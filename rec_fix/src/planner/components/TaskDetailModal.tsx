import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Calendar,
  Clock,
  User,
  Tag,
  Repeat,
  AlertCircle,
  Folder,
  Send,
  Trash2,
  CheckCircle2,
  Circle,
  MessageSquare,
  ShieldCheck,
  Plus,
  Sliders,
  Check,
  Lock,
  Users,
  CheckSquare,
  RotateCcw,
  Loader2,
} from 'lucide-react';
import {
  Task,
  TeamMember,
  UserRole,
  Priority,
  Recurrence,
  TaskStatus,
  CustomFormField,
  CustomFieldValue,
  UserTaskSubmission,
  TagBucket,
} from '../types.ts';
import { BUCKET_OPTIONS } from '../data/mockData.ts';

const WEEK_DAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom'];

interface TaskDetailModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateTask: (updated: Task) => Promise<any> | void;
  onDeleteTask: (taskId: string) => void;
  onOpenCompletionModal?: (task: Task) => void;
  teamMembers: TeamMember[];
  currentUser: TeamMember;
  userRole: UserRole;
  buckets?: string[];
  tagBuckets?: TagBucket[];
}

function TaskDetailModalContent({
  task,
  isOpen,
  onClose,
  onUpdateTask,
  onDeleteTask,
  onOpenCompletionModal,
  teamMembers,
  currentUser,
  userRole,
  buckets = BUCKET_OPTIONS,
  tagBuckets = [],
}: TaskDetailModalProps) {
  const isAdmin = userRole === 'admin';
  const [newCommentText, setNewCommentText] = useState('');
  const [newTagInput, setNewTagInput] = useState('');

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
    console.log('[FORM AUDIT - RESET MEMBER FORM]', {
      taskId: task.id,
      memberId: selectedMemberId,
      timestamp: new Date().toISOString(),
    });
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
            sum = (s.values[f.id] as any);
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

    console.log('[SUPABASE AUDIT - SAVE MEMBER RESPONSES]', {
      taskId: task.id,
      memberId,
      memberName,
      sanitizedValues,
      consolidatedCustomFields: consolidated,
      timestamp: new Date().toISOString(),
    });

    try {
      setIsSaving(true);
      await onUpdateTask(updatedTask);
      setSuccessFeedback(`Respostas de ${memberName} salvas com sucesso no Supabase.`);
    } catch (err: any) {
      console.error('Erro ao salvar respostas no Supabase:', err);
      setCompletionError(
        err?.message ||
          'Falha ao salvar respostas no Supabase. O formulário permanece aberto para você não perder os dados. Tente novamente.'
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

    console.log('[SUPABASE AUDIT - COMPLETE MEMBER PORTION]', {
      taskId: task.id,
      memberId,
      memberName,
      newStatus,
      sanitizedValues,
      consolidatedValues,
      timestamp: new Date().toISOString(),
    });

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
    } catch (err: any) {
      console.error('Erro ao salvar e finalizar parte do membro no Supabase:', err);
      setCompletionError(
        err?.message ||
          'Falha ao salvar conclusão no Supabase. O formulário não foi fechado para evitar perda de dados. Tente novamente.'
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
    } catch (err: any) {
      console.error('Erro ao salvar observação no Supabase:', err);
      setCompletionError(
        err?.message ||
          'Falha ao salvar observação no Supabase. Tente novamente.'
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
    } catch (err: any) {
      console.error('Erro ao reabrir parte do membro no Supabase:', err);
      setCompletionError(
        err?.message || 'Falha ao reabrir parte do membro no Supabase. Tente novamente.'
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

    console.log('[SUPABASE AUDIT - ADMIN TOGGLE MEMBER]', {
      taskId: task.id,
      memberId,
      memberName,
      newCompleted,
      newStatus,
      consolidatedValues,
      timestamp: new Date().toISOString(),
    });

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
    } catch (err: any) {
      console.error('Erro ao atualizar status do membro no Supabase:', err);
      setCompletionError(
        err?.message || 'Falha ao atualizar status no Supabase. Tente novamente.'
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

  const handleFieldChange = (field: keyof Task, value: any) => {
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
        {/* ============================================================ */}
        {/* CASO 1: VISÃO DO MEMBRO (SIMPLIFICADA & PROGRESSO MULTI-USUÁRIO) */}
        {/* ============================================================ */}
        {!isAdmin ? (
          <div className="flex flex-col h-full">
            {/* Cabeçalho */}
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between bg-white shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 border border-gray-200">
                  Visão de Membro
                </span>
                {allAssignedCompleted && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3" />
                    Todos Concluíram
                  </span>
                )}
                {task.status === 'concluida' && (task.completedByAdmin || task.completed_by_admin || task.finalizada_por_admin) && (
                  <span
                    className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-[#004691] border border-blue-200 shadow-2xs"
                    title="Esta tarefa foi finalizada por um Administrador"
                  >
                    <ShieldCheck className="w-3 h-3 text-[#004691]" />
                    Finalizada por Admin
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Conteúdo Focado */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Título da Ação */}
              <div>
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">
                  AÇÃO
                </span>
                <h2 className="text-base font-bold text-gray-900 leading-snug">
                  {task.title}
                </h2>
                {task.description && (
                  <p className="text-xs text-gray-600 mt-2 bg-gray-50 p-3 rounded-lg border border-gray-100 leading-relaxed">
                    {task.description}
                  </p>
                )}
              </div>

              {/* Bloco: Status da Ação e Prioridade */}
              <div className="grid grid-cols-2 gap-3 p-3.5 bg-gray-50/90 rounded-xl border border-gray-200">
                {/* 1. Status da Ação */}
                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 mb-1.5">
                    Status da Ação
                  </label>
                  <select
                    value={task.status}
                    onChange={(e) => handleStatusChange(e.target.value as TaskStatus)}
                    className={`w-full text-xs font-semibold rounded-lg px-2.5 py-2 border outline-none cursor-pointer ${
                      task.status === 'concluida'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : task.status === 'em_andamento'
                        ? 'bg-blue-50 text-blue-800 border-blue-300'
                        : 'bg-white text-gray-800 border-gray-300'
                    }`}
                  >
                    <option value="pendente">⏳ Pendente</option>
                    <option value="em_andamento">⚡ Em Andamento</option>
                    <option value="concluida">✅ Concluída</option>
                  </select>
                </div>

                {/* 2. Prioridade */}
                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 mb-1.5">
                    Prioridade
                  </label>
                  <div
                    className={`w-full text-xs font-semibold px-2.5 py-2 rounded-lg border text-center ${getPriorityStyle(
                      task.priority
                    )}`}
                  >
                    {task.priority}
                  </div>
                </div>

                {/* Feedback sutil de conclusão por Administrador na visão do membro */}
                {task.status === 'concluida' && (task.completedByAdmin || task.completed_by_admin || task.finalizada_por_admin) && (
                  <div className="col-span-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 border border-blue-200/80 text-xs text-[#004691] font-medium">
                    <ShieldCheck className="w-4 h-4 text-[#004691] shrink-0" />
                    <span>Esta ação foi finalizada diretamente por um <strong>Administrador</strong>.</span>
                  </div>
                )}
              </div>

              {/* LISTA DE USUÁRIOS RESPONSÁVEIS COM CÍRCULOS DE STATUS (Prints 1 e 2) */}
              <div className="border border-slate-200/90 rounded-xl bg-white shadow-2xs overflow-hidden">
                <div className="px-3.5 py-2.5 bg-slate-50/80 border-b border-slate-200/70 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-slate-600" />
                    <span className="text-xs font-bold text-slate-800">
                      Usuários Responsáveis
                    </span>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-500 bg-white px-2 py-0.5 rounded-full border border-slate-200">
                    {completedMembersCount} de {totalMembersCount} concluíram
                  </span>
                </div>

                <div className="divide-y divide-slate-100">
                  {assignedMemberList.map((m, idx) => {
                    const sub = getMemberSubmission(m.id);
                    const isSelected = selectedMemberId === m.id;
                    const isCompleted = sub.completed;

                    return (
                      <div
                        key={m.id}
                        onClick={() => setSelectedMemberId(m.id)}
                        className={`px-3.5 py-2.5 flex items-center justify-between transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-blue-50/70 border-l-3 border-l-blue-600'
                            : 'hover:bg-slate-50/80'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Círculo de Status: Verde preenchido (Concluído) ou Círculo vazado (Pendente) */}
                          <div className="shrink-0 flex items-center justify-center">
                            {isCompleted ? (
                              <div
                                className="w-5 h-5 rounded-full bg-[#22c55e] flex items-center justify-center text-white shadow-xs"
                                title="Formulário preenchido e concluído"
                              >
                                <Check className="w-3.5 h-3.5 stroke-[3]" />
                              </div>
                            ) : (
                              <div
                                className="w-5 h-5 rounded-full border-2 border-slate-700 bg-white shadow-2xs"
                                title="Preenchimento pendente"
                              />
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`text-xs ${
                                  isSelected ? 'font-bold text-slate-900' : 'font-medium text-slate-800'
                                }`}
                              >
                                {m.name || `Usuário ${idx + 1}`}
                              </span>
                              {m.id === currentUser.id && (
                                <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded bg-blue-100 text-blue-800">
                                  Você
                                </span>
                              )}
                            </div>
                            {m.email && (
                              <span className="text-[10px] text-slate-400 truncate block">
                                {m.email}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {isCompleted ? (
                            <div className="flex items-center gap-1">
                              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60 flex items-center gap-1">
                                <span>Concluído</span>
                              </span>
                              {(sub.completedByAdmin || sub.completed_by_admin || sub.finalizada_por_admin) && (
                                <span
                                  className="inline-flex items-center gap-0.5 text-[9.5px] font-bold px-1.5 py-0.5 rounded-md bg-blue-50 text-[#004691] border border-blue-200/90 shadow-2xs"
                                  title="Esta parte foi finalizada diretamente por um Administrador"
                                >
                                  <ShieldCheck className="w-2.5 h-2.5 text-[#004691]" />
                                  <span>Admin</span>
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                              Pendente
                            </span>
                          )}

                          {/* Botão de Ação Rápida: Administrador pode concluir ou reabrir qualquer responsável */}
                          {(isAdmin || m.id === currentUser.id) && (
                            <button
                              type="button"
                              onClick={(e) => handleAdminToggleMemberCompletion(m.id, e)}
                              className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all flex items-center gap-1 cursor-pointer ${
                                isCompleted
                                  ? 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
                                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 shadow-2xs font-bold'
                              }`}
                              title={
                                isCompleted
                                  ? `Reabrir parte de ${m.name || 'Usuário'}`
                                  : `Finalizar apenas a parte de ${m.name || 'Usuário'}`
                              }
                            >
                              {isCompleted ? (
                                <>
                                  <RotateCcw className="w-3 h-3 text-slate-400" />
                                  <span>Reabrir</span>
                                </>
                              ) : (
                                <>
                                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                                  <span>Finalizar parte</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Mensagem de Erro de Validação */}
              {completionError && (
                <div className="p-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 animate-fadeIn">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{completionError}</span>
                </div>
              )}

              {/* Mensagem de Sucesso */}
              {successFeedback && (
                <div className="p-3 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-2 animate-fadeIn">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                  <span>{successFeedback}</span>
                </div>
              )}

              {/* FORMULÁRIO DE MÉTRICAS & CAMPOS OBRIGATÓRIOS (Prints 1 e 2) */}
              {task.customFields && task.customFields.length > 0 ? (
                <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/40 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-blue-700" />
                      <h3 className="text-xs font-bold text-gray-900">
                        Métricas & Campos Obrigatórios para Conclusão
                      </h3>
                    </div>
                    {!isCurrentSelectedCompleted && (
                      <button
                        type="button"
                        onClick={handleResetMemberForm}
                        disabled={isSaving}
                        className="text-[11px] text-blue-600 hover:text-blue-800 flex items-center gap-1 hover:underline cursor-pointer disabled:opacity-50"
                        title="Limpar todos os campos digitados para começar do zero"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Limpar formulário</span>
                      </button>
                    )}
                  </div>

                  <p className="text-[11px] text-gray-600 leading-relaxed">
                    O administrador definiu os campos abaixo. Preencha-os para que seja possível marcar a ação como <strong>Concluída</strong>.
                  </p>

                  {/* Indicador de qual usuário está sendo editado */}
                  <div className="px-2.5 py-1.5 rounded-lg bg-white border border-blue-200/80 flex items-center justify-between text-xs">
                    <span className="text-slate-600">
                      Preenchendo para:{' '}
                      <strong className="text-slate-900">
                        {selectedMemberObj?.name || 'Usuário'}
                      </strong>
                    </span>
                    {isCurrentSelectedCompleted ? (
                      <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-emerald-700">
                        <Check className="w-3 h-3 stroke-[3]" /> Concluído
                      </span>
                    ) : (
                      <span className="text-[10.5px] text-amber-700 font-semibold">
                        Aguardando envio
                      </span>
                    )}
                  </div>

                  <div className="space-y-3 pt-1">
                    {task.customFields.map((field) => {
                      const currentVal =
                        activeMemberFormValues[field.id] !== undefined
                          ? activeMemberFormValues[field.id]
                          : '';

                      return (
                        <div key={field.id} className="space-y-1">
                          <label className="block text-xs font-semibold text-gray-700">
                            {field.label}{' '}
                            {field.required && (
                              <span className="text-red-500 font-bold">*</span>
                            )}
                          </label>
                          <input
                            type={field.type === 'number' ? 'number' : 'text'}
                            min={field.type === 'number' ? 0 : undefined}
                            onWheel={(e) => (e.target as HTMLInputElement).blur()}
                            required={field.required}
                            disabled={isCurrentSelectedCompleted}
                            placeholder={
                              field.placeholder ??
                              (field.type === 'number' ? '0' : 'Preencha aqui...')
                            }
                            value={currentVal}
                            onChange={(e) =>
                              handleInputChange(field.id, e.target.value, field.type)
                            }
                            className={`w-full text-xs border rounded-lg px-3 py-2 outline-none transition-all ${
                              isCurrentSelectedCompleted
                                ? 'bg-slate-100 text-slate-600 border-slate-200 cursor-not-allowed'
                                : 'bg-white text-slate-900 border-gray-300 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20'
                            }`}
                          />
                        </div>
                      );
                    })}

                    {/* Caixa de Observação Opcional por Usuário */}
                    <div className="space-y-1.5 pt-2 border-t border-blue-200/60">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                          <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
                          <span>Observação da minha parte</span>
                          <span className="text-[10.5px] font-normal text-slate-400">
                            (Opcional)
                          </span>
                        </label>

                        {!isCurrentSelectedCompleted && activeMemberObservacao.trim() && (
                          <button
                            type="button"
                            onClick={() => handleSaveMemberObservation(selectedMemberId)}
                            className="text-[11px] text-blue-700 hover:text-blue-800 font-semibold cursor-pointer underline-offset-2 hover:underline"
                          >
                            Salvar observação
                          </button>
                        )}
                      </div>

                      <textarea
                        rows={3}
                        disabled={isCurrentSelectedCompleted}
                        placeholder="Escreva uma observação ou comentário opcional sobre a sua parte nesta tarefa..."
                        value={activeMemberObservacao}
                        onChange={(e) => {
                          setActiveMemberObservacao(e.target.value);
                          setCompletionError(null);
                        }}
                        className={`w-full text-xs border rounded-lg px-3 py-2 outline-none resize-y transition-all ${
                          isCurrentSelectedCompleted
                            ? 'bg-slate-100 text-slate-600 border-slate-200 cursor-not-allowed'
                            : 'bg-white text-slate-900 border-gray-300 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20'
                        }`}
                      />
                      <p className="text-[10.5px] text-slate-500">
                        O preenchimento não é obrigatório. Você pode concluir mesmo sem preencher.
                      </p>
                    </div>
                  </div>

                  {/* Botão de Concluir a Parte do Usuário */}
                  <div className="pt-2">
                    {isCurrentSelectedCompleted ? (
                      <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-emerald-800 font-semibold flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            Formulário finalizado por este usuário
                          </span>
                          {(currentSelectedSubmission?.completedByAdmin ||
                            currentSelectedSubmission?.completed_by_admin ||
                            currentSelectedSubmission?.finalizada_por_admin) && (
                            <span
                              className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-[#004691] border border-blue-300 shadow-2xs"
                              title="Esta parte foi concluída por um Administrador"
                            >
                              <ShieldCheck className="w-3 h-3 text-[#004691]" />
                              Finalizada por Admin
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => handleReopenMemberPortion(selectedMemberId)}
                          className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-md transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-50"
                        >
                          {isSaving ? (
                            <Loader2 className="w-3 h-3 animate-spin text-slate-500" />
                          ) : (
                            <RotateCcw className="w-3 h-3 text-slate-500" />
                          )}
                          <span>Reabrir</span>
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => handleSaveMemberResponses(selectedMemberId)}
                          className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold border border-slate-300 rounded-lg shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                        >
                          {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-600" /> : null}
                          <span>Salvar Respostas</span>
                        </button>
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => handleCompleteMemberPortion(selectedMemberId)}
                          className="flex-1 py-2.5 px-4 bg-[#004691] hover:bg-[#00356e] text-white text-xs font-bold rounded-lg shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                        >
                          {isSaving ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin text-white" />
                              <span>Salvando no Supabase...</span>
                            </>
                          ) : (
                            <>
                              <Check className="w-4 h-4 stroke-[2.5]" />
                              <span>
                                Salvar e Concluir Minha Parte (
                                {selectedMemberObj?.name?.split(' ')[0] || 'Usuário'})
                              </span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* Caso a ação não possua campos customizados, permite que o membro adicione observação e conclua sua parte diretamente */
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
                  <div className="space-y-1">
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Esta ação não possui formulário adicional. Marque sua parte como concluída quando finalizar sua atividade.
                    </p>
                  </div>

                  {/* Indicador de qual usuário está sendo editado */}
                  <div className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 flex items-center justify-between text-xs">
                    <span className="text-slate-600">
                      Responsável:{' '}
                      <strong className="text-slate-900">
                        {selectedMemberObj?.name || 'Usuário'}
                      </strong>
                    </span>
                    {isCurrentSelectedCompleted ? (
                      <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-emerald-700">
                        <Check className="w-3 h-3 stroke-[3]" /> Concluído
                      </span>
                    ) : (
                      <span className="text-[10.5px] text-amber-700 font-semibold">
                        Pendente
                      </span>
                    )}
                  </div>

                  {/* Caixa de Observação Opcional por Usuário */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                        <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
                        <span>Observação da minha parte</span>
                        <span className="text-[10.5px] font-normal text-slate-400">
                          (Opcional)
                        </span>
                      </label>

                      {!isCurrentSelectedCompleted && activeMemberObservacao.trim() && (
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => handleSaveMemberObservation(selectedMemberId)}
                          className="text-[11px] text-blue-700 hover:text-blue-800 font-semibold cursor-pointer underline-offset-2 hover:underline disabled:opacity-50"
                        >
                          Salvar observação
                        </button>
                      )}
                    </div>

                    <textarea
                      rows={3}
                      disabled={isCurrentSelectedCompleted || isSaving}
                      placeholder="Escreva uma observação ou comentário opcional sobre a sua parte nesta tarefa..."
                      value={activeMemberObservacao}
                      onChange={(e) => {
                        setActiveMemberObservacao(e.target.value);
                        setCompletionError(null);
                      }}
                      className={`w-full text-xs border rounded-lg px-3 py-2 outline-none resize-y transition-all ${
                        isCurrentSelectedCompleted
                          ? 'bg-slate-100 text-slate-600 border-slate-200 cursor-not-allowed'
                          : 'bg-white text-slate-900 border-gray-300 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20'
                      }`}
                    />
                    <p className="text-[10.5px] text-slate-500">
                      O preenchimento não é obrigatório.
                    </p>
                  </div>

                  {/* Botões de Ação */}
                  <div className="pt-2">
                    {isCurrentSelectedCompleted ? (
                      <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
                        <span className="text-xs text-emerald-800 font-semibold flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          Parte finalizada por este usuário
                        </span>
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => handleReopenMemberPortion(selectedMemberId)}
                          className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-md transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-50"
                        >
                          {isSaving ? (
                            <Loader2 className="w-3 h-3 animate-spin text-slate-500" />
                          ) : (
                            <RotateCcw className="w-3 h-3 text-slate-500" />
                          )}
                          <span>Reabrir</span>
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        {activeMemberObservacao.trim() ? (
                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={() => handleSaveMemberObservation(selectedMemberId)}
                            className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold border border-slate-300 rounded-lg shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                          >
                            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-600" /> : null}
                            <span>Salvar Observação</span>
                          </button>
                        ) : null}
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => handleCompleteMemberPortion(selectedMemberId)}
                          className="flex-1 py-2.5 px-4 bg-[#004691] hover:bg-[#00356e] text-white text-xs font-bold rounded-lg shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                        >
                          {isSaving ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin text-white" />
                              <span>Salvando no Supabase...</span>
                            </>
                          ) : (
                            <>
                              <Check className="w-4 h-4 stroke-[2.5]" />
                              <span>
                                Salvar e Marcar Minha Parte como Concluída (
                                {selectedMemberObj?.name?.split(' ')[0] || 'Usuário'})
                              </span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Rodapé Simplificado */}
            <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between shrink-0">
              <span className="text-[11px] text-gray-500">
                {allAssignedCompleted
                  ? 'Status da ação: Concluída ✅'
                  : `Progresso: ${completedMembersCount}/${totalMembersCount} finalizados`}
              </span>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        ) : (
          /* ============================================================ */
          /* CASO 2: VISÃO DO ADMINISTRADOR (ACESSO COMPLETO & GESTÃO) */
          /* ============================================================ */
          <div className="flex flex-col h-full">
            {/* Cabeçalho do Drawer Admin */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-white shrink-0">
              <div className="flex items-center gap-3">
                <span
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                    task.status === 'concluida'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : task.status === 'em_andamento'
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : 'bg-gray-100 text-gray-700 border-gray-200'
                  }`}
                >
                  {task.status === 'concluida'
                    ? 'Concluída'
                    : task.status === 'em_andamento'
                    ? 'Em Andamento'
                    : 'Pendente'}
                </span>

                <span className="inline-flex items-center gap-1 text-[11px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded font-medium border border-blue-100">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Modo Administrador</span>
                </span>

                {task.status === 'concluida' && (task.completedByAdmin || task.completed_by_admin || task.finalizada_por_admin) && (
                  <span
                    className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-[#004691] border border-blue-300 shadow-2xs"
                    title="Esta tarefa foi finalizada por um Administrador"
                  >
                    <ShieldCheck className="w-3 h-3 text-[#004691]" />
                    Finalizada por Admin
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('Tem certeza que deseja excluir esta ação?')) {
                      onDeleteTask(task.id);
                      onClose();
                    }
                  }}
                  className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                  title="Excluir ação"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Corpo com Scroll do Admin */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Título da Ação */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
                  Nome da Ação
                </label>
                <input
                  type="text"
                  value={task.title}
                  onChange={(e) => handleFieldChange('title', e.target.value)}
                  className="w-full text-lg font-bold text-gray-900 border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none"
                />
              </div>

              {/* Descrição */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
                  Descrição detalhada
                </label>
                <textarea
                  rows={3}
                  value={task.description || ''}
                  onChange={(e) => handleFieldChange('description', e.target.value)}
                  placeholder="Adicione detalhes, critérios de aceitação e instruções..."
                  className="w-full text-sm text-gray-700 border border-gray-200 rounded-lg p-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none"
                />
              </div>

              {/* Grid de Atributos Estruturais */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50/70 p-4 rounded-xl border border-gray-200">
                {/* Status */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Status da Tarefa
                  </label>
                  <select
                    value={task.status}
                    onChange={(e) => handleStatusChange(e.target.value as TaskStatus)}
                    className="w-full text-xs font-medium bg-white border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-blue-600 cursor-pointer"
                  >
                    <option value="pendente">Pendente</option>
                    <option value="em_andamento">Em Andamento</option>
                    <option value="concluida">Concluída</option>
                  </select>
                </div>

                {/* Prioridade */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Prioridade
                  </label>
                  <select
                    value={task.priority}
                    onChange={(e) => handleFieldChange('priority', e.target.value as Priority)}
                    className="w-full text-xs font-medium bg-white border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-blue-600 cursor-pointer"
                  >
                    <option value="Urgente">Urgente</option>
                    <option value="Alta">Alta</option>
                    <option value="Média">Média</option>
                    <option value="Baixa">Baixa</option>
                  </select>
                </div>

                {/* Feedback de Conclusão por Administrador no formulário do Admin */}
                {task.status === 'concluida' && (task.completedByAdmin || task.completed_by_admin || task.finalizada_por_admin) && (
                  <div className="col-span-full flex items-center gap-2 p-2.5 rounded-lg bg-blue-50 border border-blue-200 text-xs text-[#004691]">
                    <ShieldCheck className="w-4 h-4 text-[#004691] shrink-0" />
                    <span>Rastreabilidade ativada: Esta ação foi registrada como <strong>Finalizada por um Administrador</strong>.</span>
                  </div>
                )}

                {/* Recorrência */}
                <div className={task.recurrence === 'Personalizado' ? 'sm:col-span-2' : ''}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Recorrência
                  </label>
                  <select
                    value={task.recurrence || 'Nenhuma'}
                    onChange={(e) => {
                      const val = e.target.value as Recurrence;
                      const currentDays =
                        task.recurrenceDays && task.recurrenceDays.length > 0
                          ? task.recurrenceDays
                          : ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'];
                      onUpdateTask({
                        ...task,
                        recurrence: val,
                        recurrenceDays: val === 'Personalizado' ? currentDays : task.recurrenceDays,
                      });
                    }}
                    className="w-full text-xs font-medium bg-white border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-blue-600 cursor-pointer"
                  >
                    <option value="Nenhuma">Nenhuma (Única vez)</option>
                    <option value="Segunda a Sexta">Segunda a Sexta (Dias Úteis)</option>
                    <option value="Diariamente">Diariamente</option>
                    <option value="Semanalmente">Semanalmente</option>
                    <option value="Mensalmente">Mensalmente</option>
                    <option value="Personalizado">Personalizado</option>
                  </select>

                  {task.recurrence === 'Personalizado' && (
                    <div className="flex items-center justify-between flex-wrap gap-2 pt-2 px-1">
                      {WEEK_DAYS.map((day) => {
                        const currentDays = task.recurrenceDays || [];
                        const isChecked = currentDays.includes(day);
                        return (
                          <label
                            key={day}
                            className="flex items-center gap-1.5 text-xs text-gray-800 font-medium cursor-pointer select-none hover:text-[#004691]"
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                const newDays = isChecked
                                  ? currentDays.filter((d) => d !== day)
                                  : [...currentDays, day];
                                onUpdateTask({
                                  ...task,
                                  recurrenceDays: newDays,
                                });
                              }}
                              className="w-4 h-4 rounded border-gray-400 text-[#004691] focus:ring-[#004691] cursor-pointer accent-[#004691]"
                            />
                            <span>{day}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Bucket / Categoria */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Bucket / Categoria
                  </label>
                  <select
                    value={task.bucket}
                    onChange={(e) => handleFieldChange('bucket', e.target.value)}
                    className="w-full text-xs font-medium bg-white border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-blue-600 cursor-pointer"
                  >
                    {buckets.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Atribuição de Múltiplos Responsáveis */}
                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-gray-700">
                      Responsáveis da Equipe{' '}
                      {assigneeIds.length > 0 && `(${assigneeIds.length} atribuído${assigneeIds.length > 1 ? 's' : ''})`}
                    </label>
                    {assigneeIds.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          onUpdateTask({
                            ...task,
                            assignedTo: null,
                            assignedToIds: [],
                          });
                        }}
                        className="text-[11px] text-rose-600 hover:text-rose-800 font-medium cursor-pointer"
                      >
                        Desmarcar todos
                      </button>
                    )}
                  </div>

                  <div className="p-2.5 bg-gray-50/80 border border-gray-200 rounded-lg max-h-40 overflow-y-auto space-y-1.5">
                    {teamMembers.map((m) => {
                      const isSelected = assigneeIds.includes(m.id);

                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            const newAssignees = isSelected
                              ? assigneeIds.filter((id) => id !== m.id)
                              : [...assigneeIds, m.id];
                            onUpdateTask({
                              ...task,
                              assignedTo: newAssignees[0] || null,
                              assignedToIds: newAssignees,
                            });
                          }}
                          className={`w-full flex items-center justify-between p-2 rounded-lg text-left text-xs transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-blue-50 border border-blue-200 text-blue-900 font-semibold shadow-2xs'
                              : 'bg-white border border-gray-200/80 text-gray-700 hover:bg-gray-100/70'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div
                              className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 shadow-2xs"
                              style={{ backgroundColor: m.color || '#004691' }}
                            >
                              {m.avatar || m.name.charAt(0)}
                            </div>
                            <div className="truncate">
                              <span>{m.name}</span>
                              <span className="text-[10px] font-normal text-gray-500 ml-1.5">
                                ({m.role === 'admin' ? 'Admin' : 'Membro'}) - {m.email}
                              </span>
                            </div>
                          </div>

                          <div
                            className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] shrink-0 transition-colors ${
                              isSelected
                                ? 'bg-[#004691] border-[#004691] text-white'
                                : 'border-gray-300 bg-white'
                            }`}
                          >
                            {isSelected && '✓'}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Datas */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Data de Início
                  </label>
                  <input
                    type="date"
                    value={task.startDate || ''}
                    onChange={(e) => handleFieldChange('startDate', e.target.value)}
                    className="w-full text-xs bg-white border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Data de Término
                  </label>
                  <input
                    type="date"
                    value={task.endDate || ''}
                    onChange={(e) => handleFieldChange('endDate', e.target.value)}
                    className="w-full text-xs bg-white border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-blue-600"
                  />
                </div>

                {/* Data Agendada no Calendário */}
                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-gray-600">
                      Agendamento no Calendário
                    </label>
                    {task.scheduledDate && (
                      <button
                        type="button"
                        onClick={() => handleFieldChange('scheduledDate', null)}
                        className="text-[11px] text-amber-700 hover:underline cursor-pointer"
                      >
                        Mover para Fila Não Iniciadas
                      </button>
                    )}
                  </div>
                  <input
                    type="date"
                    value={task.scheduledDate || ''}
                    onChange={(e) =>
                      handleFieldChange('scheduledDate', e.target.value || null)
                    }
                    className="w-full text-xs bg-white border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-blue-600"
                  />
                  {!task.scheduledDate && (
                    <p className="text-[11px] text-amber-600 mt-1">
                      Esta ação está na <strong>Fila de Tarefas Não Iniciadas</strong>.
                    </p>
                  )}
                </div>
              </div>

              {/* SEÇÃO: PROGRESSO INDIVIDUAL DOS RESPONSÁVEIS (ADMIN) */}
              <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-700" />
                    <h3 className="text-xs font-bold text-gray-900">
                      Progresso Individual por Responsável ({completedMembersCount}/{totalMembersCount})
                    </h3>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-500">
                    Ação rápida para finalizar ou reabrir parte de cada usuário
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {assignedMemberList.map((m, idx) => {
                    const sub = getMemberSubmission(m.id);
                    const isCompleted = sub.completed;
                    const isSelected = selectedMemberId === m.id;

                    return (
                      <div
                        key={m.id}
                        onClick={() => setSelectedMemberId(m.id)}
                        className={`p-3 rounded-lg border flex flex-col justify-between gap-2.5 transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-blue-50/80 border-blue-300 ring-1 ring-blue-500/20 shadow-2xs'
                            : 'bg-slate-50/60 border-slate-200 hover:bg-slate-100/70 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            {isCompleted ? (
                              <div className="w-5 h-5 rounded-full bg-[#22c55e] flex items-center justify-center text-white shrink-0 shadow-2xs">
                                <Check className="w-3.5 h-3.5 stroke-[3]" />
                              </div>
                            ) : (
                              <div className="w-5 h-5 rounded-full border-2 border-slate-700 bg-white shrink-0 shadow-2xs" />
                            )}
                            <div className="truncate">
                              <div className="text-xs font-bold text-slate-800 truncate">
                                {m.name || `Usuário ${idx + 1}`}
                              </div>
                              <span className="text-[10.5px] text-slate-500 truncate block">
                                {m.email || (isCompleted ? 'Concluído' : 'Pendente')}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded shrink-0 ${
                                isCompleted
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200/60'
                                  : 'bg-slate-200 text-slate-700'
                              }`}
                            >
                              {isCompleted ? 'Concluído' : 'Pendente'}
                            </span>

                            {isCompleted &&
                              (sub.completedByAdmin ||
                                sub.completed_by_admin ||
                                sub.finalizada_por_admin) && (
                                <span
                                  className="inline-flex items-center gap-1 text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-[#004691] border border-blue-200/90 shadow-2xs shrink-0"
                                  title="Esta parte foi finalizada diretamente por um Administrador"
                                >
                                  <ShieldCheck className="w-2.5 h-2.5 text-[#004691]" />
                                  <span>Admin</span>
                                </span>
                              )}
                          </div>
                        </div>

                        {/* Botão de Ação Rápida do Administrador */}
                        <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between flex-wrap gap-1">
                          <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                            {isCompleted ? (
                              <>
                                <span className="text-slate-400">
                                  {sub.completedAt
                                    ? `Concluído em ${new Date(sub.completedAt).toLocaleDateString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
                                    : 'Finalizado'}
                                </span>
                                {(sub.completedByAdmin ||
                                  sub.completed_by_admin ||
                                  sub.finalizada_por_admin) && (
                                  <span className="inline-flex items-center gap-0.5 text-[#004691] font-semibold bg-blue-50/80 px-1 py-0.2 rounded border border-blue-200/60">
                                    <ShieldCheck className="w-2.5 h-2.5 text-[#004691]" />
                                    <span>Por Admin</span>
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className="text-slate-400">Aguardando preenchimento</span>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={(e) => handleAdminToggleMemberCompletion(m.id, e)}
                            className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all flex items-center gap-1 cursor-pointer ${
                              isCompleted
                                ? 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-300'
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs font-bold'
                            }`}
                            title={
                              isCompleted
                                ? `Reabrir a parte de ${m.name || 'Usuário'}`
                                : `Finalizar imediatamente a parte de ${m.name || 'Usuário'}`
                            }
                          >
                            {isCompleted ? (
                              <>
                                <RotateCcw className="w-3 h-3 text-slate-500" />
                                <span>Reabrir</span>
                              </>
                            ) : (
                              <>
                                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                                <span>Finalizar parte</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Seção: Configuração e Respostas dos Campos Customizáveis */}
              <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Sliders className="w-4 h-4 text-blue-700" />
                    <h3 className="text-xs font-bold text-gray-900">
                      Campos de Formulário Customizáveis & Métricas
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAddingField(!isAddingField)}
                    className="text-xs text-blue-700 hover:text-blue-800 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{isAddingField ? 'Fechar' : 'Novo Campo'}</span>
                  </button>
                </div>

                {/* Form para adicionar novo campo */}
                {isAddingField && (
                  <div className="p-3 bg-white border border-blue-200 rounded-lg space-y-2">
                    <input
                      type="text"
                      placeholder="Nome do campo (ex: Total de Contatos na Base)"
                      value={fieldLabel}
                      onChange={(e) => setFieldLabel(e.target.value)}
                      className="w-full text-xs border border-gray-300 rounded px-2.5 py-1.5 outline-none focus:border-blue-600"
                    />
                    <div className="flex items-center justify-between pt-1">
                      <select
                        value={fieldType}
                        onChange={(e) => setFieldType(e.target.value as 'number' | 'text')}
                        className="text-xs border border-gray-300 rounded px-2 py-1 bg-white cursor-pointer"
                      >
                        <option value="number">Numérico</option>
                        <option value="text">Texto</option>
                      </select>

                      <label className="flex items-center gap-1 text-xs text-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={fieldRequired}
                          onChange={(e) => setFieldRequired(e.target.checked)}
                          className="rounded text-blue-600 cursor-pointer"
                        />
                        <span>Obrigatório</span>
                      </label>

                      <button
                        type="button"
                        onClick={handleAddAdminCustomField}
                        disabled={!fieldLabel.trim()}
                        className="px-3 py-1 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50 cursor-pointer"
                      >
                        Salvar
                      </button>
                    </div>
                  </div>
                )}

                {/* Indicador de qual membro está sendo inspecionado */}
                <div className="px-3 py-2 bg-white rounded-lg border border-blue-200 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">Inspecionando respostas de:</span>
                    <strong className="text-slate-900 font-bold">
                      {selectedMemberObj?.name || 'Usuário'}
                    </strong>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleAdminToggleMemberCompletion(selectedMemberId)}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all flex items-center gap-1 cursor-pointer ${
                      isCurrentSelectedCompleted
                        ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs'
                    }`}
                  >
                    {isCurrentSelectedCompleted ? (
                      <>
                        <RotateCcw className="w-3 h-3 text-slate-500" />
                        <span>Reabrir parte deste membro</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>Concluir parte deste membro</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Lista de Campos com Respostas Registradas */}
                {task.customFields && task.customFields.length > 0 ? (
                  <div className="space-y-2">
                    {task.customFields.map((f) => {
                      const userSub = getMemberSubmission(selectedMemberId);
                      const response = userSub.values?.[f.id];

                      return (
                        <div
                          key={f.id}
                          className="p-2.5 bg-white border border-gray-200 rounded-lg flex items-center justify-between text-xs"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-gray-800">{f.label}</span>
                              {f.required && (
                                <span className="text-[9px] bg-red-50 text-red-700 border border-red-200 px-1.5 py-0.2 rounded font-bold">
                                  Obrigatório
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-gray-500 mt-0.5">
                              Preenchido por {selectedMemberObj?.name}:{' '}
                              {response !== undefined && response !== '' ? (
                                <strong className="text-gray-900 font-bold">
                                  {response}
                                </strong>
                              ) : (
                                <span className="italic text-gray-400">
                                  Ainda não preenchido por este membro
                                </span>
                              )}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveAdminCustomField(f.id)}
                            className="p-1 text-gray-400 hover:text-red-600 rounded transition-colors cursor-pointer"
                            title="Remover este campo da ação"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-[11px] text-gray-500 italic">
                    Nenhum campo de formulário configurado nesta ação.
                  </p>
                )}

                {/* Card de Observação do Responsável no Painel Admin */}
                <div className="p-3 bg-white border border-gray-200 rounded-lg space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-gray-800 flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
                      Observação de {selectedMemberObj?.name || 'Responsável'}
                    </span>
                    <span className="text-[10px] text-gray-400">Opcional</span>
                  </div>

                  {(() => {
                    const sub = getMemberSubmission(selectedMemberId);
                    const obs = sub.observacao !== undefined ? sub.observacao : sub.observation;

                    return obs ? (
                      <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-md text-slate-800 text-xs whitespace-pre-wrap">
                        {obs}
                      </div>
                    ) : (
                      <p className="text-[11px] text-gray-400 italic">
                        Nenhuma observação registrada por este membro.
                      </p>
                    );
                  })()}
                </div>
              </div>

              {/* TAGs */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                  TAGs da Ação
                </label>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  {task.tags?.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-gray-100 text-gray-800 text-xs font-medium border border-gray-200"
                    >
                      <Tag className="w-3 h-3 text-gray-400" />
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="text-gray-400 hover:text-red-600 ml-0.5 cursor-pointer"
                      >
                        &times;
                      </button>
                    </span>
                  ))}
                </div>

                {/* Sugestões rápidas de tags cadastradas */}
                {tagBuckets.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1 my-2">
                    <span className="text-[10px] text-zinc-400 mr-1">Sugestões:</span>
                    {tagBuckets.map((tb) => {
                      const isSelected = task.tags?.includes(tb.nome);
                      return (
                        <button
                          key={tb.id}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              handleRemoveTag(tb.nome);
                            } else {
                              const updatedTags = [...(task.tags || []), tb.nome];
                              handleFieldChange('tags', updatedTags);
                            }
                          }}
                          className={`text-[10px] px-2 py-0.5 rounded-full border font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                            isSelected
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50'
                          }`}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: tb.cor || '#003067' }}
                          />
                          <span>{tb.nome}</span>
                          {isSelected && <span>✓</span>}
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="text"
                    placeholder="Nova TAG (ex: Urgente, Q3, Cliente X)"
                    value={newTagInput}
                    onChange={(e) => setNewTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTag();
                      }
                    }}
                    className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 flex-1 outline-none focus:border-blue-600"
                  />
                  <button
                    type="button"
                    onClick={handleAddTag}
                    className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
                  >
                    Adicionar
                  </button>
                </div>
              </div>

              {/* Chat Integrado da Equipe (Apenas Admin) */}
              <div className="pt-4 border-t border-gray-200">
                <div className="flex items-center gap-2 mb-4">
                  <MessageSquare className="w-4 h-4 text-blue-600" />
                  <h3 className="text-sm font-semibold text-gray-900">
                    Histórico e Chat da Equipe ({task.comments?.length ?? 0})
                  </h3>
                </div>

                {/* Lista de Comentários */}
                <div className="space-y-3 mb-4 max-h-60 overflow-y-auto pr-1">
                  {!task.comments || task.comments.length === 0 ? (
                    <div className="text-center py-6 bg-gray-50 rounded-lg border border-dashed border-gray-200 text-gray-400 text-xs">
                      Nenhum comentário registrado ainda.
                    </div>
                  ) : (
                    task.comments.map((comm) => (
                      <div
                        key={comm.id}
                        className="bg-gray-50 rounded-lg p-3 border border-gray-100"
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                comm.authorColor || 'bg-blue-600 text-white'
                              }`}
                            >
                              {comm.authorInitials || 'U'}
                            </div>
                            <span className="text-xs font-semibold text-gray-800">
                              {comm.authorName}
                            </span>
                          </div>
                          <span className="text-[10px] text-gray-400">{comm.createdAt}</span>
                        </div>
                        <p className="text-xs text-gray-700 leading-relaxed pl-7 break-words">
                          {comm.text}
                        </p>
                      </div>
                    ))
                  )}
                </div>

                {/* Input para Novo Comentário */}
                <form onSubmit={handleAddComment} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Escreva uma observação ou mensagem para o histórico..."
                    value={newCommentText}
                    onChange={(e) => setNewCommentText(e.target.value)}
                    className="flex-1 text-xs border border-gray-200 rounded-lg px-3 py-2.5 outline-none focus:border-blue-600"
                  />
                  <button
                    type="submit"
                    disabled={!newCommentText.trim()}
                    className="px-4 py-2.5 bg-institucional text-white text-xs font-medium rounded-lg hover:opacity-95 transition-all shadow-xs disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Enviar</span>
                  </button>
                </form>
              </div>
            </div>

            {/* Rodapé do Drawer Admin */}
            <div className="px-6 py-3.5 border-t border-gray-200 bg-gray-50 flex items-center justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
              >
                Fechar Painel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


// Wrapper condicional: o componente que contém hooks só é montado quando
// há uma tarefa aberta, evitando violações da Rules of Hooks.
export default function TaskDetailModal(props: TaskDetailModalProps) {
  if (!props.isOpen || !props.task) return null;
  return <TaskDetailModalContent key={props.task.id} {...props} />;
}
