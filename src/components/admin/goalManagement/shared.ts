/** Tipos e auxiliares da tela Gerenciar Metas. */
import { BuKey } from '../../../lib/goalWeights';
import { toLocalIso } from '../../../lib/dates';

export interface GoalManagementPageProps {
  onBackToPlanner?: () => void;
}

export type ConfigType = 'mensal' | 'semanal';

export interface TeamConfig {
  monthlyTarget: number;
  weeklyTarget: number;
  weeklyGap: number;
  weekStart: string;
  weekEnd: string;
  academicPeriod: string;
}

export const emptyTeamConfig = (): TeamConfig => ({
  monthlyTarget: 0,
  weeklyTarget: 0,
  weeklyGap: 0,
  weekStart: '',
  weekEnd: '',
  academicPeriod: '2026.3',
});

export const getMonthBounds = (year: number, month: number) => ({
  start: toLocalIso(new Date(year, month - 1, 1)),
  end: toLocalIso(new Date(year, month, 0)),
});

export const getWeekBounds = (year: number, month: number) => {
  const today = new Date();
  const base =
    today.getFullYear() === year && today.getMonth() + 1 === month
      ? new Date(today)
      : new Date(year, month - 1, 1);
  const day = base.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const start = new Date(base);
  start.setDate(base.getDate() + mondayOffset);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  // Semana segunda a domingo, cortada no mês. Compara texto aaaa-mm-dd: converter
  // "2026-11-01" com new Date() cai em 31/10 às 21h no horário de Brasília.
  const monthBounds = getMonthBounds(year, month);
  const startIso = toLocalIso(start);
  const endIso = toLocalIso(end);
  return {
    start: startIso < monthBounds.start ? monthBounds.start : startIso,
    end: endIso > monthBounds.end ? monthBounds.end : endIso,
  };
};

export const BU_LABEL: Record<BuKey, string> = {
  bu_presencial: 'BU Presencial',
  bu_digital: 'BU Digital',
  pos: 'Pós-Graduação',
  tecnico: 'Curso Técnico',
};
export const BU_COLOR: Record<BuKey, string> = {
  bu_presencial: 'text-blue-700',
  bu_digital: 'text-emerald-700',
  pos: 'text-purple-700',
  tecnico: 'text-amber-700',
};

export const toInt = (value: string | number | undefined | null) =>
  Math.max(0, Math.round(Number(value) || 0));
