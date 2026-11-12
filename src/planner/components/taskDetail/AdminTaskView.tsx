import { X, Tag, Send, Trash2, MessageSquare, ShieldCheck, Plus, Sliders, Check, Users, RotateCcw, Loader2 } from 'lucide-react';
import { Priority, Recurrence, TaskStatus } from '../../types.ts';
import type { TaskDetailState } from './useTaskDetail';

const WEEK_DAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom'];

/** Visão do admin: todos os atributos da execução, progresso de cada responsável, campos, tags e comentários. */
export default function AdminTaskView({ st }: { st: TaskDetailState }) {
  const {
    task, onClose, onUpdateTask, teamMembers, buckets, tagBuckets, newCommentText, setNewCommentText, newTagInput, setNewTagInput, isDeletingTask, setShowDeleteConfirmation, isAddingField, setIsAddingField, fieldLabel, setFieldLabel, fieldType, setFieldType, fieldRequired, setFieldRequired, assigneeIds, assignedMemberList, selectedMemberId, setSelectedMemberId, getMemberSubmission, completedMembersCount, totalMembersCount, handleAdminToggleMemberCompletion, handleStatusChange, handleFieldChange, handleAddComment, handleAddTag, handleRemoveTag, handleAddAdminCustomField, handleRemoveAdminCustomField, isCurrentSelectedCompleted, selectedMemberObj,
  } = st;

  return (
    <div className="flex flex-col h-full">
      {/* Cabeçalho do Drawer Admin */}
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-white shrink-0">
        <div className="flex items-center gap-3">
          <span
            className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
              task.status === 'concluida'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : task.status === 'em_andamento'
                ? 'bg-blue-50 text-blue-700 border-blue-200'
                : 'bg-gray-100 text-gray-700 border-gray-200'
            }`}
          >
            {task.status === 'concluida'
              ? 'Concluída'
              : task.status === 'em_andamento'
              ? 'Em Andamento'
              : 'Pendente'}
          </span>

          <span className="inline-flex items-center gap-1 text-[11px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded font-medium border border-blue-100">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Modo Administrador</span>
          </span>

          {task.status === 'concluida' && (task.completedByAdmin || task.completed_by_admin || task.finalizada_por_admin) && (
            <span
              className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-[#004691] border border-blue-300 shadow-2xs"
              title="Esta tarefa foi finalizada por um Administrador"
            >
              <ShieldCheck className="w-3 h-3 text-[#004691]" />
              Finalizada por Admin
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={isDeletingTask}
            onClick={() => {
              if (!isDeletingTask) setShowDeleteConfirmation(true);
            }}
            className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-wait"
            title={isDeletingTask ? 'Excluindo ação…' : 'Excluir ação'}
            aria-label={isDeletingTask ? 'Excluindo ação' : 'Excluir ação'}
          >
            {isDeletingTask ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Corpo com Scroll do Admin */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Título da Ação */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
            Nome da Ação
          </label>
          <input
            type="text"
            value={task.title}
            onChange={(e) => handleFieldChange('title', e.target.value)}
            className="w-full text-lg font-bold text-gray-900 border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none"
          />
        </div>

        {/* Descrição */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
            Descrição detalhada
          </label>
          <textarea
            rows={3}
            value={task.description || ''}
            onChange={(e) => handleFieldChange('description', e.target.value)}
            placeholder="Adicione detalhes, critérios de aceitação e instruções..."
            className="w-full text-sm text-gray-700 border border-gray-200 rounded-lg p-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none"
          />
        </div>

        {/* Grid de Atributos Estruturais */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50/70 p-4 rounded-xl border border-gray-200">
          {/* Status */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Status da Tarefa
            </label>
            <select
              value={task.status}
              onChange={(e) => handleStatusChange(e.target.value as TaskStatus)}
              className="w-full text-xs font-medium bg-white border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-blue-600 cursor-pointer"
            >
              <option value="pendente">Pendente</option>
              <option value="em_andamento">Em Andamento</option>
              <option value="concluida">Concluída</option>
            </select>
          </div>

          {/* Prioridade */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Prioridade
            </label>
            <select
              value={task.priority}
              onChange={(e) => handleFieldChange('priority', e.target.value as Priority)}
              className="w-full text-xs font-medium bg-white border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-blue-600 cursor-pointer"
            >
              <option value="Urgente">Urgente</option>
              <option value="Alta">Alta</option>
              <option value="Média">Média</option>
              <option value="Baixa">Baixa</option>
            </select>
          </div>

          {/* Feedback de Conclusão por Administrador no formulário do Admin */}
          {task.status === 'concluida' && (task.completedByAdmin || task.completed_by_admin || task.finalizada_por_admin) && (
            <div className="col-span-full flex items-center gap-2 p-2.5 rounded-lg bg-blue-50 border border-blue-200 text-xs text-[#004691]">
              <ShieldCheck className="w-4 h-4 text-[#004691] shrink-0" />
              <span>Rastreabilidade ativada: Esta ação foi registrada como <strong>Finalizada por um Administrador</strong>.</span>
            </div>
          )}

          {/* Recorrência */}
          <div className={task.recurrence === 'Personalizado' ? 'sm:col-span-2' : ''}>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Recorrência
            </label>
            <select
              value={task.recurrence || 'Nenhuma'}
              onChange={(e) => {
                const val = e.target.value as Recurrence;
                const currentDays =
                  task.recurrenceDays && task.recurrenceDays.length > 0
                    ? task.recurrenceDays
                    : ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'];
                onUpdateTask({
                  ...task,
                  recurrence: val,
                  recurrenceDays: val === 'Personalizado' ? currentDays : task.recurrenceDays,
                });
              }}
              className="w-full text-xs font-medium bg-white border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-blue-600 cursor-pointer"
            >
              <option value="Nenhuma">Nenhuma (Única vez)</option>
              <option value="Segunda a Sexta">Segunda a Sexta (Dias Úteis)</option>
              <option value="Diariamente">Diariamente</option>
              <option value="Semanalmente">Semanalmente</option>
              <option value="Mensalmente">Mensalmente</option>
              <option value="Personalizado">Personalizado</option>
            </select>

            {task.recurrence === 'Personalizado' && (
              <div className="flex items-center justify-between flex-wrap gap-2 pt-2 px-1">
                {WEEK_DAYS.map((day) => {
                  const currentDays = task.recurrenceDays || [];
                  const isChecked = currentDays.includes(day);
                  return (
                    <label
                      key={day}
                      className="flex items-center gap-1.5 text-xs text-gray-800 font-medium cursor-pointer select-none hover:text-[#004691]"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          const newDays = isChecked
                            ? currentDays.filter((d) => d !== day)
                            : [...currentDays, day];
                          onUpdateTask({
                            ...task,
                            recurrenceDays: newDays,
                          });
                        }}
                        className="w-4 h-4 rounded border-gray-400 text-[#004691] focus:ring-[#004691] cursor-pointer accent-[#004691]"
                      />
                      <span>{day}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Bucket / Categoria */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Bucket / Categoria
            </label>
            <select
              value={task.bucket}
              onChange={(e) => handleFieldChange('bucket', e.target.value)}
              className="w-full text-xs font-medium bg-white border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-blue-600 cursor-pointer"
            >
              {buckets.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          {/* Atribuição de Múltiplos Responsáveis */}
          <div className="sm:col-span-2">
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-gray-700">
                Responsáveis da Equipe{' '}
                {assigneeIds.length > 0 && `(${assigneeIds.length} atribuído${assigneeIds.length > 1 ? 's' : ''})`}
              </label>
              {assigneeIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    onUpdateTask({
                      ...task,
                      assignedTo: null,
                      assignedToIds: [],
                    });
                  }}
                  className="text-[11px] text-rose-600 hover:text-rose-800 font-medium cursor-pointer"
                >
                  Desmarcar todos
                </button>
              )}
            </div>

            <div className="p-2.5 bg-gray-50/80 border border-gray-200 rounded-lg max-h-40 overflow-y-auto space-y-1.5">
              {teamMembers.map((m) => {
                const isSelected = assigneeIds.includes(m.id);

                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      const newAssignees = isSelected
                        ? assigneeIds.filter((id) => id !== m.id)
                        : [...assigneeIds, m.id];
                      onUpdateTask({
                        ...task,
                        assignedTo: newAssignees[0] || null,
                        assignedToIds: newAssignees,
                      });
                    }}
                    className={`w-full flex items-center justify-between p-2 rounded-lg text-left text-xs transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50 border border-blue-200 text-blue-900 font-semibold shadow-2xs'
                        : 'bg-white border border-gray-200/80 text-gray-700 hover:bg-gray-100/70'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 shadow-2xs"
                        style={{ backgroundColor: m.color || '#004691' }}
                      >
                        {m.avatar || m.name.charAt(0)}
                      </div>
                      <div className="truncate">
                        <span>{m.name}</span>
                        <span className="text-[10px] font-normal text-gray-500 ml-1.5">
                          ({m.role === 'admin' ? 'Admin' : 'Membro'}) - {m.email}
                        </span>
                      </div>
                    </div>

                    <div
                      className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] shrink-0 transition-colors ${
                        isSelected
                          ? 'bg-[#004691] border-[#004691] text-white'
                          : 'border-gray-300 bg-white'
                      }`}
                    >
                      {isSelected && '✓'}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Datas */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Data de Início
            </label>
            <input
              type="date"
              value={task.startDate || ''}
              onChange={(e) => handleFieldChange('startDate', e.target.value)}
              className="w-full text-xs bg-white border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Data de Término
            </label>
            <input
              type="date"
              value={task.endDate || ''}
              onChange={(e) => handleFieldChange('endDate', e.target.value)}
              className="w-full text-xs bg-white border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-blue-600"
            />
          </div>

          {/* Data Agendada no Calendário */}
          <div className="sm:col-span-2">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-gray-600">
                Agendamento no Calendário
              </label>
              {task.scheduledDate && (
                <button
                  type="button"
                  onClick={() => handleFieldChange('scheduledDate', null)}
                  className="text-[11px] text-amber-700 hover:underline cursor-pointer"
                >
                  Mover para Fila Não Iniciadas
                </button>
              )}
            </div>
            <input
              type="date"
              value={task.scheduledDate || ''}
              onChange={(e) =>
                handleFieldChange('scheduledDate', e.target.value || null)
              }
              className="w-full text-xs bg-white border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-blue-600"
            />
            {!task.scheduledDate && (
              <p className="text-[11px] text-amber-600 mt-1">
                Esta ação está na <strong>Fila de Tarefas Não Iniciadas</strong>.
              </p>
            )}
          </div>
        </div>

        {/* SEÇÃO: PROGRESSO INDIVIDUAL DOS RESPONSÁVEIS (ADMIN) */}
        <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-700" />
              <h3 className="text-xs font-bold text-gray-900">
                Progresso Individual por Responsável ({completedMembersCount}/{totalMembersCount})
              </h3>
            </div>
            <span className="text-[11px] font-semibold text-slate-500">
              Ação rápida para finalizar ou reabrir parte de cada usuário
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {assignedMemberList.map((m, idx) => {
              const sub = getMemberSubmission(m.id);
              const isCompleted = sub.completed;
              const isSelected = selectedMemberId === m.id;

              return (
                <div
                  key={m.id}
                  onClick={() => setSelectedMemberId(m.id)}
                  className={`p-3 rounded-lg border flex flex-col justify-between gap-2.5 transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-blue-50/80 border-blue-300 ring-1 ring-blue-500/20 shadow-2xs'
                      : 'bg-slate-50/60 border-slate-200 hover:bg-slate-100/70 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {isCompleted ? (
                        <div className="w-5 h-5 rounded-full bg-[#22c55e] flex items-center justify-center text-white shrink-0 shadow-2xs">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded-full border-2 border-slate-700 bg-white shrink-0 shadow-2xs" />
                      )}
                      <div className="truncate">
                        <div className="text-xs font-bold text-slate-800 truncate">
                          {m.name || `Usuário ${idx + 1}`}
                        </div>
                        <span className="text-[10.5px] text-slate-500 truncate block">
                          {m.email || (isCompleted ? 'Concluído' : 'Pendente')}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded shrink-0 ${
                          isCompleted
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200/60'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {isCompleted ? 'Concluído' : 'Pendente'}
                      </span>

                      {isCompleted &&
                        (sub.completedByAdmin ||
                          sub.completed_by_admin ||
                          sub.finalizada_por_admin) && (
                          <span
                            className="inline-flex items-center gap-1 text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-[#004691] border border-blue-200/90 shadow-2xs shrink-0"
                            title="Esta parte foi finalizada diretamente por um Administrador"
                          >
                            <ShieldCheck className="w-2.5 h-2.5 text-[#004691]" />
                            <span>Admin</span>
                          </span>
                        )}
                    </div>
                  </div>

                  {/* Botão de Ação Rápida do Administrador */}
                  <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between flex-wrap gap-1">
                    <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                      {isCompleted ? (
                        <>
                          <span className="text-slate-400">
                            {sub.completedAt
                              ? `Concluído em ${new Date(sub.completedAt).toLocaleDateString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
                              : 'Finalizado'}
                          </span>
                          {(sub.completedByAdmin ||
                            sub.completed_by_admin ||
                            sub.finalizada_por_admin) && (
                            <span className="inline-flex items-center gap-0.5 text-[#004691] font-semibold bg-blue-50/80 px-1 py-0.2 rounded border border-blue-200/60">
                              <ShieldCheck className="w-2.5 h-2.5 text-[#004691]" />
                              <span>Por Admin</span>
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-slate-400">Aguardando preenchimento</span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={(e) => handleAdminToggleMemberCompletion(m.id, e)}
                      className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all flex items-center gap-1 cursor-pointer ${
                        isCompleted
                          ? 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-300'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs font-bold'
                      }`}
                      title={
                        isCompleted
                          ? `Reabrir a parte de ${m.name || 'Usuário'}`
                          : `Finalizar imediatamente a parte de ${m.name || 'Usuário'}`
                      }
                    >
                      {isCompleted ? (
                        <>
                          <RotateCcw className="w-3 h-3 text-slate-500" />
                          <span>Reabrir</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                          <span>Finalizar parte</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Seção: Configuração e Respostas dos Campos Customizáveis */}
        <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/30 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-blue-700" />
              <h3 className="text-xs font-bold text-gray-900">
                Campos de Formulário Customizáveis & Métricas
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setIsAddingField(!isAddingField)}
              className="text-xs text-blue-700 hover:text-blue-800 font-semibold flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isAddingField ? 'Fechar' : 'Novo Campo'}</span>
            </button>
          </div>

          {/* Form para adicionar novo campo */}
          {isAddingField && (
            <div className="p-3 bg-white border border-blue-200 rounded-lg space-y-2">
              <input
                type="text"
                placeholder="Nome do campo (ex: Total de Contatos na Base)"
                value={fieldLabel}
                onChange={(e) => setFieldLabel(e.target.value)}
                className="w-full text-xs border border-gray-300 rounded px-2.5 py-1.5 outline-none focus:border-blue-600"
              />
              <div className="flex items-center justify-between pt-1">
                <select
                  value={fieldType}
                  onChange={(e) => setFieldType(e.target.value as 'number' | 'text')}
                  className="text-xs border border-gray-300 rounded px-2 py-1 bg-white cursor-pointer"
                >
                  <option value="number">Numérico</option>
                  <option value="text">Texto</option>
                </select>

                <label className="flex items-center gap-1 text-xs text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={fieldRequired}
                    onChange={(e) => setFieldRequired(e.target.checked)}
                    className="rounded text-blue-600 cursor-pointer"
                  />
                  <span>Obrigatório</span>
                </label>

                <button
                  type="button"
                  onClick={handleAddAdminCustomField}
                  disabled={!fieldLabel.trim()}
                  className="px-3 py-1 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50 cursor-pointer"
                >
                  Salvar
                </button>
              </div>
            </div>
          )}

          {/* Indicador de qual membro está sendo inspecionado */}
          <div className="px-3 py-2 bg-white rounded-lg border border-blue-200 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-500">Inspecionando respostas de:</span>
              <strong className="text-slate-900 font-bold">
                {selectedMemberObj?.name || 'Usuário'}
              </strong>
            </div>

            <button
              type="button"
              onClick={() => handleAdminToggleMemberCompletion(selectedMemberId)}
              className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all flex items-center gap-1 cursor-pointer ${
                isCurrentSelectedCompleted
                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs'
              }`}
            >
              {isCurrentSelectedCompleted ? (
                <>
                  <RotateCcw className="w-3 h-3 text-slate-500" />
                  <span>Reabrir parte deste membro</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Concluir parte deste membro</span>
                </>
              )}
            </button>
          </div>

          {/* Lista de Campos com Respostas Registradas */}
          {task.customFields && task.customFields.length > 0 ? (
            <div className="space-y-2">
              {task.customFields.map((f) => {
                const userSub = getMemberSubmission(selectedMemberId);
                const response = userSub.values?.[f.id];

                return (
                  <div
                    key={f.id}
                    className="p-2.5 bg-white border border-gray-200 rounded-lg flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-800">{f.label}</span>
                        {f.required && (
                          <span className="text-[9px] bg-red-50 text-red-700 border border-red-200 px-1.5 py-0.2 rounded font-bold">
                            Obrigatório
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-gray-500 mt-0.5">
                        Preenchido por {selectedMemberObj?.name}:{' '}
                        {response !== undefined && response !== '' ? (
                          <strong className="text-gray-900 font-bold">
                            {response}
                          </strong>
                        ) : (
                          <span className="italic text-gray-400">
                            Ainda não preenchido por este membro
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveAdminCustomField(f.id)}
                      className="p-1 text-gray-400 hover:text-red-600 rounded transition-colors cursor-pointer"
                      title="Remover este campo da ação"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-[11px] text-gray-500 italic">
              Nenhum campo de formulário configurado nesta ação.
            </p>
          )}

          {/* Card de Observação do Responsável no Painel Admin */}
          <div className="p-3 bg-white border border-gray-200 rounded-lg space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-gray-800 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
                Observação de {selectedMemberObj?.name || 'Responsável'}
              </span>
              <span className="text-[10px] text-gray-400">Opcional</span>
            </div>

            {(() => {
              const sub = getMemberSubmission(selectedMemberId);
              const obs = sub.observacao !== undefined ? sub.observacao : sub.observation;

              return obs ? (
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-md text-slate-800 text-xs whitespace-pre-wrap">
                  {obs}
                </div>
              ) : (
                <p className="text-[11px] text-gray-400 italic">
                  Nenhuma observação registrada por este membro.
                </p>
              );
            })()}
          </div>
        </div>

        {/* TAGs */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
            TAGs da Ação
          </label>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            {task.tags?.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-gray-100 text-gray-800 text-xs font-medium border border-gray-200"
              >
                <Tag className="w-3 h-3 text-gray-400" />
                {tag}
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tag)}
                  className="text-gray-400 hover:text-red-600 ml-0.5 cursor-pointer"
                >
                  &times;
                </button>
              </span>
            ))}
          </div>

          {/* Sugestões rápidas de tags cadastradas */}
          {tagBuckets.length > 0 && (
            <div className="flex flex-wrap items-center gap-1 my-2">
              <span className="text-[10px] text-zinc-400 mr-1">Sugestões:</span>
              {tagBuckets.map((tb) => {
                const isSelected = task.tags?.includes(tb.nome);
                return (
                  <button
                    key={tb.id}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        handleRemoveTag(tb.nome);
                      } else {
                        const updatedTags = [...(task.tags || []), tb.nome];
                        handleFieldChange('tags', updatedTags);
                      }
                    }}
                    className={`text-[10px] px-2 py-0.5 rounded-full border font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50'
                    }`}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: tb.cor || '#003067' }}
                    />
                    <span>{tb.nome}</span>
                    {isSelected && <span>✓</span>}
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex items-center gap-2 mt-2">
            <input
              type="text"
              placeholder="Nova TAG (ex: Urgente, Q3, Cliente X)"
              value={newTagInput}
              onChange={(e) => setNewTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddTag();
                }
              }}
              className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 flex-1 outline-none focus:border-blue-600"
            />
            <button
              type="button"
              onClick={handleAddTag}
              className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
            >
              Adicionar
            </button>
          </div>
        </div>

        {/* Chat Integrado da Equipe (Apenas Admin) */}
        <div className="pt-4 border-t border-gray-200">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-semibold text-gray-900">
              Histórico e Chat da Equipe ({task.comments?.length ?? 0})
            </h3>
          </div>

          {/* Lista de Comentários */}
          <div className="space-y-3 mb-4 max-h-60 overflow-y-auto pr-1">
            {!task.comments || task.comments.length === 0 ? (
              <div className="text-center py-6 bg-gray-50 rounded-lg border border-dashed border-gray-200 text-gray-400 text-xs">
                Nenhum comentário registrado ainda.
              </div>
            ) : (
              task.comments.map((comm) => (
                <div
                  key={comm.id}
                  className="bg-gray-50 rounded-lg p-3 border border-gray-100"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                          comm.authorColor || 'bg-blue-600 text-white'
                        }`}
                      >
                        {comm.authorInitials || 'U'}
                      </div>
                      <span className="text-xs font-semibold text-gray-800">
                        {comm.authorName}
                      </span>
                    </div>
                    <span className="text-[10px] text-gray-400">{comm.createdAt}</span>
                  </div>
                  <p className="text-xs text-gray-700 leading-relaxed pl-7 break-words">
                    {comm.text}
                  </p>
                </div>
              ))
            )}
          </div>

          {/* Input para Novo Comentário */}
          <form onSubmit={handleAddComment} className="flex gap-2">
            <input
              type="text"
              placeholder="Escreva uma observação ou mensagem para o histórico..."
              value={newCommentText}
              onChange={(e) => setNewCommentText(e.target.value)}
              className="flex-1 text-xs border border-gray-200 rounded-lg px-3 py-2.5 outline-none focus:border-blue-600"
            />
            <button
              type="submit"
              disabled={!newCommentText.trim()}
              className="px-4 py-2.5 bg-institucional text-white text-xs font-medium rounded-lg hover:opacity-95 transition-all shadow-xs disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Enviar</span>
            </button>
          </form>
        </div>
      </div>

      {/* Rodapé do Drawer Admin */}
      <div className="px-6 py-3.5 border-t border-gray-200 bg-gray-50 flex items-center justify-end">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
        >
          Fechar Painel
        </button>
      </div>
    </div>
  );
}
