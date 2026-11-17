import React from 'react';
import { Screen, TransitionType } from '../types';
import { Blocks, BookOpen, Home } from 'lucide-react';
import { SignOutButton } from './auth/SignOutButton';

interface HeaderProps {
  currentScreen: Screen;
  onNavigate: (screen: Screen, transition?: TransitionType) => void;
  subtitle?: string;
  onSignOut: () => Promise<void>;
}

export const Header: React.FC<HeaderProps> = ({ currentScreen, onNavigate, onSignOut }) => {
  const items: { label: string; screen: Screen; icon: React.ElementType }[] = [
    { label: 'Início', screen: 'inicio', icon: Home },
    { label: 'Editor', screen: 'gerador_pro', icon: Blocks },
    { label: 'Biblioteca', screen: 'biblioteca', icon: BookOpen },
  ];

  return (
    <header className="fixed left-0 right-0 top-0 z-50 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white px-3 shadow-sm md:px-6">
      <button type="button" onClick={() => onNavigate('inicio', 'none')} className="flex shrink-0 items-center gap-2.5 rounded-lg text-left focus:outline-none focus:ring-2 focus:ring-blue-500" aria-label="Ir para o início">
        <img src="/favicon.svg" alt="" className="h-8 w-8 rounded-lg" />
        <span className="hidden text-lg font-bold tracking-tight text-slate-800 sm:inline">R9Bot <span className="font-normal text-slate-500">Mailer</span></span>
        <span className="text-lg font-bold tracking-tight text-slate-800 sm:hidden">R9Bot</span>
      </button>

      <nav aria-label="Navegação principal" className="ml-3 flex min-w-0 flex-1 items-center gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1">
        {items.map(({ label, screen, icon: Icon }) => {
          const active = currentScreen === screen;
          return (
            <button
              key={screen}
              type="button"
              onClick={() => onNavigate(screen, 'none')}
              aria-current={active ? 'page' : undefined}
              title={label}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold transition-colors sm:px-3 sm:text-sm ${active ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:bg-white/70 hover:text-slate-900'}`}
            >
              <Icon size={16} />
              <span>{label}</span>
            </button>
          );
        })}
      </nav>

      <SignOutButton
        onSignOut={onSignOut}
        className="ml-2 flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-600 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:cursor-wait disabled:opacity-60 sm:px-3 sm:text-sm"
      />
    </header>
  );
};
