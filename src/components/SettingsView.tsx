import React, { useState } from 'react';
import {
  CheckCircle2,
  FileSpreadsheet,
  KeyRound,
  RotateCcw,
  Save,
  Settings,
  Upload,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';

export function SettingsView() {
  const {
    channels,
    apiKey,
    setApiKey,
    syncAllChannels,
    importYouTubeStudioCsv,
    resetDemoData,
  } = useStore();
  const [draftKey, setDraftKey] = useState(apiKey);
  const [savedMsg, setSavedMsg] = useState('');
  const [selectedCsvChannelId, setSelectedCsvChannelId] = useState(
    channels[0]?.id || ''
  );
  const [csvStatus, setCsvStatus] = useState('');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setApiKey(draftKey);
    setSavedMsg('Chave salva localmente no navegador!');
    setTimeout(() => setSavedMsg(''), 3000);
  };

  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedCsvChannelId) return;
    const text = await file.text();
    const count = importYouTubeStudioCsv(selectedCsvChannelId, text);
    setCsvStatus(
      count > 0
        ? `Importados ${count} dias com sucesso!`
        : 'Não foi possível ler colunas de Data/Views neste CSV.'
    );
    e.target.value = '';
  };

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <div>
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Settings className="w-5 h-5 text-orange-400" />
          Conexão de Dados (Sem Precisar de API Key!)
        </h2>
        <p className="text-xs text-slate-400">
          Você não precisa brigar com o Google Cloud Console — use a sincronização pública sem chave ou importe o CSV direto do YouTube Studio.
        </p>
      </div>

      {/* Keyless Sync Banner */}
      <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/30 p-4 flex items-start gap-3">
        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-200 space-y-1">
          <div className="font-bold text-emerald-300">
            Sincronização Automática Sem API Key Ativada
          </div>
          <p className="text-slate-300 leading-relaxed">
            Ao adicionar um canal em <strong>Gerenciar Canais</strong> usando o{' '}
            <code className="text-emerald-300">@handle</code> real ou{' '}
            <code className="text-emerald-300">Channel ID (UC...)</code>, o servidor local busca nome, avatar, inscritos e os últimos 15 vídeos automaticamente via feed público do YouTube.
          </p>
        </div>
      </div>

      {/* YouTube Studio CSV Importer */}
      <div className="rounded-2xl bg-[#121720] border border-slate-800/90 p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <FileSpreadsheet className="w-4 h-4 text-orange-400" />
          Importar CSV do YouTube Studio (Views, Watch Time e Receita Reais)
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          No <strong>YouTube Studio → Estatísticas → Modo Avançado</strong>, clique em{' '}
          <strong>Exportar (CSV)</strong> e envie o arquivo aqui para atualizar métricas diárias reais sem precisar de OAuth ou API Key.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedCsvChannelId}
            onChange={(e) => setSelectedCsvChannelId(e.target.value)}
            className="px-3 py-2 rounded-xl bg-[#0b0f14] border border-slate-700 text-xs text-white focus:outline-none focus:border-orange-500"
          >
            {channels.map((ch) => (
              <option key={ch.id} value={ch.id}>
                {ch.name} ({ch.handle})
              </option>
            ))}
          </select>

          <label className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-xs font-semibold text-white cursor-pointer transition">
            <Upload className="w-3.5 h-3.5" />
            Selecionar CSV
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={handleCsvUpload}
              className="hidden"
            />
          </label>

          {csvStatus && (
            <span className="text-xs text-emerald-400 font-medium">{csvStatus}</span>
          )}
        </div>
      </div>

      {/* Optional API Key */}
      <form
        onSubmit={handleSave}
        className="rounded-2xl bg-[#121720] border border-slate-800/90 p-5 space-y-4"
      >
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <KeyRound className="w-4 h-4 text-slate-400" />
          YouTube Data API v3 Key (Opcional)
        </div>

        <input
          type="password"
          placeholder="AIzaSy... (opcional)"
          value={draftKey}
          onChange={(e) => setDraftKey(e.target.value)}
          className="w-full px-3.5 py-2.5 rounded-xl bg-[#0b0f14] border border-slate-700 text-sm text-white font-mono-num focus:outline-none focus:border-orange-500"
        />

        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-emerald-400">{savedMsg}</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => syncAllChannels()}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition cursor-pointer"
            >
              Sincronizar Agora
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-xs font-semibold text-white transition cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              Salvar Chave
            </button>
          </div>
        </div>
      </form>

      <div className="rounded-2xl bg-[#121720] border border-slate-800/90 p-5 flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-white">Restaurar Dados de Demonstração</div>
          <div className="text-xs text-slate-400">
            Reseta os canais e métricas para o conjunto inicial (8 canais em PT-BR, EN, FR e ES).
          </div>
        </div>
        <button
          onClick={resetDemoData}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition cursor-pointer shrink-0"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Restaurar Demo
        </button>
      </div>
    </div>
  );
}
