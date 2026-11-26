import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  ChevronRight,
  ShoppingCart,
  Target,
  Trophy,
  UserRound,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSales } from '../../context/SalesContext';
import { Sale, Goal } from '../../types';
import { getSaleDateBr, getTodayBrDate, getRealSaleDate } from '../../lib/salesMapper';
import { supabase } from '../../lib/supabase';
import { LocalSyncEngine } from '../../lib/localCache';
import { useOfficialGoals } from '../../hooks/useOfficialGoals';
import { useAutomatedOfficialGoals } from '../../hooks/useAutomatedOfficialGoals';
import { useUnitRanking } from '../../hooks/useUnitRanking';
import { computeCycleProgress, sumTarget } from '../../lib/goalProgress';
import { saleGoalGroup } from '../../lib/saleCycle';
import { OfficialGoalsPanel } from './OfficialGoalsPanel';
import { UnitRankingCard } from './UnitRankingCard';
import { toLocalIso } from '../../lib/dates';

interface HomeDashboardProps {
  onOpenNewSaleModal: () => void;
  onOpenPerformance: () => void;
  onOpenRanking: () => void;
}

const brNumber = (value: number) =>
  value.toLocaleString('pt-BR', { maximumFractionDigits: 0 });

/** Metas do Power BI são fracionadas por dia; uma casa decimal evita mostrar "0" para 0,4. */
const brGoal = (value: number) =>
  value.toLocaleString('pt-BR', { maximumFractionDigits: value > 0 && value < 10 ? 1 : 0 });


const startOfDay = (date: Date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const dateKey = toLocalIso;

const saleDateObject = (sale: Sale) => getRealSaleDate(sale) || new Date(sale.created_at);

const percentDelta = (current: number, previous: number) => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
};

const MODALITY_GOALS = [
  { group: 'graduacao_presencial', label: 'Presencial' },
  { group: 'graduacao_semipresencial', label: 'Semi' },
  { group: 'graduacao_aovivo', label: 'Ao Vivo' },
  { group: 'graduacao_ead', label: 'EAD' },
  { group: 'graduacao_dlex', label: 'Flex' },
] as const;

export const HomeDashboard: React.FC<HomeDashboardProps> = ({
  onOpenNewSaleModal,
  onOpenPerformance,
  onOpenRanking,
}) => {
  const { currentUser, profiles } = useAuth();
  const { sales, salesLoaded } = useSales();
  const now = useMemo(() => new Date(), []);
  const todayKey = dateKey(now);
  const yesterdayKey = dateKey(new Date(now.getTime() - 86400000));

  // Os quadros oficiais da Home vêm dos PDFs da automação; o restante continua vindo da importação manual.
  const official = useAutomatedOfficialGoals();
  const importedGoals = useOfficialGoals();
  const dataDate = useMemo(
    () => official.points.reduce((latest, point) => point.date <= todayKey && point.date > latest ? point.date : latest, '') || yesterdayKey,
    [official.points, todayKey, yesterdayKey],
  );
  const cycles = useMemo(() => computeCycleProgress(official.points, dataDate), [official.points, dataDate]);
  const unitRanking = useUnitRanking();

  // Metas manuais (Configuração de Metas). Só usadas quando não há metas importadas.
  const [manualWeeklyTarget, setManualWeeklyTarget] = useState(0);
  const [manualLoaded, setManualLoaded] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchTargets = async () => {
      try {
        const todayIso = todayKey;
        const [{ data: weekPeriod }, { data: weeklyGoals }] = await Promise.all([
          supabase
            .from('goal_periods')
            .select('target_total')
            .eq('period_type', 'week')
            .lte('reference_start', todayIso)
            .gte('reference_end', todayIso)
            .maybeSingle(),
          supabase
            .from('goals')
            .select('target_total')
            .in('type', ['week', 'semanal'])
            .lte('reference_start', todayIso)
            .gte('reference_end', todayIso),
        ]);

        let resolvedWeekly = Number(weekPeriod?.target_total) || 0;
        if (!resolvedWeekly && weeklyGoals && weeklyGoals.length > 0) {
          resolvedWeekly = weeklyGoals.reduce((s: number, g: { target_total?: number | null }) => s + (Number(g.target_total) || 0), 0);
        }

        if (!resolvedWeekly) {
          const localGoals = LocalSyncEngine.getGoals();
          const activeLocal = localGoals.filter(
            (g: Goal) =>
              (g.type === 'week' || g.type === 'semanal') &&
              (!g.reference_start || g.reference_start <= todayIso) &&
              (!g.reference_end || g.reference_end >= todayIso)
          );
          if (activeLocal.length > 0) {
            resolvedWeekly = activeLocal.reduce((s: number, g: Goal) => s + (Number(g.target_total) || 0), 0);
          }
        }

        if (isMounted) {
          setManualWeeklyTarget(resolvedWeekly);
        }
      } catch (err) {
        console.warn('Erro ao carregar metas manuais na Home:', err);
      } finally {
        if (isMounted) setManualLoaded(true);
      }
    };

    fetchTargets();
    return () => {
      isMounted = false;
    };
  }, [todayKey]);

  // A meta do cartão de lançamentos vem dos arquivos Excel importados manualmente.
  const officialTargets = useMemo(() => {
    if (!importedGoals.hasImports) return null;
    const weekStart = dateKey(new Date(now.getTime() - 6 * 86400000));
    return {
      daily: sumTarget(importedGoals.points, todayKey, todayKey),
      weekly: sumTarget(importedGoals.points, weekStart, todayKey),
    };
  }, [importedGoals.hasImports, importedGoals.points, now, todayKey]);

  const teamGoalToday = officialTargets?.daily ?? 0;
  const teamGoalWeek = officialTargets?.weekly ?? manualWeeklyTarget;

  const todaySales = useMemo(
    () => sales.filter((sale) => getSaleDateBr(sale) === getTodayBrDate()),
    [sales]
  );

  const modalityGoals = useMemo(() => MODALITY_GOALS.map(({ group, label }) => {
    const dailyRows = importedGoals.points.filter(point => point.group === group && point.date === todayKey);
    const targetRow = dailyRows.find(point => point.target !== null);
    const count = todaySales.filter(sale =>
      saleGoalGroup(sale.custom_data?.main_product || sale.product_name, sale.custom_data?.modality) === group
    ).length;
    const target = targetRow?.target ?? null;
    return {
      group,
      label,
      target,
      count,
      attainment: target && target > 0 ? Math.round((count / target) * 100) : null,
    };
  }), [importedGoals.points, todayKey, todaySales]);

  const yesterdaySales = useMemo(
    () => sales.filter((sale) => dateKey(saleDateObject(sale)) === yesterdayKey),
    [sales, yesterdayKey]
  );

  const weekSales = useMemo(() => {
    const start = startOfDay(new Date(now.getTime() - 6 * 86400000));
    return sales.filter((sale) => saleDateObject(sale) >= startOfDay(start));
  }, [sales, now]);

  const previousWeekSales = useMemo(() => {
    const end = startOfDay(new Date(now.getTime() - 7 * 86400000));
    const start = startOfDay(new Date(now.getTime() - 13 * 86400000));
    return sales.filter((sale) => {
      const date = saleDateObject(sale);
      return date >= start && date < end;
    });
  }, [sales, now]);

  const monthSales = useMemo(
    () => sales.filter((sale) => {
      const date = saleDateObject(sale);
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    }),
    [sales, now]
  );

  const mySales = useMemo(
    () => sales.filter((sale) => sale.seller_id === currentUser?.id),
    [sales, currentUser?.id]
  );

  const myToday = mySales.filter((sale) => getSaleDateBr(sale) === getTodayBrDate()).length;
  const myWeek = mySales.filter((sale) => weekSales.some((item) => item.id === sale.id)).length;
  const myMonth = mySales.filter((sale) => monthSales.some((item) => item.id === sale.id)).length;
  const myYesterday = mySales.filter((sale) => dateKey(saleDateObject(sale)) === yesterdayKey).length;
  const myPreviousWeek = previousWeekSales.filter((sale) => sale.seller_id === currentUser?.id).length;
  const previousMonthSales = useMemo(
    () => sales.filter((sale) => {
      const date = saleDateObject(sale);
      const previousMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
      const previousYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
      return date.getMonth() === previousMonth && date.getFullYear() === previousYear;
    }),
    [sales, now]
  );
  const myPreviousMonth = previousMonthSales.filter((sale) => sale.seller_id === currentUser?.id).length;

  const todayCount = todaySales.length;
  const attainment = teamGoalToday > 0 ? Math.round((todayCount / teamGoalToday) * 100) : 0;
  const dayDelta = percentDelta(todayCount, yesterdaySales.length);

  const rankingToday = useMemo(() => {
    const counts = new Map<string, number>();
    todaySales.forEach((sale) => counts.set(sale.seller_id, (counts.get(sale.seller_id) || 0) + 1));
    return profiles
      .filter((profile) => profile.role === 'seller')
      .map((profile) => ({ profile, count: counts.get(profile.id) || 0 }))
      .sort((a, b) => b.count - a.count || a.profile.name.localeCompare(b.profile.name, 'pt-BR'))
      .slice(0, 5);
  }, [profiles, todaySales]);

  const formattedDate = now.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const greeting = now.getHours() >= 5 && now.getHours() < 12
    ? 'Bom dia'
    : now.getHours() >= 12 && now.getHours() < 18
      ? 'Boa tarde'
      : 'Boa noite';

  const myDayDelta = percentDelta(myToday, myYesterday);
  const comparisonWeek = percentDelta(myWeek, myPreviousWeek);
  const comparisonMonth = percentDelta(myMonth, myPreviousMonth);

  // Valores calculados aqui mesmo, a partir das vendas carregadas.
  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <section className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-blue-600 mb-1">Visão geral</p>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-950 font-['Space_Grotesk']">
            {greeting}, {currentUser?.name?.split(' ')[0] || 'você'}!
          </h1>
          <p className="text-sm sm:text-base text-slate-500 mt-1 capitalize">{formattedDate}</p>
          <p className="text-sm text-slate-400 mt-1">Aqui está um resumo da operação de hoje.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm">
            <CalendarDays className="w-4 h-4 text-slate-500" />
            Hoje
          </div>
          <button
            onClick={onOpenNewSaleModal}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition-colors cursor-pointer"
          >
            <ShoppingCart className="w-4 h-4" />
            Lançar venda
          </button>
        </div>
      </section>

      {/* Só mostra números quando vendas e metas chegaram: evita a tela aparecer com zeros e trocar logo depois. */}
      {!(salesLoaded && manualLoaded && !official.loading && !importedGoals.loading) ? <HomeSkeleton /> : (
      <>
      <OfficialGoalsPanel
        cycles={cycles}
        dataDate={dataDate}
        lastImportAt={official.lastImportAt}
        loading={official.loading}
        error={official.error}
      />

      <div className="pt-2">
        <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
          <ShoppingCart className="w-4 h-4 text-blue-600" />
          Lançamentos no sistema
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Vendas registradas pelos consultores no R9 Hub, comparadas com a meta oficial do mesmo dia (todas as BUs).
        </p>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard icon={<ShoppingCart className="w-5 h-5" />} label="Vendas Hoje" value={brNumber(todayCount)} tone="blue" delta={dayDelta} subtitle={`vs. ontem (${brNumber(yesterdaySales.length)})`} />
        <KpiCard icon={<Target className="w-5 h-5" />} label="Meta do dia" value={brGoal(teamGoalToday)} tone="green" subtitle={`Últimos 7 dias: ${brGoal(teamGoalWeek)}`} />
        <KpiCard icon={<BarChart3 className="w-5 h-5" />} label="Atingimento Hoje" value={teamGoalToday > 0 ? `${attainment}%` : '—'} tone="purple" delta={teamGoalToday > 0 ? percentDelta(attainment, Math.round((yesterdaySales.length / teamGoalToday) * 100)) : undefined} subtitle={teamGoalToday > 0 ? `${brNumber(todayCount)} / ${brGoal(teamGoalToday)}` : 'Sem meta oficial para hoje'} />
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-extrabold text-slate-900">Metas por modalidade</h2>
          <p className="text-xs text-slate-500 mt-0.5">Metas manuais e vendas lançadas hoje · Graduação</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
          {modalityGoals.map(({ group, label, target, count, attainment }) => (
            <div key={group} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-xs font-bold text-slate-500">{label}</div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-2xl font-black tracking-tight text-slate-950">{target === null ? '—' : brGoal(target)}</span>
                <span className="text-[11px] text-slate-400">meta hoje</span>
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {brNumber(count)} {count === 1 ? 'venda lançada' : 'vendas lançadas'}
              </div>
              {attainment !== null ? (
                <>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full ${attainment >= 100 ? 'bg-emerald-500' : 'bg-blue-600'}`} style={{ width: `${Math.min(100, attainment)}%` }} />
                  </div>
                  <div className="mt-1 text-[11px] font-semibold text-slate-500">{attainment}% atingido</div>
                </>
              ) : (
                <div className="mt-3 text-[11px] text-slate-400">{target === null ? 'Sem meta importada hoje' : 'Sem meta para calcular'}</div>
              )}
            </div>
          ))}
        </div>
      </section>

      <UnitRankingCard ranking={unitRanking} />

      <section className="grid grid-cols-1 xl:grid-cols-[1.15fr_1fr] gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <UserRound className="w-4 h-4 text-blue-600" />
              Minha Performance
            </h2>
            <button onClick={onOpenPerformance} className="text-xs font-bold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1 cursor-pointer">
              Ver desempenho <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <PerformanceCard label="Hoje" value={myToday} delta={myDayDelta} suffix="vs. ontem" />
            <PerformanceCard label="Semana" value={myWeek} delta={comparisonWeek} suffix="vs. semana anterior" />
            <PerformanceCard label="Mês" value={myMonth} delta={comparisonMonth} suffix="vs. mês anterior" />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-500" />
              Ranking da Equipe (Hoje)
            </h2>
            <button onClick={onOpenRanking} className="text-xs font-bold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1 cursor-pointer">
              Ver ranking <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="space-y-2.5">
            {rankingToday.map(({ profile, count }, index) => {
              const max = Math.max(1, rankingToday[0]?.count || 1);
              return (
                <div key={profile.id} className="flex items-center gap-3">
                  <div className="w-6 text-center text-xs font-black text-slate-400">{index + 1}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-semibold text-slate-700 truncate">{profile.name}</span>
                      <span className="text-xs font-black text-slate-900">{count}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div className={`h-full rounded-full ${index === 0 ? 'bg-amber-400' : 'bg-slate-300'}`} style={{ width: `${Math.max(4, (count / max) * 100)}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
            {rankingToday.length === 0 && <p className="text-xs text-slate-400">Nenhuma venda registrada hoje.</p>}
          </div>
        </div>
      </section>

      </>
      )}
    </div>
  );
};

/** Esqueleto do Início enquanto os dados carregam (mesmo desenho, sem números). */
const HomeSkeleton: React.FC = () => {
  const block = 'rounded-2xl border border-slate-200 bg-white shadow-sm';
  const bar = 'rounded-md bg-slate-100';
  return (
    <div className="space-y-5 animate-pulse" aria-busy="true" aria-label="Carregando o resumo">
      <div className={`${block} h-40`} />
      <div className={`${block} h-28`} />
      <div className={`${block} p-5 space-y-3`}>
        <div className={`${bar} h-4 w-48`} />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[0, 1, 2].map(i => <div key={i} className={`${bar} h-20`} />)}
        </div>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-[1.15fr_1fr] gap-4">
        <div className={`${block} h-48`} />
        <div className={`${block} h-48`} />
      </div>
    </div>
  );
};

interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: 'blue' | 'green' | 'purple';
  delta?: number;
  subtitle: string;
}

const KpiCard: React.FC<KpiCardProps> = ({ icon, label, value, tone, delta, subtitle }) => {
  const toneClass = tone === 'blue' ? 'bg-blue-50 text-blue-600' : tone === 'green' ? 'bg-emerald-50 text-emerald-600' : 'bg-violet-50 text-violet-600';
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${toneClass}`}>{icon}</div>
      <div className="min-w-0">
        <div className="text-xs font-semibold text-slate-500">{label}</div>
        <div className="flex items-baseline gap-2 mt-0.5">
          <span className="text-3xl font-black tracking-tight text-slate-950 font-['Space_Grotesk']">{value}</span>
          {typeof delta === 'number' && delta !== 0 && <span className={`text-[11px] font-black ${delta > 0 ? 'text-emerald-600' : 'text-rose-500'}`}>{delta > 0 ? '▲' : '▼'} {Math.abs(delta)}%</span>}
        </div>
        <div className="text-[11px] text-slate-400 truncate">{subtitle}</div>
      </div>
    </div>
  );
};

const PerformanceCard: React.FC<{ label: string; value: number; delta: number; suffix: string }> = ({ label, value, delta, suffix }) => (
  <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
    <div className="text-xs font-semibold text-slate-500">{label}</div>
    <div className="text-3xl font-black text-slate-950 font-['Space_Grotesk'] mt-1">{value}</div>
    <div className={`text-[11px] font-bold mt-1 ${delta >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
      {delta >= 0 ? '▲' : '▼'} {Math.abs(delta)}% <span className="font-medium text-slate-400">{suffix}</span>
    </div>
  </div>
);
