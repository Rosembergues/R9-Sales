import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useAuth } from '../../context/AuthContext';
import { Database, AlertCircle } from 'lucide-react';
import { SupabaseSetupModal } from '../common/SupabaseSetupModal';

interface LoginFormInputs {
  email: string;
  password: string;
}

interface LoginFormProps {
  onSwitchToSignUp?: () => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onSwitchToSignUp }) => {
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
      if (!isSupabaseConnected) {
        setShowSupabaseModal(true);
        return;
      }

      await signIn(data.email, data.password);
    } catch (err: any) {
      console.error('❌ [Login] Erro durante o login:', err);
      setErrorMessage(err?.message || 'Ocorreu um erro ao conectar ao serviço de autenticação.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8">
      <div id="login-card" className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-8 sm:p-10">
        {/* Header Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4">
            <div className="flex items-center justify-center w-14 h-14 bg-blue-700 rounded-2xl shadow-lg shadow-blue-500/30 border border-blue-600">
              <span className="text-white font-bold text-2xl font-mono">R9</span>
            </div>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight font-sans">Sistema R9</h1>
        </div>

        {errorMessage && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 text-red-700 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-600" />
            <div>
              <p className="font-semibold">Erro de autenticação</p>
              <p className="text-xs text-red-600 mt-0.5">{errorMessage}</p>
            </div>
          </div>
        )}

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

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 px-4 bg-blue-700 hover:bg-blue-800 text-white font-medium rounded-xl text-sm transition-all shadow-md shadow-blue-500/20 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
          >
            {isLoading ? 'Entrando...' : 'Entrar na Plataforma'}
          </button>
        </form>

        {onSwitchToSignUp && (
          <div className="mt-6 text-center">
            <button
              onClick={onSwitchToSignUp}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              Não tem uma conta? Cadastre-se
            </button>
          </div>
        )}
      </div>

      {showSupabaseModal && (
        <SupabaseSetupModal isOpen={showSupabaseModal} onClose={() => setShowSupabaseModal(false)} />
      )}
    </div>
  );
};

export default LoginForm;
