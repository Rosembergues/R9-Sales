import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Download, Search, Users } from 'lucide-react';
import { Task, TaskModel, TeamMember } from '../types.ts';
import { formatISO, formatWeekInterval, getWeekDates } from '../utils/dateUtils.ts';

/**
 * Balanço da semana — 3 blocos:
 *   1. Resumo (concluídas, em atraso, pessoas em dia)
 *   2. Mapa da semana: tarefa × dia, com o status de cada execução
 *   3. Por pessoa + resultados dos formulários
 */

interface WeeklyBalanceViewProps {
  tasks: Task[];
  models: TaskModel[];
  teamMembers: TeamMember[];
  todayDate: Date;
  onTaskClick: (task: Task) => void;
}

type CellState = 'done' | 'late' | 'progress' | 'open';

const DAY_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

const assigneesOf = (t: Task) =>
  t.assignedToIds && t.assignedToIds.length ? t.assignedToIds : t.assignedTo ? [t.assignedTo] : [];

/** A parte de uma pessoa numa execução: concluiu se marcou a própria parte ou se a execução toda foi concluída. */
const personDone = (t: Task, uid: string) => t.status === 'concluida' || Boolean(t.userSubmissions?.[uid]?.completed);

const toNum = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(typeof v === 'string' ? v.replace(',', '.') : v);
  return Number.isFinite(n) ? n : null;
};

const fmt = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 2 });

export default function WeeklyBalanceView({ tasks, models, teamMembers, todayDate, onTaskClick }: WeeklyBalanceViewProps) {
  const [referenceDate, setReferenceDate] = useState<Date>(todayDate);
  const [search, setSearch] = useState('');
  const [person, setPerson] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const todayIso = formatISO(todayDate);
  const weekDates = useMemo(() => getWeekDates(referenceDate), [referenceDate]);
  const weekIsos = useMemo(() => weekDates.map(formatISO), [weekDates]);
  const memberById = useMemo(() => new Map(teamMembers.map((m) => [m.id, m])), [teamMembers]);
  const modelById = useMemo(() => new Map(models.map((m) => [m.id, m])), [models]);

  const stateOf = (t: Task): CellState => {
    if (t.status === 'concluida') return 'done';
    if (t.scheduledDate && t.scheduledDate < todayIso) return 'late';
    if (t.status === 'em_andamento') return 'progress';
    return 'open';
  };

  // Execuções da semana (com filtros)
  const weekTasks = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('pt-BR');
    return tasks.filter((t) => {
      if (!t.scheduledDate || !weekIsos.includes(t.scheduledDate)) return false;
      if (person && !assigneesOf(t).includes(person)) return false;
      if (q && !t.title.toLocaleLowerCase('pt-BR').includes(q)) return false;
      return true;
    });
  }, [tasks, weekIsos, person, search]);

  // Linhas do mapa: uma por tarefa (cadastro); execuções sem cadastro agrupam pelo título
  const rows = useMemo(() => {
    const groups = new Map<string, { key: string; title: string; bucket: string; runs: Task[] }>();
    weekTasks.forEach((t) => {
      const key = t.modeloId ?? `titulo:${t.title.trim().toLowerCase()}`;
      const title = (t.modeloId && modelById.get(t.modeloId)?.title) || t.title;
      const g = groups.get(key) ?? { key, title, bucket: t.bucket, runs: [] };
      g.runs.push(t);
      groups.set(key, g);
    });
    return Array.from(groups.values())
      .map((g) => {
        const done = g.runs.filter((t) => t.status === 'concluida').length;
        const late = g.runs.filter((t) => stateOf(t) === 'late').length;
        return { ...g, done, late, total: g.runs.length };
      })
      .sort((a, b) => b.late - a.late || a.title.localeCompare(b.title, 'pt-BR'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekTasks, modelById, todayIso]);

  const showWeekend = weekTasks.some((t) => {
    const idx = weekIsos.indexOf(t.scheduledDate!);
    return idx >= 5;
  });
  const dayIdx = showWeekend ? [0, 1, 2, 3, 4, 5, 6] : [0, 1, 2, 3, 4];

  // Resumo
  const total = weekTasks.length;
  const done = weekTasks.filter((t) => t.status === 'concluida').length;
  const late = weekTasks.filter((t) => stateOf(t) === 'late').length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  // Por pessoa
  const people = useMemo(() => {
    const map = new Map<string, { id: string; planned: number; done: number; late: Task[] }>();
    weekTasks.forEach((t) => {
      assigneesOf(t).forEach((uid) => {
        if (person && uid !== person) return;
        const p = map.get(uid) ?? { id: uid, planned: 0, done: 0, late: [] };
        p.planned += 1;
        if (personDone(t, uid)) p.done += 1;
        else if (t.scheduledDate && t.scheduledDate < todayIso) p.late.push(t);
        map.set(uid, p);
      });
    });
    return Array.from(map.values()).sort((a, b) => b.late.length - a.late.length || (memberById.get(a.id)?.name ?? '').localeCompare(memberById.get(b.id)?.name ?? '', 'pt-BR'));
  }, [weekTasks, person, todayIso, memberById]);
  const peopleOnTrack = people.filter((p) => p.late.length === 0).length;

  // Resultados dos formulários: soma dos campos numéricos por tarefa, com divisão por pessoa
  const formResults = useMemo(() => {
    return rows
      .map((row) => {
        const fields = new Map<string, { label: string; total: number; byPerson: Map<string, number> }>();
        row.runs.forEach((t) => {
          (t.customFields ?? []).forEach((f) => {
            if (f.type !== 'number') return;
            const entry = fields.get(f.label) ?? { label: f.label, total: 0, byPerson: new Map<string, number>() };
            const subs = Object.entries(t.userSubmissions ?? {});
            if (subs.length) {
              subs.forEach(([uid, sub]) => {
                const n = toNum(sub?.values?.[f.id]);
                if (n === null) return;
                entry.total += n;
                entry.byPerson.set(uid, (entry.byPerson.get(uid) ?? 0) + n);
              });
            } else {
              const n = toNum(t.customFieldValues?.find((v) => v.fieldId === f.id)?.value);
              if (n !== null) entry.total += n;
            }
            fields.set(f.label, entry);
          });
        });
        return { key: row.key, title: row.title, fields: Array.from(fields.values()).filter((f) => f.total > 0 || f.byPerson.size > 0) };
      })
      .filter((r) => r.fields.length);
  }, [rows]);

  const moveWeek = (delta: number) => {
    const d = new Date(referenceDate);
    d.setDate(d.getDate() + delta * 7);
    setReferenceDate(d);
    setExpanded(null);
  };

  const exportCsv = () => {
    const header = ['Data', 'Tarefa', 'Responsáveis', 'Status', 'Formulário'];
    const lines = weekTasks
      .slice()
      .sort((a, b) => (a.scheduledDate! + a.title).localeCompare(b.scheduledDate! + b.title))
      .map((t) => {
        const names = assigneesOf(t).map((id) => memberById.get(id)?.name ?? id).join('; ');
        const values = Object.entries(t.userSubmissions ?? {})
          .flatMap(([uid, sub]) =>
            (t.customFields ?? []).map((f) => {
              const v = sub?.values?.[f.id];
              return v === undefined || v === '' ? null : `${memberById.get(uid)?.name ?? uid} - ${f.label}: ${v}`;
            })
          )
          .filter(Boolean)
          .join(' | ');
        const status = { done: 'Concluída', late: 'Atrasada', progress: 'Em andamento', open: 'Pendente' }[stateOf(t)];
        return [t.scheduledDate!.split('-').reverse().join('/'), t.title, names, status, values];
      });
    const csv = [header, ...lines].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `balanco_${weekIsos[0]}_a_${weekIsos[6]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const Avatar = ({ id, size = 'w-6 h-6 text-[9px]' }: { id: string; size?: string }) => {
    const m = memberById.get(id);
    return (
      <span title={m?.name ?? 'Usuário removido'} className={`${size} rounded-full font-bold flex items-center justify-center shrink-0 ${m?.avatarColor ?? 'bg-slate-300 text-white'}`}>
        {m?.initials ?? '?'}
      </span>
    );
  };

  const cellStyles: Record<CellState, string> = {
    done: 'bg-emerald-500 text-white border-emerald-500',
    late: 'bg-red-50 text-red-600 border-red-300',
    progress: 'bg-blue-50 text-blue-600 border-blue-300',
    open: 'bg-white text-slate-300 border-slate-200',
  };
  const cellLabel: Record<CellState, string> = { done: 'Concluída', late: 'Atrasada', progress: 'Em andamento', open: 'Pendente' };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="p-4 sm:p-6 space-y-5">
        {/* Cabeçalho */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-base font-bold text-slate-900">Balanço da semana</h1>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => moveWeek(-1)} className="p-1.5 text-slate-500 hover:text-[#0052cc] hover:bg-blue-50 rounded-md cursor-pointer" aria-label="Semana anterior"><ChevronLeft className="w-4 h-4" /></button>
              <button type="button" onClick={() => setReferenceDate(todayDate)} className="px-2 py-1 text-xs font-semibold text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-md cursor-pointer">Esta semana</button>
              <button type="button" onClick={() => moveWeek(1)} className="p-1.5 text-slate-500 hover:text-[#0052cc] hover:bg-blue-50 rounded-md cursor-pointer" aria-label="Próxima semana"><ChevronRight className="w-4 h-4" /></button>
              <span className="text-xs font-semibold text-slate-600 pl-1">{formatWeekInterval(weekDates)}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar tarefa" className="h-8 w-40 pl-8 pr-2 rounded-lg border border-slate-200 bg-white text-xs outline-none focus:border-[#0052cc]" />
            </div>
            <select value={person} onChange={(e) => setPerson(e.target.value)} className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-600">
              <option value="">Toda a equipe</option>
              {teamMembers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <button type="button" onClick={exportCsv} disabled={!total} className="h-8 px-2.5 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 cursor-pointer">
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
          </div>
        </div>

        {/* 1. Resumo */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500"><CheckCircle2 className="w-4 h-4 text-emerald-600" /> Concluídas</div>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">{done}</span>
              <span className="text-sm text-slate-400">de {total}</span>
              <span className="ml-auto text-sm font-bold text-emerald-600">{pct}%</span>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden"><div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} /></div>
          </div>
          <div className={`rounded-2xl border p-4 ${late ? 'bg-red-50/50 border-red-200' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500"><AlertTriangle className={`w-4 h-4 ${late ? 'text-red-500' : 'text-slate-400'}`} /> Em atraso</div>
            <div className="mt-1.5 text-2xl font-black text-slate-900">{late}</div>
            <div className="text-[11px] text-slate-400">dias que já passaram sem conclusão</div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500"><Users className="w-4 h-4 text-[#0052cc]" /> Pessoas em dia</div>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">{peopleOnTrack}</span>
              <span className="text-sm text-slate-400">de {people.length}</span>
            </div>
            <div className="text-[11px] text-slate-400">sem nenhuma tarefa atrasada</div>
          </div>
        </div>

        {/* 2. Mapa da semana */}
        <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-slate-900">Mapa da semana</h2>
            <div className="flex items-center gap-3 text-[10px] text-slate-500">
              {(['done', 'late', 'progress', 'open'] as CellState[]).map((s) => (
                <span key={s} className="flex items-center gap-1"><span className={`w-3 h-3 rounded border ${cellStyles[s]}`} /> {cellLabel[s]}</span>
              ))}
            </div>
          </div>
          {rows.length === 0 ? (
            <p className="px-4 py-10 text-center text-xs text-slate-400">Nenhuma tarefa nesta semana{person || search ? ' com esses filtros' : ''}.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[640px]">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50">
                    <th className="text-left font-bold px-4 py-2">Tarefa</th>
                    {dayIdx.map((i) => (
                      <th key={i} className={`font-bold px-1 py-2 w-14 text-center ${weekIsos[i] === todayIso ? 'text-[#0052cc]' : ''}`}>
                        {DAY_LABELS[i]}<div className="text-[9px] font-semibold text-slate-400 normal-case">{weekDates[i].getDate()}</div>
                      </th>
                    ))}
                    <th className="text-right font-bold px-4 py-2 w-28">Semana</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const open = expanded === row.key;
                    const rowPct = row.total ? Math.round((row.done / row.total) * 100) : 0;
                    return (
                      <React.Fragment key={row.key}>
                        <tr className={`border-t border-slate-100 ${open ? 'bg-blue-50/30' : 'hover:bg-slate-50/70'}`}>
                          <td className="px-4 py-2">
                            <button type="button" onClick={() => setExpanded(open ? null : row.key)} className="flex items-center gap-1.5 text-left font-semibold text-slate-800 cursor-pointer" aria-expanded={open}>
                              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${open ? '' : '-rotate-90'}`} />
                              <span className="truncate max-w-[260px]">{row.title}</span>
                            </button>
                          </td>
                          {dayIdx.map((i) => {
                            const runs = row.runs.filter((t) => t.scheduledDate === weekIsos[i]);
                            return (
                              <td key={i} className="px-1 py-2 text-center">
                                {runs.length === 0 ? (
                                  <span className="text-slate-200">·</span>
                                ) : (
                                  <div className="flex justify-center gap-0.5">
                                    {runs.map((t) => {
                                      const st = stateOf(t);
                                      return (
                                        <button
                                          key={t.id}
                                          type="button"
                                          onClick={() => onTaskClick(t)}
                                          title={`${row.title} · ${DAY_LABELS[i]} ${weekDates[i].getDate()} · ${cellLabel[st]}`}
                                          className={`w-6 h-6 rounded-md border text-[11px] font-bold flex items-center justify-center cursor-pointer hover:scale-110 transition-transform ${cellStyles[st]}`}
                                        >
                                          {st === 'done' ? '✓' : st === 'late' ? '!' : st === 'progress' ? '…' : ''}
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                              </td>
                            );
                          })}
                          <td className="px-4 py-2 text-right whitespace-nowrap">
                            <span className="font-bold text-slate-800">{row.done}/{row.total}</span>
                            <span className={`ml-2 text-[11px] font-bold ${rowPct === 100 ? 'text-emerald-600' : row.late ? 'text-red-500' : 'text-slate-400'}`}>{rowPct}%</span>
                          </td>
                        </tr>
                        {open && (
                          <tr className="bg-blue-50/20">
                            <td colSpan={dayIdx.length + 2} className="px-4 pb-4 pt-1">
                              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-2">
                                {row.runs
                                  .slice()
                                  .sort((a, b) => a.scheduledDate!.localeCompare(b.scheduledDate!))
                                  .map((t) => {
                                    const numericFields = (t.customFields ?? []).filter((f) => f.type === 'number' || f.type === 'text');
                                    return (
                                      <div key={t.id} className="bg-white rounded-xl border border-slate-200 p-3">
                                        <div className="flex items-center justify-between gap-2 mb-2">
                                          <span className="text-[11px] font-bold text-slate-600">
                                            {DAY_LABELS[weekIsos.indexOf(t.scheduledDate!)]} {t.scheduledDate!.split('-').reverse().slice(0, 2).join('/')}
                                          </span>
                                          <button type="button" onClick={() => onTaskClick(t)} className="text-[11px] font-semibold text-[#0052cc] hover:underline cursor-pointer">Abrir</button>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                          {assigneesOf(t).map((uid) => {
                                            const ok = personDone(t, uid);
                                            const sub = t.userSubmissions?.[uid];
                                            const vals = numericFields
                                              .map((f) => ({ label: f.label, v: sub?.values?.[f.id] }))
                                              .filter((x) => x.v !== undefined && x.v !== '');
                                            return (
                                              <div key={uid} className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 ${ok ? 'border-emerald-200 bg-emerald-50/50' : t.scheduledDate! < todayIso ? 'border-red-200 bg-red-50/40' : 'border-slate-200'}`}>
                                                <Avatar id={uid} />
                                                <div className="leading-tight">
                                                  <div className="text-[11px] font-semibold text-slate-700">{memberById.get(uid)?.name ?? 'Usuário removido'}</div>
                                                  <div className="text-[10px] text-slate-500">
                                                    {ok ? 'Concluiu' : t.scheduledDate! < todayIso ? 'Não concluiu' : 'Pendente'}
                                                    {vals.length > 0 && ` · ${vals.map((x) => `${x.label}: ${x.v}`).join(' · ')}`}
                                                  </div>
                                                </div>
                                              </div>
                                            );
                                          })}
                                          {assigneesOf(t).length === 0 && <span className="text-[11px] text-slate-400">Sem responsável</span>}
                                        </div>
                                      </div>
                                    );
                                  })}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="grid lg:grid-cols-2 gap-5 items-start">
          {/* 3. Por pessoa */}
          <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100"><h2 className="text-sm font-bold text-slate-900">Por pessoa</h2></div>
            {people.length === 0 ? (
              <p className="px-4 py-8 text-center text-xs text-slate-400">Ninguém com tarefas nesta semana.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {people.map((p) => {
                  const pPct = p.planned ? Math.round((p.done / p.planned) * 100) : 0;
                  return (
                    <li key={p.id} className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar id={p.id} size="w-8 h-8 text-[10px]" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-slate-800 truncate">{memberById.get(p.id)?.name ?? 'Usuário removido'}</span>
                            <span className="text-xs text-slate-500 whitespace-nowrap"><b className="text-slate-800">{p.done}</b>/{p.planned} · {pPct}%</span>
                          </div>
                          <div className="mt-1.5 h-1.5 rounded-full bg-slate-100 overflow-hidden"><div className={`h-full rounded-full ${p.late.length ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${pPct}%` }} /></div>
                        </div>
                      </div>
                      {p.late.length > 0 && (
                        <div className="mt-2 ml-11 flex flex-wrap gap-1">
                          {p.late.map((t) => (
                            <button key={t.id} type="button" onClick={() => onTaskClick(t)} className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 cursor-pointer">
                              {t.title} · {t.scheduledDate!.split('-').reverse().slice(0, 2).join('/')}
                            </button>
                          ))}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Resultados dos formulários */}
          <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100"><h2 className="text-sm font-bold text-slate-900">Resultados dos formulários</h2></div>
            {formResults.length === 0 ? (
              <p className="px-4 py-8 text-center text-xs text-slate-400">Nenhum número preenchido nos formulários desta semana.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {formResults.map((r) => (
                  <li key={r.key} className="px-4 py-3 space-y-2">
                    <div className="text-xs font-semibold text-slate-800">{r.title}</div>
                    {r.fields.map((f) => (
                      <div key={f.label} className="flex flex-wrap items-center gap-2">
                        <span className="text-[11px] text-slate-500">{f.label}</span>
                        <span className="text-sm font-black text-slate-900">{fmt(f.total)}</span>
                        <div className="flex flex-wrap gap-1 ml-auto">
                          {Array.from(f.byPerson.entries())
                            .sort((a, b) => b[1] - a[1])
                            .map(([uid, v]) => (
                              <span key={uid} className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-600 bg-slate-50 border border-slate-200 rounded-full pl-0.5 pr-1.5 py-0.5">
                                <Avatar id={uid} size="w-4 h-4 text-[7px]" /> {fmt(v)}
                              </span>
                            ))}
                        </div>
                      </div>
                    ))}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
