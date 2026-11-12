import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** Nome da área, mostrado na mensagem ("Vendas", "Planejamento"...). */
  area?: string;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Se uma tela quebrar, mostra um aviso no lugar dela em vez de deixar o site em branco.
 * O resto do R9 Hub (menu, outras telas) continua funcionando.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[R9 Hub] Erro na tela${this.props.area ? ` ${this.props.area}` : ''}:`, error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="max-w-lg mx-auto my-12 bg-white rounded-2xl border border-red-200 p-6 text-center space-y-3 shadow-sm">
        <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-slate-900">
          Algo deu errado{this.props.area ? ` em ${this.props.area}` : ''}
        </h3>
        <p className="text-xs text-slate-500">
          Tente de novo. Se o erro continuar, mande um print desta mensagem para o administrador.
        </p>
        <p className="text-[11px] font-mono text-red-700 bg-red-50 rounded-lg px-3 py-2 break-words">{this.state.error.message}</p>
        <button
          type="button"
          onClick={() => this.setState({ error: null })}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0052cc] hover:bg-[#00478f] text-white text-xs font-bold rounded-xl cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Tentar de novo
        </button>
      </div>
    );
  }
}
