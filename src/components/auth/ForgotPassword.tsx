import React, { useState } from 'react';
import { AlertCircle, ArrowLeft, MailCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface ForgotPasswordProps {
  onBackToLogin: () => void;
  /** Texto de abertura (ex.: quando o link anterior expirou). */
  intro?: React.ReactNode;
  /** Mostra só o formulário, sem a moldura da página (para usar dentro de outra tela). */
  embedded?: boolean;
}

/**
 * "Esqueci minha senha": pede o e-mail e manda o link para criar uma senha nova.
 * A resposta é sempre a mesma, exista ou não o cadastro, para não revelar quem tem conta.
 */
export const ForgotPassword: React.FC<ForgotPasswordProps> = ({ onBackToLogin, intro, embedded }) => {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [isSending, setIsSending] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
      setError('Insira um endereço de e-mail válido.');
      return;
    }
    setError('');
    setIsSending(true);
    const result = await requestPasswordReset(clean);
    setIsSending(false);
    if (result.success) setSentTo(clean);
    else setError(result.error || 'Não foi possível enviar o e-mail.');
  };

  const content = sentTo ? (
    <div className="text-center space-y-4" id="forgot-password-sent">
      <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
        <MailCheck className="w-7 h-7" />
      </div>
      <div>
        <h2 className="text-lg font-bold text-gray-900">Confira seu e-mail</h2>
        <p className="text-sm text-gray-600 mt-2 leading-relaxed">
          Se <strong>{sentTo}</strong> tiver cadastro no R9 Hub, vai chegar em alguns minutos um link para criar uma senha nova.
        </p>
        <p className="text-xs text-gray-500 mt-2">Não chegou? Olhe a caixa de spam ou peça de novo daqui a um minuto.</p>
      </div>
      <button
        type="button"
        onClick={() => setSentTo('')}
        className="text-xs font-semibold text-[#00478f] hover:text-[#003366] cursor-pointer"
      >
        Enviar para outro e-mail
      </button>
    </div>
  ) : (
    <form onSubmit={submit} noValidate className="space-y-5">
      {intro ?? (
        <p className="text-sm text-gray-600 leading-relaxed">
          Informe o e-mail da sua conta. Vamos mandar um link para você criar uma senha nova.
        </p>
      )}
      <div>
        <label htmlFor="forgot-email" className="block text-sm font-medium text-gray-700 mb-1.5">E-mail</label>
        <input
          id="forgot-email"
          type="email"
          autoComplete="email"
          autoFocus
          placeholder="seuemail@estacio.br"
          value={email}
          onChange={e => { setEmail(e.target.value); setError(''); }}
          className={`w-full px-3.5 py-2.5 text-sm bg-white rounded-lg border outline-none focus:ring-2 focus:ring-[#00478f]/20 ${
            error ? 'border-red-400 focus:border-red-500' : 'border-gray-300 focus:border-[#00478f]'
          }`}
        />
      </div>
      {error && (
        <div className="p-3.5 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2" role="alert">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      <button
        id="send-reset-link-btn"
        type="submit"
        disabled={isSending}
        className="w-full py-3 px-4 text-sm font-semibold rounded-lg text-white bg-[#00478f] hover:bg-[#003c7d] disabled:opacity-50 cursor-pointer"
      >
        {isSending ? 'Enviando...' : 'Enviar link'}
      </button>
    </form>
  );

  const back = (
    <button
      type="button"
      onClick={onBackToLogin}
      className="mt-6 w-full inline-flex items-center justify-center gap-1.5 text-sm font-semibold text-gray-600 hover:text-gray-900 cursor-pointer"
    >
      <ArrowLeft className="w-4 h-4" /> Voltar ao login
    </button>
  );

  if (embedded) return <div>{content}{back}</div>;

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col justify-center items-center p-4 sm:p-6">
      <div id="forgot-password-card" className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-8 sm:p-10">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-700 rounded-2xl shadow-lg shadow-blue-500/30 border border-blue-600 mb-4">
            <span className="text-white font-bold text-2xl font-mono">R9</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Esqueci minha senha</h1>
        </div>
        {content}
        {back}
      </div>
    </div>
  );
};
