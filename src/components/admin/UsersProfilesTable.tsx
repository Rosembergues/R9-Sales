import React, { useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Profile, ProfileStatus, UserRole } from '../../types';
import {
  Users,
  Search,
  Shield,
  UserCheck,
  Mail,
  RotateCw,
  Check,
  AlertTriangle,
  Clock,
  UserX,
  Ban,
  CheckCircle2,
  MoreHorizontal,
  Pencil,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';

interface UsersProfilesTableProps {
  /** Mantido por compatibilidade com o painel; a tela não tem mais botão de voltar. */
  onBackToPlanner?: () => void;
}

type StatusFilter = 'active' | 'inactive' | 'rejected' | 'all';

interface ConfirmState {
  title: string;
  text: React.ReactNode;
  confirmLabel: string;
  tone: 'blue' | 'amber' | 'emerald';
  run: () => Promise<void>;
}

const STATUS_INFO: Record<'active' | 'inactive' | 'rejected', { label: string; className: string }> = {
  active: { label: 'Ativo', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  inactive: { label: 'Fora do ranking', className: 'bg-slate-100 text-slate-600 border-slate-200' },
  rejected: { label: 'Bloqueado', className: 'bg-red-50 text-red-600 border-red-200' },
};

const AVATAR_COLORS = ['bg-blue-600', 'bg-emerald-600', 'bg-purple-600', 'bg-amber-600', 'bg-sky-600', 'bg-pink-600', 'bg-indigo-600', 'bg-teal-600'];

const getInitials = (name: string) => {
  const parts = name.trim().split(/[._\s-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
};

const getAvatarBg = (key: string) => {
  let hash = 0;
  for (const ch of key) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
};

const formatDate = (value?: string | null) =>
  value
    ? new Date(value).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—';

const hasAccess = (p: Profile) => p.status === 'active' || p.status === 'inactive' || !p.status;

export const UsersProfilesTable: React.FC<UsersProfilesTableProps> = () => {
  const { allProfiles, pendingProfiles, currentUser, updateUserRole, updateUserStatus, updateUserName, refreshProfiles } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [isSavingName, setIsSavingName] = useState(false);

  const registered = useMemo(
    () => allProfiles.filter(p => p.status !== 'pending').sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [allProfiles],
  );
  const counts = useMemo(() => ({
    active: registered.filter(p => p.status === 'active' || !p.status).length,
    inactive: registered.filter(p => p.status === 'inactive').length,
    rejected: registered.filter(p => p.status === 'rejected').length,
  }), [registered]);
  const adminsWithAccess = useMemo(() => registered.filter(p => p.role === 'admin' && hasAccess(p)).length, [registered]);

  if (currentUser?.role !== 'admin') {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center max-w-md mx-auto my-12 space-y-3">
        <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto">
          <Shield className="w-7 h-7" />
        </div>
        <h3 className="text-base font-bold text-slate-900">Acesso restrito a administradores</h3>
      </div>
    );
  }

  const term = searchTerm.trim().toLowerCase();
  const filtered = registered.filter(p => {
    const status = p.status || 'active';
    if (statusFilter !== 'all' && status !== statusFilter) return false;
    return !term || p.name.toLowerCase().includes(term) || p.email.toLowerCase().includes(term);
  });

  const showToast = (text: string, error = false) => {
    setToast({ text, error });
    setTimeout(() => setToast(null), error ? 6000 : 3500);
  };

  const describeError = (message?: string) => {
    const m = message || '';
    if (/último administrador/i.test(m)) return 'Este é o último administrador. Promova outra pessoa a admin antes.';
    if (/próprio acesso/i.test(m)) return 'Você não pode alterar o seu próprio acesso.';
    if (/Apenas administradores/i.test(m)) return 'Apenas administradores podem fazer essa alteração.';
    return m || 'Não foi possível salvar a alteração.';
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshProfiles();
    setIsRefreshing(false);
  };

  const changeStatus = async (p: Profile, status: ProfileStatus, okText: string) => {
    setBusyId(p.id);
    const result = await updateUserStatus(p.id, status);
    setBusyId(null);
    showToast(result.success ? okText : describeError(result.error), !result.success);
  };

  const changeRole = async (p: Profile, role: UserRole) => {
    setBusyId(p.id);
    const result = await updateUserRole(p.id, role);
    setBusyId(null);
    showToast(
      result.success ? `${p.name} agora é ${role === 'admin' ? 'administrador' : 'consultor'}.` : describeError(result.error),
      !result.success,
    );
  };

  const runConfirm = async () => {
    if (!confirm) return;
    setIsConfirming(true);
    await confirm.run();
    setIsConfirming(false);
    setConfirm(null);
  };

  const saveName = async () => {
    if (!editing) return;
    setIsSavingName(true);
    const result = await updateUserName(editing.id, editing.name);
    setIsSavingName(false);
    if (result.success) {
      setEditing(null);
      showToast('Nome atualizado.');
    } else {
      showToast(describeError(result.error), true);
    }
  };

  const askRole = (p: Profile) => {
    const toAdmin = p.role !== 'admin';
    setConfirm({
      title: toAdmin ? 'Tornar administrador' : 'Tornar consultor',
      text: toAdmin ? (
        <>
          <strong className="text-slate-800">{p.name}</strong> passa a ver e mexer nas telas de administração: equipe, metas,
          importações e campanhas.
        </>
      ) : (
        <>
          <strong className="text-slate-800">{p.name}</strong> perde o acesso às telas de administração e volta a ver o site como
          consultor.
        </>
      ),
      confirmLabel: toAdmin ? 'Tornar admin' : 'Tornar consultor',
      tone: 'blue',
      run: () => changeRole(p, toAdmin ? 'admin' : 'seller'),
    });
  };

  const askBlock = (p: Profile) =>
    setConfirm({
      title: 'Bloquear acesso',
      text: (
        <>
          <strong className="text-slate-800">{p.name}</strong> deixa de entrar no R9 Hub e sai do ranking e das metas. Vendas,
          tarefas e metas passadas ficam guardadas, e você pode autorizar de novo quando quiser.
        </>
      ),
      confirmLabel: 'Bloquear',
      tone: 'amber',
      run: () => changeStatus(p, 'rejected', `Acesso de ${p.name} bloqueado.`),
    });

  const StatCard: React.FC<{ id: StatusFilter; label: string; value: number; hint: string; tone: string }> = ({ id, label, value, hint, tone }) => (
    <button
      type="button"
      onClick={() => setStatusFilter(id)}
      className={`text-left p-4 rounded-2xl border bg-white shadow-2xs transition-all cursor-pointer ${
        statusFilter === id ? `ring-2 ${tone} border-transparent` : 'border-slate-200 hover:border-slate-300'
      }`}
    >
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="text-2xl font-black text-slate-900 font-['Space_Grotesk'] my-0.5">{value}</div>
      <div className="text-[11px] text-slate-400">{hint}</div>
    </button>
  );

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Topo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 font-['Space_Grotesk']">Gerenciar Equipe</h2>
          <p className="text-xs text-slate-500 mt-0.5">Quem acessa o R9 Hub, com qual função e quem entra no ranking.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar nome ou e-mail"
              className="w-56 pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500"
              name="team_search"
            />
          </div>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            title="Atualizar lista"
            className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 cursor-pointer"
          >
            <RotateCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {toast && (
        <div
          className={`p-3 rounded-xl border text-xs font-medium flex items-center justify-between gap-3 ${
            toast.error ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {toast.error ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <Check className="w-4 h-4 shrink-0" />}
            <span>{toast.text}</span>
          </div>
          <button onClick={() => setToast(null)} className="opacity-60 hover:opacity-100 cursor-pointer" title="Fechar">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Resumo (clicar filtra a lista) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard id="active" label="Ativos" value={counts.active} hint="Acessam e entram no ranking" tone="ring-emerald-400" />
        <StatCard id="inactive" label="Fora do ranking" value={counts.inactive} hint="Acessam, sem ranking e metas" tone="ring-slate-400" />
        <StatCard id="rejected" label="Bloqueados" value={counts.rejected} hint="Sem acesso ao site" tone="ring-red-300" />
        <a
          href="#pending-approvals"
          className={`p-4 rounded-2xl border shadow-2xs ${pendingProfiles.length ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200'}`}
        >
          <div className="text-xs font-medium text-slate-500">Aguardando autorização</div>
          <div className={`text-2xl font-black font-['Space_Grotesk'] my-0.5 ${pendingProfiles.length ? 'text-amber-700' : 'text-slate-900'}`}>
            {pendingProfiles.length}
          </div>
          <div className="text-[11px] text-slate-400">Novos cadastros</div>
        </a>
      </div>

      {/* Autorização de acesso */}
      {pendingProfiles.length > 0 && (
        <div id="pending-approvals" className="rounded-2xl border bg-amber-50/40 border-amber-200 shadow-2xs overflow-hidden">
          <div className="px-4 sm:px-5 py-3 flex items-center gap-2.5 border-b border-amber-100">
            <Clock className="w-4 h-4 text-amber-700" />
            <h3 className="text-sm font-bold text-slate-900">Aguardando autorização ({pendingProfiles.length})</h3>
            <span className="text-[11px] text-slate-500 hidden sm:inline">· só acessam o R9 Hub depois de autorizados</span>
          </div>
          <div className="divide-y divide-amber-100">
            {pendingProfiles.map(p => (
              <div key={p.id} className="py-3 px-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0 ${getAvatarBg(p.id)}`}>
                    {getInitials(p.name)}
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 text-sm truncate">{p.name}</div>
                    <div className="text-xs text-slate-500 truncate">{p.email} · cadastro em {formatDate(p.created_at)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    onClick={() => changeStatus(p, 'rejected', `Cadastro de ${p.name} recusado.`)}
                    disabled={busyId === p.id}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 text-red-600 bg-white border border-red-200 hover:bg-red-50 cursor-pointer disabled:opacity-50"
                  >
                    <UserX className="w-3.5 h-3.5" /> Recusar
                  </button>
                  <button
                    onClick={() => changeStatus(p, 'active', `Acesso de ${p.name} autorizado.`)}
                    disabled={busyId === p.id}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 text-white bg-emerald-600 hover:bg-emerald-700 cursor-pointer disabled:opacity-50"
                  >
                    <UserCheck className="w-3.5 h-3.5" /> {busyId === p.id ? 'Salvando...' : 'Autorizar'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lista */}
      <div className="rounded-2xl bg-white border border-slate-200 shadow-2xs">
        <div className="px-4 sm:px-5 py-3 flex items-center justify-between border-b border-slate-100">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            {{ all: 'Todos', active: 'Ativos', inactive: 'Fora do ranking', rejected: 'Bloqueados' }[statusFilter]} ({filtered.length})
          </h3>
          {statusFilter !== 'all' && (
            <button onClick={() => setStatusFilter('all')} className="text-xs text-blue-600 hover:underline cursor-pointer">
              Ver todos ({registered.length})
            </button>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="py-10 text-center text-xs text-slate-400">Ninguém encontrado.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map(p => {
              const isSelf = p.id === currentUser?.id;
              const isAdmin = p.role === 'admin';
              const status = (p.status || 'active') as 'active' | 'inactive' | 'rejected';
              const lastAdmin = isAdmin && hasAccess(p) && adminsWithAccess <= 1;
              const info = STATUS_INFO[status] || STATUS_INFO.active;

              return (
                <div key={p.id} className="py-3 px-4 sm:px-5 flex items-center justify-between gap-3 hover:bg-slate-50/60">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0 ${getAvatarBg(p.id)} ${status === 'rejected' ? 'opacity-40' : ''}`}>
                      {getInitials(p.name)}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 text-sm flex items-center gap-2 flex-wrap">
                        <span className="truncate">{p.name}</span>
                        {isSelf && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200">Você</span>}
                      </div>
                      <div className="text-xs text-slate-400 flex items-center gap-1.5 truncate">
                        <Mail className="w-3 h-3 shrink-0" />
                        <span className="truncate">{p.email}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                        isAdmin ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-white text-slate-600 border-slate-200'
                      }`}
                    >
                      {isAdmin ? <Shield className="w-3 h-3" /> : <Users className="w-3 h-3" />}
                      {isAdmin ? 'Admin' : 'Consultor'}
                    </span>
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border ${info.className}`}>{info.label}</span>

                    <div className="relative">
                      <button
                        onClick={() => setMenuId(menuId === p.id ? null : p.id)}
                        disabled={busyId === p.id}
                        title="Ações"
                        className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 cursor-pointer disabled:opacity-40"
                      >
                        {busyId === p.id ? <RotateCw className="w-4 h-4 animate-spin" /> : <MoreHorizontal className="w-4 h-4" />}
                      </button>

                      {menuId === p.id && (
                        <>
                          <div className="fixed inset-0 z-30" onClick={() => setMenuId(null)} />
                          <div className="absolute right-0 top-full mt-1 z-40 w-60 rounded-xl bg-white border border-slate-200 shadow-lg py-1 text-xs">
                            <MenuItem icon={Pencil} label="Editar nome" onClick={() => { setMenuId(null); setEditing({ id: p.id, name: p.name }); }} />
                            {!isSelf && status !== 'rejected' && (
                              <MenuItem
                                icon={Shield}
                                label={isAdmin ? 'Tornar consultor' : 'Tornar admin'}
                                disabled={lastAdmin}
                                hint={lastAdmin ? 'É o último admin' : undefined}
                                onClick={() => { setMenuId(null); askRole(p); }}
                              />
                            )}
                            {!isSelf && status === 'active' && (
                              <MenuItem
                                icon={TrendingDown}
                                label="Tirar do ranking"
                                hint="Sai do ranking e das metas"
                                onClick={() => { setMenuId(null); changeStatus(p, 'inactive', `${p.name} saiu do ranking e das metas.`); }}
                              />
                            )}
                            {!isSelf && status === 'inactive' && (
                              <MenuItem
                                icon={TrendingUp}
                                label="Voltar ao ranking"
                                onClick={() => { setMenuId(null); changeStatus(p, 'active', `${p.name} voltou ao ranking e às metas.`); }}
                              />
                            )}
                            {!isSelf && status !== 'rejected' && (
                              <MenuItem
                                icon={Ban}
                                label="Bloquear acesso"
                                danger
                                disabled={lastAdmin}
                                hint={lastAdmin ? 'É o último admin' : undefined}
                                onClick={() => { setMenuId(null); askBlock(p); }}
                              />
                            )}
                            {!isSelf && status === 'rejected' && (
                              <MenuItem
                                icon={CheckCircle2}
                                label="Autorizar de novo"
                                onClick={() => { setMenuId(null); changeStatus(p, 'active', `Acesso de ${p.name} autorizado.`); }}
                              />
                            )}
                            {isSelf && (
                              <div className="px-3 py-2 text-[11px] text-slate-400 border-t border-slate-100 mt-1">
                                Sua função e seu acesso só podem ser mudados por outro admin.
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Confirmação */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs" onClick={() => !isConfirming && setConfirm(null)}>
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-sm w-full shadow-xl space-y-4" onClick={e => e.stopPropagation()}>
            <div>
              <h4 className="text-base font-bold text-slate-900">{confirm.title}</h4>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{confirm.text}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setConfirm(null)}
                disabled={isConfirming}
                className="flex-1 px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={runConfirm}
                disabled={isConfirming}
                className={`flex-1 px-4 py-2 text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-60 ${
                  confirm.tone === 'amber' ? 'bg-amber-600 hover:bg-amber-700' : confirm.tone === 'emerald' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-[#0052cc] hover:bg-[#00478f]'
                }`}
              >
                {isConfirming ? 'Salvando...' : confirm.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Editar nome */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs" onClick={() => !isSavingName && setEditing(null)}>
          <form
            className="bg-white border border-slate-200 rounded-2xl p-6 max-w-sm w-full shadow-xl space-y-4"
            onClick={e => e.stopPropagation()}
            onSubmit={e => { e.preventDefault(); saveName(); }}
          >
            <div>
              <h4 className="text-base font-bold text-slate-900">Editar nome</h4>
              <p className="text-xs text-slate-500 mt-1">É o nome que aparece no ranking, no planejamento e nas metas.</p>
            </div>
            <input
              autoFocus
              value={editing.name}
              onChange={e => setEditing({ ...editing, name: e.target.value })}
              onKeyDown={e => e.key === 'Escape' && setEditing(null)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-500"
              name="team_edit_name"
            />
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setEditing(null)} className="flex-1 px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer">
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSavingName || editing.name.trim().length < 2}
                className="flex-1 px-4 py-2 bg-[#0052cc] hover:bg-[#00478f] text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                {isSavingName ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

const MenuItem: React.FC<{
  icon: React.ElementType;
  label: string;
  hint?: string;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
}> = ({ icon: Icon, label, hint, danger, disabled, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`w-full flex items-start gap-2.5 px-3 py-2 text-left transition-colors ${
      disabled ? 'opacity-40 cursor-not-allowed' : danger ? 'text-red-600 hover:bg-red-50 cursor-pointer' : 'text-slate-700 hover:bg-slate-50 cursor-pointer'
    }`}
  >
    <Icon className="w-3.5 h-3.5 mt-0.5 shrink-0" />
    <span>
      <span className="font-semibold block">{label}</span>
      {hint && <span className="text-[10px] text-slate-400">{hint}</span>}
    </span>
  </button>
);
