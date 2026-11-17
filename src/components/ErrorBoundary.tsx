import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
  onReset?: () => void;
  resetLabel?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 m-4 max-w-2xl mx-auto bg-amber-50/80 border border-amber-200 rounded-2xl shadow-sm space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700 shrink-0">
              <span className="material-symbols-outlined text-[24px]">warning</span>
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-amber-950">
                {this.props.fallbackTitle || 'Ocorreu uma instabilidade na renderização'}
              </h3>
              <p className="text-xs text-amber-800 leading-relaxed">
                {this.props.fallbackMessage ||
                  'Algum bloco ou estilo continha dados incompletos. Seus dados continuam salvos e você pode restaurar a visualização.'}
              </p>
              {import.meta.env.DEV && this.state.error && (
                <p className="text-[11px] font-mono text-amber-900 bg-amber-100/60 p-2 rounded-lg break-all">
                  {this.state.error.message}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={this.handleReset}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">refresh</span>
              <span>{this.props.resetLabel || 'Tentar novamente'}</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

