import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2, FileSpreadsheet, Info, Loader2, Upload, X,
  AlertCircle, ChevronRight, Layers, Calendar, BarChart3, Trash2, Eye
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import {
  GoalFilePreview,
  GoalImportGroup,
  ParsedGoalRow,
  parseGoalFile,
  TEACHING_MODELS,
  ModelMetadata,
  getModelMetadata,
  summarizeImportedGoals
} from '../../lib/goalImport';

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

export const GoalImportPage: React.FC<GoalImportPageProps> = ({ onBackToPlanner }) => {
  const { currentUser } = useAuth();
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const [selectedPeriod, setSelectedPeriod] = useState<string>('2026.3');
  const [availablePeriods, setAvailablePeriods] = useState<string[]>(COMMON_PERIODS);
  const [isAddingPeriod, setIsAddingPeriod] = useState(false);
  const [newPeriodInput, setNewPeriodInput] = useState('');

  const [previews, setPreviews] = useState<Record<string, StoredPreview>>({});
  const [loadingGroup, setLoadingGroup] = useState<string | null>(null);
  const [loadingExisting, setLoadingExisting] = useState(true);
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [selectedPreview, setSelectedPreview] = useState<StoredPreview | null>(null);

  // Group models by section
  const buPresencialModels = useMemo(() => TEACHING_MODELS.filter(m => m.buKey === 'bu_presencial'), []);
  const buDigitalModels = useMemo(() => TEACHING_MODELS.filter(m => m.buKey === 'bu_digital'), []);
  const posModels = useMemo(() => TEACHING_MODELS.filter(m => m.buKey === 'pos'), []);
  const tecnicoModels = useMemo(() => TEACHING_MODELS.filter(m => m.buKey === 'tecnico'), []);

  const loadCurrentImports = useCallback(async (period: string) => {
    setLoadingExisting(true);
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

      const latestByGroup: Record<string, any> = {};
      (imports || []).forEach(item => {
        if (!latestByGroup[item.goal_group]) {
          latestByGroup[item.goal_group] = item;
        }
      });

      const ids = Object.values(latestByGroup).map((i: any) => i.id);
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
      Object.values(latestByGroup).forEach((item: any) => {
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
    } finally {
      setLoadingExisting(false);
    }
  }, []);

  useEffect(() => {
    loadCurrentImports(selectedPeriod);
  }, [selectedPeriod, loadCurrentImports]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 4000);
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

  const handleFile = async (meta: ModelMetadata, file?: File) => {
    if (!file) return;
    setLoadingGroup(meta.id);
    setToast(null);

    try {
      if (!/\.(xlsx|csv)$/i.test(file.name)) {
        throw new Error('Selecione um arquivo .xlsx ou .csv.');
      }

      const parsed = await parseGoalFile(file, meta.id);
      if (!parsed.rowCount) {
        throw new Error(parsed.warnings[0] || 'Não encontrei dados de metas neste arquivo.');
      }

      // We associate the import with the currently selected active academic period
      const effectivePeriod = selectedPeriod || parsed.academicPeriod || '2026.3';

      // 1. Mark existing active import for THIS (period, group) as replaced
      const previous = previews[meta.id];
      if (previous?.importId) {
        await supabase
          .from('goal_imports')
          .update({ status: 'replaced' })
          .eq('id', previous.importId);
      } else {
        await supabase
          .from('goal_imports')
          .update({ status: 'replaced' })
          .eq('academic_period', effectivePeriod)
          .eq('goal_group', meta.id)
          .eq('status', 'active');
      }

      // 2. Insert new import record
      const { data: inserted, error: importError } = await supabase
        .from('goal_imports')
        .insert({
          academic_period: effectivePeriod,
          product: meta.product,
          goal_group: meta.id,
          file_name: file.name,
          imported_by: currentUser?.id || null,
          status: 'active',
        })
        .select('id')
        .single();

      if (importError || !inserted) {
        throw importError || new Error('Não foi possível registrar a importação no Supabase.');
      }

      // 3. Insert daily rows
      const rowsPayload = parsed.rows.map(row => ({
        import_id: inserted.id,
        academic_period: effectivePeriod,
        product: meta.product,
        goal_group: meta.id,
        reference_date: row.date,
        aa: row.aa,
        target: row.target,
        actual: row.actual,
      }));

      const { error: rowsError } = await supabase
        .from('goal_daily_data')
        .insert(rowsPayload);

      if (rowsError) {
        await supabase.from('goal_imports').update({ status: 'cancelled' }).eq('id', inserted.id);
        throw rowsError;
      }

      const preview = buildPreview(
        meta,
        file.name,
        effectivePeriod,
        parsed.rows,
        parsed.filters,
        parsed.warnings,
        inserted.id
      );

      setPreviews(prev => ({ ...prev, [meta.id]: preview }));
      setToast({
        type: 'success',
        message: `${file.name} importado com sucesso para ${meta.title} (${effectivePeriod}).`,
      });
    } catch (error: any) {
      console.error('Erro ao importar metas:', error);
      setToast({
        type: 'error',
        message: error?.message || 'Não foi possível importar o arquivo.',
      });
      await loadCurrentImports(selectedPeriod);
    } finally {
      setLoadingGroup(null);
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
              Importe um arquivo padrão para cada modelo de ensino. Cada modelo armazena suas metas e realizados diários por período acadêmico.
            </p>
          </div>
        </div>

        {/* Academic Period Selector */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-gray-600 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-blue-600" /> Período:
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
                  autoFocus
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
            3 modelos
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {buPresencialModels.map(model => (
            <TeachingModelCard
              key={model.id}
              model={model}
              preview={previews[model.id]}
              loading={loadingGroup === model.id}
              inputRef={el => { inputRefs.current[model.id] = el; }}
              onSelect={() => inputRefs.current[model.id]?.click()}
              onFile={file => handleFile(model, file)}
              onRemove={() => removeFile(model)}
              onPreview={() => setSelectedPreview(previews[model.id])}
            />
          ))}
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
              Modelos 100% online ou semipresenciais digitais (EAD e DLEX/Flex).
            </p>
          </div>
          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200/70">
            2 modelos
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {buDigitalModels.map(model => (
            <TeachingModelCard
              key={model.id}
              model={model}
              preview={previews[model.id]}
              loading={loadingGroup === model.id}
              inputRef={el => { inputRefs.current[model.id] = el; }}
              onSelect={() => inputRefs.current[model.id]?.click()}
              onFile={file => handleFile(model, file)}
              onRemove={() => removeFile(model)}
              onPreview={() => setSelectedPreview(previews[model.id])}
            />
          ))}
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {posModels.map(model => (
            <TeachingModelCard
              key={model.id}
              model={model}
              preview={previews[model.id]}
              loading={loadingGroup === model.id}
              inputRef={el => { inputRefs.current[model.id] = el; }}
              onSelect={() => inputRefs.current[model.id]?.click()}
              onFile={file => handleFile(model, file)}
              onRemove={() => removeFile(model)}
              onPreview={() => setSelectedPreview(previews[model.id])}
            />
          ))}
          {tecnicoModels.map(model => (
            <TeachingModelCard
              key={model.id}
              model={model}
              preview={previews[model.id]}
              loading={loadingGroup === model.id}
              inputRef={el => { inputRefs.current[model.id] = el; }}
              onSelect={() => inputRefs.current[model.id]?.click()}
              onFile={file => handleFile(model, file)}
              onRemove={() => removeFile(model)}
              onPreview={() => setSelectedPreview(previews[model.id])}
            />
          ))}
        </div>
      </section>

      {/* Preview Modal */}
      {selectedPreview && (
        <PreviewModal
          preview={selectedPreview}
          onClose={() => setSelectedPreview(null)}
        />
      )}
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
          }}
        />

        {isLoaded ? (
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between gap-2 bg-emerald-50/70 border border-emerald-100 rounded-xl p-3">
              <div className="min-w-0">
                <p className="text-xs font-bold text-emerald-900 truncate">{preview.fileName}</p>
                <p className="text-[11px] text-emerald-700 mt-0.5">
                  {preview.rowCount} dias · {formatDate(preview.startDate)} → {formatDate(preview.endDate)}
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
