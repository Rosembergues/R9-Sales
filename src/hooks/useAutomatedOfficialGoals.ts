import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { errorText } from '../lib/errors';
import type { OfficialGoalSnapshotRow } from '../lib/dbTypes';
import type { GoalDailyPoint } from '../lib/goalProgress';

const PAGE = 1000;
const CACHE_TTL = 5 * 60 * 1000;

interface State {
  points: GoalDailyPoint[];
  lastImportAt: string | null;
  hasImports: boolean;
  loading: boolean;
  error: string | null;
}

type Loaded = Omit<State, 'loading' | 'error'>;
let cache: { at: number; promise: Promise<Loaded> } | null = null;

export function useAutomatedOfficialGoals(): State {
  const [state, setState] = useState<State>({
    points: [], lastImportAt: null, hasImports: false, loading: true, error: null,
  });

  useEffect(() => {
    let alive = true;
    const promise = cache && Date.now() - cache.at < CACHE_TTL
      ? cache.promise
      : fetchSnapshots();
    cache = { at: Date.now(), promise };
    promise.catch(() => { cache = null; });
    promise.then(
      loaded => { if (alive) setState({ ...loaded, loading: false, error: null }); },
      (err: unknown) => {
        console.warn('Erro ao carregar metas oficiais automatizadas:', err);
        if (alive) setState(s => ({ ...s, loading: false, error: errorText(err, 'Erro ao carregar metas oficiais.') }));
      },
    );
    return () => { alive = false; };
  }, []);

  return state;
}

async function fetchSnapshots(): Promise<Loaded> {
  const rows: OfficialGoalSnapshotRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('official_goal_snapshots')
      .select('academic_period, product, goal_group, reference_date, aa_to_date, target_to_date, actual_to_date, cycle_target, updated_at')
      .order('academic_period', { ascending: true })
      .order('goal_group', { ascending: true })
      .order('reference_date', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...((data || []) as OfficialGoalSnapshotRow[]));
    if (!data || data.length < PAGE) break;
  }

  const previous = new Map<string, { aa: number; target: number; actual: number }>();
  const points = rows.map(row => {
    const key = `${row.academic_period}|${row.goal_group}`;
    const prior = previous.get(key);
    const aa = row.aa_to_date === null ? null : Number(row.aa_to_date);
    const target = row.target_to_date === null ? null : Number(row.target_to_date);
    const actual = row.actual_to_date === null ? null : Number(row.actual_to_date);
    previous.set(key, { aa: aa ?? prior?.aa ?? 0, target: target ?? prior?.target ?? 0, actual: actual ?? prior?.actual ?? 0 });
    return {
      period: row.academic_period,
      group: row.goal_group,
      date: row.reference_date,
      aa: aa === null ? null : aa - (prior?.aa ?? 0),
      target: target === null ? null : target - (prior?.target ?? 0),
      actual: actual === null ? null : actual - (prior?.actual ?? 0),
      cycleTarget: row.cycle_target === null ? null : Number(row.cycle_target),
    };
  });

  return {
    points,
    lastImportAt: rows.reduce<string | null>((latest, row) => !latest || row.updated_at > latest ? row.updated_at : latest, null),
    hasImports: rows.length > 0,
  };
}
