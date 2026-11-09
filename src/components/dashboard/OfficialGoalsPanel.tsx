import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Database, Flag, TrendingDown, TrendingUp } from 'lucide-react';
import { BusinessUnitKey, TEACHING_MODELS, getModelMetadata } from '../../lib/goalImport';
import {
  CycleProgress,
  CumulativePoint,
  GoalDailyPoint,
  ProgressTotals,
  addTotals,
  computeCycleProgress,
  daysBetween,
  emptyTotals,
  pct,
} from '../../lib/goalProgress';
import { buildCycleWindows } from '../../lib/saleCycle';

const fmt = (v: number, digits = 0) => v.toLocaleString('pt-BR', { maximumFractionDigits: digits, minimumFractionDigits: 0 });
const fmtSmart = (v: number) => fmt(v, Math.abs(v) < 10 ? 1 : 0);
const fmtPct = (v: number | null) => (v === null ? '—' : `${fmt(v)}%`);
const fmtDate = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

const BU_LABEL: Record<BusinessUnitKey, string> = {
  bu_presencial: 'BU Presencial',
  bu_digital: 'BU Digital',
  pos: 'Pós-Graduação',
  tecnico: 'Técnico',
};
const BU_ORDER: BusinessUnitKey[] = ['bu_presencial', 'bu_digital', 'pos', 'tecnico'];

/** Quadros do topo da Home: um por metodologia da BU Presencial e um para a BU Digital. */
const METHOD_TILES: { key: string; label: string; detail?: string; groups: string[] }[] = [
  { key: 'presencial', label: 'Presencial', groups: ['graduacao_presencial'] },
  { key: 'semi', label: 'Semipresencial', groups: ['graduacao_semipresencial'] },
  { key: 'aovivo', label: 'Ao Vivo', groups: ['graduacao_aovivo'] },
  { key: 'digital', label: 'Digital', detail: 'EAD + Flex', groups: ['graduacao_ead', 'graduacao_dlex'] },
];

type Status = 'good' | 'warning' | 'critical' | 'none';
export const statusOf = (attainment: number | null): Status =>
  attainment === null ? 'none' : attainment >= 100 ? 'good' : attainment >= 90 ? 'warning' : 'critical';

export const STATUS_STYLE: Record<Status, { text: string; bg: string; label: string }> = {
  good: { text: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', label: 'No ritmo' },
  warning: { text: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', label: 'Atenção' },
  critical: { text: 'text-rose-700', bg: 'bg-rose-50 border-rose-200', label: 'Abaixo do ritmo' },
  none: { text: 'text-slate-500', bg: 'bg-slate-50 border-slate-200', label: 'Sem meta até agora' },
};

export const StatusChip: React.FC<{ attainment: number | null }> = ({ attainment }) => {
  const s = statusOf(attainment);
  const style = STATUS_STYLE[s];
  const Icon = s === 'good' ? CheckCircle2 : s === 'none' ? Flag : AlertTriangle;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${style.bg} ${style.text}`}>
      <Icon className="w-3 h-3" /> {style.label}
    </span>
  );
};

export const VsAA: React.FC<{ actual: number; aa: number }> = ({ actual, aa }) => {
  if (aa <= 0) return <span className="text-slate-400">—</span>;
  const d = (actual / aa - 1) * 100;
  const up = d >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 font-bold ${up ? 'text-emerald-700' : 'text-rose-600'}`}>
      {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {up ? '+' : ''}{fmt(d)}%
    </span>
  );
};

interface Props {
  points: GoalDailyPoint[];
  cycles: CycleProgress[];
  dataDate: string;
  lastImportAt: string | null;
  loading: boolean;
  error: string | null;
  isAdmin: boolean;
  onOpenImport?: () => void;
}

export const OfficialGoalsPanel: React.FC<Props> = ({ points, cycles, dataDate, lastImportAt, loading, error, isAdmin, onOpenImport }) => {
  const active = useMemo(() => {
    const a = cycles.filter(c => c.isActive);
    return a.length ? a : cycles.slice(-1);
  }, [cycles]);

  const [cycleFilter, setCycleFilter] = useState<string>('all');
  const scoped = cycleFilter === 'all' ? active : active.filter(c => c.period === cycleFilter);

  // Cards de ciclo: só Graduação (BU Presencial + BU Digital). Pós e Técnico ficam na tabela.
  const gradActive = useMemo(() => {
    const isGrad = (g: string) => {
      const bu = getModelMetadata(g).buKey;
      return bu === 'bu_presencial' || bu === 'bu_digital';
    };
    const activePeriods = new Set(active.map(c => c.period));
    return computeCycleProgress(points.filter(p => isGrad(p.group)), dataDate)
      .filter(c => activePeriods.has(c.period));
  }, [points, dataDate, active]);

  const methodTiles = useMemo(() => {
    const windows = buildCycleWindows(points);
    return METHOD_TILES.map(tile => {
      const inTile = (g: string) => tile.groups.includes(g);
      const periods = active.filter(c => tile.groups.some(g => c.byGroup[g])).map(c => c.period);
      const totals = active.reduce(
        (acc, c) => tile.groups.reduce((a, g) => (c.byGroup[g] ? addTotals(a, c.byGroup[g]) : a), acc),
        emptyTotals(),
      );
      const metaEnd = windows
        .filter(w => periods.includes(w.period) && inTile(w.group))
        .reduce((max, w) => (w.metaEnd > max ? w.metaEnd : max), '');
      const remainingDays = metaEnd ? Math.max(0, daysBetween(dataDate, metaEnd)) : 0;
      const gap = Math.max(0, totals.metaCycle - totals.actual);
      return {
        ...tile,
        periods,
        totals,
        gap,
        remainingDays,
        requiredPerDay: remainingDays > 0 ? gap / remainingDays : null,
      };
    });
  }, [points, active, dataDate]);

  if (loading) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm text-xs text-slate-400">Carregando metas oficiais…</div>;
  }
  if (error || !cycles.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-xs text-slate-500 flex items-center justify-between gap-3">
        <span>{error ? `Não foi possível carregar as metas oficiais: ${error}` : 'Nenhuma meta oficial importada ainda.'}</span>
        {isAdmin && onOpenImport && (
          <button onClick={onOpenImport} className="font-bold text-blue-600 hover:text-blue-700 cursor-pointer">Importar metas</button>
        )}
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <Flag className="w-4 h-4 text-blue-600" />
            Metas oficiais · todas as BUs
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Matrículas financeiras do Power BI · ciclos ativos: {active.map(c => c.period).join(' + ')}
          </p>
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] text-slate-500">
          <Database className="w-3.5 h-3.5" />
          Dados até <b className="text-slate-700">{fmtDate(dataDate)}</b>
          {lastImportAt && <> · importado em {new Date(lastImportAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</>}
          {isAdmin && onOpenImport && (
            <button onClick={onOpenImport} className="ml-1 font-bold text-blue-600 hover:text-blue-700 cursor-pointer">Atualizar</button>
          )}
        </div>
      </div>

      {/* Um quadro por metodologia da BU Presencial + BU Digital */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {methodTiles.map(tile => <MethodTile key={tile.key} tile={tile} dataDate={dataDate} />)}
      </div>

      {/* Ciclos */}
      <div className={`grid grid-cols-1 ${gradActive.length > 1 ? 'xl:grid-cols-2' : ''} gap-4`}>
        {gradActive.map(c => (
          <CycleCard key={c.period} cycle={c} />
        ))}
      </div>

      {/* Tabela por BU */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100">
          <h3 className="text-sm font-extrabold text-slate-900">Por BU e modalidade</h3>
          {active.length > 1 && (
            <div className="flex rounded-lg bg-slate-100 p-1 text-[11px] font-bold">
              {['all', ...active.map(c => c.period)].map(p => (
                <button
                  key={p}
                  onClick={() => setCycleFilter(p)}
                  className={`px-2.5 py-1 rounded-md cursor-pointer ${cycleFilter === p ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-900'}`}
                >
                  {p === 'all' ? 'Todos' : p}
                </button>
              ))}
            </div>
          )}
        </div>
        <BuTable cycles={scoped} />
      </div>
    </section>
  );
};

interface MethodTileData {
  key: string;
  label: string;
  detail?: string;
  periods: string[];
  totals: ProgressTotals;
  gap: number;
  remainingDays: number;
  requiredPerDay: number | null;
}

const MethodTile: React.FC<{ tile: MethodTileData; dataDate: string }> = ({ tile, dataDate }) => {
  const t = tile.totals;
  const att = pct(t.actual, t.metaToDate);
  const hasData = tile.periods.length > 0;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-extrabold text-slate-900">{tile.label}</div>
          {tile.detail && <div className="text-[11px] text-slate-500">{tile.detail}</div>}
        </div>
        {hasData && (
          <span className="shrink-0 rounded-md bg-blue-50 border border-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">
            {tile.periods.join(' + ')}
          </span>
        )}
      </div>

      {!hasData ? (
        <p className="text-xs text-slate-400">Sem meta importada para o ciclo atual.</p>
      ) : (
        <>
          <div className="flex items-end justify-between gap-2">
            <div>
              <div className="text-3xl font-black tracking-tight text-slate-950 font-['Space_Grotesk'] leading-none">{fmt(t.actual)}</div>
              <div className="text-[11px] text-slate-400 mt-1">de {fmtSmart(t.metaToDate)} previstos até {fmtDate(dataDate)}</div>
            </div>
            <div className="text-right">
              <div className="text-xl font-black text-slate-950 font-['Space_Grotesk'] leading-none">{fmtPct(att)}</div>
              <div className="mt-1"><StatusChip attainment={att} /></div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100 text-[11px]">
            <div>
              <div className="text-slate-400">vs. AA</div>
              <div className="mt-0.5"><VsAA actual={t.actual} aa={t.aaToDate} /></div>
            </div>
            <div>
              <div className="text-slate-400">Falta</div>
              <div className="mt-0.5 font-bold text-slate-800">
                {fmt(tile.gap)} <span className="font-medium text-slate-400">/ {fmt(t.metaCycle)}</span>
              </div>
            </div>
            <div>
              <div className="text-slate-400">Ritmo nec.</div>
              <div className="mt-0.5 font-bold text-slate-800">
                {tile.requiredPerDay !== null ? `${fmtSmart(tile.requiredPerDay)}/dia` : '—'}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const CycleCard: React.FC<{ cycle: CycleProgress }> = ({ cycle }) => {
  const t = cycle.totals;
  const att = pct(t.actual, t.metaToDate);
  const ofCycle = t.metaCycle > 0 ? Math.min(100, (t.actual / t.metaCycle) * 100) : 0;
  const expected = t.metaCycle > 0 ? Math.min(100, (t.metaToDate / t.metaCycle) * 100) : 0;
  const projPct = cycle.projection !== null ? pct(cycle.projection, t.metaCycle) : null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Ciclo · Graduação</div>
          <div className="text-xl font-black text-slate-950 font-['Space_Grotesk']">{cycle.period}</div>
          <div className="text-[11px] text-slate-500">
            {fmtDate(cycle.startDate)} → {fmtDate(cycle.metaEndDate)}
            {cycle.remainingDays > 0 ? ` · faltam ${cycle.remainingDays} dias` : ' · meta encerrada'}
          </div>
        </div>
        <div className="text-right">
          <div className="text-3xl font-black text-slate-950 font-['Space_Grotesk']">{fmtPct(att)}</div>
          <StatusChip attainment={att} />
        </div>
      </div>

      {/* Barra: realizado sobre a meta do ciclo, com marcador de onde deveria estar hoje */}
      <div className="mt-4">
        <div className="relative h-3 rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-blue-600" style={{ width: `${ofCycle}%` }} />
          <div
            className="absolute -top-1 -bottom-1 w-0.5 bg-slate-800"
            style={{ left: `calc(${expected}% - 1px)` }}
            title={`Previsto até agora: ${fmtSmart(t.metaToDate)}`}
          />
        </div>
        <div className="flex justify-between text-[10px] text-slate-400 mt-1">
          <span><b className="text-slate-700">{fmt(t.actual)}</b> realizados</span>
          <span>▮ previsto até agora: {fmtSmart(t.metaToDate)}</span>
          <span>meta {fmt(t.metaCycle)}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 text-center">
        <Mini label="vs. ano ant." value={<VsAA actual={t.actual} aa={t.aaToDate} />} />
        <Mini label="Falta" value={fmt(cycle.gap)} />
        <Mini label="Ritmo nec." value={cycle.requiredPerDay !== null ? `${fmtSmart(cycle.requiredPerDay)}/dia` : '—'} />
        <Mini label="Projeção" value={cycle.projection !== null ? `${fmt(cycle.projection)} (${fmtPct(projPct)})` : '—'} />
      </div>

      <CumulativeChart data={cycle.cumulative} />
    </div>
  );
};

const Mini: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="rounded-xl bg-slate-50 border border-slate-100 px-2 py-2">
    <div className="text-[10px] font-bold uppercase text-slate-400">{label}</div>
    <div className="text-xs font-bold text-slate-800 mt-0.5">{value}</div>
  </div>
);

/** Linhas acumuladas: Realizado (sólida), Meta (tracejada), Ano anterior (pontilhada). Um eixo só. */
const SERIES = [
  { key: 'actual' as const, label: 'Realizado', color: '#2563eb', dash: '' },
  { key: 'meta' as const, label: 'Meta', color: '#1e293b', dash: '6 4' },
  { key: 'aa' as const, label: 'Ano anterior', color: '#94a3b8', dash: '2 3' },
];

export const CumulativeChart: React.FC<{ data: CumulativePoint[] }> = ({ data }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(480);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(entries => setWidth(Math.max(240, entries[0].contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  if (data.length < 2) return null;

  const H = 160;
  const pad = { l: 34, r: 8, t: 8, b: 20 };
  const max = Math.max(1, ...data.map(d => Math.max(d.meta, d.aa, d.actual ?? 0)));
  const x = (i: number) => pad.l + (i / (data.length - 1)) * (width - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - v / max) * (H - pad.t - pad.b);
  const path = (key: 'actual' | 'meta' | 'aa') => {
    let d = '';
    data.forEach((p, i) => {
      const v = p[key];
      if (v === null) return;
      d += `${d ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
    });
    return d;
  };
  const ticks = [0, max / 2, max];
  const lastActual = data.reduce((idx, p, i) => (p.actual !== null ? i : idx), -1);
  const h = hover !== null ? data[hover] : null;

  return (
    <div className="mt-4">
      <div className="flex flex-wrap gap-3 text-[10px] text-slate-500 mb-1">
        {SERIES.map(s => (
          <span key={s.key} className="inline-flex items-center gap-1">
            <svg width="18" height="6"><line x1="0" y1="3" x2="18" y2="3" stroke={s.color} strokeWidth="2" strokeDasharray={s.dash} /></svg>
            {s.label} acumulado
          </span>
        ))}
      </div>
      <div ref={ref} className="relative w-full">
        <svg
          width={width}
          height={H}
          className="block"
          onMouseLeave={() => setHover(null)}
          onMouseMove={e => {
            const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
            const rel = (e.clientX - rect.left - pad.l) / (width - pad.l - pad.r);
            setHover(Math.max(0, Math.min(data.length - 1, Math.round(rel * (data.length - 1)))));
          }}
        >
          {ticks.map(tv => (
            <g key={tv}>
              <line x1={pad.l} x2={width - pad.r} y1={y(tv)} y2={y(tv)} stroke="#e2e8f0" strokeWidth="1" />
              <text x={pad.l - 4} y={y(tv) + 3} textAnchor="end" fontSize="9" fill="#94a3b8">{fmt(tv)}</text>
            </g>
          ))}
          <text x={pad.l} y={H - 4} fontSize="9" fill="#94a3b8">{fmtDate(data[0].date)}</text>
          <text x={width - pad.r} y={H - 4} fontSize="9" fill="#94a3b8" textAnchor="end">{fmtDate(data[data.length - 1].date)}</text>
          {[...SERIES].reverse().map(s => (
            <path key={s.key} d={path(s.key)} fill="none" stroke={s.color} strokeWidth="2" strokeDasharray={s.dash} strokeLinejoin="round" strokeLinecap="round" />
          ))}
          {lastActual >= 0 && (
            <circle cx={x(lastActual)} cy={y(data[lastActual].actual ?? 0)} r="4" fill="#2563eb" stroke="#fff" strokeWidth="2" />
          )}
          {hover !== null && (
            <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={H - pad.b} stroke="#64748b" strokeWidth="1" />
          )}
        </svg>
        {h && hover !== null && (
          <div
            className="pointer-events-none absolute top-1 rounded-lg border border-slate-200 bg-white/95 px-2.5 py-1.5 text-[11px] shadow-md"
            style={{ left: Math.min(Math.max(0, x(hover) + 8), width - 150) }}
          >
            <div className="font-bold text-slate-800">{fmtDate(h.date)}</div>
            <div className="text-slate-600">Realizado: <b>{h.actual === null ? '—' : fmt(h.actual)}</b></div>
            <div className="text-slate-600">Meta: <b>{fmtSmart(h.meta)}</b></div>
            <div className="text-slate-600">Ano anterior: <b>{fmt(h.aa)}</b></div>
          </div>
        )}
      </div>
    </div>
  );
};

const BuTable: React.FC<{ cycles: CycleProgress[] }> = ({ cycles }) => {
  const rows = useMemo(() => {
    const byBu = new Map<BusinessUnitKey, ProgressTotals>();
    const byGroup = new Map<string, ProgressTotals>();
    cycles.forEach(c => {
      Object.entries(c.byBu).forEach(([bu, tot]) => byBu.set(bu as BusinessUnitKey, addTotals(byBu.get(bu as BusinessUnitKey) ?? emptyTotals(), tot!)));
      Object.entries(c.byGroup).forEach(([g, tot]) => byGroup.set(g, addTotals(byGroup.get(g) ?? emptyTotals(), tot)));
    });
    const total = [...byBu.values()].reduce(addTotals, emptyTotals());
    return { byBu, byGroup, total };
  }, [cycles]);

  const Row: React.FC<{ label: string; t: ProgressTotals; strong?: boolean; sub?: boolean }> = ({ label, t, strong, sub }) => {
    const att = pct(t.actual, t.metaToDate);
    const st = STATUS_STYLE[statusOf(att)];
    return (
      <tr className={`border-t border-slate-100 ${strong ? 'bg-slate-50 font-black' : sub ? 'text-slate-500' : 'font-semibold'}`}>
        <td className={`px-5 py-2.5 ${sub ? 'pl-9 text-[11px]' : ''}`}>{label}</td>
        <td className="px-3 py-2.5 text-right">{fmt(t.actual)}</td>
        <td className="px-3 py-2.5 text-right">{fmtSmart(t.metaToDate)}</td>
        <td className={`px-3 py-2.5 text-right ${t.metaToDate > 0 ? st.text : 'text-slate-400'}`}>{fmtPct(att)}</td>
        <td className="px-3 py-2.5 text-right"><VsAA actual={t.actual} aa={t.aaToDate} /></td>
        <td className="px-3 py-2.5 text-right">{fmt(t.metaCycle)}</td>
        <td className="px-5 py-2.5 text-right">{fmt(Math.max(0, t.metaCycle - t.actual))}</td>
      </tr>
    );
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs text-slate-800">
        <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-400">
          <tr>
            <th className="px-5 py-2.5 text-left font-bold">BU / modalidade</th>
            <th className="px-3 py-2.5 text-right font-bold">Realizado</th>
            <th className="px-3 py-2.5 text-right font-bold">Meta até agora</th>
            <th className="px-3 py-2.5 text-right font-bold">Ating.</th>
            <th className="px-3 py-2.5 text-right font-bold">vs. AA</th>
            <th className="px-3 py-2.5 text-right font-bold">Meta ciclo</th>
            <th className="px-5 py-2.5 text-right font-bold">Falta</th>
          </tr>
        </thead>
        <tbody>
          {BU_ORDER.filter(bu => rows.byBu.has(bu)).map(bu => (
            <React.Fragment key={bu}>
              <Row
                label={BU_LABEL[bu]}
                t={rows.byBu.get(bu) ?? emptyTotals()}
              />
              {TEACHING_MODELS.filter(m => m.buKey === bu && rows.byGroup.has(m.id)).map(m => (
                <Row key={m.id} label={m.title.split('·').pop()!.trim()} t={rows.byGroup.get(m.id) ?? emptyTotals()} sub />
              ))}
            </React.Fragment>
          ))}
          <Row label="Total" t={rows.total} strong />
        </tbody>
      </table>
    </div>
  );
};
