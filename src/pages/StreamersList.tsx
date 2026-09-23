import React, { useState, useEffect } from 'react';
import { Streamer } from '../types';
import { fetchStreamers, createStreamer, updateStreamer, deleteStreamer, fetchReports } from '../lib/api';
import { formatRupiah } from '../lib/formatters';
import { useAuth } from '../context/AuthContext';
import {
  Users,
  Plus,
  Edit2,
  Trash2,
  CheckCircle,
  XCircle,
  ArrowUpRight,
  Search,
  X,
  Save,
  Radio,
  Sparkles,
} from 'lucide-react';

interface StreamersListProps {
  onNavigate: (tab: string, params?: any) => void;
}

export const StreamersList: React.FC<StreamersListProps> = ({ onNavigate }) => {
  const { canManageStreamers } = useAuth();
  const [streamers, setStreamers] = useState<Streamer[]>([]);
  const [search, setSearch] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  // Performance stats map: streamerId -> { count: number, totalSales: number }
  const [statsMap, setStatsMap] = useState<Record<string, { count: number; totalSales: number }>>({});

  // Add / Edit modal state
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingStreamer, setEditingStreamer] = useState<Streamer | null>(null);
  const [formName, setFormName] = useState<string>('');
  const [formUsername, setFormUsername] = useState<string>('');
  const [formStatus, setFormStatus] = useState<'active' | 'inactive'>('active');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Delete modal
  const [deletingStreamer, setDeletingStreamer] = useState<Streamer | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [list, reports] = await Promise.all([fetchStreamers(), fetchReports()]);
      setStreamers(list);

      // Build stats
      const stats: Record<string, { count: number; totalSales: number }> = {};
      for (const r of reports) {
        if (!stats[r.streamer_id]) {
          stats[r.streamer_id] = { count: 0, totalSales: 0 };
        }
        stats[r.streamer_id].count += 1;
        stats[r.streamer_id].totalSales += Number(r.sales) || 0;
      }
      setStatsMap(stats);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openAddModal = () => {
    setEditingStreamer(null);
    setFormName('');
    setFormUsername('');
    setFormStatus('active');
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (streamer: Streamer) => {
    setEditingStreamer(streamer);
    setFormName(streamer.name);
    setFormUsername(streamer.username);
    setFormStatus(streamer.status);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formUsername.trim()) {
      setFormError('Nama dan Username Shopee wajib diisi.');
      return;
    }

    setIsSaving(true);
    setFormError(null);

    try {
      if (editingStreamer) {
        await updateStreamer(editingStreamer.id, {
          name: formName,
          username: formUsername,
          status: formStatus,
        });
      } else {
        await createStreamer({
          name: formName,
          username: formUsername,
          status: formStatus,
        });
      }
      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      setFormError(err.message || 'Gagal menyimpan streamer.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async (streamer: Streamer) => {
    const newStatus = streamer.status === 'active' ? 'inactive' : 'active';
    try {
      await updateStreamer(streamer.id, { status: newStatus });
      loadData();
    } catch (err: any) {
      alert(err.message || 'Gagal mengubah status streamer.');
    }
  };

  const handleDelete = async () => {
    if (!deletingStreamer) return;
    try {
      await deleteStreamer(deletingStreamer.id);
      setDeletingStreamer(null);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus streamer.');
    }
  };

  const filtered = streamers.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.username.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <div>
          <div className="flex items-center space-x-2 text-orange-400 text-xs font-bold tracking-wider uppercase">
            <Users className="h-4 w-4" />
            <span>Manajemen Host & Streamer</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white mt-1">Daftar Streamer Shopee Live</h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">
            Kelola data akun live streamer, pantau performa omzet, dan aktifkan/nonaktifkan host
          </p>
        </div>

        {canManageStreamers && (
          <button
            onClick={openAddModal}
            className="flex items-center space-x-2 px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-xs sm:text-sm rounded-xl shadow-lg shadow-orange-500/25 transition cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Tambah Streamer Baru</span>
          </button>
        )}
      </div>

      {/* Search Bar */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-md flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Cari nama atau username streamer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-orange-500"
          />
        </div>
        <span className="text-xs text-slate-400">Total: {filtered.length} Streamer</span>
      </div>

      {/* STREAMERS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((streamer) => {
          const stats = statsMap[streamer.id] || { count: 0, totalSales: 0 };
          const isActive = streamer.status === 'active';

          return (
            <div
              key={streamer.id}
              className="bg-slate-900 border border-slate-800 hover:border-slate-700 p-5 rounded-2xl shadow-xl flex flex-col justify-between transition-all"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-slate-800 to-slate-700 flex items-center justify-center text-orange-400 font-black text-lg border border-slate-700">
                      {streamer.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-base leading-snug">{streamer.name}</h3>
                      <p className="text-xs text-slate-400">@{streamer.username}</p>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                      isActive
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                    }`}
                  >
                    {isActive ? 'Aktif' : 'Nonaktif'}
                  </span>
                </div>

                {/* Performance Summary Cards */}
                <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-slate-800 text-xs">
                  <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-750">
                    <span className="text-[10px] text-slate-400 block">Total Sesi Live</span>
                    <span className="font-extrabold text-white text-sm">{stats.count} Sesi</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-750">
                    <span className="text-[10px] text-slate-400 block">Total Omzet</span>
                    <span className="font-extrabold text-orange-400 text-sm">
                      {formatRupiah(stats.totalSales)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-5 pt-3 border-t border-slate-800 flex items-center justify-between">
                <button
                  onClick={() => onNavigate('streamer-detail', { streamerId: streamer.id })}
                  className="text-xs text-orange-400 hover:text-orange-300 font-bold flex items-center space-x-1"
                >
                  <span>Analisis Detail</span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </button>

                {canManageStreamers && (
                  <div className="flex items-center space-x-1.5">
                    <button
                      onClick={() => handleToggleStatus(streamer)}
                      title={isActive ? 'Nonaktifkan Streamer' : 'Aktifkan Streamer'}
                      className={`p-1.5 rounded-lg border text-xs transition ${
                        isActive
                          ? 'border-slate-700 text-slate-400 hover:text-amber-400'
                          : 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'
                      }`}
                    >
                      {isActive ? (
                        <span className="text-[10px] px-1 font-semibold">Nonaktifkan</span>
                      ) : (
                        <span className="text-[10px] px-1 font-semibold">Aktifkan</span>
                      )}
                    </button>
                    <button
                      onClick={() => openEditModal(streamer)}
                      title="Edit Streamer"
                      className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setDeletingStreamer(streamer)}
                      title="Hapus Streamer"
                      className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ADD / EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-base text-white">
                {editingStreamer ? 'Edit Streamer' : 'Tambah Streamer Baru'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs rounded-xl">
                {formError}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-300 block mb-1">Nama Lengkap Host / Streamer</label>
                <input
                  type="text"
                  placeholder="Contoh: Andi Pratama"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white font-semibold focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-300 block mb-1">Username Akun Shopee</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-500">@</span>
                  <input
                    type="text"
                    placeholder="andipratama.live"
                    value={formUsername}
                    onChange={(e) => setFormUsername(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-7 pr-3 py-2.5 text-white font-semibold focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-300 block mb-1">Status Akun</label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value as any)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white focus:outline-none"
                >
                  <option value="active">Aktif (Dapat Ditugaskan)</option>
                  <option value="inactive">Nonaktif (Sedang Libur / Cuti)</option>
                </select>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold hover:bg-slate-700"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5"
                >
                  <Save className="h-4 w-4" />
                  <span>{isSaving ? 'Menyimpan...' : 'Simpan Streamer'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE MODAL */}
      {deletingStreamer && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="font-bold text-base text-white">Konfirmasi Hapus Streamer</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Apakah Anda yakin ingin menghapus streamer{' '}
              <strong className="text-white">{deletingStreamer.name}</strong>? Seluruh data laporan
              yang terkait dengan streamer ini juga akan dihapus.
            </p>
            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                onClick={() => setDeletingStreamer(null)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold hover:bg-slate-700"
              >
                Batal
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold"
              >
                Hapus Streamer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
