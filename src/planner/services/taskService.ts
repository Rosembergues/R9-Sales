import { supabase } from '../../lib/supabase';
import { Task, Priority, Recurrence, TaskStatus, CustomFormField, CustomFieldValue, TaskComment, UserTaskSubmission } from '../types.ts';
import type { TaskCustomJson, TaskDbRow } from '../../lib/dbTypes';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { TaskMutationEvent } from '../types.ts';

function normalizeDateOnly(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  // Supabase timestamp values may arrive as YYYY-MM-DD, ISO strings, or
  // PostgreSQL text such as "YYYY-MM-DD 00:00:00+00". Planner compares day keys.
  const match = String(value).trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

function isValidUUID(val?: string | null): boolean {
  if (!val) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
}

// Canal global de broadcast e assinantes da tela ativa do planejador.
// O canal é compartilhado para envio, mas cada componente pode registrar/remover seu listener.
let realtimeSyncChannel: RealtimeChannel | null = null;
const taskMutationListeners = new Set<(eventPayload: TaskMutationEvent) => void>();

// A coluna completed_by_admin não existe em public.tarefas no banco atual.
// A rastreabilidade fica somente em campos_customizados para evitar consultas/escritas
// a uma coluna física inexistente.

type SubmissionChanges = Record<string, UserTaskSubmission | null>;

async function persistTaskUpdate(
  task: Task,
  submissionChanges: SubmissionChanges = {},
  replaceAggregateValues = false,
  replaceCompletionMetadata = false
): Promise<{ data: Task | null; error: unknown }> {
  const payload = mapTaskToDbPayload(task);
  if (payload.campos_customizados) {
    delete payload.campos_customizados.userSubmissions;
    if (!replaceCompletionMetadata) {
      delete payload.campos_customizados.completed_by_admin;
      delete payload.campos_customizados.completedByAdmin;
      delete payload.campos_customizados.finalizada_por_admin;
    }
    if (!replaceAggregateValues || Object.keys(submissionChanges).length > 0) {
      delete payload.campos_customizados.values;
    }
  }

  const { data, error } = await supabase.rpc('update_task_with_submissions', {
    p_task_id: task.id,
    p_payload: payload,
    p_submission_changes: submissionChanges,
  });
  if (error) return { data: null, error };
  if (!data) return { data: null, error: new Error('O Supabase não retornou a tarefa atualizada.') };

  const updatedTask = mapDbRowToTask(data);
  broadcastTaskMutation('updated', updatedTask);
  return { data: updatedTask, error: null };
}

export function getTaskSyncChannel() {
  if (!realtimeSyncChannel) {
    realtimeSyncChannel = supabase.channel('tarefas-planner-sync-hub', {
      config: {
        broadcast: { ack: false, self: false },
      },
    });
    realtimeSyncChannel.on('broadcast', { event: 'task_mutation' }, (eventPayload: unknown) => {
      taskMutationListeners.forEach((listener) => {
        try {
          listener(eventPayload as TaskMutationEvent);
        } catch (err) {
          console.error('Erro ao processar broadcast do planejador:', err);
        }
      });
    });
    realtimeSyncChannel.subscribe();
  }
  return realtimeSyncChannel;
}

/** Registra um listener da tela ativa sem deixar callbacks presos após desmontagem. */
export function subscribeTaskMutations(listener: (eventPayload: TaskMutationEvent) => void): () => void {
  taskMutationListeners.add(listener);
  getTaskSyncChannel();
  return () => {
    taskMutationListeners.delete(listener);
  };
}

export function broadcastTaskMutation(
  action: 'created' | 'updated' | 'deleted' | 'form_submitted',
  taskOrId?: Task | string | null
) {
  try {
    const channel = getTaskSyncChannel();
    const payload = {
      action,
      taskId: typeof taskOrId === 'string' ? taskOrId : taskOrId?.id,
      task: typeof taskOrId === 'object' ? taskOrId : null,
      timestamp: Date.now(),
    };
    channel.send({
      type: 'broadcast',
      event: 'task_mutation',
      payload,
    });
  } catch (err) {
    console.warn('Erro ao emitir broadcast de sincronização de tarefa:', err);
  }
}

/**
 * Converte um registro do banco de dados Supabase (tabela 'tarefas')
 * para o modelo de dados Task utilizado no Planner.
 */
export function mapDbRowToTask(row: TaskDbRow): Task {
  // Extrair campos customizados e seus valores salvos no JSONB
  let customFields: CustomFormField[] = [];
  let customFieldValues: CustomFieldValue[] = [];

  const rawCustom = row.campos_customizados ?? row.custom_fields;
  // Formato atual: objeto { fields, values, ... }. Registros muito antigos guardavam só a lista de campos.
  const customObj: TaskCustomJson | null =
    rawCustom && typeof rawCustom === 'object' && !Array.isArray(rawCustom) ? rawCustom : null;
  if (Array.isArray(rawCustom)) {
    customFields = rawCustom as CustomFormField[];
  } else if (customObj) {
    if (Array.isArray(customObj.fields)) {
      customFields = customObj.fields as CustomFormField[];
    } else if (Array.isArray(customObj.customFields)) {
      customFields = customObj.customFields as CustomFormField[];
    }
    if (Array.isArray(customObj.values)) {
      customFieldValues = customObj.values as CustomFieldValue[];
    } else if (Array.isArray(customObj.customFieldValues)) {
      customFieldValues = customObj.customFieldValues as CustomFieldValue[];
    }
  }

  // Fallback caso valores_customizados esteja em coluna separada
  if (row.valores_customizados && Array.isArray(row.valores_customizados)) {
    customFieldValues = row.valores_customizados;
  }

  // Comentários da ação
  let comments: TaskComment[] = [];
  const rawComments = row.comentarios ?? row.comments;
  if (Array.isArray(rawComments)) {
    comments = rawComments;
  }

  // Tags da ação
  let tags: string[] = [];
  if (Array.isArray(row.tags)) {
    tags = row.tags;
  } else if (typeof row.tags === 'string') {
    tags = row.tags
      ? row.tags.split(',').map((t: string) => t.trim()).filter(Boolean)
      : [];
  }

  // Responsáveis da ação (suporte robusto a múltiplos responsáveis com fallback retrocompatível)
  let assignedToIds: string[] = [];
  const rawAssignees =
    row.responsaveis_ids ??
    row.assigned_to_ids ??
    row.assignees ??
    customObj?.assigneeIds;

  if (Array.isArray(rawAssignees)) {
    assignedToIds = rawAssignees.map(String).filter(Boolean);
  } else if (typeof rawAssignees === 'string') {
    try {
      const parsed = JSON.parse(rawAssignees);
      if (Array.isArray(parsed)) {
        assignedToIds = parsed.map(String).filter(Boolean);
      } else {
        assignedToIds = rawAssignees.split(',').map((s) => s.trim()).filter(Boolean);
      }
    } catch {
      assignedToIds = rawAssignees.split(',').map((s) => s.trim()).filter(Boolean);
    }
  }

  const assignedToId = row.responsavel_id ?? row.assigned_to ?? row.assignedTo ?? null;
  if (assignedToId && !assignedToIds.includes(String(assignedToId))) {
    assignedToIds.unshift(String(assignedToId));
  }

  const primaryAssignedTo = assignedToIds.length > 0 ? assignedToIds[0] : (assignedToId ? String(assignedToId) : null);

  // Dias da semana da recorrência personalizada
  let recurrenceDays: string[] = [];
  const rawRecurrenceDays =
    row.dias_recorrencia ??
    row.recurrence_days ??
    row.recurrenceDays ??
    customObj?.recurrenceDays;

  if (Array.isArray(rawRecurrenceDays)) {
    recurrenceDays = rawRecurrenceDays.map(String).filter(Boolean);
  } else if (typeof rawRecurrenceDays === 'string') {
    try {
      const parsed = JSON.parse(rawRecurrenceDays);
      if (Array.isArray(parsed)) {
        recurrenceDays = parsed.map(String).filter(Boolean);
      } else {
        recurrenceDays = rawRecurrenceDays.split(',').map((s) => s.trim()).filter(Boolean);
      }
    } catch {
      recurrenceDays = rawRecurrenceDays.split(',').map((s) => s.trim()).filter(Boolean);
    }
  }

  // Submissões individuais por usuário (para tarefas compartilhadas com formulários)
  let userSubmissions: Record<string, UserTaskSubmission> = {};
  const rawSubmissions =
    row.submissoes_usuarios ??
    row.user_submissions ??
    row.userSubmissions ??
    (customObj?.userSubmissions || customObj?.user_submissions);

  if (rawSubmissions && typeof rawSubmissions === 'object' && !Array.isArray(rawSubmissions)) {
    userSubmissions = rawSubmissions as Record<string, UserTaskSubmission>;
  } else if (Array.isArray(rawSubmissions)) {
    rawSubmissions.forEach((sub: UserTaskSubmission) => {
      if (sub && sub.userId) {
        userSubmissions[sub.userId] = sub;
      }
    });
  }

  // Normalização explícita de submissões para garantir propagação de completedByAdmin / completed_by_admin
  const normalizedSubmissions: Record<string, UserTaskSubmission> = {};
  Object.entries(userSubmissions).forEach(([uid, sub]: [string, UserTaskSubmission & { completed_by_admin?: boolean; finalizada_por_admin?: boolean }]) => {
    if (!sub) return;
    const isSubAdmin = Boolean(
      sub.completedByAdmin === true ||
      sub.completed_by_admin === true ||
      sub.finalizada_por_admin === true
    );
    normalizedSubmissions[uid] = {
      ...sub,
      userId: sub.userId ?? uid,
      completed: Boolean(sub.completed),
      completedByAdmin: isSubAdmin,
      completed_by_admin: isSubAdmin,
      finalizada_por_admin: isSubAdmin,
    };
  });

  // Verifica se todas as submissões registradas foram concluídas por Administrador
  const submissionList = Object.values(normalizedSubmissions);
  const hasSubmissions = submissionList.length > 0;
  const allSubmissionsCompletedByAdmin =
    hasSubmissions &&
    submissionList.every(
      (s) => s.completed && (s.completedByAdmin || s.completed_by_admin || s.finalizada_por_admin)
    );

  const isTaskFinishedByAdmin = Boolean(
    row.completed_by_admin === true ||
    row.finalizada_por_admin === true ||
    row.completedByAdmin === true ||
    customObj?.completed_by_admin === true ||
    customObj?.completedByAdmin === true ||
    customObj?.finalizada_por_admin === true ||
    (row.status === 'concluida' && allSubmissionsCompletedByAdmin)
  );

  return {
    id: String(row.id),
    title: row.titulo ?? row.title ?? 'Sem título',
    description: row.descricao ?? row.description ?? '',
    priority: (row.prioridade ?? row.priority ?? 'Alta') as Priority,
    recurrence: (row.recorrencia ?? row.recurrence ?? 'Nenhuma') as Recurrence,
    recurrenceDays,
    tags,
    assignedTo: primaryAssignedTo,
    assignedToIds,
    bucket: row.bucket ?? row.categoria ?? 'Operacional',
    startDate: row.data_inicio ?? row.start_date ?? row.startDate ?? undefined,
    endDate: row.data_fim ?? row.end_date ?? row.endDate ?? undefined,
    recurrenceSeriesId: customObj?.recurrenceSeriesId ? String(customObj.recurrenceSeriesId) : undefined,
    scheduledDate: normalizeDateOnly(
      row.data_agendada !== undefined
        ? row.data_agendada
        : row.scheduled_date !== undefined
        ? row.scheduled_date
        : row.scheduledDate ?? null
    ),
    status: (row.status ?? 'pendente') as TaskStatus,
    comments,
    customFields,
    customFieldValues,
    userSubmissions: normalizedSubmissions,
    completedByAdmin: isTaskFinishedByAdmin,
    completed_by_admin: isTaskFinishedByAdmin,
    finalizada_por_admin: isTaskFinishedByAdmin,
    modeloId: row.modelo_id ? String(row.modelo_id) : undefined,
    plannedDate: normalizeDateOnly(row.data_prevista ?? null),
  };
}

/**
 * Converte um objeto Task do frontend para a estrutura de colunas do Supabase
 */
/** Colunas gravadas em public.tarefas (campos_customizados é um objeto JSON). */
type TaskDbPayload = Record<string, unknown> & { campos_customizados?: Record<string, unknown> };

export function mapTaskToDbPayload(
  task: Partial<Task> | Omit<Task, 'id' | 'comments'>
): TaskDbPayload {
  const payload: TaskDbPayload = {};

  if (task.title !== undefined) {
    payload.titulo = typeof task.title === 'string' ? task.title.trim() : task.title;
  }
  if (task.description !== undefined) {
    payload.descricao =
      typeof task.description === 'string'
        ? task.description.trim()
        : (task.description ?? '');
  }
  if (task.priority !== undefined) payload.prioridade = task.priority;
  if (task.recurrence !== undefined) payload.recorrencia = task.recurrence;
  if (task.bucket !== undefined) payload.bucket = task.bucket;

  // Lista de múltiplos responsáveis
  const assignedToIds =
    task.assignedToIds !== undefined
      ? task.assignedToIds
      : task.assignedTo
      ? [task.assignedTo]
      : [];

  if (task.assignedTo !== undefined || task.assignedToIds !== undefined) {
    const primaryId = assignedToIds[0] ?? task.assignedTo ?? null;
    if (primaryId && isValidUUID(primaryId)) {
      payload.responsavel_id = primaryId;
    } else if (primaryId && !primaryId.startsWith('user-')) {
      payload.responsavel_id = primaryId;
    } else {
      payload.responsavel_id = null;
    }
  }

  if (task.startDate !== undefined) payload.data_inicio = task.startDate ?? null;
  if (task.endDate !== undefined) payload.data_fim = task.endDate ?? null;
  if (task.scheduledDate !== undefined) payload.data_agendada = task.scheduledDate ?? null;
  if (task.status !== undefined) payload.status = task.status;
  if (task.tags !== undefined) {
    payload.tags = Array.isArray(task.tags)
      ? task.tags.map((t) => (typeof t === 'string' ? t.trim() : t)).filter(Boolean)
      : [];
  }

  // Armazena definições de campos, valores, array de responsáveis, dias de recorrência e submissões individuais no JSONB campos_customizados
  if (
    task.customFields !== undefined ||
    task.customFieldValues !== undefined ||
    task.assignedToIds !== undefined ||
    task.recurrenceDays !== undefined ||
    task.userSubmissions !== undefined
  ) {
    const fields = task.customFields ?? [];
    const fieldsById = new Map(fields.map((f) => [f.id, f]));

    // Sanitização explícita de valores: números convertidos estritamente, preservando 0 como valor válido
    const rawValues = task.customFieldValues ?? [];
    const sanitizedValues: CustomFieldValue[] = rawValues.map((v) => {
      const fieldDef = fieldsById.get(v.fieldId);
      const isNum = fieldDef?.type === 'number';
      const rawVal = v.value;

      if (rawVal !== undefined && rawVal !== null && rawVal !== '') {
        if (isNum) {
          const normalized = typeof rawVal === 'string' ? rawVal.trim().replace(',', '.') : rawVal;
          const num = Number(normalized);
          return { fieldId: v.fieldId, value: !isNaN(num) ? num : 0 };
        }
        return { fieldId: v.fieldId, value: typeof rawVal === 'string' ? rawVal.trim() : rawVal };
      }
      return { fieldId: v.fieldId, value: '' };
    });

    // Sanitização explícita de submissões por usuário
    const rawSubmissions = task.userSubmissions ?? {};
    const sanitizedSubmissions: Record<string, UserTaskSubmission> = {};
    Object.entries(rawSubmissions).forEach(([userId, sub]) => {
      const subValues: Record<string, string | number> = {};
      if (sub.values) {
        Object.entries(sub.values).forEach(([fId, val]) => {
          const fieldDef = fieldsById.get(fId);
          const isNum = fieldDef?.type === 'number';

          if (val !== undefined && val !== null && val !== '') {
            if (isNum) {
              const normalized = typeof val === 'string' ? val.trim().replace(',', '.') : val;
              const num = Number(normalized);
              subValues[fId] = !isNaN(num) ? num : 0;
            } else {
              subValues[fId] = typeof val === 'string' ? val.trim() : val;
            }
          } else {
            subValues[fId] = '';
          }
        });
      }

      const cleanObs =
        typeof sub.observacao === 'string'
          ? sub.observacao.trim()
          : typeof sub.observation === 'string'
          ? sub.observation.trim()
          : undefined;

      const isSubAdmin = Boolean(
        sub.completedByAdmin === true ||
        sub.completed_by_admin === true ||
        sub.finalizada_por_admin === true
      );

      sanitizedSubmissions[userId] = {
        ...sub,
        userId: sub.userId ?? userId,
        completed: Boolean(sub.completed),
        values: subValues,
        observacao: cleanObs ?? undefined,
        observation: cleanObs ?? undefined,
        completedByAdmin: isSubAdmin,
        completed_by_admin: isSubAdmin,
        finalizada_por_admin: isSubAdmin,
      };
    });

    payload.campos_customizados = {
      fields,
      values: sanitizedValues,
      assigneeIds: assignedToIds,
      recurrenceDays: task.recurrenceDays ?? [],
      userSubmissions: sanitizedSubmissions,
      ...(task.recurrenceSeriesId ? { recurrenceSeriesId: task.recurrenceSeriesId } : {}),
    };

  }

  // Rastreabilidade de Conclusão por Administrador (completed_by_admin / finalizada_por_admin)
  const isCompletedByAdmin =
    task.completedByAdmin !== undefined
      ? Boolean(task.completedByAdmin)
      : task.completed_by_admin !== undefined
      ? Boolean(task.completed_by_admin)
      : task.finalizada_por_admin !== undefined
      ? Boolean(task.finalizada_por_admin)
      : undefined;

  if (isCompletedByAdmin !== undefined) {
    if (!payload.campos_customizados) {
      payload.campos_customizados = {};
    }
    payload.campos_customizados.completed_by_admin = isCompletedByAdmin;
    payload.campos_customizados.completedByAdmin = isCompletedByAdmin;
    payload.campos_customizados.finalizada_por_admin = isCompletedByAdmin;

    // Não enviar completed_by_admin no nível raiz: essa coluna não existe em tarefas.
    // Os três aliases ficam dentro de campos_customizados, que é JSONB.
  }

  if ('comments' in task && task.comments !== undefined) {
    payload.comentarios = task.comments ?? [];
  }

  return payload;
}

export const taskService = {
  /**
   * Busca estritamente todas as tarefas reais da tabela 'tarefas' no Supabase
   */
  async fetchTasks(): Promise<{ data: Task[]; error: unknown }> {
    try {
      const data: TaskDbRow[] = [];
      const pageSize = 1000;
      for (let offset = 0; ; offset += pageSize) {
        const { data: page, error } = await supabase
          .from('tarefas')
          .select('*')
          .order('created_at', { ascending: false })
          .order('id', { ascending: true })
          .range(offset, offset + pageSize - 1);
        if (error) return { data: [], error };
        data.push(...(page ?? []));
        if (!page || page.length < pageSize) break;
      }

      const parsedTasks = data.map(mapDbRowToTask);
      return { data: parsedTasks, error: null };
    } catch (err) {
      return { data: [], error: err };
    }
  },

  /**
   * Atualiza a data agendada (Drag & Drop de/para Fila ou entre dias)
   */
  async updateScheduledDate(
    taskId: string,
    scheduledDate: string | null
  ): Promise<{ error: unknown }> {
    try {
      const { error } = await supabase
        .from('tarefas')
        .update({ data_agendada: scheduledDate })
        .eq('id', taskId);

      if (error) {
        return { error };
      }
      broadcastTaskMutation('updated', taskId);
      return { error: null };
    } catch (err) {
      return { error: err };
    }
  },

  /**
   * Atualiza o status da tarefa e campos customizados preenchidos.
   * Suporta rastreabilidade de conclusão por Administrador (completed_by_admin).
   * Quando o usuário marcar uma tarefa como 'concluida' com o campo recorrencia preenchido
   * (diferente de 'Nenhuma' ou null), calcula a próxima data válida e executa
   * supabase.from('tarefas').insert({...}) criando uma nova tarefa com status 'pendente'.
   */
  async updateTaskStatus(
    task: Task,
    newStatus: TaskStatus,
    filledValues?: CustomFieldValue[],
    completedByAdmin?: boolean,
    submissionChanges: SubmissionChanges = {}
  ): Promise<{
    updatedTask: Task;
    error: unknown;
  }> {
    const updatedValues =
      filledValues !== undefined ? filledValues : (task.customFieldValues ?? []);

    // Se o status for concluída, define completed_by_admin (true para admin, false para membro comum)
    // Se a tarefa estiver sendo reaberta (pendente ou em_andamento), reseta a flag para false
    const isByAdmin =
      newStatus === 'concluida'
        ? completedByAdmin !== undefined
          ? Boolean(completedByAdmin)
          : Boolean(task.completedByAdmin ?? task.completed_by_admin ?? false)
        : false;

    const updatedTask: Task = {
      ...task,
      status: newStatus,
      customFieldValues: updatedValues,
      completedByAdmin: isByAdmin,
      completed_by_admin: isByAdmin,
      finalizada_por_admin: isByAdmin,
    };

    let updateError: unknown = null;

    try {
      // 1. Atualizar registro atual no Supabase para o novo status usando mapTaskToDbPayload para sanitização rigorosa
      const { data: savedTask, error } = await persistTaskUpdate(updatedTask, submissionChanges, Boolean(filledValues), true);

      if (error || !savedTask) {
        console.error('[Planejamento] update status error', error);
        updateError = error ?? new Error('O Supabase não retornou a tarefa atualizada.');
      } else {
        Object.assign(updatedTask, savedTask);
        broadcastTaskMutation('updated', updatedTask);
      }

      return { updatedTask, error: updateError };
    } catch (err) {
      console.error('Erro ao atualizar status da tarefa:', err);
      return { updatedTask, error: err };
    }
  },

  /**
   * Atualização completa de uma tarefa (título, descrição, prioridade, comentários, etc.)
   */
  async updateTask(
    task: Task,
    submissionChanges: SubmissionChanges = {},
    replaceAggregateValues = false,
    replaceCompletionMetadata = false
  ): Promise<{ data: Task; error: unknown }> {
    try {
      const { data, error } = await persistTaskUpdate(task, submissionChanges, replaceAggregateValues, replaceCompletionMetadata);

      if (error) {
        console.error('[Planejamento] update task error', error);
        return { data: task, error };
      }

      return { data: data ?? task, error: null };
    } catch (err) {
      console.error('[Planejamento] update task exception', err);
      return { data: task, error: err };
    }
  },

  /**
   * Remove uma tarefa do banco de dados Supabase
   */
  async deleteTask(taskId: string): Promise<{ error: unknown; deleted: boolean }> {
    try {
      // Pedir o ID retornado é essencial: com RLS, o Supabase pode responder
      // sem erro e ainda assim remover zero linhas. Sem SELECT de retorno,
      // o chamador não consegue distinguir sucesso de uma exclusão bloqueada.
      const { data, error } = await supabase
        .from('tarefas')
        .delete()
        .eq('id', taskId)
        .select('id')
        .maybeSingle();

      if (error) {
        console.error('[Planejamento] delete task error', { taskId, error });
        return { error, deleted: false };
      }

      if (!data?.id) {
        const noDeleteError = new Error(
          'O Supabase não confirmou a exclusão da tarefa. Nenhum registro foi retornado; verifique se a política RLS permite que esta conta admin exclua tarefas.'
        );
        console.warn('[Planejamento] delete task not confirmed', { taskId });
        return { error: noDeleteError, deleted: false };
      }

      broadcastTaskMutation('deleted', taskId);
      return { error: null, deleted: true };
    } catch (err) {
      console.error('[Planejamento] delete task exception', { taskId, err });
      return { error: err, deleted: false };
    }
  },
};

