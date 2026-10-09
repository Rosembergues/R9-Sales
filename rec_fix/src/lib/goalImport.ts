import * as XLSX from 'xlsx';

export type GoalTeachingModel =
  | 'graduacao_presencial'
  | 'graduacao_semipresencial'
  | 'graduacao_aovivo'
  | 'graduacao_ead'
  | 'graduacao_dlex'
  | 'pos_presencial'
  | 'pos_digital'
  | 'tecnico_presencial';

export type GoalImportGroup =
  | GoalTeachingModel
  | 'graduacao_bu_presencial'
  | 'graduacao_bu_digital'
  | 'tecnico';

export type BusinessUnitKey = 'bu_presencial' | 'bu_digital' | 'pos' | 'tecnico';

export interface ModelMetadata {
  id: GoalImportGroup;
  title: string;
  subtitle: string;
  product: 'Graduação' | 'Pós-Graduação' | 'Curso Técnico';
  bu: 'BU Presencial' | 'BU Digital' | 'Pós-Graduação' | 'Curso Técnico';
  buKey: BusinessUnitKey;
}

export const TEACHING_MODELS: ModelMetadata[] = [
  {
    id: 'graduacao_presencial',
    title: 'Graduação · Presencial',
    subtitle: 'Alunos com aulas 100% no campus físico',
    product: 'Graduação',
    bu: 'BU Presencial',
    buKey: 'bu_presencial',
  },
  {
    id: 'graduacao_semipresencial',
    title: 'Graduação · Semipresencial',
    subtitle: 'Alunos com encontros presenciais e digitais',
    product: 'Graduação',
    bu: 'BU Presencial',
    buKey: 'bu_presencial',
  },
  {
    id: 'graduacao_aovivo',
    title: 'Graduação · Ao Vivo',
    subtitle: 'Alunos com aulas síncronas transmitidas ao vivo',
    product: 'Graduação',
    bu: 'BU Presencial',
    buKey: 'bu_presencial',
  },
  {
    id: 'graduacao_ead',
    title: 'Graduação · EAD',
    subtitle: 'Ensino a distância 100% assíncrono',
    product: 'Graduação',
    bu: 'BU Digital',
    buKey: 'bu_digital',
  },
  {
    id: 'graduacao_dlex',
    title: 'Graduação · DLEX (Flex)',
    subtitle: 'Modelo digital com laboratórios/práticas flexíveis',
    product: 'Graduação',
    bu: 'BU Digital',
    buKey: 'bu_digital',
  },
  {
    id: 'pos_presencial',
    title: 'Pós-Graduação · Presencial / Ao Vivo',
    subtitle: 'Especializações presenciais e síncronas',
    product: 'Pós-Graduação',
    bu: 'Pós-Graduação',
    buKey: 'pos',
  },
  {
    id: 'pos_digital',
    title: 'Pós-Graduação · Digital',
    subtitle: 'Especializações e MBAs 100% online',
    product: 'Pós-Graduação',
    bu: 'Pós-Graduação',
    buKey: 'pos',
  },
  {
    id: 'tecnico_presencial',
    title: 'Curso Técnico · Presencial',
    subtitle: 'Habilitações técnicas no campus',
    product: 'Curso Técnico',
    bu: 'Curso Técnico',
    buKey: 'tecnico',
  },
];

export const getModelMetadata = (group: string): ModelMetadata => {
  const found = TEACHING_MODELS.find(m => m.id === group);
  if (found) return found;
  if (group === 'graduacao_bu_presencial') {
    return {
      id: 'graduacao_bu_presencial',
      title: 'Graduação · BU Presencial',
      subtitle: 'Presencial + Semipresencial + Ao Vivo',
      product: 'Graduação',
      bu: 'BU Presencial',
      buKey: 'bu_presencial',
    };
  }
  if (group === 'graduacao_bu_digital') {
    return {
      id: 'graduacao_bu_digital',
      title: 'Graduação · BU Digital',
      subtitle: 'EAD + DLEX',
      product: 'Graduação',
      bu: 'BU Digital',
      buKey: 'bu_digital',
    };
  }
  return {
    id: (group as GoalImportGroup) || 'tecnico_presencial',
    title: 'Curso Técnico',
    subtitle: 'Curso Técnico Presencial',
    product: 'Curso Técnico',
    bu: 'Curso Técnico',
    buKey: 'tecnico',
  };
};

export interface ParsedGoalRow {
  date: string;
  aa: number | null;
  target: number | null;
  actual: number | null;
}

export interface GoalFilePreview {
  fileName: string;
  group: GoalImportGroup;
  academicPeriod: string | null;
  rowCount: number;
  startDate: string | null;
  endDate: string | null;
  rows: ParsedGoalRow[];
  filters: string[];
  warnings: string[];
}

export const GOAL_IMPORT_STORAGE_KEY = 'r9-goal-imports-preview-v2';

export interface ImportedGoalSummary {
  aa: number;
  target: number;
  actual: number;
  actualDays: number;
  groups: Record<string, { aa: number; target: number; actual: number; actualDays: number; rows: number }>;
  byBu: Record<BusinessUnitKey, { aa: number; target: number; actual: number; rows: number }>;
}

const emptyImportedGroupSummary = () => ({ aa: 0, target: 0, actual: 0, actualDays: 0, rows: 0 });

export function summarizeImportedGoals(
  previews: Record<string, GoalFilePreview>,
  startDate: string,
  endDate: string,
): ImportedGoalSummary {
  const groups: Record<string, { aa: number; target: number; actual: number; actualDays: number; rows: number }> = {};
  const byBu: ImportedGoalSummary['byBu'] = {
    bu_presencial: { aa: 0, target: 0, actual: 0, rows: 0 },
    bu_digital: { aa: 0, target: 0, actual: 0, rows: 0 },
    pos: { aa: 0, target: 0, actual: 0, rows: 0 },
    tecnico: { aa: 0, target: 0, actual: 0, rows: 0 },
  };

  Object.values(previews).forEach(preview => {
    if (!groups[preview.group]) groups[preview.group] = emptyImportedGroupSummary();
  });

  let aa = 0;
  let target = 0;
  let actual = 0;
  let actualDays = 0;

  Object.values(previews).forEach(preview => {
    const summary = groups[preview.group] ?? emptyImportedGroupSummary();
    const meta = getModelMetadata(preview.group);
    const buSummary = byBu[meta.buKey];

    preview.rows.forEach(row => {
      if (!row.date || row.date < startDate || row.date > endDate) return;
      summary.rows += 1;
      buSummary.rows += 1;

      if (row.aa !== null && Number.isFinite(row.aa)) {
        summary.aa += row.aa;
        buSummary.aa += row.aa;
        aa += row.aa;
      }
      if (row.target !== null && Number.isFinite(row.target)) {
        summary.target += row.target;
        buSummary.target += row.target;
        target += row.target;
      }
      if (row.actual !== null && Number.isFinite(row.actual)) {
        summary.actual += row.actual;
        buSummary.actual += row.actual;
        actual += row.actual;
        actualDays += 1;
        summary.actualDays += 1;
      }
    });
    groups[preview.group] = summary;
  });

  return { aa, target, actual, actualDays, groups, byBu };
}

const normalize = (value: unknown) => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLowerCase();

const toNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const raw = String(value).trim().replace(/\s/g, '').replace(/\.(?=\d{3}(?:\D|$))/g, '').replace(',', '.');
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
};

const toIsoDate = (value: unknown): string | null => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const d = XLSX.SSF.parse_date_code(value);
    if (d?.y && d?.m && d?.d) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
  }
  const s = String(value ?? '').trim();
  if (!s) return null;
  const br = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (br) return `${br[3]}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`;
  const iso = s.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
  return null;
};

const findHeader = (rows: unknown[][]) => {
  for (let i = 0; i < rows.length; i += 1) {
    const normalized = rows[i].map(normalize);
    const hasDate = normalized.some(v => v === 'data' || v === 'date');
    const hasTarget = normalized.some(v => v === 'meta' || v.includes('meta'));
    const hasActual = normalized.some(v => v === 'realizado' || v.includes('realizado'));
    const hasAA = normalized.some(v => v === 'aa' || v.includes('aa dinamico') || v.includes('anterior'));
    if (hasDate && hasTarget && hasActual && hasAA) return i;
  }
  return -1;
};

const extractFilters = (rows: unknown[][]) => rows
  .flatMap(r => r.map(v => String(v ?? '')).join(' ').split(/\n+/))
  .filter(line => /filtros aplicados|P_ACAD|PERIODO ACADEMICO|BU é|NOM_CAMPUS|Incluídos/i.test(line))
  .slice(0, 12);

const detectPeriod = (rows: unknown[][]) => {
  const text = rows.flat().map(v => String(v ?? '')).join('\n');
  return text.match(/(?:P_ACAD|PERIODO[_ ]ACADEMICO)\s*(?:é|=)\s*([0-9]{4}\.[0-9]+)/i)?.[1] ?? null;
};

const parseCsv = (text: string): unknown[][] => {
  const wb = XLSX.read(text, { type: 'string', raw: true, cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null }) as unknown[][];
};

const parseWorkbook = async (file: File): Promise<unknown[][]> => {
  const isCsv = /\.csv$/i.test(file.name);
  if (isCsv) return parseCsv(await file.text());
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', raw: true, cellDates: true, cellNF: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null }) as unknown[][];
};

export async function parseGoalFile(file: File, group: GoalImportGroup): Promise<GoalFilePreview> {
  const rows = await parseWorkbook(file);
  const headerIndex = findHeader(rows);
  const warnings: string[] = [];

  if (headerIndex < 0) {
    return {
      fileName: file.name,
      group,
      academicPeriod: detectPeriod(rows),
      rowCount: 0,
      startDate: null,
      endDate: null,
      rows: [],
      filters: extractFilters(rows),
      warnings: ['Não encontrei a linha de cabeçalho Data / AA (ou Anterior) / Meta / Realizado. Verifique se o arquivo é o relatório esperado.'],
    };
  }

  const header = rows[headerIndex].map(normalize);
  const dateIdx = header.findIndex(v => v === 'data' || v === 'date');
  const aaIdx = header.findIndex(v => v === 'aa' || v.includes('aa dinamico') || v.includes('aa dinâmico') || v.includes('anterior'));
  const targetIdx = header.findIndex(v => v === 'meta' || v.includes('meta'));
  const actualIdx = header.findIndex(v => v === 'realizado' || v.includes('realizado'));

  const parsedRows = rows.slice(headerIndex + 1)
    .map(r => ({
      date: toIsoDate(r[dateIdx]),
      aa: toNumber(r[aaIdx]),
      target: toNumber(r[targetIdx]),
      actual: toNumber(r[actualIdx]),
    }))
    .filter(r => r.date !== null) as ParsedGoalRow[];

  const dates = parsedRows.map(r => r.date).sort();
  if (parsedRows.some(r => r.target === null && r.actual === null && r.aa === null)) {
    warnings.push('Há dias sem AA, Meta e Realizado preenchidos; eles serão preservados como vazios.');
  }

  return {
    fileName: file.name,
    group,
    academicPeriod: detectPeriod(rows),
    rowCount: parsedRows.length,
    startDate: dates[0] ?? null,
    endDate: dates[dates.length - 1] ?? null,
    rows: parsedRows,
    filters: extractFilters(rows),
    warnings,
  };
}
