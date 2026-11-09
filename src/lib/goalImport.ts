import * as XLSX from 'xlsx';

export type GoalTeachingModel =
  | 'graduacao_presencial'
  | 'graduacao_semipresencial'
  | 'graduacao_aovivo'
  | 'graduacao_ead'
  | 'graduacao_dlex'
  | 'pos_presencial'
  | 'pos_aovivo'
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
    // O id histórico é "graduacao_dlex"; mantido para não quebrar importações já gravadas.
    id: 'graduacao_dlex',
    title: 'Graduação · Flex',
    subtitle: 'Modelo digital com laboratórios/práticas flexíveis',
    product: 'Graduação',
    bu: 'BU Digital',
    buKey: 'bu_digital',
  },
  {
    id: 'pos_presencial',
    title: 'Pós-Graduação · Presencial',
    subtitle: 'Especializações presenciais no campus',
    product: 'Pós-Graduação',
    bu: 'Pós-Graduação',
    buKey: 'pos',
  },
  {
    id: 'pos_aovivo',
    title: 'Pós-Graduação · Ao Vivo',
    subtitle: 'Especializações com aulas síncronas ao vivo',
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
  campus?: string | null;
}

/**
 * Resultado da leitura de um arquivo antes de ser gravado.
 * O grupo é detectado pelo texto "Filtros aplicados" que o Power BI coloca na célula A1.
 */
export interface ParsedGoalFile extends Omit<GoalFilePreview, 'group'> {
  group: GoalImportGroup | null;
  campus: string | null;
  /** Problemas que impedem a gravação (ex.: cabeçalho não encontrado, modalidade desconhecida). */
  errors: string[];
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

const isHeaderDate = (v: string) => v === 'data' || v === 'date';
const isHeaderAA = (v: string) => v === 'aa' || v.includes('aa dinamico') || v.includes('anterior');
const isHeaderTarget = (v: string) => v === 'meta' || v.includes('meta');
const isHeaderActual = (v: string) => v === 'realizado' || v.includes('realizado');

const findHeader = (rows: unknown[][]) => {
  for (let i = 0; i < rows.length; i += 1) {
    const normalized = rows[i].map(normalize);
    if (
      normalized.some(isHeaderDate)
      && normalized.some(isHeaderTarget)
      && normalized.some(isHeaderActual)
      && normalized.some(isHeaderAA)
    ) return i;
  }
  return -1;
};

/** Texto de filtros do Power BI (fica nas linhas acima do cabeçalho). */
const filtersText = (rows: unknown[][], headerIndex: number) => rows
  .slice(0, headerIndex >= 0 ? headerIndex : Math.min(rows.length, 5))
  .flat()
  .filter(v => v !== null && v !== undefined)
  .map(v => String(v))
  .join('\n');

const extractFilters = (text: string) => text
  .split(/\n+/)
  .map(line => line.trim())
  .filter(line => line && !/^filtros aplicados/i.test(line))
  .slice(0, 12);

const detectPeriod = (text: string) =>
  normalize(text).match(/(?:p_acad|periodo[_ ]academico)\s*(?:e|=)\s*([0-9]{4}\.[0-9]+)/)?.[1] ?? null;

const detectCampus = (text: string): string | null => {
  const line = text.split(/\n+/).find(l => /NOM_CAMPUS/i.test(l));
  if (!line) return null;
  return line.replace(/^.*?NOM_CAMPUS\w*\s*(?:é|e|=)\s*/i, '').trim() || null;
};

const GRAD_MODALITY: Record<string, GoalImportGroup> = {
  presencial: 'graduacao_presencial',
  semipresencial: 'graduacao_semipresencial',
  'ao vivo': 'graduacao_aovivo',
  ead: 'graduacao_ead',
  flex: 'graduacao_dlex',
  dlex: 'graduacao_dlex',
};

const POS_MODALITY: Record<string, GoalImportGroup> = {
  presencial: 'pos_presencial',
  'ao vivo': 'pos_aovivo',
  ead: 'pos_digital',
  digital: 'pos_digital',
};

/**
 * Identifica a modalidade a partir dos filtros do relatório do Power BI.
 * - Graduação: "Incluídos (1) PRESENCIAL (BU) + SEMIPRESENCIAL (MODALIDADE)"
 * - Pós:       "Incluídos (1) ESTACIO (MARCA) + EAD (NOM_MODALIDADE)"
 * - Técnico:   campus "ESCOLA ESTÁCIO ..." / NOM_CAMPUS_TRATADO, sem modalidade
 */
export const detectGroupFromFilters = (text: string): { group: GoalImportGroup | null; warnings: string[] } => {
  const t = normalize(text).replace(/\s+/g, ' ');
  const warnings: string[] = [];

  const grad = t.match(/\(\d+\)\s*(presencial|digital)\s*\(bu\)\s*\+\s*([a-z ]+?)\s*\(modalidade\)/);
  if (grad) {
    const bu = grad[1];
    const group = GRAD_MODALITY[grad[2].trim()] ?? null;
    if (!group) return { group: null, warnings: [`Modalidade de graduação desconhecida: "${grad[2]}".`] };
    const expectedBu = getModelMetadata(group).buKey === 'bu_digital' ? 'digital' : 'presencial';
    if (expectedBu !== bu) {
      warnings.push(`O filtro de BU (${bu.toUpperCase()}) não bate com a modalidade ${grad[2].toUpperCase()}.`);
    }
    return { group, warnings };
  }

  const pos = t.match(/\(marca\)\s*\+\s*([a-z ]+?)\s*\(nom_modalidade\)/);
  if (pos) {
    const group = POS_MODALITY[pos[1].trim()] ?? null;
    if (!group) return { group: null, warnings: [`Modalidade de pós desconhecida: "${pos[1]}".`] };
    return { group, warnings };
  }

  if (/escola estacio|nom_campus_tratado|tecnico/.test(t)) {
    return { group: 'tecnico_presencial', warnings };
  }

  return { group: null, warnings };
};

/** Campus esperado nos relatórios. Arquivos de outro campus geram alerta. */
export const EXPECTED_CAMPUS_KEYWORD = 'taquara';

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

/** Interpreta as linhas brutas de uma planilha (separado de File para poder ser testado). */
export function parseGoalRows(rows: unknown[][], fileName: string): ParsedGoalFile {
  const headerIndex = findHeader(rows);
  const text = filtersText(rows, headerIndex);
  const filters = extractFilters(text);
  const academicPeriod = detectPeriod(text);
  const campus = detectCampus(text);
  const detection = detectGroupFromFilters(text);
  const warnings: string[] = [...detection.warnings];
  const errors: string[] = [];

  if (!detection.group) {
    errors.push('Não consegui identificar a modalidade pelos filtros do arquivo. Use o botão da modalidade correspondente.');
  }
  if (!academicPeriod) {
    warnings.push('O arquivo não informa o período acadêmico; será usado o período selecionado na tela.');
  }
  if (campus && !normalize(campus).includes(EXPECTED_CAMPUS_KEYWORD)) {
    warnings.push(`Campus do arquivo é "${campus}", diferente do esperado (${EXPECTED_CAMPUS_KEYWORD.toUpperCase()}).`);
  }

  const base = { fileName, group: detection.group, academicPeriod, campus, filters };

  if (headerIndex < 0) {
    return {
      ...base,
      rowCount: 0,
      startDate: null,
      endDate: null,
      rows: [],
      warnings,
      errors: [...errors, 'Não encontrei a linha de cabeçalho Data / AA (ou Anterior) / Meta / Realizado. Verifique se o arquivo é o relatório esperado.'],
    };
  }

  const header = rows[headerIndex].map(normalize);
  const dateIdx = header.findIndex(isHeaderDate);
  const aaIdx = header.findIndex(isHeaderAA);
  const targetIdx = header.findIndex(isHeaderTarget);
  const actualIdx = header.findIndex(isHeaderActual);

  // Se o relatório vier com a mesma data repetida, os valores são somados.
  const byDate = new Map<string, ParsedGoalRow>();
  let duplicated = 0;
  const add = (a: number | null, b: number | null) => (a === null && b === null ? null : (a ?? 0) + (b ?? 0));

  rows.slice(headerIndex + 1).forEach(r => {
    const date = toIsoDate(r[dateIdx]);
    if (!date) return; // linhas de total ou em branco
    const row: ParsedGoalRow = {
      date,
      aa: toNumber(r[aaIdx]),
      target: toNumber(r[targetIdx]),
      actual: toNumber(r[actualIdx]),
    };
    const prev = byDate.get(date);
    if (prev) {
      duplicated += 1;
      byDate.set(date, {
        date,
        aa: add(prev.aa, row.aa),
        target: add(prev.target, row.target),
        actual: add(prev.actual, row.actual),
      });
    } else {
      byDate.set(date, row);
    }
  });

  const parsedRows = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));

  if (duplicated) warnings.push(`${duplicated} data(s) repetida(s) no arquivo foram somadas.`);
  if (!parsedRows.length) {
    warnings.push('Arquivo sem dias com dados. Será registrado como "sem meta" para este período.');
  } else if (!parsedRows.some(r => (r.target ?? 0) > 0)) {
    warnings.push('O arquivo não tem nenhuma meta preenchida (só Ano Anterior/Realizado).');
  }

  return {
    ...base,
    rowCount: parsedRows.length,
    startDate: parsedRows[0]?.date ?? null,
    endDate: parsedRows[parsedRows.length - 1]?.date ?? null,
    rows: parsedRows,
    warnings,
    errors,
  };
}

export async function parseGoalFile(file: File): Promise<ParsedGoalFile> {
  if (!/\.(xlsx|csv)$/i.test(file.name)) {
    return {
      fileName: file.name, group: null, academicPeriod: null, campus: null, rowCount: 0,
      startDate: null, endDate: null, rows: [], filters: [], warnings: [],
      errors: ['Selecione um arquivo .xlsx ou .csv.'],
    };
  }
  return parseGoalRows(await parseWorkbook(file), file.name);
}

export interface GoalImportTotals { aa: number; target: number; actual: number; days: number }

export const totalsOf = (rows: ParsedGoalRow[]): GoalImportTotals => rows.reduce(
  (acc, r) => ({
    aa: acc.aa + (r.aa ?? 0),
    target: acc.target + (r.target ?? 0),
    actual: acc.actual + (r.actual ?? 0),
    days: acc.days + 1,
  }),
  { aa: 0, target: 0, actual: 0, days: 0 },
);
