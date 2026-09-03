import React, { useState } from 'react';
import { UsersProfilesTable } from './UsersProfilesTable';
import { CampaignsManager } from './CampaignsManager';
import { AnalyticsOverview } from './AnalyticsOverview';
import { Users, FileSpreadsheet, TrendingUp, ShieldCheck, Sparkles } from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'users' | 'campaigns' | 'analytics'>('users');

  return (
    <div className="space-y-6">
      
      {/* Sub-navigation tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-2 rounded-2xl bg-white border border-slate-200 shadow-xs">
        <div className="flex flex-wrap gap-2">
          
          <button
            id="admin-tab-users"
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              activeTab === 'users'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Gestão de Usuários & Perfis</span>
          </button>

          <button
            id="admin-tab-campaigns"
            onClick={() => setActiveTab('campaigns')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              activeTab === 'campaigns'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Formulários & Campanhas</span>
          </button>

          <button
            id="admin-tab-analytics"
            onClick={() => setActiveTab('analytics')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              activeTab === 'analytics'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Métricas & Painel Gerencial</span>
          </button>

        </div>

        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-semibold">
          <ShieldCheck className="w-4 h-4 text-indigo-600" />
          <span>Acesso Exclusivo: Administrador</span>
        </div>
      </div>

      {/* Tab Content */}
      <div className="animate-in fade-in duration-200">
        {activeTab === 'users' && <UsersProfilesTable />}
        {activeTab === 'campaigns' && <CampaignsManager />}
        {activeTab === 'analytics' && <AnalyticsOverview />}
      </div>

    </div>
  );
};
