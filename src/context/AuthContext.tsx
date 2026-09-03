import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Profile, UserRole, SupabaseConfig } from '../types';
import { supabase, setSupabaseCredentials, LocalSyncEngine } from '../lib/supabase';

interface AuthContextType {
  currentUser: Profile | null;
  profiles: Profile[];
  loading: boolean;
  isSupabaseConnected: boolean;
  supabaseConfig: SupabaseConfig;
  signUp: (data: { name: string; email: string; password: string; role: UserRole }) => Promise<{ success: boolean; error?: string }>;
  signIn: (data: { email: string; password?: string }) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  updateUserRole: (userId: string, newRole: UserRole) => Promise<{ success: boolean; error?: string }>;
  createUserByAdmin: (data: { name: string; email: string; role: UserRole; phone?: string; target_monthly?: number }) => Promise<{ success: boolean; error?: string }>;
  deleteUser: (userId: string) => Promise<{ success: boolean; error?: string }>;
  resetToSingleUser: () => Promise<void>;
  switchUser: (profile: Profile) => void;
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
  const fetchAndSetUserProfile = async (userId: string, authUserMeta?: { name?: string; email?: string; role?: string }): Promise<Profile | null> => {
    try {
      console.log('🔍 [Supabase DB] Buscando perfil do usuário logado na tabela profiles. ID:', userId);
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('❌ [Supabase DB] Erro ao buscar perfil na tabela profiles:', error.message, error);
      }

      if (profile) {
        console.log('👤 [Supabase DB] Perfil encontrado com sucesso:', profile.name, `[${profile.role}]`);
        setCurrentUser(profile as Profile);
        LocalSyncEngine.setCurrentUser(profile as Profile);
        return profile as Profile;
      }

      console.warn('⚠️ [Supabase DB] Registro ainda não encontrado na tabela profiles para o id:', userId);

      // Se a trigger handle_new_user ainda estiver executando, aguarda 500ms e tenta novamente
      await new Promise(resolve => setTimeout(resolve, 500));
      const { data: retryProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (retryProfile) {
        console.log('👤 [Supabase DB] Perfil localizado na segunda tentativa:', retryProfile.name);
        setCurrentUser(retryProfile as Profile);
        LocalSyncEngine.setCurrentUser(retryProfile as Profile);
        return retryProfile as Profile;
      }

      // Fallback usando os metadados da sessão oficial para garantir navegação contínua
      if (authUserMeta) {
        const fallbackProfile: Profile = {
          id: userId,
          name: authUserMeta.name || authUserMeta.email?.split('@')[0] || 'Usuário',
          email: authUserMeta.email || '',
          role: (authUserMeta.role as UserRole) || 'seller',
          avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(authUserMeta.name || userId)}`,
          created_at: new Date().toISOString(),
          status: 'active',
          phone: '',
          target_monthly: authUserMeta.role === 'seller' ? 50000 : 0,
        };
        console.info('ℹ️ [Supabase DB] Perfil construído a partir dos metadados da sessão Auth:', fallbackProfile);
        setCurrentUser(fallbackProfile);
        LocalSyncEngine.setCurrentUser(fallbackProfile);
        return fallbackProfile;
      }

      return null;
    } catch (err: any) {
      console.error('💥 [Supabase DB] Exceção ao consultar tabela profiles:', err);
      return null;
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
      } else if (error) {
        console.error('❌ [Supabase DB] Erro ao listar tabela profiles:', error.message);
      }
    } catch (e) {
      console.error('💥 [Supabase DB] Exceção no refreshProfiles:', e);
    }
  }, []);

  // Inicialização e verificação da sessão atual com supabase.auth.getSession()
  const initializeAuth = useCallback(async () => {
    setLoading(true);
    try {
      console.log('🔄 [Supabase Auth] Verificando sessão ativa via getSession()...');
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        console.error('❌ [Supabase Auth] Erro ao obter sessão ativa:', sessionError.message, sessionError);
      }

      if (session?.user) {
        console.log('🔑 [Supabase Auth] Sessão encontrada para:', session.user.email, `(ID: ${session.user.id})`);
        setIsSupabaseConnected(true);
        setSupabaseConfig(prev => ({ ...prev, connected: true }));
        await fetchAndSetUserProfile(session.user.id, {
          name: session.user.user_metadata?.name,
          email: session.user.email,
          role: session.user.user_metadata?.role,
        });
      } else {
        console.log('ℹ️ [Supabase Auth] Nenhuma sessão ativa detectada.');
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

    // Listener do Supabase Auth para reagir a mudanças de sessão em tempo real
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(`🔔 [Supabase Auth] onAuthStateChange event: ${event}`, session?.user?.email);
      if (session?.user) {
        setIsSupabaseConnected(true);
        setSupabaseConfig(prev => ({ ...prev, connected: true }));
        await fetchAndSetUserProfile(session.user.id, {
          name: session.user.user_metadata?.name,
          email: session.user.email,
          role: session.user.user_metadata?.role,
        });
        await refreshProfiles();
      } else if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
        LocalSyncEngine.setCurrentUser(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [initializeAuth, refreshProfiles]);

  /**
   * FLUXO DE CADASTRO (SIGN UP)
   * Utiliza EXCLUSIVAMENTE supabase.auth.signUp({ email, password, options: { data: { name, role } } })
   * NÃO faz inserção manual na tabela profiles nem gera IDs manuais.
   * O banco executa o trigger handle_new_user automaticamente.
   */
  const signUp = async ({ name, email, password, role }: { name: string; email: string; password: string; role: UserRole }) => {
    setLoading(true);
    try {
      console.log('📤 [Supabase Auth] Executando signUp exclusivo:', { email, name, role });

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
            role,
          },
        },
      });

      if (error) {
        console.error('❌ [Supabase Auth] Erro retornado no signUp:', error.message, error);
        setLoading(false);
        return { success: false, error: error.message };
      }

      console.log('✅ [Supabase Auth] Cadastro efetuado com sucesso! ID do usuário:', data.user?.id);

      // Se a sessão foi criada imediatamente (quando confirmação de e-mail é desativada)
      if (data.session?.user) {
        // Aguarda a trigger do banco gravar o perfil
        await new Promise(r => setTimeout(r, 400));
        await fetchAndSetUserProfile(data.session.user.id, { name, email, role });
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
      console.log('🔐 [Supabase Auth] Executando login via supabase.auth.signInWithPassword para:', email);

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

      console.log('✅ [Supabase Auth] Login validado com sucesso! User ID:', data.user.id);

      // Recupera os dados do perfil do usuário logado fazendo um select na tabela profiles filtrando pelo ID da sessão
      await fetchAndSetUserProfile(data.user.id, {
        name: data.user.user_metadata?.name,
        email: data.user.email,
        role: data.user.user_metadata?.role,
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
    console.log('🚪 [Supabase Auth] Executando signOut...');
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('❌ [Supabase Auth] Erro ao deslogar:', error.message);
      } else {
        console.log('✅ [Supabase Auth] Sessão encerrada.');
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
      console.log(`🛡️ [Supabase DB] Atualizando papel do usuário ${userId} para ${newRole}...`);
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

  // Criação de usuário por administrador via Supabase Auth
  const createUserByAdmin = async (data: { name: string; email: string; role: UserRole; phone?: string; target_monthly?: number }) => {
    try {
      console.log('📤 [Supabase Auth] Administrador cadastrando novo usuário via signUp:', data.email);
      const tempPassword = `R9_${Math.random().toString(36).slice(-8)}!`;

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: tempPassword,
        options: {
          data: {
            name: data.name,
            role: data.role,
          },
        },
      });

      if (authError) {
        console.error('❌ [Supabase Auth] Erro ao cadastrar usuário:', authError.message);
        return { success: false, error: authError.message };
      }

      console.log('✅ [Supabase Auth] Usuário registrado com sucesso. ID:', authData.user?.id);
      await refreshProfiles();
      return { success: true };
    } catch (err: any) {
      console.error('💥 [Supabase Auth] Exceção ao criar usuário:', err);
      return { success: false, error: err?.message || 'Erro ao cadastrar novo usuário.' };
    }
  };

  // Exclusão de perfil da tabela profiles
  const deleteUser = async (userId: string) => {
    if (currentUser?.id === userId) {
      return { success: false, error: 'Você não pode excluir sua própria conta conectada.' };
    }
    try {
      console.log(`🗑️ [Supabase DB] Excluindo perfil ${userId} da tabela profiles...`);
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

  // Manter apenas o usuário atual na lista local
  const resetToSingleUser = async () => {
    if (currentUser) {
      setProfiles([currentUser]);
      LocalSyncEngine.saveProfiles([currentUser]);
    }
  };

  // Alternância de visualização entre perfis carregados do banco
  const switchUser = (profile: Profile) => {
    setCurrentUser(profile);
    LocalSyncEngine.setCurrentUser(profile);
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
        createUserByAdmin,
        deleteUser,
        resetToSingleUser,
        switchUser,
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
