import { GoogleGenAI } from '@google/genai';

// Candidate models in priority order
const CANDIDATE_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
];

function parseIndonesianNumber(val: any, isPercentage = false): number {
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
  if (str.includes(',') && str.indexOf(',') === str.length - 3) {
    str = str.slice(0, str.indexOf(','));
  }
  const cleaned = str.replace(/[^0-9-]/g, '');
  const parsedInt = parseInt(cleaned, 10);
  return isNaN(parsedInt) ? 0 : parsedInt;
}

function sanitizeOCRResult(raw: any) {
  const sanitizeField = (field: any, defaultVal = 0, isPercentage = false) => {
    if (!field) return { value: defaultVal, status: 'missing', raw_text: '-', note: '' };
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
      status,
      raw_text: rawText || (parsedValue > 0 ? String(parsedValue) : '-'),
      note: field.note || '',
    };
  };

  const sanitizeDuration = (field: any) => {
    if (!field) return { value: '00:00:00', status: 'missing', raw_text: '-' };
    const rawText = String(field.raw_text || field.value || '').trim();
    if (!rawText || rawText === '-') return { value: '00:00:00', status: 'missing', raw_text: '-' };
    if (/^\d{2}:\d{2}:\d{2}$/.test(rawText)) return { value: rawText, status: field.status || 'success', raw_text: rawText };
    if (/^\d{2}:\d{2}$/.test(rawText)) return { value: `00:${rawText}`, status: field.status || 'success', raw_text: rawText };
    return { value: String(field.value || '00:00:00'), status: field.status || 'success', raw_text: rawText };
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

export default async function handler(req: any, res: any) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, Content-Type, Accept, Authorization, X-Requested-With');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({
      success: false,
      error: 'Endpoint OCR ditemukan tetapi HTTP method tidak sesuai. Pastikan aplikasi menggunakan POST /api/ocr.',
    });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({
      success: false,
      error: `Method ${req.method} tidak didukung. Gunakan POST /api/ocr.`,
    });
  }

  const apiKey =
    process.env.GEMINI_API_KEY ||
    process.env.VITE_GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    '';

  if (!apiKey) {
    return res.status(500).json({
      success: false,
      error: 'GEMINI_API_KEY belum dikonfigurasi di Environment Variables Vercel.',
    });
  }

  try {
    let cleanBase64 = '';
    let mimeType = 'image/jpeg';

    // Parse body (supports JSON directly parsed by Vercel)
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {}
    }

    if (body) {
      const raw = body.imageBase64 || body.file || body.image || '';
      if (raw) {
        cleanBase64 = String(raw).includes(',') ? String(raw).split(',')[1] : String(raw);
        mimeType = body.mimeType || 'image/jpeg';
      }
    }

    if (!cleanBase64) {
      return res.status(400).json({
        success: false,
        error: 'File screenshot tidak ditemukan. Harap sertakan screenshot gambar dalam format JSON base64.',
      });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    });

    const systemPrompt = `Anda adalah spesialis Vision AI dan OCR analitik data Shopee Live profesional.
Lakukan ekstraksi data performa live streaming Shopee Live dari screenshot laporan yang diberikan DENGAN SANGAT AKURAT DAN TEPAT SESUAI TAMPILAN GAMBAR.
PENTING:
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

    let lastError: Error | null = null;
    for (const modelName of CANDIDATE_MODELS) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: [
            {
              role: 'user',
              parts: [
                { inlineData: { data: cleanBase64, mimeType } },
                { text: systemPrompt },
              ],
            },
          ],
          config: {
            temperature: 0.0,
            responseMimeType: 'application/json',
          },
        });

        const responseText = response.text || '';
        let cleanJson = responseText.trim();
        const firstBrace = cleanJson.indexOf('{');
        const lastBrace = cleanJson.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          cleanJson = cleanJson.slice(firstBrace, lastBrace + 1);
        } else {
          cleanJson = cleanJson.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
        }

        const parsed = JSON.parse(cleanJson);
        const data = sanitizeOCRResult(parsed);

        return res.status(200).json({
          success: true,
          message: 'Screenshot berhasil diekstraksi secara semantik.',
          data,
        });
      } catch (err: any) {
        lastError = err;
      }
    }

    return res.status(500).json({
      success: false,
      error: lastError?.message || 'Gagal mengekstrak teks dengan Vision AI.',
    });
  } catch (outerErr: any) {
    return res.status(500).json({
      success: false,
      error: outerErr.message || 'Server error pada OCR handler.',
    });
  }
}
