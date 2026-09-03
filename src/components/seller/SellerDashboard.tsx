import React, { useState } from 'react';
import { QuickSaleLogger } from './QuickSaleLogger';
import { GoalProgressTracker } from './GoalProgressTracker';
import { LiveTeamLeaderboard } from './LiveTeamLeaderboard';
import { SellerSalesHistory } from './SellerSalesHistory';
import { Zap, Trophy, History, Target, TrendingUp } from 'lucide-react';

export const SellerDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'quick-sale' | 'leaderboard' | 'history'>('quick-sale');

  return (
    <div className="space-y-6">
      
      {/* Top Goal Progress Summary (Always visible for real-time motivation) */}
      <GoalProgressTracker />

      {/* Seller Sub-navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-1.5 rounded-2xl bg-white border border-slate-200 shadow-xs">
        <div className="flex flex-wrap gap-1.5">
          
          <button
            id="seller-tab-quick-sale"
            onClick={() => setActiveTab('quick-sale')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
              activeTab === 'quick-sale'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Zap className="w-4 h-4 fill-current" />
            <span>Lançamento Rápido de Vendas</span>
          </button>

          <button
            id="seller-tab-leaderboard"
            onClick={() => setActiveTab('leaderboard')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
              activeTab === 'leaderboard'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Trophy className="w-4 h-4" />
            <span>Ranking da Equipe Ao Vivo</span>
          </button>

          <button
            id="seller-tab-history"
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
              activeTab === 'history'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Histórico de Vendas</span>
          </button>

        </div>

        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Feed de Vendas Conectado Ao Vivo</span>
        </div>
      </div>

      {/* Tab Views */}
      <div className="animate-in fade-in duration-200">
        {activeTab === 'quick-sale' && (
          <div className="space-y-6">
            <QuickSaleLogger />
            <SellerSalesHistory />
          </div>
        )}
        {activeTab === 'leaderboard' && <LiveTeamLeaderboard />}
        {activeTab === 'history' && <SellerSalesHistory />}
      </div>

    </div>
  );
};
