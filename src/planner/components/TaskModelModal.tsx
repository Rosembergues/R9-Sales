import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Loader2, Lock, Plus, Repeat, Trash2, X, ClipboardList } from 'lucide-react';
import { CustomFormField, Priority, Recurrence, TaskModel, TeamMember } from '../types.ts';
import { TaskModelInput, WEEKDAY_KEYS, ruleLabel } from '../services/taskModelService.ts';
import { todayLocalIso } from '../../lib/dates';
import { errorText } from '../../lib/errors';

interface TaskModelModalProps {
  isOpen: boolean;
  /** Cadastro em edição; null = nova tarefa. */
  model: TaskModel | null;
  /** Data sugerida para uma tarefa nova (ex.: clique num dia do calendário). */
  defaultDate?: string | null;
  canEdit: boolean;
  teamMembers: TeamMember[];
  buckets: string[];
  currentUserId: string;
  onClose: () => void;
  onSave: (input: TaskModelInput, id?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

type RepeatOption = 'Nenhuma' | 'Diariamente' | 'Segunda a Sexta' | 'Semanalmente' | 'Mensalmente' | 'Personalizado';

const REPEAT_OPTIONS: { value: RepeatOption; label: string }[] = [
  { value: 'Nenhuma', label: 'Não repete' },
  { value: 'Segunda a Sexta', label: 'Segunda a sexta' },
  { value: 'Diariamente', label: 'Todos os dias' },
  { value: 'Semanalmente', label: 'Toda semana' },
  { value: 'Mensalmente', label: 'Todo mês' },
  { value: 'Personalizado', label: 'Dias específicos' },
];

const PRIORITIES: Priority[] = ['Urgente', 'Alta', 'Média', 'Baixa'];

const todayIso = todayLocalIso;

const newFieldId = () => `field-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export default function TaskModelModal(props: TaskModelModalProps) {
  if (!props.isOpen) return null;
  // key garante estado limpo a cada abertura
  return <TaskModelForm key={props.model?.id ?? `new-${props.defaultDate ?? ''}`} {...props} />;
}

function TaskModelForm({ model, defaultDate, canEdit, teamMembers, buckets, currentUserId, onClose, onSave, onDelete }: TaskModelModalProps) {
  const isNew = !model;
  const readOnly = !isNew && !canEdit;

  const [title, setTitle] = useState(model?.title ?? '');
  const [description, setDescription] = useState(model?.description ?? '');
  const [bucket, setBucket] = useState(model?.bucket ?? buckets[0] ?? 'Operacional');
  const [priority, setPriority] = useState<Priority>(model?.priority ?? 'Alta');
  const [assigneeIds, setAssigneeIds] = useState<string[]>(model?.assigneeIds ?? (currentUserId ? [currentUserId] : []));
  const [recurrence, setRecurrence] = useState<RepeatOption>((model?.recurrence as RepeatOption) ?? 'Nenhuma');
  const [days, setDays] = useState<string[]>(model?.recurrenceDays ?? []);
  const [startDate, setStartDate] = useState<string>(model ? model.startDate ?? '' : defaultDate ?? '');
  const [endDate, setEndDate] = useState<string>(model?.endDate ?? '');
  const [fields, setFields] = useState<CustomFormField[]>(model?.fields ?? []);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const recurring = recurrence !== 'Nenhuma';
  const creatorName = useMemo(() => {
    if (!model) return null;
    if (!model.createdBy) return 'um administrador';
    return teamMembers.find((m) => m.id === model.createdBy)?.name ?? 'outra pessoa';
  }, [model, teamMembers]);

  const toggleAssignee = (id: string) =>
    setAssigneeIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const toggleDay = (d: string) => setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));

  const updateField = (id: string, patch: Partial<CustomFormField>) =>
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));

  const preview: TaskModel = {
    id: model?.id ?? 'preview',
    title,
    description,
    priority,
    bucket,
    tags: model?.tags ?? [],
    assigneeIds,
    fields,
    recurrence: recurrence as Recurrence,
    recurrenceDays: days,
    startDate: startDate || (recurring ? todayIso() : null),
    endDate: endDate || null,
    active: true,
    createdBy: model?.createdBy ?? currentUserId,
  };

  const validate = (): string | null => {
    if (!title.trim()) return 'Dê um título para a tarefa.';
    if (!assigneeIds.length) return 'Escolha pelo menos um responsável.';
    if (recurrence === 'Personalizado' && !days.length) return 'Escolha os dias da semana.';
    if (recurring && endDate && startDate && endDate < startDate) return 'A data final é antes do início.';
    if (fields.some((f) => !f.label.trim())) return 'Todo campo do formulário precisa de um nome.';
    return null;
  };

  const handleSave = async () => {
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(
        {
          title: title.trim(),
          description,
          priority,
          bucket,
          tags: model?.tags ?? [],
          assigneeIds,
          fields: fields.map((f) => ({ ...f, label: f.label.trim() })),
          recurrence: recurrence as Recurrence,
          recurrenceDays: recurrence === 'Personalizado' ? days : [],
          startDate: startDate || (recurring ? todayIso() : null),
          endDate: recurring ? endDate || null : null,
        },
        model?.id
      );
      onClose();
    } catch (e) {
      setError(errorText(e, 'Não foi possível salvar a tarefa.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!model) return;
    setDeleting(true);
    setError(null);
    try {
      await onDelete(model.id);
      onClose();
    } catch (e) {
      setError(errorText(e, 'Não foi possível excluir a tarefa.'));
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  };

  const label = 'block text-[11px] font-semibold text-slate-500 mb-1';
  const input = 'w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white outline-none focus:border-[#0052cc] focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-500';

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[1px] flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white w-full max-w-2xl max-h-[92vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-model-title"
      >
        <div className="px-6 py-4 border-b border-slate-100 flex items-start justify-between gap-3">
          <div>
            <h2 id="task-model-title" className="text-base font-bold text-slate-900">
              {isNew ? 'Nova tarefa' : readOnly ? 'Tarefa' : 'Editar tarefa'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
              <Repeat className="w-3.5 h-3.5" /> {ruleLabel(preview)}
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer" aria-label="Fechar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {readOnly && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
              <Lock className="w-4 h-4 shrink-0 mt-0.5" />
              Criada por {creatorName}. Só quem criou (ou um admin) pode alterar esta tarefa.
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className={label} htmlFor="tm-title">Título</label>
              <input id="tm-title" value={title} onChange={(e) => setTitle(e.target.value)} disabled={readOnly} placeholder="Ex.: Ligar para os leads do dia" className={input} autoFocus={isNew} />
            </div>
            <div>
              <label className={label} htmlFor="tm-desc">Descrição (opcional)</label>
              <textarea id="tm-desc" value={description} onChange={(e) => setDescription(e.target.value)} disabled={readOnly} rows={2} className={`${input} resize-none`} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label} htmlFor="tm-bucket">Categoria</label>
                <select id="tm-bucket" value={bucket} onChange={(e) => setBucket(e.target.value)} disabled={readOnly} className={input}>
                  {Array.from(new Set([bucket, ...buckets])).map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <label className={label} htmlFor="tm-priority">Prioridade</label>
                <select id="tm-priority" value={priority} onChange={(e) => setPriority(e.target.value as Priority)} disabled={readOnly} className={input}>
                  {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div>
            <span className={label}>Responsáveis</span>
            <div className="flex flex-wrap gap-1.5">
              {teamMembers.map((m) => {
                const on = assigneeIds.includes(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    disabled={readOnly}
                    onClick={() => toggleAssignee(m.id)}
                    className={`px-2.5 py-1.5 rounded-full text-xs font-semibold border transition-colors ${on ? 'bg-[#0052cc] text-white border-[#0052cc]' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'} ${readOnly ? 'cursor-default' : 'cursor-pointer'}`}
                  >
                    {m.name}{m.id === currentUserId ? ' (você)' : ''}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-4 space-y-3">
            <span className={label}>Repetição</span>
            <div className="flex flex-wrap gap-1.5">
              {REPEAT_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  disabled={readOnly}
                  onClick={() => setRecurrence(o.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${recurrence === o.value ? 'bg-blue-50 text-[#0052cc] border-blue-300' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'} ${readOnly ? 'cursor-default' : 'cursor-pointer'}`}
                >
                  {o.label}
                </button>
              ))}
            </div>
            {recurrence === 'Personalizado' && (
              <div className="flex gap-1.5">
                {WEEKDAY_KEYS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    disabled={readOnly}
                    onClick={() => toggleDay(d)}
                    className={`w-11 py-1.5 rounded-lg text-xs font-bold border ${days.includes(d) ? 'bg-[#0052cc] text-white border-[#0052cc]' : 'bg-white text-slate-600 border-slate-200'} ${readOnly ? 'cursor-default' : 'cursor-pointer'}`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label} htmlFor="tm-start">
                  {recurring ? (recurrence === 'Semanalmente' ? 'Começa em (define o dia da semana)' : recurrence === 'Mensalmente' ? 'Começa em (define o dia do mês)' : 'Começa em') : 'Data'}
                </label>
                <input id="tm-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} disabled={readOnly} className={input} />
                {!recurring && !startDate && <p className="text-[10px] text-slate-400 mt-1">Sem data, a tarefa vai para a fila.</p>}
              </div>
              {recurring && (
                <div>
                  <label className={label} htmlFor="tm-end">Termina em (opcional)</label>
                  <input id="tm-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} disabled={readOnly} className={input} />
                </div>
              )}
            </div>
            {recurring && (
              <p className="text-[11px] text-slate-400">
                As execuções das próximas 8 semanas ficam gravadas e o sistema renova esse prazo todo dia.
                {!isNew && ' Alterações valem para as execuções futuras ainda não concluídas.'}
              </p>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className={`${label} mb-0 flex items-center gap-1.5`}><ClipboardList className="w-3.5 h-3.5" /> Formulário ao concluir (opcional)</span>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => setFields((prev) => [...prev, { id: newFieldId(), label: '', type: 'number', required: true }])}
                  className="text-xs font-semibold text-[#0052cc] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Adicionar campo
                </button>
              )}
            </div>
            {!fields.length && <p className="text-xs text-slate-400">Sem formulário: o responsável só marca como concluída.</p>}
            {fields.map((f) => (
              <div key={f.id} className="flex flex-wrap items-center gap-2">
                <input
                  value={f.label}
                  onChange={(e) => updateField(f.id, { label: e.target.value })}
                  disabled={readOnly}
                  placeholder="Ex.: Número de ligações"
                  className={`${input} flex-1 min-w-[180px] py-1.5`}
                />
                <select value={f.type} onChange={(e) => updateField(f.id, { type: e.target.value as 'number' | 'text' })} disabled={readOnly} className={`${input} w-28 py-1.5`}>
                  <option value="number">Número</option>
                  <option value="text">Texto</option>
                </select>
                <label className="flex items-center gap-1 text-xs text-slate-600">
                  <input type="checkbox" checked={f.required} onChange={(e) => updateField(f.id, { required: e.target.checked })} disabled={readOnly} />
                  Obrigatório
                </label>
                {!readOnly && (
                  <button type="button" onClick={() => setFields((prev) => prev.filter((x) => x.id !== f.id))} className="p-1.5 text-slate-400 hover:text-red-600 rounded cursor-pointer" aria-label="Remover campo">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700" role="alert">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-2">
          <div>
            {!isNew && canEdit && (
              confirmDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-red-700 font-semibold">Excluir a tarefa e as execuções em aberto?</span>
                  <button type="button" onClick={handleDelete} disabled={deleting} className="px-3 py-1.5 text-xs font-bold rounded-lg bg-red-600 text-white hover:bg-red-700 cursor-pointer flex items-center gap-1">
                    {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Excluir
                  </button>
                  <button type="button" onClick={() => setConfirmDelete(false)} className="px-2 py-1.5 text-xs text-slate-500 cursor-pointer">Não</button>
                </div>
              ) : (
                <button type="button" onClick={() => setConfirmDelete(true)} className="px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-1.5 cursor-pointer">
                  <Trash2 className="w-3.5 h-3.5" /> Excluir tarefa
                </button>
              )
            )}
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer">
              {readOnly ? 'Fechar' : 'Cancelar'}
            </button>
            {!readOnly && (
              <button type="button" onClick={handleSave} disabled={saving} className="px-4 py-2 text-xs font-bold rounded-lg bg-[#0052cc] hover:bg-[#00478f] disabled:opacity-60 text-white flex items-center gap-1.5 cursor-pointer">
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {isNew ? 'Criar tarefa' : 'Salvar alterações'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
