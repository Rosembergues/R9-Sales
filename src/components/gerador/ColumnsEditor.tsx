import React, { useEffect, useRef, useState } from 'react';
import type { ColumnCell, EmailBlock } from '../../types';
import { RichTextEditor } from '../RichTextEditor';
import { ImagePlus, Loader2, Trash2 } from 'lucide-react';

interface ColumnsEditorProps {
  block: EmailBlock;
  onChange: (props: Partial<EmailBlock>) => void;
  /** Uploads (and optimizes) an image file and returns its public URL, or null on failure. */
  onUploadImage: (file: File) => Promise<string | null>;
}

/** Adds https:// when the user types "www.site.com" so the link isn't discarded as invalid. */
export function normalizeLinkInput(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/^(https?:|mailto:|tel:|\{\{)/i.test(trimmed)) return trimmed;
  if (/^[\w-]+(\.[\w-]+)+/.test(trimmed)) return `https://${trimmed}`;
  return trimmed;
}

/** Text input that only commits on blur/Enter, so half-typed URLs aren't rejected while typing. */
const DraftInput: React.FC<{
  value: string;
  onCommit: (value: string) => void;
  placeholder?: string;
  mono?: boolean;
  normalize?: (value: string) => string;
}> = ({ value, onCommit, placeholder, mono, normalize }) => {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => {
    const next = normalize ? normalize(draft) : draft;
    if (next !== value) onCommit(next);
    else setDraft(value);
  };
  return (
    <input
      type="text"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commit();
        }
      }}
      placeholder={placeholder}
      className={`w-full p-2 rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 ${mono ? 'font-mono' : ''}`}
    />
  );
};

export const ColumnsEditor: React.FC<ColumnsEditorProps> = ({ block, onChange, onUploadImage }) => {
  const columns = block.columns && block.columns.length ? block.columns : [{}, {}];
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const uploadTargetRef = useRef<number | null>(null);

  const updateCell = (index: number, patch: Partial<ColumnCell>) => {
    onChange({ columns: columns.map((cell, i) => (i === index ? { ...cell, ...patch } : cell)) });
  };

  const setCount = (count: number) => {
    if (count === columns.length) return;
    const next = columns.slice(0, count);
    while (next.length < count) next.push({ text: `<b>Item ${next.length + 1}</b><br/>Descrição curta.` });
    onChange({ columns: next });
  };

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const index = uploadTargetRef.current;
    event.target.value = '';
    if (!file || index === null) return;
    setUploadingIndex(index);
    try {
      const url = await onUploadImage(file);
      if (url) updateCell(index, { imageUrl: url });
    } finally {
      setUploadingIndex(null);
    }
  };

  return (
    <div className="space-y-3">
      <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={handleFile} />

      <div>
        <label className="font-bold text-slate-700 block mb-1">Quantidade de colunas:</label>
        <div className="grid grid-cols-2 gap-1.5">
          {[2, 3].map((count) => (
            <button
              key={count}
              type="button"
              onClick={() => setCount(count)}
              className={`py-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${columns.length === count ? 'bg-indigo-50 border-indigo-500 text-indigo-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            >
              {count} colunas
            </button>
          ))}
        </div>
        <p className="text-[10px] text-slate-400 mt-1">No celular, as colunas ficam uma embaixo da outra.</p>
      </div>

      {columns.map((cell, index) => (
        <div key={index} className="rounded-xl border border-slate-200 p-3 space-y-2 bg-slate-50/40">
          <p className="text-[11px] font-black uppercase tracking-wider text-indigo-700/80">Coluna {index + 1}</p>

          {cell.imageUrl ? (
            <div className="flex items-center gap-2">
              <img src={cell.imageUrl} alt={cell.imageAlt || ''} className="w-14 h-14 object-cover rounded-lg border border-slate-200 bg-white" />
              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => { uploadTargetRef.current = index; fileInputRef.current?.click(); }}
                  className="px-2 py-1 rounded-md bg-white border border-slate-200 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  {uploadingIndex === index ? 'Enviando…' : 'Trocar imagem'}
                </button>
                <button
                  type="button"
                  onClick={() => updateCell(index, { imageUrl: '', imageLink: '' })}
                  className="px-2 py-1 rounded-md text-[11px] font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" /> Remover
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => { uploadTargetRef.current = index; fileInputRef.current?.click(); }}
              disabled={uploadingIndex !== null}
              className="w-full py-2 rounded-lg border-2 border-dashed border-slate-300 hover:border-indigo-400 text-[11px] font-semibold text-slate-600 flex items-center justify-center gap-1.5 cursor-pointer bg-white"
            >
              {uploadingIndex === index ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImagePlus className="w-3.5 h-3.5" />}
              {uploadingIndex === index ? 'Enviando imagem…' : 'Adicionar imagem (opcional)'}
            </button>
          )}

          {cell.imageUrl && (
            <>
              <DraftInput value={cell.imageAlt || ''} onCommit={(v) => updateCell(index, { imageAlt: v })} placeholder="Descrição da imagem (texto alternativo)" />
              <DraftInput value={cell.imageLink || ''} onCommit={(v) => updateCell(index, { imageLink: v })} normalize={normalizeLinkInput} placeholder="Link ao clicar na imagem (opcional)" mono />
            </>
          )}

          <div className="border border-slate-300 rounded-lg overflow-hidden bg-white">
            <RichTextEditor
              value={cell.text || ''}
              onChange={(value) => updateCell(index, { text: value })}
              placeholder="Texto da coluna"
              minHeight="60px"
              className="p-2 text-xs leading-relaxed focus:outline-none bg-white"
            />
          </div>

          <div className="grid grid-cols-1 gap-1.5">
            <DraftInput value={cell.buttonLabel || ''} onCommit={(v) => updateCell(index, { buttonLabel: v })} placeholder="Texto do botão (vazio = sem botão)" />
            {cell.buttonLabel && (
              <DraftInput value={cell.buttonUrl || ''} onCommit={(v) => updateCell(index, { buttonUrl: v })} normalize={normalizeLinkInput} placeholder="https://link-do-botao.com.br" mono />
            )}
          </div>
        </div>
      ))}

      <div className="flex items-center justify-between pt-1">
        <label className="font-bold text-slate-700">Cor dos botões:</label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={block.buttonBgColor || '#4f46e5'}
            onChange={(e) => onChange({ buttonBgColor: e.target.value })}
            className="w-6 h-6 rounded cursor-pointer border border-slate-300 p-0"
            title="Fundo do botão"
          />
          <input
            type="color"
            value={block.buttonTextColor || '#ffffff'}
            onChange={(e) => onChange({ buttonTextColor: e.target.value })}
            className="w-6 h-6 rounded cursor-pointer border border-slate-300 p-0"
            title="Texto do botão"
          />
        </div>
      </div>
      <div className="flex items-center justify-between">
        <label className="font-bold text-slate-700">Cor de fundo do bloco:</label>
        <input
          type="color"
          value={block.bgColor || '#ffffff'}
          onChange={(e) => onChange({ bgColor: e.target.value })}
          className="w-6 h-6 rounded cursor-pointer border border-slate-300 p-0"
        />
      </div>
    </div>
  );
};
