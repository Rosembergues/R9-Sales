import React, { useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSales } from '../../context/SalesContext';
import { getRealSaleDate } from '../../lib/salesMapper';
import {
  Activity,
  Award,
  BarChart3,
  CalendarDays,
  CircleCheck,
  GraduationCap,
  Target,
  Trophy,
  Users,
  Wrench,
} from 'lucide-react';
import { MainProductType, Sale } from '../../types';
import { ModalityMultiFilter } from './ModalityMultiFilter';

const productMeta: Record<MainProductType, { label: string; short: string; icon: React.ReactNode; tone: string }> = {
  'Graduação': {
    label: 'Graduação',
    short: 'Grad.',
    icon: <GraduationCap className="w-4 h-4" />,
    tone: 'blue',
  },
  'Pós Graduação': {
    label: 'Pós Graduação',
    short: 'Pós',
    icon: <Award className="w-4 h-4" />,
    tone: 'purple',
  },
  'Curso Técnico': {
    label: 'Curso Técnico',
    short: 'Téc.',
    icon: <Wrench className="w-4 h-4" />,
    tone: 'amber',
  },
};

const parseSaleDay = (sale: Sale): Date | null => getRealSaleDate(sale);

const sameCalendarDay = (a: Date | null, b: Date): boolean => {
  if (!a) return false;
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
};

const isSameMonth = (date: Date | null, year: number, month: number) => {
  if (!date) return false;
  return date.getFullYear() === year && date.getMonth() === month;
};

const getProductType = (sale: Sale): MainProductType => {
  const custom = sale.custom_data?.main_product;
  if (custom === 'Graduação' || custom === 'Pós Graduação' || custom === 'Curso Técnico') {
    return custom;
  }

  const text = [
    sale.product_name,
    sale.fdi,
    sale.custom_data?.fdi,
    sale.custom_data?.fdi_channel,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (text.includes('pós')) return 'Pós Graduação';
  if (text.includes('técnic')) return 'Curso Técnico';
  return 'Graduação';
};

const formatMonth = (date: Date) =>
  date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

const formatDay = (date: Date) =>
  date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');

interface PerformanceDashboardProps {
  onOpenNewSaleModal?: () => void;
  onOpenProductDetails?: (product: MainProductType) => void;
}

export const PerformanceDashboard: React.FC<PerformanceDashboardProps> = ({ onOpenNewSaleModal, onOpenProductDetails }) => {
  const { currentUser, profiles } = useAuth();
  const { sales } = useSales();
  const [showProductDetails, setShowProductDetails] = React.useState(false);
  const [selectedModalities, setSelectedModalities] = React.useState<string[]>([]);

  const today = useMemo(() => new Date(), []);
  const monthStart = useMemo(() => new Date(today.getFullYear(), today.getMonth(), 1), [today]);
  const previousMonth = useMemo(() => new Date(today.getFullYear(), today.getMonth() - 1, 1), [today]);

  const monthSales = useMemo(
    () => sales.filter(s => isSameMonth(parseSaleDay(s), today.getFullYear(), today.getMonth())),
    [sales, today]
  );

  const modalityOptions = useMemo(() => {
    return Array.from(new Set(monthSales.map(s => s.custom_data?.modality).filter(Boolean) as string[]))
      .sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [monthSales]);

  const filteredMonthSales = useMemo(() => {
    if (selectedModalities.length === 0) return monthSales;
    const selected = new Set(selectedModalities.map(value => value.toLowerCase()));
    return monthSales.filter(s => selected.has((s.custom_data?.modality || '').toLowerCase()));
  }, [monthSales, selectedModalities]);

  useEffect(() => {
    setSelectedModalities(current => {
      const next = current.filter(value => modalityOptions.includes(value));
      return next.length === current.length ? current : next;
    });
  }, [modalityOptions]);

  const previousMonthSales = useMemo(
    () => sales.filter(s => {
      if (!isSameMonth(parseSaleDay(s), previousMonth.getFullYear(), previousMonth.getMonth())) return false;
      if (selectedModalities.length === 0) return true;
      const selected = new Set(selectedModalities.map(value => value.toLowerCase()));
      return selected.has((s.custom_data?.modality || '').toLowerCase());
    }),
    [sales, previousMonth, selectedModalities]
  );

  const sellerMonthSales = useMemo(() => {
    if (!currentUser || currentUser.role === 'admin') return filteredMonthSales;
    return filteredMonthSales.filter(s => s.seller_id === currentUser.id);
  }, [currentUser, filteredMonthSales]);

  const normalizeMonthlyGoal = (raw?: number) => {
    const numeric = Number(raw) || 0;
    return numeric >= 1000 ? 30 : numeric;
  };

  const target = useMemo(() => {
    if (currentUser?.role === 'admin') {
      return profiles
        .filter(p => p.role === 'seller' && p.status !== 'inactive')
        .reduce((sum, profile) => sum + normalizeMonthlyGoal(profile.target_monthly), 0);
    }
    return normalizeMonthlyGoal(currentUser?.target_monthly);
  }, [currentUser, profiles]);

  const realized = sellerMonthSales.length;
  const attainment = target > 0 ? Math.round((realized / target) * 100) : 0;
  const remaining = Math.max(0, target - realized);
  const previousReference = currentUser?.role === 'admin'
    ? previousMonthSales.length
    : previousMonthSales.filter(s => s.seller_id === currentUser?.id).length;
  const monthDelta = previousReference > 0
    ? Math.round(((realized - previousReference) / previousReference) * 100)
    : null;

  const productCounts = useMemo(() => {
    const counts: Record<MainProductType, number> = {
      'Graduação': 0,
      'Pós Graduação': 0,
      'Curso Técnico': 0,
    };
    sellerMonthSales.forEach(sale => {
      counts[getProductType(sale)] += 1;
    });
    return counts;
  }, [sellerMonthSales]);

  const dailySeries = useMemo(() => {
    const series: { date: Date; label: string; value: number; isToday: boolean }[] = [];
    for (let i = 6; i >= 0; i -= 1) {
      const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
      const value = sellerMonthSales.filter(sale => sameCalendarDay(parseSaleDay(sale), date)).length;
      series.push({ date, label: formatDay(date), value, isToday: i === 0 });
    }
    return series;
  }, [sellerMonthSales, today]);

  const maxDaily = Math.max(...dailySeries.map(item => item.value), 1);

  const ranking = useMemo(() => {
    const sellerProfiles = profiles.filter(p => p.role === 'seller' && p.status !== 'inactive');
    const rows = sellerProfiles
      .map(profile => ({
        id: profile.id,
        name: profile.name || profile.email,
        count: filteredMonthSales.filter(s => s.seller_id === profile.id).length,
      }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

    const currentId = currentUser?.id;
    return {
      rows: rows.slice(0, 5),
      position: currentId ? rows.findIndex(row => row.id === currentId) + 1 : 0,
    };
  }, [profiles, filteredMonthSales, currentUser]);

  const displayTarget = target > 0 ? target : 0;
  const progressWidth = Math.min(attainment, 100);

  if (!currentUser) return null;

  const subtitle = currentUser.role === 'admin'
    ? 'Acompanhamento da produção da equipe, baseado em quantidade de vendas.'
    : 'Acompanhe sua produção e o ritmo necessário para atingir a meta.';

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Header */}
      <section className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 rounded-2xl bg-white border border-slate-200 shadow-sm p-5 sm:p-6">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center">
              <Activity className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 font-['Space_Grotesk']">
              Desempenho
            </h1>
          </div>
          <p className="text-sm text-slate-500 mt-2 max-w-2xl">{subtitle}</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex items-center gap-2 rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-sm text-slate-700 font-semibold w-fit">
            <CalendarDays className="w-4 h-4 text-blue-600" />
            <span className="capitalize">{formatMonth(monthStart)}</span>
          </div>
          {onOpenNewSaleModal && (
            <button
              onClick={onOpenNewSaleModal}
              className="inline-flex items-center gap-2 rounded-xl bg-[#0052cc] hover:bg-[#00478f] text-white px-4 py-2 text-sm font-bold shadow-sm transition-colors cursor-pointer"
            >
              + Lançar venda
            </button>
          )}
        </div>
      </section>

      <section className="flex justify-end">
        <ModalityMultiFilter options={modalityOptions} selected={selectedModalities} onChange={setSelectedModalities} />
      </section>

      {/* KPI cards */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          icon={<CircleCheck className="w-5 h-5" />}
          label={currentUser.role === 'admin' ? 'Vendas da Equipe' : 'Minhas Vendas'}
          value={realized.toLocaleString('pt-BR')}
          helper={monthDelta === null ? 'Sem comparação disponível' : `${monthDelta >= 0 ? '+' : ''}${monthDelta}% vs. mês anterior`}
          tone="blue"
        />
        <MetricCard
          icon={<Target className="w-5 h-5" />}
          label={currentUser.role === 'admin' ? 'Meta da Equipe' : 'Minha Meta'}
          value={displayTarget.toLocaleString('pt-BR')}
          helper="Meta mensal em vendas"
          tone="green"
        />
        <MetricCard
          icon={<BarChart3 className="w-5 h-5" />}
          label="Atingimento"
          value={`${attainment}%`}
          helper={remaining > 0 ? `Faltam ${remaining} vendas` : 'Meta atingida'}
          tone="purple"
        />
      </section>

      {/* Main performance grid */}
      <section className="grid grid-cols-1 xl:grid-cols-5 gap-5">
        <div className="xl:col-span-3 rounded-2xl bg-white border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Ritmo de vendas</h2>
              <p className="text-xs text-slate-500 mt-0.5">Últimos 7 dias</p>
            </div>
            <span className="text-xs font-bold text-slate-500">Total: {realized}</span>
          </div>

          <div className="mt-6 h-48 flex items-end gap-2 sm:gap-3">
            {dailySeries.map(item => (
              <div key={item.date.toISOString()} className="flex-1 h-full flex flex-col justify-end items-center gap-2 min-w-0">
                <div className="relative w-full max-w-[44px] h-full flex items-end">
                  <div
                    className={`w-full rounded-t-xl transition-all ${item.isToday ? 'bg-blue-600' : 'bg-blue-100'}`}
                    style={{ height: `${Math.max(10, (item.value / maxDaily) * 100)}%` }}
                    title={`${item.value} vendas`}
                  />
                  {item.value > 0 && (
                    <span className={`absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-bold ${item.isToday ? 'text-blue-700' : 'text-slate-600'}`}>
                      {item.value}
                    </span>
                  )}
                </div>
                <span className={`text-[10px] font-semibold capitalize ${item.isToday ? 'text-blue-700' : 'text-slate-400'}`}>
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="xl:col-span-2 rounded-2xl bg-white border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Meta mensal</h2>
              <p className="text-xs text-slate-500 mt-0.5">Progresso por quantidade de vendas</p>
            </div>
            <span className={`text-sm font-black ${attainment >= 100 ? 'text-emerald-600' : 'text-blue-600'}`}>
              {attainment}%
            </span>
          </div>

          <div className="mt-6 h-4 rounded-full bg-slate-100 overflow-hidden border border-slate-200 p-0.5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 transition-all duration-700"
              style={{ width: `${progressWidth}%` }}
            />
          </div>

          <div className="mt-3 flex items-center justify-between text-xs">
            <span className="font-bold text-slate-900">{realized} vendas</span>
            <span className="text-slate-500">de {displayTarget.toLocaleString('pt-BR')}</span>
          </div>

          <div className="mt-5 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
              <Target className="w-4 h-4 text-blue-600" />
              {remaining > 0 ? `Faltam ${remaining} vendas para a meta` : 'Meta mensal atingida'}
            </div>
          </div>
        </div>
      </section>

      {/* Period summary */}
      <section className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">Resumo do período</h2>
            <p className="text-xs text-slate-500 mt-0.5">Volume de vendas por janela de acompanhamento</p>
          </div>
          <BarChart3 className="w-5 h-5 text-blue-600" />
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <MiniMetric label="Hoje" value={sellerMonthSales.filter(sale => sameCalendarDay(parseSaleDay(sale), today)).length} />
          <MiniMetric label="Últimos 7 dias" value={dailySeries.reduce((sum, item) => sum + item.value, 0)} />
          <MiniMetric label="Mês" value={realized} />
        </div>
      </section>

      {/* Products + ranking */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Distribuição por produto</h2>
              <p className="text-xs text-slate-500 mt-0.5">Quantidade de vendas no mês</p>
            </div>
            <span className="text-xs font-bold text-slate-500">{realized} total</span>
          </div>

          <div className="mt-5 space-y-4">
            {(Object.keys(productMeta) as MainProductType[]).map(product => {
              const meta = productMeta[product];
              const count = productCounts[product];
              const percentage = realized > 0 ? Math.round((count / realized) * 100) : 0;
              const barTone = meta.tone === 'purple' ? 'bg-purple-500' : meta.tone === 'amber' ? 'bg-amber-500' : 'bg-blue-600';
              const iconTone = meta.tone === 'purple' ? 'bg-purple-50 text-purple-600 border-purple-100' : meta.tone === 'amber' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-blue-50 text-blue-600 border-blue-100';

              return (
                <div key={product}>
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-lg border flex items-center justify-center ${iconTone}`}>
                        {meta.icon}
                      </div>
                      <span className="text-sm font-semibold text-slate-700">{meta.label}</span>
                    </div>
                    <span className="text-sm font-black text-slate-900">{count}</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                    <div className={`h-full rounded-full ${barTone}`} style={{ width: `${percentage}%` }} />
                  </div>
                  <div className="mt-1 text-[10px] font-semibold text-slate-400">{percentage}% das vendas</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Ranking do mês</h2>
              <p className="text-xs text-slate-500 mt-0.5">Classificação por quantidade de vendas</p>
            </div>
            <Trophy className="w-5 h-5 text-amber-500" />
          </div>

          <div className="mt-5 space-y-2">
            {ranking.rows.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-400">Nenhum vendedor com vendas no período.</div>
            ) : ranking.rows.map((row, index) => {
              const isCurrent = row.id === currentUser.id;
              return (
                <div key={row.id} className={`flex items-center gap-3 rounded-xl px-3 py-3 border ${isCurrent ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-100'}`}>
                  <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black ${index === 0 ? 'bg-amber-100 text-amber-700' : index === 1 ? 'bg-slate-200 text-slate-700' : index === 2 ? 'bg-orange-100 text-orange-700' : 'bg-white text-slate-500 border border-slate-200'}`}>
                    {index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-800 truncate">{row.name}</span>
                      {isCurrent && <span className="text-[9px] uppercase tracking-wide font-black text-blue-700 bg-blue-100 rounded-full px-1.5 py-0.5">Você</span>}
                    </div>
                  </div>
                  <span className="text-sm font-black text-slate-900">{row.count}</span>
                  <span className="text-[10px] text-slate-400">vendas</span>
                </div>
              );
            })}
          </div>

          {currentUser.role !== 'admin' && ranking.position > 0 && (
            <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                <Users className="w-4 h-4 text-blue-600" />
                Sua posição
              </div>
              <span className="text-sm font-black text-slate-900">{ranking.position}º lugar</span>
            </div>
          )}
        </div>
      </section>

      {/* Bottom status */}
      <section className="rounded-2xl bg-slate-900 text-white p-5 sm:p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-sm font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Acompanhamento ativo
          </div>
          <p className="text-xs text-slate-300 mt-1 max-w-xl">
            Acompanhamento mensal por quantidade de vendas, metas e evolução da equipe.
          </p>
        </div>
        {onOpenProductDetails && (
          <div className="flex flex-col items-end gap-2">
            <button
              type="button"
              onClick={() => setShowProductDetails(prev => !prev)}
              aria-expanded={showProductDetails}
              className="inline-flex items-center gap-2 text-xs font-bold text-white bg-white/10 hover:bg-white/15 border border-white/10 rounded-xl px-3.5 py-2.5 transition-colors"
            >
              <span>Ver detalhes por produto</span>
              <span aria-hidden="true">{showProductDetails ? '↑' : '→'}</span>
            </button>

            {showProductDetails && (
              <div className="flex flex-wrap justify-end gap-2">
                {(Object.keys(productMeta) as MainProductType[]).map(product => {
                  const meta = productMeta[product];
                  return (
                    <button
                      key={product}
                      type="button"
                      onClick={() => onOpenProductDetails(product)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-white text-slate-800 px-3 py-2 text-[11px] font-bold hover:bg-slate-100 transition-colors"
                    >
                      {meta.icon}
                      <span>{meta.short}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
};

const MiniMetric: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
    <p className="text-xs font-semibold text-slate-500">{label}</p>
    <p className="text-2xl font-black text-slate-900 font-['Space_Grotesk'] mt-1">{value.toLocaleString('pt-BR')}</p>
    <p className="text-[10px] text-slate-400 mt-1">vendas</p>
  </div>
);

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  helper: string;
  tone: 'blue' | 'green' | 'purple';
}

const MetricCard: React.FC<MetricCardProps> = ({ icon, label, value, helper, tone }) => {
  const tones = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    green: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    purple: 'bg-purple-50 text-purple-600 border-purple-100',
  };

  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${tones[tone]}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-500">{label}</p>
          <p className="text-2xl font-black text-slate-900 font-['Space_Grotesk'] mt-0.5">{value}</p>
        </div>
      </div>
      <p className="text-[11px] font-medium text-slate-400 mt-4">{helper}</p>
    </div>
  );
};
