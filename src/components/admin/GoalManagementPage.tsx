import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase, LocalSyncEngine } from '../../lib/supabase';
import { Goal, GoalType } from '../../types';
import { 
  Target, 
  Calendar, 
  CalendarDays, 
  CalendarRange, 
  Save, 
  RotateCw, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  Users, 
  TrendingUp, 
  ArrowLeft,
  Sparkles,
  SlidersHorizontal,
  FileSpreadsheet,
  Check
} from 'lucide-react';

interface GoalManagementPageProps {
  onBackToPlanner?: () => void;
}

const MONTHS = [
  { value: 1, label: 'Janeiro' },
  { value: 2, label: 'Fevereiro' },
  { value: 3, label: 'Março' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Maio' },
  { value: 6, label: 'Junho' },
  { value: 7, label: 'Julho' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Setembro' },
  { value: 10, label: 'Outubro' },
  { value: 11, label: 'Novembro' },
  { value: 12, label: 'Dezembro' },
];

const YEARS = [2025, 2026, 2027, 2028];

export interface ConsultantGoalValues {
  id?: string;
  target_graduacao: number;
  target_pos: number;
  target_tecnico: number;
  target_total: number;
}

export const GoalManagementPage: React.FC<GoalManagementPageProps> = ({ onBackToPlanner }) => {
  const { profiles, refreshProfiles } = useAuth();
  
  // Date and filter states
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(currentDate.getFullYear());
  const [goalType, setGoalType] = useState<GoalType>('mensal');
  const [searchTerm, setSearchTerm] = useState('');

  // Goals state: map of user_id -> 3 product targets + target_total
  const [goalsValues, setGoalsValues] = useState<Record<string, ConsultantGoalValues>>({});
  // Baseline saved goals for dirty detection: map of user_id -> saved target_value
  const [savedGoalsMap, setSavedGoalsMap] = useState<Record<string, ConsultantGoalValues>>({});
  
  // UI states
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkGrad, setBulkGrad] = useState<number>(goalType === 'mensal' ? 20 : 5);
  const [bulkPos, setBulkPos] = useState<number>(goalType === 'mensal' ? 5 : 2);
  const [bulkTec, setBulkTec] = useState<number>(goalType === 'mensal' ? 5 : 1);

  // Filter only active consultants/profiles
  const activeConsultants = useMemo(() => {
    return profiles.filter(p => {
      if (p.status === 'inactive') return false;
      return true;
    });
  }, [profiles]);

  // Filtered by search term
  const displayedConsultants = useMemo(() => {
    if (!searchTerm.trim()) return activeConsultants;
    const term = searchTerm.toLowerCase();
    return activeConsultants.filter(c => 
      c.name?.toLowerCase().includes(term) || 
      c.email?.toLowerCase().includes(term)
    );
  }, [activeConsultants, searchTerm]);

  // Helper to determine initial goal volume for consultant
  const getInitialDefaultGoal = useCallback((consultantTargetMonthly?: number, type: GoalType = goalType): ConsultantGoalValues => {
    if (type === 'mensal') {
      if (consultantTargetMonthly && consultantTargetMonthly > 0 && consultantTargetMonthly < 1000) {
        const tot = Math.round(consultantTargetMonthly);
        const grad = Math.max(0, Math.round(tot * 0.7));
        const pos = Math.max(0, Math.round(tot * 0.2));
        const tec = Math.max(0, tot - grad - pos);
        return {
          target_graduacao: grad,
          target_pos: pos,
          target_tecnico: tec,
          target_total: tot
        };
      }
      return {
        target_graduacao: 20,
        target_pos: 5,
        target_tecnico: 5,
        target_total: 30
      };
    }
    return {
      target_graduacao: 5,
      target_pos: 2,
      target_tecnico: 1,
      target_total: 8
    };
  }, [goalType]);

  // Parse helper for database records
  const parseGoalRecord = useCallback((g: any): ConsultantGoalValues => {
    const rawTotal = g.target_total !== undefined && g.target_total !== null
      ? Number(g.target_total)
      : (Number(g.target_value) || 0);

    const rawGrad = g.target_graduacao !== undefined && g.target_graduacao !== null
      ? Number(g.target_graduacao)
      : (g.target_pos || g.target_tecnico ? 0 : rawTotal);

    const rawPos = Number(g.target_pos) || 0;
    const rawTec = Number(g.target_tecnico) || 0;

    const grad = Math.max(0, Math.round(rawGrad));
    const pos = Math.max(0, Math.round(rawPos));
    const tec = Math.max(0, Math.round(rawTec));
    const tot = (grad + pos + tec > 0) ? (grad + pos + tec) : Math.max(0, Math.round(rawTotal));

    return {
      id: g.id,
      target_graduacao: grad,
      target_pos: pos,
      target_tecnico: tec,
      target_total: tot
    };
  }, []);

  // Load goals from Supabase and LocalSyncEngine for the selected period & type
  const loadGoals = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. Check existing records in Supabase public.goals table
      const typesToMatch = goalType === 'mensal' ? ['mensal', 'month'] : ['semanal', 'week'];
      const { data: remoteGoals, error } = await supabase
        .from('goals')
        .select('*')
        .in('type', typesToMatch);

      // 2. Check local fallback goals
      const localGoals = LocalSyncEngine.getGoals();

      const newSavedMap: Record<string, ConsultantGoalValues> = {};
      const newValuesMap: Record<string, ConsultantGoalValues> = {};

      // Seed with default quantity based on active consultants
      activeConsultants.forEach(c => {
        const defaultGoal = getInitialDefaultGoal(c.target_monthly, goalType);
        newSavedMap[c.id] = { ...defaultGoal };
        newValuesMap[c.id] = { ...defaultGoal };
      });

      // Merge local fallback if available
      if (localGoals && localGoals.length > 0) {
        localGoals.forEach(g => {
          if (g.type === goalType || typesToMatch.includes(g.type)) {
            const parsed = parseGoalRecord(g);
            newSavedMap[g.user_id] = parsed;
            newValuesMap[g.user_id] = { ...parsed };
          }
        });
      }

      // Overwrite with Supabase records if available
      if (!error && remoteGoals && remoteGoals.length > 0) {
        remoteGoals.forEach((g: any) => {
          if (g.user_id) {
            const parsed = parseGoalRecord(g);
            newSavedMap[g.user_id] = parsed;
            newValuesMap[g.user_id] = { ...parsed };
          }
        });
      }

      setSavedGoalsMap(newSavedMap);
      setGoalsValues(newValuesMap);
    } catch (err) {
      console.error('Erro ao carregar metas de vendas:', err);
    } finally {
      setIsLoading(false);
    }
  }, [goalType, activeConsultants, getInitialDefaultGoal, parseGoalRecord]);

  // Reload whenever goalType, month, or activeConsultants change, and subscribe to Realtime
  useEffect(() => {
    loadGoals();
    setBulkGrad(goalType === 'mensal' ? 20 : 5);
    setBulkPos(goalType === 'mensal' ? 5 : 2);
    setBulkTec(goalType === 'mensal' ? 5 : 1);

    // Inscrição Realtime no canal do Supabase para a tabela 'goals'
    const channel = supabase
      .channel('public:goals')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'goals' },
        (payload: any) => {
          console.log('🔄 Evento Realtime recebido na tabela goals (GoalManagementPage):', payload);
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT' || payload.eventType === 'DELETE' || !payload.eventType) {
            loadGoals();
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [goalType, selectedMonth, selectedYear, activeConsultants.length, loadGoals]);

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Handle target value changes for a specific user and product
  // Automatically updates target_total = target_graduacao + target_pos + target_tecnico
  const handleProductValueChange = (userId: string, field: 'target_graduacao' | 'target_pos' | 'target_tecnico', value: number) => {
    const intVal = Math.max(0, Math.round(value));
    setGoalsValues(prev => {
      const current = prev[userId] || getInitialDefaultGoal(undefined, goalType);
      const updated = {
        ...current,
        [field]: intVal
      };
      // Soma automática dos 3 produtos
      updated.target_total = updated.target_graduacao + updated.target_pos + updated.target_tecnico;
      return {
        ...prev,
        [userId]: updated
      };
    });
  };

  // Check if any consultant has modified goal
  const hasUnsavedChanges = useMemo(() => {
    return activeConsultants.some(c => {
      const current = goalsValues[c.id];
      const saved = savedGoalsMap[c.id];
      if (!current || !saved) return false;
      return (
        current.target_graduacao !== saved.target_graduacao ||
        current.target_pos !== saved.target_pos ||
        current.target_tecnico !== saved.target_tecnico ||
        current.target_total !== saved.target_total
      );
    });
  }, [activeConsultants, goalsValues, savedGoalsMap]);

  // Calculate team aggregates (pure volume of sales/boletos)
  const teamMetrics = useMemo(() => {
    let totalTarget = 0;
    let totalSaved = 0;
    let totalGraduacao = 0;
    let totalPos = 0;
    let totalTecnico = 0;

    activeConsultants.forEach(c => {
      const val = goalsValues[c.id];
      const savedVal = savedGoalsMap[c.id];
      if (val) {
        totalTarget += val.target_total;
        totalGraduacao += val.target_graduacao;
        totalPos += val.target_pos;
        totalTecnico += val.target_tecnico;
      }
      if (savedVal) {
        totalSaved += savedVal.target_total;
      }
    });

    const averageTarget = activeConsultants.length > 0 
      ? Math.round(totalTarget / activeConsultants.length) 
      : 0;

    const diff = totalTarget - totalSaved;

    return {
      totalTarget,
      totalSaved,
      totalGraduacao,
      totalPos,
      totalTecnico,
      averageTarget,
      diff,
      consultantCount: activeConsultants.length
    };
  }, [activeConsultants, goalsValues, savedGoalsMap]);

  // Save metas with batch upsert on public.goals (saving 4 columns: target_graduacao, target_pos, target_tecnico, target_total)
  const handleSaveGoals = async () => {
    setIsSaving(true);
    setToast(null);

    try {
      // 3. Use os filtros de 'Mês' e 'Ano' atualmente selecionados na interface para calcular o primeiro dia do mês (reference_start) e o último dia do mês (reference_end)
      const monthPadded = String(selectedMonth).padStart(2, '0');
      const startDayStr = '01';
      const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
      const lastDayPadded = String(lastDay).padStart(2, '0');
      const referenceStart = `${selectedYear}-${monthPadded}-${startDayStr}`;
      const referenceEnd = `${selectedYear}-${monthPadded}-${lastDayPadded}`;

      // Tratamento (de-para) rigoroso para satisfazer a check constraint 'goals_type_check':
      const apiType: 'month' | 'week' = goalType === 'mensal' ? 'month' : 'week';

      // Build batch upsert payload for public.goals with all 4 product columns
      const batchPayload = activeConsultants.map(c => {
        const existing = savedGoalsMap[c.id];
        const userGoal = goalsValues[c.id] || getInitialDefaultGoal(c.target_monthly, goalType);
        const targetGraduacao = Math.max(0, Math.round(userGoal.target_graduacao));
        const targetPos = Math.max(0, Math.round(userGoal.target_pos));
        const targetTecnico = Math.max(0, Math.round(userGoal.target_tecnico));
        const targetTotal = targetGraduacao + targetPos + targetTecnico;
        
        return {
          id: existing?.id || crypto.randomUUID(),
          user_id: c.id,
          type: apiType, // estritamente 'month' ou 'week'
          target_value: targetTotal, // retrocompatibilidade
          target_graduacao: targetGraduacao,
          target_pos: targetPos,
          target_tecnico: targetTecnico,
          target_total: targetTotal,
          reference_start: referenceStart,
          reference_end: referenceEnd,
          updated_at: new Date().toISOString(),
        };
      });

      console.log('🚀 [Supabase DB] Upsert em lote de metas por produto na tabela public.goals:', batchPayload);

      // 1. Batch upsert directly to Supabase public.goals table
      const { error: upsertError } = await supabase
        .from('goals')
        .upsert(batchPayload, { onConflict: 'id' });

      if (upsertError) {
        console.error('❌ [Supabase DB] Erro no upsert de metas:', upsertError);
        throw upsertError;
      }

      // 2. Persist locally in LocalSyncEngine for instantaneous fallback & offline resilience
      const currentLocalGoals = LocalSyncEngine.getGoals();
      const updatedLocalGoals: Goal[] = [...currentLocalGoals];

      batchPayload.forEach(item => {
        const idx = updatedLocalGoals.findIndex(g => g.user_id === item.user_id && (g.type === item.type || (item.type === 'month' && g.type === 'mensal') || (item.type === 'week' && g.type === 'semanal')));
        const goalRecord: Goal = {
          id: item.id,
          user_id: item.user_id,
          type: item.type as GoalType,
          target_value: item.target_total,
          target_graduacao: item.target_graduacao,
          target_pos: item.target_pos,
          target_tecnico: item.target_tecnico,
          target_total: item.target_total,
          reference_start: item.reference_start,
          reference_end: item.reference_end,
          updated_at: item.updated_at,
          month: selectedMonth,
          year: selectedYear,
        };
        if (idx >= 0) {
          updatedLocalGoals[idx] = goalRecord;
        } else {
          updatedLocalGoals.push(goalRecord);
        }
      });
      LocalSyncEngine.saveGoals(updatedLocalGoals);

      // 3. If monthly, also sync target_monthly on public.profiles and LocalSyncEngine profiles as sales count
      if (goalType === 'mensal') {
        for (const item of batchPayload) {
          try {
            await supabase
              .from('profiles')
              .update({ target_monthly: item.target_total })
              .eq('id', item.user_id);
          } catch (e) {
            console.warn('Sync profile target error:', e);
          }
        }
        await refreshProfiles();
      }

      // Update baseline map
      const updatedSavedMap: Record<string, ConsultantGoalValues> = {};
      batchPayload.forEach(item => {
        updatedSavedMap[item.user_id] = {
          id: item.id,
          target_graduacao: item.target_graduacao,
          target_pos: item.target_pos,
          target_tecnico: item.target_tecnico,
          target_total: item.target_total
        };
      });
      setSavedGoalsMap(updatedSavedMap);

      setToast({
        type: 'success',
        message: `Metas por produto (${goalType.toUpperCase()}) salvas com sucesso! Total da equipe: ${teamMetrics.totalTarget} vendas.`
      });
    } catch (err: any) {
      console.error('💥 Erro ao salvar metas de vendas:', err);
      setToast({
        type: 'error',
        message: err?.message ? `Erro ao salvar metas: ${err.message}` : 'Ocorreu um erro ao processar o salvamento das metas. Tente novamente.'
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Bulk set all consultants with specific product goals
  const handleApplyBulkGoal = (grad: number, pos: number, tec: number) => {
    const safeGrad = Math.max(0, Math.round(grad));
    const safePos = Math.max(0, Math.round(pos));
    const safeTec = Math.max(0, Math.round(tec));
    const safeTotal = safeGrad + safePos + safeTec;

    const updated: Record<string, ConsultantGoalValues> = {};
    activeConsultants.forEach(c => {
      const existingId = savedGoalsMap[c.id]?.id;
      updated[c.id] = {
        id: existingId,
        target_graduacao: safeGrad,
        target_pos: safePos,
        target_tecnico: safeTec,
        target_total: safeTotal
      };
    });
    setGoalsValues(prev => ({ ...prev, ...updated }));
    setBulkModalOpen(false);
    setToast({
      type: 'info',
      message: `Meta de ${safeTotal} vendas (Grad: ${safeGrad}, Pós: ${safePos}, Téc: ${safeTec}) aplicada a todos os consultores.`
    });
  };

  // Quick reset to saved values
  const handleResetToSaved = () => {
    const reverted: Record<string, ConsultantGoalValues> = {};
    activeConsultants.forEach(c => {
      reverted[c.id] = savedGoalsMap[c.id] ?? getInitialDefaultGoal(c.target_monthly, goalType);
    });
    setGoalsValues(reverted);
    setToast({
      type: 'info',
      message: 'Valores redefinidos para os registros salvos anteriormente.'
    });
  };

  const selectedMonthObj = MONTHS.find(m => m.value === selectedMonth);

  return (
    <div className="space-y-6">
      
      {/* Toast notification */}
      {toast && (
        <div 
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-xs font-semibold animate-in slide-in-from-bottom-5 duration-200 ${
            toast.type === 'success' 
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
              : toast.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-800'
              : 'bg-blue-50 border-blue-200 text-blue-800'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* 1. TOP HEADER BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          {onBackToPlanner && (
            <button
              onClick={onBackToPlanner}
              className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer border border-gray-200"
              title="Voltar"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#0052cc] border border-blue-100 flex items-center justify-center shadow-2xs">
                <Target className="w-4 h-4" />
              </div>
              <h1 className="text-lg font-bold text-gray-900 font-['Space_Grotesk'] tracking-tight">
                Gerenciamento de Metas
              </h1>
              <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-2 py-0.5 rounded-full">
                Painel Admin
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Defina as metas em volume/quantidade de vendas e boletos para os consultores ativos da equipe.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setBulkModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 border border-gray-200 rounded-xl shadow-2xs transition-colors cursor-pointer"
            title="Definir mesma meta de vendas para toda a equipe"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-gray-500" />
            <span className="hidden sm:inline">Definir Meta em Lote</span>
            <span className="sm:hidden">Meta em Lote</span>
          </button>

          <button
            onClick={loadGoals}
            disabled={isLoading}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-gray-200 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
            title="Recarregar metas salvas"
          >
            <RotateCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            id="btn-salvar-metas"
            onClick={handleSaveGoals}
            disabled={isSaving}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer ${
              hasUnsavedChanges
                ? 'bg-[#0052cc] hover:bg-[#00478f] text-white ring-2 ring-blue-500/20 active:scale-[0.98]'
                : 'bg-[#0052cc] hover:bg-[#00478f] text-white'
            } disabled:opacity-50`}
          >
            {isSaving ? (
              <>
                <RotateCw className="w-4 h-4 animate-spin" />
                <span>Salvando Metas...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Salvar Metas</span>
                {hasUnsavedChanges && (
                  <span className="w-2 h-2 rounded-full bg-amber-300 animate-pulse" title="Alterações pendentes" />
                )}
              </>
            )}
          </button>
        </div>
      </div>

      {/* 2. FILTERS CARD (Mês/Ano, Tipo de Meta) */}
      <div className="bg-white rounded-2xl border border-gray-200/90 p-4 shadow-2xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Left: Tipo de Meta toggle & Mês/Ano selectors */}
          <div className="flex flex-wrap items-center gap-3">
            
            {/* Toggle Tipo de Meta */}
            <div className="flex items-center gap-1 bg-gray-100/90 p-1 rounded-xl border border-gray-200/80 text-xs font-semibold">
              <button
                id="goal-type-mensal-btn"
                onClick={() => setGoalType('mensal')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  goalType === 'mensal'
                    ? 'bg-white text-blue-700 shadow-2xs font-bold'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <CalendarDays className="w-3.5 h-3.5 text-blue-600" />
                <span>Meta Mensal</span>
              </button>

              <button
                id="goal-type-semanal-btn"
                onClick={() => setGoalType('semanal')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  goalType === 'semanal'
                    ? 'bg-white text-blue-700 shadow-2xs font-bold'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <CalendarRange className="w-3.5 h-3.5 text-indigo-600" />
                <span>Meta Semanal</span>
              </button>
            </div>

            <div className="h-6 w-px bg-gray-200 hidden sm:block" />

            {/* Mês Selector */}
            <div className="flex items-center gap-2">
              <label htmlFor="select-month" className="text-xs font-semibold text-gray-500">
                Mês:
              </label>
              <select
                id="select-month"
                value={selectedMonth}
                onChange={e => setSelectedMonth(Number(e.target.value))}
                className="bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-gray-800 shadow-2xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none cursor-pointer"
              >
                {MONTHS.map(m => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Ano Selector */}
            <div className="flex items-center gap-2">
              <label htmlFor="select-year" className="text-xs font-semibold text-gray-500">
                Ano:
              </label>
              <select
                id="select-year"
                value={selectedYear}
                onChange={e => setSelectedYear(Number(e.target.value))}
                className="bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-gray-800 shadow-2xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none cursor-pointer"
              >
                {YEARS.map(y => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

          </div>

          {/* Right: Search Input */}
          <div className="relative w-full lg:w-64">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar consultor..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 placeholder-gray-400 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
            />
          </div>

        </div>

        {/* Changes Indicator Bar if dirty */}
        {hasUnsavedChanges && (
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-amber-50/80 border border-amber-200/80 text-xs">
            <div className="flex items-center gap-2 text-amber-800 font-medium">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
              <span>Você possui alterações não salvas nas metas da equipe.</span>
            </div>
            <button
              onClick={handleResetToSaved}
              className="text-[11px] font-bold text-amber-900 underline hover:text-amber-700 cursor-pointer"
            >
              Descartar alterações
            </button>
          </div>
        )}

      </div>

      {/* 3. METRICS SUMMARY CARDS (VOLUME / QUANTIDADE) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        
        {/* Card 1: Total de Vendas/Boletos da Equipe */}
        <div className="bg-white rounded-2xl border border-gray-200/80 p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500 text-xs font-medium">
            <span>Total de Vendas/Boletos da Equipe</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-xl font-extrabold text-gray-900 font-['Space_Grotesk'] tracking-tight">
              {teamMetrics.totalTarget.toLocaleString('pt-BR')} <span className="text-xs font-semibold text-gray-500">vendas</span>
            </p>
            <p className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-1">
              <span>Tipo:</span>
              <span className="font-semibold text-blue-700 capitalize">Meta {goalType}</span>
            </p>
          </div>
        </div>

        {/* Card 2: Consultores Ativos */}
        <div className="bg-white rounded-2xl border border-gray-200/80 p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500 text-xs font-medium">
            <span>Consultores Ativos</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Users className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-xl font-extrabold text-gray-900 font-['Space_Grotesk'] tracking-tight">
              {teamMetrics.consultantCount}
            </p>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Perfis comerciais ativos
            </p>
          </div>
        </div>

        {/* Card 3: Média de Vendas por Consultor */}
        <div className="bg-white rounded-2xl border border-gray-200/80 p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500 text-xs font-medium">
            <span>Média de Vendas por Consultor</span>
            <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <Target className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-xl font-extrabold text-gray-900 font-['Space_Grotesk'] tracking-tight">
              {teamMetrics.averageTarget.toLocaleString('pt-BR')} <span className="text-xs font-semibold text-gray-500">vendas</span>
            </p>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Média estipulada por profissional
            </p>
          </div>
        </div>

        {/* Card 4: Período de Referência */}
        <div className="bg-white rounded-2xl border border-gray-200/80 p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500 text-xs font-medium">
            <span>Período Vigente</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Calendar className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-base font-extrabold text-gray-900 font-['Space_Grotesk'] tracking-tight truncate">
              {selectedMonthObj?.label} / {selectedYear}
            </p>
            <p className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>Sincronizado Supabase</span>
            </p>
          </div>
        </div>

      </div>

      {/* 4. GOALS TABLE */}
      <div className="bg-white rounded-2xl border border-gray-200/90 shadow-2xs overflow-hidden">
        
        {/* Table Top Toolbar */}
        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-50/50">
          <div>
            <h2 className="text-sm font-bold text-gray-900 font-['Space_Grotesk'] flex items-center gap-2">
              <span>Metas dos Consultores</span>
              <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                {displayedConsultants.length} consultor(es)
              </span>
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Edite a meta de cada produto (Graduação, Pós, Técnico). O sistema calcula a soma automática e persiste em <code className="text-xs font-mono text-gray-700 bg-gray-100 px-1 py-0.5 rounded">public.goals</code>.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setBulkModalOpen(true)}
              className="text-[11px] font-semibold text-blue-700 hover:text-blue-800 hover:bg-blue-50 px-2.5 py-1.5 rounded-lg border border-blue-200 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Definir em Lote</span>
            </button>
            <button
              onClick={() => handleApplyBulkGoal(goalType === 'mensal' ? 20 : 5, goalType === 'mensal' ? 5 : 2, goalType === 'mensal' ? 5 : 1)}
              className="text-[11px] font-semibold text-gray-600 hover:text-blue-700 hover:bg-blue-50 px-2.5 py-1.5 rounded-lg border border-gray-200 transition-colors cursor-pointer"
            >
              Padrão ({goalType === 'mensal' ? '30 vendas' : '8 vendas'})
            </button>
          </div>
        </div>

        {/* The Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-200/80 bg-gray-50/80 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                <th className="py-3 px-4">Consultor</th>
                <th className="py-3 px-4">Meta Atual Salva</th>
                <th className="py-3 px-4 min-w-[320px]">Metas por Produto (Graduação, Pós, Técnico)</th>
                <th className="py-3 px-4 text-center">Participação na Equipe</th>
                <th className="py-3 px-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs">
              {displayedConsultants.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-gray-400">
                    <Users className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    <p className="text-sm font-semibold text-gray-600">Nenhum consultor encontrado</p>
                    <p className="text-xs text-gray-400 mt-0.5">Tente ajustar o termo de pesquisa acima.</p>
                  </td>
                </tr>
              ) : (
                displayedConsultants.map(c => {
                  const currentValue = goalsValues[c.id] || getInitialDefaultGoal(c.target_monthly, goalType);
                  const savedValue = savedGoalsMap[c.id] || getInitialDefaultGoal(c.target_monthly, goalType);
                  const isModified = (
                    currentValue.target_graduacao !== savedValue.target_graduacao ||
                    currentValue.target_pos !== savedValue.target_pos ||
                    currentValue.target_tecnico !== savedValue.target_tecnico ||
                    currentValue.target_total !== savedValue.target_total
                  );

                  // Percentage of team goal
                  const pct = teamMetrics.totalTarget > 0 
                    ? Math.round((currentValue.target_total / teamMetrics.totalTarget) * 100) 
                    : 0;

                  const initials = c.name
                    ? c.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
                    : 'CO';

                  return (
                    <tr 
                      key={c.id} 
                      className={`hover:bg-blue-50/30 transition-colors ${
                        isModified ? 'bg-amber-50/20' : ''
                      }`}
                    >
                      {/* 1. Consultor */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#00478f] text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                            {initials}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="font-bold text-gray-900 leading-tight">
                                {c.name || 'Sem nome'}
                              </p>
                              {c.role === 'admin' && (
                                <span className="text-[9px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.2 rounded">
                                  Admin
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-gray-400 leading-tight mt-0.5">
                              {c.email}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* 2. Meta Atual Salva (Volume de Vendas) */}
                      <td className="py-3.5 px-4 text-gray-600 font-medium">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className="bg-gray-100/80 px-2.5 py-1 rounded-md text-xs font-mono font-bold text-gray-900">
                              {savedValue.target_total.toLocaleString('pt-BR')} vendas
                            </span>
                          </div>
                          <div className="text-[10px] text-gray-400 font-medium flex items-center gap-1.5">
                            <span>Grad: <strong className="text-gray-600">{savedValue.target_graduacao}</strong></span>
                            <span>•</span>
                            <span>Pós: <strong className="text-gray-600">{savedValue.target_pos}</strong></span>
                            <span>•</span>
                            <span>Téc: <strong className="text-gray-600">{savedValue.target_tecnico}</strong></span>
                          </div>
                        </div>
                      </td>

                      {/* 3. Input Nova Meta: 3 inputs numéricos lado a lado com soma automática */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                          {/* Graduação Input */}
                          <div className="flex flex-col">
                            <label htmlFor={`goal-grad-${c.id}`} className="text-[10px] font-bold text-blue-700 mb-0.5">
                              Graduação
                            </label>
                            <input
                              id={`goal-grad-${c.id}`}
                              type="number"
                              min="0"
                              step="1"
                              value={currentValue.target_graduacao}
                              onChange={e => handleProductValueChange(c.id, 'target_graduacao', Number(e.target.value) || 0)}
                              className="w-18 sm:w-20 px-2 py-1.5 text-xs font-bold font-mono text-center rounded-xl border border-gray-200 bg-white text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all shadow-2xs"
                              placeholder="0"
                            />
                          </div>

                          {/* Pós Input */}
                          <div className="flex flex-col">
                            <label htmlFor={`goal-pos-${c.id}`} className="text-[10px] font-bold text-purple-700 mb-0.5">
                              Pós
                            </label>
                            <input
                              id={`goal-pos-${c.id}`}
                              type="number"
                              min="0"
                              step="1"
                              value={currentValue.target_pos}
                              onChange={e => handleProductValueChange(c.id, 'target_pos', Number(e.target.value) || 0)}
                              className="w-16 sm:w-18 px-2 py-1.5 text-xs font-bold font-mono text-center rounded-xl border border-gray-200 bg-white text-gray-900 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all shadow-2xs"
                              placeholder="0"
                            />
                          </div>

                          {/* Técnico Input */}
                          <div className="flex flex-col">
                            <label htmlFor={`goal-tec-${c.id}`} className="text-[10px] font-bold text-amber-700 mb-0.5">
                              Técnico
                            </label>
                            <input
                              id={`goal-tec-${c.id}`}
                              type="number"
                              min="0"
                              step="1"
                              value={currentValue.target_tecnico}
                              onChange={e => handleProductValueChange(c.id, 'target_tecnico', Number(e.target.value) || 0)}
                              className="w-16 sm:w-18 px-2 py-1.5 text-xs font-bold font-mono text-center rounded-xl border border-gray-200 bg-white text-gray-900 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all shadow-2xs"
                              placeholder="0"
                            />
                          </div>

                          {/* Totalizador automático */}
                          <div className="flex flex-col justify-end">
                            <span className="text-[10px] font-bold text-slate-500 mb-0.5">
                              Total
                            </span>
                            <div 
                              className={`px-2.5 py-1.5 rounded-xl border font-mono font-black text-xs text-center min-w-[54px] shadow-2xs ${
                                isModified 
                                  ? 'bg-amber-50 border-amber-300 text-amber-900 ring-1 ring-amber-300' 
                                  : 'bg-slate-100 border-slate-200 text-slate-800'
                              }`}
                              title="Soma automática: Graduação + Pós + Técnico"
                            >
                              {currentValue.target_total}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 4. Participação na Equipe (Progress Bar) */}
                      <td className="py-3.5 px-4">
                        <div className="w-32 mx-auto space-y-1">
                          <div className="flex items-center justify-between text-[10px] font-semibold text-gray-500">
                            <span>Participação</span>
                            <span className="font-bold text-gray-800">{pct}%</span>
                          </div>
                          <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                            <div 
                              className="bg-blue-600 h-full rounded-full transition-all duration-300"
                              style={{ width: `${Math.min(100, pct)}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* 5. Status da Meta */}
                      <td className="py-3.5 px-4 text-right">
                        {isModified ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            Modificado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Salvo
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>

            {/* Table Footer with Summary */}
            {displayedConsultants.length > 0 && (
              <tfoot className="border-t-2 border-gray-200 bg-gray-50 text-xs font-bold text-gray-800">
                <tr>
                  <td className="py-3 px-4">
                    <span>Total da Equipe ({displayedConsultants.length} consultores)</span>
                  </td>
                  <td className="py-3 px-4 font-mono text-gray-600">
                    {teamMetrics.totalSaved.toLocaleString('pt-BR')} vendas
                  </td>
                  <td className="py-3 px-4 font-mono text-blue-700 text-sm">
                    <div className="flex flex-col">
                      <span>{teamMetrics.totalTarget.toLocaleString('pt-BR')} vendas totais</span>
                      <span className="text-[10px] text-gray-500 font-medium">
                        Grad: {teamMetrics.totalGraduacao} • Pós: {teamMetrics.totalPos} • Téc: {teamMetrics.totalTecnico}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center text-gray-500">
                    100%
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={handleSaveGoals}
                      disabled={isSaving}
                      className="px-3 py-1 bg-[#0052cc] hover:bg-[#00478f] text-white text-[11px] font-bold rounded-lg shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {isSaving ? 'Salvando...' : 'Salvar'}
                    </button>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

      </div>

      {/* 5. MODAL: DEFINIR META EM LOTE (POR PRODUTO) */}
      {bulkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xl max-w-md w-full p-6 space-y-4">
            
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#0052cc] flex items-center justify-center">
                <SlidersHorizontal className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900 font-['Space_Grotesk']">
                  Definir Meta em Lote por Produto
                </h3>
                <p className="text-xs text-gray-500">
                  Aplique metas uniformes de Graduação, Pós e Técnico para todos os {activeConsultants.length} consultores.
                </p>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              {/* Graduação Bulk Input */}
              <div>
                <label htmlFor="bulk-grad-input" className="text-xs font-semibold text-blue-700 block mb-1">
                  Meta Graduação (por consultor)
                </label>
                <div className="relative">
                  <input
                    id="bulk-grad-input"
                    type="number"
                    min="0"
                    step="1"
                    value={bulkGrad}
                    onChange={e => setBulkGrad(Number(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-mono font-bold text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    placeholder="Ex: 20"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium">
                    vendas
                  </span>
                </div>
              </div>

              {/* Pós Bulk Input */}
              <div>
                <label htmlFor="bulk-pos-input" className="text-xs font-semibold text-purple-700 block mb-1">
                  Meta Pós-Graduação (por consultor)
                </label>
                <div className="relative">
                  <input
                    id="bulk-pos-input"
                    type="number"
                    min="0"
                    step="1"
                    value={bulkPos}
                    onChange={e => setBulkPos(Number(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-mono font-bold text-gray-900 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none"
                    placeholder="Ex: 5"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium">
                    vendas
                  </span>
                </div>
              </div>

              {/* Técnico Bulk Input */}
              <div>
                <label htmlFor="bulk-tec-input" className="text-xs font-semibold text-amber-700 block mb-1">
                  Meta Técnico (por consultor)
                </label>
                <div className="relative">
                  <input
                    id="bulk-tec-input"
                    type="number"
                    min="0"
                    step="1"
                    value={bulkTec}
                    onChange={e => setBulkTec(Number(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-mono font-bold text-gray-900 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
                    placeholder="Ex: 5"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium">
                    vendas
                  </span>
                </div>
              </div>

              {/* Total Summary */}
              <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 text-xs text-blue-900 flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <p>
                    Meta Total por consultor: <strong>{bulkGrad + bulkPos + bulkTec} vendas</strong>
                  </p>
                  <p className="mt-0.5 text-blue-800">
                    Volume total estimado da equipe: <strong>{((bulkGrad + bulkPos + bulkTec) * activeConsultants.length).toLocaleString('pt-BR')} vendas</strong> ({selectedMonthObj?.label}/{selectedYear}).
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setBulkModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleApplyBulkGoal(bulkGrad, bulkPos, bulkTec)}
                className="px-4 py-2 bg-[#0052cc] hover:bg-[#00478f] text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                Aplicar a Todos
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
