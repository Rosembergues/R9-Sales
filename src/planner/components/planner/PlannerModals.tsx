import { CheckCircle2 } from 'lucide-react';
import { ruleLabel } from '../../services/taskModelService.ts';
import TaskModelModal from '../TaskModelModal.tsx';
import TaskDetailModal from '../TaskDetailModal.tsx';
import TaskCompletionModal from '../TaskCompletionModal.tsx';
import type { PlannerState } from './usePlannerActions';

/** Janelas do Planejamento: detalhe da tarefa, cadastro, conclusão com formulário e aviso. */
export default function PlannerModals({ st }: { st: PlannerState }) {
  const {
    teamMembers, tagBuckets, userRole, modelModal, setModelModal, modelById, currentUser, selectedTask, setSelectedTask, isDetailOpen, setIsDetailOpen, completingTask, setCompletingTask, isCompletionModalOpen, setIsCompletionModalOpen, toastMessage, setToastMessage, allBuckets, canEditModel, openModel, handleSaveModel, handleDeleteModel, handleConfirmCompletion, handleUpdateTask, handleDeleteTask,
  } = st;

  return (
    <>
    <TaskDetailModal
      task={selectedTask}
      isOpen={isDetailOpen}
      onClose={() => {
        setIsDetailOpen(false);
        setSelectedTask(null);
      }}
      onUpdateTask={handleUpdateTask}
      onDeleteTask={handleDeleteTask}
      teamMembers={teamMembers}
      currentUser={currentUser}
      userRole={userRole}
      buckets={allBuckets}
      tagBuckets={tagBuckets}
      modelInfo={selectedTask?.modeloId && modelById.get(selectedTask.modeloId)
        ? { rule: ruleLabel(modelById.get(selectedTask.modeloId)!), canEdit: canEditModel(modelById.get(selectedTask.modeloId)!) }
        : null}
      onOpenModel={() => {
        const model = selectedTask?.modeloId ? modelById.get(selectedTask.modeloId) : undefined;
        if (!model) return;
        setIsDetailOpen(false);
        setSelectedTask(null);
        openModel(model);
      }}
    />

    {/* 4. Cadastro de tarefa (nova / editar) — disponível para toda a equipe */}
    <TaskModelModal
      isOpen={modelModal.open}
      model={modelModal.model}
      defaultDate={modelModal.defaultDate}
      canEdit={canEditModel(modelModal.model)}
      teamMembers={teamMembers}
      buckets={allBuckets}
      currentUserId={currentUser.id}
      onClose={() => setModelModal({ open: false, model: null, defaultDate: null })}
      onSave={handleSaveModel}
      onDelete={handleDeleteModel}
    />

    {/* 5. Modal de Preenchimento de Formulário Obrigatório ao Concluir Tarefa */}
    <TaskCompletionModal
      isOpen={isCompletionModalOpen}
      task={completingTask}
      onClose={() => {
        setIsCompletionModalOpen(false);
        setCompletingTask(null);
      }}
      onConfirmComplete={handleConfirmCompletion}
    />

    {/* 6. Notificação Toast de Feedback para Recorrência e Conclusão */}
    {toastMessage && (
      <div
        id="planner-toast-notification"
        className="fixed bottom-5 right-5 z-50 bg-zinc-900/95 text-white px-4 py-3 rounded-xl shadow-2xl border border-zinc-700/60 flex items-center gap-3 text-xs backdrop-blur-md transition-all animate-in fade-in slide-in-from-bottom-3 duration-200"
      >
        <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
          <CheckCircle2 className="w-4 h-4" />
        </div>
        <span className="font-medium pr-2 text-zinc-100">{toastMessage}</span>
        <button
          type="button"
          onClick={() => setToastMessage(null)}
          className="text-zinc-400 hover:text-white transition-colors cursor-pointer text-sm ml-auto p-1 leading-none"
          aria-label="Fechar notificação"
        >
          &times;
        </button>
      </div>
    )}
    </>
  );
}
