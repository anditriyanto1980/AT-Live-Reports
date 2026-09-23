export type UserRole = 'admin' | 'manager' | 'operator';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: 'active' | 'inactive';
  created_at: string;
}

export interface Streamer {
  id: string;
  name: string;
  username: string;
  status: 'active' | 'inactive';
  created_at: string;
}

export interface LiveReport {
  id: string;
  report_date: string; // YYYY-MM-DD
  streamer_id: string;
  order_status: string; // e.g. "Pesanan Dibuat", "Pesanan Selesai"
  sales: number; // integer (Rupiah)
  active_viewers: number;
  comments: number;
  add_to_cart: number;
  views: number;
  avg_watch_duration: string; // HH:MM:SS
  comment_rate: number; // percentage, e.g. 0.8
  sales_per_mille: number; // integer (Rupiah)
  orders: number;
  sales_per_order: number; // integer (Rupiah)
  viewers: number;
  peak_viewers: number;
  click_rate: number; // percentage, e.g. 3.7
  order_click_rate: number; // percentage, e.g. 9.7
  buyers: number;
  products_sold: number;
  created_by?: string;
  created_at: string;
  updated_at?: string;
  // Joined relation:
  streamer?: Streamer;
}

export interface ExtractedMetricField<T = number | string | null> {
  value: T;
  raw_text?: string;
  status: 'success' | 'warning' | 'missing'; // ✓ berhasil, ⚠ perlu periksa, — tidak ada
  note?: string;
}

export interface OCRResultData {
  order_status: ExtractedMetricField<string>;
  sales: ExtractedMetricField<number | null>;
  active_viewers: ExtractedMetricField<number | null>;
  comments: ExtractedMetricField<number | null>;
  add_to_cart: ExtractedMetricField<number | null>;
  views: ExtractedMetricField<number | null>;
  avg_watch_duration: ExtractedMetricField<string>;
  comment_rate: ExtractedMetricField<number | null>;
  sales_per_mille: ExtractedMetricField<number | null>;
  orders: ExtractedMetricField<number | null>;
  sales_per_order: ExtractedMetricField<number | null>;
  viewers: ExtractedMetricField<number | null>;
  peak_viewers: ExtractedMetricField<number | null>;
  click_rate: ExtractedMetricField<number | null>;
  order_click_rate: ExtractedMetricField<number | null>;
  buyers: ExtractedMetricField<number | null>;
  products_sold: ExtractedMetricField<number | null>;
}

export interface OCRResponse {
  success: boolean;
  message?: string;
  data?: OCRResultData;
  error?: string;
}

export interface DashboardFilter {
  dateRange: 'today' | 'yesterday' | 'week' | 'month' | 'custom' | 'all';
  startDate?: string;
  endDate?: string;
  streamerId?: string;
}

export interface DashboardSummary {
  total_sales: number;
  total_orders: number;
  total_buyers: number;
  total_products_sold: number;
  total_viewers: number;
  total_comments: number;
  total_reports: number;
  avg_sales_per_report: number;
  avg_sales_per_order: number;
  avg_watch_duration_seconds: number;
  avg_click_rate: number;
  avg_order_click_rate: number;
}
