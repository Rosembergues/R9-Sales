/** Prévia dia a dia de uma importação. */
import React from 'react';
import { X } from 'lucide-react';
import { getModelMetadata } from '../../../lib/goalImport';
import { StoredPreview, formatDate, formatNumber } from './shared';

interface PreviewModalProps {
  preview: StoredPreview;
  onClose: () => void;
}

export const PreviewModal: React.FC<PreviewModalProps> = ({ preview, onClose }) => {
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
