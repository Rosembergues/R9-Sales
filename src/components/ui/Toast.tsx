import React, { useEffect } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

export type ToastKind = 'success' | 'error' | 'info';

interface ToastProps {
  message: string;
  kind?: ToastKind;
  onClose: () => void;
  duration?: number;
}

export const Toast: React.FC<ToastProps> = ({ message, kind = 'success', onClose, duration = 3500 }) => {
  useEffect(() => {
    const timer = window.setTimeout(onClose, duration);
    return () => window.clearTimeout(timer);
  }, [onClose, duration]);

  const styles = {
    success: { wrapper: 'border-emerald-200 bg-emerald-50 text-emerald-900', icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" /> },
    error: { wrapper: 'border-red-200 bg-red-50 text-red-900', icon: <AlertCircle className="w-4 h-4 text-red-600" /> },
    info: { wrapper: 'border-blue-200 bg-blue-50 text-blue-900', icon: <Info className="w-4 h-4 text-blue-600" /> },
  }[kind];

  return (
    <div role="status" aria-live="polite" className={`fixed top-20 right-4 md:right-6 z-[100] max-w-[calc(100vw-2rem)] md:max-w-md border shadow-lg rounded-xl px-4 py-3 flex items-start gap-3 ${styles.wrapper}`}>
      {styles.icon}
      <span className="text-sm font-semibold leading-5 flex-1">{message}</span>
      <button type="button" onClick={onClose} aria-label="Fechar notificação" className="p-0.5 rounded hover:bg-black/5 shrink-0">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
