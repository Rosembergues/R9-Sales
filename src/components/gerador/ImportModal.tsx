import React, { useState, useRef } from 'react';
import type { EmailBlock } from '../../types';
import { analyzeHtmlConversion, type HtmlImportAnalysis } from '../../utils/htmlImportAnalysis';
import {
  X,
  Upload,
  FileCode,
  FileText,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportHtml: (rawHtml: string, parsedBlocks: EmailBlock[]) => void;
  onShowToast: (message: string) => void;
}

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  onImportHtml,
  onShowToast,
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'paste'>('upload');
  const [pastedCode, setPastedCode] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [loadedFileContent, setLoadedFileContent] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<HtmlImportAnalysis | null>(null);
  const [analysisSource, setAnalysisSource] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileSelect = (file: File) => {
    if (!file) return;
    if (!file.name.endsWith('.html') && !file.name.endsWith('.htm') && file.type !== 'text/html') {
      onShowToast('Por favor, selecione um arquivo válido .html ou .htm');
      return;
    }

    setSelectedFileName(file.name);
    setAnalysis(null);
    setAnalysisSource(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setLoadedFileContent(content);
      setAnalysis(null);
      setAnalysisSource(null);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleConfirmImport = () => {
    const htmlToImport = activeTab === 'upload' ? loadedFileContent : pastedCode;
    if (!htmlToImport || !htmlToImport.trim()) {
      onShowToast('Nenhum código ou arquivo HTML selecionado para importação.');
      return;
    }

    // First click analyzes the conversion so users can inspect estimated content loss
    // before replacing the blocks currently in the editor.
    if (!analysis || analysisSource !== htmlToImport) {
      try {
        const result = analyzeHtmlConversion(htmlToImport);
        setAnalysis(result);
        setAnalysisSource(htmlToImport);
      } catch {
        onShowToast('Não foi possível analisar este HTML. Confira se o arquivo está íntegro.');
      }
      return;
    }

    onImportHtml(htmlToImport, analysis.blocks);
    const textSummary = analysis.textCoveragePercent === null
      ? 'não foi detectado texto para medir'
      : `${analysis.textCoveragePercent}% do texto (${analysis.retainedWordCount}/${analysis.sourceWordCount} palavras)`;
    const imageSummary = `${analysis.retainedImageCount}/${analysis.sourceImageCount} imagens`;
    const linkSummary = `${analysis.retainedLinkCount}/${analysis.sourceLinkCount} links`;
    onShowToast(`Importação concluída: ${textSummary}; ${imageSummary}; ${linkSummary}. Confira o resultado visual.`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div
        className="bg-white border border-slate-200 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">Importar HTML</h2>
              <p className="text-xs text-slate-500">
                Carregue um arquivo existente ou cole o código para converter em blocos editáveis.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="px-6 pt-4 pb-1 border-b border-slate-100 flex gap-4">
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`pb-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'upload'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>Upload de Arquivo</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('paste')}
            className={`pb-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'paste'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Colar Código HTML</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-grow">
          {activeTab === 'upload' ? (
            <div>
              <input
                type="file"
                ref={fileInputRef}
                accept=".html,.htm,text/html"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileSelect(e.target.files[0]);
                  }
                }}
                className="hidden"
              />

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer ${
                  isDragging
                    ? 'border-indigo-500 bg-indigo-50/50'
                    : selectedFileName
                    ? 'border-emerald-400 bg-emerald-50/30'
                    : 'border-slate-300 hover:border-indigo-400 bg-slate-50/50 hover:bg-slate-50'
                }`}
              >
                {selectedFileName ? (
                  <div className="space-y-2">
                    <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
                    <p className="text-sm font-bold text-slate-800">{selectedFileName}</p>
                    <p className="text-xs text-slate-500">
                      Arquivo pronto para ser importado. Clique para escolher outro.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Upload className="w-10 h-10 text-slate-400 mx-auto" />
                    <p className="text-sm font-bold text-slate-700">
                      Arraste e solte o arquivo .html aqui
                    </p>
                    <p className="text-xs text-slate-400">
                      ou clique para selecionar do seu computador
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 block">
                Cole o código HTML completo:
              </label>
              <textarea
                value={pastedCode}
                onChange={(e) => { setPastedCode(e.target.value); setAnalysis(null); setAnalysisSource(null); }}
                placeholder="<!DOCTYPE html><html><body>..."
                rows={10}
                className="w-full font-mono text-xs p-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none"
              />
            </div>
          )}

          {analysis && analysisSource === (activeTab === 'upload' ? loadedFileContent : pastedCode) && (
            <div className={`rounded-xl border p-3.5 space-y-2 text-xs ${analysis.hasContentLoss ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-emerald-200 bg-emerald-50 text-emerald-900'}`}>
              <div className="flex items-center gap-2 font-bold">
                {analysis.hasContentLoss ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
                <span>{analysis.hasContentLoss ? 'Análise: há conteúdo que pode não ser preservado' : 'Análise: conteúdo reconhecido'}</span>
              </div>
              <p className="leading-relaxed">
                {analysis.textCoveragePercent === null
                  ? 'Não foi detectado texto suficiente para calcular o aproveitamento textual.'
                  : `Aproveitamento textual estimado: ${analysis.textCoveragePercent}% (${analysis.retainedWordCount} de ${analysis.sourceWordCount} palavras identificadas).`}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <div className="rounded-lg bg-white/70 px-2.5 py-2"><strong className="block text-sm">{analysis.blockCount}</strong><span className="text-[10px]">blocos gerados</span></div>
                <div className="rounded-lg bg-white/70 px-2.5 py-2"><strong className="block text-sm">{analysis.retainedImageCount}/{analysis.sourceImageCount}</strong><span className="text-[10px]">imagens reconhecidas</span></div>
                <div className="rounded-lg bg-white/70 px-2.5 py-2"><strong className="block text-sm">{analysis.retainedLinkCount}/{analysis.sourceLinkCount}</strong><span className="text-[10px]">links reconhecidos</span></div>
              </div>
              <p className="text-[10px] leading-relaxed opacity-80">A medição considera texto, imagens e links reconhecidos. Colunas, bordas, espaçamentos e outros detalhes visuais podem ser simplificados na conversão para blocos.</p>
            </div>
          )}

          <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-3 flex items-start gap-2.5 text-xs text-amber-800">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p>
              A primeira etapa analisa o conteúdo sem substituir o e-mail atual. Só depois de conferir o resultado você confirma a importação.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50/50 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-lg cursor-pointer"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleConfirmImport}
            disabled={activeTab === 'upload' ? !loadedFileContent : !pastedCode.trim()}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg shadow-xs transition-all active:scale-95 cursor-pointer"
          >
            {analysis && analysisSource === (activeTab === 'upload' ? loadedFileContent : pastedCode) ? 'Confirmar e importar' : 'Analisar conversão'}
          </button>
        </div>
      </div>
    </div>
  );
};
