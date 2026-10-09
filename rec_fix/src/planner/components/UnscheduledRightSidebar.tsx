import React, { useState } from 'react';
import {
  Inbox,
  Search,
  Plus,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  SlidersHorizontal,
} from 'lucide-react';
import { Task, TeamMember, UserRole } from '../types.ts';
import TaskCard from './TaskCard.tsx';

interface UnscheduledRightSidebarProps {
  tasks: Task[];
  teamMembers: TeamMember[];
  userRole: UserRole;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onTaskClick: (task: Task) => void;
  onToggleStatus: (taskId: string, e: React.MouseEvent) => void;
  onDragStart: (e: React.DragEvent, task: Task) => void;
  onOpenNewTaskModal: () => void;
  onDropToUnscheduled: (e: React.DragEvent) => void;
}

export default function UnscheduledRightSidebar({
  tasks,
  teamMembers,
  userRole,
  isCollapsed,
  onToggleCollapse,
  onTaskClick,
  onToggleStatus,
  onDragStart,
  onOpenNewTaskModal,
  onDropToUnscheduled,
}: UnscheduledRightSidebarProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);

  const unscheduledTasks = tasks.filter((t) => !t.scheduledDate);

  const filteredTasks = unscheduledTasks.filter((task) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const matchTitle = task.title.toLowerCase().includes(term);
    const matchBucket = task.bucket?.toLowerCase().includes(term);
    const matchTags = task.tags?.some((t) => t.toLowerCase().includes(term));
    return matchTitle || matchBucket || matchTags;
  });

  const isAdmin = userRole === 'admin';

  if (isCollapsed) {
    return (
      <aside
        id="unscheduled-sidebar-collapsed"
        className={`h-full w-12 bg-white border-l border-slate-200/80 flex flex-col items-center py-3 justify-between select-none shrink-0 transition-all ${
          isDragOver ? 'border-[#004691] bg-blue-50/50' : ''
        }`}
        onDragOver={(e) => {
          if (isAdmin) {
            e.preventDefault();
            setIsDragOver(true);
          }
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          if (isAdmin) {
            setIsDragOver(false);
            onDropToUnscheduled(e);
          }
        }}
      >
        <button
          type="button"
          onClick={onToggleCollapse}
          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          title="Expandir Fila de Tarefas (Pending Actions)"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="flex flex-col items-center gap-2">
          <div
            className="w-7 h-7 rounded-full bg-blue-50 text-[#003067] border border-blue-200 flex items-center justify-center text-xs font-bold"
            title={`${unscheduledTasks.length} ações pendentes`}
          >
            {unscheduledTasks.length}
          </div>
          <Inbox className="w-4 h-4 text-slate-500" />
        </div>

        {isAdmin ? (
          <button
            type="button"
            onClick={onOpenNewTaskModal}
            className="p-1.5 text-[#003067] hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            title="Adicionar ação na fila"
          >
            <Plus className="w-4 h-4" />
          </button>
        ) : (
          <div className="h-6" />
        )}
      </aside>
    );
  }

  return (
    <aside
      id="unscheduled-right-sidebar"
      className={`h-full w-72 lg:w-80 bg-white border-l border-slate-200/80 flex flex-col shrink-0 select-none overflow-hidden transition-all duration-200 ${
        isDragOver ? 'ring-2 ring-[#004691] bg-blue-50/20' : ''
      }`}
      onDragOver={(e) => {
        if (isAdmin) {
          e.preventDefault();
          setIsDragOver(true);
        }
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        if (isAdmin) {
          setIsDragOver(false);
          onDropToUnscheduled(e);
        }
      }}
    >
      {/* Cabeçalho */}
      <div className="p-3.5 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-slate-900 leading-tight">
            Pending Actions
          </h3>
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
            {unscheduledTasks.length}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            title="Filtros"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onToggleCollapse}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            title="Recolher painel"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Alerta quando em modo DragOver */}
      {isDragOver && (
        <div className="p-2.5 bg-blue-50 border-b border-blue-200 text-xs font-semibold text-[#003067] text-center animate-pulse shrink-0">
          Solte aqui para mover para Pending Actions
        </div>
      )}

      {/* Barra de Pesquisa */}
      <div className="p-3 border-b border-slate-100 bg-white shrink-0">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search tasks..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-xs bg-[#f1f5f9] border border-transparent rounded-xl outline-none focus:border-[#004691] focus:bg-white text-slate-800 placeholder-slate-400 transition-all"
          />
        </div>
      </div>

      {/* Lista de Cards da Fila */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-[#f7f9fb]/50">
        {filteredTasks.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center text-center p-3 border border-dashed border-slate-200 rounded-2xl bg-white">
            <Inbox className="w-6 h-6 text-slate-300 mb-1.5" />
            <p className="text-xs font-semibold text-slate-700">
              Nenhuma ação pendente
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5 max-w-[180px]">
              {searchTerm
                ? 'Nenhum resultado para a busca.'
                : 'Todas as tarefas estão agendadas no calendário.'}
            </p>
          </div>
        ) : (
          filteredTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              teamMembers={teamMembers}
              userRole={userRole}
              onClick={onTaskClick}
              onToggleStatus={onToggleStatus}
              onDragStart={onDragStart}
              compact={true}
            />
          ))
        )}
      </div>

      {/* Rodapé com botão + Add Action */}
      {isAdmin && (
        <div className="p-3 border-t border-slate-100 bg-white shrink-0">
          <button
            type="button"
            onClick={onOpenNewTaskModal}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-3 bg-[#003067] hover:bg-[#00224b] text-white text-xs font-semibold rounded-xl shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Action</span>
          </button>
        </div>
      )}
    </aside>
  );
}
