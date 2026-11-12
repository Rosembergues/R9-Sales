import { ChevronLeft, ChevronRight, Inbox, Plus, SlidersHorizontal } from 'lucide-react';
import { formatWeekInterval, MONTH_NAMES_PT } from '../../utils/dateUtils.ts';
import type { PlannerState } from './usePlannerActions';

/** Cabeçalho: título, período, Semana/Mês, Equipe/Eu, filtros, Fila e Nova tarefa. */
export default function PlannerHeader({ st }: { st: PlannerState }) {
  const {
    section, tasks, teamMembers, activeView, viewMode, setViewMode, currentReferenceDate, setIsQueueSidebarCollapsed, navFilter, setNavFilter, selectedBucket, setSelectedBucket, taskSearch, setTaskSearch, selectedAssignee, setSelectedAssignee, selectedStatus, setSelectedStatus, showQueue, setShowQueue, filtersOpen, setFiltersOpen, allBuckets, weekDates, periodTaskCount, handlePrev, handleNext, handleToday, openNewTask,
  } = st;

  return (
    <>
    {(() => {
      const isCalendar = activeView === 'planner' && (section === 'calendar' || section === 'my_tasks' || section === 'queue');
      const hidden = section === 'summary' || section === 'tags';
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
    </>
  );
}
