import React, { useState } from 'react';
import { Plus, AlertCircle } from 'lucide-react';
import { Task, TeamMember, UserRole } from '../types.ts';
import { MonthDayCell, WEEKDAYS_SHORT_PT, getTodayISO } from '../utils/dateUtils.ts';

interface MonthlyViewProps {
  monthCells: MonthDayCell[];
  tasks: Task[];
  teamMembers: TeamMember[];
  userRole: UserRole;
  todayISO?: string;
  onTaskClick: (task: Task) => void;
  onToggleStatus: (taskId: string, e: React.MouseEvent) => void;
  onDragStart: (e: React.DragEvent, task: Task) => void;
  onDropOnDate: (dateString: string, e: React.DragEvent) => void;
  onQuickAddTask: (dateString: string) => void;
}

export default function MonthlyView({
  monthCells,
  tasks,
  teamMembers,
  userRole,
  todayISO = getTodayISO(),
  onTaskClick,
  onToggleStatus,
  onDragStart,
  onDropOnDate,
  onQuickAddTask,
}: MonthlyViewProps) {
  const isAdmin = userRole === 'admin';
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);

  const getPriorityDot = (priority: string) => {
    switch (priority) {
      case 'Urgente':
        return 'bg-rose-500';
      case 'Alta':
        return 'bg-amber-500';
      case 'Média':
        return 'bg-blue-500';
      case 'Baixa':
      default:
        return 'bg-zinc-300';
    }
  };

  return (
    <div className="h-full w-full p-3 sm:p-4 md:p-5 overflow-y-auto bg-[#f8f9fa]/90 flex flex-col select-none">
      {/* Cabeçalho dos Dias da Semana */}
      <div className="grid grid-cols-7 gap-2 mb-2 shrink-0">
        {WEEKDAYS_SHORT_PT.map((dayName) => (
          <div
            key={dayName}
            className="text-center py-2 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider bg-white rounded-lg border border-zinc-200/80 shadow-2xs"
          >
            {dayName}
          </div>
        ))}
      </div>

      {/* Grade Mensal de Células */}
      <div className="grid grid-cols-7 gap-2 flex-1 auto-rows-fr min-h-[560px]">
        {monthCells.map((cell) => {
          const dateISO = cell.dateString;
          const dayTasks = tasks.filter((t) => t.scheduledDate === dateISO);
          const isDragOver = dragOverDate === dateISO;

          return (
            <div
              key={dateISO}
              id={`coluna-mes-${dateISO}`}
              onDragOver={(e) => {
                if (isAdmin) {
                  e.preventDefault();
                  setDragOverDate(dateISO);
                }
              }}
              onDragLeave={() => {
                if (dragOverDate === dateISO) {
                  setDragOverDate(null);
                }
              }}
              onDrop={(e) => {
                setDragOverDate(null);
                if (isAdmin) {
                  onDropOnDate(dateISO, e);
                }
              }}
              className={`min-h-[105px] rounded-xl border p-2 flex flex-col justify-between transition-all group ${
                isDragOver
                  ? 'border-blue-500 ring-2 ring-blue-500/25 bg-blue-50/40'
                  : cell.isToday
                  ? 'border-blue-300/90 ring-1 ring-blue-500/20 bg-white shadow-xs'
                  : cell.isCurrentMonth
                  ? 'border-zinc-200/80 bg-white shadow-2xs hover:border-zinc-300'
                  : 'border-zinc-200/50 bg-zinc-50/40 opacity-55'
              }`}
            >
              {/* Topo da Célula do Dia */}
              <div className="flex items-center justify-between mb-1 shrink-0">
                <span
                  className={`text-xs font-semibold w-5 h-5 flex items-center justify-center rounded-full ${
                    cell.isToday
                      ? 'bg-blue-600 text-white font-bold shadow-2xs'
                      : cell.isCurrentMonth
                      ? 'text-zinc-800'
                      : 'text-zinc-400'
                  }`}
                >
                  {cell.dayNumber}
                </span>

                <div className="flex items-center gap-1">
                  {dayTasks.length > 0 && (
                    <span className="text-[10px] font-medium text-zinc-500 px-1.5 py-0.2 rounded-full bg-zinc-100">
                      {dayTasks.length}
                    </span>
                  )}
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => onQuickAddTask(dateISO)}
                      className="opacity-0 group-hover:opacity-100 p-0.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded transition-all cursor-pointer"
                      title="Adicionar ação neste dia"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Lista compacta de tarefas no dia */}
              <div className="flex-1 overflow-y-auto space-y-1 pr-0.5 max-h-[95px]">
                {dayTasks.map((task) => {
                  const isConcluida = task.status === 'concluida';
                  const isOverdue = Boolean(
                    task.scheduledDate &&
                    task.scheduledDate < todayISO &&
                    !isConcluida
                  );
                  const assigneeIds = task.assignedToIds || (task.assignedTo ? [task.assignedTo] : []);
                  const assignedMembers = teamMembers.filter((m) => assigneeIds.includes(m.id));

                  return (
                    <div
                      key={task.id}
                      id={`month-task-${task.id}`}
                      draggable={isAdmin}
                      onDragStart={(e) => {
                        if (isAdmin) {
                          onDragStart(e, task);
                        }
                      }}
                      onClick={() => onTaskClick(task)}
                      className={`text-[11px] p-1.5 rounded-md border flex items-center justify-between gap-1 transition-all ${
                        isAdmin ? 'cursor-grab active:cursor-grabbing hover:border-zinc-300' : 'cursor-pointer'
                      } ${
                        isConcluida
                          ? 'bg-zinc-50/70 border-zinc-200/50 text-zinc-400 line-through'
                          : isOverdue
                          ? 'bg-rose-50/80 border-rose-300 text-rose-950 ring-1 ring-rose-400/40'
                          : 'bg-white border-zinc-200/70 text-zinc-800 hover:shadow-2xs'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        {isOverdue ? (
                          <AlertCircle className="w-3 h-3 text-rose-600 shrink-0 animate-pulse" />
                        ) : (
                          <span
                            className={`w-1.5 h-1.5 rounded-full shrink-0 ${getPriorityDot(
                              task.priority
                            )}`}
                          />
                        )}
                        <span className="truncate font-medium leading-tight text-zinc-800">
                          {task.title}
                        </span>
                      </div>

                      {assignedMembers.length > 0 && (
                        <div
                          className="flex items-center -space-x-1 shrink-0"
                          title={assignedMembers.map((m) => m.name).join(', ')}
                        >
                          {assignedMembers.slice(0, 2).map((m) => (
                            <div
                              key={m.id}
                              className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white ring-1 ring-white shadow-2xs shrink-0"
                              style={{ backgroundColor: m.color || '#004691' }}
                            >
                              {m.avatar || m.name.charAt(0)}
                            </div>
                          ))}
                          {assignedMembers.length > 2 && (
                            <div className="w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-bold text-white bg-slate-700 ring-1 ring-white shadow-2xs shrink-0">
                              +{assignedMembers.length - 2}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {isDragOver && (
                <div className="mt-1 text-[10px] text-center text-blue-600 font-semibold bg-blue-50/80 p-1 rounded border border-dashed border-blue-400">
                  Soltar aqui
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

