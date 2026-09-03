import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SalesProvider } from './context/SalesContext';
import { AuthPage } from './components/auth/AuthPage';
import { R9Dashboard } from './components/dashboard/R9Dashboard';

const MainLayout: React.FC = () => {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-2xl bg-[#00478f] text-white flex items-center justify-center font-black text-lg shadow-md animate-pulse">
          R9
        </div>
        <p className="text-xs font-semibold text-gray-500 mt-3 font-['Space_Grotesk']">
          Carregando ambiente R9 Sales...
        </p>
      </div>
    );
  }

  // If not authenticated, display the Login / Register views
  if (!currentUser) {
    return <AuthPage />;
  }

  // Display the main screen layout matching the reference
  return <R9Dashboard />;
};

export default function App() {
  return (
    <AuthProvider>
      <SalesProvider>
        <MainLayout />
      </SalesProvider>
    </AuthProvider>
  );
}
