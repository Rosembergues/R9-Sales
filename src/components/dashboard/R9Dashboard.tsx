import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSales } from '../../context/SalesContext';
import { ChevronLeft, Shield, User, LogOut, PanelLeft, Plus, TrendingUp, Users, Tag, BarChart3, FileSpreadsheet, Receipt, CalendarCheck, Trophy, Target, ClipboardList, ChevronDown, CalendarDays, Inbox, CheckSquare } from 'lucide-react';
import { UsersProfilesTable } from '../admin/UsersProfilesTable';
import { CampaignsManager } from '../admin/CampaignsManager';
import { PerformanceDashboard } from '../seller/PerformanceDashboard';
import { GoalManagementPage } from '../admin/GoalManagementPage';
import { AnalyticsPage } from '../admin/AnalyticsPage';
import { GoalImportPage } from '../admin/GoalImportPage';
import { LiveTeamLeaderboard } from '../seller/LiveTeamLeaderboard';
import { ProductSummaryView } from './ProductSummaryView';
import { SalesSpreadsheetTable } from './SalesSpreadsheetTable';
import { DailyClosingView } from './DailyClosingView';
import { HomeDashboard } from './HomeDashboard';
import { NewSaleModal } from '../sales/NewSaleModal';
import { MainProductType, Sale } from '../../types';
import { getTodayBrDate, getSaleDateBr, getSaleFdiDisplay } from '../../lib/salesMapper';
import Planner from '../../planner/components/Planner';

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
  const [isPlannerMenuOpen, setIsPlannerMenuOpen] = useState(false);
  const [plannerSection, setPlannerSection] = useState<'calendar' | 'queue' | 'my_tasks' | 'tags'>('calendar');
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
    if ((!isActualAdmin || viewRole === 'membro') && (activeTab === 'equipe' || activeTab === 'metas' || activeTab === 'metas_importacao' || activeTab === 'analytics' || activeTab === 'planner_summary')) {
      setActiveTab('home');
    }
  }, [isActualAdmin, viewRole, activeTab]);

  const openPlannerSection = (section: 'calendar' | 'queue' | 'my_tasks' | 'tags') => {
    setPlannerSection(section);
    setActiveTab('planner');
    setIsPlannerMenuOpen(true);
  };

  const openPlannerSummary = () => {
    setActiveTab('planner_summary');
    setIsPlannerMenuOpen(false);
  };

  const handlePlannerSectionChange = useCallback((section: 'calendar' | 'queue' | 'my_tasks' | 'tags' | 'summary') => {
    if (section === 'summary') {
      setActiveTab('planner_summary');
      setIsPlannerMenuOpen(false);
      return;
    }
    setPlannerSection(section);
    setActiveTab('planner');
    setIsPlannerMenuOpen(true);
  }, []);

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
    <div className="h-screen overflow-hidden bg-[#F8F9FA] flex flex-col font-sans text-slate-800 selection:bg-[#00478f] selection:text-white">
      
      {/* 2. BODY LAYOUT: SIDEBAR + MAIN CANVAS */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        
        {/* LEFT SIDEBAR */}
        <aside className={`r9-sidebar ${isSidebarCollapsed ? 'w-16 overflow-hidden' : 'w-64'} h-full min-h-0 bg-[#0f1b2d] border-r border-[#24334b] flex flex-col transition-all duration-200 z-20 shrink-0 select-none`}>
          
          <div className="flex-1 min-h-0 p-3 space-y-4 overflow-y-auto overflow-x-hidden">
            {!isSidebarCollapsed ? (
              <div className="px-2 pt-2 pb-1 flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-500 flex items-center justify-center shadow-lg shadow-blue-950/30 shrink-0">
                  <span className="text-white font-black text-lg font-['Space_Grotesk']">R9</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-white font-black tracking-tight text-lg font-['Space_Grotesk']">R9 SALES</div>
                  <div className="text-[10px] text-slate-400 font-semibold tracking-wider">OPERAÇÃO COMERCIAL</div>
                </div>
              </div>
            ) : (
              <div className="flex justify-center pt-2 pb-1">
                <button
                  id="sidebar-toggle-btn"
                  onClick={() => setIsSidebarCollapsed(false)}
                  className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                  title="Expandir menu lateral"
                  aria-label="Expandir menu lateral"
                >
                  <PanelLeft className="w-5 h-5" />
                </button>
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
                  id="sidebar-toggle-btn"
                  onClick={() => setIsSidebarCollapsed(true)}
                  className="text-slate-400 hover:text-white p-1 rounded-md transition-colors cursor-pointer"
                  title="Recolher menu lateral"
                  aria-label="Recolher menu lateral"
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
            <div className={isSidebarCollapsed ? 'flex justify-center' : ''}>
              <button
                id="btn-lancar-venda"
                onClick={() => setShowNewSaleModal(true)}
                title="Lançar venda"
                aria-label="Lançar venda"
                className={`${isSidebarCollapsed ? 'w-10 h-10 px-0 py-0' : 'w-full py-2.5 px-3'} bg-[#0052cc] hover:bg-[#00478f] active:scale-[0.99] text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer`}
              >
                <Plus className="w-4 h-4 shrink-0" />
                {!isSidebarCollapsed && <span>Lançar Venda</span>}
              </button>
            </div>

            {/* Início */}
            <button
              id="nav-inicio"
              onClick={() => setActiveTab('home')}
              title="Início"
              aria-label="Início"
              className={`${isSidebarCollapsed ? 'w-10 h-10 justify-center px-0 py-0' : 'w-full gap-2.5 px-3 py-2.5'} flex items-center rounded-xl text-sm transition-colors cursor-pointer ${
                activeTab === 'home'
                  ? 'bg-blue-500 text-white font-bold shadow-lg shadow-blue-900/30'
                  : 'text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <BarChart3 className="w-4 h-4 shrink-0" />
              {!isSidebarCollapsed && <span>Início</span>}
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

            {/* Planejamento: submenu integrado à navegação principal do R9 Sales */}
            {!isSidebarCollapsed && (
              <div className="space-y-1 pt-2">
                <button
                  id="nav-planejamento"
                  onClick={() => {
                    if (activeTab !== 'planner') {
                      setActiveTab('planner');
                      setPlannerSection('calendar');
                      setIsPlannerMenuOpen(true);
                    } else {
                      setIsPlannerMenuOpen((open) => !open);
                    }
                  }}
                  aria-expanded={isPlannerMenuOpen && activeTab === 'planner'}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-colors cursor-pointer ${
                    activeTab === 'planner'
                      ? 'bg-blue-500/15 text-blue-200 font-semibold'
                      : 'text-slate-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <ClipboardList className="w-3.5 h-3.5 text-blue-300" />
                    <span>Planejamento</span>
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isPlannerMenuOpen && activeTab === 'planner' ? 'rotate-180' : ''}`} />
                </button>

                {isPlannerMenuOpen && activeTab === 'planner' && (
                  <div className="ml-3 pl-2 border-l border-slate-700/80 space-y-1 py-1">
                    <button id="nav-planner-calendar" onClick={() => openPlannerSection('calendar')} className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs transition-colors cursor-pointer ${plannerSection === 'calendar' ? 'bg-[#0052cc] text-white font-semibold shadow-sm' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`}>
                      <CalendarDays className="w-3.5 h-3.5" /><span>Calendário</span>
                    </button>
                    {isActualAdmin && viewRole === 'admin' && (
                      <button id="nav-planner-queue" onClick={() => openPlannerSection('queue')} className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-colors cursor-pointer ${plannerSection === 'queue' ? 'bg-[#0052cc] text-white font-semibold shadow-sm' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`}>
                        <span className="flex items-center gap-2.5"><Inbox className="w-3.5 h-3.5" /><span>Fila de tarefas</span></span>
                      </button>
                    )}
                    <button id="nav-planner-my-tasks" onClick={() => openPlannerSection('my_tasks')} className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs transition-colors cursor-pointer ${plannerSection === 'my_tasks' ? 'bg-[#0052cc] text-white font-semibold shadow-sm' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`}>
                      <CheckSquare className="w-3.5 h-3.5" /><span>Minhas tarefas</span>
                    </button>
                    {isActualAdmin && viewRole === 'admin' && (
                      <button id="nav-planner-tags" onClick={() => openPlannerSection('tags')} className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs transition-colors cursor-pointer ${plannerSection === 'tags' ? 'bg-[#0052cc] text-white font-semibold shadow-sm' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`}>
                        <Tag className="w-3.5 h-3.5" /><span>Tags e categorias</span>
                      </button>
                    )}
                  </div>
                )}
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
                {isActualAdmin && viewRole === 'admin' && (
                  <button
                    id="nav-analytics"
                    onClick={() => setActiveTab('analytics')}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs transition-colors cursor-pointer ${
                      activeTab === 'analytics'
                        ? 'bg-blue-500/15 text-blue-300 font-semibold'
                        : 'text-slate-300 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <BarChart3 className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Analytics</span>
                  </button>
                )}
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
                {isActualAdmin && viewRole === 'admin' && (
                  <button
                    id="nav-planner-summary"
                    onClick={openPlannerSummary}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs transition-colors cursor-pointer ${
                      activeTab === 'planner_summary'
                        ? 'bg-blue-500/15 text-blue-300 font-semibold'
                        : 'text-slate-300 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <CalendarCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Resumo semanal</span>
                  </button>
                )}
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
                    <span className="whitespace-nowrap">Gerenciar Equipe</span>
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
                    <span className="whitespace-nowrap">Gerenciar Metas</span>
                  </div>
                  <span className="text-[10px] font-medium text-blue-200 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded">
                    metas
                  </span>
                </button>

                <button
                  id="nav-importar-metas"
                  onClick={() => setActiveTab('metas_importacao')}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                    activeTab === 'metas_importacao'
                      ? 'bg-blue-500/15 text-blue-200 font-semibold'
                      : 'text-slate-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="whitespace-nowrap">Importar Metas</span>
                  </div>
                  <span className="text-[10px] font-medium text-emerald-200 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                    arquivos
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
                    <span className="whitespace-nowrap">Campanhas</span>
                  </div>
                </button>

              </div>
            )}

          </div>

          {/* Controles fixos no rodapé do menu lateral */}
          <div className="shrink-0 p-3 border-t border-[#24334b] bg-[#0f1b2d] space-y-2.5">
            {isActualAdmin && (
              <div className={isSidebarCollapsed ? 'flex flex-col items-center gap-1.5' : 'space-y-1.5'}>
                {!isSidebarCollapsed && (
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">
                    VISUALIZAÇÃO
                  </p>
                )}
                <div className={isSidebarCollapsed
                  ? 'flex flex-col gap-1.5'
                  : 'flex w-full rounded-lg bg-[#162338] p-1 border border-[#26364d] text-xs'}>
                  <button
                    id="view-mode-admin-btn"
                    onClick={() => setViewRole('admin')}
                    title="Visualizar como administrador"
                    aria-label="Visualizar como administrador"
                    aria-pressed={viewRole === 'admin'}
                    className={`${isSidebarCollapsed ? 'w-10 h-9 justify-center' : 'flex-1 justify-center px-2 py-2'} flex items-center gap-1.5 rounded-md font-medium transition-all cursor-pointer ${
                      viewRole === 'admin'
                        ? 'bg-[#0052cc] text-white shadow-sm'
                        : 'text-slate-300 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <Shield className="w-3.5 h-3.5 shrink-0" />
                    {!isSidebarCollapsed && <span>Admin</span>}
                  </button>
                  <button
                    id="view-mode-member-btn"
                    onClick={() => setViewRole('membro')}
                    title="Visualizar como membro"
                    aria-label="Visualizar como membro"
                    aria-pressed={viewRole === 'membro'}
                    className={`${isSidebarCollapsed ? 'w-10 h-9 justify-center' : 'flex-1 justify-center px-2 py-2'} flex items-center gap-1.5 rounded-md font-medium transition-all cursor-pointer ${
                      viewRole === 'membro'
                        ? 'bg-[#0052cc] text-white shadow-sm'
                        : 'text-slate-300 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <User className="w-3.5 h-3.5 shrink-0" />
                    {!isSidebarCollapsed && <span>Membro</span>}
                  </button>
                </div>
              </div>
            )}

            <button
              id="logout-btn"
              onClick={() => signOut()}
              className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-2.5'} px-3 py-2.5 text-xs font-semibold text-slate-300 hover:text-red-200 hover:bg-red-500/10 rounded-xl transition-colors cursor-pointer`}
              title="Sair da conta"
              aria-label="Sair da conta"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              {!isSidebarCollapsed && <span>Sair da conta</span>}
            </button>
          </div>

        </aside>

        {/* MAIN WORKSPACE CANVAS */}
        <main className="flex-1 min-w-0 min-h-0 overflow-y-auto bg-[#f6f8fc]">
          <div className="w-full max-w-[1680px] mx-auto p-4 sm:p-6 lg:p-7 min-h-full">
            
            {/* Planner integrado — compartilha a sessão autenticada do R9 Sales */}
            {(activeTab === 'planner' || activeTab === 'planner_summary') && currentUser && (
              <div className="animate-in fade-in duration-200 -m-1 sm:-m-2">
                <Planner
                  user={{
                    id: currentUser.id,
                    email: currentUser.email,
                    user_metadata: { full_name: currentUser.name, nome: currentUser.name },
                  }}
                  viewRole={viewRole}
                  externalNavigation
                  section={activeTab === 'planner_summary' ? 'summary' : plannerSection}
                  onSectionChange={handlePlannerSectionChange}
                />
              </div>
            )}

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

            {activeTab === 'analytics' && (
              <div className="animate-in fade-in duration-200">
                {isActualAdmin && viewRole === 'admin' ? (
                  <AnalyticsPage />
                ) : (
                  <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center max-w-md mx-auto my-12 space-y-4">
                    <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto">
                      <Shield className="w-7 h-7" />
                    </div>
                    <h3 className="text-base font-bold text-slate-900">Acesso Restrito a Administradores</h3>
                    <p className="text-xs text-slate-500">O Analytics oficial de metas é restrito exclusivamente a administradores nesta fase.</p>
                    <button onClick={() => setActiveTab('home')} className="px-4 py-2 bg-[#0052cc] hover:bg-[#00478f] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer">Voltar ao Início</button>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'metas_importacao' && (
              <div className="animate-in fade-in duration-200">
                {isActualAdmin && viewRole === 'admin' ? (
                  <GoalImportPage onBackToPlanner={() => setActiveTab('canvas')} />
                ) : (
                  <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center max-w-md mx-auto my-12 space-y-4">
                    <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto">
                      <Shield className="w-7 h-7" />
                    </div>
                    <h3 className="text-base font-bold text-slate-900">Acesso Restrito a Administradores</h3>
                    <p className="text-xs text-slate-500">A importação de metas é restrita exclusivamente a administradores.</p>
                    <button onClick={() => setActiveTab('home')} className="px-4 py-2 bg-[#0052cc] hover:bg-[#00478f] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer">Voltar ao Início</button>
                  </div>
                )}
              </div>
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
