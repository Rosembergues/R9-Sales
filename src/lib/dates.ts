/**
 * Datas no fuso do navegador (Brasília para a equipe).
 *
 * Evite `new Date().toISOString().slice(0, 10)`: ele devolve a data em UTC, que
 * depois das 21h já é o dia seguinte no Brasil.
 */

const pad = (n: number) => String(n).padStart(2, '0');

/** aaaa-mm-dd de uma data, no fuso local. */
export const toLocalIso = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Hoje em aaaa-mm-dd, no fuso local. */
export const todayLocalIso = (): string => toLocalIso(new Date());

/** dd/mm/aaaa de uma data, no fuso local. */
export const toBrDate = (d: Date): string => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;

/** aaaa-mm-dd → dd/mm/aaaa (texto vazio se o formato não bater). */
export const isoToBr = (iso: string): string => {
  const [y, m, d] = iso.split('-');
  return y && m && d ? `${d}/${m}/${y}` : '';
};

/** aaaa-mm-dd → Date ao meio-dia local (meio-dia evita pular de dia com horário de verão). */
export const parseLocalIso = (iso: string): Date => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
};

/** Dias entre 30/12/1899 (dia 0 do Excel) e 01/01/1970. */
const EXCEL_EPOCH_OFFSET = 25569;
const MS_PER_DAY = 86400000;

/** Data serial do Excel → Date em UTC (a hora do serial vira hora UTC). Nulo se não for um serial válido. */
export const excelSerialToDate = (serial: number): Date | null =>
  Number.isFinite(serial) && serial > 0 ? new Date(Math.round((serial - EXCEL_EPOCH_OFFSET) * MS_PER_DAY)) : null;

/** Date (UTC) → data serial do Excel; inverso de excelSerialToDate. */
export const dateToExcelSerial = (d: Date): number => d.getTime() / MS_PER_DAY + EXCEL_EPOCH_OFFSET;

/**
 * Data serial do Excel (dias desde 30/12/1899) → aaaa-mm-dd.
 * Evita carregar a biblioteca de Excel só para converter uma data.
 */
export const excelSerialToIso = (serial: number): string | null => {
  const d = excelSerialToDate(serial);
  if (!d) return null;
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};

/** Soma dias a uma data aaaa-mm-dd. */
export const addDaysIso = (iso: string, days: number): string => {
  const d = parseLocalIso(iso);
  d.setDate(d.getDate() + days);
  return toLocalIso(d);
};
