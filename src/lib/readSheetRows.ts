import type { Row } from './coordenacao';

/** Separador de um CSV pela primeira linha: ";" (Excel em português) ou "," (padrão). */
export function detectCsvSeparator(text: string): ';' | ',' {
  const primeira = text.replace(/^﻿/, '').split(/\r?\n/, 1)[0] ?? '';
  const contar = (sep: string) => primeira.split(sep).length - 1;
  return contar(';') > contar(',') ? ';' : ',';
}

/** Lê a primeira aba de um .xlsx/.xls ou um .csv como matriz de células (valores brutos). */
export async function readSheetRows(file: File): Promise<Row[]> {
  const XLSX = await import('xlsx');
  const isCsv = /\.csv$/i.test(file.name) || file.type === 'text/csv';
  let wb;
  if (isCsv) {
    const text = await file.text();
    // CSV: mantém tudo como texto (matrícula, CPF e telefone não viram número).
    wb = XLSX.read(text, { type: 'string', raw: true, FS: detectCsvSeparator(text) });
  } else {
    wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  }
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error(`O arquivo "${file.name}" não tem nenhuma aba.`);
  return XLSX.utils.sheet_to_json<Row>(ws, { header: 1, defval: null, raw: true, blankrows: false });
}
