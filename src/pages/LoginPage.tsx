import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Radio, ShieldCheck, UserCheck, ArrowRight, Sparkles, Lock, Check } from 'lucide-react';
import { UserRole } from '../types';

interface LoginPageProps {
  onSuccess: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onSuccess }) => {
  const { login, availableUsers } = useAuth();
  const [selectedRole, setSelectedRole] = useState<UserRole>('admin');

  const handleLogin = (role: UserRole) => {
    login(role);
    onSuccess();
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
        {/* Brand */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-orange-600 via-amber-500 to-red-500 flex items-center justify-center mx-auto shadow-xl shadow-orange-500/25">
            <Radio className="h-7 w-7 text-white animate-pulse" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white mt-3">
            SRA LIVE STREAM ANALYTICS
          </h1>
          <p className="text-xs text-slate-400">
            Sistem Ekstraksi OCR Vision AI & Manajemen Metrik Shopee Live
          </p>
        </div>

        {/* Role Quick Selection */}
        <div className="space-y-3">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
            Pilih Akses Masuk (Role Demo):
          </label>

          <div className="space-y-2">
            {[
              {
                role: 'admin' as UserRole,
                title: 'Administrator',
                desc: 'Akses penuh: kelola streamer, laporan CRUD, pengaturan & Supabase',
                badge: 'Full Access',
                color: 'border-purple-500/40 bg-purple-950/20 text-purple-300',
              },
              {
                role: 'manager' as UserRole,
                title: 'Live Stream Manager',
                desc: 'Akses analitik tim, review & edit laporan, kelola streamer & export',
                badge: 'Manager',
                color: 'border-blue-500/40 bg-blue-950/20 text-blue-300',
              },
              {
                role: 'operator' as UserRole,
                title: 'Live Stream Operator',
                desc: 'Upload screenshot, ekstraksi AI/OCR, validasi metrik & simpan',
                badge: 'Operator',
                color: 'border-emerald-500/40 bg-emerald-950/20 text-emerald-300',
              },
            ].map((item) => (
              <div
                key={item.role}
                onClick={() => setSelectedRole(item.role)}
                className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
                  selectedRole === item.role
                    ? 'border-orange-500 bg-orange-500/10 shadow-lg shadow-orange-500/10'
                    : 'border-slate-800 bg-slate-850 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-white text-sm">{item.title}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${item.color}`}>
                      {item.badge}
                    </span>
                  </div>
                  {selectedRole === item.role && (
                    <div className="w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center text-white">
                      <Check className="h-3 w-3 stroke-[3]" />
                    </div>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-1">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Submit */}
        <button
          onClick={() => handleLogin(selectedRole)}
          className="w-full py-3.5 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:from-orange-600 hover:to-amber-600 text-white font-black text-sm rounded-xl shadow-xl shadow-orange-500/25 flex items-center justify-center space-x-2 transition cursor-pointer"
        >
          <span>MASUK SEBAGAI {selectedRole.toUpperCase()}</span>
          <ArrowRight className="h-4 w-4" />
        </button>

        {/* Hard Requirement Compliance Note */}
        <div className="pt-2 border-t border-slate-800 text-center">
          <span className="text-[11px] text-slate-500 flex items-center justify-center space-x-1">
            <Lock className="h-3 w-3 mr-1 text-slate-500" />
            Keamanan Data: Screenshot tidak disimpan dalam database.
          </span>
        </div>
      </div>
    </div>
  );
};
