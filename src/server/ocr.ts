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
Lakukan ekstraksi semantik data performa live streaming Shopee Live dari screenshot laporan yang diberikan.

PENTING - ATURAN BACA LABEL:
Shopee Live memiliki berbagai variasi layout layar (desktop seller centre, aplikasi mobile Shopee Live host, tab ringkasan performa).
Oleh karena itu:
- Anda HARUS mencocokkan setiap nilai angka dengan LABEL METRIK-nya (bukan berdasarkan koordinat pixel).
- Pahami bahasa Indonesia dengan tepat:
  1. "Status Pesanan" (misal: "Pesanan Dibuat", "Pesanan Selesai", "Pesanan Terkonfirmasi")
  2. "Penjualan" / "Total Penjualan" / "Nilai Penjualan" (dalam format Rupiah Rp, misal "1.243.800" diubah menjadi integer murni: 1243800)
  3. "Penonton Aktif" (Active Viewers, integer murni)
  4. "Komentar" (Comments, integer murni)
  5. "Tambah ke Keranjang" / "Dimasukkan ke Keranjang" (Add to cart, integer murni)
  6. "Dilihat" / "Total Dilihat" (Views, integer murni)
  7. "Durasi Rata-Rata Menonton" (Average watch duration, pertahankan format string HH:MM:SS, contoh: "00:00:35")
  8. "Persentase Komentar" (Comment rate %, ubah "0,8%" atau "0.8%" menjadi angka float: 0.8)
  9. "Penjualan per mil" / "Penjualan per 1000 Tayangan" (Sales per mille dalam Rp, integer murni, contoh: 406338)
  10. "Pesanan" / "Total Pesanan" (Orders, integer murni)
  11. "Nilai Penjualan per Pesanan" / "Rata-rata Penjualan per Pesanan" (Rupiah integer murni, contoh: 113073)
  12. "Penonton" / "Total Penonton" (Viewers, integer murni)
  13. "Penonton Tertinggi" / "Peak Viewers" (Peak viewers, integer murni)
  14. "Persentase Klik" / "Rasio Klik" (Click rate %, float angka, contoh: 3.7)
  15. "Pesanan per Klik" / "Rasio Pesanan per Klik" (Order click rate %, float angka, contoh: 9.7)
  16. "Pembeli" / "Total Pembeli Unik" (Buyers, integer murni)
  17. "Produk Terjual" / "Total Produk Terjual" (Products sold, integer murni)

ATURAN FORMAT INDONESIA:
- Titik (.) pada angka Rupiah/ribuan adalah pemisah ribuan: "1.243.800" => 1243800
- Koma (,) pada persentase/desimal adalah pemisah desimal: "0,8%" => 0.8, "3,7%" => 3.7
- Durasi: jika tertulis "35 dtk" atau "00:35" konversi menjadi format baku "00:00:35". Jika "1 mnt 15 dtk" konversi menjadi "00:01:15".

ATURAN VALIDASI KEASLIAN:
- JANGAN mengarang atau menghalusinasi angka!
- Jika sebuah label metrik tidak ditemukan atau tidak tampak pada screenshot, kembalikan value: null, status: "missing".
- Jika angka agak buram namun terbaca dengan kemungkinan variasi, beri status: "warning".
- Jika label dan angka terbaca jelas dan cocok, beri status: "success".

FORMAT JSON OUTPUT YANG WAJIB DIHASILKAN (Kembalikan HANYA JSON murni tanpa backticks markdown):
{
  "order_status": { "value": "Pesanan Dibuat", "status": "success", "raw_text": "Pesanan Dibuat" },
  "sales": { "value": 1243800, "status": "success", "raw_text": "Rp 1.243.800" },
  "active_viewers": { "value": 412, "status": "success", "raw_text": "412" },
  "comments": { "value": 24, "status": "success", "raw_text": "24" },
  "add_to_cart": { "value": 72, "status": "success", "raw_text": "72" },
  "views": { "value": 3061, "status": "success", "raw_text": "3.061" },
  "avg_watch_duration": { "value": "00:00:35", "status": "success", "raw_text": "00:00:35" },
  "comment_rate": { "value": 0.8, "status": "success", "raw_text": "0,8%" },
  "sales_per_mille": { "value": 406338, "status": "success", "raw_text": "Rp 406.338" },
  "orders": { "value": 11, "status": "success", "raw_text": "11" },
  "sales_per_order": { "value": 113073, "status": "success", "raw_text": "Rp 113.073" },
  "viewers": { "value": 2643, "status": "success", "raw_text": "2.643" },
  "peak_viewers": { "value": 101, "status": "success", "raw_text": "101" },
  "click_rate": { "value": 3.7, "status": "success", "raw_text": "3,7%" },
  "order_click_rate": { "value": 9.7, "status": "success", "raw_text": "9,7%" },
  "buyers": { "value": 11, "status": "success", "raw_text": "11" },
  "products_sold": { "value": 23, "status": "success", "raw_text": "23" }
}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
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
        temperature: 0.1, // High precision
        responseMimeType: 'application/json',
      },
    });

    const responseText = response.text || '';
    if (!responseText) {
      throw new Error('AI tidak mengembalikan respon teks dari gambar.');
    }

    // Clean JSON if needed
    let cleanJson = responseText.trim();
    if (cleanJson.startsWith('```json')) {
      cleanJson = cleanJson.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    const parsed = JSON.parse(cleanJson);
    return sanitizeOCRResult(parsed);
  } catch (err: any) {
    console.error('Gemini Vision OCR Error:', err);
    throw new Error(err.message || 'Gagal memproses screenshot dengan Vision AI.');
  }
}

function sanitizeOCRResult(raw: any): OCRResultData {
  const sanitizeField = (field: any, defaultVal: any = null, isNumeric = false): any => {
    if (!field) {
      return { value: defaultVal, status: 'missing', raw_text: '-' };
    }

    let val = field.value !== undefined ? field.value : defaultVal;
    let status = field.status || 'success';

    if (isNumeric && val !== null && val !== undefined) {
      if (typeof val === 'string') {
        const cleaned = val.replace(/[^0-9.,-]/g, '').replace(',', '.');
        const num = parseFloat(cleaned);
        val = isNaN(num) ? defaultVal : num;
      }
    }

    return {
      value: val,
      status: val === null ? 'missing' : status,
      raw_text: field.raw_text || (val !== null ? String(val) : '-'),
      note: field.note || '',
    };
  };

  return {
    order_status: {
      value: raw.order_status?.value || 'Pesanan Dibuat',
      status: raw.order_status?.status || 'success',
      raw_text: raw.order_status?.raw_text || 'Pesanan Dibuat',
    },
    sales: sanitizeField(raw.sales, 0, true),
    active_viewers: sanitizeField(raw.active_viewers, 0, true),
    comments: sanitizeField(raw.comments, 0, true),
    add_to_cart: sanitizeField(raw.add_to_cart, 0, true),
    views: sanitizeField(raw.views, 0, true),
    avg_watch_duration: {
      value: raw.avg_watch_duration?.value || '00:00:00',
      status: raw.avg_watch_duration?.status || 'success',
      raw_text: raw.avg_watch_duration?.raw_text || '00:00:00',
    },
    comment_rate: sanitizeField(raw.comment_rate, 0, true),
    sales_per_mille: sanitizeField(raw.sales_per_mille, 0, true),
    orders: sanitizeField(raw.orders, 0, true),
    sales_per_order: sanitizeField(raw.sales_per_order, 0, true),
    viewers: sanitizeField(raw.viewers, 0, true),
    peak_viewers: sanitizeField(raw.peak_viewers, 0, true),
    click_rate: sanitizeField(raw.click_rate, 0, true),
    order_click_rate: sanitizeField(raw.order_click_rate, 0, true),
    buyers: sanitizeField(raw.buyers, 0, true),
    products_sold: sanitizeField(raw.products_sold, 0, true),
  };
}
