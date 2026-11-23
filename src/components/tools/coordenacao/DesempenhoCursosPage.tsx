import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { AlertCircle, Download, Info, Loader2, Presentation } from 'lucide-react';
import { montarDesempenho, type Desempenho } from '../../../lib/coordenacao';
import { readSheetRows } from '../../../lib/readSheetRows';
import { DesempenhoCursosCard, DESEMPENHO_CARD_H, DESEMPENHO_CARD_W } from './DesempenhoCursosCard';
import { FileDrop } from './FileDrop';

export const DesempenhoCursosPage: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [dados, setDados] = useState<Desempenho | null>(null);
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);

  const onFile = useCallback(async (f: File) => {
    setFile(f);
    setDados(null);
    setError(null);
    setBusy(true);
    try {
      setDados(montarDesempenho(await readSheetRows(f)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não consegui ler a planilha.');
    } finally {
      setBusy(false);
    }
  }, []);

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const update = () => setScale(Math.min(1, wrap.clientWidth / DESEMPENHO_CARD_W));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [dados]);

  const download = useCallback(async () => {
    if (!cardRef.current) return;
    setDownloading(true);
    try {
      const { toPng } = await import('html-to-image');
      await document.fonts.ready;
      // 1280x720 * 1.5 = 1920x1080, o mesmo tamanho que o app desktop exportava.
      const dataUrl = await toPng(cardRef.current, { pixelRatio: 1.5, cacheBust: true });
      const a = document.createElement('a');
      a.download = `desempenho_cursos_${new Date().toISOString().slice(0, 10)}.png`;
      a.href = dataUrl;
      a.click();
    } catch {
      setError('Não consegui gerar a imagem. Tente novamente.');
    } finally {
      setDownloading(false);
    }
  }, []);

  return (
    <div className="max-w-6xl mx-auto animate-in fade-in duration-200 space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-[#071F54] text-white flex items-center justify-center shrink-0">
            <Presentation className="w-4.5 h-4.5" />
          </div>
          <h2 className="text-lg font-black text-slate-900">Coordenação - Desempenho de Cursos x Meta</h2>
        </div>
        <p className="text-xs text-slate-500 mt-1.5 max-w-2xl">
          Envie a planilha de indicadores por curso (export "data.xlsx"). O sistema monta a tabela com os 18 cursos e
          seus coordenadores e gera a imagem pronta para enviar.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
        <FileDrop
          label="Planilha de indicadores"
          hint="Arquivo .xlsx exportado com CURSO e os grupos AA | META | ATUAL | META FECH"
          accept=".xlsx,.xls"
          file={file}
          busy={busy}
          summary={
            dados &&
            (dados.ausentes.length
              ? `${18 - dados.ausentes.length} de 18 cursos encontrados`
              : '18 de 18 cursos encontrados')
          }
          onFile={onFile}
          onClear={() => {
            setFile(null);
            setDados(null);
            setError(null);
          }}
        />
        <div className="rounded-xl bg-teal-50/70 border border-teal-100 px-3.5 py-2.5 text-[11px] text-slate-600 flex gap-2">
          <Info className="w-3.5 h-3.5 text-teal-700 shrink-0 mt-0.5" />
          <span>
            Usa o 3º grupo de colunas da planilha. Meta Fech: metas provisórias do ciclo até 31/03/2027
            (fechamento do ano anterior × 1,2). Meta Dia: forecast pela curva do ano anterior — o que o curso tinha
            feito nesta mesma data no ciclo passado (coluna AA) × 1,2. % Meta Dia = Atual ÷ Meta Dia, com metas
            arredondadas. Verde ≥ 100% · Amarelo ≥ 80% · Vermelho &lt; 80% · "—" quando não há meta.
          </span>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-3 flex items-start gap-2 text-xs text-red-700">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {dados && dados.ausentes.length > 0 && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
          <b>Cursos não encontrados na planilha</b> (aparecem zerados): {dados.ausentes.join(', ')}
        </div>
      )}

      {dados && (
        <div className="space-y-4 flex flex-col items-center">
          <div ref={wrapRef} className="w-full" style={{ height: DESEMPENHO_CARD_H * scale }}>
            <div
              style={{
                width: DESEMPENHO_CARD_W,
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
              }}
              className="rounded-xl overflow-hidden shadow-md border border-gray-200"
            >
              <DesempenhoCursosCard ref={cardRef} dados={dados} />
            </div>
          </div>
          <button
            onClick={download}
            disabled={downloading}
            className="px-5 py-2.5 bg-[#0052cc] hover:bg-[#00478f] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
          >
            {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            Baixar imagem PNG
          </button>
        </div>
      )}
    </div>
  );
};
