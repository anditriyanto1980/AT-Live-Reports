import React, { useState, useEffect } from 'react';
import {
  Activity,
  Send,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Copy,
  Check,
  Terminal,
  Server,
  Zap,
  Clock,
  Layers,
  Sparkles,
  HelpCircle,
  ExternalLink,
  Code2,
} from 'lucide-react';
import { getClientGeminiApiKey } from '../lib/api';

interface HeaderEntry {
  key: string;
  value: string;
  isImportant?: boolean;
}

interface TestLog {
  id: string;
  timestamp: string;
  url: string;
  method: string;
  status: number;
  statusText: string;
  durationMs: number;
  headers: HeaderEntry[];
  rawBody: string;
  isJson: boolean;
  parsedJson?: any;
  analysis: {
    category: 'success' | 'warning' | 'error' | 'info';
    title: string;
    description: string;
    recommendation: string;
  };
}

export const Diagnostics: React.FC = () => {
  // Config state
  const [targetUrl, setTargetUrl] = useState<string>('/api/ocr');
  const [httpMethod, setHttpMethod] = useState<'GET' | 'POST' | 'OPTIONS' | 'PUT' | 'DELETE'>('POST');
  const [payloadType, setPayloadType] = useState<'sample_image' | 'empty' | 'json_empty' | 'custom'>('sample_image');
  const [customBody, setCustomBody] = useState<string>('{\n  "test": true\n}');
  const [contentType, setContentType] = useState<string>('application/json');

  // Execution state
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [activeLog, setActiveLog] = useState<TestLog | null>(null);
  const [history, setHistory] = useState<TestLog[]>([]);
  const [activeTab, setActiveTab] = useState<'formatted' | 'raw' | 'headers' | 'analysis'>('analysis');
  const [copied, setCopied] = useState<boolean>(false);

  // Automated suite state
  const [suiteRunning, setSuiteRunning] = useState<boolean>(false);
  const [suiteResults, setSuiteResults] = useState<{
    statusApi?: { ok: boolean; status: number; text: string; ms: number };
    optionsOcr?: { ok: boolean; status: number; allow: string; ms: number };
    getOcr?: { ok: boolean; status: number; isExpected405: boolean; ms: number };
    postOcr?: { ok: boolean; status: number; text: string; ms: number };
    clientGemini?: { ok: boolean; keyConfigured: boolean; message: string };
  }>({});

  // Generate a valid minimal base64 PNG for sample test
  const getSampleBase64Image = (): string => {
    // 1x1 orange pixel PNG in base64
    return 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
  };

  const getEffectiveRequestBody = (): string | undefined => {
    if (httpMethod === 'GET' || httpMethod === 'OPTIONS') {
      return undefined;
    }
    switch (payloadType) {
      case 'sample_image':
        return JSON.stringify(
          {
            imageBase64: getSampleBase64Image(),
            mimeType: 'image/png',
            fileName: 'diagnostic_sample.png',
            source: 'diagnostics_tester',
          },
          null,
          2
        );
      case 'json_empty':
        return '{}';
      case 'custom':
        return customBody;
      case 'empty':
      default:
        return undefined;
    }
  };

  const analyzeResponse = (
    method: string,
    url: string,
    status: number,
    headers: HeaderEntry[],
    rawBody: string
  ): TestLog['analysis'] => {
    const isHtml =
      rawBody.includes('<!DOCTYPE html>') ||
      rawBody.includes('<!doctype html>') ||
      rawBody.includes('<html');
    const headerDict = Object.fromEntries(headers.map((h) => [h.key.toLowerCase(), h.value]));
    const contentDisp = headerDict['content-disposition'] || '';
    const vercelError = headerDict['x-vercel-error'] || '';
    const allowHeader = headerDict['allow'] || '';

    // CASE 1: Vercel SPA Rewrite Trap (POST received by static index.html)
    if (method === 'POST' && status === 405 && (isHtml || contentDisp.includes('index.html'))) {
      return {
        category: 'error',
        title: '🚨 Vercel Route Rewrite Issue (POST ke Static HTML)',
        description:
          'Request POST /api/ocr mengenai file statis "index.html" milik Single Page Application (SPA), BUKAN serverless function. Server statis Vercel menolak request POST ke file HTML dengan status 405.',
        recommendation:
          '1. Pastikan file "api/ocr.ts" sudah di-commit dan di-push ke branch main di GitHub.\n2. Periksa file vercel.json agar route "/api/ocr" tidak ter-rewrite ke "/index.html".\n3. Sebagai alternatif instan: Gunakan fitur "Bypass Vercel (Kunci Gemini Langsung di Browser)" pada halaman Import.',
      };
    }

    // CASE 2: Expected 405 Method Not Allowed (GET on POST-only endpoint)
    if (method === 'GET' && status === 405) {
      return {
        category: 'info',
        title: '✓ 405 Method Not Allowed (Perilaku Standar & Sesuai Spesifikasi)',
        description:
          'Endpoint /api/ocr ditemukan dan merespon dengan benar. Status 405 muncul karena HTTP Method yang dikirimkan adalah GET, sedangkan endpoint OCR hanya menerima HTTP POST.',
        recommendation:
          'Endpoint backend Anda sudah aktif! Gunakan HTTP POST dengan payload gambar (Base64 atau FormData) untuk memproses OCR.',
      };
    }

    // CASE 3: Serverless function crashed (FUNCTION_INVOCATION_FAILED)
    if (status === 500 && (vercelError.includes('FUNCTION_INVOCATION_FAILED') || rawBody.includes('FUNCTION_INVOCATION_FAILED'))) {
      return {
        category: 'error',
        title: '⚠️ Vercel Function Invocation Failed (Crash Runtime)',
        description:
          'Serverless Function /api/ocr dieksekusi oleh Vercel namun mengalami unhandled exception saat inisialisasi modul atau runtime Node.js.',
        recommendation:
          '1. Periksa tab "Logs" di deployment Vercel Anda untuk melihat pesan error Node.js.\n2. Pastikan GEMINI_API_KEY terisi di Environment Variables Vercel.\n3. Gunakan fallback client-side Gemini di aplikasi untuk melanjutkan tanpa bergantung pada Vercel serverless.',
      };
    }

    // CASE 4: Success 200 OK
    if (status >= 200 && status < 300) {
      return {
        category: 'success',
        title: '✅ Request Berhasil (HTTP ' + status + ')',
        description:
          'Endpoint merespon dengan kode sukses 2xx. Konfigurasi rute, header, dan koneksi server berjalan normal.',
        recommendation:
          'Konfigurasi rute dan method ' + method + ' sudah valid dan berfungsi dengan baik.',
      };
    }

    // CASE 5: Bad Request 400 (Expected when no file/body)
    if (status === 400) {
      return {
        category: 'warning',
        title: '⚠️ HTTP 400 Bad Request (Handler Aktif, Format Payload Perlu Diperiksa)',
        description:
          'Rute backend /api/ocr aktif dan berhasil menerima request POST, namun server meminta file screenshot gambar yang valid.',
        recommendation:
          'Ini menandakan handler OCR backend sudah siap menerima request. Kirimkan payload gambar yang benar untuk melakukan ekstraksi.',
      };
    }

    // Default
    return {
      category: 'info',
      title: `Respon Server: HTTP ${status}`,
      description: `Server mengembalikan status HTTP ${status} untuk method ${method}.`,
      recommendation: 'Periksa tab Response Body dan Headers untuk melihat detail respons.',
    };
  };

  const executeRequest = async () => {
    setIsLoading(true);
    setActiveLog(null);
    const startTime = performance.now();

    try {
      const headersToSend: Record<string, string> = {};
      if (httpMethod !== 'GET' && httpMethod !== 'OPTIONS') {
        headersToSend['Content-Type'] = contentType;
      }
      headersToSend['Accept'] = 'application/json, text/plain, */*';

      const bodyToSend = getEffectiveRequestBody();

      const response = await fetch(targetUrl, {
        method: httpMethod,
        headers: headersToSend,
        body: bodyToSend,
      });

      const durationMs = Math.round(performance.now() - startTime);

      // Collect headers
      const parsedHeaders: HeaderEntry[] = [];
      response.headers.forEach((val, key) => {
        const isImportant = [
          'allow',
          'content-type',
          'content-disposition',
          'server',
          'x-vercel-id',
          'x-vercel-error',
          'x-vercel-cache',
          'access-control-allow-origin',
        ].includes(key.toLowerCase());
        parsedHeaders.push({ key, value: val, isImportant });
      });

      // Sort headers alphabetically, important first
      parsedHeaders.sort((a, b) => {
        if (a.isImportant && !b.isImportant) return -1;
        if (!a.isImportant && b.isImportant) return 1;
        return a.key.localeCompare(b.key);
      });

      const rawText = await response.text();
      let parsedJson: any = null;
      let isJson = false;

      try {
        parsedJson = JSON.parse(rawText);
        isJson = true;
      } catch {
        isJson = false;
      }

      const analysis = analyzeResponse(
        httpMethod,
        targetUrl,
        response.status,
        parsedHeaders,
        rawText
      );

      const logItem: TestLog = {
        id: Math.random().toString(36).substring(7),
        timestamp: new Date().toLocaleTimeString('id-ID'),
        url: targetUrl,
        method: httpMethod,
        status: response.status,
        statusText: response.statusText || (response.status === 405 ? 'Method Not Allowed' : ''),
        durationMs,
        headers: parsedHeaders,
        rawBody: rawText,
        isJson,
        parsedJson,
        analysis,
      };

      setActiveLog(logItem);
      setHistory((prev) => [logItem, ...prev.slice(0, 9)]);
    } catch (err: any) {
      const durationMs = Math.round(performance.now() - startTime);
      const logItem: TestLog = {
        id: Math.random().toString(36).substring(7),
        timestamp: new Date().toLocaleTimeString('id-ID'),
        url: targetUrl,
        method: httpMethod,
        status: 0,
        statusText: 'Network / CORS Error',
        durationMs,
        headers: [],
        rawBody: err.message || 'Gagal menghubungi endpoint (Network Error atau CORS)',
        isJson: false,
        analysis: {
          category: 'error',
          title: '🚨 Kegagalan Jaringan / Network Error',
          description:
            'Browser tidak dapat terhubung ke URL tujuan. Hal ini bisa disebabkan oleh CORS, koneksi internet terputus, atau domain tidak dapat dijangkau.',
          recommendation:
            'Pastikan URL benar dan server target mengizinkan CORS jika Anda mengetes domain eksternal.',
        },
      };
      setActiveLog(logItem);
      setHistory((prev) => [logItem, ...prev.slice(0, 9)]);
    } finally {
      setIsLoading(false);
    }
  };

  // Run full automated health check
  const runAutomatedSuite = async () => {
    setSuiteRunning(true);
    const results: typeof suiteResults = {};

    // 1. GET /api/status
    try {
      const t0 = performance.now();
      const res = await fetch('/api/status');
      const ms = Math.round(performance.now() - t0);
      const text = await res.text();
      results.statusApi = { ok: res.ok, status: res.status, text, ms };
    } catch (e: any) {
      results.statusApi = { ok: false, status: 0, text: e.message, ms: 0 };
    }

    // 2. OPTIONS /api/ocr (CORS Preflight)
    try {
      const t0 = performance.now();
      const res = await fetch('/api/ocr', { method: 'OPTIONS' });
      const ms = Math.round(performance.now() - t0);
      const allow = res.headers.get('allow') || res.headers.get('access-control-allow-methods') || '';
      results.optionsOcr = { ok: res.status === 200, status: res.status, allow, ms };
    } catch (e: any) {
      results.optionsOcr = { ok: false, status: 0, allow: '', ms: 0 };
    }

    // 3. GET /api/ocr (Should return 405 with JSON, not HTML)
    try {
      const t0 = performance.now();
      const res = await fetch('/api/ocr', { method: 'GET' });
      const ms = Math.round(performance.now() - t0);
      const text = await res.text();
      const isExpected405 = res.status === 405 && !text.includes('<!DOCTYPE html>');
      results.getOcr = { ok: isExpected405, status: res.status, isExpected405, ms };
    } catch (e: any) {
      results.getOcr = { ok: false, status: 0, isExpected405: false, ms: 0 };
    }

    // 4. POST /api/ocr with sample payload
    try {
      const t0 = performance.now();
      const res = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: getSampleBase64Image(),
          mimeType: 'image/png',
          diagnostic: true,
        }),
      });
      const ms = Math.round(performance.now() - t0);
      const text = await res.text();
      results.postOcr = { ok: res.status === 200 || res.status === 400, status: res.status, text, ms };
    } catch (e: any) {
      results.postOcr = { ok: false, status: 0, text: e.message, ms: 0 };
    }

    // 5. Client-Side Gemini Key check
    const clientKey = getClientGeminiApiKey();
    results.clientGemini = {
      ok: !!clientKey,
      keyConfigured: !!clientKey,
      message: clientKey
        ? 'Kunci Gemini aktif di memori browser (Bypass Vercel Serverless Siap Digunakan)'
        : 'Belum ada kunci tersimpan di browser. Mode fallback belum aktif.',
    };

    setSuiteResults(results);
    setSuiteRunning(false);
  };

  useEffect(() => {
    // Run automated suite on first load
    runAutomatedSuite();
  }, []);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getStatusBadgeColor = (status: number) => {
    if (status === 0) return 'bg-rose-500/20 text-rose-400 border-rose-500/40';
    if (status >= 200 && status < 300) return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
    if (status === 405) return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
    if (status >= 400 && status < 500) return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
    return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
  };

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const isVercel = currentOrigin.includes('vercel.app');

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-cyan-400 text-xs font-bold tracking-wider uppercase">
              <Terminal className="h-4 w-4" />
              <span>Inspector & Testing Suite</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white mt-1">
              Diagnostik Endpoint /api/ocr & Analisis 405
            </h1>
            <p className="text-slate-400 text-xs sm:text-sm mt-1">
              Alat verifikasi status mentah, HTTP Method, respons header, dan deteksi penyebab HTTP 405 Vercel.
            </p>
          </div>

          <button
            onClick={runAutomatedSuite}
            disabled={suiteRunning}
            className="px-4 py-2.5 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 rounded-xl text-xs font-bold transition flex items-center space-x-2"
          >
            <RotateCcw className={`h-4 w-4 ${suiteRunning ? 'animate-spin' : ''}`} />
            <span>{suiteRunning ? 'Menjalankan Pengujian...' : 'Jalankan Uji Otomatis'}</span>
          </button>
        </div>

        {/* Live Origin Status Bar */}
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-xl flex items-center justify-between">
            <span className="text-slate-400">Target Origin:</span>
            <span className="font-mono text-cyan-300 truncate max-w-[180px]">{currentOrigin}</span>
          </div>
          <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-xl flex items-center justify-between">
            <span className="text-slate-400">Lingkungan:</span>
            <span
              className={`font-semibold px-2 py-0.5 rounded text-[11px] ${
                isVercel
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              }`}
            >
              {isVercel ? 'Vercel Production' : 'AI Studio / Local'}
            </span>
          </div>
          <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-xl flex items-center justify-between">
            <span className="text-slate-400">Gemini Direct Bypass:</span>
            <span
              className={`font-semibold px-2 py-0.5 rounded text-[11px] ${
                getClientGeminiApiKey()
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              }`}
            >
              {getClientGeminiApiKey() ? '✓ Aktif' : 'Belum Diatur'}
            </span>
          </div>
        </div>
      </div>

      {/* AUTOMATED HEALTH CHECK RESULTS */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center space-x-2">
            <Activity className="h-4 w-4 text-cyan-400" />
            <span>Hasil Pengujian Otomatis Seluruh Endpoint</span>
          </h2>
          <span className="text-[11px] text-slate-500">Real-time Ping Check</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Test 1: GET /api/status */}
          <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono text-slate-400">GET /api/status</span>
              {suiteResults.statusApi ? (
                <span
                  className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
                    suiteResults.statusApi.ok
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-rose-500/20 text-rose-300'
                  }`}
                >
                  HTTP {suiteResults.statusApi.status}
                </span>
              ) : (
                <span className="text-slate-500">Checking...</span>
              )}
            </div>
            <p className="text-[11px] text-slate-400">
              {suiteResults.statusApi?.ok ? '✓ Server API online & merespon' : '✕ Server tidak dapat dihubungi'}
            </p>
            <div className="text-[10px] text-slate-500 flex justify-between">
              <span>Latensi: {suiteResults.statusApi?.ms || 0} ms</span>
            </div>
          </div>

          {/* Test 2: OPTIONS /api/ocr */}
          <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono text-slate-400">OPTIONS /api/ocr</span>
              {suiteResults.optionsOcr ? (
                <span
                  className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
                    suiteResults.optionsOcr.ok
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-amber-500/20 text-amber-300'
                  }`}
                >
                  HTTP {suiteResults.optionsOcr.status}
                </span>
              ) : (
                <span className="text-slate-500">Checking...</span>
              )}
            </div>
            <p className="text-[11px] text-slate-400">
              {suiteResults.optionsOcr?.ok ? '✓ CORS Preflight diterima' : '✕ Preflight ditolak / blocked'}
            </p>
            <div className="text-[10px] text-slate-500 flex justify-between">
              <span>Latensi: {suiteResults.optionsOcr?.ms || 0} ms</span>
            </div>
          </div>

          {/* Test 3: GET /api/ocr (Method check) */}
          <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono text-slate-400">GET /api/ocr</span>
              {suiteResults.getOcr ? (
                <span
                  className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
                    suiteResults.getOcr.isExpected405
                      ? 'bg-cyan-500/20 text-cyan-300'
                      : 'bg-rose-500/20 text-rose-300'
                  }`}
                >
                  HTTP {suiteResults.getOcr.status}
                </span>
              ) : (
                <span className="text-slate-500">Checking...</span>
              )}
            </div>
            <p className="text-[11px] text-slate-400">
              {suiteResults.getOcr?.isExpected405
                ? '✓ 405 Terverifikasi (Wajib POST)'
                : suiteResults.getOcr?.status === 405
                ? '⚠️ 405 dari Static index.html'
                : 'Status: ' + (suiteResults.getOcr?.status || 'Unknown')}
            </p>
            <div className="text-[10px] text-slate-500 flex justify-between">
              <span>Latensi: {suiteResults.getOcr?.ms || 0} ms</span>
            </div>
          </div>

          {/* Test 4: POST /api/ocr (Live POST Handler) */}
          <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono text-slate-400">POST /api/ocr</span>
              {suiteResults.postOcr ? (
                <span
                  className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
                    suiteResults.postOcr.ok
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-rose-500/20 text-rose-300'
                  }`}
                >
                  HTTP {suiteResults.postOcr.status}
                </span>
              ) : (
                <span className="text-slate-500">Checking...</span>
              )}
            </div>
            <p className="text-[11px] text-slate-400">
              {suiteResults.postOcr?.ok ? '✓ Handler POST aktif' : '✕ POST gagal atau return 405'}
            </p>
            <div className="text-[10px] text-slate-500 flex justify-between">
              <span>Latensi: {suiteResults.postOcr?.ms || 0} ms</span>
            </div>
          </div>
        </div>
      </div>

      {/* WHY 405 OCCURS - EDUCATIONAL ROOT CAUSE ACCORDION */}
      <div className="bg-gradient-to-r from-amber-500/10 via-slate-900 to-slate-900 border border-amber-500/30 p-5 rounded-2xl">
        <div className="flex items-start space-x-3">
          <HelpCircle className="h-6 w-6 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-2">
            <h3 className="font-bold text-sm text-white flex items-center space-x-2">
              <span>Memahami Mengapa Muncul HTTP 405 (Method Not Allowed) di Vercel</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-300 pt-1">
              <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800">
                <span className="font-bold text-amber-300 block mb-1">
                  1. 405 Normal (Jika Mengirim GET ke /api/ocr)
                </span>
                <p className="text-slate-400 leading-relaxed">
                  Jika Anda membuka <code>https://.../api/ocr</code> di tab browser, browser mengirimkan <strong>GET</strong>. Endpoint OCR kami memang dirancang menolak GET dengan kode 405 dan memberitahukan <code>Allow: POST</code>. Ini adalah perilaku yang benar.
                </p>
              </div>
              <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800">
                <span className="font-bold text-rose-400 block mb-1">
                  2. 405 Masalah (Jika Mengirim POST tapi tetap 405)
                </span>
                <p className="text-slate-400 leading-relaxed">
                  Jika Anda upload gambar (POST) dan tetap mendapat 405 dengan header <code>filename="index.html"</code>, itu artinya <strong>Vercel SPA rewrite menimpa /api/ocr ke index.html</strong> karena folder <code>/api</code> belum ter-deploy di Vercel. File HTML statis di Vercel tidak bisa menerima POST.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* REQUEST TESTER COMPONENT */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="border-b border-slate-800 p-4 bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-sm font-bold text-white">
            <Send className="h-4 w-4 text-orange-400" />
            <span>Interactive Request Tester (POST / GET / OPTIONS)</span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                setTargetUrl('/api/ocr');
                setHttpMethod('POST');
                setPayloadType('sample_image');
              }}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold"
            >
              Reset ke Default POST /api/ocr
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Target URL & Method Row */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            {/* Method Select */}
            <div className="sm:col-span-3">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                HTTP Method
              </label>
              <select
                value={httpMethod}
                onChange={(e) => setHttpMethod(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-700 text-white text-xs font-bold rounded-xl px-3 py-2.5 focus:border-orange-500 focus:outline-none"
              >
                <option value="POST">POST (Untuk OCR & Upload)</option>
                <option value="GET">GET (Tes 405 / Status)</option>
                <option value="OPTIONS">OPTIONS (Tes Preflight CORS)</option>
                <option value="PUT">PUT</option>
                <option value="DELETE">DELETE</option>
              </select>
            </div>

            {/* Target URL */}
            <div className="sm:col-span-7">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Target Endpoint URL
              </label>
              <div className="flex items-center space-x-1.5">
                <input
                  type="text"
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                  placeholder="/api/ocr atau https://sralivereports-phi.vercel.app/api/ocr"
                  className="w-full bg-slate-950 border border-slate-700 text-white text-xs font-mono rounded-xl px-3 py-2.5 focus:border-orange-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Send Button */}
            <div className="sm:col-span-2 flex items-end">
              <button
                onClick={executeRequest}
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black text-xs py-2.5 px-4 rounded-xl shadow-lg shadow-orange-500/20 transition flex items-center justify-center space-x-1.5"
              >
                {isLoading ? (
                  <RotateCcw className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" />
                    <span>Kirim</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Quick Preset Buttons */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-[11px] text-slate-500">Preset Cepat:</span>
            <button
              onClick={() => {
                setTargetUrl('/api/ocr');
                setHttpMethod('POST');
                setPayloadType('sample_image');
              }}
              className="px-2.5 py-1 rounded-lg bg-orange-500/10 text-orange-300 border border-orange-500/30 text-xs font-semibold hover:bg-orange-500/20"
            >
              🚀 POST /api/ocr (Sample Base64)
            </button>
            <button
              onClick={() => {
                setTargetUrl('/api/ocr');
                setHttpMethod('GET');
                setPayloadType('empty');
              }}
              className="px-2.5 py-1 rounded-lg bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 text-xs font-semibold hover:bg-cyan-500/20"
            >
              🔍 GET /api/ocr (Cek 405)
            </button>
            <button
              onClick={() => {
                setTargetUrl('/api/ocr');
                setHttpMethod('OPTIONS');
                setPayloadType('empty');
              }}
              className="px-2.5 py-1 rounded-lg bg-purple-500/10 text-purple-300 border border-purple-500/30 text-xs font-semibold hover:bg-purple-500/20"
            >
              🌐 OPTIONS /api/ocr (CORS)
            </button>
            <button
              onClick={() => {
                setTargetUrl('/api/status');
                setHttpMethod('GET');
                setPayloadType('empty');
              }}
              className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 text-xs font-semibold hover:bg-emerald-500/20"
            >
              ⚡ GET /api/status
            </button>
          </div>

          {/* Payload Configuration (Only visible for POST/PUT) */}
          {httpMethod !== 'GET' && httpMethod !== 'OPTIONS' && (
            <div className="bg-slate-950/70 border border-slate-800 p-4 rounded-xl space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Request Payload (Body)
                </label>
                <div className="flex items-center space-x-2">
                  <span className="text-[11px] text-slate-400">Pilih Tipe:</span>
                  <select
                    value={payloadType}
                    onChange={(e) => setPayloadType(e.target.value as any)}
                    className="bg-slate-900 border border-slate-700 text-xs text-white rounded-lg px-2 py-1"
                  >
                    <option value="sample_image">Contoh Gambar Shopee (Base64)</option>
                    <option value="json_empty">JSON Kosong ({})</option>
                    <option value="empty">Kosong (No Body)</option>
                    <option value="custom">Custom JSON</option>
                  </select>
                </div>
              </div>

              {payloadType === 'sample_image' && (
                <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-400 space-y-1">
                  <div className="flex items-center space-x-2 text-emerald-400 font-semibold">
                    <Sparkles className="h-4 w-4" />
                    <span>Payload Gambar Valid Disiapkan Secara Otomatis:</span>
                  </div>
                  <pre className="font-mono text-[11px] text-slate-300 overflow-x-auto bg-slate-950 p-2 rounded border border-slate-800">
                    {`{\n  "imageBase64": "${getSampleBase64Image().substring(0, 32)}...",\n  "mimeType": "image/png",\n  "fileName": "diagnostic_sample.png"\n}`}
                  </pre>
                </div>
              )}

              {payloadType === 'custom' && (
                <textarea
                  rows={4}
                  value={customBody}
                  onChange={(e) => setCustomBody(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs font-mono text-white focus:outline-none focus:border-orange-500"
                  placeholder="Masukkan JSON payload custom..."
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* ACTIVE TEST RESULT VIEWER */}
      {activeLog && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden animate-fadeIn">
          {/* Result Header */}
          <div className="p-5 border-b border-slate-800 bg-slate-950/80 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <span
                className={`text-xs font-black px-2.5 py-1 rounded-lg border font-mono ${getStatusBadgeColor(
                  activeLog.status
                )}`}
              >
                {activeLog.status === 0 ? 'NET ERROR' : `HTTP ${activeLog.status} ${activeLog.statusText}`}
              </span>
              <span className="font-mono font-bold text-xs text-white">
                {activeLog.method} {activeLog.url}
              </span>
            </div>

            <div className="flex items-center space-x-3 text-xs text-slate-400">
              <span className="flex items-center space-x-1">
                <Clock className="h-3.5 w-3.5 text-slate-500" />
                <span>{activeLog.durationMs} ms</span>
              </span>
              <span>•</span>
              <span>{activeLog.timestamp}</span>
              <button
                onClick={() => copyToClipboard(activeLog.rawBody)}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium flex items-center space-x-1"
              >
                {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                <span>{copied ? 'Tersalin' : 'Salin Respon'}</span>
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="border-b border-slate-800 px-5 flex space-x-4 text-xs font-bold">
            <button
              onClick={() => setActiveTab('analysis')}
              className={`py-3 border-b-2 transition ${
                activeTab === 'analysis'
                  ? 'border-orange-500 text-orange-400'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              Analisis Diagnosis AI & Penyebab
            </button>
            <button
              onClick={() => setActiveTab('formatted')}
              className={`py-3 border-b-2 transition ${
                activeTab === 'formatted'
                  ? 'border-orange-500 text-orange-400'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              Response Body {activeLog.isJson ? '(JSON)' : '(Raw)'}
            </button>
            <button
              onClick={() => setActiveTab('headers')}
              className={`py-3 border-b-2 transition ${
                activeTab === 'headers'
                  ? 'border-orange-500 text-orange-400'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              Response Headers ({activeLog.headers.length})
            </button>
          </div>

          {/* Tab Content */}
          <div className="p-5">
            {/* 1. Tab: Analysis */}
            {activeTab === 'analysis' && (
              <div className="space-y-4">
                <div
                  className={`p-4 rounded-xl border flex items-start space-x-3 ${
                    activeLog.analysis.category === 'error'
                      ? 'bg-rose-500/10 border-rose-500/30 text-rose-200'
                      : activeLog.analysis.category === 'warning'
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                      : activeLog.analysis.category === 'success'
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                      : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-200'
                  }`}
                >
                  {activeLog.analysis.category === 'error' && (
                    <AlertCircle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
                  )}
                  {activeLog.analysis.category === 'warning' && (
                    <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                  )}
                  {activeLog.analysis.category === 'success' && (
                    <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                  )}
                  {activeLog.analysis.category === 'info' && (
                    <HelpCircle className="h-5 w-5 text-cyan-400 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-1">
                    <div className="font-bold text-sm text-white">{activeLog.analysis.title}</div>
                    <p className="text-xs leading-relaxed">{activeLog.analysis.description}</p>
                  </div>
                </div>

                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                  <h4 className="text-xs font-bold text-orange-400 uppercase tracking-wider flex items-center space-x-1.5">
                    <Zap className="h-4 w-4" />
                    <span>Langkah Rekomendasi Solusi:</span>
                  </h4>
                  <pre className="text-xs font-sans text-slate-300 whitespace-pre-line leading-relaxed">
                    {activeLog.analysis.recommendation}
                  </pre>
                </div>
              </div>
            )}

            {/* 2. Tab: Formatted Response */}
            {activeTab === 'formatted' && (
              <div className="space-y-3">
                <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 overflow-x-auto max-h-96">
                  {activeLog.isJson ? (
                    <pre className="font-mono text-xs text-emerald-400">
                      {JSON.stringify(activeLog.parsedJson, null, 2)}
                    </pre>
                  ) : (
                    <pre className="font-mono text-xs text-slate-300 whitespace-pre-wrap">
                      {activeLog.rawBody || '(Respon kosong)'}
                    </pre>
                  )}
                </div>
              </div>
            )}

            {/* 3. Tab: Headers */}
            {activeTab === 'headers' && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="p-2.5 rounded-l-lg">Header Name</th>
                      <th className="p-2.5 rounded-r-lg">Header Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 font-mono">
                    {activeLog.headers.map((h, i) => (
                      <tr key={i} className={h.isImportant ? 'bg-orange-500/5' : ''}>
                        <td className="p-2.5 font-bold text-slate-300 flex items-center space-x-1.5">
                          {h.isImportant && <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />}
                          <span>{h.key}</span>
                        </td>
                        <td className="p-2.5 text-slate-400 break-all">{h.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* RECENT TEST HISTORY */}
      {history.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-3 flex items-center space-x-2">
            <Layers className="h-4 w-4 text-slate-400" />
            <span>Riwayat Pengujian Sesi Ini ({history.length})</span>
          </h3>

          <div className="space-y-2">
            {history.map((item) => (
              <div
                key={item.id}
                onClick={() => setActiveLog(item)}
                className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between text-xs ${
                  activeLog?.id === item.id
                    ? 'bg-slate-800 border-orange-500/40 text-white'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center space-x-3 font-mono">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getStatusBadgeColor(
                      item.status
                    )}`}
                  >
                    HTTP {item.status}
                  </span>
                  <span className="font-bold text-slate-200">{item.method}</span>
                  <span className="truncate max-w-[200px] sm:max-w-[320px]">{item.url}</span>
                </div>

                <div className="flex items-center space-x-3 text-[11px] text-slate-500">
                  <span>{item.durationMs} ms</span>
                  <span>{item.timestamp}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
export default Diagnostics;
