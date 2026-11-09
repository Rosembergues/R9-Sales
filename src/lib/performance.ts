import { GoalDailyPoint } from './goalProgress';
import { buildCycleWindows, saleGoalGroup } from './saleCycle';
import type { RankingOperation } from '../components/seller/rankingUtils';

/** Filtros de metodologia da página de Desempenho. */
export interface MethodFilter {
  key: string;
  label: string;
  groups: string[];
  /** Coluna de meta individual equivalente (metas por consultor são por BU), ou null. */
  operation: RankingOperation | null;
}

const GRAD_PRES = ['graduacao_presencial', 'graduacao_semipresencial', 'graduacao_aovivo'];
const GRAD_DIG = ['graduacao_ead', 'graduacao_dlex'];
const POS = ['pos_presencial', 'pos_aovivo', 'pos_digital'];
const TEC = ['tecnico_presencial'];

export const METHOD_FILTERS: MethodFilter[] = [
  { key: 'graduacao', label: 'Graduação Total', groups: [...GRAD_PRES, ...GRAD_DIG], operation: 'graduacao_total' },
  { key: 'bu_presencial', label: 'BU Presencial', groups: GRAD_PRES, operation: 'bu_presencial' },
  { key: 'digital', label: 'BU Digital', groups: GRAD_DIG, operation: 'bu_digital' },
  { key: 'presencial', label: 'Met. Presencial', groups: ['graduacao_presencial'], operation: null },
  { key: 'semi', label: 'Met. Semipresencial', groups: ['graduacao_semipresencial'], operation: null },
  { key: 'aovivo', label: 'Met. Ao Vivo', groups: ['graduacao_aovivo'], operation: null },
  { key: 'ead', label: 'Met. EAD', groups: ['graduacao_ead'], operation: null },
  { key: 'flex', label: 'Met. Flex', groups: ['graduacao_dlex'], operation: null },
  { key: 'pos', label: 'Pós Graduação', groups: POS, operation: 'pos' },
  { key: 'tecnico', label: 'Técnico', groups: TEC, operation: 'tecnico' },
];

const DAY = 86400000;
const toTime = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
export const isoFromTime = (t: number) => new Date(t).toISOString().slice(0, 10);
export const addDays = (iso: string, n: number) => isoFromTime(toTime(iso) + n * DAY);
export const dayCount = (from: string, to: string) => Math.round((toTime(to) - toTime(from)) / DAY) + 1;

/** Segunda-feira da semana de uma data (aaaa-mm-dd). */
export const mondayOf = (iso: string) => {
  const dow = new Date(toTime(iso)).getUTCDay(); // 0 = domingo
  return addDays(iso, dow === 0 ? -6 : 1 - dow);
};

export const monthRange = (iso: string) => {
  const y = +iso.slice(0, 4);
  const m = +iso.slice(5, 7);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const mm = String(m).padStart(2, '0');
  return { start: `${y}-${mm}-01`, end: `${y}-${mm}-${String(last).padStart(2, '0')}` };
};

/**
 * Intervalo do "ciclo atual" para as modalidades escolhidas: do início ao fim da meta
 * dos ciclos ainda abertos na data-base (cada modalidade tem um ciclo aberto por vez).
 */
export function currentCycleRange(points: GoalDailyPoint[], groups: string[], dataDate: string) {
  const windows = buildCycleWindows(points).filter(w => groups.includes(w.group));
  const open = windows.filter(w => w.metaEnd >= dataDate);
  const chosen = open.length ? open : windows.filter(w => w.metaEnd === windows.reduce((m, x) => (x.metaEnd > m ? x.metaEnd : m), ''));
  if (!chosen.length) return null;
  return {
    start: chosen.reduce((m, w) => (w.start < m ? w.start : m), chosen[0].start),
    end: chosen.reduce((m, w) => (w.metaEnd > m ? w.metaEnd : m), chosen[0].metaEnd),
    periods: Array.from(new Set(chosen.map(w => w.period))).sort(),
  };
}

export interface DayRow {
  date: string;
  meta: number;
  aa: number;
  /** null depois da data-base. */
  actual: number | null;
  cumMeta: number;
  cumAa: number;
  cumActual: number | null;
}

/** Linha por dia corrido do intervalo (o Power BI só exporta dias com movimento). */
export function dailyRows(points: GoalDailyPoint[], groups: string[], start: string, end: string, dataDate: string): DayRow[] {
  const byDate = new Map<string, { meta: number; aa: number; actual: number }>();
  points.forEach(p => {
    if (!groups.includes(p.group) || p.date < start || p.date > end) return;
    const d = byDate.get(p.date) ?? { meta: 0, aa: 0, actual: 0 };
    d.meta += p.target ?? 0;
    d.aa += p.aa ?? 0;
    d.actual += p.actual ?? 0;
    byDate.set(p.date, d);
  });
  const rows: DayRow[] = [];
  let cumMeta = 0; let cumAa = 0; let cumActual = 0;
  for (let t = toTime(start); t <= toTime(end); t += DAY) {
    const date = isoFromTime(t);
    const d = byDate.get(date) ?? { meta: 0, aa: 0, actual: 0 };
    const past = date <= dataDate;
    cumMeta += d.meta;
    cumAa += d.aa;
    if (past) cumActual += d.actual;
    rows.push({
      date,
      meta: d.meta,
      aa: d.aa,
      actual: past ? d.actual : null,
      cumMeta,
      cumAa,
      cumActual: past ? cumActual : null,
    });
  }
  return rows;
}

export interface RangeSummary {
  /** Meta somada até a data-base (dentro do intervalo). */
  metaToDate: number;
  metaTotal: number;
  actual: number;
  aaToDate: number;
  aaTotal: number;
  /** Dias do intervalo depois da data-base. */
  remainingDays: number;
  gap: number;
  requiredPerDay: number | null;
  /** Fechamento projetado mantendo o atingimento atual sobre a curva de meta. */
  projection: number | null;
}

export function summarize(rows: DayRow[], dataDate: string): RangeSummary {
  let metaToDate = 0; let metaTotal = 0; let actual = 0; let aaToDate = 0; let aaTotal = 0; let remainingDays = 0;
  rows.forEach(r => {
    metaTotal += r.meta;
    aaTotal += r.aa;
    if (r.date <= dataDate) {
      metaToDate += r.meta;
      aaToDate += r.aa;
      actual += r.actual ?? 0;
    } else {
      remainingDays += 1;
    }
  });
  const gap = Math.max(0, metaTotal - actual);
  return {
    metaToDate, metaTotal, actual, aaToDate, aaTotal, remainingDays, gap,
    requiredPerDay: remainingDays > 0 ? gap / remainingDays : null,
    projection: metaToDate > 0 ? (actual / metaToDate) * metaTotal : null,
  };
}

export interface WeekRow {
  start: string;
  end: string;
  meta: number;
  aa: number;
  actual: number;
  /** Semana ainda em andamento ou futura (a data-base está nela ou antes dela). */
  status: 'fechada' | 'em andamento' | 'futura';
  /** Meta só dos dias já ocorridos (para comparar semana em andamento). */
  metaToDate: number;
  /** Ano anterior só dos dias já ocorridos. */
  aaToDate: number;
}

/** Agrupa os dias em semanas de segunda a domingo (as pontas podem ser parciais). */
export function weeklyRows(rows: DayRow[], dataDate: string): WeekRow[] {
  const map = new Map<string, WeekRow>();
  rows.forEach(r => {
    const key = mondayOf(r.date);
    const w = map.get(key) ?? { start: r.date, end: r.date, meta: 0, aa: 0, actual: 0, status: 'fechada' as const, metaToDate: 0, aaToDate: 0 };
    if (r.date < w.start) w.start = r.date;
    if (r.date > w.end) w.end = r.date;
    w.meta += r.meta;
    w.aa += r.aa;
    w.actual += r.actual ?? 0;
    if (r.date <= dataDate) { w.metaToDate += r.meta; w.aaToDate += r.aa; }
    map.set(key, w);
  });
  return [...map.values()]
    .sort((a, b) => a.start.localeCompare(b.start))
    .map(w => ({ ...w, status: w.end <= dataDate ? 'fechada' : w.start > dataDate ? 'futura' : 'em andamento' }));
}

/** Venda já reduzida ao que a página precisa. */
export interface PerfSale {
  sellerId: string;
  sellerName: string;
  date: string; // aaaa-mm-dd
  mainProduct?: unknown;
  modality?: unknown;
}

export interface ConsultantRow {
  sellerId: string;
  name: string;
  total: number;
  /** Vendas por grupo (modalidade). */
  byGroup: Record<string, number>;
  /** Meta individual somada no intervalo (só quando o filtro tem meta por BU). */
  target: number | null;
  attainment: number | null;
}

export interface IndividualGoal {
  user_id: string;
  type: string;
  reference_start: string;
  reference_end: string;
  [key: string]: unknown;
}

/**
 * Metas individuais que valem no intervalo: as semanais quando o intervalo é uma
 * semana; senão as mensais cujo período está inteiro dentro do intervalo.
 */
export function goalsForRange(goals: IndividualGoal[], start: string, end: string, isWeek: boolean): IndividualGoal[] {
  const types = isWeek ? ['week', 'semanal'] : ['month', 'mensal'];
  return goals.filter(g => types.includes(g.type) && g.reference_start >= start && g.reference_end <= end);
}

export function consultantRows(
  sales: PerfSale[],
  groups: string[],
  start: string,
  end: string,
  profiles: { id: string; name: string; role: string; status?: string }[],
  targetOf: ((userId: string) => number) | null,
): ConsultantRow[] {
  const rows = new Map<string, ConsultantRow>();
  profiles
    .filter(p => p.role === 'seller' && p.status !== 'inactive')
    .forEach(p => rows.set(p.id, { sellerId: p.id, name: p.name, total: 0, byGroup: {}, target: null, attainment: null }));

  sales.forEach(s => {
    if (!s.date || s.date < start || s.date > end) return;
    const group = saleGoalGroup(s.mainProduct, s.modality);
    if (!group || !groups.includes(group)) return;
    const row = rows.get(s.sellerId) ?? { sellerId: s.sellerId, name: s.sellerName || 'Consultor', total: 0, byGroup: {}, target: null, attainment: null };
    row.total += 1;
    row.byGroup[group] = (row.byGroup[group] ?? 0) + 1;
    rows.set(s.sellerId, row);
  });

  return [...rows.values()]
    .map(r => {
      const target = targetOf ? targetOf(r.sellerId) : null;
      return { ...r, target, attainment: target && target > 0 ? (r.total / target) * 100 : null };
    })
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'pt-BR'));
}

/** CSV com ponto e vírgula e vírgula decimal (abre direto no Excel em português). */
export function dailyCsv(rows: DayRow[]): string {
  const n = (v: number | null) => (v === null ? '' : v.toLocaleString('pt-BR', { maximumFractionDigits: 2 }));
  const br = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
  const lines = ['Data;Meta;Realizado;Ano anterior;Meta acumulada;Realizado acumulado;Ano anterior acumulado'];
  rows.forEach(r => lines.push([br(r.date), n(r.meta), n(r.actual), n(r.aa), n(r.cumMeta), n(r.cumActual), n(r.cumAa)].join(';')));
  return lines.join('\r\n');
}

/** Dados extras da venda usados no "Perfil das vendas" (antiga tela Produtos). */
export interface ProfileSale extends PerfSale {
  shift?: string;
  fdi?: string;
  parcela?: string;
  bolsa?: boolean;
}

export interface SalesProfile {
  total: number;
  byGroup: [string, number][];
  byShift: [string, number][];
  byFdi: [string, number][];
  byParcela: [string, number][];
  withBolsa: number;
}

const ranked = (map: Map<string, number>) => [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'));

/** Distribuição das vendas lançadas no período por modalidade, turno, ingresso, parcela e convênio. */
export function salesProfile(sales: ProfileSale[], groups: string[], start: string, end: string): SalesProfile {
  const byGroup = new Map<string, number>();
  const byShift = new Map<string, number>();
  const byFdi = new Map<string, number>();
  const byParcela = new Map<string, number>();
  let total = 0;
  let withBolsa = 0;
  const inc = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);
  sales.forEach(s => {
    if (!s.date || s.date < start || s.date > end) return;
    const group = saleGoalGroup(s.mainProduct, s.modality);
    if (!group || !groups.includes(group)) return;
    total += 1;
    inc(byGroup, group);
    inc(byShift, s.shift || 'Não informado');
    inc(byFdi, s.fdi || 'Não informado');
    inc(byParcela, s.parcela || 'Sem parcelas');
    if (s.bolsa) withBolsa += 1;
  });
  return { total, byGroup: ranked(byGroup), byShift: ranked(byShift), byFdi: ranked(byFdi), byParcela: ranked(byParcela), withBolsa };
}
