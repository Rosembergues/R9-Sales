import { toLocalIso } from '../../lib/dates';

/** aaaa-mm-dd no fuso local (mesma função de src/lib/dates). */
export const formatISO = toLocalIso;

/**
 * Retorna a data de hoje formatada em YYYY-MM-DD no fuso local do cliente
 */
export function getTodayISO(): string {
  return formatISO(new Date());
}

export const MONTH_NAMES_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export const WEEKDAYS_PT = [
  'Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira',
  'Quinta-feira', 'Sexta-feira', 'Sábado'
];

export const WEEKDAYS_SHORT_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

/**
 * Retorna os 7 dias da semana (de Segunda a Domingo) para uma data de referência no fuso local
 */
export function getWeekDates(referenceDate: Date): Date[] {
  const y = referenceDate.getFullYear();
  const m = referenceDate.getMonth();
  const d = referenceDate.getDate();
  const date = new Date(y, m, d, 12, 0, 0);
  const day = date.getDay(); // 0 = Domingo, 1 = Segunda, etc.
  
  // Retroceder até a Segunda-feira da semana atual
  const monday = new Date(y, m, d - ((day + 6) % 7), 12, 0, 0);

  const week: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const current = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i, 12, 0, 0);
    week.push(current);
  }
  return week;
}

/**
 * Retorna texto formatado da semana no padrão em português, ex: "18 a 24 de Agosto de 2026"
 */
export function formatWeekInterval(weekDates: Date[]): string {
  if (weekDates.length < 7) return '';
  const first = weekDates[0];
  const last = weekDates[6];

  const firstDay = first.getDate();
  const lastDay = last.getDate();
  const firstMonth = MONTH_NAMES_PT[first.getMonth()];
  const lastMonth = MONTH_NAMES_PT[last.getMonth()];
  const year = last.getFullYear();

  if (first.getMonth() === last.getMonth()) {
    return `${firstDay} a ${lastDay} de ${lastMonth} de ${year}`;
  }
  return `${firstDay} de ${firstMonth} a ${lastDay} de ${lastMonth} de ${year}`;
}

/**
 * Retorna as células do calendário mensal (incluindo dias padding do mês anterior/seguinte)
 */
export interface MonthDayCell {
  date: Date;
  dateString: string; // YYYY-MM-DD
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
}

export function getMonthGrid(year: number, month: number, today: Date): MonthDayCell[] {
  const todayStr = formatISO(today);
  const firstDayOfMonth = new Date(year, month, 1, 12, 0, 0);
  const lastDayOfMonth = new Date(year, month + 1, 0, 12, 0, 0);

  const startDayOfWeek = firstDayOfMonth.getDay(); // 0 = Dom, 1 = Seg...
  const totalDaysInMonth = lastDayOfMonth.getDate();

  const cells: MonthDayCell[] = [];

  // Dias do mês anterior para completar a primeira semana
  const prevMonthLastDay = new Date(year, month, 0, 12, 0, 0).getDate();
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const date = new Date(year, month - 1, prevMonthLastDay - i, 12, 0, 0);
    const dateStr = formatISO(date);
    cells.push({
      date,
      dateString: dateStr,
      dayNumber: date.getDate(),
      isCurrentMonth: false,
      isToday: dateStr === todayStr,
    });
  }

  // Dias do mês atual
  for (let d = 1; d <= totalDaysInMonth; d++) {
    const date = new Date(year, month, d, 12, 0, 0);
    const dateStr = formatISO(date);
    cells.push({
      date,
      dateString: dateStr,
      dayNumber: d,
      isCurrentMonth: true,
      isToday: dateStr === todayStr,
    });
  }

  // Dias do próximo mês para completar a grade de 35 ou 42 células
  const remaining = (7 - (cells.length % 7)) % 7;
  for (let d = 1; d <= remaining; d++) {
    const date = new Date(year, month + 1, d, 12, 0, 0);
    const dateStr = formatISO(date);
    cells.push({
      date,
      dateString: dateStr,
      dayNumber: d,
      isCurrentMonth: false,
      isToday: dateStr === todayStr,
    });
  }

  return cells;
}
