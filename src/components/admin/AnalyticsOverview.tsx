import React, { useState } from 'react';
import { useSales } from '../../context/SalesContext';
import { useAuth } from '../../context/AuthContext';
import { SaleStatus } from '../../types';
import { 
  TrendingUp, 
  DollarSign, 
  ShoppingBag, 
  Percent, 
  Award, 
  Download, 
  Filter, 
  Search, 
  CheckCircle, 
  Clock, 
  AlertTriangle,
  ArrowUpRight,
  CreditCard,
  Building,
  Sparkles
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  PieChart, 
  Pie, 
  Cell, 
  LineChart, 
  Line 
} from 'recharts';

export const AnalyticsOverview: React.FC = () => {
  const { 
    sales, 
    leaderboard, 
    totalCompanyRevenue, 
    totalCompanySalesCount, 
    overallTargetPercentage, 
    totalCompanyCommission, 
    averageTicket,
    exportSalesToCSV,
    updateSaleStatus
  } = useSales();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Chart data: Sales by Seller
  const sellerPerformanceData = leaderboard.map(l => ({
    name: l.name.split(' ')[0],
    total: l.total_value,
    salesCount: l.total_sales,
    target: l.target,
    percent: l.percentage_reached,
  }));

  // Chart data: Sales by Payment Method
  const paymentMethodCount: Record<string, number> = {};
  sales.forEach(s => {
    paymentMethodCount[s.payment_method] = (paymentMethodCount[s.payment_method] || 0) + s.value;
  });

  const paymentColors: Record<string, string> = {
    'PIX': '#10b981',
    'Cartão de Crédito': '#6366f1',
    'Boleto Bancário': '#f59e0b',
    'Faturado / Transferência': '#3b82f6',
  };

  const paymentData = Object.entries(paymentMethodCount).map(([name, value]) => ({
    name,
    value,
    color: paymentColors[name] || '#8b5cf6',
  }));

  // Filter sales
  const filteredSales = sales.filter(s => {
    const matchesSearch = 
      s.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.seller_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.product_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      
      {/* Top Banner & Export */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 font-['Space_Grotesk'] flex items-center gap-2.5">
            <TrendingUp className="w-5 h-5 text-indigo-600" />
            Painel Gerencial Consolidado
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Métricas de faturamento, volume de transações e desempenho da equipe em tempo real.
          </p>
        </div>

        <button
          id="export-csv-btn"
          onClick={exportSalesToCSV}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs sm:text-sm font-bold shadow-xs transition-all self-start sm:self-auto"
        >
          <Download className="w-4 h-4 text-indigo-600" />
          <span>Exportar Relatório CSV</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        
        {/* Faturamento Total */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold mb-2">
            <span>Faturamento Total</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 font-['Space_Grotesk']">
            R$ {totalCompanyRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-emerald-700 flex items-center gap-1 mt-1 font-medium">
            <ArrowUpRight className="w-3 h-3" />
            <span>Atualizado em tempo real</span>
          </div>
        </div>

        {/* Quantidade de Vendas */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold mb-2">
            <span>Volume de Vendas</span>
            <ShoppingBag className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 font-['Space_Grotesk']">
            {totalCompanySalesCount} <span className="text-xs text-slate-500 font-normal">fechamentos</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Média por vendedor: {(totalCompanySalesCount / Math.max(leaderboard.length, 1)).toFixed(1)}
          </div>
        </div>

        {/* Ticket Médio */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold mb-2">
            <span>Ticket Médio</span>
            <Building className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 font-['Space_Grotesk']">
            R$ {averageTicket.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Por contrato/venda
          </div>
        </div>

        {/* Meta da Empresa % */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold mb-2">
            <span>Meta da Empresa</span>
            <Percent className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-700 font-['Space_Grotesk']">
            {overallTargetPercentage}%
          </div>
          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mt-2">
            <div 
              className="h-full bg-emerald-600 rounded-full"
              style={{ width: `${overallTargetPercentage}%` }}
            />
          </div>
        </div>

        {/* Comissões Totais */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold mb-2">
            <span>Total Comissões</span>
            <Award className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 font-['Space_Grotesk']">
            R$ {totalCompanyCommission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Geradas para a equipe
          </div>
        </div>

      </div>

      {/* Visual Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Desempenho por Vendedor Bar Chart */}
        <div className="lg:col-span-8 p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Award className="w-4 h-4 text-indigo-600" />
              Comparativo de Faturamento por Vendedor
            </h3>
            <span className="text-xs text-slate-500">Valores em R$</span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sellerPerformanceData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 12 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '12px', color: '#0f172a', fontSize: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(val: any) => [`R$ ${Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Faturamento']}
                />
                <Bar dataKey="total" fill="#4f46e5" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Formas de Pagamento Donut Chart */}
        <div className="lg:col-span-4 p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4 flex flex-col justify-between">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-emerald-600" />
            Vendas por Forma de Pagamento
          </h3>

          <div className="h-48 w-full flex items-center justify-center">
            {paymentData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {paymentData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '12px', color: '#0f172a', fontSize: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(val: any) => [`R$ ${Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Valor']}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-slate-400">Sem dados</p>
            )}
          </div>

          <div className="space-y-1.5 text-xs">
            {paymentData.map(p => (
              <div key={p.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                  <span className="text-slate-600">{p.name}</span>
                </div>
                <span className="font-semibold text-slate-900">
                  R$ {p.value.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                </span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Sales Transactions Feed / Table */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="text-base font-bold text-slate-900 font-['Space_Grotesk'] flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-emerald-600" />
            Registro Geral de Vendas Lançadas ({filteredSales.length})
          </h3>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                placeholder="Filtrar por cliente, vendedor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 w-48 sm:w-60 shadow-xs"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-indigo-500 shadow-xs"
            >
              <option value="all">Todos os Status</option>
              <option value="Aprovada">Aprovadas</option>
              <option value="Pendente">Pendentes</option>
              <option value="Em Análise">Em Análise</option>
            </select>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 border-b border-slate-200 uppercase font-semibold text-slate-500 text-[11px] tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Data & ID</th>
                  <th className="py-3.5 px-4">Cliente</th>
                  <th className="py-3.5 px-4">Vendedor</th>
                  <th className="py-3.5 px-4">Produto / Serviço</th>
                  <th className="py-3.5 px-4">Valor (R$)</th>
                  <th className="py-3.5 px-4">Pagamento</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Ação Admin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSales.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      Nenhuma venda encontrada com os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  filteredSales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono text-[11px]">
                        <div className="text-slate-900">{new Date(sale.created_at).toLocaleDateString('pt-BR')}</div>
                        <span className="text-slate-400">{sale.id}</span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {sale.client_name}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-medium text-slate-700">{sale.seller_name}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {sale.product_name}
                      </td>
                      <td className="py-3 px-4 font-bold text-emerald-700">
                        R$ {sale.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        {sale.payment_method}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full font-semibold text-[10px] ${
                          sale.status === 'Aprovada'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : sale.status === 'Pendente'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}>
                          {sale.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <select
                          value={sale.status}
                          onChange={(e) => updateSaleStatus(sale.id, e.target.value as SaleStatus)}
                          className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-[11px] text-slate-700 focus:outline-none focus:border-indigo-500"
                        >
                          <option value="Aprovada">Aprovar</option>
                          <option value="Pendente">Pendente</option>
                          <option value="Em Análise">Em Análise</option>
                        </select>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

    </div>
  );
};
