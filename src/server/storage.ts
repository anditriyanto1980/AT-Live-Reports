import fs from 'fs';
import path from 'path';
import { LiveReport, Streamer, User, DashboardSummary } from '../types';

const DATA_DIR = path.resolve(process.cwd(), '.data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

interface DatabaseSchema {
  users: User[];
  streamers: Streamer[];
  live_reports: LiveReport[];
}

const DEFAULT_STREAMERS: Streamer[] = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Andi Pratama',
    username: 'andipratama.live',
    status: 'active',
    created_at: '2026-09-01T08:00:00Z',
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    name: 'Siti Rahma',
    username: 'sitirahma_official',
    status: 'active',
    created_at: '2026-09-01T08:00:00Z',
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    name: 'Budi Santoso',
    username: 'budisantoso_deals',
    status: 'active',
    created_at: '2026-09-01T08:00:00Z',
  },
  {
    id: '44444444-4444-4444-4444-444444444444',
    name: 'Citra Kirana',
    username: 'citrashopee_store',
    status: 'active',
    created_at: '2026-09-02T08:00:00Z',
  },
];

const DEFAULT_USERS: User[] = [
  {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    name: 'Administrator SRA',
    email: 'admin@sra-analytics.com',
    role: 'admin',
    status: 'active',
    created_at: '2026-09-01T00:00:00Z',
  },
  {
    id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    name: 'Manager Livestream',
    email: 'manager@sra-analytics.com',
    role: 'manager',
    status: 'active',
    created_at: '2026-09-01T00:00:00Z',
  },
  {
    id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    name: 'Operator Input',
    email: 'operator@sra-analytics.com',
    role: 'operator',
    status: 'active',
    created_at: '2026-09-01T00:00:00Z',
  },
];

// Seed realistic Shopee Live reports for the past 7 days across streamers
const DEFAULT_REPORTS: LiveReport[] = [
  {
    id: 'rep-001',
    report_date: '2026-09-17',
    streamer_id: '11111111-1111-1111-1111-111111111111',
    order_status: 'Pesanan Dibuat',
    sales: 1243800,
    active_viewers: 412,
    comments: 24,
    add_to_cart: 72,
    views: 3061,
    avg_watch_duration: '00:00:35',
    comment_rate: 0.8,
    sales_per_mille: 406338,
    orders: 11,
    sales_per_order: 113073,
    viewers: 2643,
    peak_viewers: 101,
    click_rate: 3.7,
    order_click_rate: 9.7,
    buyers: 11,
    products_sold: 23,
    created_at: '2026-09-17T22:30:00Z',
  },
  {
    id: 'rep-002',
    report_date: '2026-09-18',
    streamer_id: '11111111-1111-1111-1111-111111111111',
    order_status: 'Pesanan Dibuat',
    sales: 1890000,
    active_viewers: 520,
    comments: 48,
    add_to_cart: 110,
    views: 4120,
    avg_watch_duration: '00:00:42',
    comment_rate: 1.2,
    sales_per_mille: 458737,
    orders: 19,
    sales_per_order: 99473,
    viewers: 3450,
    peak_viewers: 145,
    click_rate: 4.5,
    order_click_rate: 10.2,
    buyers: 18,
    products_sold: 34,
    created_at: '2026-09-18T22:15:00Z',
  },
  {
    id: 'rep-003',
    report_date: '2026-09-19',
    streamer_id: '22222222-2222-2222-2222-222222222222',
    order_status: 'Pesanan Dibuat',
    sales: 3450000,
    active_viewers: 890,
    comments: 92,
    add_to_cart: 215,
    views: 7890,
    avg_watch_duration: '00:01:10',
    comment_rate: 1.4,
    sales_per_mille: 437262,
    orders: 36,
    sales_per_order: 95833,
    viewers: 6420,
    peak_viewers: 240,
    click_rate: 5.1,
    order_click_rate: 12.0,
    buyers: 32,
    products_sold: 68,
    created_at: '2026-09-19T23:00:00Z',
  },
  {
    id: 'rep-004',
    report_date: '2026-09-20',
    streamer_id: '33333333-3333-3333-3333-333333333333',
    order_status: 'Pesanan Dibuat',
    sales: 4780000,
    active_viewers: 1150,
    comments: 130,
    add_to_cart: 310,
    views: 9800,
    avg_watch_duration: '00:01:25',
    comment_rate: 1.6,
    sales_per_mille: 487755,
    orders: 45,
    sales_per_order: 106222,
    viewers: 8100,
    peak_viewers: 320,
    click_rate: 5.8,
    order_click_rate: 11.5,
    buyers: 41,
    products_sold: 92,
    created_at: '2026-09-20T23:45:00Z',
  },
  {
    id: 'rep-005',
    report_date: '2026-09-21',
    streamer_id: '44444444-4444-4444-4444-444444444444',
    order_status: 'Pesanan Dibuat',
    sales: 2950000,
    active_viewers: 640,
    comments: 65,
    add_to_cart: 180,
    views: 5600,
    avg_watch_duration: '00:00:55',
    comment_rate: 1.1,
    sales_per_mille: 526785,
    orders: 28,
    sales_per_order: 105357,
    viewers: 4700,
    peak_viewers: 190,
    click_rate: 4.8,
    order_click_rate: 10.4,
    buyers: 25,
    products_sold: 51,
    created_at: '2026-09-21T22:30:00Z',
  },
  {
    id: 'rep-006',
    report_date: '2026-09-22',
    streamer_id: '22222222-2222-2222-2222-222222222222',
    order_status: 'Pesanan Dibuat',
    sales: 5120000,
    active_viewers: 1320,
    comments: 145,
    add_to_cart: 340,
    views: 11200,
    avg_watch_duration: '00:01:32',
    comment_rate: 1.8,
    sales_per_mille: 457142,
    orders: 52,
    sales_per_order: 98461,
    viewers: 9350,
    peak_viewers: 365,
    click_rate: 6.2,
    order_click_rate: 12.8,
    buyers: 48,
    products_sold: 105,
    created_at: '2026-09-22T23:10:00Z',
  },
];

class StorageManager {
  private data: DatabaseSchema;

  constructor() {
    this.data = {
      users: DEFAULT_USERS,
      streamers: DEFAULT_STREAMERS,
      live_reports: DEFAULT_REPORTS,
    };
    this.init();
  }

  private init() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(DB_FILE)) {
        const fileContent = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(fileContent);
        if (parsed.streamers && parsed.live_reports && parsed.users) {
          this.data = parsed;
          return;
        }
      }
      this.save();
    } catch (err) {
      console.error('Failed to init storage, using memory defaults:', err);
    }
  }

  private save() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to write database file:', err);
    }
  }

  // Users
  getUsers(): User[] {
    return this.data.users;
  }

  getUserById(id: string): User | undefined {
    return this.data.users.find((u) => u.id === id);
  }

  // Streamers
  getStreamers(): Streamer[] {
    return this.data.streamers;
  }

  getStreamerById(id: string): Streamer | undefined {
    return this.data.streamers.find((s) => s.id === id);
  }

  createStreamer(streamer: Omit<Streamer, 'id' | 'created_at'>): Streamer {
    const existing = this.data.streamers.find(
      (s) => s.username.toLowerCase() === streamer.username.toLowerCase()
    );
    if (existing) {
      throw new Error(`Username ${streamer.username} sudah terdaftar`);
    }

    const newStreamer: Streamer = {
      id: crypto.randomUUID(),
      name: streamer.name,
      username: streamer.username.startsWith('@') ? streamer.username.slice(1) : streamer.username,
      status: streamer.status || 'active',
      created_at: new Date().toISOString(),
    };

    this.data.streamers.push(newStreamer);
    this.save();
    return newStreamer;
  }

  updateStreamer(id: string, updates: Partial<Omit<Streamer, 'id' | 'created_at'>>): Streamer {
    const index = this.data.streamers.findIndex((s) => s.id === id);
    if (index === -1) {
      throw new Error('Streamer tidak ditemukan');
    }

    if (updates.username) {
      const usernameClean = updates.username.startsWith('@') ? updates.username.slice(1) : updates.username;
      const dup = this.data.streamers.find(
        (s) => s.id !== id && s.username.toLowerCase() === usernameClean.toLowerCase()
      );
      if (dup) {
        throw new Error(`Username ${usernameClean} sudah digunakan streamer lain`);
      }
      updates.username = usernameClean;
    }

    this.data.streamers[index] = {
      ...this.data.streamers[index],
      ...updates,
    };
    this.save();
    return this.data.streamers[index];
  }

  deleteStreamer(id: string): boolean {
    const initialLen = this.data.streamers.length;
    this.data.streamers = this.data.streamers.filter((s) => s.id !== id);
    // Also cascade delete live_reports
    this.data.live_reports = this.data.live_reports.filter((r) => r.streamer_id !== id);
    this.save();
    return this.data.streamers.length < initialLen;
  }

  // Live Reports
  getReports(filter?: {
    streamerId?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): LiveReport[] {
    let list = this.data.live_reports.map((report) => ({
      ...report,
      streamer: this.getStreamerById(report.streamer_id),
    }));

    if (filter?.streamerId && filter.streamerId !== 'all') {
      list = list.filter((r) => r.streamer_id === filter.streamerId);
    }

    if (filter?.startDate) {
      list = list.filter((r) => r.report_date >= filter.startDate!);
    }

    if (filter?.endDate) {
      list = list.filter((r) => r.report_date <= filter.endDate!);
    }

    if (filter?.search) {
      const q = filter.search.toLowerCase();
      list = list.filter(
        (r) =>
          r.report_date.includes(q) ||
          r.streamer?.name.toLowerCase().includes(q) ||
          r.streamer?.username.toLowerCase().includes(q)
      );
    }

    // Sorting
    const sortBy = filter?.sortBy || 'report_date';
    const sortOrder = filter?.sortOrder || 'desc';

    list.sort((a, b) => {
      let valA: any = (a as any)[sortBy];
      let valB: any = (b as any)[sortBy];

      if (sortBy === 'streamer') {
        valA = a.streamer?.name || '';
        valB = b.streamer?.name || '';
      }

      if (typeof valA === 'string') {
        return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortOrder === 'asc' ? (valA || 0) - (valB || 0) : (valB || 0) - (valA || 0);
    });

    return list;
  }

  getReportById(id: string): LiveReport | undefined {
    const report = this.data.live_reports.find((r) => r.id === id);
    if (!report) return undefined;
    return {
      ...report,
      streamer: this.getStreamerById(report.streamer_id),
    };
  }

  findDuplicate(report_date: string, streamer_id: string, excludeId?: string): LiveReport | undefined {
    return this.data.live_reports.find(
      (r) => r.report_date === report_date && r.streamer_id === streamer_id && (!excludeId || r.id !== excludeId)
    );
  }

  createReport(reportData: Omit<LiveReport, 'id' | 'created_at' | 'updated_at'>, overwrite = false): LiveReport {
    // Unique check
    const existing = this.findDuplicate(reportData.report_date, reportData.streamer_id);
    if (existing) {
      if (!overwrite) {
        const streamer = this.getStreamerById(reportData.streamer_id);
        const err: any = new Error(
          `Laporan untuk streamer ${streamer?.name || reportData.streamer_id} pada tanggal ${reportData.report_date} sudah tersedia.`
        );
        err.isDuplicate = true;
        err.existingReport = existing;
        throw err;
      } else {
        // Overwrite existing
        return this.updateReport(existing.id, reportData);
      }
    }

    const newReport: LiveReport = {
      id: crypto.randomUUID(),
      ...reportData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.data.live_reports.push(newReport);
    this.save();
    return {
      ...newReport,
      streamer: this.getStreamerById(newReport.streamer_id),
    };
  }

  updateReport(id: string, updates: Partial<Omit<LiveReport, 'id' | 'created_at'>>): LiveReport {
    const index = this.data.live_reports.findIndex((r) => r.id === id);
    if (index === -1) {
      throw new Error('Laporan tidak ditemukan');
    }

    if (updates.report_date || updates.streamer_id) {
      const targetDate = updates.report_date || this.data.live_reports[index].report_date;
      const targetStreamer = updates.streamer_id || this.data.live_reports[index].streamer_id;
      const dup = this.findDuplicate(targetDate, targetStreamer, id);
      if (dup) {
        throw new Error(
          `Laporan untuk streamer dan tanggal ${targetDate} sudah tersedia di record lain.`
        );
      }
    }

    this.data.live_reports[index] = {
      ...this.data.live_reports[index],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    this.save();
    return {
      ...this.data.live_reports[index],
      streamer: this.getStreamerById(this.data.live_reports[index].streamer_id),
    };
  }

  deleteReport(id: string): boolean {
    const initialLen = this.data.live_reports.length;
    this.data.live_reports = this.data.live_reports.filter((r) => r.id !== id);
    this.save();
    return this.data.live_reports.length < initialLen;
  }

  // Analytics
  getAnalyticsSummary(filter?: { streamerId?: string; startDate?: string; endDate?: string }): {
    summary: DashboardSummary;
    salesByDay: { date: string; sales: number; orders: number; buyers: number }[];
    salesByStreamer: { streamerId: string; streamerName: string; sales: number; orders: number }[];
    funnel: { views: number; addToCart: number; orders: number; buyers: number };
  } {
    const reports = this.getReports({
      streamerId: filter?.streamerId,
      startDate: filter?.startDate,
      endDate: filter?.endDate,
      sortBy: 'report_date',
      sortOrder: 'asc',
    });

    let total_sales = 0;
    let total_orders = 0;
    let total_buyers = 0;
    let total_products_sold = 0;
    let total_viewers = 0;
    let total_comments = 0;
    let total_views = 0;
    let total_add_to_cart = 0;
    let sum_click_rate = 0;
    let sum_order_click_rate = 0;
    let sum_duration_sec = 0;

    const dayMap = new Map<string, { date: string; sales: number; orders: number; buyers: number }>();
    const streamerMap = new Map<string, { streamerId: string; streamerName: string; sales: number; orders: number }>();

    for (const r of reports) {
      total_sales += Number(r.sales) || 0;
      total_orders += Number(r.orders) || 0;
      total_buyers += Number(r.buyers) || 0;
      total_products_sold += Number(r.products_sold) || 0;
      total_viewers += Number(r.viewers) || 0;
      total_comments += Number(r.comments) || 0;
      total_views += Number(r.views) || 0;
      total_add_to_cart += Number(r.add_to_cart) || 0;
      sum_click_rate += Number(r.click_rate) || 0;
      sum_order_click_rate += Number(r.order_click_rate) || 0;

      // Parse HH:MM:SS duration
      if (r.avg_watch_duration) {
        const parts = r.avg_watch_duration.split(':').map((p) => parseInt(p, 10) || 0);
        if (parts.length === 3) {
          sum_duration_sec += parts[0] * 3600 + parts[1] * 60 + parts[2];
        }
      }

      // Group by day
      const dayEntry = dayMap.get(r.report_date) || {
        date: r.report_date,
        sales: 0,
        orders: 0,
        buyers: 0,
      };
      dayEntry.sales += Number(r.sales) || 0;
      dayEntry.orders += Number(r.orders) || 0;
      dayEntry.buyers += Number(r.buyers) || 0;
      dayMap.set(r.report_date, dayEntry);

      // Group by streamer
      const sName = r.streamer?.name || 'Unknown';
      const sEntry = streamerMap.get(r.streamer_id) || {
        streamerId: r.streamer_id,
        streamerName: sName,
        sales: 0,
        orders: 0,
      };
      sEntry.sales += Number(r.sales) || 0;
      sEntry.orders += Number(r.orders) || 0;
      streamerMap.set(r.streamer_id, sEntry);
    }

    const total_reports = reports.length;

    const summary: DashboardSummary = {
      total_sales,
      total_orders,
      total_buyers,
      total_products_sold,
      total_viewers,
      total_comments,
      total_reports,
      avg_sales_per_report: total_reports > 0 ? Math.round(total_sales / total_reports) : 0,
      avg_sales_per_order: total_orders > 0 ? Math.round(total_sales / total_orders) : 0,
      avg_watch_duration_seconds: total_reports > 0 ? Math.round(sum_duration_sec / total_reports) : 0,
      avg_click_rate: total_reports > 0 ? Number((sum_click_rate / total_reports).toFixed(2)) : 0,
      avg_order_click_rate: total_reports > 0 ? Number((sum_order_click_rate / total_reports).toFixed(2)) : 0,
    };

    return {
      summary,
      salesByDay: Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date)),
      salesByStreamer: Array.from(streamerMap.values()).sort((a, b) => b.sales - a.sales),
      funnel: {
        views: total_views,
        addToCart: total_add_to_cart,
        orders: total_orders,
        buyers: total_buyers,
      },
    };
  }
}

export const storage = new StorageManager();
