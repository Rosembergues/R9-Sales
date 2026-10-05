import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Filter, X } from 'lucide-react';

interface ModalityMultiFilterProps {
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  tone?: 'blue' | 'purple';
  label?: string;
  compact?: boolean;
}

export const ModalityMultiFilter: React.FC<ModalityMultiFilterProps> = ({
  options,
  selected,
  onChange,
  tone = 'blue',
  label = 'Modalidade',
  compact = false,
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const toggle = (option: string) => {
    if (selected.includes(option)) {
      onChange(selected.filter(item => item !== option));
    } else {
      onChange([...selected, option]);
    }
  };

  const clear = () => onChange([]);
  const allSelected = selected.length === 0;
  const summary = allSelected
    ? 'Todas'
    : selected.length === 1
      ? selected[0]
      : `${selected.length} selecionadas`;
  const toneClass = tone === 'purple' ? 'text-purple-600' : 'text-blue-600';
  const activeBorder = selected.length > 0
    ? tone === 'purple' ? 'border-purple-200' : 'border-blue-200'
    : 'border-gray-200';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        className={`inline-flex items-center gap-2 rounded-lg bg-white border ${activeBorder} px-2.5 py-1.5 shadow-xs text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <Filter className={`w-3.5 h-3.5 ${toneClass}`} />
        {!compact && <span>{label}:</span>}
        <span className="max-w-[180px] truncate">{summary}</span>
        {selected.length > 0 && (
          <span
            role="button"
            tabIndex={0}
            onClick={(event) => { event.stopPropagation(); clear(); }}
            onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); clear(); } }}
            className="rounded-full p-0.5 hover:bg-gray-100"
            aria-label="Limpar modalidades"
          >
            <X className="w-3 h-3 text-gray-400" />
          </span>
        )}
        <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-64 rounded-xl border border-gray-200 bg-white shadow-xl p-2">
          <div className="flex items-center justify-between px-2 py-1.5 border-b border-gray-100 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Filtrar modalidades</span>
            <button type="button" onClick={clear} className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 cursor-pointer">
              Todas
            </button>
          </div>
          <div className="max-h-64 overflow-y-auto space-y-0.5">
            {options.length === 0 ? (
              <div className="px-2 py-3 text-xs text-gray-400">Nenhuma modalidade no período.</div>
            ) : options.map(option => {
              const checked = selected.includes(option);
              return (
                <label key={option} className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(option)}
                    className="sr-only"
                  />
                  <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${checked ? 'bg-blue-600 border-blue-600' : 'border-gray-300 bg-white'}`}>
                    {checked && <Check className="w-3 h-3 text-white" />}
                  </span>
                  <span className="text-xs font-medium text-gray-700 truncate">{option}</span>
                </label>
              );
            })}
          </div>
          <div className="border-t border-gray-100 mt-1 pt-2 px-2 flex items-center justify-between">
            <span className="text-[10px] text-gray-400">Selecione uma ou várias modalidades</span>
            <button type="button" onClick={() => setOpen(false)} className="text-xs font-bold text-gray-700 hover:text-gray-900 cursor-pointer">Concluir</button>
          </div>
        </div>
      )}
    </div>
  );
};
