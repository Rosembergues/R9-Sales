import React from 'react';
import {
  Calendar,
  CheckCircle2,
  Circle,
  TrendingUp,
  Clock,
  Zap,
  Users,
  ChevronLeft,
  ChevronRight,
  CheckSquare,
} from 'lucide-react';
import { Task, TeamMember } from '../types.ts';
import { formatISO, MONTH_NAMES_PT } from '../utils/dateUtils.ts';

interface AdminDaySummaryPanelProps {
  tasks: Task[];
  teamMembers: TeamMember[];
  todayISO: string;
  todayDate: Date;
  onTaskClick: (task: Task) => void;
  onToggleStatus: (taskId: string, e: React.MouseEvent) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export default function AdminDaySummaryPanel({
  tasks,
  teamMembers,
  todayISO,
  todayDate,
  onTaskClick,
  onToggleStatus,
  isCollapsed,
  onToggleCollapse,
}: AdminDaySummaryPanelProps) {
  // Tarefas de hoje
  const todayTasks = tasks.filter((t) => t.scheduledDate === todayISO);
  const completedToday = todayTasks.filter((t) => t.status === 'concluida').length;
  const pendingToday = todayTasks.filter((t) => t.status !== 'concluida').length;
  const totalToday = todayTasks.length;
  const completionPercentage = totalToday > 0 ? Math.round((completedToday / totalToday) * 100) : 0;

  // Prioridades hoje
  const urgentCount = todayTasks.filter((t) => t.priority === 'Urgente' && t.status !== 'concluida').length;
  const highCount = todayTasks.filter((t) => t.priority === 'Alta' && t.status !== 'concluida').length;
  const mediumCount = todayTasks.filter((t) => t.priority === 'Média' && t.status !== 'concluida').length;
  const lowCount = todayTasks.filter((t) => t.priority === 'Baixa' && t.status !== 'concluida').length;

  // Membros com tarefas hoje
  const assignedMemberIds = Array.from(new Set(todayTasks.map((t) => t.assignedTo).filter(Boolean)));

  const dayNumber = todayDate.getDate();
  const monthName = MONTH_NAMES_PT[todayDate.getMonth()];

  if (isCollapsed) {
    return (
      <aside className="h-full w-12 bg-white border-r border-zinc-200/80 flex flex-col items-center py-3 justify-between select-none shrink-0 transition-all">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-md transition-colors cursor-pointer"
          title="Expandir Resumo do Dia"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        <div className="flex flex-col items-center gap-4">
          <div className="flex flex-col items-center text-center">
            <span className="text-[10px] font-bold text-blue-600 uppercase">Hoje</span>
            <span className="text-sm font-bold text-zinc-900">{dayNumber}</span>
          </div>

          <div
            className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center text-[10px] font-bold"
            title={`${completionPercentage}% concluído`}
          >
            {completionPercentage}%
          </div>

          <div
            className="flex flex-col items-center text-zinc-500"
            title={`${pendingToday} tarefas pendentes hoje`}
          >
            <Clock className="w-4 h-4 text-amber-500 mb-0.5" />
            <span className="text-[11px] font-semibold">{pendingToday}</span>
          </div>
        </div>

        <div className="h-6" />
      </aside>
    );
  }

  return (
    <aside
      id="admin-day-summary-panel"
      className="h-full w-64 lg:w-72 bg-white border-r border-zinc-200/80 flex flex-col shrink-0 select-none overflow-hidden transition-all duration-200"
    >
      {/* Cabeçalho do Painel */}
      <div className="p-3.5 border-b border-zinc-200/70 flex items-center justify-between bg-zinc-50/60 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-700 flex items-center justify-center shrink-0">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-zinc-900 leading-tight">
              Resumo do Dia
            </h3>
            <span className="text-[10px] text-zinc-500">
              {dayNumber} de {monthName}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onToggleCollapse}
          className="p-1 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200/60 rounded-md transition-colors cursor-pointer"
          title="Recolher painel de resumo"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      {/* Conteúdo Rolável */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
        {/* Card de Progresso Geral */}
        <div className="p-3 bg-gradient-to-br from-zinc-50 to-blue-50/40 rounded-xl border border-zinc-200/70 shadow-2xs">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="font-semibold text-zinc-800 flex items-center gap-1.5">
              <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
              Execução Hoje
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

        {/* Indicadores de Prioridade */}
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 block mb-1.5">
            Pendências por Prioridade
          </span>
          <div className="grid grid-cols-2 gap-1.5">
            <div className="p-2 rounded-lg bg-rose-50/70 border border-rose-200/60 flex items-center justify-between">
              <span className="text-[11px] font-medium text-rose-800 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                Urgente
              </span>
              <span className="text-xs font-bold text-rose-900">{urgentCount}</span>
            </div>

            <div className="p-2 rounded-lg bg-amber-50/70 border border-amber-200/60 flex items-center justify-between">
              <span className="text-[11px] font-medium text-amber-800 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                Alta
              </span>
              <span className="text-xs font-bold text-amber-900">{highCount}</span>
            </div>

            <div className="p-2 rounded-lg bg-blue-50/70 border border-blue-200/60 flex items-center justify-between">
              <span className="text-[11px] font-medium text-blue-800 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                Média
              </span>
              <span className="text-xs font-bold text-blue-900">{mediumCount}</span>
            </div>

            <div className="p-2 rounded-lg bg-zinc-50 border border-zinc-200/70 flex items-center justify-between">
              <span className="text-[11px] font-medium text-zinc-700 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-zinc-400" />
                Baixa
              </span>
              <span className="text-xs font-bold text-zinc-800">{lowCount}</span>
            </div>
          </div>
        </div>

        {/* Lista Rápida de Ações de Hoje */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              Ações de Hoje ({totalToday})
            </span>
          </div>

          {todayTasks.length === 0 ? (
            <div className="text-center py-6 border border-dashed border-zinc-200 rounded-lg text-zinc-400 text-xs">
              Nenhuma ação hoje
            </div>
          ) : (
            <div className="space-y-1.5">
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
      </div>
    </aside>
  );
}
