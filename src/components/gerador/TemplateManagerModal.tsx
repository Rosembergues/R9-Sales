import React, { useEffect, useState } from 'react';
import { Clock3, Copy, FileText, LoaderCircle, RotateCcw, ShieldCheck, Trash2, X } from 'lucide-react';
import type { TemplateDocument } from '../../utils/templateStore';

interface TemplateManagerModalProps {
  isOpen: boolean;
  templates: TemplateDocument[];
  currentUserId: string;
  isAdmin: boolean;
  isLoading?: boolean;
  loadError?: string | null;
  onRetry?: () => void;
  onClose: () => void;
  onUse: (template: TemplateDocument) => void;
  onEdit: (template: TemplateDocument) => void;
  onDelete: (id: string) => void;
  onRestoreVersion: (templateId: string, versionId: string) => void;
}

export const TemplateManagerModal: React.FC<TemplateManagerModalProps> = ({
  isOpen,
  templates,
  currentUserId,
  isAdmin,
  isLoading = false,
  loadError = null,
  onRetry,
  onClose,
  onUse,
  onEdit,
  onDelete,
  onRestoreVersion,
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  useEffect(() => {
    if (selectedId && !templates.some((item) => item.id === selectedId)) setSelectedId(null);
    if (!selectedId && templates.length) setSelectedId(templates[0].id);
  }, [selectedId, templates]);

  if (!isOpen) return null;
  const selected = loadError ? null : templates.find((item) => item.id === selectedId) || null;
  const canManage = (template: TemplateDocument) => isAdmin || template.createdBy === currentUserId;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="template-manager-title" className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[88vh] overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 id="template-manager-title" className="text-base font-bold text-slate-800">Biblioteca de modelos</h2>
            <p className="text-xs text-slate-500">Modelos públicos disponíveis para toda a equipe.</p>
          </div>
          <button type="button" aria-label="Fechar biblioteca" onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2">
          <div className="overflow-y-auto p-4 border-r border-slate-100 space-y-2">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-slate-400 text-xs"><LoaderCircle className="w-5 h-5 animate-spin" />Carregando modelos da nuvem…</div>
            ) : loadError ? (
              <div className="flex flex-col items-center justify-center gap-3 py-12 px-5 text-center">
                <div className="text-xs font-semibold text-red-600">Não foi possível carregar a biblioteca</div>
                <p className="text-xs leading-5 text-slate-500">{loadError}</p>
                {onRetry && <button type="button" onClick={onRetry} className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700">Tentar novamente</button>}
              </div>
            ) : templates.length === 0 ? (
              <div className="text-center py-12 px-5 text-slate-400 text-xs">
                <FileText className="w-7 h-7 mx-auto mb-2 opacity-60" />
                <p className="font-semibold text-slate-600">A biblioteca ainda está vazia.</p>
                <p className="mt-1">Salve um modelo pelo editor para publicá-lo e compartilhá-lo com a equipe.</p>
              </div>
            ) : templates.map((template) => {
              const manageable = canManage(template);
              const isOwner = template.createdBy === currentUserId;
              return (
                <div key={template.id} className={`p-3 rounded-xl border ${selectedId === template.id ? 'border-indigo-300 bg-indigo-50/70' : 'border-slate-200 bg-white'}`}>
                  <button type="button" onClick={() => setSelectedId(template.id)} className="w-full text-left">
                    <div className="flex items-start gap-2">
                      <FileText className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-xs text-slate-800 break-words">{template.name}</div>
                        <div className="text-[11px] text-slate-500 break-words mt-0.5">{template.subject}</div>
                        <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                          {isOwner ? <><ShieldCheck className="w-3 h-3" /> Criado por você</> : 'Modelo compartilhado'}
                          <span>·</span><span>{template.blocks.length} blocos</span>
                        </div>
                      </div>
                    </div>
                  </button>
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    <button type="button" onClick={() => onUse(template)} className="flex-1 min-w-[110px] px-2 py-1.5 rounded-lg bg-indigo-600 text-white text-[11px] font-bold hover:bg-indigo-700 inline-flex justify-center items-center gap-1"><Copy className="w-3 h-3" />Usar modelo</button>
                    {manageable && <button type="button" onClick={() => onEdit(template)} className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-[11px] font-bold">Editar</button>}
                    {isAdmin && <button type="button" onClick={() => onDelete(template.id)} className="px-2 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50" title="Excluir modelo (administrador)" aria-label={`Excluir ${template.name}`}><Trash2 className="w-3.5 h-3.5" /></button>}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="overflow-y-auto p-4 bg-slate-50/70">
            {!selected ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-xs text-slate-400 gap-2"><FileText className="w-8 h-8 opacity-50" />Selecione um modelo para ver o histórico de versões.</div>
            ) : (
              <div>
                <div className="mb-4">
                  <div className="text-sm font-bold text-slate-800">{selected.name}</div>
                  <p className="text-xs text-slate-500 mt-1">{selected.description || 'Modelo de e-mail compartilhado.'}</p>
                  <div className="text-[10px] text-slate-400 mt-2">Atualizado em {new Date(selected.updatedAt).toLocaleString('pt-BR')}</div>
                </div>
                <div className="flex items-center gap-2 mb-3"><Clock3 className="w-4 h-4 text-indigo-600" /><h3 className="text-xs font-bold text-slate-800">Histórico de versões</h3></div>
                {!canManage(selected) ? (
                  <div className="rounded-xl bg-white border border-slate-200 p-4 text-xs text-slate-500">O histórico é mantido para recuperação. Somente o dono do modelo ou um administrador pode restaurar versões.</div>
                ) : selected.versions.length === 0 ? (
                  <div className="rounded-xl bg-white border border-slate-200 p-4 text-xs text-slate-500">Ainda não há versões salvas.</div>
                ) : (
                  <div className="space-y-2">
                    {selected.versions.map((version, index) => (
                      <div key={version.id} className="p-3 rounded-xl bg-white border border-slate-200 flex items-center gap-2">
                        <div className="flex-1 min-w-0"><div className="text-xs font-semibold text-slate-700">{index === 0 ? 'Versão atual' : `Versão ${version.versionNumber}`}</div><div className="text-[10px] text-slate-400">{new Date(version.createdAt).toLocaleString('pt-BR')} · {version.blocks.length} blocos</div></div>
                        <button type="button" onClick={() => onRestoreVersion(selected.id, version.id)} className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600" title="Restaurar esta versão"><RotateCcw className="w-3.5 h-3.5" /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
