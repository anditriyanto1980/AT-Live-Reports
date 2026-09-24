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
    let errorMsg = defaultErrorMsg;
    if (typeof json?.error === 'string') {
      errorMsg = json.error;
    } else if (typeof json?.error?.message === 'string') {
      errorMsg = json.error.message;
    } else if (typeof json?.message === 'string') {
      errorMsg = json.message;
    } else if (text && text.length < 300 && !text.includes('<!doctype') && !text.includes('<html')) {
      errorMsg = text;
    } else {
      errorMsg = `${defaultErrorMsg} (Status ${res.status})`;
    }

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

// Automatically optimize oversized screenshots to ensure compliance with Vercel's 4.5MB Serverless payload limit
async function optimizeScreenshotIfNeeded(file: File): Promise<File> {
  if (typeof window === 'undefined' || !window.document || file.size <= 2.5 * 1024 * 1024) {
    return file;
  }
  try {
    return await new Promise<File>((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const maxDim = 1600;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(file);
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const optFile = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
                type: 'image/jpeg',
              });
              resolve(optFile);
            } else {
              resolve(file);
            }
          },
          'image/jpeg',
          0.88
        );
      };
      img.onerror = () => resolve(file);
      img.src = url;
    });
  } catch {
    return file;
  }
}

export async function uploadScreenshotOCR(file: File): Promise<OCRResponse> {
  const readyFile = await optimizeScreenshotIfNeeded(file);

  // Primary Canonical Approach: Standard Multipart/form-data via POST /api/ocr
  // NOTE: Do NOT set Content-Type header manually; browser automatically sets boundary!
  const formData = new FormData();
  formData.append('file', readyFile);

  try {
    const res = await fetch('/api/ocr', {
      method: 'POST',
      body: formData,
    });

    if (res.status === 405) {
      throw new Error(
        'Endpoint OCR ditemukan tetapi HTTP method tidak sesuai (405). Pastikan folder /api/ sudah di-push ke GitHub dan ter-deploy di Vercel.'
      );
    }

    if (res.status === 413) {
      throw new Error('Ukuran file screenshot terlalu besar untuk serverless function (maks 4.5 MB).');
    }

    if (res.ok) {
      return await safeParseResponse<OCRResponse>(res, 'Gagal memproses screenshot');
    }

    // If an intermediate proxy blocks multipart uploads with 400/405/502, try JSON Base64 fallback
    const errText = await res.text();
    console.warn(`POST /api/ocr multipart returned status ${res.status}:`, errText);

    // Fallback: Convert to Base64 in browser
    const base64Data = await fileToBase64(readyFile);
    const jsonRes = await fetch('/api/ocr', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        imageBase64: base64Data.base64,
        mimeType: base64Data.mimeType,
        fileName: readyFile.name,
      }),
    });

    return await safeParseResponse<OCRResponse>(jsonRes, 'Gagal memproses screenshot dengan AI');
  } catch (err: any) {
    if (err.message && err.message.includes('405')) {
      throw new Error(
        'Endpoint OCR ditemukan tetapi HTTP method tidak sesuai (405). Pastikan folder /api/ sudah di-push ke GitHub dan ter-deploy di Vercel.'
      );
    }
    throw err;
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

export async function resetAllData(options?: { resetStreamers?: boolean }): Promise<{
  reportsRemoved: number;
  streamersRemoved: number;
}> {
  const res = await fetch('/api/reset', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({ resetStreamers: options?.resetStreamers || false }),
  });

  const json = await safeParseResponse<{
    success: boolean;
    message: string;
    data: { reportsRemoved: number; streamersRemoved: number };
  }>(res, 'Gagal mereset data');

  if (options?.resetStreamers) {
    try {
      localStorage.removeItem(LOCAL_STREAMERS_KEY);
    } catch {}
  }

  return json.data;
}
