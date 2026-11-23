import React, { useCallback, useRef, useState } from 'react';
import { AlertCircle, Download, FolderArchive, Info, Loader2 } from 'lucide-react';
import {
  CURSOS,
  FASES_CLASSIFICADOS,
  PERIODOS_CLASSIFICADOS,
  TURNOS_CLASSIFICADOS,
  filtrarClassificados,
  separarTrancados,
} from '../../../lib/coordenacao';
import { readSheetRows } from '../../../lib/readSheetRows';
import { todayLocalIso } from '../../../lib/dates';
import { downloadBlob } from '../../../lib/download';
import { FileDrop } from './FileDrop';

type Classificados = ReturnType<typeof filtrarClassificados>;
type Trancados = ReturnType<typeof separarTrancados>;

interface Slot<T> {
  file: File | null;
  data: T | null;
  busy: boolean;
  error: string | null;
}
const emptySlot = <T,>(): Slot<T> => ({ file: null, data: null, busy: false, error: null });

// Deixa o navegador desenhar o "carregando" antes do processamento pesado.
const nextFrame = () => new Promise((r) => setTimeout(r, 30));

export const PlanilhasPorCursoPage: React.FC = () => {
  const [classificados, setClassificados] = useState<Slot<Classificados>>(emptySlot);
  const [trancados, setTrancados] = useState<Slot<Trancados>>(emptySlot);
  const [zipping, setZipping] = useState(false);
  const [zipError, setZipError] = useState<string | null>(null);

  // Cada slot guarda o arquivo mais recente: se outro arquivo for solto enquanto o anterior
  // ainda está sendo lido, o resultado do anterior é descartado.
  const latest = useRef<Record<string, File | null>>({});
  const load = useCallback(
    async <T,>(
      slot: string,
      file: File,
      set: React.Dispatch<React.SetStateAction<Slot<T>>>,
      parse: (rows: unknown[][]) => T
    ) => {
      latest.current[slot] = file;
      set({ file, data: null, busy: true, error: null });
      await nextFrame();
      let next: Slot<T>;
      try {
        next = { file, data: parse(await readSheetRows(file)), busy: false, error: null };
      } catch (err) {
        next = { file, data: null, busy: false, error: err instanceof Error ? err.message : 'Não consegui ler o arquivo.' };
      }
      if (latest.current[slot] === file) set(next);
    },
    []
  );
  const clear = (slot: string, set: (s: Slot<never>) => void) => {
    latest.current[slot] = null;
    set(emptySlot());
  };

  const gerarZip = useCallback(async () => {
    setZipping(true);
    setZipError(null);
    await nextFrame();
    try {
      const { montarZipPorCurso } = await import('../../../lib/coordenacaoZip');
      const bytes = montarZipPorCurso(classificados.data, trancados.data);
      downloadBlob(new Blob([bytes], { type: 'application/zip' }), `Planilhas por Curso ${todayLocalIso()}.zip`);
    } catch (err) {
      setZipError(err instanceof Error ? err.message : 'Não consegui gerar o arquivo .zip.');
    } finally {
      setZipping(false);
    }
  }, [classificados.data, trancados.data]);

  const c = classificados.data;
  const t = trancados.data;
  const algumPronto = Boolean(c || t);
  const algumLendo = classificados.busy || trancados.busy;

  return (
    <div className="max-w-5xl mx-auto animate-in fade-in duration-200 space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-[#00808C] text-white flex items-center justify-center shrink-0">
            <FolderArchive className="w-4.5 h-4.5" />
          </div>
          <h2 className="text-lg font-black text-slate-900">Coordenação - Planilhas por Curso</h2>
        </div>
        <p className="text-xs text-slate-500 mt-1.5 max-w-2xl">
          Envie o relatório de Classificados e o de Trancados/Abandono. O sistema aplica os filtros e gera um .zip com
          uma pasta para cada um dos {CURSOS.length} cursos, contendo Inscritos, Trancados Adimplentes e Trancados Inadimplentes.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
          <FileDrop
            label="1. Classificados"
            hint='Relatório "1 - Graduação - Classificados" (.xlsx)'
            accept=".xlsx,.xls"
            file={classificados.file}
            busy={classificados.busy}
            summary={c && `${c.total.toLocaleString('pt-BR')} inscritos elegíveis nos ${CURSOS.length} cursos`}
            onFile={(f) => load('classificados', f, setClassificados, filtrarClassificados)}
            onClear={() => clear('classificados', setClassificados)}
          />
          {classificados.error && <ErrorBox msg={classificados.error} />}
          <Rules>
            Período {PERIODOS_CLASSIFICADOS.join(' e ')} · Turno {TURNOS_CLASSIFICADOS.join(' e ')} · Fase{' '}
            {FASES_CLASSIFICADOS.join(' e ')} · Valor Pago vazio · Exporta as colunas de Período Acadêmico até Forma
            de Ingresso.
          </Rules>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
          <FileDrop
            label="2. Trancados / Abandono"
            hint='Relatório "Trancados Abandono" (.xlsx ou .csv)'
            accept=".xlsx,.xls,.csv"
            file={trancados.file}
            busy={trancados.busy}
            summary={
              t &&
              `${t.stats.exportados.toLocaleString('pt-BR')} alunos nos ${CURSOS.length} cursos · ${t.stats.duplicados.toLocaleString(
                'pt-BR'
              )} linhas duplicadas removidas`
            }
            onFile={(f) => load('trancados', f, setTrancados, separarTrancados)}
            onClear={() => clear('trancados', setTrancados)}
          />
          {trancados.error && <ErrorBox msg={trancados.error} />}
          <Rules>
            Remove matrículas repetidas (fica a primeira) · Telefone só com números · VLR_TOTAL_EM_ABERTO vazio →
            Adimplentes, preenchido → Inadimplentes.
          </Rules>
        </div>
      </div>

      {algumPronto && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-sm font-black text-slate-800">Prévia por curso</p>
              {(!c || !t) && (
                <p className="text-[11px] text-amber-700">
                  Só {c ? 'Classificados' : 'Trancados'} carregado — o .zip terá apenas esses arquivos.
                </p>
              )}
            </div>
            <button
              onClick={gerarZip}
              disabled={zipping || algumLendo}
              className="px-5 py-2.5 bg-[#0052cc] hover:bg-[#00478f] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
            >
              {zipping ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              Baixar .zip
            </button>
          </div>
          {zipError && (
            <div className="px-5 pt-3">
              <ErrorBox msg={zipError} />
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="text-left font-bold px-5 py-2">Curso</th>
                  <th className="text-right font-bold px-3 py-2">Inscritos</th>
                  <th className="text-right font-bold px-3 py-2">Trancados adimplentes</th>
                  <th className="text-right font-bold px-5 py-2">Trancados inadimplentes</th>
                </tr>
              </thead>
              <tbody>
                {CURSOS.map((curso) => {
                  const n = (v: number | undefined) =>
                    v === undefined ? <span className="text-slate-300">—</span> : v === 0 ? <span className="text-slate-400">0</span> : v.toLocaleString('pt-BR');
                  return (
                    <tr key={curso} className="border-t border-gray-100">
                      <td className="px-5 py-1.5 font-semibold text-slate-700">{curso}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{n(c?.porCurso.get(curso)?.length)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{n(t?.adimplentes.get(curso)?.length)}</td>
                      <td className="px-5 py-1.5 text-right tabular-nums">{n(t?.inadimplentes.get(curso)?.length)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

const ErrorBox: React.FC<{ msg: string }> = ({ msg }) => (
  <div className="rounded-xl bg-red-50 border border-red-200 p-2.5 flex items-start gap-2 text-xs text-red-700">
    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
    <span>{msg}</span>
  </div>
);

const Rules: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="rounded-xl bg-teal-50/70 border border-teal-100 px-3 py-2 text-[11px] text-slate-600 flex gap-2">
    <Info className="w-3.5 h-3.5 text-teal-700 shrink-0 mt-0.5" />
    <span>{children}</span>
  </div>
);
