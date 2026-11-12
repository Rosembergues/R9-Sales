import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { supabase } from '../../../lib/supabase';
import { LocalSyncEngine } from '../../../lib/localCache';
import { Goal, DatabaseGoalRecord, ConsultantGoalValues } from '../../../types';
import { GoalFilePreview, GoalImportGroup, summarizeImportedGoals } from '../../../lib/goalImport';
import { latestPerPeriodAndGroup } from '../../../lib/goalImportService';
import { BU_KEYS, BuKey, WeightsMap, applyWeightedGoals, loadWeights, saveWeights, syncCurrentAndFutureGoals, todayIso, weightTotals } from '../../../lib/goalWeights';
import { errorText } from '../../../lib/errors';
import { GoalManagementPageProps, ConfigType, TeamConfig, emptyTeamConfig, getMonthBounds, getWeekBounds, BU_LABEL, toInt } from './shared';
import type { GoalDailyRow, GoalImportRow } from '../../../lib/dbTypes';

/** Estado e ações de Gerenciar Metas: período, metas por consultor, pesos por BU, ajustes manuais e gravação. */
export function useGoalManagement(props: GoalManagementPageProps) {
  const { onBackToPlanner } = props;
  const { profiles, currentUser } = useAuth();
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
  // Pesos por BU (%) e ajustes manuais do período
  const [weights, setWeights] = useState<WeightsMap>({});
  const [savedWeights, setSavedWeights] = useState<WeightsMap>({});
  const [weightsMissing, setWeightsMissing] = useState(false);
  const [showWeights, setShowWeights] = useState(false);
  const [isSavingWeights, setIsSavingWeights] = useState(false);
  const [manualIds, setManualIds] = useState<Set<string>>(new Set());
  const [isSyncing, setIsSyncing] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);

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
    void type;
    return {
      target_bu_presencial: 0,
      target_bu_digital: 0,
      target_graduacao: 0,
      target_pos: 0,
      target_tecnico: 0,
      target_total: 0,
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
  const loadImportedPreviews = useCallback(async (startDate: string, endDate: string) => {
    try {
      // O balizador é definido pelo intervalo de datas selecionado, não pelo ciclo acadêmico.
      const { data: imports, error } = await supabase
        .from('goal_imports')
        .select('id, academic_period, file_name, goal_group, status, imported_at')
        .eq('status', 'active')
        .order('imported_at', { ascending: false });

      if (error) throw error;

      const importIds = ((imports || []) as GoalImportRow[]).map((item) => item.id);
      if (!importIds.length) {
        setImportedPreviews({});
        return;
      }

      const { data: rows, error: rowsError } = await supabase
        .from('goal_daily_data')
        .select('import_id, reference_date, aa, target, actual')
        .in('import_id', importIds)
        .gte('reference_date', startDate)
        .lte('reference_date', endDate)
        .order('reference_date', { ascending: true });

      if (rowsError) throw rowsError;

      // Para cada (ciclo acadêmico, modalidade), usa a importação ativa mais recente que tenha
      // dados dentro do intervalo. Ciclos que se sobrepõem (ex.: 2026.4 e 2027.1) somam juntos.
      const latest = latestPerPeriodAndGroup((imports || []) as GoalImportRow[]).filter((item) =>
        ((rows || []) as GoalDailyRow[]).some((row) => row.import_id === item.id)
      );

      const next: Record<string, GoalFilePreview> = {};
      latest.forEach((item) => {
        const daily = ((rows || []) as GoalDailyRow[]).filter((row) => row.import_id === item.id);
        const dates = daily.map((row) => row.reference_date).sort();
        next[`${item.academic_period}|${item.goal_group}`] = {
          fileName: item.file_name,
          group: item.goal_group as GoalImportGroup,
          academicPeriod: item.academic_period,
          rowCount: daily.length,
          startDate: dates[0] ?? null,
          endDate: dates[dates.length - 1] ?? null,
          rows: daily.map((row) => ({
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
      console.error('Erro ao carregar dados importados de apoio por data:', error);
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

  // Soma das metas importadas na semana/mês escolhido
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

      let loadedGoals: DatabaseGoalRecord[] = [];
      if (period?.id) {
        const { data, error } = await supabase
          .from('goals')
          .select('*')
          .eq('goal_period_id', period.id);
        if (error) throw error;
        loadedGoals = (data as DatabaseGoalRecord[]) || [];
      }
      // Complementa também quando o período existe, mas as metas individuais antigas
      // ainda não possuem goal_period_id. Aceita os tipos em inglês e português.
      if (!period?.id || loadedGoals.length === 0) {
        const legacyTypes = configType === 'mensal' ? ['month', 'mensal'] : ['week', 'semanal'];
        const { data, error } = await supabase
          .from('goals')
          .select('*')
          .in('type', legacyTypes)
          .eq('reference_start', referenceStart);
        if (error) throw error;
        loadedGoals = (data as DatabaseGoalRecord[]) || [];
      }
      const manual = new Set<string>();
      loadedGoals.forEach(g => {
        if (!g.user_id) return;
        const parsed = parseGoal(g);
        next[g.user_id] = parsed;
        saved[g.user_id] = { ...parsed };
        if ((g as { ajuste_manual?: boolean }).ajuste_manual) manual.add(g.user_id);
      });

      setManualIds(manual);
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
    reloadTick,
  ]);

  // Pesos + distribuição automática da semana atual em diante (uma vez ao abrir a tela)
  const consultantIds = useMemo(() => activeConsultants.map(c => c.id), [activeConsultants]);
  const syncedOnce = React.useRef(false);
  useEffect(() => {
    loadWeights().then(({ weights: w, missingTable }) => {
      setWeights(w);
      setSavedWeights(w);
      setWeightsMissing(missingTable);
    });
  }, []);
  useEffect(() => {
    if (syncedOnce.current || !consultantIds.length) return;
    syncedOnce.current = true;
    setIsSyncing(true);
    syncCurrentAndFutureGoals(consultantIds)
      .then(() => {
        setReloadTick(t => t + 1);
        loadTeamConfig();
      })
      .catch(err => console.warn('Distribuição automática por peso não aplicada:', err))
      .finally(() => setIsSyncing(false));
  }, [consultantIds]);

  useEffect(() => {
    loadTeamConfig();
  }, [loadTeamConfig]);

  useEffect(() => {
    loadImportedPreviews(currentRange.start, currentRange.end);
  }, [currentRange.start, currentRange.end, loadImportedPreviews]);

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
    setManualIds(prev => new Set(prev).add(userId));
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

  // Soma das metas distribuídas entre os consultores
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

  const currentPeriod = useMemo(() => ({
    type: (configType === 'mensal' ? 'month' : 'week') as 'month' | 'week',
    start: currentRange.start,
    end: currentRange.end,
  }), [configType, currentRange]);
  const isClosedPeriod = currentPeriod.end < todayIso();

  // Recalcula o período aberto na tela pelos pesos (mantém os ajustes manuais)
  const handleRecalculate = async () => {
    if (isClosedPeriod) return;
    setIsSyncing(true);
    try {
      const r = await applyWeightedGoals([currentPeriod], consultantIds, teamConfig.academicPeriod);
      setReloadTick(t => t + 1);
      await loadTeamConfig();
      setToast({
        type: r.untouchedBus.length ? 'info' : 'success',
        message: r.untouchedBus.length
          ? `Metas recalculadas. Sem pesos definidos em: ${r.untouchedBus.map(bu => BU_LABEL[bu]).join(', ')}.`
          : 'Metas recalculadas pelos pesos.',
      });
    } catch (error) {
      setToast({ type: 'error', message: errorText(error, 'Não foi possível recalcular as metas.') });
    } finally {
      setIsSyncing(false);
    }
  };

  // Tira o ajuste manual de uma pessoa e devolve a meta ao cálculo por peso
  const handleBackToWeights = async (userId: string) => {
    const type = currentPeriod.type;
    const { error } = await supabase
      .from('goals')
      .update({ ajuste_manual: false })
      .eq('user_id', userId)
      .in('type', type === 'month' ? ['month', 'mensal'] : ['week', 'semanal'])
      .eq('reference_start', currentPeriod.start);
    if (error) {
      setToast({ type: 'error', message: error.message });
      return;
    }
    await handleRecalculate();
  };

  const savedManual = (userId: string) => {
    const current = goalsValues[userId];
    const saved = savedGoalsMap[userId];
    return JSON.stringify(current) === JSON.stringify(saved);
  };

  const weightSums = useMemo(() => weightTotals(weights, consultantIds), [weights, consultantIds]);
  const weightsDirty = JSON.stringify(weights) !== JSON.stringify(savedWeights);

  const setWeight = (userId: string, bu: BuKey, value: string) => {
    const n = Math.max(0, Math.min(100, Number(value.replace(',', '.')) || 0));
    setWeights(prev => ({ ...prev, [userId]: { ...(prev[userId] ?? {}), [bu]: n } }));
  };

  const handleSaveWeights = async () => {
    const wrong = BU_KEYS.filter(bu => weightSums[bu] > 0 && Math.abs(weightSums[bu] - 100) > 0.01);
    if (wrong.length) {
      setToast({ type: 'error', message: `A soma precisa dar 100% em: ${wrong.map(bu => BU_LABEL[bu]).join(', ')}.` });
      return;
    }
    setIsSavingWeights(true);
    try {
      await saveWeights(weights, consultantIds, currentUser?.id);
      setSavedWeights(weights);
      const r = await syncCurrentAndFutureGoals(consultantIds);
      setReloadTick(t => t + 1);
      await loadTeamConfig();
      setToast({ type: 'success', message: `Pesos salvos. Metas recalculadas em ${r.periods} período(s), da semana atual em diante.` });
    } catch (error) {
      setToast({ type: 'error', message: errorText(error, 'Não foi possível salvar os pesos.') });
    } finally {
      setIsSavingWeights(false);
    }
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
          ajuste_manual: manualIds.has(c.id),
        };
      });

      // Try upserting with target_bu_presencial and target_bu_digital
      const { error: fullError } = await supabase
        .from('goals')
        .upsert(payload, { onConflict: 'user_id,type,reference_start,academic_period' });

      if (fullError) {
        // Coluna ajuste_manual ainda não criada (supabase/metas-pesos.sql): salva sem ela
        if (fullError.message?.includes('ajuste_manual')) {
          const { error: noFlagError } = await supabase
            .from('goals')
            .upsert(payload.map(({ ajuste_manual, ...rest }) => rest), { onConflict: 'user_id,type,reference_start,academic_period' });
          if (noFlagError) throw noFlagError;
        } else
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

      // Período aberto: quem não foi ajustado à mão recebe o restante pelos pesos
      if (referenceEnd >= todayIso() && manualIds.size > 0) {
        try {
          await applyWeightedGoals([{ type, start: referenceStart, end: referenceEnd }], consultantIds, teamConfig.academicPeriod);
          setReloadTick(t => t + 1);
        } catch (err) {
          console.warn('Metas salvas, mas a redistribuição pelos pesos não foi aplicada:', err);
        }
      }
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
    } catch (error) {
      console.error('Erro ao salvar metas:', error);
      setToast({
        type: 'error',
        message: `Erro ao salvar: ${errorText(error, 'não foi possível salvar as metas no Supabase.')}`,
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


  return {
    onBackToPlanner,
    profiles,
    currentUser,
    now,
    configType,
    setConfigType,
    selectedMonth,
    setSelectedMonth,
    selectedYear,
    setSelectedYear,
    searchTerm,
    setSearchTerm,
    teamConfig,
    setTeamConfig,
    savedTeamConfig,
    setSavedTeamConfig,
    goalsValues,
    setGoalsValues,
    savedGoalsMap,
    setSavedGoalsMap,
    isLoading,
    setIsLoading,
    isSaving,
    setIsSaving,
    toast,
    setToast,
    importedPreviews,
    setImportedPreviews,
    weights,
    setWeights,
    savedWeights,
    setSavedWeights,
    weightsMissing,
    setWeightsMissing,
    showWeights,
    setShowWeights,
    isSavingWeights,
    setIsSavingWeights,
    manualIds,
    setManualIds,
    isSyncing,
    setIsSyncing,
    reloadTick,
    setReloadTick,
    activeConsultants,
    displayedConsultants,
    defaultGoal,
    parseGoal,
    loadTeamConfig,
    loadImportedPreviews,
    currentRange,
    importedSummary,
    loadGoals,
    consultantIds,
    syncedOnce,
    updateConsultantGoal,
    hasUnsavedChanges,
    distributedTotals,
    currentPeriod,
    isClosedPeriod,
    handleRecalculate,
    handleBackToWeights,
    savedManual,
    weightSums,
    weightsDirty,
    setWeight,
    handleSaveWeights,
    saveOperationalPeriod,
    handleSave,
    reset,
  };
}

export type GoalManagementState = ReturnType<typeof useGoalManagement>;
