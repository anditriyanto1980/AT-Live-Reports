import { LiveReport, Streamer, User, OCRResponse, OCRResultData } from '../types';

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

export function getClientGeminiApiKey(): string {
  if (typeof window === 'undefined') return '';
  return (
    localStorage.getItem('sra_gemini_api_key') ||
    (import.meta as any).env?.VITE_GEMINI_API_KEY ||
    ''
  );
}

export function setClientGeminiApiKey(key: string): void {
  if (typeof window !== 'undefined') {
    if (key.trim()) {
      localStorage.setItem('sra_gemini_api_key', key.trim());
    } else {
      localStorage.removeItem('sra_gemini_api_key');
    }
  }
}

export function parseIndonesianNumber(val: any, isPercentage = false): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  let str = String(val).trim();
  if (isPercentage) {
    str = str.replace(/%/g, '').trim().replace(',', '.');
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
  }
  if (str.includes(',') && str.indexOf(',') === str.length - 3) {
    str = str.slice(0, str.indexOf(','));
  }
  const cleaned = str.replace(/[^0-9-]/g, '');
  const parsedInt = parseInt(cleaned, 10);
  return isNaN(parsedInt) ? 0 : parsedInt;
}

export function sanitizeClientOCR(raw: any): OCRResultData {
  const sanitizeField = (field: any, defaultVal = 0, isPercentage = false) => {
    if (!field) return { value: defaultVal, status: 'missing' as const, raw_text: '-', note: '' };
    const rawText = field.raw_text !== undefined ? String(field.raw_text) : '';
    let parsedValue = defaultVal;
    if (field.value !== undefined && field.value !== null) {
      parsedValue = parseIndonesianNumber(field.value, isPercentage);
    } else if (rawText && rawText !== '-') {
      parsedValue = parseIndonesianNumber(rawText, isPercentage);
    }
    const status = (field.status || (parsedValue > 0 ? 'success' : 'missing')) as 'success' | 'warning' | 'missing';
    return {
      value: parsedValue,
      status,
      raw_text: rawText || (parsedValue > 0 ? String(parsedValue) : '-'),
      note: field.note || '',
    };
  };

  const sanitizeDuration = (field: any) => {
    if (!field) return { value: '00:00:00', status: 'missing' as const, raw_text: '-' };
    const rawText = String(field.raw_text || field.value || '').trim();
    if (!rawText || rawText === '-') return { value: '00:00:00', status: 'missing' as const, raw_text: '-' };
    if (/^\d{2}:\d{2}:\d{2}$/.test(rawText)) return { value: rawText, status: (field.status || 'success') as any, raw_text: rawText };
    if (/^\d{2}:\d{2}$/.test(rawText)) return { value: `00:${rawText}`, status: (field.status || 'success') as any, raw_text: rawText };
    return { value: String(field.value || '00:00:00'), status: (field.status || 'success') as any, raw_text: rawText };
  };

  return {
    order_status: {
      value: String(raw.order_status?.value || 'Pesanan Dibuat'),
      status: (raw.order_status?.status || 'success') as any,
      raw_text: String(raw.order_status?.raw_text || raw.order_status?.value || 'Pesanan Dibuat'),
      note: raw.order_status?.note || '',
    },
    sales: sanitizeField(raw.sales, 0, false),
    active_viewers: sanitizeField(raw.active_viewers, 0, false),
    comments: sanitizeField(raw.comments, 0, false),
    add_to_cart: sanitizeField(raw.add_to_cart, 0, false),
    views: sanitizeField(raw.views, 0, false),
    avg_watch_duration: sanitizeDuration(raw.avg_watch_duration),
    comment_rate: sanitizeField(raw.comment_rate, 0, true),
    sales_per_mille: sanitizeField(raw.sales_per_mille, 0, false),
    orders: sanitizeField(raw.orders, 0, false),
    sales_per_order: sanitizeField(raw.sales_per_order, 0, false),
    viewers: sanitizeField(raw.viewers, 0, false),
    peak_viewers: sanitizeField(raw.peak_viewers, 0, false),
    click_rate: sanitizeField(raw.click_rate, 0, true),
    order_click_rate: sanitizeField(raw.order_click_rate, 0, true),
    buyers: sanitizeField(raw.buyers, 0, false),
    products_sold: sanitizeField(raw.products_sold, 0, false),
  };
}

export async function directGeminiVisionOCR(base64Data: string, mimeType: string, apiKey: string): Promise<OCRResultData> {
  const models = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
  const prompt = `Anda adalah spesialis Vision AI dan OCR analitik data Shopee Live profesional.
Lakukan ekstraksi data performa live streaming Shopee Live dari screenshot laporan yang diberikan DENGAN SANGAT AKURAT DAN TEPAT SESUAI TAMPILAN GAMBAR.
1. BACA NILAI PERSIS SEPERTI YANG TERTULIS PADA GAMBAR: Dilarang mengarang atau menggunakan dummy!
2. Titik (.) adalah pemisah ribuan ("1.243.800" => 1243800), koma (,) pemisah desimal ("0,8%" => 0.8).
3. Jika metrik tidak tampak di gambar potongan, isi value 0 dan status "missing".

Kembalikan HANYA JSON murni (17 metrik):
{
  "order_status": { "value": "Pesanan Dibuat", "status": "success", "raw_text": "Pesanan Dibuat" },
  "sales": { "value": 0, "status": "success", "raw_text": "Rp 0" },
  "active_viewers": { "value": 0, "status": "missing", "raw_text": "-" },
  "comments": { "value": 0, "status": "missing", "raw_text": "-" },
  "add_to_cart": { "value": 0, "status": "missing", "raw_text": "-" },
  "views": { "value": 0, "status": "missing", "raw_text": "-" },
  "avg_watch_duration": { "value": "00:00:00", "status": "missing", "raw_text": "-" },
  "comment_rate": { "value": 0, "status": "missing", "raw_text": "-" },
  "sales_per_mille": { "value": 0, "status": "missing", "raw_text": "-" },
  "orders": { "value": 0, "status": "missing", "raw_text": "-" },
  "sales_per_order": { "value": 0, "status": "missing", "raw_text": "-" },
  "viewers": { "value": 0, "status": "missing", "raw_text": "-" },
  "peak_viewers": { "value": 0, "status": "missing", "raw_text": "-" },
  "click_rate": { "value": 0, "status": "missing", "raw_text": "-" },
  "order_click_rate": { "value": 0, "status": "missing", "raw_text": "-" },
  "buyers": { "value": 0, "status": "missing", "raw_text": "-" },
  "products_sold": { "value": 0, "status": "missing", "raw_text": "-" }
}`;

  let lastErr: any = null;
  for (const model of models) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                { inlineData: { mimeType: mimeType || 'image/jpeg', data: base64Data } },
                { text: prompt }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.0,
            responseMimeType: 'application/json'
          }
        })
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error?.message || `HTTP ${res.status}`);
      }

      const resData = await res.json();
      const rawText = resData.candidates?.[0]?.content?.parts?.[0]?.text;
      if (rawText) {
        let clean = rawText.trim();
        const first = clean.indexOf('{');
        const last = clean.lastIndexOf('}');
        if (first !== -1 && last > first) {
          clean = clean.slice(first, last + 1);
        } else {
          clean = clean.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        const parsed = JSON.parse(clean);
        return sanitizeClientOCR(parsed);
      }
    } catch (err: any) {
      lastErr = err;
    }
  }

  throw new Error(lastErr?.message || 'Gagal memproses Vision OCR langsung di browser.');
}

export async function uploadScreenshotOCR(file: File): Promise<OCRResponse> {
  const readyFile = await optimizeScreenshotIfNeeded(file);
  const base64Data = await fileToBase64(readyFile);

  // 1. Try Primary Serverless/Backend Route via JSON POST /api/ocr
  try {
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

    if (jsonRes.ok) {
      const data = await safeParseResponse<OCRResponse>(jsonRes, 'Gagal memproses screenshot dengan AI');
      if (data && data.success && data.data) {
        return data;
      }
    }

    const errText = await jsonRes.text().catch(() => '');
    console.warn(`[OCR API] Server returned status ${jsonRes.status}:`, errText);
  } catch (serverErr) {
    console.warn('[OCR API] Server route network error:', serverErr);
  }

  // 2. Client-Side Direct Vision AI Fallback
  // If the serverless container failed or is unavailable on Vercel, run directly in browser
  const clientApiKey = getClientGeminiApiKey();
  if (clientApiKey) {
    try {
      console.log('[OCR] Using direct Client-Side Gemini Vision extraction...');
      const extracted = await directGeminiVisionOCR(base64Data.base64, base64Data.mimeType, clientApiKey);
      return {
        success: true,
        message: 'Screenshot berhasil diekstraksi secara langsung di browser.',
        data: extracted,
      };
    } catch (clientErr: any) {
      console.error('[OCR] Client-side extraction error:', clientErr);
      throw new Error(`Gagal ekstraksi Vision AI: ${clientErr.message || clientErr}`);
    }
  }

  // If no server and no client key, throw helpful action-oriented error
  const customError: any = new Error(
    'Server backend Vercel sedang mengalami kendala. Masukkan Gemini API Key langsung di aplikasi agar ekstraksi OCR berjalan 100% instan di browser Anda.'
  );
  customError.needsClientKey = true;
  throw customError;
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
