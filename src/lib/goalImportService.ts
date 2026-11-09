import { supabase } from './supabase';
import { GoalImportGroup, ParsedGoalRow, getModelMetadata } from './goalImport';

const ROWS_CHUNK = 500;

export interface SaveGoalImportInput {
  group: GoalImportGroup;
  academicPeriod: string;
  fileName: string;
  rows: ParsedGoalRow[];
  importedBy?: string | null;
}

/**
 * Grava uma importação sem risco de perder a anterior:
 *  1. cria o registro novo como "cancelled" (invisível para as telas, que só leem "active").
 *     O banco só aceita os status active/replaced/cancelled (goal_imports_status_check),
 *     por isso "cancelled" faz o papel de rascunho até o passo 3;
 *  2. insere os dias; se falhar, apaga o registro novo e a importação anterior continua valendo;
 *  3. ativa o novo registro;
 *  4. só então marca as importações anteriores do mesmo (período, modalidade) como "replaced".
 * Se o passo 4 falhar, as telas já usam a importação mais recente por (período, modalidade).
 */
export async function saveGoalImport({ group, academicPeriod, fileName, rows, importedBy }: SaveGoalImportInput): Promise<string> {
  const meta = getModelMetadata(group);

  const { data: inserted, error: importError } = await supabase
    .from('goal_imports')
    .insert({
      academic_period: academicPeriod,
      product: meta.product,
      goal_group: group,
      file_name: fileName,
      imported_by: importedBy || null,
      status: 'cancelled',
    })
    .select('id')
    .single();

  if (importError || !inserted) {
    throw importError || new Error('Não foi possível registrar a importação no Supabase.');
  }
  const importId: string = inserted.id;

  const discardNew = async () => {
    const { error } = await supabase.from('goal_imports').delete().eq('id', importId);
    if (error) await supabase.from('goal_imports').update({ status: 'cancelled' }).eq('id', importId);
  };

  const payload = rows.map(row => ({
    import_id: importId,
    academic_period: academicPeriod,
    product: meta.product,
    goal_group: group,
    reference_date: row.date,
    aa: row.aa,
    target: row.target,
    actual: row.actual,
  }));

  for (let i = 0; i < payload.length; i += ROWS_CHUNK) {
    const { error } = await supabase.from('goal_daily_data').insert(payload.slice(i, i + ROWS_CHUNK));
    if (error) {
      await discardNew();
      throw error;
    }
  }

  const { error: activateError } = await supabase
    .from('goal_imports')
    .update({ status: 'active' })
    .eq('id', importId);
  if (activateError) {
    await discardNew();
    throw activateError;
  }

  const { error: replaceError } = await supabase
    .from('goal_imports')
    .update({ status: 'replaced' })
    .eq('academic_period', academicPeriod)
    .eq('goal_group', group)
    .eq('status', 'active')
    .neq('id', importId);
  if (replaceError) {
    console.warn('Importação nova ativa, mas não foi possível arquivar a anterior:', replaceError);
  }

  return importId;
}

/**
 * Mantém só a importação ativa mais recente de cada (período, modalidade).
 * Espera a lista já ordenada por imported_at desc.
 */
export function latestPerPeriodAndGroup<T extends { academic_period: string; goal_group: string }>(imports: T[]): T[] {
  const seen = new Set<string>();
  return imports.filter(item => {
    const key = `${item.academic_period}|${item.goal_group}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
