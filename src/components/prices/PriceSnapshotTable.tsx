import React, { useMemo, useState } from 'react';
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Search, Swords, Target, BookOpen } from 'lucide-react';
import {
  CompetitorOffer,
  ParsedPriceRow,
  compareOffer,
  courseKey,
  formatBRL,
  formatPct,
  OfferStatus,
} from '../../lib/priceComparison';

interface PriceSnapshotTableProps {
  rows: ParsedPriceRow[];
  /** Linhas da importação anterior, para mostrar o que mudou de uma semana para a outra. */
  previousRows?: ParsedPriceRow[] | null;
  threshold: number;
  /** Esconde os cards de resumo (usado na conferência da importação). */
  compact?: boolean;
}

export const competitorNamesOf = (rows: ParsedPriceRow[]) => {
  const names: string[] = [];
  rows.forEach(r => r.competitors.forEach(c => { if (!names.includes(c.name)) names.push(c.name); }));
  return names;
};

const statusStyles: Record<OfferStatus, string> = {
  offense: 'bg-red-50 text-red-700 border-red-200',
  cheaper: 'bg-amber-50 text-amber-700 border-amber-200',
  ours_cheaper: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  na: 'bg-slate-50 text-slate-400 border-slate-200',
};

const Delta: React.FC<{ current: number | null; previous: number | null | undefined }> = ({ current, previous }) => {
  if (current === null || previous === null || previous === undefined) return null;
  const diff = current - previous;
  if (Math.abs(diff) < 0.01) return null;
  const up = diff > 0;
  return (
    <span
      title={`Semana anterior: ${formatBRL(previous)} (${up ? '+' : ''}${formatBRL(diff)})`}
      className={`inline-flex items-center text-[10px] font-bold ${up ? 'text-rose-500' : 'text-emerald-600'}`}
    >
      {up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
    </span>
  );
};

export const PriceSnapshotTable: React.FC<PriceSnapshotTableProps> = ({ rows, previousRows, threshold, compact }) => {
  const [search, setSearch] = useState('');
  const [shift, setShift] = useState('');
  const [competitor, setCompetitor] = useState('');
  const [onlyOffended, setOnlyOffended] = useState(false);

  const competitorNames = useMemo(() => competitorNamesOf(rows), [rows]);
  const shifts = useMemo(() => Array.from(new Set(rows.map(r => r.shift).filter(Boolean))) as string[], [rows]);

  const previousByKey = useMemo(() => {
    const map = new Map<string, ParsedPriceRow>();
    (previousRows || []).forEach(r => map.set(courseKey(r), r));
    return map;
  }, [previousRows]);

  const offenseCount = (row: ParsedPriceRow, names: string[]) =>
    row.competitors.filter(c => names.includes(c.name) && compareOffer(row.our_price, c, threshold).status === 'offense').length;

  const summary = useMemo(() => {
    const byCompetitor = new Map<string, number>();
    let offenses = 0;
    let offendedCourses = 0;
    let worst: { row: ParsedPriceRow; offer: CompetitorOffer; pct: number } | null = null;
    rows.forEach(row => {
      let rowOffended = false;
      row.competitors.forEach(offer => {
        const cmp = compareOffer(row.our_price, offer, threshold);
        if (cmp.status !== 'offense') return;
        rowOffended = true;
        offenses += 1;
        byCompetitor.set(offer.name, (byCompetitor.get(offer.name) || 0) + 1);
        if (cmp.diffPct !== null && (!worst || cmp.diffPct < worst.pct)) worst = { row, offer, pct: cmp.diffPct };
      });
      if (rowOffended) offendedCourses += 1;
    });
    const top = Array.from(byCompetitor.entries()).sort((a, b) => b[1] - a[1])[0] || null;
    return { offenses, offendedCourses, top, worst: worst as { row: ParsedPriceRow; offer: CompetitorOffer; pct: number } | null };
  }, [rows, threshold]);

  const visibleCompetitors = competitor ? [competitor] : competitorNames;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(r => {
      if (q && !`${r.course_name} ${r.course_code ?? ''}`.toLowerCase().includes(q)) return false;
      if (shift && r.shift !== shift) return false;
      if (onlyOffended && offenseCount(r, visibleCompetitors) === 0) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, search, shift, onlyOffended, competitor, threshold]);

  return (
    <div className="space-y-4">
      {!compact && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <SummaryCard icon={<BookOpen className="w-4 h-4" />} label="Cursos monitorados" value={String(rows.length)} hint={`${competitorNames.length} concorrentes`} />
          <SummaryCard
            icon={<AlertTriangle className="w-4 h-4" />}
            tone="red"
            label="Cursos ofendidos"
            value={`${summary.offendedCourses}`}
            hint={`${summary.offenses} ofensa(s) curso × concorrente`}
          />
          <SummaryCard
            icon={<Swords className="w-4 h-4" />}
            tone="amber"
            label="Concorrente mais agressiva"
            value={summary.top ? summary.top[0] : '—'}
            hint={summary.top ? `${summary.top[1]} ofensa(s)` : 'Nenhuma ofensa'}
          />
          <SummaryCard
            icon={<Target className="w-4 h-4" />}
            tone="slate"
            label="Maior diferença"
            value={summary.worst ? formatPct(summary.worst.pct) : '—'}
            hint={summary.worst ? `${summary.worst.row.course_name} ${summary.worst.row.shift ?? ''} · ${summary.worst.offer.name}` : '—'}
          />
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="p-3 border-b border-slate-100 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar curso ou código"
              className="w-full pl-8 pr-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
          <select value={shift} onChange={e => setShift(e.target.value)} className="px-2.5 py-2 text-xs rounded-lg border border-slate-200 bg-white">
            <option value="">Todos os turnos</option>
            {shifts.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={competitor} onChange={e => setCompetitor(e.target.value)} className="px-2.5 py-2 text-xs rounded-lg border border-slate-200 bg-white">
            <option value="">Todas as concorrentes</option>
            {competitorNames.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <label className="flex items-center gap-1.5 text-xs text-slate-600 px-2 py-2 cursor-pointer select-none">
            <input type="checkbox" checked={onlyOffended} onChange={e => setOnlyOffended(e.target.checked)} className="accent-red-600" />
            Só ofendidos
          </label>
          <span className="text-[11px] text-slate-400 ml-auto">{filtered.length} de {rows.length}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                <th className="text-left font-bold px-3 py-2.5 sticky left-0 bg-slate-50 z-10 min-w-[200px]">Curso</th>
                <th className="text-left font-bold px-3 py-2.5">Turno</th>
                <th className="text-right font-bold px-3 py-2.5">Preço de</th>
                <th className="text-left font-bold px-3 py-2.5">Bolsa</th>
                <th className="text-right font-bold px-3 py-2.5 bg-blue-50/70 text-[#0052cc]">Nosso preço por</th>
                {visibleCompetitors.map(name => (
                  <th key={name} className="text-right font-bold px-3 py-2.5 min-w-[130px]">{name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(row => {
                const prev = previousByKey.get(courseKey(row));
                const composite = row.price_first !== null;
                const offended = offenseCount(row, visibleCompetitors) > 0;
                return (
                  <tr key={courseKey(row)} className={`border-t border-slate-100 ${offended ? 'bg-red-50/30' : ''} hover:bg-slate-50/80`}>
                    <td className={`px-3 py-2.5 sticky left-0 z-10 ${offended ? 'bg-[#fdf6f6]' : 'bg-white'}`}>
                      <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                        {offended && <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                        <span>{row.course_name}</span>
                      </div>
                      {row.course_code && <div className="text-[10px] text-slate-400">Cód. {row.course_code}</div>}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">{row.shift ?? '—'}</td>
                    <td className="px-3 py-2.5 text-right text-slate-500 tabular-nums">{formatBRL(row.list_price)}</td>
                    <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">{row.scholarship_label ?? '—'}</td>
                    <td className="px-3 py-2.5 text-right bg-blue-50/40 tabular-nums">
                      <div className="font-bold text-slate-900 flex items-center justify-end gap-1">
                        <Delta current={row.our_price} previous={prev?.our_price} />
                        {formatBRL(row.our_price)}
                        {composite && <span className="text-[9px] font-bold text-[#0052cc] bg-blue-100 px-1 py-0.5 rounded">1ºS</span>}
                      </div>
                      {composite && row.price_ct !== null && (
                        <div className="text-[10px] text-slate-400">depois {formatBRL(row.price_ct)} (CT)</div>
                      )}
                    </td>
                    {visibleCompetitors.map(name => {
                      const offer = row.competitors.find(c => c.name === name);
                      const cmp = compareOffer(row.our_price, offer, threshold);
                      const prevOffer = prev?.competitors.find(c => c.name === name);
                      if (!offer || !offer.offered) {
                        return <td key={name} className="px-3 py-2.5 text-right text-slate-300">não oferta</td>;
                      }
                      return (
                        <td key={name} className="px-3 py-2.5 text-right tabular-nums">
                          <div className="font-semibold text-slate-800 flex items-center justify-end gap-1">
                            <Delta current={offer.price_to} previous={prevOffer?.offered ? prevOffer.price_to : null} />
                            {formatBRL(offer.price_to)}
                          </div>
                          <div className="flex items-center justify-end gap-1 mt-0.5">
                            {offer.price_from !== null && (
                              <span className="text-[10px] text-slate-400" title="Preço cheio e desconto da concorrente">
                                de {formatBRL(offer.price_from)} · {formatPct(offer.discount_pct)}
                              </span>
                            )}
                          </div>
                          {cmp.diffPct !== null && (
                            <span className={`inline-block mt-1 text-[10px] font-bold px-1.5 py-0.5 rounded border ${statusStyles[cmp.status]}`}>
                              {cmp.diffPct > 0 ? '+' : ''}{formatPct(cmp.diffPct, 1)}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {!filtered.length && (
                <tr>
                  <td colSpan={5 + visibleCompetitors.length} className="px-3 py-10 text-center text-slate-400">
                    Nenhum curso com esses filtros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="px-3 py-2.5 border-t border-slate-100 flex flex-wrap gap-3 text-[10px] text-slate-500">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-red-200 border border-red-300" /> Ofensa: concorrente {threshold}% ou mais abaixo do nosso preço</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-amber-200 border border-amber-300" /> Concorrente mais barata, abaixo do limite</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-200 border border-emerald-300" /> Nosso preço menor</span>
          {previousRows && (
            <span className="flex items-center gap-1"><ArrowUpRight className="w-3 h-3 text-rose-500" /><ArrowDownRight className="w-3 h-3 text-emerald-600" /> mudou desde a semana anterior</span>
          )}
          <span className="ml-auto">Bolsa composta: comparação pelo preço do 1º semestre (1ºS).</span>
        </div>
      </div>
    </div>
  );
};

const toneStyles = {
  blue: 'bg-blue-50 text-[#0052cc]',
  red: 'bg-red-50 text-red-600',
  amber: 'bg-amber-50 text-amber-600',
  slate: 'bg-slate-100 text-slate-600',
};

const SummaryCard: React.FC<{ icon: React.ReactNode; label: string; value: string; hint?: string; tone?: keyof typeof toneStyles }> = ({ icon, label, value, hint, tone = 'blue' }) => (
  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 min-w-0">
    <div className="flex items-center gap-2">
      <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${toneStyles[tone]}`}>{icon}</span>
      <span className="text-[11px] font-semibold text-slate-500">{label}</span>
    </div>
    <div className="mt-2 text-xl font-black text-slate-900 font-['Space_Grotesk'] truncate">{value}</div>
    {hint && <div className="text-[11px] text-slate-400 truncate" title={hint}>{hint}</div>}
  </div>
);
