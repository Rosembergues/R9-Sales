import { Sparkles, Percent } from 'lucide-react';
import type { GoalManagementState } from './useGoalManagement';

/** Metas oficiais importadas do período (por BU), para apoiar a distribuição. */
export default function ImportedGoalsPanel({ st }: { st: GoalManagementState }) {
  const {
    showWeights, setShowWeights, isSyncing, currentRange, importedSummary, distributedTotals, isClosedPeriod, handleRecalculate,
  } = st;

  return (
    <>
    <div className="bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-slate-50 border border-blue-200 rounded-2xl p-5 shadow-2xs">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-blue-100/80">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-blue-700">
              Balizador da Semana Oficial (Planilhas Importadas)
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
              {currentRange.start} → {currentRange.end}
            </span>
          </div>
          <p className="text-xs text-slate-600 mt-1">
            Estes são os valores extraídos automaticamente dos arquivos de metas para o intervalo selecionado. Utilize-os para balizar a cobrança da equipe.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowWeights(v => !v)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border transition-colors cursor-pointer ${showWeights ? 'bg-white text-blue-700 border-blue-300' : 'bg-white/70 text-slate-700 border-slate-200 hover:bg-white'}`}
          >
            <Percent className="w-3.5 h-3.5" /> Pesos por BU
          </button>
          <button
            onClick={handleRecalculate}
            disabled={isClosedPeriod || isSyncing}
            title={isClosedPeriod ? 'Período encerrado: metas congeladas' : 'Recalcular pelos pesos (mantém ajustes manuais)'}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl transition-colors cursor-pointer shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5" /> {isSyncing ? 'Calculando…' : 'Recalcular pelos pesos'}
          </button>
        </div>
      </div>

      {/* 4 Cards das BUs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
        <div className="bg-white p-3.5 rounded-xl border border-blue-100 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 block">
            BU Presencial
          </span>
          <span className="text-[10px] text-gray-400 block mt-0.5">Presencial + Semi + Ao Vivo</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-black text-slate-900">
              {Math.round(importedSummary.byBu.bu_presencial.target)}
            </span>
            <span className="text-[11px] font-semibold text-emerald-700">
              Realizado: {Math.round(importedSummary.byBu.bu_presencial.actual)}
            </span>
          </div>
          <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between text-[10px]">
            <span className="text-gray-400">Distribuído equipe:</span>
            <strong
              className={
                distributedTotals.buPresencial >= Math.round(importedSummary.byBu.bu_presencial.target)
                  ? 'text-emerald-700'
                  : 'text-amber-700'
              }
            >
              {distributedTotals.buPresencial}
            </strong>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-emerald-100 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">
            BU Digital
          </span>
          <span className="text-[10px] text-gray-400 block mt-0.5">EAD + DLEX (Flex)</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-black text-slate-900">
              {Math.round(importedSummary.byBu.bu_digital.target)}
            </span>
            <span className="text-[11px] font-semibold text-emerald-700">
              Realizado: {Math.round(importedSummary.byBu.bu_digital.actual)}
            </span>
          </div>
          <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between text-[10px]">
            <span className="text-gray-400">Distribuído equipe:</span>
            <strong
              className={
                distributedTotals.buDigital >= Math.round(importedSummary.byBu.bu_digital.target)
                  ? 'text-emerald-700'
                  : 'text-amber-700'
              }
            >
              {distributedTotals.buDigital}
            </strong>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-purple-100 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 block">
            Pós-Graduação
          </span>
          <span className="text-[10px] text-gray-400 block mt-0.5">Presencial + Digital</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-black text-slate-900">
              {Math.round(importedSummary.byBu.pos.target)}
            </span>
            <span className="text-[11px] font-semibold text-emerald-700">
              Realizado: {Math.round(importedSummary.byBu.pos.actual)}
            </span>
          </div>
          <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between text-[10px]">
            <span className="text-gray-400">Distribuído equipe:</span>
            <strong
              className={
                distributedTotals.pos >= Math.round(importedSummary.byBu.pos.target)
                  ? 'text-emerald-700'
                  : 'text-amber-700'
              }
            >
              {distributedTotals.pos}
            </strong>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-amber-100 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 block">
            Curso Técnico
          </span>
          <span className="text-[10px] text-gray-400 block mt-0.5">Técnico Presencial</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-black text-slate-900">
              {Math.round(importedSummary.byBu.tecnico.target)}
            </span>
            <span className="text-[11px] font-semibold text-emerald-700">
              Realizado: {Math.round(importedSummary.byBu.tecnico.actual)}
            </span>
          </div>
          <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between text-[10px]">
            <span className="text-gray-400">Distribuído equipe:</span>
            <strong
              className={
                distributedTotals.tecnico >= Math.round(importedSummary.byBu.tecnico.target)
                  ? 'text-emerald-700'
                  : 'text-amber-700'
              }
            >
              {distributedTotals.tecnico}
            </strong>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
