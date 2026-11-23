import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { FileDown, SlidersHorizontal, X } from 'lucide-react';
import { PERIOD_DAYS, useStore } from '../context/StoreContext';
import { PeriodOption } from '../types/youtube';
import { exportAiPdfReport, PdfReportSections } from '../utils/exportPdfReport';

interface ExportReportModalProps {
  onClose: () => void;
}

const PERIOD_LABELS: Record<PeriodOption, string> = {
  '24h': 'Últimas 24 horas',
  '48h': 'Últimas 48 horas',
  '7d': 'Últimos 7 dias',
  '14d': 'Últimos 14 dias',
  '30d': 'Últimos 30 dias',
  '90d': 'Últimos 90 dias',
};

export function ExportReportModal({ onClose }: ExportReportModalProps) {
  const {
    languages,
    groups,
    channels,
    metrics,
    videos,
    period: currentPeriod,
    selectedLanguageId: currentLangId,
    selectedGroupId: currentGroupId,
    selectedChannelId: currentChannelId,
  } = useStore();

  const [reportPeriod, setReportPeriod] = useState<PeriodOption>(currentPeriod);
  const [langId, setLangId] = useState<string>(currentLangId);
  const [groupId, setGroupId] = useState<string>(currentGroupId);
  const [channelId, setChannelId] = useState<string>(currentChannelId);
  const [topVideosLimit, setTopVideosLimit] = useState<number>(15);
  const [aiNote, setAiNote] = useState<string>(
    'Analise padrões de crescimento, retenção, CTR, comparação entre idiomas/grupos e recomendações práticas para escalar os melhores formatos.'
  );
  const [sections, setSections] = useState<PdfReportSections>({
    kpis: true,
    byLanguage: true,
    byChannel: true,
    topVideos: true,
    topEngagement: true,
    audienceDetails: true,
  });

  const matchingChannels = useMemo(() => {
    return channels.filter((ch) => {
      if (!ch.isActive) return false;
      if (langId !== 'all' && ch.languageId !== langId) return false;
      if (groupId !== 'all' && ch.groupId !== groupId) return false;
      if (channelId !== 'all' && ch.id !== channelId) return false;
      return true;
    });
  }, [channels, langId, groupId, channelId]);

  const toggleSection = (key: keyof PdfReportSections) => {
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleGenerate = () => {
    exportAiPdfReport({
      period: reportPeriod,
      days: PERIOD_DAYS[reportPeriod],
      selectedLanguageId: langId,
      selectedGroupId: groupId,
      selectedChannelId: channelId,
      languages,
      groups,
      filteredChannels: matchingChannels,
      metrics,
      videos,
      sections,
      topVideosLimit,
      aiNote,
    });
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-[#121720] border border-slate-700/80 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-orange-400" />
            <h3 className="text-base font-bold text-white">
              Personalizar Relatório PDF (para IA)
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5 flex-1 overflow-y-auto">
          {/* Filters */}
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5">
              1. Filtros do Relatório ({matchingChannels.length} canal(is) incluído(s))
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Período</label>
                <select
                  value={reportPeriod}
                  onChange={(e) => setReportPeriod(e.target.value as PeriodOption)}
                  className="w-full px-3 py-2 rounded-xl bg-[#0b0f14] border border-slate-700 text-xs text-white focus:outline-none focus:border-orange-500"
                >
                  {(Object.keys(PERIOD_LABELS) as PeriodOption[]).map((k) => (
                    <option key={k} value={k}>
                      {PERIOD_LABELS[k]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Idioma</label>
                <select
                  value={langId}
                  onChange={(e) => {
                    setLangId(e.target.value);
                    setChannelId('all');
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-[#0b0f14] border border-slate-700 text-xs text-white focus:outline-none focus:border-orange-500"
                >
                  <option value="all">Todos os Idiomas</option>
                  {languages.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.flag} {l.name} ({l.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Grupo</label>
                <select
                  value={groupId}
                  onChange={(e) => {
                    setGroupId(e.target.value);
                    setChannelId('all');
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-[#0b0f14] border border-slate-700 text-xs text-white focus:outline-none focus:border-orange-500"
                >
                  <option value="all">Todos os Grupos</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.icon} {g.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Canal</label>
                <select
                  value={channelId}
                  onChange={(e) => setChannelId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#0b0f14] border border-slate-700 text-xs text-white focus:outline-none focus:border-orange-500"
                >
                  <option value="all">Todos os Canais</option>
                  {channels
                    .filter((c) => c.isActive)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.handle})
                      </option>
                    ))}
                </select>
              </div>
            </div>
          </div>

          {/* Sections */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                2. Seções para Incluir no PDF
              </span>
              <div className="flex items-center gap-2 text-[11px]">
                <span className="text-slate-400">Qtd. Top Vídeos:</span>
                <select
                  value={topVideosLimit}
                  onChange={(e) => setTopVideosLimit(Number(e.target.value))}
                  className="px-2 py-1 rounded-lg bg-[#0b0f14] border border-slate-700 text-white"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={15}>15</option>
                  <option value={25}>25</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(
                [
                  { key: 'kpis', label: 'Resumo Executivo (KPIs)' },
                  { key: 'byLanguage', label: 'Comparativo por Idioma' },
                  { key: 'byChannel', label: 'Desempenho por Canal (CTR, RPM)' },
                  { key: 'topVideos', label: `Top ${topVideosLimit} Vídeos por Views` },
                  { key: 'topEngagement', label: 'Top 5 Likes & Top 5 Comentários' },
                  {
                    key: 'audienceDetails',
                    label: 'Origens, Dispositivos, Idade, Género & Geo',
                  },
                ] as Array<{ key: keyof PdfReportSections; label: string }>
              ).map((item) => (
                <label
                  key={item.key}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border text-xs cursor-pointer transition ${
                    sections[item.key]
                      ? 'bg-orange-500/15 border-orange-500/40 text-white'
                      : 'bg-[#0b0f14] border-slate-800 text-slate-400'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={sections[item.key]}
                    onChange={() => toggleSection(item.key)}
                    className="accent-orange-500"
                  />
                  {item.label}
                </label>
              ))}
            </div>
          </div>

          {/* Custom prompt for AI */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              3. Instrução / Pergunta para a IA (impressa no topo do PDF)
            </label>
            <textarea
              rows={2}
              value={aiNote}
              onChange={(e) => setAiNote(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#0b0f14] border border-slate-700 text-xs text-white focus:outline-none focus:border-orange-500"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-800 bg-[#0e131a] flex items-center justify-end gap-3 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={handleGenerate}
            disabled={matchingChannels.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold shadow-lg shadow-orange-500/20 transition cursor-pointer disabled:opacity-50"
          >
            <FileDown className="w-4 h-4" />
            Baixar PDF Personalizado
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
