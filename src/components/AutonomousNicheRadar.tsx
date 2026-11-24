import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Check,
  Compass,
  Copy,
  DollarSign,
  EyeOff,
  Flame,
  Globe2,
  Radar,
  RefreshCw,
  Rocket,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react';
import { PERIOD_DAYS, useStore } from '../context/StoreContext';
import { fetchAutonomousNicheRadar } from '../services/youtubeApi';
import { AutoNicheTrend } from '../types/youtube';
import { formatCompact, formatCurrency, formatRelativeTime } from '../utils/formatters';

type RadarViewMode = 'all' | 'emergent' | 'rpm' | 'low_comp';

export function AutonomousNicheRadar() {
  const {
    apiKey,
    aiConfig,
    channels,
    languages,
    groups,
    niches,
    competitors,
    isSyncingCompetitors,
    syncCompetitors,
    openNicheExplorerWithQuery,
    selectedLanguageId,
    selectedNicheId,
    setSelectedNicheId,
    metrics,
    period,
    setActiveTab,
    uiLanguage,
  } = useStore();

  const [radarMarket, setRadarMarket] = useState<'BR' | 'US' | 'FR' | 'ES'>('BR');
  const [viewMode, setViewMode] = useState<RadarViewMode>('all');
  const [autoTrends, setAutoTrends] = useState<AutoNicheTrend[]>([]);
  const [radarScanning, setRadarScanning] = useState(false);
  const [radarScannedAt, setRadarScannedAt] = useState<string | null>(null);
  const [radarError, setRadarError] = useState<string | null>(null);
  const [showAllCards, setShowAllCards] = useState(true);
  const [showNicheRadar, setShowNicheRadar] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('pulseyt_show_niche_radar');
      return saved === null ? true : saved === 'true';
    } catch {
      return true;
    }
  });

  // Instant 4-Language Viral Cloner Modal state
  const [clonerTarget, setClonerTarget] = useState<AutoNicheTrend | null>(null);
  const [clonerGroupId, setClonerGroupId] = useState<string>('all');
  const [clonerLoading, setClonerLoading] = useState(false);
  const [clonerResult, setClonerResult] = useState('');
  const [clonerModelLabel, setClonerModelLabel] = useState('');
  const [copied, setCopied] = useState(false);

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

  useEffect(() => {
    if (selectedLanguageId === 'pt-BR') setRadarMarket('BR');
    else if (selectedLanguageId === 'en') setRadarMarket('US');
    else if (selectedLanguageId === 'fr') setRadarMarket('FR');
    else if (selectedLanguageId === 'es') setRadarMarket('ES');
  }, [selectedLanguageId]);

  const runAutonomousScan = async (
    targetMarket: 'BR' | 'US' | 'FR' | 'ES',
    forceRefresh = false
  ) => {
    setRadarScanning(true);
    setRadarError(null);
    try {
      const res = await fetchAutonomousNicheRadar(targetMarket, forceRefresh, apiKey);
      setAutoTrends(res.trends);
      setRadarScannedAt(res.scannedAt);
    } catch (err) {
      setRadarError(
        err instanceof Error ? err.message : 'Erro ao escanear nichos em alta.'
      );
    } finally {
      setRadarScanning(false);
    }
  };

  useEffect(() => {
    if (!showNicheRadar) return;
    void runAutonomousScan(radarMarket, false);
    const intervalId = window.setInterval(() => {
      void runAutonomousScan(radarMarket, true);
    }, 20 * 60 * 1000);
    return () => window.clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [radarMarket, showNicheRadar]);

  const displayedTrends = useMemo(() => {
    const list = [...autoTrends];
    if (viewMode === 'emergent') {
      return list.sort(
        (a, b) =>
          Number(Boolean(b.isEmergentDiscovery)) - Number(Boolean(a.isEmergentDiscovery)) ||
          b.maxOutlier - a.maxOutlier
      );
    }
    if (viewMode === 'rpm') {
      return list.sort(
        (a, b) =>
          b.estimatedRpm * Math.log10(Math.max(b.avgViewsPerDay, 50)) -
          a.estimatedRpm * Math.log10(Math.max(a.avgViewsPerDay, 50))
      );
    }
    if (viewMode === 'low_comp') {
      const compRank = { Baixa: 3, Média: 2, Alta: 1 };
      return list.sort(
        (a, b) =>
          compRank[b.competitionLevel] - compRank[a.competitionLevel] ||
          b.uniqueChannelsPct - a.uniqueChannelsPct ||
          b.heatScore - a.heatScore
      );
    }
    return list.sort(
      (a, b) => b.heatScore - a.heatScore || b.avgViewsPerDay - a.avgViewsPerDay
    );
  }, [autoTrends, viewMode]);

  const executiveSummary = useMemo(() => {
    if (autoTrends.length === 0) return null;
    const hottest = [...autoTrends].sort((a, b) => b.heatScore - a.heatScore)[0];
    const biggestOutlier = [...autoTrends].sort((a, b) => b.maxOutlier - a.maxOutlier)[0];
    const bestMonetization = [...autoTrends].sort(
      (a, b) =>
        b.estimatedRpm * Math.log10(Math.max(b.avgViewsPerDay, 100)) -
        a.estimatedRpm * Math.log10(Math.max(a.avgViewsPerDay, 100))
    )[0];
    const emergentCount = autoTrends.filter((t) => t.isEmergentDiscovery).length;
    return { hottest, biggestOutlier, bestMonetization, emergentCount };
  }, [autoTrends]);

  const topCompetitorOutliers = useMemo(() => {
    const items: Array<{
      channelName: string;
      languageId: string;
      video: (typeof competitors)[number]['videos'][number];
    }> = [];
    for (const comp of competitors) {
      for (const v of comp.videos) {
        items.push({
          channelName: comp.name,
          languageId: comp.languageId,
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
      for (const m of metrics) {
        if (idSet.has(m.channelId) && m.date >= startStr) {
          views += m.views;
        }
      }
      return { niche: nc, channelsCount: ncChannels.length, views };
    });
  }, [niches, channels, metrics, period]);

  const buildLocalClonePack = (trend: AutoNicheTrend) => {
    const v = trend.topVideo;
    const baseTopic = v?.title || trend.name;
    return [
      `🚀 PACOTE DE CLONAGEM VIRAL — ${trend.icon} ${trend.name.toUpperCase()}`,
      `• Vídeo Referência (#1 Breakout): "${baseTopic}" (${
        v ? `${formatCompact(v.viewsPerDay)} views/dia · 🔥 ${v.outlierScore}x Outlier` : ''
      })`,
      `• RPM Estimado do Nicho: ${formatCurrency(trend.estimatedRpm)} | Barreira de Entrada: ${trend.competitionLevel}`,
      `• Buscas em Explosão Hoje: ${trend.risingKeywords.join(' · ') || trend.query}`,
      '',
      `🇧🇷 PORTUGUÊS (PT-BR):`,
      `• Título Magnético: O Detalhe Oculto em "${baseTopic.slice(0, 42)}..." que Mudou a História`,
      `• Thumbnail: Close dramático de alto contraste + seta sutil + 3 palavras em amarelo ("NINGUÉM VIU ISSO")`,
      `• Gancho (0–15s): "Durante décadas todos repetiram a mesma versão... até que uma descoberta recente revelou o oposto."`,
      '',
      `🇺🇸 INGLÊS (EN — Alto RPM):`,
      `• Title: The Untold Truth Behind "${baseTopic.slice(0, 42)}..." Nobody Talks About`,
      `• Thumbnail: Dark cinematic lighting + glowing artifact/subject + bold text ("THE HIDDEN RECORD")`,
      `• Hook (0–15s): "Every textbook skipped this single detail — and once you see it, the entire story changes."`,
      '',
      `🇫🇷 FRANCÊS (FR — Baixa Saturação):`,
      `• Titre: Le Secret Interdit derrière "${baseTopic.slice(0, 38)}..." enfin révélé !`,
      `• Miniature: Contraste fort noir/or + texte court ("LE VRAI SECRET")`,
      `• Accroche (0–15s): "C'est l'énigme que les spécialistes ont longtemps évitée, jusqu'à aujourd'hui..."`,
      '',
      `🇪🇸 ESPANHOL (ES — Escala Global):`,
      `• Título: El Secreto Oculto que Nadie Notó en "${baseTopic.slice(0, 38)}..."`,
      `• Miniatura: Escena épica cinematográfica + texto grande blanco/rojo ("LA PRUEBA OCULTA")`,
      `• Gancho (0–15s): "Lo que estás a punto de ver desafía todo lo que creíamos saber sobre este misterio..."`,
    ].join('\n');
  };

  const triggerInstantClone = async (trend: AutoNicheTrend, overrideGroup?: string) => {
    setClonerTarget(trend);
    setClonerLoading(true);
    setClonerResult('');
    const chosenGrpId = overrideGroup ?? clonerGroupId;
    const grpName =
      chosenGrpId === 'all'
        ? 'Toda a Rede Multi-Idioma'
        : groups.find((g) => g.id === chosenGrpId)?.name || 'Meus Canais';

    try {
      if (!aiConfig.apiKey) {
        setClonerModelLabel('Motor Estratégico Local');
        setClonerResult(buildLocalClonePack(trend));
        return;
      }

      const langDirective =
        uiLanguage === 'en'
          ? 'Respond in English.'
          : uiLanguage === 'fr'
          ? 'Respond in French.'
          : uiLanguage === 'es'
          ? 'Respond in Spanish.'
          : 'Responda em Português (PT-BR).';

      const prompt = `Você é o diretor criativo nº 1 do mundo para canais Dark/Faceless multi-idioma no YouTube. ${langDirective}

Nicho detectado pelo Radar Autônomo:
- Nicho: ${trend.name} (Score ${trend.heatScore}/99, ${trend.statusLabel})
- Velocidade média: ${trend.avgViewsPerDay} views/dia | Pico Outlier: ${trend.maxOutlier}x | RPM estimado: $${trend.estimatedRpm}
- Buscas subindo agora no YouTube Autocomplete: ${trend.risingKeywords.join(', ')}
- Top vídeos explodindo agora: ${JSON.stringify(trend.topVideos)}
- Adaptar para o grupo de canais: ${grpName}

Gere um PACOTE DE ATAQUE IMEDIATO enxuto, magnético e pronto para copiar e produzir nos 4 idiomas (PT-BR, EN, FR, ES):
1. Por que este tema está furando a bolha agora (1 parágrafo direto com o gatilho psicológico principal).
2. 4 Versões Culturalmente Adaptadas (🇧🇷 PT-BR, 🇺🇸 EN, 🇫🇷 FR, 🇪🇸 ES), contendo para cada idioma:
   - Título de alto CTR (sem clickbait barato, alta curiosidade)
   - Prompt/Conceito Visual da Thumbnail + Texto curto da Thumb (máx 3 palavras)
   - Gancho palavra-por-palavra dos primeiros 15 segundos para retenção acima de 70%.`;

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
      const raw = await res.text();
      const parsed = JSON.parse(raw) as {
        ok?: boolean;
        text?: string;
        model?: string;
      };
      if (res.ok && parsed.ok && parsed.text) {
        setClonerModelLabel(`${aiConfig.provider.toUpperCase()} · ${parsed.model || ''}`);
        setClonerResult(parsed.text);
      } else {
        setClonerModelLabel('Motor Estratégico Local (Fallback)');
        setClonerResult(buildLocalClonePack(trend));
      }
    } catch {
      setClonerModelLabel('Motor Estratégico Local (Fallback)');
      setClonerResult(buildLocalClonePack(trend));
    } finally {
      setClonerLoading(false);
    }
  };

  if (!showNicheRadar) {
    return (
      <div className="flex justify-end">
        <button
          type="button"
          onClick={toggleNicheRadar}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#121720] hover:bg-slate-800 border border-emerald-500/30 text-xs font-semibold text-emerald-300 transition cursor-pointer"
        >
          <Radar className="w-3.5 h-3.5 text-emerald-400" />
          Mostrar Ultra Nicho Radar Autônomo
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-2xl bg-gradient-to-br from-[#0f1922] via-[#121720] to-[#191324] border border-emerald-500/35 shadow-2xl shadow-emerald-950/20 p-5 space-y-4">
        {/* Top Command Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/25 to-orange-500/20 border border-emerald-400/40 flex items-center justify-center shrink-0">
              <Radar
                className={`w-5 h-5 text-emerald-400 ${
                  radarScanning ? 'animate-spin' : ''
                }`}
              />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400" />
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm font-extrabold uppercase tracking-wider text-white">
                  Ultra Nicho Radar AI
                </h2>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 text-[10px] font-bold">
                  {radarScanning
                    ? 'Escaneando YouTube + Autocomplete ao vivo...'
                    : `100% Autônomo · ${autoTrends.length} Nichos Mapeados`}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 text-[10px] font-bold">
                  0 Quota API
                </span>
                {radarScannedAt && !radarScanning && (
                  <span className="text-[11px] text-slate-400">
                    · atualizado {formatRelativeTime(radarScannedAt)}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Varre sozinho velocidade diária, multiplicadores outliers, buscas reais do YouTube Autocomplete, barreira de entrada e RPM estimado.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Market Switcher */}
            <div className="inline-flex rounded-xl bg-[#0b0f14] p-1 border border-slate-800">
              {(
                [
                  { id: 'BR', label: '🇧🇷 BR' },
                  { id: 'US', label: '🇺🇸 US' },
                  { id: 'FR', label: '🇫🇷 FR' },
                  { id: 'ES', label: '🇪🇸 ES' },
                ] as const
              ).map((mkt) => (
                <button
                  key={mkt.id}
                  type="button"
                  onClick={() => setRadarMarket(mkt.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                    radarMarket === mkt.id
                      ? 'bg-emerald-500 text-slate-950 shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {mkt.label}
                </button>
              ))}
            </div>

            {displayedTrends.length > 4 && (
              <button
                type="button"
                onClick={() => setShowAllCards((v) => !v)}
                className="px-3 py-1.5 rounded-xl bg-[#0b0f14] hover:bg-slate-800 border border-slate-800 text-xs text-slate-200 font-semibold cursor-pointer"
              >
                {showAllCards ? 'Compactar (Top 4)' : `Expandir (${displayedTrends.length})`}
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                void runAutonomousScan(radarMarket, true);
                if (competitors.length > 0) void syncCompetitors();
              }}
              disabled={radarScanning || isSyncingCompetitors}
              title="Reescanear o YouTube ao vivo agora"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#0b0f14] hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${
                  radarScanning ? 'animate-spin text-emerald-400' : ''
                }`}
              />
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('niche')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-lg shadow-purple-600/20 transition cursor-pointer"
            >
              <Compass className="w-3.5 h-3.5" />
              Suite Completa
            </button>

            <button
              type="button"
              onClick={toggleNicheRadar}
              title="Ocultar Radar"
              className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-xl bg-[#0b0f14] hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
            >
              <EyeOff className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Executive Intelligence Pulse Strip + Mode Filter Pills */}
        {executiveSummary && (
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 flex-1">
              <div className="rounded-xl bg-[#0b0f14]/90 border border-orange-500/30 px-3 py-2 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-wider text-orange-400 font-bold flex items-center gap-1">
                    <Flame className="w-3 h-3" /> #1 Mais Quente Agora
                  </div>
                  <div className="text-xs font-bold text-white truncate">
                    {executiveSummary.hottest.icon} {executiveSummary.hottest.name}
                  </div>
                </div>
                <span className="text-xs font-extrabold font-mono-num text-orange-300 shrink-0">
                  {executiveSummary.hottest.heatScore}°
                </span>
              </div>

              <div className="rounded-xl bg-[#0b0f14]/90 border border-emerald-500/30 px-3 py-2 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-wider text-emerald-400 font-bold flex items-center gap-1">
                    <Zap className="w-3 h-3" /> Maior Pico Outlier
                  </div>
                  <div className="text-xs font-bold text-white truncate">
                    {executiveSummary.biggestOutlier.icon}{' '}
                    {executiveSummary.biggestOutlier.topVideo?.title ||
                      executiveSummary.biggestOutlier.name}
                  </div>
                </div>
                <span className="text-xs font-extrabold font-mono-num text-emerald-300 shrink-0">
                  {executiveSummary.biggestOutlier.maxOutlier}x
                </span>
              </div>

              <div className="rounded-xl bg-[#0b0f14]/90 border border-sky-500/30 px-3 py-2 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-wider text-sky-400 font-bold flex items-center gap-1">
                    <DollarSign className="w-3 h-3" /> Melhor RPM × Demanda
                  </div>
                  <div className="text-xs font-bold text-white truncate">
                    {executiveSummary.bestMonetization.icon}{' '}
                    {executiveSummary.bestMonetization.name}
                  </div>
                </div>
                <span className="text-xs font-extrabold font-mono-num text-sky-300 shrink-0">
                  {formatCurrency(executiveSummary.bestMonetization.estimatedRpm)}
                </span>
              </div>
            </div>

            {/* 4 Radar Lenses */}
            <div className="inline-flex flex-wrap rounded-xl bg-[#0b0f14] p-1 border border-slate-800 gap-1 shrink-0">
              {(
                [
                  { id: 'all', label: '🔥 Ranking Geral', icon: TrendingUp },
                  {
                    id: 'emergent',
                    label: `🚀 Descobertas (${executiveSummary.emergentCount})`,
                    icon: Rocket,
                  },
                  { id: 'rpm', label: '💎 Maior RPM', icon: DollarSign },
                  { id: 'low_comp', label: '🎯 Menor Barreira', icon: ShieldCheck },
                ] as const
              ).map((tab) => {
                const Icon = tab.icon;
                const active = viewMode === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setViewMode(tab.id)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                      active
                        ? 'bg-orange-500 text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Icon className="w-3 h-3" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {radarError && (
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 px-4 py-2.5 text-xs text-amber-300">
            ⚠️ {radarError}
          </div>
        )}

        {/* Loading Skeletons */}
        {radarScanning && autoTrends.length === 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((idx) => (
              <div
                key={idx}
                className="rounded-2xl bg-[#0b0f14]/90 border border-slate-800 p-4 h-56 animate-pulse flex flex-col justify-between"
              >
                <div className="h-4 w-3/4 bg-slate-800 rounded" />
                <div className="h-8 w-full bg-slate-800/70 rounded" />
                <div className="h-14 w-full bg-slate-800/60 rounded" />
                <div className="h-6 w-full bg-slate-800 rounded" />
              </div>
            ))}
          </div>
        )}

        {/* Ultra Niche Cards Grid (4 per row) */}
        {displayedTrends.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {(showAllCards ? displayedTrends : displayedTrends.slice(0, 4)).map(
              (trend, idx) => {
                const isExploding = trend.heatScore >= 80;
                const isStrong = trend.heatScore >= 65;
                const runnerUp = trend.topVideos?.[1] || null;
                const topVidUrl = trend.topVideo
                  ? trend.topVideo.isShort
                    ? `https://www.youtube.com/shorts/${trend.topVideo.id}`
                    : `https://www.youtube.com/watch?v=${trend.topVideo.id}`
                  : null;
                const runnerUpUrl = runnerUp
                  ? runnerUp.isShort
                    ? `https://www.youtube.com/shorts/${runnerUp.id}`
                    : `https://www.youtube.com/watch?v=${runnerUp.id}`
                  : null;

                return (
                  <div
                    key={trend.id}
                    className={`rounded-2xl bg-[#0b0f14]/95 border p-4 flex flex-col justify-between gap-3 transition ${
                      trend.isEmergentDiscovery
                        ? 'border-purple-500/50 hover:border-purple-400 shadow-lg shadow-purple-950/20'
                        : idx === 0
                        ? 'border-orange-500/55 hover:border-orange-400 shadow-lg shadow-orange-950/20'
                        : isStrong
                        ? 'border-emerald-500/35 hover:border-emerald-400/70'
                        : 'border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="space-y-2.5">
                      {/* Title + Heat Score */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-mono-num font-extrabold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 shrink-0">
                              #{idx + 1}
                            </span>
                            <span className="text-sm shrink-0">{trend.icon}</span>
                            <h3 className="text-xs font-bold text-white truncate">
                              {trend.name}
                            </h3>
                          </div>

                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            {trend.isEmergentDiscovery && (
                              <span className="px-1.5 py-0.5 rounded bg-purple-500/20 border border-purple-500/40 text-[9px] font-extrabold uppercase text-purple-300">
                                🆕 Descoberto no Autocomplete
                              </span>
                            )}
                            {trend.usArbitrageGap && trend.usArbitrageGap >= 1.5 && (
                              <span className="px-1.5 py-0.5 rounded bg-sky-500/20 border border-sky-500/40 text-[9px] font-extrabold text-sky-300 flex items-center gap-0.5">
                                <Globe2 className="w-2.5 h-2.5" /> Gap EUA {trend.usArbitrageGap}x
                              </span>
                            )}
                          </div>
                        </div>

                        <span
                          className={`shrink-0 px-2 py-0.5 rounded-lg text-[11px] font-extrabold font-mono-num border ${
                            isExploding
                              ? 'bg-orange-500/20 text-orange-300 border-orange-500/40'
                              : isStrong
                              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35'
                              : 'bg-slate-800 text-slate-200 border-slate-700'
                          }`}
                        >
                          🔥 {trend.heatScore}°
                        </span>
                      </div>

                      {/* Heat Progress Bar */}
                      <div className="h-1.5 w-full rounded-full bg-slate-800/90 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isExploding
                              ? 'bg-gradient-to-r from-orange-500 via-amber-400 to-emerald-400'
                              : 'bg-gradient-to-r from-emerald-500 to-sky-400'
                          }`}
                          style={{ width: `${Math.min(100, Math.max(15, trend.heatScore))}%` }}
                        />
                      </div>

                      {/* 4 Metrics Box */}
                      <div className="grid grid-cols-4 gap-1 text-center py-2 px-1 rounded-xl bg-[#121720] border border-slate-800/90">
                        <div>
                          <div className="text-[11px] font-bold font-mono-num text-white">
                            {formatCompact(trend.avgViewsPerDay)}
                          </div>
                          <div className="text-[9px] text-slate-500">Views/Dia</div>
                        </div>
                        <div>
                          <div className="text-[11px] font-bold font-mono-num text-emerald-400">
                            {trend.maxOutlier}x
                          </div>
                          <div className="text-[9px] text-slate-500">Outlier</div>
                        </div>
                        <div>
                          <div className="text-[11px] font-bold font-mono-num text-sky-400">
                            ${trend.estimatedRpm.toFixed(1)}
                          </div>
                          <div className="text-[9px] text-slate-500">RPM Est.</div>
                        </div>
                        <div>
                          <div
                            className={`text-[10px] font-extrabold ${
                              trend.competitionLevel === 'Baixa'
                                ? 'text-emerald-400'
                                : trend.competitionLevel === 'Média'
                                ? 'text-amber-300'
                                : 'text-rose-400'
                            }`}
                          >
                            {trend.competitionLevel}
                          </div>
                          <div className="text-[9px] text-slate-500">Barreira</div>
                        </div>
                      </div>

                      {/* #1 Breakout Video + #2 Runner-Up */}
                      {trend.topVideo && topVidUrl && (
                        <div className="space-y-1.5">
                          <a
                            href={topVidUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2.5 p-1.5 rounded-xl bg-[#121720]/90 hover:bg-slate-800/90 border border-slate-800/80 transition group"
                          >
                            <div className="relative w-18 h-11 rounded-lg overflow-hidden shrink-0 bg-slate-900">
                              <img
                                src={trend.topVideo.thumbnailUrl}
                                alt={trend.topVideo.title}
                                className="w-full h-full object-cover"
                              />
                              <span className="absolute bottom-0.5 right-0.5 px-1 rounded bg-black/85 text-[8px] font-mono-num font-bold text-orange-300">
                                {trend.topVideo.outlierScore}x
                              </span>
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-[11px] font-semibold text-slate-100 group-hover:text-orange-300 line-clamp-1">
                                {trend.topVideo.title}
                              </div>
                              <div className="text-[10px] text-slate-400 truncate">
                                {trend.topVideo.channelTitle} ·{' '}
                                <span className="text-emerald-400 font-mono-num font-semibold">
                                  {formatCompact(trend.topVideo.viewsPerDay)}/dia
                                </span>
                              </div>
                            </div>
                          </a>

                          {runnerUp && runnerUpUrl && (
                            <a
                              href={runnerUpUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-between gap-2 px-2 py-1 rounded-lg bg-[#121720]/50 hover:bg-slate-800/60 text-[10px] text-slate-400 hover:text-slate-200 transition"
                            >
                              <span className="truncate">
                                #2 {runnerUp.title}
                              </span>
                              <span className="shrink-0 font-mono-num text-sky-400 font-semibold">
                                {formatCompact(runnerUp.viewsPerDay)}/d
                              </span>
                            </a>
                          )}
                        </div>
                      )}

                      {/* Live Rising Keywords from YouTube Suggest */}
                      {trend.risingKeywords && trend.risingKeywords.length > 0 && (
                        <div className="flex items-center gap-1 flex-wrap pt-0.5">
                          {trend.risingKeywords.slice(0, 2).map((kw) => (
                            <button
                              key={kw}
                              type="button"
                              onClick={() => openNicheExplorerWithQuery(kw)}
                              title={`Explorar busca em alta: "${kw}"`}
                              className="px-2 py-0.5 rounded-md bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[10px] text-slate-300 hover:text-emerald-300 truncate max-w-full cursor-pointer transition"
                            >
                              🔍 {kw}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Action Footer */}
                    <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-slate-800/80">
                      <button
                        type="button"
                        onClick={() => void triggerInstantClone(trend)}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600 text-purple-200 hover:text-white border border-purple-500/35 text-[11px] font-bold transition cursor-pointer"
                      >
                        <Sparkles className="w-3 h-3" />
                        Clonar 4 Idiomas
                      </button>

                      <button
                        type="button"
                        onClick={() => openNicheExplorerWithQuery(trend.query)}
                        className="px-2.5 py-1.5 rounded-lg bg-orange-500/15 hover:bg-orange-500/25 text-orange-300 text-[11px] font-bold transition cursor-pointer shrink-0"
                      >
                        Ver +24 →
                      </button>
                    </div>
                  </div>
                );
              }
            )}
          </div>
        )}

        {/* Optional Custom Niches & Monitored Competitors strips */}
        {(nicheSummaries.length > 0 || topCompetitorOutliers.length > 0) && (
          <div className="pt-3 border-t border-slate-800/80 space-y-3">
            {nicheSummaries.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Meus Nichos Salvos:
                </span>
                {nicheSummaries.map(({ niche, channelsCount, views }) => {
                  const isSelected = selectedNicheId === niche.id;
                  return (
                    <button
                      key={niche.id}
                      type="button"
                      onClick={() => setSelectedNicheId(isSelected ? 'all' : niche.id)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border transition cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-200'
                          : 'bg-[#0b0f14] border-slate-800 text-slate-300 hover:text-white'
                      }`}
                    >
                      <span>{niche.icon}</span>
                      <span className="font-semibold">{niche.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono-num">
                        ({channelsCount} · {formatCompact(views)} views)
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {topCompetitorOutliers.length > 0 && (
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
                      className="rounded-xl bg-[#0b0f14]/90 border border-slate-800 hover:border-orange-500/40 p-2.5 flex items-center gap-2.5 transition group"
                    >
                      <img
                        src={video.thumbnailUrl}
                        alt={video.title}
                        className="w-16 h-10 rounded object-cover shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] font-semibold text-white group-hover:text-orange-300 truncate">
                          {video.title}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">
                          {lang?.flag} {channelName} ·{' '}
                          <span className="text-orange-300 font-bold font-mono-num">
                            🔥 {video.outlierScore}x
                          </span>
                        </div>
                      </div>
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Instant 4-Language Viral Cloner Modal */}
      {clonerTarget &&
        createPortal(
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#0e131a] border border-purple-500/40 rounded-2xl max-w-3xl w-full max-h-[88vh] flex flex-col shadow-2xl">
              <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Sparkles className="w-5 h-5 text-purple-400 shrink-0" />
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-white truncate">
                      Clonador Viral em 4 Idiomas — {clonerTarget.icon} {clonerTarget.name}
                    </h3>
                    <p className="text-[11px] text-slate-400 truncate">
                      Score {clonerTarget.heatScore}° · Pico {clonerTarget.maxOutlier}x ·{' '}
                      {clonerModelLabel || 'Gerando plano de ataque...'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {groups.length > 0 && (
                    <select
                      value={clonerGroupId}
                      onChange={(e) => {
                        setClonerGroupId(e.target.value);
                        void triggerInstantClone(clonerTarget, e.target.value);
                      }}
                      className="px-2.5 py-1.5 rounded-xl bg-[#121720] border border-slate-700 text-xs text-white"
                    >
                      <option value="all">Todos os Grupos</option>
                      {groups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.icon} {g.name}
                        </option>
                      ))}
                    </select>
                  )}

                  <button
                    type="button"
                    onClick={async () => {
                      if (!clonerResult) return;
                      await navigator.clipboard.writeText(clonerResult);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    disabled={!clonerResult}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5" /> Copiado!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" /> Copiar Tudo
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setClonerTarget(null)}
                    className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="p-5 overflow-y-auto flex-1">
                {clonerLoading ? (
                  <div className="py-12 text-center space-y-3">
                    <Sparkles className="w-8 h-8 text-purple-400 animate-spin mx-auto" />
                    <p className="text-xs text-slate-300 font-medium">
                      Fazendo engenharia reversa dos vídeos outliers e adaptando títulos, thumbnails e ganchos para PT-BR, EN, FR e ES...
                    </p>
                  </div>
                ) : (
                  <div className="text-xs text-slate-200 whitespace-pre-wrap leading-relaxed bg-[#0b0f14] border border-slate-800 rounded-xl p-4">
                    {clonerResult}
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
