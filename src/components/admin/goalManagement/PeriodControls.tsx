import { CalendarDays, CalendarRange } from 'lucide-react';
import { toInt } from './shared';
import type { GoalManagementState } from './useGoalManagement';

/** Escolha de mês/semana, tipo de meta e limites da semana. */
export default function PeriodControls({ st }: { st: GoalManagementState }) {
  const {
    configType, setConfigType, selectedMonth, setSelectedMonth, selectedYear, setSelectedYear, teamConfig, setTeamConfig,
  } = st;

  return (
    <>
    <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-2xs">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-xl border border-gray-200 w-fit">
          <button
            onClick={() => setConfigType('semanal')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              configType === 'semanal'
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <CalendarRange className="inline w-3.5 h-3.5 mr-1.5" /> Meta semanal (Operação)
          </button>
          <button
            onClick={() => setConfigType('mensal')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              configType === 'mensal'
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <CalendarDays className="inline w-3.5 h-3.5 mr-1.5" /> Meta mensal
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs font-semibold text-gray-500">Mês:</label>
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(Number(e.target.value))}
            className="px-3 py-2 border border-gray-200 rounded-xl text-xs bg-white font-medium" name="src_components_admin_goalmanagementpage_tsx_select_1"
          >
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {new Date(2026, i, 1).toLocaleDateString('pt-BR', { month: 'long' })}
              </option>
            ))}
          </select>

          <label className="text-xs font-semibold text-gray-500">Ano:</label>
          <select
            value={selectedYear}
            onChange={e => setSelectedYear(Number(e.target.value))}
            className="px-3 py-2 border border-gray-200 rounded-xl text-xs bg-white font-medium" name="src_components_admin_goalmanagementpage_tsx_select_2"
          >
            {[2026, 2027, 2028].map(year => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>

        </div>
      </div>

      {/* Week bounds editor */}
      {configType === 'semanal' && (
        <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-gray-700">Intervalo da Semana:</span>
            <div className="flex items-center gap-2 text-xs">
              <input
                type="date"
                value={teamConfig.weekStart}
                onChange={e => setTeamConfig(v => ({ ...v, weekStart: e.target.value }))}
                className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs" name="src_components_admin_goalmanagementpage_tsx_input_4"
              />
              <span className="text-gray-400">até</span>
              <input
                type="date"
                value={teamConfig.weekEnd}
                onChange={e => setTeamConfig(v => ({ ...v, weekEnd: e.target.value }))}
                className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs" name="src_components_admin_goalmanagementpage_tsx_input_5"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-xs text-gray-500 font-semibold">Meta da equipe na semana:</label>
            <input
              type="number"
              min="0"
              value={teamConfig.weeklyTarget || ''}
              onChange={e => setTeamConfig(v => ({ ...v, weeklyTarget: toInt(e.target.value) }))}
              className="w-20 px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs font-black text-blue-700 text-center"
              placeholder="0" name="src_components_admin_goalmanagementpage_tsx_input_6"
            />
            <span className="text-xs text-gray-400">matrículas</span>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
