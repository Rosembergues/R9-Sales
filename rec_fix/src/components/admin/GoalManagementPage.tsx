import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase, LocalSyncEngine } from '../../lib/supabase';
import { Goal, DatabaseGoalRecord, ConsultantGoalValues } from '../../types';
import {
  GoalFilePreview,
  GoalImportGroup,
  summarizeImportedGoals,
  getModelMetadata,
  BusinessUnitKey
} from '../../lib/goalImport';
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  Info,
  RotateCw,
  Save,
  Search,
  Target,
  TrendingUp,
  Users,
  Sparkles,
  ChevronRight,
  Layers
} from 'lucide-react';

interface GoalManagementPageProps {
  onBackToPlanner?: () => void;
}

type ConfigType = 'mensal' | 'semanal';

interface TeamConfig {
  monthlyTarget: number;
  weeklyTarget: number;
  weeklyGap: number;
  weekStart: string;
  weekEnd: string;
  academicPeriod: string;
}

const emptyTeamConfig = (): TeamConfig => ({
  monthlyTarget: 0,
  weeklyTarget: 0,
  weeklyGap: 0,
  weekStart: '',
  weekEnd: '',
  academicPeriod: '2026.3',
});

const getMonthBounds = (year: number, month: number) => {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  const fmt = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  return { start: fmt(start), end: fmt(end) };
};

const getWeekBounds = (year: number, month: number) => {
  const today = new Date();
  const base =
    today.getFullYear() === year && today.getMonth() + 1 === month
      ? new Date(today)
      : new Date(year, month - 1, 1);
  const day = base.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const start = new Date(base);
  start.setDate(base.getDate() + mondayOffset);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const monthBounds = getMonthBounds(year, month);
  const fmt = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dayValue = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dayValue}`;
  };
  return {
    start: fmt(start < new Date(monthBounds.start) ? new Date(monthBounds.start) : start),
    end: fmt(end > new Date(monthBounds.end) ? new Date(monthBounds.end) : end),
  };
};

const toInt = (value: string | number | undefined | null) =>
  Math.max(0, Math.round(Number(value) || 0));

export const GoalManagementPage: React.FC<GoalManagementPageProps> = ({ onBackToPlanner }) => {
  const { profiles } = useAuth();
  const now = new Date();

  const [configType, setConfigType] = useState<ConfigType>('semanal');
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [searchTerm, setSearchTerm] = useState('');
  const [teamConfig, setTeamConfig] = useState<TeamConfig>(emptyTeamConfig());
  const [savedTeamConfig, setSavedTeamConfig] = useState<TeamConfig>(emptyTeamConfig());
  const [goalsValues, setGoalsValues] = useState<Record<string, ConsultantGoalValues>>({});
  const [savedGoalsMap, setSavedGoalsMap] = useState<Record<string, ConsultantGoalValues>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [importedPreviews, setImportedPreviews] = useState<Record<string, GoalFilePreview>>({});

  const activeConsultants = useMemo(
    () => profiles.filter(profile => profile.status !== 'inactive'),
    [profiles]
  );

  const displayedConsultants = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return activeConsultants;
    return activeConsultants.filter(c =>
      c.name?.toLowerCase().includes(term) || c.email?.toLowerCase().includes(term)
    );
  }, [activeConsultants, searchTerm]);

  const defaultGoal = useCallback((type: ConfigType): ConsultantGoalValues => {
    if (type === 'mensal') {
      return {
        target_bu_presencial: 12,
        target_bu_digital: 8,
        target_graduacao: 20,
        target_pos: 5,
        target_tecnico: 5,
        target_total: 30,
      };
    }
    return {
      target_bu_presencial: 3,
      target_bu_digital: 2,
      target_graduacao: 5,
      target_pos: 2,
      target_tecnico: 1,
      target_total: 8,
    };
  }, []);

  const parseGoal = useCallback((goal: DatabaseGoalRecord | Goal): ConsultantGoalValues => {
    const buPresencial = toInt(goal.target_bu_presencial ?? 0);
    const buDigital = toInt(goal.target_bu_digital ?? 0);
    const gradLegacy = toInt(goal.target_graduacao ?? 0);
    const pos = toInt(goal.target_pos ?? 0);
    const tec = toInt(goal.target_tecnico ?? 0);

    // If BU fields were not set yet, estimate from legacy grad
    const resolvedBuPres = buPresencial || (gradLegacy ? Math.ceil(gradLegacy * 0.6) : 0);
    const resolvedBuDig = buDigital || (gradLegacy ? Math.floor(gradLegacy * 0.4) : 0);
    const total = resolvedBuPres + resolvedBuDig + pos + tec || toInt(goal.target_total ?? 0);

    return {
      id: typeof goal.id === 'string' ? goal.id : undefined,
      target_bu_presencial: resolvedBuPres,
      target_bu_digital: resolvedBuDig,
      target_graduacao: resolvedBuPres + resolvedBuDig,
      target_pos: pos,
      target_tecnico: tec,
      target_total: total,
    };
  }, []);

  // 1. Carrega períodos operacionais (goal_periods)
  const loadTeamConfig = useCallback(async () => {
    const bounds = getMonthBounds(selectedYear, selectedMonth);
    const weekBounds = getWeekBounds(selectedYear, selectedMonth);
    try {
      const [{ data: monthPeriod }, { data: weekPeriod }] = await Promise.all([
        supabase
          .from('goal_periods')
          .select('*')
          .eq('period_type', 'month')
          .eq('reference_start', bounds.start)
          .eq('reference_end', bounds.end)
          .maybeSingle(),
        supabase
          .from('goal_periods')
          .select('*')
          .eq('period_type', 'week')
          .eq('reference_start', weekBounds.start)
          .eq('reference_end', weekBounds.end)
          .maybeSingle(),
      ]);

      const base: TeamConfig = {
        ...emptyTeamConfig(),
        monthlyTarget: Number(monthPeriod?.target_total ?? 0),
        weeklyTarget: Number(weekPeriod?.target_total ?? 0),
        weeklyGap: Number(weekPeriod?.gap_total ?? 0),
        weekStart: weekPeriod?.reference_start || weekBounds.start,
        weekEnd: weekPeriod?.reference_end || weekBounds.end,
        academicPeriod:
          weekPeriod?.academic_period ||
          monthPeriod?.academic_period ||
          emptyTeamConfig().academicPeriod,
      };

      setTeamConfig(base);
      setSavedTeamConfig(base);
    } catch (error) {
      console.error('Erro ao carregar períodos de metas:', error);
      const base = { ...emptyTeamConfig(), weekStart: weekBounds.start, weekEnd: weekBounds.end };
      setTeamConfig(base);
      setSavedTeamConfig(base);
    }
  }, [selectedMonth, selectedYear]);

  // 2. Carrega dados importados de metas ativas para o período
  const loadImportedPreviews = useCallback(async (period: string) => {
    try {
      const { data: imports, error } = await supabase
        .from('goal_imports')
        .select('id, academic_period, file_name, goal_group, status')
        .eq('academic_period', period)
        .eq('status', 'active')
        .order('imported_at', { ascending: false });

      if (error) throw error;

      const latest: Record<string, any> = {};
      (imports || []).forEach(item => {
        if (!latest[item.goal_group]) latest[item.goal_group] = item;
      });

      const ids = Object.values(latest).map((item: any) => item.id);
      if (!ids.length) {
        setImportedPreviews({});
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

      setImportedPreviews(next);
    } catch (error) {
      console.error('Erro ao carregar dados importados de apoio:', error);
      setImportedPreviews({});
    }
  }, []);

  const currentRange = useMemo(() => {
    const bounds = getMonthBounds(selectedYear, selectedMonth);
    if (configType === 'mensal') {
      return { start: bounds.start, end: bounds.end };
    }
    return {
      start: teamConfig.weekStart || bounds.start,
      end: teamConfig.weekEnd || bounds.end,
    };
  }, [configType, selectedMonth, selectedYear, teamConfig.weekEnd, teamConfig.weekStart]);

  // Sum of imported goals in the selected week/month range
  const importedSummary = useMemo(
    () => summarizeImportedGoals(importedPreviews, currentRange.start, currentRange.end),
    [importedPreviews, currentRange]
  );

  // 3. Carrega metas dos consultores
  const loadGoals = useCallback(async () => {
    setIsLoading(true);
    try {
      const type: 'month' | 'week' = configType === 'mensal' ? 'month' : 'week';
      const bounds = getMonthBounds(selectedYear, selectedMonth);
      const referenceStart =
        configType === 'mensal'
          ? bounds.start
          : teamConfig.weekStart || getWeekBounds(selectedYear, selectedMonth).start;
      const referenceEnd =
        configType === 'mensal'
          ? bounds.end
          : teamConfig.weekEnd || getWeekBounds(selectedYear, selectedMonth).end;

      const next: Record<string, ConsultantGoalValues> = {};
      const saved: Record<string, ConsultantGoalValues> = {};
      activeConsultants.forEach(c => {
        const fallback = defaultGoal(configType);
        next[c.id] = { ...fallback };
        saved[c.id] = { ...fallback };
      });

      const { data: period } = await supabase
        .from('goal_periods')
        .select('id')
        .eq('period_type', type)
        .eq('reference_start', referenceStart)
        .eq('reference_end', referenceEnd)
        .maybeSingle();

      if (period?.id) {
        const { data, error } = await supabase
          .from('goals')
          .select('*')
          .eq('goal_period_id', period.id);

        if (error) throw error;
        ((data as DatabaseGoalRecord[]) || []).forEach(g => {
          if (!g.user_id) return;
          const parsed = parseGoal(g);
          next[g.user_id] = parsed;
          saved[g.user_id] = { ...parsed };
        });
      } else {
        const { data, error } = await supabase
          .from('goals')
          .select('*')
          .eq('type', type)
          .eq('reference_start', referenceStart);

        if (error) throw error;
        ((data as DatabaseGoalRecord[]) || []).forEach(g => {
          if (!g.user_id) return;
          const parsed = parseGoal(g);
          next[g.user_id] = parsed;
          saved[g.user_id] = { ...parsed };
        });
      }

      setGoalsValues(next);
      setSavedGoalsMap(saved);
    } catch (error) {
      console.error('Erro ao carregar metas dos consultores:', error);
      const next: Record<string, ConsultantGoalValues> = {};
      activeConsultants.forEach(c => {
        next[c.id] = defaultGoal(configType);
      });
      setGoalsValues(next);
      setSavedGoalsMap(next);
    } finally {
      setIsLoading(false);
    }
  }, [
    activeConsultants,
    configType,
    defaultGoal,
    parseGoal,
    selectedMonth,
    selectedYear,
    teamConfig.weekEnd,
    teamConfig.weekStart,
  ]);

  useEffect(() => {
    loadTeamConfig();
  }, [loadTeamConfig]);

  useEffect(() => {
    loadImportedPreviews(teamConfig.academicPeriod);
  }, [teamConfig.academicPeriod, loadImportedPreviews]);

  useEffect(() => {
    loadGoals();
  }, [loadGoals]);

  // Updating consultant goal inputs
  const updateConsultantGoal = (
    userId: string,
    field: 'target_bu_presencial' | 'target_bu_digital' | 'target_pos' | 'target_tecnico',
    value: string
  ) => {
    const numeric = toInt(value);
    setGoalsValues(prev => {
      const current = prev[userId] ?? defaultGoal(configType);
      const next = { ...current, [field]: numeric };
      const buPres = next.target_bu_presencial ?? 0;
      const buDig = next.target_bu_digital ?? 0;
      next.target_graduacao = buPres + buDig;
      next.target_total = buPres + buDig + next.target_pos + next.target_tecnico;
      return { ...prev, [userId]: next };
    });
  };

  // Check unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    if (JSON.stringify(teamConfig) !== JSON.stringify(savedTeamConfig)) return true;
    for (const c of activeConsultants) {
      const current = goalsValues[c.id];
      const saved = savedGoalsMap[c.id];
      if (!current || !saved) return true;
      if (
        (current.target_bu_presencial ?? 0) !== (saved.target_bu_presencial ?? 0) ||
        (current.target_bu_digital ?? 0) !== (saved.target_bu_digital ?? 0) ||
        current.target_pos !== saved.target_pos ||
        current.target_tecnico !== saved.target_tecnico ||
        current.target_total !== saved.target_total
      ) {
        return true;
      }
    }
    return false;
  }, [activeConsultants, goalsValues, savedGoalsMap, savedTeamConfig, teamConfig]);

  // Sum of goals assigned across consultants
  const distributedTotals = useMemo(() => {
    let buPresencial = 0;
    let buDigital = 0;
    let pos = 0;
    let tecnico = 0;
    let total = 0;

    activeConsultants.forEach(c => {
      const g = goalsValues[c.id];
      if (g) {
        buPresencial += g.target_bu_presencial ?? 0;
        buDigital += g.target_bu_digital ?? 0;
        pos += g.target_pos ?? 0;
        tecnico += g.target_tecnico ?? 0;
        total += g.target_total ?? 0;
      }
    });

    return { buPresencial, buDigital, pos, tecnico, total };
  }, [activeConsultants, goalsValues]);

  // Distribute imported week goal evenly among active sellers
  const handleAutoDistributeFromImport = () => {
    const count = activeConsultants.length;
    if (count === 0) return;

    const impPres = Math.round(importedSummary.byBu.bu_presencial.target);
    const impDig = Math.round(importedSummary.byBu.bu_digital.target);
    const impPos = Math.round(importedSummary.byBu.pos.target);
    const impTec = Math.round(importedSummary.byBu.tecnico.target);

    const basePres = Math.floor(impPres / count);
    const remPres = impPres % count;

    const baseDig = Math.floor(impDig / count);
    const remDig = impDig % count;

    const basePos = Math.floor(impPos / count);
    const remPos = impPos % count;

    const baseTec = Math.floor(impTec / count);
    const remTec = impTec % count;

    const next: Record<string, ConsultantGoalValues> = {};
    activeConsultants.forEach((c, index) => {
      const buPres = basePres + (index < remPres ? 1 : 0);
      const buDig = baseDig + (index < remDig ? 1 : 0);
      const posVal = basePos + (index < remPos ? 1 : 0);
      const tecVal = baseTec + (index < remTec ? 1 : 0);

      next[c.id] = {
        target_bu_presencial: buPres,
        target_bu_digital: buDig,
        target_graduacao: buPres + buDig,
        target_pos: posVal,
        target_tecnico: tecVal,
        target_total: buPres + buDig + posVal + tecVal,
      };
    });

    setGoalsValues(next);
    setTeamConfig(prev => ({
      ...prev,
      weeklyTarget: impPres + impDig + impPos + impTec,
    }));

    setToast({
      type: 'info',
      message: 'Metas da semana distribuídas proporcionalmente com base nos arquivos importados!',
    });
  };

  const saveOperationalPeriod = async (
    type: 'month' | 'week',
    referenceStart: string,
    referenceEnd: string
  ) => {
    const payload = {
      academic_period: teamConfig.academicPeriod || emptyTeamConfig().academicPeriod,
      period_type: type,
      reference_start: referenceStart,
      reference_end: referenceEnd,
      target_total:
        type === 'month' ? toInt(teamConfig.monthlyTarget) : toInt(teamConfig.weeklyTarget),
      gap_total: type === 'month' ? 0 : toInt(teamConfig.weeklyGap),
    };

    const { data: existing, error: findError } = await supabase
      .from('goal_periods')
      .select('id')
      .eq('period_type', type)
      .eq('reference_start', referenceStart)
      .eq('reference_end', referenceEnd)
      .maybeSingle();

    if (findError) throw findError;

    if (existing?.id) {
      const { error } = await supabase
        .from('goal_periods')
        .update(payload)
        .eq('id', existing.id);
      if (error) throw error;
      return existing.id as string;
    }

    const { data, error } = await supabase
      .from('goal_periods')
      .insert(payload)
      .select('id')
      .single();

    if (error || !data) throw error || new Error('Não foi possível registrar o período de metas.');
    return data.id as string;
  };

  const handleSave = async () => {
    setIsSaving(true);
    setToast(null);
    try {
      const bounds = getMonthBounds(selectedYear, selectedMonth);
      const referenceStart = configType === 'mensal' ? bounds.start : teamConfig.weekStart;
      const referenceEnd = configType === 'mensal' ? bounds.end : teamConfig.weekEnd;

      if (!referenceStart || !referenceEnd) {
        throw new Error('Informe o início e o fim da semana de referência.');
      }

      const type: 'month' | 'week' = configType === 'mensal' ? 'month' : 'week';
      const goalPeriodId = await saveOperationalPeriod(type, referenceStart, referenceEnd);

      const payload = activeConsultants.map(c => {
        const current = goalsValues[c.id] ?? defaultGoal(configType);
        const buPres = toInt(current.target_bu_presencial);
        const buDig = toInt(current.target_bu_digital);
        const pos = toInt(current.target_pos);
        const tec = toInt(current.target_tecnico);
        const total = buPres + buDig + pos + tec;

        return {
          user_id: c.id,
          type,
          reference_start: referenceStart,
          reference_end: referenceEnd,
          academic_period: teamConfig.academicPeriod || emptyTeamConfig().academicPeriod,
          goal_period_id: goalPeriodId,
          target_bu_presencial: buPres,
          target_bu_digital: buDig,
          target_graduacao: buPres + buDig,
          target_pos: pos,
          target_tecnico: tec,
          target_total: total,
        };
      });

      // Try upserting with target_bu_presencial and target_bu_digital
      let upsertError: any = null;
      const { error: fullError } = await supabase
        .from('goals')
        .upsert(payload, { onConflict: 'user_id,type,reference_start,academic_period' });

      if (fullError) {
        upsertError = fullError;
        // Graceful fallback if supabase columns haven't been added yet:
        if (fullError.message?.includes('target_bu_presencial')) {
          console.warn('Colunas de BU não encontradas no Supabase; usando colunas padrão.');
          const legacyPayload = payload.map(item => ({
            user_id: item.user_id,
            type: item.type,
            reference_start: item.reference_start,
            reference_end: item.reference_end,
            academic_period: item.academic_period,
            goal_period_id: item.goal_period_id,
            target_graduacao: item.target_graduacao,
            target_pos: item.target_pos,
            target_tecnico: item.target_tecnico,
            target_total: item.target_total,
          }));

          const { error: fallbackErr } = await supabase
            .from('goals')
            .upsert(legacyPayload, { onConflict: 'user_id,type,reference_start,academic_period' });

          if (fallbackErr) throw fallbackErr;
          upsertError = null;
        } else {
          throw fullError;
        }
      }

      // Sync local storage
      const local = LocalSyncEngine.getGoals();
      const merged = [...local];
      payload.forEach(item => {
        const index = merged.findIndex(
          g =>
            g.user_id === item.user_id &&
            (g.type === type ||
              (type === 'month' && g.type === 'mensal') ||
              (type === 'week' && g.type === 'semanal')) &&
            g.reference_start === referenceStart
        );
        const record: Goal = {
          id: index >= 0 ? merged[index].id : crypto.randomUUID(),
          user_id: item.user_id,
          type,
          target_bu_presencial: item.target_bu_presencial,
          target_bu_digital: item.target_bu_digital,
          target_graduacao: item.target_graduacao,
          target_pos: item.target_pos,
          target_tecnico: item.target_tecnico,
          target_total: item.target_total,
          reference_start: referenceStart,
          reference_end: referenceEnd,
          month: selectedMonth,
          year: selectedYear,
          updated_at: new Date().toISOString(),
          goal_period_id: goalPeriodId,
        };
        if (index >= 0) merged[index] = record;
        else merged.push(record);
      });
      LocalSyncEngine.saveGoals(merged);

      setSavedTeamConfig({ ...teamConfig });
      setSavedGoalsMap(
        Object.fromEntries(
          payload.map(item => [
            item.user_id,
            {
              target_bu_presencial: item.target_bu_presencial,
              target_bu_digital: item.target_bu_digital,
              target_graduacao: item.target_graduacao,
              target_pos: item.target_pos,
              target_tecnico: item.target_tecnico,
              target_total: item.target_total,
            },
          ])
        )
      );

      setToast({
        type: 'success',
        message:
          configType === 'mensal'
            ? 'Metas mensais por BU salvas com sucesso no Supabase!'
            : 'Metas semanais por BU salvas com sucesso no Supabase!',
      });
    } catch (error: any) {
      console.error('Erro ao salvar metas:', error);
      setToast({
        type: 'error',
        message: error?.message
          ? `Erro ao salvar: ${error.message}`
          : 'Não foi possível salvar as metas no Supabase.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const reset = () => {
    setTeamConfig({ ...savedTeamConfig });
    setGoalsValues(
      Object.fromEntries(
        activeConsultants.map(c => [c.id, savedGoalsMap[c.id] ?? defaultGoal(configType)])
      )
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-xs font-semibold ${
            toast.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : toast.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-800'
              : 'bg-blue-50 border-blue-200 text-blue-800'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <AlertCircle className="w-4 h-4" />
          )}
          {toast.message}
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          {onBackToPlanner && (
            <button
              onClick={onBackToPlanner}
              className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl border border-gray-200 transition-colors cursor-pointer"
              title="Voltar"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#0052cc] border border-blue-100 flex items-center justify-center">
                <Target className="w-4 h-4" />
              </div>
              <h1 className="text-lg font-bold text-gray-900">Metas dos Consultores por BU</h1>
              <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                ADMIN
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Defina a meta semanal de cada consultor por BU (Presencial e Digital). As metas importadas dos arquivos servem como balizador automático da semana.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={reset}
            disabled={!hasUnsavedChanges}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-gray-600 bg-white border border-gray-200 rounded-xl disabled:opacity-40 hover:bg-gray-50 transition-colors cursor-pointer"
          >
            <RotateCw className="w-3.5 h-3.5" /> Descartar
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl bg-[#0052cc] hover:bg-[#00478f] text-white disabled:opacity-50 transition-colors cursor-pointer shadow-sm"
          >
            <Save className="w-4 h-4" /> {isSaving ? 'Salvando...' : 'Salvar metas'}
          </button>
        </div>
      </div>

      {/* Period Selection Controls */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-2xs">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-xl border border-gray-200 w-fit">
            <button
              onClick={() => setConfigType('semanal')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                configType === 'semanal'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <CalendarRange className="inline w-3.5 h-3.5 mr-1.5" /> Meta semanal (Operação)
            </button>
            <button
              onClick={() => setConfigType('mensal')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                configType === 'mensal'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <CalendarDays className="inline w-3.5 h-3.5 mr-1.5" /> Meta mensal
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="text-xs font-semibold text-gray-500">Mês:</label>
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(Number(e.target.value))}
              className="px-3 py-2 border border-gray-200 rounded-xl text-xs bg-white font-medium" name="src_components_admin_goalmanagementpage_tsx_select_1"
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {new Date(2026, i, 1).toLocaleDateString('pt-BR', { month: 'long' })}
                </option>
              ))}
            </select>

            <label className="text-xs font-semibold text-gray-500">Ano:</label>
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(Number(e.target.value))}
              className="px-3 py-2 border border-gray-200 rounded-xl text-xs bg-white font-medium" name="src_components_admin_goalmanagementpage_tsx_select_2"
            >
              {[2026, 2027, 2028].map(year => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>

            <label className="text-xs font-semibold text-gray-500">Ciclo:</label>
            <input
              value={teamConfig.academicPeriod}
              onChange={e => setTeamConfig(v => ({ ...v, academicPeriod: e.target.value }))}
              className="w-24 px-3 py-2 border border-gray-200 rounded-xl text-xs font-bold text-blue-700"
              placeholder="2026.3" name="src_components_admin_goalmanagementpage_tsx_input_3"
            />
          </div>
        </div>

        {/* Week bounds editor */}
        {configType === 'semanal' && (
          <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-gray-700">Intervalo da Semana:</span>
              <div className="flex items-center gap-2 text-xs">
                <input
                  type="date"
                  value={teamConfig.weekStart}
                  onChange={e => setTeamConfig(v => ({ ...v, weekStart: e.target.value }))}
                  className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs" name="src_components_admin_goalmanagementpage_tsx_input_4"
                />
                <span className="text-gray-400">até</span>
                <input
                  type="date"
                  value={teamConfig.weekEnd}
                  onChange={e => setTeamConfig(v => ({ ...v, weekEnd: e.target.value }))}
                  className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs" name="src_components_admin_goalmanagementpage_tsx_input_5"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <label className="text-xs text-gray-500 font-semibold">Meta da equipe na semana:</label>
              <input
                type="number"
                min="0"
                value={teamConfig.weeklyTarget || ''}
                onChange={e => setTeamConfig(v => ({ ...v, weeklyTarget: toInt(e.target.value) }))}
                className="w-20 px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs font-black text-blue-700 text-center"
                placeholder="0" name="src_components_admin_goalmanagementpage_tsx_input_6"
              />
              <span className="text-xs text-gray-400">matrículas</span>
            </div>
          </div>
        )}
      </div>

      {/* BALIZADOR AUTOMÁTICO DA SEMANA (Vindo dos Arquivos Importados) */}
      <div className="bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-slate-50 border border-blue-200 rounded-2xl p-5 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-blue-100/80">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-blue-700">
                Balizador da Semana Oficial (Planilhas Importadas)
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                {currentRange.start} → {currentRange.end}
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-1">
              Estes são os valores extraídos automaticamente dos arquivos de metas para o intervalo selecionado. Utilize-os para balizar a cobrança da equipe.
            </p>
          </div>

          <button
            onClick={handleAutoDistributeFromImport}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors cursor-pointer shadow-sm shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5" /> Distribuir igualmente para os consultores
          </button>
        </div>

        {/* 4 Cards das BUs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          <div className="bg-white p-3.5 rounded-xl border border-blue-100 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 block">
              BU Presencial
            </span>
            <span className="text-[10px] text-gray-400 block mt-0.5">Presencial + Semi + Ao Vivo</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-xl font-black text-slate-900">
                {Math.round(importedSummary.byBu.bu_presencial.target)}
              </span>
              <span className="text-[11px] font-semibold text-emerald-700">
                Realizado: {Math.round(importedSummary.byBu.bu_presencial.actual)}
              </span>
            </div>
            <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between text-[10px]">
              <span className="text-gray-400">Distribuído equipe:</span>
              <strong
                className={
                  distributedTotals.buPresencial >= Math.round(importedSummary.byBu.bu_presencial.target)
                    ? 'text-emerald-700'
                    : 'text-amber-700'
                }
              >
                {distributedTotals.buPresencial}
              </strong>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-emerald-100 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">
              BU Digital
            </span>
            <span className="text-[10px] text-gray-400 block mt-0.5">EAD + DLEX (Flex)</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-xl font-black text-slate-900">
                {Math.round(importedSummary.byBu.bu_digital.target)}
              </span>
              <span className="text-[11px] font-semibold text-emerald-700">
                Realizado: {Math.round(importedSummary.byBu.bu_digital.actual)}
              </span>
            </div>
            <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between text-[10px]">
              <span className="text-gray-400">Distribuído equipe:</span>
              <strong
                className={
                  distributedTotals.buDigital >= Math.round(importedSummary.byBu.bu_digital.target)
                    ? 'text-emerald-700'
                    : 'text-amber-700'
                }
              >
                {distributedTotals.buDigital}
              </strong>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-purple-100 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 block">
              Pós-Graduação
            </span>
            <span className="text-[10px] text-gray-400 block mt-0.5">Presencial + Digital</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-xl font-black text-slate-900">
                {Math.round(importedSummary.byBu.pos.target)}
              </span>
              <span className="text-[11px] font-semibold text-emerald-700">
                Realizado: {Math.round(importedSummary.byBu.pos.actual)}
              </span>
            </div>
            <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between text-[10px]">
              <span className="text-gray-400">Distribuído equipe:</span>
              <strong
                className={
                  distributedTotals.pos >= Math.round(importedSummary.byBu.pos.target)
                    ? 'text-emerald-700'
                    : 'text-amber-700'
                }
              >
                {distributedTotals.pos}
              </strong>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-amber-100 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 block">
              Curso Técnico
            </span>
            <span className="text-[10px] text-gray-400 block mt-0.5">Técnico Presencial</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-xl font-black text-slate-900">
                {Math.round(importedSummary.byBu.tecnico.target)}
              </span>
              <span className="text-[11px] font-semibold text-emerald-700">
                Realizado: {Math.round(importedSummary.byBu.tecnico.actual)}
              </span>
            </div>
            <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between text-[10px]">
              <span className="text-gray-400">Distribuído equipe:</span>
              <strong
                className={
                  distributedTotals.tecnico >= Math.round(importedSummary.byBu.tecnico.target)
                    ? 'text-emerald-700'
                    : 'text-amber-700'
                }
              >
                {distributedTotals.tecnico}
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* CONSULTANTS GOALS TABLE */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-2xs">
        <div className="p-5 border-b border-gray-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-gray-900">
              Distribuição por Consultor ({configType === 'mensal' ? 'Mensal' : 'Semanal'})
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Informe a meta de cada consultor para BU Presencial, BU Digital, Pós e Técnico.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-xs text-gray-500">
              <Users className="inline w-3.5 h-3.5 mr-1" />
              {activeConsultants.length} consultores ·{' '}
              <strong className="text-gray-900 font-bold">{distributedTotals.total}</strong> no total
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-gray-400" />
              <input
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Buscar consultor"
                className="pl-9 pr-3 py-2 text-xs border border-gray-200 rounded-xl w-52 bg-slate-50 focus:bg-white transition-colors" name="src_components_admin_goalmanagementpage_tsx_input_7"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-5 py-3 font-bold text-gray-600">Consultor</th>
                <th className="px-3 py-3 font-bold text-blue-700 text-center">
                  BU Presencial <br />
                  <span className="text-[10px] font-normal text-gray-400">Presencial / Semi / Ao Vivo</span>
                </th>
                <th className="px-3 py-3 font-bold text-emerald-700 text-center">
                  BU Digital <br />
                  <span className="text-[10px] font-normal text-gray-400">EAD / DLEX</span>
                </th>
                <th className="px-3 py-3 font-bold text-purple-700 text-center">
                  Pós-Graduação <br />
                  <span className="text-[10px] font-normal text-gray-400">Pres. / Digital</span>
                </th>
                <th className="px-3 py-3 font-bold text-amber-700 text-center">
                  Curso Técnico <br />
                  <span className="text-[10px] font-normal text-gray-400">Presencial</span>
                </th>
                <th className="px-5 py-3 text-right font-bold text-gray-900">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {displayedConsultants.map(consultant => {
                const goal = goalsValues[consultant.id] ?? defaultGoal(configType);
                return (
                  <tr key={consultant.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-3">
                      <div className="font-semibold text-gray-900">
                        {consultant.name || consultant.email}
                      </div>
                      <div className="text-[10px] text-gray-400">{consultant.email}</div>
                    </td>

                    <td className="px-3 py-3 text-center">
                      <input
                        type="number"
                        min="0"
                        value={goal.target_bu_presencial ?? 0}
                        onChange={e =>
                          updateConsultantGoal(consultant.id, 'target_bu_presencial', e.target.value)
                        }
                        className="w-16 text-center px-2 py-1.5 border border-blue-200 bg-blue-50/30 rounded-lg text-sm font-bold text-blue-900 focus:bg-white focus:ring-1 focus:ring-blue-500" name="src_components_admin_goalmanagementpage_tsx_input_8"
                      />
                    </td>

                    <td className="px-3 py-3 text-center">
                      <input
                        type="number"
                        min="0"
                        value={goal.target_bu_digital ?? 0}
                        onChange={e =>
                          updateConsultantGoal(consultant.id, 'target_bu_digital', e.target.value)
                        }
                        className="w-16 text-center px-2 py-1.5 border border-emerald-200 bg-emerald-50/30 rounded-lg text-sm font-bold text-emerald-900 focus:bg-white focus:ring-1 focus:ring-emerald-500" name="src_components_admin_goalmanagementpage_tsx_input_9"
                      />
                    </td>

                    <td className="px-3 py-3 text-center">
                      <input
                        type="number"
                        min="0"
                        value={goal.target_pos ?? 0}
                        onChange={e =>
                          updateConsultantGoal(consultant.id, 'target_pos', e.target.value)
                        }
                        className="w-16 text-center px-2 py-1.5 border border-purple-200 bg-purple-50/30 rounded-lg text-sm font-bold text-purple-900 focus:bg-white focus:ring-1 focus:ring-purple-500" name="src_components_admin_goalmanagementpage_tsx_input_10"
                      />
                    </td>

                    <td className="px-3 py-3 text-center">
                      <input
                        type="number"
                        min="0"
                        value={goal.target_tecnico ?? 0}
                        onChange={e =>
                          updateConsultantGoal(consultant.id, 'target_tecnico', e.target.value)
                        }
                        className="w-16 text-center px-2 py-1.5 border border-amber-200 bg-amber-50/30 rounded-lg text-sm font-bold text-amber-900 focus:bg-white focus:ring-1 focus:ring-amber-500" name="src_components_admin_goalmanagementpage_tsx_input_11"
                      />
                    </td>

                    <td className="px-5 py-3 text-right font-black text-sm text-gray-900">
                      {goal.target_total}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-slate-50 border-t border-gray-200 font-bold">
              <tr>
                <td className="px-5 py-3 text-gray-700">Total Distribuído para a Equipe</td>
                <td className="px-3 py-3 text-center text-blue-700 font-black">
                  {distributedTotals.buPresencial}
                </td>
                <td className="px-3 py-3 text-center text-emerald-700 font-black">
                  {distributedTotals.buDigital}
                </td>
                <td className="px-3 py-3 text-center text-purple-700 font-black">
                  {distributedTotals.pos}
                </td>
                <td className="px-3 py-3 text-center text-amber-700 font-black">
                  {distributedTotals.tecnico}
                </td>
                <td className="px-5 py-3 text-right text-gray-900 text-sm font-black">
                  {distributedTotals.total}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between text-[11px] text-gray-400 px-1">
        <span>As metas salvas são refletidas diretamente no ranking semanal e home.</span>
        <span>
          {isLoading
            ? 'Carregando metas...'
            : hasUnsavedChanges
            ? 'Há alterações pendentes de salvamento.'
            : 'Tudo salvo e sincronizado.'}
        </span>
      </div>
    </div>
  );
};
