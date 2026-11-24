import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowDownCircle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Compass,
  DollarSign,
  ExternalLink,
  Eye,
  EyeOff,
  Flame,
  Heart,
  Plus,
  Radar,
  RefreshCw,
  Search,
  TrendingUp,
  Users,
  Video,
} from 'lucide-react';
import { PERIOD_DAYS, useStore } from '../context/StoreContext';
import { ChartViewMode, KpiMetricKey, VideoItem } from '../types/youtube';
import {
  formatCompact,
  formatCurrency,
  formatHours,
  formatNumber,
} from '../utils/formatters';

function DeltaBadge({ pct }: { pct: number }) {
  const isPositive = pct >= 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-semibold font-mono-num ${
        isPositive
          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
          : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
      }`}
    >
      {isPositive ? (
        <ArrowUpRight className="w-3 h-3" />
      ) : (
        <ArrowDownRight className="w-3 h-3" />
      )}
      {isPositive ? '+' : ''}
      {pct}%
    </span>
  );
}

type SortField =
  | 'revenue'
  | 'views'
  | 'engagedViews'
  | 'subscribers'
  | 'watchTime'
  | 'engagement'
  | 'engagementRate';

export function DashboardView() {
  const {
    channels,
    filteredChannels,
    languages,
    groups,
    niches,
    competitors,
    isSyncingCompetitors,
    syncCompetitors,
    openNicheExplorerWithQuery,
    selectedNicheId,
    setSelectedNicheId,
    metrics,
    videos,
    period,
    aggregatedKpis,
    chartViewMode,
    setChartViewMode,
    selectedKpi,
    setSelectedKpi,
    setSelectedChannelId,
    setActiveTab,
    t,
  } = useStore();

  const [sortField, setSortField] = useState<SortField>('views');
  const [sortDesc, setSortDesc] = useState(true);
  const [quickNicheInput, setQuickNicheInput] = useState('');
  const [showNicheRadar, setShowNicheRadar] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('pulseyt_show_niche_radar');
      return saved === null ? true : saved === 'true';
    } catch {
      return true;
    }
  });
  const toggleNicheRadar = () => {
    setShowNicheRadar((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('pulseyt_show_niche_radar', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };
  const [showTrafficSources, setShowTrafficSources] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('pulseyt_show_traffic_sources');
      return saved === null ? true : saved === 'true';
    } catch {
      return true;
    }
  });
  const [showDemographic, setShowDemographic] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('pulseyt_show_demographic');
      return saved === null ? true : saved === 'true';
    } catch {
      return true;
    }
  });
  const [showViewerBehavior, setShowViewerBehavior] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('pulseyt_show_viewer_behavior');
      return saved === null ? true : saved === 'true';
    } catch {
      return true;
    }
  });
  const [showAudienceGrowingVideos, setShowAudienceGrowingVideos] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('pulseyt_show_audience_growing');
      return saved === null ? true : saved === 'true';
    } catch {
      return true;
    }
  });
  const [showDeviceTypes, setShowDeviceTypes] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('pulseyt_show_device_types');
      return saved === null ? true : saved === 'true';
    } catch {
      return true;
    }
  });
  const [deviceFormatTab, setDeviceFormatTab] = useState<'all' | 'videos' | 'shorts'>('all');
  const [showGeographies, setShowGeographies] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('pulseyt_show_geographies');
      return saved === null ? true : saved === 'true';
    } catch {
      return true;
    }
  });
  const [geoFormatTab, setGeoFormatTab] = useState<'all' | 'shorts'>('all');
  const [showAgeBreakdown, setShowAgeBreakdown] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('pulseyt_show_age_breakdown');
      return saved === null ? true : saved === 'true';
    } catch {
      return true;
    }
  });
  const [ageFormatTab, setAgeFormatTab] = useState<'all' | 'shorts'>('all');
  const [showGenderBreakdown, setShowGenderBreakdown] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('pulseyt_show_gender_breakdown');
      return saved === null ? true : saved === 'true';
    } catch {
      return true;
    }
  });
  const [genderFormatTab, setGenderFormatTab] = useState<'all' | 'shorts'>('all');

  const toggleTrafficSources = () => {
    setShowTrafficSources((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('pulseyt_show_traffic_sources', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const toggleDemographic = () => {
    setShowDemographic((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('pulseyt_show_demographic', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const toggleViewerBehavior = () => {
    setShowViewerBehavior((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('pulseyt_show_viewer_behavior', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const toggleAudienceGrowingVideos = () => {
    setShowAudienceGrowingVideos((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('pulseyt_show_audience_growing', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const toggleDeviceTypes = () => {
    setShowDeviceTypes((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('pulseyt_show_device_types', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const toggleGeographies = () => {
    setShowGeographies((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('pulseyt_show_geographies', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const toggleAgeBreakdown = () => {
    setShowAgeBreakdown((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('pulseyt_show_age_breakdown', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const toggleGenderBreakdown = () => {
    setShowGenderBreakdown((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('pulseyt_show_gender_breakdown', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const days = PERIOD_DAYS[period];
  const activeIds = useMemo(
    () => new Set(filteredChannels.map((c) => c.id)),
    [filteredChannels]
  );

  // Build chart series for the selected period
  const { chartData, videosByDate } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - (days - 1));
    const startStr = startDate.toISOString().slice(0, 10);

    const dayMap = new Map<string, Record<string, number | string>>();
    for (let i = 0; i < days; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      const iso = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
      const row: Record<string, number | string> = {
        date: iso,
        label,
        combined: 0,
      };
      filteredChannels.forEach((ch) => {
        row[ch.id] = 0;
      });
      languages.forEach((lang) => {
        row[`lang_${lang.id}`] = 0;
      });
      groups.forEach((grp) => {
        row[`grp_${grp.id}`] = 0;
      });
      dayMap.set(iso, row);
    }

    const extractValue = (m: (typeof metrics)[number]) => {
      switch (selectedKpi) {
        case 'watchTime':
          return m.watchTimeHours;
        case 'subscribers':
          return m.subscribersGained;
        case 'engagement':
          return m.likes + m.comments + m.shares;
        case 'revenue':
          return m.revenue;
        case 'views':
        default:
          return m.views;
      }
    };

    const channelLangMap = new Map(filteredChannels.map((c) => [c.id, c.languageId]));
    const channelGroupMap = new Map(filteredChannels.map((c) => [c.id, c.groupId]));

    for (const m of metrics) {
      if (m.date < startStr || !activeIds.has(m.channelId)) continue;
      const row = dayMap.get(m.date);
      if (!row) continue;
      const val = extractValue(m);
      row.combined = Number(((row.combined as number) + val).toFixed(2));
      row[m.channelId] = Number((((row[m.channelId] as number) || 0) + val).toFixed(2));
      const langId = channelLangMap.get(m.channelId);
      if (langId) {
        const langKey = `lang_${langId}`;
        row[langKey] = Number((((row[langKey] as number) || 0) + val).toFixed(2));
      }
      const groupId = channelGroupMap.get(m.channelId);
      if (groupId) {
        const grpKey = `grp_${groupId}`;
        row[grpKey] = Number((((row[grpKey] as number) || 0) + val).toFixed(2));
      }
    }

    const vidsByDate = new Map<string, VideoItem[]>();
    for (const v of videos) {
      if (v.publishedAt < startStr || !activeIds.has(v.channelId)) continue;
      const list = vidsByDate.get(v.publishedAt) || [];
      list.push(v);
      vidsByDate.set(v.publishedAt, list);
    }

    return {
      chartData: Array.from(dayMap.values()),
      videosByDate: vidsByDate,
    };
  }, [days, filteredChannels, languages, groups, metrics, videos, activeIds, selectedKpi]);

  // Top Performers table rows
  const performerRows = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - (days - 1));
    const startStr = startDate.toISOString().slice(0, 10);

    const langMap = new Map(languages.map((l) => [l.id, l]));

    const rows = filteredChannels.map((ch) => {
      let views = 0;
      let engagedViews = 0;
      let subscribers = 0;
      let watchTime = 0;
      let engagement = 0;
      let revenue = 0;

      for (const m of metrics) {
        if (m.channelId === ch.id && m.date >= startStr) {
          views += m.views;
          engagedViews += m.engagedViews;
          subscribers += m.subscribersGained;
          watchTime += m.watchTimeHours;
          engagement += m.likes + m.comments + m.shares;
          revenue += m.revenue;
        }
      }

      const engagementRate = views > 0 ? Number(((engagement / views) * 100).toFixed(2)) : 0;

      return {
        channel: ch,
        language: langMap.get(ch.languageId),
        revenue: Number(revenue.toFixed(2)),
        views,
        engagedViews,
        subscribers,
        watchTime: Number(watchTime.toFixed(1)),
        engagement,
        engagementRate,
      };
    });

    rows.sort((a, b) => {
      const diff = a[sortField] - b[sortField];
      return sortDesc ? -diff : diff;
    });

    return rows;
  }, [filteredChannels, languages, metrics, days, sortField, sortDesc]);

  const enrichedPeriodVideos = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - (days - 1));
    const startStr = startDate.toISOString().slice(0, 10);

    const chMap = new Map(filteredChannels.map((c) => [c.id, c]));
    const langMap = new Map(languages.map((l) => [l.id, l]));

    return videos
      .filter((v) => chMap.has(v.channelId) && v.publishedAt >= startStr)
      .map((v) => {
        const channel = chMap.get(v.channelId)!;
        const language = langMap.get(channel.languageId);
        const engagement = v.likes + v.comments + v.shares;
        const engagementRate =
          v.views > 0 ? Number(((engagement / v.views) * 100).toFixed(2)) : 0;
        const youtubeUrl = !v.id.startsWith('vid-')
          ? v.isShort
            ? `https://www.youtube.com/shorts/${v.id}`
            : `https://www.youtube.com/watch?v=${v.id}`
          : null;
        return {
          video: v,
          channel,
          language,
          engagementRate,
          youtubeUrl,
        };
      });
  }, [filteredChannels, languages, videos, days]);

  const viralSpikes = useMemo(() => {
    if (enrichedPeriodVideos.length === 0) return [];
    const channelStats = new Map<string, { sum: number; count: number }>();
    for (const item of enrichedPeriodVideos) {
      const cur = channelStats.get(item.channel.id) || { sum: 0, count: 0 };
      cur.sum += item.video.views;
      cur.count += 1;
      channelStats.set(item.channel.id, cur);
    }

    return enrichedPeriodVideos
      .map((item) => {
        const stats = channelStats.get(item.channel.id);
        const avg = stats && stats.count > 0 ? stats.sum / stats.count : 0;
        const multiplier = avg > 0 ? Number((item.video.views / avg).toFixed(1)) : 1;
        return { ...item, multiplier };
      })
      .filter((item) => item.multiplier >= 2.0 && item.video.views >= 50)
      .sort((a, b) => b.multiplier - a.multiplier)
      .slice(0, 4);
  }, [enrichedPeriodVideos]);

  const topVideos = useMemo(
    () => [...enrichedPeriodVideos].sort((a, b) => b.video.views - a.video.views).slice(0, 12),
    [enrichedPeriodVideos]
  );

  const topLikesVideos = useMemo(
    () => [...enrichedPeriodVideos].sort((a, b) => b.video.likes - a.video.likes).slice(0, 8),
    [enrichedPeriodVideos]
  );

  const topCommentsVideos = useMemo(
    () => [...enrichedPeriodVideos].sort((a, b) => b.video.comments - a.video.comments).slice(0, 8),
    [enrichedPeriodVideos]
  );

  const trafficSourcesSummary = useMemo(() => {
    const defaults = { search: 57, browse: 13, suggested: 13, shorts: 10, other: 7 };
    if (filteredChannels.length === 0) return [];
    let totalWeight = 0;
    let search = 0;
    let browse = 0;
    let suggested = 0;
    let shorts = 0;
    let other = 0;

    for (const ch of filteredChannels) {
      const w = Math.max(1, ch.viewsTotal || 1);
      const ts = ch.trafficSources || defaults;
      totalWeight += w;
      search += ts.search * w;
      browse += ts.browse * w;
      suggested += ts.suggested * w;
      shorts += ts.shorts * w;
      other += ts.other * w;
    }

    return [
      { key: 'search', label: 'Pesquisa do YouTube', pct: Math.round(search / totalWeight) },
      { key: 'browse', label: 'Funcionalidades de navegação', pct: Math.round(browse / totalWeight) },
      { key: 'suggested', label: 'Vídeos sugeridos', pct: Math.round(suggested / totalWeight) },
      { key: 'shorts', label: 'Feed dos Shorts', pct: Math.round(shorts / totalWeight) },
      { key: 'other', label: 'Externo / Outros', pct: Math.round(other / totalWeight) },
    ].sort((a, b) => b.pct - a.pct);
  }, [filteredChannels]);

  const demographicSummary = useMemo(() => {
    if (filteredChannels.length === 0) {
      return { gender: 'Masculino', ageRange: 'Mais de 65 anos' };
    }
    const genderWeights = new Map<string, number>();
    const ageWeights = new Map<string, number>();

    for (const ch of filteredChannels) {
      const w = Math.max(1, ch.viewsTotal || 1);
      const gender = ch.demographic?.gender || 'Masculino';
      const ageRange = ch.demographic?.ageRange || 'Mais de 65 anos';
      genderWeights.set(gender, (genderWeights.get(gender) || 0) + w);
      ageWeights.set(ageRange, (ageWeights.get(ageRange) || 0) + w);
    }

    const topGender =
      Array.from(genderWeights.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Masculino';
    const topAgeRange =
      Array.from(ageWeights.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ||
      'Mais de 65 anos';

    return { gender: topGender, ageRange: topAgeRange };
  }, [filteredChannels]);

  const viewerBehaviorSummary = useMemo(() => {
    const defaults = { newViewers: 99, casualViewers: 1, returningViewers: 0 };
    if (filteredChannels.length === 0) return defaults;
    let totalWeight = 0;
    let newViewers = 0;
    let casualViewers = 0;
    let returningViewers = 0;

    for (const ch of filteredChannels) {
      const w = Math.max(1, ch.viewsTotal || 1);
      const vb = ch.viewerBehavior || defaults;
      totalWeight += w;
      newViewers += vb.newViewers * w;
      casualViewers += vb.casualViewers * w;
      returningViewers += vb.returningViewers * w;
    }

    return {
      newViewers: Math.round(newViewers / totalWeight),
      casualViewers: Math.round(casualViewers / totalWeight),
      returningViewers: Math.round(returningViewers / totalWeight),
    };
  }, [filteredChannels]);

  const audienceGrowingVideos = useMemo(() => {
    if (enrichedPeriodVideos.length === 0) return [];
    // Average views per channel to classify relative audience growth impact
    const channelTotals = new Map<string, { sum: number; count: number }>();
    for (const item of enrichedPeriodVideos) {
      const cur = channelTotals.get(item.channel.id) || { sum: 0, count: 0 };
      cur.sum += item.video.views;
      cur.count += 1;
      channelTotals.set(item.channel.id, cur);
    }

    return [...enrichedPeriodVideos]
      .sort((a, b) => b.video.views - a.video.views)
      .slice(0, 5)
      .map((item) => {
        const stats = channelTotals.get(item.channel.id);
        const avg = stats && stats.count > 0 ? stats.sum / stats.count : item.video.views;
        const ratio = avg > 0 ? item.video.views / avg : 1;
        const tier: 'Alta' | 'Moderada' | 'Baixa' =
          ratio >= 1.5 ? 'Alta' : ratio >= 0.8 ? 'Moderada' : 'Baixa';
        return { ...item, tier };
      });
  }, [enrichedPeriodVideos]);

  const deviceTypesSummary = useMemo(() => {
    const defaults = { mobile: 70.4, desktop: 13.2, tv: 12.2, tablet: 4.2 };
    if (filteredChannels.length === 0) return defaults;

    let totalWeight = 0;
    let mobile = 0;
    let desktop = 0;
    let tv = 0;
    let tablet = 0;

    for (const ch of filteredChannels) {
      const w = Math.max(1, ch.viewsTotal || 1);
      const dt = ch.deviceTypes || defaults;
      totalWeight += w;
      mobile += dt.mobile * w;
      desktop += dt.desktop * w;
      tv += dt.tv * w;
      tablet += dt.tablet * w;
    }

    let m = mobile / totalWeight;
    let d = desktop / totalWeight;
    let t = tv / totalWeight;
    let tb = tablet / totalWeight;

    if (deviceFormatTab === 'shorts') {
      m = Math.min(96, m + 16);
      t = Math.max(1, t - 8);
      d = Math.max(1, d - 6);
      tb = Math.max(0.5, tb - 2);
    } else if (deviceFormatTab === 'videos') {
      m = Math.max(35, m - 8);
      t = t + 4;
      d = d + 3;
      tb = tb + 1;
    }

    const sum = m + d + t + tb || 1;
    return {
      mobile: Number(((m / sum) * 100).toFixed(1)),
      desktop: Number(((d / sum) * 100).toFixed(1)),
      tv: Number(((t / sum) * 100).toFixed(1)),
      tablet: Number(((tb / sum) * 100).toFixed(1)),
    };
  }, [filteredChannels, deviceFormatTab]);

  const geographiesSummary = useMemo(() => {
    const defaultsByLang: Record<string, Array<{ country: string; pct: number }>> = {
      'pt-BR': [
        { country: 'Brasil', pct: 45.4 },
        { country: 'Portugal', pct: 37.4 },
        { country: 'Moçambique', pct: 1.2 },
        { country: 'Angola', pct: 1.2 },
      ],
      en: [
        { country: 'Estados Unidos', pct: 42.0 },
        { country: 'Reino Unido', pct: 18.5 },
        { country: 'Canadá', pct: 11.2 },
        { country: 'Austrália', pct: 8.4 },
      ],
      fr: [
        { country: 'França', pct: 58.0 },
        { country: 'Canadá', pct: 14.2 },
        { country: 'Bélgica', pct: 10.5 },
        { country: 'Suíça', pct: 6.1 },
      ],
      es: [
        { country: 'México', pct: 36.4 },
        { country: 'Espanha', pct: 22.8 },
        { country: 'Argentina', pct: 14.5 },
        { country: 'Colômbia', pct: 11.2 },
      ],
    };

    if (filteredChannels.length === 0) return [];
    const countryWeights = new Map<string, number>();
    let totalWeight = 0;

    for (const ch of filteredChannels) {
      const w = Math.max(1, ch.viewsTotal || 1);
      totalWeight += w;
      const geos =
        ch.geographies && ch.geographies.length > 0
          ? ch.geographies
          : defaultsByLang[ch.languageId] || defaultsByLang['pt-BR'];
      for (const g of geos) {
        countryWeights.set(g.country, (countryWeights.get(g.country) || 0) + g.pct * w);
      }
    }

    return Array.from(countryWeights.entries())
      .map(([country, weighted]) => ({
        country,
        pct: Number((weighted / totalWeight).toFixed(1)),
      }))
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 6);
  }, [filteredChannels]);

  const ageBreakdownSummary = useMemo(() => {
    const defaults = {
      a13_17: 8.0,
      a18_24: 1.9,
      a25_34: 24.4,
      a35_44: 28.6,
      a45_54: 20.1,
      a55_64: 6.3,
      a65plus: 10.8,
    };
    if (filteredChannels.length === 0) return [];
    let totalWeight = 0;
    const acc = {
      a13_17: 0,
      a18_24: 0,
      a25_34: 0,
      a35_44: 0,
      a45_54: 0,
      a55_64: 0,
      a65plus: 0,
    };

    for (const ch of filteredChannels) {
      const w = Math.max(1, ch.viewsTotal || 1);
      const ab = ch.ageBreakdown || defaults;
      totalWeight += w;
      acc.a13_17 += ab.a13_17 * w;
      acc.a18_24 += ab.a18_24 * w;
      acc.a25_34 += ab.a25_34 * w;
      acc.a35_44 += ab.a35_44 * w;
      acc.a45_54 += ab.a45_54 * w;
      acc.a55_64 += ab.a55_64 * w;
      acc.a65plus += ab.a65plus * w;
    }

    return [
      { key: 'a13_17', label: '13 a 17 anos', pct: Number((acc.a13_17 / totalWeight).toFixed(1)) },
      { key: 'a18_24', label: '18 a 24 anos', pct: Number((acc.a18_24 / totalWeight).toFixed(1)) },
      { key: 'a25_34', label: '25 a 34 anos', pct: Number((acc.a25_34 / totalWeight).toFixed(1)) },
      { key: 'a35_44', label: '35 a 44 anos', pct: Number((acc.a35_44 / totalWeight).toFixed(1)) },
      { key: 'a45_54', label: '45 a 54 anos', pct: Number((acc.a45_54 / totalWeight).toFixed(1)) },
      { key: 'a55_64', label: '55 a 64 anos', pct: Number((acc.a55_64 / totalWeight).toFixed(1)) },
      { key: 'a65plus', label: 'Mais de 65 anos', pct: Number((acc.a65plus / totalWeight).toFixed(1)) },
    ];
  }, [filteredChannels]);

  const genderBreakdownSummary = useMemo(() => {
    const defaults = { female: 14.3, male: 85.7, custom: 0.0 };
    if (filteredChannels.length === 0) return [];
    let totalWeight = 0;
    let female = 0;
    let male = 0;
    let custom = 0;

    for (const ch of filteredChannels) {
      const w = Math.max(1, ch.viewsTotal || 1);
      const gb = ch.genderBreakdown || defaults;
      totalWeight += w;
      female += gb.female * w;
      male += gb.male * w;
      custom += gb.custom * w;
    }

    return [
      { key: 'female', label: 'Feminino', pct: Number((female / totalWeight).toFixed(1)) },
      { key: 'male', label: 'Masculino', pct: Number((male / totalWeight).toFixed(1)) },
      {
        key: 'custom',
        label: 'Especificado pelo utilizador',
        pct: Number((custom / totalWeight).toFixed(1)),
      },
    ];
  }, [filteredChannels]);

  const kpiCards: Array<{
    key: KpiMetricKey;
    label: string;
    value: string;
    deltaPct: number;
    icon: typeof Eye;
    subLines: string[];
  }> = [
    {
      key: 'views',
      label: t('kpiViews'),
      value: formatNumber(aggregatedKpis.views),
      deltaPct: aggregatedKpis.viewsDeltaPct,
      icon: Eye,
      subLines: [
        `${formatCompact(aggregatedKpis.engagedViews)} Engaged Views`,
        `${aggregatedKpis.hookRate}% Hook Rate`,
      ],
    },
    {
      key: 'watchTime',
      label: t('kpiWatchTime'),
      value: formatHours(aggregatedKpis.watchTimeHours),
      deltaPct: aggregatedKpis.watchTimeDeltaPct,
      icon: Clock,
      subLines: [t('totalWatchTimeSub')],
    },
    {
      key: 'subscribers',
      label: t('kpiSubscribers'),
      value: formatNumber(aggregatedKpis.subscribers),
      deltaPct: aggregatedKpis.subscribersDeltaPct,
      icon: Users,
      subLines: [t('newInPeriodSub')],
    },
    {
      key: 'engagement',
      label: t('kpiEngagement'),
      value: formatNumber(aggregatedKpis.engagement),
      deltaPct: aggregatedKpis.engagementDeltaPct,
      icon: Heart,
      subLines: [
        `${formatCompact(aggregatedKpis.likes)} Likes · ${formatCompact(
          aggregatedKpis.comments
        )} ${t('colComments')}`,
        `${formatCompact(aggregatedKpis.shares)} Shares`,
      ],
    },
    {
      key: 'revenue',
      label: t('kpiRevenue'),
      value: formatCurrency(aggregatedKpis.revenue),
      deltaPct: aggregatedKpis.revenueDeltaPct,
      icon: DollarSign,
      subLines: [
        `$${aggregatedKpis.avgCpm.toFixed(2)} Avg CPM`,
        `$${aggregatedKpis.avgRpm.toFixed(2)} Avg RPM`,
      ],
    },
  ];

  const heroValue = (() => {
    switch (selectedKpi) {
      case 'watchTime':
        return `${formatHours(aggregatedKpis.watchTimeHours)} hrs`;
      case 'subscribers':
        return formatNumber(aggregatedKpis.subscribers);
      case 'engagement':
        return formatNumber(aggregatedKpis.engagement);
      case 'revenue':
        return formatCurrency(aggregatedKpis.revenue);
      case 'views':
      default:
        return formatNumber(aggregatedKpis.views);
    }
  })();

  const heroDeltaPct = (() => {
    switch (selectedKpi) {
      case 'watchTime':
        return aggregatedKpis.watchTimeDeltaPct;
      case 'subscribers':
        return aggregatedKpis.subscribersDeltaPct;
      case 'engagement':
        return aggregatedKpis.engagementDeltaPct;
      case 'revenue':
        return aggregatedKpis.revenueDeltaPct;
      case 'views':
      default:
        return aggregatedKpis.viewsDeltaPct;
    }
  })();

  const kpiTitles: Record<KpiMetricKey, string> = {
    views: 'Views Overview',
    watchTime: 'Watch Time Overview',
    subscribers: 'Subscribers Overview',
    engagement: 'Engagement Overview',
    revenue: 'Revenue Overview',
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDesc(!sortDesc);
    } else {
      setSortField(field);
      setSortDesc(true);
    }
  };

  const topCompetitorOutliers = useMemo(() => {
    const items: Array<{
      channelName: string;
      channelHandle: string;
      languageId: string;
      nicheTag: string;
      video: (typeof competitors)[number]['videos'][number];
    }> = [];
    for (const comp of competitors) {
      for (const v of comp.videos) {
        items.push({
          channelName: comp.name,
          channelHandle: comp.handle,
          languageId: comp.languageId,
          nicheTag: comp.nicheTag,
          video: v,
        });
      }
    }
    return items.sort((a, b) => b.video.outlierScore - a.video.outlierScore).slice(0, 4);
  }, [competitors]);

  const nicheSummaries = useMemo(() => {
    if (niches.length === 0) return [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(today);
    start.setDate(today.getDate() - (PERIOD_DAYS[period] - 1));
    const startStr = start.toISOString().slice(0, 10);

    return niches.map((nc) => {
      const ncChannels = channels.filter((c) => c.isActive && c.nicheId === nc.id);
      const idSet = new Set(ncChannels.map((c) => c.id));
      let views = 0;
      let revenue = 0;
      for (const m of metrics) {
        if (idSet.has(m.channelId) && m.date >= startStr) {
          views += m.views;
          revenue += m.revenue;
        }
      }
      return {
        niche: nc,
        channelsCount: ncChannels.length,
        views,
        revenue,
      };
    });
  }, [niches, channels, metrics, period]);

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {channels.length === 0 && (
        <div className="rounded-2xl bg-[#121720] border border-orange-500/40 p-6 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-white">
              Welcome to Open Analytic YT
            </h2>
            <p className="text-xs text-slate-400">
              No channels connected yet. Add your YouTube channels (@handle or Channel ID) to start monitoring.
            </p>
          </div>
          <button
            onClick={() => setActiveTab('channels')}
            className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold shadow-lg shadow-orange-500/20 transition cursor-pointer"
          >
            {t('addChannel')}
          </button>
        </div>
      )}

      {viralSpikes.length > 0 && (
        <div className="rounded-2xl bg-gradient-to-r from-orange-500/10 via-[#121720] to-amber-500/10 border border-orange-500/35 p-4 space-y-2.5">
          <div className="text-xs font-bold uppercase tracking-wider text-orange-400 flex items-center gap-1.5">
            🔥 Viral Spike Radar ({viralSpikes.length})
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            {viralSpikes.map((item) => (
              <div
                key={item.video.id}
                className="rounded-xl bg-[#0b0f14]/90 border border-slate-800 p-3 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  {item.youtubeUrl ? (
                    <a
                      href={item.youtubeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-semibold text-white hover:text-orange-400 truncate block"
                    >
                      {item.video.title}
                    </a>
                  ) : (
                    <div className="text-xs font-semibold text-white truncate">
                      {item.video.title}
                    </div>
                  )}
                  <div className="text-[11px] text-slate-400 truncate">
                    {item.language?.flag} {item.channel.name} · {formatCompact(item.video.views)} views
                  </div>
                </div>
                <span className="shrink-0 px-2 py-1 rounded-lg bg-orange-500/20 text-orange-300 border border-orange-500/40 font-mono-num text-xs font-bold">
                  {item.multiplier}x
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Front-Page Niche Radar */}
      {showNicheRadar ? (
        <div className="rounded-2xl bg-gradient-to-r from-emerald-500/10 via-[#121720] to-purple-500/10 border border-emerald-500/30 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                <Radar className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                  Nicho Radar
                  <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[10px] font-mono-num normal-case">
                    {niches.length} nicho(s) · {competitors.length} concorrente(s)
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Monitore seus nichos ativos, pesquise subnichos e acompanhe vídeos outliers dos concorrentes.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!quickNicheInput.trim()) return;
                  openNicheExplorerWithQuery(quickNicheInput);
                  setQuickNicheInput('');
                }}
                className="flex items-center gap-1.5"
              >
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={quickNicheInput}
                    onChange={(e) => setQuickNicheInput(e.target.value)}
                    placeholder="Explorar nicho ou tema..."
                    className="pl-8 pr-3 py-1.5 rounded-xl bg-[#0b0f14] border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 w-44 sm:w-56"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!quickNicheInput.trim()}
                  className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-xs font-bold transition cursor-pointer disabled:opacity-50"
                >
                  Explorar
                </button>
              </form>

              {competitors.length > 0 && (
                <button
                  type="button"
                  onClick={() => void syncCompetitors()}
                  disabled={isSyncingCompetitors}
                  title="Atualizar vídeos dos concorrentes no Radar"
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#0b0f14] hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 transition cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${
                      isSyncingCompetitors ? 'animate-spin text-emerald-400' : ''
                    }`}
                  />
                </button>
              )}

              <button
                type="button"
                onClick={() => setActiveTab('niche')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-purple-200 text-xs font-semibold transition cursor-pointer"
              >
                <Compass className="w-3.5 h-3.5 text-purple-300" />
                Abrir Análise de Nicho
              </button>

              <button
                type="button"
                onClick={toggleNicheRadar}
                title="Ocultar Nicho Radar"
                className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-xl bg-[#0b0f14] hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
              >
                <EyeOff className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Registered Niches Cards */}
          {nicheSummaries.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {nicheSummaries.map(({ niche, channelsCount, views, revenue }) => {
                const isSelected = selectedNicheId === niche.id;
                return (
                  <div
                    key={niche.id}
                    className={`rounded-xl p-3.5 border transition flex flex-col justify-between gap-2.5 ${
                      isSelected
                        ? 'bg-emerald-500/10 border-emerald-500/50'
                        : 'bg-[#0b0f14]/90 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedNicheId(isSelected ? 'all' : niche.id)
                        }
                        className="flex items-center gap-2 min-w-0 text-left cursor-pointer"
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: niche.color }}
                        />
                        <span className="text-sm">{niche.icon}</span>
                        <span className="text-xs font-bold text-white truncate">
                          {niche.name}
                        </span>
                      </button>
                      <span className="text-[10px] text-slate-400 font-mono-num shrink-0">
                        {channelsCount} can.
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs">
                      <div className="font-mono-num">
                        <span className="font-bold text-white">{formatCompact(views)}</span>{' '}
                        <span className="text-[10px] text-slate-400">views</span> ·{' '}
                        <span className="font-bold text-emerald-400">
                          {formatCurrency(revenue)}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          openNicheExplorerWithQuery(niche.keywords || niche.name)
                        }
                        className="text-[10px] font-bold text-emerald-300 hover:text-emerald-200 cursor-pointer"
                      >
                        Outliers →
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Top 4 Competitor Outliers on Front Page */}
          {topCompetitorOutliers.length > 0 && (
            <div className="space-y-2">
              <div className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-orange-400" />
                Top Vídeos Outliers dos Concorrentes Monitorados
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {topCompetitorOutliers.map(({ channelName, languageId, video }) => {
                  const lang = languages.find((l) => l.id === languageId);
                  const ytUrl = video.isShort
                    ? `https://www.youtube.com/shorts/${video.id}`
                    : `https://www.youtube.com/watch?v=${video.id}`;
                  return (
                    <a
                      key={`${channelName}-${video.id}`}
                      href={ytUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-xl bg-[#0b0f14]/90 border border-slate-800 hover:border-orange-500/40 p-2.5 flex items-center gap-3 transition group"
                    >
                      <img
                        src={video.thumbnailUrl}
                        alt={video.title}
                        className="w-20 h-12 rounded-lg object-cover shrink-0 border border-slate-800"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-white group-hover:text-orange-400 truncate">
                          {video.title}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">
                          {lang?.flag} {channelName} · {formatCompact(video.views)} views
                        </div>
                        <div className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300 text-[10px] font-bold font-mono-num">
                          🔥 {video.outlierScore}x média
                        </div>
                      </div>
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          {/* Empty Quick-Actions if user hasn't added Niches or Competitors yet */}
          {nicheSummaries.length === 0 && topCompetitorOutliers.length === 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-800/70 text-xs text-slate-400">
              <span>
                Cadastre seus nichos em <strong>Gerenciar Canais (+ Novo Nicho)</strong> ou adicione canais rivais no <strong>Radar de Concorrentes</strong> para ver os outliers aqui na página inicial.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('channels')}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#0b0f14] hover:bg-slate-800 border border-emerald-500/30 text-emerald-300 text-xs font-semibold cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Novo Nicho
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('niche')}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#0b0f14] hover:bg-slate-800 border border-orange-500/30 text-orange-300 text-xs font-semibold cursor-pointer"
                >
                  <Radar className="w-3.5 h-3.5" />
                  Adicionar Concorrente
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={toggleNicheRadar}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#121720] hover:bg-slate-800 border border-slate-800 text-xs text-emerald-300 transition cursor-pointer"
          >
            <Radar className="w-3.5 h-3.5 text-emerald-400" />
            Mostrar Nicho Radar
          </button>
        </div>
      )}

      {/* Hero Stock-Ticker Number Row */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5 text-orange-400" />
            {kpiTitles[selectedKpi]} · {filteredChannels.length} {t('activeChannelsSuffix')}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-4xl sm:text-5xl font-extrabold font-mono-num text-white tracking-tight">
              {heroValue}
            </span>
            <DeltaBadge pct={heroDeltaPct} />
          </div>
        </div>

        <div className="text-right">
          <div
            className={`text-2xl sm:text-3xl font-bold font-mono-num ${
              aggregatedKpis.viewsDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {aggregatedKpis.viewsDelta >= 0 ? '+' : ''}
            {formatNumber(aggregatedKpis.viewsDelta)}
          </div>
          <div className="text-xs text-slate-400">{t('viewsDeltaSubtitle')}</div>
        </div>
      </div>

      {/* 5 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          const isSelected = selectedKpi === card.key;
          return (
            <button
              key={card.key}
              onClick={() => setSelectedKpi(card.key)}
              className={`text-left rounded-2xl p-4 border transition-all cursor-pointer ${
                isSelected
                  ? 'bg-[#171d26] border-orange-500 shadow-lg shadow-orange-500/10'
                  : 'bg-[#121720] border-slate-800/90 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-300 flex items-center gap-2">
                  <span
                    className={`w-6 h-6 rounded-lg flex items-center justify-center ${
                      isSelected
                        ? 'bg-orange-500 text-white'
                        : 'bg-slate-800 text-orange-400'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </span>
                  {card.label}
                </span>
                <DeltaBadge pct={card.deltaPct} />
              </div>

              <div className="text-2xl font-bold font-mono-num text-white mb-2">
                {card.value}
              </div>

              <div className="space-y-0.5">
                {card.subLines.map((line, i) => (
                  <div key={i} className="text-[11px] text-slate-400 truncate">
                    {line}
                  </div>
                ))}
              </div>
            </button>
          );
        })}
      </div>

      {/* Main Chart Card */}
      <div className="rounded-2xl bg-[#121720] border border-slate-800/90 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-bold text-white">{kpiTitles[selectedKpi]}</h2>
            <span className="text-xs text-slate-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-orange-500 inline-block" />
              Vídeo Publicado ({Array.from(videosByDate.values()).flat().length})
            </span>
          </div>

          {/* Toggle: Combined / By Language / By Group / Individual */}
          <div className="inline-flex rounded-xl bg-[#0b0f14] p-1 border border-slate-800">
            {(
              [
                { id: 'combined', label: t('modeCombined') },
                { id: 'by_language', label: t('modeByLanguage') },
                ...(groups.length > 0 ? [{ id: 'by_group' as const, label: t('modeByGroup') }] : []),
                { id: 'individual', label: t('modeByChannel') },
              ] as Array<{ id: ChartViewMode; label: string }>
            ).map((mode) => (
              <button
                key={mode.id}
                onClick={() => setChartViewMode(mode.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                  chartViewMode === mode.id
                    ? 'bg-orange-500 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>

        <div className="h-[320px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            {chartViewMode === 'combined' ? (
              <AreaChart data={chartData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="orangeFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis
                  dataKey="label"
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => formatCompact(Number(v))}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const row = payload[0].payload as Record<string, string | number>;
                    const dateStr = String(row.date);
                    const published = videosByDate.get(dateStr) || [];
                    return (
                      <div className="bg-[#0e131a] border border-slate-700 rounded-xl p-3 shadow-2xl max-w-xs space-y-2">
                        <div className="text-xs font-semibold text-slate-300 border-b border-slate-800 pb-1.5 flex items-center justify-between gap-4">
                          <span>{dateStr}</span>
                          <span className="font-mono-num text-orange-400">
                            {selectedKpi === 'revenue'
                              ? formatCurrency(Number(row.combined))
                              : formatNumber(Number(row.combined))}
                          </span>
                        </div>
                        {published.length > 0 && (
                          <div className="space-y-1.5">
                            <div className="text-[10px] uppercase tracking-wider text-orange-400 font-semibold flex items-center gap-1">
                              <Video className="w-3 h-3" />
                              Publicado neste dia ({published.length})
                            </div>
                            {published.slice(0, 2).map((v) => (
                              <div key={v.id} className="text-[11px] text-slate-200 truncate">
                                • {v.title} ({formatCompact(v.views)} views)
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="combined"
                  stroke="#f97316"
                  strokeWidth={2.5}
                  fill="url(#orangeFill)"
                  activeDot={{ r: 5, fill: '#f97316', stroke: '#fff', strokeWidth: 2 }}
                />
              </AreaChart>
            ) : (
              <LineChart data={chartData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis
                  dataKey="label"
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => formatCompact(Number(v))}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0e131a',
                    borderColor: '#334155',
                    borderRadius: '12px',
                    fontSize: '12px',
                  }}
                />
                {chartViewMode === 'by_language'
                  ? languages.map((lang) => (
                      <Line
                        key={lang.id}
                        type="monotone"
                        dataKey={`lang_${lang.id}`}
                        name={`${lang.flag} ${lang.name}`}
                        stroke={lang.color}
                        strokeWidth={2.2}
                        dot={false}
                      />
                    ))
                  : chartViewMode === 'by_group'
                  ? groups.map((grp) => (
                      <Line
                        key={grp.id}
                        type="monotone"
                        dataKey={`grp_${grp.id}`}
                        name={`${grp.icon} ${grp.name}`}
                        stroke={grp.color}
                        strokeWidth={2.4}
                        dot={false}
                      />
                    ))
                  : filteredChannels.map((ch) => (
                      <Line
                        key={ch.id}
                        type="monotone"
                        dataKey={ch.id}
                        name={ch.name}
                        stroke={ch.color}
                        strokeWidth={2}
                        dot={false}
                      />
                    ))}
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>

        {/* Video published timeline markers strip */}
        <div className="mt-2 pt-2 border-t border-slate-800/70 flex items-center justify-between text-[11px] text-slate-500">
          <span>Linha do tempo de publicações ({days} dias)</span>
          <div className="flex items-center gap-1 overflow-hidden">
            {chartData.slice(-30).map((d) => {
              const hasVid = (videosByDate.get(String(d.date)) || []).length > 0;
              return (
                <span
                  key={String(d.date)}
                  title={`${d.date}: ${
                    hasVid
                      ? `${videosByDate.get(String(d.date))?.length} vídeo(s) publicado(s)`
                      : 'Sem publicação'
                  }`}
                  className={`w-2 h-2 rounded-xs transition ${
                    hasVid ? 'bg-orange-500' : 'bg-slate-800'
                  }`}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Top Performers Table */}
      <div className="rounded-2xl bg-[#121720] border border-slate-800/90 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800/80 flex items-center justify-between">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            🔥 {t('topPerformers')}
            <span className="text-xs font-normal text-slate-400">
              ({t('clickToFilter')})
            </span>
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800/80 text-[11px] uppercase tracking-wider text-slate-400 bg-[#0e131a]">
                <th className="py-3 px-5 font-semibold">Canal</th>
                <th className="py-3 px-3 font-semibold">Idioma</th>
                {(
                  [
                    { key: 'revenue', label: 'Receita' },
                    { key: 'views', label: 'Views' },
                    { key: 'engagedViews', label: 'Engaged Views' },
                    { key: 'subscribers', label: 'Inscritos' },
                    { key: 'watchTime', label: 'Watch Time' },
                    { key: 'engagement', label: 'Engajamento' },
                    { key: 'engagementRate', label: 'Taxa Engaj.' },
                  ] as Array<{ key: SortField; label: string }>
                ).map((col) => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className={`py-3 px-3 font-semibold text-right cursor-pointer select-none hover:text-white transition ${
                      sortField === col.key ? 'text-orange-400' : ''
                    }`}
                  >
                    {col.label} {sortField === col.key ? (sortDesc ? '↓' : '↑') : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-sm">
              {performerRows.map((row) => (
                <tr
                  key={row.channel.id}
                  onClick={() => setSelectedChannelId(row.channel.id)}
                  className="hover:bg-slate-800/40 transition cursor-pointer"
                >
                  <td className="py-3.5 px-5">
                    <div className="flex items-center gap-3">
                      <img
                        src={row.channel.avatarUrl}
                        alt={row.channel.name}
                        className="w-8 h-8 rounded-full border border-slate-700"
                      />
                      <div>
                        <div className="font-semibold text-slate-100 leading-tight">
                          {row.channel.name}
                        </div>
                        <div className="text-xs text-slate-400">{row.channel.handle}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-3">
                    {row.language && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-[#0b0f14] border border-slate-800 text-slate-200">
                        <span>{row.language.flag}</span>
                        <span>{row.language.code}</span>
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono-num text-emerald-400 font-medium">
                    {formatCurrency(row.revenue)}
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono-num text-white font-semibold">
                    {formatNumber(row.views)}
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono-num text-slate-300">
                    {formatNumber(row.engagedViews)}
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono-num text-slate-300">
                    +{formatNumber(row.subscribers)}
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono-num text-slate-300">
                    {formatHours(row.watchTime)}h
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono-num text-slate-300">
                    {formatNumber(row.engagement)}
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono-num text-orange-400 font-medium">
                    {row.engagementRate}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top Vídeos Table */}
      <div className="rounded-2xl bg-[#121720] border border-slate-800/90 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800/80 flex items-center justify-between">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            🏆 {t('topVideos')} ({topVideos.length})
            <span className="text-xs font-normal text-slate-400">
              ({t('sortedByViews')})
            </span>
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800/80 text-[11px] uppercase tracking-wider text-slate-400 bg-[#0e131a]">
                <th className="py-3 px-4 font-semibold w-10">#</th>
                <th className="py-3 px-3 font-semibold">Vídeo</th>
                <th className="py-3 px-3 font-semibold">Idioma</th>
                <th className="py-3 px-3 font-semibold">Publicado</th>
                <th className="py-3 px-3 font-semibold text-right">Receita</th>
                <th className="py-3 px-3 font-semibold text-right text-orange-400">Views ↓</th>
                <th className="py-3 px-3 font-semibold text-right">Likes</th>
                <th className="py-3 px-3 font-semibold text-right">Comentários</th>
                <th className="py-3 px-4 font-semibold text-right">Taxa Engaj.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-sm">
              {topVideos.map(({ video, channel, language, engagementRate, youtubeUrl }, idx) => (
                <tr key={video.id} className="hover:bg-slate-800/40 transition">
                  <td className="py-3 px-4 font-mono-num text-xs text-slate-500 font-bold">
                    {idx + 1}
                  </td>
                  <td className="py-3 px-3 max-w-md">
                    <div className="flex items-center gap-3">
                      <img
                        src={video.thumbnailUrl}
                        alt={video.title}
                        className="w-16 h-9 rounded-lg object-cover border border-slate-700 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          {youtubeUrl ? (
                            <a
                              href={youtubeUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-semibold text-slate-100 hover:text-orange-400 transition truncate flex items-center gap-1"
                            >
                              <span className="truncate">{video.title}</span>
                              <ExternalLink className="w-3 h-3 shrink-0 opacity-70" />
                            </a>
                          ) : (
                            <span className="font-semibold text-slate-100 truncate">
                              {video.title}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400 flex items-center gap-2">
                          <span>{channel.name}</span>
                          {video.isShort && (
                            <span className="px-1.5 py-0.2 rounded bg-orange-500/20 text-orange-400 text-[10px] font-bold uppercase">
                              Short
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    {language && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-[#0b0f14] border border-slate-800 text-slate-200">
                        <span>{language.flag}</span>
                        <span>{language.code}</span>
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-xs font-mono-num text-slate-400">
                    {video.publishedAt}
                  </td>
                  <td className="py-3 px-3 text-right font-mono-num text-emerald-400 font-medium">
                    {formatCurrency(video.revenue)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono-num text-white font-semibold">
                    {formatNumber(video.views)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono-num text-slate-300">
                    {formatNumber(video.likes)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono-num text-slate-300">
                    {formatNumber(video.comments)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono-num text-orange-400 font-medium">
                    {engagementRate}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top Likes & Top Comentários */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {(
          [
            {
              title: `👍 ${t('topLikes')}`,
              metricLabel: `${t('colLikes')} ↓`,
              accentClass: 'text-sky-400',
              items: topLikesVideos,
              getMetric: (v: VideoItem) => v.likes,
            },
            {
              title: `💬 ${t('topComments')}`,
              metricLabel: `${t('colComments')} ↓`,
              accentClass: 'text-violet-400',
              items: topCommentsVideos,
              getMetric: (v: VideoItem) => v.comments,
            },
          ] as const
        ).map((section) => (
          <div
            key={section.title}
            className="rounded-2xl bg-[#121720] border border-slate-800/90 overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-slate-800/80 flex items-center justify-between">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                {section.title} ({section.items.length})
              </h2>
              <span className="text-xs text-slate-400">No período</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800/80 text-[11px] uppercase tracking-wider text-slate-400 bg-[#0e131a]">
                    <th className="py-3 px-4 font-semibold w-8">#</th>
                    <th className="py-3 px-3 font-semibold">Vídeo</th>
                    <th className="py-3 px-3 font-semibold">Idioma</th>
                    <th className={`py-3 px-3 font-semibold text-right ${section.accentClass}`}>
                      {section.metricLabel}
                    </th>
                    <th className="py-3 px-4 font-semibold text-right">Views</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-sm">
                  {section.items.map(({ video, channel, language, youtubeUrl }, idx) => (
                    <tr key={video.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 font-mono-num text-xs text-slate-500 font-bold">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-3 max-w-[260px]">
                        <div className="flex items-center gap-2.5">
                          <img
                            src={video.thumbnailUrl}
                            alt={video.title}
                            className="w-12 h-7 rounded-md object-cover border border-slate-700 shrink-0"
                          />
                          <div className="min-w-0">
                            {youtubeUrl ? (
                              <a
                                href={youtubeUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-semibold text-xs text-slate-100 hover:text-orange-400 transition truncate flex items-center gap-1"
                              >
                                <span className="truncate">{video.title}</span>
                                <ExternalLink className="w-3 h-3 shrink-0 opacity-70" />
                              </a>
                            ) : (
                              <span className="font-semibold text-xs text-slate-100 truncate block">
                                {video.title}
                              </span>
                            )}
                            <span className="text-[11px] text-slate-400 truncate block">
                              {channel.name}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        {language && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-medium bg-[#0b0f14] border border-slate-800 text-slate-200">
                            <span>{language.flag}</span>
                            <span>{language.code}</span>
                          </span>
                        )}
                      </td>
                      <td
                        className={`py-3 px-3 text-right font-mono-num font-bold ${section.accentClass}`}
                      >
                        {formatNumber(section.getMetric(video))}
                      </td>
                      <td className="py-3 px-4 text-right font-mono-num text-xs text-slate-300">
                        {formatCompact(video.views)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {/* Como os visitantes encontram o seu conteúdo + Principal grupo demográfico + Comportamento */}
      {(!showTrafficSources ||
        !showDemographic ||
        !showViewerBehavior ||
        !showAudienceGrowingVideos ||
        !showDeviceTypes ||
        !showGeographies ||
        !showAgeBreakdown ||
        !showGenderBreakdown) && (
        <div className="flex flex-wrap items-center gap-2">
          {!showTrafficSources && (
            <button
              onClick={toggleTrafficSources}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#121720] hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 transition cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5 text-orange-400" />
              Mostrar Origens de Tráfego
            </button>
          )}
          {!showDemographic && (
            <button
              onClick={toggleDemographic}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#121720] hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 transition cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5 text-orange-400" />
              Mostrar Grupo Demográfico
            </button>
          )}
          {!showViewerBehavior && (
            <button
              onClick={toggleViewerBehavior}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#121720] hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 transition cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5 text-orange-400" />
              Mostrar Comportamento de Visualização
            </button>
          )}
          {!showAudienceGrowingVideos && (
            <button
              onClick={toggleAudienceGrowingVideos}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#121720] hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 transition cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5 text-orange-400" />
              Mostrar Vídeos que Aumentam o Público
            </button>
          )}
          {!showDeviceTypes && (
            <button
              onClick={toggleDeviceTypes}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#121720] hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 transition cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5 text-orange-400" />
              Mostrar Tipo de Dispositivo
            </button>
          )}
          {!showGeographies && (
            <button
              onClick={toggleGeographies}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#121720] hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 transition cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5 text-orange-400" />
              Mostrar Principais Geografias
            </button>
          )}
          {!showAgeBreakdown && (
            <button
              onClick={toggleAgeBreakdown}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#121720] hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 transition cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5 text-orange-400" />
              Mostrar Idade
            </button>
          )}
          {!showGenderBreakdown && (
            <button
              onClick={toggleGenderBreakdown}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#121720] hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 transition cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5 text-orange-400" />
              Mostrar Género
            </button>
          )}
        </div>
      )}

      {(showTrafficSources || showDemographic) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {showTrafficSources && (
            <div
              className={`${
                showDemographic ? 'lg:col-span-2' : 'lg:col-span-3'
              } rounded-2xl bg-[#121720] border border-slate-800/90 p-5 space-y-4`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-white">
                    {t('howViewersFind')}
                  </h2>
                  <p className="text-xs text-slate-400">
                    Visualizações · Últimos {days} dias · Média ponderada dos canais filtrados (edite em Gerenciar Canais)
                  </p>
                </div>
                <button
                  onClick={toggleTrafficSources}
                  title="Ocultar este card"
                  className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg bg-[#0b0f14] hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
                >
                  <EyeOff className="w-3.5 h-3.5" />
                  Ocultar
                </button>
              </div>

              <div className="space-y-3.5">
                {trafficSourcesSummary.map((item) => (
                  <div key={item.key} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-200 font-medium">{item.label}</span>
                      <span className="font-mono-num font-bold text-white">{item.pct}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-blue-500 transition-all duration-500"
                        style={{ width: `${Math.min(100, Math.max(0, item.pct))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {showDemographic && (
            <div
              className={`${
                showTrafficSources ? '' : 'lg:col-span-3'
              } rounded-2xl bg-[#121720] border border-slate-800/90 p-5 flex flex-col justify-between`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h2 className="text-base font-bold text-white">
                    {t('topDemographic')}
                  </h2>
                  <button
                    onClick={toggleDemographic}
                    title="Ocultar este card"
                    className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-lg bg-[#0b0f14] hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition cursor-pointer shrink-0"
                  >
                    <EyeOff className="w-3.5 h-3.5" />
                    Ocultar
                  </button>
                </div>
                <p className="text-xs text-slate-400 mb-6">
                  Visualizações · Últimos {days} dias
                </p>

                <div className="space-y-3">
                  <div className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                    {demographicSummary.gender}
                  </div>
                  <div className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                    {demographicSummary.ageRange}
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-slate-500 pt-4 mt-6 border-t border-slate-800/70">
                Calculado pelos canais filtrados (edite em Gerenciar Canais).
              </p>
            </div>
          )}
        </div>
      )}

      {/* Comportamento de visualização + Vídeos que aumentam o seu público */}
      {(showViewerBehavior || showAudienceGrowingVideos) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {showViewerBehavior && (
            <div
              className={`${
                showAudienceGrowingVideos ? '' : 'lg:col-span-2'
              } rounded-2xl bg-[#121720] border border-slate-800/90 p-5 space-y-5`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-white">
                    {t('viewingBehavior')}
                  </h2>
                  <p className="text-xs text-slate-400">{t('monthlyAudience')}</p>
                </div>
                <button
                  onClick={toggleViewerBehavior}
                  title="Ocultar este card"
                  className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-[#0b0f14] hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition cursor-pointer shrink-0"
                >
                  <EyeOff className="w-3.5 h-3.5" />
                  Ocultar
                </button>
              </div>

              {/* Segmented horizontal bar */}
              <div className="h-2.5 w-full rounded-full bg-slate-800 overflow-hidden flex gap-0.5">
                {viewerBehaviorSummary.newViewers > 0 && (
                  <div
                    className="h-full bg-slate-100 transition-all duration-500"
                    style={{ width: `${viewerBehaviorSummary.newViewers}%` }}
                  />
                )}
                {viewerBehaviorSummary.casualViewers > 0 && (
                  <div
                    className="h-full bg-indigo-500 transition-all duration-500"
                    style={{ width: `${viewerBehaviorSummary.casualViewers}%` }}
                  />
                )}
                {viewerBehaviorSummary.returningViewers > 0 && (
                  <div
                    className="h-full bg-purple-400 transition-all duration-500"
                    style={{ width: `${viewerBehaviorSummary.returningViewers}%` }}
                  />
                )}
              </div>

              <div className="space-y-3">
                {[
                  {
                    label: 'Novos visitantes',
                    pct: viewerBehaviorSummary.newViewers,
                    dotClass: 'bg-slate-100',
                  },
                  {
                    label: 'Visitantes ocasionais',
                    pct: viewerBehaviorSummary.casualViewers,
                    dotClass: 'bg-indigo-500',
                  },
                  {
                    label: 'Visitantes habituais',
                    pct: viewerBehaviorSummary.returningViewers,
                    dotClass: 'bg-purple-400',
                  },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-3 text-slate-200 font-medium">
                      <span className={`w-2.5 h-2.5 rounded-full ${row.dotClass}`} />
                      {row.label}
                    </span>
                    <span className="font-mono-num font-bold text-white">{row.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {showAudienceGrowingVideos && (
            <div
              className={`${
                showViewerBehavior ? '' : 'lg:col-span-2'
              } rounded-2xl bg-[#121720] border border-slate-800/90 p-5 space-y-4`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-white">
                    {t('videosGrowingAudience')}
                  </h2>
                  <p className="text-xs text-slate-400">
                    Desempenho relativo de novos visitantes · Últimos {days} dias
                  </p>
                </div>
                <button
                  onClick={toggleAudienceGrowingVideos}
                  title="Ocultar este card"
                  className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-[#0b0f14] hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition cursor-pointer shrink-0"
                >
                  <EyeOff className="w-3.5 h-3.5" />
                  Ocultar
                </button>
              </div>

              <div className="space-y-3">
                {audienceGrowingVideos.map(({ video, youtubeUrl, tier }) => (
                  <div
                    key={video.id}
                    className="flex items-center justify-between gap-3 group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={video.thumbnailUrl}
                        alt={video.title}
                        className="w-16 h-9 rounded-lg object-cover border border-slate-700 shrink-0"
                      />
                      {youtubeUrl ? (
                        <a
                          href={youtubeUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-slate-200 hover:text-orange-400 transition truncate"
                        >
                          {video.title}
                        </a>
                      ) : (
                        <span className="text-sm font-medium text-slate-200 truncate">
                          {video.title}
                        </span>
                      )}
                    </div>

                    <span
                      className={`inline-flex items-center gap-1.5 text-sm font-semibold shrink-0 ${
                        tier === 'Alta' || tier === 'Moderada'
                          ? 'text-emerald-400'
                          : 'text-slate-300'
                      }`}
                    >
                      {tier}
                      {tier === 'Alta' || tier === 'Moderada' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <ArrowDownCircle className="w-4 h-4 text-slate-400" />
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tipo de dispositivo + Principais geografias */}
      {(showDeviceTypes || showGeographies) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {showDeviceTypes && (
            <div
              className={`${
                showGeographies ? '' : 'lg:col-span-2'
              } rounded-2xl bg-[#121720] border border-slate-800/90 p-5 space-y-5`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-white">{t('deviceType')}</h2>
                  <p className="text-xs text-slate-400">
                    Tempo de visualização (horas) · Últimos {days} dias
                  </p>
                </div>
                <button
                  onClick={toggleDeviceTypes}
                  title="Ocultar este card"
                  className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-[#0b0f14] hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition cursor-pointer shrink-0"
                >
                  <EyeOff className="w-3.5 h-3.5" />
                  Ocultar
                </button>
              </div>

              <div className="flex items-center gap-2">
                {(
                  [
                    { id: 'all', label: 'Tudo' },
                    { id: 'videos', label: 'Vídeos' },
                    { id: 'shorts', label: 'Shorts' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setDeviceFormatTab(tab.id)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                      deviceFormatTab === tab.id
                        ? 'bg-slate-100 text-slate-900'
                        : 'bg-[#0b0f14] text-slate-300 hover:bg-slate-800 border border-slate-800'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Segmented horizontal bar */}
              <div className="h-2.5 w-full rounded-full bg-slate-800 overflow-hidden flex gap-0.5">
                {deviceTypesSummary.mobile > 0 && (
                  <div
                    className="h-full bg-slate-100 transition-all duration-500"
                    style={{ width: `${deviceTypesSummary.mobile}%` }}
                  />
                )}
                {deviceTypesSummary.desktop > 0 && (
                  <div
                    className="h-full bg-indigo-500 transition-all duration-500"
                    style={{ width: `${deviceTypesSummary.desktop}%` }}
                  />
                )}
                {deviceTypesSummary.tv > 0 && (
                  <div
                    className="h-full bg-purple-400 transition-all duration-500"
                    style={{ width: `${deviceTypesSummary.tv}%` }}
                  />
                )}
                {deviceTypesSummary.tablet > 0 && (
                  <div
                    className="h-full bg-rose-500 transition-all duration-500"
                    style={{ width: `${deviceTypesSummary.tablet}%` }}
                  />
                )}
              </div>

              <div className="space-y-3.5">
                {[
                  {
                    label: 'Telemóvel',
                    pct: deviceTypesSummary.mobile,
                    dotClass: 'bg-slate-100',
                  },
                  {
                    label: 'Computador',
                    pct: deviceTypesSummary.desktop,
                    dotClass: 'bg-indigo-500',
                  },
                  {
                    label: 'TV',
                    subtitle: 'Taxa de visualização simultânea: 1,50',
                    pct: deviceTypesSummary.tv,
                    dotClass: 'bg-purple-400',
                  },
                  {
                    label: 'Tablet',
                    pct: deviceTypesSummary.tablet,
                    dotClass: 'bg-rose-500',
                  },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between text-sm">
                    <div className="flex items-start gap-3">
                      <span className={`w-2.5 h-2.5 rounded-full mt-1.5 ${row.dotClass}`} />
                      <div>
                        <div className="text-slate-200 font-medium">{row.label}</div>
                        {row.subtitle && (
                          <div className="text-[11px] text-slate-400">{row.subtitle}</div>
                        )}
                      </div>
                    </div>
                    <span className="font-mono-num font-bold text-white">
                      {row.pct.toFixed(1).replace('.', ',')}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {showGeographies && (
            <div
              className={`${
                showDeviceTypes ? '' : 'lg:col-span-2'
              } rounded-2xl bg-[#121720] border border-slate-800/90 p-5 space-y-5`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-white">{t('topGeographies')}</h2>
                  <p className="text-xs text-slate-400">
                    Visualizações · Últimos {days} dias
                  </p>
                </div>
                <button
                  onClick={toggleGeographies}
                  title="Ocultar este card"
                  className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-[#0b0f14] hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition cursor-pointer shrink-0"
                >
                  <EyeOff className="w-3.5 h-3.5" />
                  Ocultar
                </button>
              </div>

              <div className="flex items-center gap-2">
                {(
                  [
                    { id: 'all', label: 'Tudo' },
                    { id: 'shorts', label: 'Shorts' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setGeoFormatTab(tab.id)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                      geoFormatTab === tab.id
                        ? 'bg-slate-100 text-slate-900'
                        : 'bg-[#0b0f14] text-slate-300 hover:bg-slate-800 border border-slate-800'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="space-y-3.5">
                {geographiesSummary.map((geo) => (
                  <div key={geo.country} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-200 font-medium">{geo.country}</span>
                      <span className="font-mono-num font-bold text-white">
                        {geo.pct.toFixed(1).replace('.', ',')}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-blue-500 transition-all duration-500"
                        style={{ width: `${Math.min(100, Math.max(0, geo.pct))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Idade + Género */}
      {(showAgeBreakdown || showGenderBreakdown) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {showAgeBreakdown && (
            <div
              className={`${
                showGenderBreakdown ? '' : 'lg:col-span-2'
              } rounded-2xl bg-[#121720] border border-slate-800/90 p-5 space-y-5`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-white">{t('ageTitle')}</h2>
                  <p className="text-xs text-slate-400">Visualizações · Últimos {days} dias</p>
                </div>
                <button
                  onClick={toggleAgeBreakdown}
                  title="Ocultar este card"
                  className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-[#0b0f14] hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition cursor-pointer shrink-0"
                >
                  <EyeOff className="w-3.5 h-3.5" />
                  Ocultar
                </button>
              </div>

              <div className="flex items-center gap-2">
                {(
                  [
                    { id: 'all', label: 'Tudo' },
                    { id: 'shorts', label: 'Shorts' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setAgeFormatTab(tab.id)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                      ageFormatTab === tab.id
                        ? 'bg-slate-100 text-slate-900'
                        : 'bg-[#0b0f14] text-slate-300 hover:bg-slate-800 border border-slate-800'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="space-y-3.5">
                {ageBreakdownSummary.map((row) => (
                  <div key={row.key} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-200 font-medium">{row.label}</span>
                      <span className="font-mono-num font-bold text-white">
                        {row.pct.toFixed(1).replace('.', ',')}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-blue-500 transition-all duration-500"
                        style={{ width: `${Math.min(100, Math.max(0, row.pct))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {showGenderBreakdown && (
            <div
              className={`${
                showAgeBreakdown ? '' : 'lg:col-span-2'
              } rounded-2xl bg-[#121720] border border-slate-800/90 p-5 space-y-5`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-white">{t('genderTitle')}</h2>
                  <p className="text-xs text-slate-400">Visualizações · Últimos {days} dias</p>
                </div>
                <button
                  onClick={toggleGenderBreakdown}
                  title="Ocultar este card"
                  className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-[#0b0f14] hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition cursor-pointer shrink-0"
                >
                  <EyeOff className="w-3.5 h-3.5" />
                  Ocultar
                </button>
              </div>

              <div className="flex items-center gap-2">
                {(
                  [
                    { id: 'all', label: 'Tudo' },
                    { id: 'shorts', label: 'Shorts' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setGenderFormatTab(tab.id)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                      genderFormatTab === tab.id
                        ? 'bg-slate-100 text-slate-900'
                        : 'bg-[#0b0f14] text-slate-300 hover:bg-slate-800 border border-slate-800'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="space-y-4">
                {genderBreakdownSummary.map((row) => (
                  <div key={row.key} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-200 font-medium">{row.label}</span>
                      <span className="font-mono-num font-bold text-white">
                        {row.pct.toFixed(1).replace('.', ',')}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-blue-500 transition-all duration-500"
                        style={{ width: `${Math.min(100, Math.max(0, row.pct))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
