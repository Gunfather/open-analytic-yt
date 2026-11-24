import React, { useMemo, useState } from 'react';
import {
  Check,
  Compass,
  Copy,
  ExternalLink,
  Flame,
  Globe2,
  Plus,
  Radar,
  RefreshCw,
  Search,
  Settings,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { searchNicheVideos } from '../services/youtubeApi';
import { NicheVideoItem } from '../types/youtube';
import { formatCompact, formatDuration, formatNumber } from '../utils/formatters';

type NicheSubTab = 'explorer' | 'competitors' | 'ai';

interface MarketOption {
  id: string;
  label: string;
  flag: string;
  regionCode: string;
  hl: string;
}

const MARKETS: MarketOption[] = [
  { id: 'BR', label: 'Brasil (PT-BR)', flag: '🇧🇷', regionCode: 'BR', hl: 'pt' },
  { id: 'US', label: 'EUA / Global (EN)', flag: '🇺🇸', regionCode: 'US', hl: 'en' },
  { id: 'FR', label: 'França (FR)', flag: '🇫🇷', regionCode: 'FR', hl: 'fr' },
  { id: 'ES', label: 'Espanha / LatAm (ES)', flag: '🇪🇸', regionCode: 'ES', hl: 'es' },
];

const QUICK_TOPICS = [
  { label: '🏺 Arqueologia Bíblica', q: 'arqueologia biblica misterios', market: 'BR' },
  { label: '📜 Biblical Mysteries', q: 'biblical archaeology mysteries', market: 'US' },
  { label: '⚜️ Énigmes Historiques', q: 'enigmes histoire archeologie', market: 'FR' },
  { label: '🧠 Psicologia & Comportamento', q: 'psicologia comportamento humano curiosidades', market: 'BR' },
  { label: '🕵️ Human Psychology Facts', q: 'dark psychology human behavior', market: 'US' },
  { label: '🌎 Misterios de la Historia', q: 'misterios arqueologia historia antigua', market: 'ES' },
];

interface ArbitrageRow {
  market: MarketOption;
  videosCount: number;
  avgViews: number;
  avgViewsPerDay: number;
  outliersCount: number;
  maxOutlier: number;
  opportunityScore: number;
}

function computeNicheMetrics(items: NicheVideoItem[]) {
  if (items.length === 0) {
    return {
      opportunityScore: 0,
      outliersCount: 0,
      maxOutlier: 0,
      avgViews: 0,
      medianViews: 0,
      avgViewsPerDay: 0,
      smallChannelWinPct: 0,
      shortsPct: 0,
      avgEngagement: 0,
    };
  }

  const sortedViews = [...items.map((i) => i.views)].sort((a, b) => a - b);
  const medianViews = sortedViews[Math.floor(sortedViews.length / 2)] || 0;
  const avgViews = Math.round(items.reduce((s, i) => s + i.views, 0) / items.length);
  const avgViewsPerDay = Math.round(
    items.reduce((s, i) => s + i.viewsPerDay, 0) / items.length
  );
  const outliers = items.filter((i) => i.outlierScore >= 2.0);
  const maxOutlier = Number(
    Math.max(...items.map((i) => i.outlierScore), 0).toFixed(1)
  );

  const hasSubsData = items.some((i) => i.channelSubs > 0);
  const smallWins = items.filter((i) =>
    hasSubsData ? i.channelSubs > 0 && i.channelSubs < 25000 : i.outlierScore >= 1.8
  );
  const smallChannelWinPct = Math.round((smallWins.length / items.length) * 100);
  const shortsPct = Math.round(
    (items.filter((i) => i.isShort).length / items.length) * 100
  );
  const avgEngagement = Number(
    (items.reduce((s, i) => s + i.engagementRate, 0) / items.length).toFixed(2)
  );

  // Composite score (0 - 100): rewards high daily velocity, high outlier rate, and low entry barrier
  const velocityPts = Math.min(35, Math.round(Math.log10(Math.max(avgViewsPerDay, 10)) * 8.5));
  const outlierPts = Math.min(30, Math.round((outliers.length / items.length) * 75));
  const barrierPts = Math.min(25, Math.round(smallChannelWinPct * 0.45));
  const engPts = Math.min(10, Math.round(avgEngagement * 2));
  const opportunityScore = Math.max(
    12,
    Math.min(99, velocityPts + outlierPts + barrierPts + engPts)
  );

  return {
    opportunityScore,
    outliersCount: outliers.length,
    maxOutlier,
    avgViews,
    medianViews,
    avgViewsPerDay,
    smallChannelWinPct,
    shortsPct,
    avgEngagement,
  };
}

function getScoreBadge(score: number) {
  if (score >= 75) {
    return {
      label: 'Mina de Ouro',
      cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    };
  }
  if (score >= 55) {
    return {
      label: 'Promissor',
      cls: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
    };
  }
  if (score >= 38) {
    return {
      label: 'Competitivo',
      cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    };
  }
  return {
    label: 'Saturado / Lento',
    cls: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  };
}

export function NicheAnalysisView() {
  const {
    apiKey,
    aiConfig,
    languages,
    groups,
    channels,
    competitors,
    isSyncingCompetitors,
    addCompetitor,
    removeCompetitor,
    syncCompetitors,
    setActiveTab,
    uiLanguage,
  } = useStore();

  const [subTab, setSubTab] = useState<NicheSubTab>('explorer');

  // 1) Keyword Explorer state
  const [query, setQuery] = useState('');
  const [marketId, setMarketId] = useState<string>('BR');
  const [publishedDays, setPublishedDays] = useState<number>(30);
  const [formatFilter, setFormatFilter] = useState<'all' | 'long' | 'short'>('all');
  const [sortBy, setSortBy] = useState<'outlier' | 'velocity' | 'views' | 'small'>('outlier');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<NicheVideoItem[]>([]);
  const [searchMeta, setSearchMeta] = useState<{
    source: 'api' | 'public';
    fromCache: boolean;
    lastQuery: string;
  } | null>(null);

  // Arbitrage 4-languages comparison state
  const [arbitrageLoading, setArbitrageLoading] = useState(false);
  const [arbitrageRows, setArbitrageRows] = useState<ArbitrageRow[]>([]);

  // 2) Competitor Radar state
  const [compHandle, setCompHandle] = useState('');
  const [compNicheTag, setCompNicheTag] = useState('');
  const [compLangId, setCompLangId] = useState(languages[0]?.id || 'pt-BR');
  const [addingComp, setAddingComp] = useState(false);
  const [compError, setCompError] = useState<string | null>(null);
  const [compFilterLang, setCompFilterLang] = useState<string>('all');
  const [addedRadarIds, setAddedRadarIds] = useState<Record<string, boolean>>({});

  // 3) AI Reverse Engineering Lab state
  const [aiSource, setAiSource] = useState<'search' | 'competitors' | 'video'>('search');
  const [focusedVideo, setFocusedVideo] = useState<{
    title: string;
    channelTitle: string;
    views: number;
    outlierScore: number;
    isShort: boolean;
  } | null>(null);
  const [targetGroupId, setTargetGroupId] = useState<string>('all');
  const [customBrief, setCustomBrief] = useState(
    'Identifique os padrões de títulos/ganchos que geraram views acima da média, aponte brechas nos 4 idiomas e crie 4 pautas completas (Título + Ideia de Thumbnail + Gancho de 15s) adaptadas para PT-BR, EN, FR e ES.'
  );
  const [aiLoading, setAiLoading] = useState(false);
  const [aiOutput, setAiOutput] = useState('');
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiModelUsed, setAiModelUsed] = useState('');
  const [copied, setCopied] = useState(false);

  const langMap = useMemo(() => new Map(languages.map((l) => [l.id, l])), [languages]);

  const executeSearch = async (
    overrideQuery?: string,
    overrideMarketId?: string,
    forceRefresh = false
  ) => {
    const q = (overrideQuery ?? query).trim();
    if (!q) return;
    const mId = overrideMarketId ?? marketId;
    const market = MARKETS.find((m) => m.id === mId) || MARKETS[0];

    setSearching(true);
    setSearchError(null);
    try {
      const res = await searchNicheVideos({
        query: q,
        regionCode: market.regionCode,
        relevanceLanguage: market.hl,
        publishedAfterDays: publishedDays,
        apiKey,
        forceRefresh,
      });
      setSearchResults(res.items);
      setSearchMeta({
        source: res.source,
        fromCache: res.fromCache,
        lastQuery: q,
      });
    } catch (err) {
      setSearchError(
        err instanceof Error ? err.message : 'Erro ao pesquisar vídeos do nicho.'
      );
    } finally {
      setSearching(false);
    }
  };

  const runArbitrageComparison = async () => {
    const q = query.trim();
    if (!q) return;
    setArbitrageLoading(true);
    setSearchError(null);
    try {
      const rows = await Promise.all(
        MARKETS.map(async (mkt) => {
          const res = await searchNicheVideos({
            query: q,
            regionCode: mkt.regionCode,
            relevanceLanguage: mkt.hl,
            publishedAfterDays: publishedDays,
            apiKey,
          });
          const stats = computeNicheMetrics(res.items);
          return {
            market: mkt,
            videosCount: res.items.length,
            avgViews: stats.avgViews,
            avgViewsPerDay: stats.avgViewsPerDay,
            outliersCount: stats.outliersCount,
            maxOutlier: stats.maxOutlier,
            opportunityScore: stats.opportunityScore,
          };
        })
      );
      setArbitrageRows(rows.sort((a, b) => b.opportunityScore - a.opportunityScore));
    } catch (err) {
      setSearchError(
        err instanceof Error ? err.message : 'Falha ao comparar mercados.'
      );
    } finally {
      setArbitrageLoading(false);
    }
  };

  const filteredSearchVideos = useMemo(() => {
    return searchResults
      .filter((v) => {
        if (formatFilter === 'short') return v.isShort;
        if (formatFilter === 'long') return !v.isShort;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'outlier') return b.outlierScore - a.outlierScore;
        if (sortBy === 'velocity') return b.viewsPerDay - a.viewsPerDay;
        if (sortBy === 'small') {
          const aSubs = a.channelSubs > 0 ? a.channelSubs : 9999999;
          const bSubs = b.channelSubs > 0 ? b.channelSubs : 9999999;
          return aSubs - bSubs || b.outlierScore - a.outlierScore;
        }
        return b.views - a.views;
      });
  }, [searchResults, formatFilter, sortBy]);

  const nicheStats = useMemo(
    () => computeNicheMetrics(filteredSearchVideos),
    [filteredSearchVideos]
  );

  const handleQuickAddRadar = async (v: NicheVideoItem) => {
    const target = v.channelHandle || v.channelId;
    if (!target) return;
    const mappedLang =
      marketId === 'BR'
        ? 'pt-BR'
        : marketId === 'US'
        ? 'en'
        : marketId === 'FR'
        ? 'fr'
        : 'es';
    try {
      setAddedRadarIds((prev) => ({ ...prev, [v.channelId || v.id]: true }));
      await addCompetitor({
        handle: target,
        nicheTag: searchMeta?.lastQuery || query || 'Pesquisa',
        languageId: mappedLang,
      });
    } catch {
      setAddedRadarIds((prev) => ({ ...prev, [v.channelId || v.id]: false }));
    }
  };

  const handleAddCompetitorForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!compHandle.trim()) return;
    setAddingComp(true);
    setCompError(null);
    try {
      await addCompetitor({
        handle: compHandle.trim(),
        nicheTag: compNicheTag.trim() || 'Concorrente',
        languageId: compLangId,
      });
      setCompHandle('');
      setCompNicheTag('');
    } catch (err) {
      setCompError(
        err instanceof Error
          ? err.message
          : 'Não foi possível carregar este canal concorrente.'
      );
    } finally {
      setAddingComp(false);
    }
  };

  const visibleCompetitors = useMemo(() => {
    return competitors.filter((c) =>
      compFilterLang === 'all' ? true : c.languageId === compFilterLang
    );
  }, [competitors, compFilterLang]);

  const allCompetitorOutliers = useMemo(() => {
    const list: Array<{
      compId: string;
      channelName: string;
      channelHandle: string;
      channelAvatar: string;
      languageId: string;
      nicheTag: string;
      avgViewsRecent: number;
      video: CompetitorChannelVideoView;
    }> = [];

    type CompetitorChannelVideoView = (typeof competitors)[number]['videos'][number];

    for (const comp of visibleCompetitors) {
      for (const v of comp.videos) {
        list.push({
          compId: comp.id,
          channelName: comp.name,
          channelHandle: comp.handle,
          channelAvatar: comp.avatarUrl,
          languageId: comp.languageId,
          nicheTag: comp.nicheTag,
          avgViewsRecent: comp.avgViewsRecent,
          video: v,
        });
      }
    }

    return list.sort((a, b) => b.video.outlierScore - a.video.outlierScore);
  }, [visibleCompetitors]);

  const ownNetworkAvgViews = useMemo(() => {
    const active = channels.filter((c) => c.isActive);
    if (active.length === 0) return 0;
    const totalViews = active.reduce((s, c) => s + c.viewsTotal, 0);
    const totalVideos = Math.max(1, active.reduce((s, c) => s + c.videosTotal, 0));
    return Math.round(totalViews / totalVideos);
  }, [channels]);

  const openAiForVideo = (item: {
    title: string;
    channelTitle: string;
    views: number;
    outlierScore: number;
    isShort: boolean;
  }) => {
    setFocusedVideo(item);
    setAiSource('video');
    setSubTab('ai');
  };

  const buildLocalNicheBlueprint = () => {
    const targetGroup =
      targetGroupId === 'all'
        ? 'Todos os Grupos'
        : groups.find((g) => g.id === targetGroupId)?.name || targetGroupId;

    const sampleVideos =
      aiSource === 'video' && focusedVideo
        ? [focusedVideo]
        : aiSource === 'competitors'
        ? allCompetitorOutliers.slice(0, 10).map((o) => ({
            title: o.video.title,
            channelTitle: o.channelName,
            views: o.video.views,
            outlierScore: o.video.outlierScore,
            isShort: o.video.isShort,
          }))
        : filteredSearchVideos.slice(0, 10).map((v) => ({
            title: v.title,
            channelTitle: v.channelTitle,
            views: v.views,
            outlierScore: v.outlierScore,
            isShort: v.isShort,
          }));

    if (sampleVideos.length === 0) {
      return '⚠️ Faça primeiro uma pesquisa de nicho ou adicione canais ao Radar de Concorrentes para gerar a engenharia reversa.';
    }

    const top = sampleVideos[0];
    const shortsCount = sampleVideos.filter((v) => v.isShort).length;
    const dominantFormat =
      shortsCount > sampleVideos.length / 2 ? 'Shorts (<= 60s)' : 'Vídeos Longos (5 a 12 min)';

    return [
      `🎯 DIAGNÓSTICO ESTRATÉGICO DE NICHO (Analisador Local v2.0)`,
      `• Grupo Alvo: ${targetGroup} | Amostra analisada: ${sampleVideos.length} vídeo(s) de destaque`,
      `• Formato dominante nos Outliers: ${dominantFormat}`,
      `• Principal Outlier detectado: "${top.title}" — ${top.channelTitle} (${formatNumber(
        top.views
      )} views · 🔥 ${top.outlierScore}x acima da média)`,
      '',
      `🔍 TOP OUTLIERS IDENTIFICADOS:`,
      ...sampleVideos.slice(0, 5).map(
        (v, idx) =>
          `${idx + 1}. [${v.outlierScore}x] "${v.title}" (${v.channelTitle} · ${formatCompact(
            v.views
          )} views · ${v.isShort ? 'Short' : 'Longo'})`
      ),
      '',
      `🌍 PLANO DE ADAPTAÇÃO MULTI-IDIOMA (4 MERCADOS):`,
      `• 🇧🇷 PT-BR: Adapte o ângulo de "${top.title.slice(
        0,
        55
      )}..." usando curiosidade direta + pergunta implícita na thumbnail (2 a 4 palavras em amarelo/branco de alto contraste).`,
      `• 🇺🇸 EN: Foque em retenção rápida nos primeiros 12 segundos ("Most historians never noticed this detail...") — mercado com maior RPM.`,
      `• 🇫🇷 FR: Excelente oportunidade de arbitragem; títulos com "Le Secret..." / "L'Énigme que..." têm forte CTR em canais francófonos.`,
      `• 🇪🇸 ES: Aposte em narrativa dramática e ritmo ágil para capturar tráfego simultâneo de Espanha, México e EUA Hispânico.`,
      '',
      `💡 Dica: Configure uma chave de API gratuita (Groq, Gemini, DeepSeek, OpenRouter ou NVIDIA) em Configurações & API para gerar títulos, roteiros de ganchos e thumbnails sob medida com IA generativa.`,
    ].join('\n');
  };

  const runAiNicheBlueprint = async () => {
    setAiLoading(true);
    setAiError(null);

    try {
      if (!aiConfig.apiKey) {
        setAiModelUsed('Diagnóstico Local');
        setAiOutput(buildLocalNicheBlueprint());
        return;
      }

      const targetGroup =
        targetGroupId === 'all'
          ? 'Toda a rede de canais'
          : groups.find((g) => g.id === targetGroupId)?.name || targetGroupId;

      const sample =
        aiSource === 'video' && focusedVideo
          ? [focusedVideo]
          : aiSource === 'competitors'
          ? allCompetitorOutliers.slice(0, 12).map((o) => ({
              title: o.video.title,
              channel: o.channelName,
              language: o.languageId,
              views: o.video.views,
              viewsPerDay: o.video.viewsPerDay,
              outlierMultiplier: o.video.outlierScore,
              format: o.video.isShort ? 'Short' : 'Long-form',
            }))
          : filteredSearchVideos.slice(0, 12).map((v) => ({
              title: v.title,
              channel: v.channelTitle,
              channelSubs: v.channelSubs,
              views: v.views,
              viewsPerDay: v.viewsPerDay,
              outlierMultiplier: v.outlierScore,
              format: v.isShort ? 'Short' : 'Long-form',
            }));

      if (sample.length === 0) {
        setAiModelUsed('');
        setAiOutput(buildLocalNicheBlueprint());
        return;
      }

      const langReply =
        uiLanguage === 'en'
          ? 'Respond in English.'
          : uiLanguage === 'fr'
          ? 'Respond in French.'
          : uiLanguage === 'es'
          ? 'Respond in Spanish.'
          : 'Responda em Português (PT-BR).';

      const prompt = `Você é um estrategista sênior de canais Dark/Faceless multi-idioma no YouTube. ${langReply}

Rede do usuário:
- Grupo alvo selecionado: ${targetGroup}
- Idiomas operados: Português (PT-BR), Inglês (EN), Francês (FR) e Espanhol (ES)
- Termo / Nicho pesquisado: ${searchMeta?.lastQuery || query || 'Radar de Concorrentes'}
${
  arbitrageRows.length > 0
    ? `- Comparativo de Arbitragem 4 Idiomas: ${JSON.stringify(
        arbitrageRows.map((r) => ({
          market: r.market.id,
          score: r.opportunityScore,
          avgViewsPerDay: r.avgViewsPerDay,
          outliers: r.outliersCount,
        }))
      )}`
    : ''
}

Amostra de Vídeos Outliers reais do YouTube:
${JSON.stringify(sample, null, 2)}

Pedido específico:
${customBrief}

Estruture a resposta de forma clara e prática com:
1. Diagnóstico do Nicho & Padrões Vencedores (por que esses outliers explodiram)
2. Oportunidade de Arbitragem entre PT-BR, EN, FR e ES
3. 4 Pautas Prontas para Produção (adaptadas culturalmente para PT-BR, EN, FR e ES, cada uma com: Título Magnético, Ideia Visual de Thumbnail e Gancho dos primeiros 15 segundos).`;

      const res = await fetch('/api/ai-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: aiConfig.provider,
          apiKey: aiConfig.apiKey,
          model: aiConfig.model,
          prompt,
        }),
      });

      const rawText = await res.text();
      if (rawText.trimStart().startsWith('<')) {
        throw new Error(
          'Reinicie o servidor local para ativar as novas rotas v2.0 da IA e pesquisa.'
        );
      }
      const data = JSON.parse(rawText) as {
        ok?: boolean;
        text?: string;
        model?: string;
        error?: string;
      };
      if (!res.ok || !data.ok || !data.text) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      setAiModelUsed(`${aiConfig.provider.toUpperCase()} · ${data.model || aiConfig.model || ''}`);
      setAiOutput(data.text);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Erro na requisição de IA');
      setAiModelUsed('Diagnóstico Local (Fallback)');
      setAiOutput(buildLocalNicheBlueprint());
    } finally {
      setAiLoading(false);
    }
  };

  const handleCopyAi = async () => {
    if (!aiOutput) return;
    try {
      await navigator.clipboard.writeText(aiOutput);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const scoreBadge = getScoreBadge(nicheStats.opportunityScore);

  return (
    <div className="p-6 space-y-6">
      {/* Header & 3-Pillar Navigation */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-[#121720] border border-slate-800/90 rounded-2xl p-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center">
              <Compass className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Inteligência & Análise de Nicho
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  v2.0 Suite
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Descubra vídeos outliers, monitore concorrentes em separado e gere pautas multi-idioma com IA.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setSubTab('explorer')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
              subTab === 'explorer'
                ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
                : 'bg-[#0b0f14] text-slate-300 hover:text-white border border-slate-800'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            1. Explorador de Subnicho
          </button>

          <button
            onClick={() => setSubTab('competitors')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
              subTab === 'competitors'
                ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
                : 'bg-[#0b0f14] text-slate-300 hover:text-white border border-slate-800'
            }`}
          >
            <Radar className="w-3.5 h-3.5" />
            2. Radar de Concorrentes ({competitors.length})
          </button>

          <button
            onClick={() => setSubTab('ai')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
              subTab === 'ai'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20'
                : 'bg-[#0b0f14] text-purple-300 hover:text-white border border-purple-500/30'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            3. Engenharia Reversa & Pautas (IA)
          </button>
        </div>
      </div>

      {/* =================================================================== */}
      {/* TAB 1: KEYWORD & SUBNICHE EXPLORER                                  */}
      {/* =================================================================== */}
      {subTab === 'explorer' && (
        <div className="space-y-5">
          {/* Search Controls */}
          <div className="rounded-2xl bg-[#121720] border border-slate-800/90 p-5 space-y-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void executeSearch();
              }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-3"
            >
              <div className="lg:col-span-5 relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Digite um nicho, tema ou palavra-chave (ex: arqueologia bíblica, dark psychology)..."
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-[#0b0f14] border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="lg:col-span-2">
                <select
                  value={marketId}
                  onChange={(e) => setMarketId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#0b0f14] border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-orange-500 cursor-pointer"
                >
                  {MARKETS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.flag} {m.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="lg:col-span-2">
                <select
                  value={publishedDays}
                  onChange={(e) => setPublishedDays(Number(e.target.value))}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#0b0f14] border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-orange-500 cursor-pointer"
                >
                  <option value={7}>Últimos 7 dias</option>
                  <option value={30}>Últimos 30 dias</option>
                  <option value={90}>Últimos 90 dias</option>
                  <option value={0}>Qualquer data</option>
                </select>
              </div>

              <div className="lg:col-span-3 flex items-center gap-2">
                <button
                  type="submit"
                  disabled={searching || !query.trim()}
                  className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                >
                  <Search className="w-3.5 h-3.5" />
                  {searching ? 'Analisando...' : 'Explorar Nicho'}
                </button>

                <button
                  type="button"
                  onClick={() => void runArbitrageComparison()}
                  disabled={arbitrageLoading || !query.trim()}
                  title="Comparar demanda e concorrência deste tema nos 4 idiomas (BR, US, FR, ES)"
                  className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/30 text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                >
                  <Globe2 className={`w-3.5 h-3.5 ${arbitrageLoading ? 'animate-spin' : ''}`} />
                  4 Idiomas
                </button>
              </div>
            </form>

            {/* Preset Chips */}
            <div className="flex items-center gap-2 flex-wrap pt-1">
              <span className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">
                Sugestões rápidas:
              </span>
              {QUICK_TOPICS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    setQuery(preset.q);
                    setMarketId(preset.market);
                    void executeSearch(preset.q, preset.market);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-[#0b0f14] hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-[11px] transition cursor-pointer"
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {searchError && (
              <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 px-4 py-2.5 text-xs text-rose-300">
                {searchError}
              </div>
            )}
          </div>

          {/* 4-Language Arbitrage Matrix */}
          {arbitrageRows.length > 0 && (
            <div className="rounded-2xl bg-[#121720] border border-sky-500/30 p-5 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Globe2 className="w-4 h-4 text-sky-400" />
                  <h3 className="text-sm font-bold text-white">
                    Matriz de Arbitragem Multi-Idioma — &ldquo;{query}&rdquo;
                  </h3>
                </div>
                <button
                  onClick={() => setArbitrageRows([])}
                  className="text-[11px] text-slate-400 hover:text-white cursor-pointer"
                >
                  Ocultar matriz
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {arbitrageRows.map((row, idx) => {
                  const badge = getScoreBadge(row.opportunityScore);
                  return (
                    <div
                      key={row.market.id}
                      onClick={() => {
                        setMarketId(row.market.id);
                        void executeSearch(query, row.market.id);
                      }}
                      className={`rounded-xl p-4 border transition cursor-pointer ${
                        idx === 0
                          ? 'bg-emerald-500/5 border-emerald-500/40 hover:border-emerald-400'
                          : 'bg-[#0b0f14] border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-white">
                          {row.market.flag} {row.market.label}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${badge.cls}`}
                        >
                          Score {row.opportunityScore}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center pt-2 border-t border-slate-800/80">
                        <div>
                          <div className="text-xs font-bold font-mono-num text-white">
                            {formatCompact(row.avgViewsPerDay)}
                          </div>
                          <div className="text-[10px] text-slate-500">Views/Dia</div>
                        </div>
                        <div>
                          <div className="text-xs font-bold font-mono-num text-orange-400">
                            {row.outliersCount}
                          </div>
                          <div className="text-[10px] text-slate-500">Outliers</div>
                        </div>
                        <div>
                          <div className="text-xs font-bold font-mono-num text-emerald-400">
                            {row.maxOutlier}x
                          </div>
                          <div className="text-[10px] text-slate-500">Top Pico</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Niche KPI Cards & Results */}
          {searchResults.length > 0 && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-2xl bg-[#121720] border border-slate-800/90 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-slate-400 font-medium">
                      Score de Oportunidade
                    </span>
                    <Target className="w-4 h-4 text-orange-400" />
                  </div>
                  <div className="flex items-baseline gap-2.5">
                    <span className="text-2xl font-extrabold font-mono-num text-white">
                      {nicheStats.opportunityScore}/100
                    </span>
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border ${scoreBadge.cls}`}
                    >
                      {scoreBadge.label}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1.5">
                    Combina velocidade diária, taxa de outliers e barreira de entrada.
                  </p>
                </div>

                <div className="rounded-2xl bg-[#121720] border border-slate-800/90 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-slate-400 font-medium">
                      Vídeos Outliers (≥ 2.0x)
                    </span>
                    <Flame className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-extrabold font-mono-num text-emerald-400">
                      {nicheStats.outliersCount}
                    </span>
                    <span className="text-xs text-slate-400">
                      de {filteredSearchVideos.length} vídeos (pico{' '}
                      <strong className="text-white">{nicheStats.maxOutlier}x</strong>)
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1.5">
                    Temas validados pelo algoritmo acima da média do canal.
                  </p>
                </div>

                <div className="rounded-2xl bg-[#121720] border border-slate-800/90 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-slate-400 font-medium">
                      Tração Média (Views / Dia)
                    </span>
                    <Zap className="w-4 h-4 text-sky-400" />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-extrabold font-mono-num text-white">
                      {formatCompact(nicheStats.avgViewsPerDay)}
                    </span>
                    <span className="text-xs text-slate-400">
                      mediana {formatCompact(nicheStats.medianViews)} views
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1.5">
                    Engajamento médio estimado: {nicheStats.avgEngagement}%
                  </p>
                </div>

                <div className="rounded-2xl bg-[#121720] border border-slate-800/90 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-slate-400 font-medium">
                      Espaço p/ Canais Novos
                    </span>
                    <Users className="w-4 h-4 text-purple-400" />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-extrabold font-mono-num text-purple-300">
                      {nicheStats.smallChannelWinPct}%
                    </span>
                    <span className="text-xs text-slate-400">
                      Shorts: {nicheStats.shortsPct}% · Longos: {100 - nicheStats.shortsPct}%
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1.5">
                    Fatia de canais menores (&lt; 25K) ou vídeos furando a bolha.
                  </p>
                </div>
              </div>

              {/* Filter & Action Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-[#121720] border border-slate-800/90 rounded-2xl px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={formatFilter}
                    onChange={(e) => setFormatFilter(e.target.value as 'all' | 'long' | 'short')}
                    className="px-3 py-1.5 rounded-xl bg-[#0b0f14] border border-slate-700 text-xs text-slate-200 focus:outline-none"
                  >
                    <option value="all">Todos os Formatos</option>
                    <option value="long">Apenas Vídeos Longos</option>
                    <option value="short">Apenas Shorts</option>
                  </select>

                  <select
                    value={sortBy}
                    onChange={(e) =>
                      setSortBy(e.target.value as 'outlier' | 'velocity' | 'views' | 'small')
                    }
                    className="px-3 py-1.5 rounded-xl bg-[#0b0f14] border border-slate-700 text-xs text-slate-200 focus:outline-none"
                  >
                    <option value="outlier">🔥 Maior Outlier Score</option>
                    <option value="velocity">⚡ Maior Velocidade (Views/Dia)</option>
                    <option value="views">👁️ Mais Views Totais</option>
                    <option value="small">🎯 Menores Canais Ranqueando</option>
                  </select>

                  {searchMeta && (
                    <span className="text-[11px] text-slate-400 flex items-center gap-1.5 ml-1">
                      Fonte:{' '}
                      <strong
                        className={
                          searchMeta.source === 'api' ? 'text-emerald-400' : 'text-amber-300'
                        }
                      >
                        {searchMeta.source === 'api' ? 'YouTube API v3' : 'Busca Pública (0 Quota)'}
                      </strong>
                      {searchMeta.fromCache && (
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300">
                          Cache 6h
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => void executeSearch(searchMeta.lastQuery, marketId, true)}
                        title="Forçar atualização ao vivo"
                        className="text-slate-400 hover:text-white cursor-pointer ml-1"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setAiSource('search');
                    setFocusedVideo(null);
                    setSubTab('ai');
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold transition cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Gerar Pautas 4 Idiomas dos Outliers (IA)
                </button>
              </div>

              {/* 4-per-row Niche Video Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {filteredSearchVideos.map((v) => {
                  const ytUrl = v.isShort
                    ? `https://www.youtube.com/shorts/${v.id}`
                    : `https://www.youtube.com/watch?v=${v.id}`;
                  const isStrongOutlier = v.outlierScore >= 2.0;
                  const radarKey = v.channelId || v.id;
                  const alreadyAdded = Boolean(addedRadarIds[radarKey]);

                  return (
                    <div
                      key={v.id}
                      className={`rounded-2xl bg-[#121720] border overflow-hidden transition flex flex-col ${
                        isStrongOutlier
                          ? 'border-emerald-500/40 hover:border-emerald-400'
                          : 'border-slate-800/90 hover:border-slate-700'
                      }`}
                    >
                      <div className="relative aspect-video bg-slate-900">
                        <a
                          href={ytUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block w-full h-full group"
                        >
                          <img
                            src={v.thumbnailUrl}
                            alt={v.title}
                            className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition"
                          />
                        </a>

                        <span
                          className={`absolute top-2 left-2 px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase shadow ${
                            v.outlierScore >= 5
                              ? 'bg-orange-500 text-white'
                              : isStrongOutlier
                              ? 'bg-emerald-500 text-slate-950'
                              : 'bg-black/80 text-slate-200 border border-white/10'
                          }`}
                        >
                          {isStrongOutlier ? '🔥 ' : ''}
                          {v.outlierScore}x Outlier
                        </span>

                        {v.isShort && (
                          <span className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-purple-600/90 text-[10px] font-bold uppercase text-white">
                            Short
                          </span>
                        )}

                        <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/80 text-[11px] font-mono-num text-white">
                          {formatDuration(v.durationSec)}
                        </span>
                      </div>

                      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                        <div className="space-y-1.5">
                          <a
                            href={ytUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-semibold text-white hover:text-orange-400 transition line-clamp-2 block"
                          >
                            {v.title}
                          </a>

                          <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400">
                            <span className="truncate font-medium text-slate-300">
                              {v.channelTitle}
                              {v.channelSubs > 0 ? ` · ${formatCompact(v.channelSubs)} subs` : ''}
                            </span>
                            <button
                              type="button"
                              onClick={() => void handleQuickAddRadar(v)}
                              disabled={alreadyAdded}
                              title="Adicionar canal ao Radar de Concorrentes"
                              className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold transition cursor-pointer ${
                                alreadyAdded
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                              }`}
                            >
                              {alreadyAdded ? (
                                <>
                                  <Check className="w-3 h-3" /> No Radar
                                </>
                              ) : (
                                <>
                                  <Plus className="w-3 h-3" /> Radar
                                </>
                              )}
                            </button>
                          </div>
                        </div>

                        <div className="space-y-2.5">
                          <div className="grid grid-cols-3 gap-2 pt-2.5 border-t border-slate-800/70 text-center">
                            <div>
                              <div className="text-xs font-bold font-mono-num text-white">
                                {formatCompact(v.views)}
                              </div>
                              <div className="text-[10px] text-slate-500">Views</div>
                            </div>
                            <div>
                              <div className="text-xs font-bold font-mono-num text-sky-400">
                                {formatCompact(v.viewsPerDay)}
                              </div>
                              <div className="text-[10px] text-slate-500">Views/Dia</div>
                            </div>
                            <div>
                              <div className="text-xs font-bold font-mono-num text-emerald-400">
                                {v.engagementRate}%
                              </div>
                              <div className="text-[10px] text-slate-500">Engaj.</div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] text-slate-500">
                              {v.publishedAt} ({v.daysAgo}d)
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                openAiForVideo({
                                  title: v.title,
                                  channelTitle: v.channelTitle,
                                  views: v.views,
                                  outlierScore: v.outlierScore,
                                  isShort: v.isShort,
                                })
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 text-[11px] font-semibold transition cursor-pointer"
                            >
                              <Sparkles className="w-3 h-3" />
                              Adaptar 4 Idiomas
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {searchResults.length === 0 && !searching && (
            <div className="rounded-2xl bg-[#121720] border border-slate-800/80 p-10 text-center space-y-3">
              <Compass className="w-10 h-10 text-orange-400 mx-auto opacity-80" />
              <h3 className="text-sm font-bold text-white">
                Pesquise qualquer nicho ou clique numa sugestão rápida acima
              </h3>
              <p className="text-xs text-slate-400 max-w-xl mx-auto">
                O Explorador identifica vídeos que multiplicaram as views acima da média do próprio canal (Outliers) e compara a oportunidade de entrada entre Português, Inglês, Francês e Espanhol.
              </p>
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 2: COMPETITOR RADAR (ISOLATED BENCHMARK)                        */}
      {/* =================================================================== */}
      {subTab === 'competitors' && (
        <div className="space-y-5">
          {/* Add Competitor Bar */}
          <div className="rounded-2xl bg-[#121720] border border-slate-800/90 p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Radar className="w-4 h-4 text-orange-400" />
                  Radar de Canais Concorrentes (Isolado dos seus KPIs)
                </h3>
                <p className="text-xs text-slate-400">
                  Monitore canais referência do seu nicho sem misturar nas receitas ou métricas dos seus próprios canais.
                </p>
              </div>

              {competitors.length > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void syncCompetitors()}
                    disabled={isSyncingCompetitors}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-semibold border border-slate-700 transition cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${
                        isSyncingCompetitors ? 'animate-spin text-orange-400' : ''
                      }`}
                    />
                    {isSyncingCompetitors ? 'Atualizando...' : 'Atualizar Radar'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAiSource('competitors');
                      setFocusedVideo(null);
                      setSubTab('ai');
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold transition cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Analisar Concorrentes (IA)
                  </button>
                </div>
              )}
            </div>

            <form
              onSubmit={handleAddCompetitorForm}
              className="grid grid-cols-1 sm:grid-cols-12 gap-3"
            >
              <div className="sm:col-span-5">
                <input
                  type="text"
                  required
                  value={compHandle}
                  onChange={(e) => setCompHandle(e.target.value)}
                  placeholder="@handle do concorrente ou Channel ID (UC...)"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0b0f14] border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                />
              </div>
              <div className="sm:col-span-3">
                <input
                  type="text"
                  value={compNicheTag}
                  onChange={(e) => setCompNicheTag(e.target.value)}
                  placeholder="Subnicho (ex: História Bíblica)"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0b0f14] border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                />
              </div>
              <div className="sm:col-span-2">
                <select
                  value={compLangId}
                  onChange={(e) => setCompLangId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#0b0f14] border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-orange-500"
                >
                  {languages.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.flag} {l.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={addingComp || !compHandle.trim()}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {addingComp ? 'Buscando...' : 'Monitorar'}
                </button>
              </div>
            </form>

            {compError && (
              <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 px-4 py-2.5 text-xs text-rose-300">
                {compError}
              </div>
            )}
          </div>

          {competitors.length > 0 ? (
            <>
              {/* Language Filter + Own Benchmark Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => setCompFilterLang('all')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium cursor-pointer transition ${
                      compFilterLang === 'all'
                        ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40'
                        : 'bg-[#121720] text-slate-400 border border-slate-800 hover:text-white'
                    }`}
                  >
                    Todos ({competitors.length})
                  </button>
                  {languages.map((l) => {
                    const cnt = competitors.filter((c) => c.languageId === l.id).length;
                    if (cnt === 0) return null;
                    return (
                      <button
                        key={l.id}
                        onClick={() => setCompFilterLang(l.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-medium cursor-pointer transition ${
                          compFilterLang === l.id
                            ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40'
                            : 'bg-[#121720] text-slate-400 border border-slate-800 hover:text-white'
                        }`}
                      >
                        {l.flag} {l.name} ({cnt})
                      </button>
                    );
                  })}
                </div>

                {ownNetworkAvgViews > 0 && (
                  <div className="text-xs text-slate-400 flex items-center gap-1.5 bg-[#121720] border border-slate-800 px-3 py-1.5 rounded-xl">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                    Sua média por vídeo na rede:{' '}
                    <strong className="text-white font-mono-num">
                      {formatCompact(ownNetworkAvgViews)} views
                    </strong>
                  </div>
                )}
              </div>

              {/* Competitor Channel Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {visibleCompetitors.map((comp) => {
                  const lang = langMap.get(comp.languageId);
                  const bestOutlier = Math.max(
                    ...comp.videos.map((v) => v.outlierScore),
                    0
                  );
                  return (
                    <div
                      key={comp.id}
                      className="rounded-2xl bg-[#121720] border border-slate-800/90 p-4 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img
                            src={comp.avatarUrl}
                            alt={comp.name}
                            className="w-10 h-10 rounded-full object-cover border border-slate-700 shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-white truncate">
                              {comp.name}
                            </div>
                            <div className="text-[11px] text-slate-400 truncate">
                              {comp.handle}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => removeCompetitor(comp.id)}
                          title="Remover do Radar"
                          className="text-slate-500 hover:text-rose-400 transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                        {lang && (
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 font-semibold">
                            {lang.flag} {lang.code}
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded bg-orange-500/15 text-orange-300 font-semibold">
                          {comp.nicheTag}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800/70 text-center">
                        <div>
                          <div className="text-xs font-bold font-mono-num text-white">
                            {formatCompact(comp.subscribersTotal)}
                          </div>
                          <div className="text-[10px] text-slate-500">Inscritos</div>
                        </div>
                        <div>
                          <div className="text-xs font-bold font-mono-num text-sky-400">
                            {formatCompact(comp.avgViewsRecent)}
                          </div>
                          <div className="text-[10px] text-slate-500">Média Rec.</div>
                        </div>
                        <div>
                          <div className="text-xs font-bold font-mono-num text-emerald-400">
                            {bestOutlier.toFixed(1)}x
                          </div>
                          <div className="text-[10px] text-slate-500">Top Outlier</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Consolidated Competitor Outlier Videos Feed (4 per row) */}
              <div className="space-y-3 pt-2">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Flame className="w-4 h-4 text-orange-400" />
                  Vídeos Outliers dos Concorrentes (Ordenados por Multiplicador acima da Média do Canal)
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {allCompetitorOutliers.slice(0, 24).map(({ channelName, languageId, video }) => {
                    const lang = langMap.get(languageId);
                    const ytUrl = video.isShort
                      ? `https://www.youtube.com/shorts/${video.id}`
                      : `https://www.youtube.com/watch?v=${video.id}`;
                    const isHot = video.outlierScore >= 1.8;

                    return (
                      <div
                        key={`${channelName}-${video.id}`}
                        className={`rounded-2xl bg-[#121720] border overflow-hidden flex flex-col transition ${
                          isHot
                            ? 'border-orange-500/40 hover:border-orange-400'
                            : 'border-slate-800/90 hover:border-slate-700'
                        }`}
                      >
                        <div className="relative aspect-video bg-slate-900">
                          <a
                            href={ytUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block w-full h-full"
                          >
                            <img
                              src={video.thumbnailUrl}
                              alt={video.title}
                              className="w-full h-full object-cover"
                            />
                          </a>
                          <span
                            className={`absolute top-2 left-2 px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase ${
                              isHot
                                ? 'bg-orange-500 text-white'
                                : 'bg-black/80 text-slate-200'
                            }`}
                          >
                            {isHot ? '🔥 ' : ''}
                            {video.outlierScore}x da média
                          </span>
                          {lang && (
                            <span className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-black/75 text-[10px] text-white">
                              {lang.flag} {lang.code}
                            </span>
                          )}
                          <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/80 text-[11px] font-mono-num text-white">
                            {formatDuration(video.durationSec)}
                          </span>
                        </div>

                        <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                          <div>
                            <a
                              href={ytUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs font-semibold text-white hover:text-orange-400 line-clamp-2 block mb-1"
                            >
                              {video.title}
                            </a>
                            <div className="text-[11px] text-slate-400 flex items-center justify-between">
                              <span className="truncate">{channelName}</span>
                              <span>{video.publishedAt}</span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-2.5 border-t border-slate-800/70">
                            <div className="text-xs font-bold font-mono-num text-white">
                              {formatCompact(video.views)}{' '}
                              <span className="text-[10px] font-normal text-slate-400">
                                ({formatCompact(video.viewsPerDay)}/dia)
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <a
                                href={ytUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                                title="Abrir no YouTube"
                              >
                                <ExternalLink className="w-3 h-3" />
                              </a>
                              <button
                                type="button"
                                onClick={() =>
                                  openAiForVideo({
                                    title: video.title,
                                    channelTitle: channelName,
                                    views: video.views,
                                    outlierScore: video.outlierScore,
                                    isShort: video.isShort,
                                  })
                                }
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 text-[11px] font-semibold cursor-pointer"
                              >
                                <Sparkles className="w-3 h-3" />
                                Clonar Ideia
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-2xl bg-[#121720] border border-slate-800/80 p-10 text-center space-y-3">
              <Radar className="w-10 h-10 text-orange-400 mx-auto opacity-80" />
              <h3 className="text-sm font-bold text-white">
                Seu Radar de Concorrentes está vazio
              </h3>
              <p className="text-xs text-slate-400 max-w-lg mx-auto">
                Adicione um `@handle` acima ou clique em <strong>+ Radar</strong> em qualquer vídeo encontrado no Explorador de Subnicho para rastrear automaticamente quais vídeos explodiram nos concorrentes.
              </p>
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 3: AI REVERSE ENGINEERING & MULTI-LANGUAGE CONTENT LAB          */}
      {/* =================================================================== */}
      {subTab === 'ai' && (
        <div className="rounded-2xl bg-[#121720] border border-purple-500/30 p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                Laboratório de Engenharia Reversa & Pautas Multi-Idioma (IA)
              </h3>
              <p className="text-xs text-slate-400">
                Transforma vídeos outliers reais em pautas prontas para Português, Inglês, Francês e Espanhol.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0b0f14] border border-slate-800 text-xs text-slate-300 hover:text-white cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5 text-purple-400" />
              {aiConfig.apiKey
                ? `IA Ativa: ${aiConfig.provider.toUpperCase()}`
                : 'Configurar Chave de IA'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">
                Fonte dos Outliers para Análise
              </label>
              <select
                value={aiSource}
                onChange={(e) =>
                  setAiSource(e.target.value as 'search' | 'competitors' | 'video')
                }
                className="w-full px-3 py-2 rounded-xl bg-[#0b0f14] border border-slate-700 text-xs text-white focus:outline-none focus:border-purple-500"
              >
                <option value="search">
                  Explorador Atual ({filteredSearchVideos.length} vídeos)
                </option>
                <option value="competitors">
                  Radar de Concorrentes ({allCompetitorOutliers.length} vídeos)
                </option>
                {focusedVideo && (
                  <option value="video">
                    Vídeo Selecionado: &ldquo;{focusedVideo.title.slice(0, 38)}...&rdquo;
                  </option>
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1.5">
                Adaptar para qual Grupo de Canais?
              </label>
              <select
                value={targetGroupId}
                onChange={(e) => setTargetGroupId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#0b0f14] border border-slate-700 text-xs text-white focus:outline-none focus:border-purple-500"
              >
                <option value="all">Todos os Meus Grupos</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.icon} {g.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={() => void runAiNicheBlueprint()}
                disabled={aiLoading}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-lg shadow-purple-500/20 transition cursor-pointer disabled:opacity-50"
              >
                <Sparkles className={`w-4 h-4 ${aiLoading ? 'animate-spin' : ''}`} />
                {aiLoading ? 'Gerando Engenharia Reversa...' : 'Gerar Análise & 4 Pautas (IA)'}
              </button>
            </div>
          </div>

          {aiSource === 'video' && focusedVideo && (
            <div className="rounded-xl bg-purple-500/10 border border-purple-500/30 px-4 py-3 flex items-center justify-between gap-3">
              <div className="text-xs text-purple-200">
                <strong>Vídeo Foco ({focusedVideo.outlierScore}x Outlier):</strong>{' '}
                {focusedVideo.title} — <span className="text-purple-300">{focusedVideo.channelTitle}</span> (
                {formatNumber(focusedVideo.views)} views)
              </div>
              <button
                type="button"
                onClick={() => {
                  setFocusedVideo(null);
                  setAiSource('search');
                }}
                className="text-[11px] text-purple-300 hover:text-white shrink-0 cursor-pointer"
              >
                Limpar seleção
              </button>
            </div>
          )}

          <div>
            <label className="block text-xs text-slate-400 mb-1.5">
              Instrução Estratégica para a IA
            </label>
            <textarea
              rows={2}
              value={customBrief}
              onChange={(e) => setCustomBrief(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#0b0f14] border border-slate-700 text-xs text-white focus:outline-none focus:border-purple-500"
            />
          </div>

          {aiError && (
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 px-4 py-2.5 text-xs text-amber-300">
              ⚠️ {aiError}
            </div>
          )}

          {aiOutput && (
            <div className="rounded-2xl bg-[#0b0f14] border border-slate-800 p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <span className="text-xs font-bold text-purple-300">
                  {aiModelUsed || 'Resultado da Engenharia Reversa'}
                </span>
                <button
                  type="button"
                  onClick={() => void handleCopyAi()}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" /> Copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" /> Copiar Pautas
                    </>
                  )}
                </button>
              </div>
              <div className="text-xs text-slate-200 whitespace-pre-wrap leading-relaxed">
                {aiOutput}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
