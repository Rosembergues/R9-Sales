import '../planner.css';
import type { PlannerProps } from './planner/shared';
export type { PlannerSection } from './planner/shared';
import { usePlannerData } from './planner/usePlannerData';
import { usePlannerActions } from './planner/usePlannerActions';
import PlannerHeader from './planner/PlannerHeader';
import PlannerBody from './planner/PlannerBody';
import PlannerModals from './planner/PlannerModals';

/** Planejamento da equipe. A navegação vem do menu lateral do R9 Hub (`section`). */
export default function Planner(props: PlannerProps) {
  const st = usePlannerActions(props, usePlannerData(props));
  return (
    <div className={`r9-planner-shell h-[calc(100dvh-2rem)] min-h-[620px] w-full flex flex-col bg-white overflow-hidden select-none font-sans text-zinc-900 rounded-2xl border border-slate-200 shadow-sm`}>
      {/* Cabeçalho único: título + período à esquerda; visão, filtros, fila e criação à direita */}
      <PlannerHeader st={st} />

      {/* Calendário ou a tela da seção escolhida */}
      <PlannerBody st={st} />

      {/* Janelas: detalhe, cadastro, conclusão e aviso */}
      <PlannerModals st={st} />
    </div>
  );
}
