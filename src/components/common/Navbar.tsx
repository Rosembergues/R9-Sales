import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSales } from '../../context/SalesContext';
import { 
  ShieldCheck, 
  UserCheck, 
  LogOut, 
  Database, 
  Sparkles, 
  TrendingUp, 
  Users, 
  FileSpreadsheet, 
  HelpCircle,
  RefreshCw,
  Zap,
  ChevronDown
} from 'lucide-react';
import { SupabaseSetupModal } from './SupabaseSetupModal';

interface NavbarProps {
  currentTab?: string;
  onSelectTab?: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, onSelectTab }) => {
  const { currentUser, signOut, isSupabaseConnected } = useAuth();
  const { recentLiveActivity } = useSales();
  const [showSupabaseModal, setShowSupabaseModal] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  if (!currentUser) return null;

  const isAdmin = currentUser.role === 'admin';

  return (
    <>
      <header id="main-navbar" className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-4">
            
            {/* Logo and Brand */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-900 flex items-center justify-center shadow-sm text-white font-black text-lg">
                R9
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-lg tracking-tight text-slate-900 font-['Space_Grotesk']">
                    R9 Sales
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-blue-50 text-blue-800 border border-blue-200">
                    Realtime v2.4
                  </span>
                </div>
                <p className="text-xs text-slate-500 hidden sm:block">
                  Gestão & Lançamento de Vendas em Tempo Real
                </p>
              </div>
            </div>

            {/* Live Activity Ticker (if any) */}
            {recentLiveActivity.length > 0 && (
              <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600">
                <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span className="truncate max-w-xs font-medium text-emerald-700">
                  {recentLiveActivity[0].message}
                </span>
              </div>
            )}

            {/* Right side controls */}
            <div className="flex items-center gap-2 sm:gap-3">
              
              {/* Supabase Connection Status Badge */}
              <button
                id="supabase-status-btn"
                onClick={() => setShowSupabaseModal(true)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  isSupabaseConnected
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
                }`}
                title="Configuração do Banco Supabase & Scripts SQL"
              >
                <Database className={`w-3.5 h-3.5 ${isSupabaseConnected ? 'text-emerald-600' : 'text-indigo-600'}`} />
                <span className="hidden md:inline font-semibold">
                  {isSupabaseConnected ? 'Supabase Conectado' : 'Supabase (Configurar SQL)'}
                </span>
                <span className="md:hidden font-semibold">Supabase</span>
              </button>

              {/* User Switcher Dropdown (Quick testing & role showcase) */}
              <div className="relative">
                <button
                  id="user-profile-menu-btn"
                  onClick={() => setShowUserDropdown(!showUserDropdown)}
                  className="flex items-center gap-2.5 p-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-left transition-all shadow-xs"
                >
                  <img
                    src={currentUser.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(currentUser.name)}`}
                    alt={currentUser.name}
                    className="w-8 h-8 rounded-lg object-cover ring-1 ring-slate-200"
                  />
                  <div className="hidden sm:block">
                    <div className="text-xs font-bold text-slate-900 leading-tight flex items-center gap-1.5">
                      {currentUser.name}
                      {isAdmin ? (
                        <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                      ) : (
                        <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded ${
                          isAdmin
                            ? 'bg-indigo-50 text-indigo-700'
                            : 'bg-emerald-50 text-emerald-700'
                        }`}
                      >
                        {isAdmin ? 'Administrador' : 'Vendedor'}
                      </span>
                    </div>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                </button>

                {/* Dropdown Menu */}
                {showUserDropdown && (
                  <div 
                    id="user-dropdown-panel"
                    className="absolute right-0 mt-2 w-72 rounded-2xl bg-white border border-slate-200 shadow-xl p-2 z-50 animate-in fade-in slide-in-from-top-2 text-slate-900"
                  >
                    <div className="p-2 border-b border-slate-100">
                      <p className="text-xs text-slate-500">Autenticado como</p>
                      <p className="text-sm font-bold text-slate-900 truncate">{currentUser.name}</p>
                      <p className="text-xs text-slate-500 truncate">{currentUser.email}</p>
                      <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                        {isAdmin ? 'Acesso Total (Admin)' : 'Lançamento & Metas (Vendedor)'}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex flex-col gap-1">
                      <button
                        onClick={() => {
                          setShowUserDropdown(false);
                          setShowSupabaseModal(true);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                      >
                        <Database className="w-4 h-4 text-indigo-600" />
                        <span>Script SQL & Supabase Setup</span>
                      </button>
                      <button
                        onClick={() => {
                          setShowUserDropdown(false);
                          signOut();
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-rose-600 hover:bg-rose-50 transition-colors font-medium"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Sair da Conta</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

            </div>

          </div>
        </div>
      </header>

      {/* Supabase Setup Modal */}
      {showSupabaseModal && (
        <SupabaseSetupModal onClose={() => setShowSupabaseModal(false)} />
      )}
    </>
  );
};
