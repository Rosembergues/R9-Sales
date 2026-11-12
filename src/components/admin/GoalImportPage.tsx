import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FileSpreadsheet, Upload, X, AlertCircle, Calendar, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { GoalImportGroup, parseGoalFile, totalsOf, TEACHING_MODELS, ModelMetadata, getModelMetadata } from '../../lib/goalImport';
import { latestPerPeriodAndGroup, saveGoalImport } from '../../lib/goalImportService';
import { invalidateOfficialGoals } from '../../hooks/useOfficialGoals';
import { syncCurrentAndFutureGoals } from '../../lib/goalWeights';
import { errorText } from '../../lib/errors';
import { StoredPreview, COMMON_PERIODS, formatNumber, buildPreview, ReviewItem, itemBlockingErrors } from './goalImport/shared';
import { ReviewModal } from './goalImport/ReviewModal';
import { TeachingModelCard } from './goalImport/TeachingModelCard';
import { PreviewModal } from './goalImport/PreviewModal';
import type { GoalDailyRow, GoalImportRow } from '../../lib/dbTypes';

interface GoalImportPageProps {
  onBackToPlanner?: () => void;
}


export const GoalImportPage: React.FC<GoalImportPageProps> = ({ onBackToPlanner }) => {
  const { currentUser, profiles } = useAuth();
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const bulkInputRef = useRef<HTMLInputElement | null>(null);

  const [selectedPeriod, setSelectedPeriod] = useState<string>('2026.4');
  const [availablePeriods, setAvailablePeriods] = useState<string[]>(COMMON_PERIODS);
  const [isAddingPeriod, setIsAddingPeriod] = useState(false);
  const [newPeriodInput, setNewPeriodInput] = useState('');

  const [previews, setPreviews] = useState<Record<string, StoredPreview>>({});
  const [loadingGroup, setLoadingGroup] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [selectedPreview, setSelectedPreview] = useState<StoredPreview | null>(null);
  const [reviewItems, setReviewItems] = useState<ReviewItem[] | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Group models by section
  const buPresencialModels = useMemo(() => TEACHING_MODELS.filter(m => m.buKey === 'bu_presencial'), []);
  const buDigitalModels = useMemo(() => TEACHING_MODELS.filter(m => m.buKey === 'bu_digital'), []);
  const posModels = useMemo(() => TEACHING_MODELS.filter(m => m.buKey === 'pos'), []);
  const tecnicoModels = useMemo(() => TEACHING_MODELS.filter(m => m.buKey === 'tecnico'), []);

  const loadCurrentImports = useCallback(async (period: string) => {
    try {
      // 1. Períodos que têm importação
      const { data: allPeriodsData } = await supabase
        .from('goal_imports')
        .select('academic_period')
        .eq('status', 'active');

      if (allPeriodsData && allPeriodsData.length > 0) {
        const distinct = Array.from(
          new Set([
            ...COMMON_PERIODS,
            ...allPeriodsData.map(p => p.academic_period).filter(Boolean),
          ])
        ).sort();
        setAvailablePeriods(distinct);
      }

      // 2. Importações ativas do período escolhido
      const { data: imports, error } = await supabase
        .from('goal_imports')
        .select('id, academic_period, product, goal_group, file_name, imported_at, status')
        .eq('academic_period', period)
        .eq('status', 'active')
        .order('imported_at', { ascending: false });

      if (error) throw error;

      const latest = latestPerPeriodAndGroup(imports || []);
      const ids = latest.map((i) => i.id);
      if (!ids.length) {
        setPreviews({});
        return;
      }

      const { data: daily, error: dailyError } = await supabase
        .from('goal_daily_data')
        .select('import_id, reference_date, aa, target, actual')
        .in('import_id', ids)
        .order('reference_date', { ascending: true });

      if (dailyError) throw dailyError;

      const next: Record<string, StoredPreview> = {};
      latest.forEach((item) => {
        const rows = (daily || [])
          .filter((r) => r.import_id === item.id)
          .map((r) => ({
            date: r.reference_date,
            aa: r.aa === null ? null : Number(r.aa),
            target: r.target === null ? null : Number(r.target),
            actual: r.actual === null ? null : Number(r.actual),
          }));

        const meta = getModelMetadata(item.goal_group);
        next[item.goal_group] = buildPreview(
          meta,
          item.file_name,
          item.academic_period,
          rows,
          [],
          [],
          item.id
        );
      });

      setPreviews(next);
    } catch (error) {
      console.error('Erro ao carregar importações de metas:', error);
      setToast({
        type: 'error',
        message: errorText(error, 'Não foi possível carregar as importações do Supabase.'),
      });
    }
  }, []);

  useEffect(() => {
    loadCurrentImports(selectedPeriod);
  }, [selectedPeriod, loadCurrentImports]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(t);
  }, [toast]);

  const handleAddPeriod = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newPeriodInput.trim().toUpperCase();
    if (!clean) return;
    if (!availablePeriods.includes(clean)) {
      setAvailablePeriods(prev => [...prev, clean].sort());
    }
    setSelectedPeriod(clean);
    setNewPeriodInput('');
    setIsAddingPeriod(false);
  };

  /** Busca a importação ativa atual de cada (período, modalidade) para mostrar o "antes x depois". */
  const loadPreviousFor = async (items: ReviewItem[]): Promise<ReviewItem[]> => {
    const targets = items.filter(i => i.group && i.period);
    if (!targets.length) return items;
    const periods = Array.from(new Set(targets.map(i => i.period)));
    const { data: imports } = await supabase
      .from('goal_imports')
      .select('id, academic_period, goal_group, file_name, imported_at')
      .in('academic_period', periods)
      .eq('status', 'active')
      .order('imported_at', { ascending: false });
    const latest = latestPerPeriodAndGroup((imports || []) as GoalImportRow[]);
    const ids = latest.map((i) => i.id);
    const { data: daily } = ids.length
      ? await supabase.from('goal_daily_data').select('import_id, reference_date, aa, target, actual').in('import_id', ids)
      : { data: [] as GoalDailyRow[] };

    return items.map(item => {
      const prev = latest.find((i) => i.academic_period === item.period && i.goal_group === item.group);
      if (!prev) return { ...item, previous: null };
      const rows = ((daily || []) as GoalDailyRow[]).filter((r) => r.import_id === prev.id).map((r) => ({
        date: r.reference_date,
        aa: r.aa === null ? null : Number(r.aa),
        target: r.target === null ? null : Number(r.target),
        actual: r.actual === null ? null : Number(r.actual),
      }));
      return { ...item, previous: { fileName: prev.file_name, importedAt: prev.imported_at, totals: totalsOf(rows) } };
    });
  };

  /** Lê os arquivos e abre a tela de conferência. `forcedGroup` vem do card em que o arquivo foi enviado. */
  const startReview = async (files: File[], forcedGroup?: GoalImportGroup) => {
    if (!files.length) return;
    setLoadingGroup(forcedGroup ?? 'bulk');
    try {
      const parsedList = await Promise.all(files.map(parseGoalFile));
      let items: ReviewItem[] = parsedList.map((parsed, idx) => {
        const notes: string[] = [];
        let group = parsed.group;
        if (forcedGroup) {
          if (parsed.group && parsed.group !== forcedGroup) {
            notes.push(
              `Enviado no card ${getModelMetadata(forcedGroup).title}, mas os filtros do arquivo indicam ${getModelMetadata(parsed.group).title}. Será gravado como ${getModelMetadata(parsed.group).title}.`
            );
          }
          group = parsed.group ?? forcedGroup;
        }
        const period = parsed.academicPeriod ?? selectedPeriod;
        return { key: `${idx}-${parsed.fileName}`, parsed, group, period, notes, status: 'ready' };
      });
      items = await loadPreviousFor(items);
      setReviewItems(items);
    } catch (error) {
      setToast({ type: 'error', message: errorText(error, 'Não foi possível ler os arquivos.') });
    } finally {
      setLoadingGroup(null);
    }
  };

  const updateReviewItem = async (key: string, patch: Partial<ReviewItem>) => {
    if (!reviewItems) return;
    const next = reviewItems.map(i => (i.key === key ? { ...i, ...patch } : i));
    setReviewItems(await loadPreviousFor(next));
  };

  const confirmReview = async () => {
    if (!reviewItems) return;
    const items = [...reviewItems];
    let saved = 0;
    let failed = 0;
    for (let idx = 0; idx < items.length; idx += 1) {
      const item = items[idx];
      if (item.status === 'saved' || itemBlockingErrors(item, items).length) continue;
      items[idx] = { ...item, status: 'saving' };
      setReviewItems([...items]);
      try {
        await saveGoalImport({
          group: item.group as GoalImportGroup,
          academicPeriod: item.period,
          fileName: item.parsed.fileName,
          rows: item.parsed.rows,
          importedBy: currentUser?.id,
        });
        items[idx] = { ...item, status: 'saved' };
        saved += 1;
      } catch (error) {
        console.error('Erro ao importar metas:', error);
        items[idx] = { ...item, status: 'error', message: errorText(error, 'Falha ao gravar.') };
        failed += 1;
      }
      setReviewItems([...items]);
    }

    let weightNote = '';
    if (saved) {
      invalidateOfficialGoals();
      // Meta oficial mudou: redistribui pelos pesos da semana atual em diante
      try {
        const consultantIds = profiles.filter(p => p.status !== 'inactive').map(p => p.id);
        const r = await syncCurrentAndFutureGoals(consultantIds);
        if (r.periods) weightNote = ` Metas dos consultores recalculadas pelos pesos em ${r.periods} período(s).`;
      } catch (err) {
        console.warn('Metas importadas, mas a distribuição por peso não foi aplicada:', err);
      }
    }
    const savedPeriods = Array.from(new Set(items.filter(i => i.status === 'saved').map(i => i.period)));
    if (savedPeriods.length) {
      setAvailablePeriods(prev => Array.from(new Set([...prev, ...savedPeriods])).sort());
    }
    if (savedPeriods.length === 1 && savedPeriods[0] !== selectedPeriod) {
      setSelectedPeriod(savedPeriods[0]);
    } else {
      await loadCurrentImports(selectedPeriod);
    }

    if (!failed) {
      setReviewItems(null);
      setToast({
        type: 'success',
        message: `${saved} arquivo(s) importado(s)${savedPeriods.length ? ` · ${savedPeriods.join(', ')}` : ''}.${weightNote}`,
      });
    } else {
      setToast({ type: 'error', message: `${saved} importado(s), ${failed} com erro. Veja os detalhes na conferência.` });
    }
  };

  const removeFile = async (meta: ModelMetadata) => {
    const preview = previews[meta.id];
    if (!preview?.importId) return;

    try {
      const { error } = await supabase
        .from('goal_imports')
        .update({ status: 'cancelled' })
        .eq('id', preview.importId);

      if (error) throw error;

      setPreviews(prev => {
        const next = { ...prev };
        delete next[meta.id];
        return next;
      });

      setToast({ type: 'success', message: `Importação de ${meta.title} removida.` });
    } catch (error) {
      setToast({
        type: 'error',
        message: errorText(error, 'Não foi possível remover a importação.'),
      });
    }
  };

  // Totais do período escolhido
  const totalStats = useMemo(() => {
    let target = 0;
    let actual = 0;
    let aa = 0;
    let filesCount = 0;

    (Object.values(previews) as StoredPreview[]).forEach(p => {
      filesCount += 1;
      p.rows.forEach(r => {
        if (r.target != null && Number.isFinite(r.target)) target += r.target;
        if (r.actual != null && Number.isFinite(r.actual)) actual += r.actual;
        if (r.aa != null && Number.isFinite(r.aa)) aa += r.aa;
      });
    });

    return { target, actual, aa, filesCount };
  }, [previews]);

  const renderCard = (model: ModelMetadata) => (
    <TeachingModelCard
      key={model.id}
      model={model}
      preview={previews[model.id]}
      loading={loadingGroup === model.id}
      inputRef={el => { inputRefs.current[model.id] = el; }}
      onSelect={() => inputRefs.current[model.id]?.click()}
      onFile={file => startReview([file], model.id)}
      onRemove={() => removeFile(model)}
      onPreview={() => setSelectedPreview(previews[model.id])}
    />
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-[120] flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-xs font-semibold ${
            toast.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : toast.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-800'
              : 'bg-blue-50 border-blue-200 text-blue-800'
          }`}
        >
          <AlertCircle className="w-4 h-4" />
          {toast.message}
        </div>
      )}

      {/* Cabeçalho com troca de período */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          {onBackToPlanner && (
            <button
              onClick={onBackToPlanner}
              className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl border border-gray-200 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4 rotate-45" />
            </button>
          )}
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center">
                <Upload className="w-4 h-4" />
              </div>
              <h1 className="text-lg font-bold text-gray-900">Importação de Metas por Modelo de Ensino</h1>
              <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                ADMIN
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Arraste os relatórios do Power BI. A modalidade e o período acadêmico são lidos dos filtros de cada arquivo.
            </p>
          </div>
        </div>

        {/* Academic Period Selector */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-gray-600 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-blue-600" /> Visualizar período:
          </span>
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl border border-gray-200">
            {availablePeriods.map(period => (
              <button
                key={period}
                onClick={() => setSelectedPeriod(period)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  selectedPeriod === period
                    ? 'bg-white text-blue-700 shadow-2xs border border-gray-200/60'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {period}
              </button>
            ))}
            {!isAddingPeriod ? (
              <button
                onClick={() => setIsAddingPeriod(true)}
                className="px-2 py-1 text-xs text-blue-600 hover:text-blue-800 font-bold hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                title="Cadastrar outro período acadêmico"
              >
                + Outro
              </button>
            ) : (
              <form onSubmit={handleAddPeriod} className="flex items-center gap-1">
                <input
                  type="text"
                  value={newPeriodInput}
                  onChange={e => setNewPeriodInput(e.target.value)}
                  placeholder="2027.2"
                  className="w-16 px-2 py-1 text-xs border border-blue-400 rounded-lg bg-white"
                  autoFocus name="src_components_admin_goalimportpage_tsx_input_1"
                />
                <button
                  type="submit"
                  className="px-2 py-1 bg-blue-600 text-white text-[10px] font-bold rounded-lg cursor-pointer"
                >
                  OK
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddingPeriod(false)}
                  className="p-1 text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* Bulk drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={e => {
          e.preventDefault();
          setIsDragging(false);
          startReview(Array.from(e.dataTransfer.files));
        }}
        onClick={() => bulkInputRef.current?.click()}
        className={`rounded-2xl border-2 border-dashed p-6 text-center cursor-pointer transition-all ${
          isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-blue-400 hover:bg-blue-50/30'
        }`}
      >
        <input
          ref={bulkInputRef}
          type="file"
          accept=".xlsx,.csv"
          multiple
          className="hidden"
          onChange={e => {
            const files = Array.from(e.target.files || []);
            e.currentTarget.value = '';
            startReview(files);
          }}
          name="src_components_admin_goalimportpage_tsx_bulk"
        />
        {loadingGroup === 'bulk' ? (
          <Loader2 className="w-6 h-6 mx-auto text-blue-600 animate-spin" />
        ) : (
          <Upload className="w-6 h-6 mx-auto text-blue-600" />
        )}
        <div className="text-sm font-bold text-gray-800 mt-2">
          Arraste aqui todos os arquivos do Power BI de uma vez
        </div>
        <div className="text-xs text-gray-500 mt-1">
          Você confere o que mudou antes de gravar. Nada é salvo sem confirmação.
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-gradient-to-r from-slate-50 to-blue-50/50 p-4 rounded-2xl border border-slate-200/80">
        <div className="p-3 bg-white rounded-xl border border-slate-200/70 shadow-2xs">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Arquivos do Período</span>
          <div className="text-lg font-black text-slate-900 mt-1 flex items-center gap-1.5">
            <FileSpreadsheet className="w-4 h-4 text-blue-600" />
            {totalStats.filesCount} / {TEACHING_MODELS.length} ativos
          </div>
        </div>
        <div className="p-3 bg-white rounded-xl border border-slate-200/70 shadow-2xs">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Meta Total ({selectedPeriod})</span>
          <div className="text-lg font-black text-blue-700 mt-1">
            {formatNumber(totalStats.target)}
          </div>
        </div>
        <div className="p-3 bg-white rounded-xl border border-slate-200/70 shadow-2xs">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Realizado Oficial</span>
          <div className="text-lg font-black text-emerald-700 mt-1">
            {formatNumber(totalStats.actual)}
          </div>
        </div>
        <div className="p-3 bg-white rounded-xl border border-slate-200/70 shadow-2xs">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Atingimento Geral</span>
          <div className="text-lg font-black text-purple-700 mt-1">
            {totalStats.target > 0 ? `${Math.round((totalStats.actual / totalStats.target) * 100)}%` : '—'}
          </div>
        </div>
      </div>

      {/* SECTION 1: BU PRESENCIAL */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-black text-gray-900 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" />
              BU Presencial · Graduação
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Modelos de ensino com foco na operação do campus físico e aulas síncronas.
            </p>
          </div>
          <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200/70">
            {buPresencialModels.length} modelos
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {buPresencialModels.map(renderCard)}
        </div>
      </section>

      {/* SECTION 2: BU DIGITAL */}
      <section className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-black text-gray-900 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block" />
              BU Digital · Graduação
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Modelos 100% online ou digitais com práticas (EAD e Flex).
            </p>
          </div>
          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200/70">
            {buDigitalModels.length} modelos
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {buDigitalModels.map(renderCard)}
        </div>
      </section>

      {/* SECTION 3: PÓS-GRADUAÇÃO & TÉCNICO */}
      <section className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-black text-gray-900 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-600 inline-block" />
              Pós-Graduação & Curso Técnico
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Programas de especialização e habilitações técnicas.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {posModels.map(renderCard)}
          {tecnicoModels.map(renderCard)}
        </div>
      </section>

      {/* Conferência antes de gravar */}
      {selectedPreview && (
        <PreviewModal
          preview={selectedPreview}
          onClose={() => setSelectedPreview(null)}
        />
      )}

      {reviewItems && (
        <ReviewModal
          items={reviewItems}
          periods={availablePeriods}
          onChange={updateReviewItem}
          onRemove={key => setReviewItems(prev => {
            const next = (prev || []).filter(i => i.key !== key);
            return next.length ? next : null;
          })}
          onConfirm={confirmReview}
          onClose={() => setReviewItems(null)}
        />
      )}
    </div>
  );
};
