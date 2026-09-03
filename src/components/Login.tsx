import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useAuth } from '../context/AuthContext';
import { Database, AlertCircle } from 'lucide-react';
import { SupabaseSetupModal } from './common/SupabaseSetupModal';

interface LoginFormInputs {
  email: string;
  password: string;
}

interface LoginProps {
  onSwitchToSignUp?: () => void;
}

export default function Login({ onSwitchToSignUp }: LoginProps) {
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSupabaseModal, setShowSupabaseModal] = useState(false);
  const { signIn, isSupabaseConnected } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<LoginFormInputs>();

  const handleLogin = async (data: LoginFormInputs) => {
    setErrorMessage('');
    setIsLoading(true);

    try {
      console.log('🚀 [Login] Submetendo credenciais para autenticação Supabase:', data.email);
      const result = await signIn({
        email: data.email.trim(),
        password: data.password
      });

      if (!result.success) {
        console.warn('⚠️ [Login] Falha na autenticação:', result.error);
        setErrorMessage(
          result.error === 'Invalid login credentials'
            ? 'E-mail ou senha incorretos. Verifique suas credenciais no Supabase.'
            : result.error || 'Erro ao realizar login. Tente novamente.'
        );
      } else {
        console.log('🎉 [Login] Login realizado com sucesso no Supabase!');
      }
    } catch (err: any) {
      console.error('❌ [Login] Erro não tratado durante o login:', err);
      setErrorMessage(err?.message || 'Ocorreu um erro ao conectar ao serviço de autenticação.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8">
      <div id="login-card" className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-8 sm:p-10">
        
        {/* Logo Badge */}
        <div className="flex justify-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-[#00478f] text-white font-extrabold text-2xl flex items-center justify-center shadow-sm tracking-tight">
            R9
          </div>
        </div>

        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Acessar Conta
          </h1>
          <p className="text-sm text-gray-500 mt-2">
            Insira suas credenciais cadastradas no Supabase Auth
          </p>
        </div>

        <form onSubmit={handleSubmit(handleLogin)} noValidate className="space-y-5">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              placeholder="seuemail@exemplo.com"
              autoComplete="email"
              className={`w-full px-3.5 py-2.5 text-sm bg-white rounded-lg border transition-colors outline-none focus:ring-2 focus:ring-[#00478f]/20 ${
                errors.email
                  ? 'border-red-400 focus:border-red-500'
                  : 'border-gray-300 focus:border-[#00478f]'
              }`}
              {...register('email', {
                required: 'O campo E-mail é obrigatório.',
                pattern: {
                  value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                  message: 'Insira um endereço de e-mail válido.'
                }
              })}
            />
            {errors.email && (
              <span className="text-xs text-red-600 mt-1.5 block">
                {errors.email.message}
              </span>
            )}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
              Senha
            </label>
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              className={`w-full px-3.5 py-2.5 text-sm bg-white rounded-lg border transition-colors outline-none focus:ring-2 focus:ring-[#00478f]/20 ${
                errors.password
                  ? 'border-red-400 focus:border-red-500'
                  : 'border-gray-300 focus:border-[#00478f]'
              }`}
              {...register('password', {
                required: 'O campo Senha é obrigatório.',
                minLength: {
                  value: 6,
                  message: 'A senha deve conter no mínimo 6 caracteres.'
                }
              })}
            />
            {errors.password && (
              <span className="text-xs text-red-600 mt-1.5 block">
                {errors.password.message}
              </span>
            )}
          </div>

          {errorMessage && (
            <div
              id="login-error-message"
              className="p-3.5 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-left"
              role="alert"
            >
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <button
            id="submit-login-button"
            type="submit"
            disabled={isLoading}
            className="w-full py-3 px-4 text-sm font-semibold rounded-lg text-white bg-[#00478f] hover:bg-[#003c7d] transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer mt-2"
          >
            {isLoading ? 'Autenticando...' : 'Entrar'}
          </button>
        </form>

        {/* Footer switch to Register */}
        <div className="mt-8 text-center pt-2 border-t border-gray-100">
          <p className="text-sm text-gray-600">
            Não tem uma conta?{' '}
            {onSwitchToSignUp && (
              <button
                id="switch-to-register-btn"
                type="button"
                onClick={onSwitchToSignUp}
                className="text-[#00478f] hover:text-[#003366] font-semibold transition-colors cursor-pointer inline-block"
              >
                Cadastre-se
              </button>
            )}
          </p>
        </div>

        {/* Supabase connection indicator button */}
        <div className="mt-5 pt-3 text-center">
          <button
            type="button"
            onClick={() => setShowSupabaseModal(true)}
            className="inline-flex items-center gap-1.5 text-[11px] text-gray-400 hover:text-gray-600 transition-colors"
          >
            <Database className="w-3 h-3 text-[#00478f]" />
            <span>{isSupabaseConnected ? 'Conexão Supabase Ativa' : 'Configurar Banco Supabase & SQL'}</span>
          </button>
        </div>

      </div>

      {showSupabaseModal && (
        <SupabaseSetupModal onClose={() => setShowSupabaseModal(false)} />
      )}
    </div>
  );
}
