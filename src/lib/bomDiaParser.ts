import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

export type BusinessUnit = 'presencial' | 'digital';

export interface FunilSavaResult {
  bu: BusinessUnit;
  academicPeriod: string;
  metaFinal: number;
  metaDoDia: number;
  realizado: number;
}

interface TextItem {
  str: string;
  x: number;
  y: number;
}

function toNumber(raw: string): number {
  const v = raw.trim();
  if (v.toLowerCase() === '(blank)') return 0;
  const semPercentual = v.replace('%', '');
  return parseFloat(semPercentual.replace(/\./g, '').replace(',', '.')) || 0;
}

function detectBuFromText(value: string): BusinessUnit | null {
  const v = value.toUpperCase();
  if (v.includes('DIGITAL')) return 'digital';
  if (v.includes('PRESENC')) return 'presencial';
  return null;
}

function detectBuFromFilename(fileName: string): BusinessUnit | null {
  const v = fileName.toLowerCase();
  if (v.includes('digital')) return 'digital';
  if (v.includes('pres')) return 'presencial';
  return null;
}

async function extractItems(file: File): Promise<TextItem[]> {
  const buffer = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: buffer }).promise;
  const page = await doc.getPage(1);
  const content = await page.getTextContent();
  return content.items
    .map((item) => {
      const it = item as { str?: string; transform: number[] };
      return { str: (it.str ?? '').trim(), x: it.transform[4], y: it.transform[5] };
    })
    .filter((it) => it.str !== '');
}

const LINHA_TOLERANCIA = 15;

function itensNaMesmaLinha(items: TextItem[], y0: number, excluir: TextItem): TextItem[] {
  return items
    .filter((it) => it !== excluir && Math.abs(it.y - y0) <= LINHA_TOLERANCIA)
    .sort((a, b) => a.x - b.x);
}

export async function parseFunilSavaPdf(file: File): Promise<FunilSavaResult> {
  const items = await extractItems(file);

  if (!items.some((it) => it.str.includes('Funil de Captação'))) {
    throw new Error(`"${file.name}" não parece ser um relatório "Funil de Captação - Sava".`);
  }

  // BU e período: achamos o valor do período (ex.: "2027.1") e, na mesma linha,
  // o próximo valor à direita é a BU/Modalidade (ex.: "PRESENCIAL").
  const periodoItem = items.find((it) => /^\d{4}\.\d$/.test(it.str));
  let academicPeriod = periodoItem?.str ?? '';
  let bu: BusinessUnit | null = null;

  if (periodoItem) {
    const linha = itensNaMesmaLinha(items, periodoItem.y, periodoItem);
    const buItem = linha.find((it) => it.x > periodoItem.x);
    if (buItem) bu = detectBuFromText(buItem.str);
  }
  if (!bu) bu = detectBuFromFilename(file.name);
  if (!bu) {
    throw new Error(`Não consegui identificar a BU (Presencial/Digital) em "${file.name}".`);
  }
  if (!academicPeriod) {
    throw new Error(`Não consegui identificar o período acadêmico em "${file.name}".`);
  }

  // Linha "M.FIN": ANTERIOR META ATUAL %META %AA | AA% META% ATUAL% | AA META ATUAL %META %AA
  const mfinLabel = items.find((it) => it.str.replace(/\s+/g, '') === 'M.FIN');
  if (!mfinLabel) {
    throw new Error(`Não encontrei a linha "M.FIN" em "${file.name}".`);
  }
  const valores = itensNaMesmaLinha(items, mfinLabel.y, mfinLabel);
  if (valores.length < 13) {
    throw new Error(`A linha "M.FIN" de "${file.name}" veio incompleta (esperava 13 valores, achei ${valores.length}).`);
  }

  const metaDoDia = toNumber(valores[1].str);
  const realizado = toNumber(valores[2].str);
  const metaFinal = toNumber(valores[9].str);

  return { bu, academicPeriod, metaFinal, metaDoDia, realizado };
}
