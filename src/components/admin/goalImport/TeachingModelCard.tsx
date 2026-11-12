/** Cartão de uma modalidade: arquivo vigente, totais e botões de ver/limpar. */
import React from 'react';
import { CheckCircle2, FileSpreadsheet, Upload, Trash2, Eye } from 'lucide-react';
import { ModelMetadata } from '../../../lib/goalImport';
import { StoredPreview, formatDate, formatNumber } from './shared';

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

export const TeachingModelCard: React.FC<TeachingModelCardProps> = ({
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
