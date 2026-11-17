import React, { useEffect, useState } from 'react';
import { BookmarkPlus, X } from 'lucide-react';

interface SaveBlockModalProps {
  isOpen: boolean;
  defaultName: string;
  onClose: () => void;
  onSave: (name: string) => Promise<void>;
}

/** Asks for a name before saving the selected block to "Meus blocos". */
export const SaveBlockModal: React.FC<SaveBlockModalProps> = ({ isOpen, defaultName, onClose, onSave }) => {
  const [name, setName] = useState(defaultName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setName(defaultName);
      setError(null);
    }
  }, [isOpen, defaultName]);

  if (!isOpen) return null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setError('Dê um nome ao bloco.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(name.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível salvar o bloco.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <form onSubmit={submit} role="dialog" aria-modal="true" aria-label="Salvar bloco" className="bg-white border border-slate-200 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-scaleUp">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-800">
            <BookmarkPlus className="w-4 h-4 text-indigo-600" />
            <h2 className="text-sm font-bold">Salvar em Meus blocos</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-2 text-xs">
          <label htmlFor="saved-block-name" className="font-bold text-slate-700 block">Nome do bloco</label>
          <input
            id="saved-block-name"
            autoFocus
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Rodapé padrão da unidade"
            className="w-full p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
          <p className="text-[11px] text-slate-500">Depois, use em qualquer e-mail pelo botão "Adicionar bloco", em Meus blocos.</p>
          {error && <p className="text-rose-600">{error}</p>}
        </div>
        <div className="px-5 py-3 border-t border-slate-200 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer">Cancelar</button>
          <button type="submit" disabled={saving} className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg cursor-pointer disabled:opacity-60">
            {saving ? 'Salvando…' : 'Salvar bloco'}
          </button>
        </div>
      </form>
    </div>
  );
};
