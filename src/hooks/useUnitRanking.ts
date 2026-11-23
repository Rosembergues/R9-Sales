import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { errorText } from '../lib/errors';
import type { UnitRankingRow } from '../lib/dbTypes';

export interface UnitRankingState {
  /** Linha mais recente de cada BU (no máximo uma por 'bu_presencial'/'bu_digital'). */
  rows: UnitRankingRow[];
  loading: boolean;
  error: string | null;
}

type Loaded = Omit<UnitRankingState, 'loading' | 'error'>;

// Mesmo padrão de cache do useOfficialGoals: Home não busca de novo a cada render.
const CACHE_TTL = 5 * 60 * 1000;
let cache: { at: number; promise: Promise<Loaded> } | null = null;

const loadUnitRanking = (): Promise<Loaded> => {
  if (cache && Date.now() - cache.at < CACHE_TTL) return cache.promise;
  const promise = fetchUnitRanking();
  cache = { at: Date.now(), promise };
  promise.catch(() => { cache = null; });
  return promise;
};

export function useUnitRanking(): UnitRankingState {
  const [state, setState] = useState<UnitRankingState>({ rows: [], loading: true, error: null });

  useEffect(() => {
    let alive = true;
    loadUnitRanking()
      .then(loaded => { if (alive) setState({ ...loaded, loading: false, error: null }); })
      .catch((err: unknown) => {
        console.warn('Erro ao carregar ranking de unidades:', err);
        if (alive) setState(s => ({ ...s, loading: false, error: errorText(err, 'Erro ao carregar ranking.') }));
      });
    return () => { alive = false; };
  }, []);

  return state;
}

const BUS = ['bu_presencial', 'bu_digital'] as const;

async function fetchUnitRanking(): Promise<Loaded> {
  // Só a linha mais recente de cada BU: a tabela ganha uma linha por BU por dia, não precisa trazer o histórico.
  const results = await Promise.all(
    BUS.map((bu) =>
      supabase
        .from('unit_ranking_daily')
        .select('reference_date, bu, academic_period, our_rank, our_aa, our_meta, our_real, market_aa, market_meta, market_real')
        .eq('bu', bu)
        .order('reference_date', { ascending: false })
        .limit(1)
    )
  );

  const rows: UnitRankingRow[] = [];
  for (const { data, error } of results) {
    if (error) {
      // Tabela ainda não criada (automacao-ranking-unidades.sql não rodou): trata como "sem dados", não como erro.
      if (error.code === '42P01' || /could not find the table/i.test(error.message)) return { rows: [] };
      throw error;
    }
    rows.push(...((data || []) as UnitRankingRow[]));
  }
  return { rows };
}
