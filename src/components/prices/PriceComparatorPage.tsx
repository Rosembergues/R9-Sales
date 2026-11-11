import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Check, History, Loader2, Pencil, Scale, Upload, Eye } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { DEFAULT_OFFENSE_THRESHOLD_PCT, formatIsoDate } from '../../lib/priceComparison';
import {
  PriceImport,
  StoredPriceRow,
  describePriceError,
  listActivePriceImports,
  loadOffenseThreshold,
  loadPriceRows,
  saveOffenseThreshold,
} from '../../lib/priceComparisonService';
import { PriceSnapshotTable } from './PriceSnapshotTable';
import { PriceImportPanel } from './PriceImportPanel';
import { PriceHistoryPanel } from './PriceHistoryPanel';

interface PriceComparatorPageProps {
  /** Admin (no modo de visualização admin) pode importar e mudar o limite. */
  canManage: boolean;
}

type Tab = 'latest' | 'history' | 'import';

export const PriceComparatorPage: React.FC<PriceComparatorPageProps> = ({ canManage }) => {
  const { currentUser } = useAuth();
  const [tab, setTab] = useState<Tab>('latest');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeImports, setActiveImports] = useState<PriceImport[]>([]);
  const [latestRows, setLatestRows] = useState<StoredPriceRow[]>([]);
  const [previousRows, setPreviousRows] = useState<StoredPriceRow[] | null>(null);
  const [threshold, setThreshold] = useState<number>(DEFAULT_OFFENSE_THRESHOLD_PCT);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [imports, limit] = await Promise.all([listActivePriceImports(), loadOffenseThreshold()]);
      setActiveImports(imports);
      setThreshold(limit);
      const [latest, previous] = await Promise.all([
        imports[0] ? loadPriceRows(imports[0].id) : Promise.resolve([]),
        imports[1] ? loadPriceRows(imports[1].id) : Promise.resolve(null),
      ]);
      setLatestRows(latest);
      setPreviousRows(previous);
    } catch (e) {
      setError(describePriceError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!canManage && tab === 'import') setTab('latest');
  }, [canManage, tab]);

  const latest = activeImports[0] || null;

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-gray-900 font-['Space_Grotesk'] flex items-center gap-2">
            <Scale className="w-4 h-4 text-[#0052cc]" />
            <span>Comparador de Preços</span>
            <span className="text-[10px] font-semibold text-[#0052cc] bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">Presencial</span>
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {latest
              ? <>Última atualização: <b className="text-slate-700">{formatIsoDate(latest.reference_date)}</b> · importada por {latest.imported_by_name || 'admin'} em {new Date(latest.imported_at).toLocaleDateString('pt-BR')}</>
              : 'Nossos preços por curso e turno comparados com a concorrência.'}
          </p>
        </div>
        <ThresholdControl
          value={threshold}
          canEdit={canManage}
          onSave={async v => {
            await saveOffenseThreshold(v, currentUser?.id);
            setThreshold(v);
          }}
        />
      </div>

      <div className="flex gap-1 border-b border-slate-200">
        <TabButton active={tab === 'latest'} onClick={() => setTab('latest')} icon={<Eye className="w-3.5 h-3.5" />} label="Última atualização" />
        <TabButton active={tab === 'history'} onClick={() => setTab('history')} icon={<History className="w-3.5 h-3.5" />} label="Histórico" />
        {canManage && <TabButton active={tab === 'import'} onClick={() => setTab('import')} icon={<Upload className="w-3.5 h-3.5" />} label="Importar planilha" />}
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="py-20 flex justify-center"><Loader2 className="w-6 h-6 text-[#0052cc] animate-spin" /></div>
      ) : (
        <>
          {tab === 'latest' && (
            latest ? (
              <PriceSnapshotTable rows={latestRows} previousRows={previousRows} threshold={threshold} />
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center space-y-3">
                <Scale className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-sm font-bold text-slate-700">Nenhuma atualização de preços ainda</p>
                <p className="text-xs text-slate-500">
                  {canManage ? 'Importe a planilha da Análise da Concorrência para começar.' : 'Assim que um administrador importar a planilha, os preços aparecem aqui.'}
                </p>
                {canManage && (
                  <button onClick={() => setTab('import')} className="px-4 py-2 bg-[#0052cc] hover:bg-[#00478f] text-white text-xs font-bold rounded-xl cursor-pointer">
                    Importar planilha
                  </button>
                )}
              </div>
            )
          )}
          {tab === 'history' && <PriceHistoryPanel activeImports={activeImports} latestRows={latestRows} threshold={threshold} />}
          {tab === 'import' && canManage && (
            <PriceImportPanel
              threshold={threshold}
              latestImport={latest}
              latestRows={latestRows}
              activeImports={activeImports}
              onSaved={async () => {
                await load();
                setTab('latest');
              }}
            />
          )}
        </>
      )}
    </div>
  );
};

const TabButton: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({ active, onClick, icon, label }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 -mb-px transition-colors cursor-pointer ${active ? 'border-[#0052cc] text-[#0052cc]' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
  >
    {icon}{label}
  </button>
);

const ThresholdControl: React.FC<{ value: number; canEdit: boolean; onSave: (v: number) => Promise<void> }> = ({ value, canEdit, onSave }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setDraft(String(value)); }, [value]);

  const submit = async () => {
    const n = Number(draft.replace(',', '.'));
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      setError('Use um valor entre 0 e 100.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(n);
      setEditing(false);
    } catch (e) {
      setError(describePriceError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col items-start lg:items-end gap-1 shrink-0">
      <div className="flex items-center gap-2 text-xs rounded-xl bg-red-50 border border-red-100 px-3 py-2">
        <span className="text-red-700 font-semibold">Ofensa: concorrente</span>
        {editing ? (
          <>
            <input
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') setEditing(false); }}
              autoFocus
              className="w-12 px-1.5 py-0.5 text-xs text-center rounded border border-red-200 bg-white"
            />
            <span className="text-red-700 font-semibold">% ou mais abaixo</span>
            <button onClick={submit} disabled={saving} className="p-1 rounded bg-red-600 text-white hover:bg-red-700 cursor-pointer" title="Salvar limite">
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
            </button>
          </>
        ) : (
          <>
            <b className="text-red-700">{value}%</b>
            <span className="text-red-700 font-semibold">ou mais abaixo</span>
            {canEdit && (
              <button onClick={() => setEditing(true)} className="p-1 rounded text-red-500 hover:bg-red-100 cursor-pointer" title="Alterar limite">
                <Pencil className="w-3 h-3" />
              </button>
            )}
          </>
        )}
      </div>
      {error && <span className="text-[10px] text-red-600">{error}</span>}
    </div>
  );
};
