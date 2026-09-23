import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { Dashboard } from './pages/Dashboard';
import { ImportReport } from './pages/ImportReport';
import { ReportsList } from './pages/ReportsList';
import { StreamersList } from './pages/StreamersList';
import { StreamerDetail } from './pages/StreamerDetail';
import { Settings } from './pages/Settings';
import { LoginPage } from './pages/LoginPage';

function MainApp() {
  const { isAuthenticated } = useAuth();
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [activeStreamerId, setActiveStreamerId] = useState<string>('');

  const handleNavigate = (tab: string, params?: any) => {
    if (tab === 'streamer-detail' && params?.streamerId) {
      setActiveStreamerId(params.streamerId);
      setCurrentTab('streamer-detail');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setCurrentTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!isAuthenticated && currentTab === 'login') {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center">
        <LoginPage onSuccess={() => setCurrentTab('dashboard')} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-orange-500 selection:text-white">
      {/* Top Navigation */}
      <Navbar currentTab={currentTab} setCurrentTab={handleNavigate} />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {currentTab === 'dashboard' && <Dashboard onNavigate={handleNavigate} />}
        {currentTab === 'import' && <ImportReport onNavigate={handleNavigate} />}
        {currentTab === 'reports' && <ReportsList onNavigate={handleNavigate} />}
        {currentTab === 'streamers' && <StreamersList onNavigate={handleNavigate} />}
        {currentTab === 'streamer-detail' && (
          <StreamerDetail streamerId={activeStreamerId} onNavigate={handleNavigate} />
        )}
        {currentTab === 'settings' && <Settings />}
        {currentTab === 'login' && <LoginPage onSuccess={() => setCurrentTab('dashboard')} />}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-850 py-6 bg-slate-900/50 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            <span className="font-bold text-slate-400">SRA LIVE STREAM ANALYTICS</span> • Sistem
            Otomatisasi Laporan Shopee Live
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-emerald-400 font-semibold">
              ✓ Hard Requirement: Screenshot tidak disimpan
            </span>
            <span>•</span>
            <span className="text-slate-400">Model Vision AI: Gemini 3.8 Flash</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}

export default App;
