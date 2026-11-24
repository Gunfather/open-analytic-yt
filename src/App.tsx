import { StoreProvider, useStore } from './context/StoreContext';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { DashboardView } from './components/DashboardView';
import { AutonomousNicheRadar } from './components/AutonomousNicheRadar';
import { ChannelsView } from './components/ChannelsView';
import { VideosView } from './components/VideosView';
import { AnalyticsView } from './components/AnalyticsView';
import { NicheAnalysisView } from './components/NicheAnalysisView';
import { ScheduledTasksView } from './components/ScheduledTasksView';
import { SettingsView } from './components/SettingsView';

function AppShell() {
  const { activeTab } = useStore();

  return (
    <div className="min-h-screen flex bg-[#0b0f14] text-slate-100">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main className="flex-1">
          {activeTab === 'dashboard' && <DashboardView />}
          {activeTab === 'radar' && (
            <div className="p-6 max-w-[1680px] mx-auto">
              <AutonomousNicheRadar mode="full" />
            </div>
          )}
          {activeTab === 'channels' && <ChannelsView />}
          {activeTab === 'videos' && <VideosView />}
          {activeTab === 'analytics' && <AnalyticsView />}
          {activeTab === 'niche' && <NicheAnalysisView />}
          {activeTab === 'scheduled' && <ScheduledTasksView />}
          {activeTab === 'settings' && <SettingsView />}
        </main>
      </div>
    </div>
  );
}

export function App() {
  return (
    <StoreProvider>
      <AppShell />
    </StoreProvider>
  );
}

export default App;
