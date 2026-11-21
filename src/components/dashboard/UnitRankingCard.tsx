import React from 'react';
import { Medal, Trophy } from 'lucide-react';
import type { UnitRankingRow } from '../../lib/dbTypes';
import type { UnitRankingState } from '../../hooks/useUnitRanking';

const fmt = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
const fmtDate = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

const BU_LABEL: Record<UnitRankingRow['bu'], string> = {
  bu_presencial: 'BU Presencial',
  bu_digital: 'BU Digital',
};

const ORDER: UnitRankingRow['bu'][] = ['bu_presencial', 'bu_digital'];

interface Props {
  ranking: UnitRankingState;
}

/** Posição do R9-Taquara entre as unidades e participação no total do mercado, por BU. */
export const UnitRankingCard: React.FC<Props> = ({ ranking }) => {
  const { rows, loading, error } = ranking;
  const byBu = new Map(rows.map((r) => [r.bu, r]));
  const hasAny = rows.length > 0;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-500" />
          Ranking entre Unidades
        </h2>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-pulse">
          {[0, 1].map((i) => <div key={i} className="h-24 rounded-xl bg-slate-100" />)}
        </div>
      ) : error ? (
        <p className="text-xs text-rose-600">{error}</p>
      ) : !hasAny ? (
        <p className="text-xs text-slate-400">
          Ainda sem dados do relatório "Rankings" automático. Assim que o Power Automate começar a enviar, a posição aparece aqui.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {ORDER.map((bu) => {
            const row = byBu.get(bu);
            if (!row) {
              return (
                <div key={bu} className="rounded-xl bg-slate-50 border border-slate-200 p-4">
                  <div className="text-xs font-semibold text-slate-500">{BU_LABEL[bu]}</div>
                  <p className="text-xs text-slate-400 mt-2">Sem dados ainda.</p>
                </div>
              );
            }
            const share = row.market_real && row.market_real > 0 && row.our_real !== null
              ? (row.our_real / row.market_real) * 100
              : null;
            return (
              <div key={bu} className="rounded-xl bg-slate-50 border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-semibold text-slate-500">{BU_LABEL[bu]}</div>
                  <div className="text-[10px] text-slate-400">{fmtDate(row.reference_date)}</div>
                </div>
                <div className="flex items-baseline gap-2 mt-1">
                  <Medal className="w-5 h-5 text-amber-500" />
                  <span className="text-2xl font-black text-slate-950 font-['Space_Grotesk']">
                    {row.our_rank !== null ? `#${row.our_rank}` : '—'}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 mt-2">
                  Nossa unidade: <span className="font-bold text-slate-800">{row.our_real !== null ? fmt(row.our_real) : '—'}</span>
                  {row.our_meta !== null && row.our_meta > 0 && <> / meta {fmt(row.our_meta)}</>}
                </div>
                <div className="text-[11px] text-slate-500">
                  Total das unidades: <span className="font-bold text-slate-800">{row.market_real !== null ? fmt(row.market_real) : '—'}</span>
                  {share !== null && <span className="text-slate-400"> ({share.toFixed(1)}% é nosso)</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
