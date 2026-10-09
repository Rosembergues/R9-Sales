import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Users,
  Shield,
  ShieldCheck,
  UserCheck,
  Search,
  RefreshCw,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Mail,
  User,
  Filter,
  Sparkles,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { userService, UserProfile } from '../services/userService.ts';
import { TeamMember } from '../types.ts';

interface TeamManagementViewProps {
  currentUserEmail?: string;
  userRole?: 'admin' | 'member';
  isAdmin?: boolean;
  onBackToPlanner: () => void;
  onProfileUpdated?: (updatedProfiles: UserProfile[]) => void;
}

export default function TeamManagementView({
  currentUserEmail,
  userRole = 'member',
  isAdmin = false,
  onBackToPlanner,
  onProfileUpdated,
}: TeamManagementViewProps) {
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'membro'>('all');
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  const showNotification = (
    message: string,
    type: 'success' | 'error' | 'info' = 'success'
  ) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  // Carregar perfis estritamente da tabela 'perfis'
  const loadProfiles = useCallback(
    async (isInitial = false) => {
      if (isInitial) setIsLoading(true);
      else setIsRefreshing(true);

      try {
        const { data, error } = await userService.fetchProfiles();

        if (error) {
          showNotification('Erro ao carregar tabela de perfis do Supabase.', 'error');
          setProfiles([]);
          onProfileUpdated?.([]);
        } else {
          setProfiles(data || []);
          onProfileUpdated?.(data || []);
        }
      } catch {
        showNotification('Erro ao conectar ao Supabase.', 'error');
        setProfiles([]);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [onProfileUpdated]
  );

  useEffect(() => {
    loadProfiles(true);

    // Canal Realtime do Supabase para alterações na tabela perfis
    const channel = supabase
      .channel('perfis-team-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
        },
        () => {
          loadProfiles(false);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadProfiles]);

  // Alterar Função / Cargo do Usuário no Supabase (Estritamente permitido apenas para Administradores)
  const handleRoleChange = async (userId: string, newRole: 'admin' | 'membro') => {
    if (!isAdmin) {
      showNotification('Apenas administradores têm permissão para alterar funções.', 'error');
      return;
    }

    const userToUpdate = profiles.find((p) => p.id === userId);
    if (!userToUpdate) return;
    if (userToUpdate.funcao === newRole) return;

    setUpdatingUserId(userId);

    // Atualização otimista local
    const updatedList = profiles.map((p) =>
      p.id === userId ? { ...p, funcao: newRole } : p
    );
    setProfiles(updatedList);
    onProfileUpdated?.(updatedList);

    // Chamada real ao Supabase
    const { error } = await userService.updateUserRole(userId, newRole);
    setUpdatingUserId(null);

    if (error) {
      showNotification(`Erro ao atualizar perfil no Supabase: ${error.message}`, 'error');
      // Reverte se falhar
      loadProfiles(false);
    } else {
      const roleLabel = newRole === 'admin' ? 'Administrador' : 'Membro';
      showNotification(
        `Função de ${userToUpdate.nome} atualizada para "${roleLabel}" no Supabase com sucesso.`,
        'success'
      );
    }
  };

  // Se o usuário não for administrador, bloqueia a exibição da tela
  if (!isAdmin) {
    return (
      <div className="flex-1 min-h-0 bg-[#f8f9fa] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl border border-zinc-200 shadow-sm p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-zinc-900">Acesso Restrito a Administradores</h2>
          <p className="text-xs text-zinc-500 leading-relaxed">
            Esta tela de gerenciamento de equipe e controle de papéis é exclusiva para administradores validados na tabela <code className="font-mono bg-zinc-100 px-1 py-0.5 rounded">profiles</code> do R9 Sales.
          </p>
          <button
            type="button"
            onClick={onBackToPlanner}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            Voltar ao Planner
          </button>
        </div>
      </div>
    );
  }

  // Filtragem e Métricas
  const filteredProfiles = useMemo(() => {
    return profiles.filter((profile) => {
      const matchesSearch =
        profile.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        profile.email.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesRole =
        roleFilter === 'all' || profile.funcao === roleFilter;

      return matchesSearch && matchesRole;
    });
  }, [profiles, searchTerm, roleFilter]);

  const totalUsers = profiles.length;
  const adminCount = profiles.filter((p) => p.funcao === 'admin').length;
  const memberCount = profiles.filter((p) => p.funcao === 'membro').length;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-[#f8f9fa] flex flex-col">
      {/* Notificação Toast */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg border text-xs font-medium flex items-center gap-2.5 transition-all animate-in fade-in slide-in-from-top-2 duration-200 ${
            notification.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : notification.type === 'error'
              ? 'bg-rose-50 text-rose-900 border-rose-200'
              : 'bg-blue-50 text-blue-900 border-blue-200'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Cabeçalho da Tela de Gestão de Equipe */}
      <div className="bg-white border-b border-zinc-200/80 px-6 py-5 shrink-0">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              id="back-to-planner-button"
              type="button"
              onClick={onBackToPlanner}
              className="p-2 rounded-lg text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors cursor-pointer border border-zinc-200"
              title="Voltar ao Planner"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
                  <Users className="w-4 h-4" />
                </div>
                <h1 className="text-lg font-bold text-zinc-900 tracking-tight">
                  Gerenciamento de Equipe
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                  Exclusivo Administrador
                </span>
              </div>
              <p className="text-xs text-zinc-500 mt-1">
                Controle de acessos, permissões e funções dos membros vinculados à tabela <code className="font-mono text-zinc-700 bg-zinc-100 px-1 py-0.5 rounded">profiles</code> do R9 Sales.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              id="refresh-team-button"
              type="button"
              onClick={() => loadProfiles(false)}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-700 bg-white hover:bg-zinc-50 border border-zinc-200 transition-colors shadow-2xs cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-zinc-500 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
              <span>{isRefreshing ? 'Atualizando...' : 'Atualizar Lista'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Conteúdo Principal com Cards e Tabela */}
      <div className="flex-1 max-w-6xl w-full mx-auto p-6 space-y-6">
        {/* Cards de Métricas e Resumo de Permissões */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 bg-white rounded-xl border border-zinc-200/80 shadow-2xs flex items-center justify-between">
            <div>
              <span className="text-xs font-medium text-zinc-500">Total de Usuários</span>
              <p className="text-2xl font-bold text-zinc-900 mt-1">{totalUsers}</p>
              <span className="text-[11px] text-zinc-400">Contas cadastradas no sistema</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-zinc-50 border border-zinc-200 flex items-center justify-center text-zinc-600">
              <Users className="w-5 h-5" />
            </div>
          </div>

          <div className="p-4 bg-gradient-to-br from-blue-50/60 to-indigo-50/40 rounded-xl border border-blue-100 shadow-2xs flex items-center justify-between">
            <div>
              <span className="text-xs font-medium text-blue-800">Administradores (admin)</span>
              <p className="text-2xl font-bold text-blue-900 mt-1">{adminCount}</p>
              <span className="text-[11px] text-blue-600/80">Acesso irrestrito & Alocação de ações</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-100/80 border border-blue-200 flex items-center justify-center text-blue-700">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>

          <div className="p-4 bg-gradient-to-br from-emerald-50/60 to-teal-50/40 rounded-xl border border-emerald-100 shadow-2xs flex items-center justify-between">
            <div>
              <span className="text-xs font-medium text-emerald-800">Membros da Equipe (membro)</span>
              <p className="text-2xl font-bold text-emerald-900 mt-1">{memberCount}</p>
              <span className="text-[11px] text-emerald-600/80">Foco em execução e conclusão</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-100/80 border border-emerald-200 flex items-center justify-center text-emerald-700">
              <UserCheck className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Barra de Filtros e Busca */}
        <div className="bg-white p-4 rounded-xl border border-zinc-200/80 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="team-search-input"
              type="text"
              placeholder="Buscar por nome ou e-mail..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 text-zinc-800 transition-all placeholder-zinc-400"
            />
          </div>

          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            <span className="text-xs text-zinc-500 font-medium flex items-center gap-1 mr-1">
              <Filter className="w-3.5 h-3.5" />
              Função:
            </span>
            <div className="p-1 bg-zinc-100 rounded-lg flex items-center gap-1">
              <button
                type="button"
                onClick={() => setRoleFilter('all')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  roleFilter === 'all'
                    ? 'bg-white text-zinc-900 shadow-2xs font-semibold'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                Todos ({profiles.length})
              </button>
              <button
                type="button"
                onClick={() => setRoleFilter('admin')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  roleFilter === 'admin'
                    ? 'bg-white text-blue-900 shadow-2xs font-semibold'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                Admins ({adminCount})
              </button>
              <button
                type="button"
                onClick={() => setRoleFilter('membro')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  roleFilter === 'membro'
                    ? 'bg-white text-emerald-900 shadow-2xs font-semibold'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                Membros ({memberCount})
              </button>
            </div>
          </div>
        </div>

        {/* Tabela de Usuários com Seletores de Cargo em Tempo Real */}
        <div className="bg-white rounded-xl border border-zinc-200/80 shadow-2xs overflow-hidden">
          <div className="px-5 py-3.5 border-b border-zinc-200/70 bg-zinc-50/50 flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-800 uppercase tracking-wider">
              Usuários Registrados ({filteredProfiles.length})
            </span>
            <span className="text-[11px] text-zinc-500">
              Clique para promover a Administrador ou rebaixar a Membro
            </span>
          </div>

          {isLoading ? (
            <div className="p-12 text-center text-zinc-500 flex flex-col items-center justify-center">
              <RefreshCw className="w-6 h-6 animate-spin text-blue-600 mb-2" />
              <p className="text-xs font-medium">Buscando perfis no Supabase...</p>
            </div>
          ) : filteredProfiles.length === 0 ? (
            <div className="p-12 text-center text-zinc-500">
              <User className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
              <p className="text-xs font-medium text-zinc-700">Nenhum usuário encontrado</p>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Tente ajustar o termo de pesquisa ou o filtro de função.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-100 overflow-x-auto">
              {filteredProfiles.map((user) => {
                const isCurrentUser = currentUserEmail && user.email.toLowerCase() === currentUserEmail.toLowerCase();
                const isUpdating = updatingUserId === user.id;

                return (
                  <div
                    key={user.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-zinc-50/70 transition-colors"
                  >
                    {/* Informações do Usuário (Avatar, Nome, E-mail) */}
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold shrink-0 shadow-2xs ${user.avatarColor}`}
                      >
                        {user.initials}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold text-zinc-900 truncate">
                            {user.nome}
                          </p>
                          {isCurrentUser && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 border border-blue-200 shrink-0">
                              Você
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-[11px] text-zinc-500 mt-0.5 truncate">
                          <Mail className="w-3 h-3 text-zinc-400 shrink-0" />
                          <span className="truncate">{user.email || 'Sem e-mail cadastrado'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Controle de Permissões: Seletor / Botões de Promoção / Rebaixamento */}
                    <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
                      {/* Badge da Função Atual */}
                      <div className="hidden md:flex items-center gap-1 text-[11px] font-medium">
                        {user.funcao === 'admin' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200">
                            <ShieldCheck className="w-3 h-3 text-blue-600" />
                            Administrador
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <UserCheck className="w-3 h-3 text-emerald-600" />
                            Membro
                          </span>
                        )}
                      </div>

                      {/* Botões de Alternância Rápida de Cargo com Atualização em Tempo Real no Supabase */}
                      <div className="flex items-center p-1 bg-zinc-100 rounded-lg border border-zinc-200/80">
                        <button
                          type="button"
                          disabled={isUpdating}
                          onClick={() => handleRoleChange(user.id, 'admin')}
                          className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
                            user.funcao === 'admin'
                              ? 'bg-blue-600 text-white shadow-2xs font-semibold'
                              : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/50'
                          }`}
                          title="Definir como Administrador (acesso completo a fila e agendamento)"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Admin</span>
                        </button>

                        <button
                          type="button"
                          disabled={isUpdating}
                          onClick={() => handleRoleChange(user.id, 'membro')}
                          className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
                            user.funcao === 'membro'
                              ? 'bg-emerald-600 text-white shadow-2xs font-semibold'
                              : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/50'
                          }`}
                          title="Definir como Membro (foco em tarefas atribuídas)"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>Membro</span>
                        </button>
                      </div>

                      {isUpdating && (
                        <RefreshCw className="w-4 h-4 text-blue-600 animate-spin shrink-0" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Guia Informativo de Permissões */}
        <div className="p-4 bg-white rounded-xl border border-zinc-200/80 shadow-2xs text-xs space-y-2">
          <div className="flex items-center gap-2 font-bold text-zinc-900">
            <Sparkles className="w-4 h-4 text-blue-600" />
            <span>Diretrizes de Permissões no Planner</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-zinc-600 text-[11px] pt-1">
            <div className="p-2.5 rounded-lg bg-blue-50/40 border border-blue-100">
              <span className="font-semibold text-blue-900 block mb-1">
                Função Administrador (admin):
              </span>
              Visualização de todos os cards da equipe, acesso completo à Fila de Não Agendadas, alocação de ações via Drag & Drop no calendário, criação/exclusão de tarefas e gerenciamento de perfis.
            </div>
            <div className="p-2.5 rounded-lg bg-emerald-50/40 border border-emerald-100">
              <span className="font-semibold text-emerald-900 block mb-1">
                Função Membro (membro):
              </span>
              Visualização focada no painel pessoal de tarefas, filtros rápidos ("Meu Dia", "Minhas Tarefas", "Atrasadas"), preenchimento de campos customizados e conclusão de ações diárias.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
