import type { Row } from './coordenacao';

/** Lê a primeira aba de um .xlsx/.xls ou um .csv como matriz de células (valores brutos). */
export async function readSheetRows(file: File): Promise<Row[]> {
  const XLSX = await import('xlsx');
  const isCsv = /\.csv$/i.test(file.name) || file.type === 'text/csv';
  const wb = isCsv
    ? // CSV: mantém tudo como texto (matrícula, CPF e telefone não viram número).
      XLSX.read(await file.text(), { type: 'string', raw: true, FS: ',' })
    : XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error(`O arquivo "${file.name}" não tem nenhuma aba.`);
  return XLSX.utils.sheet_to_json<Row>(ws, { header: 1, defval: null, raw: true, blankrows: false });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
