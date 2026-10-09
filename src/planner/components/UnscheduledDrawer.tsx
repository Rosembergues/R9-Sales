import React, { useState } from 'react';
import {
  Inbox,
  X,
  Search,
  Plus,
  GripVertical,
} from 'lucide-react';
import { Task, TeamMember, UserRole } from '../types.ts';
import TaskCard from './TaskCard.tsx';

interface UnscheduledDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: Task[];
  teamMembers: TeamMember[];
  userRole: UserRole;
  onTaskClick: (task: Task) => void;
  onToggleStatus: (taskId: string, e: React.MouseEvent) => void;
  onDragStart: (e: React.DragEvent, task: Task) => void;
  onOpenNewTaskModal: () => void;
  onDropToUnscheduled: (e: React.DragEvent) => void;
}

export default function UnscheduledDrawer({
  isOpen,
  onClose,
  tasks,
  teamMembers,
  userRole,
  onTaskClick,
  onToggleStatus,
  onDragStart,
  onOpenNewTaskModal,
  onDropToUnscheduled,
}: UnscheduledDrawerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const isAdmin = userRole === 'admin';

  // Tarefas na fila de não iniciadas (sem data agendada)
  const unscheduledTasks = tasks.filter((t) => !t.scheduledDate);

  const filteredTasks = unscheduledTasks.filter((t) => {
    const matchSearch =
      t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.bucket?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.tags?.some((tag) => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchSearch;
  });

  if (!isOpen) return null;

  return (
    <div
      id="unscheduled-drawer-backdrop"
      className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[2px] flex justify-end animate-fadeIn"
      onClick={onClose}
    >
      <div
        id="unscheduled-drawer"
        className="w-full max-w-sm sm:max-w-md bg-white h-full shadow-2xl flex flex-col overflow-hidden animate-slideLeft border-l border-zinc-200"
        onClick={(e) => e.stopPropagation()}
        onDragOver={(e) => {
          if (isAdmin) {
            e.preventDefault();
            setIsDragOver(true);
          }
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          setIsDragOver(false);
          if (isAdmin) {
            onDropToUnscheduled(e);
          }
        }}
      >
        {/* Cabeçalho */}
        <div className="px-5 py-4 border-b border-zinc-200/80 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-700 flex items-center justify-center">
              <Inbox className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-zinc-900 tracking-tight">
                  Fila Não Iniciadas
                </h2>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100/80 text-amber-800">
                  {unscheduledTasks.length}
                </span>
              </div>
              <p className="text-[11px] text-zinc-500">
                Ações pendentes de agendamento no calendário
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-700 rounded-lg hover:bg-zinc-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Zona de Drop para Administrador */}
        {isAdmin && isDragOver && (
          <div className="p-4 bg-amber-50/90 border-2 border-dashed border-amber-400 text-center m-4 rounded-xl text-amber-800 text-xs font-semibold animate-pulse">
            Solte o card aqui para mover de volta à fila de Não Iniciadas
          </div>
        )}

        {/* Barra de Pesquisa + Ação Rápida */}
        <div className="p-3.5 border-b border-zinc-100 bg-zinc-50/70 space-y-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Buscar por título, tag ou categoria..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-zinc-200/80 rounded-lg outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-500/20 text-zinc-800 placeholder-zinc-400"
            />
          </div>

          {isAdmin ? (
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-zinc-500 flex items-center gap-1">
                <GripVertical className="w-3 h-3 text-blue-600" />
                Arraste os cards para o calendário
              </span>
              <button
                type="button"
                onClick={onOpenNewTaskModal}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nova Ação</span>
              </button>
            </div>
          ) : (
            <span className="text-[11px] text-zinc-500 block text-center">
              Visualização de membro (apenas admins podem agendar)
            </span>
          )}
        </div>

        {/* Lista de Cards da Fila */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 bg-zinc-50/40">
          {filteredTasks.length === 0 ? (
            <div className="h-60 flex flex-col items-center justify-center text-center p-4 border border-dashed border-zinc-200 rounded-xl bg-white">
              <Inbox className="w-7 h-7 text-zinc-300 mb-2" />
              <p className="text-xs font-semibold text-zinc-700">
                Nenhuma tarefa na fila
              </p>
              <p className="text-[11px] text-zinc-400 mt-1 max-w-[200px]">
                {searchTerm
                  ? 'Nenhum resultado para a busca.'
                  : 'Todas as ações foram agendadas no calendário.'}
              </p>
              {isAdmin && !searchTerm && (
                <button
                  type="button"
                  onClick={onOpenNewTaskModal}
                  className="mt-3 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50/80 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors cursor-pointer"
                >
                  Adicionar Ação à Fila
                </button>
              )}
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
              />
            ))
          )}
        </div>

        {/* Rodapé informativo */}
        <div className="p-3 border-t border-zinc-200/80 bg-white text-center text-[11px] text-zinc-500">
          {isAdmin
            ? '💡 Dica: Arraste qualquer card para as colunas do calendário.'
            : '🔒 Apenas administradores podem alocar tarefas nos dias do calendário.'}
        </div>
      </div>
    </div>
  );
}

