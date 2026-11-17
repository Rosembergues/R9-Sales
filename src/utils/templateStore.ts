import type { EmailBlock, EmailData } from '../types';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { normalizeBlocks } from './blockNormalizer';

const MAX_VERSIONS = 20;

export interface TemplateVersion {
  id: string;
  versionNumber: number;
  createdAt: string;
  name: string;
  subject: string;
  blocks: EmailBlock[];
  emailData: EmailData;
}

export interface TemplateDocument {
  id: string;
  name: string;
  subject: string;
  description: string;
  blocks: EmailBlock[];
  emailData: EmailData;
  createdAt: string;
  updatedAt: string;
  currentVersionId: string;
  versions: TemplateVersion[];
  createdBy: string;
  updatedBy: string;
  isPublic: boolean;
}

export interface TemplateLibraryContext {
  userId: string;
  isAdmin: boolean;
}

export interface DraftSnapshot {
  savedAt: string;
  documentId: string;
  sourceTemplateId: string | null;
  blocks: EmailBlock[];
  emailData: EmailData;
}

export interface SaveTemplateInput {
  id: string;
  name: string;
  subject: string;
  description: string;
  blocks: EmailBlock[];
  emailData: EmailData;
}

type DbRow = Record<string, any>;

function getClient() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('O Supabase não está configurado. Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.');
  }
  return supabase;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function createDocumentId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  // UUID v4 fallback for browsers without crypto.randomUUID.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    return (char === 'x' ? random : (random & 0x3) | 0x8).toString(16);
  });
}

async function getCurrentUser() {
  const client = getClient();
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  if (!data.session?.user) throw new Error('Sua sessão expirou. Entre novamente para acessar a biblioteca.');
  return data.session.user;
}

export async function getTemplateLibraryContext(): Promise<TemplateLibraryContext> {
  const client = getClient();
  const user = await getCurrentUser();
  const { data, error } = await client.rpc('is_mailer_library_admin');
  if (error) {
    throw new Error('Não foi possível consultar as permissões da biblioteca. Aplique a migração Supabase incluída no projeto.');
  }
  return { userId: user.id, isAdmin: data === true };
}

function mapVersion(row: DbRow): TemplateVersion {
  return {
    id: String(row.id),
    versionNumber: Number(row.version_number || 1),
    createdAt: String(row.created_at),
    name: String(row.name || 'Modelo sem nome'),
    subject: String(row.subject || 'E-mail sem assunto'),
    blocks: normalizeBlocks(row.blocks),
    emailData: (row.email_data || {}) as EmailData,
  };
}

function mapTemplate(row: DbRow, versionRows: DbRow[] = []): TemplateDocument {
  const versions = versionRows
    .filter((version) => version.template_id === row.id)
    .sort((a, b) => Number(b.version_number) - Number(a.version_number))
    .slice(0, MAX_VERSIONS)
    .map(mapVersion);
  return {
    id: String(row.id),
    name: String(row.name || 'Meu template'),
    subject: String(row.subject || 'E-mail sem assunto'),
    description: String(row.description || ''),
    blocks: normalizeBlocks(row.blocks),
    emailData: (row.email_data || {}) as EmailData,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    currentVersionId: versions[0]?.id || '',
    versions,
    createdBy: String(row.created_by || ''),
    updatedBy: String(row.updated_by || ''),
    isPublic: row.is_public === true,
  };
}

async function fetchVersions(templateIds: string[]): Promise<DbRow[]> {
  if (!templateIds.length) return [];
  const client = getClient();
  const { data, error } = await client
    .from('mailer_template_versions')
    .select('id, template_id, version_number, name, subject, blocks, email_data, created_by, created_at')
    .in('template_id', templateIds)
    .order('version_number', { ascending: false });
  if (error) throw error;
  return (data || []) as DbRow[];
}

export async function listSavedTemplates(limit?: number): Promise<TemplateDocument[]> {
  const client = getClient();
  let query = client
    .from('mailer_templates')
    .select('id, name, subject, description, blocks, email_data, is_public, created_by, updated_by, created_at, updated_at')
    .eq('is_public', true)
    .order('updated_at', { ascending: false });
  if (typeof limit === 'number' && Number.isFinite(limit) && limit > 0) {
    query = query.limit(Math.floor(limit));
  }
  const { data, error } = await query;
  if (error) {
    throw new Error('Não foi possível carregar a biblioteca. Confirme se a migração Supabase foi aplicada.');
  }
  const rows = (data || []) as DbRow[];
  const versions = await fetchVersions(rows.map((row) => String(row.id)));
  return rows.map((row) => mapTemplate(row, versions));
}

export async function getSavedTemplate(id: string): Promise<TemplateDocument | null> {
  const client = getClient();
  const { data, error } = await client
    .from('mailer_templates')
    .select('id, name, subject, description, blocks, email_data, is_public, created_by, updated_by, created_at, updated_at')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const versions = await fetchVersions([id]);
  return mapTemplate(data as DbRow, versions);
}

export async function saveTemplateDocument(input: SaveTemplateInput): Promise<TemplateDocument> {
  if (!isUuid(input.id)) throw new Error('O identificador do modelo não é válido. Reabra o editor para criar um novo documento.');
  const client = getClient();
  const user = await getCurrentUser();
  const normalizedName = input.name.trim();
  const normalizedDescription = input.description.trim();
  if (!normalizedName) throw new Error('Informe um nome para o modelo.');
  if (!normalizedDescription) throw new Error('Informe uma descrição para o modelo.');
  if (normalizedName.length > 100) throw new Error('O nome do modelo deve ter até 100 caracteres.');
  if (normalizedDescription.length > 500) throw new Error('A descrição deve ter até 500 caracteres.');
  const normalizedSubject = input.subject.trim() || 'E-mail sem assunto';
  const { data: existing, error: lookupError } = await client
    .from('mailer_templates')
    .select('id, created_by, description')
    .eq('id', input.id)
    .maybeSingle();
  if (lookupError) throw lookupError;

  // A public template has its own ID. Never persist a user's private draft ID inside the shared model.
  const { documentId: _privateDraftId, ...templateEmailData } = input.emailData;
  const payload = {
    name: normalizedName,
    subject: normalizedSubject,
    description: normalizedDescription,
    blocks: normalizeBlocks(input.blocks),
    email_data: { ...templateEmailData, contentSource: 'blocks' },
    is_public: true,
    updated_by: user.id,
  };

  let savedRow: DbRow | null = null;
  if (existing) {
    const { data, error } = await client
      .from('mailer_templates')
      .update(payload)
      .eq('id', input.id)
      .select('id, name, subject, description, blocks, email_data, is_public, created_by, updated_by, created_at, updated_at')
      .single();
    if (error) {
      if (error.code === '42501' || error.code === 'PGRST116' || /row-level security|permission/i.test(error.message || '')) {
        throw new Error('Você só pode editar modelos que criou. Para usar este modelo sem alterar o original, escolha “Usar modelo”.');
      }
      throw error;
    }
    savedRow = data as DbRow;
  } else {
    const { data, error } = await client
      .from('mailer_templates')
      .insert({ ...payload, id: input.id, created_by: user.id })
      .select('id, name, subject, description, blocks, email_data, is_public, created_by, updated_by, created_at, updated_at')
      .single();
    if (error) throw error;
    savedRow = data as DbRow;
  }

  if (!savedRow) throw new Error('O Supabase não retornou o modelo salvo.');
  const versions = await fetchVersions([input.id]);
  return mapTemplate(savedRow, versions);
}

export async function deleteSavedTemplate(id: string): Promise<void> {
  const client = getClient();
  const { data, error } = await client.from('mailer_templates').delete().eq('id', id).select('id');
  if (error) {
    if (error.code === '42501' || /row-level security|permission/i.test(error.message || '')) {
      throw new Error('Somente administradores podem excluir modelos da biblioteca.');
    }
    throw error;
  }
  // PostgREST can return zero rows without an error when RLS filters the target row.
  if (!data?.length) throw new Error('O modelo não foi excluído. Somente administradores podem excluir modelos da biblioteca.');
}

export async function restoreTemplateVersion(templateId: string, versionId: string): Promise<TemplateDocument | null> {
  const client = getClient();
  const user = await getCurrentUser();
  const { data: version, error: versionError } = await client
    .from('mailer_template_versions')
    .select('id, template_id, name, subject, blocks, email_data')
    .eq('id', versionId)
    .eq('template_id', templateId)
    .maybeSingle();
  if (versionError) throw versionError;
  if (!version) return null;

  const { data: updated, error: updateError } = await client
    .from('mailer_templates')
    .update({
      name: version.name,
      subject: version.subject,
      blocks: version.blocks,
      email_data: version.email_data,
      updated_by: user.id,
    })
    .eq('id', templateId)
    .select('id')
    .maybeSingle();
  if (updateError) throw updateError;
  if (!updated) throw new Error('Somente o dono do modelo ou um administrador pode restaurar versões.');
  return getSavedTemplate(templateId);
}

const draftWriteQueues = new Map<string, Promise<void>>();

export async function saveDraft(
  blocks: EmailBlock[],
  emailData: EmailData,
  documentId: string,
  sourceTemplateId: string | null = null,
): Promise<void> {
  if (!isUuid(documentId)) throw new Error('O identificador do rascunho não é válido.');
  const client = getClient();
  // Enqueue synchronously, before any await, so writes reach the database in call order.
  const queueKey = documentId;
  const previousWrite = draftWriteQueues.get(queueKey) || Promise.resolve();
  const nextWrite = previousWrite.catch(() => undefined).then(async () => {
    const user = await getCurrentUser();
    const { error } = await client.from('mailer_drafts').upsert({
      user_id: user.id,
      document_id: documentId,
      source_template_id: sourceTemplateId,
      blocks: normalizeBlocks(blocks),
      email_data: { ...emailData, documentId, contentSource: 'blocks' },
      saved_at: new Date().toISOString(),
    }, { onConflict: 'user_id,document_id' });
    if (error) throw error;
  });
  draftWriteQueues.set(queueKey, nextWrite);
  try {
    await nextWrite;
  } finally {
    if (draftWriteQueues.get(queueKey) === nextWrite) draftWriteQueues.delete(queueKey);
  }
}

export async function loadLatestDraft(): Promise<DraftSnapshot | null> {
  const client = getClient();
  const user = await getCurrentUser();
  const { data, error } = await client
    .from('mailer_drafts')
    .select('document_id, source_template_id, blocks, email_data, saved_at')
    .eq('user_id', user.id)
    .order('saved_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    savedAt: String(data.saved_at),
    documentId: String(data.document_id),
    sourceTemplateId: data.source_template_id ? String(data.source_template_id) : null,
    blocks: normalizeBlocks(data.blocks),
    emailData: (data.email_data || {}) as EmailData,
  };
}

export async function loadDraft(documentId?: string): Promise<DraftSnapshot | null> {
  if (!documentId) return null;
  if (!isUuid(documentId)) return null;
  const client = getClient();
  const user = await getCurrentUser();
  const { data, error } = await client
    .from('mailer_drafts')
    .select('document_id, source_template_id, blocks, email_data, saved_at')
    .eq('user_id', user.id)
    .eq('document_id', documentId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    savedAt: String(data.saved_at),
    documentId: String(data.document_id),
    sourceTemplateId: data.source_template_id ? String(data.source_template_id) : null,
    blocks: normalizeBlocks(data.blocks),
    emailData: (data.email_data || {}) as EmailData,
  };
}

export async function clearDraft(documentId: string): Promise<void> {
  if (!isUuid(documentId)) return;
  const client = getClient();
  const user = await getCurrentUser();
  const { error } = await client
    .from('mailer_drafts')
    .delete()
    .eq('user_id', user.id)
    .eq('document_id', documentId);
  if (error) throw error;
}
