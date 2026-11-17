import { FormEvent, useState } from 'react';
import { ArrowRight, Eye, EyeOff, Mail, LockKeyhole, AlertCircle, LoaderCircle, ShieldCheck } from 'lucide-react';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';

export function LoginScreen({ onAuthenticated }: { onAuthenticated: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [confirmPassword, setConfirmPassword] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(''); setNotice('');
    if (mode === 'signup' && password !== confirmPassword) { setError('As senhas não coincidem.'); return; }
    if (!isSupabaseConfigured || !supabase) {
      setError('O Supabase ainda não está configurado. Preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no ambiente do projeto.');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'signup') {
        const { data, error: authError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: window.location.origin }
        });
        if (authError) { setError(authError.message); return; }
        if (data.session) {
          onAuthenticated();
        } else {
          setNotice('Conta solicitada! Confira seu e-mail para confirmar o cadastro antes de entrar.');
          setMode('login'); setPassword(''); setConfirmPassword('');
        }
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (authError) {
          const message = authError.message.toLowerCase().includes('invalid login credentials') ? 'E-mail ou senha incorretos.' : authError.message;
          setError(message); return;
        }
        onAuthenticated();
      }
    } catch {
      setError('Não foi possível conectar ao serviço de autenticação. Verifique sua conexão e tente novamente.');
    } finally { setLoading(false); }
  }

  async function handleRecovery() {
    setError(''); setNotice('');
    if (!isSupabaseConfigured || !supabase) {
      setError('Configure primeiro as credenciais do Supabase.'); return;
    }
    if (!email.trim()) { setError('Digite seu e-mail no campo acima para recuperar a senha.'); return; }
    setLoading(true);
    try {
      const { error: recoveryError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/?auth=password-reset` });
      if (recoveryError) setError(recoveryError.message);
      else setNotice('Se esse e-mail estiver cadastrado, você receberá as instruções para redefinir a senha.');
    } catch { setError('Não foi possível solicitar a recuperação agora. Tente novamente.'); }
    finally { setLoading(false); }
  }

  return <main className="r9-auth-shell">
    <section className="r9-auth-brand" aria-label="R9Bot Mailer">
      <div className="r9-brand-orb orb-one"/><div className="r9-brand-orb orb-two"/>
      <div className="r9-brand-content">
        <div className="r9-logo-mark">R9</div>
        <div className="r9-brand-kicker">COMUNICAÇÃO · ESTÁCIO</div>
        <h1>Suas ideias.<br/><span>Em cada inbox.</span></h1>
        <p>Crie, organize e compartilhe comunicações por e-mail em um só lugar.</p>
        <div className="r9-brand-feature"><ShieldCheck size={18}/><span>Um espaço de criação para todas as unidades</span></div>
      </div>
      <div className="r9-brand-foot">R9 MAILER <span>•</span> PLATAFORMA DE COMUNICAÇÃO</div>
    </section>
    <section className="r9-auth-panel">
      <div className="r9-auth-card">
        <div className="r9-mobile-logo"><span className="r9-logo-mark">R9</span><span>R9Bot Mailer</span></div>
        <div className="r9-auth-eyebrow">{mode === 'login' ? 'BEM-VINDO DE VOLTA' : 'CRIE SEU ACESSO'}</div>
        <h2>{mode === 'login' ? 'Acesse sua conta' : 'Criar uma conta'}</h2>
        <p className="r9-auth-subtitle">{mode === 'login' ? 'Entre para continuar criando seus e-mails.' : 'Cadastre seu e-mail e crie uma senha para acessar o R9Bot Mailer.'}</p>
        {!isSupabaseConfigured && <div className="r9-config-note"><AlertCircle size={17}/><span>Login pronto para conectar. Falta configurar as credenciais do Supabase.</span></div>}
        <form onSubmit={handleSubmit} className="r9-auth-form">
          <label htmlFor="r9-email">E-mail</label>
          <div className="r9-input-wrap"><Mail size={18}/><input id="r9-email" type="email" autoComplete="email" placeholder="voce@empresa.com.br" value={email} onChange={e=>setEmail(e.target.value)} required/></div>
          <div className="r9-password-label"><label htmlFor="r9-password">Senha</label>{mode === 'login' && <button type="button" onClick={handleRecovery} disabled={loading}>Esqueci minha senha</button>}</div>
          <div className="r9-input-wrap"><LockKeyhole size={18}/><input id="r9-password" type={showPassword?'text':'password'} autoComplete="current-password" placeholder="Digite sua senha" value={password} onChange={e=>setPassword(e.target.value)} required minLength={6}/><button className="r9-show-password" type="button" aria-label={showPassword?'Ocultar senha':'Mostrar senha'} onClick={()=>setShowPassword(v=>!v)}>{showPassword?<EyeOff size={18}/>:<Eye size={18}/>}</button></div>
          {error && <div className="r9-auth-message error" role="alert"><AlertCircle size={17}/><span>{error}</span></div>}
          {notice && <div className="r9-auth-message success" role="status">{notice}</div>}
          {mode === 'signup' && <>
            <label htmlFor="r9-confirm-password">Confirmar senha</label>
            <div className="r9-input-wrap"><LockKeyhole size={18}/><input id="r9-confirm-password" type={showPassword?'text':'password'} autoComplete="new-password" placeholder="Digite a senha novamente" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} required minLength={6}/></div>
          </>}
          <button className="r9-submit" type="submit" disabled={loading}>{loading?<><LoaderCircle className="r9-spinner" size={18}/>Aguarde...</>:<>{mode === 'login' ? 'Entrar na plataforma' : 'Criar minha conta'} <ArrowRight size={18}/></>}</button>
          <button className="r9-auth-mode-toggle" type="button" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); setNotice(''); }}>{mode === 'login' ? 'Não tem uma conta? Criar conta' : 'Já tem uma conta? Entrar'}</button>
        </form>
        <div className="r9-auth-divider"><span/></div>
        <p className="r9-auth-help">Dúvidas ou problemas para acessar? <a href="https://teams.microsoft.com/l/chat/0/0?users=daniel.marques%40estacio.br" target="_blank" rel="noreferrer">Fale com Daniel Marques pelo Microsoft Teams</a>.</p>
        <div className="r9-auth-security"><ShieldCheck size={15}/> Acesso protegido por autenticação segura</div>
      </div>
      <footer className="r9-auth-footer">© {new Date().getFullYear()} R9Bot Mailer <span>•</span> Estácio</footer>
    </section>
  </main>;
}
