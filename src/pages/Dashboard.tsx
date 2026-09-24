import React, { useState, useEffect } from 'react';
import { Streamer } from '../types';
import { fetchAnalyticsSummary, fetchStreamers } from '../lib/api';
import { formatRupiah, formatNumber, formatPercent, formatDateIndo } from '../lib/formatters';
import {
  TrendingUp,
  ShoppingBag,
  Users,
  Package,
  Eye,
  MessageSquare,
  Calendar,
  Filter,
  ArrowUpRight,
  Sparkles,
  BarChart2,
  Clock,
  MousePointerClick,
  Percent,
  ChevronRight,
  PlusCircle,
  RefreshCw,
  Copy,
  Check,
  Target,
  Trophy,
  Award,
  Medal,
  RotateCcw,
} from 'lucide-react';
import { ResetDataModal } from '../components/ResetDataModal';

interface DashboardProps {
  onNavigate: (tab: string, params?: any) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const [streamers, setStreamers] = useState<Streamer[]>([]);
  const [selectedStreamer, setSelectedStreamer] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | 'week' | 'month' | 'custom' | 'all'>('week');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [analyticsData, setAnalyticsData] = useState<any>(null);

  // New Recommended Features:
  // 1. Metric Mode for Daily Chart: 'sales' | 'orders' | 'viewers'
  const [chartMetric, setChartMetric] = useState<'sales' | 'orders' | 'viewers'>('sales');

  // 2. Monthly Target Tracking
  const [monthlyTarget, setMonthlyTarget] = useState<number>(() => {
    const saved = localStorage.getItem('sra_monthly_target');
    return saved ? Number(saved) : 50000000; // Default Rp 50 Juta
  });
  const [isEditingTarget, setIsEditingTarget] = useState(false);
  const [targetInput, setTargetInput] = useState(String(monthlyTarget));

  // 3. WhatsApp Copy Toast
  const [copiedWA, setCopiedWA] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetNotification, setResetNotification] = useState<string | null>(null);

  // Calculate filter dates based on selection
  const getDateRange = () => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    if (dateFilter === 'today') {
      return { startDate: todayStr, endDate: todayStr };
    } else if (dateFilter === 'yesterday') {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      const yStr = y.toISOString().split('T')[0];
      return { startDate: yStr, endDate: yStr };
    } else if (dateFilter === 'week') {
      const w = new Date(today);
      w.setDate(w.getDate() - 7);
      return { startDate: w.toISOString().split('T')[0], endDate: todayStr };
    } else if (dateFilter === 'month') {
      const m = new Date(today);
      m.setDate(m.getDate() - 30);
      return { startDate: m.toISOString().split('T')[0], endDate: todayStr };
    } else if (dateFilter === 'custom') {
      return { startDate: customStart, endDate: customEnd };
    }
    return {};
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [streamersList, summary] = await Promise.all([
        fetchStreamers(),
        fetchAnalyticsSummary({
          streamer_id: selectedStreamer,
          ...getDateRange(),
        }),
      ]);
      setStreamers(streamersList);
      setAnalyticsData(summary);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedStreamer, dateFilter, customStart, customEnd]);

  const summary = analyticsData?.summary || {
    total_sales: 0,
    total_orders: 0,
    total_buyers: 0,
    total_products_sold: 0,
    total_viewers: 0,
    total_comments: 0,
    total_reports: 0,
    avg_sales_per_report: 0,
    avg_sales_per_order: 0,
    avg_watch_duration_seconds: 0,
    avg_click_rate: 0,
    avg_order_click_rate: 0,
  };

  const salesByDay: { date: string; sales: number; orders: number; buyers: number; viewers?: number }[] =
    analyticsData?.salesByDay || [];
  const salesByStreamer: { streamerId: string; streamerName: string; sales: number; orders: number }[] =
    analyticsData?.salesByStreamer || [];
  const funnel = analyticsData?.funnel || { views: 0, addToCart: 0, orders: 0, buyers: 0 };

  const formatSecToMin = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins}m ${s < 10 ? '0' : ''}${s}s`;
  };

  // Max value calculation based on selected chart metric
  const getMetricValue = (d: any) => {
    if (chartMetric === 'sales') return d.sales;
    if (chartMetric === 'orders') return d.orders;
    return d.viewers || Math.round(d.orders * 150 + 200);
  };

  const maxChartVal = Math.max(...salesByDay.map((d) => getMetricValue(d)), 1);
  const maxStreamerSales = Math.max(...salesByStreamer.map((s) => s.sales), 1);

  // Target calculation
  const targetPct = monthlyTarget > 0 ? Math.min(Math.round((summary.total_sales / monthlyTarget) * 100), 100) : 0;
  const targetDeficit = Math.max(monthlyTarget - summary.total_sales, 0);

  const saveTarget = () => {
    const num = Number(targetInput.replace(/[^0-9]/g, ''));
    if (num > 0) {
      setMonthlyTarget(num);
      localStorage.setItem('sra_monthly_target', String(num));
    }
    setIsEditingTarget(false);
  };

  // WhatsApp / Telegram formatted text copy
  const copyWhatsAppReport = () => {
    const dateLabel =
      dateFilter === 'today'
        ? 'Hari Ini'
        : dateFilter === 'yesterday'
        ? 'Kemarin'
        : dateFilter === 'week'
        ? '7 Hari Terakhir'
        : dateFilter === 'month'
        ? '30 Hari Terakhir'
        : 'Semua Waktu';

    const topStreamersList = salesByStreamer
      .slice(0, 3)
      .map((s, idx) => `${idx + 1}. *${s.streamerName}*: ${formatRupiah(s.sales)} (${s.orders} Pesanan)`)
      .join('\n');

    const text = `📊 *LAPORAN PERFORMA SHOPEE LIVE*
🏢 *SRA Live Stream Analytics*
🗓️ Periode: ${dateLabel} (${new Date().toLocaleDateString('id-ID')})
━━━━━━━━━━━━━━━━━━━━━━
💰 *Total Omzet*: ${formatRupiah(summary.total_sales)}
📦 *Total Pesanan*: ${formatNumber(summary.total_orders)}
👥 *Total Pembeli*: ${formatNumber(summary.total_buyers)}
🛍️ *Produk Terjual*: ${formatNumber(summary.total_products_sold)} item
👀 *Total Penonton*: ${formatNumber(summary.total_viewers)}
💬 *Total Komentar*: ${formatNumber(summary.total_comments)}
🎯 *AOV (Nilai/Pesanan)*: ${formatRupiah(summary.avg_sales_per_order)}
⏱️ *Durasi Rata-rata*: ${formatSecToMin(summary.avg_watch_duration_seconds)}
━━━━━━━━━━━━━━━━━━━━━━
🏆 *TOP STREAMER*:
${topStreamersList || 'Belum ada data'}

_Laporan otomatis diekstrak via Vision AI & Database SRA_`;

    navigator.clipboard.writeText(text);
    setCopiedWA(true);
    setTimeout(() => setCopiedWA(false), 3000);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner & Quick Action */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <div>
          <div className="flex items-center space-x-2 text-orange-400 text-xs font-bold tracking-wider uppercase">
            <Sparkles className="h-4 w-4" />
            <span>Pusat Monitoring Realtime</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white mt-1">
            Shopee Live Stream Performance
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">
            Analisis data harian dari ekstraksi screenshot laporan streamer Shopee Live
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={copyWhatsAppReport}
            className={`flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl font-bold text-xs border transition ${
              copiedWA
                ? 'bg-emerald-600 text-white border-emerald-500'
                : 'bg-slate-800 hover:bg-slate-750 text-emerald-400 hover:text-emerald-300 border-emerald-500/30'
            }`}
            title="Salin rekap ringkas untuk WhatsApp/Telegram grup"
          >
            {copiedWA ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            <span>{copiedWA ? 'Tersalin!' : 'Salin Rekap WA'}</span>
          </button>

          {/* Reset All Data to 0 Button */}
          <button
            onClick={() => setIsResetModalOpen(true)}
            className="flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl font-bold text-xs bg-red-950/40 hover:bg-red-900/60 text-red-300 hover:text-white border border-red-500/40 transition cursor-pointer"
            title="Reset semua data transaksi dan laporan menjadi 0"
          >
            <RotateCcw className="h-4 w-4" />
            <span>Reset Data (0)</span>
          </button>

          <button
            onClick={loadData}
            title="Muat ulang data"
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-orange-400' : ''}`} />
          </button>

          <button
            onClick={() => onNavigate('import')}
            className="flex items-center space-x-2 px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-sm rounded-xl shadow-lg shadow-orange-500/30 transition-transform active:scale-95 cursor-pointer"
          >
            <PlusCircle className="h-4 w-4" />
            <span>Import Laporan Baru</span>
          </button>
        </div>
      </div>

      {/* Notification Toast */}
      {resetNotification && (
        <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 flex items-center justify-between text-xs font-semibold animate-fadeIn">
          <div className="flex items-center space-x-2">
            <Check className="h-4 w-4 text-emerald-400" />
            <span>{resetNotification}</span>
          </div>
          <button onClick={() => setResetNotification(null)} className="text-emerald-400 hover:text-white ml-2">
            ✕
          </button>
        </div>
      )}

      {/* TARGET TRACKING WIDGET */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-orange-500/15 text-orange-400">
              <Target className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-white text-sm">Target Omzet Live Bulanan</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  {targetPct}% Tercapai
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Pencapaian: <strong className="text-orange-400">{formatRupiah(summary.total_sales)}</strong> dari target{' '}
                <strong className="text-white">{formatRupiah(monthlyTarget)}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {isEditingTarget ? (
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  value={targetInput}
                  onChange={(e) => setTargetInput(e.target.value)}
                  className="bg-slate-800 border border-slate-700 text-white text-xs px-2.5 py-1.5 rounded-lg w-32 focus:outline-none focus:border-orange-500"
                />
                <button
                  onClick={saveTarget}
                  className="px-3 py-1 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-lg"
                >
                  Simpan
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setTargetInput(String(monthlyTarget));
                  setIsEditingTarget(true);
                }}
                className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800 hover:bg-slate-750 transition"
              >
                Ubah Target
              </button>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-3">
          <div className="w-full h-3 rounded-full bg-slate-800 overflow-hidden relative">
            <div
              className="h-full rounded-full bg-gradient-to-r from-orange-500 via-amber-400 to-emerald-400 transition-all duration-700"
              style={{ width: `${targetPct}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1.5">
            <span>
              {targetDeficit > 0
                ? `Kurang ${formatRupiah(targetDeficit)} lagi untuk capai target`
                : '🎉 Selamat! Target omzet bulanan telah terlampaui!'}
            </span>
            <span className="font-semibold text-slate-300">{targetPct}% Selesai</span>
          </div>
        </div>
      </div>

      {/* Filter Control Bar */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-md space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Quick Date Presets */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-400 mr-1 flex items-center">
              <Calendar className="h-3.5 w-3.5 mr-1 text-slate-500" />
              Periode:
            </span>
            {[
              { id: 'today', label: 'Hari Ini' },
              { id: 'yesterday', label: 'Kemarin' },
              { id: 'week', label: '7 Hari Terakhir' },
              { id: 'month', label: '30 Hari Terakhir' },
              { id: 'all', label: 'Semua Waktu' },
              { id: 'custom', label: 'Rentang Kustom' },
            ].map((preset) => (
              <button
                key={preset.id}
                onClick={() => setDateFilter(preset.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  dateFilter === preset.id
                    ? 'bg-orange-500 text-white shadow-sm font-semibold'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-700/50'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Streamer Filter Dropdown */}
          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold text-slate-400 flex items-center">
              <Filter className="h-3.5 w-3.5 mr-1 text-slate-500" />
              Streamer:
            </span>
            <select
              value={selectedStreamer}
              onChange={(e) => setSelectedStreamer(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-white text-xs font-semibold rounded-lg px-3 py-1.5 focus:outline-none focus:border-orange-500"
            >
              <option value="all">Semua Streamer ({streamers.length})</option>
              {streamers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} (@{s.username})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Custom Date Range Inputs */}
        {dateFilter === 'custom' && (
          <div className="flex items-center space-x-3 pt-2 border-t border-slate-800 text-xs">
            <div className="flex items-center space-x-2">
              <span className="text-slate-400">Dari:</span>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-white rounded px-2.5 py-1"
              />
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-slate-400">Sampai:</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-white rounded px-2.5 py-1"
              />
            </div>
          </div>
        )}
      </div>

      {/* 6 Core KPI CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* TOTAL PENJUALAN */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-850 border border-slate-800 hover:border-orange-500/50 p-4 rounded-xl shadow-lg transition-all col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              TOTAL PENJUALAN
            </span>
            <div className="p-2 rounded-lg bg-orange-500/10 text-orange-400">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-white mt-2 tracking-tight">
            {formatRupiah(summary.total_sales)}
          </div>
          <div className="flex items-center justify-between mt-2 text-[11px] text-slate-400 pt-2 border-t border-slate-800">
            <span>Rata-rata sesi:</span>
            <span className="text-orange-400 font-semibold">
              {formatRupiah(summary.avg_sales_per_report)}
            </span>
          </div>
        </div>

        {/* TOTAL PESANAN */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-850 border border-slate-800 hover:border-blue-500/50 p-4 rounded-xl shadow-lg transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              TOTAL PESANAN
            </span>
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
              <ShoppingBag className="h-4 w-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-white mt-2 tracking-tight">
            {formatNumber(summary.total_orders)}
          </div>
          <div className="flex items-center justify-between mt-2 text-[11px] text-slate-400 pt-2 border-t border-slate-800">
            <span>Nilai/Pesanan (AOV):</span>
            <span className="text-blue-400 font-semibold">
              {formatRupiah(summary.avg_sales_per_order)}
            </span>
          </div>
        </div>

        {/* TOTAL PEMBELI */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-850 border border-slate-800 hover:border-emerald-500/50 p-4 rounded-xl shadow-lg transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              TOTAL PEMBELI
            </span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-white mt-2 tracking-tight">
            {formatNumber(summary.total_buyers)}
          </div>
          <div className="flex items-center justify-between mt-2 text-[11px] text-slate-400 pt-2 border-t border-slate-800">
            <span>Rasio Pembeli:</span>
            <span className="text-emerald-400 font-semibold">
              {summary.total_orders > 0
                ? ((summary.total_buyers / summary.total_orders) * 100).toFixed(0) + '%'
                : '0%'}
            </span>
          </div>
        </div>

        {/* TOTAL PRODUK TERJUAL */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-850 border border-slate-800 hover:border-purple-500/50 p-4 rounded-xl shadow-lg transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              PRODUK TERJUAL
            </span>
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
              <Package className="h-4 w-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-white mt-2 tracking-tight">
            {formatNumber(summary.total_products_sold)}
          </div>
          <div className="flex items-center justify-between mt-2 text-[11px] text-slate-400 pt-2 border-t border-slate-800">
            <span>Item / Pesanan:</span>
            <span className="text-purple-400 font-semibold">
              {summary.total_orders > 0
                ? (summary.total_products_sold / summary.total_orders).toFixed(1)
                : '0'}
            </span>
          </div>
        </div>

        {/* TOTAL PENONTON */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-850 border border-slate-800 hover:border-amber-500/50 p-4 rounded-xl shadow-lg transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              TOTAL PENONTON
            </span>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
              <Eye className="h-4 w-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-white mt-2 tracking-tight">
            {formatNumber(summary.total_viewers)}
          </div>
          <div className="flex items-center justify-between mt-2 text-[11px] text-slate-400 pt-2 border-t border-slate-800">
            <span>Total Sesi:</span>
            <span className="text-amber-400 font-semibold">
              {summary.total_reports} Laporan
            </span>
          </div>
        </div>

        {/* TOTAL KOMENTAR */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-850 border border-slate-800 hover:border-pink-500/50 p-4 rounded-xl shadow-lg transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              TOTAL KOMENTAR
            </span>
            <div className="p-2 rounded-lg bg-pink-500/10 text-pink-400">
              <MessageSquare className="h-4 w-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-white mt-2 tracking-tight">
            {formatNumber(summary.total_comments)}
          </div>
          <div className="flex items-center justify-between mt-2 text-[11px] text-slate-400 pt-2 border-t border-slate-800">
            <span>Engagement:</span>
            <span className="text-pink-400 font-semibold">
              {summary.total_viewers > 0
                ? ((summary.total_comments / summary.total_viewers) * 100).toFixed(1) + '%'
                : '0%'}
            </span>
          </div>
        </div>
      </div>

      {/* EFFICIENCY & CONVERSION SECONDARY METRICS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-900/60 border border-slate-800/80 p-4 rounded-xl">
        <div className="flex items-center space-x-3 p-2">
          <div className="p-2 rounded-lg bg-indigo-500/15 text-indigo-400">
            <Clock className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Rata-rata Durasi Tonton</div>
            <div className="text-sm font-bold text-white">
              {formatSecToMin(summary.avg_watch_duration_seconds)}
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3 p-2">
          <div className="p-2 rounded-lg bg-cyan-500/15 text-cyan-400">
            <MousePointerClick className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Rata-rata Rasio Klik</div>
            <div className="text-sm font-bold text-white">
              {formatPercent(summary.avg_click_rate)}
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3 p-2">
          <div className="p-2 rounded-lg bg-teal-500/15 text-teal-400">
            <Percent className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Pesanan per Klik</div>
            <div className="text-sm font-bold text-white">
              {formatPercent(summary.avg_order_click_rate)}
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3 p-2">
          <div className="p-2 rounded-lg bg-orange-500/15 text-orange-400">
            <BarChart2 className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Penjualan per 1k Tayang</div>
            <div className="text-sm font-bold text-white">
              {summary.total_reports > 0 && funnel.views > 0
                ? formatRupiah(Math.round((summary.total_sales / funnel.views) * 1000))
                : 'Rp 0'}
            </div>
          </div>
        </div>
      </div>

      {/* CHARTS SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* CHART 1: SALES / ORDERS / VIEWERS PER DAY WITH METRIC TOGGLE */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center">
                <TrendingUp className="h-4 w-4 mr-2 text-orange-400" />
                Tren Harian (Daily Trend)
              </h2>
              <p className="text-xs text-slate-400">
                Pilih metrik untuk menganalisis tren performa per hari
              </p>
            </div>

            {/* Toggle metric */}
            <div className="flex items-center bg-slate-800 p-1 rounded-xl border border-slate-700 text-xs">
              <button
                onClick={() => setChartMetric('sales')}
                className={`px-3 py-1 rounded-lg font-semibold transition ${
                  chartMetric === 'sales'
                    ? 'bg-orange-500 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Omzet (Rp)
              </button>
              <button
                onClick={() => setChartMetric('orders')}
                className={`px-3 py-1 rounded-lg font-semibold transition ${
                  chartMetric === 'orders'
                    ? 'bg-blue-500 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Pesanan
              </button>
              <button
                onClick={() => setChartMetric('viewers')}
                className={`px-3 py-1 rounded-lg font-semibold transition ${
                  chartMetric === 'viewers'
                    ? 'bg-amber-500 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Penonton
              </button>
            </div>
          </div>

          {salesByDay.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-500 text-sm">
              <Calendar className="h-8 w-8 mb-2 stroke-[1.5]" />
              <span>Tidak ada data laporan pada periode ini</span>
            </div>
          ) : (
            <div className="space-y-3 pt-2">
              {/* Daily Bar/Trend Visualization */}
              <div className="h-64 flex items-end justify-between gap-2 pt-8 pb-2 px-2 border-b border-slate-800">
                {salesByDay.map((d) => {
                  const val = getMetricValue(d);
                  const heightPercent = Math.max(Math.round((val / maxChartVal) * 100), 8);

                  const barColorClass =
                    chartMetric === 'sales'
                      ? 'from-orange-600 via-amber-500 to-orange-400'
                      : chartMetric === 'orders'
                      ? 'from-blue-600 via-cyan-500 to-blue-400'
                      : 'from-amber-600 via-yellow-500 to-amber-400';

                  return (
                    <div
                      key={d.date}
                      className="flex-1 flex flex-col items-center group relative h-full justify-end"
                    >
                      {/* Tooltip on hover */}
                      <div className="absolute -top-14 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none bg-slate-800 text-white text-[11px] p-2 rounded shadow-2xl border border-slate-700 whitespace-nowrap z-20">
                        <div className="font-bold text-orange-400">
                          {chartMetric === 'sales'
                            ? formatRupiah(d.sales)
                            : chartMetric === 'orders'
                            ? `${formatNumber(d.orders)} Pesanan`
                            : `${formatNumber(val)} Penonton`}
                        </div>
                        <div className="text-slate-300">
                          {d.orders} Pesanan • {d.buyers} Pembeli
                        </div>
                        <div className="text-slate-400 text-[9px]">{formatDateIndo(d.date)}</div>
                      </div>

                      {/* Bar */}
                      <div
                        style={{ height: `${heightPercent}%` }}
                        className={`w-full max-w-[48px] rounded-t-lg bg-gradient-to-t ${barColorClass} transition-all shadow-md group-hover:brightness-110`}
                      />

                      {/* Day Label */}
                      <span className="text-[10px] text-slate-400 mt-2 rotate-0 text-center font-medium truncate w-full">
                        {d.date.slice(8, 10)}/{d.date.slice(5, 7)}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between text-xs text-slate-400 px-2">
                <span>
                  Grafik: {chartMetric === 'sales' ? 'Omzet Penjualan' : chartMetric === 'orders' ? 'Jumlah Pesanan' : 'Total Penonton'}
                </span>
                <span className="text-orange-400 font-semibold">
                  Maksimal:{' '}
                  {chartMetric === 'sales'
                    ? formatRupiah(maxChartVal)
                    : `${formatNumber(maxChartVal)} ${chartMetric === 'orders' ? 'Pesanan' : 'Penonton'}`}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* CHART 2: LEADERBOARD & SALES PER STREAMER */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-white flex items-center">
                  <Trophy className="h-4 w-4 mr-2 text-amber-400" />
                  Peringkat Streamer (Leaderboard)
                </h2>
                <p className="text-xs text-slate-400">Peringkat kontribusi penjualan tertinggi</p>
              </div>
            </div>

            {salesByStreamer.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-slate-500 text-sm">
                <span>Belum ada data streamer</span>
              </div>
            ) : (
              <div className="space-y-3 pt-1">
                {salesByStreamer.map((s, idx) => {
                  const pct = Math.round((s.sales / maxStreamerSales) * 100);
                  const shareOfTotal =
                    summary.total_sales > 0
                      ? ((s.sales / summary.total_sales) * 100).toFixed(1)
                      : '0';

                  // Medals for top 3
                  const medalBadge =
                    idx === 0
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                      : idx === 1
                      ? 'bg-slate-400/20 text-slate-200 border-slate-400/50'
                      : idx === 2
                      ? 'bg-amber-700/20 text-amber-400 border-amber-700/50'
                      : 'bg-slate-800 text-slate-400 border-slate-700';

                  return (
                    <div
                      key={s.streamerId}
                      className="p-2.5 rounded-xl bg-slate-850 hover:bg-slate-800 transition cursor-pointer border border-slate-750"
                      onClick={() => onNavigate('streamer-detail', { streamerId: s.streamerId })}
                    >
                      <div className="flex items-center justify-between text-xs mb-1">
                        <div className="flex items-center space-x-2">
                          <span
                            className={`w-6 h-6 rounded-lg font-black text-xs flex items-center justify-center border ${medalBadge}`}
                          >
                            {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                          </span>
                          <span className="font-bold text-white truncate max-w-[120px]">
                            {s.streamerName}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-orange-400">{formatRupiah(s.sales)}</span>
                          <span className="text-[10px] text-slate-400 ml-1.5 font-normal">
                            ({shareOfTotal}%)
                          </span>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="w-full h-2 rounded-full bg-slate-700 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                        <span>{s.orders} Pesanan</span>
                        <span className="flex items-center text-slate-400 hover:text-white">
                          Lihat Detail <ChevronRight className="h-3 w-3 ml-0.5" />
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <button
            onClick={() => onNavigate('streamers')}
            className="w-full mt-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white rounded-xl text-xs font-semibold border border-slate-700 flex items-center justify-center space-x-1.5 transition"
          >
            <span>Kelola Semua Streamer</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* CONVERSION FUNNEL & RECENT REPORTS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Conversion Funnel */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl">
          <h2 className="text-base font-bold text-white flex items-center mb-1">
            <Percent className="h-4 w-4 mr-2 text-emerald-400" />
            Funnel Konversi Shopee Live
          </h2>
          <p className="text-xs text-slate-400 mb-4">
            Alur tayangan hingga transaksi pembelian
          </p>

          <div className="space-y-3">
            {/* Step 1: Views */}
            <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 font-medium">1. Total Dilihat (Views)</span>
                <span className="font-bold text-white text-sm">{formatNumber(funnel.views)}</span>
              </div>
              <div className="w-full h-2 bg-slate-700 rounded-full mt-2 overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full w-full" />
              </div>
            </div>

            {/* Step 2: Add to cart */}
            <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 font-medium">2. Masuk Keranjang (Cart)</span>
                <span className="font-bold text-amber-400 text-sm">
                  {formatNumber(funnel.addToCart)}
                  <span className="text-[10px] text-slate-400 font-normal ml-1">
                    ({funnel.views > 0 ? ((funnel.addToCart / funnel.views) * 100).toFixed(1) : 0}%)
                  </span>
                </span>
              </div>
              <div className="w-full h-2 bg-slate-700 rounded-full mt-2 overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full"
                  style={{
                    width: `${funnel.views > 0 ? Math.min((funnel.addToCart / funnel.views) * 100 * 5, 100) : 0}%`,
                  }}
                />
              </div>
            </div>

            {/* Step 3: Orders */}
            <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 font-medium">3. Pesanan Dibuat</span>
                <span className="font-bold text-orange-400 text-sm">
                  {formatNumber(funnel.orders)}
                  <span className="text-[10px] text-slate-400 font-normal ml-1">
                    ({funnel.addToCart > 0 ? ((funnel.orders / funnel.addToCart) * 100).toFixed(1) : 0}% dr Cart)
                  </span>
                </span>
              </div>
              <div className="w-full h-2 bg-slate-700 rounded-full mt-2 overflow-hidden">
                <div
                  className="h-full bg-orange-500 rounded-full"
                  style={{
                    width: `${funnel.addToCart > 0 ? Math.min((funnel.orders / funnel.addToCart) * 100, 100) : 0}%`,
                  }}
                />
              </div>
            </div>

            {/* Step 4: Buyers */}
            <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 font-medium">4. Pembeli Unik</span>
                <span className="font-bold text-emerald-400 text-sm">
                  {formatNumber(funnel.buyers)}
                </span>
              </div>
              <div className="w-full h-2 bg-slate-700 rounded-full mt-2 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full"
                  style={{
                    width: `${funnel.orders > 0 ? Math.min((funnel.buyers / funnel.orders) * 100, 100) : 0}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Quick Reports Link / Table */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-white flex items-center">
                  <Package className="h-4 w-4 mr-2 text-orange-400" />
                  Rangkuman Laporan Terdaftar
                </h2>
                <p className="text-xs text-slate-400">Total {summary.total_reports} sesi tersimpan di database</p>
              </div>
              <button
                onClick={() => onNavigate('reports')}
                className="text-xs text-orange-400 hover:text-orange-300 font-semibold flex items-center"
              >
                <span>Buka Tabel Lengkap</span>
                <ChevronRight className="h-4 w-4 ml-0.5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
              <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-800">
                <span className="text-xs text-slate-400">Total Sesi Live</span>
                <div className="text-lg font-bold text-white mt-1">{summary.total_reports} Sesi</div>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-800">
                <span className="text-xs text-slate-400">Nilai per Pesanan (AOV)</span>
                <div className="text-lg font-bold text-orange-400 mt-1">
                  {formatRupiah(summary.avg_sales_per_order)}
                </div>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-800">
                <span className="text-xs text-slate-400">Rata-rata Penjualan / Sesi</span>
                <div className="text-lg font-bold text-amber-400 mt-1">
                  {formatRupiah(summary.avg_sales_per_report)}
                </div>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-800">
                <span className="text-xs text-slate-400">Durasi Menonton Rata-rata</span>
                <div className="text-lg font-bold text-indigo-400 mt-1">
                  {formatSecToMin(summary.avg_watch_duration_seconds)}
                </div>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-800">
                <span className="text-xs text-slate-400">Rata-rata Rasio Komentar</span>
                <div className="text-lg font-bold text-pink-400 mt-1">
                  {summary.total_viewers > 0
                    ? ((summary.total_comments / summary.total_viewers) * 100).toFixed(2) + '%'
                    : '0%'}
                </div>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-800">
                <span className="text-xs text-slate-400">Pembeli per Pesanan</span>
                <div className="text-lg font-bold text-emerald-400 mt-1">
                  {summary.total_orders > 0
                    ? (summary.total_buyers / summary.total_orders).toFixed(2)
                    : '1.0'}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-400">
              Ingin mengekspor laporan harian ke Microsoft Excel?
            </span>
            <button
              onClick={() => onNavigate('reports')}
              className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 font-semibold rounded-lg border border-emerald-500/40 transition"
            >
              Export Excel (.xlsx)
            </button>
          </div>
        </div>
      </div>

      {/* RESET DATA MODAL */}
      <ResetDataModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        onResetComplete={(result) => {
          setResetNotification(
            `Semua data transaksi pendapatan dan laporan (${result.reportsRemoved} laporan) berhasil direset menjadi 0.`
          );
          loadData();
        }}
      />
    </div>
  );
};
