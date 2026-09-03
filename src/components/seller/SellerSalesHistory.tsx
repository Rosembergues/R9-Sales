import React, { useState } from 'react';
import { useSales } from '../../context/SalesContext';
import { useAuth } from '../../context/AuthContext';
import { Sale } from '../../types';
import { 
  ShoppingBag, 
  Search, 
  Filter, 
  Calendar, 
  CreditCard, 
  FileText, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  ExternalLink,
  DollarSign,
  Building2,
  Hash,
  Layers,
  BookOpen
} from 'lucide-react';

export const SellerSalesHistory: React.FC = () => {
  const { sales } = useSales();
  const { currentUser } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

  // Filter sales for the current seller or all sales if admin
  const sellerSales = sales.filter(s => currentUser?.role === 'admin' ? true : s.seller_id === currentUser?.id);
  
  const filteredSales = sellerSales.filter(s => {
    const opp = s.custom_data?.opportunity_number || '';
    const fdi = s.custom_data?.fdi_channel || '';
    const mod = s.custom_data?.modality || '';
    const cand = s.custom_data?.candidate_name || s.client_name || '';

    return (
      cand.toLowerCase().includes(searchTerm.toLowerCase()) ||
      opp.toLowerCase().includes(searchTerm.toLowerCase()) ||
      fdi.toLowerCase().includes(searchTerm.toLowerCase()) ||
      mod.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.payment_method.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.campaign_name && s.campaign_name.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  });

  return (
    <div className="space-y-4">
      
      {/* Search and Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-900 font-['Space_Grotesk'] flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-[#0052cc]" />
            Fila & Histórico de Oportunidades ({sellerSales.length})
          </h3>
          <p className="text-xs text-slate-500">
            Registro detalhado de matrículas, modalidades, turnos e condições de pagamento
          </p>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar por Nº oportunidade, candidato, FDI..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#0052cc] w-full sm:w-72 shadow-xs"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 uppercase font-bold text-slate-500 text-[11px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Oportunidade & Data</th>
                <th className="py-3 px-4">Candidato</th>
                <th className="py-3 px-4">Produto/Canal (FDI)</th>
                <th className="py-3 px-4">Modalidade & Turno</th>
                <th className="py-3 px-4">Condições Pagamento</th>
                <th className="py-3 px-4">Valor</th>
                <th className="py-3 px-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400">
                    Nenhuma venda encontrada com os filtros atuais.
                  </td>
                </tr>
              ) : (
                filteredSales.map((sale) => {
                  const oppNumber = sale.custom_data?.opportunity_number || sale.id.slice(0, 8);
                  const candidate = sale.custom_data?.candidate_name || sale.client_name;
                  const fdi = sale.custom_data?.fdi_channel || 'Vestibular';
                  const mod = sale.custom_data?.modality || (sale.product_name.includes('Presencial') ? 'Presencial' : 'Semipresencial');
                  const shift = sale.custom_data?.shift || 'Noite';
                  const parcela = sale.custom_data?.parcela_leve || 'Sem parcelas';
                  const hasConvenio = sale.custom_data?.has_bolsa_convenio;
                  const empresaConvenio = sale.custom_data?.empresa_convenio;
                  const dateFormatted = sale.custom_data?.sale_date || new Date(sale.created_at).toLocaleDateString('pt-BR');

                  return (
                    <tr key={sale.id} className="hover:bg-blue-50/40 transition-colors">
                      <td className="py-3 px-4 font-mono text-[11px]">
                        <div className="flex items-center gap-1.5 font-bold text-[#0052cc]">
                          <Hash className="w-3 h-3 text-gray-400" />
                          <span>{oppNumber}</span>
                        </div>
                        <span className="text-slate-400 text-[10px] flex items-center gap-1 mt-0.5">
                          <Calendar className="w-2.5 h-2.5" />
                          {dateFormatted}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-900 block text-xs">
                          {candidate}
                        </span>
                        {sale.seller_name && (
                          <span className="text-[10px] text-gray-400">
                            Vendedor: {sale.seller_name}
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-800 border border-blue-100">
                          {fdi}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${mod === 'Presencial' ? 'bg-[#0052cc]' : 'bg-emerald-500'}`} />
                          <span className="font-medium text-slate-800">{mod}</span>
                        </div>
                        <span className="text-[10px] text-slate-500 block">
                          Turno: {shift}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <span className="text-[11px] font-medium text-slate-700 block">
                          {parcela}
                        </span>
                        {hasConvenio ? (
                          <span className="inline-flex items-center gap-1 text-[10px] text-purple-700 font-semibold bg-purple-50 px-1.5 py-0.5 rounded mt-0.5">
                            <Building2 className="w-2.5 h-2.5" />
                            {empresaConvenio || 'Convênio'}
                          </span>
                        ) : (
                          <span className="text-[10px] text-gray-400">Sem convênio</span>
                        )}
                      </td>

                      <td className="py-3 px-4 font-bold text-slate-900">
                        R$ {sale.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        <span className="block text-[10px] text-gray-400 font-normal">
                          {sale.payment_method}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => setSelectedSale(sale)}
                          className="p-1.5 text-slate-400 hover:text-[#0052cc] rounded-lg hover:bg-blue-50 transition-colors cursor-pointer"
                          title="Ver Detalhes do Lançamento"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sale Details Modal */}
      {selectedSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="relative w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#00478f] text-white flex items-center justify-center font-bold text-xs">
                  R9
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    Detalhes do Lançamento de Venda
                  </h3>
                  <p className="text-[11px] text-gray-400">
                    Oportunidade #{selectedSale.custom_data?.opportunity_number || selectedSale.id}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedSale(null)} 
                className="text-slate-400 hover:text-slate-700 text-xs p-1 rounded-lg hover:bg-gray-100"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-gray-50 p-3 rounded-xl border border-gray-100">
                <div>
                  <span className="text-gray-400 block text-[10px]">Nº da Oportunidade</span>
                  <span className="font-bold text-blue-900 font-mono">
                    {selectedSale.custom_data?.opportunity_number || selectedSale.id}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[10px]">Data do Registro</span>
                  <span className="font-semibold text-gray-800">
                    {selectedSale.custom_data?.sale_date || new Date(selectedSale.created_at).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              </div>

              <div className="flex justify-between py-1.5 border-b border-gray-100">
                <span className="text-slate-500">Nome do Candidato:</span>
                <span className="font-bold text-slate-900">
                  {selectedSale.custom_data?.candidate_name || selectedSale.client_name}
                </span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-gray-100">
                <span className="text-slate-500">Produto / Canal (FDI):</span>
                <span className="font-semibold text-blue-700">
                  {selectedSale.custom_data?.fdi_channel || 'Vestibular'}
                </span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-gray-100">
                <span className="text-slate-500">Modalidade & Turno:</span>
                <span className="font-medium text-slate-900">
                  {selectedSale.custom_data?.modality || 'Presencial'} ({selectedSale.custom_data?.shift || 'Noite'})
                </span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-gray-100">
                <span className="text-slate-500">Parcela Leve:</span>
                <span className="font-medium text-emerald-700">
                  {selectedSale.custom_data?.parcela_leve || 'Sem parcelas'}
                </span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-gray-100">
                <span className="text-slate-500">Bolsa Convênio:</span>
                <span className="font-medium text-slate-900">
                  {selectedSale.custom_data?.has_bolsa_convenio
                    ? `Sim (${selectedSale.custom_data.empresa_convenio || 'Parceiro'})`
                    : 'Não'}
                </span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-gray-100">
                <span className="text-slate-500">Valor da Venda:</span>
                <span className="font-bold text-emerald-600 text-sm">
                  R$ {selectedSale.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-gray-100">
                <span className="text-slate-500">Forma de Pagamento:</span>
                <span className="text-slate-900">{selectedSale.payment_method}</span>
              </div>

              {selectedSale.notes && (
                <div className="pt-2">
                  <span className="text-slate-500 block mb-1 font-semibold">Observações:</span>
                  <p className="text-slate-700 bg-gray-50 p-2.5 rounded-xl border border-slate-200 text-xs leading-relaxed whitespace-pre-wrap">
                    {selectedSale.notes}
                  </p>
                </div>
              )}
            </div>

            <button
              onClick={() => setSelectedSale(null)}
              className="w-full py-2.5 bg-[#0052cc] hover:bg-[#00478f] text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Fechar Detalhes
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

