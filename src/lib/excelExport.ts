import * as XLSX from 'xlsx';
import { LiveReport } from '../types';

export function exportReportsToExcel(reports: LiveReport[], fileName = 'Laporan_SRA_Shopee_Live.xlsx') {
  const rows = reports.map((r) => ({
    'Tanggal Laporan': r.report_date,
    'Nama Streamer': r.streamer?.name || '-',
    'Username Streamer': r.streamer?.username ? `@${r.streamer.username}` : '-',
    'Status Pesanan': r.order_status,
    'Penjualan (Rp)': r.sales,
    'Total Pesanan': r.orders,
    'Total Pembeli': r.buyers,
    'Produk Terjual': r.products_sold,
    'Penonton (Viewers)': r.viewers,
    'Dilihat (Views)': r.views,
    'Penonton Tertinggi': r.peak_viewers,
    'Penonton Aktif': r.active_viewers,
    'Komentar': r.comments,
    'Tambah ke Keranjang': r.add_to_cart,
    'Durasi Rata-Rata Menonton': r.avg_watch_duration,
    'Persentase Komentar (%)': r.comment_rate,
    'Penjualan per Mil (Rp)': r.sales_per_mille,
    'Nilai per Pesanan (Rp)': r.sales_per_order,
    'Persentase Klik (%)': r.click_rate,
    'Pesanan per Klik (%)': r.order_click_rate,
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Set column widths
  const colWidths = [
    { wch: 15 }, // Tanggal
    { wch: 22 }, // Nama Streamer
    { wch: 20 }, // Username
    { wch: 18 }, // Status
    { wch: 18 }, // Penjualan
    { wch: 14 }, // Pesanan
    { wch: 14 }, // Pembeli
    { wch: 16 }, // Produk Terjual
    { wch: 16 }, // Viewers
    { wch: 14 }, // Views
    { wch: 18 }, // Peak Viewers
    { wch: 16 }, // Active Viewers
    { wch: 12 }, // Komentar
    { wch: 18 }, // Keranjang
    { wch: 22 }, // Durasi
    { wch: 20 }, // % Komentar
    { wch: 20 }, // Sales per Mil
    { wch: 20 }, // Sales per Order
    { wch: 18 }, // % Klik
    { wch: 20 }, // Pesanan per Klik
  ];
  worksheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Laporan Live');

  XLSX.writeFile(workbook, fileName);
}
