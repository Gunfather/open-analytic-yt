import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  AggregatedKpis,
  Channel,
  ChannelGroup,
  ChannelNiche,
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
  niches?: ChannelNiche[];
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
  niches: ChannelNiche[];
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
  selectedNicheId: string; // 'all' | nicheId
  setSelectedNicheId: (id: string) => void;
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
    nicheId?: string;
    color: string;
    rpm?: number;
    ctr?: number;
  }) => Promise<void>;
  updateChannel: (id: string, patch: Partial<Channel>) => void;
  deleteChannel: (id: string) => void;
  deleteVideo: (id: string) => void;
  addVideoManual: (
    channelId: string,
    videoUrlOrId: string
  ) => Promise<{ ok: boolean; title?: string; error?: string }>;
  toggleChannelActive: (id: string) => void;
  addLanguage: (input: { name: string; code: string; flag: string; color: string }) => Language;
  addGroup: (input: {
    name: string;
    icon: string;
    color: string;
    channelIds?: string[];
  }) => ChannelGroup;
  deleteGroup: (id: string) => void;
  addNiche: (input: {
    name: string;
    keywords?: string;
    icon: string;
    color: string;
    channelIds?: string[];
  }) => ChannelNiche;
  deleteNiche: (id: string) => void;
  pendingNicheQuery: string | null;
  openNicheExplorerWithQuery: (query: string) => void;
  clearPendingNicheQuery: () => void;
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

          const initialChannelIds = new Set(INITIAL_CHANNELS.map((ic) => ic.id));

          // Strip fake demo videos (id starting with 'vid-') from custom channels added by the user
          const cleanVideos = (parsed.videos || []).filter((v) => {
            if (removedIds.has(v.channelId)) return false;
            if (v.id.startsWith('vid-') && !initialChannelIds.has(v.channelId)) {
              return false;
            }
            return true;
          });

          // Compute actual real video counts for custom channels
          const channelVideoCount = new Map<string, number>();
          const channelViewsCount = new Map<string, number>();
          for (const v of cleanVideos) {
            channelVideoCount.set(v.channelId, (channelVideoCount.get(v.channelId) || 0) + 1);
            channelViewsCount.set(v.channelId, (channelViewsCount.get(v.channelId) || 0) + (v.views || 0));
          }

          const fixedChannels = uniqueChannels.map((ch) => {
            if (!initialChannelIds.has(ch.id)) {
              const actualVids = channelVideoCount.get(ch.id) || 0;
              const actualViews = channelViewsCount.get(ch.id) || 0;
              if (actualVids === 0) {
                return {
                  ...ch,
                  videosTotal: 0,
                  viewsTotal: 0,
                  subscribersTotal: ch.isLiveApi ? ch.subscribersTotal : 0,
                };
              }
              return {
                ...ch,
                videosTotal: actualVids,
                viewsTotal: actualViews > 0 ? actualViews : ch.viewsTotal,
              };
            }
            return ch;
          });

          // Clean metrics: if a custom channel has 0 real videos, drop any fake seed daily metrics
          const cleanMetrics = (parsed.metrics || []).filter((m) => {
            if (removedIds.has(m.channelId)) return false;
            if (!initialChannelIds.has(m.channelId) && (channelVideoCount.get(m.channelId) || 0) === 0) {
              return false;
            }
            return true;
          });

          const cleanParsed = {
            ...parsed,
            channels: fixedChannels,
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
            for (const ch of fixedChannels) {
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
      // Fallback to seed data below
    }
  const seed = generateSeedMetricsAndVideos(INITIAL_CHANNELS, 90);
  return {
    languages: INITIAL_LANGUAGES,
    groups: [],
    channels: INITIAL_CHANNELS,
    metrics: seed.metrics,
    videos: seed.videos,
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
  const [selectedNicheId, setSelectedNicheId] = useState<string>('all');
  const [selectedChannelId, setSelectedChannelId] = useState<string>('all');
  const [pendingNicheQuery, setPendingNicheQuery] = useState<string | null>(null);
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
      // If storage quota exceeded, trim historical metrics and retry safely
      try {
        const trimmedState: PersistedState = {
          ...state,
          metrics: state.metrics.slice(-1500),
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmedState));
      } catch {
        // Ignore quota error if still overflowing
      }
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
      if (selectedNicheId !== 'all' && ch.nicheId !== selectedNicheId) return false;
      if (selectedChannelId !== 'all' && ch.id !== selectedChannelId) return false;
      return true;
    });
  }, [state.channels, selectedLanguageId, selectedGroupId, selectedNicheId, selectedChannelId]);

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

  const addNiche: StoreContextValue['addNiche'] = ({
    name,
    keywords,
    icon,
    color,
    channelIds = [],
  }) => {
    const newNiche: ChannelNiche = {
      id: `niche-${Date.now()}`,
      name: name.trim(),
      keywords: keywords?.trim() || undefined,
      icon: icon.trim() || '🎯',
      color,
    };
    const idSet = new Set(channelIds);
    setState((prev) => ({
      ...prev,
      niches: [...(prev.niches || []), newNiche],
      channels: prev.channels.map((ch) =>
        idSet.has(ch.id) ? { ...ch, nicheId: newNiche.id } : ch
      ),
    }));
    return newNiche;
  };

  const deleteNiche = (id: string) => {
    setState((prev) => ({
      ...prev,
      niches: (prev.niches || []).filter((n) => n.id !== id),
      channels: prev.channels.map((ch) =>
        ch.nicheId === id ? { ...ch, nicheId: undefined } : ch
      ),
    }));
    if (selectedNicheId === id) {
      setSelectedNicheId('all');
    }
  };

  const openNicheExplorerWithQuery = (query: string) => {
    setPendingNicheQuery(query.trim());
    setActiveTab('niche');
  };

  const clearPendingNicheQuery = () => {
    setPendingNicheQuery(null);
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
        nicheId: input.nicheId || existing.nicheId,
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
      nicheId: input.nicheId || undefined,
      avatarUrl: `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(
        input.name.trim().slice(0, 2).toUpperCase()
      )}`,
      color: input.color,
      isActive: true,
      subscribersTotal: 0,
      viewsTotal: 0,
      videosTotal: 0,
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
        newVideos = pub.videos.map((v) => ({ ...v, channelId: newChannel.id }));
        const summedViews = newVideos.reduce((s, v) => s + v.views, 0);
        newChannel = {
          ...newChannel,
          youtubeChannelId: pub.youtubeChannelId || newChannel.youtubeChannelId,
          name: pub.name || newChannel.name,
          handle: pub.handle || newChannel.handle,
          avatarUrl: pub.avatarUrl || newChannel.avatarUrl,
          subscribersTotal: pub.subscribersTotal || 0,
          viewsTotal: summedViews,
          videosTotal: newVideos.length,
          isLiveApi: true,
        };
        setLastSyncMessage(`Canal "${newChannel.name}" sincronizado sem API Key!`);
      } catch {
        // Keeps 0 metrics if offline or handle doesn't exist publicly
      }
    }

    const generated =
      newVideos.length > 0
        ? {
            metrics: buildDailyMetricsFromVideos(newChannel, newVideos, 90),
            videos: newVideos,
          }
        : {
            metrics: [],
            videos: [],
          };

    setState((prev) => ({
      ...prev,
      channels: [...prev.channels, newChannel],
      metrics: [...prev.metrics, ...generated.metrics],
      videos: [...prev.videos, ...generated.videos],
    }));
  };

  const deleteVideo = (videoId: string) => {
    setState((prev) => {
      const remainingVideos = prev.videos.filter((v) => v.id !== videoId);
      const targetVideo = prev.videos.find((v) => v.id === videoId);
      let updatedMetrics = prev.metrics;
      let updatedChannels = prev.channels;
      if (targetVideo) {
        const ch = prev.channels.find((c) => c.id === targetVideo.channelId);
        if (ch) {
          const chVideos = remainingVideos.filter((v) => v.channelId === ch.id);
          const summedViews = chVideos.reduce((s, v) => s + v.views, 0);
          updatedChannels = prev.channels.map((c) =>
            c.id === ch.id
              ? { ...c, videosTotal: chVideos.length, viewsTotal: summedViews }
              : c
          );
          updatedMetrics = [
            ...prev.metrics.filter((m) => m.channelId !== ch.id),
            ...(chVideos.length > 0 ? buildDailyMetricsFromVideos(ch, chVideos, 90) : []),
          ];
        }
      }
      return {
        ...prev,
        videos: remainingVideos,
        channels: updatedChannels,
        metrics: updatedMetrics,
      };
    });
  };

  const addVideoManual: StoreContextValue['addVideoManual'] = async (
    channelId,
    videoUrlOrId
  ) => {
    const ch = state.channels.find((c) => c.id === channelId);
    if (!ch) return { ok: false, error: 'Canal não encontrado.' };

    const cleanInput = videoUrlOrId.trim();
    if (!cleanInput) return { ok: false, error: 'Insira um link ou ID de vídeo válido.' };

    try {
      const res = await fetch(`/api/yt-video?url=${encodeURIComponent(cleanInput)}`);
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || `Erro ao buscar vídeo (${res.status})`);
      }
      const data = (await res.json()) as {
        id: string;
        title: string;
        author?: string;
        publishedAt: string;
        thumbnailUrl: string;
        durationSec: number;
        isShort: boolean;
        views: number;
        likes: number;
      };

      const newVideo: VideoItem = {
        id: data.id,
        channelId: ch.id,
        title: data.title,
        publishedAt: data.publishedAt,
        thumbnailUrl: data.thumbnailUrl,
        durationSec: data.durationSec,
        isShort: data.isShort,
        views: data.views || 10,
        engagedViews: Math.round((data.views || 10) * 0.52),
        watchTimeHours: Number(
          (((data.views || 10) * (data.isShort ? 0.65 : 3.5)) / 60).toFixed(1)
        ),
        likes: data.likes || 1,
        comments: 0,
        shares: 0,
        revenue: Number((((data.views || 10) / 1000) * (ch.rpm || 2.5)).toFixed(2)),
        hookRate: 60,
        ctr: ch.ctr ?? 6.2,
      };

      setState((prev) => {
        const alreadyExists = prev.videos.some((v) => v.id === newVideo.id);
        const updatedVideos = alreadyExists
          ? prev.videos.map((v) => (v.id === newVideo.id ? newVideo : v))
          : [newVideo, ...prev.videos];

        const chVideos = updatedVideos.filter((v) => v.channelId === ch.id);
        const updatedChannels = prev.channels.map((c) =>
          c.id === ch.id
            ? {
                ...c,
                videosTotal: chVideos.length,
                viewsTotal: chVideos.reduce((s, v) => s + v.views, 0),
              }
            : c
        );

        const updatedMetrics = [
          ...prev.metrics.filter((m) => m.channelId !== ch.id),
          ...buildDailyMetricsFromVideos(
            updatedChannels.find((c) => c.id === ch.id) || ch,
            chVideos,
            90
          ),
        ];

        return {
          ...prev,
          videos: updatedVideos,
          channels: updatedChannels,
          metrics: updatedMetrics,
        };
      });

      setLastSyncMessage(`Vídeo "${newVideo.title}" adicionado com sucesso a ${ch.name}!`);
      return { ok: true, title: newVideo.title };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Falha ao buscar vídeo';
      setLastSyncMessage(errMsg);
      return { ok: false, error: errMsg };
    }
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
      let lastApiError: string | null = null;
      let lastPubError: string | null = null;
      let fellBackToPublic = false;

      for (const ch of state.channels) {
        const target = ch.youtubeChannelId || ch.handle;
        if (!target) {
          updatedChannels.push({ ...ch, lastSyncedAt: nowIso });
          continue;
        }

        let synced = false;

        // 1) Try YouTube Data API v3 if API key is configured
        if (state.apiKey) {
          try {
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
            synced = true;

            let chVideos: VideoItem[] = [];
            if (live.uploadsPlaylistId) {
              chVideos = await fetchRecentVideosForChannel(
                state.apiKey,
                nextChannel,
                live.uploadsPlaylistId,
                25
              );
            }

            // If API uploads playlist returns 0 videos (YouTube API index lag for new Shorts),
            // fallback to public feed which checks /shorts tab directly
            if (chVideos.length === 0) {
              try {
                const pub = await fetchPublicChannelWithoutKey(target, ch.rpm, ch.engagedRate);
                if (pub.videos.length > 0) {
                  chVideos = pub.videos.map((v) => ({ ...v, channelId: ch.id }));
                  nextChannel.videosTotal = chVideos.length;
                  nextChannel.viewsTotal = chVideos.reduce((s, v) => s + v.views, 0);
                }
              } catch {}
            }

            updatedVideos = [
              ...updatedVideos.filter((v) => v.channelId !== ch.id),
              ...chVideos,
            ];
            updatedMetrics = [
              ...updatedMetrics.filter((m) => m.channelId !== ch.id),
              ...(chVideos.length > 0 ? buildDailyMetricsFromVideos(nextChannel, chVideos, 90) : []),
            ];
          } catch (apiErr) {
            lastApiError = apiErr instanceof Error ? apiErr.message : String(apiErr);
            fellBackToPublic = true;
          }
        }

        // 2) If not synced via API (no key or API quota exhausted), fall back to public feed
        if (!synced) {
          try {
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
              videosTotal: chVideos.length,
              lastSyncedAt: nowIso,
              isLiveApi: true,
            };
            updatedChannels.push(nextChannel);
            liveCount++;
            synced = true;

            updatedVideos = [
              ...updatedVideos.filter((v) => v.channelId !== ch.id),
              ...chVideos,
            ];
            updatedMetrics = [
              ...updatedMetrics.filter((m) => m.channelId !== ch.id),
              ...(chVideos.length > 0 ? buildDailyMetricsFromVideos(nextChannel, chVideos, 90) : []),
            ];
          } catch (pubErr) {
            lastPubError = pubErr instanceof Error ? pubErr.message : String(pubErr);
            updatedChannels.push({ ...ch, lastSyncedAt: nowIso });
          }
        }
      }

      setState((prev) => ({
        ...prev,
        channels: updatedChannels,
        videos: updatedVideos,
        metrics: updatedMetrics,
      }));

      if (liveCount > 0) {
        if (fellBackToPublic) {
          setLastSyncMessage(
            `Sincronizados ${liveCount} canal(is) via Feed Público (Cota da API excedida ou canal não listado).`
          );
        } else {
          setLastSyncMessage(
            `Sincronizados ${liveCount} canal(is) com dados reais (${
              state.apiKey ? 'YouTube API v3' : 'Feed Público'
            }).`
          );
        }
      } else {
        if (
          lastApiError &&
          (lastApiError.includes('403') || lastApiError.toLowerCase().includes('quota'))
        ) {
          setLastSyncMessage(
            `Cota da YouTube API excedida (403). ${lastPubError || 'Canais não encontrados no Feed Público.'}`
          );
        } else if (lastApiError) {
          setLastSyncMessage(`Nenhum canal sincronizado (${lastApiError}).`);
        } else if (lastPubError) {
          setLastSyncMessage(`Nenhum canal encontrado: ${lastPubError}`);
        } else {
          setLastSyncMessage('Nenhum canal pôde ser sincronizado. Verifique se os @handles existem no YouTube.');
        }
      }
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
      let synced = false;

      if (state.apiKey) {
        try {
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
          if (chVideos.length === 0) {
            try {
              const pub = await fetchPublicChannelWithoutKey(target, ch.rpm, ch.engagedRate);
              if (pub.videos.length > 0) {
                chVideos = pub.videos.map((v) => ({ ...v, channelId: ch.id }));
                nextChannel.videosTotal = chVideos.length;
                nextChannel.viewsTotal = chVideos.reduce((s, v) => s + v.views, 0);
              }
            } catch {}
          }
          synced = true;
        } catch {
          // Fall back to public feed below
        }
      }

      if (!synced) {
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
        videos: [...prev.videos.filter((v) => v.channelId !== channelId), ...chVideos],
        metrics: [
          ...prev.metrics.filter((m) => m.channelId !== channelId),
          ...(chVideos.length > 0 ? buildDailyMetricsFromVideos(nextChannel, chVideos, 90) : []),
        ],
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
        niches: state.niches || [],
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
        niches: Array.isArray(parsed.niches) ? parsed.niches : prev.niches || [],
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
        niches: state.niches || [],
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
        selectedNicheId,
        setSelectedNicheId,
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
        deleteVideo,
        addVideoManual,
        toggleChannelActive,
        addLanguage,
        addGroup,
        deleteGroup,
        addNiche,
        deleteNiche,
        pendingNicheQuery,
        openNicheExplorerWithQuery,
        clearPendingNicheQuery,
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
