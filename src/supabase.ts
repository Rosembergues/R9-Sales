import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const SUPABASE_CONFIG_KEY = 'salesflow_supabase_config';

const DEFAULT_SUPABASE_URL = 'https://wqdrybpjfvuzrnozomxa.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndxZHJ5YnBqZnZ1enJub3pvbXhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgzNTEzMDEsImV4cCI6MjEwMzkyNzMwMX0.MEIL2IfMECBU-Fy5MRxp9XlMhElJU_rOpuH3K36MGTo';

/**
 * Limpa e normaliza a URL do Supabase, removendo sufixos acidentais como /rest/v1/ ou barras finais.
 */
export function sanitizeSupabaseUrl(url: string): string {
  if (!url) return '';
  return url
    .trim()
    .replace(/\/rest\/v1\/?$/i, '')
    .replace(/\/auth\/v1\/?$/i, '')
    .replace(/\/+$/, '');
}

// Helper to determine active credentials from localStorage or environment variables
function resolveSupabaseCredentials(): { url: string; key: string; isConfigured: boolean } {
  const envUrl = import.meta.env.VITE_SUPABASE_URL;
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  let savedConfig: { url: string; anonKey: string } | null = null;
  try {
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem(SUPABASE_CONFIG_KEY);
      if (raw) savedConfig = JSON.parse(raw);
    }
  } catch (e) {
    console.error('Error parsing stored supabase config', e);
  }

  const rawUrl = savedConfig?.url || envUrl || DEFAULT_SUPABASE_URL;
  const rawKey = savedConfig?.anonKey || envKey || DEFAULT_SUPABASE_ANON_KEY;

  const url = sanitizeSupabaseUrl(rawUrl);
  const key = rawKey?.trim() || '';

  const isConfigured = Boolean(
    url &&
    key &&
    url !== 'https://xyzcompany.supabase.co' &&
    url !== 'https://your-project.supabase.co' &&
    key !== 'your-anon-key' &&
    key !== 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.dummy'
  );

  return { url, key, isConfigured };
}

const initialCredentials = resolveSupabaseCredentials();

/**
 * Instância única e centralizada do Supabase compartilhada em toda a aplicação.
 */
export let supabase: SupabaseClient = createClient(
  initialCredentials.url,
  initialCredentials.key,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  }
);

/**
 * Retorna a instância compartilhada do Supabase ou null se não configurado.
 */
export function getSupabaseClient(): SupabaseClient | null {
  const creds = resolveSupabaseCredentials();
  if (creds.isConfigured) {
    return supabase;
  }
  return supabase;
}

/**
 * Atualiza a instância compartilhada do cliente caso novas credenciais sejam configuradas em runtime.
 */
export function setSupabaseCredentials(newUrl: string, newKey: string): SupabaseClient {
  const cleanUrl = sanitizeSupabaseUrl(newUrl);
  const cleanKey = newKey.trim();
  
  supabase = createClient(cleanUrl, cleanKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });
  return supabase;
}

/**
 * Verifica se o Supabase está com credenciais reais configuradas.
 */
export function isSupabaseConfigured(): boolean {
  return resolveSupabaseCredentials().isConfigured;
}

export default supabase;

