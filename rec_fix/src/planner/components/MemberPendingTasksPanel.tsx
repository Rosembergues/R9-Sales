import React, { useState } from 'react';
import {
  CheckSquare,
  CheckCircle2,
  Circle,
  Clock,
  Zap,
  ChevronLeft,
  ChevronRight,
  Filter,
  Calendar,
  ShieldCheck,
} from 'lucide-react';
import { Task, TeamMember } from '../types.ts';
import { formatISO } from '../utils/dateUtils.ts';
import { isUserAssignedToTask } from '../utils/taskFilterUtils.ts';

interface MemberPendingTasksPanelProps {
  tasks: Task[];
  currentUser: TeamMember;
  todayISO: string;
  onTaskClick: (task: Task) => void;
  onToggleStatus: (taskId: string, e: React.MouseEvent) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export default function MemberPendingTasksPanel({
  tasks,
  currentUser,
  todayISO,
  onTaskClick,
  onToggleStatus,
  isCollapsed,
  onToggleCollapse,
}: MemberPendingTasksPanelProps) {
  const [filterMode, setFilterMode] = useState<'all' | 'today' | 'urgent'>('all');

  // Filtrar apenas tarefas atribuídas ao usuário logado (com suporte a múltiplos responsáveis)
  const myTasks = tasks.filter((t) => isUserAssignedToTask(t, currentUser));

  // Filtrar conforme o modo selecionado
  const filteredTasks = myTasks.filter((t) => {
    if (filterMode === 'today') {
      return t.scheduledDate === todayISO;
    }
    if (filterMode === 'urgent') {
      return t.priority === 'Urgente' || t.priority === 'Alta';
    }
    return true;
  });

  const pendingCount = myTasks.filter((t) => t.status !== 'concluida').length;
  const completedCount = myTasks.filter((t) => t.status === 'concluida').length;

  const getPriorityStyle = (priority: string) => {
    switch (priority) {
      case 'Urgente':
        return 'border-l-rose-500 text-rose-700 bg-rose-50/40';
      case 'Alta':
        return 'border-l-amber-500 text-amber-700 bg-amber-50/40';
      case 'Média':
        return 'border-l-blue-500 text-blue-700 bg-blue-50/40';
      case 'Baixa':
      default:
        return 'border-l-zinc-300 text-zinc-600 bg-zinc-50/40';
    }
  };

  if (isCollapsed) {
    return (
      <aside className="h-full w-12 bg-white border-r border-zinc-200/80 flex flex-col items-center py-3 justify-between select-none shrink-0 transition-all">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-md transition-colors cursor-pointer"
          title="Expandir Minhas Tarefas"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        <div className="flex flex-col items-center gap-3">
          <div
            className="w-8 h-8 rounded-full bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center text-xs font-bold"
            title={`${pendingCount} pendências`}
          >
            {pendingCount}
          </div>
          <CheckSquare className="w-4 h-4 text-blue-600" />
        </div>

        <div className="h-6" />
      </aside>
    );
  }

  return (
    <aside
      id="member-pending-tasks-panel"
      className="h-full w-64 lg:w-72 bg-white border-r border-zinc-200/80 flex flex-col shrink-0 select-none overflow-hidden transition-all duration-200"
    >
      {/* Cabeçalho */}
      <div className="p-3.5 border-b border-zinc-200/70 flex items-center justify-between bg-zinc-50/60 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
            <CheckSquare className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-zinc-900 leading-tight">
              Minhas Ações
            </h3>
            <span className="text-[10px] text-zinc-500">
              {pendingCount} pendente(s) • {completedCount} concluída(s)
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onToggleCollapse}
          className="p-1 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200/60 rounded-md transition-colors cursor-pointer"
          title="Recolher painel"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      {/* Filtros Rápidos (Linear Style) */}
      <div className="p-2.5 border-b border-zinc-100 bg-zinc-50/40 flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={() => setFilterMode('all')}
          className={`flex-1 py-1 px-2 text-[11px] font-medium rounded-md text-center transition-colors cursor-pointer ${
            filterMode === 'all'
              ? 'bg-white text-zinc-900 shadow-2xs font-semibold'
              : 'text-zinc-500 hover:text-zinc-800'
          }`}
        >
          Todas ({myTasks.length})
        </button>
        <button
          type="button"
          onClick={() => setFilterMode('today')}
          className={`py-1 px-2 text-[11px] font-medium rounded-md text-center transition-colors cursor-pointer ${
            filterMode === 'today'
              ? 'bg-white text-blue-700 shadow-2xs font-semibold'
              : 'text-zinc-500 hover:text-zinc-800'
          }`}
        >
          Hoje
        </button>
        <button
          type="button"
          onClick={() => setFilterMode('urgent')}
          className={`py-1 px-2 text-[11px] font-medium rounded-md text-center transition-colors cursor-pointer ${
            filterMode === 'urgent'
              ? 'bg-white text-rose-700 shadow-2xs font-semibold'
              : 'text-zinc-500 hover:text-zinc-800'
          }`}
        >
          Prioritárias
        </button>
      </div>

      {/* Lista de Ações do Usuário */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {filteredTasks.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center text-center p-3 border border-dashed border-zinc-200 rounded-xl bg-zinc-50/50">
            <CheckCircle2 className="w-7 h-7 text-emerald-500/70 mb-1.5" />
            <p className="text-xs font-semibold text-zinc-800">
              Tudo em dia!
            </p>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Nenhuma ação pendente neste filtro.
            </p>
          </div>
        ) : (
          filteredTasks.map((task) => {
            const isConcluida = task.status === 'concluida';
            const isForToday = task.scheduledDate === todayISO;

            return (
              <div
                key={task.id}
                onClick={() => onTaskClick(task)}
                className={`p-2.5 rounded-lg border border-l-[3.5px] text-xs transition-all cursor-pointer select-none ${getPriorityStyle(
                  task.priority
                )} ${
                  isConcluida
                    ? 'border-zinc-200/70 bg-zinc-50/60 opacity-70'
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
                        : 'text-zinc-300 hover:text-blue-600'
                    }`}
                    title={isConcluida ? 'Reabrir tarefa' : 'Concluir tarefa'}
                  >
                    {isConcluida ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <Circle className="w-4 h-4" />
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-[12px] font-medium leading-snug break-words ${
                        isConcluida
                          ? 'line-through text-zinc-400 font-normal'
                          : 'text-zinc-900'
                      }`}
                    >
                      {task.title}
                    </p>

                    <div className="flex items-center gap-1.5 mt-1.5 text-[10px] text-zinc-500">
                      <span className="font-semibold text-zinc-600">
                        {task.priority}
                      </span>
                      <span>•</span>
                      {task.scheduledDate ? (
                        <span
                          className={`flex items-center gap-0.5 ${
                            isForToday
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

                      {isConcluida && (
                        Boolean(
                          task.completedByAdmin ||
                          task.completed_by_admin ||
                          task.finalizada_por_admin ||
                          (task.userSubmissions &&
                            Object.keys(task.userSubmissions).length > 0 &&
                            Object.values(task.userSubmissions).every(
                              (s) => s.completed && (s.completedByAdmin || s.completed_by_admin || s.finalizada_por_admin)
                            ))
                        )
                      ) && (
                        <>
                          <span>•</span>
                          <span
                            className="inline-flex items-center gap-0.5 text-[9.5px] font-semibold text-[#004691] bg-blue-50 px-1 py-0.2 rounded border border-blue-200/60"
                            title="Finalizada por Administrador"
                          >
                            <ShieldCheck className="w-2.5 h-2.5 text-[#004691]" />
                            <span>Admin</span>
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Dica de rodapé */}
      <div className="p-2.5 border-t border-zinc-100 bg-zinc-50/60 text-center text-[10px] text-zinc-400">
        Clique no checkbox para concluir ou no card para ver detalhes
      </div>
    </aside>
  );
}
