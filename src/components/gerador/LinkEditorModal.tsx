import React from 'react';

interface LinkEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  linkText: string;
  setLinkText: (text: string) => void;
  linkUrl: string;
  setLinkUrl: (url: string) => void;
  onSaveLink: () => void;
  onRemoveLink: () => void;
}

export const LinkEditorModal: React.FC<LinkEditorModalProps> = ({
  isOpen,
  onClose,
  linkText,
  setLinkText,
  linkUrl,
  setLinkUrl,
  onSaveLink,
  onRemoveLink,
}) => {
  if (!isOpen) return null;

  return (
    <div className="bg-indigo-50/90 border-2 border-indigo-200 p-3.5 rounded-xl space-y-3 animate-fadeIn">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[18px] text-indigo-600">link</span>
          <span>Inserir / Editar Hiperlink no Texto</span>
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
        >
          ✕ Fechar
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1">
            Texto a ser Exibido no Link:
          </label>
          <input
            type="text"
            value={linkText}
            onChange={(e) => setLinkText(e.target.value)}
            placeholder="Ex: Clique aqui para se matricular"
            className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white"
          />
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1">
            URL de Destino (Link):
          </label>
          <input
            type="text"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="Ex: https://seusite.com.br ou {{var1}}"
            className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white font-mono text-indigo-900 font-medium"
          />
        </div>
      </div>

      {/* Quick Presets for Link URL */}
      <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
        <span className="text-slate-500 font-medium">Atalhos rápidos:</span>
        <button
          type="button"
          onClick={() => setLinkUrl('https://')}
          className="px-2 py-0.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded font-mono text-[10px] cursor-pointer"
        >
          https://
        </button>
        <button
          type="button"
          onClick={() => setLinkUrl('{{var1}}')}
          className="px-2 py-0.5 bg-indigo-100 text-indigo-800 hover:bg-indigo-200 rounded font-mono text-[10px] font-bold cursor-pointer"
        >
          {`{{var1}}`}
        </button>
        <button
          type="button"
          onClick={() => setLinkUrl('{{var2}}')}
          className="px-2 py-0.5 bg-indigo-100 text-indigo-800 hover:bg-indigo-200 rounded font-mono text-[10px] font-bold cursor-pointer"
        >
          {`{{var2}}`}
        </button>
        <button
          type="button"
          onClick={() => setLinkUrl('mailto:')}
          className="px-2 py-0.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded font-mono text-[10px] cursor-pointer"
        >
          mailto:
        </button>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-2 border-t border-indigo-100">
        <button
          type="button"
          onClick={onRemoveLink}
          className="px-3 py-1.5 bg-white hover:bg-red-50 text-red-600 border border-slate-200 hover:border-red-200 text-xs rounded-lg font-bold transition-colors flex items-center gap-1 cursor-pointer"
          title="Remover hiperlink do texto"
        >
          <span className="material-symbols-outlined text-[16px]">link_off</span>
          <span>Remover Link</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 text-xs rounded-lg font-semibold transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onSaveLink}
            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs rounded-lg font-bold transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">check</span>
            <span>Aplicar Link no Texto</span>
          </button>
        </div>
      </div>
    </div>
  );
};
