import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Flame, RefreshCw, Sparkles, X } from 'lucide-react';
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
  } = useStore();

  const [loading, setLoading] = useState(false);
  const [analysisText, setAnalysisText] = useState('');
  const [usedMode, setUsedMode] = useState<'gemini' | 'openai' | 'local'>('local');
  const [customQuestion, setCustomQuestion] = useState(
    'Which languages and channels are performing best, and what should I prioritize next?'
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
      .slice(0, 8)
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

  const buildLocalDiagnostics = () => {
    const sorted = [...summaryPayload.channels].sort((a, b) => b.views - a.views);
    const topCh = sorted[0];
    const lowestCtr = [...summaryPayload.channels].sort((a, b) => a.ctr - b.ctr)[0];
    const bestVideo = summaryPayload.topVideos[0];

    const byLang = new Map<string, number>();
    for (const c of summaryPayload.channels) {
      byLang.set(c.language, (byLang.get(c.language) || 0) + c.views);
    }
    const topLang = Array.from(byLang.entries()).sort((a, b) => b[1] - a[1])[0];

    const lines = [
      `📊 Executive Summary (${period})`,
      `• Total Views: ${formatNumber(summaryPayload.totalViews)} (${
        summaryPayload.viewsDeltaPct >= 0 ? '+' : ''
      }${summaryPayload.viewsDeltaPct}% vs previous period)`,
      `• Watch Time: ${summaryPayload.watchTimeHours}h | New Subscribers: +${formatNumber(
        summaryPayload.subscribers
      )} | Est. Revenue: ${formatCurrency(summaryPayload.estimatedRevenue)}`,
      '',
      '🏆 Key Highlights',
      topCh
        ? `• Top Channel: ${topCh.name} (${topCh.language}) with ${formatNumber(
            topCh.views
          )} views and ${topCh.ctr.toFixed(1)}% CTR.`
        : '• No active channels in current filter.',
      topLang
        ? `• Strongest Language: ${topLang[0]} (${formatNumber(
            topLang[1]
          )} views across channels in this language).`
        : '',
      bestVideo
        ? `• Top Video: "${bestVideo.title}" (${formatNumber(
            bestVideo.views
          )} views, ${formatNumber(bestVideo.likes)} likes, ${formatNumber(
            bestVideo.comments
          )} comments).`
        : '',
      '',
      '🎯 Actionable Recommendations',
      lowestCtr
        ? `• Thumbnail / Title Opportunity: "${lowestCtr.name}" has the lowest CTR (${lowestCtr.ctr.toFixed(
            1
          )}%). Test high-contrast thumbnails or curiosity hooks similar to your top performer.`
        : '',
      '• Cross-Language Scaling: Replicate your top-performing video formats across all active languages within 24-48h to maximize regional reach.',
      '',
      '💡 Tip: Add a free Gemini or OpenAI API key in Settings & API for deeper custom natural-language analysis.',
    ];
    return lines.filter(Boolean).join('\n');
  };

  const runAnalysis = async () => {
    setLoading(true);
    try {
      if (!aiConfig.apiKey) {
        setUsedMode('local');
        setAnalysisText(buildLocalDiagnostics());
        return;
      }

      const prompt = `You are a YouTube multi-channel growth strategist. Analyze the following JSON metrics and answer concisely with bullet points and actionable recommendations.\n\nUser Question: ${customQuestion}\n\nData:\n${JSON.stringify(
        summaryPayload,
        null,
        2
      )}`;

      if (aiConfig.provider === 'gemini') {
        setUsedMode('gemini');
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(
            aiConfig.apiKey
          )}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
            }),
          }
        );
        const data = (await res.json()) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
          error?: { message?: string };
        };
        if (!res.ok || data.error) {
          throw new Error(data.error?.message || `Gemini API HTTP ${res.status}`);
        }
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        setAnalysisText(text || buildLocalDiagnostics());
      } else {
        setUsedMode('openai');
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${aiConfig.apiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
          }),
        });
        const data = (await res.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
          error?: { message?: string };
        };
        if (!res.ok || data.error) {
          throw new Error(data.error?.message || `OpenAI API HTTP ${res.status}`);
        }
        const text = data.choices?.[0]?.message?.content;
        setAnalysisText(text || buildLocalDiagnostics());
      }
    } catch (err) {
      setUsedMode('local');
      setAnalysisText(
        `⚠️ Cloud AI call failed (${
          err instanceof Error ? err.message : 'Unknown error'
        }). Falling back to local diagnostics:\n\n${buildLocalDiagnostics()}`
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
          <div className="flex gap-2">
            <input
              type="text"
              value={customQuestion}
              onChange={(e) => setCustomQuestion(e.target.value)}
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
