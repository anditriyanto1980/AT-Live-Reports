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
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// Parse JSON and urlencoded for API routes
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Multer in-memory storage (HARD REQUIREMENT: screenshot is only in RAM and deleted after OCR)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype.toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error('Format file tidak didukung. Harap upload format JPG, JPEG, PNG, atau WebP.'));
    }
  },
});

// ==========================================
// 1. CANONICAL OCR ENDPOINT: POST /api/ocr
// ==========================================
app.post('/api/ocr', (req: Request, res: Response, next: NextFunction) => {
  upload.single('file')(req, res, async (err: any) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            error: 'Ukuran file terlalu besar. Maksimal ukuran file adalah 10 MB.',
          });
        }
        return res.status(400).json({ success: false, error: `Upload error: ${err.message}` });
      }
      return res.status(400).json({ success: false, error: err.message || 'Gagal memproses file upload.' });
    }

    if (!req.file || !req.file.buffer) {
      return res.status(400).json({
        success: false,
        error: 'File screenshot tidak ditemukan. Harap sertakan file pada field "file".',
      });
    }

    try {
      // Process image in memory via Vision AI (Gemini Flash)
      const extractedData = await processShopeeScreenshot(req.file.buffer, req.file.mimetype);

      // HARD REQUIREMENT: Screenshot memory buffer is purged immediately.
      // Do NOT keep any reference or save image to database or filesystem.
      req.file.buffer = Buffer.alloc(0);
      delete (req as any).file;

      return res.status(200).json({
        success: true,
        message: 'Screenshot berhasil diekstraksi secara semantik.',
        data: extractedData,
      });
    } catch (aiErr: any) {
      // Ensure memory cleanup on error as well
      if (req.file) {
        req.file.buffer = Buffer.alloc(0);
        delete (req as any).file;
      }
      console.error('OCR processing failed:', aiErr);
      return res.status(500).json({
        success: false,
        error: aiErr.message || 'Terjadi kesalahan saat mengekstraksi data screenshot dengan Vision AI.',
      });
    }
  });
});

// ==========================================
// 2. STREAMERS API
// ==========================================
app.get('/api/streamers', (_req: Request, res: Response) => {
  try {
    const streamers = storage.getStreamers();
    res.json({ success: true, data: streamers });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/streamers', (req: Request, res: Response) => {
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

app.put('/api/streamers/:id', (req: Request, res: Response) => {
  try {
    const updated = storage.updateStreamer(req.params.id, req.body);
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.delete('/api/streamers/:id', (req: Request, res: Response) => {
  try {
    const success = storage.deleteStreamer(req.params.id);
    if (!success) {
      return res.status(404).json({ success: false, error: 'Streamer tidak ditemukan.' });
    }
    res.json({ success: true, message: 'Streamer berhasil dihapus.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 3. LIVE REPORTS API
// ==========================================
app.get('/api/reports', (req: Request, res: Response) => {
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

app.get('/api/reports/check-duplicate', (req: Request, res: Response) => {
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

app.post('/api/reports', (req: Request, res: Response) => {
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

app.put('/api/reports/:id', (req: Request, res: Response) => {
  try {
    const updated = storage.updateReport(req.params.id, req.body);
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.delete('/api/reports/:id', (req: Request, res: Response) => {
  try {
    const success = storage.deleteReport(req.params.id);
    if (!success) {
      return res.status(404).json({ success: false, error: 'Laporan tidak ditemukan.' });
    }
    res.json({ success: true, message: 'Laporan berhasil dihapus.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 4. ANALYTICS API
// ==========================================
app.get('/api/analytics/summary', (req: Request, res: Response) => {
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

app.get('/api/streamers/:id/analytics', (req: Request, res: Response) => {
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
app.get('/api/users', (_req: Request, res: Response) => {
  try {
    const users = storage.getUsers();
    res.json({ success: true, data: users });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// System Status (Vercel / Supabase info)
app.get('/api/status', (_req: Request, res: Response) => {
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

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
