import { supabase } from './supabase';
import { GoalFilePreview, GoalImportGroup, summarizeImportedGoals } from './goalImport';
import { latestPerPeriodAndGroup } from './goalImportService';

/**
 * Metas por peso.
 *
 * Cada consultor tem um percentual por BU (soma de cada BU = 100%). A meta oficial
 * importada do período é distribuída por esses percentuais, com arredondamento que
 * mantém a soma igual à meta oficial. Metas marcadas como ajuste manual ficam como
 * estão, e o restante da BU é distribuído entre os demais.
 */

export type BuKey = 'bu_presencial' | 'bu_digital' | 'pos' | 'tecnico';
export const BU_KEYS: BuKey[] = ['bu_presencial', 'bu_digital', 'pos', 'tecnico'];

export const BU_FIELD: Record<BuKey, 'target_bu_presencial' | 'target_bu_digital' | 'target_pos' | 'target_tecnico'> = {
  bu_presencial: 'target_bu_presencial',
  bu_digital: 'target_bu_digital',
  pos: 'target_pos',
  tecnico: 'target_tecnico',
};

/** userId → BU → percentual (0–100) */
export type WeightsMap = Record<string, Partial<Record<BuKey, number>>>;
export type BuValues = Record<BuKey, number>;

export interface GoalPeriod {
  type: 'week' | 'month';
  start: string;
  end: string;
}

const emptyBu = (): BuValues => ({ bu_presencial: 0, bu_digital: 0, pos: 0, tecnico: 0 });

// ---------------------------------------------------------------------------
// Cálculo (puro)
// ---------------------------------------------------------------------------

/**
 * Distribui `total` entre as pessoas proporcionalmente a `shares`
 * (maiores restos: a soma dá exatamente `total`). Sem pesos → ninguém recebe.
 */
export function splitByShares(total: number, shares: Record<string, number>): Record<string, number> {
  const ids = Object.keys(shares).filter((id) => shares[id] > 0);
  const result: Record<string, number> = Object.fromEntries(Object.keys(shares).map((id) => [id, 0]));
  const sum = ids.reduce((s, id) => s + shares[id], 0);
  const whole = Math.max(0, Math.round(total));
  if (!ids.length || sum <= 0 || whole === 0) return result;

  const exact = ids.map((id) => ({ id, value: (whole * shares[id]) / sum }));
  exact.forEach((e) => { result[e.id] = Math.floor(e.value); });
  let remaining = whole - exact.reduce((s, e) => s + Math.floor(e.value), 0);
  exact
    .sort((a, b) => (b.value - Math.floor(b.value)) - (a.value - Math.floor(a.value)) || shares[b.id] - shares[a.id])
    .forEach((e) => {
      if (remaining > 0) {
        result[e.id] += 1;
        remaining -= 1;
      }
    });
  return result;
}

/**
 * Meta de cada pessoa por BU.
 * - `manual`: pessoas com ajuste manual no período (valores mantidos).
 * - BU sem nenhum peso definido → `null` (não mexer nessa BU).
 */
export function distributeByWeights(
  official: BuValues,
  userIds: string[],
  weights: WeightsMap,
  manual: Record<string, BuValues> = {}
): { values: Record<string, BuValues>; untouchedBus: BuKey[] } {
  const values: Record<string, BuValues> = Object.fromEntries(userIds.map((id) => [id, manual[id] ? { ...manual[id] } : emptyBu()]));
  const untouchedBus: BuKey[] = [];

  BU_KEYS.forEach((bu) => {
    const auto = userIds.filter((id) => !manual[id]);
    const shares = Object.fromEntries(auto.map((id) => [id, Math.max(0, Number(weights[id]?.[bu] ?? 0))]));
    const anyWeight = userIds.some((id) => Number(weights[id]?.[bu] ?? 0) > 0);
    if (!anyWeight) {
      untouchedBus.push(bu);
      return;
    }
    const manualSum = userIds.filter((id) => manual[id]).reduce((s, id) => s + (manual[id][bu] ?? 0), 0);
    const remaining = Math.max(0, Math.round(official[bu]) - manualSum);
    const split = splitByShares(remaining, shares);
    auto.forEach((id) => { values[id][bu] = split[id] ?? 0; });
  });

  return { values, untouchedBus };
}

/** Soma dos percentuais por BU (para validar 100%). */
export function weightTotals(weights: WeightsMap, userIds: string[]): BuValues {
  const totals = emptyBu();
  userIds.forEach((id) => BU_KEYS.forEach((bu) => { totals[bu] += Number(weights[id]?.[bu] ?? 0); }));
  BU_KEYS.forEach((bu) => { totals[bu] = Math.round(totals[bu] * 100) / 100; });
  return totals;
}

// ---------------------------------------------------------------------------
// Períodos (mesma regra da tela de metas: semana seg–dom cortada no mês)
// ---------------------------------------------------------------------------

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
};

export const todayIso = () => iso(new Date());

/** Semanas (seg–dom, cortadas no mês) e meses que tocam [from, to]. */
export function periodsBetween(from: string, to: string): GoalPeriod[] {
  const out: GoalPeriod[] = [];
  const start = parse(from);
  const end = parse(to);
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1, 12);
  while (cursor <= end) {
    const y = cursor.getFullYear();
    const m = cursor.getMonth();
    const monthStart = new Date(y, m, 1, 12);
    const monthEnd = new Date(y, m + 1, 0, 12);
    if (monthEnd >= start) out.push({ type: 'month', start: iso(monthStart), end: iso(monthEnd) });
    const day = new Date(monthStart);
    while (day <= monthEnd) {
      const dow = day.getDay();
      const weekEnd = new Date(day);
      weekEnd.setDate(day.getDate() + (dow === 0 ? 0 : 7 - dow));
      const clippedEnd = weekEnd > monthEnd ? monthEnd : weekEnd;
      if (clippedEnd >= start && day <= end) out.push({ type: 'week', start: iso(day), end: iso(clippedEnd) });
      day.setTime(clippedEnd.getTime());
      day.setDate(day.getDate() + 1);
    }
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Banco
// ---------------------------------------------------------------------------

export async function loadWeights(): Promise<{ weights: WeightsMap; missingTable: boolean }> {
  const { data, error } = await supabase.from('metas_pesos').select('user_id, bu, percentual');
  if (error) {
    return { weights: {}, missingTable: /metas_pesos/.test(error.message) };
  }
  const weights: WeightsMap = {};
  (data || []).forEach((r: any) => {
    weights[r.user_id] = { ...(weights[r.user_id] ?? {}), [r.bu]: Number(r.percentual) || 0 };
  });
  return { weights, missingTable: false };
}

export async function saveWeights(weights: WeightsMap, userIds: string[], updatedBy?: string | null) {
  const rows = userIds.flatMap((id) =>
    BU_KEYS.map((bu) => ({
      user_id: id,
      bu,
      percentual: Math.max(0, Math.min(100, Number(weights[id]?.[bu] ?? 0))),
      updated_at: new Date().toISOString(),
      updated_by: updatedBy ?? null,
    }))
  );
  const { error } = await supabase.from('metas_pesos').upsert(rows, { onConflict: 'user_id,bu' });
  if (error) throw error;
}

/** Meta oficial por BU de cada período, com a mesma regra da tela (importação ativa mais recente com dados no intervalo). */
async function loadOfficialByPeriod(periods: GoalPeriod[]): Promise<{ official: Map<string, BuValues>; academicByPeriod: Map<string, string> }> {
  const official = new Map<string, BuValues>();
  const academicByPeriod = new Map<string, string>();
  if (!periods.length) return { official, academicByPeriod };

  const minStart = periods.reduce((m, p) => (p.start < m ? p.start : m), periods[0].start);
  const maxEnd = periods.reduce((m, p) => (p.end > m ? p.end : m), periods[0].end);

  const { data: imports, error } = await supabase
    .from('goal_imports')
    .select('id, academic_period, file_name, goal_group, status, imported_at')
    .eq('status', 'active')
    .order('imported_at', { ascending: false });
  if (error) throw error;
  const ids = (imports || []).map((i: any) => i.id);
  let rows: any[] = [];
  for (let offset = 0; ids.length; offset += 1000) {
    const { data, error: rowsError } = await supabase
      .from('goal_daily_data')
      .select('import_id, reference_date, aa, target, actual')
      .in('import_id', ids)
      .gte('reference_date', minStart)
      .lte('reference_date', maxEnd)
      .order('reference_date', { ascending: true })
      .range(offset, offset + 999);
    if (rowsError) throw rowsError;
    rows = rows.concat(data || []);
    if (!data || data.length < 1000) break;
  }

  periods.forEach((p) => {
    const inRange = rows.filter((r) => r.reference_date >= p.start && r.reference_date <= p.end);
    const latest = latestPerPeriodAndGroup(imports || []).filter((item: any) => inRange.some((r) => r.import_id === item.id));
    const previews: Record<string, GoalFilePreview> = {};
    const academicCount = new Map<string, number>();
    latest.forEach((item: any) => {
      const daily = inRange.filter((r) => r.import_id === item.id);
      academicCount.set(item.academic_period, (academicCount.get(item.academic_period) ?? 0) + daily.length);
      previews[`${item.academic_period}|${item.goal_group}`] = {
        fileName: item.file_name,
        group: item.goal_group as GoalImportGroup,
        academicPeriod: item.academic_period,
        rowCount: daily.length,
        startDate: null,
        endDate: null,
        rows: daily.map((r: any) => ({
          date: r.reference_date,
          aa: r.aa === null ? null : Number(r.aa),
          target: r.target === null ? null : Number(r.target),
          actual: r.actual === null ? null : Number(r.actual),
        })),
        filters: [],
        warnings: [],
      };
    });
    const summary = summarizeImportedGoals(previews, p.start, p.end);
    const key = `${p.type}|${p.start}`;
    official.set(key, {
      bu_presencial: Math.round(summary.byBu.bu_presencial.target),
      bu_digital: Math.round(summary.byBu.bu_digital.target),
      pos: Math.round(summary.byBu.pos.target),
      tecnico: Math.round(summary.byBu.tecnico.target),
    });
    const topAcademic = Array.from(academicCount.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];
    if (topAcademic) academicByPeriod.set(key, topAcademic);
  });

  return { official, academicByPeriod };
}

/** Último dia com meta importada (para saber até onde gerar). */
async function lastImportedDate(): Promise<string | null> {
  const { data: imports } = await supabase.from('goal_imports').select('id').eq('status', 'active');
  const ids = (imports || []).map((i: any) => i.id);
  if (!ids.length) return null;
  const { data } = await supabase
    .from('goal_daily_data')
    .select('reference_date')
    .in('import_id', ids)
    .order('reference_date', { ascending: false })
    .limit(1);
  return data?.[0]?.reference_date ?? null;
}

export interface ApplyResult {
  periods: number;
  goalsWritten: number;
  untouchedBus: BuKey[];
}

/**
 * Recalcula e grava as metas individuais dos períodos informados.
 * Só períodos atuais/futuros (fim ≥ hoje); metas com ajuste manual são mantidas.
 */
export async function applyWeightedGoals(periods: GoalPeriod[], userIds: string[], defaultAcademicPeriod = '2026.3'): Promise<ApplyResult> {
  const today = todayIso();
  const open = periods.filter((p) => p.end >= today);
  const result: ApplyResult = { periods: 0, goalsWritten: 0, untouchedBus: [] };
  if (!open.length || !userIds.length) return result;

  const { weights, missingTable } = await loadWeights();
  if (missingTable) throw new Error('A tabela de pesos ainda não existe. Rode supabase/metas-pesos.sql no Supabase.');
  const { official, academicByPeriod } = await loadOfficialByPeriod(open);
  const untouched = new Set<BuKey>();

  for (const p of open) {
    const key = `${p.type}|${p.start}`;
    const officialBu = official.get(key) ?? emptyBu();
    const officialTotal = BU_KEYS.reduce((s, bu) => s + officialBu[bu], 0);

    // Período operacional (goal_periods): mantém o que já existir (ciclo, fim da semana, gap)
    const { data: existingPeriod } = await supabase
      .from('goal_periods')
      .select('id, academic_period, reference_end, gap_total')
      .eq('period_type', p.type)
      .eq('reference_start', p.start)
      .maybeSingle();
    const academic = existingPeriod?.academic_period || academicByPeriod.get(key) || defaultAcademicPeriod;
    const end = existingPeriod?.reference_end || p.end;

    // Sem meta oficial e sem período criado: nada a distribuir
    if (!officialTotal && !existingPeriod) continue;

    let periodId = existingPeriod?.id as string | undefined;
    if (periodId) {
      const { error } = await supabase.from('goal_periods').update({ target_total: officialTotal }).eq('id', periodId);
      if (error) throw error;
    } else {
      const { data, error } = await supabase
        .from('goal_periods')
        .insert({ academic_period: academic, period_type: p.type, reference_start: p.start, reference_end: end, target_total: officialTotal, gap_total: 0 })
        .select('id')
        .single();
      if (error || !data) throw error || new Error('Não foi possível registrar o período de metas.');
      periodId = data.id;
    }

    const types = p.type === 'month' ? ['month', 'mensal'] : ['week', 'semanal'];
    const { data: existingGoals, error: goalsError } = await supabase
      .from('goals')
      .select('*')
      .in('type', types)
      .eq('reference_start', p.start);
    if (goalsError) throw goalsError;

    const byUser = new Map<string, any>();
    (existingGoals || []).forEach((g: any) => byUser.set(g.user_id, g));
    const manual: Record<string, BuValues> = {};
    byUser.forEach((g, uid) => {
      if (g.ajuste_manual && userIds.includes(uid)) {
        manual[uid] = {
          bu_presencial: Number(g.target_bu_presencial) || 0,
          bu_digital: Number(g.target_bu_digital) || 0,
          pos: Number(g.target_pos) || 0,
          tecnico: Number(g.target_tecnico) || 0,
        };
      }
    });

    const { values, untouchedBus } = distributeByWeights(officialBu, userIds, weights, manual);
    untouchedBus.forEach((bu) => untouched.add(bu));

    const payload = userIds
      .filter((uid) => !manual[uid])
      .map((uid) => {
        const prev = byUser.get(uid);
        const v = { ...values[uid] };
        // BU sem pesos definidos: mantém o valor que já estava gravado
        untouchedBus.forEach((bu) => { v[bu] = Number(prev?.[BU_FIELD[bu]]) || 0; });
        const total = v.bu_presencial + v.bu_digital + v.pos + v.tecnico;
        return {
          user_id: uid,
          type: p.type,
          reference_start: p.start,
          reference_end: end,
          academic_period: prev?.academic_period || academic,
          goal_period_id: periodId,
          target_bu_presencial: v.bu_presencial,
          target_bu_digital: v.bu_digital,
          target_graduacao: v.bu_presencial + v.bu_digital,
          target_pos: v.pos,
          target_tecnico: v.tecnico,
          target_total: total,
          ajuste_manual: false,
        };
      });

    if (payload.length) {
      const { error } = await supabase.from('goals').upsert(payload, { onConflict: 'user_id,type,reference_start,academic_period' });
      if (error) throw error;
      result.goalsWritten += payload.length;
    }
    result.periods += 1;
  }

  result.untouchedBus = Array.from(untouched);
  return result;
}

/** Recalcula da semana atual até o último dia com meta importada (máx. 6 meses). */
export async function syncCurrentAndFutureGoals(userIds: string[]): Promise<ApplyResult> {
  const today = todayIso();
  const last = await lastImportedDate();
  const limit = new Date();
  limit.setMonth(limit.getMonth() + 6);
  const to = last && last > today ? (last < iso(limit) ? last : iso(limit)) : today;
  return applyWeightedGoals(periodsBetween(today, to), userIds);
}
