import React, { useCallback } from 'react';
import { Task, CustomFieldValue, UserTaskSubmission, TaskModel } from '../../types.ts';
import { taskModelService, TaskModelInput } from '../../services/taskModelService.ts';
import { taskService } from '../../services/taskService.ts';
import { PlannerProps } from './shared';
import type { usePlannerData } from './usePlannerData';
import { errorText } from '../../../lib/errors';

/** Ações do Planejamento: navegar no calendário, arrastar, concluir, editar e excluir tarefas e cadastros. */
export function usePlannerActions(_props: PlannerProps, deps: ReturnType<typeof usePlannerData>) {
  const { tasks, setTasks, isRealAdmin, userRole, setModelModal, modelById, loadModels, currentUser, loadTasksFromSupabase, viewMode, todayDate, todayISO, currentReferenceDate, setCurrentReferenceDate, selectedTask, setSelectedTask, setIsDetailOpen, setCompletingTask, setIsCompletionModalOpen, setToastMessage, draggedTaskId, setDraggedTaskId, displayedTasks } = deps;
  const handlePrev = () => {
    const nextDate = new Date(currentReferenceDate);
    if (viewMode === 'week') {
      nextDate.setDate(nextDate.getDate() - 7);
    } else {
      nextDate.setMonth(nextDate.getMonth() - 1);
    }
    setCurrentReferenceDate(nextDate);
  };

  const handleNext = () => {
    const nextDate = new Date(currentReferenceDate);
    if (viewMode === 'week') {
      nextDate.setDate(nextDate.getDate() + 7);
    } else {
      nextDate.setMonth(nextDate.getMonth() + 1);
    }
    setCurrentReferenceDate(nextDate);
  };

  const handleToday = () => {
    setCurrentReferenceDate(new Date(todayDate));
  };

  /** Mexer na execução (data, exclusão) e no cadastro: admin ou quem criou a tarefa. */
  const canManageTask = useCallback((task: Task) => {
    if (isRealAdmin) return true;
    const model = task.modeloId ? modelById.get(task.modeloId) : undefined;
    return Boolean(model && model.createdBy && model.createdBy === currentUser.id);
  }, [isRealAdmin, modelById, currentUser.id]);

  const canEditModel = useCallback(
    (model: TaskModel | null) => !model || isRealAdmin || (Boolean(model.createdBy) && model.createdBy === currentUser.id),
    [isRealAdmin, currentUser.id]
  );

  const openNewTask = (date: string | null = null) => setModelModal({ open: true, model: null, defaultDate: date });
  const openModel = (model: TaskModel) => setModelModal({ open: true, model, defaultDate: null });

  const handleSaveModel = async (input: TaskModelInput, id?: string) => {
    if (id) {
      await taskModelService.update(id, input);
      setToastMessage('Tarefa atualizada. As próximas execuções já seguem o novo cadastro.');
    } else {
      await taskModelService.create(input, currentUser.id);
      setToastMessage(input.recurrence === 'Nenhuma' ? 'Tarefa criada.' : 'Tarefa criada com as execuções das próximas 8 semanas.');
    }
    setTimeout(() => setToastMessage(null), 4000);
    await Promise.all([loadModels(), loadTasksFromSupabase(false)]);
  };

  const handleDeleteModel = async (id: string) => {
    await taskModelService.remove(id);
    setToastMessage('Tarefa excluída. As execuções concluídas continuam no histórico.');
    setTimeout(() => setToastMessage(null), 4000);
    await Promise.all([loadModels(), loadTasksFromSupabase(false)]);
  };

  // Drag & Drop (admin ou quem criou a tarefa), com persistência imediata
  const handleDragStart = (e: React.DragEvent, task: Task) => {
    if (!canManageTask(task)) return;
    setDraggedTaskId(task.id);
    e.dataTransfer.setData('text/plain', task.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDropOnDate = async (targetDateString: string, e: React.DragEvent) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain') || draggedTaskId;
    if (!taskId) return;
    const draggedTask = tasks.find((t) => t.id === taskId);
    if (!draggedTask || !canManageTask(draggedTask)) return;

    // Atualização otimista imediata na UI
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, scheduledDate: targetDateString } : t
      )
    );
    setDraggedTaskId(null);

    // Persistência em tempo real no Supabase
    const { error } = await taskService.updateScheduledDate(taskId, targetDateString);
    if (error) {
      setToastMessage('Aviso: salvo localmente. Verifique a conexão com o Supabase.');
      setTimeout(() => setToastMessage(null), 4000);
    } else {
      const [, m, d] = targetDateString.split('-');
      setToastMessage(`Ação alocada para ${d}/${m} no Supabase.`);
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  const handleDropToUnscheduled = async (e: React.DragEvent) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain') || draggedTaskId;
    if (!taskId) return;
    const draggedTask = tasks.find((t) => t.id === taskId);
    if (!draggedTask || !canManageTask(draggedTask)) return;

    // Atualização otimista imediata na UI (mover para a Fila)
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, scheduledDate: null } : t))
    );
    setDraggedTaskId(null);

    // Persistência em tempo real no Supabase (data_agendada: null)
    const { error } = await taskService.updateScheduledDate(taskId, null);
    if (error) {
      setToastMessage('Aviso: salvo localmente. Verifique a conexão com o Supabase.');
      setTimeout(() => setToastMessage(null), 4000);
    } else {
      setToastMessage('Ação movida para a Fila de Não Agendadas no Supabase.');
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  const handleRescheduleOverdue = async () => {
    if (userRole !== 'admin') return;
    const overdueTasks = displayedTasks.filter((task) => task.scheduledDate && task.scheduledDate < todayISO && task.status !== 'concluida');
    setTasks((prev) => prev.map((task) => overdueTasks.some((overdue) => overdue.id === task.id) ? { ...task, scheduledDate: todayISO } : task));
    let failed = 0;
    for (let offset = 0; offset < overdueTasks.length; offset += 20) {
      const batch = overdueTasks.slice(offset, offset + 20);
      const results = await Promise.all(batch.map((task) => taskService.updateScheduledDate(task.id, todayISO)));
      failed += results.filter((result) => result.error).length;
    }
    if (failed) loadTasksFromSupabase(false);
    setToastMessage(failed ? `${failed} tarefa(s) não puderam ser reagendadas.` : `${overdueTasks.length} tarefa(s) reagendadas para hoje.`);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Execução unificada da conclusão de tarefas com suporte a Geração Automática por Recorrência no Supabase
  const executeCompleteTask = async (
    taskOrId: string | Task,
    filledValues?: CustomFieldValue[],
    completedByAdmin?: boolean,
    submissionChanges: Record<string, UserTaskSubmission | null> = {}
  ) => {
    const targetTask =
      typeof taskOrId === 'string'
        ? tasks.find((t) => t.id === taskOrId)
        : taskOrId;
    if (!targetTask) return;

    const taskId = targetTask.id;
    // Rastreabilidade: computa se a conclusão foi executada por perfil Administrador
    const isActionByAdmin =
      completedByAdmin !== undefined
        ? Boolean(completedByAdmin)
        : userRole === 'admin' || currentUser?.role === 'admin';

    // As próximas execuções já existem (geradas pelo banco); aqui só grava a conclusão.
    const { updatedTask, error } =
      await taskService.updateTaskStatus(
        targetTask,
        'concluida',
        filledValues,
        isActionByAdmin,
        submissionChanges
      );

    if (error) {
      console.error('Erro ao concluir tarefa no Supabase:', error);
      setToastMessage('Falha ao salvar respostas no Supabase. Tente novamente.');
      setTimeout(() => setToastMessage(null), 5000);
      throw error;
    }

    setTasks((prev) => prev.map((t) => (t.id === taskId ? updatedTask : t)));

    if (selectedTask && selectedTask.id === taskId) {
      setSelectedTask(updatedTask);
    }

    setToastMessage(`Tarefa "${targetTask.title}" concluída${isActionByAdmin ? ' por administrador' : ''}.`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Regra de Conclusão de Status
  const handleToggleStatus = async (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    if (task.status === 'concluida') {
      // Reverter para pendente no Supabase (reseta a flag completed_by_admin)
      const { updatedTask } = await taskService.updateTaskStatus(task, 'pendente', undefined, false);
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? updatedTask : t))
      );
      setToastMessage(`Tarefa "${task.title}" reaberta como pendente no Supabase.`);
      setTimeout(() => setToastMessage(null), 3000);
      return;
    }

    // Se a tarefa tiver múltiplos responsáveis ou campos customizados, verificar se todos completaram
    const assigneeIds = task.assignedToIds || (task.assignedTo ? [task.assignedTo] : []);
    const effectiveAssignees = assigneeIds.length > 0 ? assigneeIds : (currentUser.id ? [currentUser.id] : []);

    const uncompletedAssignees = effectiveAssignees.filter((id) => {
      if (task.userSubmissions && task.userSubmissions[id]) {
        return !task.userSubmissions[id].completed;
      }
      return true;
    });

    const hasCustomFields = task.customFields && task.customFields.length > 0;

    if (uncompletedAssignees.length > 0 && hasCustomFields) {
      // Abre o modal de detalhes para preenchimento individual e visualização do status
      setSelectedTask(task);
      setIsDetailOpen(true);
      setToastMessage(
        `Esta tarefa é compartilhada: todos os responsáveis precisam preencher seus formulários (${effectiveAssignees.length - uncompletedAssignees.length}/${effectiveAssignees.length} concluíram).`
      );
      setTimeout(() => setToastMessage(null), 5000);
      return;
    }

    // Se estiver marcando como concluída, verificar se há campos customizados obrigatórios legados
    const hasUnfilledRequiredFields = task.customFields?.some((f) => {
      if (!f.required) return false;
      const filled = task.customFieldValues?.find((v) => v.fieldId === f.id);
      return (
        filled === undefined ||
        filled.value === '' ||
        filled.value === null ||
        filled.value === undefined
      );
    });

    if (hasUnfilledRequiredFields) {
      setSelectedTask(task);
      setIsDetailOpen(true);
      setToastMessage('Preencha os campos obrigatórios para concluir a ação.');
      setTimeout(() => setToastMessage(null), 4000);
    } else {
      // Conclui diretamente e gera a próxima ocorrência recorrente caso aplicável
      const isByAdmin = userRole === 'admin' || currentUser?.role === 'admin';
      await executeCompleteTask(task, undefined, isByAdmin);
    }
  };

  // Confirmação de conclusão vinda do modal de preenchimento
  const handleConfirmCompletion = async (
    taskId: string,
    filledValues: CustomFieldValue[]
  ) => {
    const isByAdmin = userRole === 'admin' || currentUser?.role === 'admin';
    await executeCompleteTask(taskId, filledValues, isByAdmin);
    setIsCompletionModalOpen(false);
    setCompletingTask(null);
  };

  // Abrir detalhes da ação
  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setIsDetailOpen(true);
  };

  // Atualizar ação existente (com persistência no Supabase)
  const handleUpdateTask = async (updated: Task) => {
    const previousTask = tasks.find((t) => t.id === updated.id);
    const submissionChanges = Object.fromEntries(
      Array.from(new Set([
        ...Object.keys(previousTask?.userSubmissions ?? {}),
        ...Object.keys(updated.userSubmissions ?? {}),
      ]))
        .filter((id) => JSON.stringify(previousTask?.userSubmissions?.[id] ?? null) !== JSON.stringify(updated.userSubmissions?.[id] ?? null))
        .map((id) => [id, updated.userSubmissions?.[id] ?? null])
    ) as Record<string, UserTaskSubmission | null>;
    const isBecomingCompleted =
      previousTask &&
      previousTask.status !== 'concluida' &&
      updated.status === 'concluida';

    if (isBecomingCompleted) {
      // Se acabou de ser marcada como concluída pelo modal de detalhes, usa a rota com criação de recorrência
      const isByAdmin =
        updated.completedByAdmin !== undefined
          ? updated.completedByAdmin
          : userRole === 'admin' || currentUser?.role === 'admin';

      await executeCompleteTask(updated, updated.customFieldValues, isByAdmin, submissionChanges);
      return;
    }

    // Se o status estiver sendo revertido de concluida para outro, garantir reset de completed_by_admin
    const sanitizedUpdated: Task = {
      ...updated,
      completedByAdmin:
        updated.status === 'concluida' ? Boolean(updated.completedByAdmin) : false,
      completed_by_admin:
        updated.status === 'concluida' ? Boolean(updated.completed_by_admin) : false,
      finalizada_por_admin:
        updated.status === 'concluida' ? Boolean(updated.finalizada_por_admin) : false,
    };

    // Atualização otimista
    setTasks((prev) => prev.map((t) => (t.id === sanitizedUpdated.id ? sanitizedUpdated : t)));
    setSelectedTask(sanitizedUpdated);

    // Persistir no Supabase
    const aggregateValuesChanged = JSON.stringify(previousTask?.customFieldValues ?? []) !== JSON.stringify(sanitizedUpdated.customFieldValues ?? []);
    const statusChanged = previousTask?.status !== sanitizedUpdated.status;
    const { data: savedTask, error } = await taskService.updateTask(sanitizedUpdated, submissionChanges, aggregateValuesChanged, statusChanged);
    if (error) {
      console.error('Erro ao salvar alterações no Supabase:', error);
      // Reverter estado otimista
      if (previousTask) {
        setTasks((prev) => prev.map((t) => (t.id === previousTask.id ? previousTask : t)));
        setSelectedTask(previousTask);
      }
      setToastMessage('Falha ao salvar no Supabase. As alterações não puderam ser gravadas.');
      setTimeout(() => setToastMessage(null), 5000);
      throw error;
    } else if (savedTask) {
      setTasks((prev) => prev.map((t) => (t.id === savedTask.id ? savedTask : t)));
      setSelectedTask(savedTask);
    }
  };

  // Excluir ação existente: autorização baseada no papel REAL da conta, não no modo de visualização Admin/Membro.
  // O seletor global apenas simula a visão; não deve remover permissões administrativas reais.
  const handleDeleteTask = async (taskId: string): Promise<boolean> => {
    const target = tasks.find((t) => t.id === taskId);
    if (!target || !canManageTask(target)) {
      setToastMessage('Só quem criou a tarefa (ou um admin) pode excluí-la.');
      setTimeout(() => setToastMessage(null), 5000);
      return false;
    }

    const result = await taskService.deleteTask(taskId);

    if (result.error || !result.deleted) {
      console.error('[PLANNER] Falha ao excluir tarefa:', { taskId, error: result.error });
      const message = result.error instanceof Error
        ? result.error.message
        : errorText(result.error, 'O Supabase não confirmou a exclusão da tarefa.');
      setToastMessage(`Não foi possível excluir a ação: ${message}`);
      setTimeout(() => setToastMessage(null), 7000);
      return false;
    }

    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    if (selectedTask?.id === taskId) {
      setSelectedTask(null);
    }
    setToastMessage('Ação excluída com sucesso.');
    setTimeout(() => setToastMessage(null), 3000);
    return true;
  };

  const handleQuickAddTask = (dateString: string) => {
    openNewTask(dateString);
  };


  return {
    ...deps,
    handlePrev,
    handleNext,
    handleToday,
    canManageTask,
    canEditModel,
    openNewTask,
    openModel,
    handleSaveModel,
    handleDeleteModel,
    handleDragStart,
    handleDropOnDate,
    handleDropToUnscheduled,
    handleRescheduleOverdue,
    executeCompleteTask,
    handleToggleStatus,
    handleConfirmCompletion,
    handleTaskClick,
    handleUpdateTask,
    handleDeleteTask,
    handleQuickAddTask,
  };
}

export type PlannerState = ReturnType<typeof usePlannerActions>;
