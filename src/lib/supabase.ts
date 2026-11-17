import { createClient } from '@supabase/supabase-js';

function stripWrappingQuotes(value: unknown): string {
  if (typeof value !== 'string') return '';
  let cleaned = value.trim();
  while (
    cleaned.length >= 2 &&
    ((cleaned.startsWith('"') && cleaned.endsWith('"')) ||
      (cleaned.startsWith("'") && cleaned.endsWith("'")))
  ) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  return cleaned;
}

/** Normalizes dashboard/API URLs to the Supabase project root expected by createClient. */
export function normalizeSupabaseUrl(value: unknown): string {
  const raw = stripWrappingQuotes(value);
  if (!raw) return '';

  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const parsed = new URL(withProtocol);
    if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname) return '';

    let pathname = parsed.pathname.replace(/\/+$/, '');
    pathname = pathname.replace(/\/(?:rest|auth)\/v1$/i, '');
    parsed.pathname = pathname;
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString().replace(/\/+$/, '');
  } catch {
    return '';
  }
}

/** Trims whitespace and wrapping quotes commonly copied with an anon/publishable key. */
export function normalizeSupabaseKey(value: unknown): string {
  return stripWrappingQuotes(value);
}

const supabaseUrl = normalizeSupabaseUrl(import.meta.env.VITE_SUPABASE_URL);
const supabaseAnonKey = normalizeSupabaseKey(import.meta.env.VITE_SUPABASE_ANON_KEY);

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;
