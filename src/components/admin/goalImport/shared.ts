/** Tipos e auxiliares da tela Importar Metas. */
import { GoalFilePreview, GoalImportGroup, GoalImportTotals, ParsedGoalFile, ParsedGoalRow, ModelMetadata, getModelMetadata } from '../../../lib/goalImport';

export type StoredPreview = GoalFilePreview & { importId?: string };

export const COMMON_PERIODS = ['2026.3', '2026.4', '2027.1'];

export const formatDate = (value: string | null) =>
  value ? new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR') : '—';

export const formatNumber = (value: number | null) =>
  value === null ? '—' : value.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

export const buildPreview = (
  meta: ModelMetadata,
  fileName: string,
  academicPeriod: string | null,
  rows: ParsedGoalRow[],
  filters: string[],
  warnings: string[],
  importId?: string
): StoredPreview => {
  const dates = rows.map(r => r.date).filter(Boolean).sort();
  return {
    fileName,
    group: meta.id,
    academicPeriod,
    rowCount: rows.length,
    startDate: dates[0] ?? null,
    endDate: dates[dates.length - 1] ?? null,
    rows,
    filters,
    warnings,
    importId,
  };
};

/** Um arquivo na tela de conferência, antes de gravar. */
export interface ReviewItem {
  key: string;
  parsed: ParsedGoalFile;
  group: GoalImportGroup | null;
  period: string;
  /** Avisos adicionais gerados na conferência (ex.: card diferente do arquivo). */
  notes: string[];
  previous?: { fileName: string; importedAt: string; totals: GoalImportTotals } | null;
  status: 'ready' | 'saving' | 'saved' | 'error';
  message?: string;
}

export const itemBlockingErrors = (item: ReviewItem, all: ReviewItem[]) => {
  const errors = [...item.parsed.errors.filter(e => !(item.group && e.startsWith('Não consegui identificar a modalidade')))];
  if (!item.group) errors.push('Escolha a modalidade deste arquivo.');
  if (!/^\d{4}\.\d+$/.test(item.period)) errors.push('Período acadêmico inválido.');
  const dup = all.find(o => o.key !== item.key && o.group === item.group && o.period === item.period);
  if (item.group && dup && all.indexOf(dup) < all.indexOf(item)) {
    errors.push(`Outro arquivo (${dup.parsed.fileName}) já está indo para ${getModelMetadata(item.group).title} ${item.period}.`);
  }
  return errors;
};
