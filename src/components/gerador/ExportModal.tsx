import React, { useEffect, useState } from 'react';
import {
  X,
  Copy,
  Check,
  Download,
  Code2,
  Eye,
  CheckCircle2,
  ClipboardCheck,
  AlertTriangle,
  XCircle,
  FileText,
  ArrowRight,
} from 'lucide-react';
import type { ChecklistIssue } from '../../utils/emailChecklist';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  compiledHtml: string;
  plainText?: string;
  subject?: string;
  issues?: ChecklistIssue[];
  /** Closes the modal and takes the user to where the issue can be fixed. */
  onFixIssue?: (issue: ChecklistIssue) => void;
  onShowToast: (message: string) => void;
}

type Tab = 'review' | 'code' | 'text' | 'preview';

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
  }
}

function downloadFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function fileBaseName(subject: string): string {
  return (subject || 'email-newsletter')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'email';
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  compiledHtml,
  plainText = '',
  subject = 'newsletter',
  issues = [],
  onFixIssue,
  onShowToast,
}) => {
  const [copied, setCopied] = useState<'html' | 'text' | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('review');
  const errors = issues.filter((issue) => issue.severity === 'error');
  const warnings = issues.filter((issue) => issue.severity === 'warning');

  // Open on the review when something needs attention, otherwise straight to the code.
  // Only on opening: issues change while the modal is open as the user fixes them.
  const hasIssues = issues.length > 0;
  const [wasOpen, setWasOpen] = useState(false);
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) setActiveTab(hasIssues ? 'review' : 'code');
  }

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const baseName = fileBaseName(subject);
  const isText = activeTab === 'text';

  const handleCopy = async () => {
    await copyText(isText ? plainText : compiledHtml);
    setCopied(isText ? 'text' : 'html');
    onShowToast(isText ? 'Texto puro copiado!' : 'Código HTML copiado para a área de transferência!');
    setTimeout(() => setCopied(null), 2500);
  };

  const handleDownload = () => {
    try {
      if (isText) {
        downloadFile(plainText, `${baseName}.txt`, 'text/plain;charset=utf-8');
        onShowToast('Arquivo .txt baixado com sucesso!');
      } else {
        downloadFile(compiledHtml, `${baseName}.html`, 'text/html;charset=utf-8');
        onShowToast('Arquivo .html baixado com sucesso!');
      }
    } catch {
      onShowToast('Erro ao baixar o arquivo.');
    }
  };

  const tabButton = (tab: Tab, label: string, icon: React.ReactNode, badge?: React.ReactNode) => (
    <button
      type="button"
      onClick={() => setActiveTab(tab)}
      className={`px-3 py-1 rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
        activeTab === tab ? 'bg-white text-indigo-700 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
      }`}
    >
      {icon}
      <span>{label}</span>
      {badge}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Exportar e-mail"
        className="bg-white border border-slate-200 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">Exportar e-mail</h2>
              <p className="text-xs text-slate-500">Revise, copie o HTML e, se o disparador aceitar, a versão em texto puro.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-3 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2 bg-white">
          <div className="flex items-center flex-wrap bg-slate-100 p-0.5 rounded-lg text-xs font-medium border border-slate-200/80">
            {tabButton('review', 'Revisão', <ClipboardCheck className="w-3.5 h-3.5" />, issues.length > 0 && (
              <span className={`ml-0.5 rounded-full px-1.5 text-[10px] font-bold text-white ${errors.length ? 'bg-rose-500' : 'bg-amber-500'}`}>{issues.length}</span>
            ))}
            {tabButton('code', 'Código HTML', <Code2 className="w-3.5 h-3.5" />)}
            {tabButton('text', 'Texto puro', <FileText className="w-3.5 h-3.5" />)}
            {tabButton('preview', 'Pré-visualização', <Eye className="w-3.5 h-3.5" />)}
          </div>

          {activeTab !== 'review' && activeTab !== 'preview' && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void handleCopy()}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer border ${
                  copied ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-200'
                }`}
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                <span>{copied ? 'Copiado!' : isText ? 'Copiar texto' : 'Copiar código'}</span>
              </button>
              <button
                type="button"
                onClick={handleDownload}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-2xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isText ? 'Baixar .txt' : 'Baixar .html'}</span>
              </button>
            </div>
          )}
        </div>

        <div className="p-6 overflow-y-auto flex-grow bg-slate-50/50">
          {activeTab === 'review' && (
            <div className="space-y-3">
              {issues.length === 0 ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-emerald-800">Tudo certo para enviar!</p>
                    <p className="text-xs text-emerald-700 mt-0.5">Links, imagens, contraste, variáveis e tamanho foram verificados.</p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-600">
                  {errors.length > 0
                    ? `Encontramos ${errors.length} ${errors.length === 1 ? 'problema que chegaria' : 'problemas que chegariam'} ao destinatário`
                    : 'Nenhum problema grave'}
                  {warnings.length > 0 && ` e ${warnings.length} ${warnings.length === 1 ? 'sugestão' : 'sugestões'}`}. Clique em um item para corrigir.
                </p>
              )}
              <ul className="space-y-2">
                {issues.map((issue) => (
                  <li key={issue.id}>
                    <button
                      type="button"
                      onClick={() => onFixIssue?.(issue)}
                      disabled={!onFixIssue || (!issue.blockId && !issue.target)}
                      className="w-full text-left rounded-xl border bg-white p-3 flex items-start gap-3 hover:border-indigo-300 hover:bg-indigo-50/30 transition-colors cursor-pointer disabled:cursor-default disabled:hover:bg-white disabled:hover:border-slate-200 border-slate-200 group"
                    >
                      {issue.severity === 'error'
                        ? <XCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                        : <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />}
                      <div className="min-w-0 flex-grow">
                        <p className="text-xs font-bold text-slate-800">{issue.title}</p>
                        {issue.detail && <p className="text-[11px] text-slate-500 mt-0.5 break-words">{issue.detail}</p>}
                      </div>
                      {(issue.blockId || issue.target) && onFixIssue && (
                        <span className="text-[11px] font-semibold text-indigo-600 flex items-center gap-0.5 shrink-0 opacity-70 group-hover:opacity-100">
                          Corrigir <ArrowRight className="w-3 h-3" />
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
              {issues.length > 0 && (
                <button type="button" onClick={() => setActiveTab('code')} className="text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer">
                  Exportar mesmo assim →
                </button>
              )}
            </div>
          )}

          {activeTab === 'code' && (
            <div className="space-y-3">
              <textarea
                readOnly
                value={compiledHtml}
                rows={14}
                className="w-full font-mono text-xs bg-slate-900 text-slate-100 p-4 rounded-xl border border-slate-800 focus:outline-none resize-none selection:bg-indigo-500 selection:text-white"
              />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2">
                <div className="p-2.5 bg-white border border-slate-200 rounded-xl flex items-center gap-2 text-xs text-slate-700">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Compatível com Gmail & Apple Mail</span>
                </div>
                <div className="p-2.5 bg-white border border-slate-200 rounded-xl flex items-center gap-2 text-xs text-slate-700">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Botões especiais para o Outlook</span>
                </div>
                <div className="p-2.5 bg-white border border-slate-200 rounded-xl flex items-center gap-2 text-xs text-slate-700">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Estrutura em tabelas + CSS defensivo</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'text' && (
            <div className="space-y-2">
              <p className="text-xs text-slate-600">
                Versão sem formatação do mesmo conteúdo. Se o seu disparador tiver um campo "versão texto" ou "text/plain", cole aqui; isso ajuda a não cair no spam.
              </p>
              <textarea
                readOnly
                value={plainText}
                rows={14}
                className="w-full font-mono text-xs bg-white text-slate-800 p-4 rounded-xl border border-slate-200 focus:outline-none resize-none"
              />
            </div>
          )}

          {activeTab === 'preview' && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 flex justify-center items-center">
              <iframe
                title="Export Preview"
                srcDoc={compiledHtml}
                sandbox=""
                className="w-full max-w-[580px] h-[400px] border-0 rounded-lg shadow-sm"
              />
            </div>
          )}
        </div>

        <div className="px-6 py-3 border-t border-slate-200 bg-white flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
