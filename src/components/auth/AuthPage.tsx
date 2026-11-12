import React, { useState } from 'react';
import Login from './Login';
import Register from './Register';
import { ForgotPassword } from './ForgotPassword';

/** Entrada do site: login, cadastro ou "esqueci minha senha". */
export const AuthPage: React.FC = () => {
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login');

  if (mode === 'signup') return <Register onSwitchToLogin={() => setMode('login')} />;
  if (mode === 'forgot') return <ForgotPassword onBackToLogin={() => setMode('login')} />;
  return <Login onSwitchToSignUp={() => setMode('signup')} onForgotPassword={() => setMode('forgot')} />;
};

export default AuthPage;
