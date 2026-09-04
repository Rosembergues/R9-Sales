import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSales } from '../../context/SalesContext';
import { useAuth } from '../../context/AuthContext';
import { supabase, LocalSyncEngine } from '../../lib/supabase';
import { getSaleDateBr } from '../../lib/salesMapper';
import { Profile, Sale, Goal } from '../../types';
import { 
  Trophy, 
  Crown, 
  Flame, 
  Target, 
  RotateCw, 
  Users, 
  TrendingUp, 
  CalendarRange, 
  CheckCircle2,
  Sparkles,
  Award
} from 'lucide-react';

interface UserGoalData {
  target_graduacao: number;
  target_pos: number;
  target_tecnico: number;
  target_total: number;
}

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
function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const trimmed = dateStr.trim();
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(trimmed)) {
    const [d, m, y] = trimmed.split('/').map(Number);
    return new Date(y, m - 1, d, 12, 0, 0);
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const [y, m, d] = trimmed.slice(0, 10).split('-').map(Number);
    return new Date(y, m - 1, d, 12, 0, 0);
  }
  const parsed = new Date(trimmed);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function parseGoalData(g: any): UserGoalData {
  const rawTargetValue = Number(g.target_value) || 0;
  const rawTargetTotal = Number(g.target_total) || 0;
  const targetTotal = rawTargetTotal > 0 ? rawTargetTotal : Math.round(rawTargetValue);

  const hasSpecificTargets = g.target_graduacao !== undefined || g.target_pos !== undefined || g.target_tecnico !== undefined;
  
  const targetGraduacao = hasSpecificTargets
    ? (Number(g.target_graduacao) || 0)
    : (targetTotal > 0 ? targetTotal : 0);
  const targetPos = Number(g.target_pos) || 0;
  const targetTecnico = Number(g.target_tecnico) || 0;
  const finalTotal = targetTotal > 0 ? targetTotal : (targetGraduacao + targetPos + targetTecnico);

  return {
    target_graduacao: targetGraduacao,
    target_pos: targetPos,
    target_tecnico: targetTecnico,
    target_total: finalTotal
  };
}

export const WeeklyRankView: React.FC = () => {
  const { sales: contextSales } = useSales();
  const { profiles, currentUser } = useAuth();

  const [isLoading, setIsLoading] = useState(false);
  const [goalsMap, setGoalsMap] = useState<Record<string, UserGoalData>>({});
  const [remoteSales, setRemoteSales] = useState<Sale[] | null>(null);

  // Current week boundaries (Monday 00:00:00.000 to Sunday 23:59:59.999)
  const weekRange = useMemo(() => {
    const now = new Date();
    const day = now.getDay();
    const diffToMonday = (day === 0 ? -6 : 1) - day;
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday, 0, 0, 0, 0);
    const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6, 23, 59, 59, 999);

    const fmt = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = `Semana Atual (${fmt(monday)} a ${fmt(sunday)})`;
    return { start: monday, end: sunday, label };
  }, []);

  // 1. Fetch weekly goals from public.goals and latest sales
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Query weekly goals from public.goals
      const { data: goalsData, error: goalsError } = await supabase
        .from('goals')
        .select('*')
        .in('type', ['semanal', 'week']);

      const localGoals = LocalSyncEngine.getGoals();
      const newGoalsMap: Record<string, UserGoalData> = {};

      // Seed from local sync engine
      if (localGoals && localGoals.length > 0) {
        localGoals.forEach(g => {
          if (g.type === 'semanal' || (g.type as string) === 'week') {
            newGoalsMap[g.user_id] = parseGoalData(g);
          }
        });
      }

      // Overwrite with Supabase public.goals
      if (!goalsError && goalsData && goalsData.length > 0) {
        goalsData.forEach((g: any) => {
          if (g.user_id) {
            newGoalsMap[g.user_id] = parseGoalData(g);
          }
        });
      }
      setGoalsMap(newGoalsMap);

      // 1 & 2. Query latest sales from Supabase within current week
      // Limite de data inclui 23:59:59.999 do domingo e preserva fuso horário convertendo para ISO UTC
      const startIso = weekRange.start.toISOString();
      const endIso = weekRange.end.toISOString();

      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select('*')
        .gte('created_at', startIso)
        .lte('created_at', endIso)
        .order('created_at', { ascending: false });

      if (!salesError && salesData) {
        setRemoteSales(salesData as Sale[]);
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

    const goalsChannel = supabase
      .channel('public:goals-weekly-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'goals' },
        (payload: any) => {
          console.log('🔄 Evento Realtime recebido na tabela goals (WeeklyRankView):', payload);
          loadData();
        }
      )
      .subscribe();

    const salesChannel = supabase
      .channel('public:sales-weekly-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sales' },
        (payload: any) => {
          console.log('🔄 Evento Realtime recebido na tabela sales (WeeklyRankView):', payload);
          loadData();
        }
      )
      .subscribe();

    return () => {
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

  // Filter sales within the current week
  const weeklySales = useMemo(() => {
    return salesToUse.filter(sale => {
      // 3. Remoção de Filtros Errados: NÃO ocultar vendas com status 'Em Análise' nem filtros arbitrários
      const saleDateStr = getSaleDateBr(sale);
      const parsed = parseDate(saleDateStr);

      const createdAtDate = sale.created_at ? new Date(sale.created_at) : null;
      const isCreatedAtInWeek = createdAtDate && !isNaN(createdAtDate.getTime())
        ? createdAtDate >= weekRange.start && createdAtDate <= weekRange.end
        : false;

      const isSaleDateInWeek = parsed
        ? parsed >= weekRange.start && parsed <= weekRange.end
        : false;

      if (!parsed && !isCreatedAtInWeek) return true; // Include if date parsing is ambiguous to prevent loss
      return isSaleDateInWeek || isCreatedAtInWeek;
    });
  }, [salesToUse, weekRange]);

  // Build weekly leaderboard joined with public.goals
  const leaderboard = useMemo<WeeklyLeaderboardEntry[]>(() => {
    // Include active consultants (or profiles with role seller/admin who have sales)
    const consultantProfiles = profiles.filter(p => p.status !== 'inactive');

    const result: WeeklyLeaderboardEntry[] = consultantProfiles.map(consultant => {
      const sName = (consultant.name || '').trim().toLowerCase();
      
      const consultantSales = weeklySales.filter(s => {
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
      const targetTotal = userGoal?.target_total ?? (targetGrad + targetPos + targetTec);
      const hasTarget = targetTotal > 0;

      // Formula: (Total de Vendas / Meta Total) * 100 e Graduação isolada
      // Tratamento de Meta Zero: 0% sem quebrar ou dividir por zero
      const percentageReached = targetTotal > 0 ? Math.round((totalCount / targetTotal) * 100) : 0;
      const percentageGraduacao = targetGrad > 0 ? Math.round((graduacaoCount / targetGrad) * 100) : 0;
      const percentagePos = targetPos > 0 ? Math.round((posCount / targetPos) * 100) : 0;
      const percentageTecnico = targetTec > 0 ? Math.round((tecnicoCount / targetTec) * 100) : 0;

      return {
        seller_id: consultant.id,
        name: consultant.name,
        email: consultant.email,
        avatar_url: consultant.avatar_url,
        total_sales: totalCount,
        target: targetTotal,
        target_graduacao: targetGrad,
        target_pos: targetPos,
        target_tecnico: targetTec,
        target_total: targetTotal,
        percentage_reached: percentageReached,
        percentage_graduacao: percentageGraduacao,
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
  }, [profiles, weeklySales, goalsMap]);

  const topThree = leaderboard.slice(0, 3);

  // Total metrics of the week
  const totalWeeklySales = weeklySales.length;
  const totalWeeklyGoals: number = (Object.values(goalsMap) as UserGoalData[]).reduce((acc: number, val: UserGoalData) => acc + (Number(val.target_total) || 0), 0);
  const overallWeekPercentage = totalWeeklyGoals > 0 
    ? Math.round((totalWeeklySales / totalWeeklyGoals) * 100) 
    : 0;

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 border border-amber-200/80 flex items-center justify-center shadow-2xs">
              <Trophy className="w-4 h-4" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 font-['Space_Grotesk'] tracking-tight">
              Ranking Semanal da Equipe
            </h2>
            <span className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1">
              <CalendarRange className="w-3 h-3" />
              {weekRange.label}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Classificação oficial e progresso das metas individuais e coletivas definidas para a semana vigente.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            disabled={isLoading}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
            title="Atualizar ranking e metas"
          >
            <RotateCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold">
            <Flame className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
            <span>Classificação por Boletos</span>
          </div>
        </div>
      </div>

      {/* Summary Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <span className="text-xs text-slate-500 font-medium">Boletos Confirmados na Semana</span>
          <div className="text-2xl font-black text-slate-900 font-['Space_Grotesk'] mt-1">
            {totalWeeklySales} <span className="text-xs font-semibold text-slate-500">vendas</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <span className="text-xs text-slate-500 font-medium">Meta Semanal Coletiva (public.goals)</span>
          <div className="text-2xl font-black text-blue-700 font-['Space_Grotesk'] mt-1">
            {totalWeeklyGoals > 0 ? `${totalWeeklyGoals} vendas` : 'A definir'}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <span className="text-xs text-slate-500 font-medium">Atingimento da Equipe</span>
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

              {/* Goal Progress Card: Flagship Graduação na barra de progresso */}
              <div className="w-full mt-3 p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-left space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700">Meta Graduação (Principal):</span>
                  {topThree[1].target_graduacao > 0 ? (
                    <span className={`font-black ${
                      topThree[1].percentage_graduacao >= 100 ? 'text-emerald-700 font-extrabold' : 'text-emerald-600'
                    }`}>
                      {topThree[1].percentage_graduacao}%
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-400 italic">Sem meta</span>
                  )}
                </div>

                {topThree[1].target_graduacao > 0 ? (
                  <>
                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all duration-300 bg-gradient-to-r from-orange-500 via-amber-500 to-emerald-500 bg-no-repeat"
                        style={{ 
                          width: `${Math.min(topThree[1].percentage_graduacao, 100)}%`,
                          backgroundSize: topThree[1].percentage_graduacao > 0 
                            ? `${(100 / Math.min(topThree[1].percentage_graduacao, 100)) * 100}% 100%` 
                            : '100% 100%'
                        }}
                      />
                    </div>
                    <div className="text-[11px] text-slate-500 text-right font-medium">
                      {topThree[1].graduacao_count}/{topThree[1].target_graduacao} boletos graduação
                    </div>
                  </>
                ) : (
                  <div className="text-[11px] text-slate-400">Meta de graduação não definida</div>
                )}
              </div>

              {/* Product breakdown (Pós e Técnico visíveis em formato textual/resumido) */}
              <div className="w-full flex items-center justify-between text-xs text-slate-600 mt-3 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                <span>Grad: <strong className="text-slate-900">{topThree[1].graduacao_count}/{topThree[1].target_graduacao > 0 ? topThree[1].target_graduacao : 0}</strong></span>
                <span>•</span>
                <span>Pós: <strong className="text-purple-700">{topThree[1].pos_count}/{topThree[1].target_pos > 0 ? topThree[1].target_pos : 0}</strong></span>
                <span>•</span>
                <span>Téc: <strong className="text-amber-700">{topThree[1].tecnico_count}/{topThree[1].target_tecnico > 0 ? topThree[1].target_tecnico : 0}</strong></span>
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

              {/* Goal Progress Card: Flagship Graduação na barra de progresso */}
              <div className="w-full mt-3 p-3 rounded-xl bg-amber-50/60 border border-amber-200/80 text-left space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800">Meta Graduação (Principal):</span>
                  {topThree[0].target_graduacao > 0 ? (
                    <span className={`font-black text-sm ${
                      topThree[0].percentage_graduacao >= 100 ? 'text-emerald-700 font-extrabold' : 'text-emerald-600'
                    }`}>
                      {topThree[0].percentage_graduacao}%
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-400 italic">Sem meta</span>
                  )}
                </div>

                {topThree[0].target_graduacao > 0 ? (
                  <>
                    <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all duration-300 bg-gradient-to-r from-orange-500 via-amber-500 to-emerald-500 bg-no-repeat"
                        style={{ 
                          width: `${Math.min(topThree[0].percentage_graduacao, 100)}%`,
                          backgroundSize: topThree[0].percentage_graduacao > 0 
                            ? `${(100 / Math.min(topThree[0].percentage_graduacao, 100)) * 100}% 100%` 
                            : '100% 100%'
                        }}
                      />
                    </div>
                    <div className="text-[11px] text-slate-600 text-right font-semibold">
                      {topThree[0].graduacao_count}/{topThree[0].target_graduacao} boletos graduação
                    </div>
                  </>
                ) : (
                  <div className="text-[11px] text-slate-400">Meta de graduação não definida</div>
                )}
              </div>

              {/* Product breakdown (Pós e Técnico visíveis em formato textual/resumido) */}
              <div className="w-full flex items-center justify-between text-xs text-slate-700 mt-3 bg-amber-50/70 px-3.5 py-1.5 rounded-lg border border-amber-200/70">
                <span>Graduação: <strong className="text-slate-900">{topThree[0].graduacao_count}/{topThree[0].target_graduacao > 0 ? topThree[0].target_graduacao : 0}</strong></span>
                <span>•</span>
                <span>Pós: <strong className="text-purple-700">{topThree[0].pos_count}/{topThree[0].target_pos > 0 ? topThree[0].target_pos : 0}</strong></span>
                <span>•</span>
                <span>Técnico: <strong className="text-amber-700">{topThree[0].tecnico_count}/{topThree[0].target_tecnico > 0 ? topThree[0].target_tecnico : 0}</strong></span>
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

              {/* Goal Progress Card: Flagship Graduação na barra de progresso */}
              <div className="w-full mt-3 p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-left space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700">Meta Graduação (Principal):</span>
                  {topThree[2].target_graduacao > 0 ? (
                    <span className={`font-black ${
                      topThree[2].percentage_graduacao >= 100 ? 'text-emerald-700 font-extrabold' : 'text-emerald-600'
                    }`}>
                      {topThree[2].percentage_graduacao}%
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-400 italic">Sem meta</span>
                  )}
                </div>

                {topThree[2].target_graduacao > 0 ? (
                  <>
                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all duration-300 bg-gradient-to-r from-orange-500 via-amber-500 to-emerald-500 bg-no-repeat"
                        style={{ 
                          width: `${Math.min(topThree[2].percentage_graduacao, 100)}%`,
                          backgroundSize: topThree[2].percentage_graduacao > 0 
                            ? `${(100 / Math.min(topThree[2].percentage_graduacao, 100)) * 100}% 100%` 
                            : '100% 100%'
                        }}
                      />
                    </div>
                    <div className="text-[11px] text-slate-500 text-right font-medium">
                      {topThree[2].graduacao_count}/{topThree[2].target_graduacao} boletos graduação
                    </div>
                  </>
                ) : (
                  <div className="text-[11px] text-slate-400">Meta de graduação não definida</div>
                )}
              </div>

              {/* Product breakdown (Pós e Técnico visíveis em formato textual/resumido) */}
              <div className="w-full flex items-center justify-between text-xs text-slate-600 mt-3 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                <span>Grad: <strong className="text-slate-900">{topThree[2].graduacao_count}/{topThree[2].target_graduacao > 0 ? topThree[2].target_graduacao : 0}</strong></span>
                <span>•</span>
                <span>Pós: <strong className="text-purple-700">{topThree[2].pos_count}/{topThree[2].target_pos > 0 ? topThree[2].target_pos : 0}</strong></span>
                <span>•</span>
                <span>Téc: <strong className="text-amber-700">{topThree[2].tecnico_count}/{topThree[2].target_tecnico > 0 ? topThree[2].target_tecnico : 0}</strong></span>
              </div>
            </div>
          )}

        </div>
      )}

      {/* Leaderboard Full Table */}
      <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-xs">
        <div className="px-6 py-4 bg-slate-50/75 border-b border-slate-200 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Tabela Geral de Classificação Semanal
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
                <th className="py-3 px-4 font-bold text-slate-900">Total Boletos</th>
                <th className="py-3 px-4 hidden sm:table-cell min-w-[130px]">Graduação</th>
                <th className="py-3 px-4 hidden sm:table-cell min-w-[130px]">Pós-Graduação</th>
                <th className="py-3 px-4 hidden sm:table-cell min-w-[130px]">Técnico</th>
                <th className="py-3 px-4 sm:px-6 text-right min-w-[180px]">Progresso da Meta</th>
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

                    {/* Graduação: Indicador Duplo (fração + mini barra) */}
                    <td className="py-3.5 px-4 hidden sm:table-cell">
                      <div className="space-y-1">
                        <div className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                          <span className="font-bold text-slate-900">{seller.graduacao_count}</span>
                          <span className="text-slate-400 font-medium">/{seller.target_graduacao > 0 ? seller.target_graduacao : 0}</span>
                          {seller.target_graduacao > 0 && (
                            <span className="text-[10px] text-blue-600 font-bold ml-0.5">
                              ({seller.percentage_graduacao}%)
                            </span>
                          )}
                        </div>
                        <div className="w-16 sm:w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-600 rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(seller.percentage_graduacao, 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Pós-Graduação: Indicador Duplo (fração + mini barra) */}
                    <td className="py-3.5 px-4 hidden sm:table-cell">
                      <div className="space-y-1">
                        <div className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                          <span className="font-bold text-slate-900">{seller.pos_count}</span>
                          <span className="text-slate-400 font-medium">/{seller.target_pos > 0 ? seller.target_pos : 0}</span>
                          {seller.target_pos > 0 && (
                            <span className="text-[10px] text-purple-600 font-bold ml-0.5">
                              ({seller.percentage_pos}%)
                            </span>
                          )}
                        </div>
                        <div className="w-16 sm:w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-purple-600 rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(seller.percentage_pos, 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Técnico: Indicador Duplo (fração + mini barra) */}
                    <td className="py-3.5 px-4 hidden sm:table-cell">
                      <div className="space-y-1">
                        <div className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                          <span className="font-bold text-slate-900">{seller.tecnico_count}</span>
                          <span className="text-slate-400 font-medium">/{seller.target_tecnico > 0 ? seller.target_tecnico : 0}</span>
                          {seller.target_tecnico > 0 && (
                            <span className="text-[10px] text-amber-600 font-bold ml-0.5">
                              ({seller.percentage_tecnico}%)
                            </span>
                          )}
                        </div>
                        <div className="w-16 sm:w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-amber-500 rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(seller.percentage_tecnico, 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* PROGRESSO DA META: Grande Consolidador Geral (Total / target_total) com barra maior */}
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
                              ({seller.total_sales}/{seller.target_total} total)
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
                            0% ({seller.total_sales}/0 total)
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
