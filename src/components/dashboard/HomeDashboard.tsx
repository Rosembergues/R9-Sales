import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  ChevronRight,
  Clock3,
  ShoppingCart,
  Target,
  Trophy,
  UserRound,
  UsersRound,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSales } from '../../context/SalesContext';
import { Sale, Goal } from '../../types';
import { getSaleDateBr, getTodayBrDate, getRealSaleDate } from '../../lib/salesMapper';
import { supabase, LocalSyncEngine } from '../../lib/supabase';

interface HomeDashboardProps {
  onOpenNewSaleModal: () => void;
  onOpenSales: () => void;
  onOpenRanking: () => void;
}

const brNumber = (value: number) =>
  value.toLocaleString('pt-BR', { maximumFractionDigits: 0 });


const startOfDay = (date: Date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const dateKey = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const saleDateObject = (sale: Sale) => getRealSaleDate(sale) || new Date(sale.created_at);

const percentDelta = (current: number, previous: number) => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
};

export const HomeDashboard: React.FC<HomeDashboardProps> = ({
  onOpenNewSaleModal,
  onOpenSales,
  onOpenRanking,
}) => {
  const { currentUser, profiles } = useAuth();
  const { sales, leaderboard } = useSales();
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('today');

  const now = useMemo(() => new Date(), []);
  const todayKey = dateKey(now);
  const yesterdayKey = dateKey(new Date(now.getTime() - 86400000));

  const [operationalTargets, setOperationalTargets] = useState<{
    daily: number;
    weekly: number;
    monthly: number;
  }>({ daily: 0, weekly: 0, monthly: 0 });

  useEffect(() => {
    let isMounted = true;
    const fetchTargets = async () => {
      try {
        const todayIso = todayKey;
        const [{ data: weekPeriod }, { data: monthPeriod }, { data: weeklyGoals }, { data: activeImports, error: importsError }] = await Promise.all([
          supabase
            .from('goal_periods')
            .select('target_total')
            .eq('period_type', 'week')
            .lte('reference_start', todayIso)
            .gte('reference_end', todayIso)
            .maybeSingle(),
          supabase
            .from('goal_periods')
            .select('target_total')
            .eq('period_type', 'month')
            .lte('reference_start', todayIso)
            .gte('reference_end', todayIso)
            .maybeSingle(),
          supabase
            .from('goals')
            .select('target_total')
            .eq('type', 'week')
            .lte('reference_start', todayIso)
            .gte('reference_end', todayIso),
          supabase
            .from('goal_imports')
            .select('id, academic_period, goal_group, imported_at')
            .eq('status', 'active')
            .order('imported_at', { ascending: false }),
        ]);

        // A meta diária da Home soma as modalidades de Graduação das duas BUs
        // em todos os ciclos acadêmicos ativos. Não inclui Pós nem Técnico.
        let resolvedDaily = 0;
        if (importsError) throw importsError;
        const imports = activeImports || [];
        const buGroupIds = new Set([
          'graduacao_presencial',
          'graduacao_semipresencial',
          'graduacao_aovivo',
          'graduacao_ao_vivo',
          'graduacao_ead',
          'graduacao_dlex',
          'graduacao_flex',
          'graduacao_bu_presencial',
          'graduacao_bu_digital',
        ]);
        const relevantImportIds = imports
          .filter(item => buGroupIds.has(String(item.goal_group || '').toLowerCase()))
          .map(item => item.id);

        if (relevantImportIds.length > 0) {
          const { data: dailyRows, error: dailyError } = await supabase
            .from('goal_daily_data')
            .select('target')
            .eq('reference_date', todayIso)
            .in('import_id', relevantImportIds);
          if (dailyError) throw dailyError;
          resolvedDaily = (dailyRows || []).reduce(
            (sum, row) => sum + (row.target === null || row.target === undefined ? 0 : Number(row.target) || 0),
            0
          );
        }

        let resolvedWeekly = Number(weekPeriod?.target_total) || 0;
        if (!resolvedWeekly && weeklyGoals && weeklyGoals.length > 0) {
          resolvedWeekly = weeklyGoals.reduce((s: number, g: any) => s + (Number(g.target_total) || 0), 0);
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

        const activeSellers = profiles.filter(p => p.role === 'seller');
        const fallbackMonthly =
          activeSellers.reduce((s, p) => s + (Number(p.target_monthly) || 30), 0) || 30;

        const resolvedMonthly = Number(monthPeriod?.target_total) || fallbackMonthly;
        if (!resolvedWeekly) {
          resolvedWeekly = Math.max(1, Math.round(resolvedMonthly / 4));
        }

        if (isMounted) {
          setOperationalTargets({
            daily: resolvedDaily,
            weekly: resolvedWeekly,
            monthly: resolvedMonthly,
          });
        }
      } catch (err) {
        console.warn('Erro ao carregar metas sincronizadas na Home:', err);
      }
    };

    fetchTargets();
    return () => {
      isMounted = false;
    };
  }, [todayKey, profiles]);

  const teamGoalToday = operationalTargets.daily;
  const teamGoalWeek = operationalTargets.weekly || (teamGoalToday * 6);
  const teamGoalMonth = operationalTargets.monthly || (teamGoalWeek * 4);

  const todaySales = useMemo(
    () => sales.filter((sale) => getSaleDateBr(sale) === getTodayBrDate()),
    [sales]
  );

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

  const previousMonthSales = useMemo(
    () => sales.filter((sale) => {
      const date = saleDateObject(sale);
      const previousMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
      const previousYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
      return date.getMonth() === previousMonth && date.getFullYear() === previousYear;
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

  const todayCount = todaySales.length;
  const attainment = teamGoalToday > 0 ? Math.round((todayCount / teamGoalToday) * 100) : 0;
  const dayDelta = percentDelta(todayCount, yesterdaySales.length);

  const evolution = useMemo(() => {
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(now.getTime() - (6 - index) * 86400000);
      const key = dateKey(date);
      const count = sales.filter((sale) => dateKey(saleDateObject(sale)) === key).length;
      return {
        key,
        label: date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        count,
      };
    });
  }, [sales, now]);

  const maxEvolution = Math.max(...evolution.map((item) => item.count), teamGoalToday, 1);

  const rankingToday = useMemo(() => {
    const counts = new Map<string, number>();
    todaySales.forEach((sale) => counts.set(sale.seller_id, (counts.get(sale.seller_id) || 0) + 1));
    return profiles
      .filter((profile) => profile.role === 'seller')
      .map((profile) => ({ profile, count: counts.get(profile.id) || 0 }))
      .sort((a, b) => b.count - a.count || a.profile.name.localeCompare(b.profile.name, 'pt-BR'))
      .slice(0, 5);
  }, [profiles, todaySales]);

  const periodData = period === 'today'
    ? { count: todayCount, target: teamGoalToday }
    : period === 'week'
      ? { count: weekSales.length, target: teamGoalWeek }
      : { count: monthSales.length, target: teamGoalMonth };

  const periodAttainment = periodData.target > 0
    ? Math.round((periodData.count / periodData.target) * 100)
    : 0;

  const recentSales = [...sales].sort((a, b) => {
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  }).slice(0, 5);

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

  const comparisonWeek = percentDelta(weekSales.length, previousWeekSales.length);
  const comparisonMonth = percentDelta(monthSales.length, previousMonthSales.length);

  // Keep these values intentionally local to the dashboard. The Home redesign will later
  // move them to dedicated aggregate queries, without changing the visual contract.
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

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard icon={<ShoppingCart className="w-5 h-5" />} label="Vendas Hoje" value={brNumber(todayCount)} tone="blue" delta={dayDelta} subtitle={`vs. ontem (${brNumber(yesterdaySales.length)})`} />
        <KpiCard icon={<Target className="w-5 h-5" />} label="Meta Hoje" value={brNumber(teamGoalToday)} tone="green" subtitle={`Meta semanal: ${brNumber(teamGoalWeek)}`} />
        <KpiCard icon={<BarChart3 className="w-5 h-5" />} label="Atingimento Hoje" value={`${attainment}%`} tone="purple" delta={percentDelta(attainment, teamGoalToday > 0 ? Math.round((yesterdaySales.length / teamGoalToday) * 100) : 0)} subtitle={`${brNumber(todayCount)} / ${brNumber(teamGoalToday)}`} />
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-[1.55fr_0.85fr_0.85fr] gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3 mb-5">
            <div>
              <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-600" />
                Evolução da Equipe
              </h2>
              <p className="text-xs text-slate-400 mt-1">Vendas dos últimos 7 dias</p>
            </div>
            <span className="text-[11px] text-slate-400">Meta: {brNumber(teamGoalToday)}/dia · Semanal: {brNumber(teamGoalWeek)}</span>
          </div>

          <div className="h-52 flex items-end gap-2 sm:gap-3">
            {evolution.map((item) => (
              <div key={item.key} className="flex-1 h-full flex flex-col justify-end gap-2">
                <div className="relative flex-1 flex items-end">
                  <div
                    className="w-full rounded-t-xl bg-blue-500/85 transition-all"
                    style={{ height: `${Math.max(8, (item.count / maxEvolution) * 100)}%` }}
                    title={`${item.count} vendas`}
                  />
                  {teamGoalToday > 0 && (
                    <div
                      className="absolute left-0 right-0 border-t border-dashed border-slate-300"
                      style={{ bottom: `${Math.min(96, (teamGoalToday / maxEvolution) * 100)}%` }}
                    />
                  )}
                </div>
                <div className="text-center">
                  <div className={`text-[10px] font-semibold ${item.key === todayKey ? 'text-blue-700' : 'text-slate-400'}`}>
                    {item.label}
                  </div>
                  <div className="text-[10px] text-slate-500">{item.count}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <Target className="w-4 h-4 text-emerald-600" />
              Atingimento da Meta do Dia
            </h2>
          </div>
          <div className="text-4xl font-black text-slate-950 font-['Space_Grotesk']">{attainment}%</div>
          <p className="text-xs text-slate-400 mt-1">{brNumber(todayCount)} / {brNumber(teamGoalToday)} vendas</p>
          <div className="mt-5 h-4 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all" style={{ width: `${Math.min(attainment, 100)}%` }} />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-2 mb-4">
            <h2 className="text-sm font-extrabold text-slate-900">Resumo do Período</h2>
            <div className="flex rounded-lg bg-slate-100 p-1 text-[11px] font-bold">
              {(['today', 'week', 'month'] as const).map((item) => (
                <button
                  key={item}
                  onClick={() => setPeriod(item)}
                  className={`px-2.5 py-1.5 rounded-md transition-colors cursor-pointer ${period === item ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-900'}`}
                >
                  {item === 'today' ? 'Hoje' : item === 'week' ? 'Semana' : 'Mês'}
                </button>
              ))}
            </div>
          </div>
          <SummaryRow label="Vendas" value={brNumber(periodData.count)} />
          <SummaryRow label="Meta" value={periodData.target > 0 ? brNumber(periodData.target) : '—'} />
          <SummaryRow label="Atingimento" value={periodData.target > 0 ? `${periodAttainment}%` : '—'} />
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-[1.15fr_1fr] gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <UserRound className="w-4 h-4 text-blue-600" />
              Minha Performance
            </h2>
            <button onClick={() => onOpenRanking()} className="text-xs font-bold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1 cursor-pointer">
              Ver desempenho <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <PerformanceCard label="Hoje" value={myToday} delta={dayDelta} suffix="vs. ontem" />
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

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between gap-3 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <Clock3 className="w-4 h-4 text-slate-500" />
              Últimas Vendas
            </h2>
            <p className="text-xs text-slate-400 mt-1">Os últimos lançamentos registrados no sistema</p>
          </div>
          <button onClick={onOpenSales} className="text-xs font-bold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1 cursor-pointer">
            Ver todas as vendas <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-5 py-3 text-left font-bold">Hora</th>
                <th className="px-5 py-3 text-left font-bold">Candidato</th>
                <th className="px-5 py-3 text-left font-bold">Produto</th>
                <th className="px-5 py-3 text-left font-bold">Modalidade</th>
                <th className="px-5 py-3 text-left font-bold">Consultor</th>
              </tr>
            </thead>
            <tbody>
              {recentSales.map((sale) => (
                <tr key={sale.id} className="border-t border-slate-100 hover:bg-slate-50/70 transition-colors">
                  <td className="px-5 py-3 font-semibold text-slate-500 whitespace-nowrap">
                    {new Date(sale.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-5 py-3 font-semibold text-slate-800 max-w-[220px] truncate">{sale.client_name || '—'}</td>
                  <td className="px-5 py-3 text-slate-600 max-w-[240px] truncate">{sale.product_name || '—'}</td>
                  <td className="px-5 py-3 text-slate-600 max-w-[180px] truncate">{sale.custom_data?.modality || '—'}</td>
                  <td className="px-5 py-3 text-slate-600 max-w-[180px] truncate">{sale.seller_name || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center"><UsersRound className="w-4 h-4" /></div>
          <div><div className="text-xs font-bold text-slate-800">Equipe ativa</div><div className="text-[11px] text-slate-400">{profiles.filter((p) => p.role === 'seller' && p.status === 'active').length} vendedores</div></div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center"><ShoppingCart className="w-4 h-4" /></div>
          <div><div className="text-xs font-bold text-slate-800">Vendas na semana</div><div className="text-[11px] text-slate-400">{brNumber(weekSales.length)} lançamentos</div></div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center"><BarChart3 className="w-4 h-4" /></div>
          <div><div className="text-xs font-bold text-slate-800">Vendas no mês</div><div className="text-[11px] text-slate-400">{brNumber(monthSales.length)} lançamentos</div></div>
        </div>
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

const SummaryRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex items-center justify-between py-3 border-t border-slate-100 text-xs">
    <span className="text-slate-500">{label}</span>
    <span className="font-black text-slate-900">{value}</span>
  </div>
);

const PerformanceCard: React.FC<{ label: string; value: number; delta: number; suffix: string }> = ({ label, value, delta, suffix }) => (
  <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
    <div className="text-xs font-semibold text-slate-500">{label}</div>
    <div className="text-3xl font-black text-slate-950 font-['Space_Grotesk'] mt-1">{value}</div>
    <div className={`text-[11px] font-bold mt-1 ${delta >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
      {delta >= 0 ? '▲' : '▼'} {Math.abs(delta)}% <span className="font-medium text-slate-400">{suffix}</span>
    </div>
  </div>
);
