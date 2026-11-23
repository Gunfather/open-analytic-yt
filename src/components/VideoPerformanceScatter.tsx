import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import { ChevronDown, ChevronRight, ExternalLink, SlidersHorizontal, Sparkles } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import {
  formatCompact,
  formatDuration,
  formatNumber,
} from '../utils/formatters';

type MetricMode = 'views' | 'likes' | 'comments' | 'revenue';
type SincePublishMode = '24h' | '48h' | '7d' | 'all';
type PublishWindowDays = 7 | 30 | 90;

interface ScatterPoint {
  x: number;
  y: number;
  dateLabel: string;
  rank: number;
  tier: 'best' | 'mid' | 'worst';
  title: string;
  channelName: string;
  langFlag: string;
  langCode: string;
  thumbnailUrl: string;
  youtubeUrl: string | null;
  views: number;
  likes: number;
  comments: number;
  revenue: number;
  durationSec: number;
  engagementRate: number;
  ctr: number;
}

const SINCE_LABELS: Record<SincePublishMode, string> = {
  '24h': 'Primeiras 24 horas',
  '48h': 'Primeiras 48 horas',
  '7d': 'Primeiros 7 dias',
  all: 'Desde a publicação',
};

const SINCE_MULTIPLIER: Record<SincePublishMode, number> = {
  '24h': 0.55,
  '48h': 0.72,
  '7d': 0.9,
  all: 1,
};

function renderNumberedDot(fill: string) {
  return (props: { cx?: number; cy?: number; payload?: ScatterPoint }) => {
    const { cx, cy, payload } = props;
    if (cx === undefined || cy === undefined || !payload) return <g />;
    return (
      <g>
        <circle cx={cx} cy={cy} r={10} fill={fill} stroke="#0e131a" strokeWidth={1.5} />
        <text
          x={cx}
          y={cy + 3.5}
          textAnchor="middle"
          fill="#0b0f14"
          fontSize={10}
          fontWeight={800}
        >
          {payload.rank}
        </text>
      </g>
    );
  };
}

export function VideoPerformanceScatter() {
  const { filteredChannels, languages, videos } = useStore();

  const [sinceMode, setSinceMode] = useState<SincePublishMode>('24h');
  const [publishWindow, setPublishWindow] = useState<PublishWindowDays>(90);
  const [metricMode, setMetricMode] = useState<MetricMode>('views');
  const [searchFilter, setSearchFilter] = useState('');
  const [openBest, setOpenBest] = useState(true);
  const [openMid, setOpenMid] = useState(false);
  const [openWorst, setOpenWorst] = useState(true);

  const { bestPoints, midPoints, worstPoints } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - (publishWindow - 1));
    const startStr = startDate.toISOString().slice(0, 10);

    const chMap = new Map(filteredChannels.map((c) => [c.id, c]));
    const langMap = new Map(languages.map((l) => [l.id, l]));
    const mult = SINCE_MULTIPLIER[sinceMode];

    const filtered = videos
      .filter((v) => {
        if (!chMap.has(v.channelId) || v.publishedAt < startStr) return false;
        if (searchFilter && !v.title.toLowerCase().includes(searchFilter.toLowerCase())) {
          return false;
        }
        return true;
      })
      .map((v) => {
        const ch = chMap.get(v.channelId)!;
        const lang = langMap.get(ch.languageId);
        const ts = new Date(`${v.publishedAt}T12:00:00`).getTime();
        const scaledViews = Math.round(v.views * mult);
        const scaledLikes = Math.round(v.likes * mult);
        const scaledComments = Math.round(v.comments * mult);
        const scaledRevenue = Number((v.revenue * mult).toFixed(2));
        const engagement = scaledLikes + scaledComments + Math.round(v.shares * mult);
        const engagementRate =
          scaledViews > 0 ? Number(((engagement / scaledViews) * 100).toFixed(1)) : 0;

        const y =
          metricMode === 'likes'
            ? scaledLikes
            : metricMode === 'comments'
            ? scaledComments
            : metricMode === 'revenue'
            ? scaledRevenue
            : scaledViews;

        const youtubeUrl = !v.id.startsWith('vid-')
          ? v.isShort
            ? `https://www.youtube.com/shorts/${v.id}`
            : `https://www.youtube.com/watch?v=${v.id}`
          : null;

        return {
          x: ts,
          y,
          dateLabel: v.publishedAt,
          rank: 0,
          tier: 'mid' as const,
          title: v.title,
          channelName: ch.name,
          langFlag: lang?.flag || '',
          langCode: lang?.code || '',
          thumbnailUrl: v.thumbnailUrl,
          youtubeUrl,
          views: scaledViews,
          likes: scaledLikes,
          comments: scaledComments,
          revenue: scaledRevenue,
          durationSec: v.durationSec,
          engagementRate,
          ctr: ch.ctr ?? v.ctr,
        };
      })
      .sort((a, b) => b.y - a.y);

    const bestCount = Math.min(5, filtered.length);
    const best: ScatterPoint[] = filtered.slice(0, bestCount).map((p, idx) => ({
      ...p,
      tier: 'best',
      rank: idx + 1,
    }));

    const remainingAfterBest = filtered.slice(bestCount);
    const worstCount = Math.min(5, remainingAfterBest.length);
    const worstSlice = remainingAfterBest.slice(-worstCount).reverse();
    const worst: ScatterPoint[] = worstSlice.map((p, idx) => ({
      ...p,
      tier: 'worst',
      rank: idx + 1,
    }));

    const midSlice = remainingAfterBest.slice(
      0,
      Math.max(0, remainingAfterBest.length - worstCount)
    );
    const mid: ScatterPoint[] = midSlice.map((p, idx) => ({
      ...p,
      tier: 'mid',
      rank: idx + 1,
    }));

    return { bestPoints: best, midPoints: mid, worstPoints: worst };
  }, [filteredChannels, languages, videos, publishWindow, sinceMode, metricMode, searchFilter]);

  const sections = [
    {
      id: 'best',
      title: 'Vídeos com melhor desempenho',
      accentBorder: 'border-l-purple-500',
      dotColor: 'bg-purple-500',
      items: bestPoints,
      isOpen: openBest,
      toggle: () => setOpenBest((v) => !v),
    },
    {
      id: 'mid',
      title: 'Vídeos com desempenho médio',
      accentBorder: 'border-l-slate-500',
      dotColor: 'bg-slate-400',
      items: midPoints,
      isOpen: openMid,
      toggle: () => setOpenMid((v) => !v),
    },
    {
      id: 'worst',
      title: 'Vídeos com pior desempenho',
      accentBorder: 'border-l-sky-400',
      dotColor: 'bg-sky-400',
      items: worstPoints,
      isOpen: openWorst,
      toggle: () => setOpenWorst((v) => !v),
    },
  ];

  return (
    <div className="rounded-2xl bg-[#121720] border border-slate-800/90 overflow-hidden">
      {/* Top Bar */}
      <div className="px-5 py-4 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-400" />
          Modo Avançado · Desempenho do vídeo ({SINCE_LABELS[sinceMode]})
        </h2>

        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
            Vídeos com melhor desempenho
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
            Vídeos com pior desempenho
          </span>
        </div>
      </div>

      {/* Main Split: Left Controlos + Right Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 border-b border-slate-800/80">
        {/* Controlos Sidebar */}
        <div className="lg:col-span-3 p-4 border-b lg:border-b-0 lg:border-r border-slate-800/80 bg-[#0e131a]/60 space-y-4">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
            <SlidersHorizontal className="w-3.5 h-3.5 text-orange-400" />
            Controlos
          </div>

          <div>
            <label className="block text-[11px] text-slate-400 mb-1">
              Período desde a publicação
            </label>
            <select
              value={sinceMode}
              onChange={(e) => setSinceMode(e.target.value as SincePublishMode)}
              className="w-full px-3 py-2 rounded-xl bg-[#0b0f14] border border-slate-700 text-xs text-white focus:outline-none focus:border-orange-500 cursor-pointer"
            >
              {(Object.keys(SINCE_LABELS) as SincePublishMode[]).map((k) => (
                <option key={k} value={k}>
                  {SINCE_LABELS[k]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Métricas</label>
            <select
              value={metricMode}
              onChange={(e) => setMetricMode(e.target.value as MetricMode)}
              className="w-full px-3 py-2 rounded-xl bg-[#0b0f14] border border-slate-700 text-xs text-white focus:outline-none focus:border-orange-500 cursor-pointer"
            >
              <option value="views">Visualizações</option>
              <option value="likes">Likes</option>
              <option value="comments">Comentários</option>
              <option value="revenue">Receita Estimada</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] text-slate-400 mb-1">
              Data de publicação
            </label>
            <select
              value={publishWindow}
              onChange={(e) => setPublishWindow(Number(e.target.value) as PublishWindowDays)}
              className="w-full px-3 py-2 rounded-xl bg-[#0b0f14] border border-slate-700 text-xs text-white focus:outline-none focus:border-orange-500 cursor-pointer"
            >
              <option value={7}>Últimos 7 dias</option>
              <option value={30}>Últimos 30 dias</option>
              <option value={90}>Últimos 90 dias</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Filtrar</label>
            <input
              type="text"
              placeholder="Pesquise um filtro..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#0b0f14] border border-slate-700 text-xs text-white focus:outline-none focus:border-orange-500"
            />
          </div>
        </div>

        {/* Scatter Plot */}
        <div className="lg:col-span-9 p-5">
          <div className="h-[290px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 16, right: 24, bottom: 10, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis
                  type="number"
                  dataKey="x"
                  domain={['auto', 'auto']}
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  tickFormatter={(ts) =>
                    new Date(Number(ts)).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: 'short',
                    })
                  }
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  tickFormatter={(v) =>
                    metricMode === 'revenue' ? `$${v}` : formatCompact(Number(v))
                  }
                />
                <ZAxis range={[120, 120]} />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3', stroke: '#475569' }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const p = payload[0].payload as ScatterPoint;
                    return (
                      <div className="bg-[#0e131a] border border-slate-700 rounded-xl p-3 shadow-2xl max-w-xs space-y-1.5">
                        <div className="text-xs font-bold text-white line-clamp-2">
                          {p.title}
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center justify-between gap-3">
                          <span>
                            {p.langFlag} {p.channelName}
                          </span>
                          <span>{p.dateLabel}</span>
                        </div>
                        <div className="pt-1.5 border-t border-slate-800 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                          <span className="text-slate-400">Visualizações:</span>
                          <span className="font-mono-num text-white text-right font-semibold">
                            {formatNumber(p.views)}
                          </span>
                          <span className="text-slate-400">Likes / Coment.:</span>
                          <span className="font-mono-num text-slate-200 text-right">
                            {formatNumber(p.likes)} / {formatNumber(p.comments)}
                          </span>
                          <span className="text-slate-400">CTR:</span>
                          <span className="font-mono-num text-orange-400 text-right">
                            {p.ctr.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    );
                  }}
                />
                <Scatter name="Desempenho médio" data={midPoints} fill="#64748b" />
                <Scatter
                  name="Melhor desempenho"
                  data={bestPoints}
                  fill="#a855f7"
                  shape={renderNumberedDot('#a855f7')}
                />
                <Scatter
                  name="Pior desempenho"
                  data={worstPoints}
                  fill="#38bdf8"
                  shape={renderNumberedDot('#38bdf8')}
                />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Grouped Accordion Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-800/80 text-[11px] uppercase tracking-wider text-slate-400 bg-[#0e131a]">
              <th className="py-3 px-4 font-semibold w-10">#</th>
              <th className="py-3 px-3 font-semibold">Conteúdo</th>
              <th className="py-3 px-3 font-semibold">Idioma</th>
              <th className="py-3 px-3 font-semibold text-right">Visualizações</th>
              <th className="py-3 px-3 font-semibold text-right">CTR</th>
              <th className="py-3 px-3 font-semibold text-right">Likes</th>
              <th className="py-3 px-3 font-semibold text-right">Comentários</th>
              <th className="py-3 px-3 font-semibold text-right">Duração</th>
              <th className="py-3 px-4 font-semibold text-right">Taxa Engaj.</th>
            </tr>
          </thead>

          {sections.map((sec) => (
            <tbody key={sec.id} className="divide-y divide-slate-800/60 text-sm">
              <tr
                onClick={sec.toggle}
                className="bg-[#0e131a]/70 hover:bg-slate-800/50 cursor-pointer select-none"
              >
                <td colSpan={9} className="py-2.5 px-4">
                  <span className="text-xs font-bold text-slate-200 flex items-center gap-2">
                    {sec.isOpen ? (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    )}
                    <span className={`w-2 h-2 rounded-full ${sec.dotColor}`} />
                    {sec.title}
                    <span className="text-slate-500 font-mono-num">
                      ({sec.items.length})
                    </span>
                  </span>
                </td>
              </tr>

              {sec.isOpen &&
                sec.items.map((item) => (
                  <tr
                    key={`${sec.id}-${item.title}-${item.dateLabel}`}
                    className={`border-l-2 ${sec.accentBorder} hover:bg-slate-800/35 transition`}
                  >
                    <td className="py-2.5 px-4 font-mono-num text-xs text-slate-400 font-semibold">
                      {item.rank}
                    </td>
                    <td className="py-2.5 px-3 max-w-md">
                      <div className="flex items-center gap-3">
                        <img
                          src={item.thumbnailUrl}
                          alt={item.title}
                          className="w-14 h-8 rounded-md object-cover border border-slate-700 shrink-0"
                        />
                        <div className="min-w-0">
                          {item.youtubeUrl ? (
                            <a
                              href={item.youtubeUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs font-semibold text-slate-100 hover:text-orange-400 transition truncate flex items-center gap-1"
                            >
                              <span className="truncate">{item.title}</span>
                              <ExternalLink className="w-3 h-3 shrink-0 opacity-70" />
                            </a>
                          ) : (
                            <span className="text-xs font-semibold text-slate-100 truncate block">
                              {item.title}
                            </span>
                          )}
                          <span className="text-[11px] text-slate-400">
                            {item.channelName} · {item.dateLabel}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-medium bg-[#0b0f14] border border-slate-800 text-slate-200">
                        {item.langFlag} {item.langCode}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono-num text-white font-semibold">
                      {formatNumber(item.views)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono-num text-orange-400">
                      {item.ctr.toFixed(1)}%
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono-num text-slate-300">
                      {formatNumber(item.likes)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono-num text-slate-300">
                      {formatNumber(item.comments)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono-num text-slate-400 text-xs">
                      {formatDuration(item.durationSec)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono-num text-emerald-400 font-medium">
                      {item.engagementRate}%
                    </td>
                  </tr>
                ))}
            </tbody>
          ))}
        </table>
      </div>
    </div>
  );
}
