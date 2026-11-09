import { GoalImportGroup } from './goalImport';
import { GoalDailyPoint } from './goalProgress';

/** Janela de datas de um ciclo para uma modalidade, tirada do arquivo importado. */
export interface CycleWindow {
  period: string;
  group: string;
  start: string;
  end: string;
  /** Último dia com meta > 0 (ou o fim do arquivo). */
  metaEnd: string;
}

const norm = (v: unknown) => String(v ?? '')
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .trim()
  .toLowerCase();

/**
 * Converte o produto/modalidade da venda no grupo usado pelas metas importadas.
 * Aceita os valores do formulário atual e variações antigas.
 */
export function saleGoalGroup(mainProduct: unknown, modality: unknown): GoalImportGroup | null {
  const p = norm(mainProduct);
  const m = norm(modality);

  if (p.includes('tecnico') || m.includes('tecnico')) return 'tecnico_presencial';

  const isPos = p.includes('pos') || m.startsWith('pos ');
  if (isPos) {
    if (m.includes('ao vivo')) return 'pos_aovivo';
    if (m.includes('digital') || m.includes('ead')) return 'pos_digital';
    return 'pos_presencial';
  }

  if (m === 'semipresencial') return 'graduacao_semipresencial';
  if (m === 'ao vivo') return 'graduacao_aovivo';
  if (m === 'ead') return 'graduacao_ead';
  if (m === 'flex' || m === 'dlex') return 'graduacao_dlex';
  if (m === 'presencial' || !m) return 'graduacao_presencial';
  return null;
}

export function buildCycleWindows(points: GoalDailyPoint[]): CycleWindow[] {
  const map = new Map<string, CycleWindow>();
  points.forEach(p => {
    const key = `${p.period}|${p.group}`;
    const w = map.get(key);
    const hasMeta = (p.target ?? 0) > 0;
    if (!w) {
      map.set(key, { period: p.period, group: p.group, start: p.date, end: p.date, metaEnd: hasMeta ? p.date : '' });
      return;
    }
    if (p.date < w.start) w.start = p.date;
    if (p.date > w.end) w.end = p.date;
    if (hasMeta && p.date > w.metaEnd) w.metaEnd = p.date;
  });
  return [...map.values()].map(w => ({ ...w, metaEnd: w.metaEnd || w.end }));
}

/** Ciclos possíveis para uma venda, do mais provável para o menos provável. */
export function candidateCycles(group: string | null, dateIso: string, windows: CycleWindow[]): string[] {
  if (!group || !dateIso) return [];
  const inRange = windows.filter(w => w.group === group && w.start <= dateIso && dateIso <= w.end);
  // Preferência: ciclo mais antigo que ainda tem meta a perseguir nessa data; depois os demais.
  const open = inRange.filter(w => w.metaEnd >= dateIso).sort((a, b) => a.period.localeCompare(b.period));
  const closed = inRange.filter(w => w.metaEnd < dateIso).sort((a, b) => b.period.localeCompare(a.period));
  return [...open, ...closed].map(w => w.period);
}

/** Ciclo sugerido para uma venda, ou null se nenhum arquivo cobre essa modalidade nessa data. */
export const suggestSaleCycle = (group: string | null, dateIso: string, windows: CycleWindow[]) =>
  candidateCycles(group, dateIso, windows)[0] ?? null;
