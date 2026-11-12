import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { errorText } from '../lib/errors';
import { latestPerPeriodAndGroup } from '../lib/goalImportService';
import { GoalDailyPoint } from '../lib/goalProgress';
import type { GoalDailyRow, GoalImportRow } from '../lib/dbTypes';

const PAGE = 1000;

export interface OfficialGoalsState {
  points: GoalDailyPoint[];
  /** Data/hora da importação mais recente entre as ativas. */
  lastImportAt: string | null;
  hasImports: boolean;
  loading: boolean;
  error: string | null;
}

/**
 * Carrega as metas oficiais importadas do Power BI: a importação ativa mais recente
 * de cada (ciclo, modalidade), com todos os dias. Pagina para não esbarrar no limite
 * de 1000 linhas por consulta do Supabase.
 */
type Loaded = Omit<OfficialGoalsState, 'loading' | 'error'>;

// Cache compartilhado: Home e formulário de venda usam os mesmos dados sem buscar duas vezes.
const CACHE_TTL = 5 * 60 * 1000;
let cache: { at: number; promise: Promise<Loaded> } | null = null;

export function invalidateOfficialGoals() {
  cache = null;
}

const loadOfficialGoals = (): Promise<Loaded> => {
  if (cache && Date.now() - cache.at < CACHE_TTL) return cache.promise;
  const promise = fetchOfficialGoals();
  cache = { at: Date.now(), promise };
  promise.catch(() => { cache = null; });
  return promise;
};

export function useOfficialGoals(): OfficialGoalsState {
  const [state, setState] = useState<OfficialGoalsState>({
    points: [], lastImportAt: null, hasImports: false, loading: true, error: null,
  });

  useEffect(() => {
    let alive = true;
    loadOfficialGoals()
      .then(loaded => { if (alive) setState({ ...loaded, loading: false, error: null }); })
      .catch((err: unknown) => {
        console.warn('Erro ao carregar metas oficiais:', err);
        if (alive) setState(s => ({ ...s, loading: false, error: errorText(err, 'Erro ao carregar metas.') }));
      });
    return () => { alive = false; };
  }, []);

  return state;
}

async function fetchOfficialGoals(): Promise<Loaded> {
  const { data: imports, error } = await supabase
    .from('goal_imports')
    .select('id, academic_period, goal_group, imported_at')
    .eq('status', 'active')
    .order('imported_at', { ascending: false });
  if (error) throw error;

  const latest = latestPerPeriodAndGroup((imports || []) as GoalImportRow[]);
  const byId = new Map(latest.map((i) => [i.id, i]));
  const points: GoalDailyPoint[] = [];

  if (latest.length) {
    for (let from = 0; ; from += PAGE) {
      const { data, error: rowsError } = await supabase
        .from('goal_daily_data')
        .select('import_id, reference_date, aa, target, actual')
        .in('import_id', [...byId.keys()])
        .order('reference_date', { ascending: true })
        .order('id', { ascending: true })
        .range(from, from + PAGE - 1);
      if (rowsError) throw rowsError;
      ((data || []) as GoalDailyRow[]).forEach((r) => {
        const imp = byId.get(r.import_id);
        if (!imp) return; // linha de uma importação que não é a vigente
        points.push({
          period: imp.academic_period,
          group: imp.goal_group,
          date: r.reference_date,
          aa: r.aa === null ? null : Number(r.aa),
          target: r.target === null ? null : Number(r.target),
          actual: r.actual === null ? null : Number(r.actual),
        });
      });
      if (!data || data.length < PAGE) break;
    }
  }

  return {
    points,
    lastImportAt: latest[0]?.imported_at ?? null,
    hasImports: latest.length > 0,
  };
}
