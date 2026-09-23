import React, { useState, useEffect, useRef } from 'react';
import { Streamer, OCRResultData, LiveReport } from '../types';
import {
  fetchStreamers,
  uploadScreenshotOCR,
  checkDuplicateReport,
  createReport,
} from '../lib/api';
import { formatRupiah, formatNumber, formatDateIndo } from '../lib/formatters';
import {
  UploadCloud,
  FileText,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Sparkles,
  Calendar,
  User,
  Save,
  Trash2,
  RefreshCw,
  Eye,
  ShieldCheck,
  Check,
  AlertCircle,
  Clock,
  Zap,
} from 'lucide-react';

interface ImportReportProps {
  onNavigate: (tab: string, params?: any) => void;
}

export const ImportReport: React.FC<ImportReportProps> = ({ onNavigate }) => {
  const [streamers, setStreamers] = useState<Streamer[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [selectedStreamerId, setSelectedStreamerId] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // States for process
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisStep, setAnalysisStep] = useState<string>('');
  const [ocrResult, setOcrResult] = useState<OCRResultData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Duplicate warning state
  const [duplicateWarning, setDuplicateWarning] = useState<{
    exists: boolean;
    existingReport?: LiveReport;
  } | null>(null);
  const [allowOverwrite, setAllowOverwrite] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Drag & drop state
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Editable form state for 17 fields
  const [formData, setFormData] = useState({
    order_status: 'Pesanan Dibuat',
    sales: 0,
    active_viewers: 0,
    comments: 0,
    add_to_cart: 0,
    views: 0,
    avg_watch_duration: '00:00:35',
    comment_rate: 0,
    sales_per_mille: 0,
    orders: 0,
    sales_per_order: 0,
    viewers: 0,
    peak_viewers: 0,
    click_rate: 0,
    order_click_rate: 0,
    buyers: 0,
    products_sold: 0,
  });

  // Load streamers
  useEffect(() => {
    fetchStreamers()
      .then((data) => {
        setStreamers(data);
        if (data.length > 0) {
          setSelectedStreamerId(data[0].id);
        }
      })
      .catch((err) => console.error(err));
  }, []);

  // Realtime duplicate check when date or streamer changes
  useEffect(() => {
    if (selectedDate && selectedStreamerId) {
      checkDuplicateReport(selectedDate, selectedStreamerId)
        .then((res) => {
          if (res.exists) {
            setDuplicateWarning({
              exists: true,
              existingReport: res.data || undefined,
            });
          } else {
            setDuplicateWarning(null);
            setAllowOverwrite(false);
          }
        })
        .catch(() => {});
    }
  }, [selectedDate, selectedStreamerId]);

  // Clean up object URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // Handle file select
  const handleFile = (file: File) => {
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setErrorMessage('Format file tidak didukung. Harap gunakan format JPG, JPEG, PNG, atau WebP.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage('Ukuran file melebihi batas maksimal 10 MB.');
      return;
    }

    setErrorMessage(null);
    setSelectedFile(file);

    // Create temporary local preview for user feedback ONLY (never stored)
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  // Helper to generate a realistic Shopee Live test screenshot canvas
  const generateSampleShopeeScreenshot = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background Shopee seller center dark/light mobile view
    ctx.fillStyle = '#1e212d';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Header bar
    ctx.fillStyle = '#ee4d2d'; // Shopee Red/Orange
    ctx.fillRect(0, 0, canvas.width, 140);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 44px sans-serif';
    ctx.fillText('Laporan Harian Shopee Live', 60, 90);

    // Metric cards background
    ctx.fillStyle = '#282b36';
    ctx.roundRect(40, 180, 1000, 320, 20);
    ctx.fill();

    // Randomize slightly for dynamic test
    const randomSales = 1200000 + Math.floor(Math.random() * 800000);
    const randomOrders = 10 + Math.floor(Math.random() * 25);
    const randomBuyers = Math.max(randomOrders - Math.floor(Math.random() * 3), 1);
    const randomProducts = randomOrders + 8 + Math.floor(Math.random() * 15);
    const randomViewers = 2000 + Math.floor(Math.random() * 2000);

    // Label: Status Pesanan
    ctx.fillStyle = '#9ca3af';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText('Status Pesanan', 80, 240);
    ctx.fillStyle = '#10b981';
    ctx.font = 'bold 36px sans-serif';
    ctx.fillText('Pesanan Dibuat', 80, 290);

    // Label: Penjualan (Rp)
    ctx.fillStyle = '#9ca3af';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText('Penjualan (Rp)', 560, 240);
    ctx.fillStyle = '#ee4d2d';
    ctx.font = 'bold 48px sans-serif';
    ctx.fillText(`Rp ${new Intl.NumberFormat('id-ID').format(randomSales)}`, 560, 300);

    // Section 2: Viewers & Engagement
    ctx.fillStyle = '#282b36';
    ctx.roundRect(40, 530, 1000, 580, 20);
    ctx.fill();

    const metricsCol1 = [
      { label: 'Penonton Aktif', val: '412' },
      { label: 'Komentar', val: '28' },
      { label: 'Tambah ke Keranjang', val: '84' },
      { label: 'Dilihat', val: '3.420' },
      { label: 'Durasi Rata-Rata Menonton', val: '00:00:45' },
      { label: 'Persentase Komentar', val: '0,8%' },
    ];

    const metricsCol2 = [
      { label: 'Pesanan', val: `${randomOrders}` },
      { label: 'Nilai Penjualan per Pesanan', val: `Rp ${new Intl.NumberFormat('id-ID').format(Math.round(randomSales / randomOrders))}` },
      { label: 'Penonton', val: `${randomViewers}` },
      { label: 'Penonton Tertinggi', val: '125' },
      { label: 'Persentase Klik', val: '3,7%' },
      { label: 'Pesanan per Klik', val: '9,7%' },
    ];

    metricsCol1.forEach((m, idx) => {
      const y = 600 + idx * 80;
      ctx.fillStyle = '#9ca3af';
      ctx.font = '26px sans-serif';
      ctx.fillText(m.label, 80, y);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 30px sans-serif';
      ctx.fillText(m.val, 80, y + 36);
    });

    metricsCol2.forEach((m, idx) => {
      const y = 600 + idx * 80;
      ctx.fillStyle = '#9ca3af';
      ctx.font = '26px sans-serif';
      ctx.fillText(m.label, 560, y);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 30px sans-serif';
      ctx.fillText(m.val, 560, y + 36);
    });

    // Bottom block: Buyers, Products, Sales per mille
    ctx.fillStyle = '#282b36';
    ctx.roundRect(40, 1140, 1000, 360, 20);
    ctx.fill();

    ctx.fillStyle = '#9ca3af';
    ctx.font = '26px sans-serif';
    ctx.fillText('Pembeli', 80, 1210);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 34px sans-serif';
    ctx.fillText(`${randomBuyers}`, 80, 1255);

    ctx.fillStyle = '#9ca3af';
    ctx.font = '26px sans-serif';
    ctx.fillText('Produk Terjual', 420, 1210);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 34px sans-serif';
    ctx.fillText(`${randomProducts}`, 420, 1255);

    ctx.fillStyle = '#9ca3af';
    ctx.font = '26px sans-serif';
    ctx.fillText('Penjualan per mil (Rp)', 740, 1210);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 32px sans-serif';
    ctx.fillText(`Rp ${new Intl.NumberFormat('id-ID').format(Math.round((randomSales / randomViewers) * 1000))}`, 740, 1255);

    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `ShopeeLive_Report_${selectedDate}.png`, { type: 'image/png' });
        handleFile(file);
      }
    }, 'image/png');
  };

  // Run OCR
  const handleProcessOCR = async () => {
    if (!selectedFile) {
      setErrorMessage('Harap pilih atau upload screenshot terlebih dahulu.');
      return;
    }
    if (!selectedDate) {
      setErrorMessage('Harap tentukan tanggal laporan.');
      return;
    }
    if (!selectedStreamerId) {
      setErrorMessage('Harap pilih streamer yang bertugas.');
      return;
    }

    setIsAnalyzing(true);
    setErrorMessage(null);
    setAnalysisStep('Mengunggah file ke backend dalam memori sementara...');

    try {
      setTimeout(() => setAnalysisStep('Vision AI menganalisis label semantik Shopee Live...'), 800);
      setTimeout(() => setAnalysisStep('Mengekstrak 17 metrik penjualan dan durasi menonton...'), 1800);
      setTimeout(() => setAnalysisStep('Memvalidasi format Rupiah & menghapus cache gambar...'), 2800);

      const result = await uploadScreenshotOCR(selectedFile);

      if (result.success && result.data) {
        setOcrResult(result.data);

        // Populate editable form values
        setFormData({
          order_status: String(result.data.order_status?.value || 'Pesanan Dibuat'),
          sales: Number(result.data.sales?.value || 0),
          active_viewers: Number(result.data.active_viewers?.value || 0),
          comments: Number(result.data.comments?.value || 0),
          add_to_cart: Number(result.data.add_to_cart?.value || 0),
          views: Number(result.data.views?.value || 0),
          avg_watch_duration: String(result.data.avg_watch_duration?.value || '00:00:35'),
          comment_rate: Number(result.data.comment_rate?.value || 0),
          sales_per_mille: Number(result.data.sales_per_mille?.value || 0),
          orders: Number(result.data.orders?.value || 0),
          sales_per_order: Number(result.data.sales_per_order?.value || 0),
          viewers: Number(result.data.viewers?.value || 0),
          peak_viewers: Number(result.data.peak_viewers?.value || 0),
          click_rate: Number(result.data.click_rate?.value || 0),
          order_click_rate: Number(result.data.order_click_rate?.value || 0),
          buyers: Number(result.data.buyers?.value || 0),
          products_sold: Number(result.data.products_sold?.value || 0),
        });

        // HARD REQUIREMENT NOTIFICATION: Server has already cleaned memory buffer
        setSuccessToast('Ekstraksi berhasil! File gambar sementara otomatis telah dihapus dari server.');
      } else {
        throw new Error(result.error || 'Ekstraksi AI tidak menghasilkan data terstruktur.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal memproses screenshot Shopee Live.');
    } finally {
      setIsAnalyzing(false);
      setAnalysisStep('');
    }
  };

  // Recalculate derived metrics if needed
  const handleInputChange = (field: keyof typeof formData, value: any) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };

      // Auto-calculate sales_per_order if sales or orders changed
      if (field === 'sales' || field === 'orders') {
        const salesNum = field === 'sales' ? Number(value) : updated.sales;
        const ordersNum = field === 'orders' ? Number(value) : updated.orders;
        if (ordersNum > 0) {
          updated.sales_per_order = Math.round(salesNum / ordersNum);
        }
      }

      // Auto-calculate sales_per_mille if sales or views changed
      if (field === 'sales' || field === 'views') {
        const salesNum = field === 'sales' ? Number(value) : updated.sales;
        const viewsNum = field === 'views' ? Number(value) : updated.views;
        if (viewsNum > 0) {
          updated.sales_per_mille = Math.round((salesNum / viewsNum) * 1000);
        }
      }

      return updated;
    });
  };

  // Save to database
  const handleSaveReport = async () => {
    if (!selectedDate || !selectedStreamerId) {
      setErrorMessage('Tanggal dan Streamer wajib diisi.');
      return;
    }

    if (duplicateWarning?.exists && !allowOverwrite) {
      setErrorMessage(
        'Laporan untuk streamer dan tanggal ini sudah ada. Pilih opsi "Update Laporan Lama" jika ingin mengganti.'
      );
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const payload = {
        report_date: selectedDate,
        streamer_id: selectedStreamerId,
        order_status: formData.order_status,
        sales: Math.round(Number(formData.sales) || 0),
        active_viewers: Math.round(Number(formData.active_viewers) || 0),
        comments: Math.round(Number(formData.comments) || 0),
        add_to_cart: Math.round(Number(formData.add_to_cart) || 0),
        views: Math.round(Number(formData.views) || 0),
        avg_watch_duration: formData.avg_watch_duration || '00:00:00',
        comment_rate: Number(formData.comment_rate) || 0,
        sales_per_mille: Math.round(Number(formData.sales_per_mille) || 0),
        orders: Math.round(Number(formData.orders) || 0),
        sales_per_order: Math.round(Number(formData.sales_per_order) || 0),
        viewers: Math.round(Number(formData.viewers) || 0),
        peak_viewers: Math.round(Number(formData.peak_viewers) || 0),
        click_rate: Number(formData.click_rate) || 0,
        order_click_rate: Number(formData.order_click_rate) || 0,
        buyers: Math.round(Number(formData.buyers) || 0),
        products_sold: Math.round(Number(formData.products_sold) || 0),
      };

      await createReport(payload, allowOverwrite);

      setSuccessToast('Laporan berhasil disimpan ke database!');

      // Reset file and form
      setTimeout(() => {
        onNavigate('reports');
      }, 1200);
    } catch (err: any) {
      if (err.isDuplicate) {
        setDuplicateWarning({
          exists: true,
          existingReport: err.existingReport,
        });
        setErrorMessage(
          'Laporan untuk streamer dan tanggal tersebut sudah tersedia. Silakan batalkan atau pilih ganti data.'
        );
      } else {
        setErrorMessage(err.message || 'Gagal menyimpan laporan.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const getStatusBadge = (fieldKey: keyof OCRResultData) => {
    if (!ocrResult) return null;
    const item = ocrResult[fieldKey];
    if (!item) return null;

    if (item.status === 'success') {
      return (
        <span className="flex items-center text-[10px] text-emerald-400 font-semibold">
          <Check className="h-3 w-3 mr-0.5" /> Berhasil dibaca
        </span>
      );
    } else if (item.status === 'warning') {
      return (
        <span className="flex items-center text-[10px] text-amber-400 font-semibold">
          <AlertCircle className="h-3 w-3 mr-0.5" /> Perlu diperiksa
        </span>
      );
    } else {
      return (
        <span className="flex items-center text-[10px] text-slate-500 font-semibold">
          — Tidak ditemukan
        </span>
      );
    }
  };

  const selectedStreamer = streamers.find((s) => s.id === selectedStreamerId);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <div className="flex items-center space-x-2 text-orange-400 text-xs font-bold tracking-wider uppercase">
          <Zap className="h-4 w-4" />
          <span>Alur Ekstraksi AI & OCR</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-white mt-1">
          Import Shopee Live Report
        </h1>
        <p className="text-slate-400 text-xs sm:text-sm mt-1">
          Upload screenshot laporan harian Shopee Live, AI akan mengekstrak seluruh 17 label metrik
          secara otomatis untuk dikoreksi dan disimpan.
        </p>

        {/* Hard Requirement Banner */}
        <div className="mt-4 flex items-start space-x-3 bg-slate-800/80 border border-slate-700/80 p-3 rounded-xl text-xs text-slate-300">
          <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-white">Prinsip Keamanan & Privasi Gambar:</span>
            <p className="text-slate-400 mt-0.5">
              Screenshot yang diupload <strong className="text-slate-200">HANYA</strong> diproses
              sementara dalam memori server untuk Vision AI. Gambar langsung dihapus dan{' '}
              <strong className="text-slate-200">TIDAK PERNAH</strong> disimpan ke database atau disk.
            </p>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-start space-x-3 text-sm animate-fadeIn">
          <AlertCircle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1 font-medium">{errorMessage}</div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-400 hover:text-white">
            ✕
          </button>
        </div>
      )}

      {successToast && (
        <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 flex items-center space-x-3 text-sm animate-fadeIn">
          <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
          <div className="font-semibold">{successToast}</div>
        </div>
      )}

      {/* DUPLICATE WARNING MODAL / CARD */}
      {duplicateWarning?.exists && (
        <div className="p-5 rounded-2xl bg-amber-500/10 border-2 border-amber-500/40 text-amber-200 space-y-3 shadow-xl">
          <div className="flex items-center space-x-2.5">
            <AlertTriangle className="h-6 w-6 text-amber-400 shrink-0" />
            <h3 className="font-black text-base text-amber-300 uppercase tracking-wide">
              Peringatan Duplikasi: Laporan Sudah Ada
            </h3>
          </div>
          <p className="text-xs text-amber-200/90 leading-relaxed">
            Laporan untuk streamer <strong className="text-white">{selectedStreamer?.name}</strong> pada tanggal{' '}
            <strong className="text-white">{formatDateIndo(selectedDate)}</strong> sudah tersimpan di database
            dengan omzet tercatat{' '}
            <strong className="text-amber-300">
              {formatRupiah(duplicateWarning.existingReport?.sales || 0)}
            </strong>.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={() => {
                setAllowOverwrite(false);
                setDuplicateWarning(null);
                setErrorMessage('Proses dibatalkan untuk mencegah duplikasi data.');
              }}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold border border-slate-700 transition"
            >
              Batalkan Input
            </button>
            <button
              onClick={() => {
                setAllowOverwrite(true);
                setErrorMessage(null);
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 ${
                allowOverwrite
                  ? 'bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/30'
                  : 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40'
              }`}
            >
              <Check className="h-3.5 w-3.5" />
              <span>{allowOverwrite ? '✓ Siap Ganti / Update Laporan Lama' : 'Ganti / Update Laporan Lama'}</span>
            </button>
          </div>
        </div>
      )}

      {/* STEP 1 & 2: PILIH TANGGAL & STREAMER */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Pilih Tanggal */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-md">
          <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center mb-2">
            <Calendar className="h-4 w-4 mr-1.5 text-orange-400" />
            1. Pilih Tanggal Laporan
          </label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 focus:border-orange-500 text-white rounded-xl px-4 py-2.5 text-sm font-semibold focus:outline-none transition"
          />
          <span className="text-[11px] text-slate-400 mt-1.5 block">
            Terpilih: {formatDateIndo(selectedDate)}
          </span>
        </div>

        {/* Pilih Streamer */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-md">
          <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center mb-2">
            <User className="h-4 w-4 mr-1.5 text-amber-400" />
            2. Pilih Streamer
          </label>
          <select
            value={selectedStreamerId}
            onChange={(e) => setSelectedStreamerId(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 focus:border-orange-500 text-white rounded-xl px-4 py-2.5 text-sm font-semibold focus:outline-none transition"
          >
            {streamers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} (@{s.username}) {s.status === 'inactive' ? '(Nonaktif)' : ''}
              </option>
            ))}
          </select>
          <span className="text-[11px] text-slate-400 mt-1.5 block">
            {streamers.length} streamer terdaftar di sistem
          </span>
        </div>
      </div>

      {/* STEP 3: UPLOAD SCREENSHOT AREA */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center">
              <UploadCloud className="h-4 w-4 mr-1.5 text-orange-400" />
              3. Upload Screenshot Laporan Shopee Live
            </label>
            <p className="text-xs text-slate-400 mt-0.5">
              Mendukung file: JPG, JPEG, PNG, WebP (Maksimal 10 MB)
            </p>
          </div>

          <button
            type="button"
            onClick={generateSampleShopeeScreenshot}
            className="self-start sm:self-auto text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-orange-400 hover:text-orange-300 font-semibold rounded-xl border border-slate-700 flex items-center space-x-1.5 transition"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Gunakan Contoh Screenshot Shopee Live</span>
          </button>
        </div>

        {/* Dropzone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
            isDragging
              ? 'border-orange-500 bg-orange-500/10'
              : selectedFile
              ? 'border-emerald-500/60 bg-emerald-950/10'
              : 'border-slate-700 hover:border-slate-600 bg-slate-850/50'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                handleFile(e.target.files[0]);
              }
            }}
          />

          <div className="flex flex-col items-center justify-center space-y-3">
            <div
              className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
                selectedFile
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-orange-500/10 text-orange-400'
              }`}
            >
              {selectedFile ? (
                <FileText className="h-8 w-8" />
              ) : (
                <UploadCloud className="h-8 w-8 animate-bounce" />
              )}
            </div>

            {selectedFile ? (
              <div>
                <div className="font-bold text-white text-base">{selectedFile.name}</div>
                <div className="text-xs text-slate-400 mt-1">
                  Ukuran: {(selectedFile.size / 1024).toFixed(1)} KB • Siap diproses AI
                </div>
              </div>
            ) : (
              <div>
                <p className="font-bold text-white text-sm sm:text-base">
                  DROP SCREENSHOT HERE
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  atau klik untuk memilih file dari komputer / HP Anda
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Process Button & Progress */}
        <div className="pt-2">
          {isAnalyzing ? (
            <div className="p-4 bg-slate-800 rounded-xl border border-slate-700 space-y-3">
              <div className="flex items-center space-x-3 text-orange-400 font-semibold text-sm">
                <RefreshCw className="h-5 w-5 animate-spin" />
                <span>{analysisStep || 'Menganalisis screenshot...'}</span>
              </div>
              <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-orange-500 to-amber-400 animate-pulse w-3/4 rounded-full" />
              </div>
              <p className="text-[11px] text-slate-400">
                AI sedang melakukan semantic parsing berdasarkan label metrik (bukan koordinat pixel tetap).
              </p>
            </div>
          ) : (
            <button
              onClick={handleProcessOCR}
              disabled={!selectedFile || isAnalyzing}
              className={`w-full py-3.5 rounded-xl font-black text-sm tracking-wide shadow-xl flex items-center justify-center space-x-2 transition ${
                !selectedFile
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                  : 'bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:from-orange-600 hover:to-amber-600 text-white cursor-pointer shadow-orange-500/30'
              }`}
            >
              <Sparkles className="h-4 w-4" />
              <span>PROSES SCREENSHOT DENGAN AI</span>
            </button>
          )}
        </div>
      </div>

      {/* STEP 4: OCR RESULT REVIEW & EDITABLE FORM */}
      {ocrResult && (
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-2xl space-y-6 animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-800 pb-4">
            <div>
              <div className="flex items-center space-x-2 text-emerald-400 text-xs font-bold tracking-wider uppercase">
                <CheckCircle2 className="h-4 w-4" />
                <span>Hasil Ekstraksi Semantik</span>
              </div>
              <h2 className="text-xl font-black text-white mt-0.5">
                Review & Koreksi Data Metrik
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Periksa nilai yang terbaca oleh AI. Seluruh field dapat diedit manual sebelum
                disimpan.
              </p>
            </div>

            {/* Status Legend */}
            <div className="flex items-center space-x-3 text-[11px] bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700">
              <span className="flex items-center text-emerald-400 font-semibold">
                ✓ Dibaca
              </span>
              <span className="flex items-center text-amber-400 font-semibold">
                ⚠ Periksa
              </span>
              <span className="flex items-center text-slate-400 font-semibold">
                — Kosong
              </span>
            </div>
          </div>

          {/* 17 EDITABLE FIELDS IN 3 INTUITIVE CATEGORIES */}

          {/* Category A: Pendapatan & Pesanan */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-orange-400 flex items-center">
              <span>A. Transaksi & Pendapatan</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {/* 1. Status Pesanan */}
              <div className="bg-slate-850 p-3.5 rounded-xl border border-slate-750">
                <div className="flex items-center justify-between text-xs mb-1">
                  <label className="font-semibold text-slate-300">1. Status Pesanan</label>
                  {getStatusBadge('order_status')}
                </div>
                <input
                  type="text"
                  value={formData.order_status}
                  onChange={(e) => handleInputChange('order_status', e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm font-bold focus:outline-none focus:border-orange-500"
                />
              </div>

              {/* 2. Penjualan (Rp) */}
              <div className="bg-slate-850 p-3.5 rounded-xl border border-slate-750">
                <div className="flex items-center justify-between text-xs mb-1">
                  <label className="font-semibold text-slate-300">2. Penjualan (Rp)</label>
                  {getStatusBadge('sales')}
                </div>
                <input
                  type="number"
                  value={formData.sales}
                  onChange={(e) => handleInputChange('sales', Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 text-orange-400 rounded-lg px-3 py-2 text-base font-black focus:outline-none focus:border-orange-500"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Format: {formatRupiah(formData.sales)}
                </span>
              </div>

              {/* 10. Pesanan */}
              <div className="bg-slate-850 p-3.5 rounded-xl border border-slate-750">
                <div className="flex items-center justify-between text-xs mb-1">
                  <label className="font-semibold text-slate-300">10. Pesanan</label>
                  {getStatusBadge('orders')}
                </div>
                <input
                  type="number"
                  value={formData.orders}
                  onChange={(e) => handleInputChange('orders', Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm font-bold focus:outline-none focus:border-orange-500"
                />
              </div>

              {/* 11. Nilai Penjualan per Pesanan */}
              <div className="bg-slate-850 p-3.5 rounded-xl border border-slate-750">
                <div className="flex items-center justify-between text-xs mb-1">
                  <label className="font-semibold text-slate-300">11. Nilai / Pesanan (AOV)</label>
                  {getStatusBadge('sales_per_order')}
                </div>
                <input
                  type="number"
                  value={formData.sales_per_order}
                  onChange={(e) => handleInputChange('sales_per_order', Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:border-orange-500"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  {formatRupiah(formData.sales_per_order)}
                </span>
              </div>

              {/* 16. Pembeli */}
              <div className="bg-slate-850 p-3.5 rounded-xl border border-slate-750">
                <div className="flex items-center justify-between text-xs mb-1">
                  <label className="font-semibold text-slate-300">16. Pembeli</label>
                  {getStatusBadge('buyers')}
                </div>
                <input
                  type="number"
                  value={formData.buyers}
                  onChange={(e) => handleInputChange('buyers', Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm font-bold focus:outline-none focus:border-orange-500"
                />
              </div>

              {/* 17. Produk Terjual */}
              <div className="bg-slate-850 p-3.5 rounded-xl border border-slate-750">
                <div className="flex items-center justify-between text-xs mb-1">
                  <label className="font-semibold text-slate-300">17. Produk Terjual</label>
                  {getStatusBadge('products_sold')}
                </div>
                <input
                  type="number"
                  value={formData.products_sold}
                  onChange={(e) => handleInputChange('products_sold', Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm font-bold focus:outline-none focus:border-orange-500"
                />
              </div>
            </div>
          </div>

          {/* Category B: Penonton & Durasi */}
          <div className="space-y-3 pt-2 border-t border-slate-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center">
              <span>B. Penonton & Durasi Menonton</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {/* 12. Penonton */}
              <div className="bg-slate-850 p-3.5 rounded-xl border border-slate-750">
                <div className="flex items-center justify-between text-xs mb-1">
                  <label className="font-semibold text-slate-300">12. Penonton (Viewers)</label>
                  {getStatusBadge('viewers')}
                </div>
                <input
                  type="number"
                  value={formData.viewers}
                  onChange={(e) => handleInputChange('viewers', Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm font-bold focus:outline-none focus:border-orange-500"
                />
              </div>

              {/* 13. Penonton Tertinggi */}
              <div className="bg-slate-850 p-3.5 rounded-xl border border-slate-750">
                <div className="flex items-center justify-between text-xs mb-1">
                  <label className="font-semibold text-slate-300">13. Penonton Tertinggi (Peak)</label>
                  {getStatusBadge('peak_viewers')}
                </div>
                <input
                  type="number"
                  value={formData.peak_viewers}
                  onChange={(e) => handleInputChange('peak_viewers', Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm font-bold focus:outline-none focus:border-orange-500"
                />
              </div>

              {/* 3. Penonton Aktif */}
              <div className="bg-slate-850 p-3.5 rounded-xl border border-slate-750">
                <div className="flex items-center justify-between text-xs mb-1">
                  <label className="font-semibold text-slate-300">3. Penonton Aktif</label>
                  {getStatusBadge('active_viewers')}
                </div>
                <input
                  type="number"
                  value={formData.active_viewers}
                  onChange={(e) => handleInputChange('active_viewers', Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm font-bold focus:outline-none focus:border-orange-500"
                />
              </div>

              {/* 6. Dilihat */}
              <div className="bg-slate-850 p-3.5 rounded-xl border border-slate-750">
                <div className="flex items-center justify-between text-xs mb-1">
                  <label className="font-semibold text-slate-300">6. Dilihat (Views)</label>
                  {getStatusBadge('views')}
                </div>
                <input
                  type="number"
                  value={formData.views}
                  onChange={(e) => handleInputChange('views', Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm font-bold focus:outline-none focus:border-orange-500"
                />
              </div>

              {/* 7. Durasi Rata-Rata Menonton */}
              <div className="bg-slate-850 p-3.5 rounded-xl border border-slate-750">
                <div className="flex items-center justify-between text-xs mb-1">
                  <label className="font-semibold text-slate-300">7. Durasi Rata-Rata Menonton</label>
                  {getStatusBadge('avg_watch_duration')}
                </div>
                <input
                  type="text"
                  placeholder="HH:MM:SS"
                  value={formData.avg_watch_duration}
                  onChange={(e) => handleInputChange('avg_watch_duration', e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-indigo-400 rounded-lg px-3 py-2 text-sm font-mono font-bold focus:outline-none focus:border-orange-500"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">Format: HH:MM:SS</span>
              </div>

              {/* 9. Penjualan per mil */}
              <div className="bg-slate-850 p-3.5 rounded-xl border border-slate-750">
                <div className="flex items-center justify-between text-xs mb-1">
                  <label className="font-semibold text-slate-300">9. Penjualan per mil (Rp)</label>
                  {getStatusBadge('sales_per_mille')}
                </div>
                <input
                  type="number"
                  value={formData.sales_per_mille}
                  onChange={(e) => handleInputChange('sales_per_mille', Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:border-orange-500"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  {formatRupiah(formData.sales_per_mille)}
                </span>
              </div>
            </div>
          </div>

          {/* Category C: Interaksi & Konversi */}
          <div className="space-y-3 pt-2 border-t border-slate-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center">
              <span>C. Interaksi & Konversi Pembelian</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {/* 4. Komentar */}
              <div className="bg-slate-850 p-3.5 rounded-xl border border-slate-750">
                <div className="flex items-center justify-between text-xs mb-1">
                  <label className="font-semibold text-slate-300">4. Komentar</label>
                  {getStatusBadge('comments')}
                </div>
                <input
                  type="number"
                  value={formData.comments}
                  onChange={(e) => handleInputChange('comments', Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm font-bold focus:outline-none focus:border-orange-500"
                />
              </div>

              {/* 8. Persentase Komentar */}
              <div className="bg-slate-850 p-3.5 rounded-xl border border-slate-750">
                <div className="flex items-center justify-between text-xs mb-1">
                  <label className="font-semibold text-slate-300">8. % Komentar</label>
                  {getStatusBadge('comment_rate')}
                </div>
                <input
                  type="number"
                  step="0.1"
                  value={formData.comment_rate}
                  onChange={(e) => handleInputChange('comment_rate', Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm font-bold focus:outline-none focus:border-orange-500"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  {formData.comment_rate}%
                </span>
              </div>

              {/* 5. Tambah ke Keranjang */}
              <div className="bg-slate-850 p-3.5 rounded-xl border border-slate-750">
                <div className="flex items-center justify-between text-xs mb-1">
                  <label className="font-semibold text-slate-300">5. Masuk Keranjang</label>
                  {getStatusBadge('add_to_cart')}
                </div>
                <input
                  type="number"
                  value={formData.add_to_cart}
                  onChange={(e) => handleInputChange('add_to_cart', Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm font-bold focus:outline-none focus:border-orange-500"
                />
              </div>

              {/* 14. Persentase Klik */}
              <div className="bg-slate-850 p-3.5 rounded-xl border border-slate-750">
                <div className="flex items-center justify-between text-xs mb-1">
                  <label className="font-semibold text-slate-300">14. % Klik (CTR)</label>
                  {getStatusBadge('click_rate')}
                </div>
                <input
                  type="number"
                  step="0.1"
                  value={formData.click_rate}
                  onChange={(e) => handleInputChange('click_rate', Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm font-bold focus:outline-none focus:border-orange-500"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  {formData.click_rate}%
                </span>
              </div>

              {/* 15. Pesanan per Klik */}
              <div className="bg-slate-850 p-3.5 rounded-xl border border-slate-750">
                <div className="flex items-center justify-between text-xs mb-1">
                  <label className="font-semibold text-slate-300">15. Pesanan / Klik</label>
                  {getStatusBadge('order_click_rate')}
                </div>
                <input
                  type="number"
                  step="0.1"
                  value={formData.order_click_rate}
                  onChange={(e) => handleInputChange('order_click_rate', Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm font-bold focus:outline-none focus:border-orange-500"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  {formData.order_click_rate}%
                </span>
              </div>
            </div>
          </div>

          {/* SUMMARY PREVIEW CARD & SUBMIT ACTION */}
          <div className="pt-4 border-t border-slate-800">
            <div className="bg-gradient-to-r from-slate-850 to-slate-800 p-4 rounded-xl border border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
                  Ringkasan Laporan yang Akan Disimpan:
                </span>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  <span className="text-white font-bold">{selectedStreamer?.name}</span>
                  <span className="text-slate-400">•</span>
                  <span className="text-slate-300">{formatDateIndo(selectedDate)}</span>
                  <span className="text-slate-400">•</span>
                  <span className="text-orange-400 font-extrabold">
                    {formatRupiah(formData.sales)}
                  </span>
                  <span className="text-slate-400">•</span>
                  <span className="text-blue-400 font-semibold">{formData.orders} Pesanan</span>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setOcrResult(null);
                    setSelectedFile(null);
                    setPreviewUrl(null);
                  }}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold border border-slate-700 transition"
                >
                  Reset Form
                </button>

                <button
                  type="button"
                  onClick={handleSaveReport}
                  disabled={isSaving}
                  className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-xl text-sm font-black shadow-lg shadow-emerald-500/25 flex items-center space-x-2 transition cursor-pointer"
                >
                  <Save className="h-4 w-4" />
                  <span>{isSaving ? 'Menyimpan ke Database...' : 'SIMPAN LAPORAN'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
