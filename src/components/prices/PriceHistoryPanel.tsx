import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, LineChart, Loader2, History } from 'lucide-react';
import { compareOffer, courseKey, formatBRL, formatIsoDate, formatPct } from '../../lib/priceComparison';
import {
  PriceImport,
  StoredPriceRow,
  describePriceError,
  listAllPriceImports,
  loadPriceRows,
  loadPriceRowsForImports,
} from '../../lib/priceComparisonService';
import { PriceSnapshotTable, competitorNamesOf } from './PriceSnapshotTable';

interface PriceHistoryPanelProps {
  activeImports: PriceImport[];
  latestRows: StoredPriceRow[];
  threshold: number;
}

type Mode = 'week' | 'course';

export const PriceHistoryPanel: React.FC<PriceHistoryPanelProps> = ({ activeImports, latestRows, threshold }) => {
  const [mode, setMode] = useState<Mode>('week');
  const [allImports, setAllImports] = useState<PriceImport[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(activeImports[0]?.id ?? null);
  const [snapshot, setSnapshot] = useState<{ rows: StoredPriceRow[]; previous: StoredPriceRow[] | null } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [courseOptionKey, setCourseOptionKey] = useState<string>('');
  const [allRows, setAllRows] = useState<StoredPriceRow[] | null>(null);

  useEffect(() => {
    listAllPriceImports().then(setAllImports).catch(e => setError(describePriceError(e)));
  }, [activeImports]);

  // Foto de uma semana + a semana anterior a ela (para as setas de variação).
  useEffect(() => {
    if (mode !== 'week' || !selectedId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    const selected = allImports.find(i => i.id === selectedId) || activeImports.find(i => i.id === selectedId);
    const previous = selected ? activeImports.find(i => i.reference_date < selected.reference_date && i.id !== selected.id) : undefined;
    Promise.all([loadPriceRows(selectedId), previous ? loadPriceRows(previous.id) : Promise.resolve(null)])
      .then(([rows, prev]) => { if (!cancelled) setSnapshot({ rows, previous: prev }); })
      .catch(e => { if (!cancelled) setError(describePriceError(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [mode, selectedId, allImports, activeImports]);

  // Evolução por curso: carrega todas as semanas vigentes uma vez.
  useEffect(() => {
    if (mode !== 'course' || allRows) return;
    setLoading(true);
    loadPriceRowsForImports(activeImports.map(i => i.id))
      .then(setAllRows)
      .catch(e => setError(describePriceError(e)))
      .finally(() => setLoading(false));
  }, [mode, allRows, activeImports]);

  useEffect(() => { setAllRows(null); }, [activeImports]);

  const courseOptions = useMemo(() => {
    const source = latestRows.length ? latestRows : allRows || [];
    return source.map(r => ({ key: courseKey(r), label: `${r.course_name} · ${r.shift ?? ''}` }));
  }, [latestRows, allRows]);

  useEffect(() => {
    if (!courseOptionKey && courseOptions.length) setCourseOptionKey(courseOptions[0].key);
  }, [courseOptions, courseOptionKey]);

  const evolution = useMemo(() => {
    if (!allRows || !courseOptionKey) return null;
    const weeks = activeImports
      .map(imp => ({ imp, row: allRows.find(r => r.import_id === imp.id && courseKey(r) === courseOptionKey) || null }))
      .filter(w => w.row);
    const names = competitorNamesOf(weeks.map(w => w.row!));
    return { weeks, names };
  }, [allRows, courseOptionKey, activeImports]);

  const selectedImport = allImports.find(i => i.id === selectedId) || activeImports.find(i => i.id === selectedId);

  if (!activeImports.length) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-xs text-slate-500">
        Ainda não há atualizações gravadas.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit">
        <ModeButton active={mode === 'week'} onClick={() => setMode('week')} icon={<CalendarDays className="w-3.5 h-3.5" />} label="Foto de uma semana" />
        <ModeButton active={mode === 'course'} onClick={() => setMode('course')} icon={<LineChart className="w-3.5 h-3.5" />} label="Evolução de um curso" />
      </div>

      {error && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">{error}</div>}

      {mode === 'week' && (
        <div className="grid lg:grid-cols-[240px_1fr] gap-4 items-start">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-3 py-2.5 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <History className="w-3.5 h-3.5" /> Envios
            </div>
            <div className="max-h-[520px] overflow-y-auto divide-y divide-slate-100">
              {(allImports.length ? allImports : activeImports).map((imp, idx) => (
                <button
                  key={imp.id}
                  onClick={() => setSelectedId(imp.id)}
                  className={`w-full text-left px-3 py-2.5 transition-colors cursor-pointer ${selectedId === imp.id ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-xs font-bold ${imp.status === 'replaced' ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                      {formatIsoDate(imp.reference_date)}
                    </span>
                    {imp.id === activeImports[0]?.id && (
                      <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">ATUAL</span>
                    )}
                    {imp.status === 'replaced' && (
                      <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">SUBSTITUÍDA</span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">
                    {imp.row_count} cursos · {imp.imported_by_name || 'admin'} · {new Date(imp.imported_at).toLocaleDateString('pt-BR')}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="min-w-0 space-y-2">
            {selectedImport && (
              <p className="text-xs text-slate-500">
                Atualização de <b className="text-slate-800">{formatIsoDate(selectedImport.reference_date)}</b> · arquivo {selectedImport.file_name}
                {snapshot?.previous ? ' · setas comparam com a semana anterior' : ''}
              </p>
            )}
            {loading || !snapshot ? (
              <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 text-[#0052cc] animate-spin" /></div>
            ) : (
              <PriceSnapshotTable rows={snapshot.rows} previousRows={snapshot.previous} threshold={threshold} />
            )}
          </div>
        </div>
      )}

      {mode === 'course' && (
        <div className="space-y-3">
          <select
            value={courseOptionKey}
            onChange={e => setCourseOptionKey(e.target.value)}
            className="px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white min-w-[280px]"
          >
            {courseOptions.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>

          {loading || !evolution ? (
            <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 text-[#0052cc] animate-spin" /></div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                    <th className="text-left font-bold px-3 py-2.5">Semana</th>
                    <th className="text-right font-bold px-3 py-2.5 bg-blue-50/70 text-[#0052cc]">Nosso preço por</th>
                    {evolution.names.map(n => <th key={n} className="text-right font-bold px-3 py-2.5">{n}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {evolution.weeks.map(({ imp, row }) => (
                    <tr key={imp.id} className="border-t border-slate-100">
                      <td className="px-3 py-2.5 font-semibold text-slate-700">{formatIsoDate(imp.reference_date)}</td>
                      <td className="px-3 py-2.5 text-right font-bold bg-blue-50/40 tabular-nums">
                        {formatBRL(row!.our_price)}
                        <div className="text-[10px] font-normal text-slate-400">{row!.scholarship_label}</div>
                      </td>
                      {evolution.names.map(n => {
                        const offer = row!.competitors.find(c => c.name === n);
                        const cmp = compareOffer(row!.our_price, offer, threshold);
                        return (
                          <td key={n} className="px-3 py-2.5 text-right tabular-nums">
                            {offer?.offered ? (
                              <>
                                <span className={cmp.status === 'offense' ? 'font-bold text-red-600' : 'text-slate-800'}>{formatBRL(offer.price_to)}</span>
                                {cmp.diffPct !== null && <div className="text-[10px] text-slate-400">{cmp.diffPct > 0 ? '+' : ''}{formatPct(cmp.diffPct, 1)}</div>}
                              </>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  {!evolution.weeks.length && (
                    <tr><td colSpan={2 + evolution.names.length} className="px-3 py-10 text-center text-slate-400">Sem histórico para este curso.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const ModeButton: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({ active, onClick, icon, label }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${active ? 'bg-white text-[#0052cc] shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
  >
    {icon}{label}
  </button>
);
