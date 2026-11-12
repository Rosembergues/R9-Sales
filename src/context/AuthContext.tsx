import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Profile, UserRole, ProfileStatus, hasApprovedAccess, isAllowedEmailDomain } from '../types';
import { RESET_PASSWORD_PATH, authRedirectAtStartup, supabase } from '../lib/supabase';
import { LocalSyncEngine } from '../lib/localCache';
import { errorText } from '../lib/errors';

interface AuthContextType {
  currentUser: Profile | null;
  /** Só perfis autorizados (rankings, metas, vendas, listas de consultores). */
  profiles: Profile[];
  /** Todos os perfis, inclusive pendentes e recusados (tela de Gerenciar Equipe). */
  allProfiles: Profile[];
  /** Usuários aguardando autorização. */
  pendingProfiles: Profile[];
  loading: boolean;
  signUp: (data: { name: string; email: string; password: string }) => Promise<{ success: boolean; error?: string }>;
  signIn: (data: { email: string; password?: string }) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  updateUserRole: (userId: string, newRole: UserRole) => Promise<{ success: boolean; error?: string }>;
  updateUserStatus: (userId: string, status: ProfileStatus) => Promise<{ success: boolean; error?: string }>;
  updateUserName: (userId: string, name: string) => Promise<{ success: boolean; error?: string }>;
  /** Relê o perfil do usuário logado (ex.: conferir se já foi autorizado). */
  reloadCurrentUser: () => Promise<void>;
  refreshProfiles: () => Promise<void>;
  /** Aberto pelo link de "Esqueci minha senha": mostrar a página de nova senha. */
  isPasswordRecovery: boolean;
  /** Envia o e-mail com o link para criar uma senha nova. */
  requestPasswordReset: (email: string) => Promise<{ success: boolean; error?: string }>;
  /** Grava a senha nova de quem está logado (inclusive pelo link de recuperação). */
  updatePassword: (password: string) => Promise<{ success: boolean; error?: string }>;
  /** Sai da página de nova senha e volta ao fluxo normal do site. */
  endPasswordRecovery: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [allProfiles, setProfiles] = useState<Profile[]>([]);
  const profiles = React.useMemo(() => allProfiles.filter(hasApprovedAccess), [allProfiles]);
  const pendingProfiles = React.useMemo(() => allProfiles.filter(p => p.status === 'pending'), [allProfiles]);
  const [loading, setLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(authRedirectAtStartup.isRecovery);


  /**
   * Recupera o perfil do usuário logado fazendo um select na tabela profiles
   * filtrando pelo ID da sessão atual no Supabase.
   */
  const fetchAndSetUserProfile = async (userId: string, authUserMeta?: { name?: string; email?: string }): Promise<Profile | null> => {
    const buildFallbackProfile = (status: ProfileStatus = 'active'): Profile | null => {
      if (!authUserMeta) return null;
      const fallbackProfile: Profile = {
        id: userId,
        name: authUserMeta.name || authUserMeta.email?.split('@')[0] || 'Usuário',
        email: authUserMeta.email || '',
        // Fallback seguro: o cargo só pode vir do perfil persistido no banco.
        role: 'seller',
        avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(authUserMeta.name || userId)}`,
        created_at: new Date().toISOString(),
        status,
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
        // A consulta funcionou e o perfil não existe (ex.: removido pelo admin): sem acesso.
        return buildFallbackProfile('pending');
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
        LocalSyncEngine.saveProfiles((data as Profile[]).filter(hasApprovedAccess));
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
    } catch (err) {
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
      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true);
        return;
      }

      if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
        LocalSyncEngine.setCurrentUser(null);
        return;
      }

      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {

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
    if (!isAllowedEmailDomain(email)) {
      return { success: false, error: 'Use seu e-mail corporativo @estacio.br ou @yduqs.com.br.' };
    }
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
        const friendly = /estacio|yduqs|Database error saving new user/i.test(error.message)
          ? 'Cadastro permitido apenas para e-mails @estacio.br ou @yduqs.com.br.'
          : error.message;
        return { success: false, error: friendly };
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
    } catch (err) {
      console.error('💥 [Supabase Auth] Exceção inesperada durante o cadastro:', err);
      setLoading(false);
      return { success: false, error: errorText(err, 'Erro inesperado durante o cadastro.') };
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
    } catch (err) {
      console.error('💥 [Supabase Auth] Exceção inesperada no login:', err);
      setLoading(false);
      return { success: false, error: errorText(err, 'Erro ao realizar login.') };
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

  const reloadCurrentUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    await fetchAndSetUserProfile(session.user.id, {
      name: session.user.user_metadata?.name,
      email: session.user.email,
    });
    await refreshProfiles();
  };

  // Autorização de acesso (pending → active, recusar/revogar → rejected). O banco só aceita de admin.
  const updateUserStatus = async (userId: string, status: ProfileStatus) => {
    if (currentUser?.id === userId) {
      return { success: false, error: 'Você não pode alterar o seu próprio acesso.' };
    }
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', userId)
        .select('*');
      if (error) return { success: false, error: error.message };
      if (!data || data.length === 0) {
        return { success: false, error: 'Nenhum perfil foi alterado. Verifique suas permissões de administrador.' };
      }
      const updated = data[0] as Profile;
      setProfiles(prev => prev.map(p => (p.id === userId ? { ...p, ...updated } : p)));
      return { success: true };
    } catch (err) {
      return { success: false, error: errorText(err, 'Erro ao alterar o acesso do usuário.') };
    }
  };

  // Alteração de cargo na tabela profiles por um administrador
  const updateUserRole = async (userId: string, newRole: UserRole) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({ role: newRole, updated_at: new Date().toISOString() })
        .eq('id', userId)
        .select('id');

      if (error) {
        console.error('❌ [Supabase DB] Erro ao atualizar papel na tabela profiles:', error.message);
        return { success: false, error: error.message };
      }
      if (!data || data.length === 0) {
        return { success: false, error: 'Nenhum perfil foi alterado. Verifique suas permissões de administrador.' };
      }

      setProfiles(prev => prev.map(p => (p.id === userId ? { ...p, role: newRole } : p)));
      if (currentUser?.id === userId) {
        setCurrentUser(prev => (prev ? { ...prev, role: newRole } : null));
      }

      return { success: true };
    } catch (err) {
      console.error('💥 [Supabase DB] Exceção ao atualizar papel:', err);
      return { success: false, error: errorText(err, 'Erro ao alterar perfil do usuário.') };
    }
  };

  // Correção do nome exibido (ranking, planejamento, metas).
  const updateUserName = async (userId: string, name: string) => {
    const clean = name.trim().replace(/\s+/g, ' ');
    if (clean.length < 2) return { success: false, error: 'Informe um nome com pelo menos 2 letras.' };
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({ name: clean, updated_at: new Date().toISOString() })
        .eq('id', userId)
        .select('id');
      if (error) return { success: false, error: error.message };
      if (!data || data.length === 0) {
        return { success: false, error: 'Nenhum perfil foi alterado. Verifique suas permissões de administrador.' };
      }
      setProfiles(prev => prev.map(p => (p.id === userId ? { ...p, name: clean } : p)));
      if (currentUser?.id === userId) setCurrentUser(prev => (prev ? { ...prev, name: clean } : null));
      return { success: true };
    } catch (err) {
      return { success: false, error: errorText(err, 'Erro ao alterar o nome.') };
    }
  };

  const requestPasswordReset = async (email: string) => {
    const clean = email.trim().toLowerCase();
    if (!isAllowedEmailDomain(clean)) {
      return { success: false, error: 'Use o seu e-mail @estacio.br ou @yduqs.com.br.' };
    }
    const { error } = await supabase.auth.resetPasswordForEmail(clean, {
      redirectTo: `${window.location.origin}${RESET_PASSWORD_PATH}`,
    });
    if (!error) return { success: true };
    const msg = error.message || '';
    if (/only request this after|rate limit|too many/i.test(msg)) {
      return { success: false, error: 'Muitos pedidos seguidos. Espere um minuto e tente de novo.' };
    }
    return { success: false, error: errorText(error, 'Não foi possível enviar o e-mail agora. Tente de novo.') };
  };

  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (!error) return { success: true };
    const msg = error.message || '';
    if (/different from the old password/i.test(msg)) {
      return { success: false, error: 'A senha nova precisa ser diferente da atual.' };
    }
    if (/at least|weak|characters/i.test(msg)) {
      return { success: false, error: 'Senha fraca. Use pelo menos 8 caracteres, com letras e números.' };
    }
    if (/session|jwt|expired|not authenticated/i.test(msg)) {
      return { success: false, error: 'O link expirou. Peça um link novo.' };
    }
    return { success: false, error: errorText(error, 'Não foi possível salvar a senha. Tente de novo.') };
  };

  const endPasswordRecovery = () => {
    setIsPasswordRecovery(false);
    if (window.location.pathname === RESET_PASSWORD_PATH) window.history.replaceState(null, '', '/');
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        profiles,
        allProfiles,
        pendingProfiles,
        loading,
        signUp,
        signIn,
        signOut,
        updateUserRole,
        updateUserStatus,
        updateUserName,
        reloadCurrentUser,
        refreshProfiles,
        isPasswordRecovery,
        requestPasswordReset,
        updatePassword,
        endPasswordRecovery,
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
