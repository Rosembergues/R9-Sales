import React, { useRef, useState } from 'react';
import { CheckCircle2, FileSpreadsheet, Loader2, Upload, X } from 'lucide-react';

interface Props {
  label: string;
  hint: string;
  accept: string;
  file: File | null;
  busy?: boolean;
  summary?: React.ReactNode;
  onFile: (file: File) => void;
  onClear: () => void;
}

/** Área para soltar/selecionar um arquivo, com estado de carregado. */
export const FileDrop: React.FC<Props> = ({ label, hint, accept, file, busy, summary, onFile, onClear }) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-black uppercase tracking-wide text-slate-700">{label}</p>
      {file ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-3.5 py-3 flex items-start gap-3">
          {busy ? (
            <Loader2 className="w-4 h-4 text-[#0052cc] animate-spin mt-0.5 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-slate-800 truncate">{file.name}</p>
            <div className="text-[11px] text-slate-500 mt-0.5">{busy ? 'Lendo o arquivo...' : summary}</div>
          </div>
          <button
            onClick={onClear}
            disabled={busy}
            className="text-slate-400 hover:text-red-500 transition-colors cursor-pointer disabled:opacity-40"
            title="Remover arquivo"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const f = e.dataTransfer.files?.[0];
            if (f) onFile(f);
          }}
          onClick={() => inputRef.current?.click()}
          className={`rounded-xl border-2 border-dashed px-4 py-5 flex items-center gap-3 cursor-pointer transition-colors ${
            dragging ? 'border-[#0052cc] bg-blue-50' : 'border-gray-300 bg-white hover:bg-gray-50'
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
              e.target.value = '';
            }}
          />
          <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
            {dragging ? <Upload className="w-4 h-4 text-[#0052cc]" /> : <FileSpreadsheet className="w-4 h-4 text-slate-400" />}
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-600">Arraste o arquivo aqui ou clique para selecionar</p>
            <p className="text-[11px] text-slate-400">{hint}</p>
          </div>
        </div>
      )}
    </div>
  );
};
