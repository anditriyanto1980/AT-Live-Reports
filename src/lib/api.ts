import { LiveReport, Streamer, User, OCRResponse } from '../types';

export async function uploadScreenshotOCR(file: File): Promise<OCRResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/ocr', {
    method: 'POST',
    body: formData,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Gagal memproses screenshot');
  }

  return data;
}

export async function fetchStreamers(): Promise<Streamer[]> {
  const res = await fetch('/api/streamers');
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Gagal mengambil data streamer');
  return json.data || [];
}

export async function createStreamer(payload: { name: string; username: string; status: 'active' | 'inactive' }): Promise<Streamer> {
  const res = await fetch('/api/streamers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Gagal menambahkan streamer');
  return json.data;
}

export async function updateStreamer(id: string, payload: Partial<Streamer>): Promise<Streamer> {
  const res = await fetch(`/api/streamers/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Gagal memperbarui streamer');
  return json.data;
}

export async function deleteStreamer(id: string): Promise<void> {
  const res = await fetch(`/api/streamers/${id}`, { method: 'DELETE' });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Gagal menghapus streamer');
}

export async function fetchReports(params?: {
  streamer_id?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}): Promise<LiveReport[]> {
  const query = new URLSearchParams();
  if (params?.streamer_id && params.streamer_id !== 'all') query.append('streamer_id', params.streamer_id);
  if (params?.startDate) query.append('startDate', params.startDate);
  if (params?.endDate) query.append('endDate', params.endDate);
  if (params?.search) query.append('search', params.search);
  if (params?.sortBy) query.append('sortBy', params.sortBy);
  if (params?.sortOrder) query.append('sortOrder', params.sortOrder);

  const res = await fetch(`/api/reports?${query.toString()}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Gagal mengambil data laporan');
  return json.data || [];
}

export async function checkDuplicateReport(report_date: string, streamer_id: string, exclude_id?: string): Promise<{ exists: boolean; data: LiveReport | null }> {
  const query = new URLSearchParams({ report_date, streamer_id });
  if (exclude_id) query.append('exclude_id', exclude_id);

  const res = await fetch(`/api/reports/check-duplicate?${query.toString()}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Gagal mengecek duplikasi laporan');
  return json;
}

export async function createReport(
  reportData: Omit<LiveReport, 'id' | 'created_at' | 'updated_at'>,
  overwrite = false
): Promise<LiveReport> {
  const res = await fetch('/api/reports', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...reportData, overwrite }),
  });

  const json = await res.json();
  if (res.status === 409) {
    const error: any = new Error(json.error || 'Laporan duplikat terdeteksi');
    error.isDuplicate = true;
    error.existingReport = json.existingReport;
    throw error;
  }
  if (!res.ok) throw new Error(json.error || 'Gagal menyimpan laporan');
  return json.data;
}

export async function updateReport(id: string, payload: Partial<LiveReport>): Promise<LiveReport> {
  const res = await fetch(`/api/reports/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Gagal memperbarui laporan');
  return json.data;
}

export async function deleteReport(id: string): Promise<void> {
  const res = await fetch(`/api/reports/${id}`, { method: 'DELETE' });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Gagal menghapus laporan');
}

export async function fetchAnalyticsSummary(params?: {
  streamer_id?: string;
  startDate?: string;
  endDate?: string;
}) {
  const query = new URLSearchParams();
  if (params?.streamer_id && params.streamer_id !== 'all') query.append('streamer_id', params.streamer_id);
  if (params?.startDate) query.append('startDate', params.startDate);
  if (params?.endDate) query.append('endDate', params.endDate);

  const res = await fetch(`/api/analytics/summary?${query.toString()}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Gagal mengambil ringkasan analitik');
  return json.data;
}

export async function fetchStreamerAnalytics(id: string) {
  const res = await fetch(`/api/streamers/${id}/analytics`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Gagal mengambil detail analitik streamer');
  return json.data;
}

export async function fetchUsers(): Promise<User[]> {
  const res = await fetch('/api/users');
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Gagal mengambil data pengguna');
  return json.data || [];
}

export async function fetchSystemStatus() {
  const res = await fetch('/api/status');
  return res.json();
}
