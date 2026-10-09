import React from 'react';
import {
  Sun,
  CheckSquare,
  Calendar,
  Zap,
  Inbox,
  FolderKanban,
  ChevronLeft,
  ChevronRight,
  Plus,
} from 'lucide-react';
import { TeamMember, UserRole } from '../types.ts';

export type NavFilter = 'all' | 'my_day' | 'my_tasks' | 'urgent' | 'unscheduled';

interface NavigationSidebarProps {
  currentFilter: NavFilter;
  onSelectFilter: (filter: NavFilter) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  currentUser: TeamMember;
  userRole: UserRole;
  counts: {
    myDay: number;
    myTasks: number;
    all: number;
    urgent: number;
    unscheduled: number;
  };
  selectedBucket: string | null;
  onSelectBucket: (bucket: string | null) => void;
  buckets: string[];
  onOpenNewTaskModal?: () => void;
}

export default function NavigationSidebar({
  currentFilter,
  onSelectFilter,
  isCollapsed,
  onToggleCollapse,
  currentUser,
  userRole,
  counts,
  selectedBucket,
  onSelectBucket,
  buckets,
  onOpenNewTaskModal,
}: NavigationSidebarProps) {
  const navItems = [
    {
      id: 'my_day' as NavFilter,
      label: 'Meu dia',
      icon: Sun,
      color: 'text-amber-500',
      activeBg: 'bg-amber-50 text-amber-900 font-medium',
      count: counts.myDay,
    },
    {
      id: 'my_tasks' as NavFilter,
      label: 'Minhas tarefas',
      icon: CheckSquare,
      color: 'text-blue-500',
      activeBg: 'bg-blue-50 text-blue-900 font-medium',
      count: counts.myTasks,
    },
    {
      id: 'urgent' as NavFilter,
      label: 'Importantes',
      icon: Zap,
      color: 'text-rose-500',
      activeBg: 'bg-rose-50 text-rose-900 font-medium',
      count: counts.urgent,
    },
    {
      id: 'all' as NavFilter,
      label: 'Planejador Geral',
      icon: Calendar,
      color: 'text-indigo-500',
      activeBg: 'bg-zinc-100 text-zinc-900 font-medium',
      count: counts.all,
    },
    {
      id: 'unscheduled' as NavFilter,
      label: 'Não Agendadas',
      icon: Inbox,
      color: 'text-amber-600',
      activeBg: 'bg-amber-50 text-amber-900 font-medium',
      count: counts.unscheduled,
    },
  ];

  return (
    <aside
      id="planner-navigation-sidebar"
      className={`h-full bg-white border-r border-zinc-200/80 flex flex-col justify-between shrink-0 transition-all duration-200 z-30 select-none ${
        isCollapsed ? 'w-16' : 'w-60 lg:w-64'
      }`}
    >
      {/* Topo: Logo + Botão de Recolher */}
      <div className="flex flex-col">
        <div className="h-14 px-3.5 border-b border-zinc-200/70 flex items-center justify-between">
          {!isCollapsed && (
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-2xs shrink-0">
                <FolderKanban className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h2 className="text-xs font-bold text-zinc-900 leading-none truncate">
                  Planner To-Do
                </h2>
                <span className="text-[10px] text-zinc-400 font-medium mt-0.5 block leading-none truncate">
                  Workspace da Equipe
                </span>
              </div>
            </div>
          )}

          {isCollapsed && (
            <div className="w-full flex justify-center">
              <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-2xs">
                <FolderKanban className="w-4 h-4" />
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={onToggleCollapse}
            className={`p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-md transition-colors cursor-pointer ${
              isCollapsed ? 'hidden' : 'block'
            }`}
            title={isCollapsed ? 'Expandir barra lateral' : 'Recolher barra lateral'}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        {/* Botão de Ação Rápida: Nova Tarefa (apenas Admin) */}
        {userRole === 'admin' && onOpenNewTaskModal && (
          <div className="p-3 border-b border-zinc-100">
            <button
              type="button"
              onClick={onOpenNewTaskModal}
              className={`w-full flex items-center justify-center gap-2 py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg shadow-2xs transition-all cursor-pointer ${
                isCollapsed ? 'px-0' : ''
              }`}
              title="Criar nova tarefa"
            >
              <Plus className="w-4 h-4 shrink-0" />
              {!isCollapsed && <span>Nova Tarefa</span>}
            </button>
          </div>
        )}

        {/* Lista de Navegação Principal */}
        <nav className="p-2 space-y-1">
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
                } ${isCollapsed ? 'justify-center px-0' : ''}`}
                title={item.label}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon className={`w-4 h-4 shrink-0 ${item.color}`} />
                  {!isCollapsed && (
                    <span className="truncate">{item.label}</span>
                  )}
                </div>

                {!isCollapsed && item.count > 0 && (
                  <span
                    className={`text-[11px] px-1.5 py-0.2 rounded-full font-medium ${
                      isActive
                        ? 'bg-white/80 text-zinc-900 shadow-2xs'
                        : 'text-zinc-400 bg-zinc-100'
                    }`}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Seção de Planos / Categorias (Buckets) */}
        {!isCollapsed && (
          <div className="mt-3 px-3">
            <div className="flex items-center justify-between mb-1.5 px-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                Planos & Categorias
              </span>
              {selectedBucket && (
                <button
                  type="button"
                  onClick={() => onSelectBucket(null)}
                  className="text-[10px] text-blue-600 hover:underline cursor-pointer"
                >
                  Limpar
                </button>
              )}
            </div>

            <div className="space-y-0.5 max-h-48 overflow-y-auto pr-1">
              {buckets.map((bucket) => {
                const isBucketActive = selectedBucket === bucket;
                return (
                  <button
                    key={bucket}
                    type="button"
                    onClick={() => {
                      onSelectBucket(isBucketActive ? null : bucket);
                    }}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs transition-colors cursor-pointer ${
                      isBucketActive
                        ? 'bg-zinc-100 font-semibold text-zinc-900'
                        : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 font-normal'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        bucket === 'Financeiro'
                          ? 'bg-emerald-500'
                          : bucket === 'Tecnologia'
                          ? 'bg-blue-500'
                          : bucket === 'Marketing'
                          ? 'bg-purple-500'
                          : bucket === 'Estratégico'
                          ? 'bg-amber-500'
                          : 'bg-pink-500'
                      }`}
                    />
                    <span className="truncate">{bucket}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Rodapé: Perfil do Usuário e Botão de Expandir quando colapsado */}
      <div className="p-2.5 border-t border-zinc-200/70 bg-zinc-50/50">
        {isCollapsed ? (
          <div className="flex flex-col items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${currentUser.avatarColor}`}
              title={`${currentUser.name} (${userRole === 'admin' ? 'Admin' : 'Membro'})`}
            >
              {currentUser.initials}
            </div>
            <button
              type="button"
              onClick={onToggleCollapse}
              className="p-1 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200/60 rounded cursor-pointer"
              title="Expandir barra lateral"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${currentUser.avatarColor}`}
            >
              {currentUser.initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-zinc-900 truncate leading-tight">
                {currentUser.name}
              </p>
              <span className="text-[10px] text-zinc-400 truncate block">
                {userRole === 'admin' ? '🛡️ Administrador' : '👤 Usuário Comum'}
              </span>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
