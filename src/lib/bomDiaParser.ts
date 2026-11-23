import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { parsePowerBiNumber } from './powerBiNumber';

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


function detectBuFromText(value: string): BusinessUnit | null {
  const v = value.toUpperCase();
  if (v.includes('DIGITAL')) return 'digital';
  if (v.includes('PRESENC')) return 'presencial';
  return null;
}

async function extractItems(file: File): Promise<TextItem[]> {
  const buffer = await file.arrayBuffer();
  const task = pdfjsLib.getDocument({ data: buffer });
  try {
    const doc = await task.promise;
    const page = await doc.getPage(1);
    const content = await page.getTextContent();
    return content.items
      .map((item) => {
        const it = item as { str?: string; transform: number[] };
        return { str: (it.str ?? '').trim(), x: it.transform[4], y: it.transform[5] };
      })
      .filter((it) => it.str !== '');
  } finally {
    // Libera a memória do documento (senão cada PDF lido fica preso no worker).
    void task.destroy();
  }
}

const LINHA_TOLERANCIA = 15;

function itensNaMesmaLinha(items: TextItem[], y0: number, excluir: TextItem): TextItem[] {
  return items
    .filter((it) => it !== excluir && Math.abs(it.y - y0) <= LINHA_TOLERANCIA)
    .sort((a, b) => a.x - b.x);
}

// Valor do filtro do cabeçalho logo abaixo do rótulo. Ignora os ícones de dropdown,
// que vêm como itens de texto sem letras nem dígitos.
function valorDoFiltro(items: TextItem[], rotulo: RegExp): string | null {
  const label = items.find((it) => rotulo.test(it.str));
  if (!label) return null;
  const valor = items
    .filter(
      (it) =>
        it.y < label.y &&
        label.y - it.y < 80 &&
        Math.abs(it.x - label.x) < 40 &&
        /[\p{L}\d]/u.test(it.str)
    )
    .sort((a, b) => b.y - a.y)[0];
  return valor?.str ?? null;
}

export async function parseFunilSavaPdf(file: File): Promise<FunilSavaResult> {
  const items = await extractItems(file);

  if (!items.some((it) => /Funil de Captação\s*-\s*Sava/i.test(it.str))) {
    throw new Error(`"${file.name}" não parece ser um relatório "Funil de Captação - Sava".`);
  }

  const academicPeriod = valorDoFiltro(items, /^PER[IÍ]ODO ACAD[EÊ]MICO$/i) ?? '';
  const buTexto = valorDoFiltro(items, /^BU\s*\/\s*MODALIDADE$/i);
  const bu = buTexto ? detectBuFromText(buTexto) : null;

  if (!bu) {
    throw new Error(
      `Não consegui identificar a BU (Presencial/Digital) no filtro "BU / MODALIDADE" de "${file.name}"` +
        (buTexto ? ` (valor encontrado: "${buTexto}").` : '.')
    );
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

  // Posições fixas da linha (ver acima). Cada valor precisa ser um número de verdade:
  // se uma célula vier vazia ou o layout mudar, é melhor recusar do que gerar a arte com número errado.
  const lerValor = (indice: number, nome: string) => {
    const n = parsePowerBiNumber(valores[indice].str);
    if (n === null) {
      throw new Error(
        `"${nome}" na linha "M.FIN" de "${file.name}" não é um número ("${valores[indice].str}"). ` +
          'O layout do relatório pode ter mudado.'
      );
    }
    return n;
  };
  const metaDoDia = lerValor(1, 'Meta');
  const realizado = lerValor(2, 'Atual');
  const metaFinal = lerValor(9, 'Meta final');

  return { bu, academicPeriod, metaFinal, metaDoDia, realizado };
}
