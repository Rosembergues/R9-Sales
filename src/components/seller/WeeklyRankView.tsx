import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSales } from '../../context/SalesContext';
import { useAuth } from '../../context/AuthContext';
import { supabase, LocalSyncEngine } from '../../lib/supabase';
import { getRealSaleDate, normalizeRemoteSale } from '../../lib/salesMapper';
import { Sale, Goal, DatabaseGoalRecord, UserGoalData } from '../../types';
import { ModalityMultiFilter } from './ModalityMultiFilter';
import { RankingOperationSelector } from './RankingOperationSelector';
import { getRankingOperationTarget, RANKING_OPERATION_OPTIONS, saleMatchesRankingOperation, type RankingOperation } from './rankingUtils';
import { Trophy, Crown, Flame, RotateCw, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';

interface WeeklyLeaderboardEntry {
  seller_id: string;
  name: string;
  email: string;
  avatar_url?: string;
  total_sales: number;
  target: number;
  target_graduacao: number;
  target_pos: number;
  target_tecnico: number;
  target_total: number;
  percentage_reached: number;
  percentage_graduacao: number;
  percentage_pos: number;
  percentage_tecnico: number;
  has_target: boolean;
  position: number;
  graduacao_count: number;
  pos_count: number;
  tecnico_count: number;
}

// Helper to parse date string (DD/MM/YYYY or YYYY-MM-DD or ISO) to Date object
function parseGoalData(g: DatabaseGoalRecord | Goal): UserGoalData {
  const targetTotal = g.target_total !== undefined ? Number(g.target_total) || 0 : 0;
  const targetBuPresencial = g.target_bu_presencial != null ? Number(g.target_bu_presencial) || 0 : undefined;
  const targetBuDigital = g.target_bu_digital != null ? Number(g.target_bu_digital) || 0 : undefined;
  const hasBuTargets = targetBuPresencial !== undefined || targetBuDigital !== undefined;
  const buGraduacaoTarget = (targetBuPresencial || 0) + (targetBuDigital || 0);
  const legacyGraduacaoTarget = Number(g.target_graduacao) || (targetTotal > 0 ? targetTotal : 0);
  const targetGraduacao = hasBuTargets && buGraduacaoTarget > 0 ? buGraduacaoTarget : legacyGraduacaoTarget;
  const targetPos = Number(g.target_pos) || 0;
  const targetTecnico = Number(g.target_tecnico) || 0;
  const finalTotal = targetTotal > 0 ? targetTotal : targetGraduacao + targetPos + targetTecnico;

  return {
    target_bu_presencial: targetBuPresencial,
    target_bu_digital: targetBuDigital,
    target_graduacao: targetGraduacao,
    target_pos: targetPos,
    target_tecnico: targetTecnico,
    target_total: finalTotal,
  };
}

export const WeeklyRankView: React.FC = () => {
  const { sales: contextSales } = useSales();
  const { profiles, currentUser } = useAuth();

  const [isLoading, setIsLoading] = useState(false);
  const [goalsMap, setGoalsMap] = useState<Record<string, UserGoalData>>({});
  const [remoteSales, setRemoteSales] = useState<Sale[] | null>(null);

  // Navigation across previous and current weeks (0 = current, -1 = last week, -2 = 2 weeks ago...)
  const [weekOffset, setWeekOffset] = useState<number>(0);
  const [selectedModalities, setSelectedModalities] = useState<string[]>([]);
  const [selectedOperation, setSelectedOperation] = useState<RankingOperation>('graduacao_total');

  const handlePrevWeek = () => {
    setWeekOffset(prev => prev - 1);
  };

  const handleNextWeek = () => {
    setWeekOffset(prev => Math.min(prev + 1, 0));
  };

  const handleCurrentWeek = () => {
    setWeekOffset(0);
  };

  // Week boundaries shifted by weekOffset (Monday 00:00:00.000 to Sunday 23:59:59.999)
  const weekRange = useMemo(() => {
    const now = new Date();
    // Shift date by weekOffset * 7 days
    const targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (weekOffset * 7));
    const day = targetDate.getDay();
    const diffToMonday = (day === 0 ? -6 : 1) - day;
    const monday = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate() + diffToMonday, 0, 0, 0, 0);
    const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6, 23, 59, 59, 999);

    const fmtShort = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    const shortLabel = `${fmtShort(monday)} a ${fmtShort(sunday)}`;

    const months = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    const startDay = monday.getDate();
    const endDay = sunday.getDate();
    const startMonth = months[monday.getMonth()];
    const endMonth = months[sunday.getMonth()];
    const startYear = monday.getFullYear();
    const endYear = sunday.getFullYear();

    let fullLabel = '';
    if (startYear !== endYear) {
      fullLabel = `${startDay} de ${startMonth} de ${startYear} a ${endDay} de ${endMonth} de ${endYear}`;
    } else if (startMonth !== endMonth) {
      fullLabel = `${startDay} de ${startMonth} a ${endDay} de ${endMonth} de ${endYear}`;
    } else {
      fullLabel = `${startDay} a ${endDay} de ${endMonth} de ${endYear}`;
    }

    let statusText = 'Semana Atual';
    if (weekOffset === -1) {
      statusText = 'Semana Anterior';
    } else if (weekOffset < -1) {
      statusText = `${Math.abs(weekOffset)} semanas atrás`;
    }

    return { 
      start: monday, 
      end: sunday, 
      label: weekOffset === 0 ? `Semana Atual (${shortLabel})` : `${statusText} (${shortLabel})`,
      shortLabel,
      fullLabel,
      statusText,
      isCurrent: weekOffset === 0
    };
  }, [weekOffset]);

  // 1. Fetch weekly goals from public.goals and latest sales
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Query weekly goals from public.goals
      const { data: goalsData, error: goalsError } = await supabase
        .from('goals')
        .select('*')
        .in('type', ['semanal', 'week'])
        .gte('reference_start', weekRange.start.toISOString().slice(0, 10))
        .lte('reference_start', weekRange.end.toISOString().slice(0, 10));

      const localGoals = LocalSyncEngine.getGoals();
      const newGoalsMap: Record<string, UserGoalData> = {};

      // Seed from local sync engine
      if (localGoals && localGoals.length > 0) {
        localGoals.forEach(g => {
          if (
            (g.type === 'semanal' || (g.type as string) === 'week') &&
            g.reference_start &&
            g.reference_start >= weekRange.start.toISOString().slice(0, 10) &&
            g.reference_start <= weekRange.end.toISOString().slice(0, 10)
          ) {
            newGoalsMap[g.user_id] = parseGoalData(g);
          }
        });
      }

      // Overwrite with Supabase public.goals
      if (!goalsError && goalsData && goalsData.length > 0) {
        (goalsData as DatabaseGoalRecord[]).forEach(g => {
          if (g.user_id) {
            newGoalsMap[g.user_id] = parseGoalData(g);
          }
        });
      }
      setGoalsMap(newGoalsMap);

      // 1 & 2. Consulta vendas no Supabase priorizando a data real da venda (sale_date)
      // Converte as datas da semana para limites de busca com margem de 24h para fuso horário
      const queryStart = new Date(weekRange.start.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const queryEnd = new Date(weekRange.end.getTime() + 24 * 60 * 60 * 1000).toISOString();

      let fetchedRows: any[] = [];
      try {
        const { data: salesData, error: salesError } = await supabase
          .from('sales')
          .select('*')
          .or(`and(sale_date.gte.${queryStart},sale_date.lte.${queryEnd}),and(created_at.gte.${queryStart},created_at.lte.${queryEnd})`)
          .order('created_at', { ascending: false });

        if (!salesError && salesData) {
          fetchedRows = salesData;
        } else {
          // Fallback resiliente caso haja erro de sintaxe no .or() ou cache do schema
          const { data: fallbackSales, error: fallbackErr } = await supabase
            .from('sales')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(1000);
          if (!fallbackErr && fallbackSales) {
            fetchedRows = fallbackSales;
          }
        }
      } catch {
        const { data: fallbackAll } = await supabase
          .from('sales')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(1000);
        if (fallbackAll) fetchedRows = fallbackAll;
      }

      if (fetchedRows.length > 0) {
        const normalized = fetchedRows.map(row => normalizeRemoteSale(row));
        setRemoteSales(normalized);
      }
    } catch (err) {
      console.error('Erro ao carregar dados do ranking semanal:', err);
    } finally {
      setIsLoading(false);
    }
  }, [weekRange]);

  // 4. Inscrição Realtime no canal do Supabase para as tabelas 'goals' e 'sales'
  useEffect(() => {
    loadData();

    let debounceTimer: NodeJS.Timeout | null = null;
    const debouncedReload = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        loadData();
      }, 350);
    };

    const goalsChannel = supabase
      .channel('public:goals-weekly-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'goals' },
        () => {
          debouncedReload();
        }
      )
      .subscribe();

    const salesChannel = supabase
      .channel('public:sales-weekly-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sales' },
        () => {
          debouncedReload();
        }
      )
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      goalsChannel.unsubscribe();
      supabase.removeChannel(goalsChannel);
      salesChannel.unsubscribe();
      supabase.removeChannel(salesChannel);
    };
  }, [loadData]);

  // Unifica vendas remotas com as do contexto para não omitir nenhum registro local
  const salesToUse = useMemo(() => {
    if (!remoteSales) return contextSales;
    const map = new Map<string, Sale>();
    contextSales.forEach(s => map.set(s.id, s));
    remoteSales.forEach(s => map.set(s.id, s));
    return Array.from(map.values());
  }, [remoteSales, contextSales]);

  // Filter sales within the selected week strictly based on real sale date (sale_date)
  // Regra obrigatória: A data da realização da venda (sale_date) tem prioridade total sobre a data de registro (created_at).
  // Uma venda realizada no sábado e registrada na segunda-feira é contabilizada exclusivamente na semana do sábado.
  const weeklySales = useMemo(() => {
    return salesToUse.filter(sale => {
      const saleDate = getRealSaleDate(sale);
      if (!saleDate) return false;

      return saleDate >= weekRange.start && saleDate <= weekRange.end;
    });
  }, [salesToUse, weekRange]);

  const operationSales = useMemo(
    () => weeklySales.filter(sale => saleMatchesRankingOperation(sale, selectedOperation)),
    [weeklySales, selectedOperation],
  );

  const modalityOptions = useMemo(() => {
    return Array.from(new Set(operationSales.map(s => s.custom_data?.modality).filter(Boolean) as string[]))
      .sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [operationSales]);

  const filteredWeeklySales = useMemo(() => {
    if (selectedModalities.length === 0) return operationSales;
    const selected = new Set(selectedModalities.map(value => value.toLowerCase()));
    return operationSales.filter(s => selected.has((s.custom_data?.modality || '').toLowerCase()));
  }, [operationSales, selectedModalities]);

  useEffect(() => {
    setSelectedModalities(current => {
      const next = current.filter(value => modalityOptions.includes(value));
      return next.length === current.length ? current : next;
    });
  }, [modalityOptions]);

  // Build weekly leaderboard joined with public.goals
  const leaderboard = useMemo<WeeklyLeaderboardEntry[]>(() => {
    // Include active consultants (or profiles with role seller/admin who have sales)
    const consultantProfiles = profiles.filter(p => p.status !== 'inactive');

    const result: WeeklyLeaderboardEntry[] = consultantProfiles.map(consultant => {
      const sName = (consultant.name || '').trim().toLowerCase();
      
      const consultantSales = filteredWeeklySales.filter(s => {
        const matchId = s.seller_id === consultant.id;
        const matchName = (s.seller_name || '').trim().toLowerCase() === sName;
        const matchCustom = (s.custom_data?.seller_name || '').trim().toLowerCase() === sName;
        return matchId || matchName || matchCustom;
      });

      const totalCount = consultantSales.length;

      const graduacaoCount = consultantSales.filter(s => {
        const p = s.custom_data?.main_product || s.product_name || '';
        return p.includes('Graduação') || (!p.includes('Pós') && !p.includes('Técnico'));
      }).length;

      const posCount = consultantSales.filter(s => {
        const p = s.custom_data?.main_product || s.product_name || '';
        return p.includes('Pós');
      }).length;

      const tecnicoCount = consultantSales.filter(s => {
        const p = s.custom_data?.main_product || s.product_name || '';
        return p.includes('Técnico');
      }).length;

      // 2. Goal calculation: fetch from public.goals (goalsMap)
      const userGoal = goalsMap[consultant.id];
      const targetGrad = userGoal?.target_graduacao ?? 0;
      const targetPos = userGoal?.target_pos ?? 0;
      const targetTec = userGoal?.target_tecnico ?? 0;
      let targetTotal = userGoal?.target_total ?? (targetGrad + targetPos + targetTec);
      let targetOperation = getRankingOperationTarget(userGoal, selectedOperation);
      if (targetTotal <= 0 && consultant.target_monthly && consultant.target_monthly > 0) {
        targetTotal = consultant.target_monthly >= 1000 ? 30 : Math.round(consultant.target_monthly);
      }
      if (targetOperation <= 0 && selectedOperation === 'todos_produtos' && targetTotal > 0) {
        targetOperation = targetTotal;
      }
      if (targetOperation <= 0 && selectedOperation === 'graduacao_total' && targetGrad <= 0 && targetTotal > 0) {
        targetOperation = targetTotal;
      }
      const hasTarget = targetOperation > 0;

      // Formula: (Total de Vendas / Meta Total) * 100 e Graduação isolada
      // Tratamento de Meta Zero: 0% sem quebrar ou dividir por zero
      const percentageReached = targetOperation > 0 ? Math.round((totalCount / targetOperation) * 100) : 0;
      const percentageGraduacao = targetGrad > 0 ? Math.round((graduacaoCount / targetGrad) * 100) : 0;
      const percentagePos = targetPos > 0 ? Math.round((posCount / targetPos) * 100) : 0;
      const percentageTecnico = targetTec > 0 ? Math.round((tecnicoCount / targetTec) * 100) : 0;

      return {
        seller_id: consultant.id,
        name: consultant.name,
        email: consultant.email,
        avatar_url: consultant.avatar_url,
        total_sales: totalCount,
        target: targetOperation,
        target_graduacao: targetOperation,
        target_pos: targetPos,
        target_tecnico: targetTec,
        target_total: targetOperation,
        percentage_reached: percentageReached,
        percentage_graduacao: percentageReached,
        percentage_pos: percentagePos,
        percentage_tecnico: percentageTecnico,
        has_target: hasTarget,
        position: 1,
        graduacao_count: graduacaoCount,
        pos_count: posCount,
        tecnico_count: tecnicoCount,
      };
    });

    // Sort by total_sales descending; tie-breaker: percentage_reached descending
    result.sort((a, b) => {
      if (b.total_sales !== a.total_sales) {
        return b.total_sales - a.total_sales;
      }
      return b.percentage_reached - a.percentage_reached;
    });

    // Assign positions
    return result.map((item, index) => ({
      ...item,
      position: index + 1,
    }));
  }, [profiles, filteredWeeklySales, goalsMap, selectedOperation]);

  const topThree = leaderboard.slice(0, 3);
  const selectedOperationLabel = RANKING_OPERATION_OPTIONS.find(option => option.value === selectedOperation)?.label || 'Graduação Total';

  // Total metrics of the week
  const totalWeeklySales = filteredWeeklySales.length;
  const totalWeeklyGoals = (Object.values(goalsMap) as UserGoalData[])
    .reduce((acc, goal) => acc + getRankingOperationTarget(goal, selectedOperation), 0);
  const overallWeekPercentage = totalWeeklyGoals > 0
    ? Math.round((totalWeeklySales / totalWeeklyGoals) * 100)
    : 0;

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      
      {/* Top Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 border border-amber-200/80 flex items-center justify-center shadow-2xs">
              <Trophy className="w-4 h-4" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 font-['Space_Grotesk'] tracking-tight">
              Ranking Semanal da Equipe
            </h2>
            {weekRange.isCurrent ? (
              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Semana Vigente
              </span>
            ) : (
              <span className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                Histórico ({weekRange.statusText})
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {weekRange.isCurrent
              ? 'Acompanhe o ritmo da equipe, as metas e a evolução da semana.'
              : `Exibindo histórico de classificação e vendas da semana de ${weekRange.fullLabel}.`}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Navegador de Semana com identificação clara da semana ativa */}
          <div className="inline-flex items-center gap-1 sm:gap-2 px-2 sm:px-2.5 py-1.5 rounded-xl bg-gray-50 border border-gray-200 text-xs text-gray-700 font-medium shadow-xs">
            <button
              onClick={handlePrevWeek}
              className="p-1 text-gray-500 hover:text-gray-900 hover:bg-gray-200/70 rounded-lg transition-colors cursor-pointer"
              title="Semana anterior"
              aria-label="Semana anterior"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            <div className="px-2.5 py-1 rounded-lg bg-white border border-gray-200/80 shadow-2xs font-bold text-gray-900 text-xs flex items-center gap-1.5">
              <Calendar className="w-3 h-3 text-blue-600" />
              <span>{weekRange.shortLabel}</span>
              {weekRange.isCurrent && (
                <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded">
                  Atual
                </span>
              )}
            </div>

            <button
              onClick={handleNextWeek}
              disabled={weekRange.isCurrent}
              className="p-1 text-gray-500 hover:text-gray-900 hover:bg-gray-200/70 rounded-lg transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              title={weekRange.isCurrent ? 'Semana atual é a mais recente' : 'Próxima semana'}
              aria-label="Próxima semana"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>

            {!weekRange.isCurrent && (
              <button
                onClick={handleCurrentWeek}
                className="ml-1 px-2 py-0.5 rounded-lg text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200/60 transition-colors cursor-pointer"
                title="Voltar para a semana atual"
              >
                Voltar p/ Atual
              </button>
            )}
          </div>

          <ModalityMultiFilter options={modalityOptions} selected={selectedModalities} onChange={setSelectedModalities} tone="blue" />

          <button
            onClick={loadData}
            disabled={isLoading}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
            title="Atualizar dados da semana selecionada"
          >
            <RotateCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold">
            <Flame className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
            <span className="hidden sm:inline">Classificação por Boletos</span>
            <span className="sm:hidden">Boletos</span>
          </div>
        </div>
      </div>

      <RankingOperationSelector
        value={selectedOperation}
        onChange={(operation) => {
          setSelectedOperation(operation);
          setSelectedModalities([]);
        }}
        tone="blue"
      />

      {/* Summary Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <span className="text-xs text-slate-500 font-medium">
            {weekRange.isCurrent ? `Vendas de ${selectedOperationLabel} na semana` : `Vendas de ${selectedOperationLabel} (${weekRange.shortLabel})`}
          </span>
          <div className="text-2xl font-black text-slate-900 font-['Space_Grotesk'] mt-1">
            {totalWeeklySales} <span className="text-xs font-semibold text-slate-500">vendas</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <span className="text-xs text-slate-500 font-medium">Meta Semanal Coletiva — {selectedOperationLabel}</span>
          <div className="text-2xl font-black text-blue-700 font-['Space_Grotesk'] mt-1">
            {totalWeeklyGoals > 0 ? `${totalWeeklyGoals} vendas` : 'A definir'}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <span className="text-xs text-slate-500 font-medium">Atingimento da Equipe — {selectedOperationLabel}</span>
          <div className="text-2xl font-black text-emerald-600 font-['Space_Grotesk'] mt-1">
            {overallWeekPercentage}%
          </div>
        </div>
      </div>

      {/* Top 3 Podium Visual Cards com Progresso da Meta Integrado (Graduação Flagship na Barra Colorida) */}
      {topThree.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end pt-2">
          
          {/* 2nd Place (Silver) */}
          {topThree[1] && (
            <div className="p-5 pt-7 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col items-center text-center relative order-2 md:order-1">
              <div className="absolute -top-3 px-3 py-0.5 rounded-full bg-slate-200 text-slate-800 font-bold text-xs shadow-xs">
                2º LUGAR
              </div>
              
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-1.5">
                {topThree[1].name}
                {topThree[1].seller_id === currentUser?.id && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-600 text-white font-bold">Você</span>
                )}
              </h3>
              
              {/* Boletos Count */}
              <div className="text-3xl font-black text-slate-800 mt-1 font-['Space_Grotesk']">
                {topThree[1].total_sales} <span className="text-sm font-semibold text-slate-500">{topThree[1].total_sales === 1 ? 'Boleto' : 'Boletos'}</span>
              </div>

              {/* Goal progress for selected operation */}
              <div className="w-full mt-3 p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-left space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700">Meta {selectedOperationLabel}:</span>
                  {topThree[1].target > 0 ? (
                    <span className={`font-black ${
                      topThree[1].percentage_reached >= 100 ? 'text-emerald-700 font-extrabold' : 'text-emerald-600'
                    }`}>
                      {topThree[1].percentage_reached}%
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-400 italic">Sem meta</span>
                  )}
                </div>

                {topThree[1].target > 0 ? (
                  <>
                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all duration-300 bg-gradient-to-r from-orange-500 via-amber-500 to-emerald-500 bg-no-repeat"
                        style={{ 
                          width: `${Math.min(topThree[1].percentage_reached, 100)}%`,
                          backgroundSize: topThree[1].percentage_reached > 0 
                            ? `${(100 / Math.min(topThree[1].percentage_reached, 100)) * 100}% 100%` 
                            : '100% 100%'
                        }}
                      />
                    </div>
                    <div className="text-[11px] text-slate-500 text-right font-medium">
                      {topThree[1].total_sales}/{topThree[1].target} vendas de {selectedOperationLabel}
                    </div>
                  </>
                ) : (
                  <div className="text-[11px] text-slate-400">Meta da operação não definida</div>
                )}
              </div>
            </div>
          )}

          {/* 1st Place (Gold / Champion) */}
          {topThree[0] && (
            <div className="p-6 pt-8 rounded-2xl bg-white border-2 border-amber-400 shadow-sm flex flex-col items-center text-center relative order-1 md:order-2 md:-translate-y-2">
              <div className="absolute -top-4 px-4 py-1 rounded-full bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 font-bold text-xs shadow-xs flex items-center gap-1">
                <Crown className="w-3.5 h-3.5 fill-current" />
                CAMPEÃO DA SEMANA (1º LUGAR)
              </div>
              
              <h3 className="font-bold text-slate-900 text-lg flex items-center gap-1.5">
                {topThree[0].name}
                {topThree[0].seller_id === currentUser?.id && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-600 text-white font-bold">Você</span>
                )}
              </h3>
              
              {/* Boletos Count */}
              <div className="text-4xl font-black text-amber-600 mt-1 font-['Space_Grotesk']">
                {topThree[0].total_sales} <span className="text-base font-semibold text-amber-700">{topThree[0].total_sales === 1 ? 'Boleto' : 'Boletos'}</span>
              </div>

              {/* Goal progress for selected operation */}
              <div className="w-full mt-3 p-3 rounded-xl bg-amber-50/60 border border-amber-200/80 text-left space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800">Meta {selectedOperationLabel}:</span>
                  {topThree[0].target > 0 ? (
                    <span className={`font-black text-sm ${
                      topThree[0].percentage_reached >= 100 ? 'text-emerald-700 font-extrabold' : 'text-emerald-600'
                    }`}>
                      {topThree[0].percentage_reached}%
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-400 italic">Sem meta</span>
                  )}
                </div>

                {topThree[0].target > 0 ? (
                  <>
                    <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all duration-300 bg-gradient-to-r from-orange-500 via-amber-500 to-emerald-500 bg-no-repeat"
                        style={{ 
                          width: `${Math.min(topThree[0].percentage_reached, 100)}%`,
                          backgroundSize: topThree[0].percentage_reached > 0 
                            ? `${(100 / Math.min(topThree[0].percentage_reached, 100)) * 100}% 100%` 
                            : '100% 100%'
                        }}
                      />
                    </div>
                    <div className="text-[11px] text-slate-600 text-right font-semibold">
                      {topThree[0].total_sales}/{topThree[0].target} vendas de {selectedOperationLabel}
                    </div>
                  </>
                ) : (
                  <div className="text-[11px] text-slate-400">Meta da operação não definida</div>
                )}
              </div>
            </div>
          )}

          {/* 3rd Place (Bronze) */}
          {topThree[2] && (
            <div className="p-5 pt-7 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col items-center text-center relative order-3 md:order-3">
              <div className="absolute -top-3 px-3 py-0.5 rounded-full bg-amber-600 text-white font-bold text-xs shadow-xs">
                3º LUGAR
              </div>
              
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-1.5">
                {topThree[2].name}
                {topThree[2].seller_id === currentUser?.id && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-600 text-white font-bold">Você</span>
                )}
              </h3>
              
              {/* Boletos Count */}
              <div className="text-3xl font-black text-amber-700 mt-1 font-['Space_Grotesk']">
                {topThree[2].total_sales} <span className="text-sm font-semibold text-slate-500">{topThree[2].total_sales === 1 ? 'Boleto' : 'Boletos'}</span>
              </div>

              {/* Goal progress for selected operation */}
              <div className="w-full mt-3 p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-left space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700">Meta {selectedOperationLabel}:</span>
                  {topThree[2].target > 0 ? (
                    <span className={`font-black ${
                      topThree[2].percentage_reached >= 100 ? 'text-emerald-700 font-extrabold' : 'text-emerald-600'
                    }`}>
                      {topThree[2].percentage_reached}%
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-400 italic">Sem meta</span>
                  )}
                </div>

                {topThree[2].target > 0 ? (
                  <>
                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all duration-300 bg-gradient-to-r from-orange-500 via-amber-500 to-emerald-500 bg-no-repeat"
                        style={{ 
                          width: `${Math.min(topThree[2].percentage_reached, 100)}%`,
                          backgroundSize: topThree[2].percentage_reached > 0 
                            ? `${(100 / Math.min(topThree[2].percentage_reached, 100)) * 100}% 100%` 
                            : '100% 100%'
                        }}
                      />
                    </div>
                    <div className="text-[11px] text-slate-500 text-right font-medium">
                      {topThree[2].total_sales}/{topThree[2].target} vendas de {selectedOperationLabel}
                    </div>
                  </>
                ) : (
                  <div className="text-[11px] text-slate-400">Meta da operação não definida</div>
                )}
              </div>
            </div>
          )}

        </div>
      )}

      {/* Leaderboard Full Table */}
      <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-xs">
        <div className="px-6 py-4 bg-slate-50/75 border-b border-slate-200 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Ranking de {selectedOperationLabel} — Semana ({weekRange.shortLabel})
          </span>
          <span className="text-xs text-slate-500 font-medium">
            Total de {leaderboard.length} consultores avaliados
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm text-slate-600">
            <thead className="bg-slate-50/50 border-b border-slate-200 uppercase font-semibold text-slate-500 text-[11px] tracking-wider">
              <tr>
                <th className="py-3 px-4 sm:px-6 w-16">Posição</th>
                <th className="py-3 px-4">Consultor</th>
                <th className="py-3 px-4 font-bold text-slate-900">Vendas da operação</th>
                
                
                
                <th className="py-3 px-4 sm:px-6 text-right min-w-[180px]">Atingimento da Meta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {leaderboard.map((seller) => {
                const isCurrent = seller.seller_id === currentUser?.id;

                return (
                  <tr
                    key={seller.seller_id}
                    className={`transition-colors ${
                      isCurrent
                        ? 'bg-blue-50/60 border-l-4 border-blue-600'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    {/* Rank position badge */}
                    <td className="py-3.5 px-4 sm:px-6 font-bold">
                      <div className="flex items-center gap-1.5">
                        {seller.position === 1 ? (
                          <span className="w-6 h-6 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center font-black text-xs shadow-xs">
                            1
                          </span>
                        ) : seller.position === 2 ? (
                          <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-800 flex items-center justify-center font-bold text-xs">
                            2
                          </span>
                        ) : seller.position === 3 ? (
                          <span className="w-6 h-6 rounded-full bg-amber-600 text-white flex items-center justify-center font-bold text-xs">
                            3
                          </span>
                        ) : (
                          <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs">
                            {seller.position}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Colaborador */}
                    <td className="py-3.5 px-4">
                      <div>
                        <div className="font-bold text-slate-900 flex items-center gap-2">
                          <span>{seller.name}</span>
                          {isCurrent && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-600 text-white font-bold">
                              Você
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-500">{seller.email}</span>
                      </div>
                    </td>

                    {/* Total Boletos */}
                    <td className="py-3.5 px-4 font-black text-slate-900 text-sm">
                      <span className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg border border-blue-200/80 font-bold">
                        {seller.total_sales} {seller.total_sales === 1 ? 'boleto' : 'boletos'}
                      </span>
                    </td>

                    {/* Progresso da meta da operação selecionada */}
                    <td className="py-3.5 px-4 sm:px-6 text-right">
                      {seller.has_target ? (
                        <div className="inline-block space-y-1 text-right">
                          <div className="flex items-center justify-end gap-2 text-xs">
                            <span className={`font-black ${
                              seller.percentage_reached >= 100 ? 'text-emerald-700 font-extrabold' : 'text-emerald-600'
                            }`}>
                              {seller.percentage_reached}%
                            </span>
                            <span className="text-slate-500 font-medium text-[11px]">
                              ({seller.total_sales}/{seller.target} vendas)
                            </span>
                          </div>
                          <div className="w-28 sm:w-36 h-2.5 bg-slate-100 rounded-full overflow-hidden ml-auto">
                            <div
                              className="h-full rounded-full transition-all duration-300 bg-gradient-to-r from-orange-500 via-amber-500 to-emerald-500 bg-no-repeat"
                              style={{ 
                                width: `${Math.min(seller.percentage_reached, 100)}%`,
                                backgroundSize: seller.percentage_reached > 0 
                                  ? `${(100 / Math.min(seller.percentage_reached, 100)) * 100}% 100%` 
                                  : '100% 100%'
                              }}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="inline-block space-y-1 text-right">
                          <div className="text-xs text-slate-400 font-medium">
                            Sem meta configurada ({seller.total_sales} vendas)
                          </div>
                          <div className="w-28 sm:w-36 h-2.5 bg-slate-100 rounded-full overflow-hidden ml-auto" />
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
