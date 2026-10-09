import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Lock, CheckCircle2, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface ResetPasswordProps {
  onPasswordResetSuccess: (user: any) => void;
  onCancel?: () => void;
}

export default function ResetPassword({
  onPasswordResetSuccess,
  onCancel,
}: ResetPasswordProps) {
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm();

  const passwordValue = watch('newPassword');

  const handleResetSubmit = async (data: any) => {
    setErrorMessage('');
    setSuccessMessage('');
    setIsLoading(true);

    try {
      // Método do Supabase Auth para atualizar a senha do usuário com a sessão ativa de recuperação
      const { data: userData, error } = await supabase.auth.updateUser({
        password: data.newPassword,
      });

      if (error) {
        if (error.message.includes('Password should be at least')) {
          setErrorMessage('A nova senha deve ter no mínimo 6 caracteres.');
        } else if (error.message.includes('Auth session missing') || error.message.includes('token is expired')) {
          setErrorMessage('O link de recuperação expirou ou é inválido. Solicite um novo link.');
        } else {
          setErrorMessage(error.message || 'Não foi possível redefinir a senha. Tente novamente.');
        }
        return;
      }

      setSuccessMessage('Sua senha foi redefinida com sucesso! Redirecionando...');

      // Pequeno delay para exibir o feedback visual positivo antes de entrar no Planner
      setTimeout(() => {
        if (userData?.user) {
          onPasswordResetSuccess(userData.user);
        } else {
          // Fallback buscando a sessão atual
          supabase.auth.getSession().then(({ data: { session } }) => {
            onPasswordResetSuccess(session?.user || null);
          });
        }
      }, 1200);
    } catch (err: any) {
      setErrorMessage(
        err?.message || 'Ocorreu um erro inesperado ao conectar ao Supabase.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8">
      <div
        id="reset-password-card"
        className="w-full max-w-md bg-white rounded-xl shadow-sm border border-gray-100 p-8"
      >
        <div className="mb-6 text-center flex flex-col items-center">
          <div className="w-14 h-14 bg-gradient-to-br from-[#0056b3] to-[#003d7a] rounded-2xl flex items-center justify-center shadow-md shadow-blue-900/15 mb-4 select-none">
            <Lock className="w-7 h-7 text-white stroke-[2.2]" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
            Redefinir Senha
          </h1>
          <p className="text-sm text-gray-500 mt-2">
            Crie uma nova senha de acesso para sua conta
          </p>
        </div>

        {/* Mensagem de sucesso */}
        {successMessage && (
          <div
            id="reset-success-message"
            className="mb-5 p-3.5 text-xs leading-relaxed text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2.5"
            role="status"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Mensagem de erro */}
        {errorMessage && (
          <div
            id="reset-error-message"
            className="mb-5 p-3.5 text-xs leading-relaxed text-red-700 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2.5"
            role="alert"
          >
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form
          onSubmit={handleSubmit(handleResetSubmit)}
          noValidate
          className="space-y-4"
        >
          {/* Campo Nova Senha */}
          <div>
            <label
              htmlFor="newPassword"
              className="block text-sm font-medium text-gray-700 mb-1.5"
            >
              Nova Senha
            </label>
            <div className="relative">
              <input
                id="newPassword"
                type={showPassword ? 'text' : 'password'}
                placeholder="No mínimo 6 caracteres"
                autoComplete="new-password"
                className={`w-full px-3.5 py-2.5 pr-10 text-sm bg-white rounded-lg border transition-colors outline-none focus:ring-2 focus:ring-blue-500/20 ${
                  errors.newPassword
                    ? 'border-red-400 focus:border-red-500'
                    : 'border-gray-300 focus:border-blue-600'
                }`}
                {...register('newPassword', {
                  required: 'O campo Nova Senha é obrigatório.',
                  minLength: {
                    value: 6,
                    message: 'A senha deve conter no mínimo 6 caracteres.',
                  },
                })}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                title={showPassword ? 'Ocultar senha' : 'Exibir senha'}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            {errors.newPassword && (
              <span className="text-xs text-red-600 mt-1.5 block">
                {errors.newPassword.message as string}
              </span>
            )}
          </div>

          {/* Campo Confirmar Nova Senha */}
          <div>
            <label
              htmlFor="confirmNewPassword"
              className="block text-sm font-medium text-gray-700 mb-1.5"
            >
              Confirmar Nova Senha
            </label>
            <div className="relative">
              <input
                id="confirmNewPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Repita a nova senha"
                autoComplete="new-password"
                className={`w-full px-3.5 py-2.5 pr-10 text-sm bg-white rounded-lg border transition-colors outline-none focus:ring-2 focus:ring-blue-500/20 ${
                  errors.confirmNewPassword
                    ? 'border-red-400 focus:border-red-500'
                    : 'border-gray-300 focus:border-blue-600'
                }`}
                {...register('confirmNewPassword', {
                  required: 'Confirme a sua nova senha.',
                  validate: (val) =>
                    val === passwordValue || 'As senhas não coincidem.',
                })}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                title={showConfirmPassword ? 'Ocultar senha' : 'Exibir senha'}
              >
                {showConfirmPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            {errors.confirmNewPassword && (
              <span className="text-xs text-red-600 mt-1.5 block">
                {errors.confirmNewPassword.message as string}
              </span>
            )}
          </div>

          <button
            id="submit-reset-password-button"
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 py-2.5 px-4 text-sm font-medium rounded-lg text-white bg-institucional hover:opacity-95 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer"
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <svg
                  className="animate-spin h-4 w-4 text-white"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                <span>Salvando nova senha...</span>
              </div>
            ) : (
              'Salvar Nova Senha'
            )}
          </button>
        </form>

        {onCancel && (
          <div className="mt-6 pt-5 border-t border-gray-100 text-center">
            <button
              type="button"
              onClick={onCancel}
              className="text-sm font-semibold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer focus:outline-none"
            >
              Voltar para o login
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
