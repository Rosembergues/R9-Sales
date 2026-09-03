import React, { useState } from 'react';
import { useSales } from '../../context/SalesContext';
import { Campaign } from '../../types';
import { 
  FileSpreadsheet, 
  Plus, 
  CheckCircle2, 
  XCircle, 
  Percent, 
  Target, 
  Calendar, 
  Sliders, 
  Trash2, 
  Layers, 
  Sparkles,
  ExternalLink,
  Copy,
  Check
} from 'lucide-react';
import { CreateCampaignModal } from './CreateCampaignModal';

export const CampaignsManager: React.FC = () => {
  const { campaigns, sales, toggleCampaignStatus, deleteCampaign } = useSales();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div className="space-y-6">
      
      {/* Header and Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 font-['Space_Grotesk'] flex items-center gap-2.5">
            <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
            Gerenciador de Formulários e Campanhas
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Substitua formulários estáticos como Microsoft Forms com formulários dinâmicos com validações, regras de comissão e metas em tempo real.
          </p>
        </div>

        <button
          id="create-campaign-btn"
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold shadow-xs transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Criar Nova Campanha / Formulário</span>
        </button>
      </div>

      {/* Campaigns Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {campaigns.map((campaign) => {
          const campaignSales = sales.filter(s => s.campaign_id === campaign.id);
          const totalSalesValue = campaignSales.reduce((acc, s) => acc + (Number(s.value) || 0), 0);
          const targetPercentage = campaign.target_amount > 0 
            ? Math.min(Math.round((totalSalesValue / campaign.target_amount) * 100), 100) 
            : 0;

          return (
            <div
              key={campaign.id}
              className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${
                campaign.active
                  ? 'bg-white border-slate-200 shadow-xs'
                  : 'bg-slate-50 border-slate-200 opacity-80'
              }`}
            >
              <div className="space-y-4">
                
                {/* Card Top: Code & Status Switch */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                      {campaign.code}
                    </span>
                    <button
                      onClick={() => handleCopyCode(campaign.code)}
                      className="text-slate-400 hover:text-slate-600 transition-colors"
                      title="Copiar código da campanha"
                    >
                      {copiedCode === campaign.code ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`text-[11px] font-bold uppercase ${
                      campaign.active ? 'text-emerald-700' : 'text-slate-400'
                    }`}>
                      {campaign.active ? 'Ativa' : 'Pausada'}
                    </span>
                    <button
                      onClick={() => toggleCampaignStatus(campaign.id)}
                      className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        campaign.active ? 'bg-emerald-600' : 'bg-slate-300'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          campaign.active ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Campaign Title & Description */}
                <div>
                  <h3 className="text-base font-bold text-slate-900 font-['Space_Grotesk'] leading-snug">
                    {campaign.title}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                    {campaign.description || 'Sem descrição cadastrada.'}
                  </p>
                </div>

                {/* Target & Revenue Progress Bar */}
                <div className="space-y-1.5 p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Arrecadação da Campanha:</span>
                    <span className="font-bold text-slate-900">
                      R$ {totalSalesValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      <span className="text-slate-500 text-[11px] font-normal"> / R$ {campaign.target_amount.toLocaleString('pt-BR')}</span>
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                      style={{ width: `${targetPercentage}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                    <span>{campaignSales.length} {campaignSales.length === 1 ? 'venda registrada' : 'vendas registradas'}</span>
                    <span className="font-bold text-emerald-700">{targetPercentage}% Atingido</span>
                  </div>
                </div>

                {/* Key Attributes */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="text-slate-400 text-[10px] block">Comissão Base</span>
                    <span className="font-bold text-indigo-700 flex items-center gap-1 mt-0.5">
                      <Percent className="w-3.5 h-3.5" />
                      {campaign.commission_rate}%
                    </span>
                  </div>

                  <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="text-slate-400 text-[10px] block">Campos Custom</span>
                    <span className="font-bold text-slate-700 flex items-center gap-1 mt-0.5">
                      <Sliders className="w-3.5 h-3.5 text-slate-400" />
                      {campaign.fields?.length || 0} campos
                    </span>
                  </div>

                  <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 col-span-2 sm:col-span-1">
                    <span className="text-slate-400 text-[10px] block">Validade</span>
                    <span className="font-medium text-slate-700 text-[11px] flex items-center gap-1 mt-0.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {new Date(campaign.end_date).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                </div>

                {/* Custom Fields Tags */}
                {campaign.fields && campaign.fields.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      Campos do Formulário Dinâmico:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {campaign.fields.map((f) => (
                        <span
                          key={f.id}
                          className="px-2 py-0.5 rounded-md text-[10px] bg-slate-100 text-slate-700 border border-slate-200 font-medium"
                        >
                          {f.label} ({f.type})
                        </span>
                      ))}
                    </div>
                  </div>
                )}

              </div>

              {/* Bottom Actions */}
              <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">
                  Criada em {new Date(campaign.created_at).toLocaleDateString('pt-BR')}
                </span>
                <button
                  onClick={() => deleteCampaign(campaign.id)}
                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                  title="Excluir Campanha"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

            </div>
          );
        })}
      </div>

      {showCreateModal && (
        <CreateCampaignModal onClose={() => setShowCreateModal(false)} />
      )}
    </div>
  );
};
