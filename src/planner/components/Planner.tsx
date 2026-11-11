import React, { useState, useMemo, useEffect, useCallback } from 'react';
import '../planner.css';
import { ChevronLeft, ChevronRight, CheckCircle2, Inbox, RefreshCw, Plus, SlidersHorizontal } from 'lucide-react';
import { Task, TeamMember, UserRole, CustomFieldValue, TagBucket, UserTaskSubmission, TaskModel } from '../types.ts';
import { taskModelService, TaskModelInput, ruleLabel } from '../services/taskModelService.ts';
import TaskModelModal from './TaskModelModal.tsx';
import TaskCatalogView from './TaskCatalogView.tsx';
import { getWeekDates, formatWeekInterval, getMonthGrid, MONTH_NAMES_PT, formatISO } from '../utils/dateUtils.ts';
import { isUserAssignedToTask } from '../utils/taskFilterUtils.ts';
import { taskService, mapDbRowToTask, subscribeTaskMutations } from '../services/taskService.ts';
import { userService, UserProfile } from '../services/userService.ts';
import { tagService } from '../services/tagService.ts';
import { supabase } from '../../lib/supabase';
import WeeklyView from './WeeklyView.tsx';
import MonthlyView from './MonthlyView.tsx';
import TaskDetailModal from './TaskDetailModal.tsx';
import TaskCompletionModal from './TaskCompletionModal.tsx';
import LeftSidebar, { SidebarTab, NavFilter } from './LeftSidebar.tsx';
import TeamManagementView from './TeamManagementView.tsx';
import WeeklyBalanceView from './WeeklyBalanceView.tsx';
import TagManagementView from './TagManagementView.tsx';
import UnscheduledRightSidebar from './UnscheduledRightSidebar.tsx';

export type PlannerSection = 'calendar' | 'queue' | 'my_tasks' | 'tasks' | 'tags' | 'summary';

interface PlannerProps {
  user?: {
    id?: string;
    email?: string;
    user_metadata?: { full_name?: string; nome?: string };
    [key: string]: any;
  };
  /** Papel de visualização controlado pelo seletor global do R9 Hub. */
  viewRole?: 'admin' | 'membro';
  /** Navegação controlada pelo menu lateral principal do R9 Hub. */
  externalNavigation?: boolean;
  section?: PlannerSection;
  onSectionChange?: (section: PlannerSection) => void;
}

export default function Planner({ user, viewRole: globalViewRole, externalNavigation = false, section = 'calendar', onSectionChange }: PlannerProps) {
  // Estado das Tarefas, Tags/Categorias e Membros reais do Supabase
  const [tasks, setTasks] = useState<Task[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [tagBuckets, setTagBuckets] = useState<TagBucket[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);

  // RBAC: Perfil real do usuário logado consultado na tabela 'perfis' do Supabase
  const [realUserRole, setRealUserRole] = useState<'admin' | 'membro'>('membro');
  // Modo de visualização para simulação e validação (Exclusivo para Administrador)
  const [simulatedRole, setSimulatedRole] = useState<UserRole>(globalViewRole === 'membro' ? 'member' : 'admin');

  // O seletor global do R9 Hub é a fonte única para alternar Admin/Membro.
  useEffect(() => {
    if (globalViewRole) setSimulatedRole(globalViewRole === 'membro' ? 'member' : 'admin');
  }, [globalViewRole]);

  // Papel efetivo ativo no momento
  const isRealAdmin = realUserRole === 'admin';
  const userRole: UserRole = isRealAdmin ? simulatedRole : 'member';

  // Tela Ativa: 'planner', 'team_management', 'executive_summary' ou 'tag_management'
  const [activeView, setActiveView] = useState<'planner' | 'team_management' | 'executive_summary' | 'tag_management' | 'task_catalog'>('planner');

  // Cadastro de tarefas (tarefas_modelo): o que é cada tarefa e quando se repete
  const [models, setModels] = useState<TaskModel[]>([]);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [modelModal, setModelModal] = useState<{ open: boolean; model: TaskModel | null; defaultDate: string | null }>({ open: false, model: null, defaultDate: null });
  const modelById = useMemo(() => new Map(models.map((m) => [m.id, m])), [models]);

  const loadModels = useCallback(async () => {
    const { data, error, missingTable } = await taskModelService.list();
    setModels(data);
    setModelsError(error ? (missingTable ? error.message : `Não foi possível carregar o cadastro: ${error.message}`) : null);
    setModelsLoading(false);
  }, []);

  useEffect(() => {
    loadModels();
    const channel = supabase
      .channel('tarefas-modelo-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tarefas_modelo' }, () => loadModels())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadModels]);

  // Proteção de Rota: se não for admin ativo, bloqueia telas administrativas e redireciona para o planner
  useEffect(() => {
    if (userRole !== 'admin' && (activeView === 'team_management' || activeView === 'tag_management')) {
      setActiveView('planner');
      if (externalNavigation) onSectionChange?.('calendar');
    }
  }, [userRole, activeView, externalNavigation, onSectionChange]);

  // Sincronizar membros da equipe com a tabela perfis do Supabase
  const handleProfilesUpdated = useCallback((profiles: UserProfile[]) => {
    if (!profiles || profiles.length === 0) {
      setTeamMembers([]);
      return;
    }
    const mappedMembers: TeamMember[] = profiles.map((p) => ({
      id: p.id,
      name: p.nome,
      email: p.email,
      role: p.funcao === 'admin' ? 'admin' : 'member',
      avatarColor: p.avatarColor || 'bg-blue-600 text-white',
      initials: p.initials || p.nome.substring(0, 2).toUpperCase(),
    }));
    setTeamMembers(mappedMembers);

    // Se o usuário logado estiver na lista de perfis, sincroniza seu papel real da tabela perfis
    if (user?.id || user?.email) {
      const match = mappedMembers.find(
        (m) =>
          (user.id && m.id === user.id) ||
          (user.email && m.email.toLowerCase() === user.email.toLowerCase())
      );
      if (match) {
        const isAdm = match.role === 'admin';
        setRealUserRole(isAdm ? 'admin' : 'membro');
      }
    }
  }, [user]);

  // Carregar perfil real do usuário logado na tabela 'perfis' e lista da equipe
  useEffect(() => {
    let isMounted = true;

    async function loadRoleAndProfiles() {
      try {
        // 1. Busca direta na tabela 'perfis' pelo id do usuário logado
        if (user?.id) {
          const { data: userRecord } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .maybeSingle();

          if (isMounted && userRecord?.role) {
            const rawRole = userRecord.role.toLowerCase();
            const isAdm = rawRole === 'admin' || rawRole === 'administrador';
            setRealUserRole(isAdm ? 'admin' : 'membro');
            if (!globalViewRole) setSimulatedRole(isAdm ? 'admin' : 'member');
          } else if (isMounted && user.email) {
            // Fallback por e-mail se o ID não bater
            const { data: byEmail } = await supabase
              .from('profiles')
              .select('role')
              .eq('email', user.email)
              .maybeSingle();
            if (byEmail?.role) {
              const rawRole = byEmail.role.toLowerCase();
              const isAdm = rawRole === 'admin' || rawRole === 'administrador';
              setRealUserRole(isAdm ? 'admin' : 'membro');
              if (!globalViewRole) setSimulatedRole(isAdm ? 'admin' : 'member');
            }
          }
        } else if (user?.email) {
          const { data: byEmail } = await supabase
            .from('profiles')
            .select('role')
            .eq('email', user.email)
            .maybeSingle();
          if (isMounted && byEmail?.role) {
            const rawRole = byEmail.role.toLowerCase();
            const isAdm = rawRole === 'admin' || rawRole === 'administrador';
            setRealUserRole(isAdm ? 'admin' : 'membro');
            if (!globalViewRole) setSimulatedRole(isAdm ? 'admin' : 'member');
          }
        }

        // 2. Busca lista completa de perfis para a equipe
        const { data: allProfiles } = await userService.fetchProfiles();
        if (isMounted && allProfiles) {
          handleProfilesUpdated(allProfiles);
        }
      } catch {
        // Falha silenciosa
      } finally {
        if (isMounted) {
          }
      }
    }

    loadRoleAndProfiles();

    // Sincronização em tempo real da tabela 'perfis'
    const channel = supabase
      .channel('perfis-role-sync')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
        },
        async () => {
          const { data: userProfile } = await userService.fetchUserProfile(user?.id, user?.email);
          if (isMounted && userProfile) {
            const isAdm = userProfile.funcao === 'admin';
            setRealUserRole(isAdm ? 'admin' : 'membro');
          }
          const { data: allProfiles } = await userService.fetchProfiles();
          if (isMounted && allProfiles) {
            handleProfilesUpdated(allProfiles);
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [user?.id, user?.email, handleProfilesUpdated]);

  const currentUser: TeamMember = useMemo(() => {
    const found = teamMembers.find(
      (m) =>
        (user?.id && m.id === user.id) ||
        (user?.email && m.email.toLowerCase() === user.email.toLowerCase())
    );

    if (found) {
      return found;
    }

    const fallbackName =
      user?.user_metadata?.full_name ||
      user?.user_metadata?.nome ||
      (user?.email ? user.email.split('@')[0] : 'Usuário');

    return {
      id: user?.id || '',
      name: fallbackName,
      email: user?.email || '',
      role: userRole,
      avatarColor: 'bg-blue-600 text-white',
      initials: fallbackName ? fallbackName.substring(0, 2).toUpperCase() : 'U',
    };
  }, [user, teamMembers, userRole]);

  // Carregamento Inicial (Fetch) do Supabase estritamente da tabela tarefas
  const loadTasksFromSupabase = useCallback(async (isInitial = false) => {
    if (isInitial) setIsLoadingTasks(true);

    try {
      // Garante o horizonte de 8 semanas das tarefas recorrentes (o banco também faz isso todo dia).
      if (isInitial) await taskModelService.ensureHorizon();
      const { data, error } = await taskService.fetchTasks();

      if (!error) {
        let taskList = data || [];
        if (userRole === 'admin') {
          const generated = await taskService.ensureFutureRecurringOccurrences(taskList);
          if (generated.length) taskList = [...generated, ...taskList];
        }
        setTasks(taskList);

        // Atualizar selectedTask se o modal estiver aberto para manter valores e status ao vivo
        setSelectedTask((curr) => {
          if (!curr) return null;
          const matched = taskList.find((t) => t.id === curr.id);
          return matched || curr;
        });
      }
    } catch {
      // Falha tratada sem estado visual de conexão; a lista permanece com os dados atuais.
    } finally {
      setIsLoadingTasks(false);
    }
  }, [userRole]);

  useEffect(() => {
    loadTasksFromSupabase(true);

    // 1. Canal Realtime Postgres Changes do Supabase para alterações diretas no banco
    const postgresChannel = supabase
      .channel('tarefas-planner-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tarefas',
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newTask = mapDbRowToTask(payload.new);
            setTasks((prev) => {
              if (prev.some((t) => t.id === newTask.id)) return prev;
              return [newTask, ...prev];
            });
          } else if (payload.eventType === 'UPDATE') {
            const updatedTask = mapDbRowToTask(payload.new);
            setTasks((prev) =>
              prev.map((t) => (t.id === updatedTask.id ? updatedTask : t))
            );
            setSelectedTask((curr) =>
              curr?.id === updatedTask.id ? updatedTask : curr
            );
          } else if (payload.eventType === 'DELETE') {
            const deletedId = String(payload.old.id);
            setTasks((prev) => prev.filter((t) => t.id !== deletedId));
            setSelectedTask((curr) => (curr?.id === deletedId ? null : curr));
          }
        }
      )
      .subscribe();

    // 2. Canal Broadcast em tempo real para sincronização instantânea entre abas e usuários
    const handleBroadcastEvent = (eventPayload: any) => {
      const payload = eventPayload?.payload;
      if (!payload) return;

      if (payload.action === 'deleted' && payload.taskId) {
        setTasks((prev) => prev.filter((t) => t.id !== payload.taskId));
        setSelectedTask((curr) => (curr?.id === payload.taskId ? null : curr));
      } else if (payload.task) {
        const incomingTask = payload.task as Task;
        setTasks((prev) => {
          const exists = prev.some((t) => t.id === incomingTask.id);
          if (exists) {
            return prev.map((t) => (t.id === incomingTask.id ? incomingTask : t));
          }
          return [incomingTask, ...prev];
        });
        setSelectedTask((curr) =>
          curr?.id === incomingTask.id ? incomingTask : curr
        );
      } else {
        // Atualização com recarga em background
        loadTasksFromSupabase(false);
      }
    };

    const unsubscribeTaskMutations = subscribeTaskMutations(handleBroadcastEvent);

    // 3. Heartbeat elástico de consistência (a cada 60s) apenas se a aba estiver ativa e visível
    const heartbeatInterval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        loadTasksFromSupabase(false);
      }
    }, 60000);

    // 4. Atualização imediata ao focar na janela ou voltar para a aba
    const handleFocus = () => {
      loadTasksFromSupabase(false);
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadTasksFromSupabase(false);
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      // Remove apenas o listener desta tela; o canal compartilhado continua disponível para envios.
      unsubscribeTaskMutations();
      supabase.removeChannel(postgresChannel);
      clearInterval(heartbeatInterval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loadTasksFromSupabase]);

  // Carregamento e sincronização em tempo real das Tags/Categorias (tabela tags_bucket)
  const loadTagsFromSupabase = useCallback(async () => {
    try {
      const { data } = await tagService.fetchTags();
      if (data) {
        setTagBuckets(data);
      }
    } catch {
      // Silencioso
    }
  }, []);

  useEffect(() => {
    loadTagsFromSupabase();

    const channel = supabase
      .channel('tags-bucket-planner-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tags_bucket',
        },
        () => {
          loadTagsFromSupabase();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadTagsFromSupabase]);

  // Visualização de Alto Nível: 'week' ou 'month'
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');

  // Data atual real do sistema do cliente no fuso local (dinâmica)
  const [todayDate, setTodayDate] = useState<Date>(() => new Date());
  const todayISO = useMemo(() => formatISO(todayDate), [todayDate]);

  // Atualizar data atual automaticamente à meia-noite ou quando a janela do navegador ganha foco
  useEffect(() => {
    const updateToday = () => {
      const now = new Date();
      if (formatISO(now) !== formatISO(todayDate)) {
        setTodayDate(now);
      }
    };
    const interval = setInterval(updateToday, 30000); // 30 segundos
    window.addEventListener('focus', updateToday);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', updateToday);
    };
  }, [todayDate]);

  // Data de Navegação de Referência (inicia rigorosamente na data de hoje real do cliente)
  const [currentReferenceDate, setCurrentReferenceDate] = useState<Date>(() => new Date());

  // Modais
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Modal de Conclusão Obrigatória (quando a ação tem campos não preenchidos)
  const [completingTask, setCompletingTask] = useState<Task | null>(null);
  const [isCompletionModalOpen, setIsCompletionModalOpen] = useState(false);

  // Notificação Toast para feedback de recorrência e ações
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Estado de Arrastar e Soltar
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  // Estados de Controle do Menu Lateral Esquerdo Unificado
  const [isLeftSidebarCollapsed, setIsLeftSidebarCollapsed] = useState(false);
  const [isQueueSidebarCollapsed, setIsQueueSidebarCollapsed] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('planner');

  // Filtros de Produtividade
  const [navFilter, setNavFilter] = useState<NavFilter>('all');
  const [selectedBucket, setSelectedBucket] = useState<string | null>(null);
  const [taskSearch, setTaskSearch] = useState('');
  const [selectedAssignee, setSelectedAssignee] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  // Fila (tarefas sem data) como painel lateral do calendário
  const [showQueue, setShowQueue] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // No modo integrado, a navegação é controlada pela sidebar principal do R9 Hub.
  useEffect(() => {
    if (!externalNavigation) return;
    if (section === 'summary') {
      setActiveView('executive_summary');
      return;
    }
    if (section === 'tags') {
      setActiveView('tag_management');
      return;
    }
    if (section === 'tasks') {
      setActiveView('task_catalog');
      return;
    }
    setActiveView('planner');
    if (section === 'queue') {
      // atalho antigo: abre o calendário com a fila aberta
      setShowQueue(true);
      setIsQueueSidebarCollapsed(false);
      setSidebarTab('planner');
      setNavFilter('all');
    } else if (section === 'my_tasks') {
      setSidebarTab('planner');
      setNavFilter('my_tasks');
    } else {
      setSidebarTab('planner');
      setNavFilter('all');
    }
  }, [externalNavigation, section, userRole, onSectionChange]);

  const goToCalendar = useCallback(() => {
    setActiveView('planner');
    setSidebarTab('planner');
    setNavFilter('all');
    onSectionChange?.('calendar');
  }, [onSectionChange]);

  // Lista única de Buckets / Categorias (tabela tags_bucket + tarefas)
  const allBuckets = useMemo(() => {
    const bucketsSet = new Set<string>();
    // Prioriza tags cadastradas no tags_bucket
    tagBuckets.forEach((tb) => {
      if (tb.nome && tb.nome.trim()) bucketsSet.add(tb.nome.trim());
    });
    // Adiciona buckets das tarefas existentes
    tasks.forEach((t) => {
      if (t.bucket && t.bucket.trim()) bucketsSet.add(t.bucket.trim());
    });
    // Fallback padrão se vazio
    if (bucketsSet.size === 0) {
      ['Operacional', 'Financeiro', 'Tecnologia', 'Marketing', 'Estratégico'].forEach((b) =>
        bucketsSet.add(b)
      );
    }
    return Array.from(bucketsSet);
  }, [tasks, tagBuckets]);

  // Contagens para a barra de navegação
  const navCounts = useMemo(() => {
    const isUserTask = (t: Task) =>
      isUserAssignedToTask(t, currentUser, user, teamMembers);

    // "Meu dia" estritamente filtra tarefas agendadas para hoje nas quais o usuário logado é responsável
    const myDayCount = tasks.filter((t) => {
      const isToday = t.scheduledDate === todayISO;
      return (isToday || Boolean(t.scheduledDate && t.scheduledDate < todayISO && t.status !== 'concluida')) && isUserTask(t);
    }).length;

    const myTasksCount = tasks.filter(isUserTask).length;
    const allCount = tasks.length;
    const urgentCount = tasks.filter((t) => t.priority === 'Urgente' || t.priority === 'Alta').length;
    const unscheduledCount = tasks.filter((t) => !t.scheduledDate).length;

    return {
      myDay: myDayCount,
      myTasks: myTasksCount,
      all: allCount,
      urgent: urgentCount,
      unscheduled: unscheduledCount,
    };
  }, [tasks, todayISO, currentUser, user, teamMembers]);

  // Cálculo das datas da semana atual
  const weekDates = useMemo(
    () => getWeekDates(currentReferenceDate),
    [currentReferenceDate]
  );

  // Cálculo da grade do mês atual
  const monthCells = useMemo(
    () =>
      getMonthGrid(
        currentReferenceDate.getFullYear(),
        currentReferenceDate.getMonth(),
        todayDate
      ),
    [currentReferenceDate, todayDate]
  );

  // Filtragem de tarefas exibidas na grade do calendário
  const displayedTasks = useMemo(() => {
    return tasks.filter((task) => {
      // Filtro por Bucket / Categoria
      if (selectedBucket && task.bucket !== selectedBucket) {
        return false;
      }

      const isAssigned = isUserAssignedToTask(task, currentUser, user, teamMembers);

      // Filtro por Navegação (Meu Dia / Minhas Tarefas / Urgente / Planejador Geral)
      if (navFilter === 'my_tasks') {
        if (!isAssigned) return false;
      } else if (navFilter === 'my_day') {
        // "Meu dia" exibe estritamente apenas as tarefas agendadas para hoje E atribuídas ao usuário logado
        if ((!task.scheduledDate || task.scheduledDate > todayISO || task.status === 'concluida') || !isAssigned) return false;
      } else if (navFilter === 'urgent') {
        if (task.priority !== 'Urgente' && task.priority !== 'Alta') return false;
      }

      if (taskSearch && !`${task.title} ${task.description ?? ''} ${task.bucket}`.toLocaleLowerCase('pt-BR').includes(taskSearch.trim().toLocaleLowerCase('pt-BR'))) return false;
      if (selectedAssignee && !(task.assignedToIds ?? (task.assignedTo ? [task.assignedTo] : [])).includes(selectedAssignee)) return false;
      if (selectedStatus && task.status !== selectedStatus) return false;

      return true;
    });
  }, [tasks, selectedBucket, navFilter, currentUser, user, teamMembers, todayISO, taskSearch, selectedAssignee, selectedStatus]);

  const periodTaskCount = useMemo(() => {
    if (section === 'queue') return displayedTasks.filter((task) => !task.scheduledDate).length;
    const dates = viewMode === 'week'
      ? new Set(weekDates.map(formatISO))
      : new Set(monthCells.map((cell) => cell.dateString));
    return displayedTasks.filter((task) => task.scheduledDate && dates.has(task.scheduledDate)).length;
  }, [section, tasks, viewMode, weekDates, monthCells, displayedTasks]);

  // Navegação de datas (Anterior / Próximo / Hoje)
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

    // Executa a atualização no Supabase com lógica de recorrência e rastreabilidade admin
    const { updatedTask, nextRecurrentTask, error } =
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

    setTasks((prev) => {
      const updatedList = prev.map((t) => (t.id === taskId ? updatedTask : t));
      if (nextRecurrentTask) {
        if (updatedList.some((t) => t.id === nextRecurrentTask.id)) {
          return updatedList;
        }
        return [nextRecurrentTask, ...updatedList];
      }
      return updatedList;
    });

    if (selectedTask && selectedTask.id === taskId) {
      setSelectedTask(updatedTask);
    }

    if (nextRecurrentTask && nextRecurrentTask.scheduledDate) {
      const [, nm, nd] = nextRecurrentTask.scheduledDate.split('-');
      setToastMessage(
        `Tarefa concluída${isActionByAdmin ? ' por Administrador' : ''}! Nova ocorrência inserida no Supabase para ${nd}/${nm} (${targetTask.recurrence}).`
      );
      setTimeout(() => setToastMessage(null), 6000);
    } else {
      setToastMessage(
        `Tarefa "${targetTask.title}" concluída com sucesso${isActionByAdmin ? ' por Administrador' : ''} no Supabase.`
      );
      setTimeout(() => setToastMessage(null), 3000);
    }
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
        : (result.error?.message || 'O Supabase não confirmou a exclusão da tarefa.');
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

  return (
    <div className={`r9-planner-shell ${externalNavigation ? 'h-[calc(100dvh-2rem)] min-h-[620px]' : 'h-[calc(100vh-4rem)] min-h-[620px]'} w-full flex flex-col bg-white overflow-hidden select-none font-sans text-zinc-900 rounded-2xl border border-slate-200 shadow-sm`}>
      {/* Cabeçalho único: título + período à esquerda; visão, filtros, fila e criação à direita */}
      {(() => {
        const isCalendar = activeView === 'planner' && (section === 'calendar' || section === 'my_tasks' || section === 'queue');
        const hidden = externalNavigation && (section === 'summary' || section === 'tags');
        const queueCount = tasks.filter((t) => !t.scheduledDate && t.status !== 'concluida').length;
        const activeFilters = [taskSearch, selectedAssignee, selectedStatus, selectedBucket].filter(Boolean).length;
        const title = section === 'tasks' ? 'Rotina da semana' : section === 'my_tasks' ? 'Minhas tarefas' : 'Calendário';
        if (hidden) return null;
        return (
          <header id="planner-main-header" className="px-4 sm:px-5 py-3 border-b border-slate-200/80 bg-white flex flex-wrap items-center justify-between gap-3 shrink-0 z-20">
            <div className="flex items-center gap-3 min-w-0">
              <h1 className="text-base font-bold text-slate-900 whitespace-nowrap">{title}</h1>
              {isCalendar && (
                <div className="flex items-center gap-1">
                  <button type="button" onClick={handlePrev} className="p-1.5 text-slate-500 hover:text-[#0052cc] hover:bg-blue-50 rounded-md cursor-pointer" title="Período anterior" aria-label="Período anterior"><ChevronLeft className="w-4 h-4" /></button>
                  <button type="button" onClick={handleToday} className="px-2 py-1 text-xs font-semibold text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-md cursor-pointer">Hoje</button>
                  <button type="button" onClick={handleNext} className="p-1.5 text-slate-500 hover:text-[#0052cc] hover:bg-blue-50 rounded-md cursor-pointer" title="Próximo período" aria-label="Próximo período"><ChevronRight className="w-4 h-4" /></button>
                  <span className="text-xs font-semibold text-slate-600 pl-1 whitespace-nowrap">{viewMode === 'week' ? formatWeekInterval(weekDates) : `${MONTH_NAMES_PT[currentReferenceDate.getMonth()]} de ${currentReferenceDate.getFullYear()}`}</span>
                  <span className="text-[11px] text-slate-400 pl-2 whitespace-nowrap hidden md:inline">{periodTaskCount} no período</span>
                </div>
              )}
            </div>

            {isCalendar && (
              <div className="flex flex-wrap items-center justify-end gap-2">
                <div className="bg-slate-100 p-0.5 rounded-lg flex items-center border border-slate-200">
                  {([['week', 'Semana'], ['month', 'Mês']] as const).map(([mode, label]) => (
                    <button key={mode} id={`view-mode-${mode}-button`} type="button" onClick={() => setViewMode(mode)} className={`px-2.5 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${viewMode === mode ? 'bg-white text-[#003067] shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>{label}</button>
                  ))}
                </div>
                {section !== 'my_tasks' && (
                  <div className="bg-slate-100 p-0.5 rounded-lg flex items-center border border-slate-200">
                    {([['all', 'Equipe'], ['my_tasks', 'Eu']] as const).map(([filter, label]) => (
                      <button key={filter} type="button" onClick={() => setNavFilter(filter)} className={`px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${navFilter === filter ? 'bg-white text-[#003067] shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>{label}</button>
                    ))}
                  </div>
                )}
                <div className="relative">
                  <button type="button" onClick={() => setFiltersOpen((o) => !o)} aria-expanded={filtersOpen} className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer ${activeFilters ? 'border-blue-300 bg-blue-50 text-[#0052cc]' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
                    <SlidersHorizontal className="w-3.5 h-3.5" /> Filtros{activeFilters ? ` (${activeFilters})` : ''}
                  </button>
                  {filtersOpen && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setFiltersOpen(false)} />
                      <div className="absolute right-0 top-full mt-1.5 z-40 w-72 bg-white rounded-xl border border-slate-200 shadow-xl p-3 space-y-2.5">
                        <label className="block">
                          <span className="block text-[11px] font-semibold text-slate-500 mb-1">Buscar</span>
                          <input value={taskSearch} onChange={(e) => setTaskSearch(e.target.value)} placeholder="Nome da tarefa" className="w-full h-8 rounded-lg border border-slate-200 px-2.5 text-xs outline-none focus:border-[#0052cc]" autoFocus />
                        </label>
                        <label className="block">
                          <span className="block text-[11px] font-semibold text-slate-500 mb-1">Pessoa</span>
                          <select value={selectedAssignee} onChange={(e) => setSelectedAssignee(e.target.value)} className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs"><option value="">Todas</option>{teamMembers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
                        </label>
                        <label className="block">
                          <span className="block text-[11px] font-semibold text-slate-500 mb-1">Status</span>
                          <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)} className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs"><option value="">Todos</option><option value="pendente">Pendente</option><option value="em_andamento">Em andamento</option><option value="concluida">Concluída</option></select>
                        </label>
                        <label className="block">
                          <span className="block text-[11px] font-semibold text-slate-500 mb-1">Categoria</span>
                          <select value={selectedBucket ?? ''} onChange={(e) => setSelectedBucket(e.target.value || null)} className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs"><option value="">Todas</option>{allBuckets.map((b) => <option key={b} value={b}>{b}</option>)}</select>
                        </label>
                        {activeFilters > 0 && (
                          <button type="button" onClick={() => { setTaskSearch(''); setSelectedAssignee(''); setSelectedStatus(''); setSelectedBucket(null); }} className="text-xs font-semibold text-[#0052cc] hover:underline cursor-pointer">Limpar filtros</button>
                        )}
                      </div>
                    </>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => { setShowQueue((v) => !v); setIsQueueSidebarCollapsed(false); }}
                  aria-pressed={showQueue}
                  title="Tarefas sem data"
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer ${showQueue ? 'border-blue-300 bg-blue-50 text-[#0052cc]' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                >
                  <Inbox className="w-3.5 h-3.5" /> Fila
                  {queueCount > 0 && <span className="text-[10px] font-bold bg-slate-200 text-slate-700 rounded-full px-1.5">{queueCount}</span>}
                </button>
                <button type="button" onClick={() => openNewTask()} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0052cc] hover:bg-[#00478f] text-white text-xs font-bold shadow-sm transition-colors cursor-pointer whitespace-nowrap">
                  <Plus className="w-3.5 h-3.5" /> Nova tarefa
                </button>
              </div>
            )}
          </header>
        );
      })()}

      {/* 2. Estrutura Limpa: Menu Lateral Esquerdo Unificado + Grade Central Espaçosa */}
      <div className="flex-1 min-h-0 flex overflow-hidden relative">
        {!externalNavigation && (
          <div className="contents">
          {/* Menu Lateral Esquerdo - disponível apenas no Planner isolado */}
        <LeftSidebar
          userRole={userRole}
          currentUser={currentUser}
          tasks={tasks}
          teamMembers={teamMembers}
          todayISO={todayISO}
          todayDate={todayDate}
          currentFilter={navFilter}
          onSelectFilter={(f) => {
            setActiveView('planner');
            setNavFilter(f);
          }}
          selectedBucket={selectedBucket}
          onSelectBucket={(b) => {
            setActiveView('planner');
            setSelectedBucket(b);
          }}
          buckets={allBuckets}
          tagBuckets={tagBuckets}
          counts={navCounts}
          onTaskClick={handleTaskClick}
          onToggleStatus={handleToggleStatus}
          onDragStart={handleDragStart}
          onDropToUnscheduled={handleDropToUnscheduled}
          onOpenNewTaskModal={() => openNewTask()}
          isCollapsed={isLeftSidebarCollapsed}
          onToggleCollapse={() => setIsLeftSidebarCollapsed((prev) => !prev)}
          activeTab={sidebarTab}
          onSelectTab={(tab) => {
            setActiveView('planner');
            setSidebarTab(tab);
          }}
          activeView={activeView === 'task_catalog' ? 'planner' : activeView}
          onOpenTeamManagement={() => {
            if (userRole === 'admin') {
              setActiveView('team_management');
            }
          }}
          onOpenExecutiveSummary={() => {
            if (userRole === 'admin') {
              setActiveView('executive_summary');
            }
          }}
          onOpenTagManagement={() => {
            if (userRole === 'admin') {
              setActiveView('tag_management');
            }
          }}
        />
          </div>
        )}

        {/* Grade Principal do Calendário OU Telas Administrativas (Equipe, Tags, Resumo) */}
        <main className="flex-1 min-h-0 overflow-hidden relative bg-[#f8f9fa]/80 flex flex-col">
          {activeView === 'task_catalog' ? (
            <TaskCatalogView
              models={models}
              tasks={tasks}
              teamMembers={teamMembers}
              tagBuckets={tagBuckets}
              currentUserId={currentUser.id}
              isAdmin={isRealAdmin}
              loading={modelsLoading}
              error={modelsError}
              onOpenModel={openModel}
              onNewTask={() => openNewTask()}
            />
          ) : activeView === 'tag_management' && userRole === 'admin' ? (
            <TagManagementView
              isAdmin={isRealAdmin && userRole === 'admin'}
              tasks={tasks}
              onTagsUpdated={(updated) => setTagBuckets(updated)}
              onBackToPlanner={goToCalendar}
            />
          ) : activeView === 'executive_summary' ? (
            <WeeklyBalanceView
              tasks={tasks}
              models={models}
              teamMembers={teamMembers}
              todayDate={todayDate}
              onTaskClick={handleTaskClick}
            />
          ) : activeView === 'team_management' && userRole === 'admin' ? (
            <TeamManagementView
              currentUserEmail={user?.email}
              isAdmin={isRealAdmin && userRole === 'admin'}
              onBackToPlanner={goToCalendar}
              onProfileUpdated={handleProfilesUpdated}
            />
          ) : isLoadingTasks ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-zinc-500">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mb-3 shadow-xs">
                <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
              </div>
              <p className="text-sm font-semibold text-zinc-800 mb-1">
                Carregando tarefas do Supabase...
              </p>
              <p className="text-xs text-zinc-400 max-w-sm">
                Buscando registros da tabela <code className="text-zinc-600 font-mono bg-zinc-100 px-1 py-0.5 rounded">tarefas</code> e sincronizando status em tempo real.
              </p>
            </div>
          ) : externalNavigation && showQueue && activeView === 'planner' ? (
            <div className="flex-1 min-h-0 flex overflow-hidden">
              <div className="flex-1 min-w-0 min-h-0 flex flex-col">
                {viewMode === 'week' ? (
                  <WeeklyView
                    weekDates={weekDates}
                    tasks={displayedTasks}
                    teamMembers={teamMembers}
                    userRole={userRole}
                    todayDate={todayDate}
                    onTaskClick={handleTaskClick}
                    onToggleStatus={handleToggleStatus}
                    onDragStart={handleDragStart}
                    onDropOnDate={handleDropOnDate}
                    canManageTask={canManageTask}
                    onQuickAddTask={handleQuickAddTask}
                    onRescheduleOverdue={handleRescheduleOverdue}
                  />
                ) : (
                  <MonthlyView
                    monthCells={monthCells}
                    tasks={displayedTasks}
                    teamMembers={teamMembers}
                    userRole={userRole}
                    todayISO={todayISO}
                    onTaskClick={handleTaskClick}
                    onDragStart={handleDragStart}
                    onDropOnDate={handleDropOnDate}
                    canManageTask={canManageTask}
                    onQuickAddTask={handleQuickAddTask}
                    onRescheduleOverdue={handleRescheduleOverdue}
                  />
                )}
              </div>
              <UnscheduledRightSidebar
                tasks={tasks}
                selectedBucket={selectedBucket}
                teamMembers={teamMembers}
                userRole={userRole}
                isCollapsed={isQueueSidebarCollapsed}
                onToggleCollapse={() => setIsQueueSidebarCollapsed((collapsed) => !collapsed)}
                onTaskClick={handleTaskClick}
                onToggleStatus={handleToggleStatus}
                onDragStart={handleDragStart}
                onOpenNewTaskModal={() => openNewTask()}
                onDropToUnscheduled={handleDropToUnscheduled}
                canManageTask={canManageTask}
              />
            </div>
          ) : viewMode === 'week' ? (
            <WeeklyView
              weekDates={weekDates}
              tasks={displayedTasks}
              teamMembers={teamMembers}
              userRole={userRole}
              todayDate={todayDate}
              onTaskClick={handleTaskClick}
              onToggleStatus={handleToggleStatus}
              onDragStart={handleDragStart}
              onDropOnDate={handleDropOnDate}
              canManageTask={canManageTask}
              onQuickAddTask={handleQuickAddTask}
              onRescheduleOverdue={handleRescheduleOverdue}
            />
          ) : (
            <MonthlyView
              monthCells={monthCells}
              tasks={displayedTasks}
              teamMembers={teamMembers}
              userRole={userRole}
              todayISO={todayISO}
              onTaskClick={handleTaskClick}
              onDragStart={handleDragStart}
              onDropOnDate={handleDropOnDate}
              canManageTask={canManageTask}
              onQuickAddTask={handleQuickAddTask}
              onRescheduleOverdue={handleRescheduleOverdue}
            />
          )}
        </main>
      </div>

      {/* 3. Modal Lateral de Detalhes da Ação (RBAC: Simplificada p/ Membro, Completa p/ Admin) */}
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
    </div>
  );
}
