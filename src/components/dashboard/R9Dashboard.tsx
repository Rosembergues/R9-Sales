import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSales } from '../../context/SalesContext';
import { 
  Calendar, 
  ChevronLeft, 
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
  CalendarCheck,
  Trophy,
  Crown,
  Target
} from 'lucide-react';
import { UsersProfilesTable } from '../admin/UsersProfilesTable';
import { CampaignsManager } from '../admin/CampaignsManager';
import { PerformanceDashboard } from '../seller/PerformanceDashboard';
import { GoalManagementPage } from '../admin/GoalManagementPage';
import { LiveTeamLeaderboard } from '../seller/LiveTeamLeaderboard';
import { ProductSummaryView } from './ProductSummaryView';
import { SalesSpreadsheetTable } from './SalesSpreadsheetTable';
import { DailyClosingView } from './DailyClosingView';
import { HomeDashboard } from './HomeDashboard';
import { NewSaleModal } from '../sales/NewSaleModal';
import { MainProductType, Sale } from '../../types';
import { getTodayBrDate, getSaleDateBr, getSaleFdiDisplay } from '../../lib/salesMapper';

export const R9Dashboard: React.FC = () => {
  const { currentUser, signOut } = useAuth();
  const { sales } = useSales();

  // Role check
  const isActualAdmin = currentUser?.role === 'admin';

  // Navigation & View States
  const [viewRole, setViewRole] = useState<'admin' | 'membro'>(
    currentUser?.role === 'admin' ? 'admin' : 'membro'
  );
  const [activeTab, setActiveTab] = useState<string>('home');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [showNewSaleModal, setShowNewSaleModal] = useState(false);
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
    if ((!isActualAdmin || viewRole === 'membro') && (activeTab === 'equipe' || activeTab === 'metas')) {
      setActiveTab('home');
    }
  }, [isActualAdmin, viewRole, activeTab]);

  // Helper to determine product type of a sale
  const getSaleProductType = (sale: Sale): MainProductType => {
    if (sale.custom_data?.main_product) {
      return sale.custom_data.main_product;
    }
    const name = (sale.product_name || '').toLowerCase();
    const mod = (sale.custom_data?.modality || '').toLowerCase();
    const fdi = getSaleFdiDisplay(sale).toLowerCase();

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

  // Computed today's sales count (Boletos do Dia) - Estritamente pela Data da Venda de HOJE
  const todayFormatted = getTodayBrDate();
  const boletosDoDiaCount = sales.filter(s => {
    const saleDate = getSaleDateBr(s);
    return saleDate === todayFormatted;
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
      <header className="h-16 bg-[#f6f8fc] px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30">
        {/* Left: Sidebar Toggle */}
        <div className="flex items-center gap-3">
          <button
            id="sidebar-toggle-btn"
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-white rounded-xl transition-colors cursor-pointer border border-transparent hover:border-slate-200"
            title="Alternar Barra Lateral"
          >
            <PanelLeft className="w-5 h-5" />
          </button>
        </div>

        {/* Right: Date, Role View Selector & Logout */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden md:flex items-center gap-2 rounded-xl bg-white border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm">
            <Calendar className="w-4 h-4 text-slate-500" />
            {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
          </div>
          
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

          <button
            id="logout-btn"
            onClick={() => signOut()}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-red-200"
            title="Sair da Conta"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline font-medium">Sair</span>
          </button>

        </div>

      </header>

      {/* 2. BODY LAYOUT: SIDEBAR + MAIN CANVAS */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* LEFT SIDEBAR */}
        <aside className={`r9-sidebar ${isSidebarCollapsed ? 'w-0 sm:w-16 overflow-hidden' : 'w-64'} bg-[#0f1b2d] border-r border-[#24334b] flex flex-col justify-between transition-all duration-200 z-20 shrink-0 select-none`}>
          
          <div className="p-3 space-y-4 overflow-y-auto">
            {!isSidebarCollapsed && (
              <div className="px-2 pt-2 pb-1 flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-500 flex items-center justify-center shadow-lg shadow-blue-950/30">
                  <span className="text-white font-black text-lg font-['Space_Grotesk']">R9</span>
                </div>
                <div>
                  <div className="text-white font-black tracking-tight text-lg font-['Space_Grotesk']">R9 SALES</div>
                  <div className="text-[10px] text-slate-400 font-semibold tracking-wider">OPERAÇÃO COMERCIAL</div>
                </div>
              </div>
            )}
            
            {/* User Profile Header */}
            {!isSidebarCollapsed ? (
              <div className="flex items-center justify-between p-1">
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <div className="w-9 h-9 rounded-full bg-[#00478f] text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
                    {userInitials}
                  </div>
                  <div className="truncate">
                    <p className="text-xs font-bold text-white truncate">
                      {userName}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate">
                      {userRoleText} • R9 Corp
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsSidebarCollapsed(true)}
                  className="text-slate-400 hover:text-white p-1"
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

            {/* Início */}
            <button
              id="nav-inicio"
              onClick={() => setActiveTab('home')}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-colors cursor-pointer ${
                activeTab === 'home'
                  ? 'bg-blue-500 text-white font-bold shadow-lg shadow-blue-900/30'
                  : 'text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Início</span>
            </button>

            {/* Section: VENDAS & OPERAÇÃO */}
            {!isSidebarCollapsed && (
              <div className="space-y-1 pt-2">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-2 mb-1">
                  VENDAS & OPERAÇÃO
                </p>

                <button
                  id="nav-planilha-vendas"
                  onClick={() => setActiveTab('canvas')}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                    activeTab === 'canvas' || activeTab === 'planilha'
                      ? 'bg-blue-500/15 text-blue-200 font-semibold'
                      : 'text-slate-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Vendas</span>
                  </div>
                  <span className="text-[11px] font-bold text-slate-400">{sales.length}</span>
                </button>

                <button
                  id="nav-boletos-do-dia"
                  onClick={() => setActiveTab('boletos_do_dia')}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                    activeTab === 'boletos_do_dia'
                      ? 'bg-blue-500/15 text-blue-200 font-semibold'
                      : 'text-slate-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Receipt className="w-3.5 h-3.5 text-blue-600" />
                    <span>Boletos do Dia</span>
                  </div>
                  <span className="text-[11px] font-bold text-gray-500">{boletosDoDiaCount}</span>
                </button>

                <button
                  id="nav-fechamento-diario"
                  onClick={() => setActiveTab('fechamento_diario')}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                    activeTab === 'fechamento_diario'
                      ? 'bg-blue-500/15 text-blue-200 font-semibold'
                      : 'text-slate-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <CalendarCheck className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Fechamento Diário</span>
                  </div>
                  <span className="text-[11px] font-bold text-indigo-600">{boletosDoDiaCount}</span>
                </button>

              </div>
            )}

            {/* Section: Desempenho */}
            {!isSidebarCollapsed && (
              <div className="space-y-1 pt-3 border-t border-[#24334b]">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-1">
                  DESEMPENHO
                </p>
                <button
                  id="nav-desempenho"
                  onClick={() => setActiveTab('resumo')}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs transition-colors cursor-pointer ${
                    activeTab === 'resumo' || activeTab === 'resumo_semanal'
                      ? 'bg-blue-500/15 text-blue-300 font-semibold'
                      : 'text-slate-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
                  <span>Desempenho</span>
                </button>
                <button
                  id="nav-ranking"
                  onClick={() => setActiveTab('rank_semanal')}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs transition-colors cursor-pointer ${
                    activeTab === 'rank_semanal' || activeTab === 'rank_mensal'
                      ? 'bg-blue-500/15 text-blue-300 font-semibold'
                      : 'text-slate-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Trophy className="w-3.5 h-3.5 text-amber-400" />
                  <span>Ranking</span>
                </button>
              </div>
            )}

            {/* Section: Produtos */}
            {!isSidebarCollapsed && (
              <div className="space-y-1 pt-3 border-t border-[#24334b]">
                <div className="flex items-center justify-between px-2 mb-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    PRODUTOS
                  </p>
                  <span className="text-[10px] font-bold text-gray-400 bg-white/5 text-slate-300 px-1.5 py-0.5 rounded">
                    {graduacaoCount + posCount + tecnicoCount}
                  </span>
                </div>

                <button
                  id="filter-graduacao"
                  onClick={() => setActiveTab('produto_graduacao')}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                    activeTab === 'produto_graduacao'
                      ? 'bg-blue-500/15 text-blue-200 font-semibold'
                      : 'text-slate-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#0052cc]" />
                    <span className="font-medium">Graduação</span>
                  </div>
                  <span className="text-[11px] font-bold text-slate-400">{graduacaoCount}</span>
                </button>

                <button
                  id="filter-pos-graduacao"
                  onClick={() => setActiveTab('produto_pos')}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                    activeTab === 'produto_pos'
                      ? 'bg-purple-50 text-purple-700 font-semibold shadow-2xs'
                      : 'text-slate-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-purple-600" />
                    <span className="font-medium">Pós Graduação</span>
                  </div>
                  <span className="text-[11px] font-bold text-slate-400">{posCount}</span>
                </button>

                <button
                  id="filter-curso-tecnico"
                  onClick={() => setActiveTab('produto_tecnico')}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                    activeTab === 'produto_tecnico'
                      ? 'bg-amber-50 text-amber-700 font-semibold shadow-2xs'
                      : 'text-slate-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    <span className="font-medium">Curso Técnico</span>
                  </div>
                  <span className="text-[11px] font-bold text-slate-400">{tecnicoCount}</span>
                </button>
              </div>
            )}

          </div>

          {/* Bottom Sidebar: ADMINISTRAÇÃO & User Footer */}
          <div className="p-3 border-t border-[#24334b] space-y-3">
            {/* A aba de administração deve ser visivel apenas para administradores */}
            {isActualAdmin && viewRole === 'admin' && !isSidebarCollapsed && (
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2">
                  ADMINISTRAÇÃO
                </p>

                <button
                  id="nav-gerenciar-equipe"
                  onClick={() => setActiveTab('equipe')}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                    activeTab === 'equipe'
                      ? 'bg-blue-500/15 text-blue-200 font-semibold'
                      : 'text-slate-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-blue-600" />
                    <span>Gerenciar Equipe</span>
                  </div>
                  <span className="text-[10px] font-medium text-purple-200 bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 rounded">
                    perfis
                  </span>
                </button>

                <button
                  id="nav-gerenciar-metas"
                  onClick={() => setActiveTab('metas')}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                    activeTab === 'metas'
                      ? 'bg-blue-500/15 text-blue-200 font-semibold'
                      : 'text-slate-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Target className="w-3.5 h-3.5 text-blue-600" />
                    <span>Gerenciamento de Metas</span>
                  </div>
                  <span className="text-[10px] font-medium text-blue-200 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded">
                    metas
                  </span>
                </button>

                <button
                  id="nav-campanhas"
                  onClick={() => setActiveTab('campanhas')}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                    activeTab === 'campanhas'
                      ? 'bg-blue-500/15 text-blue-300 font-semibold'
                      : 'text-slate-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Tag className="w-3.5 h-3.5 text-purple-400" />
                    <span>Campanhas</span>
                  </div>
                </button>

              </div>
            )}

            {/* Bottom mini user bar */}
            {!isSidebarCollapsed ? (
              <div className="flex items-center justify-between pt-2 border-t border-[#24334b]">
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
        <main className="flex-1 overflow-y-auto bg-[#f6f8fc]">
          <div className="w-full max-w-[1680px] mx-auto p-4 sm:p-6 lg:p-7 min-h-[calc(100vh-4rem)]">
            
            {/* Home dashboard */}
            {activeTab === 'home' && (
              <HomeDashboard
                onOpenNewSaleModal={() => setShowNewSaleModal(true)}
                onOpenSales={() => setActiveTab('canvas')}
                onOpenRanking={() => setActiveTab('rank_semanal')}
              />
            )}

            {/* View switcher based on sidebar selection */}
            {(activeTab === 'canvas' || activeTab === 'planilha') && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
                  <div>
                    <h2 className="text-base font-bold text-gray-900 font-['Space_Grotesk'] flex items-center gap-2">
                      <span>Vendas</span>
                      <span className="text-[10px] font-semibold text-[#0052cc] bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                        50 por página
                      </span>
                    </h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Consulte, filtre e edite suas vendas com paginação e exportação.
                    </p>
                  </div>
                </div>

                {/* Spreadsheet Component */}
                <SalesSpreadsheetTable 
                  onOpenNewSaleModal={() => setShowNewSaleModal(true)}
                />
              </div>
            )}

            {(activeTab === 'resumo' || activeTab === 'resumo_semanal') && (
              <PerformanceDashboard
                onOpenNewSaleModal={() => setShowNewSaleModal(true)}
                onOpenProductDetails={(product) => {
                  setActiveTab(
                    product === 'Pós Graduação'
                      ? 'produto_pos'
                      : product === 'Curso Técnico'
                      ? 'produto_tecnico'
                      : 'produto_graduacao'
                  );
                }}
              />
            )}

            {activeTab === 'boletos_do_dia' && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
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

            {activeTab === 'fechamento_diario' && (
              <DailyClosingView 
                onOpenNewSaleModal={() => setShowNewSaleModal(true)}
              />
            )}

            {(activeTab === 'rank_semanal' || activeTab === 'rank_mensal') && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <LiveTeamLeaderboard
                  period={activeTab === 'rank_mensal' ? 'mensal' : 'semanal'}
                />
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

            {activeTab === 'campanhas' && (
              <div className="animate-in fade-in duration-200">
                {isActualAdmin && viewRole === 'admin' ? (
                  <CampaignsManager />
                ) : (
                  <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center max-w-md mx-auto my-12 space-y-4 shadow-sm">
                    <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto">
                      <Shield className="w-7 h-7" />
                    </div>
                    <h3 className="text-base font-bold text-slate-900">Acesso Restrito a Administradores</h3>
                    <p className="text-xs text-slate-500">A gestão de campanhas é restrita exclusivamente a administradores.</p>
                    <button onClick={() => setActiveTab('home')} className="px-4 py-2 bg-[#0052cc] hover:bg-[#00478f] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer">Voltar ao Início</button>
                  </div>
                )}
              </div>
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

            {activeTab === 'metas' && (
              <div className="animate-in fade-in duration-200">
                {isActualAdmin && viewRole === 'admin' ? (
                  <GoalManagementPage onBackToPlanner={() => setActiveTab('canvas')} />
                ) : (
                  <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center max-w-md mx-auto my-12 space-y-4">
                    <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto">
                      <Shield className="w-7 h-7" />
                    </div>
                    <h3 className="text-base font-bold text-slate-900">Acesso Restrito a Administradores</h3>
                    <p className="text-xs text-slate-500">
                      A aba de gerenciamento de metas é restrita exclusivamente a administradores.
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
