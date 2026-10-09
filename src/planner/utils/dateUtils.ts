import { Recurrence } from '../types.ts';

export function formatISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseISO(str: string): Date {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

/**
 * Retorna a data de hoje estritamente baseada no fuso local do cliente (new Date())
 */
export function getTodayDate(): Date {
  return new Date();
}

/**
 * Retorna a data de hoje formatada em YYYY-MM-DD no fuso local do cliente
 */
export function getTodayISO(): string {
  return formatISO(new Date());
}

/**
 * Calcula a próxima data válida com base na regra de recorrência e formato YYYY-MM-DD
 * - Diariamente: Próximo dia corrido (+1 dia)
 * - Segunda a Sexta (Dias Úteis): Se for sexta-feira, pula para segunda-feira; se for sábado ou domingo, avança para segunda-feira; caso contrário, avança 1 dia (+1 dia)
 * - Semanal: Avança exatamente 7 dias (+7 dias)
 * - Mensal: Avança 1 mês mantendo o mesmo dia (com proteção para meses com menos dias)
 *
 * @param currentDateStr Data base em formato YYYY-MM-DD (ou data_agendada / data_inicio)
 * @param recurrence Tipo de recorrência (ex: 'Diariamente', 'Segunda a Sexta', 'Semanalmente', 'Mensalmente')
 * @returns Nova data em formato YYYY-MM-DD ou null se não houver recorrência válida
 */
export function getNextRecurrenceDate(
  currentDateStr: string | null | undefined,
  recurrence: Recurrence | string | null | undefined,
  recurrenceDays?: string[]
): string | null {
  if (!currentDateStr || !recurrence) {
    return null;
  }

  // Normalizar string de recorrência (remove acentos, espaços extras e minúsculas)
  const normalizedRec = String(recurrence)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (
    normalizedRec === 'nenhuma' ||
    normalizedRec === 'none' ||
    normalizedRec === 'null' ||
    normalizedRec === 'undefined' ||
    normalizedRec === ''
  ) {
    return null;
  }

  // Parse estrito e seguro de YYYY-MM-DD sem conversões de fuso horário UTC
  const rawDate = currentDateStr.split('T')[0].trim();
  const parts = rawDate.split('-');
  if (parts.length < 3) {
    return null;
  }

  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10); // 1-12
  const d = parseInt(parts[2], 10); // 1-31

  if (isNaN(y) || isNaN(m) || isNaN(d)) {
    return null;
  }

  const pad = (num: number) => String(num).padStart(2, '0');

  // 1. DIARIAMENTE: Próximo dia corrido
  if (normalizedRec.includes('diari')) {
    const baseDate = new Date(y, m - 1, d, 12, 0, 0);
    baseDate.setDate(baseDate.getDate() + 1);
    return `${baseDate.getFullYear()}-${pad(baseDate.getMonth() + 1)}-${pad(baseDate.getDate())}`;
  }

  // 2. SEGUNDA A SEXTA (DIAS ÚTEIS): Se for sexta-feira, pula para segunda-feira; caso contrário, avança 1 dia
  if (
    normalizedRec.includes('segunda') ||
    normalizedRec.includes('util') ||
    normalizedRec.includes('uteis')
  ) {
    const baseDate = new Date(y, m - 1, d, 12, 0, 0);
    const dayOfWeek = baseDate.getDay(); // 0 = Domingo, 1 = Segunda, ..., 5 = Sexta, 6 = Sábado

    if (dayOfWeek === 5) {
      // Sexta-feira -> Pula para Segunda-feira (+3 dias)
      baseDate.setDate(baseDate.getDate() + 3);
    } else if (dayOfWeek === 6) {
      // Sábado -> Pula para Segunda-feira (+2 dias)
      baseDate.setDate(baseDate.getDate() + 2);
    } else if (dayOfWeek === 0) {
      // Domingo -> Pula para Segunda-feira (+1 dia)
      baseDate.setDate(baseDate.getDate() + 1);
    } else {
      // Segunda a Quinta -> Avança 1 dia corrido
      baseDate.setDate(baseDate.getDate() + 1);
    }
    return `${baseDate.getFullYear()}-${pad(baseDate.getMonth() + 1)}-${pad(baseDate.getDate())}`;
  }

  // 3. PERSONALIZADO (com dias da semana selecionados)
  if (normalizedRec.includes('personaliz') && recurrenceDays && recurrenceDays.length > 0) {
    const dayMap: Record<string, number> = {
      dom: 0,
      seg: 1,
      ter: 2,
      qua: 3,
      qui: 4,
      sex: 5,
      sab: 6,
      sáb: 6,
    };

    const targetDays = recurrenceDays
      .map((d) => dayMap[d.toLowerCase().trim().slice(0, 3)])
      .filter((n) => n !== undefined);

    if (targetDays.length > 0) {
      const baseDate = new Date(y, m - 1, d, 12, 0, 0);
      for (let i = 1; i <= 14; i++) {
        const next = new Date(baseDate);
        next.setDate(baseDate.getDate() + i);
        if (targetDays.includes(next.getDay())) {
          return `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}`;
        }
      }
    }
  }

  // 4. SEMANAL: Avança exatamente 7 dias
  if (normalizedRec.includes('seman')) {
    const baseDate = new Date(y, m - 1, d, 12, 0, 0);
    baseDate.setDate(baseDate.getDate() + 7);
    return `${baseDate.getFullYear()}-${pad(baseDate.getMonth() + 1)}-${pad(baseDate.getDate())}`;
  }

  // 5. MENSAL: Avança 1 mês mantendo o mesmo dia
  if (normalizedRec.includes('mensa')) {
    let targetYear = y;
    let targetMonth = m + 1; // 1-12
    if (targetMonth > 12) {
      targetMonth = 1;
      targetYear += 1;
    }
    // Proteção para o último dia válido do mês alvo (ex: 31 em mês de 30 dias)
    const maxDaysInTargetMonth = new Date(targetYear, targetMonth, 0).getDate();
    const targetDay = Math.min(d, maxDaysInTargetMonth);

    return `${targetYear}-${pad(targetMonth)}-${pad(targetDay)}`;
  }

  return null;
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
 * Retorna os 7 dias da semana (de Domingo a Sábado) para uma data de referência no fuso local
 */
export function getWeekDates(referenceDate: Date): Date[] {
  const y = referenceDate.getFullYear();
  const m = referenceDate.getMonth();
  const d = referenceDate.getDate();
  const date = new Date(y, m, d, 12, 0, 0);
  const day = date.getDay(); // 0 = Domingo, 1 = Segunda, etc.
  
  // Retroceder até o Domingo da semana atual
  const sunday = new Date(y, m, d - day, 12, 0, 0);

  const week: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const current = new Date(sunday.getFullYear(), sunday.getMonth(), sunday.getDate() + i, 12, 0, 0);
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
