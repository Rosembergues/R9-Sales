/** Tipos do Planejamento. */
export type PlannerSection = 'calendar' | 'queue' | 'my_tasks' | 'tasks' | 'tags' | 'summary';

export interface PlannerProps {
  user?: {
    id?: string;
    email?: string;
    user_metadata?: { full_name?: string; nome?: string };
    [key: string]: unknown;
  };
  /** Papel de visualização controlado pelo seletor global do R9 Hub. */
  viewRole?: 'admin' | 'membro';
  /** Seção escolhida no menu lateral do R9 Hub (o Planejamento não tem menu próprio). */
  section?: PlannerSection;
  onSectionChange?: (section: PlannerSection) => void;
}

/** Quem aparece no calendário: a equipe toda ou só as tarefas de quem está logado. */
export type NavFilter = 'all' | 'my_tasks';
