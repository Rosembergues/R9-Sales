import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types';
import { CreateUserModal } from './CreateUserModal';
import { 
  Users, 
  Search, 
  Shield, 
  ShieldCheck, 
  UserCheck, 
  Filter, 
  Mail, 
  RotateCw,
  ArrowLeft,
  ChevronLeft,
  LogOut,
  Check,
  User,
  UserPlus,
  Trash2,
  AlertTriangle
} from 'lucide-react';

interface UsersProfilesTableProps {
  onBackToPlanner?: () => void;
}

export const UsersProfilesTable: React.FC<UsersProfilesTableProps> = ({ onBackToPlanner }) => {
  const { profiles, currentUser, updateUserRole, refreshProfiles, deleteUser, resetToSingleUser, signOut } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'seller'>('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [userToDelete, setUserToDelete] = useState<{ id: string; name: string } | null>(null);

  const isAdmin = currentUser?.role === 'admin';

  // Active view simulation role
  const [viewMode, setViewMode] = useState<'admin' | 'seller'>(
    currentUser?.role === 'admin' ? 'admin' : 'seller'
  );

  // Non-admin guard
  if (!isAdmin) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center max-w-md mx-auto my-12 space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto">
          <Shield className="w-7 h-7" />
        </div>
        <h3 className="text-base font-bold text-slate-900">Acesso Restrito a Administradores</h3>
        <p className="text-xs text-slate-500">
          Esta tela é restrita a administradores. Seu usuário atual possui cargo de Membro/Vendedor.
        </p>
        <button
          onClick={onBackToPlanner}
          className="px-5 py-2.5 bg-[#0052cc] hover:bg-[#00478f] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
        >
          Voltar ao Painel
        </button>
      </div>
    );
  }

  const adminCount = profiles.filter(p => p.role === 'admin').length;
  const memberCount = profiles.filter(p => p.role === 'seller').length;

  // Filter profiles
  const filteredProfiles = profiles.filter(p => {
    const matchesSearch = 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || p.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshProfiles();
    setTimeout(() => {
      setIsRefreshing(false);
      setToastMessage('Lista de usuários atualizada com sucesso!');
      setTimeout(() => setToastMessage(null), 3000);
    }, 400);
  };

  const handleRoleChange = async (userId: string, newRole: UserRole, userName: string) => {
    setUpdatingId(userId);
    const result = await updateUserRole(userId, newRole);
    setUpdatingId(null);

    if (result.success) {
      setToastMessage(`Função de ${userName} atualizada para ${newRole === 'admin' ? 'Administrador' : 'Membro'}.`);
      setTimeout(() => setToastMessage(null), 3500);
    } else {
      setToastMessage(result.error || 'Erro ao alterar função.');
      setTimeout(() => setToastMessage(null), 4000);
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    setDeletingId(userId);
    const result = await deleteUser(userId);
    setDeletingId(null);
    setUserToDelete(null);

    if (result.success) {
      setToastMessage(`Usuário ${userName} foi removido com sucesso.`);
      setTimeout(() => setToastMessage(null), 3500);
    } else {
      setToastMessage(result.error || 'Erro ao remover usuário.');
      setTimeout(() => setToastMessage(null), 4000);
    }
  };

  const handleResetToSingleUser = async () => {
    await resetToSingleUser();
    setShowResetConfirm(false);
    setToastMessage('Todos os outros usuários foram removidos. Apenas sua conta permanece ativa.');
    setTimeout(() => setToastMessage(null), 4000);
  };

  const getInitials = (name: string) => {
    const parts = name.split(/[._\s-]+/);
    if (parts.length >= 2 && parts[0] && parts[1]) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const getAvatarBg = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.startsWith('da')) return 'bg-blue-600';
    if (lower.startsWith('gu')) return 'bg-emerald-600';
    if (lower.startsWith('ka')) return 'bg-purple-600';
    if (lower.startsWith('ma')) return 'bg-amber-600';
    if (lower.startsWith('lu')) return 'bg-sky-600';
    if (lower.startsWith('be')) return 'bg-pink-600';
    if (lower.startsWith('br')) return 'bg-indigo-600';
    if (lower.startsWith('ca')) return 'bg-teal-600';
    return 'bg-blue-600';
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Top Header Bar matching screenshot */}
      <div className="flex items-center justify-between py-2 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToPlanner}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-blue-200 bg-white hover:bg-blue-50 text-blue-600 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Voltar ao Planner</span>
          </button>
          <span className="text-sm font-semibold text-slate-700 hidden sm:inline">
            Gerenciamento de Equipe & Permissões
          </span>
        </div>

        <div className="flex items-center gap-3">
          {isAdmin && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                VISUALIZAR:
              </span>
              <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200">
                <button
                  onClick={() => setViewMode('admin')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                    viewMode === 'admin'
                      ? 'bg-blue-50 text-blue-600 border border-blue-200 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Shield className="w-3.5 h-3.5 fill-current" />
                  <span>Admin</span>
                </button>
                <button
                  onClick={() => setViewMode('seller')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                    viewMode === 'seller'
                      ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Membro</span>
                </button>
              </div>
            </div>
          )}

          <button
            onClick={() => signOut()}
            title="Sair da conta"
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs font-medium flex items-center justify-between shadow-2xs animate-in fade-in slide-in-from-top-1">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-blue-600 shrink-0" />
            <span>{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="text-slate-500 hover:text-slate-800 text-xs font-bold">
            ×
          </button>
        </div>
      )}

      {/* Title section with back button and action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <button
            onClick={onBackToPlanner}
            title="Voltar"
            className="w-9 h-9 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-600 shadow-2xs transition-colors shrink-0 mt-0.5 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white shrink-0">
                <Users className="w-4 h-4" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 font-['Space_Grotesk']">
                Gerenciamento de Equipe
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200 text-xs font-semibold">
                Exclusivo Administrador
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Controle de acessos, permissões e funções dos membros vinculados à tabela <code className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200 font-mono text-[11px]">perfis</code> no Supabase.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
          <button
            onClick={() => setIsCreateUserOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Cadastrar Usuário</span>
          </button>

          {profiles.length > 1 && (
            <button
              onClick={() => setShowResetConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
              title="Excluir todos os outros usuários e manter apenas a minha conta"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-600" />
              <span>Deixar Só Eu</span>
            </button>
          )}

          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
          >
            <RotateCw className={`w-3.5 h-3.5 text-slate-500 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Atualizar</span>
          </button>
        </div>
      </div>

      {/* 3 Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Total de Usuários */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-start justify-between">
          <div>
            <span className="text-xs font-medium text-slate-500">Total de Usuários</span>
            <div className="text-3xl font-black text-slate-900 font-['Space_Grotesk'] my-1">
              {profiles.length}
            </div>
            <span className="text-xs text-slate-400">Contas cadastradas no sistema</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-500">
            <Users className="w-5 h-5" />
          </div>
        </div>

        {/* Card 2: Administradores */}
        <div className="p-5 rounded-2xl bg-blue-50/20 border border-blue-200/80 shadow-2xs flex items-start justify-between">
          <div>
            <span className="text-xs font-medium text-blue-700">Administradores (admin)</span>
            <div className="text-3xl font-black text-blue-600 font-['Space_Grotesk'] my-1">
              {adminCount}
            </div>
            <span className="text-xs text-blue-600/80">Acesso irrestrito & Alocação de ações</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200/60 flex items-center justify-center text-blue-600">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>

        {/* Card 3: Membros da Equipe */}
        <div className="p-5 rounded-2xl bg-emerald-50/20 border border-emerald-200/80 shadow-2xs flex items-start justify-between">
          <div>
            <span className="text-xs font-medium text-emerald-700">Membros da Equipe (membro)</span>
            <div className="text-3xl font-black text-emerald-600 font-['Space_Grotesk'] my-1">
              {memberCount}
            </div>
            <span className="text-xs text-emerald-600/80">Foco em execução e conclusão</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200/60 flex items-center justify-center text-emerald-600">
            <UserCheck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nome ou e-mail..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50/60 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs text-slate-500 font-medium">Função:</span>
          <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200/70 gap-1">
            <button
              onClick={() => setRoleFilter('all')}
              className={`px-3 py-1 rounded-lg text-xs transition-all cursor-pointer ${
                roleFilter === 'all'
                  ? 'bg-white text-slate-900 font-bold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 font-medium'
              }`}
            >
              Todos ({profiles.length})
            </button>
            <button
              onClick={() => setRoleFilter('admin')}
              className={`px-3 py-1 rounded-lg text-xs transition-all cursor-pointer ${
                roleFilter === 'admin'
                  ? 'bg-white text-slate-900 font-bold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 font-medium'
              }`}
            >
              Admins ({adminCount})
            </button>
            <button
              onClick={() => setRoleFilter('seller')}
              className={`px-3 py-1 rounded-lg text-xs transition-all cursor-pointer ${
                roleFilter === 'seller'
                  ? 'bg-white text-slate-900 font-bold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 font-medium'
              }`}
            >
              Membros ({memberCount})
            </button>
          </div>
        </div>
      </div>

      {/* Users List Section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            USUÁRIOS REGISTRADOS ({filteredProfiles.length})
          </h3>
          <span className="text-xs text-slate-400 hidden sm:inline">
            Clique para promover a Administrador ou rebaixar a Membro
          </span>
        </div>

        <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-2xs divide-y divide-slate-100">
          {filteredProfiles.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              Nenhum usuário encontrado com os filtros aplicados.
            </div>
          ) : (
            filteredProfiles.map((profile) => {
              const isCurrent = profile.id === currentUser?.id || profile.email === currentUser?.email;
              const isAdmin = profile.role === 'admin';

              return (
                <div 
                  key={profile.id}
                  className="py-3.5 px-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/60 transition-colors"
                >
                  {/* Left: Avatar + Name + Email */}
                  <div className="flex items-center gap-3.5">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-xs uppercase shrink-0 ${getAvatarBg(profile.name)} shadow-2xs`}>
                      {getInitials(profile.name)}
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                        <span>{profile.name}</span>
                        {isCurrent && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200">
                            Você
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        <span>{profile.email}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Role Badge + Toggle Buttons */}
                  <div className="flex items-center gap-3 self-end sm:self-center">
                    {/* Role Badge */}
                    {isAdmin ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-600 border border-blue-200">
                        <Shield className="w-3.5 h-3.5" />
                        Administrador
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-600 border border-emerald-200">
                        <Users className="w-3.5 h-3.5" />
                        Membro
                      </span>
                    )}

                    {/* Action Segmented Toggle: [ Admin | Membro ] */}
                    <div className="inline-flex rounded-xl bg-slate-100 p-0.5 border border-slate-200">
                      <button
                        onClick={() => !isAdmin && handleRoleChange(profile.id, 'admin', profile.name)}
                        disabled={updatingId === profile.id}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                          isAdmin
                            ? 'bg-blue-600 text-white shadow-2xs cursor-default'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 cursor-pointer'
                        }`}
                      >
                        <Shield className="w-3.5 h-3.5" />
                        <span>Admin</span>
                      </button>

                      <button
                        onClick={() => isAdmin && handleRoleChange(profile.id, 'seller', profile.name)}
                        disabled={updatingId === profile.id}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                          !isAdmin
                            ? 'bg-emerald-600 text-white shadow-2xs cursor-default'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 cursor-pointer'
                        }`}
                      >
                        <Users className="w-3.5 h-3.5" />
                        <span>Membro</span>
                      </button>
                    </div>

                    {/* Individual Delete Button (only for other users) */}
                    {profile.id !== currentUser?.id && (
                      <button
                        onClick={() => setUserToDelete({ id: profile.id, name: profile.name })}
                        disabled={deletingId === profile.id}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition-colors cursor-pointer"
                        title={`Remover usuário ${profile.name}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Modal: Cadastrar Novo Usuário */}
      {isCreateUserOpen && (
        <CreateUserModal onClose={() => setIsCreateUserOpen(false)} />
      )}

      {/* Modal: Confirmar exclusão de usuário único */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-sm w-full shadow-xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h4 className="text-base font-bold text-slate-900">Remover Usuário</h4>
              <p className="text-xs text-slate-500 mt-1">
                Tem certeza que deseja excluir o usuário <strong className="text-slate-800">{userToDelete.name}</strong>? Esta ação não pode ser desfeita.
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                className="flex-1 px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleDeleteUser(userToDelete.id, userToDelete.name)}
                disabled={deletingId === userToDelete.id}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
              >
                {deletingId === userToDelete.id ? 'Removendo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirmar Reset Geral (Deixar só eu) */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-md w-full shadow-xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h4 className="text-base font-bold text-slate-900">Limpar outros usuários?</h4>
              <p className="text-xs text-slate-500 mt-1">
                Esta ação removerá todos os outros membros cadastrados e manterá exclusivamente a sua conta de Administrador ativa (<strong className="text-slate-800">{currentUser?.name || 'Daniel Marques'}</strong>).
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleResetToSingleUser}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
              >
                Sim, Limpar e Deixar Só Eu
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
