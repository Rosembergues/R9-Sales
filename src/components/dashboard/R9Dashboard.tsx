import React, { Suspense, lazy, useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSales } from '../../context/SalesContext';
import { ChevronLeft, Shield, User, LogOut, PanelLeft, Plus, TrendingUp, Users, Tag, BarChart3, FileSpreadsheet, CalendarCheck, Trophy, Target, ClipboardList, ChevronDown, CalendarDays, CheckSquare, MessageSquareText, Scale, ListChecks, Wrench, Sparkles, Presentation, FolderArchive } from 'lucide-react';
import { HomeDashboard } from './HomeDashboard';
import { getTodayBrDate, getSaleDateBr } from '../../lib/salesMapper';
import { ErrorBoundary } from '../common/ErrorBoundary';

// Telas carregadas só quando abertas: o primeiro acesso ao site fica mais leve
// (Excel, Planejamento e Comparador não entram no carregamento inicial).
const UsersProfilesTable = lazy(() => import('../admin/UsersProfilesTable').then(m => ({ default: m.UsersProfilesTable })));
const PerformancePage = lazy(() => import('../performance/PerformancePage').then(m => ({ default: m.PerformancePage })));
const GoalManagementPage = lazy(() => import('../admin/GoalManagementPage').then(m => ({ default: m.GoalManagementPage })));
const GoalImportPage = lazy(() => import('../admin/GoalImportPage').then(m => ({ default: m.GoalImportPage })));
const MessageRepository = lazy(() => import('../messages/MessageRepository').then(m => ({ default: m.MessageRepository })));
const LiveTeamLeaderboard = lazy(() => import('../ranking/LiveTeamLeaderboard').then(m => ({ default: m.LiveTeamLeaderboard })));
const SalesSpreadsheetTable = lazy(() => import('../sales/SalesSpreadsheetTable').then(m => ({ default: m.SalesSpreadsheetTable })));
const DailyClosingView = lazy(() => import('../sales/DailyClosingView').then(m => ({ default: m.DailyClosingView })));
const Planner = lazy(() => import('../../planner/components/Planner'));
const PriceComparatorPage = lazy(() => import('../prices/PriceComparatorPage').then(m => ({ default: m.PriceComparatorPage })));
const BomDiaGeneratorPage = lazy(() => import('../tools/BomDiaGeneratorPage').then(m => ({ default: m.BomDiaGeneratorPage })));
const DesempenhoCursosPage = lazy(() => import('../tools/coordenacao/DesempenhoCursosPage').then(m => ({ default: m.DesempenhoCursosPage })));
const NewSaleModal = lazy(() => import('../sales/NewSaleModal').then(m => ({ default: m.NewSaleModal })));
const PlanilhasPorCursoPage = lazy(() => import('../tools/coordenacao/PlanilhasPorCursoPage').then(m => ({ default: m.PlanilhasPorCursoPage })));

const TabLoading = () => (
  <div className="py-20 flex items-center justify-center gap-2 text-xs text-slate-400">
    <span className="w-4 h-4 rounded-full border-2 border-slate-300 border-t-[#0052cc] animate-spin" />
    Carregando...
  </div>
);

/** Abas do painel (o que aparece na área principal). */
type DashboardTab =
  | 'home'
  | 'canvas'
  | 'fechamento_diario'
  | 'resumo'
  | 'rank_semanal'
  | 'planner'
  | 'planner_summary'
  | 'comparador_precos'
  | 'mensagens'
  | 'ferramentas_bom_dia'
  | 'ferramentas_coord_desempenho'
  | 'ferramentas_coord_planilhas'
  | 'equipe'
  | 'metas'
  | 'metas_importacao';

type PlannerSection = 'calendar' | 'queue' | 'my_tasks' | 'tasks' | 'tags';

const readDashboardRoute = (pathname = window.location.pathname): { tab: DashboardTab; plannerSection: PlannerSection } => {
  const normalizedPath = pathname.replace(/\/+$/, '') || '/';
  const routes: Record<string, { tab: DashboardTab; plannerSection: PlannerSection }> = {
    '/': { tab: 'home', plannerSection: 'calendar' },
    '/vendas': { tab: 'canvas', plannerSection: 'calendar' },
    '/vendas/fechamento-diario': { tab: 'fechamento_diario', plannerSection: 'calendar' },
    '/rotina/calendario': { tab: 'planner', plannerSection: 'calendar' },
    '/rotina/fila': { tab: 'planner', plannerSection: 'queue' },
    '/rotina/minhas-tarefas': { tab: 'planner', plannerSection: 'my_tasks' },
    '/rotina/semana': { tab: 'planner', plannerSection: 'tasks' },
    '/rotina/balanco': { tab: 'planner_summary', plannerSection: 'calendar' },
    '/resultados/desempenho': { tab: 'resumo', plannerSection: 'calendar' },
    '/resultados/ranking': { tab: 'rank_semanal', plannerSection: 'calendar' },
    '/ferramentas/comparador-precos': { tab: 'comparador_precos', plannerSection: 'calendar' },
    '/ferramentas/mensagens': { tab: 'mensagens', plannerSection: 'calendar' },
    '/ferramentas/bom-dia': { tab: 'ferramentas_bom_dia', plannerSection: 'calendar' },
    '/ferramentas/coordenacao/desempenho': { tab: 'ferramentas_coord_desempenho', plannerSection: 'calendar' },
    '/ferramentas/coordenacao/planilhas': { tab: 'ferramentas_coord_planilhas', plannerSection: 'calendar' },
    '/gestao/equipe': { tab: 'equipe', plannerSection: 'calendar' },
    '/gestao/metas': { tab: 'metas', plannerSection: 'calendar' },
    '/gestao/importar-metas': { tab: 'metas_importacao', plannerSection: 'calendar' },
    '/gestao/tags': { tab: 'planner', plannerSection: 'tags' },
  };
  return routes[normalizedPath] ?? { tab: 'home', plannerSection: 'calendar' };
};

const dashboardPath = (tab: DashboardTab, plannerSection: PlannerSection) => {
  if (tab === 'planner_summary') return '/rotina/balanco';
  if (tab === 'planner') {
    if (plannerSection === 'tags') return '/gestao/tags';
    return {
      calendar: '/rotina/calendario',
      queue: '/rotina/fila',
      my_tasks: '/rotina/minhas-tarefas',
      tasks: '/rotina/semana',
    }[plannerSection];
  }
  const paths: Record<Exclude<DashboardTab, 'planner' | 'planner_summary'>, string> = {
    home: '/',
    canvas: '/vendas',
    fechamento_diario: '/vendas/fechamento-diario',
    resumo: '/resultados/desempenho',
    rank_semanal: '/resultados/ranking',
    comparador_precos: '/ferramentas/comparador-precos',
    mensagens: '/ferramentas/mensagens',
    ferramentas_bom_dia: '/ferramentas/bom-dia',
    ferramentas_coord_desempenho: '/ferramentas/coordenacao/desempenho',
    ferramentas_coord_planilhas: '/ferramentas/coordenacao/planilhas',
    equipe: '/gestao/equipe',
    metas: '/gestao/metas',
    metas_importacao: '/gestao/importar-metas',
  };
  return paths[tab];
};

export const R9Dashboard: React.FC = () => {
  const { currentUser, signOut, pendingProfiles } = useAuth();
  const { sales } = useSales();

  // Papel de quem está logado
  const isActualAdmin = currentUser?.role === 'admin';

  // Navigation & View States
  const [viewRole, setViewRole] = useState<'admin' | 'membro'>(
    currentUser?.role === 'admin' ? 'admin' : 'membro'
  );
  const [activeTab, setActiveTab] = useState<DashboardTab>(() => readDashboardRoute().tab);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isPlannerMenuOpen, setIsPlannerMenuOpen] = useState(() => readDashboardRoute().tab === 'planner' || readDashboardRoute().tab === 'planner_summary');
  const [isSalesMenuOpen, setIsSalesMenuOpen] = useState(() => window.location.pathname.startsWith('/vendas/'));
  const [isPerformanceMenuOpen, setIsPerformanceMenuOpen] = useState(() => window.location.pathname.startsWith('/resultados/'));
  const [isAdminMenuOpen, setIsAdminMenuOpen] = useState(() => window.location.pathname.startsWith('/gestao/'));
  const [isToolsMenuOpen, setIsToolsMenuOpen] = useState(() => window.location.pathname.startsWith('/ferramentas/'));
  const [plannerSection, setPlannerSection] = useState<PlannerSection>(() => readDashboardRoute().plannerSection);
  const [showNewSaleModal, setShowNewSaleModal] = useState(false);

  // Keep viewRole aligned if user changes
  useEffect(() => {
    if (currentUser?.role !== 'admin') {
      setViewRole('membro');
    } else {
      setViewRole('admin');
    }
  }, [currentUser?.role]);

  useEffect(() => {
    const path = dashboardPath(activeTab, plannerSection);
    if (window.location.pathname !== path) window.history.pushState(null, '', path);
  }, [activeTab, plannerSection]);

  useEffect(() => {
    if (activeTab === 'canvas' || activeTab === 'fechamento_diario') setIsSalesMenuOpen(true);
    if (activeTab === 'planner' || activeTab === 'planner_summary') setIsPlannerMenuOpen(true);
    if (activeTab === 'resumo' || activeTab === 'rank_semanal') setIsPerformanceMenuOpen(true);
    if (activeTab.startsWith('ferramentas_') || activeTab === 'comparador_precos' || activeTab === 'mensagens') setIsToolsMenuOpen(true);
    if (isActualAdmin && viewRole === 'admin' && (activeTab === 'equipe' || activeTab === 'metas' || activeTab === 'metas_importacao' || (activeTab === 'planner' && plannerSection === 'tags'))) setIsAdminMenuOpen(true);
  }, [activeTab, plannerSection, isActualAdmin, viewRole]);

  useEffect(() => {
    const handlePopState = () => {
      const route = readDashboardRoute();
      setActiveTab(route.tab);
      setPlannerSection(route.plannerSection);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Security guard: Non-admin or member view mode cannot view admin team management
  useEffect(() => {
    if ((!isActualAdmin || viewRole === 'membro') && (activeTab === 'equipe' || activeTab === 'metas' || activeTab === 'metas_importacao' || (activeTab === 'planner' && plannerSection === 'tags'))) {
      setActiveTab('home');
      setPlannerSection('calendar');
    }
  }, [isActualAdmin, viewRole, activeTab, plannerSection]);

  const isPlannerArea = activeTab === 'planner' || activeTab === 'planner_summary';

  const openPlannerSection = (section: 'calendar' | 'queue' | 'my_tasks' | 'tasks' | 'tags') => {
    setPlannerSection(section);
    setActiveTab('planner');
    setIsPlannerMenuOpen(true);
  };

  const openPlannerSummary = () => {
    setActiveTab('planner_summary');
    setIsPlannerMenuOpen(true);
  };

  const handlePlannerSectionChange = useCallback((section: 'calendar' | 'queue' | 'my_tasks' | 'tasks' | 'tags' | 'summary') => {
    if (section === 'summary') {
      setActiveTab('planner_summary');
      setIsPlannerMenuOpen(true);
      return;
    }
    setPlannerSection(section);
    setActiveTab('planner');
    setIsPlannerMenuOpen(true);
  }, []);

  // Computed today's sales count (Boletos do Dia) - Estritamente pela Data da Venda de HOJE
  const todayFormatted = getTodayBrDate();
  const boletosDoDiaCount = sales.filter(s => {
    const saleDate = getSaleDateBr(s);
    return saleDate === todayFormatted;
  }).length;

  // Nome e iniciais exibidos no menu
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
                  <div className="text-white font-black tracking-tight text-lg font-['Space_Grotesk']">R9 HUB</div>
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
            
            {/* Perfil de quem está logado */}
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
                      {userRoleText} • R9 Hub
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

            {/* Botão Lançar Venda */}
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

            {isSidebarCollapsed && (
              <div className="space-y-1 pt-2">
                <button onClick={() => setActiveTab('canvas')} title="Vendas" aria-label="Vendas" className="w-full h-10 flex items-center justify-center rounded-xl text-slate-300 hover:bg-white/10 hover:text-white cursor-pointer"><FileSpreadsheet className="w-4 h-4" /></button>
                <button onClick={() => openPlannerSection('calendar')} title="Minha Rotina" aria-label="Minha Rotina" className="w-full h-10 flex items-center justify-center rounded-xl text-slate-300 hover:bg-white/10 hover:text-white cursor-pointer"><ClipboardList className="w-4 h-4" /></button>
                <button onClick={() => setActiveTab('resumo')} title="Resultados" aria-label="Resultados" className="w-full h-10 flex items-center justify-center rounded-xl text-slate-300 hover:bg-white/10 hover:text-white cursor-pointer"><TrendingUp className="w-4 h-4" /></button>
                <button onClick={() => setActiveTab('ferramentas_bom_dia')} title="Ferramentas" aria-label="Ferramentas" className="w-full h-10 flex items-center justify-center rounded-xl text-slate-300 hover:bg-white/10 hover:text-white cursor-pointer"><Wrench className="w-4 h-4" /></button>
                {isActualAdmin && viewRole === 'admin' && <button onClick={() => setActiveTab('equipe')} title="Gestão" aria-label="Gestão" className="w-full h-10 flex items-center justify-center rounded-xl text-slate-300 hover:bg-white/10 hover:text-white cursor-pointer"><Shield className="w-4 h-4" /></button>}
              </div>
            )}

            {/* Vendas */}
            {!isSidebarCollapsed && (
              <div className="space-y-1 pt-2">
                <button
                  id="nav-vendas-operacao"
                  onClick={() => setIsSalesMenuOpen((open) => !open)}
                  aria-expanded={isSalesMenuOpen}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-colors cursor-pointer ${
                    activeTab === 'canvas' || activeTab === 'fechamento_diario'
                      ? 'bg-blue-500/15 text-blue-200 font-semibold'
                      : 'text-slate-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <FileSpreadsheet className="w-3.5 h-3.5 text-blue-300" />
                    <span>Vendas</span>
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isSalesMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {isSalesMenuOpen && <div className="ml-3 pl-2 border-l border-slate-700/80 space-y-1 py-1">
                <button
                  id="nav-planilha-vendas"
                  onClick={() => setActiveTab('canvas')}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                    activeTab === 'canvas'
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

                </div>}
              </div>
            )}

            {/* Minha Rotina */}
            {!isSidebarCollapsed && (
              <div className="space-y-1 pt-2">
                <button
                  id="nav-minha-rotina"
                  onClick={() => {
                    if (activeTab !== 'planner' && activeTab !== 'planner_summary') {
                      setActiveTab('planner');
                      setPlannerSection('calendar');
                      setIsPlannerMenuOpen(true);
                    } else {
                      setIsPlannerMenuOpen((open) => !open);
                    }
                  }}
                  aria-expanded={isPlannerMenuOpen && isPlannerArea}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-colors cursor-pointer ${
                    isPlannerArea
                      ? 'bg-blue-500/15 text-blue-200 font-semibold'
                      : 'text-slate-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <ClipboardList className="w-3.5 h-3.5 text-blue-300" />
                    <span>Minha Rotina</span>
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isPlannerMenuOpen && isPlannerArea ? 'rotate-180' : ''}`} />
                </button>

                {isPlannerMenuOpen && isPlannerArea && (
                  <div className="ml-3 pl-2 border-l border-slate-700/80 space-y-1 py-1">
                    <button id="nav-planner-calendar" onClick={() => openPlannerSection('calendar')} className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs transition-colors cursor-pointer ${activeTab === 'planner' && plannerSection === 'calendar' ? 'bg-[#0052cc] text-white font-semibold shadow-sm' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`}>
                      <CalendarDays className="w-3.5 h-3.5" /><span>Calendário</span>
                    </button>
                    <button id="nav-planner-my-tasks" onClick={() => openPlannerSection('my_tasks')} className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs transition-colors cursor-pointer ${activeTab === 'planner' && plannerSection === 'my_tasks' ? 'bg-[#0052cc] text-white font-semibold shadow-sm' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`}>
                      <CheckSquare className="w-3.5 h-3.5" /><span>Minhas tarefas</span>
                    </button>
                    <button id="nav-planner-tasks" onClick={() => openPlannerSection('tasks')} className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs transition-colors cursor-pointer ${activeTab === 'planner' && plannerSection === 'tasks' ? 'bg-[#0052cc] text-white font-semibold shadow-sm' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`}>
                      <ListChecks className="w-3.5 h-3.5" /><span>Rotina da semana</span>
                    </button>
                    <button id="nav-planner-summary" onClick={openPlannerSummary} className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs transition-colors cursor-pointer ${activeTab === 'planner_summary' ? 'bg-[#0052cc] text-white font-semibold shadow-sm' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`}>
                      <CalendarCheck className="w-3.5 h-3.5" /><span>Balanço da semana</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Resultados */}
            {!isSidebarCollapsed && (
              <div className="space-y-1 pt-2">
                <button
                  id="nav-resultados-section"
                  onClick={() => setIsPerformanceMenuOpen((open) => !open)}
                  aria-expanded={isPerformanceMenuOpen}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-colors cursor-pointer ${
                    activeTab === 'resumo' || activeTab === 'rank_semanal'
                      ? 'bg-blue-500/15 text-blue-200 font-semibold'
                      : 'text-slate-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <TrendingUp className="w-3.5 h-3.5 text-blue-300" />
                    <span>Resultados</span>
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isPerformanceMenuOpen ? 'rotate-180' : ''}`} />
                </button>
                {isPerformanceMenuOpen && <div className="ml-3 pl-2 border-l border-slate-700/80 space-y-1 py-1">
                <button
                  id="nav-desempenho"
                  onClick={() => setActiveTab('resumo')}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs transition-colors cursor-pointer ${
                    activeTab === 'resumo'
                      ? 'bg-blue-500/15 text-blue-300 font-semibold'
                      : 'text-slate-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <BarChart3 className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Desempenho</span>
                </button>
                <button
                  id="nav-ranking"
                  onClick={() => setActiveTab('rank_semanal')}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs transition-colors cursor-pointer ${
                    activeTab === 'rank_semanal'
                      ? 'bg-blue-500/15 text-blue-300 font-semibold'
                      : 'text-slate-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Trophy className="w-3.5 h-3.5 text-amber-400" />
                  <span>Ranking</span>
                </button>
                </div>}
              </div>
            )}

            {/* Section: Ferramentas */}
            {!isSidebarCollapsed && (
              <div className="space-y-1 pt-2">
                <button
                  id="nav-ferramentas-section"
                  onClick={() => setIsToolsMenuOpen((open) => !open)}
                  aria-expanded={isToolsMenuOpen}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-colors cursor-pointer ${
                    activeTab.startsWith('ferramentas_') || activeTab === 'comparador_precos' || activeTab === 'mensagens'
                      ? 'bg-blue-500/15 text-blue-200 font-semibold'
                      : 'text-slate-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Wrench className="w-3.5 h-3.5 text-blue-300" />
                    <span>Ferramentas</span>
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isToolsMenuOpen ? 'rotate-180' : ''}`} />
                </button>
                {isToolsMenuOpen && <div className="ml-3 pl-2 border-l border-slate-700/80 space-y-1 py-1">
                <button id="nav-comparador-precos" onClick={() => setActiveTab('comparador_precos')} className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs transition-colors cursor-pointer ${activeTab === 'comparador_precos' ? 'bg-blue-500/15 text-blue-300 font-semibold' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`}>
                  <Scale className="w-3.5 h-3.5 text-blue-300" /><span>Comparador de preços</span>
                </button>
                <button id="nav-mensagens" onClick={() => setActiveTab('mensagens')} className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs transition-colors cursor-pointer ${activeTab === 'mensagens' ? 'bg-blue-500/15 text-blue-300 font-semibold' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`}>
                  <MessageSquareText className="w-3.5 h-3.5 text-blue-300" /><span>Repositório de Mensagens</span>
                </button>
                <button
                  id="nav-ferramentas-bom-dia"
                  onClick={() => setActiveTab('ferramentas_bom_dia')}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs transition-colors cursor-pointer ${
                    activeTab === 'ferramentas_bom_dia'
                      ? 'bg-blue-500/15 text-blue-300 font-semibold'
                      : 'text-slate-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span className="whitespace-nowrap">Bom Dia Captação</span>
                </button>
                <button
                  id="nav-ferramentas-coord-desempenho"
                  onClick={() => setActiveTab('ferramentas_coord_desempenho')}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs transition-colors cursor-pointer ${
                    activeTab === 'ferramentas_coord_desempenho'
                      ? 'bg-blue-500/15 text-blue-300 font-semibold'
                      : 'text-slate-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Presentation className="w-3.5 h-3.5 text-teal-300" />
                  <span className="whitespace-nowrap">Coordenação - Desempenho</span>
                </button>
                <button
                  id="nav-ferramentas-coord-planilhas"
                  onClick={() => setActiveTab('ferramentas_coord_planilhas')}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs transition-colors cursor-pointer ${
                    activeTab === 'ferramentas_coord_planilhas'
                      ? 'bg-blue-500/15 text-blue-300 font-semibold'
                      : 'text-slate-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <FolderArchive className="w-3.5 h-3.5 text-teal-300" />
                  <span className="whitespace-nowrap">Coordenação - Planilhas</span>
                </button>
                </div>}
              </div>
            )}

            {isActualAdmin && viewRole === 'admin' && !isSidebarCollapsed && (
              <div className="space-y-1 pt-2">
                <button
                  id="nav-administracao-section"
                  onClick={() => setIsAdminMenuOpen((open) => !open)}
                  aria-expanded={isAdminMenuOpen}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-colors cursor-pointer ${
                    ['equipe', 'metas', 'metas_importacao'].includes(activeTab) || (activeTab === 'planner' && plannerSection === 'tags')
                      ? 'bg-blue-500/15 text-blue-200 font-semibold'
                      : 'text-slate-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Shield className="w-3.5 h-3.5 text-blue-300" />
                    <span>Gestão</span>
                    {pendingProfiles.length > 0 && (
                      <span className="text-[10px] font-bold text-amber-950 bg-amber-400 rounded-full px-1.5 min-w-[18px] text-center" title="Cadastros aguardando autorização">
                        {pendingProfiles.length}
                      </span>
                    )}
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isAdminMenuOpen ? 'rotate-180' : ''}`} />
                </button>
                {isAdminMenuOpen && <div className="ml-3 pl-2 border-l border-slate-700/80 space-y-1 py-1">
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
                  {pendingProfiles.length > 0 ? (
                    <span className="text-[10px] font-bold text-amber-950 bg-amber-400 px-1.5 py-0.5 rounded" title="Cadastros aguardando autorização">
                      {pendingProfiles.length} pendente{pendingProfiles.length > 1 ? 's' : ''}
                    </span>
                  ) : (
                    <span className="text-[10px] font-medium text-purple-200 bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 rounded">
                      perfis
                    </span>
                  )}
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
                  id="nav-gerenciar-tags"
                  onClick={() => openPlannerSection('tags')}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${activeTab === 'planner' && plannerSection === 'tags' ? 'bg-blue-500/15 text-blue-200 font-semibold' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`}
                >
                  <Tag className="w-3.5 h-3.5 text-blue-300" />
                  <span className="whitespace-nowrap">Gerenciar Tags</span>
                </button>

                </div>}
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
           <ErrorBoundary key={activeTab}>
           <Suspense fallback={<TabLoading />}>
            
            {/* Planner integrado — compartilha a sessão autenticada do R9 Hub */}
            {(activeTab === 'planner' || activeTab === 'planner_summary') && currentUser && (
              <div className="animate-in fade-in duration-200 -m-1 sm:-m-2">
                <Planner
                  user={{
                    id: currentUser.id,
                    email: currentUser.email,
                    user_metadata: { full_name: currentUser.name, nome: currentUser.name },
                  }}
                  viewRole={viewRole}

                  section={activeTab === 'planner_summary' ? 'summary' : plannerSection}
                  onSectionChange={handlePlannerSectionChange}
                />
              </div>
            )}

            {/* Home dashboard */}
            {activeTab === 'home' && (
              <HomeDashboard
                onOpenNewSaleModal={() => setShowNewSaleModal(true)}
                onOpenPerformance={() => setActiveTab('resumo')}
                onOpenRanking={() => setActiveTab('rank_semanal')}
                isAdminView={isActualAdmin && viewRole === 'admin'}
                onOpenGoalImport={isActualAdmin && viewRole === 'admin' ? () => setActiveTab('metas_importacao') : undefined}
              />
            )}

            {/* View switcher based on sidebar selection */}
            {activeTab === 'canvas' && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div>
                  <h2 className="text-lg font-bold text-gray-900 font-['Space_Grotesk']">Vendas</h2>
                  <p className="text-xs text-gray-500 mt-0.5">Consulte, filtre, corrija e exporte as vendas da equipe.</p>
                </div>
                <SalesSpreadsheetTable
                  initialPeriod="all"
                  onOpenNewSaleModal={() => setShowNewSaleModal(true)}
                />
              </div>
            )}

            {activeTab === 'resumo' && (
              <PerformancePage onOpenNewSaleModal={() => setShowNewSaleModal(true)} />
            )}

            {activeTab === 'fechamento_diario' && (
              <DailyClosingView 
                onOpenNewSaleModal={() => setShowNewSaleModal(true)}
              />
            )}

            {activeTab === 'rank_semanal' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <LiveTeamLeaderboard period="semanal" />
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

            {activeTab === 'mensagens' && <MessageRepository />}

            {activeTab === 'comparador_precos' && (
              <PriceComparatorPage canManage={isActualAdmin && viewRole === 'admin'} />
            )}

            {activeTab === 'ferramentas_bom_dia' && <BomDiaGeneratorPage />}
            {activeTab === 'ferramentas_coord_desempenho' && <DesempenhoCursosPage />}
            {activeTab === 'ferramentas_coord_planilhas' && <PlanilhasPorCursoPage />}

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

           </Suspense>
           </ErrorBoundary>
          </div>

        </main>

      </div>

      {/* 3. MODAL: + NOVA VENDA _ */}
      {/* Só carrega o formulário quando ele é aberto pela primeira vez (ele já recomeça vazio a cada abertura). */}
      {showNewSaleModal && (
        <Suspense fallback={null}>
          <NewSaleModal isOpen onClose={() => setShowNewSaleModal(false)} />
        </Suspense>
      )}

    </div>
  );
};

export default R9Dashboard;
