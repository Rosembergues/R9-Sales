import React, { useEffect, useMemo, useState } from 'react';
import type {
  Task, TeamMember, TagBucket, UserRole, Priority, TaskStatus, CustomFormField, CustomFieldValue, UserTaskSubmission,
} from '../../types.ts';
import { BUCKET_OPTIONS } from '../../data/bucketOptions.ts';
import { errorText } from '../../../lib/errors';

export interface TaskDetailModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateTask: (updated: Task) => Promise<unknown> | void;
  onDeleteTask: (taskId: string) => Promise<boolean> | boolean;
  teamMembers: TeamMember[];
  currentUser: TeamMember;
  userRole: UserRole;
  buckets?: string[];
  tagBuckets?: TagBucket[];
  /** Cadastro ao qual esta execução pertence (regra legível e se o usuário pode editá-lo). */
  modelInfo?: { rule: string; canEdit: boolean } | null;
  onOpenModel?: () => void;
}

/**
 * Estado e ações da janela de detalhe de uma execução de tarefa:
 * formulário de cada responsável, conclusão/reabertura, comentários, tags e campos.
 */
/** Props com a tarefa garantida: a janela só monta quando há uma tarefa aberta. */
export type OpenTaskDetailProps = Omit<TaskDetailModalProps, 'task'> & { task: Task };

export function useTaskDetail(props: OpenTaskDetailProps) {
  const {
    task, isOpen, onClose, onUpdateTask, onDeleteTask, teamMembers, currentUser, userRole,
    buckets = BUCKET_OPTIONS, tagBuckets = [], modelInfo = null, onOpenModel,
  } = props;
  const isAdmin = userRole === 'admin';
  const [newCommentText, setNewCommentText] = useState('');
  const [newTagInput, setNewTagInput] = useState('');
  const [isDeletingTask, setIsDeletingTask] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);

  // Estados para edição de campos customizados pelo admin
  const [isAddingField, setIsAddingField] = useState(false);
  const [fieldLabel, setFieldLabel] = useState('');
  const [fieldType, setFieldType] = useState<'number' | 'text'>('number');
  const [fieldRequired, setFieldRequired] = useState(true);

  // Lista normalizada de responsáveis da tarefa
  const assigneeIds = useMemo(() => {
    if (task.assignedToIds && task.assignedToIds.length > 0) {
      return task.assignedToIds;
    }
    if (task.assignedTo) {
      return [task.assignedTo];
    }
    return [];
  }, [task.assignedToIds, task.assignedTo]);

  // Objetos detalhados dos membros atribuídos
  const assignedMemberList = useMemo(() => {
    if (assigneeIds.length === 0) {
      return [
        {
          id: currentUser.id || 'default-user',
          name: currentUser.name || 'Usuário Atual',
          email: currentUser.email || '',
          role: currentUser.role,
          avatarColor: currentUser.avatarColor || '#004691',
          initials: currentUser.initials || 'U',
        },
      ];
    }

    return assigneeIds.map((id, index) => {
      const found = teamMembers.find((m) => m.id === id);
      if (found) return found;
      return {
        id,
        name: `Usuário ${index + 1}`,
        email: '',
        role: 'member' as UserRole,
        avatarColor: '#004691',
        initials: `U${index + 1}`,
      };
    });
  }, [assigneeIds, teamMembers, currentUser]);

  // ID do usuário atualmente selecionado no painel para visualização/preenchimento do formulário
  const [selectedMemberId, setSelectedMemberId] = useState<string>(() => {
    if (currentUser?.id && assigneeIds.includes(currentUser.id)) {
      return currentUser.id;
    }
    return assignedMemberList[0]?.id ?? currentUser?.id ?? 'default-user';
  });

  // Obter submissão de um membro
  const getMemberSubmission = (memberId: string): UserTaskSubmission => {
    if (task.userSubmissions && task.userSubmissions[memberId]) {
      return task.userSubmissions[memberId];
    }
    return {
      userId: memberId,
      userName: assignedMemberList.find((m) => m.id === memberId)?.name,
      completed: false,
      values: {},
    };
  };

  // Constrói estado inicial limpo para o membro: NUNCA herda valores fantasmas (como 5322) nem totais acumulados
  const buildInitialValuesForMember = (memberId: string): Record<string, string | number> => {
    const sub = getMemberSubmission(memberId);
    const initial: Record<string, string | number> = {};
    task.customFields?.forEach((f) => {
      // Prioriza EXCLUSIVAMENTE o valor salvo por este membro específico
      if (
        sub.values &&
        sub.values[f.id] !== undefined &&
        sub.values[f.id] !== null &&
        sub.values[f.id] !== ''
      ) {
        initial[f.id] =
          f.type === 'number'
            ? Number(sub.values[f.id])
            : sub.values[f.id];
      } else {
        // Inicialização limpa: estritamente '' (vazio), sem herdar valores fantasmas
        initial[f.id] = '';
      }
    });
    return initial;
  };

  // Valores ativos do formulário para o usuário selecionado
  const [activeMemberFormValues, setActiveMemberFormValues] = useState<
    Record<string, string | number>
  >(() => buildInitialValuesForMember(selectedMemberId));

  // Observação livre e opcional da parte do usuário selecionado
  const [activeMemberObservacao, setActiveMemberObservacao] = useState<string>(() => {
    const sub = getMemberSubmission(selectedMemberId);
    return sub.observacao !== undefined ? sub.observacao : (sub.observation ?? '');
  });

  // Mensagens de validação e feedback
  const [completionError, setCompletionError] = useState<string | null>(null);
  const [successFeedback, setSuccessFeedback] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Sincronizar os valores dos campos e observação sempre que o membro selecionado ou a submissão dele mudar
  const currentMemberSubString = JSON.stringify(task.userSubmissions?.[selectedMemberId] ?? null);

  // Resetar membro ativo quando a tarefa ou modal mudar
  useEffect(() => {
    if (isOpen && task) {
      const defaultId =
        currentUser?.id && assigneeIds.includes(currentUser.id)
          ? currentUser.id
          : (assignedMemberList[0]?.id ?? currentUser?.id ?? 'default-user');
      setSelectedMemberId(defaultId);
    }
  }, [isOpen, task.id]);

  useEffect(() => {
    const initial = buildInitialValuesForMember(selectedMemberId);
    setActiveMemberFormValues(initial);
    const sub = getMemberSubmission(selectedMemberId);
    setActiveMemberObservacao(
      sub.observacao !== undefined ? sub.observacao : (sub.observation ?? '')
    );
    setCompletionError(null);
  }, [selectedMemberId, task.id, currentMemberSubString, isOpen]);

  // Função para limpar/resetar o formulário do membro atual
  const handleResetMemberForm = () => {
    const initial: Record<string, string | number> = {};
    task.customFields?.forEach((f) => {
      initial[f.id] = '';
    });
    setActiveMemberFormValues(initial);
    setActiveMemberObservacao('');
    setCompletionError(null);
    setSuccessFeedback('Formulário limpo com sucesso.');
  };

  // Contagem de progresso de membros
  const effectiveAssigneeIds = useMemo(() => {
    return assigneeIds.length > 0 ? assigneeIds : [selectedMemberId];
  }, [assigneeIds, selectedMemberId]);

  const completedMembersCount = useMemo(() => {
    return effectiveAssigneeIds.filter((id) => {
      const sub = getMemberSubmission(id);
      return sub.completed;
    }).length;
  }, [effectiveAssigneeIds, task.userSubmissions, task.customFieldValues, task.status]);

  const totalMembersCount = effectiveAssigneeIds.length;
  const allAssignedCompleted = completedMembersCount >= totalMembersCount;

  // Atualizar input do formulário do membro selecionado com sanitização estrita
  const handleInputChange = (fieldId: string, val: string, type: 'number' | 'text') => {
    setCompletionError(null);
    setSuccessFeedback(null);
    if (type === 'number') {
      const trimmed = val.trim();
      if (trimmed === '') {
        setActiveMemberFormValues((prev) => ({ ...prev, [fieldId]: '' }));
      } else {
        const normalized = trimmed.replace(',', '.');
        const num = Number(normalized);
        // Garante que o número 0 ou positivo seja estritamente preservado e nunca decrementado indevidamente
        setActiveMemberFormValues((prev) => ({
          ...prev,
          [fieldId]: !isNaN(num) ? num : normalized,
        }));
      }
    } else {
      setActiveMemberFormValues((prev) => ({ ...prev, [fieldId]: val }));
    }
  };

  // Helper para consolidar valores das respostas mantendo 0 e números válidos
  const calculateConsolidatedValues = (
    submissions: Record<string, UserTaskSubmission>
  ): CustomFieldValue[] => {
    const consolidated: CustomFieldValue[] = [];
    task.customFields?.forEach((f) => {
      let sum = 0;
      const isNum = f.type === 'number';
      let hasAny = false;

      Object.values(submissions).forEach((s) => {
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
            sum = sum + (!isNaN(parsed) ? parsed : 0);
          } else {
            sum = s.values[f.id] as unknown as number;
          }
        }
      });

      if (hasAny) {
        consolidated.push({
          fieldId: f.id,
          value: isNum ? Number(sum) : String(sum).trim(),
        });
      }
    });
    return consolidated;
  };

  // Salvar respostas como rascunho sem marcar como concluído
  const handleSaveMemberResponses = async (memberId: string) => {
    if (isSaving) return;
    setCompletionError(null);
    setSuccessFeedback(null);

    const memberName = assignedMemberList.find((m) => m.id === memberId)?.name || 'Usuário';
    const sub = getMemberSubmission(memberId);

    // Sanitizar valores preenchidos
    const sanitizedValues: Record<string, string | number> = {};
    task.customFields?.forEach((f) => {
      const raw = activeMemberFormValues[f.id];
      if (raw !== undefined && raw !== null && raw !== '') {
        if (f.type === 'number') {
          const num = typeof raw === 'string' ? Number(raw.trim().replace(',', '.')) : Number(raw);
          sanitizedValues[f.id] = isNaN(num) ? 0 : num;
        } else {
          sanitizedValues[f.id] = String(raw).trim();
        }
      } else {
        sanitizedValues[f.id] = '';
      }
    });

    const updatedSubmissions: Record<string, UserTaskSubmission> = {
      ...(task.userSubmissions || {}),
      [memberId]: {
        ...sub,
        userId: memberId,
        userName: memberName,
        values: sanitizedValues,
        observacao: activeMemberObservacao.trim() || undefined,
        observation: activeMemberObservacao.trim() || undefined,
      },
    };

    const consolidated = calculateConsolidatedValues(updatedSubmissions);

    const updatedTask: Task = {
      ...task,
      userSubmissions: updatedSubmissions,
      customFieldValues: consolidated,
    };


    try {
      setIsSaving(true);
      await onUpdateTask(updatedTask);
      setSuccessFeedback(`Respostas de ${memberName} salvas com sucesso no Supabase.`);
    } catch (err) {
      console.error('Erro ao salvar respostas no Supabase:', err);
      setCompletionError(
        errorText(err, 'Falha ao salvar respostas no Supabase. O formulário permanece aberto para você não perder os dados. Tente novamente.')
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Submeter e finalizar a parte do usuário selecionado
  const handleCompleteMemberPortion = async (memberId: string) => {
    if (isSaving) return;
    setCompletionError(null);
    setSuccessFeedback(null);

    // 1. Validar campos obrigatórios e sanitizar
    const missing: string[] = [];
    const sanitizedValues: Record<string, string | number> = {};

    task.customFields?.forEach((field) => {
      const rawVal = activeMemberFormValues[field.id];
      const isNum = field.type === 'number';

      // 0 (zero) é estritamente válido! Apenas undefined, null ou string vazia '' contam como não preenchido
      const isFilled = rawVal !== undefined && rawVal !== null && rawVal !== '';

      if (field.required && !isFilled) {
        missing.push(field.label);
      }

      if (isFilled) {
        if (isNum) {
          const normalized = typeof rawVal === 'string' ? rawVal.trim().replace(',', '.') : rawVal;
          const num = Number(normalized);
          if (isNaN(num)) {
            missing.push(`${field.label} (deve ser um número válido)`);
          } else {
            sanitizedValues[field.id] = num; // Número explícito, inclusive 0
          }
        } else {
          sanitizedValues[field.id] = String(rawVal).trim();
        }
      } else {
        sanitizedValues[field.id] = '';
      }
    });

    if (missing.length > 0) {
      setCompletionError(
        `Preenchimento obrigatório pendente: ${missing.join(', ')}.`
      );
      return;
    }

    // 2. Atualizar submissão do membro
    const memberName = assignedMemberList.find((m) => m.id === memberId)?.name || 'Usuário';
    const sub = getMemberSubmission(memberId);
    const isActionAdmin = Boolean(isAdmin || currentUser?.role === 'admin');
    const updatedSubmissions: Record<string, UserTaskSubmission> = {
      ...(task.userSubmissions || {}),
      [memberId]: {
        ...sub,
        userId: memberId,
        userName: memberName,
        completed: true,
        completedAt: new Date().toISOString(),
        values: sanitizedValues,
        observacao: activeMemberObservacao.trim() || undefined,
        observation: activeMemberObservacao.trim() || undefined,
        completedByAdmin: isActionAdmin,
        completed_by_admin: isActionAdmin,
        finalizada_por_admin: isActionAdmin,
      },
    };

    // 3. Consolidar valores para customFieldValues de forma estrita
    const consolidatedValues = calculateConsolidatedValues(updatedSubmissions);

    // 4. Verificar se todos os responsáveis completaram
    const willAllBeCompleted = effectiveAssigneeIds.every(
      (id) => updatedSubmissions[id]?.completed === true
    );
    const willAnyBeCompleted = effectiveAssigneeIds.some(
      (id) => updatedSubmissions[id]?.completed === true
    );

    const newStatus: TaskStatus = willAllBeCompleted
      ? 'concluida'
      : willAnyBeCompleted
      ? 'em_andamento'
      : 'pendente';

    const allSubsFinishedByAdmin =
      willAllBeCompleted &&
      effectiveAssigneeIds.every(
        (id) =>
          updatedSubmissions[id]?.completed &&
          (updatedSubmissions[id]?.completedByAdmin ||
            updatedSubmissions[id]?.completed_by_admin ||
            updatedSubmissions[id]?.finalizada_por_admin)
      );

    const isFinishedByAdmin = willAllBeCompleted
      ? Boolean(isActionAdmin || allSubsFinishedByAdmin || task.completedByAdmin || task.completed_by_admin)
      : false;

    const updatedTask: Task = {
      ...task,
      status: newStatus,
      userSubmissions: updatedSubmissions,
      customFieldValues: consolidatedValues,
      completedByAdmin: isFinishedByAdmin,
      completed_by_admin: isFinishedByAdmin,
      finalizada_por_admin: isFinishedByAdmin,
    };


    try {
      setIsSaving(true);
      await onUpdateTask(updatedTask);

      if (willAllBeCompleted) {
        setSuccessFeedback(
          'Todos os responsáveis concluíram suas partes! A tarefa foi marcada como Concluída.'
        );
      } else {
        setSuccessFeedback(
          `Formulário de ${memberName} salvo e concluído com sucesso (${completedMembersCount + 1}/${totalMembersCount} concluídos). Aguardando os demais responsáveis.`
        );
      }
    } catch (err) {
      console.error('Erro ao salvar e finalizar parte do membro no Supabase:', err);
      setCompletionError(
        errorText(err, 'Falha ao salvar conclusão no Supabase. O formulário não foi fechado para evitar perda de dados. Tente novamente.')
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Salvar apenas a observação do usuário sem alterar o status da tarefa
  const handleSaveMemberObservation = async (memberId: string) => {
    if (isSaving) return;
    setCompletionError(null);
    setSuccessFeedback(null);

    const memberName = assignedMemberList.find((m) => m.id === memberId)?.name ?? 'Usuário';
    const sub = getMemberSubmission(memberId);
    const updatedSubmissions: Record<string, UserTaskSubmission> = {
      ...(task.userSubmissions ?? {}),
      [memberId]: {
        ...sub,
        userId: memberId,
        userName: memberName,
        values: memberId === selectedMemberId ? { ...activeMemberFormValues } : (sub.values ?? {}),
        observacao: activeMemberObservacao.trim() || undefined,
        observation: activeMemberObservacao.trim() || undefined,
      },
    };

    try {
      setIsSaving(true);
      await onUpdateTask({
        ...task,
        userSubmissions: updatedSubmissions,
      });
      setSuccessFeedback(`Observação de ${memberName} salva com sucesso no Supabase.`);
    } catch (err) {
      console.error('Erro ao salvar observação no Supabase:', err);
      setCompletionError(
        errorText(err, 'Falha ao salvar observação no Supabase. Tente novamente.')
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Reabrir a parte do membro para edição
  const handleReopenMemberPortion = async (memberId: string) => {
    if (isSaving) return;
    setCompletionError(null);
    setSuccessFeedback(null);

    const memberName = assignedMemberList.find((m) => m.id === memberId)?.name || 'Usuário';
    const sub = getMemberSubmission(memberId);
    const updatedSubmissions: Record<string, UserTaskSubmission> = {
      ...(task.userSubmissions || {}),
      [memberId]: {
        ...sub,
        userId: memberId,
        userName: memberName,
        completed: false,
        completedAt: undefined,
        observacao: sub.observacao !== undefined ? sub.observacao : sub.observation,
        observation: sub.observacao !== undefined ? sub.observacao : sub.observation,
        completedByAdmin: false,
        completed_by_admin: false,
        finalizada_por_admin: false,
      },
    };

    // Verificar novo status geral
    const willAnyBeCompleted = effectiveAssigneeIds.some(
      (id) => id !== memberId && updatedSubmissions[id]?.completed === true
    );
    const newStatus: TaskStatus = willAnyBeCompleted ? 'em_andamento' : 'pendente';

    try {
      setIsSaving(true);
      await onUpdateTask({
        ...task,
        status: newStatus,
        userSubmissions: updatedSubmissions,
        completedByAdmin: false,
        completed_by_admin: false,
        finalizada_por_admin: false,
      });
      setSuccessFeedback(`Parte de ${memberName} reaberta como pendente no Supabase.`);
    } catch (err) {
      console.error('Erro ao reabrir parte do membro no Supabase:', err);
      setCompletionError(
        errorText(err, 'Falha ao reabrir parte do membro no Supabase. Tente novamente.')
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Ação rápida do Administrador para finalizar ou reabrir apenas a parte de um responsável específico
  const handleAdminToggleMemberCompletion = async (
    memberId: string,
    e?: React.MouseEvent
  ) => {
    if (e) e.stopPropagation();
    if (isSaving) return;
    setCompletionError(null);
    setSuccessFeedback(null);

    const sub = getMemberSubmission(memberId);
    const memberName = assignedMemberList.find((m) => m.id === memberId)?.name ?? 'Usuário';
    const newCompleted = !sub.completed;

    // Se o membro selecionado está sendo editado no momento, herda os valores atuais do formulário
    const valuesToUse =
      memberId === selectedMemberId
        ? { ...activeMemberFormValues }
        : (sub.values ?? {});

    const observacaoToUse =
      memberId === selectedMemberId
        ? (activeMemberObservacao.trim() || undefined)
        : (sub.observacao !== undefined ? sub.observacao : sub.observation);

    // Quando o admin clica para finalizar a parte, grava explicitamente completedByAdmin: true
    const isActionByAdmin = Boolean(isAdmin || currentUser?.role === 'admin');
    const isMemberCompletedByAdmin = newCompleted ? isActionByAdmin : false;

    const updatedSubmissions: Record<string, UserTaskSubmission> = {
      ...(task.userSubmissions ?? {}),
      [memberId]: {
        ...sub,
        userId: memberId,
        userName: memberName,
        completed: newCompleted,
        completedAt: newCompleted ? (sub.completedAt || new Date().toISOString()) : undefined,
        values: valuesToUse,
        observacao: observacaoToUse,
        observation: observacaoToUse,
        completedByAdmin: isMemberCompletedByAdmin,
        completed_by_admin: isMemberCompletedByAdmin,
        finalizada_por_admin: isMemberCompletedByAdmin,
      },
    };

    // Consolidar valores para customFieldValues (compatibilidade)
    const consolidatedValues = calculateConsolidatedValues(updatedSubmissions);

    // Recalcular status global
    const willAllBeCompleted = effectiveAssigneeIds.every(
      (id) => updatedSubmissions[id]?.completed === true
    );
    const willAnyBeCompleted = effectiveAssigneeIds.some(
      (id) => updatedSubmissions[id]?.completed === true
    );

    const newStatus: TaskStatus = willAllBeCompleted
      ? 'concluida'
      : willAnyBeCompleted
      ? 'em_andamento'
      : 'pendente';

    // Rastreabilidade no resumo geral: se todos os membros foram concluídos e todos foram por admin (ou ação feita por admin)
    const allSubsFinishedByAdmin =
      willAllBeCompleted &&
      effectiveAssigneeIds.every(
        (id) =>
          updatedSubmissions[id]?.completed &&
          (updatedSubmissions[id]?.completedByAdmin ||
            updatedSubmissions[id]?.completed_by_admin ||
            updatedSubmissions[id]?.finalizada_por_admin)
      );

    const isFinishedByAdmin = willAllBeCompleted
      ? Boolean(isActionByAdmin || allSubsFinishedByAdmin || task.completedByAdmin || task.completed_by_admin)
      : false;

    const updatedTask: Task = {
      ...task,
      status: newStatus,
      userSubmissions: updatedSubmissions,
      customFieldValues: consolidatedValues,
      completedByAdmin: isFinishedByAdmin,
      completed_by_admin: isFinishedByAdmin,
      finalizada_por_admin: isFinishedByAdmin,
    };


    try {
      setIsSaving(true);
      await onUpdateTask(updatedTask);

      if (newCompleted) {
        if (willAllBeCompleted) {
          setSuccessFeedback(
            `Parte de ${memberName} finalizada! Todos os responsáveis concluíram e a tarefa foi finalizada no Supabase.`
          );
        } else {
          setSuccessFeedback(
            `Parte de ${memberName} finalizada com sucesso pelo Administrador no Supabase.`
          );
        }
      } else {
        setSuccessFeedback(`Parte de ${memberName} reaberta como pendente no Supabase.`);
      }
    } catch (err) {
      console.error('Erro ao atualizar status do membro no Supabase:', err);
      setCompletionError(
        errorText(err, 'Falha ao atualizar status no Supabase. Tente novamente.')
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Mudança do Status Global da Tarefa
  const handleStatusChange = (newStatus: TaskStatus) => {
    setCompletionError(null);
    setSuccessFeedback(null);

    if (newStatus === 'concluida') {
      // Validar se todos os membros preencheram seus formulários
      const uncompletedMembers = effectiveAssigneeIds.filter((id) => {
        const sub = getMemberSubmission(id);
        return !sub.completed;
      });

      if (uncompletedMembers.length > 0 && task.customFields && task.customFields.length > 0) {
        const names = uncompletedMembers
          .map((id) => assignedMemberList.find((m) => m.id === id)?.name || id)
          .join(', ');

        setCompletionError(
          `Ação bloqueada: todos os responsáveis precisam preencher e finalizar seus formulários (${completedMembersCount}/${totalMembersCount} concluíram). Pendente para: ${names}.`
        );
        return;
      }

      onUpdateTask({
        ...task,
        status: 'concluida',
        completedByAdmin: Boolean(isAdmin || currentUser?.role === 'admin'),
        completed_by_admin: Boolean(isAdmin || currentUser?.role === 'admin'),
        finalizada_por_admin: Boolean(isAdmin || currentUser?.role === 'admin'),
      });
    } else {
      onUpdateTask({
        ...task,
        status: newStatus,
        completedByAdmin: false,
        completed_by_admin: false,
        finalizada_por_admin: false,
      });
    }
  };

  const handleFieldChange = <K extends keyof Task>(field: K, value: Task[K]) => {
    if (!isAdmin && field !== 'status') return;
    onUpdateTask({ ...task, [field]: value });
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim()) return;

    const newComment = {
      id: `c-${Date.now()}`,
      authorId: currentUser.id,
      authorName: currentUser.name,
      authorInitials: currentUser.initials,
      authorColor: currentUser.avatarColor,
      text: newCommentText.trim(),
      createdAt: new Date().toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    };

    onUpdateTask({
      ...task,
      comments: [...(task.comments ?? []), newComment],
    });
    setNewCommentText('');
  };

  const handleAddTag = () => {
    if (!newTagInput.trim()) return;
    const cleanTag = newTagInput.trim();
    if (!task.tags.includes(cleanTag)) {
      onUpdateTask({ ...task, tags: [...task.tags, cleanTag] });
    }
    setNewTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    if (!isAdmin) return;
    onUpdateTask({
      ...task,
      tags: task.tags.filter((t) => t !== tagToRemove),
    });
  };

  const handleAddAdminCustomField = () => {
    if (!fieldLabel.trim()) return;
    const newField: CustomFormField = {
      id: `field-${Date.now()}`,
      label: fieldLabel.trim(),
      type: fieldType,
      required: fieldRequired,
    };
    onUpdateTask({
      ...task,
      customFields: [...(task.customFields ?? []), newField],
    });
    setFieldLabel('');
    setIsAddingField(false);
  };

  const handleRemoveAdminCustomField = (fieldId: string) => {
    if (!isAdmin) return;
    onUpdateTask({
      ...task,
      customFields: task.customFields?.filter((f) => f.id !== fieldId),
      customFieldValues: task.customFieldValues?.filter((v) => v.fieldId !== fieldId),
    });
  };

  // Helper para cor de prioridade
  const getPriorityStyle = (p: Priority) => {
    switch (p) {
      case 'Urgente':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'Alta':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'Média':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Baixa':
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const currentSelectedSubmission = getMemberSubmission(selectedMemberId);
  const isCurrentSelectedCompleted = currentSelectedSubmission.completed;
  const selectedMemberObj = assignedMemberList.find((m) => m.id === selectedMemberId);

  return {
    task,
    isOpen,
    onClose,
    onUpdateTask,
    onDeleteTask,
    teamMembers,
    currentUser,
    userRole,
    buckets,
    tagBuckets,
    modelInfo,
    onOpenModel,
    isAdmin,
    newCommentText,
    setNewCommentText,
    newTagInput,
    setNewTagInput,
    isDeletingTask,
    setIsDeletingTask,
    showDeleteConfirmation,
    setShowDeleteConfirmation,
    isAddingField,
    setIsAddingField,
    fieldLabel,
    setFieldLabel,
    fieldType,
    setFieldType,
    fieldRequired,
    setFieldRequired,
    assigneeIds,
    assignedMemberList,
    selectedMemberId,
    setSelectedMemberId,
    getMemberSubmission,
    buildInitialValuesForMember,
    activeMemberFormValues,
    setActiveMemberFormValues,
    activeMemberObservacao,
    setActiveMemberObservacao,
    completionError,
    setCompletionError,
    successFeedback,
    setSuccessFeedback,
    isSaving,
    setIsSaving,
    currentMemberSubString,
    handleResetMemberForm,
    effectiveAssigneeIds,
    completedMembersCount,
    totalMembersCount,
    allAssignedCompleted,
    handleInputChange,
    calculateConsolidatedValues,
    handleSaveMemberResponses,
    handleCompleteMemberPortion,
    handleSaveMemberObservation,
    handleReopenMemberPortion,
    handleAdminToggleMemberCompletion,
    handleStatusChange,
    handleFieldChange,
    handleAddComment,
    handleAddTag,
    handleRemoveTag,
    handleAddAdminCustomField,
    handleRemoveAdminCustomField,
    getPriorityStyle,
    currentSelectedSubmission,
    isCurrentSelectedCompleted,
    selectedMemberObj,
  };
}

export type TaskDetailState = ReturnType<typeof useTaskDetail>;
