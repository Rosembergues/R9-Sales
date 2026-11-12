import { excelSerialToIso } from './dates';
import { toLocalIso } from './dates';

/**
 * Comparador de Preços — leitura da planilha "Análise da Concorrência" e regras de comparação.
 *
 * As fórmulas da planilha costumam vir SEM valor salvo (arquivo gerado por ferramenta),
 * então tudo que é derivado (preço por, % de desconto, desconto de/para) é recalculado aqui.
 */

export interface CompetitorOffer {
  name: string;
  /** Preço cheio da concorrente ("DESCONTO DE"). */
  price_from: number | null;
  /** Desconto em fração (0.62 = 62%). */
  discount_pct: number | null;
  /** Preço final da concorrente ("DESCONTO PARA"). É o valor comparado com o nosso. */
  price_to: number | null;
  /** false quando a concorrente não oferece o curso/turno (célula "x" ou vazia). */
  offered: boolean;
}

export interface ParsedPriceRow {
  sort_order: number;
  campus: string | null;
  course_code: string | null;
  course_name: string;
  shift: string | null;
  modality: string | null;
  list_price: number | null;
  scholarship_label: string | null;
  scholarship_first_pct: number | null;
  scholarship_ct_pct: number | null;
  price_first: number | null;
  price_ct: number | null;
  /** Preço usado na comparação: 1º semestre quando a bolsa é composta, senão o contínuo. */
  our_price: number | null;
  competitors: CompetitorOffer[];
}

export interface ParsedPriceFile {
  fileName: string;
  sheetName: string;
  referenceDate: string | null; // yyyy-mm-dd
  campus: string | null;
  rows: ParsedPriceRow[];
  competitorNames: string[];
  warnings: string[];
  errors: string[];
}

export const DEFAULT_OFFENSE_THRESHOLD_PCT = 8;

const normalizeHeader = (value: unknown) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();

const isBlankMarker = (value: unknown) => {
  if (value === null || value === undefined) return true;
  const s = String(value).trim().toLowerCase();
  return s === '' || s === 'x' || s === '-' || s === '—' || s === 'n/a' || s === 'na';
};

/** Lê número de célula: aceita 1622.91, "1.622,91", "R$ 1622,91". */
export const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (isBlankMarker(value)) return null;
  let s = String(value).replace(/R\$|\s/gi, '').replace('%', '');
  if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.');
  else if (s.includes(',')) s = s.replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

/** Percentual em fração: 0.62, "62%", 62 → 0.62. */
const toFraction = (value: unknown): number | null => {
  const n = toNumber(value);
  if (n === null) return null;
  return n > 1 ? n / 100 : n;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

const pad = (n: number) => String(n).padStart(2, '0');
const toIso = toLocalIso;

/** Data da célula de atualização: serial do Excel, Date ou "dd/mm/aaaa". */
const toIsoDate = (value: unknown): string | null => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return toIso(value);
  if (typeof value === 'number' && value > 20000 && value < 80000) {
    const fromSerial = excelSerialToIso(value);
    if (fromSerial) return fromSerial;
  }
  if (typeof value === 'string') {
    const br = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (br) {
      const y = br[3].length === 2 ? 2000 + Number(br[3]) : Number(br[3]);
      return `${y}-${pad(Number(br[2]))}-${pad(Number(br[1]))}`;
    }
    const iso = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  }
  return null;
};

/** Segunda-feira da semana da data (yyyy-mm-dd). */
export const weekStartOf = (isoDate: string): string => {
  const d = new Date(`${isoDate}T12:00:00`);
  const day = d.getDay(); // 0 = domingo
  d.setDate(d.getDate() - ((day + 6) % 7));
  return toIso(d);
};

/**
 * "% DE BOLSA": "60% CT", "65% 1ºS + 60% CT", "50%".
 * Retorna as frações do 1º semestre e da bolsa contínua.
 */
export const parseScholarship = (label: unknown): { first: number | null; ct: number | null } => {
  if (typeof label === 'number') return { first: null, ct: label > 1 ? label / 100 : label };
  const text = String(label ?? '').toUpperCase();
  let first: number | null = null;
  let ct: number | null = null;
  // Cada parte separada por "+" tem um percentual e um rótulo (1ºS, CT...).
  for (const part of text.split('+')) {
    const m = part.match(/(\d+(?:[.,]\d+)?)\s*%\s*(.*)$/);
    if (!m) continue;
    const pct = Number(m[1].replace(',', '.')) / 100;
    const tag = m[2].replace(/\s+/g, '');
    if (/^1[ºO°ª]?S|^1SEM|^1°?SEM/.test(tag)) first = pct;
    else ct = pct;
  }
  return { first, ct };
};

/** Completa desconto de / % / para a partir de dois deles (as fórmulas vêm sem valor). */
export const resolveOffer = (name: string, fromRaw: unknown, pctRaw: unknown, toRaw: unknown): CompetitorOffer => {
  let from = toNumber(fromRaw);
  let pct = toFraction(pctRaw);
  let to = toNumber(toRaw);

  if (to === null && from !== null && pct !== null) to = from * (1 - pct);
  if (from === null && to !== null && pct !== null && pct < 1) from = to / (1 - pct);
  if (pct === null && from !== null && to !== null && from > 0) pct = 1 - to / from;

  return {
    name,
    price_from: from === null ? null : round2(from),
    discount_pct: pct === null ? null : Math.round(pct * 10000) / 10000,
    price_to: to === null ? null : round2(to),
    offered: to !== null,
  };
};

interface ColumnMap {
  campus: number;
  code: number;
  course: number;
  shift: number;
  modality: number;
  listPrice: number;
  scholarship: number;
  pricePor: number;
  date: number;
  competitors: { nameCol: number; fromCol: number; pctCol: number; toCol: number }[];
}

const findHeaderRow = (rows: unknown[][]): number =>
  rows.findIndex(r => (r || []).some(c => normalizeHeader(c) === 'NOME DO CURSO'));

const mapColumns = (header: unknown[]): ColumnMap => {
  const h = header.map(normalizeHeader);
  const idx = (...names: string[]) => h.findIndex(x => names.includes(x));
  const competitors: ColumnMap['competitors'] = [];
  h.forEach((name, i) => {
    if (/^CONCORRENTE\b/.test(name)) {
      competitors.push({ nameCol: i, fromCol: i + 1, pctCol: i + 2, toCol: i + 3 });
    }
  });
  return {
    campus: idx('NOME DO CAMPUS', 'CAMPUS'),
    code: idx('COD CURSO', 'CODIGO CURSO', 'COD. CURSO', 'CODIGO'),
    course: idx('NOME DO CURSO', 'CURSO'),
    shift: idx('TURNO'),
    modality: idx('MODALIDADE'),
    listPrice: idx('PRECO DE', 'VALOR CHEIO'),
    scholarship: idx('% DE BOLSA', 'BOLSA', '% BOLSA'),
    pricePor: idx('PRECO POR'),
    date: h.findIndex(x => x.startsWith('DATA DE ATUALIZACAO') || x === 'DATA'),
    competitors,
  };
};

const cellText = (value: unknown) => {
  if (value === null || value === undefined) return null;
  const s = String(value).replace(/\s+/g, ' ').trim();
  return s === '' ? null : s;
};

// A biblioteca de Excel (pesada) só é baixada quando alguém importa um arquivo.
const readSheetRows = async (file: File): Promise<{ sheetName: string; rows: unknown[][] }[]> => {
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array', raw: true, cellDates: true, cellNF: false });
  return wb.SheetNames.map(name => ({
    sheetName: name,
    rows: XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: null }) as unknown[][],
  }));
};

export async function parsePriceFile(file: File): Promise<ParsedPriceFile> {
  const result: ParsedPriceFile = {
    fileName: file.name,
    sheetName: '',
    referenceDate: null,
    campus: null,
    rows: [],
    competitorNames: [],
    warnings: [],
    errors: [],
  };

  let sheets: { sheetName: string; rows: unknown[][] }[];
  try {
    sheets = await readSheetRows(file);
  } catch (e) {
    result.errors.push('Não consegui abrir o arquivo. Envie a planilha em .xlsx.');
    return result;
  }

  // Usa a primeira aba que tenha o cabeçalho "NOME DO CURSO" (normalmente "Comparativo de Valores").
  const sheet = sheets.find(s => findHeaderRow(s.rows) >= 0);
  if (!sheet) {
    result.errors.push('Não encontrei o cabeçalho "NOME DO CURSO" em nenhuma aba da planilha.');
    return result;
  }
  result.sheetName = sheet.sheetName;

  const headerIdx = findHeaderRow(sheet.rows);
  const cols = mapColumns(sheet.rows[headerIdx]);
  if (cols.listPrice < 0) result.errors.push('Coluna "PREÇO DE" não encontrada.');
  if (cols.scholarship < 0 && cols.pricePor < 0) result.errors.push('Colunas "% DE BOLSA" / "PREÇO POR" não encontradas.');
  if (!cols.competitors.length) result.errors.push('Nenhuma coluna "CONCORRENTE" encontrada.');
  if (result.errors.length) return result;

  const dates = new Set<string>();
  const campuses = new Set<string>();
  const competitorNames: string[] = [];
  const seenKeys = new Set<string>();

  sheet.rows.slice(headerIdx + 1).forEach((r, i) => {
    const row = r || [];
    const courseName = cellText(row[cols.course]);
    if (!courseName) return;
    const excelLine = headerIdx + i + 2;

    const campus = cols.campus >= 0 ? cellText(row[cols.campus]) : null;
    if (campus) campuses.add(campus);
    const shift = cols.shift >= 0 ? cellText(row[cols.shift]) : null;
    const code = cols.code >= 0 ? cellText(row[cols.code]) : null;
    const listPrice = toNumber(row[cols.listPrice]);
    const label = cols.scholarship >= 0 ? cellText(row[cols.scholarship]) : null;
    const { first, ct } = parseScholarship(label);

    const priceFirst = listPrice !== null && first !== null ? round2(listPrice * (1 - first)) : null;
    let priceCt = listPrice !== null && ct !== null ? round2(listPrice * (1 - ct)) : null;
    if (priceCt === null && priceFirst === null && cols.pricePor >= 0) priceCt = toNumber(row[cols.pricePor]);
    const ourPrice = priceFirst ?? priceCt;

    if (listPrice === null) result.warnings.push(`Linha ${excelLine} (${courseName} ${shift ?? ''}): sem "PREÇO DE".`);
    else if (first === null && ct === null) result.warnings.push(`Linha ${excelLine} (${courseName} ${shift ?? ''}): não entendi a bolsa "${label ?? ''}".`);

    const key = `${code ?? courseName}|${shift ?? ''}`;
    if (seenKeys.has(key)) result.warnings.push(`Linha ${excelLine}: ${courseName} ${shift ?? ''} aparece mais de uma vez.`);
    seenKeys.add(key);

    const competitors = cols.competitors.map((c, ci) => {
      const name = cellText(row[c.nameCol]) || `Concorrente ${ci + 1}`;
      if (!competitorNames.includes(name)) competitorNames.push(name);
      return resolveOffer(name, row[c.fromCol], row[c.pctCol], row[c.toCol]);
    });

    if (cols.date >= 0) {
      const d = toIsoDate(row[cols.date]);
      if (d) dates.add(d);
    }

    result.rows.push({
      sort_order: result.rows.length,
      campus,
      course_code: code,
      course_name: courseName,
      shift,
      modality: cols.modality >= 0 ? cellText(row[cols.modality]) : null,
      list_price: listPrice,
      scholarship_label: label,
      scholarship_first_pct: first,
      scholarship_ct_pct: ct,
      price_first: priceFirst,
      price_ct: priceCt,
      our_price: ourPrice,
      competitors,
    });
  });

  result.competitorNames = competitorNames;
  result.campus = campuses.size ? Array.from(campuses)[0] : null;
  if (campuses.size > 1) result.warnings.push(`A planilha tem mais de um campus: ${Array.from(campuses).join(', ')}.`);

  const sortedDates = Array.from(dates).sort();
  result.referenceDate = sortedDates[sortedDates.length - 1] ?? null;
  if (sortedDates.length > 1) {
    result.warnings.push(`Datas de atualização diferentes nas linhas (${sortedDates.map(formatIsoDate).join(', ')}); usei a mais recente.`);
  }
  if (!result.referenceDate) result.warnings.push('Não encontrei a data de atualização; escolha a data abaixo.');
  if (!result.rows.length) result.errors.push('Nenhum curso encontrado na planilha.');

  return result;
}

// ---------------------------------------------------------------------------
// Regras de comparação (usadas pelas telas)
// ---------------------------------------------------------------------------

export type OfferStatus = 'offense' | 'cheaper' | 'ours_cheaper' | 'na';

export interface OfferComparison {
  diff: number | null; // concorrente - nosso (R$)
  diffPct: number | null; // fração sobre o nosso preço
  status: OfferStatus;
}

/**
 * "Ofensa": preço final da concorrente X% ou mais abaixo do nosso (regra da planilha: L <= H * 0,92).
 */
export const compareOffer = (ourPrice: number | null, offer: CompetitorOffer | undefined, thresholdPct: number): OfferComparison => {
  if (!offer || !offer.offered || offer.price_to === null || ourPrice === null || ourPrice <= 0) {
    return { diff: null, diffPct: null, status: 'na' };
  }
  const diff = offer.price_to - ourPrice;
  const diffPct = diff / ourPrice;
  let status: OfferStatus = 'ours_cheaper';
  if (offer.price_to <= ourPrice * (1 - thresholdPct / 100) + 1e-9) status = 'offense';
  else if (offer.price_to < ourPrice) status = 'cheaper';
  return { diff, diffPct, status };
};

export const courseKey = (row: { course_code: string | null; course_name: string; shift: string | null }) =>
  `${row.course_code ?? row.course_name}|${(row.shift ?? '').toUpperCase()}`;

export const formatBRL = (value: number | null | undefined) =>
  value === null || value === undefined
    ? '—'
    : value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const formatPct = (value: number | null | undefined, digits = 0) =>
  value === null || value === undefined
    ? '—'
    : `${(value * 100).toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;

export const formatIsoDate = (value: string | null | undefined) =>
  value ? new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR') : '—';
