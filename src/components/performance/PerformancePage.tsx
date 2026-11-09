import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, ChevronLeft, ChevronRight, Database, Download, ShoppingCart } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSales } from '../../context/SalesContext';
import { useOfficialGoals } from '../../hooks/useOfficialGoals';
import { supabase } from '../../lib/supabase';
import { getRealSaleDate, getSaleFdiDisplay } from '../../lib/salesMapper';
import { getModelMetadata } from '../../lib/goalImport';
import { resolveDataDate } from '../../lib/goalProgress';
import { getRankingOperationTarget } from '../seller/rankingUtils';
import {
  METHOD_FILTERS,
  IndividualGoal,
  addDays,
  consultantRows,
  salesProfile,
  SalesProfile,
  currentCycleRange,
  dailyCsv,
  dailyRows,
  goalsForRange,
  mondayOf,
  monthRange,
  summarize,
  weeklyRows,
} from '../../lib/performance';
import { CumulativeChart, STATUS_STYLE, StatusChip, VsAA, statusOf } from '../dashboard/OfficialGoalsPanel';

type PeriodMode = 'ciclo' | 'mes' | 'semana' | 'livre';
type Tab = 'geral' | 'semanas' | 'dias' | 'consultores' | 'perfil';

const fmt = (v: number, digits = 0) => v.toLocaleString('pt-BR', { maximumFractionDigits: digits });
const fmtSmart = (v: number) => fmt(v, Math.abs(v) > 0 && Math.abs(v) < 10 ? 1 : 0);
const fmtPct = (v: number | null) => (v === null ? '—' : `${fmt(v)}%`);
const pct = (a: number, b: number) => (b > 0 ? (a / b) * 100 : null);
const br = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const brFull = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const localIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const monthLabel = (iso: string) => { // ex.: "Novembro de 2026"
  const s = new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const groupLabel = (g: string) => getModelMetadata(g).title.replace('Graduação · ', '').replace('Pós-Graduação · ', 'Pós ').replace('Curso Técnico · ', 'Técnico ');

interface Props {
  onOpenNewSaleModal?: () => void;
}

export const PerformancePage: React.FC<Props> = ({ onOpenNewSaleModal }) => {
  const { currentUser, profiles } = useAuth();
  const { sales } = useSales();
  const official = useOfficialGoals();
  const isAdmin = currentUser?.role === 'admin';

  const todayIso = useMemo(() => localIso(new Date()), []);
  const dataDate = useMemo(() => resolveDataDate(official.points, todayIso), [official.points, todayIso]);

  const [filterKey, setFilterKey] = useState('graduacao');
  const [mode, setMode] = useState<PeriodMode>('ciclo');
  const [anchor, setAnchor] = useState(todayIso); // referência para mês/semana
  const [custom, setCustom] = useState(() => ({ start: monthRange(todayIso).start, end: todayIso }));
  const [tab, setTab] = useState<Tab>('geral');
  const [goals, setGoals] = useState<IndividualGoal[]>([]);

  const filter = METHOD_FILTERS.find(f => f.key === filterKey) ?? METHOD_FILTERS[0];

  const cycle = useMemo(
    () => currentCycleRange(official.points, filter.groups, dataDate),
    [official.points, filter.groups, dataDate],
  );

  const range = useMemo(() => {
    if (mode === 'mes') return monthRange(anchor);
    if (mode === 'semana') { const s = mondayOf(anchor); return { start: s, end: addDays(s, 6) }; }
    if (mode === 'livre') return custom.start <= custom.end ? custom : { start: custom.end, end: custom.start };
    return cycle ? { start: cycle.start, end: cycle.end } : monthRange(todayIso);
  }, [mode, anchor, custom, cycle, todayIso]);

  const rangeLabel = mode === 'mes'
    ? monthLabel(range.start)
    : mode === 'ciclo' && cycle
      ? `Ciclo ${cycle.periods.join(' + ')} · ${br(range.start)} a ${br(range.end)}`
      : `${brFull(range.start)} a ${brFull(range.end)}`;

  const rows = useMemo(
    () => dailyRows(official.points, filter.groups, range.start, range.end, dataDate),
    [official.points, filter.groups, range, dataDate],
  );
  const weeks = useMemo(() => weeklyRows(rows, dataDate), [rows, dataDate]);

  // Detalhe por modalidade dentro do filtro (ex.: Graduação → 5 modalidades).
  // Em "Ciclo atual" cada modalidade usa o próprio ciclo: o Semi termina antes do Presencial,
  // então o ritmo necessário de cada uma é calculado até o fim da sua própria meta.
  const byGroup = useMemo(
    () => filter.groups.map(g => {
      const r = mode === 'ciclo' ? (currentCycleRange(official.points, [g], dataDate) ?? range) : range;
      return { group: g, s: summarize(dailyRows(official.points, [g], r.start, r.end, dataDate), dataDate) };
    }),
    [official.points, filter.groups, range, dataDate, mode],
  );

  const summary = useMemo(() => {
    const whole = summarize(rows, dataDate);
    if (mode !== 'ciclo' || filter.groups.length < 2) return whole;
    // Ciclo atual com várias modalidades: soma os resumos de cada uma (cada uma no seu ciclo).
    const parts = byGroup.map(b => b.s);
    const sum = (k: 'metaToDate' | 'metaTotal' | 'actual' | 'aaToDate' | 'aaTotal' | 'gap') => parts.reduce((t, p) => t + p[k], 0);
    const required = parts.reduce((t, p) => t + (p.requiredPerDay ?? 0), 0);
    const projection = parts.reduce((t, p) => t + (p.projection ?? p.actual), 0);
    return {
      metaToDate: sum('metaToDate'), metaTotal: sum('metaTotal'), actual: sum('actual'),
      aaToDate: sum('aaToDate'), aaTotal: sum('aaTotal'), gap: sum('gap'),
      remainingDays: Math.max(0, ...parts.map(p => p.remainingDays)),
      requiredPerDay: required > 0 ? required : null,
      projection: sum('metaToDate') > 0 ? projection : null,
    };
  }, [rows, dataDate, mode, filter.groups.length, byGroup]);

  // Metas individuais (Configuração de Metas) que caem no intervalo.
  useEffect(() => {
    let alive = true;
    supabase
      .from('goals')
      .select('*')
      .lte('reference_start', range.end)
      .gte('reference_end', range.start)
      .then(({ data }) => { if (alive) setGoals((data as IndividualGoal[]) || []); });
    return () => { alive = false; };
  }, [range.start, range.end]);

  const perfSales = useMemo(() => sales.map(s => {
    const d = getRealSaleDate(s) || new Date(s.created_at);
    return {
      sellerId: s.seller_id,
      sellerName: s.seller_name,
      date: localIso(d),
      mainProduct: s.custom_data?.main_product || s.product_name,
      modality: s.custom_data?.modality,
      shift: s.custom_data?.shift,
      fdi: getSaleFdiDisplay(s),
      parcela: s.custom_data?.parcela_leve,
      bolsa: Boolean(s.custom_data?.has_bolsa_convenio),
    };
  }), [sales]);

  const consultants = useMemo(() => {
    const validGoals = goalsForRange(goals, range.start, range.end, mode === 'semana');
    const targetOf = filter.operation
      ? (userId: string) => validGoals
          .filter(g => g.user_id === userId)
          .reduce((sum, g) => sum + getRankingOperationTarget(g as any, filter.operation!), 0)
      : null;
    return consultantRows(perfSales, filter.groups, range.start, range.end, profiles, targetOf);
  }, [goals, range, mode, filter, perfSales, profiles]);

  const profile = useMemo(
    () => salesProfile(perfSales, filter.groups, range.start, range.end),
    [perfSales, filter.groups, range],
  );

  const shift = (dir: 1 | -1) => {
    if (mode === 'mes') {
      const d = new Date(`${anchor}T12:00:00`);
      setAnchor(localIso(new Date(d.getFullYear(), d.getMonth() + dir, 1)));
    } else if (mode === 'semana') {
      setAnchor(addDays(anchor, 7 * dir));
    }
  };

  const downloadCsv = () => {
    const blob = new Blob(['﻿' + dailyCsv(rows)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `desempenho-${filter.key}-${range.start}-a-${range.end}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (!currentUser) return null;

  const att = pct(summary.actual, summary.metaToDate);
  const hasOfficial = official.hasImports;
  const tabs: { key: Tab; label: string }[] = [
    { key: 'geral', label: 'Visão geral' },
    { key: 'semanas', label: 'Semana a semana' },
    { key: 'dias', label: 'Dia a dia' },
    { key: 'consultores', label: isAdmin ? 'Consultores' : 'Meu desempenho' },
    { key: 'perfil', label: 'Perfil das vendas' },
  ];

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Cabeçalho */}
      <section className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-950 font-['Space_Grotesk'] flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-blue-600" /> Analytics
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Metas oficiais do Power BI em detalhe: por metodologia, semana, dia e consultor.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {hasOfficial && (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] text-slate-500">
              <Database className="w-3.5 h-3.5" /> Dados até <b className="text-slate-700">{br(dataDate)}</b>
            </span>
          )}
          {onOpenNewSaleModal && (
            <button onClick={onOpenNewSaleModal} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 cursor-pointer">
              <ShoppingCart className="w-4 h-4" /> Lançar venda
            </button>
          )}
        </div>
      </section>

      {/* Filtros: uma linha acima de tudo */}
      <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm flex flex-col xl:flex-row xl:items-center gap-3">
        <select
          value={filterKey}
          onChange={e => setFilterKey(e.target.value)}
          className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-800"
          name="performance_method_filter"
        >
          {METHOD_FILTERS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
        </select>

        <div className="flex rounded-lg bg-slate-100 p-1 text-[11px] font-bold w-fit">
          {([['ciclo', 'Ciclo atual'], ['mes', 'Mês'], ['semana', 'Semana'], ['livre', 'Período']] as [PeriodMode, string][]).map(([m, label]) => (
            <button
              key={m}
              onClick={() => { setMode(m); setAnchor(todayIso); }}
              className={`px-3 py-1.5 rounded-md cursor-pointer ${mode === m ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-900'}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-700">
          {(mode === 'mes' || mode === 'semana') && (
            <button onClick={() => shift(-1)} className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer" aria-label="Anterior"><ChevronLeft className="w-4 h-4" /></button>
          )}
          {mode === 'livre' ? (
            <>
              <input type="date" value={custom.start} onChange={e => setCustom(c => ({ ...c, start: e.target.value }))} className="h-9 rounded-lg border border-slate-200 px-2 text-xs" name="performance_start" />
              <span>a</span>
              <input type="date" value={custom.end} onChange={e => setCustom(c => ({ ...c, end: e.target.value }))} className="h-9 rounded-lg border border-slate-200 px-2 text-xs" name="performance_end" />
            </>
          ) : (
            <span className="font-bold">{rangeLabel}</span>
          )}
          {(mode === 'mes' || mode === 'semana') && (
            <button onClick={() => shift(1)} className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer" aria-label="Próximo"><ChevronRight className="w-4 h-4" /></button>
          )}
        </div>
      </section>

      {/* Abas */}
      <div className="flex gap-1 border-b border-slate-200 overflow-x-auto overflow-y-hidden">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-xs font-bold whitespace-nowrap border-b-2 -mb-px cursor-pointer ${tab === t.key ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {official.loading && <p className="text-xs text-slate-400">Carregando metas oficiais…</p>}
      {!official.loading && !hasOfficial && tab !== 'consultores' && (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-xs text-slate-500">
          Nenhuma meta oficial importada. Importe as planilhas do Power BI em Metas → Importação.
        </p>
      )}

      {hasOfficial && tab === 'geral' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            <Tile label="Realizado" value={fmt(summary.actual)} sub={`de ${fmtSmart(summary.metaToDate)} previstos até ${br(dataDate)}`} />
            <Tile label="Atingimento" value={fmtPct(att)} sub={<StatusChip attainment={att} />} />
            <Tile label="vs. ano anterior" value={<VsAA actual={summary.actual} aa={summary.aaToDate} />} sub={`AA no mesmo ponto: ${fmt(summary.aaToDate)}`} />
            <Tile label="Falta" value={fmt(summary.gap)} sub={`meta do período: ${fmtSmart(summary.metaTotal)}`} />
            <Tile label="Ritmo necessário" value={summary.requiredPerDay !== null ? `${fmtSmart(summary.requiredPerDay)}/dia` : '—'} sub={summary.remainingDays ? `${summary.remainingDays} dias restantes` : 'período encerrado'} />
            <Tile label="Projeção" value={summary.projection !== null ? fmt(summary.projection) : '—'} sub={summary.projection !== null ? `${fmtPct(pct(summary.projection, summary.metaTotal))} da meta` : 'sem meta até agora'} />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-extrabold text-slate-900">Acumulado no período · {filter.label}</h2>
            <CumulativeChart data={rows.map(r => ({ date: r.date, meta: r.cumMeta, aa: r.cumAa, actual: r.cumActual }))} />
          </div>

          {filter.groups.length > 1 && (
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-x-auto">
              <table className="w-full text-xs text-slate-800">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-5 py-2.5 text-left font-bold">Modalidade</th>
                    <th className="px-3 py-2.5 text-right font-bold">Realizado</th>
                    <th className="px-3 py-2.5 text-right font-bold">Meta até agora</th>
                    <th className="px-3 py-2.5 text-right font-bold">Ating.</th>
                    <th className="px-3 py-2.5 text-right font-bold">vs. AA</th>
                    <th className="px-3 py-2.5 text-right font-bold">Meta período</th>
                    <th className="px-3 py-2.5 text-right font-bold">Falta</th>
                    <th className="px-5 py-2.5 text-right font-bold">Ritmo nec.</th>
                  </tr>
                </thead>
                <tbody>
                  {byGroup.filter(({ s }) => s.metaTotal > 0 || s.actual > 0 || s.aaTotal > 0).map(({ group, s }) => {
                    const a = pct(s.actual, s.metaToDate);
                    return (
                      <tr key={group} className="border-t border-slate-100">
                        <td className="px-5 py-2.5 font-semibold">{groupLabel(group)}</td>
                        <td className="px-3 py-2.5 text-right">{fmt(s.actual)}</td>
                        <td className="px-3 py-2.5 text-right">{fmtSmart(s.metaToDate)}</td>
                        <td className={`px-3 py-2.5 text-right font-bold ${s.metaToDate > 0 ? STATUS_STYLE[statusOf(a)].text : 'text-slate-400'}`}>{fmtPct(a)}</td>
                        <td className="px-3 py-2.5 text-right"><VsAA actual={s.actual} aa={s.aaToDate} /></td>
                        <td className="px-3 py-2.5 text-right">{fmtSmart(s.metaTotal)}</td>
                        <td className="px-3 py-2.5 text-right">{fmt(s.gap)}</td>
                        <td className="px-5 py-2.5 text-right">{s.requiredPerDay !== null ? `${fmtSmart(s.requiredPerDay)}/dia` : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {hasOfficial && tab === 'semanas' && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-x-auto">
          <table className="w-full text-xs text-slate-800">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-5 py-2.5 text-left font-bold">Semana</th>
                <th className="px-3 py-2.5 text-left font-bold w-[30%]">Realizado × meta</th>
                <th className="px-3 py-2.5 text-right font-bold">Realizado</th>
                <th className="px-3 py-2.5 text-right font-bold">Meta</th>
                <th className="px-3 py-2.5 text-right font-bold">Ating.</th>
                <th className="px-3 py-2.5 text-right font-bold">Ano ant.</th>
                <th className="px-5 py-2.5 text-right font-bold">vs. AA</th>
              </tr>
            </thead>
            <tbody>
              {weeks.map(w => {
                const base = w.status === 'em andamento' ? w.metaToDate : w.meta;
                const a = w.status === 'futura' ? null : pct(w.actual, base);
                const maxV = Math.max(1, ...weeks.map(x => Math.max(x.meta, x.actual)));
                return (
                  <tr key={w.start} className={`border-t border-slate-100 ${w.status === 'futura' ? 'text-slate-400' : ''}`}>
                    <td className="px-5 py-2.5 font-semibold whitespace-nowrap">
                      {br(w.start)} a {br(w.end)}
                      {w.status !== 'fechada' && <span className="ml-2 text-[10px] font-bold text-slate-400">{w.status}</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="relative h-2.5 rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-blue-600" style={{ width: `${(w.actual / maxV) * 100}%` }} />
                        <div className="absolute -top-0.5 -bottom-0.5 w-0.5 bg-slate-800" style={{ left: `calc(${(w.meta / maxV) * 100}% - 1px)` }} title={`Meta: ${fmtSmart(w.meta)}`} />
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold">{w.status === 'futura' ? '—' : fmt(w.actual)}</td>
                    <td className="px-3 py-2.5 text-right">{fmtSmart(w.meta)}</td>
                    <td className={`px-3 py-2.5 text-right font-bold ${a !== null && base > 0 ? STATUS_STYLE[statusOf(a)].text : 'text-slate-400'}`}>{base > 0 ? fmtPct(a) : '—'}</td>
                    <td className="px-3 py-2.5 text-right">{fmt(w.aa)}</td>
                    <td className="px-5 py-2.5 text-right">{w.status === 'futura' ? '—' : <VsAA actual={w.actual} aa={w.aaToDate} />}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="px-5 py-2.5 border-t border-slate-100 text-[11px] text-slate-400">
            Semanas de segunda a domingo. Na semana em andamento o atingimento compara com a meta dos dias que já passaram (até {br(dataDate)}). A barra escura marca a meta da semana.
          </p>
        </div>
      )}

      {hasOfficial && tab === 'dias' && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-3 flex items-center justify-between border-b border-slate-100">
            <h2 className="text-sm font-extrabold text-slate-900">Dia a dia · {filter.label}</h2>
            <button onClick={downloadCsv} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50 cursor-pointer">
              <Download className="w-3.5 h-3.5" /> Exportar CSV
            </button>
          </div>
          <div className="overflow-auto max-h-[60vh]">
            <table className="w-full text-xs text-slate-800">
              <thead className="sticky top-0 bg-slate-50 text-[10px] uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-5 py-2.5 text-left font-bold">Data</th>
                  <th className="px-3 py-2.5 text-right font-bold">Meta</th>
                  <th className="px-3 py-2.5 text-right font-bold">Realizado</th>
                  <th className="px-3 py-2.5 text-right font-bold">Ano ant.</th>
                  <th className="px-3 py-2.5 text-right font-bold">Meta acum.</th>
                  <th className="px-3 py-2.5 text-right font-bold">Realizado acum.</th>
                  <th className="px-5 py-2.5 text-right font-bold">Ating. acum.</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const a = r.cumActual === null ? null : pct(r.cumActual, r.cumMeta);
                  const weekend = [0, 6].includes(new Date(`${r.date}T12:00:00`).getDay());
                  return (
                    <tr key={r.date} className={`border-t border-slate-100 ${r.actual === null ? 'text-slate-400' : ''} ${r.date === dataDate ? 'bg-blue-50/60' : weekend ? 'bg-slate-50/50' : ''}`}>
                      <td className="px-5 py-2 whitespace-nowrap font-semibold">
                        {new Date(`${r.date}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                      </td>
                      <td className="px-3 py-2 text-right">{r.meta ? fmtSmart(r.meta) : '—'}</td>
                      <td className="px-3 py-2 text-right font-bold">{r.actual === null ? '—' : fmt(r.actual)}</td>
                      <td className="px-3 py-2 text-right">{r.aa ? fmt(r.aa) : '—'}</td>
                      <td className="px-3 py-2 text-right">{fmtSmart(r.cumMeta)}</td>
                      <td className="px-3 py-2 text-right">{r.cumActual === null ? '—' : fmt(r.cumActual)}</td>
                      <td className={`px-5 py-2 text-right font-bold ${a !== null && r.cumMeta > 0 ? STATUS_STYLE[statusOf(a)].text : 'text-slate-400'}`}>{r.cumMeta > 0 ? fmtPct(a) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'perfil' && <ProfileTab profile={profile} rangeLabel={rangeLabel} filterLabel={filter.label} />}

      {tab === 'consultores' && (
        <ConsultantsTab
          rows={consultants}
          groups={filter.groups}
          hasTarget={Boolean(filter.operation)}
          isAdmin={isAdmin}
          currentUserId={currentUser.id}
          rangeLabel={rangeLabel}
          isWeek={mode === 'semana'}
        />
      )}
    </div>
  );
};

const Tile: React.FC<{ label: string; value: React.ReactNode; sub: React.ReactNode }> = ({ label, value, sub }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="text-[11px] font-semibold text-slate-500">{label}</div>
    <div className="text-2xl font-black tracking-tight text-slate-950 font-['Space_Grotesk'] mt-0.5">{value}</div>
    <div className="text-[11px] text-slate-400 mt-1">{sub}</div>
  </div>
);

const ConsultantsTab: React.FC<{
  rows: ReturnType<typeof consultantRows>;
  groups: string[];
  hasTarget: boolean;
  isAdmin: boolean;
  currentUserId: string;
  rangeLabel: string;
  isWeek: boolean;
}> = ({ rows, groups, hasTarget, isAdmin, currentUserId, rangeLabel, isWeek }) => {
  const visibleGroups = groups.filter(g => rows.some(r => r.byGroup[g]));
  const position = rows.findIndex(r => r.sellerId === currentUserId) + 1;
  const shown = isAdmin ? rows : rows.filter(r => r.sellerId === currentUserId);
  const totalSales = rows.reduce((s, r) => s + r.total, 0);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-extrabold text-slate-900">{isAdmin ? 'Vendas por consultor' : 'Minhas vendas'}</h2>
          <p className="text-[11px] text-slate-500">{rangeLabel}</p>
        </div>
        {!isAdmin && position > 0 && (
          <span className="rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-1 text-[11px] font-bold text-amber-800">
            Sua posição: {position}º de {rows.length}
          </span>
        )}
        {isAdmin && <span className="text-[11px] text-slate-500">{fmt(totalSales)} vendas lançadas no período</span>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-slate-800">
          <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-400">
            <tr>
              {isAdmin && <th className="px-5 py-2.5 text-left font-bold w-10">#</th>}
              <th className="px-3 py-2.5 text-left font-bold">Consultor</th>
              {visibleGroups.map(g => <th key={g} className="px-3 py-2.5 text-right font-bold">{groupLabel(g)}</th>)}
              <th className="px-3 py-2.5 text-right font-bold">Total</th>
              {hasTarget && <th className="px-3 py-2.5 text-right font-bold">Meta individual</th>}
              {hasTarget && <th className="px-5 py-2.5 text-right font-bold">% da meta</th>}
            </tr>
          </thead>
          <tbody>
            {shown.map(r => (
              <tr key={r.sellerId} className={`border-t border-slate-100 ${r.sellerId === currentUserId ? 'bg-blue-50/50' : ''}`}>
                {isAdmin && <td className="px-5 py-2.5 text-slate-400 font-bold">{rows.indexOf(r) + 1}</td>}
                <td className="px-3 py-2.5 font-semibold">{r.name}</td>
                {visibleGroups.map(g => <td key={g} className="px-3 py-2.5 text-right">{r.byGroup[g] ?? 0}</td>)}
                <td className="px-3 py-2.5 text-right font-black">{r.total}</td>
                {hasTarget && <td className="px-3 py-2.5 text-right">{r.target ? fmt(r.target) : '—'}</td>}
                {hasTarget && (
                  <td className={`px-5 py-2.5 text-right font-bold ${r.attainment !== null ? STATUS_STYLE[statusOf(r.attainment)].text : 'text-slate-400'}`}>
                    {fmtPct(r.attainment)}
                  </td>
                )}
              </tr>
            ))}
            {shown.length === 0 && (
              <tr><td colSpan={10} className="px-5 py-6 text-center text-slate-400">Nenhuma venda no período.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="px-5 py-2.5 border-t border-slate-100 text-[11px] text-slate-400">
        Vendas lançadas no R9 Sales. {hasTarget
          ? `Meta individual = metas ${isWeek ? 'semanais' : 'mensais'} da Configuração de Metas que caem inteiras no período.`
          : 'As metas individuais são por BU; escolha BU Presencial, Digital, Pós ou Técnico para ver a meta.'}
      </p>
    </div>
  );
};

/** Lista de barras horizontais (uma dimensão do perfil). */
const Breakdown: React.FC<{ title: string; items: [string, number][]; total: number; label?: (k: string) => string }> = ({ title, items, total, label }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <h3 className="text-xs font-extrabold text-slate-900 mb-3">{title}</h3>
    {items.length === 0 ? <p className="text-[11px] text-slate-400">Sem vendas.</p> : (
      <ul className="space-y-2">
        {items.map(([k, n]) => (
          <li key={k}>
            <div className="flex justify-between text-[11px] text-slate-700 mb-0.5">
              <span className="truncate">{label ? label(k) : k}</span>
              <span className="font-bold">{n} <span className="font-normal text-slate-400">· {fmt((n / Math.max(1, total)) * 100)}%</span></span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-blue-600" style={{ width: `${(n / Math.max(1, total)) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
    )}
  </div>
);

const ProfileTab: React.FC<{ profile: SalesProfile; rangeLabel: string; filterLabel: string }> = ({ profile, rangeLabel, filterLabel }) => (
  <div className="space-y-4">
    <p className="text-xs text-slate-500">
      Vendas lançadas no R9 Sales · {filterLabel} · {rangeLabel}: <b className="text-slate-800">{profile.total}</b>
      {profile.total > 0 && <> · com bolsa/convênio: <b className="text-slate-800">{profile.withBolsa}</b> ({fmt((profile.withBolsa / profile.total) * 100)}%)</>}
    </p>
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
      <Breakdown title="Modalidade" items={profile.byGroup} total={profile.total} label={groupLabel} />
      <Breakdown title="Forma de ingresso" items={profile.byFdi} total={profile.total} />
      <Breakdown title="Turno" items={profile.byShift} total={profile.total} />
      <Breakdown title="Parcela leve" items={profile.byParcela} total={profile.total} />
    </div>
  </div>
);
