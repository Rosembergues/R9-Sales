import { RefreshCw } from 'lucide-react';
import TaskCatalogView from '../TaskCatalogView.tsx';
import WeeklyView from '../WeeklyView.tsx';
import MonthlyView from '../MonthlyView.tsx';
import WeeklyBalanceView from '../WeeklyBalanceView.tsx';
import TagManagementView from '../TagManagementView.tsx';
import UnscheduledRightSidebar from '../UnscheduledRightSidebar.tsx';
import type { PlannerState } from './usePlannerActions';

/** Área principal: calendário (com a Fila) ou Rotina da semana, Balanço e Tags. */
export default function PlannerBody({ st }: { st: PlannerState }) {
  const {
    tasks, teamMembers, tagBuckets, setTagBuckets, isLoadingTasks, isRealAdmin, userRole, activeView, models, modelsLoading, modelsError, currentUser, viewMode, todayDate, todayISO, isQueueSidebarCollapsed, setIsQueueSidebarCollapsed, selectedBucket, showQueue, goToCalendar, weekDates, monthCells, displayedTasks, canManageTask, openNewTask, openModel, handleDragStart, handleDropOnDate, handleDropToUnscheduled, handleRescheduleOverdue, handleToggleStatus, handleTaskClick, handleQuickAddTask,
  } = st;

  return (
    <>
    <div className="flex-1 min-h-0 flex overflow-hidden relative">
      {/* Calendário ou uma das telas do Planejamento (Rotina, Balanço, Tags) */}
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
        ) : (
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
            {showQueue && (
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
            )}
          </div>
        )}
      </main>
    </div>
    </>
  );
}
