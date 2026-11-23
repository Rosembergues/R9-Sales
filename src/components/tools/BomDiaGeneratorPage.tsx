import React, { useCallback, useRef, useState } from 'react';
import { Upload, Download, AlertCircle, Loader2, FileText, X, Sparkles } from 'lucide-react';
import { parseFunilSavaPdf, type BusinessUnit, type FunilSavaResult } from '../../lib/bomDiaParser';
import { BomDiaCard } from './BomDiaCard';

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
  const cardRefs = useRef<Record<BusinessUnit, HTMLDivElement | null>>({ presencial: null, digital: null });
  const [downloadingBu, setDownloadingBu] = useState<BusinessUnit | null>(null);

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

  const handleDownload = useCallback(async (bu: BusinessUnit) => {
    const node = cardRefs.current[bu];
    if (!node) return;
    setDownloadingBu(bu);
    try {
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(node, { pixelRatio: 3.2, cacheBust: true });
      const resultado = cards[bu];
      const dataHoje = new Date().toISOString().slice(0, 10);
      const link = document.createElement('a');
      link.download = `bom-dia-captacao-${bu}-${resultado?.academicPeriod ?? ''}-${dataHoje}.png`;
      link.href = dataUrl;
      link.click();
    } catch {
      setErrors((prev) => [...prev, `Não consegui gerar a imagem da ${BU_TITLE[bu]}. Tente novamente.`]);
    } finally {
      setDownloadingBu(null);
    }
  }, [cards]);

  const clearCard = useCallback((bu: BusinessUnit) => {
    setCards((prev) => ({ ...prev, [bu]: null }));
  }, []);

  const temAlgumCard = cards.presencial || cards.digital;

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
          Solte aqui os PDFs do relatório "Funil de Captação - Sava" (BU Presencial e/ou BU Digital) recebidos por
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 justify-items-center">
        {(['presencial', 'digital'] as BusinessUnit[]).map((bu) => {
          const resultado = cards[bu];
          if (!resultado) return null;
          return (
            <div key={bu} className="space-y-2.5 flex flex-col items-center">
              <div className="flex items-center justify-between w-full max-w-[460px]">
                <span className="text-xs font-bold text-slate-700">{BU_TITLE[bu]} · {resultado.academicPeriod}</span>
                <button
                  onClick={() => clearCard(bu)}
                  className="text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                  title="Remover"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <BomDiaCard
                ref={(el) => {
                  cardRefs.current[bu] = el;
                }}
                bu={bu}
                academicPeriod={resultado.academicPeriod}
                metaFinal={resultado.metaFinal}
                metaDoDia={resultado.metaDoDia}
                realizado={resultado.realizado}
              />

              <button
                onClick={() => handleDownload(bu)}
                disabled={downloadingBu === bu}
                className="px-4 py-2 bg-[#0052cc] hover:bg-[#00478f] disabled:opacity-60 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
              >
                {downloadingBu === bu ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                Baixar imagem
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
