import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { Upload, Download, AlertCircle, Loader2, FileText, X, Sparkles } from 'lucide-react';
import { parseFunilSavaPdf, type BusinessUnit, type FunilSavaResult } from '../../lib/bomDiaParser';
import { BomDiaFullCard, BOM_DIA_CARD_WIDTH } from './BomDiaFullCard';

type CardState = Record<BusinessUnit, FunilSavaResult | null>;

const BU_TITLE: Record<BusinessUnit, string> = {
  presencial: 'BU Presencial',
  digital: 'BU Digital',
};

export const BomDiaGeneratorPage: React.FC = () => {
  const [cards, setCards] = useState<CardState>({ presencial: null, digital: null });
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const fullCardRef = useRef<HTMLDivElement | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const handleFiles = useCallback(async (fileList: FileList | File[]) => {
    const files = Array.from(fileList).filter((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    if (files.length === 0) return;

    setIsProcessing(true);
    const novosErros: string[] = [];
    const resultados: Partial<CardState> = {};

    for (const file of files) {
      try {
        const resultado = await parseFunilSavaPdf(file);
        resultados[resultado.bu] = resultado;
      } catch (err) {
        novosErros.push(err instanceof Error ? err.message : `Falha ao processar "${file.name}".`);
      }
    }

    setCards((prev) => ({ ...prev, ...resultados }));
    setErrors(novosErros);
    setIsProcessing(false);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const onPickFiles = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.length) handleFiles(e.target.files);
      e.target.value = '';
    },
    [handleFiles]
  );

  const temAsDuas = Boolean(cards.presencial && cards.digital);

  const handleDownload = useCallback(async () => {
    const node = fullCardRef.current;
    if (!node || !temAsDuas) return;
    setIsDownloading(true);
    try {
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(node, { pixelRatio: 2.5, cacheBust: true });
      const dataHoje = new Date().toISOString().slice(0, 10);
      const link = document.createElement('a');
      link.download = `bom-dia-captacao-${dataHoje}.png`;
      link.href = dataUrl;
      link.click();
    } catch {
      setErrors((prev) => [...prev, 'Não consegui gerar a imagem. Tente novamente.']);
    } finally {
      setIsDownloading(false);
    }
  }, [temAsDuas]);

  const clearCard = useCallback((bu: BusinessUnit) => {
    setCards((prev) => ({ ...prev, [bu]: null }));
  }, []);

  const temAlgumCard = Boolean(cards.presencial || cards.digital);

  const previewWrapRef = useRef<HTMLDivElement | null>(null);
  const [preview, setPreview] = useState({ scale: 1, cardH: 0, wrapW: 0 });

  useLayoutEffect(() => {
    const wrap = previewWrapRef.current;
    const card = fullCardRef.current;
    if (!wrap || !card) return;
    const update = () =>
      setPreview({
        scale: Math.min(1, wrap.clientWidth / BOM_DIA_CARD_WIDTH),
        cardH: card.offsetHeight,
        wrapW: wrap.clientWidth,
      });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(wrap);
    ro.observe(card);
    return () => ro.disconnect();
  }, [temAlgumCard]);

  return (
    <div className="max-w-5xl mx-auto animate-in fade-in duration-200 space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-[#0052cc] text-white flex items-center justify-center shrink-0">
            <Sparkles className="w-4.5 h-4.5" />
          </div>
          <h2 className="text-lg font-black text-slate-900">Gerador - Bom Dia Captação</h2>
        </div>
        <p className="text-xs text-slate-500 mt-1.5 max-w-2xl">
          Solte aqui os PDFs do relatório "Funil de Captação - Sava" (BU Presencial e BU Digital) recebidos por
          e-mail. O sistema identifica a BU e o período automaticamente e gera a arte de acompanhamento do dia,
          pronta para baixar.
        </p>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`rounded-2xl border-2 border-dashed p-8 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors ${
          isDragging ? 'border-[#0052cc] bg-blue-50' : 'border-gray-300 bg-white hover:bg-gray-50'
        }`}
      >
        <input ref={inputRef} type="file" accept=".pdf" multiple className="hidden" onChange={onPickFiles} />
        {isProcessing ? (
          <Loader2 className="w-6 h-6 text-[#0052cc] animate-spin" />
        ) : (
          <Upload className="w-6 h-6 text-slate-400" />
        )}
        <p className="text-xs font-semibold text-slate-600">
          {isProcessing ? 'Lendo os PDFs...' : 'Arraste os PDFs aqui ou clique para selecionar'}
        </p>
        <p className="text-[10px] text-slate-400">Aceita um ou os dois relatórios de uma vez (.pdf)</p>
      </div>

      {errors.length > 0 && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-3 space-y-1">
          {errors.map((erro, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-red-700">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{erro}</span>
            </div>
          ))}
        </div>
      )}

      {!temAlgumCard && !isProcessing && (
        <div className="flex items-center gap-2 text-xs text-slate-400 py-6 justify-center">
          <FileText className="w-4 h-4" />
          Nenhum relatório carregado ainda.
        </div>
      )}

      {temAlgumCard && (
        <div className="space-y-4 flex flex-col items-center">
          <div className="flex items-center gap-4 flex-wrap justify-center">
            {(['presencial', 'digital'] as BusinessUnit[]).map((bu) => {
              const resultado = cards[bu];
              if (!resultado) return null;
              return (
                <div
                  key={bu}
                  className="flex items-center gap-2 text-xs font-bold text-slate-700 bg-white border border-gray-200 rounded-lg px-3 py-1.5"
                >
                  <span>
                    {BU_TITLE[bu]} · {resultado.academicPeriod}
                  </span>
                  <button
                    onClick={() => clearCard(bu)}
                    className="text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                    title="Remover"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>

          {!temAsDuas && (
            <p className="text-xs text-slate-400">
              Carregue o PDF da BU que falta para liberar o download da imagem completa.
            </p>
          )}

          <div ref={previewWrapRef} className="w-full" style={{ height: preview.cardH * preview.scale }}>
            <div
              style={{
                width: BOM_DIA_CARD_WIDTH,
                transform: `scale(${preview.scale})`,
                transformOrigin: 'top left',
                marginLeft: Math.max(0, (preview.wrapW - BOM_DIA_CARD_WIDTH * preview.scale) / 2),
              }}
              className="rounded-2xl overflow-hidden shadow-md"
            >
              <BomDiaFullCard ref={fullCardRef} presencial={cards.presencial} digital={cards.digital} />
            </div>
          </div>

          <button
            onClick={handleDownload}
            disabled={!temAsDuas || isDownloading}
            className="px-5 py-2.5 bg-[#0052cc] hover:bg-[#00478f] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
          >
            {isDownloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            Baixar imagem
          </button>
        </div>
      )}
    </div>
  );
};
