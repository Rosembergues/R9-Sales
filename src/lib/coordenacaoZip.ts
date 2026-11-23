import { zipSync } from 'fflate';
import { CURSOS, type filtrarClassificados, type separarTrancados } from './coordenacao';
import { buildXlsx } from './simpleXlsx';

type Classificados = ReturnType<typeof filtrarClassificados>;
type Trancados = ReturnType<typeof separarTrancados>;

const LARGURAS_CLASSIFICADOS = [16, 22, 20, 34, 38, 14, 18, 34, 38];
const LARGURAS_TRANCADOS = [18, 34, 18, 36, 22, 32, 38, 24, 20, 22];

/** Monta o .zip com uma pasta por curso: Inscritos, Trancados Adimplentes e Trancados Inadimplentes. */
export function montarZipPorCurso(classificados: Classificados | null, trancados: Trancados | null): Uint8Array {
  const arquivos: Record<string, [Uint8Array, { level: 0 }]> = {};
  const add = (caminho: string, bytes: Uint8Array) => {
    // O .xlsx já é compactado; guardar sem recompressão deixa o zip mais rápido.
    arquivos[caminho] = [bytes, { level: 0 }];
  };

  for (const curso of CURSOS) {
    if (classificados) {
      add(
        `${curso}/${curso}_Inscritos.xlsx`,
        buildXlsx({
          name: 'Planilha1',
          headers: classificados.cabecalho,
          rows: classificados.porCurso.get(curso) ?? [],
          widths: LARGURAS_CLASSIFICADOS,
          textColumns: [2, 6],
        })
      );
    }
    if (trancados) {
      for (const [sufixo, mapa] of [
        ['Adimplentes', trancados.adimplentes],
        ['Inadimplentes', trancados.inadimplentes],
      ] as const) {
        add(
          `${curso}/${curso}_Trancados_${sufixo}.xlsx`,
          buildXlsx({
            name: 'Trancados',
            headers: trancados.cabecalho,
            rows: mapa.get(curso) ?? [],
            widths: LARGURAS_TRANCADOS,
            textColumns: [0, 2, 4],
          })
        );
      }
    }
  }
  return zipSync(arquivos);
}
