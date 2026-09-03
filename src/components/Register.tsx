import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

interface RegisterFormInputs {
  name: string;
  email: string;
  role: UserRole;
  password: string;
  confirmPassword: string;
}

interface RegisterProps {
  onSwitchToLogin?: () => void;
}

export default function Register({ onSwitchToLogin }: RegisterProps) {
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { signUp } = useAuth();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors }
  } = useForm<RegisterFormInputs>({
    defaultValues: {
      role: 'seller'
    }
  });

  const passwordValue = watch('password');

  const handleRegister = async (data: RegisterFormInputs) => {
    setErrorMessage('');
    setSuccessMessage('');
    setIsLoading(true);

    try {
      console.log('🚀 [Cadastro] Submetendo novo usuário para Supabase Auth:', {
        email: data.email,
        name: data.name,
        role: data.role
      });

      const result = await signUp({
        name: data.name.trim(),
        email: data.email.trim(),
        password: data.password,
        role: data.role
      });

      if (!result.success) {
        console.error('❌ [Cadastro] Erro retornado no cadastro:', result.error);
        setErrorMessage(result.error || 'Erro ao criar conta no Supabase. Tente novamente.');
      } else {
        console.log('🎉 [Cadastro] Conta criada com sucesso no Supabase!');
        setSuccessMessage(
          'Conta cadastrada com sucesso! Se a confirmação de e-mail estiver ativa no seu projeto Supabase, verifique sua caixa de entrada antes de fazer login.'
        );
      }
    } catch (err: any) {
      console.error('💥 [Cadastro] Erro não tratado durante o cadastro:', err);
      setErrorMessage(err?.message || 'Ocorreu um erro ao conectar ao Supabase.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8">
      <div
        id="register-card"
        className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-8 sm:p-10"
      >
        {/* Logo Badge */}
        <div className="flex justify-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-[#00478f] text-white font-extrabold text-2xl flex items-center justify-center shadow-sm tracking-tight">
            R9
          </div>
        </div>

        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Criar Nova Conta
          </h1>
          <p className="text-sm text-gray-500 mt-2">
            Cadastro direto no ambiente oficial Supabase Auth
          </p>
        </div>

        {/* Success Alert */}
        {successMessage && (
          <div
            id="register-success-message"
            className="mb-5 p-3.5 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-2 text-left"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Cadastro realizado!</p>
              <p className="mt-0.5">{successMessage}</p>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit(handleRegister)} noValidate className="space-y-4">
          {/* Nome Completo */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Nome Completo
            </label>
            <input
              id="name"
              type="text"
              placeholder="Ex: João da Silva"
              autoComplete="name"
              className={`w-full px-3.5 py-2.5 text-sm bg-white rounded-lg border transition-colors outline-none focus:ring-2 focus:ring-[#00478f]/20 ${
                errors.name
                  ? 'border-red-400 focus:border-red-500'
                  : 'border-gray-300 focus:border-[#00478f]'
              }`}
              {...register('name', {
                required: 'O campo Nome Completo é obrigatório.',
                minLength: {
                  value: 3,
                  message: 'O nome deve conter ao menos 3 caracteres.'
                }
              })}
            />
            {errors.name && (
              <span className="text-xs text-red-600 mt-1 block">
                {errors.name.message}
              </span>
            )}
          </div>

          {/* E-mail */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
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
              <span className="text-xs text-red-600 mt-1 block">
                {errors.email.message}
              </span>
            )}
          </div>

          {/* Cargo / Função */}
          <div>
            <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
              Cargo / Função
            </label>
            <select
              id="role"
              className="w-full px-3.5 py-2.5 text-sm bg-white rounded-lg border border-gray-300 focus:border-[#00478f] focus:ring-2 focus:ring-[#00478f]/20 outline-none transition-colors"
              {...register('role')}
            >
              <option value="seller">Consultor de Vendas (seller)</option>
              <option value="admin">Administrador (admin)</option>
            </select>
          </div>

          {/* Senha */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Senha
            </label>
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              autoComplete="new-password"
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
              <span className="text-xs text-red-600 mt-1 block">
                {errors.password.message}
              </span>
            )}
          </div>

          {/* Confirmar Senha */}
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
              Confirmar Senha
            </label>
            <input
              id="confirmPassword"
              type="password"
              placeholder="••••••••"
              autoComplete="new-password"
              className={`w-full px-3.5 py-2.5 text-sm bg-white rounded-lg border transition-colors outline-none focus:ring-2 focus:ring-[#00478f]/20 ${
                errors.confirmPassword
                  ? 'border-red-400 focus:border-red-500'
                  : 'border-gray-300 focus:border-[#00478f]'
              }`}
              {...register('confirmPassword', {
                required: 'Por favor confirme sua senha.',
                validate: (value) =>
                  value === passwordValue || 'As senhas informadas não conferem.'
              })}
            />
            {errors.confirmPassword && (
              <span className="text-xs text-red-600 mt-1 block">
                {errors.confirmPassword.message}
              </span>
            )}
          </div>

          {/* Error message */}
          {errorMessage && (
            <div
              id="register-error-message"
              className="p-3.5 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-left"
              role="alert"
            >
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Submit Button */}
          <button
            id="submit-register-button"
            type="submit"
            disabled={isLoading}
            className="w-full py-3 px-4 text-sm font-semibold rounded-lg text-white bg-[#00478f] hover:bg-[#003c7d] transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer mt-3"
          >
            {isLoading ? 'Cadastrando no Supabase...' : 'Criar Conta'}
          </button>
        </form>

        {/* Footer link to Login */}
        <div className="mt-7 text-center pt-2 border-t border-gray-100">
          <p className="text-sm text-gray-600">
            Já tem uma conta?{' '}
            <button
              id="switch-to-login-btn"
              type="button"
              onClick={onSwitchToLogin}
              className="text-[#00478f] hover:text-[#003366] font-semibold transition-colors cursor-pointer inline-block"
            >
              Faça login
            </button>
          </p>
        </div>

      </div>
    </div>
  );
}
