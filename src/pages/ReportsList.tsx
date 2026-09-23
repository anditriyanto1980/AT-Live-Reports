import React, { useState, useEffect } from 'react';
import { LiveReport, Streamer } from '../types';
import { fetchReports, fetchStreamers, deleteReport, updateReport } from '../lib/api';
import { formatRupiah, formatNumber, formatDateIndo, formatPercent } from '../lib/formatters';
import { exportReportsToExcel } from '../lib/excelExport';
import { useAuth } from '../context/AuthContext';
import {
  FileSpreadsheet,
  Search,
  Filter,
  Download,
  Edit2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Plus,
  RefreshCw,
  X,
  Save,
  AlertTriangle,
  Eye,
  CheckCircle,
  Copy,
  Check,
  FileText,
} from 'lucide-react';

interface ReportsListProps {
  onNavigate: (tab: string, params?: any) => void;
}

export const ReportsList: React.FC<ReportsListProps> = ({ onNavigate }) => {
  const { canEditReports, canDeleteReports } = useAuth();

  const [reports, setReports] = useState<LiveReport[]>([]);
  const [streamers, setStreamers] = useState<Streamer[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterStreamerId, setFilterStreamerId] = useState<string>('all');
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');

  // Sorting
  const [sortBy, setSortBy] = useState<string>('report_date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Detail View Modal
  const [viewingReport, setViewingReport] = useState<LiveReport | null>(null);

  // Edit Modal State
  const [editingReport, setEditingReport] = useState<LiveReport | null>(null);
  const [editForm, setEditForm] = useState<Partial<LiveReport>>({});
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Delete Modal State
  const [deletingReport, setDeletingReport] = useState<LiveReport | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Toast
  const [notification, setNotification] = useState<string | null>(null);
  const [copiedRowId, setCopiedRowId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [streamersList, reportsList] = await Promise.all([
        fetchStreamers(),
        fetchReports({
          streamer_id: filterStreamerId,
          startDate: filterStartDate,
          endDate: filterEndDate,
          search: searchQuery,
          sortBy,
          sortOrder,
        }),
      ]);
      setStreamers(streamersList);
      setReports(reportsList);
    } catch (err) {
      console.error('Failed to load reports:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filterStreamerId, filterStartDate, filterEndDate, sortBy, sortOrder]);

  // Handle client-side search debounce / immediate
  useEffect(() => {
    const handler = setTimeout(() => {
      loadData();
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  // Pagination calculation
  const totalItems = reports.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedReports = reports.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Open Edit Modal
  const openEditModal = (report: LiveReport) => {
    setEditingReport(report);
    setEditForm({ ...report });
    setEditError(null);
  };

  const handleSaveEdit = async () => {
    if (!editingReport) return;
    setIsSavingEdit(true);
    setEditError(null);
    try {
      await updateReport(editingReport.id, editForm);
      setEditingReport(null);
      setNotification('Laporan berhasil diperbarui.');
      loadData();
    } catch (err: any) {
      setEditError(err.message || 'Gagal memperbarui laporan.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Handle Delete
  const confirmDelete = async () => {
    if (!deletingReport) return;
    setIsDeleting(true);
    try {
      await deleteReport(deletingReport.id);
      setDeletingReport(null);
      setNotification('Laporan berhasil dihapus.');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus laporan.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Excel Export
  const handleExportExcel = () => {
    exportReportsToExcel(reports, `Laporan_Shopee_Live_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // CSV Export
  const handleExportCSV = () => {
    const headers = [
      'Tanggal',
      'Streamer',
      'Username',
      'Status Pesanan',
      'Penjualan (Rp)',
      'Total Pesanan',
      'Total Pembeli',
      'Produk Terjual',
      'Total Penonton',
      'Penonton Aktif',
      'Penonton Tertinggi',
      'Durasi Menonton',
      'Total Komentar',
      'Rasio Komentar (%)',
      'Tambah ke Keranjang',
      'Dilihat (Views)',
      'Rasio Klik (%)',
      'Pesanan per Klik (%)',
      'Penjualan per Mil (Rp)',
      'Nilai per Pesanan (Rp)',
    ];

    const rows = reports.map((r) => [
      `"${r.report_date}"`,
      `"${r.streamer?.name || '-'}"`,
      `"${r.streamer?.username || '-'}"`,
      `"${r.order_status || 'Pesanan Dibuat'}"`,
      r.sales,
      r.orders,
      r.buyers,
      r.products_sold,
      r.viewers,
      r.active_viewers,
      r.peak_viewers,
      `"${r.avg_watch_duration}"`,
      r.comments,
      r.comment_rate,
      r.add_to_cart,
      r.views,
      r.click_rate,
      r.order_click_rate,
      r.sales_per_mille,
      r.sales_per_order,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Laporan_Shopee_Live_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Copy single session to WhatsApp
  const copySessionWA = (report: LiveReport) => {
    const text = `📊 *LAPORAN LIVE SHOPEE*
🗓️ Tanggal: ${formatDateIndo(report.report_date)}
👤 Streamer: *${report.streamer?.name}* (@${report.streamer?.username})
━━━━━━━━━━━━━━━━━━
💰 *Omzet*: ${formatRupiah(report.sales)}
📦 *Pesanan*: ${formatNumber(report.orders)}
👥 *Pembeli*: ${formatNumber(report.buyers)}
🛍️ *Produk*: ${formatNumber(report.products_sold)} item
👀 *Penonton*: ${formatNumber(report.viewers)} (Puncak: ${formatNumber(report.peak_viewers)})
⏱️ *Durasi Tonton*: ${report.avg_watch_duration}
💬 *Komentar*: ${formatNumber(report.comments)} (${formatPercent(report.comment_rate)})
🎯 *AOV*: ${formatRupiah(report.sales_per_order)}
🛒 *Masuk Keranjang*: ${formatNumber(report.add_to_cart)}
📈 *Rasio Klik*: ${formatPercent(report.click_rate)}
━━━━━━━━━━━━━━━━━━
_SRA Live Stream Analytics_`;

    navigator.clipboard.writeText(text);
    setCopiedRowId(report.id);
    setTimeout(() => setCopiedRowId(null), 2500);
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <div>
          <div className="flex items-center space-x-2 text-orange-400 text-xs font-bold tracking-wider uppercase">
            <FileSpreadsheet className="h-4 w-4" />
            <span>Database Terstruktur</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white mt-1">Data Laporan Shopee Live</h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">
            Kelola, cari, filter, edit, dan export data performa harian seluruh streamer
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleExportCSV}
            className="flex items-center space-x-2 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white font-bold text-xs sm:text-sm rounded-xl border border-slate-700 transition cursor-pointer"
            title="Download CSV"
          >
            <FileText className="h-4 w-4 text-sky-400" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={handleExportExcel}
            className="flex items-center space-x-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm rounded-xl shadow-lg shadow-emerald-600/20 transition cursor-pointer"
          >
            <Download className="h-4 w-4" />
            <span>Export Excel (.xlsx)</span>
          </button>
          <button
            onClick={() => onNavigate('import')}
            className="flex items-center space-x-2 px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-xs sm:text-sm rounded-xl shadow-lg shadow-orange-500/25 transition cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Tambah Laporan</span>
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      {notification && (
        <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 flex items-center justify-between text-xs font-semibold animate-fadeIn">
          <div className="flex items-center space-x-2">
            <CheckCircle className="h-4 w-4 text-emerald-400" />
            <span>{notification}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-emerald-400 hover:text-white">
            ✕
          </button>
        </div>
      )}

      {/* FILTER & SEARCH BAR */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-md space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search text */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <input
              type="text"
              placeholder="Cari tanggal / streamer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-orange-500"
            />
          </div>

          {/* Streamer Filter */}
          <div>
            <select
              value={filterStreamerId}
              onChange={(e) => setFilterStreamerId(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-orange-500"
            >
              <option value="all">Semua Streamer</option>
              {streamers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} (@{s.username})
                </option>
              ))}
            </select>
          </div>

          {/* Start Date */}
          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-400 whitespace-nowrap">Dari:</span>
            <input
              type="date"
              value={filterStartDate}
              onChange={(e) => setFilterStartDate(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-2.5 py-1.5 text-xs focus:outline-none"
            />
          </div>

          {/* End Date */}
          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-400 whitespace-nowrap">Sampai:</span>
            <input
              type="date"
              value={filterEndDate}
              onChange={(e) => setFilterEndDate(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-2.5 py-1.5 text-xs focus:outline-none"
            />
          </div>
        </div>

        {/* Active Filter Indicators & Reset */}
        {(searchQuery || filterStreamerId !== 'all' || filterStartDate || filterEndDate) && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
            <span className="text-slate-400">
              Menampilkan {reports.length} data laporan sesuai filter
            </span>
            <button
              onClick={() => {
                setSearchQuery('');
                setFilterStreamerId('all');
                setFilterStartDate('');
                setFilterEndDate('');
              }}
              className="text-orange-400 hover:text-orange-300 font-semibold"
            >
              Reset Semua Filter
            </button>
          </div>
        )}
      </div>

      {/* DATA TABLE */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-800/80 text-slate-300 border-b border-slate-700 uppercase tracking-wider font-bold text-[11px]">
                <th
                  onClick={() => handleSort('report_date')}
                  className="p-3.5 cursor-pointer hover:text-white"
                >
                  <div className="flex items-center space-x-1">
                    <span>Tanggal</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('streamer')}
                  className="p-3.5 cursor-pointer hover:text-white"
                >
                  <div className="flex items-center space-x-1">
                    <span>Streamer</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('sales')}
                  className="p-3.5 cursor-pointer hover:text-white text-right"
                >
                  <div className="flex items-center justify-end space-x-1">
                    <span>Penjualan (Sales)</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('orders')}
                  className="p-3.5 cursor-pointer hover:text-white text-right"
                >
                  <div className="flex items-center justify-end space-x-1">
                    <span>Pesanan</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('buyers')}
                  className="p-3.5 cursor-pointer hover:text-white text-right"
                >
                  <div className="flex items-center justify-end space-x-1">
                    <span>Pembeli</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('products_sold')}
                  className="p-3.5 cursor-pointer hover:text-white text-right"
                >
                  <div className="flex items-center justify-end space-x-1">
                    <span>Produk Terjual</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('viewers')}
                  className="p-3.5 cursor-pointer hover:text-white text-right"
                >
                  <div className="flex items-center justify-end space-x-1">
                    <span>Penonton</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('comments')}
                  className="p-3.5 cursor-pointer hover:text-white text-right"
                >
                  <div className="flex items-center justify-end space-x-1">
                    <span>Komentar</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th className="p-3.5 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-orange-400" />
                    <span>Memuat data laporan...</span>
                  </td>
                </tr>
              ) : paginatedReports.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-500">
                    Tidak ada data laporan yang cocok.
                  </td>
                </tr>
              ) : (
                paginatedReports.map((report) => (
                  <tr key={report.id} className="hover:bg-slate-800/40 transition">
                    {/* Tanggal */}
                    <td className="p-3.5 font-semibold text-white whitespace-nowrap">
                      {formatDateIndo(report.report_date)}
                    </td>

                    {/* Streamer */}
                    <td className="p-3.5 whitespace-nowrap">
                      <div
                        onClick={() =>
                          onNavigate('streamer-detail', { streamerId: report.streamer_id })
                        }
                        className="cursor-pointer group"
                      >
                        <span className="font-bold text-slate-200 group-hover:text-orange-400 transition">
                          {report.streamer?.name || '-'}
                        </span>
                        <span className="text-[10px] text-slate-400 block">
                          @{report.streamer?.username}
                        </span>
                      </div>
                    </td>

                    {/* Sales */}
                    <td className="p-3.5 text-right font-black text-orange-400 whitespace-nowrap text-sm">
                      {formatRupiah(report.sales)}
                    </td>

                    {/* Orders */}
                    <td className="p-3.5 text-right font-semibold text-slate-200">
                      {formatNumber(report.orders)}
                    </td>

                    {/* Buyers */}
                    <td className="p-3.5 text-right font-semibold text-slate-200">
                      {formatNumber(report.buyers)}
                    </td>

                    {/* Products Sold */}
                    <td className="p-3.5 text-right font-semibold text-purple-300">
                      {formatNumber(report.products_sold)}
                    </td>

                    {/* Viewers */}
                    <td className="p-3.5 text-right text-slate-300">
                      {formatNumber(report.viewers)}
                    </td>

                    {/* Comments */}
                    <td className="p-3.5 text-right text-slate-300">
                      {formatNumber(report.comments)}
                    </td>

                    {/* Actions */}
                    <td className="p-3.5 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center space-x-1">
                        {/* View 17 Metrics */}
                        <button
                          onClick={() => setViewingReport(report)}
                          title="Lihat 17 Metrik Lengkap"
                          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
                        >
                          <Eye className="h-4 w-4" />
                        </button>

                        {/* WhatsApp Single Row Copy */}
                        <button
                          onClick={() => copySessionWA(report)}
                          title="Salin Ringkasan untuk WhatsApp"
                          className={`p-1.5 rounded-lg transition ${
                            copiedRowId === report.id
                              ? 'text-emerald-400 bg-emerald-500/20'
                              : 'text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10'
                          }`}
                        >
                          {copiedRowId === report.id ? (
                            <Check className="h-4 w-4" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </button>

                        {canEditReports && (
                          <button
                            onClick={() => openEditModal(report)}
                            title="Edit Laporan"
                            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                        )}

                        {canDeleteReports && (
                          <button
                            onClick={() => setDeletingReport(report)}
                            title="Hapus Laporan"
                            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION CONTROLS */}
        <div className="p-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center space-x-2">
            <span>Tampilkan</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-slate-800 border border-slate-700 text-white rounded px-2 py-1"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
            <span>dari total {totalItems} laporan</span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-white font-semibold">
              Halaman {currentPage} dari {totalPages}
            </span>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* VIEW MODAL: ALL 17 METRICS */}
      {viewingReport && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-orange-400">
                  Rincian 17 Metrik Shopee Live
                </span>
                <h3 className="font-black text-xl text-white">
                  {viewingReport.streamer?.name} (@{viewingReport.streamer?.username})
                </h3>
                <p className="text-xs text-slate-400">
                  Tanggal: {formatDateIndo(viewingReport.report_date)} • Status: {viewingReport.order_status}
                </p>
              </div>
              <button
                onClick={() => setViewingReport(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Section 1: Financial & Sales */}
            <div>
              <h4 className="text-xs font-bold text-orange-400 uppercase tracking-wider mb-2">
                1. Penjualan & Pesanan
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                <div className="p-3 bg-slate-850 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block text-[11px]">Penjualan</span>
                  <strong className="text-orange-400 text-base font-black">
                    {formatRupiah(viewingReport.sales)}
                  </strong>
                </div>
                <div className="p-3 bg-slate-850 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block text-[11px]">Total Pesanan</span>
                  <strong className="text-white text-base font-bold">
                    {formatNumber(viewingReport.orders)}
                  </strong>
                </div>
                <div className="p-3 bg-slate-850 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block text-[11px]">Nilai/Pesanan (AOV)</span>
                  <strong className="text-amber-400 text-sm font-bold">
                    {formatRupiah(viewingReport.sales_per_order)}
                  </strong>
                </div>
                <div className="p-3 bg-slate-850 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block text-[11px]">Penjualan per Mil (SPM)</span>
                  <strong className="text-emerald-400 text-sm font-bold">
                    {formatRupiah(viewingReport.sales_per_mille)}
                  </strong>
                </div>
              </div>
            </div>

            {/* Section 2: Conversion & Products */}
            <div>
              <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-2">
                2. Konversi & Produk
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs">
                <div className="p-3 bg-slate-850 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block text-[11px]">Total Pembeli</span>
                  <strong className="text-white text-sm font-bold">
                    {formatNumber(viewingReport.buyers)}
                  </strong>
                </div>
                <div className="p-3 bg-slate-850 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block text-[11px]">Produk Terjual</span>
                  <strong className="text-purple-300 text-sm font-bold">
                    {formatNumber(viewingReport.products_sold)}
                  </strong>
                </div>
                <div className="p-3 bg-slate-850 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block text-[11px]">Masuk Keranjang</span>
                  <strong className="text-amber-300 text-sm font-bold">
                    {formatNumber(viewingReport.add_to_cart)}
                  </strong>
                </div>
                <div className="p-3 bg-slate-850 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block text-[11px]">Rasio Klik</span>
                  <strong className="text-cyan-400 text-sm font-bold">
                    {formatPercent(viewingReport.click_rate)}
                  </strong>
                </div>
                <div className="p-3 bg-slate-850 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block text-[11px]">Pesanan per Klik</span>
                  <strong className="text-teal-400 text-sm font-bold">
                    {formatPercent(viewingReport.order_click_rate)}
                  </strong>
                </div>
              </div>
            </div>

            {/* Section 3: Audience & Engagement */}
            <div>
              <h4 className="text-xs font-bold text-pink-400 uppercase tracking-wider mb-2">
                3. Penonton & Interaksi
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                <div className="p-3 bg-slate-850 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block text-[11px]">Total Penonton</span>
                  <strong className="text-white text-sm font-bold">
                    {formatNumber(viewingReport.viewers)}
                  </strong>
                </div>
                <div className="p-3 bg-slate-850 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block text-[11px]">Penonton Tertinggi</span>
                  <strong className="text-amber-400 text-sm font-bold">
                    {formatNumber(viewingReport.peak_viewers)}
                  </strong>
                </div>
                <div className="p-3 bg-slate-850 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block text-[11px]">Penonton Aktif</span>
                  <strong className="text-slate-300 text-sm font-bold">
                    {formatNumber(viewingReport.active_viewers)}
                  </strong>
                </div>
                <div className="p-3 bg-slate-850 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block text-[11px]">Durasi Tonton Rata-rata</span>
                  <strong className="text-indigo-400 text-sm font-bold font-mono">
                    {viewingReport.avg_watch_duration}
                  </strong>
                </div>
                <div className="p-3 bg-slate-850 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block text-[11px]">Total Komentar</span>
                  <strong className="text-pink-400 text-sm font-bold">
                    {formatNumber(viewingReport.comments)}
                  </strong>
                </div>
                <div className="p-3 bg-slate-850 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block text-[11px]">Rasio Komentar</span>
                  <strong className="text-pink-300 text-sm font-bold">
                    {formatPercent(viewingReport.comment_rate)}
                  </strong>
                </div>
                <div className="p-3 bg-slate-850 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block text-[11px]">Total Dilihat (Views)</span>
                  <strong className="text-slate-300 text-sm font-bold">
                    {formatNumber(viewingReport.views)}
                  </strong>
                </div>
                <div className="p-3 bg-slate-850 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block text-[11px]">Status Laporan</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40 text-[10px]">
                    {viewingReport.order_status}
                  </span>
                </div>
              </div>
            </div>

            {/* Actions in Modal */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <button
                onClick={() => copySessionWA(viewingReport)}
                className="flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow transition"
              >
                <Copy className="h-4 w-4" />
                <span>Salin Rekap WhatsApp</span>
              </button>

              <button
                onClick={() => setViewingReport(null)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editingReport && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-black text-lg text-white">Edit Data Laporan</h3>
                <p className="text-xs text-slate-400">
                  {editingReport.streamer?.name} • {formatDateIndo(editingReport.report_date)}
                </p>
              </div>
              <button
                onClick={() => setEditingReport(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {editError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs rounded-xl">
                {editError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="font-semibold text-slate-400 block mb-1">Status Pesanan</label>
                <input
                  type="text"
                  value={editForm.order_status || ''}
                  onChange={(e) => setEditForm({ ...editForm, order_status: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white font-semibold"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-400 block mb-1">Penjualan (Rp)</label>
                <input
                  type="number"
                  value={editForm.sales ?? 0}
                  onChange={(e) => setEditForm({ ...editForm, sales: Number(e.target.value) })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-orange-400 font-bold"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-400 block mb-1">Total Pesanan</label>
                <input
                  type="number"
                  value={editForm.orders ?? 0}
                  onChange={(e) => setEditForm({ ...editForm, orders: Number(e.target.value) })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-400 block mb-1">Total Pembeli</label>
                <input
                  type="number"
                  value={editForm.buyers ?? 0}
                  onChange={(e) => setEditForm({ ...editForm, buyers: Number(e.target.value) })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-400 block mb-1">Produk Terjual</label>
                <input
                  type="number"
                  value={editForm.products_sold ?? 0}
                  onChange={(e) => setEditForm({ ...editForm, products_sold: Number(e.target.value) })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-400 block mb-1">Penonton (Viewers)</label>
                <input
                  type="number"
                  value={editForm.viewers ?? 0}
                  onChange={(e) => setEditForm({ ...editForm, viewers: Number(e.target.value) })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-400 block mb-1">Komentar</label>
                <input
                  type="number"
                  value={editForm.comments ?? 0}
                  onChange={(e) => setEditForm({ ...editForm, comments: Number(e.target.value) })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-400 block mb-1">Durasi Menonton</label>
                <input
                  type="text"
                  value={editForm.avg_watch_duration || '00:00:00'}
                  onChange={(e) => setEditForm({ ...editForm, avg_watch_duration: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white font-mono"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => setEditingReport(null)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold hover:bg-slate-700"
              >
                Batal
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={isSavingEdit}
                className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5"
              >
                <Save className="h-4 w-4" />
                <span>{isSavingEdit ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingReport && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 text-rose-400">
              <AlertTriangle className="h-6 w-6" />
              <h3 className="font-bold text-base text-white">Konfirmasi Hapus Laporan</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Apakah Anda yakin ingin menghapus laporan streamer{' '}
              <strong className="text-white">{deletingReport.streamer?.name}</strong> pada tanggal{' '}
              <strong className="text-white">{formatDateIndo(deletingReport.report_date)}</strong>?
              Data ini akan terhapus permanen dari database.
            </p>
            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                onClick={() => setDeletingReport(null)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold hover:bg-slate-700"
              >
                Batal
              </button>
              <button
                onClick={confirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold"
              >
                {isDeleting ? 'Menghapus...' : 'Hapus Laporan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
