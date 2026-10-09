import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Mail, CheckCircle2, AlertCircle, X, ArrowLeft, KeyRound } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialEmail?: string;
}

export default function ForgotPasswordModal({
  isOpen,
  onClose,
  initialEmail = '',
}: ForgotPasswordModalProps) {
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: {
      email: initialEmail,
    },
  });

  if (!isOpen) return null;

  const handleSendRecoveryEmail = async (data: { email: string }) => {
    setErrorMessage('');
    setSuccessMessage('');
    setIsLoading(true);

    try {
      // Configuração correta do redirecionamento para o fluxo de reset de senha
      // Suporta produção em https://r9-planner.vercel.app/ ou o origin do ambiente atual
      const isProduction =
        typeof window !== 'undefined' &&
        (window.location.hostname.includes('vercel.app') ||
          !window.location.hostname.includes('localhost') && !window.location.hostname.includes('run.app'));

      const redirectToUrl =
        isProduction
          ? 'https://r9-planner.vercel.app/'
          : `${window.location.origin}/`;

      const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
        redirectTo: redirectToUrl,
      });

      if (error) {
        setErrorMessage(
          error.message || 'Erro ao solicitar recuperação de senha. Verifique o e-mail digitado.'
        );
        return;
      }

      setSuccessMessage(
        'Enviamos um link de recuperação para seu e-mail! Verifique sua caixa de entrada (e a pasta de spam) e siga as instruções para redefinir sua senha.'
      );
    } catch (err: any) {
      setErrorMessage(
        err?.message || 'Ocorreu um erro inesperado ao conectar ao servidor.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div
        id="forgot-password-modal"
        className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-100 p-6 sm:p-7 relative transition-all"
        role="dialog"
        aria-labelledby="forgot-password-title"
      >
        {/* Botão de Fechar */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
          title="Fechar"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex flex-col items-center text-center mb-5">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-3">
            <KeyRound className="w-6 h-6 stroke-[2.2]" />
          </div>
          <h2
            id="forgot-password-title"
            className="text-xl font-bold text-gray-900 tracking-tight"
          >
            Esqueceu sua senha?
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-1 max-w-xs leading-relaxed">
            Digite seu e-mail cadastrado e enviaremos um link seguro para você redefinir sua senha.
          </p>
        </div>

        {/* Mensagem de sucesso */}
        {successMessage ? (
          <div className="space-y-4">
            <div
              id="recovery-success-banner"
              className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs sm:text-sm leading-relaxed flex items-start gap-3"
              role="status"
            >
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-emerald-900 mb-1">
                  E-mail de recuperação enviado!
                </p>
                <p>{successMessage}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 px-4 text-sm font-medium rounded-lg text-white bg-institucional hover:opacity-95 transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar para o Login</span>
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit(handleSendRecoveryEmail)} noValidate className="space-y-4">
            <div>
              <label htmlFor="recovery-email" className="block text-xs font-semibold text-gray-700 mb-1.5">
                E-mail da sua conta
              </label>
              <div className="relative">
                <input
                  id="recovery-email"
                  type="email"
                  placeholder="seuemail@exemplo.com"
                  autoComplete="email"
                  className={`w-full px-3.5 py-2.5 pl-9 text-sm bg-white rounded-lg border transition-colors outline-none focus:ring-2 focus:ring-blue-500/20 ${
                    errors.email
                      ? 'border-red-400 focus:border-red-500'
                      : 'border-gray-300 focus:border-blue-600'
                  }`}
                  {...register('email', {
                    required: 'O campo E-mail é obrigatório.',
                    pattern: {
                      value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                      message: 'Insira um endereço de e-mail válido.',
                    },
                  })}
                />
                <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
              {errors.email && (
                <span className="text-xs text-red-600 mt-1.5 block">
                  {errors.email.message as string}
                </span>
              )}
            </div>

            {errorMessage && (
              <div
                id="recovery-error-banner"
                className="p-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2"
                role="alert"
              >
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="flex flex-col gap-2 pt-1">
              <button
                id="submit-forgot-password-button"
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 px-4 text-sm font-medium rounded-lg text-white bg-institucional hover:opacity-95 transition-all shadow-xs disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer"
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Enviando link...</span>
                  </div>
                ) : (
                  'Enviar link de recuperação'
                )}
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-full py-2 text-xs font-semibold text-gray-600 hover:text-gray-900 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
