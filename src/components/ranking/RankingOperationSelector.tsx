import React from 'react';
import { BookOpen, GraduationCap, Laptop, Layers, Monitor, Wrench } from 'lucide-react';
import { RANKING_OPERATION_OPTIONS, type RankingOperation } from './rankingUtils';

interface RankingOperationSelectorProps {
  value: RankingOperation;
  onChange: (value: RankingOperation) => void;
  tone?: 'blue' | 'purple';
}

const icons = {
  todos_produtos: Layers,
  graduacao_total: GraduationCap,
  bu_presencial: BookOpen,
  bu_digital: Monitor,
  pos: Laptop,
  tecnico: Wrench,
};

export const RankingOperationSelector: React.FC<RankingOperationSelectorProps> = ({
  value,
  onChange,
  tone = 'blue',
}) => {
  const activeClasses = tone === 'purple'
    ? 'border-purple-600 bg-purple-50 text-purple-800 ring-1 ring-purple-200'
    : 'border-blue-600 bg-blue-50 text-blue-800 ring-1 ring-blue-200';

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4 shadow-xs" aria-label="Operação do ranking">
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Ranking por operação</h3>
          <p className="text-xs text-slate-500">Selecione uma visão para comparar consultores por recorte de produto.</p>
        </div>
        <p className="text-[11px] text-slate-400">A classificação e as metas acompanham a seleção.</p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-3">
        {RANKING_OPERATION_OPTIONS.map((option) => {
          const Icon = icons[option.value];
          const active = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(option.value)}
              className={`flex min-h-[68px] items-start gap-2 rounded-xl border px-3 py-2.5 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-blue-300 ${
                active ? activeClasses : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${active ? (tone === 'purple' ? 'text-purple-700' : 'text-blue-700') : 'text-slate-400'}`} />
              <span className="min-w-0">
                <span className="block text-xs font-bold leading-4">{option.label}</span>
                <span className={`mt-1 block text-[10px] leading-3 ${active ? 'opacity-80' : 'text-slate-400'}`}>{option.description}</span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
};
