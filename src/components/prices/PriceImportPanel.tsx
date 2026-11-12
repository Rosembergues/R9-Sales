import React, { useMemo, useRef, useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, FileSpreadsheet, Loader2, Upload, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ParsedPriceFile, courseKey, formatIsoDate, parsePriceFile, weekStartOf } from '../../lib/priceComparison';
import { PriceImport, StoredPriceRow, describePriceError, savePriceImport } from '../../lib/priceComparisonService';
import { PriceSnapshotTable } from './PriceSnapshotTable';
import { todayLocalIso } from '../../lib/dates';
import { errorText } from '../../lib/errors';

interface PriceImportPanelProps {
  threshold: number;
  latestImport: PriceImport | null;
  latestRows: StoredPriceRow[];
  activeImports: PriceImport[];
  onSaved: () => void;
}

export const PriceImportPanel: React.FC<PriceImportPanelProps> = ({ threshold, latestImport, latestRows, activeImports, onSaved }) => {
  const { currentUser } = useAuth();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<ParsedPriceFile | null>(null);
  const [referenceDate, setReferenceDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setSuccess(null);
    setParsing(true);
    try {
      const result = await parsePriceFile(file);
      setParsed(result);
      setReferenceDate(result.referenceDate || todayLocalIso());
    } catch (e) {
      setError(errorText(e, 'Não consegui ler a planilha.'));
    } finally {
      setParsing(false);
    }
  };

  /** O que muda em relação à última atualização vigente. */
  const changes = useMemo(() => {
    if (!parsed || !latestRows.length) return null;
    const before = new Map(latestRows.map(r => [courseKey(r), r]));
    const after = new Map(parsed.rows.map(r => [courseKey(r), r]));
    let ourChanged = 0;
    let competitorChanged = 0;
    after.forEach((row, key) => {
      const prev = before.get(key);
      if (!prev) return;
      if (Math.abs((row.our_price ?? 0) - (prev.our_price ?? 0)) >= 0.01) ourChanged += 1;
      row.competitors.forEach(c => {
        const p = prev.competitors.find(x => x.name === c.name);
        if ((p?.price_to ?? null) !== (c.price_to ?? null)) competitorChanged += 1;
      });
    });
    const added = Array.from(after.keys()).filter(k => !before.has(k)).length;
    const removed = Array.from(before.keys()).filter(k => !after.has(k)).length;
    return { ourChanged, competitorChanged, added, removed };
  }, [parsed, latestRows]);

  const sameWeekImport = useMemo(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(referenceDate)) return null;
    const week = weekStartOf(referenceDate);
    return activeImports.find(i => i.reference_week === week) || null;
  }, [referenceDate, activeImports]);

  const olderThanLatest = latestImport && referenceDate && referenceDate < latestImport.reference_date;
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(referenceDate);
  const canSave = parsed && !parsed.errors.length && parsed.rows.length > 0 && validDate && !saving;

  const handleSave = async () => {
    if (!parsed || !canSave) return;
    setSaving(true);
    setError(null);
    try {
      await savePriceImport({
        referenceDate,
        campus: parsed.campus,
        fileName: parsed.fileName,
        rows: parsed.rows,
        importedBy: currentUser?.id,
        importedByName: currentUser?.name || currentUser?.email || null,
      });
      setSuccess(`Planilha de ${formatIsoDate(referenceDate)} gravada com ${parsed.rows.length} cursos.`);
      setParsed(null);
      onSaved();
    } catch (e) {
      setError(describePriceError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {success && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
          <CheckCircle2 className="w-4 h-4" /> {success}
        </div>
      )}
      {error && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> <span>{error}</span>
        </div>
      )}

      {!parsed && (
        <div
          onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={e => { e.preventDefault(); setIsDragging(false); handleFile(e.dataTransfer.files?.[0]); }}
          onClick={() => inputRef.current?.click()}
          className={`cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition-colors ${isDragging ? 'border-[#0052cc] bg-blue-50' : 'border-slate-300 bg-white hover:border-[#0052cc] hover:bg-blue-50/40'}`}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={e => { handleFile(e.target.files?.[0]); e.target.value = ''; }}
          />
          {parsing ? (
            <Loader2 className="w-8 h-8 text-[#0052cc] mx-auto animate-spin" />
          ) : (
            <Upload className="w-8 h-8 text-[#0052cc] mx-auto" />
          )}
          <p className="mt-3 text-sm font-bold text-slate-800">Arraste a planilha da Análise da Concorrência</p>
          <p className="text-xs text-slate-500 mt-1">
            ou clique para escolher o arquivo .xlsx. A aba com "NOME DO CURSO" é lida automaticamente.
          </p>
        </div>
      )}

      {parsed && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900 truncate">{parsed.fileName}</p>
                  <p className="text-[11px] text-slate-500">
                    Aba "{parsed.sheetName}" · {parsed.rows.length} cursos · {parsed.competitorNames.length} concorrentes ({parsed.competitorNames.join(', ')})
                    {parsed.campus ? ` · ${parsed.campus}` : ''}
                  </p>
                </div>
              </div>
              <button onClick={() => setParsed(null)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer" title="Descartar arquivo">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <label className="block">
                <span className="text-[11px] font-semibold text-slate-500">Data da atualização</span>
                <input
                  type="date"
                  value={referenceDate}
                  onChange={e => setReferenceDate(e.target.value)}
                  className="mt-1 w-full px-2.5 py-2 text-xs rounded-lg border border-slate-200"
                />
              </label>
              <InfoBox label="Última atualização vigente" value={latestImport ? formatIsoDate(latestImport.reference_date) : 'nenhuma ainda'} />
              <InfoBox
                label="Nosso preço mudou em"
                value={changes ? `${changes.ourChanged} curso(s)` : '—'}
              />
              <InfoBox
                label="Preços de concorrentes mudaram"
                value={changes ? `${changes.competitorChanged} oferta(s)` : '—'}
                hint={changes && (changes.added || changes.removed) ? `${changes.added} curso(s) novo(s) · ${changes.removed} fora da planilha` : undefined}
              />
            </div>

            {(parsed.errors.length > 0 || parsed.warnings.length > 0 || sameWeekImport || olderThanLatest) && (
              <div className="space-y-1.5">
                {parsed.errors.map(msg => (
                  <p key={msg} className="flex items-start gap-1.5 text-xs text-red-700"><AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />{msg}</p>
                ))}
                {sameWeekImport && (
                  <p className="flex items-start gap-1.5 text-xs text-amber-700">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    Já existe uma atualização nesta semana ({formatIsoDate(sameWeekImport.reference_date)}, {sameWeekImport.file_name}). Ela será substituída por esta e continuará no histórico de envios.
                  </p>
                )}
                {olderThanLatest && (
                  <p className="flex items-start gap-1.5 text-xs text-amber-700">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    Esta data é anterior à última atualização. Ela entra no histórico, mas a tela principal continua mostrando {formatIsoDate(latestImport!.reference_date)}.
                  </p>
                )}
                {parsed.warnings.map(msg => (
                  <p key={msg} className="flex items-start gap-1.5 text-xs text-amber-700"><AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />{msg}</p>
                ))}
              </div>
            )}

            <div className="flex flex-wrap justify-end gap-2">
              <button onClick={() => setParsed(null)} className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer">
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={!canSave}
                className="px-4 py-2 bg-[#0052cc] hover:bg-[#00478f] disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Gravar atualização de {validDate ? formatIsoDate(referenceDate) : '—'}
              </button>
            </div>
          </div>

          <div>
            <p className="text-xs font-bold text-slate-700 mb-2">Conferência: como a tabela vai ficar</p>
            <PriceSnapshotTable rows={parsed.rows} previousRows={latestRows} threshold={threshold} compact />
          </div>
        </div>
      )}
    </div>
  );
};

const InfoBox: React.FC<{ label: string; value: string; hint?: string }> = ({ label, value, hint }) => (
  <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
    <p className="text-[11px] font-semibold text-slate-500">{label}</p>
    <p className="text-sm font-bold text-slate-900 mt-0.5">{value}</p>
    {hint && <p className="text-[10px] text-slate-400">{hint}</p>}
  </div>
);
