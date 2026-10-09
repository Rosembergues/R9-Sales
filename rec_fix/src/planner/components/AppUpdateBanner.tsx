import React from 'react';
import { Sparkles, RefreshCw, X, ArrowUpRight } from 'lucide-react';

export interface AppUpdateBannerProps {
  isUpdateAvailable: boolean;
  isDismissed: boolean;
  onApplyUpdate: () => void;
  onDismiss: () => void;
  onReopen: () => void;
  latestVersion?: string | null;
}

export const AppUpdateBanner: React.FC<AppUpdateBannerProps> = ({
  isUpdateAvailable,
  isDismissed,
  onApplyUpdate,
  onDismiss,
  onReopen,
}) => {
  if (!isUpdateAvailable) {
    return null;
  }

  // Se o usuário optou por dispensar temporariamente (ex: está preenchendo um formulário),
  // exibe uma pílula flutuante não intrusiva no canto inferior
  if (isDismissed) {
    return (
      <div className="fixed bottom-4 right-4 z-50 animate-in fade-in slide-in-from-bottom-2 duration-300">
        <button
          id="btn-reopen-app-update"
          onClick={onReopen}
          className="flex items-center gap-2.5 px-3.5 py-2 rounded-full bg-slate-900/90 hover:bg-slate-900 text-white text-xs font-medium shadow-lg border border-slate-700/80 backdrop-blur transition-all duration-200 hover:scale-[1.02] cursor-pointer group"
          title="Clique para ver os detalhes da nova versão do R9 Planner"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
          </span>
          <span>Nova versão pronta</span>
          <ArrowUpRight className="w-3.5 h-3.5 text-blue-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
        </button>
      </div>
    );
  }

  // Banner principal discreto, no topo da aplicação
  return (
    <div
      id="app-update-banner"
      role="alert"
      aria-live="polite"
      className="fixed top-3 left-1/2 -translate-x-1/2 z-50 w-[94%] max-w-3xl px-2 animate-in fade-in slide-in-from-top-3 duration-300 pointer-events-none"
    >
      <div className="pointer-events-auto bg-slate-900/95 text-white border border-slate-700/70 shadow-2xl shadow-black/30 rounded-2xl p-3 sm:p-4 backdrop-blur-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-3">
          <div className="p-2 bg-blue-500/20 text-blue-400 rounded-xl border border-blue-500/30 shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold text-white">
                Uma nova versão do R9 Planner está disponível
              </h4>
              <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase bg-blue-500/20 text-blue-300 rounded-full border border-blue-500/30">
                Deploy Recente
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
              Você tem alterações em formulários? Conclua o preenchimento antes de atualizar para garantir que nenhum dado seja perdido.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center shrink-0 w-full sm:w-auto justify-end pt-1 sm:pt-0">
          <button
            id="btn-dismiss-app-update"
            type="button"
            onClick={onDismiss}
            className="px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            Lembrar mais tarde
          </button>
          <button
            id="btn-apply-app-update"
            type="button"
            onClick={onApplyUpdate}
            className="flex items-center justify-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 active:bg-blue-700 rounded-lg shadow-sm transition-all duration-150 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Atualizar agora</span>
          </button>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Fechar aviso de atualização"
            className="p-1 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition cursor-pointer ml-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
