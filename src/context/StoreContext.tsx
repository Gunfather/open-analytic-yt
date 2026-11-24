import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  AggregatedKpis,
  Channel,
  ChannelGroup,
  ChartViewMode,
  CompetitorChannel,
  DailyMetric,
  KpiMetricKey,
  Language,
  NavTab,
  PeriodOption,
  ScheduledTask,
  SmtpConfig,
  VideoItem,
} from '../types/youtube';
import { exportAiPdfReport } from '../utils/exportPdfReport';
import { TranslationKeys, TRANSLATIONS, UiLanguage } from '../i18n/translations';
import {
  buildDailyMetricsFromVideos,
  generateSeedMetricsAndVideos,
  INITIAL_CHANNELS,
  INITIAL_LANGUAGES,
} from '../data/seedData';
import {
  fetchCompetitorChannelSnapshot,
  fetchPublicChannelWithoutKey,
  fetchRecentVideosForChannel,
  fetchYouTubeChannelData,
  parseYouTubeStudioCsv,
} from '../services/youtubeApi';

const STORAGE_KEY = 'pulseyt_store_v1';

interface PersistedState {
  languages: Language[];
  groups?: ChannelGroup[];
  channels: Channel[];
  metrics: DailyMetric[];
  videos: VideoItem[];
  apiKey: string;
  aiConfig?: {
    provider: 'gemini' | 'openai' | 'deepseek' | 'groq' | 'openrouter' | 'nvidia';
    apiKey: string;
    model?: string;
  };
  scheduledTasks?: ScheduledTask[];
  smtpConfig?: SmtpConfig;
  competitors?: CompetitorChannel[];
}

interface StoreContextValue {
  languages: Language[];
  groups: ChannelGroup[];
  channels: Channel[];
  filteredChannels: Channel[];
  metrics: DailyMetric[];
  videos: VideoItem[];
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  period: PeriodOption;
  setPeriod: (p: PeriodOption) => void;
  selectedLanguageId: string; // 'all' | languageId
  setSelectedLanguageId: (id: string) => void;
  selectedGroupId: string; // 'all' | groupId
  setSelectedGroupId: (id: string) => void;
  selectedChannelId: string; // 'all' | channelId
  setSelectedChannelId: (id: string) => void;
  chartViewMode: ChartViewMode;
  setChartViewMode: (mode: ChartViewMode) => void;
  selectedKpi: KpiMetricKey;
  setSelectedKpi: (kpi: KpiMetricKey) => void;
  apiKey: string;
  setApiKey: (key: string) => void;
  isSyncing: boolean;
  lastSyncMessage: string | null;
  aggregatedKpis: AggregatedKpis;
  addChannel: (input: {
    name: string;
    handle: string;
    youtubeChannelId?: string;
    languageId: string;
    groupId?: string;
    color: string;
    rpm?: number;
    ctr?: number;
  }) => Promise<void>;
  updateChannel: (id: string, patch: Partial<Channel>) => void;
  deleteChannel: (id: string) => void;
  toggleChannelActive: (id: string) => void;
  addLanguage: (input: { name: string; code: string; flag: string; color: string }) => Language;
  addGroup: (input: {
    name: string;
    icon: string;
    color: string;
    channelIds?: string[];
  }) => ChannelGroup;
  deleteGroup: (id: string) => void;
  syncAllChannels: () => Promise<void>;
  autoSyncMinutes: 0 | 2 | 10 | 20;
  setAutoSyncMinutes: (minutes: 0 | 2 | 10 | 20) => void;
  syncChannelVideos: (channelId: string) => Promise<void>;
  importYouTubeStudioCsv: (channelId: string, csvText: string) => number;
  scheduledTasks: ScheduledTask[];
  smtpConfig: SmtpConfig;
  setSmtpConfig: (cfg: SmtpConfig) => void;
  uiLanguage: UiLanguage;
  setUiLanguage: (lang: UiLanguage) => void;
  t: (key: TranslationKeys) => string;
  addScheduledTask: (
    task: Omit<ScheduledTask, 'id' | 'lastRunAt' | 'lastRunKey' | 'lastStatus'>
  ) => void;
  updateScheduledTask: (id: string, patch: Partial<ScheduledTask>) => void;
  deleteScheduledTask: (id: string) => void;
  toggleScheduledTask: (id: string) => void;
  runScheduledTaskNow: (id: string) => Promise<{ ok: boolean; message: string }>;
  aiConfig: { provider: 'gemini' | 'openai' | 'deepseek' | 'groq' | 'openrouter' | 'nvidia'; apiKey: string; model?: string };
  setAiConfig: (cfg: {
    provider: 'gemini' | 'openai' | 'deepseek' | 'groq' | 'openrouter' | 'nvidia';
    apiKey: string;
    model?: string;
  }) => void;
  exportBackupJson: () => string;
  importBackupJson: (jsonText: string) => { ok: boolean; message: string };
  resetDemoData: () => void;
  competitors: CompetitorChannel[];
  isSyncingCompetitors: boolean;
  addCompetitor: (input: {
    handle: string;
    nicheTag: string;
    languageId: string;
  }) => Promise<void>;
  removeCompetitor: (id: string) => void;
  syncCompetitors: () => Promise<void>;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function deduplicateChannelsList(channels: Channel[]): {
  uniqueChannels: Channel[];
  removedIds: Set<string>;
} {
  const seenHandles = new Set<string>();
  const seenYtIds = new Set<string>();
  const seenGroupLang = new Set<string>();
  const uniqueChannels: Channel[] = [];
  const removedIds = new Set<string>();

  for (const ch of channels) {
    const normHandle = ch.handle ? ch.handle.trim().toLowerCase().replace(/^@/, '') : '';
    const normYtId = ch.youtubeChannelId ? ch.youtubeChannelId.trim() : '';
    const groupLangKey =
      ch.groupId && ch.languageId
        ? `${ch.groupId}::${ch.languageId}::${normHandle || ch.name.trim().toLowerCase()}`
        : '';

    const isDupHandle = Boolean(normHandle && seenHandles.has(normHandle));
    const isDupYt = Boolean(normYtId && seenYtIds.has(normYtId));
    const isDupGroupLang = Boolean(groupLangKey && seenGroupLang.has(groupLangKey));

    if (isDupHandle || isDupYt || isDupGroupLang) {
      removedIds.add(ch.id);
    } else {
      if (normHandle) seenHandles.add(normHandle);
      if (normYtId) seenYtIds.add(normYtId);
      if (groupLangKey) seenGroupLang.add(groupLangKey);
      uniqueChannels.push(ch);
    }
  }

  return { uniqueChannels, removedIds };
}

function loadInitialState(): PersistedState {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as PersistedState;
        if (Array.isArray(parsed.channels) && Array.isArray(parsed.languages)) {
          const { uniqueChannels, removedIds } = deduplicateChannelsList(parsed.channels);
          const cleanVideos = (parsed.videos || []).filter((v) => !removedIds.has(v.channelId));
          const cleanMetrics = (parsed.metrics || []).filter((m) => !removedIds.has(m.channelId));
          const cleanParsed = {
            ...parsed,
            channels: uniqueChannels,
            videos: cleanVideos,
            metrics: cleanMetrics,
          };
          // Ensure channels with real videos have metrics derived from their real videos
          const realVideoChannelIds = new Set(
            cleanVideos
              .filter((v) => !v.id.startsWith('vid-'))
              .map((v) => v.channelId)
          );
          if (realVideoChannelIds.size > 0) {
            const rebuiltMetrics: DailyMetric[] = cleanMetrics.filter(
              (m) => !realVideoChannelIds.has(m.channelId)
            );
            for (const ch of uniqueChannels) {
              if (!realVideoChannelIds.has(ch.id)) continue;
              const chVideos = cleanVideos.filter((v) => v.channelId === ch.id);
              rebuiltMetrics.push(...buildDailyMetricsFromVideos(ch, chVideos, 90));
            }
            return { ...cleanParsed, metrics: rebuiltMetrics };
          }
          return cleanParsed;
        }
      }
    } catch {
    // Fallback to seed data
  }
  return {
    languages: INITIAL_LANGUAGES,
    groups: [],
    channels: [],
    metrics: [],
    videos: [],
    apiKey: '',
    scheduledTasks: [],
  };
}

export const PERIOD_DAYS: Record<PeriodOption, number> = {
  '24h': 1,
  '48h': 2,
  '7d': 7,
  '14d': 14,
  '30d': 30,
  '90d': 90,
};

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PersistedState>(loadInitialState);
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [period, setPeriod] = useState<PeriodOption>('30d');
  const [selectedLanguageId, setSelectedLanguageId] = useState<string>('all');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('all');
  const [selectedChannelId, setSelectedChannelId] = useState<string>('all');
  const [chartViewMode, setChartViewMode] = useState<ChartViewMode>('combined');
  const [selectedKpi, setSelectedKpi] = useState<KpiMetricKey>('views');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSyncingCompetitors, setIsSyncingCompetitors] = useState(false);
  const [lastSyncMessage, setLastSyncMessage] = useState<string | null>(null);
  const [uiLanguage, setUiLanguage] = useState<UiLanguage>(() => {
    try {
      const saved = localStorage.getItem('open_analytic_ui_lang') as UiLanguage | null;
      if (saved && saved in TRANSLATIONS) return saved;
    } catch {
      // ignore
    }
    return 'en';
  });
  const [autoSyncMinutes, setAutoSyncMinutesState] = useState<0 | 2 | 10 | 20>(() => {
    try {
      const savedMins = localStorage.getItem('pulseyt_auto_sync_minutes');
      if (savedMins !== null) {
        const parsed = Number(savedMins);
        if (parsed === 0 || parsed === 2 || parsed === 10 || parsed === 20) {
          return parsed;
        }
      }
      const legacySaved = localStorage.getItem('pulseyt_auto_sync');
      if (legacySaved === 'false') return 0;
    } catch {
      // ignore
    }
    return 20;
  });
  const setAutoSyncMinutes = (minutes: 0 | 2 | 10 | 20) => {
    setAutoSyncMinutesState(minutes);
    try {
      localStorage.setItem('pulseyt_auto_sync_minutes', String(minutes));
      localStorage.setItem('pulseyt_auto_sync', String(minutes > 0));
    } catch {
      // ignore
    }
  };
  const syncRef = useRef<() => Promise<void>>();
  const isSyncingRef = useRef(false);

  useEffect(() => {
    isSyncingRef.current = isSyncing;
  }, [isSyncing]);

  useEffect(() => {
    try {
      localStorage.setItem('open_analytic_ui_lang', uiLanguage);
    } catch {
      // ignore
    }
  }, [uiLanguage]);

  const t = (key: TranslationKeys): string => {
    return TRANSLATIONS[uiLanguage]?.[key] ?? TRANSLATIONS.en[key];
  };

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore storage quota errors
    }
  }, [state]);

  // Proactive channel deduplication: prevents duplicate channel counts
  useEffect(() => {
    const { uniqueChannels, removedIds } = deduplicateChannelsList(state.channels);
    if (removedIds.size > 0) {
      setState((prev) => ({
        ...prev,
        channels: uniqueChannels,
        videos: (prev.videos || []).filter((v) => !removedIds.has(v.channelId)),
        metrics: (prev.metrics || []).filter((m) => !removedIds.has(m.channelId)),
      }));
    }
  }, [state.channels]);

  const filteredChannels = useMemo(() => {
    return state.channels.filter((ch) => {
      if (!ch.isActive) return false;
      if (selectedLanguageId !== 'all' && ch.languageId !== selectedLanguageId) return false;
      if (selectedGroupId !== 'all' && ch.groupId !== selectedGroupId) return false;
      if (selectedChannelId !== 'all' && ch.id !== selectedChannelId) return false;
      return true;
    });
  }, [state.channels, selectedLanguageId, selectedGroupId, selectedChannelId]);

  const aggregatedKpis = useMemo<AggregatedKpis>(() => {
    const days = PERIOD_DAYS[period];
    const activeIds = new Set(filteredChannels.map((c) => c.id));

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentStart = new Date(today);
    currentStart.setDate(today.getDate() - (days - 1));
    const prevStart = new Date(currentStart);
    prevStart.setDate(currentStart.getDate() - days);

    const curStartStr = currentStart.toISOString().slice(0, 10);
    const prevStartStr = prevStart.toISOString().slice(0, 10);

    let views = 0;
    let engagedViews = 0;
    let watchTimeHours = 0;
    let subscribers = 0;
    let likes = 0;
    let comments = 0;
    let shares = 0;
    let revenue = 0;

    let prevViews = 0;
    let prevWatchTime = 0;
    let prevSubs = 0;
    let prevEngagement = 0;
    let prevRevenue = 0;

    for (const m of state.metrics) {
      if (!activeIds.has(m.channelId)) continue;
      if (m.date >= curStartStr) {
        views += m.views;
        engagedViews += m.engagedViews;
        watchTimeHours += m.watchTimeHours;
        subscribers += m.subscribersGained;
        likes += m.likes;
        comments += m.comments;
        shares += m.shares;
        revenue += m.revenue;
      } else if (m.date >= prevStartStr && m.date < curStartStr) {
        prevViews += m.views;
        prevWatchTime += m.watchTimeHours;
        prevSubs += m.subscribersGained;
        prevEngagement += m.likes + m.comments + m.shares;
        prevRevenue += m.revenue;
      }
    }

    const engagement = likes + comments + shares;
    const calcDeltaPct = (cur: number, prev: number) =>
      prev > 0 ? Number((((cur - prev) / prev) * 100).toFixed(1)) : 0;

    const avgHookRate =
      filteredChannels.length > 0
        ? Number(
            (
              filteredChannels.reduce((acc, c) => acc + c.hookRate, 0) /
              filteredChannels.length
            ).toFixed(1)
          )
        : 0;

    const avgRpm = views > 0 ? Number(((revenue / views) * 1000).toFixed(2)) : 0;
    const avgCpm =
      filteredChannels.length > 0
        ? Number(
            (
              filteredChannels.reduce((acc, c) => acc + c.cpm, 0) /
              filteredChannels.length
            ).toFixed(2)
          )
        : 0;

    return {
      views,
      viewsDelta: views - prevViews,
      viewsDeltaPct: calcDeltaPct(views, prevViews),
      engagedViews,
      hookRate: avgHookRate,
      watchTimeHours: Number(watchTimeHours.toFixed(1)),
      watchTimeDeltaPct: calcDeltaPct(watchTimeHours, prevWatchTime),
      subscribers,
      subscribersDeltaPct: calcDeltaPct(subscribers, prevSubs),
      engagement,
      engagementDeltaPct: calcDeltaPct(engagement, prevEngagement),
      likes,
      comments,
      shares,
      revenue: Number(revenue.toFixed(2)),
      revenueDeltaPct: calcDeltaPct(revenue, prevRevenue),
      avgCpm,
      avgRpm,
    };
  }, [filteredChannels, period, state.metrics]);

  const addLanguage: StoreContextValue['addLanguage'] = ({ name, code, flag, color }) => {
    const id = code.toLowerCase().replace(/[^a-z0-9-]/g, '') || `lang-${Date.now()}`;
    const newLang: Language = {
      id,
      code: code.toUpperCase(),
      name: name.trim(),
      flag: flag.trim() || '🌐',
      color,
    };
    setState((prev) => ({
      ...prev,
      languages: [...prev.languages, newLang],
    }));
    return newLang;
  };

  const addGroup: StoreContextValue['addGroup'] = ({
    name,
    icon,
    color,
    channelIds = [],
  }) => {
    const newGroup: ChannelGroup = {
      id: `grp-${Date.now()}`,
      name: name.trim(),
      icon: icon.trim() || '📁',
      color,
    };
    const idSet = new Set(channelIds);
    setState((prev) => ({
      ...prev,
      groups: [...(prev.groups || []), newGroup],
      channels: prev.channels.map((ch) =>
        idSet.has(ch.id) ? { ...ch, groupId: newGroup.id } : ch
      ),
    }));
    return newGroup;
  };

  const deleteGroup = (id: string) => {
    setState((prev) => ({
      ...prev,
      groups: (prev.groups || []).filter((g) => g.id !== id),
      channels: prev.channels.map((ch) =>
        ch.groupId === id ? { ...ch, groupId: undefined } : ch
      ),
    }));
    if (selectedGroupId === id) {
      setSelectedGroupId('all');
    }
  };

  const addChannel: StoreContextValue['addChannel'] = async (input) => {
    const cleanHandle = input.handle.startsWith('@') ? input.handle.trim() : `@${input.handle.trim()}`;
    const normHandle = cleanHandle.toLowerCase().replace(/^@/, '');
    const cleanYtId = input.youtubeChannelId?.trim() || undefined;

    // Check if channel already exists to prevent duplicate channel entries
    const existingIndex = state.channels.findIndex((c) => {
      const cNorm = c.handle.toLowerCase().replace(/^@/, '');
      if (cNorm && cNorm === normHandle) return true;
      if (cleanYtId && c.youtubeChannelId && c.youtubeChannelId === cleanYtId) return true;
      if (
        c.groupId &&
        input.groupId &&
        c.groupId === input.groupId &&
        c.languageId === input.languageId &&
        c.name.trim().toLowerCase() === input.name.trim().toLowerCase()
      ) {
        return true;
      }
      return false;
    });

    if (existingIndex >= 0) {
      const existing = state.channels[existingIndex];
      updateChannel(existing.id, {
        name: input.name.trim() || existing.name,
        languageId: input.languageId || existing.languageId,
        groupId: input.groupId || existing.groupId,
        color: input.color || existing.color,
        rpm: input.rpm ?? existing.rpm,
        ctr: input.ctr ?? existing.ctr,
      });
      setLastSyncMessage(`Canal "${existing.name}" (${existing.handle}) já cadastrado e foi atualizado.`);
      return;
    }

    const id = `ch-${Date.now()}`;
    let newChannel: Channel = {
      id,
      youtubeChannelId: cleanYtId,
      handle: cleanHandle,
      name: input.name.trim(),
      languageId: input.languageId,
      groupId: input.groupId || undefined,
      avatarUrl: `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(
        input.name.trim().slice(0, 2).toUpperCase()
      )}`,
      color: input.color,
      isActive: true,
      subscribersTotal: 25000,
      viewsTotal: 1500000,
      videosTotal: 45,
      rpm: input.rpm ?? 2.5,
      cpm: Number(((input.rpm ?? 2.5) * 1.75).toFixed(2)),
      hookRate: 60.0,
      engagedRate: 51.5,
      ctr: input.ctr ?? 6.2,
      lastSyncedAt: new Date().toISOString(),
    };

    let newVideos: VideoItem[] = [];

    const target = input.youtubeChannelId || input.handle;
    if (state.apiKey && target) {
      try {
        const live = await fetchYouTubeChannelData(state.apiKey, target);
        newChannel = {
          ...newChannel,
          youtubeChannelId: live.youtubeChannelId,
          name: live.name,
          handle: live.handle,
          avatarUrl: live.avatarUrl,
          subscribersTotal: live.subscribersTotal,
          viewsTotal: live.viewsTotal,
          videosTotal: live.videosTotal,
          isLiveApi: true,
        };
        if (live.uploadsPlaylistId) {
          newVideos = await fetchRecentVideosForChannel(
            state.apiKey,
            newChannel,
            live.uploadsPlaylistId
          );
        }
      } catch (err) {
        setLastSyncMessage(
          err instanceof Error ? err.message : 'Falha ao buscar canal na YouTube API.'
        );
      }
    } else if (target) {
      try {
        const pub = await fetchPublicChannelWithoutKey(
          target,
          newChannel.rpm,
          newChannel.engagedRate
        );
        newChannel = {
          ...newChannel,
          youtubeChannelId: pub.youtubeChannelId || newChannel.youtubeChannelId,
          name: pub.name || newChannel.name,
          handle: pub.handle || newChannel.handle,
          avatarUrl: pub.avatarUrl || newChannel.avatarUrl,
          subscribersTotal: pub.subscribersTotal || newChannel.subscribersTotal,
          isLiveApi: true,
        };
        newVideos = pub.videos.map((v) => ({ ...v, channelId: newChannel.id }));
        setLastSyncMessage(`Canal "${newChannel.name}" sincronizado sem API Key!`);
      } catch {
        // Keeps demo metrics if offline or handle doesn't exist publicly
      }
    }

    const generated =
      newVideos.length > 0
        ? {
            metrics: buildDailyMetricsFromVideos(newChannel, newVideos, 90),
            videos: newVideos,
          }
        : generateSeedMetricsAndVideos([newChannel], 90);

    setState((prev) => ({
      ...prev,
      channels: [...prev.channels, newChannel],
      metrics: [...prev.metrics, ...generated.metrics],
      videos: [...prev.videos, ...generated.videos],
    }));
  };

  const updateChannel = (id: string, patch: Partial<Channel>) => {
    setState((prev) => ({
      ...prev,
      channels: prev.channels.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));
  };

  const deleteChannel = (id: string) => {
    setState((prev) => ({
      ...prev,
      channels: prev.channels.filter((c) => c.id !== id),
      metrics: prev.metrics.filter((m) => m.channelId !== id),
      videos: prev.videos.filter((v) => v.channelId !== id),
    }));
    if (selectedChannelId === id) {
      setSelectedChannelId('all');
    }
  };

  const toggleChannelActive = (id: string) => {
    setState((prev) => ({
      ...prev,
      channels: prev.channels.map((c) => (c.id === id ? { ...c, isActive: !c.isActive } : c)),
    }));
  };

  const syncAllChannels = async () => {
    setIsSyncing(true);
    setLastSyncMessage(null);
    try {
      const nowIso = new Date().toISOString();
      const updatedChannels: Channel[] = [];
      let updatedVideos = [...state.videos];
      let updatedMetrics = [...state.metrics];
      let liveCount = 0;

      for (const ch of state.channels) {
        const target = ch.youtubeChannelId || ch.handle;
        if (!target) {
          updatedChannels.push({ ...ch, lastSyncedAt: nowIso });
          continue;
        }

        try {
          if (state.apiKey) {
            const live = await fetchYouTubeChannelData(state.apiKey, target);
            const nextChannel: Channel = {
              ...ch,
              youtubeChannelId: live.youtubeChannelId,
              name: live.name,
              avatarUrl: live.avatarUrl,
              subscribersTotal: live.subscribersTotal,
              viewsTotal: live.viewsTotal,
              videosTotal: live.videosTotal,
              lastSyncedAt: nowIso,
              isLiveApi: true,
            };
            updatedChannels.push(nextChannel);
            liveCount++;

            if (live.uploadsPlaylistId) {
              const chVideos = await fetchRecentVideosForChannel(
                state.apiKey,
                nextChannel,
                live.uploadsPlaylistId,
                25
              );
              if (chVideos.length > 0) {
                updatedVideos = [
                  ...updatedVideos.filter((v) => v.channelId !== ch.id),
                  ...chVideos,
                ];
                updatedMetrics = [
                  ...updatedMetrics.filter((m) => m.channelId !== ch.id),
                  ...buildDailyMetricsFromVideos(nextChannel, chVideos, 90),
                ];
              }
            }
          } else {
            const pub = await fetchPublicChannelWithoutKey(target, ch.rpm, ch.engagedRate);
            const chVideos = pub.videos.map((v) => ({ ...v, channelId: ch.id }));
            const summedViews = chVideos.reduce((s, v) => s + v.views, 0);
            const nextChannel: Channel = {
              ...ch,
              youtubeChannelId: pub.youtubeChannelId || ch.youtubeChannelId,
              name: pub.name || ch.name,
              avatarUrl: pub.avatarUrl || ch.avatarUrl,
              subscribersTotal: pub.subscribersTotal || ch.subscribersTotal,
              viewsTotal: summedViews > 0 ? summedViews : ch.viewsTotal,
              videosTotal: chVideos.length > 0 ? chVideos.length : ch.videosTotal,
              lastSyncedAt: nowIso,
              isLiveApi: true,
            };
            updatedChannels.push(nextChannel);
            liveCount++;

            if (chVideos.length > 0) {
              updatedVideos = [
                ...updatedVideos.filter((v) => v.channelId !== ch.id),
                ...chVideos,
              ];
              updatedMetrics = [
                ...updatedMetrics.filter((m) => m.channelId !== ch.id),
                ...buildDailyMetricsFromVideos(nextChannel, chVideos, 90),
              ];
            }
          }
        } catch {
          updatedChannels.push({ ...ch, lastSyncedAt: nowIso });
        }
      }

      setState((prev) => ({
        ...prev,
        channels: updatedChannels,
        videos: updatedVideos,
        metrics: updatedMetrics,
      }));
      setLastSyncMessage(
        liveCount > 0
          ? `Sincronizados ${liveCount} canal(is) com dados reais (${
              state.apiKey ? 'YouTube API v3' : 'Feed Público'
            }).`
          : 'Nenhum canal pôde ser sincronizado.'
      );
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    syncRef.current = syncAllChannels;
  });

  useEffect(() => {
    if (autoSyncMinutes <= 0) return;
    const intervalId = window.setInterval(() => {
      if (!isSyncingRef.current && syncRef.current) {
        void syncRef.current();
      }
    }, autoSyncMinutes * 60 * 1000);
    return () => window.clearInterval(intervalId);
  }, [autoSyncMinutes]);

  const syncChannelVideos = async (channelId: string) => {
    const ch = state.channels.find((c) => c.id === channelId);
    if (!ch) return;
    const target = ch.youtubeChannelId || ch.handle;
    if (!target) return;

    setLastSyncMessage(`Carregando vídeos de ${ch.name}...`);
    const nowIso = new Date().toISOString();

    try {
      let nextChannel: Channel = { ...ch, lastSyncedAt: nowIso };
      let chVideos: VideoItem[] = [];

      if (state.apiKey) {
        const live = await fetchYouTubeChannelData(state.apiKey, target);
        nextChannel = {
          ...nextChannel,
          youtubeChannelId: live.youtubeChannelId,
          name: live.name,
          avatarUrl: live.avatarUrl,
          subscribersTotal: live.subscribersTotal,
          viewsTotal: live.viewsTotal,
          videosTotal: live.videosTotal,
          isLiveApi: true,
        };
        if (live.uploadsPlaylistId) {
          chVideos = await fetchRecentVideosForChannel(
            state.apiKey,
            nextChannel,
            live.uploadsPlaylistId,
            25
          );
        }
      } else {
        const pub = await fetchPublicChannelWithoutKey(target, ch.rpm, ch.engagedRate);
        chVideos = pub.videos.map((v) => ({ ...v, channelId: ch.id }));
        const summedViews = chVideos.reduce((s, v) => s + v.views, 0);
        nextChannel = {
          ...nextChannel,
          youtubeChannelId: pub.youtubeChannelId || ch.youtubeChannelId,
          name: pub.name || ch.name,
          avatarUrl: pub.avatarUrl || ch.avatarUrl,
          subscribersTotal: pub.subscribersTotal || ch.subscribersTotal,
          viewsTotal: summedViews > 0 ? summedViews : ch.viewsTotal,
          videosTotal: chVideos.length > 0 ? chVideos.length : ch.videosTotal,
          isLiveApi: true,
        };
      }

      setState((prev) => ({
        ...prev,
        channels: prev.channels.map((c) => (c.id === channelId ? nextChannel : c)),
        videos:
          chVideos.length > 0
            ? [...prev.videos.filter((v) => v.channelId !== channelId), ...chVideos]
            : prev.videos,
        metrics:
          chVideos.length > 0
            ? [
                ...prev.metrics.filter((m) => m.channelId !== channelId),
                ...buildDailyMetricsFromVideos(nextChannel, chVideos, 90),
              ]
            : prev.metrics,
      }));
      setLastSyncMessage(
        `${chVideos.length} vídeo(s) carregado(s) para ${nextChannel.name}!`
      );
    } catch (err) {
      setLastSyncMessage(
        err instanceof Error
          ? err.message
          : `Falha ao carregar vídeos de ${ch.name}.`
      );
    }
  };

  const setApiKey = (apiKey: string) => {
    setState((prev) => ({ ...prev, apiKey: apiKey.trim() }));
  };

  const importYouTubeStudioCsv = (channelId: string, csvText: string): number => {
    const channel = state.channels.find((c) => c.id === channelId);
    if (!channel) return 0;
    const parsed = parseYouTubeStudioCsv(csvText, channel);
    if (parsed.length === 0) return 0;

    const importedDates = new Set(parsed.map((p) => p.date));
    setState((prev) => ({
      ...prev,
      metrics: [
        ...prev.metrics.filter(
          (m) => !(m.channelId === channelId && importedDates.has(m.date))
        ),
        ...parsed,
      ],
    }));
    setLastSyncMessage(
      `${parsed.length} dia(s) importados do YouTube Studio para ${channel.name}!`
    );
    return parsed.length;
  };

  const DEFAULT_SMTP: SmtpConfig = {
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    user: '',
    pass: '',
  };

  const setSmtpConfig = (cfg: SmtpConfig) => {
    setState((prev) => ({ ...prev, smtpConfig: cfg }));
  };

  const addScheduledTask: StoreContextValue['addScheduledTask'] = (taskInput) => {
    const newTask: ScheduledTask = {
      ...taskInput,
      id: `task-${Date.now()}`,
    };
    setState((prev) => ({
      ...prev,
      scheduledTasks: [...(prev.scheduledTasks || []), newTask],
    }));
  };

  const updateScheduledTask = (id: string, patch: Partial<ScheduledTask>) => {
    setState((prev) => ({
      ...prev,
      scheduledTasks: (prev.scheduledTasks || []).map((t) =>
        t.id === id ? { ...t, ...patch } : t
      ),
    }));
  };

  const deleteScheduledTask = (id: string) => {
    setState((prev) => ({
      ...prev,
      scheduledTasks: (prev.scheduledTasks || []).filter((t) => t.id !== id),
    }));
  };

  const toggleScheduledTask = (id: string) => {
    setState((prev) => ({
      ...prev,
      scheduledTasks: (prev.scheduledTasks || []).map((t) =>
        t.id === id ? { ...t, isActive: !t.isActive } : t
      ),
    }));
  };

  const runScheduledTaskNow = async (
    id: string
  ): Promise<{ ok: boolean; message: string }> => {
    const task = (state.scheduledTasks || []).find((t) => t.id === id);
    if (!task) return { ok: false, message: 'Tarefa não encontrada.' };

    const matchingChannels = state.channels.filter((ch) => {
      if (!ch.isActive) return false;
      if (task.languageId !== 'all' && ch.languageId !== task.languageId) return false;
      if (task.groupId !== 'all' && ch.groupId !== task.groupId) return false;
      if (task.channelId !== 'all' && ch.id !== task.channelId) return false;
      return true;
    });

    const { filename, base64 } = exportAiPdfReport({
      period: task.period,
      days: PERIOD_DAYS[task.period],
      selectedLanguageId: task.languageId,
      selectedGroupId: task.groupId,
      selectedChannelId: task.channelId,
      languages: state.languages,
      groups: state.groups || [],
      filteredChannels: matchingChannels,
      metrics: state.metrics,
      videos: state.videos,
      sections: task.sections,
      topVideosLimit: task.topVideosLimit,
      aiNote: task.aiNote,
      returnBase64: true,
    });

    const smtp = state.smtpConfig || DEFAULT_SMTP;
    const nowIso = new Date().toISOString();
    const now = new Date();
    const runKey = `${now.toISOString().slice(0, 10)} ${now
      .getHours()
      .toString()
      .padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    try {
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          smtp,
          to: task.toEmail,
          subject: `[Open Analytic YT] ${task.name} (${task.period})`,
          text: `Olá!\n\nSegue em anexo o relatório agendado "${task.name}" referente ao período "${task.period}" (${matchingChannels.length} canal(is)).\n\n${
            task.aiNote ? `Instrução para IA: ${task.aiNote}\n\n` : ''
          }Enviado automaticamente pelo Open Analytic YT.`,
          pdfBase64: base64,
          filename,
        }),
      });

      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        const errMsg = data.error || `Erro HTTP ${res.status}`;
        setState((prev) => ({
          ...prev,
          scheduledTasks: (prev.scheduledTasks || []).map((t) =>
            t.id === id
              ? { ...t, lastRunAt: nowIso, lastRunKey: runKey, lastStatus: `Erro: ${errMsg}` }
              : t
          ),
        }));
        return { ok: false, message: errMsg };
      }

      setState((prev) => ({
        ...prev,
        scheduledTasks: (prev.scheduledTasks || []).map((t) =>
          t.id === id
            ? {
                ...t,
                lastRunAt: nowIso,
                lastRunKey: runKey,
                lastStatus: 'Enviado com sucesso',
                isActive: t.frequency === 'once' ? false : t.isActive,
              }
            : t
        ),
      }));
      setLastSyncMessage(`Relatório "${task.name}" enviado para ${task.toEmail}!`);
      return { ok: true, message: `Enviado para ${task.toEmail}` };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Falha de rede ao enviar e-mail.';
      setState((prev) => ({
        ...prev,
        scheduledTasks: (prev.scheduledTasks || []).map((t) =>
          t.id === id
            ? { ...t, lastRunAt: nowIso, lastRunKey: runKey, lastStatus: `Erro: ${errMsg}` }
            : t
        ),
      }));
      return { ok: false, message: errMsg };
    }
  };

  const runTaskRef = useRef(runScheduledTaskNow);
  useEffect(() => {
    runTaskRef.current = runScheduledTaskNow;
  });

  useEffect(() => {
    const checkSchedules = () => {
      const now = new Date();
      const currentDate = now.toISOString().slice(0, 10);
      const currentHHMM = `${now.getHours().toString().padStart(2, '0')}:${now
        .getMinutes()
        .toString()
        .padStart(2, '0')}`;
      const runKey = `${currentDate} ${currentHHMM}`;
      const weekday = now.getDay();
      const monthDay = now.getDate();

      for (const task of state.scheduledTasks || []) {
        if (!task.isActive) continue;
        if (task.time !== currentHHMM) continue;
        if (task.lastRunKey === runKey) continue;

        const matchesFrequency =
          task.frequency === 'daily' ||
          (task.frequency === 'weekly' && task.weekday === weekday) ||
          (task.frequency === 'monthly' && task.monthDay === monthDay) ||
          (task.frequency === 'once' && task.onceDate === currentDate);

        if (matchesFrequency) {
          void runTaskRef.current(task.id);
        }
      }
    };

    const id = window.setInterval(checkSchedules, 30 * 1000);
    return () => window.clearInterval(id);
  }, [state.scheduledTasks]);

  const setAiConfig = (cfg: {
    provider: 'gemini' | 'openai' | 'deepseek' | 'groq' | 'openrouter' | 'nvidia';
    apiKey: string;
    model?: string;
  }) => {
    setState((prev) => ({
      ...prev,
      aiConfig: {
        provider: cfg.provider,
        apiKey: cfg.apiKey.trim(),
        model: cfg.model?.trim() || undefined,
      },
    }));
  };

  const addCompetitor: StoreContextValue['addCompetitor'] = async ({
    handle,
    nicheTag,
    languageId,
  }) => {
    const cleanTarget = handle.trim();
    if (!cleanTarget) return;
    const norm = cleanTarget.toLowerCase().replace(/^@/, '');
    const existing = (state.competitors || []).find(
      (c) =>
        c.handle.toLowerCase().replace(/^@/, '') === norm ||
        (c.youtubeChannelId && c.youtubeChannelId === cleanTarget)
    );

    const snapshot = await fetchCompetitorChannelSnapshot({
      apiKey: state.apiKey,
      target: cleanTarget,
      nicheTag,
      languageId,
      existingId: existing?.id,
    });

    setState((prev) => {
      const list = prev.competitors || [];
      const filtered = list.filter(
        (c) =>
          c.id !== snapshot.id &&
          c.handle.toLowerCase().replace(/^@/, '') !==
            snapshot.handle.toLowerCase().replace(/^@/, '') &&
          (!snapshot.youtubeChannelId || c.youtubeChannelId !== snapshot.youtubeChannelId)
      );
      return {
        ...prev,
        competitors: [snapshot, ...filtered],
      };
    });
    setLastSyncMessage(`Concorrente "${snapshot.name}" sincronizado no Radar!`);
  };

  const removeCompetitor = (id: string) => {
    setState((prev) => ({
      ...prev,
      competitors: (prev.competitors || []).filter((c) => c.id !== id),
    }));
  };

  const syncCompetitors = async () => {
    const list = state.competitors || [];
    if (list.length === 0) return;
    setIsSyncingCompetitors(true);
    try {
      const updated: CompetitorChannel[] = [];
      for (const comp of list) {
        try {
          const snap = await fetchCompetitorChannelSnapshot({
            apiKey: state.apiKey,
            target: comp.youtubeChannelId || comp.handle,
            nicheTag: comp.nicheTag,
            languageId: comp.languageId,
            existingId: comp.id,
          });
          updated.push(snap);
        } catch {
          updated.push(comp);
        }
      }
      setState((prev) => ({ ...prev, competitors: updated }));
      setLastSyncMessage(`Radar atualizado: ${updated.length} concorrente(s) analisado(s).`);
    } finally {
      setIsSyncingCompetitors(false);
    }
  };

  const exportBackupJson = () => {
    return JSON.stringify(
      {
        version: '2.0.0',
        exportedAt: new Date().toISOString(),
        languages: state.languages,
        groups: state.groups || [],
        channels: state.channels,
        metrics: state.metrics,
        videos: state.videos,
        scheduledTasks: state.scheduledTasks || [],
        competitors: state.competitors || [],
      },
      null,
      2
    );
  };

  const importBackupJson = (jsonText: string): { ok: boolean; message: string } => {
    try {
      const parsed = JSON.parse(jsonText) as Partial<PersistedState>;
      if (!Array.isArray(parsed.channels) || !Array.isArray(parsed.languages)) {
        return { ok: false, message: 'Invalid backup file format.' };
      }
      setState((prev) => ({
        ...prev,
        languages: parsed.languages!,
        groups: Array.isArray(parsed.groups) ? parsed.groups : [],
        channels: parsed.channels!,
        metrics: Array.isArray(parsed.metrics) ? parsed.metrics : [],
        videos: Array.isArray(parsed.videos) ? parsed.videos : [],
        scheduledTasks: Array.isArray(parsed.scheduledTasks)
          ? parsed.scheduledTasks
          : [],
        competitors: Array.isArray(parsed.competitors)
          ? parsed.competitors
          : prev.competitors || [],
      }));
      setSelectedLanguageId('all');
      setSelectedGroupId('all');
      setSelectedChannelId('all');
      return {
        ok: true,
        message: `Imported ${parsed.channels.length} channel(s) and ${
          (parsed.groups || []).length
        } group(s).`,
      };
    } catch {
      return { ok: false, message: 'Could not parse JSON backup file.' };
    }
  };

  const resetDemoData = () => {
    const { metrics, videos } = generateSeedMetricsAndVideos(INITIAL_CHANNELS, 90);
    setState({
      languages: INITIAL_LANGUAGES,
      channels: INITIAL_CHANNELS,
      metrics,
      videos,
      apiKey: state.apiKey,
    });
    setSelectedLanguageId('all');
    setSelectedChannelId('all');
    setLastSyncMessage('Dados de demonstração (8 canais / 4 idiomas) restaurados.');
  };

  return (
    <StoreContext.Provider
      value={{
        languages: state.languages,
        groups: state.groups || [],
        channels: state.channels,
        filteredChannels,
        metrics: state.metrics,
        videos: state.videos,
        activeTab,
        setActiveTab,
        period,
        setPeriod,
        selectedLanguageId,
        setSelectedLanguageId,
        selectedGroupId,
        setSelectedGroupId,
        selectedChannelId,
        setSelectedChannelId,
        chartViewMode,
        setChartViewMode,
        selectedKpi,
        setSelectedKpi,
        apiKey: state.apiKey,
        setApiKey,
        isSyncing,
        lastSyncMessage,
        aggregatedKpis,
        addChannel,
        updateChannel,
        deleteChannel,
        toggleChannelActive,
        addLanguage,
        addGroup,
        deleteGroup,
        syncAllChannels,
        autoSyncMinutes,
        setAutoSyncMinutes,
        syncChannelVideos,
        importYouTubeStudioCsv,
        scheduledTasks: state.scheduledTasks || [],
        smtpConfig: state.smtpConfig || DEFAULT_SMTP,
        setSmtpConfig,
        uiLanguage,
        setUiLanguage,
        t,
        addScheduledTask,
        updateScheduledTask,
        deleteScheduledTask,
        toggleScheduledTask,
        runScheduledTaskNow,
        aiConfig: state.aiConfig || { provider: 'gemini', apiKey: '' },
        setAiConfig,
        exportBackupJson,
        importBackupJson,
        resetDemoData,
        competitors: state.competitors || [],
        isSyncingCompetitors,
        addCompetitor,
        removeCompetitor,
        syncCompetitors,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}
