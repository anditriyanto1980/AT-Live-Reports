import { LiveReport, Streamer, User, OCRResponse } from '../types';

// Helper to safely parse response and prevent "Unexpected end of JSON input"
async function safeParseResponse<T = any>(res: Response, defaultErrorMsg = 'Permintaan ke server gagal'): Promise<T> {
  let text = '';
  try {
    text = await res.text();
  } catch (err: any) {
    throw new Error(`Gagal membaca respon server: ${err.message}`);
  }

  let json: any = null;
  if (text && text.trim().length > 0) {
    try {
      json = JSON.parse(text);
    } catch {
      // Non-JSON response (e.g. proxy HTML or plain text)
      console.warn('Server returned non-JSON text:', text);
    }
  }

  if (!res.ok) {
    const errorMsg =
      json?.error ||
      json?.message ||
      (text && text.length < 200 && !text.includes('<!doctype') ? text : `${defaultErrorMsg} (Status ${res.status})`);
    const error: any = new Error(errorMsg);
    if (res.status === 409 && json?.existingReport) {
      error.isDuplicate = true;
      error.existingReport = json.existingReport;
    }
    throw error;
  }

  if (json !== null) {
    return json;
  }

  return { success: true, data: null } as unknown as T;
}

// Local storage fallback key for streamers to guarantee resilience
const LOCAL_STREAMERS_KEY = 'sra_cached_streamers';

function getCachedStreamers(): Streamer[] {
  try {
    const raw = localStorage.getItem(LOCAL_STREAMERS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function setCachedStreamers(streamers: Streamer[]) {
  try {
    localStorage.setItem(LOCAL_STREAMERS_KEY, JSON.stringify(streamers));
  } catch {}
}

export async function uploadScreenshotOCR(file: File): Promise<OCRResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch('/api/ocr', {
    method: 'POST',
    body: formData,
  });

  return safeParseResponse<OCRResponse>(res, 'Gagal memproses screenshot dengan AI');
}

export async function fetchStreamers(): Promise<Streamer[]> {
  try {
    const res = await fetch('/api/streamers');
    const json = await safeParseResponse<{ success: boolean; data: Streamer[] }>(
      res,
      'Gagal mengambil data streamer'
    );
    if (json.data && Array.isArray(json.data)) {
      setCachedStreamers(json.data);
      return json.data;
    }
  } catch (err) {
    console.warn('Backend fetchStreamers failed, using local cache:', err);
    const cached = getCachedStreamers();
    if (cached.length > 0) return cached;
  }
  return getCachedStreamers();
}

export async function createStreamer(payload: {
  name: string;
  username: string;
  status: 'active' | 'inactive';
}): Promise<Streamer> {
  const cleanUsername = payload.username.startsWith('@')
    ? payload.username.slice(1).trim()
    : payload.username.trim();

  const bodyData = {
    name: payload.name.trim(),
    username: cleanUsername,
    status: payload.status || 'active',
  };

  try {
    const res = await fetch('/api/streamers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(bodyData),
    });

    const json = await safeParseResponse<{ success: boolean; data: Streamer; error?: string }>(
      res,
      'Gagal menambahkan streamer baru'
    );

    if (json.data) {
      const current = getCachedStreamers();
      setCachedStreamers([...current, json.data]);
      return json.data;
    }
  } catch (err: any) {
    // If backend endpoint had a network/proxy glitch, fall back gracefully
    console.warn('API createStreamer fallback activated:', err);
    if (err.message && !err.message.includes('Unexpected') && !err.message.includes('Status')) {
      throw err; // Re-throw business validation errors like "Username sudah terdaftar"
    }

    // Client-side fallback creation
    const current = getCachedStreamers();
    const existing = current.find((s) => s.username.toLowerCase() === cleanUsername.toLowerCase());
    if (existing) {
      throw new Error(`Username @${cleanUsername} sudah terdaftar.`);
    }

    const fallbackStreamer: Streamer = {
      id: crypto.randomUUID ? crypto.randomUUID() : `str-${Date.now()}`,
      name: bodyData.name,
      username: bodyData.username,
      status: bodyData.status,
      created_at: new Date().toISOString(),
    };

    setCachedStreamers([...current, fallbackStreamer]);
    return fallbackStreamer;
  }

  throw new Error('Gagal menyimpan streamer.');
}

export async function updateStreamer(id: string, payload: Partial<Streamer>): Promise<Streamer> {
  const cleanId = encodeURIComponent(id.trim());
  let res: Response;

  try {
    res = await fetch(`/api/streamers/${cleanId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    // Fallback to POST /update if proxy or environment disallows PUT (Status 405)
    if (res.status === 405) {
      res = await fetch(`/api/streamers/${cleanId}/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
      });
    }
  } catch {
    res = await fetch(`/api/streamers/${cleanId}/update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  }

  const json = await safeParseResponse<{ success: boolean; data: Streamer }>(
    res,
    'Gagal memperbarui streamer'
  );

  // Sync with local cache
  if (json.data) {
    const current = getCachedStreamers();
    const idx = current.findIndex((s) => s.id === id);
    if (idx !== -1) {
      current[idx] = { ...current[idx], ...json.data };
      setCachedStreamers(current);
    }
  }

  return json.data;
}

export async function deleteStreamer(id: string): Promise<void> {
  const cleanId = encodeURIComponent(id.trim());
  let res: Response;

  try {
    res = await fetch(`/api/streamers/${cleanId}`, {
      method: 'DELETE',
      headers: { 'Accept': 'application/json' },
    });

    if (res.status === 405) {
      res = await fetch(`/api/streamers/${cleanId}/delete`, {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
      });
    }
  } catch {
    res = await fetch(`/api/streamers/${cleanId}/delete`, {
      method: 'POST',
      headers: { 'Accept': 'application/json' },
    });
  }

  await safeParseResponse<{ success: boolean; message?: string }>(
    res,
    'Gagal menghapus streamer'
  );

  // Update local cache
  const current = getCachedStreamers();
  setCachedStreamers(current.filter((s) => s.id !== id));
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

  const res = await fetch(`/api/reports?${query.toString()}`, {
    headers: { 'Accept': 'application/json' },
  });
  const json = await safeParseResponse<{ success: boolean; data: LiveReport[] }>(
    res,
    'Gagal mengambil data laporan'
  );
  return json.data || [];
}

export async function checkDuplicateReport(
  report_date: string,
  streamer_id: string,
  exclude_id?: string
): Promise<{ exists: boolean; data: LiveReport | null }> {
  const query = new URLSearchParams({ report_date, streamer_id });
  if (exclude_id) query.append('exclude_id', exclude_id);

  const res = await fetch(`/api/reports/check-duplicate?${query.toString()}`, {
    headers: { 'Accept': 'application/json' },
  });
  return safeParseResponse<{ exists: boolean; data: LiveReport | null }>(
    res,
    'Gagal mengecek duplikasi laporan'
  );
}

export async function createReport(
  reportData: Omit<LiveReport, 'id' | 'created_at' | 'updated_at'>,
  overwrite = false
): Promise<LiveReport> {
  const res = await fetch('/api/reports', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({ ...reportData, overwrite }),
  });

  const json = await safeParseResponse<{ success: boolean; data: LiveReport }>(
    res,
    'Gagal menyimpan laporan'
  );
  return json.data;
}

export async function updateReport(id: string, payload: Partial<LiveReport>): Promise<LiveReport> {
  const cleanId = encodeURIComponent(id.trim());
  let res: Response;

  try {
    res = await fetch(`/api/reports/${cleanId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (res.status === 405) {
      res = await fetch(`/api/reports/${cleanId}/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
      });
    }
  } catch {
    res = await fetch(`/api/reports/${cleanId}/update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  }

  const json = await safeParseResponse<{ success: boolean; data: LiveReport }>(
    res,
    'Gagal memperbarui laporan'
  );
  return json.data;
}

export async function deleteReport(id: string): Promise<void> {
  const cleanId = encodeURIComponent(id.trim());
  let res: Response;

  try {
    res = await fetch(`/api/reports/${cleanId}`, {
      method: 'DELETE',
      headers: { 'Accept': 'application/json' },
    });

    if (res.status === 405) {
      res = await fetch(`/api/reports/${cleanId}/delete`, {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
      });
    }
  } catch {
    res = await fetch(`/api/reports/${cleanId}/delete`, {
      method: 'POST',
      headers: { 'Accept': 'application/json' },
    });
  }

  await safeParseResponse<{ success: boolean }>(res, 'Gagal menghapus laporan');
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

  const res = await fetch(`/api/analytics/summary?${query.toString()}`, {
    headers: { 'Accept': 'application/json' },
  });
  const json = await safeParseResponse<{ success: boolean; data: any }>(
    res,
    'Gagal mengambil ringkasan analitik'
  );
  return json.data;
}

export async function fetchStreamerAnalytics(id: string) {
  const res = await fetch(`/api/streamers/${id}/analytics`, {
    headers: { 'Accept': 'application/json' },
  });
  const json = await safeParseResponse<{ success: boolean; data: any }>(
    res,
    'Gagal mengambil detail analitik streamer'
  );
  return json.data;
}

export async function fetchUsers(): Promise<User[]> {
  const res = await fetch('/api/users', {
    headers: { 'Accept': 'application/json' },
  });
  const json = await safeParseResponse<{ success: boolean; data: User[] }>(
    res,
    'Gagal mengambil data pengguna'
  );
  return json.data || [];
}

export async function fetchSystemStatus() {
  const res = await fetch('/api/status', {
    headers: { 'Accept': 'application/json' },
  });
  return safeParseResponse(res, 'Gagal mengambil status sistem');
}
