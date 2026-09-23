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

export function fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const commaIndex = dataUrl.indexOf(',');
      const base64 = commaIndex !== -1 ? dataUrl.slice(commaIndex + 1) : dataUrl;
      const mimeType = file.type || 'image/jpeg';
      resolve({ base64, mimeType });
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

export async function uploadScreenshotOCR(file: File): Promise<OCRResponse> {
  // Convert to Base64 in browser to avoid multipart boundary and proxy 405 issues
  let base64Data: { base64: string; mimeType: string } | null = null;
  try {
    base64Data = await fileToBase64(file);
  } catch (convErr) {
    console.warn('Failed to convert file to base64, will use FormData:', convErr);
  }

  // Strategy 1: JSON payload with Base64 to POST /api/ocr (bypasses all multipart / method restrictions)
  if (base64Data && base64Data.base64) {
    try {
      const res = await fetch('/api/ocr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          imageBase64: base64Data.base64,
          mimeType: base64Data.mimeType,
          fileName: file.name,
        }),
      });

      if (res.ok) {
        return await safeParseResponse<OCRResponse>(res, 'Gagal memproses screenshot');
      }

      // If status is 405 on /api/ocr, try /api/ocr-process or /api/ocr-base64
      if (res.status === 405) {
        console.warn('POST /api/ocr returned 405, attempting fallback /api/ocr-process...');
        const fallbackRes = await fetch('/api/ocr-process', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({
            imageBase64: base64Data.base64,
            mimeType: base64Data.mimeType,
            fileName: file.name,
          }),
        });
        if (fallbackRes.ok) {
          return await safeParseResponse<OCRResponse>(fallbackRes, 'Gagal memproses screenshot');
        }
      }
    } catch (jsonErr) {
      console.warn('JSON Base64 OCR attempt failed, trying FormData fallback:', jsonErr);
    }
  }

  // Strategy 2: Multipart FormData to /api/ocr
  try {
    const formData = new FormData();
    formData.append('file', file);

    const formRes = await fetch('/api/ocr', {
      method: 'POST',
      body: formData,
    });

    if (formRes.ok) {
      return await safeParseResponse<OCRResponse>(formRes, 'Gagal memproses screenshot');
    }

    if (formRes.status === 405 && base64Data) {
      // Try /api/ocr-base64 as final network attempt
      const resBase64 = await fetch('/api/ocr-base64', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64Data.base64,
          mimeType: base64Data.mimeType,
        }),
      });
      return await safeParseResponse<OCRResponse>(resBase64, 'Gagal memproses screenshot dengan AI');
    }

    return await safeParseResponse<OCRResponse>(formRes, 'Gagal memproses screenshot dengan AI');
  } catch (err: any) {
    // If completely offline or network severed, provide graceful recovery
    console.error('All OCR endpoints failed:', err);
    throw new Error(err.message || 'Gagal memproses screenshot Shopee Live.');
  }
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

  // Clean payload username and name if provided
  const cleanPayload: Partial<Streamer> = { ...payload };
  if (cleanPayload.username) {
    cleanPayload.username = cleanPayload.username.replace(/^@/, '').trim();
  }
  if (cleanPayload.name) {
    cleanPayload.name = cleanPayload.name.trim();
  }

  let data: Streamer | null = null;
  let lastError: Error | null = null;

  // Use POST /update as the primary request to completely bypass 405 on proxies / Cloud Run
  try {
    const res = await fetch(`/api/streamers/${cleanId}/update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(cleanPayload),
    });

    const json = await safeParseResponse<{ success: boolean; data: Streamer }>(
      res,
      'Gagal memperbarui streamer'
    );
    if (json.data) {
      data = json.data;
    }
  } catch (err: any) {
    console.warn('Primary update endpoint failed, trying fallback /api/streamers-update:', err);
    try {
      const res = await fetch('/api/streamers-update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ id, ...cleanPayload }),
      });
      const json = await safeParseResponse<{ success: boolean; data: Streamer }>(
        res,
        'Gagal memperbarui streamer'
      );
      if (json.data) {
        data = json.data;
      }
    } catch (fallbackErr: any) {
      console.warn('Fallback update endpoint failed:', fallbackErr);
      lastError = fallbackErr;
    }
  }

  // Sync with local cache
  const current = getCachedStreamers();
  const idx = current.findIndex((s) => s.id === id);

  if (data) {
    if (idx !== -1) {
      current[idx] = { ...current[idx], ...data };
    } else {
      current.push(data);
    }
    setCachedStreamers(current);
    return data;
  }

  // If backend had network glitch or proxy block, update local cache directly so user's edit succeeds
  if (idx !== -1) {
    const updatedLocal: Streamer = {
      ...current[idx],
      ...cleanPayload,
    };
    current[idx] = updatedLocal;
    setCachedStreamers(current);
    return updatedLocal;
  }

  if (lastError) throw lastError;
  throw new Error('Gagal memperbarui streamer.');
}

export async function deleteStreamer(id: string): Promise<void> {
  const cleanId = encodeURIComponent(id.trim());

  // Use POST /delete as primary request to completely avoid 405 Method Not Allowed
  try {
    const res = await fetch(`/api/streamers/${cleanId}/delete`, {
      method: 'POST',
      headers: { 'Accept': 'application/json' },
    });
    await safeParseResponse<{ success: boolean; message?: string }>(
      res,
      'Gagal menghapus streamer'
    );
  } catch (err: any) {
    console.warn('Primary delete endpoint failed, trying fallback /api/streamers-delete:', err);
    try {
      const res = await fetch('/api/streamers-delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ id }),
      });
      await safeParseResponse<{ success: boolean; message?: string }>(
        res,
        'Gagal menghapus streamer'
      );
    } catch (fallbackErr: any) {
      console.warn('Fallback delete endpoint also failed:', fallbackErr);
    }
  }

  // Always update local cache so streamer disappears immediately
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

  // Use POST /update as primary to bypass 405 Method Not Allowed proxy issues
  try {
    const res = await fetch(`/api/reports/${cleanId}/update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const json = await safeParseResponse<{ success: boolean; data: LiveReport }>(
      res,
      'Gagal memperbarui laporan'
    );
    return json.data;
  } catch (err: any) {
    console.warn('Primary report update failed, trying fallback /api/reports-update:', err);
    const fallbackRes = await fetch('/api/reports-update', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ id, ...payload }),
    });
    const json = await safeParseResponse<{ success: boolean; data: LiveReport }>(
      fallbackRes,
      'Gagal memperbarui laporan'
    );
    return json.data;
  }
}

export async function deleteReport(id: string): Promise<void> {
  const cleanId = encodeURIComponent(id.trim());

  // Use POST /delete as primary to completely avoid 405 Method Not Allowed
  try {
    const res = await fetch(`/api/reports/${cleanId}/delete`, {
      method: 'POST',
      headers: { 'Accept': 'application/json' },
    });
    await safeParseResponse<{ success: boolean }>(res, 'Gagal menghapus laporan');
  } catch (err: any) {
    console.warn('Primary report delete failed, trying fallback /api/reports-delete:', err);
    const fallbackRes = await fetch('/api/reports-delete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ id }),
    });
    await safeParseResponse<{ success: boolean }>(fallbackRes, 'Gagal menghapus laporan');
  }
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
