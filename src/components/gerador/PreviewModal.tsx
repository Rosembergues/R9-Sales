import React, { useEffect, useMemo, useState } from 'react';
import { Moon, Sun, X } from 'lucide-react';
import { simulateDarkMode } from '../../utils/darkModeSimulator';

interface PreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Mesmo HTML que será exportado, para que o que se vê aqui seja o que se envia. */
  html: string;
  device: 'desktop' | 'mobile';
}

export const PreviewModal: React.FC<PreviewModalProps> = ({ isOpen, onClose, html, device }) => {
  const [scheme, setScheme] = useState<'light' | 'dark'>('light');
  const darkHtml = useMemo(() => (isOpen && scheme === 'dark' ? simulateDarkMode(html) : ''), [isOpen, scheme, html]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isDark = scheme === 'dark';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Visualização do e-mail"
        className="bg-white border border-slate-200 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-scaleUp"
      >
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-slate-200">
          <h2 className="text-sm font-bold text-slate-900">Visualização do e-mail</h2>
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs font-medium border border-slate-200/80" role="group" aria-label="Tema da visualização">
              <button
                type="button"
                onClick={() => setScheme('light')}
                aria-pressed={!isDark}
                className={`px-2.5 py-1 rounded-md flex items-center gap-1.5 cursor-pointer ${!isDark ? 'bg-white text-indigo-700 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'}`}
              >
                <Sun className="w-3.5 h-3.5" /> Claro
              </button>
              <button
                type="button"
                onClick={() => setScheme('dark')}
                aria-pressed={isDark}
                className={`px-2.5 py-1 rounded-md flex items-center gap-1.5 cursor-pointer ${isDark ? 'bg-white text-indigo-700 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'}`}
              >
                <Moon className="w-3.5 h-3.5" /> Modo escuro
              </button>
            </div>
            <button type="button" onClick={onClose} aria-label="Fechar visualização" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        {isDark && (
          <p className="px-5 py-2 text-[11px] text-slate-600 bg-amber-50 border-b border-amber-100">
            Simulação de como o Gmail e o Outlook escurecem o e-mail para quem usa modo escuro: fundos claros ficam escuros e textos escuros ficam claros. Imagens não mudam, então confira se o logo e os textos dentro de imagens continuam visíveis.
          </p>
        )}
        <div className={`flex-1 overflow-auto p-4 md:p-6 flex justify-center items-start ${isDark ? 'bg-neutral-900' : 'bg-slate-50'}`}>
          <div className={`w-full rounded-xl border overflow-hidden ${isDark ? 'border-neutral-700 bg-neutral-900' : 'border-slate-200 bg-white'} ${device === 'mobile' ? 'max-w-[375px]' : 'max-w-[700px]'}`}>
            <iframe
              title="Visualização fiel do e-mail"
              srcDoc={isDark ? darkHtml : html}
              sandbox=""
              className={`w-full h-[620px] border-0 ${isDark ? 'bg-neutral-900' : 'bg-white'}`}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
