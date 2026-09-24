import React, { useState } from 'react';
import { AlertTriangle, RotateCcw, Trash2, Check, X, ShieldAlert } from 'lucide-react';
import { resetAllData } from '../lib/api';

interface ResetDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResetComplete: (result: { reportsRemoved: number; streamersRemoved: number }) => void;
}

export const ResetDataModal: React.FC<ResetDataModalProps> = ({
  isOpen,
  onClose,
  onResetComplete,
}) => {
  const [includeStreamers, setIncludeStreamers] = useState<boolean>(false);
  const [confirmed, setConfirmed] = useState<boolean>(false);
  const [isResetting, setIsResetting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleExecuteReset = async () => {
    if (!confirmed) {
      setErrorMessage('Harap centang konfirmasi sebelum melanjutkan.');
      return;
    }

    setIsResetting(true);
    setErrorMessage(null);

    try {
      const result = await resetAllData({ resetStreamers: includeStreamers });
      onResetComplete(result);
      onClose();
    } catch (err: any) {
      console.error('Reset data error:', err);
      setErrorMessage(err.message || 'Gagal mereset data.');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-red-500/40 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 text-white relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={isResetting}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition p-1.5 rounded-lg hover:bg-slate-800"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header with Red Warning Icon */}
        <div className="flex items-start space-x-3.5">
          <div className="p-3 bg-red-500/20 border border-red-500/40 rounded-xl text-red-400 shrink-0">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              <span>Reset Semua Data Menjadi 0</span>
            </h2>
            <p className="text-slate-400 text-xs mt-1 leading-relaxed">
              Tindakan ini akan mengosongkan seluruh riwayat pendapatan transaksi dan metrik performa live streaming.
            </p>
          </div>
        </div>

        {/* Impact List */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-2.5 text-xs">
          <div className="font-semibold text-slate-300 flex items-center gap-1.5">
            <ShieldAlert className="h-4 w-4 text-amber-400" />
            <span>Hasil setelah reset:</span>
          </div>
          <ul className="space-y-1.5 text-slate-400 list-disc list-inside">
            <li>
              Total Pendapatan / Penjualan kembali menjadi <strong className="text-white">Rp 0</strong>.
            </li>
            <li>
              Total Pesanan, Pembeli, & Produk Terjual kembali menjadi <strong className="text-white">0</strong>.
            </li>
            <li>
              Semua grafik penjualan harian dan funnel konversi akan menjadi <strong className="text-white">0</strong>.
            </li>
            <li>
              Seluruh riwayat laporan tersimpan akan dihapus dari sistem.
            </li>
          </ul>
        </div>

        {/* Include Streamers Option */}
        <label className="flex items-start space-x-3 p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 cursor-pointer hover:bg-slate-800 transition">
          <input
            type="checkbox"
            checked={includeStreamers}
            onChange={(e) => setIncludeStreamers(e.target.checked)}
            disabled={isResetting}
            className="mt-0.5 rounded border-slate-600 text-red-500 focus:ring-red-500"
          />
          <div className="text-xs">
            <span className="font-bold text-white block">
              Sertakan reset daftar streamer
            </span>
            <span className="text-slate-400">
              Jika dicentang, seluruh data streamer juga akan dikosongkan. Jika tidak, data nama streamer tetap tersimpan.
            </span>
          </div>
        </label>

        {/* Confirmation Checkbox */}
        <label className="flex items-center space-x-3 p-3 rounded-xl bg-red-950/30 border border-red-500/30 cursor-pointer hover:bg-red-950/40 transition">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            disabled={isResetting}
            className="rounded border-red-500 text-red-500 focus:ring-red-500"
          />
          <span className="text-xs font-semibold text-red-200">
            Saya mengerti dan setuju untuk mereset semua data transaksi menjadi 0.
          </span>
        </label>

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-3 bg-red-500/20 border border-red-500/40 rounded-xl text-red-300 text-xs font-medium">
            {errorMessage}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end space-x-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isResetting}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleExecuteReset}
            disabled={!confirmed || isResetting}
            className="flex items-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-red-600/30 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {isResetting ? (
              <>
                <RotateCcw className="h-4 w-4 animate-spin" />
                <span>Mereset Data...</span>
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                <span>Ya, Reset Menjadi 0</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
