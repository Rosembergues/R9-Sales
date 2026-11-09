import { BusinessUnitKey, getModelMetadata } from './goalImport';

/** Uma linha diária de meta já associada ao ciclo e à modalidade. */
export interface GoalDailyPoint {
  period: string;
  group: string;
  date: string; // yyyy-mm-dd
  aa: number | null;
  target: number | null;
  actual: number | null;
}

export interface ProgressTotals {
  /** Meta acumulada até a data-base (inclusive). */
  metaToDate: number;
  /** Meta do ciclo inteiro. */
  metaCycle: number;
  /** Realizado oficial (Power BI) até a data-base. */
  actual: number;
  /** Ano anterior acumulado até a data-base. */
  aaToDate: number;
  /** Ano anterior do ciclo inteiro. */
  aaCycle: number;
}

export interface CumulativePoint {
  date: string;
  meta: number;
  aa: number;
  /** null depois da data-base (ainda não aconteceu). */
  actual: number | null;
}

export interface CycleProgress {
  period: string;
  startDate: string;
  /** Último dia com meta > 0 (ou último dia do arquivo, se não houver meta). */
  metaEndDate: string;
  lastDate: string;
  totals: ProgressTotals;
  byBu: Partial<Record<BusinessUnitKey, ProgressTotals>>;
  byGroup: Record<string, ProgressTotals>;
  /** Dias corridos depois da data-base até o fim da meta. */
  remainingDays: number;
  /** Quanto falta para a meta do ciclo. */
  gap: number;
  /** Matrículas por dia necessárias para fechar a meta do ciclo. */
  requiredPerDay: number | null;
  /** Fechamento projetado mantendo o atingimento atual sobre a curva de meta. */
  projection: number | null;
  cumulative: CumulativePoint[];
  isActive: boolean;
}

export const emptyTotals = (): ProgressTotals => ({ metaToDate: 0, metaCycle: 0, actual: 0, aaToDate: 0, aaCycle: 0 });

export const addTotals = (a: ProgressTotals, b: ProgressTotals): ProgressTotals => ({
  metaToDate: a.metaToDate + b.metaToDate,
  metaCycle: a.metaCycle + b.metaCycle,
  actual: a.actual + b.actual,
  aaToDate: a.aaToDate + b.aaToDate,
  aaCycle: a.aaCycle + b.aaCycle,
});

const DAY = 86400000;
const toTime = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
const toIso = (t: number) => new Date(t).toISOString().slice(0, 10);
export const daysBetween = (from: string, to: string) => Math.round((toTime(to) - toTime(from)) / DAY);

/**
 * Data-base dos dados oficiais: último dia com realizado > 0 em qualquer arquivo,
 * limitado a hoje. O Power BI costuma estar um dia atrás, então usar "hoje" inflaria
 * a meta acumulada sem o realizado correspondente.
 */
export function resolveDataDate(points: GoalDailyPoint[], todayIso: string): string {
  let max = '';
  points.forEach(p => {
    if ((p.actual ?? 0) > 0 && p.date <= todayIso && p.date > max) max = p.date;
  });
  return max || toIso(toTime(todayIso) - DAY);
}

const accumulate = (t: ProgressTotals, p: GoalDailyPoint, dataDate: string) => {
  const target = p.target ?? 0;
  const aa = p.aa ?? 0;
  t.metaCycle += target;
  t.aaCycle += aa;
  if (p.date <= dataDate) {
    t.metaToDate += target;
    t.aaToDate += aa;
    t.actual += p.actual ?? 0;
  }
};

export function computeCycleProgress(points: GoalDailyPoint[], dataDate: string): CycleProgress[] {
  const byPeriod = new Map<string, GoalDailyPoint[]>();
  points.forEach(p => {
    if (!byPeriod.has(p.period)) byPeriod.set(p.period, []);
    byPeriod.get(p.period)!.push(p);
  });

  const cycles: CycleProgress[] = [];
  byPeriod.forEach((rows, period) => {
    if (!rows.length) return;
    const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
    const startDate = sorted[0].date;
    const lastDate = sorted[sorted.length - 1].date;
    const withMeta = sorted.filter(r => (r.target ?? 0) > 0);
    const metaEndDate = withMeta.length ? withMeta[withMeta.length - 1].date : lastDate;

    const totals = emptyTotals();
    const byBu: CycleProgress['byBu'] = {};
    const byGroup: Record<string, ProgressTotals> = {};
    const daily = new Map<string, { meta: number; aa: number; actual: number }>();

    sorted.forEach(p => {
      accumulate(totals, p, dataDate);
      const bu = getModelMetadata(p.group).buKey;
      accumulate((byBu[bu] ??= emptyTotals()), p, dataDate);
      accumulate((byGroup[p.group] ??= emptyTotals()), p, dataDate);
      const d = daily.get(p.date) ?? { meta: 0, aa: 0, actual: 0 };
      d.meta += p.target ?? 0;
      d.aa += p.aa ?? 0;
      d.actual += p.actual ?? 0;
      daily.set(p.date, d);
    });

    // Curva acumulada em dias corridos (o Power BI só exporta dias com movimento).
    const cumulative: CumulativePoint[] = [];
    const chartEnd = metaEndDate > dataDate ? metaEndDate : dataDate < lastDate ? dataDate : lastDate;
    let meta = 0;
    let aa = 0;
    let actual = 0;
    for (let t = toTime(startDate); t <= toTime(chartEnd); t += DAY) {
      const iso = toIso(t);
      const d = daily.get(iso);
      meta += d?.meta ?? 0;
      aa += d?.aa ?? 0;
      actual += d?.actual ?? 0;
      cumulative.push({ date: iso, meta, aa, actual: iso <= dataDate ? actual : null });
    }

    const remainingDays = Math.max(0, daysBetween(dataDate, metaEndDate));
    const gap = Math.max(0, totals.metaCycle - totals.actual);
    cycles.push({
      period,
      startDate,
      metaEndDate,
      lastDate,
      totals,
      byBu,
      byGroup,
      remainingDays,
      gap,
      requiredPerDay: remainingDays > 0 ? gap / remainingDays : null,
      projection: totals.metaToDate > 0 ? (totals.actual / totals.metaToDate) * totals.metaCycle : null,
      cumulative,
      isActive: metaEndDate >= dataDate || lastDate >= dataDate,
    });
  });

  return cycles.sort((a, b) => a.period.localeCompare(b.period));
}

/** Soma da meta (todas as BUs e ciclos) entre duas datas, inclusive. */
export function sumTarget(points: GoalDailyPoint[], from: string, to: string): number {
  return points.reduce((s, p) => (p.date >= from && p.date <= to ? s + (p.target ?? 0) : s), 0);
}

export const pct = (num: number, den: number) => (den > 0 ? (num / den) * 100 : null);
