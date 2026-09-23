import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  BarChart3,
  Upload,
  FileSpreadsheet,
  Users,
  Database,
  Radio,
  UserCheck,
  ChevronDown,
  LogOut,
  ShieldAlert,
} from 'lucide-react';

interface NavbarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, setCurrentTab }) => {
  const { currentUser, switchUser, availableUsers, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'import', label: 'Import Laporan', icon: Upload, highlight: true },
    { id: 'reports', label: 'Data Laporan', icon: FileSpreadsheet },
    { id: 'streamers', label: 'Streamer', icon: Users },
    { id: 'settings', label: 'Supabase & Database', icon: Database },
  ];

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-purple-900/40 text-purple-300 border-purple-700/60';
      case 'manager':
        return 'bg-blue-900/40 text-blue-300 border-blue-700/60';
      default:
        return 'bg-emerald-900/40 text-emerald-300 border-emerald-700/60';
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur border-b border-slate-800 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setCurrentTab('dashboard')}>
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-orange-600 via-red-500 to-amber-500 flex items-center justify-center shadow-lg shadow-orange-500/20">
              <Radio className="h-5 w-5 text-white animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-black text-lg tracking-tight bg-gradient-to-r from-orange-400 via-amber-300 to-white bg-clip-text text-transparent">
                  SRA ANALYTICS
                </span>
                <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase rounded bg-red-500/20 text-red-400 border border-red-500/40 tracking-wider">
                  SHOPEE LIVE
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium hidden sm:block">
                Sistem OCR Vision AI & Manajemen Metrik
              </p>
            </div>
          </div>

          {/* Nav Items */}
          <nav className="hidden md:flex items-center space-x-1 lg:space-x-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentTab(item.id)}
                  className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-sm font-semibold transition-all ${
                    isActive
                      ? item.highlight
                        ? 'bg-orange-500 text-white shadow-md shadow-orange-500/25'
                        : 'bg-slate-800 text-orange-400 border border-slate-700'
                      : item.highlight
                      ? 'bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 border border-orange-500/30'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${isActive ? 'text-current' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* User Profile & Role Switcher */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center space-x-2.5 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 px-3 py-1.5 rounded-xl transition"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-slate-700 to-slate-600 flex items-center justify-center font-bold text-xs text-amber-300 border border-slate-600">
                {currentUser?.name.charAt(0) || 'U'}
              </div>
              <div className="text-left hidden sm:block">
                <div className="text-xs font-semibold text-slate-200">{currentUser?.name}</div>
                <div className="flex items-center space-x-1">
                  <span
                    className={`text-[10px] font-bold uppercase px-1.5 py-0.2 rounded border ${getRoleBadge(
                      currentUser?.role || 'operator'
                    )}`}
                  >
                    {currentUser?.role}
                  </span>
                </div>
              </div>
              <ChevronDown className="h-4 w-4 text-slate-400" />
            </button>

            {/* Dropdown Menu */}
            {showUserMenu && (
              <div
                className="absolute right-0 mt-2 w-64 bg-slate-850 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl py-2 z-50 text-xs"
                onMouseLeave={() => setShowUserMenu(false)}
              >
                <div className="px-3 py-2 border-b border-slate-800">
                  <p className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
                    Akun Saat Ini
                  </p>
                  <p className="font-bold text-slate-200 text-sm mt-0.5">{currentUser?.name}</p>
                  <p className="text-slate-400 truncate">{currentUser?.email}</p>
                </div>

                <div className="px-3 py-2 border-b border-slate-800">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] text-slate-400 uppercase font-semibold">
                      Ganti Role / Pengguna:
                    </span>
                    <ShieldAlert className="h-3.5 w-3.5 text-amber-400" />
                  </div>
                  <div className="space-y-1">
                    {availableUsers.map((user) => (
                      <button
                        key={user.id}
                        onClick={() => {
                          switchUser(user);
                          setShowUserMenu(false);
                        }}
                        className={`w-full flex items-center justify-between p-2 rounded-lg text-left transition ${
                          currentUser?.id === user.id
                            ? 'bg-orange-500/15 border border-orange-500/40 text-orange-300'
                            : 'hover:bg-slate-800 text-slate-300'
                        }`}
                      >
                        <div>
                          <div className="font-semibold text-slate-200">{user.name}</div>
                          <div className="text-[10px] text-slate-400">{user.email}</div>
                        </div>
                        <span
                          className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${getRoleBadge(
                            user.role
                          )}`}
                        >
                          {user.role}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="px-2 pt-1">
                  <button
                    onClick={() => {
                      logout();
                      setShowUserMenu(false);
                      setCurrentTab('login');
                    }}
                    className="w-full flex items-center space-x-2 px-3 py-2 text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Keluar (Logout)</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Nav Bar */}
      <div className="md:hidden border-t border-slate-800 px-2 py-2 flex justify-around bg-slate-900">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentTab(item.id)}
              className={`flex flex-col items-center py-1 px-2 rounded-md text-[10px] font-medium transition ${
                isActive ? 'text-orange-400 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="h-4 w-4 mb-0.5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </header>
  );
};
