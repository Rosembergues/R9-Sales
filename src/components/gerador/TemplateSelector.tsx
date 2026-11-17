import React from 'react';
import { DEFAULT_TEMPLATES } from '../../data/templates';

interface TemplateSelectorProps {
  activeTemplateId?: string;
  onSelectTemplate: (templateId: string) => void;
}

export const TemplateSelector: React.FC<TemplateSelectorProps> = ({
  activeTemplateId,
  onSelectTemplate,
}) => {
  return (
    <div className="bg-slate-50/90 border border-slate-200 p-4 rounded-xl space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-slate-800">
          <span className="material-symbols-outlined text-indigo-600 text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>
            dashboard_customize
          </span>
          <span className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
            MODELOS PRONTOS DE E-MAIL:
          </span>
        </div>
        <span className="text-[11px] text-slate-500 font-medium">
          Clique em um modelo para carregar a estrutura pronta de e-mail no Gerador Visual
        </span>
      </div>

      <div className="flex flex-wrap gap-2.5 items-center">
        {DEFAULT_TEMPLATES.map((tmpl) => {
          const isActive = activeTemplateId === tmpl.id;
          return (
            <button
              key={tmpl.id}
              type="button"
              onClick={() => onSelectTemplate(tmpl.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-bold text-xs uppercase transition-all active:scale-95 cursor-pointer ${
                isActive
                  ? 'bg-blue-600 text-white shadow-xs ring-2 ring-blue-400 ring-offset-1'
                  : 'bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 hover:border-blue-300 shadow-2xs'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">
                {tmpl.id === 'padrao' && 'description'}
                {tmpl.id === 'estacio-matricula' && 'local_offer'}
                {tmpl.id === 'estacio-boleto' && 'receipt_long'}
                {tmpl.id === 'documentacao' && 'folder_shared'}
                {!['padrao', 'estacio-matricula', 'estacio-boleto', 'documentacao'].includes(tmpl.id) && 'draft'}
              </span>
              <span>{tmpl.name}</span>
              {isActive && (
                <span className="w-2.5 h-2.5 bg-white rounded-full ml-1 animate-pulse" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
