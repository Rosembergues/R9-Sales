import { useState } from 'react';
import { LogOut, LoaderCircle } from 'lucide-react';

interface SignOutButtonProps {
  onSignOut: () => Promise<void>;
  className?: string;
  compactOnMobile?: boolean;
}

export function SignOutButton({ onSignOut, className, compactOnMobile = false }: SignOutButtonProps) {
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [error, setError] = useState('');

  async function handleSignOut() {
    if (isSigningOut) return;
    setIsSigningOut(true);
    setError('');
    try {
      await onSignOut();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível encerrar a sessão. Tente novamente.');
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <div className="relative flex shrink-0 items-center">
      <button
        type="button"
        onClick={() => void handleSignOut()}
        disabled={isSigningOut}
        aria-label="Sair da conta"
        title={error || 'Sair da conta'}
        className={className || 'flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:cursor-wait disabled:opacity-60 sm:text-sm'}
      >
        {isSigningOut ? <LoaderCircle size={16} className="animate-spin" /> : <LogOut size={16} />}
        <span className={compactOnMobile ? 'hidden sm:inline' : undefined}>{isSigningOut ? 'Saindo…' : 'Sair'}</span>
      </button>
      {error && (
        <div role="alert" className="absolute right-0 top-full z-[100] mt-2 w-64 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-medium text-red-700 shadow-lg">
          {error}
        </div>
      )}
    </div>
  );
}
