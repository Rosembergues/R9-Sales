import React, { useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SalesProvider } from './context/SalesContext';
import { AuthPage } from './components/auth/AuthPage';
import { R9Dashboard } from './components/dashboard/R9Dashboard';
import { useIdleTimeout, THREE_HOURS_MS } from './hooks/useIdleTimeout';
import { supabase, LocalSyncEngine } from './lib/supabase';

const MainLayout: React.FC = () => {
  const { currentUser, loading, signOut } = useAuth();

  // Limpa rota de login quando autenticado
  useEffect(() => {
    if (currentUser && window.location.pathname === '/login') {
      window.history.replaceState(null, '', '/');
    }
  }, [currentUser]);

  // Callback de encerramento por inatividade de 3 horas
  const handleIdleLogout = useCallback(async () => {
    console.warn('⏰ [Idle Timeout] 3 horas de inatividade atingidas. Executando logout global e redirecionamento...');
    try {
      // 1. Limpeza de estado local
      localStorage.setItem('r9_session_expired_idle', 'true');
      localStorage.removeItem('r9_last_user_activity');
      LocalSyncEngine.setCurrentUser(null);

      // 2. Encerramento oficial no Supabase Auth
      await supabase.auth.signOut();
      await signOut();
    } catch (error) {
      console.error('❌ [Idle Timeout] Erro ao deslogar por inatividade:', error);
    } finally {
      // 3. Forçar redirecionamento para a tela de login
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      } else {
        window.location.reload();
      }
    }
  }, [signOut]);

  // Bloqueio por inatividade ativo durante toda a sessão autenticada do usuário
  useIdleTimeout({
    enabled: Boolean(currentUser),
    timeoutMs: THREE_HOURS_MS,
    onIdle: handleIdleLogout,
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-2xl bg-[#00478f] text-white flex items-center justify-center font-black text-lg shadow-md animate-pulse">
          R9
        </div>
        <p className="text-xs font-semibold text-gray-500 mt-3 font-['Space_Grotesk']">
          Carregando ambiente R9 Sales...
        </p>
      </div>
    );
  }

  // Se não autenticado, exibe a tela de login/cadastro
  if (!currentUser) {
    return <AuthPage />;
  }

  // Exibe a tela principal do sistema R9
  return <R9Dashboard />;
};

export default function App() {
  return (
    <AuthProvider>
      <SalesProvider>
        <MainLayout />
      </SalesProvider>
    </AuthProvider>
  );
}
