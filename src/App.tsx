import { StoreProvider, useStore } from './context/StoreContext';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { DashboardView } from './components/DashboardView';
import { ChannelsView } from './components/ChannelsView';
import { VideosView } from './components/VideosView';
import { AnalyticsView } from './components/AnalyticsView';
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
          {activeTab === 'channels' && <ChannelsView />}
          {activeTab === 'videos' && <VideosView />}
          {activeTab === 'analytics' && <AnalyticsView />}
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
