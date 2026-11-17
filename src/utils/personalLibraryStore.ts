import type { EmailBlock } from '../types';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { normalizeBlock } from './blockNormalizer';
import { BrandKit, DEFAULT_BRAND_KIT, normalizeBrandKit } from './brandKit';

/*
 * Per-user brand kit and reusable ("saved") blocks, stored in Supabase.
 * Both tables are created by supabase/migrations/202611130002_brand_kit_and_saved_blocks.sql.
 */

export interface SavedBlock {
  id: string;
  name: string;
  block: EmailBlock;
  createdAt: string;
}

const MIGRATION_HINT = 'Aplique a migração 202611130002_brand_kit_and_saved_blocks.sql no Supabase.';

function getClient() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('O Supabase não está configurado. Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.');
  }
  return supabase;
}

async function currentUserId(): Promise<string> {
  const { data, error } = await getClient().auth.getSession();
  if (error) throw error;
  if (!data.session?.user) throw new Error('Sua sessão expirou. Entre novamente.');
  return data.session.user.id;
}

function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  return Boolean(error && (error.code === '42P01' || error.code === 'PGRST205' || /does not exist|schema cache/i.test(error.message || '')));
}

// ----- brand kit --------------------------------------------------------------

export async function loadBrandKit(): Promise<BrandKit> {
  const client = getClient();
  const userId = await currentUserId();
  const { data, error } = await client.from('mailer_brand_kits').select('kit').eq('user_id', userId).maybeSingle();
  if (error) {
    if (isMissingTable(error)) throw new Error(`O kit da marca ainda não está disponível. ${MIGRATION_HINT}`);
    throw error;
  }
  return data ? normalizeBrandKit(data.kit) : { ...DEFAULT_BRAND_KIT };
}

export async function saveBrandKit(kit: BrandKit): Promise<BrandKit> {
  const client = getClient();
  const userId = await currentUserId();
  const normalized = normalizeBrandKit(kit);
  const { error } = await client
    .from('mailer_brand_kits')
    .upsert({ user_id: userId, kit: normalized, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) {
    if (isMissingTable(error)) throw new Error(`Não foi possível salvar o kit da marca. ${MIGRATION_HINT}`);
    throw error;
  }
  return normalized;
}

// ----- saved blocks -----------------------------------------------------------

function mapSavedBlock(row: Record<string, unknown>): SavedBlock | null {
  const block = normalizeBlock(row.block);
  if (!block) return null;
  return {
    id: String(row.id),
    name: String(row.name || 'Bloco salvo'),
    block,
    createdAt: String(row.created_at || ''),
  };
}

export async function listSavedBlocks(): Promise<SavedBlock[]> {
  const client = getClient();
  const userId = await currentUserId();
  const { data, error } = await client
    .from('mailer_saved_blocks')
    .select('id, name, block, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) {
    if (isMissingTable(error)) throw new Error(`Os blocos salvos ainda não estão disponíveis. ${MIGRATION_HINT}`);
    throw error;
  }
  return (data || []).map((row) => mapSavedBlock(row as Record<string, unknown>)).filter((b): b is SavedBlock => b !== null);
}

export async function createSavedBlock(name: string, block: EmailBlock): Promise<SavedBlock> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Dê um nome ao bloco.');
  if (trimmed.length > 80) throw new Error('O nome do bloco deve ter até 80 caracteres.');
  const normalized = normalizeBlock(block);
  if (!normalized) throw new Error('Este bloco não pode ser salvo.');
  const client = getClient();
  const userId = await currentUserId();
  const { data, error } = await client
    .from('mailer_saved_blocks')
    .insert({ user_id: userId, name: trimmed, block: normalized })
    .select('id, name, block, created_at')
    .single();
  if (error) {
    if (isMissingTable(error)) throw new Error(`Não foi possível salvar o bloco. ${MIGRATION_HINT}`);
    throw error;
  }
  const saved = mapSavedBlock(data as Record<string, unknown>);
  if (!saved) throw new Error('O Supabase não retornou o bloco salvo.');
  return saved;
}

export async function deleteSavedBlock(id: string): Promise<void> {
  const client = getClient();
  const userId = await currentUserId();
  const { error } = await client.from('mailer_saved_blocks').delete().eq('id', id).eq('user_id', userId);
  if (error) throw error;
}
