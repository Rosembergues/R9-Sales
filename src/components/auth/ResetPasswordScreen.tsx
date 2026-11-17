import { FormEvent, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
} from 'lucide-react';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';

type ResetPasswordScreenProps = {
  onContinue: () => void;
  onBackToLogin: () => void;
};

function getFriendlyAuthError(message: string): string {
  const normalized = message.toLowerCase();
  if (
    normalized.includes('session missing') ||
    normalized.includes('jwt') ||
    normalized.includes('expired') ||
    normalized.includes('invalid token') ||
    normalized.includes('token has expired')
  ) {
    return 'Este link de redefinição expirou, já foi utilizado ou não é válido. Solicite um novo link na tela de login.';
  }
  if (normalized.includes('password should be at least') || normalized.includes('password must be at least')) {
    return 'A senha é muito curta. Use pelo menos 6 caracteres.';
  }
  if (normalized.includes('same password') || normalized.includes('different from the old password')) {
    return 'Escolha uma senha diferente da atual.';
  }
  return message || 'Não foi possível redefinir sua senha. Solicite um novo link e tente novamente.';
}

function clearRecoveryUrl() {
  // Remove os parâmetros e tokens temporários da barra de endereço após o fluxo.
  window.history.replaceState({}, document.title, window.location.pathname);
}

export function ResetPasswordScreen({ onContinue, onBackToLogin }: ResetPasswordScreenProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }
    if (!isSupabaseConfigured || !supabase) {
      setError('O Supabase não está configurado neste ambiente.');
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(getFriendlyAuthError(updateError.message));
        return;
      }
      setDone(true);
      setPassword('');
      setConfirmPassword('');
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '';
      setError(getFriendlyAuthError(message));
    } finally {
      setLoading(false);
    }
  }

  async function handleBackToLogin() {
    if (supabase) {
      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch {
        // A tela de login continua acessível mesmo se não houver uma sessão local ativa.
      }
    }
    clearRecoveryUrl();
    onBackToLogin();
  }

  function handleContinue() {
    clearRecoveryUrl();
    onContinue();
  }

  return (
    <main className="r9-auth-shell">
      <section className="r9-auth-brand" aria-label="R9Bot Mailer">
        <div className="r9-brand-orb orb-one" />
        <div className="r9-brand-orb orb-two" />
        <div className="r9-brand-content">
          <div className="r9-logo-mark">R9</div>
          <div className="r9-brand-kicker">COMUNICAÇÃO · ESTÁCIO</div>
          <h1>Seu acesso.<br /><span>De volta às mãos.</span></h1>
          <p>Crie uma nova senha para voltar a organizar e compartilhar suas comunicações por e-mail.</p>
          <div className="r9-brand-feature"><ShieldCheck size={18} /><span>Redefinição protegida pelo Supabase Auth</span></div>
        </div>
        <div className="r9-brand-foot">R9 MAILER <span>•</span> PLATAFORMA DE COMUNICAÇÃO</div>
      </section>

      <section className="r9-auth-panel">
        <div className="r9-auth-card">
          <div className="r9-mobile-logo"><span className="r9-logo-mark">R9</span><span>R9Bot Mailer</span></div>
          {done ? (
            <>
              <div className="r9-reset-success-icon"><CheckCircle2 size={28} /></div>
              <div className="r9-auth-eyebrow">SENHA ATUALIZADA</div>
              <h2>Tudo certo!</h2>
              <p className="r9-auth-subtitle">Sua senha foi redefinida com sucesso. Agora você já pode continuar usando o R9Bot Mailer.</p>
              <div className="r9-auth-message success" role="status"><CheckCircle2 size={17} /><span>A nova senha já está ativa.</span></div>
              <button className="r9-submit" type="button" onClick={handleContinue}>Continuar para o sistema <ArrowRight size={18} /></button>
            </>
          ) : (
            <>
              <div className="r9-auth-eyebrow">RECUPERAÇÃO DE ACESSO</div>
              <h2>Defina uma nova senha</h2>
              <p className="r9-auth-subtitle">Escolha uma senha nova para sua conta. Use pelo menos 6 caracteres.</p>

              {!isSupabaseConfigured && <div className="r9-config-note"><AlertCircle size={17} /><span>O Supabase ainda não está configurado neste ambiente.</span></div>}

              <form onSubmit={handleSubmit} className="r9-auth-form">
                <label htmlFor="r9-new-password">Nova senha</label>
                <div className="r9-input-wrap">
                  <LockKeyhole size={18} />
                  <input
                    id="r9-new-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Digite sua nova senha"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    minLength={6}
                  />
                  <button className="r9-show-password" type="button" aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'} onClick={() => setShowPassword((value) => !value)}>
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                <label htmlFor="r9-confirm-new-password">Confirmar nova senha</label>
                <div className="r9-input-wrap">
                  <LockKeyhole size={18} />
                  <input
                    id="r9-confirm-new-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Digite a senha novamente"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    required
                    minLength={6}
                  />
                </div>

                {error && <div className="r9-auth-message error" role="alert"><AlertCircle size={17} /><span>{error}</span></div>}

                <button className="r9-submit" type="submit" disabled={loading}>
                  {loading ? <><LoaderCircle className="r9-spinner" size={18} />Atualizando senha...</> : <>Redefinir minha senha <ArrowRight size={18} /></>}
                </button>
                <button className="r9-auth-mode-toggle" type="button" onClick={handleBackToLogin} disabled={loading}>
                  <ArrowLeft size={15} style={{ display: 'inline', marginRight: 7, verticalAlign: '-3px' }} /> Voltar para o login
                </button>
              </form>
            </>
          )}

          <div className="r9-auth-divider"><span /></div>
          <p className="r9-auth-help">Se você não solicitou essa alteração, ignore o e-mail de recuperação.</p>
          <div className="r9-auth-security"><ShieldCheck size={15} /> Acesso protegido por autenticação segura</div>
        </div>
        <footer className="r9-auth-footer">© {new Date().getFullYear()} R9Bot Mailer <span>•</span> Estácio</footer>
      </section>
    </main>
  );
}
