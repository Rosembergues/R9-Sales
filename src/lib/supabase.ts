import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Conexão única com o Supabase usada em todo o R9 Hub.
 *
 * As credenciais vêm de VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (ver .env.example).
 * Sem elas, usa o projeto oficial do R9 Hub. A chave "anon" é pública por natureza:
 * quem protege os dados são as regras de RLS do banco (pasta supabase/).
 */
const DEFAULT_SUPABASE_URL = 'https://wqdrybpjfvuzrnozomxa.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndxZHJ5YnBqZnZ1enJub3pvbXhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgzNTEzMDEsImV4cCI6MjEwMzkyNzMwMX0.MEIL2IfMECBU-Fy5MRxp9XlMhElJU_rOpuH3K36MGTo';

/** Remove sufixos colados por engano na URL (/rest/v1, /auth/v1, barra final). */
const cleanUrl = (url: string) =>
  url.trim().replace(/\/rest\/v1\/?$/i, '').replace(/\/auth\/v1\/?$/i, '').replace(/\/+$/, '');

const url = cleanUrl(import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL);
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY).trim();

/** Endereço da página de nova senha (precisa estar em Authentication → URL Configuration no Supabase). */
export const RESET_PASSWORD_PATH = '/redefinir-senha';

/**
 * O que veio no endereço ao abrir o site, lido ANTES de criar o cliente:
 * o Supabase apaga os dados do link de recuperação assim que os lê.
 */
function readAuthRedirect() {
  if (typeof window === 'undefined') return { isRecovery: false, errorCode: null, errorDescription: null };
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const query = new URLSearchParams(window.location.search);
  return {
    isRecovery: window.location.pathname === RESET_PASSWORD_PATH || hash.get('type') === 'recovery',
    errorCode: hash.get('error_code') || query.get('error_code'),
    errorDescription: hash.get('error_description') || query.get('error_description'),
  };
}

export const authRedirectAtStartup = readAuthRedirect();

export const supabase: SupabaseClient = createClient(url, anonKey, {
  auth: { persistSession: true, autoRefreshToken: true },
});

/** Mantido para os módulos que pedem o cliente por função. */
export function getSupabaseClient(): SupabaseClient {
  return supabase;
}
