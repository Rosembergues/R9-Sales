import React from 'react';
import { useSales } from '../../context/SalesContext';
import { useAuth } from '../../context/AuthContext';
import { Target, TrendingUp, Award, DollarSign, Calendar, Zap, CheckCircle } from 'lucide-react';

export const GoalProgressTracker: React.FC = () => {
  const { currentUser } = useAuth();
  const { getSellerStats } = useSales();

  if (!currentUser) return null;

  const stats = getSellerStats(currentUser.id);
  const remainingForGoal = Math.max(0, stats.target - stats.totalRevenue);
  const isGoalReached = stats.targetPercentage >= 100;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      
      {/* Target Progress Card */}
      <div className="md:col-span-2 p-5 rounded-2xl bg-white border border-slate-200 shadow-xs relative overflow-hidden flex flex-col justify-between">
        
        <div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
                <Target className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 font-['Space_Grotesk']">
                  Meta Individual do Mês
                </h3>
                <p className="text-xs text-slate-500">
                  Progresso pessoal atualizado instantaneamente a cada venda
                </p>
              </div>
            </div>

            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
              isGoalReached 
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
            }`}>
              {isGoalReached ? '🎉 Meta Superada!' : `${stats.targetPercentage}% Atingido`}
            </span>
          </div>

          {/* Large Numbers */}
          <div className="mt-5 grid grid-cols-2 gap-4">
            <div>
              <span className="text-xs text-slate-500 block">Total Realizado:</span>
              <div className="text-2xl sm:text-3xl font-black text-emerald-600 font-['Space_Grotesk']">
                R$ {stats.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
            </div>

            <div>
              <span className="text-xs text-slate-500 block">Meta Estipulada:</span>
              <div className="text-xl sm:text-2xl font-bold text-slate-700 font-['Space_Grotesk']">
                R$ {stats.target.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-4 space-y-1.5">
            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 via-teal-500 to-emerald-500 rounded-full transition-all duration-700 shadow-xs"
                style={{ width: `${Math.min(stats.targetPercentage, 100)}%` }}
              />
            </div>
            
            <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
              <span>{stats.totalSales} {stats.totalSales === 1 ? 'venda aprovada' : 'vendas aprovadas'}</span>
              <span>
                {remainingForGoal > 0 ? (
                  <>Faltam <strong className="text-slate-700">R$ {remainingForGoal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></>
                ) : (
                  <span className="text-emerald-600 font-bold">Meta 100% batida!</span>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Motivational pill */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
          <span className="text-slate-600 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            Posição na Equipe: <strong className="text-slate-900 font-bold">{stats.rankPosition}º Lugar</strong>
          </span>
          <span className="text-slate-600">
            Ticket Médio: <strong className="text-slate-900">R$ {stats.averageTicket.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}</strong>
          </span>
        </div>

      </div>

      {/* Accumulated Commission Card */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between">
        
        <div>
          <div className="flex items-center justify-between text-xs text-indigo-700 font-semibold mb-3">
            <span className="flex items-center gap-1.5">
              <Award className="w-4 h-4 text-indigo-600" />
              Comissões Conquistadas
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-mono font-medium border border-indigo-100">
              Live
            </span>
          </div>

          <div className="text-2xl sm:text-3xl font-black text-slate-900 font-['Space_Grotesk']">
            R$ {stats.commissionEarned.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Ganhos acumulados no período atual
          </p>

          <div className="mt-4 space-y-2 text-xs">
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <span className="text-slate-500">Total de Fechamentos:</span>
              <span className="font-bold text-slate-900">{stats.totalSales}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <span className="text-slate-500">Status no Ranking:</span>
              <span className="font-bold text-amber-600">{stats.rankPosition}º Colocado</span>
            </div>
          </div>
        </div>

        <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-center gap-1">
          <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span>Valores liberados automaticamente após aprovação</span>
        </div>

      </div>

    </div>
  );
};
