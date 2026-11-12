import React, { useEffect, useState } from 'react';
import { AlertCircle, Check, CheckCircle2, Eye, EyeOff, KeyRound, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { authRedirectAtStartup, supabase } from '../../lib/supabase';
import { ForgotPassword } from './ForgotPassword';

type Stage = 'checking' | 'form' | 'invalid' | 'done';

/** Regras mostradas enquanto a pessoa digita (o Supabase pode exigir mais). */
const RULES: Array<{ label: string; test: (p: string) => boolean }> = [
  { label: 'Pelo menos 8 caracteres', test: p => p.length >= 8 },
  { label: 'Letras e números', test: p => /[a-zA-Z]/.test(p) && /\d/.test(p) },
];

const invalidMessage = (code: string | null) => {
  if (code === 'otp_expired') return 'Este link expirou ou já foi usado. Os links valem por pouco tempo e só funcionam uma vez.';
  if (code) return 'Este link não é válido.';
  return 'Não encontramos um link de recuperação válido. Abra o link mais recente que chegou no seu e-mail.';
};

/**
 * Página aberta pelo link do e-mail de "Esqueci minha senha" (/redefinir-senha).
 * O Supabase transforma o link numa sessão temporária; aqui a pessoa grava a senha nova.
 */
export const ResetPasswordPage: React.FC = () => {
  const { updatePassword, endPasswordRecovery, signOut } = useAuth();
  const [stage, setStage] = useState<Stage>(authRedirectAtStartup.errorCode ? 'invalid' : 'checking');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // O link vira sessão logo que o site abre; sem sessão, o link era inválido.
  useEffect(() => {
    if (stage !== 'checking') return;
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (alive) setStage(data.session ? 'form' : 'invalid');
    });
    return () => { alive = false; };
  }, [stage]);

  const allRulesOk = RULES.every(r => r.test(password));
  const matches = password.length > 0 && password === confirm;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allRulesOk) return setError('A senha precisa ter pelo menos 8 caracteres, com letras e números.');
    if (!matches) return setError('As duas senhas não são iguais.');
    setError('');
    setIsSaving(true);
    const result = await updatePassword(password);
    setIsSaving(false);
    if (result.success) setStage('done');
    else setError(result.error || 'Não foi possível salvar a senha.');
  };

  const backToLogin = async () => {
    await signOut();
    endPasswordRecovery();
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col justify-center items-center p-4 sm:p-6">
      <div id="reset-password-card" className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-8 sm:p-10">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-700 rounded-2xl shadow-lg shadow-blue-500/30 border border-blue-600 mb-4">
            <KeyRound className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            {stage === 'done' ? 'Senha alterada' : stage === 'invalid' ? 'Link inválido' : 'Criar senha nova'}
          </h1>
        </div>

        {stage === 'checking' && (
          <div className="py-8 flex items-center justify-center gap-2 text-sm text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" /> Conferindo o link...
          </div>
        )}

        {stage === 'invalid' && (
          <ForgotPassword
            embedded
            onBackToLogin={backToLogin}
            intro={
              <div className="p-3.5 text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>{invalidMessage(authRedirectAtStartup.errorCode)} Peça um link novo abaixo.</span>
              </div>
            }
          />
        )}

        {stage === 'form' && (
          <form onSubmit={submit} noValidate className="space-y-5">
            <div>
              <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 mb-1.5">Senha nova</label>
              <div className="relative">
                <input
                  id="new-password"
                  type={show ? 'text' : 'password'}
                  autoComplete="new-password"
                  autoFocus
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  className="w-full px-3.5 py-2.5 pr-10 text-sm bg-white rounded-lg border border-gray-300 outline-none focus:border-[#00478f] focus:ring-2 focus:ring-[#00478f]/20"
                />
                <button
                  type="button"
                  onClick={() => setShow(s => !s)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-700 cursor-pointer"
                  title={show ? 'Esconder senha' : 'Mostrar senha'}
                  aria-label={show ? 'Esconder senha' : 'Mostrar senha'}
                >
                  {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <ul className="mt-2 space-y-1">
                {RULES.map(r => {
                  const ok = r.test(password);
                  return (
                    <li key={r.label} className={`flex items-center gap-1.5 text-xs ${ok ? 'text-emerald-700' : 'text-gray-500'}`}>
                      <Check className={`w-3.5 h-3.5 ${ok ? '' : 'opacity-30'}`} /> {r.label}
                    </li>
                  );
                })}
              </ul>
            </div>
            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-1.5">Repita a senha nova</label>
              <input
                id="confirm-password"
                type={show ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirm}
                onChange={e => { setConfirm(e.target.value); setError(''); }}
                className={`w-full px-3.5 py-2.5 text-sm bg-white rounded-lg border outline-none focus:ring-2 focus:ring-[#00478f]/20 ${
                  confirm && !matches ? 'border-red-400 focus:border-red-500' : 'border-gray-300 focus:border-[#00478f]'
                }`}
              />
              {confirm && !matches && <span className="text-xs text-red-600 mt-1.5 block">As duas senhas não são iguais.</span>}
            </div>
            {error && (
              <div className="p-3.5 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2" role="alert">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
            <button
              id="save-new-password-btn"
              type="submit"
              disabled={isSaving}
              className="w-full py-3 px-4 text-sm font-semibold rounded-lg text-white bg-[#00478f] hover:bg-[#003c7d] disabled:opacity-50 cursor-pointer"
            >
              {isSaving ? 'Salvando...' : 'Salvar senha nova'}
            </button>
            <button type="button" onClick={backToLogin} className="w-full text-sm font-semibold text-gray-500 hover:text-gray-800 cursor-pointer">
              Cancelar
            </button>
          </form>
        )}

        {stage === 'done' && (
          <div className="text-center space-y-4">
            <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
            <p className="text-sm text-gray-600">Pronto! A partir de agora, entre com a senha nova.</p>
            <button
              id="continue-after-reset-btn"
              type="button"
              onClick={endPasswordRecovery}
              className="w-full py-3 px-4 text-sm font-semibold rounded-lg text-white bg-[#00478f] hover:bg-[#003c7d] cursor-pointer"
            >
              Continuar para o R9 Hub
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
