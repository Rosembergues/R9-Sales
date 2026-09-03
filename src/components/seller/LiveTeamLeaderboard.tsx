import React from 'react';
import { useSales } from '../../context/SalesContext';
import { useAuth } from '../../context/AuthContext';
import { Trophy, Crown, Flame } from 'lucide-react';

interface LiveTeamLeaderboardProps {
  period?: 'semanal' | 'mensal';
}

export const LiveTeamLeaderboard: React.FC<LiveTeamLeaderboardProps> = ({ period = 'semanal' }) => {
  const { leaderboard } = useSales();
  const { currentUser } = useAuth();

  const topThree = leaderboard.slice(0, 3);
  const isMonthly = period === 'mensal';

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 font-['Space_Grotesk'] flex items-center gap-2">
            {isMonthly ? (
              <Crown className="w-5 h-5 text-purple-600" />
            ) : (
              <Trophy className="w-5 h-5 text-amber-500" />
            )}
            <span>{isMonthly ? 'Ranking Mensal da Equipe' : 'Ranking Semanal da Equipe'}</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Classificação oficial baseada na <strong>quantidade de boletos e matrículas</strong> confirmadas
          </p>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold self-start sm:self-auto">
          <Flame className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
          <span>Classificação por Boletos</span>
        </div>
      </div>

      {/* Top 3 Podium Visual Cards */}
      {topThree.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end pt-2">
          
          {/* 2nd Place (Silver) */}
          {topThree[1] && (
            <div className="p-5 pt-7 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col items-center text-center relative order-2 md:order-1">
              <div className="absolute -top-3 px-3 py-0.5 rounded-full bg-slate-200 text-slate-800 font-bold text-xs shadow-xs">
                2º LUGAR
              </div>
              
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-1.5">
                {topThree[1].name}
                {topThree[1].seller_id === currentUser?.id && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-600 text-white font-bold">Você</span>
                )}
              </h3>
              
              {/* Boletos Count */}
              <div className="text-3xl font-black text-slate-800 mt-1 font-['Space_Grotesk']">
                {topThree[1].total_sales} <span className="text-sm font-semibold text-slate-500">{topThree[1].total_sales === 1 ? 'Boleto' : 'Boletos'}</span>
              </div>

              {/* Product breakdown */}
              <div className="flex items-center gap-1.5 text-xs text-slate-600 mt-3 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                <span>Grad: <strong className="text-slate-800">{topThree[1].graduacao_count || 0}</strong></span>
                <span>•</span>
                <span>Pós: <strong className="text-slate-800">{topThree[1].pos_count || 0}</strong></span>
                <span>•</span>
                <span>Téc: <strong className="text-slate-800">{topThree[1].tecnico_count || 0}</strong></span>
              </div>
            </div>
          )}

          {/* 1st Place (Gold / Champion) */}
          {topThree[0] && (
            <div className="p-6 pt-8 rounded-2xl bg-white border-2 border-amber-400 shadow-sm flex flex-col items-center text-center relative order-1 md:order-2 md:-translate-y-2">
              <div className="absolute -top-4 px-4 py-1 rounded-full bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 font-bold text-xs shadow-xs flex items-center gap-1">
                <Crown className="w-3.5 h-3.5 fill-current" />
                CAMPEÃO (1º LUGAR)
              </div>
              
              <h3 className="font-bold text-slate-900 text-lg flex items-center gap-1.5">
                {topThree[0].name}
                {topThree[0].seller_id === currentUser?.id && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-600 text-white font-bold">Você</span>
                )}
              </h3>
              
              {/* Boletos Count */}
              <div className="text-4xl font-black text-amber-600 mt-1 font-['Space_Grotesk']">
                {topThree[0].total_sales} <span className="text-base font-semibold text-amber-700">{topThree[0].total_sales === 1 ? 'Boleto' : 'Boletos'}</span>
              </div>

              {/* Product breakdown */}
              <div className="flex items-center gap-2 text-xs text-slate-700 mt-3 bg-amber-50/70 px-3.5 py-1.5 rounded-lg border border-amber-200/70">
                <span>Graduação: <strong className="text-slate-900">{topThree[0].graduacao_count || 0}</strong></span>
                <span>•</span>
                <span>Pós: <strong className="text-slate-900">{topThree[0].pos_count || 0}</strong></span>
                <span>•</span>
                <span>Técnico: <strong className="text-slate-900">{topThree[0].tecnico_count || 0}</strong></span>
              </div>
            </div>
          )}

          {/* 3rd Place (Bronze) */}
          {topThree[2] && (
            <div className="p-5 pt-7 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col items-center text-center relative order-3 md:order-3">
              <div className="absolute -top-3 px-3 py-0.5 rounded-full bg-amber-600 text-white font-bold text-xs shadow-xs">
                3º LUGAR
              </div>
              
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-1.5">
                {topThree[2].name}
                {topThree[2].seller_id === currentUser?.id && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-600 text-white font-bold">Você</span>
                )}
              </h3>
              
              {/* Boletos Count */}
              <div className="text-3xl font-black text-amber-700 mt-1 font-['Space_Grotesk']">
                {topThree[2].total_sales} <span className="text-sm font-semibold text-slate-500">{topThree[2].total_sales === 1 ? 'Boleto' : 'Boletos'}</span>
              </div>

              {/* Product breakdown */}
              <div className="flex items-center gap-1.5 text-xs text-slate-600 mt-3 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                <span>Grad: <strong className="text-slate-800">{topThree[2].graduacao_count || 0}</strong></span>
                <span>•</span>
                <span>Pós: <strong className="text-slate-800">{topThree[2].pos_count || 0}</strong></span>
                <span>•</span>
                <span>Téc: <strong className="text-slate-800">{topThree[2].tecnico_count || 0}</strong></span>
              </div>
            </div>
          )}

        </div>
      )}

      {/* Leaderboard Full Table */}
      <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-xs">
        <div className="px-6 py-4 bg-slate-50/75 border-b border-slate-200 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Tabela Geral de Classificação da Equipe
          </span>
          <span className="text-xs text-slate-500">Total de {leaderboard.length} colaboradores</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm text-slate-600">
            <thead className="bg-slate-50/50 border-b border-slate-200 uppercase font-semibold text-slate-500 text-[11px] tracking-wider">
              <tr>
                <th className="py-3 px-4 sm:px-6 w-16">Posição</th>
                <th className="py-3 px-4">Colaborador</th>
                <th className="py-3 px-4 font-bold text-slate-900">Total Boletos</th>
                <th className="py-3 px-4 hidden sm:table-cell">Graduação</th>
                <th className="py-3 px-4 hidden sm:table-cell">Pós-Graduação</th>
                <th className="py-3 px-4 hidden sm:table-cell">Técnico</th>
                <th className="py-3 px-4 sm:px-6 text-right">Progresso da Meta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {leaderboard.map((seller) => {
                const isCurrent = seller.seller_id === currentUser?.id;

                return (
                  <tr
                    key={seller.seller_id}
                    className={`transition-colors ${
                      isCurrent
                        ? 'bg-blue-50/60 border-l-4 border-blue-600'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    {/* Rank position badge */}
                    <td className="py-3.5 px-4 sm:px-6 font-bold">
                      <div className="flex items-center gap-1.5">
                        {seller.position === 1 ? (
                          <span className="w-6 h-6 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center font-black text-xs shadow-xs">
                            1
                          </span>
                        ) : seller.position === 2 ? (
                          <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-800 flex items-center justify-center font-bold text-xs">
                            2
                          </span>
                        ) : seller.position === 3 ? (
                          <span className="w-6 h-6 rounded-full bg-amber-600 text-white flex items-center justify-center font-bold text-xs">
                            3
                          </span>
                        ) : (
                          <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs">
                            {seller.position}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Colaborador */}
                    <td className="py-3.5 px-4">
                      <div>
                        <div className="font-bold text-slate-900 flex items-center gap-2">
                          <span>{seller.name}</span>
                          {isCurrent && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-600 text-white font-bold">
                              Você
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-500">{seller.email}</span>
                      </div>
                    </td>

                    {/* Total Boletos */}
                    <td className="py-3.5 px-4 font-black text-slate-900 text-sm">
                      <span className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg border border-blue-200/80 font-bold">
                        {seller.total_sales} {seller.total_sales === 1 ? 'boleto' : 'boletos'}
                      </span>
                    </td>

                    {/* Graduação */}
                    <td className="py-3.5 px-4 hidden sm:table-cell text-slate-700 font-semibold">
                      {seller.graduacao_count || 0}
                    </td>

                    {/* Pós */}
                    <td className="py-3.5 px-4 hidden sm:table-cell text-slate-700 font-semibold">
                      {seller.pos_count || 0}
                    </td>

                    {/* Técnico */}
                    <td className="py-3.5 px-4 hidden sm:table-cell text-slate-700 font-semibold">
                      {seller.tecnico_count || 0}
                    </td>

                    {/* Meta Progresso */}
                    <td className="py-3.5 px-4 sm:px-6 text-right">
                      <div className="inline-block space-y-1 text-right">
                        <div className="flex items-center justify-end gap-2 text-[11px]">
                          <span className="font-bold text-emerald-600">{seller.percentage_reached}%</span>
                          <span className="text-slate-500">({seller.total_sales}/{seller.target} boletos)</span>
                        </div>
                        <div className="w-28 sm:w-36 h-1.5 bg-slate-100 rounded-full overflow-hidden ml-auto">
                          <div
                            className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full"
                            style={{ width: `${Math.min(seller.percentage_reached, 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
