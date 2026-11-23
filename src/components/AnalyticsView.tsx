import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3, Globe2, Languages } from 'lucide-react';
import { PERIOD_DAYS, useStore } from '../context/StoreContext';
import { formatCompact, formatCurrency, formatHours, formatNumber } from '../utils/formatters';
import { VideoPerformanceScatter } from './VideoPerformanceScatter';

export function AnalyticsView() {
  const { channels, filteredChannels, languages, metrics, videos, period } = useStore();
  const days = PERIOD_DAYS[period];

  const crossLanguageTopics = useMemo(() => {
    const chMap = new Map(filteredChannels.map((c) => [c.id, c]));
    const langMap = new Map(languages.map((l) => [l.id, l]));

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - (days - 1));
    const startStr = startDate.toISOString().slice(0, 10);

    // Group videos published on the same date (or within same group) across different languages
    const buckets = new Map<
      string,
      Array<{
        video: (typeof videos)[number];
        channelName: string;
        langFlag: string;
        langCode: string;
        langName: string;
      }>
    >();

    for (const v of videos) {
      if (v.publishedAt < startStr) continue;
      const ch = chMap.get(v.channelId);
      if (!ch) continue;
      const lang = langMap.get(ch.languageId);
      const bucketKey = `${ch.groupId || 'all'}__${v.publishedAt}`;
      const list = buckets.get(bucketKey) || [];
      list.push({
        video: v,
        channelName: ch.name,
        langFlag: lang?.flag || '',
        langCode: lang?.code || ch.languageId,
        langName: lang?.name || ch.languageId,
      });
      buckets.set(bucketKey, list);
    }

    return Array.from(buckets.entries())
      .map(([key, items]) => {
        const distinctLangs = new Set(items.map((i) => i.langCode));
        const sorted = [...items].sort((a, b) => b.video.views - a.video.views);
        return {
          key,
          date: key.split('__')[1],
          distinctLangCount: distinctLangs.size,
          items: sorted,
        };
      })
      .filter((g) => g.distinctLangCount >= 2)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 8);
  }, [filteredChannels, languages, videos, days]);

  const languageStats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - (days - 1));
    const startStr = startDate.toISOString().slice(0, 10);

    const activeChannels = channels.filter((c) => c.isActive);
    const chLangMap = new Map(activeChannels.map((c) => [c.id, c.languageId]));

    const map = new Map(
      languages.map((l) => [
        l.id,
        {
          language: l,
          channelCount: activeChannels.filter((c) => c.languageId === l.id).length,
          views: 0,
          watchTime: 0,
          subscribers: 0,
          revenue: 0,
        },
      ])
    );

    for (const m of metrics) {
      if (m.date < startStr) continue;
      const langId = chLangMap.get(m.channelId);
      if (!langId) continue;
      const entry = map.get(langId);
      if (!entry) continue;
      entry.views += m.views;
      entry.watchTime += m.watchTimeHours;
      entry.subscribers += m.subscribersGained;
      entry.revenue += m.revenue;
    }

    return Array.from(map.values()).map((s) => ({
      ...s,
      name: `${s.language.flag} ${s.language.name}`,
      revenue: Number(s.revenue.toFixed(2)),
      watchTime: Number(s.watchTime.toFixed(1)),
      rpm: s.views > 0 ? Number(((s.revenue / s.views) * 1000).toFixed(2)) : 0,
    }));
  }, [channels, languages, metrics, days]);

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <VideoPerformanceScatter />

      {/* Cross-Language Topic Comparison */}
      {crossLanguageTopics.length > 0 && (
        <div className="rounded-2xl bg-[#121720] border border-slate-800/90 p-5 space-y-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Languages className="w-5 h-5 text-sky-400" />
              Cross-Language Performance (Same Publish Date)
            </h2>
            <p className="text-xs text-slate-400">
              Compare how videos published on the same day performed across different languages.
            </p>
          </div>

          <div className="space-y-4">
            {crossLanguageTopics.map((bundle) => (
              <div
                key={bundle.key}
                className="rounded-xl bg-[#0b0f14] border border-slate-800 p-4 space-y-3"
              >
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-mono-num font-semibold text-slate-200">
                    📅 {bundle.date}
                  </span>
                  <span>{bundle.distinctLangCount} languages</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                  {bundle.items.map((entry, idx) => (
                    <div
                      key={entry.video.id}
                      className={`rounded-xl p-3 border ${
                        idx === 0
                          ? 'bg-emerald-500/10 border-emerald-500/40'
                          : 'bg-[#121720] border-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-semibold text-slate-200">
                          {entry.langFlag} {entry.langCode}
                        </span>
                        {idx === 0 && (
                          <span className="text-[10px] font-bold uppercase text-emerald-400">
                            #1 Best
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-white font-medium line-clamp-1 mb-1">
                        {entry.video.title}
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center justify-between font-mono-num">
                        <span>{formatNumber(entry.video.views)} views</span>
                        <span>{formatNumber(entry.video.likes)} likes</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-orange-400" />
          Comparativo por Idioma ({period})
        </h2>
        <p className="text-xs text-slate-400">
          Desempenho agregado dos seus canais agrupado por idioma — compare alcance, retenção e monetização.
        </p>
      </div>

      {/* Language Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {languageStats.map((stat) => (
          <div
            key={stat.language.id}
            className="rounded-2xl bg-[#121720] border border-slate-800/90 p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">{stat.language.flag}</span>
                <div>
                  <div className="font-bold text-sm text-white">{stat.language.name}</div>
                  <div className="text-[11px] text-slate-400">
                    {stat.channelCount} canal(is)
                  </div>
                </div>
              </div>
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: stat.language.color }}
              />
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl bg-[#0b0f14] p-2.5 border border-slate-800/70">
                <div className="text-slate-400 text-[10px]">Views</div>
                <div className="font-bold font-mono-num text-white text-sm">
                  {formatCompact(stat.views)}
                </div>
              </div>
              <div className="rounded-xl bg-[#0b0f14] p-2.5 border border-slate-800/70">
                <div className="text-slate-400 text-[10px]">Receita</div>
                <div className="font-bold font-mono-num text-emerald-400 text-sm">
                  {formatCurrency(stat.revenue)}
                </div>
              </div>
              <div className="rounded-xl bg-[#0b0f14] p-2.5 border border-slate-800/70">
                <div className="text-slate-400 text-[10px]">Watch Time</div>
                <div className="font-bold font-mono-num text-slate-200 text-sm">
                  {formatHours(stat.watchTime)}h
                </div>
              </div>
              <div className="rounded-xl bg-[#0b0f14] p-2.5 border border-slate-800/70">
                <div className="text-slate-400 text-[10px]">RPM Médio</div>
                <div className="font-bold font-mono-num text-orange-400 text-sm">
                  {formatCurrency(stat.rpm)}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts: Views & Revenue by Language */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl bg-[#121720] border border-slate-800/90 p-5">
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <Globe2 className="w-4 h-4 text-orange-400" />
            Views por Idioma
          </h3>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={languageStats}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} />
                <YAxis
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  tickFormatter={(v) => formatCompact(Number(v))}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0e131a',
                    borderColor: '#334155',
                    borderRadius: '12px',
                  }}
                />
                <Bar dataKey="views" name="Views" radius={[8, 8, 0, 0]}>
                  {languageStats.map((entry) => (
                    <Cell key={entry.language.id} fill={entry.language.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl bg-[#121720] border border-slate-800/90 p-5">
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <Globe2 className="w-4 h-4 text-emerald-400" />
            Receita Estimada por Idioma (USD)
          </h3>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={languageStats}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} />
                <YAxis
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  tickFormatter={(v) => `$${v}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0e131a',
                    borderColor: '#334155',
                    borderRadius: '12px',
                  }}
                />
                <Bar dataKey="revenue" name="Receita ($)" radius={[8, 8, 0, 0]}>
                  {languageStats.map((entry) => (
                    <Cell key={entry.language.id} fill={entry.language.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
