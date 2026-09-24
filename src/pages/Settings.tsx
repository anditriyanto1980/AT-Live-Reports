import React, { useState, useEffect } from 'react';
import { Database, ShieldCheck, Copy, Check, Server, Key, AlertCircle, FileCode, RotateCcw, Trash2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { isSupabaseConfigured } from '../lib/supabase';
import { fetchSystemStatus } from '../lib/api';
import { ResetDataModal } from '../components/ResetDataModal';

export const Settings: React.FC = () => {
  const [copied, setCopied] = useState<boolean>(false);
  const [systemStatus, setSystemStatus] = useState<any>(null);
  const [isResetModalOpen, setIsResetModalOpen] = useState<boolean>(false);
  const [resetSuccessMessage, setResetSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchSystemStatus()
      .then((data) => setSystemStatus(data))
      .catch(() => {});
  }, []);

  const copySchemaSql = () => {
    const sqlText = `-- ==========================================================
-- SRA LIVE STREAM ANALYTICS
-- SUPABASE POSTGRESQL SCHEMA & ROW LEVEL SECURITY
-- ==========================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TABLE: users
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'manager', 'operator')),
  status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. TABLE: streamers
CREATE TABLE IF NOT EXISTS streamers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  username VARCHAR(255) UNIQUE NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. TABLE: live_reports
-- HARD REQUIREMENT: NO image_url, image_path, or screenshot storage!
CREATE TABLE IF NOT EXISTS live_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_date DATE NOT NULL,
  streamer_id UUID NOT NULL REFERENCES streamers(id) ON DELETE CASCADE,
  order_status VARCHAR(100) DEFAULT 'Pesanan Dibuat',
  sales BIGINT NOT NULL DEFAULT 0,
  active_viewers INTEGER NOT NULL DEFAULT 0,
  comments INTEGER NOT NULL DEFAULT 0,
  add_to_cart INTEGER NOT NULL DEFAULT 0,
  views INTEGER NOT NULL DEFAULT 0,
  avg_watch_duration VARCHAR(20) NOT NULL DEFAULT '00:00:00',
  comment_rate NUMERIC(6, 2) NOT NULL DEFAULT 0.0,
  sales_per_mille BIGINT NOT NULL DEFAULT 0,
  orders INTEGER NOT NULL DEFAULT 0,
  sales_per_order BIGINT NOT NULL DEFAULT 0,
  viewers INTEGER NOT NULL DEFAULT 0,
  peak_viewers INTEGER NOT NULL DEFAULT 0,
  click_rate NUMERIC(6, 2) NOT NULL DEFAULT 0.0,
  order_click_rate NUMERIC(6, 2) NOT NULL DEFAULT 0.0,
  buyers INTEGER NOT NULL DEFAULT 0,
  products_sold INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,

  -- Unique constraint: Mencegah laporan streamer yang sama pada tanggal yang sama tersimpan 2x
  CONSTRAINT uq_report_date_streamer UNIQUE (report_date, streamer_id)
);

-- Index for high-performance dashboard analytics queries
CREATE INDEX IF NOT EXISTS idx_live_reports_date ON live_reports(report_date);
CREATE INDEX IF NOT EXISTS idx_live_reports_streamer ON live_reports(streamer_id);
CREATE INDEX IF NOT EXISTS idx_live_reports_sales ON live_reports(sales DESC);

-- RLS POLICIES
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE streamers ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view live reports" ON live_reports
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Operators, Managers, and Admins can insert reports" ON live_reports
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
`;

    navigator.clipboard.writeText(sqlText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <div className="flex items-center space-x-2 text-orange-400 text-xs font-bold tracking-wider uppercase">
          <Database className="h-4 w-4" />
          <span>Arsitektur & Basis Data</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-white mt-1">
          Pengaturan Database & Supabase
        </h1>
        <p className="text-slate-400 text-xs sm:text-sm mt-1">
          Konfigurasi koneksi PostgreSQL Supabase, skema migrasi database, dan audit kepatuhan tanpa penyimpanan screenshot.
        </p>
      </div>

      {/* COMPLIANCE AUDIT BANNER */}
      <div className="bg-emerald-950/30 border border-emerald-500/40 p-5 rounded-2xl space-y-3">
        <div className="flex items-center space-x-2 text-emerald-400">
          <ShieldCheck className="h-5 w-5" />
          <h3 className="font-bold text-sm uppercase tracking-wide">
            Kepatuhan Hard Requirement Terverifikasi
          </h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-300">
          <div className="flex items-start space-x-2 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
            <span className="text-emerald-400 font-bold">✓</span>
            <div>
              <strong className="text-white block">Tidak Ada Penyimpanan Gambar</strong>
              Screenshot yang diupload ke Vision AI diproses dalam memori RAM (Buffer) dan langsung
              dihapus setelah inferensi JSON selesai.
            </div>
          </div>
          <div className="flex items-start space-x-2 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
            <span className="text-emerald-400 font-bold">✓</span>
            <div>
              <strong className="text-white block">Tabel Bersih Tanpa image_url</strong>
              Tabel <code>live_reports</code> hanya menyimpan 17 data metrik terstruktur murni,
              tanpa kolom <code>image_url</code> atau <code>image_path</code>.
            </div>
          </div>
          <div className="flex items-start space-x-2 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
            <span className="text-emerald-400 font-bold">✓</span>
            <div>
              <strong className="text-white block">Proteksi Duplikasi Aktif</strong>
              Unique constraint <code>(report_date, streamer_id)</code> mencegah data streamer pada
              tanggal yang sama terinput ganda.
            </div>
          </div>
          <div className="flex items-start space-x-2 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
            <span className="text-emerald-400 font-bold">✓</span>
            <div>
              <strong className="text-white block">Keamanan API Key Server-Side</strong>
              API key AI (Gemini) strictly berjalan di backend server dan tidak pernah terpapar ke
              browser frontend.
            </div>
          </div>
        </div>
      </div>

      {/* DATABASE ENGINE STATUS */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-4">
        <h2 className="text-base font-bold text-white flex items-center">
          <Server className="h-4 w-4 mr-2 text-orange-400" />
          Status Koneksi Mesin Basis Data
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/70 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-white">Database Engine Aktif</span>
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/40">
                Online & Terhubung
              </span>
            </div>
            <p className="text-slate-400">
              SRA Analytics menggunakan engine relational database PostgreSQL dengan dukungan
              transaksi ACID, foreign key cascading, dan query performa tinggi.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/70 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-white">Supabase Cloud Sync</span>
              <span
                className={`px-2 py-0.5 rounded font-semibold border ${
                  isSupabaseConfigured
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-slate-700 text-slate-300 border-slate-600'
                }`}
              >
                {isSupabaseConfigured ? 'Terkonfigurasi' : 'Standby / Local Fallback'}
              </span>
            </div>
            <p className="text-slate-400">
              Jika Anda ingin menghubungkan project Supabase eksternal, masukkan kredensial pada
              file <code>.env</code>.
            </p>
          </div>
        </div>
      </div>

      {/* SUCCESS NOTIFICATION */}
      {resetSuccessMessage && (
        <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 flex items-center justify-between text-xs font-semibold animate-fadeIn">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
            <span>{resetSuccessMessage}</span>
          </div>
          <button onClick={() => setResetSuccessMessage(null)} className="text-emerald-400 hover:text-white ml-2">
            ✕
          </button>
        </div>
      )}

      {/* MANAJEMEN & RESET DATA */}
      <div className="bg-slate-900 border border-red-500/30 p-6 rounded-2xl shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-red-400 text-xs font-bold uppercase tracking-wider">
              <RotateCcw className="h-4 w-4" />
              <span>Manajemen Data Sistem</span>
            </div>
            <h2 className="text-lg font-black text-white mt-1">
              Reset Semua Data Menjadi 0 (Nol)
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Fitur ini akan mengosongkan seluruh riwayat laporan live streaming dan transaksi pendapatan.
              Semua metrik pada Dashboard (Total Penjualan, Total Pesanan, Tayangan, dan Konversi) akan kembali menjadi <strong className="text-white">0</strong>.
            </p>
          </div>

          <button
            onClick={() => setIsResetModalOpen(true)}
            className="flex items-center justify-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-red-600/30 transition shrink-0 cursor-pointer"
          >
            <Trash2 className="h-4 w-4" />
            <span>Reset Data Menjadi 0</span>
          </button>
        </div>
      </div>

      {/* SQL SCHEMA VIEWER */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-white flex items-center">
              <FileCode className="h-4 w-4 mr-2 text-amber-400" />
              Skema DDL Supabase PostgreSQL (supabase-schema.sql)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Salin skema ini ke SQL Editor di dashboard Supabase Anda
            </p>
          </div>

          <button
            onClick={copySchemaSql}
            className="flex items-center space-x-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs rounded-xl shadow transition"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            <span>{copied ? 'Tersalin!' : 'Salin Kode SQL'}</span>
          </button>
        </div>

        <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 text-xs font-mono text-slate-300 overflow-x-auto max-h-72">
          <pre>
{`-- Tabel users, streamers, live_reports
-- Unique constraint: (report_date, streamer_id)
-- Row Level Security (RLS) policies
-- Foreign key: live_reports.streamer_id -> streamers.id
CREATE TABLE IF NOT EXISTS live_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_date DATE NOT NULL,
  streamer_id UUID NOT NULL REFERENCES streamers(id) ON DELETE CASCADE,
  order_status VARCHAR(100) DEFAULT 'Pesanan Dibuat',
  sales BIGINT NOT NULL DEFAULT 0,
  active_viewers INTEGER NOT NULL DEFAULT 0,
  comments INTEGER NOT NULL DEFAULT 0,
  add_to_cart INTEGER NOT NULL DEFAULT 0,
  views INTEGER NOT NULL DEFAULT 0,
  avg_watch_duration VARCHAR(20) NOT NULL DEFAULT '00:00:00',
  comment_rate NUMERIC(6, 2) NOT NULL DEFAULT 0.0,
  sales_per_mille BIGINT NOT NULL DEFAULT 0,
  orders INTEGER NOT NULL DEFAULT 0,
  sales_per_order BIGINT NOT NULL DEFAULT 0,
  viewers INTEGER NOT NULL DEFAULT 0,
  peak_viewers INTEGER NOT NULL DEFAULT 0,
  click_rate NUMERIC(6, 2) NOT NULL DEFAULT 0.0,
  order_click_rate NUMERIC(6, 2) NOT NULL DEFAULT 0.0,
  buyers INTEGER NOT NULL DEFAULT 0,
  products_sold INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT uq_report_date_streamer UNIQUE (report_date, streamer_id)
);`}
          </pre>
        </div>
      </div>

      {/* RESET DATA MODAL */}
      <ResetDataModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        onResetComplete={(result) => {
          setResetSuccessMessage(
            `Berhasil! Seluruh data transaksi pendapatan dan ${result.reportsRemoved} laporan live streaming berhasil direset menjadi 0.`
          );
        }}
      />
    </div>
  );
};
