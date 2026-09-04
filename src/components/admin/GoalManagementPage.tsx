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

export const GoalManagementPage: React.FC<GoalManagementPageProps> = ({ onBackToPlanner }) => {
  const { profiles, refreshProfiles } = useAuth();
  
  // Date and filter states
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(currentDate.getFullYear());
  const [goalType, setGoalType] = useState<GoalType>('mensal');
  const [searchTerm, setSearchTerm] = useState('');

  // Goals state: map of user_id -> target_value (integer quantity of sales/boletos)
  const [goalsValues, setGoalsValues] = useState<Record<string, number>>({});
  // Baseline saved goals for dirty detection: map of user_id -> saved target_value
  const [savedGoalsMap, setSavedGoalsMap] = useState<Record<string, { id?: string; target_value: number }>>({});
  
  // UI states
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkValue, setBulkValue] = useState<number>(goalType === 'mensal' ? 30 : 8);

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
  const getInitialDefaultVolume = useCallback((consultantTargetMonthly?: number, type: GoalType = goalType) => {
    if (type === 'mensal') {
      // If a previous target was stored as monetary (e.g. >= 1000), convert or fallback to 30 sales
      if (consultantTargetMonthly && consultantTargetMonthly > 0 && consultantTargetMonthly < 1000) {
        return Math.round(consultantTargetMonthly);
      }
      return 30;
    }
    return 8; // Weekly default volume
  }, [goalType]);

  // Load goals from Supabase and LocalSyncEngine for the selected period & type
  const loadGoals = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. Check existing records in Supabase public.goals table
      const { data: remoteGoals, error } = await supabase
        .from('goals')
        .select('*')
        .eq('type', goalType);

      // 2. Check local fallback goals
      const localGoals = LocalSyncEngine.getGoals();

      const newSavedMap: Record<string, { id?: string; target_value: number }> = {};
      const newValuesMap: Record<string, number> = {};

      // Seed with default quantity based on active consultants
      activeConsultants.forEach(c => {
        const defaultVal = getInitialDefaultVolume(c.target_monthly, goalType);
        newSavedMap[c.id] = { target_value: defaultVal };
        newValuesMap[c.id] = defaultVal;
      });

      // Merge local fallback if available
      if (localGoals && localGoals.length > 0) {
        localGoals.forEach(g => {
          if (g.type === goalType) {
            const rawVal = Number(g.target_value) || 0;
            // Sanitize in case old monetary values exist
            const volumeVal = rawVal >= 1000 ? (goalType === 'mensal' ? 30 : 8) : Math.round(rawVal);
            newSavedMap[g.user_id] = { id: g.id, target_value: volumeVal };
            newValuesMap[g.user_id] = volumeVal;
          }
        });
      }

      // Overwrite with Supabase records if available
      if (!error && remoteGoals && remoteGoals.length > 0) {
        remoteGoals.forEach((g: any) => {
          if (g.user_id) {
            const rawVal = Number(g.target_value) || 0;
            const volumeVal = rawVal >= 1000 ? (goalType === 'mensal' ? 30 : 8) : Math.round(rawVal);
            newSavedMap[g.user_id] = { id: g.id, target_value: volumeVal };
            newValuesMap[g.user_id] = volumeVal;
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
  }, [goalType, activeConsultants, getInitialDefaultVolume]);

  // Reload whenever goalType, month, or activeConsultants change
  useEffect(() => {
    loadGoals();
    setBulkValue(goalType === 'mensal' ? 30 : 8);
  }, [goalType, selectedMonth, selectedYear, activeConsultants.length, loadGoals]);

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Handle target value changes for a specific user (pure integer quantity)
  const handleValueChange = (userId: string, value: number) => {
    const intVal = Math.max(0, Math.round(value));
    setGoalsValues(prev => ({
      ...prev,
      [userId]: intVal
    }));
  };

  // Check if any consultant has modified goal
  const hasUnsavedChanges = useMemo(() => {
    return activeConsultants.some(c => {
      const current = goalsValues[c.id] ?? 0;
      const saved = savedGoalsMap[c.id]?.target_value ?? getInitialDefaultVolume(c.target_monthly, goalType);
      return current !== saved;
    });
  }, [activeConsultants, goalsValues, savedGoalsMap, goalType, getInitialDefaultVolume]);

  // Calculate team aggregates (pure volume of sales/boletos)
  const teamMetrics = useMemo(() => {
    let totalTarget = 0;
    let totalSaved = 0;

    activeConsultants.forEach(c => {
      const val = goalsValues[c.id] ?? 0;
      const savedVal = savedGoalsMap[c.id]?.target_value ?? 0;
      totalTarget += val;
      totalSaved += savedVal;
    });

    const averageTarget = activeConsultants.length > 0 
      ? Math.round(totalTarget / activeConsultants.length) 
      : 0;

    const diff = totalTarget - totalSaved;

    return {
      totalTarget,
      totalSaved,
      averageTarget,
      diff,
      consultantCount: activeConsultants.length
    };
  }, [activeConsultants, goalsValues, savedGoalsMap]);

  // Save metas with batch upsert on public.goals (saving integer sales volume)
  const handleSaveGoals = async () => {
    setIsSaving(true);
    setToast(null);

    try {
      // Build batch upsert payload for public.goals
      const batchPayload = activeConsultants.map(c => {
        const existing = savedGoalsMap[c.id];
        const targetValue = Math.round(Number(goalsValues[c.id] ?? getInitialDefaultVolume(c.target_monthly, goalType)));
        
        return {
          id: existing?.id || crypto.randomUUID(),
          user_id: c.id,
          type: goalType, // 'semanal' ou 'mensal'
          target_value: targetValue,
          updated_at: new Date().toISOString(),
        };
      });

      console.log('🚀 [Supabase DB] Upsert em lote de volume de vendas na tabela public.goals:', batchPayload);

      // 1. Batch upsert directly to Supabase public.goals table
      const { error: upsertError } = await supabase
        .from('goals')
        .upsert(batchPayload, { onConflict: 'id' });

      // 2. Persist locally in LocalSyncEngine for instantaneous fallback & offline resilience
      const currentLocalGoals = LocalSyncEngine.getGoals();
      const updatedLocalGoals: Goal[] = [...currentLocalGoals];

      batchPayload.forEach(item => {
        const idx = updatedLocalGoals.findIndex(g => g.user_id === item.user_id && g.type === item.type);
        const goalRecord: Goal = {
          id: item.id,
          user_id: item.user_id,
          type: item.type as GoalType,
          target_value: item.target_value,
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
              .update({ target_monthly: item.target_value })
              .eq('id', item.user_id);
          } catch (e) {
            console.warn('Sync profile target error:', e);
          }
        }
        await refreshProfiles();
      }

      // Update baseline map
      const updatedSavedMap: Record<string, { id?: string; target_value: number }> = {};
      batchPayload.forEach(item => {
        updatedSavedMap[item.user_id] = {
          id: item.id,
          target_value: item.target_value
        };
      });
      setSavedGoalsMap(updatedSavedMap);

      if (upsertError) {
        console.warn('⚠️ [Supabase DB] Aviso no upsert de metas (dados salvos localmente):', upsertError.message);
        setToast({
          type: 'success',
          message: `Metas de ${teamMetrics.totalTarget} vendas salvas e sincronizadas com sucesso!`
        });
      } else {
        setToast({
          type: 'success',
          message: `Metas de vendas (${goalType.toUpperCase()}) salvas no Supabase! Total: ${teamMetrics.totalTarget} vendas.`
        });
      }
    } catch (err: any) {
      console.error('💥 Erro ao salvar metas de vendas:', err);
      setToast({
        type: 'error',
        message: 'Ocorreu um erro ao processar o salvamento das metas. Tente novamente.'
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Bulk set all consultants to the same integer sales volume
  const handleApplyBulkGoal = (value: number) => {
    const intVal = Math.max(0, Math.round(value));
    const updated: Record<string, number> = {};
    activeConsultants.forEach(c => {
      updated[c.id] = intVal;
    });
    setGoalsValues(prev => ({ ...prev, ...updated }));
    setBulkModalOpen(false);
    setToast({
      type: 'info',
      message: `Meta uniforme de ${intVal} vendas/boletos aplicada a todos os consultores.`
    });
  };

  // Quick reset to saved values
  const handleResetToSaved = () => {
    const reverted: Record<string, number> = {};
    activeConsultants.forEach(c => {
      reverted[c.id] = savedGoalsMap[c.id]?.target_value ?? getInitialDefaultVolume(c.target_monthly, goalType);
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
              Edite a quantidade de vendas/boletos da meta de cada consultor no campo abaixo. Os valores serão persistidos na tabela <code className="text-xs font-mono text-gray-700 bg-gray-100 px-1 py-0.5 rounded">public.goals</code>.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleApplyBulkGoal(goalType === 'mensal' ? 30 : 8)}
              className="text-[11px] font-semibold text-gray-600 hover:text-blue-700 hover:bg-blue-50 px-2.5 py-1.5 rounded-lg border border-gray-200 transition-colors cursor-pointer"
            >
              Aplicar Padrão ({goalType === 'mensal' ? '30 vendas' : '8 vendas'})
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
                <th className="py-3 px-4 min-w-[260px]">Nova Meta (Qtd de Vendas)</th>
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
                  const currentValue = goalsValues[c.id] ?? getInitialDefaultVolume(c.target_monthly, goalType);
                  const savedValue = savedGoalsMap[c.id]?.target_value ?? getInitialDefaultVolume(c.target_monthly, goalType);
                  const isModified = currentValue !== savedValue;

                  // Percentage of team goal
                  const pct = teamMetrics.totalTarget > 0 
                    ? Math.round((currentValue / teamMetrics.totalTarget) * 100) 
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
                        <span className="bg-gray-100/80 px-2.5 py-1 rounded-md text-xs font-mono font-semibold">
                          {savedValue.toLocaleString('pt-BR')} vendas
                        </span>
                      </td>

                      {/* 3. Input Nova Meta (Qtd de Vendas) com Botões de Ajuste Rápido */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <div className="relative w-32">
                            <input
                              id={`goal-input-${c.id}`}
                              type="number"
                              min="0"
                              step="1"
                              value={currentValue}
                              onChange={e => handleValueChange(c.id, Number(e.target.value) || 0)}
                              className={`w-full px-3 py-1.5 text-xs font-bold font-mono rounded-xl border outline-none transition-all ${
                                isModified
                                  ? 'border-amber-400 bg-amber-50/50 text-gray-900 focus:ring-2 focus:ring-amber-400/30'
                                  : 'border-gray-200 bg-white text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                              }`}
                            />
                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 font-medium pointer-events-none">
                              unid
                            </span>
                          </div>

                          {/* Practical Volume Increment Buttons */}
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleValueChange(c.id, currentValue + 1)}
                              className="px-2 py-1 text-[11px] font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors cursor-pointer"
                              title="Adicionar 1 venda"
                            >
                              +1
                            </button>
                            <button
                              type="button"
                              onClick={() => handleValueChange(c.id, currentValue + 5)}
                              className="px-2 py-1 text-[11px] font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors cursor-pointer"
                              title="Adicionar 5 vendas"
                            >
                              +5
                            </button>
                            <button
                              type="button"
                              onClick={() => handleValueChange(c.id, currentValue + 10)}
                              className="px-2 py-1 text-[11px] font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors cursor-pointer"
                              title="Adicionar 10 vendas"
                            >
                              +10
                            </button>
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
                    {teamMetrics.totalTarget.toLocaleString('pt-BR')} vendas
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

      {/* 5. MODAL: DEFINIR META EM LOTE (QUANTIDADE) */}
      {bulkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xl max-w-md w-full p-6 space-y-4">
            
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#0052cc] flex items-center justify-center">
                <SlidersHorizontal className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900 font-['Space_Grotesk']">
                  Definir Meta em Lote
                </h3>
                <p className="text-xs text-gray-500">
                  Aplique uma quantidade uniforme de vendas para todos os {activeConsultants.length} consultores ativos.
                </p>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <label htmlFor="bulk-goal-input" className="text-xs font-semibold text-gray-700">
                Quantidade de Vendas por Consultor
              </label>
              <div className="relative">
                <input
                  id="bulk-goal-input"
                  type="number"
                  min="0"
                  step="1"
                  value={bulkValue}
                  onChange={e => setBulkValue(Number(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-mono font-bold text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  placeholder="Ex: 30"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium">
                  vendas / consultor
                </span>
              </div>

              {/* Quick Choice Pills */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {[5, 10, 15, 20, 25, 30, 40, 50].map(val => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setBulkValue(val)}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                      bulkValue === val 
                        ? 'bg-blue-50 border-blue-300 text-blue-700 font-bold' 
                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {val} vendas
                  </button>
                ))}
              </div>
            </div>

            <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 text-xs text-blue-900 flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <span>
                Isso resultará em um volume total da equipe estimado em{' '}
                <strong>{(bulkValue * activeConsultants.length).toLocaleString('pt-BR')} vendas/boletos</strong> para {selectedMonthObj?.label}/{selectedYear}.
              </span>
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
                onClick={() => handleApplyBulkGoal(bulkValue)}
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
