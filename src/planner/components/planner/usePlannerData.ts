import { useState, useMemo, useEffect, useCallback } from 'react';
import { Task, TeamMember, UserRole, TagBucket, TaskModel } from '../../types.ts';
import { taskModelService } from '../../services/taskModelService.ts';
import { getWeekDates, getMonthGrid, formatISO } from '../../utils/dateUtils.ts';
import { isUserAssignedToTask } from '../../utils/taskFilterUtils.ts';
import { taskService, mapDbRowToTask, subscribeTaskMutations } from '../../services/taskService.ts';
import { userService, UserProfile } from '../../services/userService.ts';
import { tagService } from '../../services/tagService.ts';
import { supabase } from '../../../lib/supabase';
import { PlannerProps, NavFilter } from './shared';
import type { TaskDbRow } from '../../../lib/dbTypes';
import type { TaskMutationEvent } from '../../types.ts';

/** Dados do Planejamento: tarefas, cadastros, equipe e tags (com tempo real), filtros e datas do calendário. */
export function usePlannerData(props: PlannerProps) {
  const { user, viewRole: globalViewRole, section = 'calendar', onSectionChange } = props;
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

  // Tela ativa dentro do Planejamento (definida pela seção do menu)
  const [activeView, setActiveView] = useState<'planner' | 'executive_summary' | 'tag_management' | 'task_catalog'>('planner');

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
    if (userRole !== 'admin' && activeView === 'tag_management') {
      setActiveView('planner');
      onSectionChange?.('calendar');
    }
  }, [userRole, activeView, onSectionChange]);

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
        const taskList = data || [];
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
            const newTask = mapDbRowToTask(payload.new as TaskDbRow);
            setTasks((prev) => {
              if (prev.some((t) => t.id === newTask.id)) return prev;
              return [newTask, ...prev];
            });
          } else if (payload.eventType === 'UPDATE') {
            const updatedTask = mapDbRowToTask(payload.new as TaskDbRow);
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
    const handleBroadcastEvent = (eventPayload: TaskMutationEvent) => {
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

  const [isQueueSidebarCollapsed, setIsQueueSidebarCollapsed] = useState(false);

  // Filtros de Produtividade
  const [navFilter, setNavFilter] = useState<NavFilter>('all');
  const [selectedBucket, setSelectedBucket] = useState<string | null>(null);
  const [taskSearch, setTaskSearch] = useState('');
  const [selectedAssignee, setSelectedAssignee] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  // Fila (tarefas sem data) como painel lateral do calendário
  const [showQueue, setShowQueue] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // A navegação vem do menu lateral principal do R9 Hub.
  useEffect(() => {
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
      setNavFilter('all');
    } else {
      setNavFilter(section === 'my_tasks' ? 'my_tasks' : 'all');
    }
  }, [section, userRole, onSectionChange]);

  const goToCalendar = useCallback(() => {
    setActiveView('planner');
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

      // "Minhas tarefas" / botão "Eu": só tarefas em que a pessoa logada é responsável
      if (navFilter === 'my_tasks' && !isAssigned) return false;

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

  return {
    user,
    globalViewRole,
    section,
    onSectionChange,
    tasks,
    setTasks,
    teamMembers,
    setTeamMembers,
    tagBuckets,
    setTagBuckets,
    isLoadingTasks,
    setIsLoadingTasks,
    realUserRole,
    setRealUserRole,
    simulatedRole,
    setSimulatedRole,
    isRealAdmin,
    userRole,
    activeView,
    setActiveView,
    models,
    setModels,
    modelsLoading,
    setModelsLoading,
    modelsError,
    setModelsError,
    modelModal,
    setModelModal,
    modelById,
    loadModels,
    handleProfilesUpdated,
    currentUser,
    loadTasksFromSupabase,
    loadTagsFromSupabase,
    viewMode,
    setViewMode,
    todayDate,
    setTodayDate,
    todayISO,
    currentReferenceDate,
    setCurrentReferenceDate,
    selectedTask,
    setSelectedTask,
    isDetailOpen,
    setIsDetailOpen,
    completingTask,
    setCompletingTask,
    isCompletionModalOpen,
    setIsCompletionModalOpen,
    toastMessage,
    setToastMessage,
    draggedTaskId,
    setDraggedTaskId,
    isQueueSidebarCollapsed,
    setIsQueueSidebarCollapsed,
    navFilter,
    setNavFilter,
    selectedBucket,
    setSelectedBucket,
    taskSearch,
    setTaskSearch,
    selectedAssignee,
    setSelectedAssignee,
    selectedStatus,
    setSelectedStatus,
    showQueue,
    setShowQueue,
    filtersOpen,
    setFiltersOpen,
    goToCalendar,
    allBuckets,
    weekDates,
    monthCells,
    displayedTasks,
    periodTaskCount,
  };
}
