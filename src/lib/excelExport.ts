import * as XLSX from 'xlsx';
import { LiveReport } from '../types';

export interface ExportOptions {
  fileName?: string;
  format?: 'xlsx' | 'csv';
  csvDelimiter?: ',' | ';';
  includeSummaryRow?: boolean;
  includeStreamerRecap?: boolean;
  columns?: {
    date?: boolean;
    streamer?: boolean;
    status?: boolean;
    sales?: boolean;
    orders?: boolean;
    buyers?: boolean;
    productsSold?: boolean;
    viewers?: boolean;
    views?: boolean;
    peakViewers?: boolean;
    activeViewers?: boolean;
    comments?: boolean;
    addToCart?: boolean;
    watchDuration?: boolean;
    commentRate?: boolean;
    salesPerMille?: boolean;
    salesPerOrder?: boolean;
    clickRate?: boolean;
    orderClickRate?: boolean;
  };
}

/**
 * Builds array of row objects for XLSX / CSV export
 */
export function buildExportRows(reports: LiveReport[], options?: ExportOptions) {
  const cols = options?.columns;
  const show = (colKey: keyof NonNullable<ExportOptions['columns']>, defaultVal = true) => {
    if (!cols) return defaultVal;
    return cols[colKey] !== false;
  };

  return reports.map((r) => {
    const row: Record<string, any> = {};

    if (show('date')) row['Tanggal Laporan'] = r.report_date;
    if (show('streamer')) {
      row['Nama Streamer'] = r.streamer?.name || '-';
      row['Username Shopee'] = r.streamer?.username ? `@${r.streamer.username.replace(/^@/, '')}` : '-';
    }
    if (show('status')) row['Status Pesanan'] = r.order_status || 'Pesanan Dibuat';
    if (show('sales')) row['Penjualan (Rp)'] = r.sales;
    if (show('orders')) row['Total Pesanan'] = r.orders;
    if (show('buyers')) row['Total Pembeli'] = r.buyers;
    if (show('productsSold')) row['Produk Terjual (Item)'] = r.products_sold;
    if (show('viewers')) row['Total Penonton'] = r.viewers;
    if (show('views')) row['Dilihat (Views)'] = r.views;
    if (show('peakViewers')) row['Penonton Puncak'] = r.peak_viewers;
    if (show('activeViewers')) row['Penonton Aktif'] = r.active_viewers;
    if (show('comments')) row['Total Komentar'] = r.comments;
    if (show('commentRate')) row['Rasio Komentar (%)'] = r.comment_rate;
    if (show('addToCart')) row['Masuk Keranjang'] = r.add_to_cart;
    if (show('watchDuration')) row['Durasi Tonton Rata-rata'] = r.avg_watch_duration || '00:00:00';
    if (show('clickRate')) row['Rasio Klik (%)'] = r.click_rate;
    if (show('orderClickRate')) row['Pesanan per Klik (%)'] = r.order_click_rate;
    if (show('salesPerOrder')) row['AOV (Nilai/Pesanan)'] = r.sales_per_order;
    if (show('salesPerMille')) row['SPM (Penjualan/1k)'] = r.sales_per_mille;

    return row;
  });
}

/**
 * Builds streamer recap aggregation
 */
export function buildStreamerRecapRows(reports: LiveReport[]) {
  const map = new Map<string, {
    name: string;
    username: string;
    sessions: number;
    sales: number;
    orders: number;
    buyers: number;
    productsSold: number;
    viewers: number;
    comments: number;
  }>();

  for (const r of reports) {
    const key = r.streamer_id;
    const name = r.streamer?.name || 'Unknown';
    const username = r.streamer?.username ? `@${r.streamer.username.replace(/^@/, '')}` : '-';

    const curr = map.get(key) || {
      name,
      username,
      sessions: 0,
      sales: 0,
      orders: 0,
      buyers: 0,
      productsSold: 0,
      viewers: 0,
      comments: 0,
    };

    curr.sessions += 1;
    curr.sales += r.sales || 0;
    curr.orders += r.orders || 0;
    curr.buyers += r.buyers || 0;
    curr.productsSold += r.products_sold || 0;
    curr.viewers += r.viewers || 0;
    curr.comments += r.comments || 0;

    map.set(key, curr);
  }

  return Array.from(map.values())
    .sort((a, b) => b.sales - a.sales)
    .map((s, idx) => ({
      'Peringkat': idx + 1,
      'Nama Streamer': s.name,
      'Username': s.username,
      'Total Sesi Live': s.sessions,
      'Total Omzet (Rp)': s.sales,
      'Total Pesanan': s.orders,
      'Total Pembeli': s.buyers,
      'Produk Terjual': s.productsSold,
      'Rata-rata Omzet / Sesi': s.sessions > 0 ? Math.round(s.sales / s.sessions) : 0,
      'AOV (Omzet / Pesanan)': s.orders > 0 ? Math.round(s.sales / s.orders) : 0,
      'Total Penonton': s.viewers,
      'Total Komentar': s.comments,
    }));
}

/**
 * Exports data to multi-sheet Microsoft Excel (.xlsx)
 */
export function exportReportsToExcel(
  reports: LiveReport[],
  fileName = 'Laporan_SRA_Shopee_Live.xlsx',
  options?: ExportOptions
) {
  const rows = buildExportRows(reports, options);

  // Add Summary / Totals row if enabled
  if (options?.includeSummaryRow !== false && rows.length > 0) {
    const totalSales = reports.reduce((acc, r) => acc + (r.sales || 0), 0);
    const totalOrders = reports.reduce((acc, r) => acc + (r.orders || 0), 0);
    const totalBuyers = reports.reduce((acc, r) => acc + (r.buyers || 0), 0);
    const totalProducts = reports.reduce((acc, r) => acc + (r.products_sold || 0), 0);
    const totalViewers = reports.reduce((acc, r) => acc + (r.viewers || 0), 0);
    const totalComments = reports.reduce((acc, r) => acc + (r.comments || 0), 0);
    const totalAddToCart = reports.reduce((acc, r) => acc + (r.add_to_cart || 0), 0);

    const summaryRow: Record<string, any> = {
      'Tanggal Laporan': `TOTAL (${reports.length} SESI)`,
      'Nama Streamer': '-',
      'Username Shopee': '-',
      'Status Pesanan': '-',
      'Penjualan (Rp)': totalSales,
      'Total Pesanan': totalOrders,
      'Total Pembeli': totalBuyers,
      'Produk Terjual (Item)': totalProducts,
      'Total Penonton': totalViewers,
      'Total Komentar': totalComments,
      'Masuk Keranjang': totalAddToCart,
      'AOV (Nilai/Pesanan)': totalOrders > 0 ? Math.round(totalSales / totalOrders) : 0,
    };
    rows.push(summaryRow);
  }

  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Dynamic column widths
  const colWidths = [
    { wch: 18 }, // Tanggal
    { wch: 22 }, // Nama Streamer
    { wch: 20 }, // Username
    { wch: 18 }, // Status
    { wch: 20 }, // Penjualan
    { wch: 15 }, // Pesanan
    { wch: 15 }, // Pembeli
    { wch: 20 }, // Produk Terjual
    { wch: 16 }, // Viewers
    { wch: 16 }, // Views
    { wch: 18 }, // Peak Viewers
    { wch: 16 }, // Active Viewers
    { wch: 14 }, // Komentar
    { wch: 20 }, // Rasio Komentar
    { wch: 18 }, // Keranjang
    { wch: 24 }, // Durasi
    { wch: 18 }, // Rasio Klik
    { wch: 20 }, // Pesanan per Klik
    { wch: 22 }, // AOV
    { wch: 22 }, // SPM
  ];
  worksheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Data Performa Live');

  // Sheet 2: Rekap Performa per Streamer
  if (options?.includeStreamerRecap !== false && reports.length > 0) {
    const recapRows = buildStreamerRecapRows(reports);
    const recapSheet = XLSX.utils.json_to_sheet(recapRows);
    recapSheet['!cols'] = [
      { wch: 10 },
      { wch: 22 },
      { wch: 20 },
      { wch: 16 },
      { wch: 22 },
      { wch: 16 },
      { wch: 16 },
      { wch: 16 },
      { wch: 24 },
      { wch: 24 },
      { wch: 16 },
      { wch: 16 },
    ];
    XLSX.utils.book_append_sheet(workbook, recapSheet, 'Rekap per Streamer');
  }

  const cleanFileName = fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`;
  XLSX.writeFile(workbook, cleanFileName);
}

/**
 * Exports data to clean CSV with proper UTF-8 BOM
 */
export function exportReportsToCSV(
  reports: LiveReport[],
  fileName = 'Laporan_SRA_Shopee_Live.csv',
  options?: ExportOptions
) {
  const delimiter = options?.csvDelimiter || ',';
  const rows = buildExportRows(reports, options);

  if (rows.length === 0) {
    alert('Tidak ada data laporan untuk diexport.');
    return;
  }

  const headers = Object.keys(rows[0]);

  const escapeCSV = (val: any) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const csvLines: string[] = [];
  csvLines.push(headers.map(escapeCSV).join(delimiter));

  for (const row of rows) {
    const line = headers.map((h) => escapeCSV(row[h])).join(delimiter);
    csvLines.push(line);
  }

  // Summary row in CSV if enabled
  if (options?.includeSummaryRow !== false) {
    const totalSales = reports.reduce((acc, r) => acc + (r.sales || 0), 0);
    const totalOrders = reports.reduce((acc, r) => acc + (r.orders || 0), 0);
    const totalBuyers = reports.reduce((acc, r) => acc + (r.buyers || 0), 0);
    const totalProducts = reports.reduce((acc, r) => acc + (r.products_sold || 0), 0);
    const totalViewers = reports.reduce((acc, r) => acc + (r.viewers || 0), 0);
    const totalComments = reports.reduce((acc, r) => acc + (r.comments || 0), 0);

    const summaryLine = headers
      .map((h) => {
        if (h === 'Tanggal Laporan') return escapeCSV(`TOTAL (${reports.length} SESI)`);
        if (h === 'Penjualan (Rp)') return escapeCSV(totalSales);
        if (h === 'Total Pesanan') return escapeCSV(totalOrders);
        if (h === 'Total Pembeli') return escapeCSV(totalBuyers);
        if (h === 'Produk Terjual (Item)') return escapeCSV(totalProducts);
        if (h === 'Total Penonton') return escapeCSV(totalViewers);
        if (h === 'Total Komentar') return escapeCSV(totalComments);
        if (h === 'AOV (Nilai/Pesanan)') return escapeCSV(totalOrders > 0 ? Math.round(totalSales / totalOrders) : 0);
        return escapeCSV('-');
      })
      .join(delimiter);

    csvLines.push(summaryLine);
  }

  // UTF-8 BOM (\uFEFF) ensures Excel opens Indonesian characters and numbers without corruption
  const csvContent = '\uFEFF' + csvLines.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const cleanFileName = fileName.endsWith('.csv') ? fileName : `${fileName}.csv`;
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', cleanFileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
