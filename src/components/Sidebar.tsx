import {
  Activity,
  BarChart3,
  CalendarClock,
  Compass,
  Globe2,
  LayoutDashboard,
  PlaySquare,
  Radio,
  Settings,
  Tv2,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { NavTab } from '../types/youtube';

const NAV_ITEMS: Array<{ id: NavTab; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'channels', label: 'Gerenciar Canais', icon: Tv2 },
  { id: 'videos', label: 'Vídeos', icon: PlaySquare },
  { id: 'analytics', label: 'Analytics de Vídeo', icon: BarChart3 },
  { id: 'niche', label: 'Análise de Nicho', icon: Compass },
  { id: 'scheduled', label: 'Tarefas Agendadas', icon: CalendarClock },
  { id: 'settings', label: 'Configurações & API', icon: Settings },
];

export function Sidebar() {
  const { activeTab, setActiveTab, channels, competitors, languages, apiKey, t } = useStore();
  const activeChannelsCount = channels.filter((c) => c.isActive).length;

  const navLabels: Record<NavTab, string> = {
    dashboard: t('navDashboard'),
    channels: t('navChannels'),
    videos: t('navVideos'),
    analytics: t('navAnalytics'),
    niche: t('navNiche'),
    scheduled: t('navScheduled'),
    settings: t('navSettings'),
  };

  return (
    <aside className="w-64 shrink-0 border-r border-slate-800/80 bg-[#0e131a] flex flex-col justify-between min-h-screen sticky top-0">
      <div>
        {/* Brand */}
        <div className="h-16 px-5 flex items-center gap-3 border-b border-slate-800/80">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-lg shadow-orange-500/20">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-bold text-sm tracking-tight text-white flex items-center gap-1.5">
              Open Analytic YT
              <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-400 border border-orange-500/30">
                v2.0
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Multi-Channel Monitor</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="p-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                  isActive
                    ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                }`}
              >
                <span className="flex items-center gap-3">
                  <Icon className="w-4 h-4 shrink-0" />
                  {navLabels[item.id]}
                </span>
                {item.id === 'channels' && (
                  <span
                    className={`text-[11px] font-mono-num px-1.5 py-0.5 rounded-md ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {activeChannelsCount}/{channels.length}
                  </span>
                )}
                {item.id === 'niche' && (
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-purple-500/20 text-purple-300'
                    }`}
                  >
                    {competitors.length > 0 ? `${competitors.length} radar` : 'NEW'}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Network Status */}
      <div className="p-4 m-3 rounded-xl bg-[#131a24] border border-slate-800/80 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
            <Globe2 className="w-3.5 h-3.5 text-orange-400" />
            {t('globalNetwork')}
          </span>
          <span className="text-[11px] font-mono-num text-emerald-400 flex items-center gap-1">
            <Radio className="w-3 h-3 animate-pulse" />
            {t('online')}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="rounded-lg bg-[#0b0f14] p-2 border border-slate-800/70">
            <div className="text-sm font-bold font-mono-num text-white">
              {channels.length}
            </div>
            <div className="text-[10px] text-slate-400">{t('channelsCount')}</div>
          </div>
          <div className="rounded-lg bg-[#0b0f14] p-2 border border-slate-800/70">
            <div className="text-sm font-bold font-mono-num text-white">
              {languages.length}
            </div>
            <div className="text-[10px] text-slate-400">{t('languagesCount')}</div>
          </div>
        </div>

        <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-800/70">
          <span>{t('source')}:</span>
          <span className={apiKey ? 'text-emerald-400 font-medium' : 'text-amber-400 font-medium'}>
            {apiKey ? 'YouTube API v3' : t('demoMode')}
          </span>
        </div>
      </div>
    </aside>
  );
}
