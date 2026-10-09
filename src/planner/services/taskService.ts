import { supabase } from '../../lib/supabase';
import { Task, Priority, Recurrence, TaskStatus, CustomFormField, CustomFieldValue, TaskComment, UserTaskSubmission } from '../types.ts';
import { getNextRecurrenceDate, formatISO } from '../utils/dateUtils.ts';

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
let realtimeSyncChannel: any = null;
const taskMutationListeners = new Set<(eventPayload: any) => void>();

// A coluna completed_by_admin não existe em public.tarefas no banco atual.
// A rastreabilidade fica somente em campos_customizados para evitar consultas/escritas
// a uma coluna física inexistente.

// Trava atômica em memória para prevenir execuções concorrentes simultâneas (duplos cliques ou disparos paralelos)
const recurrenceLocks = new Set<string>();

/**
 * Cria a próxima ocorrência de uma tarefa recorrente de forma estritamente atômica e segura.
 * Realiza verificação de unicidade no Supabase para garantir que nenhuma tarefa com o mesmo
 * título já exista na mesma data agendada / data de início antes de efetivar qualquer inserção.
 */
export async function createNextRecurrentTaskSafely(
  task: Task,
  nextDate: string
): Promise<Task | null> {
  if (!nextDate || !task.title || !task.title.trim()) {
    return null;
  }

  const normalizedTitle = task.title.trim();
  const seriesId = task.recurrenceSeriesId || task.id;
  const lockKey = `${seriesId}::${nextDate}`;

  // 1. Trava atômica em memória: se já houver uma requisição em processamento para esse título e data, abortar
  if (recurrenceLocks.has(lockKey)) {
    console.warn(
      `[Recorrência] Criação já em andamento para "${normalizedTitle}" na data ${nextDate}. Disparo duplicado ignorado com sucesso.`
    );
    return null;
  }

  recurrenceLocks.add(lockKey);

  try {
    // 2. Consulta de Unicidade no Supabase:
    // Verifica se já existe uma tarefa com o mesmo título cadastrada para aquela exata mesma data
    const { data: existingMatches, error: queryError } = await supabase
      .from('tarefas')
      .select('id, titulo, data_agendada, data_inicio, campos_customizados')
      .contains('campos_customizados', { recurrenceSeriesId: seriesId })
      .limit(1000);

    if (queryError) {
      // Não criar sem conseguir verificar duplicidade; é mais seguro falhar claramente.
      console.error('[Recorrência] Não foi possível verificar duplicidade da série:', queryError);
      return null;
    }

    // A deduplicação fica limitada à mesma série; outra tarefa com o mesmo título
    // não pode bloquear a recorrência desta tarefa.
    const alreadyExists = existingMatches?.some((row: any) => {
      const rowScheduled = normalizeDateOnly(row.data_agendada);
      const rowStart = normalizeDateOnly(row.data_inicio);
      return rowScheduled === nextDate || rowStart === nextDate;
    });

    if (alreadyExists) {
      console.info(
        `[Recorrência] A tarefa "${normalizedTitle}" já existe na data ${nextDate}. Nenhuma duplicata foi criada.`
      );
      return null;
    }

    // 3. Extrair a lista completa de múltiplos responsáveis para herança total
    const allAssigneeIds =
      task.assignedToIds && task.assignedToIds.length > 0
        ? [...task.assignedToIds]
        : task.assignedTo
        ? [task.assignedTo]
        : [];

    // 4. Preparar payload da nova ocorrência limpa
    const recurrentPayload = mapTaskToDbPayload({
      title: normalizedTitle,
      description: task.description ?? '',
      priority: task.priority ?? 'Alta',
      recurrence: task.recurrence,
      recurrenceDays: task.recurrenceDays ?? [],
      bucket: task.bucket ?? 'Operacional',
      assignedTo: allAssigneeIds[0] ?? null,
      assignedToIds: allAssigneeIds,
      startDate: nextDate,
      endDate: nextDate,
      scheduledDate: nextDate,
      status: 'pendente',
      tags: task.tags ?? [],
      customFields: task.customFields ?? [],
      customFieldValues: [], // Resetar valores preenchidos para a nova ocorrência
      userSubmissions: {}, // Iniciar submissões limpas para os responsáveis
      recurrenceSeriesId: seriesId,
      comments: [], // Iniciar sem comentários históricos
    });

    // 5. Inserir a nova ocorrência única no Supabase
    const { data: recurrentData, error: recurrentError } = await supabase
      .from('tarefas')
      .insert([recurrentPayload])
      .select();

    if (recurrentError) {
      console.error(
        'Erro ao criar próxima instância recorrente no Supabase:',
        recurrentError
      );
      return null;
    }

    if (recurrentData && recurrentData.length > 0) {
      const createdTask = mapDbRowToTask(recurrentData[0]);
      broadcastTaskMutation('created', createdTask);
      return createdTask;
    }

    return null;
  } catch (err) {
    console.error('Erro inesperado na rotina de criação recorrente:', err);
    return null;
  } finally {
    // Manter a trava por 2.5s para blindar contra múltiplos cliques rápidos ou loops
    setTimeout(() => {
      recurrenceLocks.delete(lockKey);
    }, 2500);
  }
}

export function getTaskSyncChannel() {
  if (!realtimeSyncChannel) {
    realtimeSyncChannel = supabase.channel('tarefas-planner-sync-hub', {
      config: {
        broadcast: { ack: false, self: false },
      },
    });
    realtimeSyncChannel.on('broadcast', { event: 'task_mutation' }, (eventPayload: any) => {
      taskMutationListeners.forEach((listener) => {
        try {
          listener(eventPayload);
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
export function subscribeTaskMutations(listener: (eventPayload: any) => void): () => void {
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
export function mapDbRowToTask(row: any): Task {
  // Extrair campos customizados e seus valores salvos no JSONB
  let customFields: CustomFormField[] = [];
  let customFieldValues: CustomFieldValue[] = [];

  const rawCustom = row.campos_customizados ?? row.custom_fields;
  if (rawCustom) {
    if (Array.isArray(rawCustom)) {
      customFields = rawCustom;
    } else if (typeof rawCustom === 'object') {
      if (Array.isArray(rawCustom.fields)) {
        customFields = rawCustom.fields;
      } else if (Array.isArray(rawCustom.customFields)) {
        customFields = rawCustom.customFields;
      }
      if (Array.isArray(rawCustom.values)) {
        customFieldValues = rawCustom.values;
      } else if (Array.isArray(rawCustom.customFieldValues)) {
        customFieldValues = rawCustom.customFieldValues;
      }
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
    (rawCustom && typeof rawCustom === 'object' && rawCustom.assigneeIds);

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
    (rawCustom && typeof rawCustom === 'object' && rawCustom.recurrenceDays);

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
    (rawCustom && typeof rawCustom === 'object' && (rawCustom.userSubmissions || rawCustom.user_submissions));

  if (rawSubmissions && typeof rawSubmissions === 'object' && !Array.isArray(rawSubmissions)) {
    userSubmissions = rawSubmissions;
  } else if (Array.isArray(rawSubmissions)) {
    rawSubmissions.forEach((sub: any) => {
      if (sub && sub.userId) {
        userSubmissions[sub.userId] = sub;
      }
    });
  }

  // Normalização explícita de submissões para garantir propagação de completedByAdmin / completed_by_admin
  const normalizedSubmissions: Record<string, UserTaskSubmission> = {};
  Object.entries(userSubmissions).forEach(([uid, sub]: [string, any]) => {
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
    (rawCustom &&
      typeof rawCustom === 'object' &&
      (rawCustom.completed_by_admin === true ||
        rawCustom.completedByAdmin === true ||
        rawCustom.finalizada_por_admin === true)) ||
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
    recurrenceSeriesId: rawCustom && typeof rawCustom === 'object' && rawCustom.recurrenceSeriesId ? String(rawCustom.recurrenceSeriesId) : undefined,
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
  };
}

/**
 * Converte um objeto Task do frontend para a estrutura de colunas do Supabase
 */
export function mapTaskToDbPayload(
  task: Partial<Task> | Omit<Task, 'id' | 'comments'>
): Record<string, any> {
  const payload: Record<string, any> = {};

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

    // Rastreabilidade e Log (Check-up de Payload antes do Supabase)
    console.log('[SUPABASE PAYLOAD AUDIT - CHECK-UP]', {
      taskId: (task as any).id ?? 'NOVO_REGISTRO',
      taskTitle: task.title,
      timestamp: new Date().toISOString(),
      rawInput: {
        customFieldValues: task.customFieldValues,
        userSubmissions: task.userSubmissions,
      },
      sanitizedPayload: {
        values: sanitizedValues,
        userSubmissions: sanitizedSubmissions,
      },
      camposCustomizados: payload.campos_customizados,
    });
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
  async fetchTasks(): Promise<{ data: Task[]; error: any | null }> {
    try {
      const { data, error } = await supabase
        .from('tarefas')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000);

      if (error) {
        return { data: [], error };
      }

      if (!data || data.length === 0) {
        return { data: [], error: null };
      }

      const parsedTasks = data.map(mapDbRowToTask);
      return { data: parsedTasks, error: null };
    } catch (err) {
      return { data: [], error: err };
    }
  },

  /**
   * Salva uma nova tarefa no Supabase (respeitando se vai para a Fila ou Calendário)
   */
  async createTask(
    newTaskData: Omit<Task, 'id' | 'comments'>
  ): Promise<{ data: Task | null; error: any | null }> {
    try {
      const payload = mapTaskToDbPayload(newTaskData);

      console.log('[SUPABASE AUDIT - INSERT TAREFA]', {
        operation: 'tarefas.insert',
        title: newTaskData.title,
        payload,
        timestamp: new Date().toISOString(),
      });

      const { data, error } = await supabase
        .from('tarefas')
        .insert([payload])
        .select();

      if (error) {
        console.error('[SUPABASE AUDIT - INSERT ERROR]', error);
        return { data: null, error };
      }

      if (data && data.length > 0) {
        const created = mapDbRowToTask(data[0]);
        broadcastTaskMutation('created', created);
        return { data: created, error: null };
      }

      return { data: null, error: null };
    } catch (err) {
      console.error('[SUPABASE AUDIT - INSERT EXCEPTION]', err);
      return { data: null, error: err };
    }
  },

  /**
   * Atualiza a data agendada (Drag & Drop de/para Fila ou entre dias)
   */
  async updateScheduledDate(
    taskId: string,
    scheduledDate: string | null
  ): Promise<{ error: any | null }> {
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
    completedByAdmin?: boolean
  ): Promise<{
    updatedTask: Task;
    nextRecurrentTask: Task | null;
    error: any | null;
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

    let nextRecurrentTask: Task | null = null;
    let updateError: any = null;

    try {
      // 1. Atualizar registro atual no Supabase para o novo status usando mapTaskToDbPayload para sanitização rigorosa
      const payload = mapTaskToDbPayload(updatedTask);

      console.log('[SUPABASE AUDIT - UPDATE TASK STATUS]', {
        operation: 'tarefas.updateStatus',
        taskId: task.id,
        newStatus,
        filledValues,
        payload,
        timestamp: new Date().toISOString(),
      });

      const { data: updatedRows, error } = await supabase
        .from('tarefas')
        .update(payload)
        .eq('id', task.id)
        .select('id');

      if (error) {
        console.error('[SUPABASE AUDIT - UPDATE STATUS ERROR]', error);
        updateError = error;
      } else if (!updatedRows || updatedRows.length === 0) {
        updateError = new Error(
          'O Supabase não confirmou a atualização da tarefa. Verifique as políticas de acesso (RLS) e se a tarefa ainda existe.'
        );
        console.error('[SUPABASE AUDIT - UPDATE STATUS NO ROW]', { taskId: task.id });
      } else {
        broadcastTaskMutation('updated', updatedTask);
      }

      // 2. Só gerar recorrência após confirmar a gravação da conclusão.
      // Isso evita criar uma próxima ocorrência quando a política RLS bloqueia o update.
      if (!updateError) {
      const hasRecurrence =
        task.recurrence &&
        String(task.recurrence).trim().toLowerCase() !== 'nenhuma' &&
        String(task.recurrence).trim() !== '';

      if (newStatus === 'concluida' && hasRecurrence) {
        // Base de cálculo: data_agendada atual (ou data_inicio / hoje)
        const baseDate = normalizeDateOnly(task.scheduledDate) ?? normalizeDateOnly(task.startDate) ?? formatISO(new Date());
        const nextDate = getNextRecurrenceDate(baseDate, task.recurrence, task.recurrenceDays);

        if (nextDate) {
          // Criação da próxima ocorrência após a conclusão ser persistida.
          nextRecurrentTask = await createNextRecurrentTaskSafely(task, nextDate);
          if (!nextRecurrentTask) {
            console.warn('[Recorrência] Nenhuma nova ocorrência foi criada.', {
              taskId: task.id,
              recurrence: task.recurrence,
              recurrenceDays: task.recurrenceDays,
              baseDate,
              nextDate,
            });
          }
        } else {
          console.warn('[Recorrência] Não foi possível calcular a próxima data.', {
            taskId: task.id,
            recurrence: task.recurrence,
            recurrenceDays: task.recurrenceDays,
            baseDate,
          });
        }
      }
      }

      return {
        updatedTask,
        nextRecurrentTask,
        error: updateError,
      };
    } catch (err) {
      console.error('Erro ao atualizar status da tarefa:', err);
      return {
        updatedTask,
        nextRecurrentTask: null,
        error: err,
      };
    }
  },

  /**
   * Conclui ou reabre a parte de um responsável específico em uma tarefa (Conclusão Parcial).
   * Atualiza a submissão no Supabase sem afetar os dados ou status dos outros membros atribuídos.
   * Se todos os membros atribuídos completarem, atualiza o status geral da tarefa para 'concluida'
   * e dispara a recorrência automática quando configurada.
   */
  async updateAssigneeCompletion(
    task: Task,
    memberId: string,
    completed: boolean,
    values?: Record<string, string | number>,
    memberName?: string,
    observacao?: string,
    isAdmin?: boolean
  ): Promise<{
    updatedTask: Task;
    nextRecurrentTask: Task | null;
    error: any | null;
  }> {
    const assigneeIds =
      task.assignedToIds && task.assignedToIds.length > 0
        ? task.assignedToIds
        : task.assignedTo
        ? [task.assignedTo]
        : [memberId];

    const existingSub = task.userSubmissions?.[memberId] ?? {
      userId: memberId,
      userName: memberName ?? 'Usuário',
      completed: false,
      values: {},
    };

    const finalObservacao =
      observacao !== undefined
        ? observacao
        : existingSub.observacao !== undefined
        ? existingSub.observacao
        : existingSub.observation;

    const isMemberAdmin = completed
      ? (isAdmin !== undefined ? Boolean(isAdmin) : Boolean(existingSub.completedByAdmin || existingSub.completed_by_admin))
      : false;

    const updatedSubmissions: Record<string, UserTaskSubmission> = {
      ...(task.userSubmissions ?? {}),
      [memberId]: {
        ...existingSub,
        userId: memberId,
        userName: memberName ?? existingSub.userName ?? 'Usuário',
        completed,
        completedAt: completed
          ? (existingSub.completedAt ?? new Date().toISOString())
          : undefined,
        values: values !== undefined ? values : (existingSub.values ?? {}),
        observacao: finalObservacao,
        observation: finalObservacao,
        completedByAdmin: isMemberAdmin,
        completed_by_admin: isMemberAdmin,
        finalizada_por_admin: isMemberAdmin,
      },
    };

    // Consolidar valores para customFieldValues de forma estrita
    const consolidatedValues: CustomFieldValue[] = [];
    if (task.customFields && task.customFields.length > 0) {
      task.customFields.forEach((f) => {
        let sum = 0;
        const isNum = f.type === 'number';
        let hasAny = false;

        Object.values(updatedSubmissions).forEach((s) => {
          if (
            s.values &&
            s.values[f.id] !== undefined &&
            s.values[f.id] !== null &&
            s.values[f.id] !== ''
          ) {
            hasAny = true;
            if (isNum) {
              const raw = s.values[f.id];
              const normalized = typeof raw === 'string' ? raw.trim().replace(',', '.') : raw;
              const parsed = Number(normalized);
              sum = sum + (isNaN(parsed) ? 0 : parsed);
            } else {
              sum = (s.values[f.id] as any);
            }
          }
        });

        if (hasAny) {
          consolidatedValues.push({
            fieldId: f.id,
            value: isNum ? Number(sum) : String(sum).trim(),
          });
        }
      });
    }

    // Verificar se todos os responsáveis completaram
    const allCompleted = assigneeIds.every(
      (id) => updatedSubmissions[id]?.completed === true
    );
    const anyCompleted = assigneeIds.some(
      (id) => updatedSubmissions[id]?.completed === true
    );

    const newStatus: TaskStatus = allCompleted
      ? 'concluida'
      : anyCompleted
      ? 'em_andamento'
      : 'pendente';

    // Rastreabilidade no resumo geral: tarefa integralmente concluída por admin se todos os membros foram concluídos por admin ou ação direta de admin
    const allSubsFinishedByAdmin =
      allCompleted &&
      assigneeIds.every(
        (id) =>
          updatedSubmissions[id]?.completed &&
          (updatedSubmissions[id]?.completedByAdmin ||
            updatedSubmissions[id]?.completed_by_admin ||
            updatedSubmissions[id]?.finalizada_por_admin)
      );

    const isByAdmin = allCompleted
      ? Boolean(isAdmin || allSubsFinishedByAdmin || task.completedByAdmin || task.completed_by_admin)
      : false;

    const updatedTask: Task = {
      ...task,
      status: newStatus,
      userSubmissions: updatedSubmissions,
      customFieldValues: consolidatedValues,
      completedByAdmin: isByAdmin,
      completed_by_admin: isByAdmin,
      finalizada_por_admin: isByAdmin,
    };

    let nextRecurrentTask: Task | null = null;
    let updateError: any = null;

    try {
      const payload = mapTaskToDbPayload(updatedTask);

      console.log('[SUPABASE AUDIT - UPDATE ASSIGNEE COMPLETION]', {
        operation: 'tarefas.updateAssigneeCompletion',
        taskId: task.id,
        memberId,
        completed,
        inputValues: values,
        consolidatedValues,
        payload,
        timestamp: new Date().toISOString(),
      });

      const { data: updatedRows, error } = await supabase
        .from('tarefas')
        .update(payload)
        .eq('id', task.id)
        .select('id');

      if (error) {
        console.error('[SUPABASE AUDIT - UPDATE ASSIGNEE COMPLETION ERROR]', error);
        updateError = error;
      } else if (!updatedRows || updatedRows.length === 0) {
        updateError = new Error(
          'O Supabase não confirmou a atualização da tarefa. Verifique as políticas de acesso (RLS) e se a tarefa ainda existe.'
        );
        console.error('[SUPABASE AUDIT - UPDATE ASSIGNEE COMPLETION NO ROW]', { taskId: task.id });
      } else {
        broadcastTaskMutation('updated', updatedTask);
      }

      // Verificação de recorrência somente depois de confirmar a gravação.
      const hasRecurrence =
        task.recurrence &&
        String(task.recurrence).trim().toLowerCase() !== 'nenhuma' &&
        String(task.recurrence).trim() !== '';

      if (!updateError && allCompleted && hasRecurrence) {
        const baseDate = normalizeDateOnly(task.scheduledDate) ?? normalizeDateOnly(task.startDate) ?? formatISO(new Date());
        const nextDate = getNextRecurrenceDate(baseDate, task.recurrence, task.recurrenceDays);

        if (nextDate) {
          // Criação atômica e segura com consulta prévia no Supabase para evitar duplicatas
          nextRecurrentTask = await createNextRecurrentTaskSafely(task, nextDate);
        }
      }

      return {
        updatedTask,
        nextRecurrentTask,
        error: updateError,
      };
    } catch (err) {
      console.error('Erro ao atualizar conclusão individual do responsável:', err);
      return {
        updatedTask,
        nextRecurrentTask: null,
        error: err,
      };
    }
  },

  /**
   * Função explícita para marcar uma tarefa como 'concluida', aplicando preenchimento e gerando recorrência automática.
   */
  async completeTask(
    task: Task,
    filledValues?: CustomFieldValue[],
    completedByAdmin?: boolean
  ): Promise<{
    updatedTask: Task;
    nextRecurrentTask: Task | null;
    error: any | null;
  }> {
    return this.updateTaskStatus(task, 'concluida', filledValues, completedByAdmin);
  },

  /**
   * Atualização completa de uma tarefa (título, descrição, prioridade, comentários, etc.)
   */
  async updateTask(
    task: Task
  ): Promise<{ data: Task; error: any | null }> {
    try {
      const payload = mapTaskToDbPayload(task);

      console.log('[SUPABASE AUDIT - UPDATE TASK]', {
        operation: 'tarefas.update',
        taskId: task.id,
        payload,
        timestamp: new Date().toISOString(),
      });

      const { error } = await supabase
        .from('tarefas')
        .update(payload)
        .eq('id', task.id);

      if (error) {
        console.error('[SUPABASE AUDIT - UPDATE TASK ERROR]', error);
        return { data: task, error };
      }

      broadcastTaskMutation('updated', task);
      return { data: task, error: null };
    } catch (err) {
      console.error('[SUPABASE AUDIT - UPDATE TASK EXCEPTION]', err);
      return { data: task, error: err };
    }
  },

  /**
   * Cria a próxima ocorrência recorrente de forma atômica e segura com verificação de duplicidade.
   */
  async createNextRecurrentTaskSafely(
    task: Task,
    nextDate: string
  ): Promise<Task | null> {
    return createNextRecurrentTaskSafely(task, nextDate);
  },

  /**
   * Remove uma tarefa do banco de dados Supabase
   */
  async deleteTask(taskId: string): Promise<{ error: any | null; deleted: boolean }> {
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
        console.error('[SUPABASE AUDIT - DELETE TASK ERROR]', { taskId, error });
        return { error, deleted: false };
      }

      if (!data?.id) {
        const noDeleteError = new Error(
          'O Supabase não confirmou a exclusão da tarefa. Nenhum registro foi retornado; verifique se a política RLS permite que esta conta admin exclua tarefas.'
        );
        console.warn('[SUPABASE AUDIT - DELETE TASK NOT CONFIRMED]', { taskId });
        return { error: noDeleteError, deleted: false };
      }

      broadcastTaskMutation('deleted', taskId);
      return { error: null, deleted: true };
    } catch (err) {
      console.error('[SUPABASE AUDIT - DELETE TASK EXCEPTION]', { taskId, err });
      return { error: err, deleted: false };
    }
  },
};

