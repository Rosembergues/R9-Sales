import { Save, Lock } from 'lucide-react';
import { BU_KEYS } from '../../../lib/goalWeights';
import { BU_LABEL, BU_COLOR } from './shared';
import type { GoalManagementState } from './useGoalManagement';

/** Pesos por BU de cada consultor e aviso de período encerrado. */
export default function WeightsPanel({ st }: { st: GoalManagementState }) {
  const {
    weights, setWeights, savedWeights, weightsMissing, showWeights, isSavingWeights, displayedConsultants, isClosedPeriod, weightSums, weightsDirty, setWeight, handleSaveWeights,
  } = st;

  return (
    <>
    {showWeights && (
      <div className="bg-white rounded-2xl border border-blue-200 overflow-hidden shadow-2xs">
        <div className="p-5 border-b border-gray-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-gray-900">Pesos por BU (%)</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Quanto da meta de cada BU vai para cada pessoa. Cada coluna precisa somar 100%. Peso 0 = não recebe meta naquela BU.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setWeights(savedWeights)}
              disabled={!weightsDirty}
              className="px-3 py-2 text-xs font-semibold text-gray-600 bg-white border border-gray-200 rounded-xl disabled:opacity-40 cursor-pointer"
            >
              Descartar
            </button>
            <button
              onClick={handleSaveWeights}
              disabled={!weightsDirty || isSavingWeights}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-[#0052cc] hover:bg-[#00478f] text-white disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" /> {isSavingWeights ? 'Salvando…' : 'Salvar pesos e recalcular'}
            </button>
          </div>
        </div>
        {weightsMissing ? (
          <p className="p-5 text-xs text-amber-700 bg-amber-50">A tabela de pesos ainda não existe. Rode supabase/metas-pesos.sql no Supabase.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-5 py-2.5 font-bold text-gray-600">Consultor</th>
                  {BU_KEYS.map(bu => (
                    <th key={bu} className={`px-3 py-2.5 font-bold text-center ${BU_COLOR[bu]}`}>{BU_LABEL[bu]}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {displayedConsultants.map(c => (
                  <tr key={c.id}>
                    <td className="px-5 py-2 font-semibold text-gray-900">{c.name || c.email}</td>
                    {BU_KEYS.map(bu => (
                      <td key={bu} className="px-3 py-2 text-center">
                        <div className="inline-flex items-center gap-1">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.5"
                            value={weights[c.id]?.[bu] ?? 0}
                            onChange={e => setWeight(c.id, bu, e.target.value)}
                            className="w-16 text-center px-2 py-1.5 border border-gray-200 rounded-lg text-sm font-bold text-gray-900 focus:ring-1 focus:ring-blue-500"
                          />
                          <span className="text-gray-400">%</span>
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 border-t border-gray-200 font-bold">
                <tr>
                  <td className="px-5 py-2.5 text-gray-700">Soma</td>
                  {BU_KEYS.map(bu => {
                    const sum = weightSums[bu];
                    const ok = Math.abs(sum - 100) < 0.01;
                    return (
                      <td key={bu} className={`px-3 py-2.5 text-center font-black ${ok ? 'text-emerald-700' : sum === 0 ? 'text-gray-400' : 'text-red-600'}`}>
                        {sum.toLocaleString('pt-BR')}%{!ok && sum > 0 && <div className="text-[10px] font-semibold">{sum > 100 ? `sobram ${(sum - 100).toLocaleString('pt-BR')}` : `faltam ${(100 - sum).toLocaleString('pt-BR')}`}</div>}
                        {sum === 0 && <div className="text-[10px] font-semibold">sem pesos</div>}
                      </td>
                    );
                  })}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    )}

    {isClosedPeriod && (
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
        <Lock className="w-3.5 h-3.5" /> Período encerrado: as metas ficam congeladas e não são recalculadas pelos pesos.
      </div>
    )}
    </>
  );
}
