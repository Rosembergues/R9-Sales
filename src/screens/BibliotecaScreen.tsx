import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDownUp, ArrowRight, BookOpen, Check, Clock3, Copy, FileText,
  LoaderCircle, RefreshCw, Search, ShieldCheck, Sparkles, Trash2,
  RotateCcw, UserRound, X,
} from 'lucide-react';
import type { TemplateDocument } from '../utils/templateStore';
import { TemplateMiniPreview } from '../components/TemplateMiniPreview';
import {
  deleteSavedTemplate,
  getTemplateLibraryContext,
  listSavedTemplates,
  restoreTemplateVersion,
  type TemplateLibraryContext,
} from '../utils/templateStore';

interface BibliotecaScreenProps {
  onUseTemplate: (template: TemplateDocument) => void;
  onEditTemplate: (template: TemplateDocument) => void;
  onCreateTemplate: () => void;
}

type LibraryFilter = 'todos' | 'meus';

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Data indisponível';
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export const BibliotecaScreen: React.FC<BibliotecaScreenProps> = ({ onUseTemplate, onEditTemplate, onCreateTemplate }) => {
  const [templates, setTemplates] = useState<TemplateDocument[]>([]);
  const [context, setContext] = useState<TemplateLibraryContext | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<LibraryFilter>('todos');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const loadLibrary = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [items, userContext] = await Promise.all([listSavedTemplates(), getTemplateLibraryContext()]);
      setTemplates(items);
      setContext(userContext);
      setSelectedId((current) => current && items.some((item) => item.id === current) ? current : items[0]?.id ?? null);
    } catch (error) {
      setLoadError(errorMessage(error, 'Não foi possível carregar a biblioteca.'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void loadLibrary(); }, [loadLibrary]);

  const filteredTemplates = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('pt-BR');
    return templates.filter((template) => {
      if (filter === 'meus' && template.createdBy !== context?.userId) return false;
      if (!normalizedSearch) return true;
      return [template.name, template.description, template.subject]
        .some((value) => (value || '').toLocaleLowerCase('pt-BR').includes(normalizedSearch));
    });
  }, [templates, search, filter, context?.userId]);

  const selectedTemplate = filteredTemplates.find((item) => item.id === selectedId)
    || filteredTemplates[0]
    || null;
  const canManage = (template: TemplateDocument) => Boolean(context?.isAdmin || template.createdBy === context?.userId);

  const handleDelete = async (template: TemplateDocument) => {
    if (!context?.isAdmin) return;
    const confirmed = window.confirm(`Excluir definitivamente o modelo “${template.name}”? Essa ação não pode ser desfeita.`);
    if (!confirmed) return;
    setBusyAction(`delete:${template.id}`);
    setNotice(null);
    try {
      await deleteSavedTemplate(template.id);
      setTemplates((current) => current.filter((item) => item.id !== template.id));
      setSelectedId((current) => current === template.id ? null : current);
      setNotice({ kind: 'success', text: `O modelo “${template.name}” foi excluído.` });
    } catch (error) {
      setNotice({ kind: 'error', text: errorMessage(error, 'Não foi possível excluir o modelo.') });
    } finally {
      setBusyAction(null);
    }
  };

  const handleRestore = async (template: TemplateDocument, versionId: string) => {
    if (!canManage(template)) return;
    const confirmed = window.confirm(`Restaurar esta versão de “${template.name}”? O conteúdo atual será substituído por essa versão.`);
    if (!confirmed) return;
    setBusyAction(`restore:${versionId}`);
    setNotice(null);
    try {
      const restored = await restoreTemplateVersion(template.id, versionId);
      if (!restored) throw new Error('Não foi possível localizar essa versão. Atualize a biblioteca e tente novamente.');
      await loadLibrary();
      setSelectedId(template.id);
      setNotice({ kind: 'success', text: `A versão selecionada de “${template.name}” foi restaurada.` });
    } catch (error) {
      setNotice({ kind: 'error', text: errorMessage(error, 'Não foi possível restaurar a versão.') });
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div className="min-h-full flex-1 bg-slate-50 px-4 pb-8 pt-24 text-slate-800 md:px-8 md:pb-10 md:pt-28">
      <div className="mx-auto max-w-7xl">
        <div className="mb-7 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700">
              <BookOpen size={14} /> Repositório compartilhado
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">Biblioteca de modelos</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Encontre um modelo publicado pela equipe, use uma cópia no editor ou mantenha os modelos que você criou.</p>
          </div>
          <button type="button" onClick={onCreateTemplate} className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">
            <Sparkles size={17} /> Criar modelo para compartilhar
          </button>
        </div>

        {notice && (
          <div role="status" className={`mb-5 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${notice.kind === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : notice.kind === 'error' ? 'border-red-200 bg-red-50 text-red-800' : 'border-blue-200 bg-blue-50 text-blue-800'}`}>
            {notice.kind === 'success' ? <Check size={18} className="mt-0.5 shrink-0" /> : <X size={18} className="mt-0.5 shrink-0" />}
            <span className="flex-1">{notice.text}</span>
            <button type="button" onClick={() => setNotice(null)} className="rounded p-0.5 opacity-70 hover:opacity-100" aria-label="Fechar aviso"><X size={16} /></button>
          </div>
        )}

        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm md:p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">Buscar modelos</span>
              <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome, descrição ou assunto..." className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100" />
            </label>
            <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1" role="group" aria-label="Filtrar modelos">
              <button type="button" onClick={() => setFilter('todos')} aria-pressed={filter === 'todos'} className={`rounded-lg px-3.5 py-2.5 text-xs font-bold transition ${filter === 'todos' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>Todos os modelos</button>
              <button type="button" onClick={() => setFilter('meus')} aria-pressed={filter === 'meus'} className={`rounded-lg px-3.5 py-2.5 text-xs font-bold transition ${filter === 'meus' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>Meus modelos</button>
            </div>
            <button type="button" onClick={() => void loadLibrary()} disabled={isLoading} title="Atualizar biblioteca" className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3.5 py-3 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"><RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} /> Atualizar</button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex min-h-72 items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white text-sm text-slate-500"><LoaderCircle className="animate-spin" size={20} /> Carregando modelos da biblioteca…</div>
        ) : loadError ? (
          <div className="rounded-2xl border border-red-200 bg-white px-5 py-14 text-center">
            <BookOpen size={34} className="mx-auto text-red-400" />
            <h2 className="mt-3 text-lg font-bold text-slate-900">Não foi possível abrir a biblioteca</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">{loadError}</p>
            <button type="button" onClick={() => void loadLibrary()} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-700"><RefreshCw size={15} /> Tentar novamente</button>
          </div>
        ) : templates.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-16 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600"><BookOpen size={27} /></span>
            <h2 className="mt-4 text-lg font-bold text-slate-900">A biblioteca ainda está vazia</h2>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-600">Crie um e-mail no editor e publique um modelo com nome e descrição para que outras unidades também possam encontrá-lo.</p>
            <button type="button" onClick={onCreateTemplate} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white hover:bg-indigo-700"><Sparkles size={16} /> Criar primeiro modelo</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)] xl:gap-6">
            <section aria-label="Lista de modelos" className="min-w-0">
              <div className="mb-3 flex items-center justify-between gap-3 text-xs text-slate-500">
                <span>{filteredTemplates.length} {filteredTemplates.length === 1 ? 'modelo encontrado' : 'modelos encontrados'}</span>
                <span className="inline-flex items-center gap-1"><ArrowDownUp size={13} /> Mais recentes primeiro</span>
              </div>
              {filteredTemplates.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
                  <Search size={25} className="mx-auto text-slate-300" />
                  <p className="mt-3 text-sm font-bold text-slate-800">Nenhum modelo encontrado</p>
                  <p className="mt-1 text-xs text-slate-500">Tente outro termo ou altere o filtro.</p>
                  <button type="button" onClick={() => { setSearch(''); setFilter('todos'); }} className="mt-3 text-xs font-bold text-indigo-700 hover:underline">Limpar busca e filtros</button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {filteredTemplates.map((template) => {
                    const isSelected = selectedTemplate?.id === template.id;
                    const isOwner = template.createdBy === context?.userId;
                    return (
                      <article key={template.id} className={`flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition ${isSelected ? 'border-indigo-400 ring-2 ring-indigo-100' : 'border-slate-200 hover:border-indigo-200 hover:shadow-md'}`}>
                        <button type="button" onClick={() => setSelectedId(template.id)} className="flex flex-1 flex-col text-left focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-400">
                          <div className="relative p-2 pb-0">
                            <TemplateMiniPreview blocks={template.blocks} variant="card" label={`Prévia de ${template.name}`} />
                            <span className="absolute right-4 top-4 rounded-full border border-white/70 bg-white/95 px-2.5 py-1 text-[10px] font-bold text-slate-700 shadow-sm">{template.blocks.length} blocos</span>
                          </div>
                          <div className="flex w-full flex-1 flex-col p-4">
                            <h2 className="line-clamp-2 min-h-10 break-words text-sm font-bold text-slate-900">{template.name}</h2>
                            <p className="mt-2 line-clamp-3 min-h-[3.5rem] text-xs leading-5 text-slate-600">{template.description || 'Modelo compartilhado pela equipe.'}</p>
                            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-100 pt-3 text-[10px] text-slate-400">
                              <span className="inline-flex items-center gap-1">{isOwner ? <ShieldCheck size={12} /> : <UserRound size={12} />}{isOwner ? 'Criado por você' : 'Compartilhado pela equipe'}</span>
                              <span>{formatDate(template.updatedAt)}</span>
                            </div>
                          </div>
                        </button>
                        <div className="flex gap-2 px-4 pb-4">
                          <button type="button" onClick={() => onUseTemplate(template)} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2.5 text-xs font-bold text-white hover:bg-indigo-700"><Copy size={13} /> Usar modelo</button>
                          {canManage(template) && <button type="button" onClick={() => onEditTemplate(template)} className="rounded-lg border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50">Editar</button>}
                          {context?.isAdmin && <button type="button" onClick={() => void handleDelete(template)} disabled={busyAction === `delete:${template.id}`} title="Excluir (administrador)" aria-label={`Excluir ${template.name}`} className="rounded-lg border border-red-200 px-2.5 py-2.5 text-red-600 hover:bg-red-50 disabled:opacity-50"><Trash2 size={14} /></button>}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            <aside aria-label="Detalhes do modelo selecionado" className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-24">
              {!selectedTemplate ? (
                <div className="flex min-h-56 flex-col items-center justify-center text-center text-sm text-slate-400"><FileText size={30} className="mb-3 opacity-50" />Selecione um modelo para ver os detalhes.</div>
              ) : (
                <>
                  <div className="flex items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700"><FileText size={21} /></span>
                    <div className="min-w-0 flex-1">
                      <h2 className="break-words text-lg font-bold text-slate-900">{selectedTemplate.name}</h2>
                      <p className="mt-1 text-xs leading-5 text-slate-600">{selectedTemplate.description || 'Modelo compartilhado pela equipe.'}</p>
                    </div>
                  </div>
                  <div className="mt-5">
                    <TemplateMiniPreview blocks={selectedTemplate.blocks} variant="detail" label={`Prévia ampliada de ${selectedTemplate.name}`} />
                  </div>
                  <div className="mt-5 grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-slate-50 p-3"><div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Blocos</div><div className="mt-1 text-lg font-bold text-slate-900">{selectedTemplate.blocks.length}</div></div>
                    <div className="rounded-xl bg-slate-50 p-3"><div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Atualizado</div><div className="mt-1 text-sm font-bold text-slate-900">{formatDate(selectedTemplate.updatedAt)}</div></div>
                  </div>
                  <div className="mt-4 rounded-xl border border-slate-200 p-3">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Assunto do e-mail</div>
                    <div className="mt-1 break-words text-sm font-semibold text-slate-800">{selectedTemplate.subject || 'Sem assunto'}</div>
                  </div>
                  <div className="mt-5 flex flex-col gap-2 sm:flex-row lg:flex-col xl:flex-row">
                    <button type="button" onClick={() => onUseTemplate(selectedTemplate)} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white hover:bg-indigo-700"><Copy size={15} /> Usar uma cópia</button>
                    {canManage(selectedTemplate) && <button type="button" onClick={() => onEditTemplate(selectedTemplate)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">Editar original</button>}
                  </div>
                  <div className="mt-7 border-t border-slate-100 pt-5">
                    <div className="mb-3 flex items-center gap-2"><Clock3 size={16} className="text-indigo-600" /><h3 className="text-sm font-bold text-slate-900">Histórico de versões</h3></div>
                    {!canManage(selectedTemplate) ? (
                      <p className="rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500">O histórico pode ser restaurado pelo dono do modelo ou por um administrador.</p>
                    ) : selectedTemplate.versions.length === 0 ? (
                      <p className="rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500">Ainda não há versões anteriores para recuperar.</p>
                    ) : (
                      <div className="space-y-2">
                        {selectedTemplate.versions.map((version, index) => (
                          <div key={version.id} className="flex items-center gap-2 rounded-xl border border-slate-200 p-3">
                            <div className="min-w-0 flex-1"><div className="text-xs font-bold text-slate-800">{index === 0 ? 'Versão atual' : `Versão ${version.versionNumber}`}</div><div className="mt-1 text-[10px] text-slate-500">{formatDate(version.createdAt)} · {version.blocks.length} blocos</div></div>
                            {index > 0 && <button type="button" onClick={() => void handleRestore(selectedTemplate, version.id)} disabled={busyAction === `restore:${version.id}`} title="Restaurar esta versão" aria-label={`Restaurar versão ${version.versionNumber}`} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-2 text-[10px] font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50">{busyAction === `restore:${version.id}` ? <LoaderCircle size={13} className="animate-spin" /> : <RotateCcw size={13} />} Restaurar</button>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="mt-5 flex items-start gap-2 text-[11px] leading-5 text-slate-400"><ShieldCheck size={14} className="mt-0.5 shrink-0" /> Usar modelo cria uma cópia independente. O original só pode ser editado pelo dono ou por um administrador.</p>
                </>
              )}
            </aside>
          </div>
        )}
      </div>
    </div>
  );
};
