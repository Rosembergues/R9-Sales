import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Profile, UserRole, SupabaseConfig } from '../types';
import { supabase, setSupabaseCredentials, LocalSyncEngine } from '../lib/supabase';

interface AuthContextType {
  currentUser: Profile | null;
  profiles: Profile[];
  loading: boolean;
  isSupabaseConnected: boolean;
  supabaseConfig: SupabaseConfig;
  signUp: (data: { name: string; email: string; password: string }) => Promise<{ success: boolean; error?: string }>;
  signIn: (data: { email: string; password?: string }) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  updateUserRole: (userId: string, newRole: UserRole) => Promise<{ success: boolean; error?: string }>;
  deleteUser: (userId: string) => Promise<{ success: boolean; error?: string }>;
  updateSupabaseCredentials: (url: string, key: string) => Promise<{ success: boolean; error?: string }>;
  refreshProfiles: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSupabaseConnected, setIsSupabaseConnected] = useState(true);
  const [supabaseConfig, setSupabaseConfig] = useState<SupabaseConfig>({
    url: import.meta.env.VITE_SUPABASE_URL || 'https://wqdrybpjfvuzrnozomxa.supabase.co',
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
    isCustom: false,
    connected: true,
  });

  /**
   * Recupera o perfil do usuário logado fazendo um select na tabela profiles
   * filtrando pelo ID da sessão atual no Supabase.
   */
  const fetchAndSetUserProfile = async (userId: string, authUserMeta?: { name?: string; email?: string }): Promise<Profile | null> => {
    const buildFallbackProfile = (): Profile | null => {
      if (!authUserMeta) return null;
      const fallbackProfile: Profile = {
        id: userId,
        name: authUserMeta.name || authUserMeta.email?.split('@')[0] || 'Usuário',
        email: authUserMeta.email || '',
        // Fallback seguro: o cargo só pode vir do perfil persistido no banco.
        role: 'seller',
        avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(authUserMeta.name || userId)}`,
        created_at: new Date().toISOString(),
        status: 'active',
        phone: '',
        target_monthly: 30,
      };
      setCurrentUser(fallbackProfile);
      LocalSyncEngine.setCurrentUser(fallbackProfile);
      return fallbackProfile;
    };

    try {
      // Uma falha de rede não deve impedir a aplicação de usar a sessão já autenticada.
      const requestProfile = async () => supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      let result = await requestProfile();
      if (result.error) {
        console.warn('⚠️ [Supabase DB] Não foi possível consultar profiles:', result.error.message);
        // TypeError: Failed to fetch normalmente é indisponibilidade de rede/CORS/offline.
        // Uma única tentativa curta evita martelar a API sem esconder falhas reais.
        await new Promise(resolve => setTimeout(resolve, 400));
        result = await requestProfile();
      }

      if (!result.error && result.data) {
        setCurrentUser(result.data as Profile);
        LocalSyncEngine.setCurrentUser(result.data as Profile);
        return result.data as Profile;
      }

      // Se o perfil ainda não existe (trigger atrasada), tenta uma vez mais apenas
      // quando a primeira chamada foi concluída sem erro de rede.
      if (!result.error) {
        await new Promise(resolve => setTimeout(resolve, 500));
        const retry = await requestProfile();
        if (!retry.error && retry.data) {
          setCurrentUser(retry.data as Profile);
          LocalSyncEngine.setCurrentUser(retry.data as Profile);
          return retry.data as Profile;
        }
      }

      return buildFallbackProfile();
    } catch (err) {
      console.warn('⚠️ [Supabase DB] Falha de rede ao consultar profiles. Usando dados da sessão.', err);
      return buildFallbackProfile();
    }
  };

  // Carrega a lista completa de perfis da tabela profiles (para administradores)
  const refreshProfiles = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        setProfiles(data as Profile[]);
        LocalSyncEngine.saveProfiles(data as Profile[]);
        return;
      }

      if (error) {
        console.warn('⚠️ [Supabase DB] Não foi possível atualizar profiles:', error.message);
        // Mantém a lista já carregada/local em vez de substituir por vazio.
      }
    } catch (e) {
      console.warn('⚠️ [Supabase DB] Falha de rede no refreshProfiles:', e);
      // Não propaga erro: a aplicação continua com o cache/local atual.
    }
  }, []);

  // Inicialização e verificação da sessão atual com supabase.auth.getSession()
  const initializeAuth = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        console.error('❌ [Supabase Auth] Erro ao obter sessão ativa:', sessionError.message, sessionError);
      }

      if (session?.user) {
        setIsSupabaseConnected(true);
        setSupabaseConfig(prev => ({ ...prev, connected: true }));
        await fetchAndSetUserProfile(session.user.id, {
          name: session.user.user_metadata?.name,
          email: session.user.email,
        });
      } else {
        setCurrentUser(null);
        LocalSyncEngine.setCurrentUser(null);
      }

      // Carregar lista de perfis do banco
      await refreshProfiles();
    } catch (err: any) {
      console.error('💥 [Supabase Auth] Exceção durante inicialização de sessão:', err);
    } finally {
      setLoading(false);
    }
  }, [refreshProfiles]);

  useEffect(() => {
    initializeAuth();

    // Listener do Supabase Auth.
    // IMPORTANTE: não fazemos consultas assíncronas ao Supabase diretamente
    // dentro do callback. O Auth pode estar segurando um lock interno durante
    // a mudança de sessão; consultar profiles dentro dele pode causar
    // "Failed to fetch"/deadlocks intermitentes.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
        LocalSyncEngine.setCurrentUser(null);
        return;
      }

      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        setIsSupabaseConnected(true);
        setSupabaseConfig(prev => ({ ...prev, connected: true }));

        // Sai do callback do Auth antes de consultar profiles.
        setTimeout(() => {
          if (!session?.user) return;

          void (async () => {
            try {
              await fetchAndSetUserProfile(session.user.id, {
                name: session.user.user_metadata?.name,
                email: session.user.email,
              });
              await refreshProfiles();
            } catch (err) {
              console.error('💥 [Supabase Auth] Erro ao carregar dados após mudança de sessão:', err);
            }
          })();
        }, 0);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [initializeAuth, refreshProfiles]);

  /**
   * FLUXO DE CADASTRO (SIGN UP)
   * Utiliza supabase.auth.signUp com nome; o cargo inicial é definido pelo banco como 'seller'.
   * NÃO faz inserção manual na tabela profiles nem gera IDs manuais.
   * O banco executa o trigger handle_new_user automaticamente.
   */
  const signUp = async ({ name, email, password }: { name: string; email: string; password: string }) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name },
        },
      });

      if (error) {
        console.error('❌ [Supabase Auth] Erro retornado no signUp:', error.message, error);
        setLoading(false);
        return { success: false, error: error.message };
      }

      // Se a sessão foi criada imediatamente (quando confirmação de e-mail é desativada)
      if (data.session?.user) {
        // Aguarda a trigger do banco gravar o perfil
        await new Promise(r => setTimeout(r, 400));
        await fetchAndSetUserProfile(data.session.user.id, { name, email });
        await refreshProfiles();
      }

      setLoading(false);
      return { success: true };
    } catch (err: any) {
      console.error('💥 [Supabase Auth] Exceção inesperada durante o cadastro:', err);
      setLoading(false);
      return { success: false, error: err?.message || 'Erro inesperado durante o cadastro.' };
    }
  };

  /**
   * FLUXO DE LOGIN (SIGN IN)
   * Utiliza EXCLUSIVAMENTE supabase.auth.signInWithPassword({ email, password })
   */
  const signIn = async ({ email, password }: { email: string; password?: string }) => {
    if (!password) {
      const err = 'A senha é obrigatória para autenticação no Supabase.';
      console.error('❌ [Supabase Auth] Tentativa de login sem senha:', err);
      return { success: false, error: err };
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('❌ [Supabase Auth] Erro no signInWithPassword:', error.message, error);
        setLoading(false);
        return {
          success: false,
          error: error.message === 'Invalid login credentials'
            ? 'E-mail ou senha incorretos. Verifique suas credenciais.'
            : error.message || 'Falha ao autenticar no Supabase.',
        };
      }

      // Recupera os dados do perfil do usuário logado fazendo um select na tabela profiles filtrando pelo ID da sessão
      await fetchAndSetUserProfile(data.user.id, {
        name: data.user.user_metadata?.name,
        email: data.user.email,
      });

      await refreshProfiles();

      setLoading(false);
      return { success: true };
    } catch (err: any) {
      console.error('💥 [Supabase Auth] Exceção inesperada no login:', err);
      setLoading(false);
      return { success: false, error: err?.message || 'Erro ao realizar login.' };
    }
  };

  /**
   * FLUXO DE LOGOUT (SIGN OUT)
   */
  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('❌ [Supabase Auth] Erro ao deslogar:', error.message);
      }
    } catch (err) {
      console.error('💥 [Supabase Auth] Exceção no signOut:', err);
    }
    setCurrentUser(null);
    LocalSyncEngine.setCurrentUser(null);
  };

  // Alteração de cargo na tabela profiles por um administrador
  const updateUserRole = async (userId: string, newRole: UserRole) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole, updated_at: new Date().toISOString() })
        .eq('id', userId);

      if (error) {
        console.error('❌ [Supabase DB] Erro ao atualizar papel na tabela profiles:', error.message);
        return { success: false, error: error.message };
      }

      setProfiles(prev => prev.map(p => (p.id === userId ? { ...p, role: newRole } : p)));
      if (currentUser?.id === userId) {
        setCurrentUser(prev => (prev ? { ...prev, role: newRole } : null));
      }

      return { success: true };
    } catch (err: any) {
      console.error('💥 [Supabase DB] Exceção ao atualizar papel:', err);
      return { success: false, error: err?.message || 'Erro ao alterar perfil do usuário.' };
    }
  };

  // Exclusão de perfil da tabela profiles
  const deleteUser = async (userId: string) => {
    if (currentUser?.id === userId) {
      return { success: false, error: 'Você não pode excluir sua própria conta conectada.' };
    }
    try {
      const { error } = await supabase.from('profiles').delete().eq('id', userId);
      if (error) {
        console.error('❌ [Supabase DB] Erro ao excluir perfil:', error.message);
        return { success: false, error: error.message };
      }
      setProfiles(prev => prev.filter(p => p.id !== userId));
      return { success: true };
    } catch (err: any) {
      console.error('💥 [Supabase DB] Exceção ao excluir perfil:', err);
      return { success: false, error: err?.message || 'Erro ao excluir usuário.' };
    }
  };

  const updateSupabaseCredentials = async (url: string, key: string) => {
    try {
      localStorage.setItem('salesflow_supabase_config', JSON.stringify({ url, anonKey: key }));
      setSupabaseCredentials(url, key);
      setSupabaseConfig({
        url,
        anonKey: key,
        isCustom: true,
        connected: true,
      });
      await initializeAuth();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Erro ao atualizar credenciais do Supabase.' };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        profiles,
        loading,
        isSupabaseConnected,
        supabaseConfig,
        signUp,
        signIn,
        signOut,
        updateUserRole,
        deleteUser,
        updateSupabaseCredentials,
        refreshProfiles,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
