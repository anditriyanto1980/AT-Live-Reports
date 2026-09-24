import { processShopeeScreenshot } from '../src/server/ocr';
import multer from 'multer';

// In-memory upload for serverless function
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB serverless limit
  },
});

function runMiddleware(req: any, res: any, fn: any) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result: any) => {
      if (result instanceof Error) {
        return reject(result);
      }
      return resolve(result);
    });
  });
}

export default async function handler(req: any, res: any) {
  // Setup CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GET /api/ocr MUST return 405 Method Not Allowed
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

  try {
    let buffer: Buffer | null = null;
    let mimeType = 'image/jpeg';

    // Scenario A: JSON with Base64 payload { imageBase64, mimeType }
    if (req.body && (req.body.imageBase64 || req.body.file || req.body.image)) {
      const rawBase64 = String(req.body.imageBase64 || req.body.file || req.body.image);
      const cleanBase64 = rawBase64.includes(',') ? rawBase64.split(',')[1] : rawBase64;
      buffer = Buffer.from(cleanBase64, 'base64');
      mimeType = req.body.mimeType || 'image/jpeg';
    } 
    // Scenario B: Multipart/form-data upload
    else {
      try {
        await runMiddleware(req, res, upload.single('file'));
      } catch (uploadErr: any) {
        return res.status(400).json({
          success: false,
          error: `Upload error: ${uploadErr.message || uploadErr}`,
        });
      }

      if (req.file && req.file.buffer) {
        buffer = req.file.buffer;
        mimeType = req.file.mimetype || 'image/jpeg';
      } else if (req.body && (req.body.imageBase64 || req.body.file)) {
        const rawBase64 = String(req.body.imageBase64 || req.body.file);
        const cleanBase64 = rawBase64.includes(',') ? rawBase64.split(',')[1] : rawBase64;
        buffer = Buffer.from(cleanBase64, 'base64');
        mimeType = req.body.mimeType || 'image/jpeg';
      }
    }

    if (!buffer || buffer.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'File screenshot tidak ditemukan. Harap sertakan file screenshot gambar.',
      });
    }

    // Call Vision AI extraction
    const extractedData = await processShopeeScreenshot(buffer, mimeType);
    
    // Purge buffer immediately
    buffer.fill(0);

    return res.status(200).json({
      success: true,
      message: 'Screenshot berhasil diekstraksi secara semantik.',
      data: extractedData,
    });
  } catch (err: any) {
    console.error('[API OCR Error]:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Terjadi kesalahan saat memproses OCR dengan Vision AI.',
    });
  }
}
