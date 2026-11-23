/**
 * Downloads gerados no navegador (CSV, .zip, imagens).
 *
 * A URL temporária só é liberada depois de um tempo: liberar logo após o clique
 * cancela o download em alguns navegadores.
 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  downloadUrl(url, filename);
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Baixa um endereço já pronto (ex.: data URL de uma imagem gerada). */
export function downloadUrl(url: string, filename: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** CSV com BOM (para o Excel reconhecer UTF-8 e os acentos). */
export const downloadCsv = (csv: string, filename: string) =>
  downloadBlob(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }), filename);
