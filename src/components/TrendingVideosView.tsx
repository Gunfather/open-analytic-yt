import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowUpRight,
  Check,
  Copy,
  EyeOff,
  MessageSquare,
  Plus,
  RefreshCw,
  Sparkles,
  ThumbsUp,
  Trophy,
  X,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import {
  fetchTopTrendingYouTubeVideos,
  TrendingCategoryFilter,
} from '../services/youtubeApi';
import { TrendingYouTubeVideo } from '../types/youtube';
import { formatCompact, formatDuration, formatNumber } from '../utils/formatters';

interface TrendingVideosViewProps {
  mode?: 'compact' | 'full';
}

const TRENDING_MARKETS = [
  { id: 'BR', label: '🇧🇷 Brasil' },
  { id: 'PT', label: '🇵🇹 Portugal' },
  { id: 'US', label: '🇺🇸 EUA' },
  { id: 'FR', label: '🇫🇷 França' },
  { id: 'ES', label: '🇪🇸 Espanha' },
] as const;

const TRENDING_CATEGORIES: Array<{ id: TrendingCategoryFilter; label: string }> = [
  { id: 'all_no_music', label: '🔥 Geral (Sem Música)' },
  { id: '27', label: '🏛️ Educação & História' },
  { id: '28', label: '🤖 Ciência & Tech' },
  { id: '24', label: '🎬 Entretenimento' },
  { id: '22', label: '🧠 Pessoas & Blogs' },
  { id: '25', label: '🌍 Notícias & Mundo' },
  { id: 'all', label: '🎵 Tudo (+ Música)' },
];

export function TrendingVideosView({ mode = 'full' }: TrendingVideosViewProps) {
  const {
    apiKey,
    aiConfig,
    groups,
    addCompetitor,
    selectedLanguageId,
    setActiveTab,
    uiLanguage,
  } = useStore();

  const [region, setRegion] = useState<'BR' | 'PT' | 'US' | 'FR' | 'ES'>('BR');
  const [category, setCategory] = useState<TrendingCategoryFilter>('all_no_music');
  const [formatFilter, setFormatFilter] = useState<'all' | 'long' | 'short'>('all');
  const [sortBy, setSortBy] = useState<'velocity' | 'views' | 'outlier' | 'engagement'>(
    'velocity'
  );
  const [videos, setVideos] = useState<TrendingYouTubeVideo[]>([]);
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState<'api' | 'public'>('api');
  const [error, setError] = useState<string | null>(null);
  const [addedRadarIds, setAddedRadarIds] = useState<Record<string, boolean>>({});

  const [showCompactBar, setShowCompactBar] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('pulseyt_show_trending_bar');
      return saved === null ? true : saved === 'true';
    } catch {
      return true;
    }
  });

  // Instant 4-Language Viral Cloner Modal state
  const [cloneVideo, setCloneVideo] = useState<TrendingYouTubeVideo | null>(null);
  const [cloneGroupId, setCloneGroupId] = useState<string>('all');
  const [cloneLoading, setCloneLoading] = useState(false);
  const [cloneResult, setCloneResult] = useState('');
  const [cloneModelLabel, setCloneModelLabel] = useState('');
  const [copied, setCopied] = useState(false);

  const toggleCompactBar = () => {
    setShowCompactBar((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('pulseyt_show_trending_bar', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  useEffect(() => {
    if (cloneVideo) {
      const original = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = original;
      };
    }
  }, [cloneVideo]);

  useEffect(() => {
    if (selectedLanguageId === 'pt-BR') setRegion('BR');
    else if (selectedLanguageId === 'en') setRegion('US');
    else if (selectedLanguageId === 'fr') setRegion('FR');
    else if (selectedLanguageId === 'es') setRegion('ES');
  }, [selectedLanguageId]);

  const loadTrending = async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchTopTrendingYouTubeVideos({
        regionCode: region,
        categoryFilter: category,
        apiKey,
        forceRefresh,
      });
      setVideos(res.items);
      setSource(res.source);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Erro ao carregar Top Vídeos do YouTube.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (mode === 'compact' && !showCompactBar) return;
    void loadTrending(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, region, category, apiKey, showCompactBar]);

  const filteredVideos = useMemo(() => {
    return videos
      .filter((v) => {
        if (formatFilter === 'short') return v.isShort;
        if (formatFilter === 'long') return !v.isShort;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'velocity') return b.viewsPerHour - a.viewsPerHour;
        if (sortBy === 'outlier') return b.outlierScore - a.outlierScore;
        if (sortBy === 'engagement') return b.engagementRate - a.engagementRate;
        return b.views - a.views;
      });
  }, [videos, formatFilter, sortBy]);

  const handleAddChannelToRadar = async (v: TrendingYouTubeVideo) => {
    const target = v.channelHandle || v.channelId;
    if (!target) return;
    const langId =
      region === 'BR' || region === 'PT'
        ? 'pt-BR'
        : region === 'FR'
        ? 'fr'
        : region === 'ES'
        ? 'es'
        : 'en';
    try {
      setAddedRadarIds((prev) => ({ ...prev, [v.id]: true }));
      await addCompetitor({
        handle: target,
        nicheTag: 'Top YouTube',
        languageId: langId,
      });
    } catch {
      setAddedRadarIds((prev) => ({ ...prev, [v.id]: false }));
    }
  };

  const triggerCloneModal = async (v: TrendingYouTubeVideo, overrideGroup?: string) => {
    setCloneVideo(v);
    setCloneLoading(true);
    setCloneResult('');
    const chosenGrpId = overrideGroup ?? cloneGroupId;
    const grpName =
      chosenGrpId === 'all'
        ? 'Toda a Rede Multi-Idioma'
        : groups.find((g) => g.id === chosenGrpId)?.name || 'Meus Canais';

    const localFallback = [
      `🔥 ENGENHARIA REVERSA DO VÍDEO EM ALTA NO YOUTUBE`,
      `• Original: "${v.title}" — ${v.channelTitle}`,
      `• Tração: ${formatNumber(v.views)} views (${formatCompact(v.viewsPerHour)} views/hora · 🔥 ${v.outlierScore}x Outlier)`,
      '',
      `🇧🇷 PT-BR: Adapte o gancho central de "${v.title.slice(0, 50)}..." com foco em curiosidade imediata + thumb de alto contraste.`,
      `🇺🇸 EN: "Why Everyone Is Suddenly Talking About ${v.title.slice(0, 42)}..."`,
      `🇫🇷 FR: "Ce que personne ne vous dit sur ${v.title.slice(0, 42)}..."`,
      `🇪🇸 ES: "La Verdad detrás de ${v.title.slice(0, 42)}... que está impactando a todos"`,
    ].join('\n');

    try {
      if (!aiConfig.apiKey) {
        setCloneModelLabel('Motor Estratégico Local');
        setCloneResult(localFallback);
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

      const prompt = `Você é um estrategista sênior de canais multi-idioma no YouTube. ${langDirective}

Vídeo a bater forte agora no Top Em Alta do YouTube (${region}):
- Título: "${v.title}"
- Canal: ${v.channelTitle} (${v.channelSubs} inscritos)
- Views: ${v.views} (${v.viewsPerHour} views/hora, publicado há ${v.hoursAgo}h)
- Outlier Score: ${v.outlierScore}x | Engajamento: ${v.engagementRate}%
- Adaptar para o grupo de canais: ${grpName}

Gere um PACOTE DE ADAPTAÇÃO IMEDIATO para os 4 idiomas (PT-BR, EN, FR, ES):
1. O que fez este vídeo explodir agora (gatilho psicológico + estrutura do título).
2. 4 Versões Culturalmente Adaptadas (🇧🇷 PT-BR, 🇺🇸 EN, 🇫🇷 FR, 🇪🇸 ES) com:
   - Título magnético de alto CTR
   - Ideia Visual de Thumbnail + Texto curto (máx 3 palavras)
   - Gancho dos primeiros 15 segundos.`;

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
        setCloneModelLabel(`${aiConfig.provider.toUpperCase()} · ${parsed.model || ''}`);
        setCloneResult(parsed.text);
      } else {
        setCloneModelLabel('Motor Estratégico Local (Fallback)');
        setCloneResult(localFallback);
      }
    } catch {
      setCloneModelLabel('Motor Estratégico Local (Fallback)');
      setCloneResult(localFallback);
    } finally {
      setCloneLoading(false);
    }
  };

  // =========================================================================
  // COMPACT MODE (STANDALONE STRIP ON FRONT PAGE — NOT INSIDE RADAR)
  // =========================================================================
  if (mode === 'compact') {
    if (!showCompactBar) {
      return (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={toggleCompactBar}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#121720] hover:bg-slate-800 border border-orange-500/30 text-xs font-semibold text-orange-300 transition cursor-pointer"
          >
            <Trophy className="w-3.5 h-3.5 text-orange-400" />
            Mostrar Barra Top Vídeos YouTube
          </button>
        </div>
      );
    }

    return (
      <div className="rounded-2xl bg-gradient-to-r from-[#1a130f] via-[#121720] to-[#171321] border border-orange-500/30 px-4 py-3 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Trophy className="w-4 h-4 text-orange-400 shrink-0" />
            <span className="text-xs font-extrabold uppercase tracking-wider text-orange-400">
              Top Vídeos a Bater no YouTube
            </span>
            <span className="text-[11px] text-slate-400 hidden sm:inline">
              {loading
                ? 'Carregando vídeos em alta...'
                : `Ranking ao vivo (${region}) · sem música`}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="inline-flex rounded-lg bg-[#0b0f14] p-0.5 border border-slate-800">
              {(['BR', 'PT', 'US', 'FR', 'ES'] as const).map((mkt) => (
                <button
                  key={mkt}
                  type="button"
                  onClick={() => setRegion(mkt)}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition cursor-pointer ${
                    region === mkt
                      ? 'bg-orange-500 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {mkt}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setActiveTab('trending')}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-400 text-slate-950 text-xs font-extrabold shadow-lg shadow-orange-500/20 transition cursor-pointer"
            >
              Abrir Top YouTube
              <ArrowUpRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={toggleCompactBar}
              title="Ocultar barra Top Vídeos"
              className="p-1.5 rounded-lg bg-[#0b0f14] hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white cursor-pointer"
            >
              <EyeOff className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {filteredVideos.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
            {filteredVideos.slice(0, 4).map((v, idx) => {
              const ytUrl = v.isShort
                ? `https://www.youtube.com/shorts/${v.id}`
                : `https://www.youtube.com/watch?v=${v.id}`;
              return (
                <a
                  key={v.id}
                  href={ytUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl bg-[#0b0f14]/90 hover:bg-slate-800/80 border border-slate-800 hover:border-orange-500/40 transition group"
                >
                  <div className="relative w-16 h-10 rounded-lg overflow-hidden shrink-0 bg-slate-900">
                    <img
                      src={v.thumbnailUrl}
                      alt={v.title}
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute top-0.5 left-0.5 px-1 rounded bg-orange-500 text-slate-950 text-[9px] font-extrabold font-mono-num">
                      #{idx + 1}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-white group-hover:text-orange-300 truncate">
                      {v.title}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono-num truncate">
                      {v.channelTitle} ·{' '}
                      <span className="text-orange-300 font-bold">
                        ⚡ {formatCompact(v.viewsPerHour)}/h
                      </span>
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-14 rounded-xl bg-[#0b0f14]/70 border border-slate-800 animate-pulse"
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // FULL DEDICATED PAGE MODE (activeTab === 'trending')
  // =========================================================================
  return (
    <>
      <div className="space-y-6">
        {/* Header & Country Controls */}
        <div className="rounded-2xl bg-gradient-to-br from-[#191210] via-[#121720] to-[#141824] border border-orange-500/35 p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-orange-500/20 border border-orange-500/40 flex items-center justify-center shrink-0">
                <Trophy className="w-6 h-6 text-orange-400" />
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
                    Top Vídeos que Mais Estão a Bater no YouTube
                  </h2>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold border ${
                      source === 'api'
                        ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-300'
                        : 'bg-amber-500/15 border-amber-500/35 text-amber-300'
                    }`}
                  >
                    {source === 'api'
                      ? 'YouTube API v3 Oficial (Tempo Real)'
                      : 'Feed Em Alta Público'}
                  </span>
                </div>
                <p className="text-sm text-slate-400 mt-1">
                  Página independente com os vídeos de maior explosão de visualizações por hora e engajamento no momento.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <div className="inline-flex flex-wrap rounded-xl bg-[#0b0f14] p-1.5 border border-slate-800 gap-1">
                {TRENDING_MARKETS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setRegion(m.id)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      region === m.id
                        ? 'bg-orange-500 text-white shadow'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => void loadTrending(true)}
                disabled={loading}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0b0f14] hover:bg-slate-800 border border-slate-700 text-xs font-bold text-slate-200 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw
                  className={`w-4 h-4 ${loading ? 'animate-spin text-orange-400' : ''}`}
                />
                Atualizar Agora
              </button>
            </div>
          </div>

          {/* Categories + Format + Sort */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-800/80">
            <div className="flex items-center gap-1.5 flex-wrap">
              {TRENDING_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(cat.id)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    category === cat.id
                      ? 'bg-orange-500/20 text-orange-300 border border-orange-500/50'
                      : 'bg-[#0b0f14] text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={formatFilter}
                onChange={(e) => setFormatFilter(e.target.value as 'all' | 'long' | 'short')}
                className="px-3.5 py-2 rounded-xl bg-[#0b0f14] border border-slate-700 text-xs font-semibold text-slate-200 focus:outline-none"
              >
                <option value="all">Todos os Formatos</option>
                <option value="long">Vídeos Longos</option>
                <option value="short">Shorts</option>
              </select>

              <select
                value={sortBy}
                onChange={(e) =>
                  setSortBy(
                    e.target.value as 'velocity' | 'views' | 'outlier' | 'engagement'
                  )
                }
                className="px-3.5 py-2 rounded-xl bg-[#0b0f14] border border-slate-700 text-xs font-semibold text-slate-200 focus:outline-none"
              >
                <option value="velocity">⚡ Mais Views / Hora (A Bater Agora)</option>
                <option value="views">👁️ Mais Views Totais</option>
                <option value="outlier">🔥 Maior Multiplicador Outlier</option>
                <option value="engagement">💬 Maior Taxa de Engajamento</option>
              </select>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl bg-amber-500/10 border border-amber-500/30 px-5 py-4 text-sm text-amber-300">
            ⚠️ {error}
          </div>
        )}

        {/* 4-per-row Video Cards */}
        {loading && filteredVideos.length === 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div
                key={i}
                className="rounded-2xl bg-[#121720] border border-slate-800 h-72 animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {filteredVideos.slice(0, 36).map((v, idx) => {
              const ytUrl = v.isShort
                ? `https://www.youtube.com/shorts/${v.id}`
                : `https://www.youtube.com/watch?v=${v.id}`;
              const rankColors =
                idx === 0
                  ? 'bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/30'
                  : idx === 1
                  ? 'bg-slate-200 text-slate-950'
                  : idx === 2
                  ? 'bg-amber-700 text-white'
                  : 'bg-black/85 text-white border border-white/15';
              const alreadyInRadar = Boolean(addedRadarIds[v.id]);

              return (
                <div
                  key={v.id}
                  className={`rounded-2xl bg-[#121720] border overflow-hidden flex flex-col justify-between transition ${
                    idx < 3
                      ? 'border-orange-500/50 hover:border-orange-400 shadow-lg shadow-orange-950/20'
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div>
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
                          className="w-full h-full object-cover opacity-95 group-hover:scale-[1.02] transition duration-300"
                        />
                      </a>

                      <span
                        className={`absolute top-2.5 left-2.5 px-2.5 py-1 rounded-lg text-xs font-extrabold font-mono-num ${rankColors}`}
                      >
                        #{idx + 1}
                      </span>

                      <span className="absolute top-2.5 right-2.5 px-2 py-1 rounded-lg bg-orange-500/95 text-white text-[11px] font-extrabold font-mono-num shadow">
                        ⚡ {formatCompact(v.viewsPerHour)}/h
                      </span>

                      {v.outlierScore >= 2.0 && (
                        <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-emerald-500 text-slate-950 text-[10px] font-extrabold font-mono-num">
                          🔥 {v.outlierScore}x Outlier
                        </span>
                      )}

                      <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/85 text-[11px] font-mono-num text-white">
                        {formatDuration(v.durationSec)}
                      </span>
                    </div>

                    <div className="p-4 space-y-2.5">
                      <a
                        href={ytUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-bold text-white hover:text-orange-400 line-clamp-2 leading-snug block"
                      >
                        {v.title}
                      </a>

                      <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
                        <span className="truncate font-medium text-slate-300">
                          {v.channelTitle}
                          {v.channelSubs > 0 ? ` · ${formatCompact(v.channelSubs)}` : ''}
                        </span>
                        <button
                          type="button"
                          onClick={() => void handleAddChannelToRadar(v)}
                          disabled={alreadyInRadar}
                          title="Adicionar este canal ao Radar de Concorrentes"
                          className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold cursor-pointer ${
                            alreadyInRadar
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                          }`}
                        >
                          {alreadyInRadar ? (
                            <>
                              <Check className="w-3 h-3" /> Salvo
                            </>
                          ) : (
                            <>
                              <Plus className="w-3 h-3" /> Concorrente
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="px-4 pb-4 space-y-3">
                    <div className="grid grid-cols-3 gap-2 pt-2.5 border-t border-slate-800/80 text-center">
                      <div>
                        <div className="text-xs font-extrabold font-mono-num text-white">
                          {formatCompact(v.views)}
                        </div>
                        <div className="text-[10px] text-slate-500">Views</div>
                      </div>
                      <div>
                        <div className="text-xs font-bold font-mono-num text-sky-400 flex items-center justify-center gap-1">
                          <ThumbsUp className="w-3 h-3" />
                          {formatCompact(v.likes)}
                        </div>
                        <div className="text-[10px] text-slate-500">Likes</div>
                      </div>
                      <div>
                        <div className="text-xs font-bold font-mono-num text-purple-300 flex items-center justify-center gap-1">
                          <MessageSquare className="w-3 h-3" />
                          {formatCompact(v.comments)}
                        </div>
                        <div className="text-[10px] text-slate-500">Coment.</div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] text-slate-400">
                        há {v.hoursAgo < 24 ? `${v.hoursAgo}h` : `${Math.round(v.hoursAgo / 24)}d`}
                      </span>

                      <button
                        type="button"
                        onClick={() => void triggerCloneModal(v)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        Clonar 4 Idiomas
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Instant 4-Language Viral Cloner Modal */}
      {cloneVideo &&
        createPortal(
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#0e131a] border border-purple-500/40 rounded-2xl max-w-3xl w-full max-h-[88vh] flex flex-col shadow-2xl">
              <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Sparkles className="w-5 h-5 text-purple-400 shrink-0" />
                  <div className="min-w-0">
                    <h3 className="text-base font-bold text-white truncate">
                      Clonador Viral em 4 Idiomas — {cloneVideo.title}
                    </h3>
                    <p className="text-xs text-slate-400 truncate">
                      {cloneVideo.channelTitle} · {formatCompact(cloneVideo.viewsPerHour)}/h ·{' '}
                      {cloneModelLabel || 'Gerando...'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {groups.length > 0 && (
                    <select
                      value={cloneGroupId}
                      onChange={(e) => {
                        setCloneGroupId(e.target.value);
                        void triggerCloneModal(cloneVideo, e.target.value);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-[#121720] border border-slate-700 text-xs text-white"
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
                      if (!cloneResult) return;
                      await navigator.clipboard.writeText(cloneResult);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    disabled={!cloneResult}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4" /> Copiado!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" /> Copiar Tudo
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setCloneVideo(null)}
                    className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="p-6 overflow-y-auto flex-1">
                {cloneLoading ? (
                  <div className="py-14 text-center space-y-3">
                    <Sparkles className="w-8 h-8 text-purple-400 animate-spin mx-auto" />
                    <p className="text-sm text-slate-300 font-medium">
                      Fazendo engenharia reversa do vídeo em alta e adaptando títulos, thumbnails e ganchos para PT-BR, EN, FR e ES...
                    </p>
                  </div>
                ) : (
                  <div className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed bg-[#0b0f14] border border-slate-800 rounded-xl p-5">
                    {cloneResult}
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
