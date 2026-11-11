import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, FileSpreadsheet, Upload, X, AlertCircle, AlertTriangle, Calendar, Trash2, Eye, Loader2, ArrowRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import {
  GoalFilePreview,
  GoalImportGroup,
  GoalImportTotals,
  ParsedGoalFile,
  ParsedGoalRow,
  parseGoalFile,
  totalsOf,
  TEACHING_MODELS,
  ModelMetadata,
  getModelMetadata,
} from '../../lib/goalImport';
import { latestPerPeriodAndGroup, saveGoalImport } from '../../lib/goalImportService';
import { invalidateOfficialGoals } from '../../hooks/useOfficialGoals';
import { syncCurrentAndFutureGoals } from '../../lib/goalWeights';

interface GoalImportPageProps {
  onBackToPlanner?: () => void;
}

type StoredPreview = GoalFilePreview & { importId?: string };

const COMMON_PERIODS = ['2026.3', '2026.4', '2027.1'];

const formatDate = (value: string | null) =>
  value ? new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR') : '—';

const formatNumber = (value: number | null) =>
  value === null ? '—' : value.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

const buildPreview = (
  meta: ModelMetadata,
  fileName: string,
  academicPeriod: string | null,
  rows: ParsedGoalRow[],
  filters: string[],
  warnings: string[],
  importId?: string
): StoredPreview => {
  const dates = rows.map(r => r.date).filter(Boolean).sort();
  return {
    fileName,
    group: meta.id,
    academicPeriod,
    rowCount: rows.length,
    startDate: dates[0] ?? null,
    endDate: dates[dates.length - 1] ?? null,
    rows,
    filters,
    warnings,
    importId,
  };
};

/** Um arquivo na tela de conferência, antes de gravar. */
interface ReviewItem {
  key: string;
  parsed: ParsedGoalFile;
  group: GoalImportGroup | null;
  period: string;
  /** Avisos adicionais gerados na conferência (ex.: card diferente do arquivo). */
  notes: string[];
  previous?: { fileName: string; importedAt: string; totals: GoalImportTotals } | null;
  status: 'ready' | 'saving' | 'saved' | 'error';
  message?: string;
}

const itemBlockingErrors = (item: ReviewItem, all: ReviewItem[]) => {
  const errors = [...item.parsed.errors.filter(e => !(item.group && e.startsWith('Não consegui identificar a modalidade')))];
  if (!item.group) errors.push('Escolha a modalidade deste arquivo.');
  if (!/^\d{4}\.\d+$/.test(item.period)) errors.push('Período acadêmico inválido.');
  const dup = all.find(o => o.key !== item.key && o.group === item.group && o.period === item.period);
  if (item.group && dup && all.indexOf(dup) < all.indexOf(item)) {
    errors.push(`Outro arquivo (${dup.parsed.fileName}) já está indo para ${getModelMetadata(item.group).title} ${item.period}.`);
  }
  return errors;
};

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
      // 1. Fetch available distinct periods
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

      // 2. Fetch active imports for the selected period
      const { data: imports, error } = await supabase
        .from('goal_imports')
        .select('id, academic_period, product, goal_group, file_name, imported_at, status')
        .eq('academic_period', period)
        .eq('status', 'active')
        .order('imported_at', { ascending: false });

      if (error) throw error;

      const latest = latestPerPeriodAndGroup(imports || []);
      const ids = latest.map((i: any) => i.id);
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
      latest.forEach((item: any) => {
        const rows = (daily || [])
          .filter((r: any) => r.import_id === item.id)
          .map((r: any) => ({
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
    } catch (error: any) {
      console.error('Erro ao carregar importações de metas:', error);
      setToast({
        type: 'error',
        message: error?.message || 'Não foi possível carregar as importações do Supabase.',
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
    const latest = latestPerPeriodAndGroup(imports || []);
    const ids = latest.map((i: any) => i.id);
    const { data: daily } = ids.length
      ? await supabase.from('goal_daily_data').select('import_id, reference_date, aa, target, actual').in('import_id', ids)
      : { data: [] as any[] };

    return items.map(item => {
      const prev = latest.find((i: any) => i.academic_period === item.period && i.goal_group === item.group);
      if (!prev) return { ...item, previous: null };
      const rows = (daily || []).filter((r: any) => r.import_id === prev.id).map((r: any) => ({
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
    } catch (error: any) {
      setToast({ type: 'error', message: error?.message || 'Não foi possível ler os arquivos.' });
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
      } catch (error: any) {
        console.error('Erro ao importar metas:', error);
        items[idx] = { ...item, status: 'error', message: error?.message || 'Falha ao gravar.' };
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
    } catch (error: any) {
      setToast({
        type: 'error',
        message: error?.message || 'Não foi possível remover a importação.',
      });
    }
  };

  // Overall totals for the active period
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

      {/* Header with period switcher */}
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

      {/* Preview Modal */}
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

interface ReviewModalProps {
  items: ReviewItem[];
  periods: string[];
  onChange: (key: string, patch: Partial<ReviewItem>) => void;
  onRemove: (key: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}

const DeltaValue: React.FC<{ label: string; now: number; before?: number | null; tone: string }> = ({ label, now, before, tone }) => {
  const diff = before === undefined || before === null ? null : now - before;
  return (
    <div className="rounded-lg bg-gray-50 border border-gray-100 px-2 py-1.5 text-center">
      <span className="text-[9px] uppercase font-bold text-gray-400 block">{label}</span>
      <span className={`text-xs font-bold ${tone}`}>{formatNumber(now)}</span>
      {diff !== null && Math.abs(diff) >= 0.05 && (
        <span className={`block text-[10px] font-bold ${diff > 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
          {diff > 0 ? '+' : ''}{formatNumber(diff)}
        </span>
      )}
    </div>
  );
};

const ReviewModal: React.FC<ReviewModalProps> = ({ items, periods, onChange, onRemove, onConfirm, onClose }) => {
  const saving = items.some(i => i.status === 'saving');
  const pending = items.filter(i => i.status !== 'saved');
  const blocked = pending.filter(i => itemBlockingErrors(i, items).length > 0);
  const ready = pending.length - blocked.length;

  return (
    <div className="fixed inset-0 z-[110] bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-slate-50">
          <div>
            <h3 className="text-sm font-bold text-gray-900">Conferência da importação</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Confira modalidade, período e o que muda em relação à importação atual antes de gravar.
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded-xl transition-colors cursor-pointer disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-auto flex-1 space-y-3">
          {items.map(item => {
            const errors = item.status === 'saved' ? [] : itemBlockingErrors(item, items);
            const totals = totalsOf(item.parsed.rows);
            const prev = item.previous?.totals;
            const warnings = [...item.notes, ...item.parsed.warnings];
            const periodOptions = Array.from(new Set([...periods, item.period, item.parsed.academicPeriod].filter(Boolean) as string[])).sort();
            return (
              <div
                key={item.key}
                className={`rounded-xl border p-4 ${
                  item.status === 'saved'
                    ? 'border-emerald-300 bg-emerald-50/40'
                    : errors.length || item.status === 'error'
                    ? 'border-rose-200 bg-rose-50/30'
                    : 'border-gray-200'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                  <div className="min-w-0 lg:w-72 shrink-0 space-y-2">
                    <div className="flex items-center gap-2">
                      {item.status === 'saving' && <Loader2 className="w-4 h-4 text-blue-600 animate-spin shrink-0" />}
                      {item.status === 'saved' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                      {item.status === 'ready' && <FileSpreadsheet className="w-4 h-4 text-gray-400 shrink-0" />}
                      {item.status === 'error' && <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
                      <span className="text-xs font-bold text-gray-900 truncate" title={item.parsed.fileName}>{item.parsed.fileName}</span>
                    </div>
                    <select
                      value={item.group ?? ''}
                      disabled={item.status === 'saved' || saving}
                      onChange={e => onChange(item.key, { group: (e.target.value || null) as GoalImportGroup | null })}
                      className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
                      name={`review_group_${item.key}`}
                    >
                      <option value="">— escolha a modalidade —</option>
                      {TEACHING_MODELS.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
                    </select>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-gray-500">Período</span>
                      <select
                        value={item.period}
                        disabled={item.status === 'saved' || saving}
                        onChange={e => onChange(item.key, { period: e.target.value })}
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white"
                        name={`review_period_${item.key}`}
                      >
                        {periodOptions.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                      {item.parsed.academicPeriod && item.period !== item.parsed.academicPeriod && (
                        <span className="text-[10px] font-bold text-amber-700">arquivo diz {item.parsed.academicPeriod}</span>
                      )}
                    </div>
                    {item.parsed.campus && <p className="text-[11px] text-gray-500 truncate">Campus: {item.parsed.campus}</p>}
                  </div>

                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2 text-[11px] text-gray-500">
                      {item.previous ? (
                        <>
                          <span className="truncate">Substitui <b>{item.previous.fileName}</b> ({new Date(item.previous.importedAt).toLocaleDateString('pt-BR')})</span>
                          <ArrowRight className="w-3 h-3 shrink-0" />
                        </>
                      ) : (
                        <span>Primeira importação desta modalidade neste período.</span>
                      )}
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      <DeltaValue label="Dias" now={totals.days} before={prev?.days} tone="text-slate-700" />
                      <DeltaValue label="Ano Ant." now={totals.aa} before={prev?.aa} tone="text-slate-600" />
                      <DeltaValue label="Meta" now={totals.target} before={prev?.target} tone="text-blue-700" />
                      <DeltaValue label="Realizado" now={totals.actual} before={prev?.actual} tone="text-emerald-700" />
                    </div>
                    <p className="text-[11px] text-gray-500">
                      {item.parsed.rowCount ? `${formatDate(item.parsed.startDate)} → ${formatDate(item.parsed.endDate)}` : 'Sem dias com dados'}
                    </p>
                    {warnings.map(w => (
                      <p key={w} className="text-[11px] text-amber-700 flex items-start gap-1.5">
                        <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" /> {w}
                      </p>
                    ))}
                    {errors.map(er => (
                      <p key={er} className="text-[11px] font-semibold text-rose-700 flex items-start gap-1.5">
                        <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" /> {er}
                      </p>
                    ))}
                    {item.status === 'error' && item.message && (
                      <p className="text-[11px] font-semibold text-rose-700">Erro ao gravar: {item.message}</p>
                    )}
                  </div>

                  {item.status !== 'saved' && (
                    <button
                      onClick={() => onRemove(item.key)}
                      disabled={saving}
                      className="self-start p-1.5 text-gray-400 hover:text-rose-600 hover:bg-white rounded-lg cursor-pointer disabled:opacity-40"
                      title="Tirar este arquivo da importação"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-5 py-4 border-t border-gray-100 bg-slate-50 flex items-center justify-between gap-3">
          <p className="text-xs text-gray-500">
            {ready} pronto(s) para gravar{blocked.length ? ` · ${blocked.length} com pendência (não serão gravados)` : ''}
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-xs font-bold text-gray-600 border border-gray-200 rounded-xl hover:bg-white cursor-pointer disabled:opacity-40"
            >
              Cancelar
            </button>
            <button
              onClick={onConfirm}
              disabled={saving || ready === 0}
              className="px-4 py-2 text-xs font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 cursor-pointer disabled:opacity-40 inline-flex items-center gap-2"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Gravar {ready} arquivo(s)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface TeachingModelCardProps {
  model: ModelMetadata;
  preview?: StoredPreview;
  loading: boolean;
  inputRef: (el: HTMLInputElement | null) => void;
  onSelect: () => void;
  onFile: (file: File) => void;
  onRemove: () => void;
  onPreview: () => void;
}

const TeachingModelCard: React.FC<TeachingModelCardProps> = ({
  model,
  preview,
  loading,
  inputRef,
  onSelect,
  onFile,
  onRemove,
  onPreview,
}) => {
  const isLoaded = !!preview;

  return (
    <div
      className={`rounded-2xl border p-5 shadow-2xs transition-all flex flex-col justify-between ${
        isLoaded ? 'bg-white border-emerald-300 ring-1 ring-emerald-100' : 'bg-white border-gray-200'
      }`}
    >
      <div>
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
              {model.bu}
            </span>
            <h3 className="text-sm font-bold text-gray-900 mt-0.5">{model.title}</h3>
            <p className="text-xs text-gray-500 mt-1">{model.subtitle}</p>
          </div>
          <div
            className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
              isLoaded ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-50 text-gray-400'
            }`}
          >
            {isLoaded ? <CheckCircle2 className="w-4 h-4" /> : <FileSpreadsheet className="w-4 h-4" />}
          </div>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.csv"
          className="hidden"
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.currentTarget.value = '';
          }} name="src_components_admin_goalimportpage_tsx_input_2"
        />

        {isLoaded ? (
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between gap-2 bg-emerald-50/70 border border-emerald-100 rounded-xl p-3">
              <div className="min-w-0">
                <p className="text-xs font-bold text-emerald-900 truncate">{preview.fileName}</p>
                <p className="text-[11px] text-emerald-700 mt-0.5">
                  {preview.rowCount
                    ? `${preview.rowCount} dias · ${formatDate(preview.startDate)} → ${formatDate(preview.endDate)}`
                    : 'Importado sem dados · sem meta neste período'}
                </p>
              </div>
              <button
                onClick={onRemove}
                className="p-1.5 text-emerald-700 hover:bg-white rounded-lg transition-colors cursor-pointer"
                title="Remover arquivo"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="rounded-xl bg-gray-50 p-2 border border-gray-100">
                <span className="text-[10px] uppercase font-bold text-gray-400 block">Meta Total</span>
                <span className="text-sm font-bold text-blue-700">
                  {formatNumber(preview.rows.reduce((s, r) => s + (r.target || 0), 0))}
                </span>
              </div>
              <div className="rounded-xl bg-gray-50 p-2 border border-gray-100">
                <span className="text-[10px] uppercase font-bold text-gray-400 block">Realizado</span>
                <span className="text-sm font-bold text-emerald-700">
                  {formatNumber(preview.rows.reduce((s, r) => s + (r.actual ?? 0), 0))}
                </span>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={onPreview}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-blue-700 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" /> Ver dados
              </button>
              <button
                onClick={onSelect}
                disabled={loading}
                className="px-3 py-2 text-xs font-bold text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50 cursor-pointer"
              >
                Trocar
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={onSelect}
            disabled={loading}
            className="mt-4 w-full border-2 border-dashed border-gray-200 hover:border-blue-400 hover:bg-blue-50/30 rounded-xl p-5 text-center transition-all disabled:opacity-50 cursor-pointer group"
          >
            <Upload className="w-5 h-5 mx-auto text-gray-400 group-hover:text-blue-600 transition-colors" />
            <div className="text-xs font-bold text-gray-700 mt-2">
              {loading ? 'Importando...' : 'Selecionar arquivo'}
            </div>
            <div className="text-[11px] text-gray-400 mt-1">Planilha diária (.xlsx ou .csv)</div>
          </button>
        )}
      </div>
    </div>
  );
};

interface PreviewModalProps {
  preview: StoredPreview;
  onClose: () => void;
}

const PreviewModal: React.FC<PreviewModalProps> = ({ preview, onClose }) => {
  const meta = getModelMetadata(preview.group);

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
      onMouseDown={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col"
        onMouseDown={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-slate-50">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 block">
              {meta.bu} · {meta.title}
            </span>
            <h3 className="text-sm font-bold text-gray-900 mt-0.5">
              Prévia: {preview.fileName}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {preview.rowCount} registros · Período Acadêmico {preview.academicPeriod || '—'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-auto flex-1">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-white border-b border-gray-200">
              <tr>
                <th className="text-left p-2.5 font-bold text-gray-600">Data</th>
                <th className="text-right p-2.5 font-bold text-gray-600">AA (Ano Anterior)</th>
                <th className="text-right p-2.5 font-bold text-gray-600">Meta Oficial</th>
                <th className="text-right p-2.5 font-bold text-gray-600">Realizado</th>
                <th className="text-right p-2.5 font-bold text-gray-600">Atingimento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {preview.rows.slice(0, 150).map((r, i) => {
                const dayPct = r.target && r.target > 0 && r.actual != null ? Math.round((r.actual / r.target) * 100) : null;
                return (
                  <tr key={`${r.date}-${i}`} className="hover:bg-slate-50/70">
                    <td className="p-2.5 font-semibold text-gray-800">{formatDate(r.date)}</td>
                    <td className="p-2.5 text-right text-gray-500">{formatNumber(r.aa)}</td>
                    <td className="p-2.5 text-right font-bold text-blue-700">{formatNumber(r.target)}</td>
                    <td className="p-2.5 text-right font-bold text-emerald-700">{formatNumber(r.actual)}</td>
                    <td className="p-2.5 text-right font-semibold text-slate-700">
                      {dayPct !== null ? `${dayPct}%` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {preview.rows.length > 150 && (
            <p className="text-[11px] text-gray-400 mt-3 text-center">
              Mostrando os primeiros 150 dias da planilha importada.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
