import React, { useState } from 'react';
import { Plus, Calendar, AlertCircle } from 'lucide-react';
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
  onRescheduleOverdue?: () => void;
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
  onRescheduleOverdue,
}: WeeklyViewProps) {
  const isAdmin = userRole === 'admin';
  const todayISO = formatISO(todayDate);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);

  // Nomes dos dias em formato limpo
  const getDayLabel = (dateObj: Date) => WEEKDAYS_PT[dateObj.getDay()].replace('-feira', '').slice(0, 3);
  const overdueTasks = tasks.filter((task) => task.scheduledDate && task.scheduledDate < todayISO && task.status !== 'concluida');
  const visibleDates = weekDates.slice(0, 5).concat(weekDates.slice(5).filter((date) => tasks.some((task) => task.scheduledDate === formatISO(date))));

  return (
    <div className="h-full w-full p-3 sm:p-4 overflow-x-auto select-none bg-[#f7f9fb]">
      <div className="h-full min-w-[780px] flex flex-col gap-2">
        {overdueTasks.length > 0 && <section className="shrink-0 rounded-xl border border-rose-200 bg-rose-50/70 px-3 py-2 flex items-center gap-2 text-xs">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span className="font-semibold text-rose-900">Atrasadas · {overdueTasks.length}</span>
          <div className="flex-1 flex gap-1 overflow-hidden">{overdueTasks.slice(0, 3).map((task) => <button key={task.id} onClick={() => onTaskClick(task)} className="max-w-40 truncate text-rose-800 hover:underline">{task.title}</button>)}{overdueTasks.length > 3 && <span className="text-rose-700">+{overdueTasks.length - 3}</span>}</div>
          {isAdmin && <button onClick={onRescheduleOverdue} className="shrink-0 rounded-md bg-white px-2 py-1 font-semibold text-rose-800 border border-rose-200 hover:bg-rose-100">Reagendar para hoje</button>}
        </section>}
      <div className="grid gap-3 sm:gap-3.5 flex-1 min-h-0" style={{ gridTemplateColumns: `repeat(${visibleDates.length}, minmax(0, 1fr))` }}>
        {visibleDates.map((dateObj) => {
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
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                      isToday ? 'bg-[#004691] text-white' : 'text-slate-800'
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
                    {dayTasks.filter((task) => task.status === 'concluida').length}/{dayTasks.length}
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
                className={`planner-task-list flex-1 p-2.5 overflow-y-auto space-y-2.5 transition-colors ${
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
                    <p className="text-xs font-normal text-slate-400">Sem tarefas</p>
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
    </div>
  );
}


