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

interface WeeklyLeaderboardEntry {
  seller_id: string;
  name: string;
  email: string;
  avatar_url?: string;
  total_sales: number;
  target: number;
  percentage_reached: number;
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
    return new Date(y, m - 1, d);
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const [y, m, d] = trimmed.slice(0, 10).split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  const parsed = new Date(trimmed);
  return isNaN(parsed.getTime()) ? null : parsed;
}

export const WeeklyRankView: React.FC = () => {
  const { sales: contextSales } = useSales();
  const { profiles, currentUser } = useAuth();

  const [isLoading, setIsLoading] = useState(false);
  const [goalsMap, setGoalsMap] = useState<Record<string, number>>({});
  const [remoteSales, setRemoteSales] = useState<Sale[] | null>(null);

  // Current week boundaries (Monday to Sunday)
  const weekRange = useMemo(() => {
    const now = new Date();
    const day = now.getDay();
    const diffToMonday = (day === 0 ? -6 : 1) - day;
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday, 0, 0, 0);
    const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6, 23, 59, 59);

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
        .eq('type', 'semanal');

      const localGoals = LocalSyncEngine.getGoals();
      const newGoalsMap: Record<string, number> = {};

      // Seed from local sync engine
      if (localGoals && localGoals.length > 0) {
        localGoals.forEach(g => {
          if (g.type === 'semanal') {
            newGoalsMap[g.user_id] = Number(g.target_value) || 0;
          }
        });
      }

      // Overwrite with Supabase public.goals
      if (!goalsError && goalsData && goalsData.length > 0) {
        goalsData.forEach((g: any) => {
          if (g.user_id) {
            newGoalsMap[g.user_id] = Number(g.target_value) || 0;
          }
        });
      }
      setGoalsMap(newGoalsMap);

      // Query latest sales from Supabase
      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select('*');

      if (!salesError && salesData) {
        setRemoteSales(salesData as Sale[]);
      }
    } catch (err) {
      console.error('Erro ao carregar dados do ranking semanal:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Use remote sales if available, otherwise context sales
  const salesToUse = useMemo(() => {
    return remoteSales || contextSales;
  }, [remoteSales, contextSales]);

  // Filter sales within the current week
  const weeklySales = useMemo(() => {
    return salesToUse.filter(sale => {
      if (sale.status === 'Em Análise') return false;
      const saleDateStr = getSaleDateBr(sale);
      const parsed = parseDate(saleDateStr);
      if (!parsed) return true; // Include if date parsing is ambiguous to prevent loss
      return parsed >= weekRange.start && parsed <= weekRange.end;
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

      // 2. Goal calculation: fetch from goalsMap
      const rawTarget = goalsMap[consultant.id];
      const target = rawTarget !== undefined && rawTarget > 0 ? rawTarget : 0;
      const hasTarget = target > 0;

      // Formula: (Total de Vendas / Meta Definida) * 100
      // Tratamento de Meta Zero: 0% sem quebrar
      const percentageReached = hasTarget ? Math.round((totalCount / target) * 100) : 0;

      return {
        seller_id: consultant.id,
        name: consultant.name,
        email: consultant.email,
        avatar_url: consultant.avatar_url,
        total_sales: totalCount,
        target,
        percentage_reached: percentageReached,
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
  const totalWeeklyGoals: number = (Object.values(goalsMap) as number[]).reduce((acc: number, val: number) => acc + (Number(val) || 0), 0);
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

      {/* Top 3 Podium Visual Cards com Progresso da Meta Integrado */}
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

              {/* Goal Progress Card */}
              <div className="w-full mt-3 p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-left space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700">Progresso da Meta:</span>
                  {topThree[1].has_target ? (
                    <span className="font-black text-emerald-600">
                      {topThree[1].percentage_reached}%
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-400 italic">Sem meta</span>
                  )}
                </div>

                {topThree[1].has_target ? (
                  <>
                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(topThree[1].percentage_reached, 100)}%` }}
                      />
                    </div>
                    <div className="text-[11px] text-slate-500 text-right font-medium">
                      {topThree[1].total_sales}/{topThree[1].target} boletos
                    </div>
                  </>
                ) : (
                  <div className="text-[11px] text-slate-400">Meta não cadastrada no painel</div>
                )}
              </div>

              {/* Product breakdown */}
              <div className="flex items-center gap-1.5 text-xs text-slate-600 mt-3 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                <span>Grad: <strong className="text-slate-800">{topThree[1].graduacao_count}</strong></span>
                <span>•</span>
                <span>Pós: <strong className="text-slate-800">{topThree[1].pos_count}</strong></span>
                <span>•</span>
                <span>Téc: <strong className="text-slate-800">{topThree[1].tecnico_count}</strong></span>
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

              {/* Goal Progress Card */}
              <div className="w-full mt-3 p-3 rounded-xl bg-amber-50/60 border border-amber-200/80 text-left space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800">Progresso da Meta:</span>
                  {topThree[0].has_target ? (
                    <span className="font-black text-emerald-700 text-sm">
                      {topThree[0].percentage_reached}%
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-400 italic">Sem meta</span>
                  )}
                </div>

                {topThree[0].has_target ? (
                  <>
                    <div className="w-full h-2.5 bg-amber-200/80 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(topThree[0].percentage_reached, 100)}%` }}
                      />
                    </div>
                    <div className="text-[11px] text-slate-600 text-right font-semibold">
                      {topThree[0].total_sales}/{topThree[0].target} boletos
                    </div>
                  </>
                ) : (
                  <div className="text-[11px] text-slate-400">Meta não cadastrada no painel</div>
                )}
              </div>

              {/* Product breakdown */}
              <div className="flex items-center gap-2 text-xs text-slate-700 mt-3 bg-amber-50/70 px-3.5 py-1.5 rounded-lg border border-amber-200/70">
                <span>Graduação: <strong className="text-slate-900">{topThree[0].graduacao_count}</strong></span>
                <span>•</span>
                <span>Pós: <strong className="text-slate-900">{topThree[0].pos_count}</strong></span>
                <span>•</span>
                <span>Técnico: <strong className="text-slate-900">{topThree[0].tecnico_count}</strong></span>
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

              {/* Goal Progress Card */}
              <div className="w-full mt-3 p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-left space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700">Progresso da Meta:</span>
                  {topThree[2].has_target ? (
                    <span className="font-black text-emerald-600">
                      {topThree[2].percentage_reached}%
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-400 italic">Sem meta</span>
                  )}
                </div>

                {topThree[2].has_target ? (
                  <>
                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(topThree[2].percentage_reached, 100)}%` }}
                      />
                    </div>
                    <div className="text-[11px] text-slate-500 text-right font-medium">
                      {topThree[2].total_sales}/{topThree[2].target} boletos
                    </div>
                  </>
                ) : (
                  <div className="text-[11px] text-slate-400">Meta não cadastrada no painel</div>
                )}
              </div>

              {/* Product breakdown */}
              <div className="flex items-center gap-1.5 text-xs text-slate-600 mt-3 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                <span>Grad: <strong className="text-slate-800">{topThree[2].graduacao_count}</strong></span>
                <span>•</span>
                <span>Pós: <strong className="text-slate-800">{topThree[2].pos_count}</strong></span>
                <span>•</span>
                <span>Téc: <strong className="text-slate-800">{topThree[2].tecnico_count}</strong></span>
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
                <th className="py-3 px-4 hidden sm:table-cell">Graduação</th>
                <th className="py-3 px-4 hidden sm:table-cell">Pós-Graduação</th>
                <th className="py-3 px-4 hidden sm:table-cell">Técnico</th>
                <th className="py-3 px-4 sm:px-6 text-right">Progresso da Meta</th>
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
                          <span className="w-6 h-6 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center font-black text-xs shadow-xs">
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

                    {/* Graduação */}
                    <td className="py-3.5 px-4 hidden sm:table-cell text-slate-700 font-semibold">
                      {seller.graduacao_count}
                    </td>

                    {/* Pós */}
                    <td className="py-3.5 px-4 hidden sm:table-cell text-slate-700 font-semibold">
                      {seller.pos_count}
                    </td>

                    {/* Técnico */}
                    <td className="py-3.5 px-4 hidden sm:table-cell text-slate-700 font-semibold">
                      {seller.tecnico_count}
                    </td>

                    {/* PROGRESSO DA META: Barra preenchida, % e proporção numérica */}
                    <td className="py-3.5 px-4 sm:px-6 text-right">
                      {seller.has_target ? (
                        <div className="inline-block space-y-1 text-right">
                          <div className="flex items-center justify-end gap-2 text-[11px]">
                            <span className={`font-bold ${
                              seller.percentage_reached >= 100 ? 'text-emerald-700 font-extrabold' : 'text-emerald-600'
                            }`}>
                              {seller.percentage_reached}%
                            </span>
                            <span className="text-slate-500 font-medium">
                              ({seller.total_sales}/{seller.target} boletos)
                            </span>
                          </div>
                          <div className="w-28 sm:w-36 h-2 bg-slate-100 rounded-full overflow-hidden ml-auto">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                seller.percentage_reached >= 100
                                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                                  : 'bg-gradient-to-r from-blue-500 to-emerald-500'
                              }`}
                              style={{ width: `${Math.min(seller.percentage_reached, 100)}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="text-right">
                          <span className="text-xs text-slate-400 italic">
                            0% (Sem meta)
                          </span>
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
