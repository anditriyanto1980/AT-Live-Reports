import { createClient, SupabaseClient } from '@supabase/supabase-js';

const rawUrl = import.meta.env.VITE_SUPABASE_URL;
const rawAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

function isValidHttpUrl(urlStr: unknown): urlStr is string {
  if (!urlStr || typeof urlStr !== 'string') return false;
  const trimmed = urlStr.trim();
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return false;
  }
  if (trimmed.includes('your-project') || trimmed.includes('example.com')) {
    return false;
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function isValidKey(keyStr: unknown): keyStr is string {
  if (!keyStr || typeof keyStr !== 'string') return false;
  const trimmed = keyStr.trim();
  return (
    trimmed.length > 10 &&
    trimmed !== 'your-anon-key' &&
    trimmed !== 'your-service-role-key'
  );
}

function initializeSupabaseClient(): SupabaseClient | null {
  if (!isValidHttpUrl(rawUrl) || !isValidKey(rawAnonKey)) {
    return null;
  }

  try {
    return createClient(rawUrl.trim(), rawAnonKey.trim(), {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  } catch (error) {
    console.warn('Supabase client initialization skipped due to invalid configuration:', error);
    return null;
  }
}

export const supabase: SupabaseClient | null = initializeSupabaseClient();
export const isSupabaseConfigured: boolean = supabase !== null;
