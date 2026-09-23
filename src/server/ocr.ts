import { GoogleGenAI } from '@google/genai';
import { OCRResultData } from '../types';

// Initialize Gemini client strictly on server-side
const apiKey = process.env.GEMINI_API_KEY || '';

const ai = new GoogleGenAI({
  apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Candidate models in priority order.
// gemini-2.5-flash is primary because of its exceptional vision accuracy and low latency.
const CANDIDATE_MODELS = [
  'gemini-2.5-flash',
  'gemini-flash-latest',
  'gemini-3.1-flash-lite',
  'gemini-3.8-flash',
];

export async function processShopeeScreenshot(
  imageBuffer: Buffer,
  mimeType: string
): Promise<OCRResultData> {
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY belum dikonfigurasi pada server environment.');
  }

  const base64Data = imageBuffer.toString('base64');

  const systemPrompt = `Anda adalah spesialis Vision AI dan OCR analitik data Shopee Live profesional.
TUGAS UTAMA:
Lakukan ekstraksi data performa live streaming Shopee Live dari screenshot laporan yang diberikan DENGAN SANGAT AKURAT DAN TEPAT SESUAI TAMPILAN GAMBAR.

PENTING - ATURAN BACA LABEL DAN NILAI ANGKA:
1. BACA NILAI PERSIS SEPERTI YANG TERTULIS PADA GAMBAR:
   - DILARANG KERAS MENGARANG ATAU MENGGUNAKAN NILAI DEFAULT!
   - Contoh nyata: Jika terdapat kartu dengan judul "Penjualan (Rp)" dan angka yang tertulis di dalamnya adalah "1.243.800", maka nilai "sales" HARUS bernilai integer 1243800 dan raw_text adalah "Rp 1.243.800" atau "1.243.800". JANGAN PERNAH mengeluarkan 1850000 kecuali jika gambar benar-benar tertulis 1.850.000!
   - Abaikan simbol informasi atau ikon bantuan (seperti ikon "i" di dalam lingkaran) yang ada di samping angka.

2. METRIK-METRIK YANG DIEKSTRAK (17 Metrik):
   1. order_status: Status pesanan (contoh: "Pesanan Dibuat", "Pesanan Selesai", "Pesanan Terkonfirmasi")
   2. sales: Nilai Penjualan dalam Rupiah (integer murni, contoh: "1.243.800" => 1243800)
   3. active_viewers: Penonton Aktif saat live (integer murni)
   4. comments: Komentar (integer murni)
   5. add_to_cart: Produk dimasukkan ke keranjang / Tambah ke Keranjang (integer murni)
   6. views: Total Dilihat / Tayangan (integer murni, contoh: "3.061" => 3061)
   7. avg_watch_duration: Durasi Rata-Rata Menonton dalam format string HH:MM:SS (contoh: "00:00:35")
   8. comment_rate: Persentase Komentar dalam float angka desimal (contoh: "0,8%" => 0.8)
   9. sales_per_mille: Penjualan per mil / Penjualan per 1000 Tayangan (integer Rupiah)
   10. orders: Total Pesanan (integer murni)
   11. sales_per_order: Nilai Penjualan per Pesanan (integer Rupiah)
   12. viewers: Total Penonton / Penonton Unik (integer murni)
   13. peak_viewers: Penonton Tertinggi / Peak Viewers (integer murni)
   14. click_rate: Persentase Klik Produk dalam float angka desimal (contoh: "3,7%" => 3.7)
   15. order_click_rate: Pesanan per Klik / Rasio Pesanan per Klik dalam float desimal (contoh: "9,7%" => 9.7)
   16. buyers: Total Pembeli / Pembeli Unik (integer murni)
   17. products_sold: Total Produk Terjual (integer murni)

3. ATURAN FORMAT ANGKA INDONESIA:
   - Titik (.) adalah pemisah ribuan: "1.243.800" => integer 1243800, "3.061" => integer 3061.
   - Koma (,) adalah pemisah desimal: "0,8%" => float 0.8, "14,8%" => float 14.8.
   - Durasi waktu: Ubah format pendek seperti "35 dtk" menjadi "00:00:35".

4. TAMPILAN PARSIAL / POTONGAN GAMBAR (CROP):
   - Jika gambar yang diunggah hanya merupakan potongan gambar (misalnya hanya satu kartu "Penjualan (Rp) 1.243.800"):
     - Ekstrak metrik yang tampak ("sales") dengan nilai sesuai gambar dan status "success".
     - Metrik lain yang tidak tampak dalam screenshot diberi nilai 0 (atau null), status "missing", dan raw_text "-".

5. STATUS VALIDASI:
   - status "success": Angka terbaca jelas pada gambar.
   - status "warning": Angka agak buram atau perlu dikonfirmasi.
   - status "missing": Metrik tidak ditemukan pada gambar screenshot.

FORMAT JSON OUTPUT YANG WAJIB DIHASILKAN (Kembalikan HANYA JSON murni tanpa markdown backticks):
{
  "order_status": { "value": "Pesanan Dibuat", "status": "success", "raw_text": "Pesanan Dibuat" },
  "sales": { "value": 1243800, "status": "success", "raw_text": "Rp 1.243.800" },
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

  let lastError: Error | null = null;

  // Try candidate models in order of precision and availability
  for (const modelName of CANDIDATE_MODELS) {
    try {
      console.log(`[Vision OCR] Trying model: ${modelName}...`);
      const response = await ai.models.generateContent({
        model: modelName,
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  data: base64Data,
                  mimeType: mimeType || 'image/jpeg',
                },
              },
              {
                text: systemPrompt,
              },
            ],
          },
        ],
        config: {
          temperature: 0.0, // Zero temperature for maximum determinism and OCR precision
          responseMimeType: 'application/json',
        },
      });

      const responseText = response.text || '';
      if (!responseText.trim()) {
        throw new Error(`Model ${modelName} returned empty text.`);
      }

      // Robust extraction of JSON from response text
      let cleanJson = responseText.trim();
      const firstBrace = cleanJson.indexOf('{');
      const lastBrace = cleanJson.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        cleanJson = cleanJson.slice(firstBrace, lastBrace + 1);
      } else {
        if (cleanJson.startsWith('```json')) {
          cleanJson = cleanJson.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (cleanJson.startsWith('```')) {
          cleanJson = cleanJson.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
      }

      const parsed = JSON.parse(cleanJson);
      const sanitized = sanitizeOCRResult(parsed);
      console.log(`[Vision OCR] Extraction successful with model: ${modelName}`);
      return sanitized;
    } catch (err: any) {
      console.warn(`[Vision OCR] Model ${modelName} failed:`, err.message || err);
      lastError = err;
    }
  }

  // If all models failed, throw clean error explaining what happened instead of fake dummy numbers!
  console.error('[Vision OCR] All candidate models failed. Last error:', lastError);
  throw new Error(
    lastError?.message ||
      'Vision AI tidak dapat mengekstrak data dari screenshot. Pastikan screenshot jelas dan terbaca.'
  );
}

/**
 * Parser for Indonesian formatted numbers and strings:
 * - "1.243.800" => 1243800 (strips dot thousand separators)
 * - "Rp 1.243.800" => 1243800
 * - "3.061" => 3061
 * - "0,8%" => 0.8
 * - "14,8%" => 14.8
 */
export function parseIndonesianNumber(val: any, isPercentage = false): number {
  if (typeof val === 'number') {
    return isNaN(val) ? 0 : val;
  }
  if (!val) return 0;

  let str = String(val).trim();

  if (isPercentage) {
    str = str.replace(/%/g, '').trim().replace(',', '.');
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
  }

  // Remove trailing decimal cents if any (e.g. ,00)
  if (str.includes(',') && str.indexOf(',') === str.length - 3) {
    str = str.slice(0, str.indexOf(','));
  }

  // Strip all dots and non-numeric characters (except minus sign)
  const cleaned = str.replace(/[^0-9-]/g, '');
  const parsedInt = parseInt(cleaned, 10);
  return isNaN(parsedInt) ? 0 : parsedInt;
}

function sanitizeOCRResult(raw: any): OCRResultData {
  const sanitizeField = (
    field: any,
    defaultVal: number = 0,
    isPercentage = false
  ): { value: number; status: 'success' | 'warning' | 'missing'; raw_text: string; note: string } => {
    if (!field) {
      return { value: defaultVal, status: 'missing', raw_text: '-', note: '' };
    }

    const rawText = field.raw_text !== undefined ? String(field.raw_text) : '';
    let parsedValue = defaultVal;

    if (field.value !== undefined && field.value !== null) {
      parsedValue = parseIndonesianNumber(field.value, isPercentage);
    } else if (rawText && rawText !== '-') {
      parsedValue = parseIndonesianNumber(rawText, isPercentage);
    }

    const status = field.status || (parsedValue > 0 ? 'success' : 'missing');

    return {
      value: parsedValue,
      status: status,
      raw_text: rawText || (parsedValue > 0 ? String(parsedValue) : '-'),
      note: field.note || '',
    };
  };

  // Duration parser: e.g. "00:00:35", "35 dtk", "1 mnt 20 dtk"
  const sanitizeDuration = (field: any): { value: string; status: 'success' | 'warning' | 'missing'; raw_text: string } => {
    if (!field) {
      return { value: '00:00:00', status: 'missing', raw_text: '-' };
    }
    const rawText = String(field.raw_text || field.value || '').trim();
    if (!rawText || rawText === '-') {
      return { value: '00:00:00', status: 'missing', raw_text: '-' };
    }

    // If already in HH:MM:SS format
    if (/^\d{2}:\d{2}:\d{2}$/.test(rawText)) {
      return { value: rawText, status: field.status || 'success', raw_text: rawText };
    }

    // If in MM:SS format
    if (/^\d{2}:\d{2}$/.test(rawText)) {
      return { value: `00:${rawText}`, status: field.status || 'success', raw_text: rawText };
    }

    return {
      value: String(field.value || '00:00:00'),
      status: field.status || 'success',
      raw_text: rawText,
    };
  };

  return {
    order_status: {
      value: String(raw.order_status?.value || 'Pesanan Dibuat'),
      status: raw.order_status?.status || 'success',
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
