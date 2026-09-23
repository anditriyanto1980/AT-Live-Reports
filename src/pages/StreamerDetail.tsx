import React, { useState, useEffect } from 'react';
import { fetchStreamerAnalytics } from '../lib/api';
import { formatRupiah, formatNumber, formatDateIndo } from '../lib/formatters';
import { Streamer, LiveReport, DashboardSummary } from '../types';
import {
  ArrowLeft,
  TrendingUp,
  ShoppingBag,
  Users,
  Package,
  Eye,
  Calendar,
  Sparkles,
  BarChart3,
  CheckCircle,
  Clock,
  ChevronRight,
  Plus,
} from 'lucide-react';

interface StreamerDetailProps {
  streamerId: string;
  onNavigate: (tab: string, params?: any) => void;
}

export const StreamerDetail: React.FC<StreamerDetailProps> = ({ streamerId, onNavigate }) => {
  const [data, setData] = useState<{
    streamer: Streamer;
    reports: LiveReport[];
    summary: DashboardSummary;
    salesByDay: { date: string; sales: number; orders: number; buyers: number }[];
  } | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!streamerId) return;
    setLoading(true);
    fetchStreamerAnalytics(streamerId)
      .then((res) => {
        setData(res);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [streamerId]);

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center text-slate-400">
        <span>Memuat data analitik streamer...</span>
      </div>
    );
  }

  if (!data || !data.streamer) {
    return (
      <div className="p-8 text-center text-slate-400">
        <p>Data streamer tidak ditemukan.</p>
        <button
          onClick={() => onNavigate('streamers')}
          className="mt-4 px-4 py-2 bg-slate-800 text-white rounded-xl text-xs"
        >
          Kembali ke Daftar Streamer
        </button>
      </div>
    );
  }

  const { streamer, reports, summary, salesByDay } = data;
  const maxSales = Math.max(...salesByDay.map((d) => d.sales), 1);

  return (
    <div className="space-y-6 pb-16">
      {/* Back button & Streamer Profile Header */}
      <div className="flex items-center space-x-3">
        <button
          onClick={() => onNavigate('streamers')}
          className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <span className="text-xs text-slate-400">Kembali ke Daftar Streamer</span>
      </div>

      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-orange-600 via-amber-500 to-red-500 flex items-center justify-center text-white font-black text-2xl shadow-lg shadow-orange-500/30">
            {streamer.name.charAt(0)}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-2xl font-black text-white">{streamer.name}</h1>
              <span
                className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                  streamer.status === 'active'
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                    : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                }`}
              >
                {streamer.status === 'active' ? 'Aktif' : 'Nonaktif'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">@{streamer.username}</p>
            <p className="text-[11px] text-slate-400 mt-1">
              Bergabung sejak: {formatDateIndo(streamer.created_at.slice(0, 10))} •{' '}
              <strong className="text-slate-200">{reports.length} Sesi Terdata</strong>
            </p>
          </div>
        </div>

        <button
          onClick={() => onNavigate('import')}
          className="flex items-center space-x-2 px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-xs rounded-xl shadow-lg shadow-orange-500/25 transition cursor-pointer self-start md:self-auto"
        >
          <Plus className="h-4 w-4" />
          <span>Upload Laporan untuk Host Ini</span>
        </button>
      </div>

      {/* 6 KEY METRICS FOR THIS STREAMER */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* TOTAL SALES */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 text-[11px] uppercase font-bold">
            <span>Total Sales</span>
            <TrendingUp className="h-4 w-4 text-orange-400" />
          </div>
          <div className="text-xl font-black text-orange-400 mt-1">
            {formatRupiah(summary.total_sales)}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            Avg: {formatRupiah(summary.avg_sales_per_report)} / sesi
          </div>
        </div>

        {/* TOTAL ORDERS */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 text-[11px] uppercase font-bold">
            <span>Total Orders</span>
            <ShoppingBag className="h-4 w-4 text-blue-400" />
          </div>
          <div className="text-xl font-black text-white mt-1">
            {formatNumber(summary.total_orders)}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            AOV: {formatRupiah(summary.avg_sales_per_order)}
          </div>
        </div>

        {/* TOTAL BUYERS */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 text-[11px] uppercase font-bold">
            <span>Total Buyers</span>
            <Users className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-xl font-black text-white mt-1">
            {formatNumber(summary.total_buyers)}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">Pelanggan unik</div>
        </div>

        {/* PRODUCTS SOLD */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 text-[11px] uppercase font-bold">
            <span>Produk Terjual</span>
            <Package className="h-4 w-4 text-purple-400" />
          </div>
          <div className="text-xl font-black text-white mt-1">
            {formatNumber(summary.total_products_sold)}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">Total unit barang</div>
        </div>

        {/* TOTAL VIEWERS */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 text-[11px] uppercase font-bold">
            <span>Total Viewers</span>
            <Eye className="h-4 w-4 text-amber-400" />
          </div>
          <div className="text-xl font-black text-white mt-1">
            {formatNumber(summary.total_viewers)}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">Penonton siaran</div>
        </div>

        {/* AVERAGE SALES */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 text-[11px] uppercase font-bold">
            <span>Rata-rata Sales</span>
            <Sparkles className="h-4 w-4 text-pink-400" />
          </div>
          <div className="text-xl font-black text-white mt-1">
            {formatRupiah(summary.avg_sales_per_report)}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">Per sesi siaran</div>
        </div>
      </div>

      {/* DAILY PERFORMANCE CHART */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center">
              <BarChart3 className="h-4 w-4 mr-2 text-orange-400" />
              Performa Harian (Daily Performance)
            </h2>
            <p className="text-xs text-slate-400">Grafik omzet per sesi live stream {streamer.name}</p>
          </div>
          <span className="text-xs text-slate-400">
            {salesByDay.length} Tanggal Tercatat
          </span>
        </div>

        {salesByDay.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-slate-500 text-xs">
            Belum ada data laporan untuk streamer ini.
          </div>
        ) : (
          <div className="space-y-2 pt-2">
            <div className="h-56 flex items-end justify-between gap-3 pt-6 pb-2 px-2 border-b border-slate-800">
              {salesByDay.map((d) => {
                const heightPercent = Math.max(Math.round((d.sales / maxSales) * 100), 10);
                return (
                  <div
                    key={d.date}
                    className="flex-1 flex flex-col items-center group relative h-full justify-end"
                  >
                    {/* Tooltip */}
                    <div className="absolute -top-12 opacity-0 group-hover:opacity-100 transition pointer-events-none bg-slate-800 text-white text-[11px] p-2 rounded shadow-2xl border border-slate-700 whitespace-nowrap z-20">
                      <div className="font-bold text-orange-400">{formatRupiah(d.sales)}</div>
                      <div className="text-[9px] text-slate-300">
                        {d.orders} Pesanan • {formatDateIndo(d.date)}
                      </div>
                    </div>

                    <div
                      style={{ height: `${heightPercent}%` }}
                      className="w-full max-w-[56px] rounded-t-lg bg-gradient-to-t from-orange-600 to-amber-400 group-hover:brightness-110 transition shadow-md"
                    />

                    <span className="text-[10px] text-slate-400 mt-2 font-medium">
                      {d.date.slice(8, 10)}/{d.date.slice(5, 7)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* HISTORICAL REPORTS TABLE */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-white">Riwayat Seluruh Laporan Sesi Live</h3>
            <p className="text-xs text-slate-400">Daftar rekapan Shopee Live streamer {streamer.name}</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-800/80 text-slate-300 border-b border-slate-700 uppercase font-bold text-[10px]">
                <th className="p-3">Tanggal</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Penjualan (Sales)</th>
                <th className="p-3 text-right">Pesanan</th>
                <th className="p-3 text-right">Pembeli</th>
                <th className="p-3 text-right">Produk Terjual</th>
                <th className="p-3 text-right">Penonton</th>
                <th className="p-3 text-right">Komentar</th>
                <th className="p-3 text-center">Durasi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {reports.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-6 text-center text-slate-500">
                    Belum ada riwayat laporan untuk streamer ini.
                  </td>
                </tr>
              ) : (
                reports.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-800/40">
                    <td className="p-3 font-semibold text-white whitespace-nowrap">
                      {formatDateIndo(r.report_date)}
                    </td>
                    <td className="p-3 text-emerald-400 font-semibold">{r.order_status}</td>
                    <td className="p-3 text-right font-black text-orange-400 whitespace-nowrap">
                      {formatRupiah(r.sales)}
                    </td>
                    <td className="p-3 text-right text-slate-200">{formatNumber(r.orders)}</td>
                    <td className="p-3 text-right text-slate-200">{formatNumber(r.buyers)}</td>
                    <td className="p-3 text-right text-purple-300 font-semibold">
                      {formatNumber(r.products_sold)}
                    </td>
                    <td className="p-3 text-right text-slate-300">{formatNumber(r.viewers)}</td>
                    <td className="p-3 text-right text-slate-300">{formatNumber(r.comments)}</td>
                    <td className="p-3 text-center font-mono text-indigo-400">
                      {r.avg_watch_duration || '00:00:00'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
