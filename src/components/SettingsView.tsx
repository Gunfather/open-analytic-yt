import React, { useState } from 'react';
import {
  CheckCircle2,
  Download,
  FileSpreadsheet,
  KeyRound,
  RotateCcw,
  Save,
  Settings,
  Sparkles,
  Upload,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';

export function SettingsView() {
  const {
    channels,
    apiKey,
    setApiKey,
    aiConfig,
    setAiConfig,
    syncAllChannels,
    importYouTubeStudioCsv,
    exportBackupJson,
    importBackupJson,
    resetDemoData,
    t,
  } = useStore();
  const [draftKey, setDraftKey] = useState(apiKey);
  const [savedMsg, setSavedMsg] = useState('');
  const [aiProvider, setAiProvider] = useState<'gemini' | 'openai'>(aiConfig.provider);
  const [aiKey, setAiKey] = useState(aiConfig.apiKey);
  const [aiSavedMsg, setAiSavedMsg] = useState('');
  const [selectedCsvChannelId, setSelectedCsvChannelId] = useState(
    channels[0]?.id || ''
  );
  const [csvStatus, setCsvStatus] = useState('');
  const [backupStatus, setBackupStatus] = useState('');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setApiKey(draftKey);
    setSavedMsg('Saved locally!');
    setTimeout(() => setSavedMsg(''), 3000);
  };

  const handleSaveAi = (e: React.FormEvent) => {
    e.preventDefault();
    setAiConfig({ provider: aiProvider, apiKey: aiKey });
    setAiSavedMsg('AI configuration saved locally!');
    setTimeout(() => setAiSavedMsg(''), 3000);
  };

  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedCsvChannelId) return;
    const text = await file.text();
    const count = importYouTubeStudioCsv(selectedCsvChannelId, text);
    setCsvStatus(
      count > 0
        ? `Imported ${count} day(s) successfully!`
        : 'Could not find Date/Views columns in this CSV.'
    );
    e.target.value = '';
  };

  const handleDownloadBackup = () => {
    const json = exportBackupJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `OpenAnalyticYT-Backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setBackupStatus('Backup exported!');
    setTimeout(() => setBackupStatus(''), 3000);
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const res = importBackupJson(text);
    setBackupStatus(res.message);
    e.target.value = '';
  };

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <div>
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Settings className="w-5 h-5 text-orange-400" />
          {t('settingsTitle')}
        </h2>
        <p className="text-xs text-slate-400">
          {t('settingsSubtitle')}
        </p>
      </div>

      {/* Keyless Sync Banner */}
      <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/30 p-4 flex items-start gap-3">
        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-200 space-y-1">
          <div className="font-bold text-emerald-300">
            {t('keylessTitle')}
          </div>
          <p className="text-slate-300 leading-relaxed">
            {t('keylessDesc')}
          </p>
        </div>
      </div>

      {/* Backup & Restore JSON */}
      <div className="rounded-2xl bg-[#121720] border border-slate-800/90 p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <Download className="w-4 h-4 text-sky-400" />
          {t('backupTitle')}
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          {t('backupDesc')}
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleDownloadBackup}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-xs font-semibold text-white transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            {t('exportBackupBtn')}
          </button>

          <label className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-100 border border-slate-700 cursor-pointer transition">
            <Upload className="w-3.5 h-3.5" />
            {t('importBackupBtn')}
            <input
              type="file"
              accept=".json,application/json"
              onChange={handleImportBackup}
              className="hidden"
            />
          </label>

          {backupStatus && (
            <span className="text-xs text-emerald-400 font-medium">{backupStatus}</span>
          )}
        </div>
      </div>

      {/* YouTube Studio CSV Importer */}
      <div className="rounded-2xl bg-[#121720] border border-slate-800/90 p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <FileSpreadsheet className="w-4 h-4 text-orange-400" />
          {t('csvTitle')}
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          {t('csvDesc')}
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
            {t('selectCsvBtn')}
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

      {/* AI Insights API Key (Optional) */}
      <form
        onSubmit={handleSaveAi}
        className="rounded-2xl bg-[#121720] border border-slate-800/90 p-5 space-y-4"
      >
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <Sparkles className="w-4 h-4 text-purple-400" />
          {t('aiConfigTitle')}
        </div>
        <p className="text-xs text-slate-400">
          {t('aiConfigDesc')}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <select
            value={aiProvider}
            onChange={(e) => setAiProvider(e.target.value as 'gemini' | 'openai')}
            className="px-3 py-2 rounded-xl bg-[#0b0f14] border border-slate-700 text-xs text-white focus:outline-none focus:border-purple-500"
          >
            <option value="gemini">Google Gemini</option>
            <option value="openai">OpenAI (GPT)</option>
          </select>

          <input
            type="password"
            placeholder={aiProvider === 'gemini' ? 'AIza... (optional)' : 'sk-... (optional)'}
            value={aiKey}
            onChange={(e) => setAiKey(e.target.value)}
            className="sm:col-span-2 px-3.5 py-2 rounded-xl bg-[#0b0f14] border border-slate-700 text-xs text-white font-mono-num focus:outline-none focus:border-purple-500"
          />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-emerald-400">{aiSavedMsg}</span>
          <button
            type="submit"
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-xs font-semibold text-white transition cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            {t('saveAiBtn')}
          </button>
        </div>
      </form>

      {/* Optional YouTube Data API Key */}
      <form
        onSubmit={handleSave}
        className="rounded-2xl bg-[#121720] border border-slate-800/90 p-5 space-y-4"
      >
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <KeyRound className="w-4 h-4 text-slate-400" />
          {t('ytKeyTitle')}
        </div>

        <input
          type="password"
          placeholder="AIzaSy... (optional)"
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
              {t('syncBtn')}
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-xs font-semibold text-white transition cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              {t('saveKey')}
            </button>
          </div>
        </div>
      </form>

      <div className="rounded-2xl bg-[#121720] border border-slate-800/90 p-5 flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-white">{t('demoTitle')}</div>
          <div className="text-xs text-slate-400">
            {t('demoDesc')}
          </div>
        </div>
        <button
          onClick={resetDemoData}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition cursor-pointer shrink-0"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          {t('restoreDemo')}
        </button>
      </div>
    </div>
  );
}
