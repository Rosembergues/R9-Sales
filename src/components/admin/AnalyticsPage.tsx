import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, ArrowDownRight, ArrowUpRight, BarChart3, CalendarDays, CheckCircle2,
  ChevronDown, Filter, Info, RefreshCw, Target, TrendingDown, TrendingUp, X,
  Layers, ArrowLeft, Calendar, Flame, Award, Clock
} from 'lucide-react';
import {
  GoalFilePreview,
  GoalImportGroup,
  summarizeImportedGoals,
  getModelMetadata,
  TEACHING_MODELS,
  ModelMetadata
} from '../../lib/goalImport';
import { supabase } from '../../lib/supabase';
import { useSales } from '../../context/SalesContext';

const COMMON_PERIODS = ['2026.3', '2026.4', '2027.1'];

const fmt = (value: number, fraction = 1) =>
  value.toLocaleString('pt-BR', { minimumFractionDigits: fraction, maximumFractionDigits: fraction });

const fmtInt = (value: number) =>
  value.toLocaleString('pt-BR', { maximumFractionDigits: 0 });

const pct = (actual: number, target: number) =>
  target > 0 ? (actual / target) * 100 : null;

const dateToBr = (iso: string) => {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

const monthBounds = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return {
    start: `${y}-${m}-01`,
    end: `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`,
  };
};

interface DailyRow {
  date: string;
  aa: number;
  target: number;
  actual: number;
  crmSales: number;
}

interface AnalyticsPageProps {
  onBack?: () => void;
}

export const AnalyticsPage: React.FC<AnalyticsPageProps> = ({ onBack }) => {
  const bounds = monthBounds();
  const { sales } = useSales();

  const [selectedPeriod, setSelectedPeriod] = useState<string>('2026.3');
  const [availablePeriods, setAvailablePeriods] = useState<string[]>(COMMON_PERIODS);
  const [previews, setPreviews] = useState<Record<string, GoalFilePreview>>({});
  const [startDate, setStartDate] = useState(bounds.start);
  const [endDate, setEndDate] = useState(bounds.end);
  const [selectedBu, setSelectedBu] = useState<'all' | 'bu_presencial' | 'bu_digital' | 'pos' | 'tecnico'>('all');
  const [activeSection, setActiveSection] = useState<'geral' | 'modelos' | 'evolucao'>('geral');
  const [isLoading, setIsLoading] = useState(false);

  const load = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch available distinct periods
      const { data: allPeriodsData } = await supabase
        .from('goal_imports')
        .select('academic_period')
        .eq('status', 'active');

      if (allPeriodsData && allPeriodsData.length > 0) {
        const distinct = Array.from(
          new Set([
            ...COMMON_PERIODS,
            ...allPeriodsData.map(p => p.academic_period).filter(Boolean),
          ])
        ).sort();
        setAvailablePeriods(distinct);
      }

      // 2. Fetch active imports for the selected period
      const { data: imports, error } = await supabase
        .from('goal_imports')
        .select('id, academic_period, file_name, goal_group, status')
        .eq('academic_period', selectedPeriod)
        .eq('status', 'active')
        .order('imported_at', { ascending: false });

      if (error) throw error;

      const latest: Record<string, any> = {};
      (imports || []).forEach(item => {
        if (!latest[item.goal_group]) latest[item.goal_group] = item;
      });

      const ids = Object.values(latest).map((item: any) => item.id);
      if (!ids.length) {
        setPreviews({});
        return;
      }

      const { data: rows, error: rowsError } = await supabase
        .from('goal_daily_data')
        .select('import_id, reference_date, aa, target, actual')
        .in('import_id', ids)
        .order('reference_date', { ascending: true });

      if (rowsError) throw rowsError;

      const next: Record<string, GoalFilePreview> = {};
      Object.values(latest).forEach((item: any) => {
        const daily = (rows || []).filter((row: any) => row.import_id === item.id);
        const dates = daily.map((row: any) => row.reference_date).sort();
        next[item.goal_group] = {
          fileName: item.file_name,
          group: item.goal_group as GoalImportGroup,
          academicPeriod: item.academic_period,
          rowCount: daily.length,
          startDate: dates[0] ?? null,
          endDate: dates[dates.length - 1] ?? null,
          rows: daily.map((row: any) => ({
            date: row.reference_date,
            aa: row.aa === null ? null : Number(row.aa),
            target: row.target === null ? null : Number(row.target),
            actual: row.actual === null ? null : Number(row.actual),
          })),
          filters: [],
          warnings: [],
        };
      });

      setPreviews(next);
    } catch (error) {
      console.error('Erro ao carregar dados do Analytics:', error);
      setPreviews({});
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [selectedPeriod]);

  // Filter previews by selected BU
  const filteredPreviews = useMemo<GoalFilePreview[]>(() => {
    return (Object.values(previews) as GoalFilePreview[]).filter(preview => {
      if (selectedBu === 'all') return true;
      const meta = getModelMetadata(preview.group);
      return meta.buKey === selectedBu;
    });
  }, [previews, selectedBu]);

  // Summarize imported goals within the date window
  const summary = useMemo(() => {
    const map: Record<string, GoalFilePreview> = {};
    filteredPreviews.forEach((p: GoalFilePreview) => {
      map[p.group] = p;
    });
    return summarizeImportedGoals(map, startDate, endDate);
  }, [filteredPreviews, startDate, endDate]);

  // Map CRM real sales in date window
  const crmSalesByDate = useMemo(() => {
    const map = new Map<string, number>();
    sales.forEach(s => {
      // Resolve sale date ISO
      let isoDate = '';
      if (s.custom_data?.sale_date && /^\d{2}\/\d{2}\/\d{4}$/.test(s.custom_data.sale_date)) {
        const [d, m, y] = s.custom_data.sale_date.split('/');
        isoDate = `${y}-${m}-${d}`;
      } else if (s.sale_date) {
        isoDate = s.sale_date.slice(0, 10);
      } else if (s.created_at) {
        isoDate = s.created_at.slice(0, 10);
      }

      if (!isoDate || isoDate < startDate || isoDate > endDate) return;

      // Filter by BU if selected
      if (selectedBu !== 'all') {
        const prod = s.custom_data?.main_product || s.product_name || '';
        const mod = s.custom_data?.modality || '';
        if (selectedBu === 'bu_presencial') {
          const isPres =
            mod.includes('Presencial') ||
            mod.includes('Semipresencial') ||
            mod.includes('Ao Vivo');
          if (!isPres) return;
        } else if (selectedBu === 'bu_digital') {
          const isDig = mod.includes('EAD') || mod.includes('FLEX') || mod.includes('DLEX');
          if (!isDig) return;
        } else if (selectedBu === 'pos') {
          if (!prod.includes('Pós')) return;
        } else if (selectedBu === 'tecnico') {
          if (!prod.includes('Técnico')) return;
        }
      }

      map.set(isoDate, (map.get(isoDate) || 0) + 1);
    });
    return map;
  }, [sales, startDate, endDate, selectedBu]);

  const totalCrmSales = useMemo(() => {
    return Array.from(crmSalesByDate.values()).reduce((a: number, b: number) => a + b, 0);
  }, [crmSalesByDate]);

  // Daily rows combining Official and CRM
  const dailyRows = useMemo<DailyRow[]>(() => {
    const map = new Map<string, DailyRow>();

    filteredPreviews.forEach(p => {
      p.rows.forEach(r => {
        if (!r.date || r.date < startDate || r.date > endDate) return;
        const cur = map.get(r.date) ?? {
          date: r.date,
          aa: 0,
          target: 0,
          actual: 0,
          crmSales: crmSalesByDate.get(r.date) || 0,
        };
        if (r.aa != null && Number.isFinite(r.aa)) cur.aa += r.aa;
        if (r.target != null && Number.isFinite(r.target)) cur.target += r.target;
        if (r.actual != null && Number.isFinite(r.actual)) cur.actual += r.actual;
        map.set(r.date, cur);
      });
    });

    // Also include any dates with CRM sales that might not have imported goal rows
    crmSalesByDate.forEach((count, date) => {
      if (!map.has(date)) {
        map.set(date, { date, aa: 0, target: 0, actual: 0, crmSales: count });
      }
    });

    return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredPreviews, startDate, endDate, crmSalesByDate]);

  // Model breakdown table
  const modelBreakdown = useMemo(() => {
    return TEACHING_MODELS.map(model => {
      const p = previews[model.id];
      if (!p) {
        return {
          model,
          isImported: false,
          target: 0,
          actual: 0,
          aa: 0,
          achievement: null,
          gap: 0,
        };
      }
      let t = 0;
      let act = 0;
      let aa = 0;
      p.rows.forEach(r => {
        if (!r.date || r.date < startDate || r.date > endDate) return;
        if (r.target != null) t += r.target;
        if (r.actual != null) act += r.actual;
        if (r.aa != null) aa += r.aa;
      });

      return {
        model,
        isImported: true,
        target: t,
        actual: act,
        aa,
        achievement: t > 0 ? Math.round((act / t) * 100) : null,
        gap: t - act,
      };
    }).filter(item => {
      if (selectedBu === 'all') return true;
      return item.model.buKey === selectedBu;
    });
  }, [previews, startDate, endDate, selectedBu]);

  // Pacing and KPIs
  const achievement = pct(summary.actual, summary.target);
  const gap = summary.target - summary.actual;
  const daysInPeriod = dailyRows.length || 1;
  const currentPace = summary.actual / daysInPeriod;
  const targetPace = summary.target / daysInPeriod;

  // Remaining days pace (assuming up to end of date range)
  const remainingPace = gap > 0 ? gap / Math.max(1, daysInPeriod) : 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl border border-gray-200 transition-colors cursor-pointer"
              title="Voltar"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center justify-center">
                <BarChart3 className="w-4 h-4" />
              </div>
              <h1 className="text-lg font-bold text-gray-900">Analytics de Metas & Performance</h1>
              <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                ADMIN
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Cruzamento entre metas oficiais importadas, realizado reportado e lançamentos reais da equipe no CRM.
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Cycle / Period */}
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl border border-gray-200">
            {availablePeriods.map(period => (
              <button
                key={period}
                onClick={() => setSelectedPeriod(period)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  selectedPeriod === period
                    ? 'bg-white text-indigo-700 shadow-2xs border border-gray-200/60'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {period}
              </button>
            ))}
          </div>

          {/* Date Range inputs */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 bg-white text-xs">
            <Calendar className="w-3.5 h-3.5 text-gray-400" />
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="text-xs font-medium text-gray-700 border-none outline-none"
            />
            <span className="text-gray-400">até</span>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="text-xs font-medium text-gray-700 border-none outline-none"
            />
          </div>

          <button
            onClick={load}
            disabled={isLoading}
            className="p-2 border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-600 cursor-pointer disabled:opacity-50"
            title="Atualizar dados"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* BU Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-gray-200 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-gray-500 mr-1">Filtrar Visão:</span>
          {[
            { key: 'all', label: 'Todos os Modelos' },
            { key: 'bu_presencial', label: '🏛️ BU Presencial (Presencial, Semi, Ao Vivo)' },
            { key: 'bu_digital', label: '💻 BU Digital (EAD, DLEX)' },
            { key: 'pos', label: '🎓 Pós-Graduação' },
            { key: 'tecnico', label: '🔧 Curso Técnico' },
          ].map(bu => (
            <button
              key={bu.key}
              onClick={() => setSelectedBu(bu.key as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                selectedBu === bu.key
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/70'
              }`}
            >
              {bu.label}
            </button>
          ))}
        </div>

        <div className="flex rounded-lg bg-slate-100 p-1 text-[11px] font-bold">
          <button
            onClick={() => setActiveSection('geral')}
            className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
              activeSection === 'geral' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600'
            }`}
          >
            Visão Geral
          </button>
          <button
            onClick={() => setActiveSection('modelos')}
            className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
              activeSection === 'modelos' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600'
            }`}
          >
            Por Modelo de Ensino
          </button>
          <button
            onClick={() => setActiveSection('evolucao')}
            className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
              activeSection === 'evolucao' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600'
            }`}
          >
            Evolução Diária
          </button>
        </div>
      </div>

      {/* COMPARATIVO TRIPLO: Meta Oficial vs Realizado Oficial vs Vendas CRM */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Card 1: Meta Oficial */}
        <div className="p-4 rounded-2xl bg-white border border-blue-200 shadow-2xs">
          <div className="flex items-center justify-between text-blue-700">
            <span className="text-[10px] font-bold uppercase tracking-wider">Meta Oficial ({selectedPeriod})</span>
            <Target className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2 font-['Space_Grotesk']">
            {fmtInt(summary.target)}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Média de {fmt(targetPace, 1)} matrículas / dia
          </p>
        </div>

        {/* Card 2: Realizado Oficial */}
        <div className="p-4 rounded-2xl bg-white border border-emerald-200 shadow-2xs">
          <div className="flex items-center justify-between text-emerald-700">
            <span className="text-[10px] font-bold uppercase tracking-wider">Realizado Oficial (Planilha)</span>
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black text-emerald-700 mt-2 font-['Space_Grotesk']">
            {fmtInt(summary.actual)}
          </div>
          <div className="mt-1 flex items-center justify-between text-xs">
            <span className="text-slate-400">Atingimento:</span>
            <strong className="text-slate-900">{achievement !== null ? `${fmt(achievement, 1)}%` : '—'}</strong>
          </div>
        </div>

        {/* Card 3: Vendas Lançadas no CRM */}
        <div className="p-4 rounded-2xl bg-white border border-purple-200 shadow-2xs">
          <div className="flex items-center justify-between text-purple-700">
            <span className="text-[10px] font-bold uppercase tracking-wider">Lançamentos CRM (Equipe)</span>
            <Flame className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black text-purple-700 mt-2 font-['Space_Grotesk']">
            {totalCrmSales}
          </div>
          <div className="mt-1 flex items-center justify-between text-xs">
            <span className="text-slate-400">vs. Oficial:</span>
            <span
              className={`font-semibold ${
                totalCrmSales >= summary.actual ? 'text-emerald-700' : 'text-amber-700'
              }`}
            >
              {totalCrmSales >= summary.actual ? `+${totalCrmSales - Math.round(summary.actual)} no CRM` : `${totalCrmSales - Math.round(summary.actual)} no CRM`}
            </span>
          </div>
        </div>

        {/* Card 4: Gap & Pacing */}
        <div className="p-4 rounded-2xl bg-white border border-amber-200 shadow-2xs">
          <div className="flex items-center justify-between text-amber-700">
            <span className="text-[10px] font-bold uppercase tracking-wider">Gap para a Meta</span>
            <Clock className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2 font-['Space_Grotesk']">
            {gap > 0 ? fmtInt(gap) : 'Superada!'}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {gap > 0 ? `Faltam ${fmtInt(gap)} matrículas no ciclo` : 'Meta do período atingida'}
          </p>
        </div>
      </div>

      {/* SECTION: GERAL */}
      {activeSection === 'geral' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Pacing Insights */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-600" />
                Diagnóstico Operacional & Pacing
              </h2>
              <span className="text-xs font-semibold text-gray-500">
                {dailyRows.length} dias analisados no período
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                <span className="text-xs font-semibold text-slate-600">Ritmo Atual de Captação</span>
                <div className="text-xl font-black text-slate-900 mt-1">
                  {fmt(currentPace, 1)} <span className="text-xs font-normal text-slate-500">matrículas/dia</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Média diária observada no período selecionado.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                <span className="text-xs font-semibold text-slate-600">Ritmo Necessário para a Meta</span>
                <div className="text-xl font-black text-indigo-700 mt-1">
                  {gap > 0 ? fmt(targetPace, 1) : '0'} <span className="text-xs font-normal text-slate-500">matrículas/dia</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  {currentPace >= targetPace
                    ? 'A equipe está operando acima do ritmo planejado.'
                    : `Necessário acelerar +${fmt(targetPace - currentPace, 1)} matrículas/dia para fechar a meta.`}
                </p>
              </div>
            </div>

            {/* Quick Status Bar */}
            <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-100">
              <div className="flex items-center justify-between text-xs font-bold text-blue-900 mb-1.5">
                <span>Progresso Oficial da Captação</span>
                <span>{achievement !== null ? `${fmt(achievement, 1)}%` : '0%'}</span>
              </div>
              <div className="h-3 rounded-full bg-blue-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-blue-600 transition-all"
                  style={{ width: `${Math.min(100, Math.max(0, achievement || 0))}%` }}
                />
              </div>
            </div>
          </div>

          {/* BU Snapshot Breakdown */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-2xs">
            <h2 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600" />
              Consolidado por BU
            </h2>
            <div className="space-y-3">
              {[
                { title: 'BU Presencial', key: 'bu_presencial' as const, color: 'text-blue-700 bg-blue-50' },
                { title: 'BU Digital', key: 'bu_digital' as const, color: 'text-emerald-700 bg-emerald-50' },
                { title: 'Pós-Graduação', key: 'pos' as const, color: 'text-purple-700 bg-purple-50' },
                { title: 'Curso Técnico', key: 'tecnico' as const, color: 'text-amber-700 bg-amber-50' },
              ].map(bu => {
                const data = summary.byBu[bu.key];
                const buPct = data.target > 0 ? Math.round((data.actual / data.target) * 100) : null;
                return (
                  <div key={bu.key} className="p-3 rounded-xl border border-gray-100 bg-slate-50/50">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-800">{bu.title}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${bu.color}`}>
                        {buPct !== null ? `${buPct}%` : '—'}
                      </span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <span className="text-gray-400 block text-[10px]">Meta</span>
                        <strong className="text-gray-900">{fmtInt(data.target)}</strong>
                      </div>
                      <div>
                        <span className="text-gray-400 block text-[10px]">Realizado</span>
                        <strong className="text-emerald-700">{fmtInt(data.actual)}</strong>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* SECTION: POR MODELO DE ENSINO */}
      {activeSection === 'modelos' && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-2xs">
          <div className="p-5 border-b border-gray-100">
            <h2 className="text-sm font-bold text-gray-900">
              Desempenho por Modelo de Ensino
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Acompanhe individualmente o atingimento das metas em cada modelo importado.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-5 py-3 font-bold text-gray-600">Modelo de Ensino</th>
                  <th className="text-left px-3 py-3 font-bold text-gray-600">Unidade (BU)</th>
                  <th className="text-right px-3 py-3 font-bold text-gray-600">AA (Ano Anterior)</th>
                  <th className="text-right px-3 py-3 font-bold text-blue-700">Meta Oficial</th>
                  <th className="text-right px-3 py-3 font-bold text-emerald-700">Realizado</th>
                  <th className="text-right px-3 py-3 font-bold text-gray-900">Atingimento</th>
                  <th className="text-right px-5 py-3 font-bold text-gray-600">Gap</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {modelBreakdown.map(item => (
                  <tr key={item.model.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-3">
                      <div className="font-semibold text-gray-900">{item.model.title}</div>
                      <div className="text-[10px] text-gray-400">{item.model.subtitle}</div>
                    </td>
                    <td className="px-3 py-3 font-medium text-gray-600">{item.model.bu}</td>
                    <td className="px-3 py-3 text-right text-gray-500">{fmtInt(item.aa)}</td>
                    <td className="px-3 py-3 text-right font-bold text-blue-700">{fmtInt(item.target)}</td>
                    <td className="px-3 py-3 text-right font-bold text-emerald-700">{fmtInt(item.actual)}</td>
                    <td className="px-3 py-3 text-right font-black">
                      {item.achievement !== null ? (
                        <span
                          className={
                            item.achievement >= 100
                              ? 'text-emerald-700'
                              : item.achievement >= 75
                              ? 'text-blue-700'
                              : 'text-amber-700'
                          }
                        >
                          {item.achievement}%
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-gray-700">
                      {item.gap > 0 ? (
                        <span className="text-amber-700">-{fmtInt(item.gap)}</span>
                      ) : (
                        <span className="text-emerald-700">OK</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECTION: EVOLUÇÃO DIÁRIA */}
      {activeSection === 'evolucao' && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-2xs">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-gray-900">Evolução Diária da Captação</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Comparativo diário: Histórico AA, Meta Oficial, Realizado Oficial e Lançamentos no CRM.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[600px]">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-slate-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-5 py-3 font-bold text-gray-600">Data</th>
                  <th className="text-right px-3 py-3 font-bold text-gray-500">AA</th>
                  <th className="text-right px-3 py-3 font-bold text-blue-700">Meta Oficial</th>
                  <th className="text-right px-3 py-3 font-bold text-emerald-700">Realizado Oficial</th>
                  <th className="text-right px-3 py-3 font-bold text-purple-700">Lançamentos CRM</th>
                  <th className="text-right px-5 py-3 font-bold text-gray-900">Atingimento Dia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {dailyRows.map(row => {
                  const dayPct =
                    row.target > 0 && row.actual > 0 ? Math.round((row.actual / row.target) * 100) : null;
                  return (
                    <tr key={row.date} className="hover:bg-slate-50/70">
                      <td className="px-5 py-2.5 font-semibold text-gray-800">{dateToBr(row.date)}</td>
                      <td className="px-3 py-2.5 text-right text-gray-500">{fmtInt(row.aa)}</td>
                      <td className="px-3 py-2.5 text-right font-bold text-blue-700">{fmtInt(row.target)}</td>
                      <td className="px-3 py-2.5 text-right font-bold text-emerald-700">{fmtInt(row.actual)}</td>
                      <td className="px-3 py-2.5 text-right font-bold text-purple-700">{row.crmSales}</td>
                      <td className="px-5 py-2.5 text-right font-semibold text-gray-700">
                        {dayPct !== null ? `${dayPct}%` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
