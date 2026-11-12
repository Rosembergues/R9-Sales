import React from 'react';
import { AlertCircle, ArrowLeft, CheckCircle2, RotateCw, Save, Target } from 'lucide-react';
import { GoalManagementPageProps } from './goalManagement/shared';
import { useGoalManagement } from './goalManagement/useGoalManagement';
import PeriodControls from './goalManagement/PeriodControls';
import ImportedGoalsPanel from './goalManagement/ImportedGoalsPanel';
import WeightsPanel from './goalManagement/WeightsPanel';
import ConsultantGoalsTable from './goalManagement/ConsultantGoalsTable';

export const GoalManagementPage: React.FC<GoalManagementPageProps> = (props) => {
  const st = useGoalManagement(props);
  const {
    onBackToPlanner, isLoading, isSaving, toast, hasUnsavedChanges, handleSave, reset,
  } = st;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-xs font-semibold ${
            toast.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : toast.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-800'
              : 'bg-blue-50 border-blue-200 text-blue-800'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <AlertCircle className="w-4 h-4" />
          )}
          {toast.message}
        </div>
      )}

      {/* Cabeçalho */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          {onBackToPlanner && (
            <button
              onClick={onBackToPlanner}
              className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl border border-gray-200 transition-colors cursor-pointer"
              title="Voltar"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#0052cc] border border-blue-100 flex items-center justify-center">
                <Target className="w-4 h-4" />
              </div>
              <h1 className="text-lg font-bold text-gray-900">Metas dos Consultores por BU</h1>
              <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                ADMIN
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              A meta oficial importada é distribuída automaticamente pelos pesos de cada consultor em cada BU (da semana atual em diante). Ajuste uma pessoa à mão só quando precisar.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={reset}
            disabled={!hasUnsavedChanges}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-gray-600 bg-white border border-gray-200 rounded-xl disabled:opacity-40 hover:bg-gray-50 transition-colors cursor-pointer"
          >
            <RotateCw className="w-3.5 h-3.5" /> Descartar
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl bg-[#0052cc] hover:bg-[#00478f] text-white disabled:opacity-50 transition-colors cursor-pointer shadow-sm"
          >
            <Save className="w-4 h-4" /> {isSaving ? 'Salvando...' : 'Salvar metas'}
          </button>
        </div>
      </div>

      {/* Period Selection Controls */}
      <PeriodControls st={st} />

      {/* BALIZADOR AUTOMÁTICO DA SEMANA (Vindo dos Arquivos Importados) */}
      <ImportedGoalsPanel st={st} />

      {/* PESOS POR BU */}
      <WeightsPanel st={st} />

      {/* CONSULTANTS GOALS TABLE */}
      <ConsultantGoalsTable st={st} />

      <div className="flex items-center justify-between text-[11px] text-gray-400 px-1">
        <span>As metas salvas são refletidas diretamente no ranking semanal e home.</span>
        <span>
          {isLoading
            ? 'Carregando metas...'
            : hasUnsavedChanges
            ? 'Há alterações pendentes de salvamento.'
            : 'Tudo salvo e sincronizado.'}
        </span>
      </div>
    </div>
  );
};
