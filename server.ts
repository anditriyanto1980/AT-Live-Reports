import express, { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { processShopeeScreenshot } from './src/server/ocr';
import { storage } from './src/server/storage';

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// Enable CORS and handle preflight OPTIONS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-HTTP-Method-Override');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// Parse JSON and urlencoded for API routes (allow 25MB for high-res screenshots Base64)
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Multer in-memory storage (HARD REQUIREMENT: screenshot is only in RAM and deleted after OCR)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB limit
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const mime = (file.mimetype || '').toLowerCase();
    if (allowedTypes.includes(mime) || mime.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Format file tidak didukung. Harap upload format JPG, JPEG, PNG, atau WebP.'));
    }
  },
});

// ==========================================
// 1. CANONICAL OCR ENDPOINT: POST /api/ocr
// ==========================================
const handleOCR = async (req: Request, res: Response) => {
  console.log('[OCR] Request received');
  console.log(`[OCR] Method: ${req.method}`);

  // Check if payload is JSON with Base64 image
  if (req.body && (req.body.imageBase64 || req.body.file || req.body.image)) {
    try {
      const rawBase64 = String(req.body.imageBase64 || req.body.file || req.body.image);
      const cleanBase64 = rawBase64.includes(',') ? rawBase64.split(',')[1] : rawBase64;
      const buffer = Buffer.from(cleanBase64, 'base64');
      const mimeType = req.body.mimeType || 'image/jpeg';

      console.log(`[OCR] File received: true (Base64 payload)`);
      console.log(`[OCR] MIME type: ${mimeType}`);
      console.log('[OCR] Starting AI extraction');

      const extractedData = await processShopeeScreenshot(buffer, mimeType);
      buffer.fill(0); // Immediately purge buffer from RAM

      console.log('[OCR] Extraction successful');
      return res.status(200).json({
        success: true,
        message: 'Screenshot berhasil diekstraksi secara semantik.',
        data: extractedData,
      });
    } catch (aiErr: any) {
      console.error('[OCR] Extraction failed:', aiErr.message || aiErr);
      return res.status(500).json({
        success: false,
        error: aiErr.message || 'Gagal memproses screenshot dengan Vision AI.',
      });
    }
  }

  // Multipart / FormData file upload
  upload.single('file')(req, res, async (err: any) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({
            success: false,
            error: 'Ukuran file terlalu besar. Maksimal ukuran file adalah 25 MB.',
          });
        }
        return res.status(400).json({ success: false, error: `Upload error: ${err.message}` });
      }
      return res.status(400).json({ success: false, error: err.message || 'Gagal memproses file upload.' });
    }

    if (!req.file || !req.file.buffer) {
      // In case body was populated during form parsing
      if (req.body && (req.body.imageBase64 || req.body.file)) {
        try {
          const rawBase64 = String(req.body.imageBase64 || req.body.file);
          const cleanBase64 = rawBase64.includes(',') ? rawBase64.split(',')[1] : rawBase64;
          const buffer = Buffer.from(cleanBase64, 'base64');
          const mimeType = req.body.mimeType || 'image/jpeg';

          console.log(`[OCR] File received: true (Form Base64)`);
          console.log(`[OCR] MIME type: ${mimeType}`);
          console.log('[OCR] Starting AI extraction');

          const extractedData = await processShopeeScreenshot(buffer, mimeType);
          buffer.fill(0);
          console.log('[OCR] Extraction successful');
          return res.status(200).json({
            success: true,
            message: 'Screenshot berhasil diekstraksi secara semantik.',
            data: extractedData,
          });
        } catch (aiErr: any) {
          console.error('[OCR] Extraction failed:', aiErr.message || aiErr);
          return res.status(500).json({ success: false, error: aiErr.message });
        }
      }

      console.log('[OCR] File received: false');
      return res.status(400).json({
        success: false,
        error: 'File screenshot tidak ditemukan. Harap sertakan file screenshot.',
      });
    }

    console.log(`[OCR] File received: true`);
    console.log(`[OCR] MIME type: ${req.file.mimetype}`);
    console.log('[OCR] Starting AI extraction');

    try {
      // Process image in memory via Vision AI (Gemini Flash)
      const extractedData = await processShopeeScreenshot(req.file.buffer, req.file.mimetype);

      // HARD REQUIREMENT: Screenshot memory buffer is purged immediately.
      req.file.buffer.fill(0);
      delete (req as any).file;

      console.log('[OCR] Extraction successful');
      return res.status(200).json({
        success: true,
        message: 'Screenshot berhasil diekstraksi secara semantik.',
        data: extractedData,
      });
    } catch (aiErr: any) {
      if (req.file) {
        req.file.buffer.fill(0);
        delete (req as any).file;
      }
      console.error('[OCR] Extraction failed:', aiErr.message || aiErr);
      return res.status(500).json({
        success: false,
        error: aiErr.message || 'Terjadi kesalahan saat mengekstraksi data screenshot dengan Vision AI.',
      });
    }
  });
};

// Mount OCR handlers
const ocrPostPaths = [
  '/api/ocr',
  '/ocr',
  '/api/ocr/',
  '/ocr/',
  '/api/ocr-process',
  '/ocr-process',
  '/api/ocr-base64',
  '/ocr-base64',
];
app.post(ocrPostPaths, handleOCR);

// GET /api/ocr MUST return HTTP 405 Method Not Allowed
const ocrGetPaths = ['/api/ocr', '/ocr', '/api/ocr/', '/ocr/'];
app.get(ocrGetPaths, (_req: Request, res: Response) => {
  res.setHeader('Allow', 'POST');
  return res.status(405).json({
    success: false,
    error: 'Endpoint OCR ditemukan tetapi HTTP method tidak sesuai. Pastikan aplikasi menggunakan POST /api/ocr.',
  });
});

// ==========================================
// RESET DATA API: POST /api/reset & /api/reset-data
// ==========================================
const handleResetData = (req: Request, res: Response) => {
  try {
    const { resetStreamers } = req.body || {};
    const result = storage.resetAllData({ resetStreamers: !!resetStreamers });
    console.log(`[RESET] Data reset executed. Reports removed: ${result.reportsRemoved}, Streamers removed: ${result.streamersRemoved}`);
    res.json({
      success: true,
      message: 'Seluruh data transaksi pendapatan dan laporan berhasil direset menjadi 0.',
      data: result,
    });
  } catch (err: any) {
    console.error('[RESET] Failed to reset data:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

app.post(['/api/reset', '/reset', '/api/reset-data', '/reset-data'], handleResetData);

// ==========================================
// 2. STREAMERS API
// ==========================================
app.get(['/api/streamers', '/streamers'], (_req: Request, res: Response) => {
  try {
    const streamers = storage.getStreamers();
    res.json({ success: true, data: streamers });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post(['/api/streamers', '/streamers'], (req: Request, res: Response) => {
  try {
    const { name, username, status } = req.body;
    if (!name || !username) {
      return res.status(400).json({ success: false, error: 'Nama dan Username wajib diisi.' });
    }
    const newStreamer = storage.createStreamer({ name, username, status: status || 'active' });
    res.status(201).json({ success: true, data: newStreamer });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Update streamer handler (supports PUT, PATCH, and POST for proxy compatibility)
const handleUpdateStreamer = (req: Request, res: Response) => {
  try {
    const id = req.params.id || req.body?.id;
    if (!id) {
      return res.status(400).json({ success: false, error: 'ID Streamer wajib disertakan.' });
    }
    const updated = storage.updateStreamer(id, req.body);
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
};

app.put(['/api/streamers/:id', '/streamers/:id'], handleUpdateStreamer);
app.patch(['/api/streamers/:id', '/streamers/:id'], handleUpdateStreamer);
app.post(['/api/streamers/:id/update', '/streamers/:id/update', '/api/streamers/:id', '/streamers/:id', '/api/streamers-update', '/streamers-update'], handleUpdateStreamer);

// Delete streamer handler (supports DELETE and POST for proxy compatibility)
const handleDeleteStreamer = (req: Request, res: Response) => {
  try {
    const id = req.params.id || req.body?.id;
    if (!id) {
      return res.status(400).json({ success: false, error: 'ID Streamer wajib disertakan.' });
    }
    storage.deleteStreamer(id);
    res.json({ success: true, message: 'Streamer berhasil dihapus.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

app.delete(['/api/streamers/:id', '/streamers/:id'], handleDeleteStreamer);
app.post(['/api/streamers/:id/delete', '/streamers/:id/delete', '/api/streamers-delete', '/streamers-delete'], handleDeleteStreamer);

// ==========================================
// 3. LIVE REPORTS API
// ==========================================
app.get(['/api/reports', '/reports'], (req: Request, res: Response) => {
  try {
    const { streamer_id, startDate, endDate, search, sortBy, sortOrder } = req.query;
    const reports = storage.getReports({
      streamerId: streamer_id as string,
      startDate: startDate as string,
      endDate: endDate as string,
      search: search as string,
      sortBy: sortBy as string,
      sortOrder: sortOrder as 'asc' | 'desc',
    });
    res.json({ success: true, data: reports });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get(['/api/reports/check-duplicate', '/reports/check-duplicate'], (req: Request, res: Response) => {
  try {
    const { report_date, streamer_id, exclude_id } = req.query;
    if (!report_date || !streamer_id) {
      return res.status(400).json({ success: false, error: 'report_date dan streamer_id diperlukan.' });
    }
    const duplicate = storage.findDuplicate(
      report_date as string,
      streamer_id as string,
      exclude_id as string
    );
    res.json({
      success: true,
      exists: !!duplicate,
      data: duplicate || null,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post(['/api/reports', '/reports'], (req: Request, res: Response) => {
  try {
    const { overwrite, ...reportData } = req.body;
    if (!reportData.report_date || !reportData.streamer_id) {
      return res.status(400).json({ success: false, error: 'Tanggal laporan dan streamer wajib dipilih.' });
    }

    const saved = storage.createReport(reportData, overwrite === true);
    res.status(201).json({ success: true, data: saved });
  } catch (err: any) {
    if (err.isDuplicate) {
      return res.status(409).json({
        success: false,
        isDuplicate: true,
        existingReport: err.existingReport,
        error: err.message,
      });
    }
    res.status(400).json({ success: false, error: err.message });
  }
});

// Update report handler (supports PUT, PATCH, and POST for proxy compatibility)
const handleUpdateReport = (req: Request, res: Response) => {
  try {
    const id = (req.params.id || req.body?.id || '').trim();
    if (!id) {
      return res.status(400).json({ success: false, error: 'ID laporan diperlukan.' });
    }
    const updated = storage.updateReport(id, req.body);
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
};

app.put(['/api/reports/:id', '/reports/:id'], handleUpdateReport);
app.patch(['/api/reports/:id', '/reports/:id'], handleUpdateReport);
app.post(['/api/reports/:id/update', '/reports/:id/update', '/api/reports/:id', '/reports/:id', '/api/reports-update', '/reports-update'], handleUpdateReport);

// Delete report handler (supports DELETE and POST for proxy compatibility, idempotent)
const handleDeleteReport = (req: Request, res: Response) => {
  try {
    const id = (req.params.id || req.body?.id || '').trim();
    if (!id) {
      return res.status(400).json({ success: false, error: 'ID laporan diperlukan.' });
    }
    storage.deleteReport(id);
    res.json({ success: true, message: 'Laporan berhasil dihapus.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

app.delete(['/api/reports/:id', '/reports/:id'], handleDeleteReport);
app.post(['/api/reports/:id/delete', '/reports/:id/delete', '/api/reports-delete', '/reports-delete'], handleDeleteReport);

// ==========================================
// 4. ANALYTICS API
// ==========================================
app.get(['/api/analytics/summary', '/analytics/summary'], (req: Request, res: Response) => {
  try {
    const { streamer_id, startDate, endDate } = req.query;
    const analytics = storage.getAnalyticsSummary({
      streamerId: streamer_id as string,
      startDate: startDate as string,
      endDate: endDate as string,
    });
    res.json({ success: true, data: analytics });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get(['/api/streamers/:id/analytics', '/streamers/:id/analytics'], (req: Request, res: Response) => {
  try {
    const streamer = storage.getStreamerById(req.params.id);
    if (!streamer) {
      return res.status(404).json({ success: false, error: 'Streamer tidak ditemukan.' });
    }

    const reports = storage.getReports({
      streamerId: req.params.id,
      sortBy: 'report_date',
      sortOrder: 'asc',
    });

    const analytics = storage.getAnalyticsSummary({ streamerId: req.params.id });

    res.json({
      success: true,
      data: {
        streamer,
        reports,
        summary: analytics.summary,
        salesByDay: analytics.salesByDay,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Users list (for role testing and authentication mock/sync)
app.get(['/api/users', '/users'], (_req: Request, res: Response) => {
  try {
    const users = storage.getUsers();
    res.json({ success: true, data: users });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// System Status (Vercel / Supabase info)
app.get(['/api/status', '/status'], (_req: Request, res: Response) => {
  res.json({
    status: 'online',
    appName: 'SRA LIVE STREAM ANALYTICS',
    geminiConfigured: !!process.env.GEMINI_API_KEY,
    supabaseConfigured: !!(process.env.VITE_SUPABASE_URL && process.env.VITE_SUPABASE_ANON_KEY),
    temporaryStorageOnly: true,
    timestamp: new Date().toISOString(),
  });
});

// ==========================================
// 5. DEV SERVER (VITE) & PROD STATIC SERVING
// ==========================================
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SRA LIVE ANALYTICS] Server running at http://0.0.0.0:${PORT}`);
  });
}

// Only start the standalone server if NOT running inside Vercel Serverless Function
if (!process.env.VERCEL) {
  startServer().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}

export default app;

