import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Flame, RefreshCw, Settings, Sparkles, X } from 'lucide-react';
import { PERIOD_DAYS, useStore } from '../context/StoreContext';
import { formatCurrency, formatNumber } from '../utils/formatters';

interface AiInsightsModalProps {
  onClose: () => void;
}

export function AiInsightsModal({ onClose }: AiInsightsModalProps) {
  const {
    filteredChannels,
    languages,
    groups,
    metrics,
    videos,
    period,
    aggregatedKpis,
    aiConfig,
    uiLanguage,
    setActiveTab,
  } = useStore();

  const [loading, setLoading] = useState(false);
  const [analysisText, setAnalysisText] = useState('');
  const [usedMode, setUsedMode] = useState<'gemini' | 'openai' | 'local'>('local');
  const [customQuestion, setCustomQuestion] = useState(
    uiLanguage === 'pt-BR'
      ? 'Quais idiomas e canais têm melhor desempenho e o que devo priorizar agora?'
      : 'Which languages and channels are performing best, and what should I prioritize next?'
  );

  const summaryPayload = useMemo(() => {
    const days = PERIOD_DAYS[period];
    const langMap = new Map(languages.map((l) => [l.id, l]));
    const groupMap = new Map(groups.map((g) => [g.id, g]));
    const chMap = new Map(filteredChannels.map((c) => [c.id, c]));

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - (days - 1));
    const startStr = startDate.toISOString().slice(0, 10);

    const perChannel = filteredChannels.map((ch) => {
      let views = 0;
      let revenue = 0;
      for (const m of metrics) {
        if (m.channelId === ch.id && m.date >= startStr) {
          views += m.views;
          revenue += m.revenue;
        }
      }
      return {
        name: ch.name,
        language: langMap.get(ch.languageId)?.name || ch.languageId,
        group: ch.groupId ? groupMap.get(ch.groupId)?.name : undefined,
        views,
        ctr: ch.ctr ?? 6.2,
        rpm: ch.rpm,
        revenue: Number(revenue.toFixed(2)),
      };
    });

    const topVideos = videos
      .filter((v) => chMap.has(v.channelId) && v.publishedAt >= startStr)
      .sort((a, b) => b.views - a.views)
      .slice(0, 10)
      .map((v) => ({
        title: v.title,
        channel: chMap.get(v.channelId)?.name,
        views: v.views,
        likes: v.likes,
        comments: v.comments,
      }));

    return {
      period,
      totalViews: aggregatedKpis.views,
      viewsDeltaPct: aggregatedKpis.viewsDeltaPct,
      watchTimeHours: aggregatedKpis.watchTimeHours,
      subscribers: aggregatedKpis.subscribers,
      estimatedRevenue: aggregatedKpis.revenue,
      channels: perChannel,
      topVideos,
    };
  }, [filteredChannels, languages, groups, metrics, videos, period, aggregatedKpis]);

  const buildLocalDiagnostics = (question: string) => {
    const q = question.toLowerCase();
    const sorted = [...summaryPayload.channels].sort((a, b) => b.views - a.views);
    const topCh = sorted[0];
    const lowestCtr = [...summaryPayload.channels].sort((a, b) => a.ctr - b.ctr)[0];
    const bestCtr = [...summaryPayload.channels].sort((a, b) => b.ctr - a.ctr)[0];
    const bestVideo = summaryPayload.topVideos[0];

    const byLang = new Map<string, { views: number; revenue: number }>();
    for (const c of summaryPayload.channels) {
      const cur = byLang.get(c.language) || { views: 0, revenue: 0 };
      cur.views += c.views;
      cur.revenue += c.revenue;
      byLang.set(c.language, cur);
    }
    const sortedLangs = Array.from(byLang.entries()).sort((a, b) => b[1].views - a[1].views);
    const topLang = sortedLangs[0];

    const isPt = uiLanguage === 'pt-BR';

    const lines: string[] = [
      isPt
        ? `📊 Resumo (${period}) · ${filteredChannels.length} canal(is)`
        : `📊 Summary (${period}) · ${filteredChannels.length} channel(s)`,
      `• Views: ${formatNumber(summaryPayload.totalViews)} (${
        summaryPayload.viewsDeltaPct >= 0 ? '+' : ''
      }${summaryPayload.viewsDeltaPct}%) | Watch Time: ${summaryPayload.watchTimeHours}h | Est. Revenue: ${formatCurrency(
        summaryPayload.estimatedRevenue
      )}`,
      '',
    ];

    if (q.includes('ctr') || q.includes('click') || q.includes('thumb')) {
      lines.push(isPt ? '🎯 Análise de CTR:' : '🎯 CTR Breakdown:');
      if (bestCtr) {
        lines.push(
          `• ${isPt ? 'Melhor CTR' : 'Highest CTR'}: ${bestCtr.name} (${bestCtr.ctr.toFixed(1)}%)`
        );
      }
      if (lowestCtr) {
        lines.push(
          `• ${isPt ? 'Menor CTR' : 'Lowest CTR'}: ${lowestCtr.name} (${lowestCtr.ctr.toFixed(
            1
          )}%) — ${
            isPt
              ? 'teste novas thumbnails com mais contraste.'
              : 'test higher-contrast thumbnails and stronger curiosity hooks.'
          }`
        );
      }
      lines.push('');
    }

    if (q.includes('lang') || q.includes('idiom') || q.includes('lingua')) {
      lines.push(isPt ? '🌍 Ranking por Idioma:' : '🌍 Language Ranking:');
      sortedLangs.forEach(([langName, stats], i) => {
        lines.push(
          `${i + 1}. ${langName}: ${formatNumber(stats.views)} views · ${formatCurrency(
            stats.revenue
          )}`
        );
      });
      lines.push('');
    }

    lines.push(isPt ? '🏆 Principais Destaques:' : '🏆 Key Highlights:');
    if (topCh) {
      lines.push(
        `• ${isPt ? 'Canal líder' : 'Top Channel'}: ${topCh.name} (${topCh.language}) — ${formatNumber(
          topCh.views
        )} views, CTR ${topCh.ctr.toFixed(1)}%`
      );
    }
    if (topLang) {
      lines.push(
        `• ${isPt ? 'Idioma mais forte' : 'Strongest Language'}: ${topLang[0]} (${formatNumber(
          topLang[1].views
        )} views)`
      );
    }
    if (bestVideo) {
      lines.push(
        `• ${isPt ? 'Vídeo #1' : 'Top Video'}: "${bestVideo.title}" (${formatNumber(
          bestVideo.views
        )} views, ${formatNumber(bestVideo.likes)} likes, ${formatNumber(
          bestVideo.comments
        )} comments)`
      );
    }

    return lines.join('\n');
  };

  const runAnalysis = async () => {
    setLoading(true);
    try {
      if (!aiConfig.apiKey) {
        setUsedMode('local');
        setAnalysisText(buildLocalDiagnostics(customQuestion));
        return;
      }

      const langInstruction =
        uiLanguage === 'pt-BR'
          ? 'Respond in Portuguese (PT-BR).'
          : uiLanguage === 'fr'
          ? 'Respond in French.'
          : uiLanguage === 'es'
          ? 'Respond in Spanish.'
          : 'Respond in English.';

      const prompt = `You are a YouTube multi-channel growth strategist. ${langInstruction} Analyze the following JSON metrics and answer concisely with bullet points and actionable recommendations.\n\nUser Question: ${customQuestion}\n\nData:\n${JSON.stringify(
        summaryPayload,
        null,
        2
      )}`;

      const res = await fetch('/api/ai-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: aiConfig.provider,
          apiKey: aiConfig.apiKey,
          prompt,
        }),
      });

      const data = (await res.json()) as { ok?: boolean; text?: string; error?: string };
      if (!res.ok || !data.ok || !data.text) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      setUsedMode(aiConfig.provider);
      setAnalysisText(data.text);
    } catch (err) {
      setUsedMode('local');
      setAnalysisText(
        `⚠️ ${
          err instanceof Error ? err.message : 'AI request error'
        }\n\n${buildLocalDiagnostics(customQuestion)}`
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void runAnalysis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-[#121720] border border-purple-500/40 shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <h3 className="text-base font-bold text-white">AI Insights</h3>
            <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30">
              {usedMode === 'gemini'
                ? 'Gemini'
                : usedMode === 'openai'
                ? 'OpenAI'
                : 'Local Analyzer'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 flex-1 overflow-y-auto">
          {!aiConfig.apiKey && (
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs text-amber-200">
              <span>
                {uiLanguage === 'pt-BR'
                  ? 'Sem chave Gemini/OpenAI configurada — usando resumo automático local.'
                  : 'No Gemini/OpenAI key configured — using local summary diagnostics.'}
              </span>
              <button
                onClick={() => {
                  onClose();
                  setActiveTab('settings');
                }}
                className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 font-semibold cursor-pointer"
              >
                <Settings className="w-3 h-3" />
                {uiLanguage === 'pt-BR' ? 'Configurar IA' : 'Setup AI Key'}
              </button>
            </div>
          )}

          <div className="flex gap-2">
            <input
              type="text"
              value={customQuestion}
              onChange={(e) => setCustomQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void runAnalysis();
              }}
              className="flex-1 px-3 py-2 rounded-xl bg-[#0b0f14] border border-slate-700 text-xs text-white focus:outline-none focus:border-purple-500"
            />
            <button
              onClick={() => void runAnalysis()}
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-xs font-semibold text-white transition cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Flame className="w-3.5 h-3.5" />
              )}
              Analyze
            </button>
          </div>

          <div className="rounded-xl bg-[#0b0f14] border border-slate-800 p-4 text-xs text-slate-200 whitespace-pre-wrap leading-relaxed font-sans min-h-[220px]">
            {loading ? 'Analyzing your channels and video performance...' : analysisText}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
