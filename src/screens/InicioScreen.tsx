import React, { useEffect, useState } from 'react';
import { ArrowRight, Blocks, BookOpen, FileCode2, FileText, Layers3, LoaderCircle, RefreshCw, Sparkles } from 'lucide-react';
import type { Screen, TransitionType } from '../types';
import { listSavedTemplates, type TemplateDocument } from '../utils/templateStore';

interface InicioScreenProps {
  onNavigate: (screen: Screen, transition?: TransitionType) => void;
  onOpenLibrary: () => void;
  onSelectLibraryTemplate: (template: TemplateDocument) => void;
}

function formatUpdatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Atualização recente';
  return `Atualizado em ${date.toLocaleDateString('pt-BR')}`;
}

export const InicioScreen: React.FC<InicioScreenProps> = ({ onNavigate, onOpenLibrary, onSelectLibraryTemplate }) => {
  const [recentTemplates, setRecentTemplates] = useState<TemplateDocument[]>([]);
  const [isLoadingRecent, setIsLoadingRecent] = useState(true);
  const [recentLoadError, setRecentLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setIsLoadingRecent(true);
    setRecentLoadError(null);

    listSavedTemplates(3)
      .then((templates) => {
        if (active) setRecentTemplates(templates);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setRecentTemplates([]);
        setRecentLoadError(error instanceof Error ? error.message : 'Não foi possível carregar os modelos recentes.');
      })
      .finally(() => {
        if (active) setIsLoadingRecent(false);
      });

    return () => { active = false; };
  }, [reloadKey]);

  return (
    <main className="flex-grow w-full bg-slate-50 px-4 py-10 md:px-8 md:py-14 text-slate-800">
      <div className="mx-auto max-w-6xl">
        <section className="mb-8 md:mb-10">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
            <Layers3 size={14} /> R9Bot Mailer
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">O que você quer fazer?</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 md:text-base">
            Crie, edite e confira seus e-mails em um só lugar.
          </p>
        </section>

        <section aria-label="Ações principais">
          <button
            type="button"
            onClick={() => onNavigate('gerador_pro', 'push')}
            className="group flex min-h-48 w-full flex-col rounded-2xl border border-blue-700 bg-blue-700 p-6 text-left text-white transition-all hover:-translate-y-0.5 hover:bg-blue-800 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 md:p-7"
          >
            <span className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 text-white">
              <Blocks size={23} />
            </span>
            <span className="text-xl font-bold">Criar ou editar e-mail</span>
            <span className="mt-2 max-w-2xl text-sm leading-6 text-blue-100">
              Monte seu e-mail com blocos, abra um e-mail salvo ou importe um HTML existente. Sem precisar escrever código.
            </span>
            <span className="mt-auto flex items-center gap-2 pt-6 text-xs font-semibold text-white">
              Abrir o editor <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
            </span>
          </button>
        </section>

        <section className="mt-4" aria-label="Biblioteca compartilhada">
          <button
            type="button"
            onClick={onOpenLibrary}
            className="group flex w-full items-center gap-4 rounded-2xl border border-indigo-200 bg-white p-5 text-left shadow-sm transition-all hover:border-indigo-300 hover:bg-indigo-50/40 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700"><BookOpen size={22} /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-slate-900">Biblioteca compartilhada</span>
              <span className="mt-1 block text-xs leading-5 text-slate-600">Consulte os modelos publicados pela equipe ou publique um novo e-mail para todos reutilizarem.</span>
            </span>
            <ArrowRight size={18} className="shrink-0 text-indigo-600 transition-transform group-hover:translate-x-1" />
          </button>
        </section>

        <section className="mt-10 md:mt-12" aria-label="Modelos recentes da biblioteca">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-indigo-700">
                <Sparkles size={16} /> Compartilhados pela equipe
              </div>
              <h2 className="text-xl font-bold tracking-tight text-slate-900 md:text-2xl">Modelos recentes da Biblioteca</h2>
              <p className="mt-1.5 text-sm text-slate-600">Os três modelos públicos atualizados mais recentemente por qualquer unidade.</p>
            </div>
            <button
              type="button"
              onClick={onOpenLibrary}
              className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-indigo-200 bg-white px-3.5 py-2.5 text-xs font-bold text-indigo-700 transition-colors hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              Ver biblioteca completa <ArrowRight size={14} />
            </button>
          </div>

          {isLoadingRecent ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Carregando modelos" aria-live="polite">
              {[0, 1, 2].map((item) => (
                <div key={item} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="h-28 animate-pulse bg-slate-100" />
                  <div className="space-y-3 p-4">
                    <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
                    <div className="h-3 w-full animate-pulse rounded bg-slate-100" />
                    <div className="h-3 w-4/5 animate-pulse rounded bg-slate-100" />
                  </div>
                </div>
              ))}
            </div>
          ) : recentLoadError ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-6 text-center">
              <p className="text-sm font-semibold text-amber-950">Não foi possível carregar os modelos recentes.</p>
              <p className="mx-auto mt-1 max-w-xl text-xs leading-5 text-amber-800">Você ainda pode abrir a Biblioteca completa ou tentar carregar esta seção novamente.</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <button type="button" onClick={() => setReloadKey((value) => value + 1)} className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-bold text-amber-900 hover:bg-amber-100">
                  <RefreshCw size={13} /> Tentar novamente
                </button>
                <button type="button" onClick={onOpenLibrary} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-700">
                  Abrir biblioteca <ArrowRight size={13} />
                </button>
              </div>
            </div>
          ) : recentTemplates.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-8 text-center">
              <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700"><BookOpen size={22} /></span>
              <h3 className="mt-3 text-sm font-bold text-slate-900">Ainda não há modelos publicados</h3>
              <p className="mx-auto mt-1 max-w-lg text-xs leading-5 text-slate-600">Quando alguém publicar um modelo na Biblioteca, ele aparecerá aqui para toda a equipe.</p>
              <button type="button" onClick={onOpenLibrary} className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2.5 text-xs font-bold text-white hover:bg-indigo-700">
                Abrir biblioteca <ArrowRight size={14} />
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {recentTemplates.map((template, index) => (
                <article key={template.id} className="group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md">
                  <div className={`relative flex h-28 items-center justify-between overflow-hidden px-5 ${index === 0 ? 'bg-gradient-to-br from-blue-800 via-blue-700 to-indigo-600' : index === 1 ? 'bg-gradient-to-br from-indigo-700 to-violet-500' : 'bg-gradient-to-br from-slate-800 to-slate-600'}`}>
                    <div aria-hidden="true" className="pointer-events-none absolute -right-5 -top-8 h-32 w-32 rounded-full border border-white/15 shadow-[0_0_0_18px_rgba(255,255,255,0.05),0_0_0_36px_rgba(255,255,255,0.04)]" />
                    <div className="relative min-w-0 flex-1 pr-4">
                      <div className="mb-2 inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-white"><BookOpen size={10} /> Biblioteca</div>
                      <div className="line-clamp-2 text-base font-bold leading-tight text-white">{template.name}</div>
                    </div>
                    <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-white"><FileText size={24} /></span>
                  </div>
                  <div className="flex flex-grow flex-col p-4">
                    <p className="line-clamp-3 min-h-[3.75rem] text-xs leading-5 text-slate-600">{template.description || 'Modelo de e-mail compartilhado pela equipe.'}</p>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-400">
                      <span>{formatUpdatedAt(template.updatedAt)}</span>
                      <span>{template.blocks.length} blocos</span>
                    </div>
                    <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                      <span className="min-w-0 truncate pr-3 text-[11px] text-slate-500" title={template.subject}>Assunto: {template.subject || 'Sem assunto'}</span>
                      <button
                        type="button"
                        onClick={() => onSelectLibraryTemplate(template)}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700 transition-colors hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      >
                        Usar modelo <ArrowRight size={14} />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <p className="mt-8 flex items-center justify-center gap-2 text-center text-xs text-slate-400">
          <FileCode2 size={14} /> Dica: mantenha as tags dinâmicas, como {'{{nome}}'} e {'{{email}}'}, quando o disparo precisar personalizar cada mensagem.
        </p>
      </div>
    </main>
  );
};
