import React, { useState } from 'react';
import {
  X,
  Plus,
  Tag,
  Sliders,
  Trash2,
  ListPlus,
  HelpCircle,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { Task, TeamMember, Priority, Recurrence, CustomFormField, TagBucket } from '../types.ts';
import { BUCKET_OPTIONS } from '../data/mockData.ts';

interface NewTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateTask: (newTask: Omit<Task, 'id' | 'comments'>) => Promise<any> | void;
  teamMembers: TeamMember[];
  defaultScheduledDate?: string | null;
  buckets?: string[];
  tagBuckets?: TagBucket[];
}

const WEEK_DAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom'];

function NewTaskModalContent({
  isOpen,
  onClose,
  onCreateTask,
  teamMembers,
  defaultScheduledDate = null,
  buckets = BUCKET_OPTIONS,
  tagBuckets = [],
}: NewTaskModalProps) {
  const initialBucket = buckets.length > 0 ? buckets[0] : 'Operacional';
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('Alta');
  const [recurrence, setRecurrence] = useState<Recurrence>('Nenhuma');
  const [customRecurrenceDays, setCustomRecurrenceDays] = useState<string[]>([]);
  const [bucket, setBucket] = useState(initialBucket);
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [scheduleType, setScheduleType] = useState<'scheduled' | 'queue'>(
    defaultScheduledDate ? 'scheduled' : 'queue'
  );
  const [scheduledDate, setScheduledDate] = useState(defaultScheduledDate || '');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleAssignee = (memberId: string) => {
    setSelectedAssignees((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
    );
  };

  // Campos Customizáveis / Formulário Obrigatório por Ação
  const [customFields, setCustomFields] = useState<CustomFormField[]>([]);
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldType, setNewFieldType] = useState<'number' | 'text'>('number');
  const [newFieldRequired, setNewFieldRequired] = useState(true);
  const [newFieldPlaceholder, setNewFieldPlaceholder] = useState('');
  const [isAddingField, setIsAddingField] = useState(false);

  const handleAddTag = (e?: React.MouseEvent | React.KeyboardEvent) => {
    if (e) e.preventDefault();
    const clean = tagInput.trim();
    if (clean && !tags.includes(clean)) {
      setTags([...tags, clean]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  // Adicionar campo customizado
  const handleAddCustomField = () => {
    if (!newFieldLabel.trim()) return;

    const newField: CustomFormField = {
      id: `field-${Date.now()}`,
      label: newFieldLabel.trim(),
      type: newFieldType,
      required: newFieldRequired,
      placeholder: newFieldPlaceholder.trim() || undefined,
    };

    setCustomFields((prev) => [...prev, newField]);
    setNewFieldLabel('');
    setNewFieldPlaceholder('');
    setNewFieldType('number');
    setNewFieldRequired(true);
    setIsAddingField(false);
  };

  // Predefinições rápidas (ex: Ligações comerciais)
  const handleApplyPresetCalls = () => {
    const preset1: CustomFormField = {
      id: `field-${Date.now()}-1`,
      label: 'Número de ligações totais',
      type: 'number',
      required: true,
      placeholder: 'Ex: 40',
    };
    const preset2: CustomFormField = {
      id: `field-${Date.now()}-2`,
      label: 'Número de ligações efetivas',
      type: 'number',
      required: true,
      placeholder: 'Ex: 15',
    };
    setCustomFields((prev) => [...prev, preset1, preset2]);
  };

  const handleRemoveCustomField = (id: string) => {
    setCustomFields((prev) => prev.filter((f) => f.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setErrorMessage('');

    if (!title.trim()) {
      setErrorMessage('O Nome da Ação é obrigatório.');
      return;
    }

    try {
      setIsSubmitting(true);
      await onCreateTask({
        title: title.trim(),
        description: description.trim(),
        priority,
        recurrence,
        recurrenceDays: recurrence === 'Personalizado' ? customRecurrenceDays : undefined,
        bucket,
        assignedTo: selectedAssignees[0] || null,
        assignedToIds: selectedAssignees,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        scheduledDate: scheduleType === 'scheduled' && scheduledDate ? scheduledDate : null,
        status: 'pendente',
        tags,
        customFields,
        customFieldValues: [],
      });
      onClose();
    } catch (err: any) {
      console.error('Erro ao criar ação:', err);
      setErrorMessage(
        err?.message ||
          'Falha ao salvar a nova ação no Supabase. O formulário não foi fechado para evitar perda de dados. Tente novamente.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="new-task-modal-backdrop"
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        id="new-task-modal-card"
        className="w-full max-w-lg bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-white shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              Nova Ação / Tarefa
            </h2>
            <p className="text-xs text-gray-500">
              Preencha os parâmetros e atribuições da ação
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulário com Scroll */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {errorMessage && (
            <div className="p-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg">
              {errorMessage}
            </div>
          )}

          {/* Nome da Ação */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Nome da Ação *
            </label>
            <input
              type="text"
              required
              placeholder="Ex: Auditoria fiscal Q3, Lançamento do Produto, Prospecção Ativa..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full text-xs border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Descrição Detalhada
            </label>
            <textarea
              rows={2}
              placeholder="Instruções para o responsável da equipe..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-xs border border-gray-300 rounded-lg p-3 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* Linha: Prioridade + Recorrência */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Prioridade
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                className="w-full text-xs bg-white border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-blue-600"
              >
                <option value="Urgente">Urgente</option>
                <option value="Alta">Alta</option>
                <option value="Média">Média</option>
                <option value="Baixa">Baixa</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Recorrência
              </label>
              <select
                value={recurrence}
                onChange={(e) => {
                  const val = e.target.value as Recurrence;
                  setRecurrence(val);
                  if (val === 'Personalizado' && customRecurrenceDays.length === 0) {
                    setCustomRecurrenceDays(['Seg', 'Ter', 'Qua', 'Qui', 'Sex']);
                  }
                }}
                className="w-full text-xs bg-white border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-blue-600"
              >
                <option value="Nenhuma">Nenhuma (Única vez)</option>
                <option value="Segunda a Sexta">Segunda a Sexta (Dias Úteis)</option>
                <option value="Diariamente">Diariamente</option>
                <option value="Semanalmente">Semanalmente</option>
                <option value="Mensalmente">Mensalmente</option>
                <option value="Personalizado">Personalizado</option>
              </select>
            </div>
          </div>

          {/* Seleção de Dias da Semana (Exibido quando Recorrência for Personalizado) */}
          {recurrence === 'Personalizado' && (
            <div className="flex items-center justify-between flex-wrap gap-2 py-1 px-1">
              {WEEK_DAYS.map((day) => {
                const isChecked = customRecurrenceDays.includes(day);
                return (
                  <label
                    key={day}
                    className="flex items-center gap-1.5 text-xs text-gray-800 font-medium cursor-pointer select-none hover:text-[#004691]"
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {
                        setCustomRecurrenceDays((prev) =>
                          prev.includes(day)
                            ? prev.filter((d) => d !== day)
                            : [...prev, day]
                        );
                      }}
                      className="w-4 h-4 rounded border-gray-400 text-[#004691] focus:ring-[#004691] cursor-pointer accent-[#004691]"
                    />
                    <span>{day}</span>
                  </label>
                );
              })}
            </div>
          )}

          {/* Bucket / Categoria */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Bucket / Categoria
            </label>
            <select
              value={bucket}
              onChange={(e) => setBucket(e.target.value)}
              className="w-full text-xs bg-white border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-blue-600 font-medium"
            >
              {buckets.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          {/* Atribuir Múltiplos Responsáveis */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-gray-700">
                Responsáveis da Ação {selectedAssignees.length > 0 && `(${selectedAssignees.length} selecionado${selectedAssignees.length > 1 ? 's' : ''})`}
              </label>
              {selectedAssignees.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedAssignees([])}
                  className="text-[11px] text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
                >
                  Limpar seleção
                </button>
              )}
            </div>

            <div className="p-2.5 bg-gray-50/80 border border-gray-200 rounded-lg max-h-36 overflow-y-auto space-y-1.5">
              {teamMembers.map((m) => {
                const isSelected = selectedAssignees.includes(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggleAssignee(m.id)}
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
                          ({m.role === 'admin' ? 'Admin' : 'Membro'})
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

          {/* Destino de Agendamento */}
          <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 space-y-2">
            <label className="block text-xs font-semibold text-gray-700">
              Onde alocar esta ação inicialmente?
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer">
                <input
                  type="radio"
                  name="scheduleType"
                  checked={scheduleType === 'queue'}
                  onChange={() => setScheduleType('queue')}
                  className="text-blue-600"
                />
                <span>Fila de Não Iniciadas (Sem data)</span>
              </label>
              <label className="flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer">
                <input
                  type="radio"
                  name="scheduleType"
                  checked={scheduleType === 'scheduled'}
                  onChange={() => setScheduleType('scheduled')}
                  className="text-blue-600"
                />
                <span>Agendar no Calendário</span>
              </label>
            </div>

            {scheduleType === 'scheduled' && (
              <div className="pt-2">
                <input
                  type="date"
                  required={scheduleType === 'scheduled'}
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className="w-full text-xs bg-white border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-blue-600"
                />
              </div>
            )}
          </div>

          {/* Seção de Campos Customizáveis / Formulário Obrigatório por Ação */}
          <div className="bg-blue-50/40 border border-blue-200/80 rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-blue-700" />
                <label className="text-xs font-bold text-gray-900">
                  Campos de Formulário Customizáveis
                </label>
              </div>
              <span className="text-[10px] text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded font-medium">
                Admin
              </span>
            </div>

            <p className="text-[11px] text-gray-600 leading-snug">
              Adicione métricas ou campos que o responsável deve obrigatoriamente responder para concluir esta ação no dia (ex: <em>'Número de ligações totais'</em> e <em>'Número de ligações efetivas'</em>).
            </p>

            {/* Lista de Campos já Adicionados */}
            {customFields.length > 0 && (
              <div className="space-y-2 pt-1">
                {customFields.map((field) => (
                  <div
                    key={field.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-white border border-blue-200/70 text-xs shadow-2xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-medium text-gray-800 truncate">
                        {field.label}
                      </span>
                      <span className="text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.2 rounded shrink-0">
                        {field.type === 'number' ? 'Numérico' : 'Texto'}
                      </span>
                      {field.required && (
                        <span className="text-[10px] text-red-700 bg-red-50 border border-red-200 px-1.5 py-0.2 rounded font-semibold shrink-0">
                          Obrigatório
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveCustomField(field.id)}
                      className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                      title="Remover campo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Painel para Inserir Novo Campo Customizado */}
            {isAddingField ? (
              <div className="p-3 bg-white rounded-lg border border-blue-200 space-y-2.5 mt-2">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                    Nome / Rótulo do Campo *
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Número de ligações totais"
                    value={newFieldLabel}
                    onChange={(e) => setNewFieldLabel(e.target.value)}
                    className="w-full text-xs border border-gray-300 rounded px-2.5 py-1.5 outline-none focus:border-blue-600"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                      Tipo do Campo
                    </label>
                    <select
                      value={newFieldType}
                      onChange={(e) => setNewFieldType(e.target.value as 'number' | 'text')}
                      className="w-full text-xs bg-white border border-gray-300 rounded px-2 py-1.5 outline-none focus:border-blue-600"
                    >
                      <option value="number">Número / Métrica</option>
                      <option value="text">Texto / Descrição</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                      Placeholder (Dica)
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: 0 ou Ex: Observação..."
                      value={newFieldPlaceholder}
                      onChange={(e) => setNewFieldPlaceholder(e.target.value)}
                      className="w-full text-xs border border-gray-300 rounded px-2.5 py-1.5 outline-none focus:border-blue-600"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newFieldRequired}
                      onChange={(e) => setNewFieldRequired(e.target.checked)}
                      className="rounded text-blue-600"
                    />
                    <span>Obrigatório para concluir ação</span>
                  </label>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setIsAddingField(false)}
                      className="px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleAddCustomField}
                      disabled={!newFieldLabel.trim()}
                      className="px-3 py-1 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50"
                    >
                      Salvar Campo
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsAddingField(true)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 bg-white hover:bg-blue-50 px-2.5 py-1.5 rounded-lg border border-blue-300 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Adicionar Campo Customizado</span>
                </button>

                <button
                  type="button"
                  onClick={handleApplyPresetCalls}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-700 bg-white hover:bg-gray-100 px-2.5 py-1.5 rounded-lg border border-gray-300 transition-colors"
                  title="Insere 'Ligações Totais' e 'Ligações Efetivas'"
                >
                  <ListPlus className="w-3 h-3 text-gray-500" />
                  <span>Preset: Ligações Telefônicas</span>
                </button>
              </div>
            )}
          </div>

          {/* TAGs */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-gray-700">
                TAGs
              </label>
              {tagBuckets.length > 0 && (
                <span className="text-[10px] text-zinc-400">Clique nas sugestões abaixo para adicionar</span>
              )}
            </div>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                placeholder="Ex: Financeiro, Urgente, Cliente X..."
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                className="text-xs border border-gray-300 rounded-lg px-3 py-1.5 flex-1 outline-none focus:border-blue-600"
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="px-3 py-1.5 text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors cursor-pointer"
              >
                Adicionar
              </button>
            </div>

            {/* Sugestões rápidas de Tags cadastradas */}
            {tagBuckets.length > 0 && (
              <div className="flex flex-wrap items-center gap-1 mb-2">
                <span className="text-[10px] text-zinc-400 mr-1">Sugestões:</span>
                {tagBuckets.map((tb) => {
                  const isSelected = tags.includes(tb.nome);
                  return (
                    <button
                      key={tb.id}
                      type="button"
                      onClick={() => {
                        if (isSelected) {
                          handleRemoveTag(tb.nome);
                        } else {
                          setTags([...tags, tb.nome]);
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

            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {tags.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 text-[11px] bg-gray-100 text-gray-700 px-2 py-0.5 rounded border border-gray-200"
                  >
                    <Tag className="w-2.5 h-2.5 text-gray-400" />
                    {t}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(t)}
                      className="text-gray-400 hover:text-red-600 ml-1 cursor-pointer"
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Rodapé / Ações */}
          <div className="pt-3 border-t border-gray-200 flex items-center justify-end gap-2">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-medium text-white bg-institucional hover:opacity-95 rounded-lg transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Salvando no Supabase...</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Criar Ação</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


// Mantém o componente com hooks montado somente quando o modal está aberto.
// Isso evita mudar a ordem/quantidade de hooks entre renders e o erro React
// "Expected static flag was missing" ao abrir/fechar o formulário.
export default function NewTaskModal(props: NewTaskModalProps) {
  if (!props.isOpen) return null;
  return <NewTaskModalContent key="new-task-modal" {...props} />;
}
