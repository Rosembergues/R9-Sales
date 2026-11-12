/** Conferência antes de gravar: um cartão por arquivo, com "antes × depois" e erros que bloqueiam. */
import React from 'react';
import { CheckCircle2, FileSpreadsheet, X, AlertCircle, AlertTriangle, Trash2, Loader2, ArrowRight } from 'lucide-react';
import { GoalImportGroup, totalsOf, TEACHING_MODELS } from '../../../lib/goalImport';
import { formatDate, formatNumber, ReviewItem, itemBlockingErrors } from './shared';

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

export const ReviewModal: React.FC<ReviewModalProps> = ({ items, periods, onChange, onRemove, onConfirm, onClose }) => {
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
