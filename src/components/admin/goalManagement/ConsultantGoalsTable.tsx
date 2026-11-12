import { Search, Users, Undo2 } from 'lucide-react';
import type { GoalManagementState } from './useGoalManagement';

/** Tabela de metas de cada consultor, com ajuste manual e volta ao peso. */
export default function ConsultantGoalsTable({ st }: { st: GoalManagementState }) {
  const {
    configType, searchTerm, setSearchTerm, goalsValues, weights, manualIds, activeConsultants, displayedConsultants, defaultGoal, updateConsultantGoal, distributedTotals, isClosedPeriod, handleBackToWeights, savedManual,
  } = st;

  return (
    <>
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-2xs">
      <div className="p-5 border-b border-gray-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-gray-900">
            Distribuição por Consultor ({configType === 'mensal' ? 'Mensal' : 'Semanal'})
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Calculada pelos pesos. Editar um valor marca a pessoa como ajustada à mão neste período.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-xs text-gray-500">
            <Users className="inline w-3.5 h-3.5 mr-1" />
            {activeConsultants.length} consultores ·{' '}
            <strong className="text-gray-900 font-bold">{distributedTotals.total}</strong> no total
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-gray-400" />
            <input
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar consultor"
              className="pl-9 pr-3 py-2 text-xs border border-gray-200 rounded-xl w-52 bg-slate-50 focus:bg-white transition-colors" name="src_components_admin_goalmanagementpage_tsx_input_7"
            />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-5 py-3 font-bold text-gray-600">Consultor</th>
              <th className="px-3 py-3 font-bold text-blue-700 text-center">
                BU Presencial <br />
                <span className="text-[10px] font-normal text-gray-400">Presencial / Semi / Ao Vivo</span>
              </th>
              <th className="px-3 py-3 font-bold text-emerald-700 text-center">
                BU Digital <br />
                <span className="text-[10px] font-normal text-gray-400">EAD / DLEX</span>
              </th>
              <th className="px-3 py-3 font-bold text-purple-700 text-center">
                Pós-Graduação <br />
                <span className="text-[10px] font-normal text-gray-400">Pres. / Digital</span>
              </th>
              <th className="px-3 py-3 font-bold text-amber-700 text-center">
                Curso Técnico <br />
                <span className="text-[10px] font-normal text-gray-400">Presencial</span>
              </th>
              <th className="px-5 py-3 text-right font-bold text-gray-900">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {displayedConsultants.map(consultant => {
              const goal = goalsValues[consultant.id] ?? defaultGoal(configType);
              return (
                <tr key={consultant.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-5 py-3">
                    <div className="font-semibold text-gray-900 flex items-center gap-2">
                      {consultant.name || consultant.email}
                      {manualIds.has(consultant.id) && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">AJUSTADO</span>
                      )}
                    </div>
                    <div className="text-[10px] text-gray-400 flex items-center gap-2">
                      {consultant.email}
                      {manualIds.has(consultant.id) && !isClosedPeriod && savedManual(consultant.id) && (
                        <button onClick={() => handleBackToWeights(consultant.id)} className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-blue-600 hover:underline cursor-pointer">
                          <Undo2 className="w-3 h-3" /> voltar ao peso
                        </button>
                      )}
                    </div>
                  </td>

                  <td className="px-3 py-3 text-center">
                    <input
                      type="number"
                      min="0"
                      value={goal.target_bu_presencial ?? 0}
                      onChange={e =>
                        updateConsultantGoal(consultant.id, 'target_bu_presencial', e.target.value)
                      }
                      className="w-16 text-center px-2 py-1.5 border border-blue-200 bg-blue-50/30 rounded-lg text-sm font-bold text-blue-900 focus:bg-white focus:ring-1 focus:ring-blue-500" name="src_components_admin_goalmanagementpage_tsx_input_8"
                    />
                    <div className="text-[10px] text-gray-400 mt-0.5">{weights[consultant.id]?.bu_presencial ?? 0}%</div>
                  </td>

                  <td className="px-3 py-3 text-center">
                    <input
                      type="number"
                      min="0"
                      value={goal.target_bu_digital ?? 0}
                      onChange={e =>
                        updateConsultantGoal(consultant.id, 'target_bu_digital', e.target.value)
                      }
                      className="w-16 text-center px-2 py-1.5 border border-emerald-200 bg-emerald-50/30 rounded-lg text-sm font-bold text-emerald-900 focus:bg-white focus:ring-1 focus:ring-emerald-500" name="src_components_admin_goalmanagementpage_tsx_input_9"
                    />
                    <div className="text-[10px] text-gray-400 mt-0.5">{weights[consultant.id]?.bu_digital ?? 0}%</div>
                  </td>

                  <td className="px-3 py-3 text-center">
                    <input
                      type="number"
                      min="0"
                      value={goal.target_pos ?? 0}
                      onChange={e =>
                        updateConsultantGoal(consultant.id, 'target_pos', e.target.value)
                      }
                      className="w-16 text-center px-2 py-1.5 border border-purple-200 bg-purple-50/30 rounded-lg text-sm font-bold text-purple-900 focus:bg-white focus:ring-1 focus:ring-purple-500" name="src_components_admin_goalmanagementpage_tsx_input_10"
                    />
                    <div className="text-[10px] text-gray-400 mt-0.5">{weights[consultant.id]?.pos ?? 0}%</div>
                  </td>

                  <td className="px-3 py-3 text-center">
                    <input
                      type="number"
                      min="0"
                      value={goal.target_tecnico ?? 0}
                      onChange={e =>
                        updateConsultantGoal(consultant.id, 'target_tecnico', e.target.value)
                      }
                      className="w-16 text-center px-2 py-1.5 border border-amber-200 bg-amber-50/30 rounded-lg text-sm font-bold text-amber-900 focus:bg-white focus:ring-1 focus:ring-amber-500" name="src_components_admin_goalmanagementpage_tsx_input_11"
                    />
                    <div className="text-[10px] text-gray-400 mt-0.5">{weights[consultant.id]?.tecnico ?? 0}%</div>
                  </td>

                  <td className="px-5 py-3 text-right font-black text-sm text-gray-900">
                    {goal.target_total}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-slate-50 border-t border-gray-200 font-bold">
            <tr>
              <td className="px-5 py-3 text-gray-700">Total Distribuído para a Equipe</td>
              <td className="px-3 py-3 text-center text-blue-700 font-black">
                {distributedTotals.buPresencial}
              </td>
              <td className="px-3 py-3 text-center text-emerald-700 font-black">
                {distributedTotals.buDigital}
              </td>
              <td className="px-3 py-3 text-center text-purple-700 font-black">
                {distributedTotals.pos}
              </td>
              <td className="px-3 py-3 text-center text-amber-700 font-black">
                {distributedTotals.tecnico}
              </td>
              <td className="px-5 py-3 text-right text-gray-900 text-sm font-black">
                {distributedTotals.total}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
    </>
  );
}
