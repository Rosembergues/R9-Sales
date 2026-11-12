import { Trash2, Loader2 } from 'lucide-react';
import { OpenTaskDetailProps, TaskDetailModalProps, useTaskDetail } from './taskDetail/useTaskDetail';
import MemberTaskView from './taskDetail/MemberTaskView';
import AdminTaskView from './taskDetail/AdminTaskView';

function TaskDetailModalContent(props: OpenTaskDetailProps) {
  const st = useTaskDetail(props);
  const {
    task, onClose, onDeleteTask, modelInfo, onOpenModel, isAdmin, isDeletingTask, setIsDeletingTask, showDeleteConfirmation, setShowDeleteConfirmation,
  } = st;

  return (
    <div
      id="task-detail-backdrop"
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex justify-end animate-fadeIn"
      onClick={onClose}
    >
      <div
        id="task-detail-drawer"
        className={`bg-white h-full shadow-2xl flex flex-col overflow-hidden animate-slideLeft transition-all ${
          isAdmin ? 'w-full max-w-2xl' : 'w-full max-w-md'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Ligação com o cadastro: esta é uma execução (um dia) da tarefa */}
        {modelInfo && onOpenModel && (
          <div className="shrink-0 px-5 py-2 bg-blue-50/70 border-b border-blue-100 flex items-center justify-between gap-3 text-[11px]">
            <span className="text-slate-600 truncate">
              Execução de {task.scheduledDate ? new Date(`${task.scheduledDate}T12:00:00`).toLocaleDateString('pt-BR') : 'sem data'} · <b className="text-slate-800">{modelInfo.rule}</b>
            </span>
            <button
              type="button"
              onClick={onOpenModel}
              className="shrink-0 font-bold text-[#0052cc] hover:underline cursor-pointer"
            >
              {modelInfo.canEdit ? 'Editar tarefa (próximas execuções)' : 'Ver tarefa'}
            </button>
          </div>
        )}
        {/* ============================================================ */}
        {/* CASO 1: VISÃO DO MEMBRO (SIMPLIFICADA & PROGRESSO MULTI-USUÁRIO) */}
        {!isAdmin ? <MemberTaskView st={st} /> : <AdminTaskView st={st} />}
      </div>

      {showDeleteConfirmation && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
          role="presentation"
          onClick={(e) => e.stopPropagation()}
        >
          <div role="alertdialog" aria-modal="true" aria-labelledby="planner-delete-title" aria-describedby="planner-delete-description" className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h2 id="planner-delete-title" className="text-base font-semibold text-gray-900">Excluir esta ação?</h2>
                <p id="planner-delete-description" className="mt-1 text-sm text-gray-600">Esta ação não poderá ser desfeita. A tarefa será removida permanentemente.</p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" disabled={isDeletingTask} onClick={() => setShowDeleteConfirmation(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">Cancelar</button>
              <button
                type="button"
                disabled={isDeletingTask}
                onClick={async () => {
                  if (isDeletingTask) return;
                  setIsDeletingTask(true);
                  try {
                    const deleted = await onDeleteTask(task.id);
                    if (deleted) {
                      setShowDeleteConfirmation(false);
                      onClose();
                    }
                  } catch (error) {
                    console.error('[PLANNER] Erro inesperado ao excluir tarefa:', error);
                  } finally {
                    setIsDeletingTask(false);
                  }
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {isDeletingTask && <Loader2 className="h-4 w-4 animate-spin" />}
                {isDeletingTask ? 'Excluindo…' : 'Excluir ação'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



// Wrapper condicional: o componente que contém hooks só é montado quando
// há uma tarefa aberta, evitando violações da Rules of Hooks.
export default function TaskDetailModal(props: TaskDetailModalProps) {
  if (!props.isOpen || !props.task) return null;
  return <TaskDetailModalContent key={props.task.id} {...props} task={props.task} />;
}
