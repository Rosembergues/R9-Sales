import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { supabase } from '../../lib/supabase';
import ForgotPasswordModal from './ForgotPasswordModal.tsx';

export default function Login({ onLoginSuccess }) {
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors }
  } = useForm();

  const passwordValue = watch('password');

  const toggleMode = () => {
    setIsRegisterMode((prev) => !prev);
    setErrorMessage('');
    setSuccessMessage('');
    reset();
  };

  const handleAuthSubmit = async (data) => {
    setErrorMessage('');
    setSuccessMessage('');
    setIsLoading(true);

    try {
      if (isRegisterMode) {
        // Fluxo de Cadastro / Registro
        const { data: authData, error } = await supabase.auth.signUp({
          email: data.email,
          password: data.password
        });

        if (error) {
          if (error.message.includes('User already registered')) {
            setErrorMessage('Este e-mail já está cadastrado. Faça login ou use outro.');
          } else if (error.message.includes('Password should be at least')) {
            setErrorMessage('A senha deve ter pelo menos 6 caracteres.');
          } else {
            setErrorMessage(error.message || 'Erro ao criar conta. Tente novamente.');
          }
          return;
        }

        // Se o Supabase confirmou ou retornou a sessão imediatamente
        if (authData?.session?.user) {
          if (onLoginSuccess) {
            onLoginSuccess(authData.session.user);
          }
        } else if (authData?.user) {
          // Caso exija confirmação de e-mail por padrão do Supabase
          setSuccessMessage(
            'Conta criada com sucesso! Verifique seu e-mail para confirmar seu cadastro ou tente fazer login.'
          );
          setIsRegisterMode(false);
          reset();
        }
      } else {
        // Fluxo de Login
        const { data: authData, error } = await supabase.auth.signInWithPassword({
          email: data.email,
          password: data.password
        });

        if (error) {
          setErrorMessage(
            error.message === 'Invalid login credentials'
              ? 'E-mail ou senha incorretos. Verifique suas credenciais.'
              : error.message || 'Erro ao realizar login. Tente novamente.'
          );
          return;
        }

        if (authData?.user && onLoginSuccess) {
          onLoginSuccess(authData.user);
        }
      }
    } catch (err) {
      setErrorMessage('Ocorreu um erro inesperado ao conectar ao serviço.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8">
      <div id="auth-card" className="w-full max-w-md bg-white rounded-xl shadow-sm border border-gray-100 p-8">
        <div className="mb-8 text-center flex flex-col items-center">
          <div className="w-14 h-14 bg-gradient-to-br from-[#0056b3] to-[#003d7a] rounded-2xl flex items-center justify-center shadow-md shadow-blue-900/15 mb-4 select-none">
            <span className="text-white font-black text-2xl tracking-wider">R9</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
            {isRegisterMode ? 'Criar Nova Conta' : 'Acessar Conta'}
          </h1>
          <p className="text-sm text-gray-500 mt-2">
            {isRegisterMode
              ? 'Preencha os dados abaixo para se cadastrar'
              : 'Insira suas credenciais para continuar'}
          </p>
        </div>

        {/* Mensagem de sucesso (ex: após cadastro) */}
        {successMessage && (
          <div
            id="auth-success-message"
            className="mb-5 p-3.5 text-xs leading-relaxed text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg text-center"
            role="status"
          >
            {successMessage}
          </div>
        )}

        <form onSubmit={handleSubmit(handleAuthSubmit)} noValidate className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              placeholder="seuemail@exemplo.com"
              autoComplete="email"
              className={`w-full px-3.5 py-2.5 text-sm bg-white rounded-lg border transition-colors outline-none focus:ring-2 focus:ring-blue-500/20 ${
                errors.email
                  ? 'border-red-400 focus:border-red-500'
                  : 'border-gray-300 focus:border-blue-600'
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
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Senha
              </label>
              {!isRegisterMode && (
                <button
                  id="forgot-password-link"
                  type="button"
                  onClick={() => setIsForgotPasswordOpen(true)}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium hover:underline cursor-pointer focus:outline-none"
                >
                  Esqueceu sua senha?
                </button>
              )}
            </div>
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              autoComplete={isRegisterMode ? 'new-password' : 'current-password'}
              className={`w-full px-3.5 py-2.5 text-sm bg-white rounded-lg border transition-colors outline-none focus:ring-2 focus:ring-blue-500/20 ${
                errors.password
                  ? 'border-red-400 focus:border-red-500'
                  : 'border-gray-300 focus:border-blue-600'
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

          {/* Campo de confirmação de senha apenas no modo de Registro */}
          {isRegisterMode && (
            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-gray-700 mb-1.5"
              >
                Confirmar Senha
              </label>
              <input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                autoComplete="new-password"
                className={`w-full px-3.5 py-2.5 text-sm bg-white rounded-lg border transition-colors outline-none focus:ring-2 focus:ring-blue-500/20 ${
                  errors.confirmPassword
                    ? 'border-red-400 focus:border-red-500'
                    : 'border-gray-300 focus:border-blue-600'
                }`}
                {...register('confirmPassword', {
                  required: 'Confirme sua senha.',
                  validate: (val) =>
                    val === passwordValue || 'As senhas não coincidem.'
                })}
              />
              {errors.confirmPassword && (
                <span className="text-xs text-red-600 mt-1.5 block">
                  {errors.confirmPassword.message}
                </span>
              )}
            </div>
          )}

          {errorMessage && (
            <div
              id="auth-error-message"
              className="p-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg text-center"
              role="alert"
            >
              {errorMessage}
            </div>
          )}

          <button
            id="submit-auth-button"
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 py-2.5 px-4 text-sm font-medium rounded-lg text-white bg-institucional hover:opacity-95 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer"
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>{isRegisterMode ? 'Cadastrando...' : 'Entrando...'}</span>
              </div>
            ) : (
              isRegisterMode ? 'Criar Conta' : 'Entrar'
            )}
          </button>
        </form>

        {/* Alternar entre Login e Registro */}
        <div className="mt-6 pt-5 border-t border-gray-100 text-center">
          <p className="text-sm text-gray-600">
            {isRegisterMode ? 'Já tem uma conta?' : 'Não possui uma conta?'}
            <button
              id="toggle-auth-mode-button"
              type="button"
              onClick={toggleMode}
              className="ml-1.5 font-semibold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer focus:outline-none"
            >
              {isRegisterMode ? 'Faça login' : 'Cadastre-se'}
            </button>
          </p>
        </div>
      </div>

      {/* Modal de Esqueci Minha Senha */}
      <ForgotPasswordModal
        isOpen={isForgotPasswordOpen}
        onClose={() => setIsForgotPasswordOpen(false)}
        initialEmail={watch('email') || ''}
      />
    </div>
  );
}
