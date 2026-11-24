import { useState } from 'react';
import { Calendar, FileDown, Globe2, RefreshCw, Sparkles, Tv2 } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { UI_LANGUAGE_OPTIONS, UiLanguage } from '../i18n/translations';
import { NavTab, PeriodOption } from '../types/youtube';
import { AiInsightsModal } from './AiInsightsModal';
import { ExportReportModal } from './ExportReportModal';
import { formatRelativeTime } from '../utils/formatters';

export function TopBar() {
  const [showExportModal, setShowExportModal] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const {
    activeTab,
    channels,
    languages,
    groups,
    period,
    setPeriod,
    selectedLanguageId,
    setSelectedLanguageId,
    selectedGroupId,
    setSelectedGroupId,
    selectedChannelId,
    setSelectedChannelId,
    isSyncing,
    syncAllChannels,
    autoSyncMinutes,
    setAutoSyncMinutes,
    apiKey,
    setActiveTab,
    uiLanguage,
    setUiLanguage,
    t,
    lastSyncMessage,
  } = useStore();

  const TAB_TITLES: Record<NavTab, string> = {
    dashboard: t('tabDashboard'),
    channels: t('tabChannels'),
    videos: t('tabVideos'),
    analytics: t('tabAnalytics'),
    scheduled: t('tabScheduled'),
    settings: t('tabSettings'),
  };

  const PERIOD_LABELS: Record<PeriodOption, string> = {
    '24h': t('period24h'),
    '48h': t('period48h'),
    '7d': t('period7d'),
    '14d': t('period14d'),
    '30d': t('period30d'),
    '90d': t('period90d'),
  };

  const latestSync = channels.reduce((latest, ch) => {
    return ch.lastSyncedAt > latest ? ch.lastSyncedAt : latest;
  }, channels[0]?.lastSyncedAt || new Date().toISOString());

  const langMap = new Map(languages.map((l) => [l.id, l]));

  const visibleAvatars = channels.filter(
    (c) =>
      c.isActive &&
      (selectedLanguageId === 'all' || c.languageId === selectedLanguageId) &&
      (selectedGroupId === 'all' || c.groupId === selectedGroupId)
  );

  return (
    <header className="border-b border-slate-800/80 bg-[#0e131a]/90 backdrop-blur-md sticky top-0 z-20">
      <div className="px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
        {/* Left: Title + Synced + Avatars */}
        <div className="flex items-center gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              {TAB_TITLES[activeTab]}
            </h1>
            <p className="text-xs text-slate-400">
              {t('lastSynced')}: {formatRelativeTime(latestSync)}
            </p>
          </div>

          {/* Channel avatar stack */}
          <div className="flex items-center -space-x-2 pl-2">
            {visibleAvatars.slice(0, 10).map((ch) => {
              const isSelected = selectedChannelId === ch.id;
              return (
                <button
                  key={ch.id}
                  title={`${ch.name} (${ch.handle}) — Clique para filtrar`}
                  onClick={() =>
                    setSelectedChannelId(isSelected ? 'all' : ch.id)
                  }
                  className={`relative w-8 h-8 rounded-full overflow-hidden border-2 transition-transform hover:scale-110 hover:z-10 cursor-pointer ${isSelected
                      ? 'border-orange-500 ring-2 ring-orange-500/40 z-10 scale-110'
                      : 'border-[#0e131a]'
                    }`}
                >
                  <img
                    src={ch.avatarUrl}
                    alt={ch.name}
                    className="w-full h-full object-cover"
                  />
                </button>
              );
            })}
            {visibleAvatars.length > 10 && (
              <span className="w-8 h-8 rounded-full bg-slate-800 border-2 border-[#0e131a] flex items-center justify-center text-[11px] font-mono-num text-slate-300">
                +{visibleAvatars.length - 10}
              </span>
            )}
            {selectedChannelId !== 'all' && (
              <button
                onClick={() => setSelectedChannelId('all')}
                className="ml-4 text-xs text-orange-400 hover:text-orange-300 underline cursor-pointer"
              >
                {t('clearChannel')}
              </button>
            )}
          </div>
        </div>

        {/* Right: Channel selector + Period selector + Sync button + UI Language */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 bg-[#131a24] border border-slate-800 rounded-xl px-3 py-1.5">
            <Tv2 className="w-4 h-4 text-orange-400" />
            <span className="text-xs text-slate-400 hidden sm:inline">{t('channelLabel')}:</span>
            <select
              value={selectedChannelId}
              onChange={(e) => setSelectedChannelId(e.target.value)}
              className="bg-transparent text-xs font-medium text-slate-100 focus:outline-none cursor-pointer max-w-[200px]"
            >
              <option value="all" className="bg-[#131a24] text-slate-100">
                {t('allChannels')} ({visibleAvatars.length})
              </option>
              {visibleAvatars.map((ch) => {
                const lang = langMap.get(ch.languageId);
                return (
                  <option
                    key={ch.id}
                    value={ch.id}
                    className="bg-[#131a24] text-slate-100"
                  >
                    {lang ? `${lang.flag} ` : ''}
                    {ch.name} ({ch.handle})
                  </option>
                );
              })}
            </select>
          </div>

          <div className="flex items-center gap-2 bg-[#131a24] border border-slate-800 rounded-xl px-3 py-1.5">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span className="text-xs text-slate-400 hidden sm:inline">{t('periodLabel')}:</span>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as PeriodOption)}
              className="bg-transparent text-xs font-medium text-slate-100 focus:outline-none cursor-pointer"
            >
              {(Object.keys(PERIOD_LABELS) as PeriodOption[]).map((key) => (
                <option key={key} value={key} className="bg-[#131a24] text-slate-100">
                  {PERIOD_LABELS[key]}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => syncAllChannels()}
            disabled={isSyncing}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-100 text-xs font-medium border border-slate-700/80 transition cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-orange-400' : ''}`} />
            {isSyncing ? t('syncingBtn') : t('syncBtn')}
          </button>

          <div
            title={
              autoSyncMinutes > 0
                ? `Sincronização automática a cada ${autoSyncMinutes} min (${
                    apiKey ? 'via YouTube API v3' : 'via Feed Público — configure a API Key em Configurações'
                  })`
                : 'Sincronização automática pausada'
            }
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold border transition ${
              autoSyncMinutes > 0
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-[#131a24] text-slate-400 border-slate-800'
              }`}
          >
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                autoSyncMinutes > 0 ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
              }`}
            />
            <select
              value={autoSyncMinutes}
              onChange={(e) => setAutoSyncMinutes(Number(e.target.value) as 0 | 2 | 10 | 20)}
              className="bg-transparent text-[11px] font-semibold focus:outline-none cursor-pointer"
            >
              <option value={2} className="bg-[#131a24] text-slate-100">
                Auto 2m
              </option>
              <option value={10} className="bg-[#131a24] text-slate-100">
                Auto 10m
              </option>
              <option value={20} className="bg-[#131a24] text-slate-100">
                Auto 20m
              </option>
              <option value={0} className="bg-[#131a24] text-slate-100">
                Auto Off
              </option>
            </select>
            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              title={
                apiKey
                  ? 'A sincronizar pela YouTube Data API v3 (clique para abrir Configurações)'
                  : 'Sem YouTube API Key — a usar Feed Público (clique para configurar a API)'
              }
              className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider cursor-pointer transition ${
                apiKey
                  ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30'
              }`}
            >
              {apiKey ? 'API' : 'RSS'}
            </button>
          </div>

          <button
            onClick={() => setShowAiModal(true)}
            title="Analyze current filtered data with AI Insights"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shadow-lg shadow-purple-500/20 transition cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            AI Insights
          </button>

          <button
            onClick={() => setShowExportModal(true)}
            title="Personalizar e exportar relatório em PDF para análise com IA"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold shadow-lg shadow-orange-500/20 transition cursor-pointer"
          >
            <FileDown className="w-3.5 h-3.5" />
            {t('exportPdfBtn')}
          </button>

          {/* UI Language Switcher */}
          <div
            title="Interface Language"
            className="flex items-center gap-1.5 bg-[#131a24] border border-slate-800 rounded-xl px-2.5 py-1.5"
          >
            <Globe2 className="w-3.5 h-3.5 text-sky-400" />
            <select
              value={uiLanguage}
              onChange={(e) => setUiLanguage(e.target.value as UiLanguage)}
              className="bg-transparent text-xs font-semibold text-slate-100 focus:outline-none cursor-pointer"
            >
              {UI_LANGUAGE_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id} className="bg-[#131a24] text-slate-100">
                  {opt.flag} {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Language Filter Bar */}
      <div className="px-6 py-2.5 border-t border-slate-800/60 bg-[#0b0f14]/60 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mr-1">
            {t('languagesLabel')}:
          </span>
          <button
            onClick={() => {
              setSelectedLanguageId('all');
              setSelectedChannelId('all');
            }}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${selectedLanguageId === 'all'
                ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40'
                : 'bg-[#131a24] text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
          >
            {t('allLabel')} ({channels.filter((c) => c.isActive).length})
          </button>

          {languages.map((lang) => {
            const count = channels.filter(
              (c) => c.isActive && c.languageId === lang.id
            ).length;
            const isSelected = selectedLanguageId === lang.id;
            return (
              <button
                key={lang.id}
                onClick={() => {
                  setSelectedLanguageId(isSelected ? 'all' : lang.id);
                  setSelectedChannelId('all');
                }}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition flex items-center gap-1.5 cursor-pointer ${isSelected
                    ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40'
                    : 'bg-[#131a24] text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
              >
                <span>{lang.flag}</span>
                <span>{lang.name}</span>
                <span className="font-mono-num text-[11px] opacity-75">({count})</span>
              </button>
            );
          })}
        </div>

        {lastSyncMessage && (
          <span className="text-xs text-emerald-400 font-medium">{lastSyncMessage}</span>
        )}
      </div>

      {/* Groups Filter Bar */}
      {groups.length > 0 && (
        <div className="px-6 py-2 border-t border-slate-800/60 bg-[#0b0f14]/80 flex items-center gap-2 flex-wrap">
          <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mr-1">
            {t('groupsLabel')}:
          </span>
          <button
            onClick={() => {
              setSelectedGroupId('all');
              setSelectedChannelId('all');
            }}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${selectedGroupId === 'all'
                ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40'
                : 'bg-[#131a24] text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
          >
            {t('allGroups')}
          </button>

          {groups.map((grp) => {
            const count = channels.filter(
              (c) => c.isActive && c.groupId === grp.id
            ).length;
            const isSelected = selectedGroupId === grp.id;
            return (
              <button
                key={grp.id}
                onClick={() => {
                  setSelectedGroupId(isSelected ? 'all' : grp.id);
                  setSelectedChannelId('all');
                }}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition flex items-center gap-1.5 cursor-pointer ${isSelected
                    ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40'
                    : 'bg-[#131a24] text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
              >
                <span>{grp.icon}</span>
                <span>{grp.name}</span>
                <span className="font-mono-num text-[11px] opacity-75">({count})</span>
              </button>
            );
          })}
        </div>
      )}
      {showExportModal && (
        <ExportReportModal onClose={() => setShowExportModal(false)} />
      )}
      {showAiModal && (
        <AiInsightsModal onClose={() => setShowAiModal(false)} />
      )}
    </header>
  );
}
