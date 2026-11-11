import React, { useState } from 'react';
import { Clock, LogOut, RotateCw, ShieldX } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

/**
 * Exibida para quem está logado mas ainda não foi autorizado (ou teve o acesso recusado).
 * Os dados já ficam bloqueados no banco (RLS); esta tela só explica o que está acontecendo.
 */
export const PendingApprovalPage: React.FC = () => {
  const { currentUser, signOut, reloadCurrentUser } = useAuth();
  const [checking, setChecking] = useState(false);
  const [checkedOnce, setCheckedOnce] = useState(false);
  const rejected = currentUser?.status === 'rejected';

  const handleCheck = async () => {
    setChecking(true);
    try {
      await reloadCurrentUser();
    } finally {
      setChecking(false);
      setCheckedOnce(true);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center space-y-5">
        <div className={`w-14 h-14 rounded-2xl mx-auto flex items-center justify-center ${rejected ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
          {rejected ? <ShieldX className="w-7 h-7" /> : <Clock className="w-7 h-7" />}
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-bold text-gray-900">
            {rejected ? 'Acesso não autorizado' : 'Aguardando autorização'}
          </h1>
          <p className="text-sm text-gray-500">
            {rejected
              ? 'Seu acesso ao R9 Hub não foi autorizado ou foi revogado. Se acha que é um engano, fale com um administrador.'
              : 'Seu cadastro foi recebido. Um administrador do R9 Hub precisa liberar o seu acesso antes de você entrar.'}
          </p>
          {currentUser?.email && (
            <p className="text-xs text-gray-400">Conta: <b className="text-gray-600">{currentUser.email}</b></p>
          )}
        </div>

        {!rejected && checkedOnce && !checking && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
            Ainda não foi autorizado. Tente novamente mais tarde.
          </p>
        )}

        <div className="flex flex-col gap-2">
          {!rejected && (
            <button
              onClick={handleCheck}
              disabled={checking}
              className="w-full py-2.5 px-4 text-sm font-semibold rounded-lg text-white bg-[#00478f] hover:bg-[#003c7d] disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
            >
              <RotateCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
              Verificar autorização
            </button>
          )}
          <button
            onClick={() => signOut()}
            className="w-full py-2.5 px-4 text-sm font-semibold rounded-lg text-gray-600 hover:bg-gray-100 flex items-center justify-center gap-2 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      </div>
    </div>
  );
};
