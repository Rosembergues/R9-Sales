import React, { useState } from 'react';
import { Plus, Calendar, CalendarDays } from 'lucide-react';
import { Task, TeamMember, UserRole } from '../types.ts';
import { formatISO, WEEKDAYS_PT, MONTH_NAMES_PT } from '../utils/dateUtils.ts';
import TaskCard from './TaskCard.tsx';

interface WeeklyViewProps {
  weekDates: Date[];
  tasks: Task[];
  teamMembers: TeamMember[];
  userRole: UserRole;
  todayDate: Date;
  onTaskClick: (task: Task) => void;
  onToggleStatus: (taskId: string, e: React.MouseEvent) => void;
  onDragStart: (e: React.DragEvent, task: Task) => void;
  onDropOnDate: (dateString: string, e: React.DragEvent) => void;
  onQuickAddTask: (dateString: string) => void;
}

export default function WeeklyView({
  weekDates,
  tasks,
  teamMembers,
  userRole,
  todayDate,
  onTaskClick,
  onToggleStatus,
  onDragStart,
  onDropOnDate,
  onQuickAddTask,
}: WeeklyViewProps) {
  const isAdmin = userRole === 'admin';
  const todayISO = formatISO(todayDate);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);

  // Nomes dos dias em formato limpo
  const getDayLabel = (dateObj: Date) => {
    const raw = WEEKDAYS_PT[dateObj.getDay()];
    return raw.replace('-feira', '');
  };

  return (
    <div className="h-full w-full p-3 sm:p-4 overflow-x-auto select-none bg-[#f7f9fb]">
      <div className="grid grid-cols-7 gap-3 sm:gap-3.5 h-full min-w-[1100px] xl:min-w-0">
        {weekDates.map((dateObj) => {
          const dateISO = formatISO(dateObj);
          const isToday = dateISO === todayISO;
          const isDragOver = dragOverDate === dateISO;
          const cleanDayName = getDayLabel(dateObj);
          const dayNumber = dateObj.getDate();
          const monthShort = MONTH_NAMES_PT[dateObj.getMonth()].slice(0, 3);

          // Filtrar tarefas agendadas para este dia
          const dayTasks = tasks.filter((t) => t.scheduledDate === dateISO);

          return (
            <div
              key={dateISO}
              id={`coluna-semana-${dateISO}`}
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
              className={`flex flex-col h-full rounded-2xl overflow-hidden border transition-all duration-150 shadow-[0_2px_8px_rgba(0,0,0,0.03)] ${
                isDragOver
                  ? 'border-[#004691] ring-2 ring-[#004691]/25 bg-blue-50/40'
                  : isToday
                  ? 'border-[#004691]/40 bg-white ring-1 ring-[#004691]/15'
                  : 'border-slate-200/80 bg-white hover:border-slate-300'
              }`}
            >
              {/* Cabeçalho do Dia */}
              <div
                className={`px-3.5 py-3 border-b shrink-0 flex items-center justify-between transition-colors ${
                  isToday
                    ? 'bg-blue-50/50 border-blue-200/70 text-[#003067]'
                    : 'bg-white border-slate-100 text-slate-800'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {/* Número do dia grande e nítido */}
                  <span
                    className={`text-base font-bold shrink-0 ${
                      isToday ? 'text-[#004691]' : 'text-slate-800'
                    }`}
                  >
                    {dayNumber}
                  </span>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1 leading-none">
                      <span className="text-[13px] font-semibold text-slate-900 truncate capitalize">
                        {cleanDayName}
                      </span>
                      {isToday && (
                        <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-full bg-[#003067] text-white leading-none">
                          Hoje
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400 font-medium mt-0.5 block leading-none">
                      {monthShort}
                    </span>
                  </div>
                </div>

                {/* Contagem de Tarefas & Botão Quick Add */}
                <div className="flex items-center gap-1.5">
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                      isToday
                        ? 'bg-blue-100 text-[#003067]'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {dayTasks.length}
                  </span>

                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => onQuickAddTask(dateISO)}
                      className="p-1 text-slate-400 hover:text-[#003067] hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                      title="Adicionar ação neste dia"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Lista de Ações do Dia */}
              <div
                className={`flex-1 p-2.5 overflow-y-auto space-y-2.5 transition-colors ${
                  isDragOver ? 'bg-blue-50/20' : 'bg-transparent'
                }`}
              >
                {isDragOver && (
                  <div className="border-2 border-dashed border-[#004691] rounded-xl p-3 text-center text-xs font-semibold text-[#003067] bg-blue-50/70 animate-pulse">
                    Soltar para agendar em {dayNumber} de {monthShort}
                  </div>
                )}

                {dayTasks.length === 0 && !isDragOver ? (
                  <div className="h-40 flex flex-col items-center justify-center text-center p-3 text-slate-400">
                    <Calendar className="w-5 h-5 opacity-25 mb-1.5 text-slate-500" />
                    <p className="text-xs font-normal text-slate-400">No tasks</p>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => onQuickAddTask(dateISO)}
                        className="mt-1.5 text-xs text-[#004691] hover:text-[#003067] hover:underline font-semibold cursor-pointer"
                      >
                        + Adicionar
                      </button>
                    )}
                  </div>
                ) : (
                  dayTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      teamMembers={teamMembers}
                      userRole={userRole}
                      onClick={onTaskClick}
                      onToggleStatus={onToggleStatus}
                      onDragStart={onDragStart}
                      todayISO={todayISO}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


