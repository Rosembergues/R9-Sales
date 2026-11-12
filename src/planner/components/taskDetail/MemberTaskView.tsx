import { X, AlertCircle, CheckCircle2, MessageSquare, ShieldCheck, Sliders, Check, Users, RotateCcw, Loader2 } from 'lucide-react';
import { TaskStatus } from '../../types.ts';
import type { TaskDetailState } from './useTaskDetail';

/** Visão do consultor: o próprio formulário, a observação e o progresso de cada responsável. */
export default function MemberTaskView({ st }: { st: TaskDetailState }) {
  const {
    task, onClose, currentUser, isAdmin, assignedMemberList, selectedMemberId, setSelectedMemberId, getMemberSubmission, activeMemberFormValues, activeMemberObservacao, setActiveMemberObservacao, completionError, setCompletionError, successFeedback, isSaving, handleResetMemberForm, completedMembersCount, totalMembersCount, allAssignedCompleted, handleInputChange, handleSaveMemberResponses, handleCompleteMemberPortion, handleSaveMemberObservation, handleReopenMemberPortion, handleAdminToggleMemberCompletion, handleStatusChange, getPriorityStyle, currentSelectedSubmission, isCurrentSelectedCompleted, selectedMemberObj,
  } = st;

  return (
    <div className="flex flex-col h-full">
      {/* Cabeçalho */}
      <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between bg-white shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 border border-gray-200">
            Visão de Membro
          </span>
          {allAssignedCompleted && (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              <CheckCircle2 className="w-3 h-3" />
              Todos Concluíram
            </span>
          )}
          {task.status === 'concluida' && (task.completedByAdmin || task.completed_by_admin || task.finalizada_por_admin) && (
            <span
              className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-[#004691] border border-blue-200 shadow-2xs"
              title="Esta tarefa foi finalizada por um Administrador"
            >
              <ShieldCheck className="w-3 h-3 text-[#004691]" />
              Finalizada por Admin
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Conteúdo Focado */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Título da Ação */}
        <div>
          <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">
            AÇÃO
          </span>
          <h2 className="text-base font-bold text-gray-900 leading-snug">
            {task.title}
          </h2>
          {task.description && (
            <p className="text-xs text-gray-600 mt-2 bg-gray-50 p-3 rounded-lg border border-gray-100 leading-relaxed">
              {task.description}
            </p>
          )}
        </div>

        {/* Bloco: Status da Ação e Prioridade */}
        <div className="grid grid-cols-2 gap-3 p-3.5 bg-gray-50/90 rounded-xl border border-gray-200">
          {/* 1. Status da Ação */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-600 mb-1.5">
              Status da Ação
            </label>
            <select
              value={task.status}
              onChange={(e) => handleStatusChange(e.target.value as TaskStatus)}
              className={`w-full text-xs font-semibold rounded-lg px-2.5 py-2 border outline-none cursor-pointer ${
                task.status === 'concluida'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  : task.status === 'em_andamento'
                  ? 'bg-blue-50 text-blue-800 border-blue-300'
                  : 'bg-white text-gray-800 border-gray-300'
              }`}
            >
              <option value="pendente">⏳ Pendente</option>
              <option value="em_andamento">⚡ Em Andamento</option>
              <option value="concluida">✅ Concluída</option>
            </select>
          </div>

          {/* 2. Prioridade */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-600 mb-1.5">
              Prioridade
            </label>
            <div
              className={`w-full text-xs font-semibold px-2.5 py-2 rounded-lg border text-center ${getPriorityStyle(
                task.priority
              )}`}
            >
              {task.priority}
            </div>
          </div>

          {/* Feedback sutil de conclusão por Administrador na visão do membro */}
          {task.status === 'concluida' && (task.completedByAdmin || task.completed_by_admin || task.finalizada_por_admin) && (
            <div className="col-span-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 border border-blue-200/80 text-xs text-[#004691] font-medium">
              <ShieldCheck className="w-4 h-4 text-[#004691] shrink-0" />
              <span>Esta ação foi finalizada diretamente por um <strong>Administrador</strong>.</span>
            </div>
          )}
        </div>

        {/* Responsáveis e quem já concluiu */}
        <div className="border border-slate-200/90 rounded-xl bg-white shadow-2xs overflow-hidden">
          <div className="px-3.5 py-2.5 bg-slate-50/80 border-b border-slate-200/70 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-slate-600" />
              <span className="text-xs font-bold text-slate-800">
                Usuários Responsáveis
              </span>
            </div>
            <span className="text-[11px] font-semibold text-slate-500 bg-white px-2 py-0.5 rounded-full border border-slate-200">
              {completedMembersCount} de {totalMembersCount} concluíram
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {assignedMemberList.map((m, idx) => {
              const sub = getMemberSubmission(m.id);
              const isSelected = selectedMemberId === m.id;
              const isCompleted = sub.completed;

              return (
                <div
                  key={m.id}
                  onClick={() => setSelectedMemberId(m.id)}
                  className={`px-3.5 py-2.5 flex items-center justify-between transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-blue-50/70 border-l-3 border-l-blue-600'
                      : 'hover:bg-slate-50/80'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Círculo de Status: Verde preenchido (Concluído) ou Círculo vazado (Pendente) */}
                    <div className="shrink-0 flex items-center justify-center">
                      {isCompleted ? (
                        <div
                          className="w-5 h-5 rounded-full bg-[#22c55e] flex items-center justify-center text-white shadow-xs"
                          title="Formulário preenchido e concluído"
                        >
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                      ) : (
                        <div
                          className="w-5 h-5 rounded-full border-2 border-slate-700 bg-white shadow-2xs"
                          title="Preenchimento pendente"
                        />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-xs ${
                            isSelected ? 'font-bold text-slate-900' : 'font-medium text-slate-800'
                          }`}
                        >
                          {m.name || `Usuário ${idx + 1}`}
                        </span>
                        {m.id === currentUser.id && (
                          <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded bg-blue-100 text-blue-800">
                            Você
                          </span>
                        )}
                      </div>
                      {m.email && (
                        <span className="text-[10px] text-slate-400 truncate block">
                          {m.email}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {isCompleted ? (
                      <div className="flex items-center gap-1">
                        <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60 flex items-center gap-1">
                          <span>Concluído</span>
                        </span>
                        {(sub.completedByAdmin || sub.completed_by_admin || sub.finalizada_por_admin) && (
                          <span
                            className="inline-flex items-center gap-0.5 text-[9.5px] font-bold px-1.5 py-0.5 rounded-md bg-blue-50 text-[#004691] border border-blue-200/90 shadow-2xs"
                            title="Esta parte foi finalizada diretamente por um Administrador"
                          >
                            <ShieldCheck className="w-2.5 h-2.5 text-[#004691]" />
                            <span>Admin</span>
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                        Pendente
                      </span>
                    )}

                    {/* Botão de Ação Rápida: Administrador pode concluir ou reabrir qualquer responsável */}
                    {(isAdmin || m.id === currentUser.id) && (
                      <button
                        type="button"
                        onClick={(e) => handleAdminToggleMemberCompletion(m.id, e)}
                        className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all flex items-center gap-1 cursor-pointer ${
                          isCompleted
                            ? 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
                            : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 shadow-2xs font-bold'
                        }`}
                        title={
                          isCompleted
                            ? `Reabrir parte de ${m.name || 'Usuário'}`
                            : `Finalizar apenas a parte de ${m.name || 'Usuário'}`
                        }
                      >
                        {isCompleted ? (
                          <>
                            <RotateCcw className="w-3 h-3 text-slate-400" />
                            <span>Reabrir</span>
                          </>
                        ) : (
                          <>
                            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>Finalizar parte</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Mensagem de Erro de Validação */}
        {completionError && (
          <div className="p-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 animate-fadeIn">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{completionError}</span>
          </div>
        )}

        {/* Mensagem de Sucesso */}
        {successFeedback && (
          <div className="p-3 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
            <span>{successFeedback}</span>
          </div>
        )}

        {/* Formulário da tarefa (campos obrigatórios) */}
        {task.customFields && task.customFields.length > 0 ? (
          <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/40 space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-blue-700" />
                <h3 className="text-xs font-bold text-gray-900">
                  Métricas & Campos Obrigatórios para Conclusão
                </h3>
              </div>
              {!isCurrentSelectedCompleted && (
                <button
                  type="button"
                  onClick={handleResetMemberForm}
                  disabled={isSaving}
                  className="text-[11px] text-blue-600 hover:text-blue-800 flex items-center gap-1 hover:underline cursor-pointer disabled:opacity-50"
                  title="Limpar todos os campos digitados para começar do zero"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Limpar formulário</span>
                </button>
              )}
            </div>

            <p className="text-[11px] text-gray-600 leading-relaxed">
              O administrador definiu os campos abaixo. Preencha-os para que seja possível marcar a ação como <strong>Concluída</strong>.
            </p>

            {/* Indicador de qual usuário está sendo editado */}
            <div className="px-2.5 py-1.5 rounded-lg bg-white border border-blue-200/80 flex items-center justify-between text-xs">
              <span className="text-slate-600">
                Preenchendo para:{' '}
                <strong className="text-slate-900">
                  {selectedMemberObj?.name || 'Usuário'}
                </strong>
              </span>
              {isCurrentSelectedCompleted ? (
                <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-emerald-700">
                  <Check className="w-3 h-3 stroke-[3]" /> Concluído
                </span>
              ) : (
                <span className="text-[10.5px] text-amber-700 font-semibold">
                  Aguardando envio
                </span>
              )}
            </div>

            <div className="space-y-3 pt-1">
              {task.customFields.map((field) => {
                const currentVal =
                  activeMemberFormValues[field.id] !== undefined
                    ? activeMemberFormValues[field.id]
                    : '';

                return (
                  <div key={field.id} className="space-y-1">
                    <label className="block text-xs font-semibold text-gray-700">
                      {field.label}{' '}
                      {field.required && (
                        <span className="text-red-500 font-bold">*</span>
                      )}
                    </label>
                    <input
                      type={field.type === 'number' ? 'number' : 'text'}
                      min={field.type === 'number' ? 0 : undefined}
                      onWheel={(e) => (e.target as HTMLInputElement).blur()}
                      required={field.required}
                      disabled={isCurrentSelectedCompleted}
                      placeholder={
                        field.placeholder ??
                        (field.type === 'number' ? '0' : 'Preencha aqui...')
                      }
                      value={currentVal}
                      onChange={(e) =>
                        handleInputChange(field.id, e.target.value, field.type)
                      }
                      className={`w-full text-xs border rounded-lg px-3 py-2 outline-none transition-all ${
                        isCurrentSelectedCompleted
                          ? 'bg-slate-100 text-slate-600 border-slate-200 cursor-not-allowed'
                          : 'bg-white text-slate-900 border-gray-300 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20'
                      }`}
                    />
                  </div>
                );
              })}

              {/* Caixa de Observação Opcional por Usuário */}
              <div className="space-y-1.5 pt-2 border-t border-blue-200/60">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
                    <span>Observação da minha parte</span>
                    <span className="text-[10.5px] font-normal text-slate-400">
                      (Opcional)
                    </span>
                  </label>

                  {!isCurrentSelectedCompleted && activeMemberObservacao.trim() && (
                    <button
                      type="button"
                      onClick={() => handleSaveMemberObservation(selectedMemberId)}
                      className="text-[11px] text-blue-700 hover:text-blue-800 font-semibold cursor-pointer underline-offset-2 hover:underline"
                    >
                      Salvar observação
                    </button>
                  )}
                </div>

                <textarea
                  rows={3}
                  disabled={isCurrentSelectedCompleted}
                  placeholder="Escreva uma observação ou comentário opcional sobre a sua parte nesta tarefa..."
                  value={activeMemberObservacao}
                  onChange={(e) => {
                    setActiveMemberObservacao(e.target.value);
                    setCompletionError(null);
                  }}
                  className={`w-full text-xs border rounded-lg px-3 py-2 outline-none resize-y transition-all ${
                    isCurrentSelectedCompleted
                      ? 'bg-slate-100 text-slate-600 border-slate-200 cursor-not-allowed'
                      : 'bg-white text-slate-900 border-gray-300 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20'
                  }`}
                />
                <p className="text-[10.5px] text-slate-500">
                  O preenchimento não é obrigatório. Você pode concluir mesmo sem preencher.
                </p>
              </div>
            </div>

            {/* Botão de Concluir a Parte do Usuário */}
            <div className="pt-2">
              {isCurrentSelectedCompleted ? (
                <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-emerald-800 font-semibold flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Formulário finalizado por este usuário
                    </span>
                    {(currentSelectedSubmission?.completedByAdmin ||
                      currentSelectedSubmission?.completed_by_admin ||
                      currentSelectedSubmission?.finalizada_por_admin) && (
                      <span
                        className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-[#004691] border border-blue-300 shadow-2xs"
                        title="Esta parte foi concluída por um Administrador"
                      >
                        <ShieldCheck className="w-3 h-3 text-[#004691]" />
                        Finalizada por Admin
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => handleReopenMemberPortion(selectedMemberId)}
                    className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-md transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-50"
                  >
                    {isSaving ? (
                      <Loader2 className="w-3 h-3 animate-spin text-slate-500" />
                    ) : (
                      <RotateCcw className="w-3 h-3 text-slate-500" />
                    )}
                    <span>Reabrir</span>
                  </button>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => handleSaveMemberResponses(selectedMemberId)}
                    className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold border border-slate-300 rounded-lg shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-600" /> : null}
                    <span>Salvar Respostas</span>
                  </button>
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => handleCompleteMemberPortion(selectedMemberId)}
                    className="flex-1 py-2.5 px-4 bg-[#004691] hover:bg-[#00356e] text-white text-xs font-bold rounded-lg shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                        <span>Salvando no Supabase...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4 stroke-[2.5]" />
                        <span>
                          Salvar e Concluir Minha Parte (
                          {selectedMemberObj?.name?.split(' ')[0] || 'Usuário'})
                        </span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Caso a ação não possua campos customizados, permite que o membro adicione observação e conclua sua parte diretamente */
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
            <div className="space-y-1">
              <p className="text-xs text-slate-600 leading-relaxed">
                Esta ação não possui formulário adicional. Marque sua parte como concluída quando finalizar sua atividade.
              </p>
            </div>

            {/* Indicador de qual usuário está sendo editado */}
            <div className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 flex items-center justify-between text-xs">
              <span className="text-slate-600">
                Responsável:{' '}
                <strong className="text-slate-900">
                  {selectedMemberObj?.name || 'Usuário'}
                </strong>
              </span>
              {isCurrentSelectedCompleted ? (
                <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-emerald-700">
                  <Check className="w-3 h-3 stroke-[3]" /> Concluído
                </span>
              ) : (
                <span className="text-[10.5px] text-amber-700 font-semibold">
                  Pendente
                </span>
              )}
            </div>

            {/* Caixa de Observação Opcional por Usuário */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
                  <span>Observação da minha parte</span>
                  <span className="text-[10.5px] font-normal text-slate-400">
                    (Opcional)
                  </span>
                </label>

                {!isCurrentSelectedCompleted && activeMemberObservacao.trim() && (
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => handleSaveMemberObservation(selectedMemberId)}
                    className="text-[11px] text-blue-700 hover:text-blue-800 font-semibold cursor-pointer underline-offset-2 hover:underline disabled:opacity-50"
                  >
                    Salvar observação
                  </button>
                )}
              </div>

              <textarea
                rows={3}
                disabled={isCurrentSelectedCompleted || isSaving}
                placeholder="Escreva uma observação ou comentário opcional sobre a sua parte nesta tarefa..."
                value={activeMemberObservacao}
                onChange={(e) => {
                  setActiveMemberObservacao(e.target.value);
                  setCompletionError(null);
                }}
                className={`w-full text-xs border rounded-lg px-3 py-2 outline-none resize-y transition-all ${
                  isCurrentSelectedCompleted
                    ? 'bg-slate-100 text-slate-600 border-slate-200 cursor-not-allowed'
                    : 'bg-white text-slate-900 border-gray-300 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20'
                }`}
              />
              <p className="text-[10.5px] text-slate-500">
                O preenchimento não é obrigatório.
              </p>
            </div>

            {/* Botões de Ação */}
            <div className="pt-2">
              {isCurrentSelectedCompleted ? (
                <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
                  <span className="text-xs text-emerald-800 font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Parte finalizada por este usuário
                  </span>
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => handleReopenMemberPortion(selectedMemberId)}
                    className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-md transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-50"
                  >
                    {isSaving ? (
                      <Loader2 className="w-3 h-3 animate-spin text-slate-500" />
                    ) : (
                      <RotateCcw className="w-3 h-3 text-slate-500" />
                    )}
                    <span>Reabrir</span>
                  </button>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  {activeMemberObservacao.trim() ? (
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => handleSaveMemberObservation(selectedMemberId)}
                      className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold border border-slate-300 rounded-lg shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                    >
                      {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-600" /> : null}
                      <span>Salvar Observação</span>
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => handleCompleteMemberPortion(selectedMemberId)}
                    className="flex-1 py-2.5 px-4 bg-[#004691] hover:bg-[#00356e] text-white text-xs font-bold rounded-lg shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                        <span>Salvando no Supabase...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4 stroke-[2.5]" />
                        <span>
                          Salvar e Marcar Minha Parte como Concluída (
                          {selectedMemberObj?.name?.split(' ')[0] || 'Usuário'})
                        </span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Rodapé Simplificado */}
      <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between shrink-0">
        <span className="text-[11px] text-gray-500">
          {allAssignedCompleted
            ? 'Status da ação: Concluída ✅'
            : `Progresso: ${completedMembersCount}/${totalMembersCount} finalizados`}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
        >
          Fechar
        </button>
      </div>
    </div>
  );
}
