import React, { useState } from 'react';
import Login from '../Login';
import Register from '../Register';

export const AuthPage: React.FC = () => {
  const [isSignUp, setIsSignUp] = useState(false);

  if (isSignUp) {
    return <Register onSwitchToLogin={() => setIsSignUp(false)} />;
  }

  return <Login onSwitchToSignUp={() => setIsSignUp(true)} />;
};

export default AuthPage;
