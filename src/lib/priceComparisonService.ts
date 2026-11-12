import { supabase } from './supabase';
import { CompetitorOffer, DEFAULT_OFFENSE_THRESHOLD_PCT, ParsedPriceRow, weekStartOf } from './priceComparison';
import type { PriceCourseRow } from './dbTypes';
import { errorText } from './errors';

const ROWS_CHUNK = 200;
const IMPORT_COLUMNS = 'id, reference_date, reference_week, campus, file_name, row_count, imported_by, imported_by_name, imported_at, status';

export interface PriceImport {
  id: string;
  reference_date: string;
  reference_week: string;
  campus: string | null;
  file_name: string | null;
  row_count: number;
  imported_by: string | null;
  imported_by_name: string | null;
  imported_at: string;
  status: 'draft' | 'active' | 'replaced';
}

export interface StoredPriceRow extends ParsedPriceRow {
  id: string;
  import_id: string;
  competitors: CompetitorOffer[];
}

export interface SavePriceImportInput {
  referenceDate: string;
  campus: string | null;
  fileName: string;
  rows: ParsedPriceRow[];
  importedBy?: string | null;
  importedByName?: string | null;
}

/**
 * Grava a planilha sem risco de perder a versão vigente:
 *  1. cria a importação como "draft" (as telas só leem "active");
 *  2. insere as linhas; se falhar, apaga o rascunho;
 *  3. ativa a importação nova;
 *  4. marca como "replaced" as outras ativas da MESMA semana (reenvio corrige a semana).
 * Semanas anteriores continuam ativas e formam o histórico.
 */
export async function savePriceImport(input: SavePriceImportInput): Promise<string> {
  const referenceWeek = weekStartOf(input.referenceDate);

  const { data: inserted, error: importError } = await supabase
    .from('price_imports')
    .insert({
      reference_date: input.referenceDate,
      reference_week: referenceWeek,
      campus: input.campus,
      file_name: input.fileName,
      row_count: input.rows.length,
      imported_by: input.importedBy || null,
      imported_by_name: input.importedByName || null,
      status: 'draft',
    })
    .select('id')
    .single();

  if (importError || !inserted) {
    throw importError || new Error('Não foi possível registrar a importação no Supabase.');
  }
  const importId: string = inserted.id;

  const discardNew = async () => {
    await supabase.from('price_imports').delete().eq('id', importId);
  };

  const payload = input.rows.map(row => ({ ...row, import_id: importId }));
  for (let i = 0; i < payload.length; i += ROWS_CHUNK) {
    const { error } = await supabase.from('price_courses').insert(payload.slice(i, i + ROWS_CHUNK));
    if (error) {
      await discardNew();
      throw error;
    }
  }

  const { error: activateError } = await supabase.from('price_imports').update({ status: 'active' }).eq('id', importId);
  if (activateError) {
    await discardNew();
    throw activateError;
  }

  const { error: replaceError } = await supabase
    .from('price_imports')
    .update({ status: 'replaced' })
    .eq('reference_week', referenceWeek)
    .eq('status', 'active')
    .neq('id', importId);
  if (replaceError) console.warn('Importação nova ativa, mas não foi possível arquivar a anterior da semana:', replaceError);

  return importId;
}

/**
 * Importações vigentes, da mais recente para a mais antiga (uma por semana).
 * Se duas ativas caírem na mesma semana (passo 4 falhou), fica a mais nova.
 */
export async function listActivePriceImports(): Promise<PriceImport[]> {
  const { data, error } = await supabase
    .from('price_imports')
    .select(IMPORT_COLUMNS)
    .eq('status', 'active')
    .order('reference_date', { ascending: false })
    .order('imported_at', { ascending: false });
  if (error) throw error;
  const seen = new Set<string>();
  return ((data || []) as PriceImport[]).filter(item => {
    if (seen.has(item.reference_week)) return false;
    seen.add(item.reference_week);
    return true;
  });
}

/** Todas as importações (inclui substituídas), para o histórico de envios. */
export async function listAllPriceImports(): Promise<PriceImport[]> {
  const { data, error } = await supabase
    .from('price_imports')
    .select(IMPORT_COLUMNS)
    .in('status', ['active', 'replaced'])
    .order('reference_date', { ascending: false })
    .order('imported_at', { ascending: false });
  if (error) throw error;
  return (data || []) as PriceImport[];
}

export async function loadPriceRows(importId: string): Promise<StoredPriceRow[]> {
  const { data, error } = await supabase
    .from('price_courses')
    .select('*')
    .eq('import_id', importId)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return ((data || []) as PriceCourseRow[]).map(normalizeStoredRow);
}

/** Linhas de várias importações de uma vez (histórico de um curso). */
export async function loadPriceRowsForImports(importIds: string[]): Promise<StoredPriceRow[]> {
  if (!importIds.length) return [];
  const { data, error } = await supabase.from('price_courses').select('*').in('import_id', importIds);
  if (error) throw error;
  return ((data || []) as PriceCourseRow[]).map(normalizeStoredRow);
}

const num = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number(v));

const normalizeStoredRow = (r: PriceCourseRow): StoredPriceRow => ({
  ...r,
  id: String(r.id ?? ''),
  list_price: num(r.list_price),
  scholarship_first_pct: num(r.scholarship_first_pct),
  scholarship_ct_pct: num(r.scholarship_ct_pct),
  price_first: num(r.price_first),
  price_ct: num(r.price_ct),
  our_price: num(r.our_price),
  competitors: Array.isArray(r.competitors) ? (r.competitors as CompetitorOffer[]) : [],
});

export async function loadOffenseThreshold(): Promise<number> {
  const { data, error } = await supabase.from('price_settings').select('value').eq('key', 'offense_threshold_pct').maybeSingle();
  if (error || !data) return DEFAULT_OFFENSE_THRESHOLD_PCT;
  const n = Number(data.value);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_OFFENSE_THRESHOLD_PCT;
}

export async function saveOffenseThreshold(value: number, userId?: string | null): Promise<void> {
  const { error } = await supabase.from('price_settings').upsert({
    key: 'offense_threshold_pct',
    value,
    updated_at: new Date().toISOString(),
    updated_by: userId || null,
  });
  if (error) throw error;
}

/** Mensagem amigável quando as tabelas ainda não foram criadas no Supabase. */
export const describePriceError = (err: unknown): string => {
  const msg = errorText(err, '');
  if (/price_(imports|courses|settings)/.test(msg) && /(does not exist|schema cache|not find)/i.test(msg)) {
    return 'As tabelas do Comparador de Preços ainda não existem no Supabase. Rode o arquivo supabase/comparador-precos.sql no SQL Editor.';
  }
  return msg || 'Erro inesperado ao falar com o Supabase.';
};
