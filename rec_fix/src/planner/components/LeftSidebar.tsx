import React, { useState } from 'react';
import {
  CalendarDays,
  Inbox,
  TrendingUp,
  Sun,
  CheckSquare,
  Zap,
  Calendar,
  Plus,
  Search,
  CheckCircle2,
  Circle,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  Layers,
  Award,
  AlertCircle,
  Users,
  Shield,
  ShieldCheck,
  Tag,
} from 'lucide-react';
import { Task, TeamMember, UserRole, TagBucket } from '../types.ts';
import { MONTH_NAMES_PT } from '../utils/dateUtils.ts';
import { isUserAssignedToTask } from '../utils/taskFilterUtils.ts';
import TaskCard from './TaskCard.tsx';

export type SidebarTab = 'planner' | 'unscheduled' | 'summary';
export type NavFilter = 'all' | 'my_day' | 'my_tasks' | 'urgent' | 'unscheduled';

interface LeftSidebarProps {
  userRole: UserRole;
  currentUser: TeamMember;
  tasks: Task[];
  teamMembers: TeamMember[];
  todayISO: string;
  todayDate: Date;
  // Navegação do Planner
  currentFilter: NavFilter;
  onSelectFilter: (filter: NavFilter) => void;
  selectedBucket: string | null;
  onSelectBucket: (bucket: string | null) => void;
  buckets: string[];
  tagBuckets?: TagBucket[];
  // Contagens
  counts: {
    myDay: number;
    myTasks: number;
    all: number;
    urgent: number;
    unscheduled: number;
  };
  // Handlers de Ações e Drag & Drop
  onTaskClick: (task: Task) => void;
  onToggleStatus: (taskId: string, e: React.MouseEvent) => void;
  onDragStart: (e: React.DragEvent, task: Task) => void;
  onDropToUnscheduled: (e: React.DragEvent) => void;
  onOpenNewTaskModal: () => void;
  // Controle de colapso
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  // Aba Ativa
  activeTab: SidebarTab;
  onSelectTab: (tab: SidebarTab) => void;
  // Gestão de Equipe, Resumo Executivo e Tags/Categorias (Exclusivo Administrador)
  activeView?: 'planner' | 'team_management' | 'executive_summary' | 'tag_management';
  onOpenTeamManagement?: () => void;
  onOpenExecutiveSummary?: () => void;
  onOpenTagManagement?: () => void;
}

export default function LeftSidebar({
  userRole,
  currentUser,
  tasks,
  teamMembers,
  todayISO,
  todayDate,
  currentFilter,
  onSelectFilter,
  selectedBucket,
  onSelectBucket,
  buckets,
  tagBuckets = [],
  counts,
  onTaskClick,
  onToggleStatus,
  onDragStart,
  onDropToUnscheduled,
  onOpenNewTaskModal,
  isCollapsed,
  onToggleCollapse,
  activeTab,
  onSelectTab,
  activeView = 'planner',
  onOpenTeamManagement,
  onOpenExecutiveSummary,
  onOpenTagManagement,
}: LeftSidebarProps) {
  // Estado interno para busca na fila (Admin)
  const [searchTerm, setSearchTerm] = useState('');
  const [isDragOverUnscheduled, setIsDragOverUnscheduled] = useState(false);

  // Filtro interno para o Usuário Comum na aba Resumo (com suporte a ações atrasadas)
  const [memberFilter, setMemberFilter] = useState<'all' | 'today' | 'urgent' | 'overdue'>('all');

  const isAdmin = userRole === 'admin';

  // Se o usuário comum estiver com aba 'unscheduled' (ex: após troca de perfil), ajusta para 'planner'
  const currentTab: SidebarTab = !isAdmin && activeTab === 'unscheduled' ? 'planner' : activeTab;

  // --- DADOS PARA ADMIN: FILA NÃO AGENDADA ---
  const unscheduledTasks = tasks.filter((t) => !t.scheduledDate);
  const filteredUnscheduled = unscheduledTasks.filter((task) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const matchTitle = task.title.toLowerCase().includes(term);
    const matchBucket = task.bucket?.toLowerCase().includes(term);
    const matchTags = task.tags?.some((t) => t.toLowerCase().includes(term));
    return matchTitle || matchBucket || matchTags;
  });

  // --- TAREFAS ATRASADAS GERAIS (Comparação da data agendada com hoje) ---
  const overdueTasks = tasks.filter(
    (t) => t.scheduledDate && t.scheduledDate < todayISO && t.status !== 'concluida'
  );

  // --- DADOS PARA ADMIN: RESUMO GLOBAL DO DIA ---
  const todayTasks = tasks.filter((t) => t.scheduledDate === todayISO);
  const completedToday = todayTasks.filter((t) => t.status === 'concluida').length;
  const pendingToday = todayTasks.filter((t) => t.status !== 'concluida').length;
  const totalToday = todayTasks.length;
  const completionPercentage = totalToday > 0 ? Math.round((completedToday / totalToday) * 100) : 0;
  const urgentToday = todayTasks.filter((t) => t.priority === 'Urgente' && t.status !== 'concluida').length;
  const highToday = todayTasks.filter((t) => t.priority === 'Alta' && t.status !== 'concluida').length;
  const mediumToday = todayTasks.filter((t) => t.priority === 'Média' && t.status !== 'concluida').length;
  const lowToday = todayTasks.filter((t) => t.priority === 'Baixa' && t.status !== 'concluida').length;
  const assignedMemberIds = Array.from(
    new Set(
      todayTasks.flatMap((t) =>
        t.assignedToIds && t.assignedToIds.length > 0
          ? t.assignedToIds
          : t.assignedTo
          ? [t.assignedTo]
          : []
      )
    )
  );

  // --- DADOS PARA MEMBRO: MINHAS AÇÕES & MÉTRICAS PESSOAIS ---
  const isUserTask = (t: Task) =>
    isUserAssignedToTask(t, currentUser, undefined, teamMembers);

  const myTasks = tasks.filter(isUserTask);
  const myTodayTasks = myTasks.filter((t) => t.scheduledDate === todayISO);
  const myCompletedCount = myTasks.filter((t) => t.status === 'concluida').length;
  const myPendingCount = myTasks.filter((t) => t.status !== 'concluida').length;
  const myOverdueTasks = myTasks.filter(
    (t) => t.scheduledDate && t.scheduledDate < todayISO && t.status !== 'concluida'
  );
  const myCompletionPercentage =
    myTasks.length > 0 ? Math.round((myCompletedCount / myTasks.length) * 100) : 0;

  const filteredMyTasks = myTasks.filter((t) => {
    if (memberFilter === 'today') return t.scheduledDate === todayISO;
    if (memberFilter === 'urgent') return t.priority === 'Urgente' || t.priority === 'Alta';
    if (memberFilter === 'overdue') return t.scheduledDate && t.scheduledDate < todayISO && t.status !== 'concluida';
    return true;
  });

  const dayNumber = todayDate.getDate();
  const monthName = MONTH_NAMES_PT[todayDate.getMonth()];

  const navItems = [
    {
      id: 'my_day' as NavFilter,
      label: 'Meu dia',
      icon: Sun,
      color: 'text-amber-500',
      activeBg: 'bg-[#d0e1fb] text-[#003067] font-bold shadow-xs',
      count: counts.myDay,
    },
    {
      id: 'my_tasks' as NavFilter,
      label: 'Minhas tarefas',
      icon: CheckSquare,
      color: 'text-[#004691]',
      activeBg: 'bg-[#d0e1fb] text-[#003067] font-bold shadow-xs',
      count: counts.myTasks,
    },
    {
      id: 'urgent' as NavFilter,
      label: 'Importantes',
      icon: Zap,
      color: 'text-rose-500',
      activeBg: 'bg-[#d0e1fb] text-[#003067] font-bold shadow-xs',
      count: counts.urgent,
    },
    {
      id: 'all' as NavFilter,
      label: 'Visão Geral (Todas)',
      icon: Calendar,
      color: 'text-slate-600',
      activeBg: 'bg-[#d0e1fb] text-[#003067] font-bold shadow-xs',
      count: counts.all,
    },
  ];

  // Renderização Colapsada (Minimal Icon Rail)
  if (isCollapsed) {
    return (
      <aside
        id="left-sidebar-collapsed"
        className="h-full w-14 bg-white border-r border-zinc-200/80 flex flex-col justify-between items-center py-3 select-none shrink-0 transition-all z-20"
      >
        <div className="flex flex-col items-center gap-3 w-full">
          <button
            type="button"
            onClick={onToggleCollapse}
            className="p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-md transition-colors cursor-pointer"
            title="Expandir barra lateral"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {isAdmin ? (
            /* Abas Colapsadas do Administrador: 3 botões (Planner, Fila, Resumo) */
            <div className="flex flex-col items-center gap-1.5 w-full px-1 pt-2 border-t border-zinc-100">
              <button
                type="button"
                onClick={() => {
                  onSelectTab('planner');
                  onToggleCollapse();
                }}
                className={`p-2 rounded-lg transition-colors cursor-pointer ${
                  currentTab === 'planner'
                    ? 'bg-blue-50 text-blue-700 font-bold'
                    : 'text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100'
                }`}
                title="Planner & Navegação"
              >
                <CalendarDays className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => {
                  onSelectTab('unscheduled');
                  onToggleCollapse();
                }}
                className={`p-2 rounded-lg relative transition-colors cursor-pointer ${
                  currentTab === 'unscheduled'
                    ? 'bg-amber-50 text-amber-700 font-bold'
                    : 'text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100'
                }`}
                title={`Fila de Não Agendadas (${unscheduledTasks.length} pendentes para alocar)`}
              >
                <Inbox className="w-4 h-4 text-amber-600" />
                {unscheduledTasks.length > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-[9px] font-bold text-white shadow-xs animate-pulse ring-2 ring-white">
                    {unscheduledTasks.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  onSelectTab('summary');
                  onToggleCollapse();
                }}
                className={`p-2 rounded-lg relative transition-colors cursor-pointer ${
                  currentTab === 'summary'
                    ? 'bg-blue-50 text-blue-700 font-bold'
                    : 'text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100'
                }`}
                title="Resumo da Equipe & Métricas"
              >
                <TrendingUp className="w-4 h-4 text-blue-600" />
                {overdueTasks.length > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-white animate-pulse" />
                )}
              </button>

              {/* Botão Colapsado: Gerenciar Tags / Categorias (Exclusivo Admin) */}
              <button
                id="collapsed-tag-management-button"
                type="button"
                onClick={() => {
                  onOpenTagManagement?.();
                  onToggleCollapse();
                }}
                className={`p-2 rounded-lg relative transition-colors cursor-pointer ${
                  activeView === 'tag_management'
                    ? 'bg-blue-600 text-white font-bold'
                    : 'text-zinc-400 hover:text-blue-700 hover:bg-blue-50'
                }`}
                title="Gerenciar Tags & Categorias (tabela tags_bucket)"
              >
                <Tag className="w-4 h-4" />
              </button>

              {/* Botão Colapsado: Resumo Executivo Semanal (Exclusivo Admin) */}
              <button
                id="collapsed-executive-summary-button"
                type="button"
                onClick={() => {
                  onOpenExecutiveSummary?.();
                  onToggleCollapse();
                }}
                className={`p-2 rounded-lg relative transition-colors cursor-pointer ${
                  activeView === 'executive_summary'
                    ? 'bg-blue-600 text-white font-bold'
                    : 'text-zinc-400 hover:text-blue-700 hover:bg-blue-50'
                }`}
                title="Resumo Executivo Semanal (Painel Gerencial)"
              >
                <CalendarDays className="w-4 h-4" />
              </button>

              {/* Botão Colapsado: Gerenciar Equipe (Exclusivo Admin) */}
              <button
                id="collapsed-team-management-button"
                type="button"
                onClick={() => {
                  onOpenTeamManagement?.();
                  onToggleCollapse();
                }}
                className={`p-2 rounded-lg relative transition-colors cursor-pointer ${
                  activeView === 'team_management'
                    ? 'bg-blue-600 text-white font-bold'
                    : 'text-zinc-400 hover:text-blue-700 hover:bg-blue-50'
                }`}
                title="Gerenciar Equipe & Permissões (Supabase)"
              >
                <Users className="w-4 h-4" />
              </button>
            </div>
          ) : (
            /* Abas Colapsadas do Usuário Comum: 2 botões (Planner e Resumo) */
            <div className="flex flex-col items-center gap-1.5 w-full px-1 pt-2 border-t border-zinc-100">
              <button
                type="button"
                onClick={() => {
                  onSelectTab('planner');
                  onToggleCollapse();
                }}
                className={`p-2 rounded-lg transition-colors cursor-pointer ${
                  currentTab === 'planner'
                    ? 'bg-blue-50 text-blue-700 font-bold'
                    : 'text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100'
                }`}
                title="Planner & Navegação"
              >
                <CalendarDays className="w-4 h-4 text-blue-600" />
              </button>

              <button
                type="button"
                onClick={() => {
                  onSelectTab('summary');
                  onToggleCollapse();
                }}
                className={`p-2 rounded-lg relative transition-colors cursor-pointer ${
                  currentTab === 'summary'
                    ? 'bg-blue-50 text-blue-700 font-bold'
                    : 'text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100'
                }`}
                title={`Resumo & Minhas Tarefas (${myPendingCount} pendentes)`}
              >
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                {myOverdueTasks.length > 0 ? (
                  <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-white animate-pulse" />
                ) : myPendingCount > 0 ? (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-blue-600" />
                ) : null}
              </button>
            </div>
          )}
        </div>

        {/* Rodapé Colapsado */}
        <div
          className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold ${currentUser.avatarColor}`}
          title={`${currentUser.name} (${isAdmin ? 'Admin' : 'Membro'})`}
        >
          {currentUser.initials}
        </div>
      </aside>
    );
  }

  return (
    <aside
      id="planner-left-sidebar"
      className="h-full w-72 lg:w-80 bg-white border-r border-zinc-200/80 flex flex-col justify-between shrink-0 select-none overflow-hidden transition-all duration-200 z-20"
    >
      {/* 1. TOPO DA BARRA LATERAL: PERFIL DO USUÁRIO + BOTÃO NOVA AÇÃO + ABAS */}
      <div className="flex flex-col shrink-0 border-b border-slate-200/80 bg-white p-3 space-y-3">
        {/* Bloco de Usuário Topo */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 bg-[#003067] text-white shadow-sm"
            >
              {currentUser.initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold text-slate-900 truncate leading-tight">
                {currentUser.name}
              </p>
              <span className="text-[11px] text-slate-500 font-medium truncate block">
                {isAdmin ? 'Administrator • R9 Corp' : 'Standard User • R9 Corp'}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onToggleCollapse}
            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            title="Recolher barra lateral"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        {/* CONTROLE DE ABAS:
            - ADMINISTRADOR: 3 Abas (Planner | Fila | Resumo)
            - USUÁRIO COMUM (MEMBRO): 2 Abas (Planner | Resumo)
        */}
        <div>
          {isAdmin ? (
            <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100/90 rounded-xl">
              <button
                id="admin-tab-planner-button"
                type="button"
                onClick={() => onSelectTab('planner')}
                className={`flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-semibold rounded-lg transition-all cursor-pointer ${
                  currentTab === 'planner'
                    ? 'bg-white text-[#003067] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <CalendarDays className="w-3.5 h-3.5" />
                <span>Planner</span>
              </button>

              <button
                id="admin-tab-unscheduled-button"
                type="button"
                onClick={() => onSelectTab('unscheduled')}
                className={`flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-semibold rounded-lg transition-all cursor-pointer relative ${
                  currentTab === 'unscheduled'
                    ? 'bg-white text-amber-950 shadow-xs ring-1 ring-amber-400/40'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Inbox className={`w-3.5 h-3.5 ${unscheduledTasks.length > 0 ? 'text-amber-600' : 'text-slate-500'}`} />
                <span>Fila</span>
                {unscheduledTasks.length > 0 && (
                  <span
                    className="inline-flex items-center justify-center text-[10px] font-bold px-1.5 py-0.2 min-w-[18px] rounded-full bg-amber-500 text-white shadow-xs animate-pulse"
                    title={`${unscheduledTasks.length} tarefas aguardando agendamento`}
                  >
                    {unscheduledTasks.length}
                  </span>
                )}
              </button>

              <button
                id="admin-tab-summary-button"
                type="button"
                onClick={() => onSelectTab('summary')}
                className={`flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-semibold rounded-lg transition-all cursor-pointer ${
                  currentTab === 'summary'
                    ? 'bg-white text-[#003067] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5 text-[#004691]" />
                <span>Resumo</span>
                {overdueTasks.length > 0 && (
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse ml-0.5" />
                )}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100/90 rounded-xl">
              <button
                id="member-tab-planner-button"
                type="button"
                onClick={() => onSelectTab('planner')}
                className={`flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-semibold rounded-lg transition-all cursor-pointer ${
                  currentTab === 'planner'
                    ? 'bg-white text-[#003067] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <CalendarDays className="w-3.5 h-3.5 text-[#004691]" />
                <span>Planner</span>
              </button>

              <button
                id="member-tab-summary-button"
                type="button"
                onClick={() => onSelectTab('summary')}
                className={`flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-semibold rounded-lg transition-all cursor-pointer relative ${
                  currentTab === 'summary'
                    ? 'bg-white text-[#003067] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                <span>Resumo</span>
                {myPendingCount > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-blue-100 text-[#003067]">
                    {myPendingCount}
                  </span>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 2. CONTEÚDO DINÂMICO CONFORME ABA SELECIONADA E PERFIL RBAC */}
      <div className="flex-1 overflow-y-auto">
        {/* ========================================================
            ABA 1: PLANNER (NAVEGAÇÃO, ATALHOS RÁPIDOS & BUCKETS)
            Disponível tanto para Admin quanto para Membro
           ======================================================== */}
        {currentTab === 'planner' && (
          <div className="p-3 space-y-4">
            {/* Botão de Criar Nova Ação (Exclusivo para Administrador) */}
            {isAdmin && (
              <button
                type="button"
                onClick={onOpenNewTaskModal}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg shadow-2xs transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Nova Ação</span>
              </button>
            )}

            {/* Atalhos Rápidos */}
            <div className="space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 px-1 block mb-1">
                Visualizações Rápidas
              </span>

              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentFilter === item.id && selectedBucket === null;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onSelectBucket(null);
                      onSelectFilter(item.id);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-colors cursor-pointer ${
                      isActive
                        ? item.activeBg
                        : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Icon className={`w-4 h-4 shrink-0 ${item.color}`} />
                      <span className="truncate">{item.label}</span>
                    </div>

                    {item.count > 0 && (
                      <span
                        className={`text-[11px] px-1.5 py-0.2 rounded-full font-medium ${
                          isActive
                            ? 'bg-white/90 text-zinc-900 shadow-2xs'
                            : 'text-zinc-400 bg-zinc-100'
                        }`}
                      >
                        {item.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Planos & Categorias (Buckets) */}
            <div className="pt-2 border-t border-zinc-100">
              <div className="flex items-center justify-between mb-1.5 px-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                  Planos & Categorias
                </span>
                {selectedBucket && (
                  <button
                    type="button"
                    onClick={() => onSelectBucket(null)}
                    className="text-[10px] text-zinc-500 hover:underline cursor-pointer font-medium"
                  >
                    Limpar
                  </button>
                )}
              </div>

              <div className="space-y-0.5">
                {buckets.map((bucket) => {
                  const isBucketActive = selectedBucket === bucket;
                  const countInBucket = tasks.filter((t) => {
                    if (t.bucket !== bucket) return false;
                    return isAdmin ? true : t.assignedTo === currentUser.id;
                  }).length;

                  // Encontrar cor customizada da tabela tags_bucket se existir
                  const foundTag = tagBuckets.find(
                    (tb) => tb.nome.toLowerCase() === bucket.toLowerCase()
                  );
                  const bucketColor = foundTag?.cor;

                  return (
                    <button
                      key={bucket}
                      type="button"
                      onClick={() => onSelectBucket(isBucketActive ? null : bucket)}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors cursor-pointer ${
                        isBucketActive
                          ? 'bg-zinc-100 font-semibold text-zinc-900 shadow-2xs'
                          : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            !bucketColor
                              ? bucket === 'Financeiro'
                                ? 'bg-emerald-500'
                                : bucket === 'Tecnologia'
                                ? 'bg-blue-500'
                                : bucket === 'Marketing'
                                ? 'bg-purple-500'
                                : bucket === 'Estratégico'
                                ? 'bg-amber-500'
                                : 'bg-pink-500'
                              : ''
                          }`}
                          style={bucketColor ? { backgroundColor: bucketColor } : undefined}
                        />
                        <span className="truncate">{bucket}</span>
                      </div>

                      <span className="text-[10px] text-zinc-400">{countInBucket}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Seção Exclusiva de Administração (Apenas para Administrador) */}
            {isAdmin && (
              <div className="pt-2 border-t border-zinc-100 space-y-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 px-1 block">
                  Administração
                </span>

                {/* Botão Gerenciar Tags / Categorias */}
                <button
                  id="admin-manage-tags-button"
                  type="button"
                  onClick={onOpenTagManagement}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    activeView === 'tag_management'
                      ? 'bg-blue-600 text-white shadow-2xs font-semibold'
                      : 'bg-blue-50/70 text-blue-700 hover:bg-blue-100/80 border border-blue-200/80'
                  }`}
                  title="Gerenciar tags e categorias da tabela tags_bucket no Supabase"
                >
                  <div className="flex items-center gap-2">
                    <Tag className={`w-4 h-4 ${activeView === 'tag_management' ? 'text-white' : 'text-blue-600'}`} />
                    <span>Gerenciar Tags</span>
                  </div>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      activeView === 'tag_management'
                        ? 'bg-white/25 text-white'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    tags
                  </span>
                </button>

                {/* Botão Resumo Executivo Semanal */}
                <button
                  id="admin-executive-summary-button"
                  type="button"
                  onClick={onOpenExecutiveSummary}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    activeView === 'executive_summary'
                      ? 'bg-blue-600 text-white shadow-2xs font-semibold'
                      : 'bg-blue-50/70 text-blue-700 hover:bg-blue-100/80 border border-blue-200/80'
                  }`}
                  title="Acessar o Resumo Executivo Semanal e métricas de formulários"
                >
                  <div className="flex items-center gap-2">
                    <TrendingUp className={`w-4 h-4 ${activeView === 'executive_summary' ? 'text-white' : 'text-blue-600'}`} />
                    <span>Resumo Semanal</span>
                  </div>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      activeView === 'executive_summary'
                        ? 'bg-white/25 text-white'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    gerencial
                  </span>
                </button>

                {/* Botão Gerenciar Equipe */}
                <button
                  id="admin-manage-team-button"
                  type="button"
                  onClick={onOpenTeamManagement}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    activeView === 'team_management'
                      ? 'bg-blue-600 text-white shadow-2xs font-semibold'
                      : 'bg-blue-50/70 text-blue-700 hover:bg-blue-100/80 border border-blue-200/80'
                  }`}
                  title="Gerenciar usuários e permissões da equipe no Supabase"
                >
                  <div className="flex items-center gap-2">
                    <Users className={`w-4 h-4 ${activeView === 'team_management' ? 'text-white' : 'text-blue-600'}`} />
                    <span>Gerenciar Equipe</span>
                  </div>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      activeView === 'team_management'
                        ? 'bg-white/25 text-white'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    perfis
                  </span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* ========================================================
            ABA 2: FILA DE NÃO AGENDADAS (DRAG & DROP)
            EXCLUSIVA DO ADMINISTRADOR (Oculta para Membros)
           ======================================================== */}
        {isAdmin && currentTab === 'unscheduled' && (
          <div
            className={`flex flex-col h-full ${
              isDragOverUnscheduled ? 'bg-amber-50/40 ring-2 ring-amber-400/50' : ''
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOverUnscheduled(true);
            }}
            onDragLeave={() => setIsDragOverUnscheduled(false)}
            onDrop={(e) => {
              setIsDragOverUnscheduled(false);
              onDropToUnscheduled(e);
            }}
          >
            {/* Barra de Pesquisa + Ação Rápida */}
            <div className="p-3 border-b border-zinc-100 bg-zinc-50/40 space-y-2 shrink-0">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Buscar na fila..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-white border border-zinc-200/80 rounded-lg outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-500/20 text-zinc-800 placeholder-zinc-400"
                />
              </div>

              <div className="flex items-center justify-between pt-0.5">
                <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                  <GripVertical className="w-3 h-3 text-blue-500" />
                  Arraste os cards para o calendário
                </span>
                <button
                  type="button"
                  onClick={onOpenNewTaskModal}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Nova</span>
                </button>
              </div>
            </div>

            {/* Aviso de Drop zone quando arrastando de volta */}
            {isDragOverUnscheduled && (
              <div className="p-2 bg-amber-100/90 text-amber-900 text-[11px] font-semibold text-center animate-pulse border-b border-amber-200">
                Solte aqui para mover para a Fila Não Agendada
              </div>
            )}

            {/* Lista de Cards da Fila */}
            <div className="flex-1 p-3 space-y-2.5 overflow-y-auto">
              {filteredUnscheduled.length === 0 ? (
                <div className="h-44 flex flex-col items-center justify-center text-center p-3 border border-dashed border-zinc-200 rounded-xl bg-zinc-50/50">
                  <Inbox className="w-6 h-6 text-zinc-300 mb-1.5" />
                  <p className="text-xs font-semibold text-zinc-700">
                    Fila vazia
                  </p>
                  <p className="text-[10px] text-zinc-400 mt-0.5 max-w-[180px]">
                    {searchTerm
                      ? 'Nenhuma tarefa encontrada com esse termo.'
                      : 'Todas as tarefas estão agendadas no calendário.'}
                  </p>
                  {!searchTerm && (
                    <button
                      type="button"
                      onClick={onOpenNewTaskModal}
                      className="mt-2.5 px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors cursor-pointer"
                    >
                      + Criar Ação na Fila
                    </button>
                  )}
                </div>
              ) : (
                filteredUnscheduled.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    teamMembers={teamMembers}
                    userRole={userRole}
                    onClick={onTaskClick}
                    onToggleStatus={onToggleStatus}
                    onDragStart={onDragStart}
                    compact={true}
                    todayISO={todayISO}
                  />
                ))
              )}
            </div>
          </div>
        )}

        {/* ========================================================
            ABA 3: RESUMO
            - Para Administrador: Visão Geral da Equipe & Métricas de Hoje
            - Para Usuário Comum: Minhas Ações Pendentes & Desempenho Pessoal
           ======================================================== */}
        {currentTab === 'summary' && (
          <div className="p-3 space-y-4">
            {isAdmin ? (
              /* --- RESUMO DO ADMINISTRADOR (EQUIPE GERAL) --- */
              <>
                {/* Alerta de Ações Atrasadas no Sistema (se houver) */}
                {overdueTasks.length > 0 && (
                  <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-center justify-between shadow-2xs">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-600 animate-pulse shrink-0" />
                      <span className="font-semibold">
                        {overdueTasks.length} {overdueTasks.length === 1 ? 'ação atrasada' : 'ações atrasadas'}
                      </span>
                    </div>
                    <span className="text-[10px] text-rose-700 font-medium px-2 py-0.5 rounded bg-rose-100/80 border border-rose-200">
                      Requer atenção
                    </span>
                  </div>
                )}

                {/* Card de Execução Geral do Dia */}
                <div className="p-3 bg-gradient-to-br from-zinc-50 to-blue-50/40 rounded-xl border border-zinc-200/70 shadow-2xs">
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="font-semibold text-zinc-800 flex items-center gap-1.5">
                      <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
                      Execução Geral ({dayNumber} de {monthName})
                    </span>
                    <span className="font-bold text-blue-700">{completionPercentage}%</span>
                  </div>

                  {/* Barra de Progresso */}
                  <div className="w-full h-2 bg-zinc-200 rounded-full overflow-hidden mb-2.5">
                    <div
                      className="h-full bg-blue-600 transition-all duration-300 rounded-full"
                      style={{ width: `${completionPercentage}%` }}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-center pt-1 border-t border-zinc-200/50">
                    <div>
                      <span className="text-[10px] text-zinc-500 block">Concluídas</span>
                      <span className="text-sm font-bold text-emerald-700">{completedToday}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-500 block">Pendentes</span>
                      <span className="text-sm font-bold text-amber-700">{pendingToday}</span>
                    </div>
                  </div>
                </div>

                {/* Pendências por Prioridade */}
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 block mb-1.5">
                    Pendências de Hoje (Equipe)
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    <div className="p-2 rounded-lg bg-rose-50/70 border border-rose-200/60 flex items-center justify-between">
                      <span className="text-[11px] font-medium text-rose-800 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-rose-500" />
                        Urgente
                      </span>
                      <span className="text-xs font-bold text-rose-900">{urgentToday}</span>
                    </div>

                    <div className="p-2 rounded-lg bg-amber-50/70 border border-amber-200/60 flex items-center justify-between">
                      <span className="text-[11px] font-medium text-amber-800 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-amber-500" />
                        Alta
                      </span>
                      <span className="text-xs font-bold text-amber-900">{highToday}</span>
                    </div>

                    <div className="p-2 rounded-lg bg-blue-50/70 border border-blue-200/60 flex items-center justify-between">
                      <span className="text-[11px] font-medium text-blue-800 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-blue-500" />
                        Média
                      </span>
                      <span className="text-xs font-bold text-blue-900">{mediumToday}</span>
                    </div>

                    <div className="p-2 rounded-lg bg-zinc-50 border border-zinc-200/70 flex items-center justify-between">
                      <span className="text-[11px] font-medium text-zinc-700 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-zinc-400" />
                        Baixa
                      </span>
                      <span className="text-xs font-bold text-zinc-800">{lowToday}</span>
                    </div>
                  </div>
                </div>

                {/* Lista Rápida de Ações de Hoje */}
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 block mb-1.5">
                    Tarefas de Hoje ({totalToday})
                  </span>

                  {todayTasks.length === 0 ? (
                    <div className="text-center py-5 border border-dashed border-zinc-200 rounded-lg text-zinc-400 text-xs">
                      Nenhuma ação agendada para hoje
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                      {todayTasks.map((task) => {
                        const isConcluida = task.status === 'concluida';
                        const assignee = teamMembers.find((m) => m.id === task.assignedTo);

                        return (
                          <div
                            key={task.id}
                            onClick={() => onTaskClick(task)}
                            className={`p-2 rounded-lg border text-xs flex items-start gap-2 transition-all cursor-pointer ${
                              isConcluida
                                ? 'bg-zinc-50/80 border-zinc-200/60 opacity-70'
                                : 'bg-white border-zinc-200/80 hover:border-zinc-300 hover:shadow-2xs'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={(e) => onToggleStatus(task.id, e)}
                              className={`mt-0.5 shrink-0 transition-colors ${
                                isConcluida ? 'text-emerald-600' : 'text-zinc-300 hover:text-blue-600'
                              }`}
                            >
                              {isConcluida ? (
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              ) : (
                                <Circle className="w-3.5 h-3.5" />
                              )}
                            </button>

                            <div className="flex-1 min-w-0">
                              <p
                                className={`text-[12px] font-medium leading-tight truncate ${
                                  isConcluida ? 'line-through text-zinc-400' : 'text-zinc-900'
                                }`}
                              >
                                {task.title}
                              </p>
                              <div className="flex items-center gap-1.5 mt-1 text-[10px] text-zinc-400">
                                {task.bucket && (
                                  <span className="text-zinc-600 bg-zinc-100 px-1 py-0.2 rounded font-normal">
                                    {task.bucket}
                                  </span>
                                )}
                                {assignee && (
                                  <span className="truncate max-w-[80px]">
                                    {assignee.name.split(' ')[0]}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Membros Ativos Hoje */}
                {assignedMemberIds.length > 0 && (
                  <div className="pt-2 border-t border-zinc-100">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 block mb-1.5">
                      Equipe Ativa Hoje
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {assignedMemberIds.map((memberId) => {
                        const member = teamMembers.find((m) => m.id === memberId);
                        if (!member) return null;
                        const memberTasksCount = todayTasks.filter((t) => t.assignedTo === memberId).length;

                        return (
                          <div
                            key={memberId}
                            className="flex items-center gap-1.5 bg-zinc-50 border border-zinc-200/80 px-2 py-1 rounded-md text-[11px] text-zinc-700"
                            title={`${member.name}: ${memberTasksCount} tarefa(s) hoje`}
                          >
                            <div
                              className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold ${member.avatarColor}`}
                            >
                              {member.initials}
                            </div>
                            <span className="font-medium">{member.name.split(' ')[0]}</span>
                            <span className="text-[10px] text-zinc-400">({memberTasksCount})</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Botão de Acesso Direto ao Resumo Executivo Semanal */}
                <div className="pt-2 border-t border-zinc-100">
                  <button
                    id="admin-summary-open-executive-btn"
                    type="button"
                    onClick={onOpenExecutiveSummary}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg text-xs font-bold shadow-2xs transition-all cursor-pointer"
                  >
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>Abrir Resumo Executivo Semanal</span>
                  </button>
                </div>
              </>
            ) : (
              /* --- RESUMO DO MEMBRO (MINHAS AÇÕES & MÉTRICAS PESSOAIS) --- */
              <>
                {/* Alerta de Minhas Ações Atrasadas (se houver) */}
                {myOverdueTasks.length > 0 && (
                  <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-center justify-between shadow-2xs">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-600 animate-pulse shrink-0" />
                      <span className="font-semibold">
                        Você tem {myOverdueTasks.length} {myOverdueTasks.length === 1 ? 'ação atrasada' : 'ações atrasadas'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setMemberFilter('overdue')}
                      className="text-[10px] font-semibold text-rose-800 bg-rose-100 hover:bg-rose-200 px-2 py-0.5 rounded transition-colors cursor-pointer"
                    >
                      Ver
                    </button>
                  </div>
                )}

                {/* Desempenho Pessoal */}
                <div className="p-3 bg-gradient-to-br from-blue-50/50 to-indigo-50/30 rounded-xl border border-blue-100 shadow-2xs">
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="font-semibold text-zinc-800 flex items-center gap-1.5">
                      <Award className="w-3.5 h-3.5 text-blue-600" />
                      Meu Progresso Geral
                    </span>
                    <span className="font-bold text-blue-700">{myCompletionPercentage}%</span>
                  </div>

                  {/* Barra de Progresso do Membro */}
                  <div className="w-full h-2 bg-blue-200/60 rounded-full overflow-hidden mb-2.5">
                    <div
                      className="h-full bg-blue-600 transition-all duration-300 rounded-full"
                      style={{ width: `${myCompletionPercentage}%` }}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-1 text-center pt-1 border-t border-blue-100">
                    <div>
                      <span className="text-[9px] text-zinc-500 block">Total</span>
                      <span className="text-xs font-bold text-zinc-800">{myTasks.length}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-zinc-500 block">Concluídas</span>
                      <span className="text-xs font-bold text-emerald-700">{myCompletedCount}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-zinc-500 block">Pendentes</span>
                      <span className="text-xs font-bold text-amber-700">{myPendingCount}</span>
                    </div>
                  </div>
                </div>

                {/* Filtros Rápidos (Todas / Hoje / Atrasadas / Prioritárias) */}
                <div>
                  <div className="p-1 bg-zinc-100 rounded-lg flex items-center gap-1 mb-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setMemberFilter('all')}
                      className={`flex-1 min-w-[50px] py-1 px-1.5 text-[11px] font-medium rounded-md text-center transition-colors cursor-pointer ${
                        memberFilter === 'all'
                          ? 'bg-white text-zinc-900 shadow-2xs font-semibold'
                          : 'text-zinc-500 hover:text-zinc-800'
                      }`}
                    >
                      Todas ({myTasks.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setMemberFilter('today')}
                      className={`py-1 px-2 text-[11px] font-medium rounded-md text-center transition-colors cursor-pointer ${
                        memberFilter === 'today'
                          ? 'bg-white text-blue-700 shadow-2xs font-semibold'
                          : 'text-zinc-500 hover:text-zinc-800'
                      }`}
                    >
                      Hoje ({myTodayTasks.length})
                    </button>
                    {myOverdueTasks.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setMemberFilter('overdue')}
                        className={`py-1 px-2 text-[11px] font-medium rounded-md text-center transition-colors cursor-pointer flex items-center gap-1 ${
                          memberFilter === 'overdue'
                            ? 'bg-rose-50 text-rose-800 shadow-2xs font-semibold ring-1 ring-rose-300'
                            : 'text-rose-600 hover:text-rose-800 hover:bg-rose-50/50'
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                        <span>Atrasadas ({myOverdueTasks.length})</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setMemberFilter('urgent')}
                      className={`py-1 px-2 text-[11px] font-medium rounded-md text-center transition-colors cursor-pointer ${
                        memberFilter === 'urgent'
                          ? 'bg-white text-rose-700 shadow-2xs font-semibold'
                          : 'text-zinc-500 hover:text-zinc-800'
                      }`}
                    >
                      Prioritárias
                    </button>
                  </div>

                  {/* Lista de Minhas Tarefas */}
                  <div className="space-y-1.5 max-h-[360px] overflow-y-auto pr-1">
                    {filteredMyTasks.length === 0 ? (
                      <div className="h-36 flex flex-col items-center justify-center text-center p-3 border border-dashed border-zinc-200 rounded-xl bg-zinc-50/50">
                        <CheckCircle2 className="w-6 h-6 text-emerald-500/70 mb-1" />
                        <p className="text-xs font-semibold text-zinc-800">
                          Tudo em dia!
                        </p>
                        <p className="text-[10px] text-zinc-400 mt-0.5">
                          Nenhuma ação pendente neste filtro.
                        </p>
                      </div>
                    ) : (
                      filteredMyTasks.map((task) => {
                        const isConcluida = task.status === 'concluida';
                        const isForToday = task.scheduledDate === todayISO;
                        const isOverdue = Boolean(
                          task.scheduledDate &&
                          task.scheduledDate < todayISO &&
                          !isConcluida
                        );

                        return (
                          <div
                            key={task.id}
                            onClick={() => onTaskClick(task)}
                            className={`p-2.5 rounded-lg border border-l-[3.5px] text-xs transition-all cursor-pointer select-none ${
                              isOverdue
                                ? 'border-l-[4px] border-l-rose-500 border-rose-300/80 bg-rose-50/20 ring-1 ring-rose-400/20'
                                : task.priority === 'Urgente'
                                ? 'border-l-rose-500'
                                : task.priority === 'Alta'
                                ? 'border-l-amber-500'
                                : task.priority === 'Média'
                                ? 'border-l-blue-500'
                                : 'border-l-zinc-300'
                            } ${
                              isConcluida
                                ? 'border-zinc-200/70 bg-zinc-50/60 opacity-70'
                                : isOverdue
                                ? 'hover:border-rose-400 shadow-2xs'
                                : 'border-zinc-200/80 bg-white hover:border-zinc-300 hover:shadow-2xs'
                            }`}
                          >
                            <div className="flex items-start gap-2">
                              <button
                                type="button"
                                onClick={(e) => onToggleStatus(task.id, e)}
                                className={`mt-0.5 shrink-0 transition-colors ${
                                  isConcluida
                                    ? 'text-emerald-600'
                                    : isOverdue
                                    ? 'text-rose-400 hover:text-rose-600'
                                    : 'text-zinc-300 hover:text-blue-600'
                                }`}
                                title={
                                  isConcluida
                                    ? 'Reabrir tarefa'
                                    : isOverdue
                                    ? 'Ação Atrasada - Marcar como concluída'
                                    : 'Concluir tarefa'
                                }
                              >
                                {isConcluida ? (
                                  <CheckCircle2 className="w-4 h-4" />
                                ) : (
                                  <Circle className="w-4 h-4" />
                                )}
                              </button>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <p
                                    className={`text-[12px] font-medium leading-snug break-words ${
                                      isConcluida
                                        ? 'line-through text-zinc-400 font-normal'
                                        : 'text-zinc-900 font-medium'
                                    }`}
                                  >
                                    {task.title}
                                  </p>

                                  {isOverdue && (
                                    <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 border border-rose-300/80 animate-pulse shrink-0">
                                      <AlertCircle className="w-2.5 h-2.5 text-rose-600" />
                                      Atrasada
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-1.5 mt-1.5 text-[10px] text-zinc-500">
                                  <span className="font-semibold text-zinc-600">
                                    {task.priority}
                                  </span>
                                  <span>•</span>
                                  {task.scheduledDate ? (
                                    <span
                                      className={`flex items-center gap-0.5 ${
                                        isOverdue
                                          ? 'font-bold text-rose-700'
                                          : isForToday
                                          ? 'font-bold text-blue-700'
                                          : 'text-zinc-500'
                                      }`}
                                    >
                                      <Calendar className="w-2.5 h-2.5" />
                                      {isForToday
                                        ? 'Hoje'
                                        : task.scheduledDate.split('-').reverse().slice(0, 2).join('/')}
                                    </span>
                                  ) : (
                                    <span className="italic text-zinc-400">Não agendada</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* 3. RODAPÉ DA BARRA LATERAL: PERFIL DO USUÁRIO */}
      <div className="p-3 border-t border-zinc-200/70 bg-zinc-50/60 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 shadow-2xs ${currentUser.avatarColor}`}
            >
              {currentUser.initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-zinc-900 truncate leading-tight">
                {currentUser.name}
              </p>
              <span className="text-[10px] text-zinc-400 truncate block">
                {isAdmin ? '🛡️ Administrador' : '👤 Usuário Comum'}
              </span>
            </div>
          </div>

          {isAdmin && (
            <div className="flex items-center gap-1 shrink-0">
              <button
                id="footer-manage-tags-button"
                type="button"
                onClick={onOpenTagManagement}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  activeView === 'tag_management'
                    ? 'bg-blue-600 text-white'
                    : 'text-zinc-400 hover:text-blue-700 hover:bg-zinc-200/70'
                }`}
                title="Gerenciar Tags & Categorias (tags_bucket)"
              >
                <Tag className="w-4 h-4" />
              </button>

              <button
                id="footer-manage-team-button"
                type="button"
                onClick={onOpenTeamManagement}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  activeView === 'team_management'
                    ? 'bg-blue-600 text-white'
                    : 'text-zinc-400 hover:text-blue-700 hover:bg-zinc-200/70'
                }`}
                title="Gerenciar Equipe (perfis)"
              >
                <Users className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
