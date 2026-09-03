import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSales } from '../../context/SalesContext';
import { 
  Calendar, 
  LayoutGrid, 
  ChevronLeft, 
  ChevronRight, 
  ChevronDown,
  Shield, 
  User, 
  LogOut, 
  PanelLeft, 
  Plus, 
  Sun, 
  TrendingUp, 
  Users, 
  Mail, 
  Tag, 
  CheckCircle2, 
  DollarSign, 
  Zap, 
  X, 
  Sparkles,
  Search,
  Filter,
  BarChart3,
  Award,
  Layers,
  ArrowUpRight,
  GraduationCap,
  Wrench,
  FileSpreadsheet,
  Receipt,
  Trophy,
  Crown
} from 'lucide-react';
import { UsersProfilesTable } from '../admin/UsersProfilesTable';
import { CampaignsManager } from '../admin/CampaignsManager';
import { AnalyticsOverview } from '../admin/AnalyticsOverview';
import { LiveTeamLeaderboard } from '../seller/LiveTeamLeaderboard';
import { GoalProgressTracker } from '../seller/GoalProgressTracker';
import { SellerSalesHistory } from '../seller/SellerSalesHistory';
import { ProductSummaryView } from './ProductSummaryView';
import { SalesSpreadsheetTable } from './SalesSpreadsheetTable';
import { NewSaleModal } from '../sales/NewSaleModal';
import { MainProductType, Sale } from '../../types';

export const R9Dashboard: React.FC = () => {
  const { currentUser, signOut } = useAuth();
  const { sales, activeCampaigns, leaderboard } = useSales();

  // Role check
  const isActualAdmin = currentUser?.role === 'admin';

  // Navigation & View States
  const [periodMode, setPeriodMode] = useState<'semana' | 'mes'>('semana');
  const [viewRole, setViewRole] = useState<'admin' | 'membro'>(
    currentUser?.role === 'admin' ? 'admin' : 'membro'
  );
  const [activeTab, setActiveTab] = useState<string>('canvas'); // 'canvas', 'planner', 'fila', 'resumo', 'meu_dia', 'rank_semanal', 'rank_mensal', 'produto_graduacao', 'produto_pos', 'produto_tecnico', 'resumo_semanal', 'equipe'
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [showNewSaleModal, setShowNewSaleModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [initialProductForModal, setInitialProductForModal] = useState<MainProductType>('Graduação');

  // Keep viewRole aligned if user changes
  useEffect(() => {
    if (currentUser?.role !== 'admin') {
      setViewRole('membro');
    } else {
      setViewRole('admin');
    }
  }, [currentUser?.role]);

  // Security guard: Non-admin or member view mode cannot view admin team management
  useEffect(() => {
    if ((!isActualAdmin || viewRole === 'membro') && activeTab === 'equipe') {
      setActiveTab('canvas');
    }
  }, [isActualAdmin, viewRole, activeTab]);

  // Helper to determine product type of a sale
  const getSaleProductType = (sale: Sale): MainProductType => {
    if (sale.custom_data?.main_product) {
      return sale.custom_data.main_product;
    }
    const name = (sale.product_name || '').toLowerCase();
    const mod = (sale.custom_data?.modality || '').toLowerCase();
    const fdi = (sale.custom_data?.fdi_channel || '').toLowerCase();

    if (name.includes('pós') || mod.includes('pós') || fdi.includes('pós')) {
      return 'Pós Graduação';
    }
    if (name.includes('técnico') || mod.includes('técnico') || fdi.includes('técnico')) {
      return 'Curso Técnico';
    }
    return 'Graduação';
  };

  // Computed product counts
  const graduacaoCount = sales.filter(s => getSaleProductType(s) === 'Graduação').length;
  const posCount = sales.filter(s => getSaleProductType(s) === 'Pós Graduação').length;
  const tecnicoCount = sales.filter(s => getSaleProductType(s) === 'Curso Técnico').length;
  const totalSalesCount = sales.length;

  // Computed today's sales count (Boletos do Dia)
  const todayDateObj = new Date();
  const todayFormatted = `${String(todayDateObj.getDate()).padStart(2, '0')}/${String(todayDateObj.getMonth() + 1).padStart(2, '0')}/${todayDateObj.getFullYear()}`;
  const boletosDoDiaCount = sales.filter(s => {
    const saleDate = s.custom_data?.sale_date;
    if (saleDate) {
      return saleDate === todayFormatted;
    }
    const d = new Date(s.created_at);
    const dStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    return dStr === todayFormatted;
  }).length;

  // Format initials and username
  const userName = currentUser?.name || currentUser?.email?.split('@')[0] || 'daniel.marques';
  const userInitials = userName
    .split(/[\s._]+/)
    .map(p => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'DA';

  const userRoleText = currentUser?.role === 'admin' ? 'Administrator' : 'Vendedor';

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col font-sans text-slate-800 selection:bg-[#00478f] selection:text-white">
      
      {/* 1. TOP HEADER BAR */}
      <header className="h-14 bg-white border-b border-gray-200 px-4 flex items-center justify-between sticky top-0 z-30 shadow-xs">
        
        {/* Left: Sidebar Toggle & Brand */}
        <div className="flex items-center gap-3">
          <button
            id="sidebar-toggle-btn"
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
            title="Alternar Barra Lateral"
          >
            <PanelLeft className="w-5 h-5" />
          </button>

          <div 
            onClick={() => setActiveTab('canvas')}
            className="flex items-center gap-2 cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-lg bg-[#00478f] text-white font-black text-sm flex items-center justify-center shadow-xs tracking-tight">
              R9
            </div>
            <span className="text-xl font-bold tracking-tight text-gray-900 font-['Space_Grotesk']">
              sales
            </span>
          </div>
        </div>

        {/* Center: Period selector & Date range */}
        <div className="hidden md:flex items-center gap-3">
          
          {/* Semana / Mês toggle pill */}
          <div className="inline-flex rounded-lg bg-gray-100 p-0.5 border border-gray-200/80 text-xs font-medium">
            <button
              onClick={() => setPeriodMode('semana')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-all cursor-pointer ${
                periodMode === 'semana'
                  ? 'bg-white text-gray-900 shadow-xs font-semibold'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Semana</span>
            </button>
            <button
              onClick={() => setPeriodMode('mes')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-all cursor-pointer ${
                periodMode === 'mes'
                  ? 'bg-white text-gray-900 shadow-xs font-semibold'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Mês</span>
            </button>
          </div>

          {/* Date range navigator pill */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-gray-50 border border-gray-200 text-xs text-gray-700 font-medium shadow-xs">
            <button className="p-0.5 text-gray-400 hover:text-gray-800 rounded transition-colors cursor-pointer">
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="px-1 font-semibold text-gray-900">Hoje</span>
            <button className="p-0.5 text-gray-400 hover:text-gray-800 rounded transition-colors cursor-pointer">
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <span className="text-gray-400">|</span>
            <span className="text-gray-600">30 de Agosto a 5 de Setembro de 2026</span>
          </div>

        </div>

        {/* Right: Role View Selector & Logout */}
        <div className="flex items-center gap-3">
          
          {/* O botão de trocar entre a visão de membro e administrador deve estar disponível apenas para administradores */}
          {isActualAdmin && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider hidden sm:inline">
                VISUALIZAR:
              </span>
              <div className="inline-flex rounded-lg bg-gray-100 p-0.5 border border-gray-200 text-xs">
                <button
                  id="view-mode-admin-btn"
                  onClick={() => setViewRole('admin')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${
                    viewRole === 'admin'
                      ? 'bg-[#0052cc] text-white shadow-xs font-semibold'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>Admin</span>
                </button>
                <button
                  id="view-mode-member-btn"
                  onClick={() => setViewRole('membro')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${
                    viewRole === 'membro'
                      ? 'bg-[#0052cc] text-white shadow-xs font-semibold'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Membro</span>
                </button>
              </div>
            </div>
          )}

          {/* User profile */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 px-2.5 py-1 rounded-lg border border-gray-200 hover:bg-gray-50 text-xs text-gray-700 transition-colors cursor-pointer"
              title="Informações da Conta"
            >
              <div className="w-6 h-6 rounded-full bg-[#00478f] text-white font-bold text-[10px] flex items-center justify-center">
                {userInitials}
              </div>
              <span className="hidden sm:inline font-medium">{userName}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${isActualAdmin ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'}`}>
                {isActualAdmin ? 'Admin' : 'Membro'}
              </span>
              <ChevronDown className="w-3 h-3 text-gray-400" />
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-gray-200 p-2.5 z-50 animate-in fade-in zoom-in-95 duration-100 space-y-2 text-xs">
                <div className="px-2 py-1.5 border-b border-gray-100">
                  <p className="text-[10px] uppercase font-bold text-gray-400">Usuário Conectado</p>
                  <p className="font-bold text-gray-900 text-sm mt-0.5">{userName}</p>
                  <p className="text-[11px] text-gray-500">{currentUser?.email}</p>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <span className="px-2 py-0.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-full font-bold text-[10px]">
                      {isActualAdmin ? 'Administrador Geral' : 'Membro'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <button
            id="logout-btn"
            onClick={() => signOut()}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
            title="Sair da Conta"
          >
            <LogOut className="w-4 h-4" />
          </button>

        </div>

      </header>

      {/* 2. BODY LAYOUT: SIDEBAR + MAIN CANVAS */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* LEFT SIDEBAR */}
        <aside className={`${isSidebarCollapsed ? 'w-0 sm:w-16 overflow-hidden' : 'w-64'} bg-white border-r border-gray-200 flex flex-col justify-between transition-all duration-200 z-20 shrink-0 select-none`}>
          
          <div className="p-3 space-y-4 overflow-y-auto">
            
            {/* User Profile Header */}
            {!isSidebarCollapsed ? (
              <div className="flex items-center justify-between p-1">
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <div className="w-9 h-9 rounded-full bg-[#00478f] text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
                    {userInitials}
                  </div>
                  <div className="truncate">
                    <p className="text-xs font-bold text-gray-900 truncate">
                      {userName}
                    </p>
                    <p className="text-[11px] text-gray-400 truncate">
                      {userRoleText} • R9 Corp
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsSidebarCollapsed(true)}
                  className="text-gray-300 hover:text-gray-600 p-1"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex justify-center py-2">
                <div className="w-9 h-9 rounded-full bg-[#00478f] text-white font-bold text-xs flex items-center justify-center shadow-xs">
                  {userInitials}
                </div>
              </div>
            )}

            {/* Lançar Venda CTA Button */}
            <div>
              <button
                id="btn-lancar-venda"
                onClick={() => setShowNewSaleModal(true)}
                className="w-full py-2.5 px-3 bg-[#0052cc] hover:bg-[#00478f] active:scale-[0.99] text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Lançar Venda</span>
              </button>
            </div>

            {/* Section: VISUALIZAÇÕES RÁPIDAS */}
            {!isSidebarCollapsed && (
              <div className="space-y-1 pt-2">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-2 mb-1">
                  VISUALIZAÇÕES RÁPIDAS
                </p>

                <button
                  id="nav-planilha-vendas"
                  onClick={() => setActiveTab('canvas')}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                    activeTab === 'canvas' || activeTab === 'planilha'
                      ? 'bg-blue-50 text-blue-700 font-semibold shadow-2xs'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Planilha de Vendas</span>
                  </div>
                  <span className="text-[11px] font-bold text-gray-500">{sales.length}</span>
                </button>

                <button
                  id="nav-boletos-do-dia"
                  onClick={() => setActiveTab('boletos_do_dia')}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                    activeTab === 'boletos_do_dia'
                      ? 'bg-blue-50 text-blue-700 font-semibold'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Receipt className="w-3.5 h-3.5 text-blue-600" />
                    <span>Boletos do Dia</span>
                  </div>
                  <span className="text-[11px] font-bold text-gray-500">{boletosDoDiaCount}</span>
                </button>

                <button
                  id="nav-rank-semanal"
                  onClick={() => setActiveTab('rank_semanal')}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                    activeTab === 'rank_semanal'
                      ? 'bg-blue-50 text-blue-700 font-semibold'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Trophy className="w-3.5 h-3.5 text-amber-500" />
                    <span>Rank Semanal</span>
                  </div>
                  <span className="text-[11px] font-bold text-gray-400">{sales.length}</span>
                </button>

                <button
                  id="nav-rank-mensal"
                  onClick={() => setActiveTab('rank_mensal')}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                    activeTab === 'rank_mensal'
                      ? 'bg-blue-50 text-blue-700 font-semibold'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Crown className="w-3.5 h-3.5 text-purple-600" />
                    <span>Rank Mensal</span>
                  </div>
                  <span className="text-[11px] font-bold text-gray-400">{sales.length}</span>
                </button>
              </div>
            )}

            {/* Section: Produtos */}
            {!isSidebarCollapsed && (
              <div className="space-y-1 pt-3 border-t border-gray-100">
                <div className="flex items-center justify-between px-2 mb-1">
                  <p className="text-xs font-semibold text-gray-900">
                    Produtos
                  </p>
                  <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                    {graduacaoCount + posCount + tecnicoCount}
                  </span>
                </div>

                <button
                  id="filter-graduacao"
                  onClick={() => setActiveTab('produto_graduacao')}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                    activeTab === 'produto_graduacao'
                      ? 'bg-blue-50 text-blue-700 font-semibold shadow-2xs'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#0052cc]" />
                    <span className="font-medium">Graduação</span>
                  </div>
                  <span className="text-[11px] font-bold text-gray-500">{graduacaoCount}</span>
                </button>

                <button
                  id="filter-pos-graduacao"
                  onClick={() => setActiveTab('produto_pos')}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                    activeTab === 'produto_pos'
                      ? 'bg-purple-50 text-purple-700 font-semibold shadow-2xs'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-purple-600" />
                    <span className="font-medium">Pós Graduação</span>
                  </div>
                  <span className="text-[11px] font-bold text-gray-500">{posCount}</span>
                </button>

                <button
                  id="filter-curso-tecnico"
                  onClick={() => setActiveTab('produto_tecnico')}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                    activeTab === 'produto_tecnico'
                      ? 'bg-amber-50 text-amber-700 font-semibold shadow-2xs'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    <span className="font-medium">Curso Técnico</span>
                  </div>
                  <span className="text-[11px] font-bold text-gray-500">{tecnicoCount}</span>
                </button>
              </div>
            )}

          </div>

          {/* Bottom Sidebar: ADMINISTRAÇÃO & User Footer */}
          <div className="p-3 border-t border-gray-100 space-y-3">
            {/* A aba de administração deve ser visivel apenas para administradores */}
            {isActualAdmin && viewRole === 'admin' && !isSidebarCollapsed && (
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-2">
                  ADMINISTRAÇÃO
                </p>

                <button
                  id="nav-gerenciar-equipe"
                  onClick={() => setActiveTab('equipe')}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                    activeTab === 'equipe'
                      ? 'bg-blue-50 text-blue-700 font-semibold'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-blue-600" />
                    <span>Gerenciar Equipe</span>
                  </div>
                  <span className="text-[10px] font-medium text-purple-700 bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded">
                    perfis
                  </span>
                </button>
              </div>
            )}

            {/* Bottom mini user bar */}
            {!isSidebarCollapsed ? (
              <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-[#00478f] text-white font-bold text-[10px] flex items-center justify-center">
                    {userInitials}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-800 leading-tight">
                      {userName}
                    </p>
                    <div className="flex items-center gap-1">
                      <span className={`w-1.5 h-1.5 rounded-full ${isActualAdmin ? 'bg-blue-500' : 'bg-emerald-500'}`} />
                      <span className="text-[10px] text-gray-400">
                        {isActualAdmin ? 'Administrador' : 'Membro / Vendedor'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-gray-400">
                  <button className="p-1 hover:text-gray-700 transition-colors">
                    <Tag className="w-3.5 h-3.5" />
                  </button>
                  <button className="p-1 hover:text-gray-700 transition-colors">
                    <Users className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex justify-center">
                <div className="w-7 h-7 rounded-full bg-[#00478f] text-white font-bold text-[10px] flex items-center justify-center">
                  {userInitials}
                </div>
              </div>
            )}

          </div>

        </aside>

        {/* MAIN WORKSPACE CANVAS */}
        <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
          
          {/* Main Content Area Container matching the screenshot's clean white card */}
          <div className="w-full bg-white rounded-2xl border border-gray-200/80 shadow-xs min-h-[calc(100vh-6rem)] p-6 sm:p-8">
            
            {/* View switcher based on sidebar selection */}
            {(activeTab === 'canvas' || activeTab === 'planilha') && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
                  <div>
                    <h2 className="text-base font-bold text-gray-900 font-['Space_Grotesk'] flex items-center gap-2">
                      <span>Planilha de Vendas</span>
                      <span className="text-[10px] font-semibold text-[#0052cc] bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                        Visualização Excel
                      </span>
                    </h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Listagem detalhada das vendas com filtros avançados por coluna e exportação
                    </p>
                  </div>
                </div>

                {/* Spreadsheet Component */}
                <SalesSpreadsheetTable 
                  onOpenNewSaleModal={() => setShowNewSaleModal(true)}
                />
              </div>
            )}

            {activeTab === 'planner' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900 font-['Space_Grotesk'] flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-blue-600" />
                      Planner de Metas & Fechamentos
                    </h2>
                    <p className="text-xs text-gray-500">
                      Acompanhamento diário e semanal dos objetivos de vendas da equipe
                    </p>
                  </div>
                  <button
                    onClick={() => setShowNewSaleModal(true)}
                    className="px-3.5 py-1.5 bg-[#0052cc] hover:bg-[#00478f] text-white text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Lançar Venda</span>
                  </button>
                </div>
                <GoalProgressTracker />
              </div>
            )}

            {activeTab === 'fila' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900 font-['Space_Grotesk'] flex items-center gap-2">
                      <Mail className="w-5 h-5 text-blue-600" />
                      Fila de Oportunidades & Vendas
                    </h2>
                    <p className="text-xs text-gray-500">
                      Histórico recente de lançamentos em tempo real
                    </p>
                  </div>
                </div>
                <SellerSalesHistory />
              </div>
            )}

            {(activeTab === 'resumo' || activeTab === 'resumo_semanal') && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900 font-['Space_Grotesk'] flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-blue-600" />
                      Resumo Semanal & Gerencial
                    </h2>
                    <p className="text-xs text-gray-500">
                      Métricas agregadas de faturamento e desempenho
                    </p>
                  </div>
                </div>
                <AnalyticsOverview />
              </div>
            )}

            {activeTab === 'boletos_do_dia' && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
                  <div>
                    <h2 className="text-base font-bold text-gray-900 font-['Space_Grotesk'] flex items-center gap-2">
                      <Receipt className="w-4 h-4 text-blue-600" />
                      <span>Boletos do Dia</span>
                      <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                        Hoje
                      </span>
                    </h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Listagem detalhada das vendas e boletos registrados na data de hoje
                    </p>
                  </div>
                </div>

                {/* Spreadsheet Component filtered specifically for today */}
                <SalesSpreadsheetTable 
                  onlyToday={true}
                  onOpenNewSaleModal={() => setShowNewSaleModal(true)}
                />
              </div>
            )}

            {(activeTab === 'rank_semanal' || activeTab === 'rank_mensal') && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <LiveTeamLeaderboard period={activeTab === 'rank_mensal' ? 'mensal' : 'semanal'} />
              </div>
            )}

            {(activeTab === 'produto_graduacao' || activeTab === 'produto_pos' || activeTab === 'produto_tecnico') && (
              <ProductSummaryView
                productType={
                  activeTab === 'produto_pos'
                    ? 'Pós Graduação'
                    : activeTab === 'produto_tecnico'
                    ? 'Curso Técnico'
                    : 'Graduação'
                }
                onOpenNewSaleModal={(prod) => {
                  setInitialProductForModal(prod || 'Graduação');
                  setShowNewSaleModal(true);
                }}
              />
            )}

            {activeTab === 'equipe' && (
              <div className="animate-in fade-in duration-200">
                {isActualAdmin && viewRole === 'admin' ? (
                  <UsersProfilesTable onBackToPlanner={() => setActiveTab('canvas')} />
                ) : (
                  <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center max-w-md mx-auto my-12 space-y-4">
                    <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto">
                      <Shield className="w-7 h-7" />
                    </div>
                    <h3 className="text-base font-bold text-slate-900">Acesso Restrito a Administradores</h3>
                    <p className="text-xs text-slate-500">
                      A aba de administração e gerenciamento de equipe é restrita exclusivamente a administradores.
                    </p>
                    <button
                      onClick={() => setActiveTab('canvas')}
                      className="px-4 py-2 bg-[#0052cc] hover:bg-[#00478f] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
                    >
                      Voltar ao Painel
                    </button>
                  </div>
                )}
              </div>
            )}

          </div>

        </main>

      </div>

      {/* 3. MODAL: + NOVA VENDA _ */}
      <NewSaleModal
        isOpen={showNewSaleModal}
        onClose={() => setShowNewSaleModal(false)}
        initialProduct={initialProductForModal}
      />

    </div>
  );
};

export default R9Dashboard;
