import { useMemo, useState } from 'react';
import { CalendarClock, ClipboardList, LayoutGrid, List, Plus, Repeat, Search, AlertCircle } from 'lucide-react';
import { Task, TaskModel, TeamMember, TagBucket } from '../types.ts';
import { isMonthly, isRecurring, parseIsoDate, ruleLabel, weekdaysOf } from '../services/taskModelService.ts';
import { formatISO, getWeekDates } from '../utils/dateUtils.ts';

interface TaskCatalogViewProps {
  models: TaskModel[];
  /** Execuções carregadas no Planner (para próximas datas e taxa de conclusão). */
  tasks: Task[];
  teamMembers: TeamMember[];
  tagBuckets: TagBucket[];
  currentUserId: string;
  isAdmin: boolean;
  loading: boolean;
  error: string | null;
  onOpenModel: (model: TaskModel) => void;
  onNewTask: () => void;
}

// Segunda → domingo
const COLUMNS: { day: number; label: string }[] = [
  { day: 1, label: 'Segunda' },
  { day: 2, label: 'Terça' },
  { day: 3, label: 'Quarta' },
  { day: 4, label: 'Quinta' },
  { day: 5, label: 'Sexta' },
  { day: 6, label: 'Sábado' },
  { day: 0, label: 'Domingo' },
];

const FALLBACK_COLORS = ['#2563eb', '#059669', '#d97706', '#7c3aed', '#db2777', '#0891b2', '#65a30d', '#dc2626'];

export default function TaskCatalogView({
  models,
  tasks,
  teamMembers,
  tagBuckets,
  currentUserId,
  isAdmin,
  loading,
  error,
  onOpenModel,
  onNewTask,
}: TaskCatalogViewProps) {
  const [mode, setMode] = useState<'week' | 'list'>('week');
  const [search, setSearch] = useState('');
  const [assignee, setAssignee] = useState('');
  const [mineOnly, setMineOnly] = useState(false);

  const todayIso = formatISO(new Date());
  const weekIsos = useMemo(() => new Set(getWeekDates(new Date()).map(formatISO)), []);

  const memberById = useMemo(() => new Map(teamMembers.map((m) => [m.id, m])), [teamMembers]);

  const bucketColor = useMemo(() => {
    const map = new Map<string, string>();
    tagBuckets.forEach((b, i) => map.set(b.nome, b.cor || b.color || FALLBACK_COLORS[i % FALLBACK_COLORS.length]));
    return (bucket: string) => {
      if (!map.has(bucket)) map.set(bucket, FALLBACK_COLORS[map.size % FALLBACK_COLORS.length]);
      return map.get(bucket)!;
    };
  }, [tagBuckets]);

  const executionsByModel = useMemo(() => {
    const map = new Map<string, Task[]>();
    tasks.forEach((t) => {
      if (!t.modeloId) return;
      map.set(t.modeloId, [...(map.get(t.modeloId) ?? []), t]);
    });
    return map;
  }, [tasks]);

  /** Cadastros "vivos": recorrentes ativos e avulsas ainda em aberto. */
  const liveModels = useMemo(() => {
    return models.filter((m) => {
      if (!m.active) return false;
      if (isRecurring(m)) return true;
      const runs = executionsByModel.get(m.id) ?? [];
      return runs.length === 0 || runs.some((t) => t.status !== 'concluida');
    });
  }, [models, executionsByModel]);

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('pt-BR');
    return liveModels.filter((m) => {
      if (q && !`${m.title} ${m.description} ${m.bucket}`.toLocaleLowerCase('pt-BR').includes(q)) return false;
      if (assignee && !m.assigneeIds.includes(assignee)) return false;
      if (mineOnly && m.createdBy !== currentUserId) return false;
      return true;
    });
  }, [liveModels, search, assignee, mineOnly, currentUserId]);

  const recurringCount = liveModels.filter(isRecurring).length;
  const weekExecutions = tasks.filter((t) => t.modeloId && t.scheduledDate && weekIsos.has(t.scheduledDate)).length;

  const weekly = filtered.filter((m) => isRecurring(m) && !isMonthly(m));
  const monthly = filtered.filter(isMonthly).sort((a, b) => dayOfMonth(a) - dayOfMonth(b));
  const oneOff = filtered
    .filter((m) => !isRecurring(m))
    .sort((a, b) => (a.startDate ?? '9999').localeCompare(b.startDate ?? '9999'));
  const hasWeekend = weekly.some((m) => weekdaysOf(m).some((d) => d === 0 || d === 6));
  const columns = hasWeekend ? COLUMNS : COLUMNS.slice(0, 5);

  const stats = (m: TaskModel) => {
    const runs = executionsByModel.get(m.id) ?? [];
    const next = runs
      .filter((t) => t.status !== 'concluida' && t.scheduledDate && t.scheduledDate >= todayIso)
      .map((t) => t.scheduledDate!)
      .sort()
      .slice(0, 3);
    const since = formatISO(new Date(Date.now() - 28 * 86400000));
    const recent = runs.filter((t) => t.scheduledDate && t.scheduledDate >= since && t.scheduledDate < todayIso);
    const done = recent.filter((t) => t.status === 'concluida').length;
    return { next, done, total: recent.length };
  };

  const Avatars = ({ ids }: { ids: string[] }) => (
    <div className="flex -space-x-1.5">
      {ids.slice(0, 4).map((id) => {
        const m = memberById.get(id);
        return (
          <span
            key={id}
            title={m?.name ?? 'Usuário removido'}
            className={`w-6 h-6 rounded-full border-2 border-white text-[9px] font-bold flex items-center justify-center ${m?.avatarColor ?? 'bg-slate-300 text-white'}`}
          >
            {m?.initials ?? '?'}
          </span>
        );
      })}
      {ids.length > 4 && <span className="w-6 h-6 rounded-full border-2 border-white bg-slate-200 text-[9px] font-bold text-slate-600 flex items-center justify-center">+{ids.length - 4}</span>}
    </div>
  );

  const RoutineCard = ({ m }: { m: TaskModel }) => (
    <button
      type="button"
      onClick={() => onOpenModel(m)}
      className="w-full text-left bg-white rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all p-2.5 cursor-pointer"
      style={{ borderLeft: `3px solid ${bucketColor(m.bucket)}` }}
    >
      <div className="text-xs font-semibold text-slate-800 leading-snug line-clamp-2">{m.title}</div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <Avatars ids={m.assigneeIds} />
        <div className="flex items-center gap-1 text-slate-400">
          {m.fields.length > 0 && <ClipboardList className="w-3.5 h-3.5" aria-label="Tem formulário" />}
        </div>
      </div>
    </button>
  );

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="p-4 sm:p-6 space-y-4">
        {/* Cabeçalho */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-slate-600">
              <b className="text-slate-900">{liveModels.length} tarefas</b> cadastradas
              <span className="text-slate-400"> · {recurringCount} se repetem · </span>
              <b className="text-slate-900">{weekExecutions} execuções</b> nesta semana
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="bg-slate-100 p-0.5 rounded-lg flex items-center border border-slate-200">
              <button type="button" onClick={() => setMode('week')} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md cursor-pointer ${mode === 'week' ? 'bg-white text-[#003067] shadow-sm' : 'text-slate-600'}`}>
                <LayoutGrid className="w-3.5 h-3.5" /> Rotina da semana
              </button>
              <button type="button" onClick={() => setMode('list')} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md cursor-pointer ${mode === 'list' ? 'bg-white text-[#003067] shadow-sm' : 'text-slate-600'}`}>
                <List className="w-3.5 h-3.5" /> Lista
              </button>
            </div>
            <button type="button" onClick={onNewTask} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0052cc] hover:bg-[#00478f] text-white text-xs font-bold cursor-pointer">
              <Plus className="w-4 h-4" /> Nova tarefa
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar tarefa" className="h-8 w-48 pl-8 pr-2.5 rounded-lg border border-slate-200 bg-white text-xs outline-none focus:border-[#0052cc]" />
          </div>
          <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-600">
            <option value="">Todas as pessoas</option>
            {teamMembers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <label className="flex items-center gap-1.5 text-xs text-slate-600 px-1 cursor-pointer select-none">
            <input type="checkbox" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} />
            Criadas por mim
          </label>
          {!isAdmin && <span className="text-[11px] text-slate-400 ml-auto">Você pode editar as tarefas que criou.</span>}
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
          </div>
        )}

        {loading ? (
          <div className="py-16 text-center text-xs text-slate-400">Carregando tarefas…</div>
        ) : mode === 'week' ? (
          <div className="space-y-5">
            <div className="overflow-x-auto">
              <div className="grid gap-3 min-w-[760px]" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}>
                {columns.map((c) => {
                  const items = weekly.filter((m) => weekdaysOf(m).includes(c.day));
                  return (
                    <div key={c.day} className="rounded-2xl bg-slate-50 border border-slate-200 p-2.5 min-h-[160px]">
                      <div className="flex items-center justify-between px-1 pb-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{c.label}</span>
                        <span className="text-[10px] font-bold text-slate-400">{items.length}</span>
                      </div>
                      <div className="space-y-2">
                        {items.map((m) => <RoutineCard key={m.id} m={m} />)}
                        {!items.length && <p className="text-[11px] text-slate-300 px-1 py-3">Nada neste dia</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {monthly.length > 0 && (
              <section className="rounded-2xl border border-slate-200 bg-white p-4">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5"><Repeat className="w-3.5 h-3.5" /> Mensais</h3>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
                  {monthly.map((m) => (
                    <div key={m.id} className="flex items-center gap-2">
                      <span className="w-10 shrink-0 text-center text-xs font-black text-slate-700 bg-slate-100 rounded-lg py-1.5">{dayOfMonth(m)}</span>
                      <div className="flex-1 min-w-0"><RoutineCard m={m} /></div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {oneOff.length > 0 && (
              <section className="rounded-2xl border border-slate-200 bg-white p-4">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5"><CalendarClock className="w-3.5 h-3.5" /> Avulsas em aberto</h3>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
                  {oneOff.map((m) => (
                    <div key={m.id}>
                      <p className="text-[10px] font-semibold text-slate-400 mb-1">{m.startDate ? parseIsoDate(m.startDate).toLocaleDateString('pt-BR') : 'Sem data (fila)'}</p>
                      <RoutineCard m={m} />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {!filtered.length && !error && (
              <div className="py-12 text-center text-xs text-slate-400">Nenhuma tarefa com esses filtros.</div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
            <table className="w-full text-xs min-w-[860px]">
              <thead>
                <tr className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 text-left">
                  <th className="px-4 py-2.5 font-bold">Tarefa</th>
                  <th className="px-3 py-2.5 font-bold">Quando</th>
                  <th className="px-3 py-2.5 font-bold">Responsáveis</th>
                  <th className="px-3 py-2.5 font-bold">Formulário</th>
                  <th className="px-3 py-2.5 font-bold">Criada por</th>
                  <th className="px-3 py-2.5 font-bold">Próximas</th>
                  <th className="px-3 py-2.5 font-bold text-right">Últimas 4 semanas</th>
                </tr>
              </thead>
              <tbody>
                {[...filtered].sort((a, b) => a.title.localeCompare(b.title, 'pt-BR')).map((m) => {
                  const s = stats(m);
                  const pct = s.total ? Math.round((s.done / s.total) * 100) : null;
                  return (
                    <tr key={m.id} onClick={() => onOpenModel(m)} className="border-t border-slate-100 hover:bg-slate-50/80 cursor-pointer">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: bucketColor(m.bucket) }} />
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-800 truncate max-w-[260px]">{m.title}</div>
                            <div className="text-[10px] text-slate-400">{m.bucket} · {m.priority}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-slate-600 whitespace-nowrap">{ruleLabel(m)}</td>
                      <td className="px-3 py-3"><Avatars ids={m.assigneeIds} /></td>
                      <td className="px-3 py-3 text-slate-500">{m.fields.length ? `${m.fields.length} campo(s)` : '—'}</td>
                      <td className="px-3 py-3 text-slate-500 whitespace-nowrap">{m.createdBy ? memberById.get(m.createdBy)?.name ?? '—' : 'Admin (anterior)'}</td>
                      <td className="px-3 py-3 text-slate-500 whitespace-nowrap">{s.next.length ? s.next.map((d) => parseIsoDate(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })).join(' · ') : '—'}</td>
                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        {pct === null ? (
                          <span className="text-slate-300">—</span>
                        ) : (
                          <span className={`font-bold ${pct >= 80 ? 'text-emerald-600' : pct >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                            {pct}% <span className="font-normal text-slate-400">({s.done}/{s.total})</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {!filtered.length && (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">Nenhuma tarefa com esses filtros.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function dayOfMonth(m: TaskModel) {
  return m.startDate ? parseIsoDate(m.startDate).getDate() : 1;
}
