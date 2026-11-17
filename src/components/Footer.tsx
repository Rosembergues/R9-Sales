import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-white border-t border-slate-200 fixed bottom-0 left-0 right-0 z-40 flex justify-between items-center px-4 md:px-6 py-3 h-16 w-full shadow-xs">
      <span className="text-xs sm:text-sm text-slate-500 font-medium truncate">
        © 2026 Estácio - Criador de E-mail Marketing
      </span>
    </footer>
  );
};
