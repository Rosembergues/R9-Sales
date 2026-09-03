import React, { useState, useMemo } from 'react';
import { useSales } from '../../context/SalesContext';
import { useAuth } from '../../context/AuthContext';
import { 
  MainProductType, 
  Sale 
} from '../../types';
import { 
  GraduationCap, 
  Award, 
  Wrench, 
  Search, 
  Calendar, 
  Hash, 
  Building2, 
  Layers, 
  Clock, 
  TrendingUp, 
  CheckCircle2, 
  Plus, 
  FileText,
  Filter,
  Sparkles,
  ChevronRight,
  BookOpen,
  DollarSign,
  Edit3,
  Shield
} from 'lucide-react';
import { EditSaleModal } from '../sales/EditSaleModal';
import { getSaleFdiDisplay } from '../../lib/salesMapper';

interface ProductSummaryViewProps {
  productType: MainProductType;
  onOpenNewSaleModal: (initialProduct?: MainProductType) => void;
}

export const ProductSummaryView: React.FC<ProductSummaryViewProps> = ({
  productType,
  onOpenNewSaleModal
}) => {
  const { sales } = useSales();
  const { currentUser } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedModalityFilter, setSelectedModalityFilter] = useState<string>('all');
  const [selectedShiftFilter, setSelectedShiftFilter] = useState<string>('all');
  const [selectedSaleDetail, setSelectedSaleDetail] = useState<Sale | null>(null);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);

  const isAdmin = currentUser?.role === 'admin';

  // Helper to determine the main product of a sale
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

  // Filter sales belonging to this product
  const productSales = useMemo(() => {
    return sales.filter(s => getSaleProductType(s) === productType);
  }, [sales, productType]);

  // Modality & Shift structures based on the system definition spreadsheet
  const productStructure = useMemo(() => {
    if (productType === 'Graduação') {
      return {
        icon: GraduationCap,
        color: 'text-blue-600',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-200',
        pillBg: 'bg-[#0052cc]',
        description: 'Cursos de Ensino Superior nas unidades de negócio Presencial e Digital.',
        businessUnits: [
          {
            name: 'BU Presencial',
            modalities: [
              { name: 'Presencial', defaultShifts: 'Manhã e Noite', key: 'Presencial' },
              { name: 'Semipresencial', defaultShifts: 'Manhã e Noite', key: 'Semipresencial' },
              { name: 'Ao Vivo', defaultShifts: 'Manhã e Noite', key: 'Ao Vivo' }
            ]
          },
          {
            name: 'BU Digital',
            modalities: [
              { name: 'EAD', defaultShifts: 'Virtual', key: 'EAD' },
              { name: 'FLEX', defaultShifts: 'Virtual', key: 'FLEX' }
            ]
          }
        ]
      };
    } else if (productType === 'Pós Graduação') {
      return {
        icon: Award,
        color: 'text-purple-600',
        bgColor: 'bg-purple-50',
        borderColor: 'border-purple-200',
        pillBg: 'bg-purple-600',
        description: 'Programas de especialização Lato Sensu e MBAs executivos.',
        businessUnits: [
          {
            name: 'Pós Graduação',
            modalities: [
              { name: 'Pós Presencial', defaultShifts: 'Manhã e Noite', key: 'Pós Presencial' },
              { name: 'Pós Ao Vivo', defaultShifts: 'Manhã e Noite', key: 'Pós Ao Vivo' },
              { name: 'Pós Digital', defaultShifts: 'Virtual', key: 'Pós Digital' }
            ]
          }
        ]
      };
    } else {
      return {
        icon: Wrench,
        color: 'text-amber-600',
        bgColor: 'bg-amber-50',
        borderColor: 'border-amber-200',
        pillBg: 'bg-amber-600',
        description: 'Formação técnica profissionalizante rápida com alta empregabilidade.',
        businessUnits: [
          {
            name: 'Curso Técnico',
            modalities: [
              { name: 'Técnico Presencial', defaultShifts: 'Manhã e Noite', key: 'Técnico Presencial' }
            ]
          }
        ]
      };
    }
  }, [productType]);

  // Metrics by modality
  const modalityCounts = useMemo(() => {
    const map: Record<string, number> = {};
    productSales.forEach(s => {
      let mod = s.custom_data?.modality || 'Presencial';
      if (mod === 'Técnico') mod = 'Técnico Presencial';
      map[mod] = (map[mod] || 0) + 1;
    });
    return map;
  }, [productSales]);

  // Metrics by shift
  const shiftCounts = useMemo(() => {
    const map: Record<string, number> = { 'Manhã': 0, 'Noite': 0, 'Virtual': 0 };
    productSales.forEach(s => {
      const shift = s.custom_data?.shift || 'Noite';
      map[shift] = (map[shift] || 0) + 1;
    });
    return map;
  }, [productSales]);

  // Bolsa convênio counts
  const bolsaConvenioCount = useMemo(() => {
    return productSales.filter(s => s.custom_data?.has_bolsa_convenio).length;
  }, [productSales]);

  // Parcela leve counts
  const parcelaLeveCounts = useMemo(() => {
    const map: Record<string, number> = {};
    productSales.forEach(s => {
      const p = s.custom_data?.parcela_leve || 'Sem parcelas';
      map[p] = (map[p] || 0) + 1;
    });
    return map;
  }, [productSales]);

  // Filtered sales for the table
  const filteredSales = useMemo(() => {
    return productSales.filter(s => {
      const opp = s.custom_data?.opportunity_number || '';
      const cand = s.custom_data?.candidate_name || s.client_name || '';
      const fdi = getSaleFdiDisplay(s);
      const mod = s.custom_data?.modality || '';
      const shift = s.custom_data?.shift || '';
      const notes = s.notes || '';

      const matchesSearch = 
        cand.toLowerCase().includes(searchTerm.toLowerCase()) ||
        opp.toLowerCase().includes(searchTerm.toLowerCase()) ||
        fdi.toLowerCase().includes(searchTerm.toLowerCase()) ||
        mod.toLowerCase().includes(searchTerm.toLowerCase()) ||
        notes.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesModality = 
        selectedModalityFilter === 'all' || 
        mod.toLowerCase() === selectedModalityFilter.toLowerCase() ||
        (selectedModalityFilter === 'Técnico Presencial' && (mod === 'Técnico' || mod === 'Técnico Presencial'));

      const matchesShift = 
        selectedShiftFilter === 'all' || 
        shift.toLowerCase() === selectedShiftFilter.toLowerCase();

      return matchesSearch && matchesModality && matchesShift;
    });
  }, [productSales, searchTerm, selectedModalityFilter, selectedShiftFilter]);

  const Icon = productStructure.icon;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* 1. PRODUCT HEADER BANNER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-gray-100">
        <div className="flex items-start gap-3.5">
          <div className={`w-12 h-12 rounded-2xl ${productStructure.bgColor} ${productStructure.color} border ${productStructure.borderColor} flex items-center justify-center shrink-0 shadow-xs`}>
            <Icon className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-gray-900 font-['Space_Grotesk']">
                Resumo do Produto: {productType}
              </h2>
              <span className={`px-2.5 py-0.5 rounded-full text-white text-[11px] font-bold ${productStructure.pillBg} shadow-xs`}>
                {productSales.length} {productSales.length === 1 ? 'Matrícula' : 'Matrículas'}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {productStructure.description}
            </p>
          </div>
        </div>

        <button
          onClick={() => onOpenNewSaleModal(productType)}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0052cc] hover:bg-[#00478f] text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Lançar Venda de {productType}</span>
        </button>
      </div>

      {/* 2. SUMMARY KPI METRIC CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        
        {/* Card 1: Total Matrículas */}
        <div className="p-4 rounded-xl bg-gray-50 border border-gray-200/80 space-y-1">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
            Total de Matrículas
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-gray-900 font-['Space_Grotesk']">
              {productSales.length}
            </span>
            <span className="text-[11px] text-gray-500">registradas</span>
          </div>
        </div>

        {/* Card 2: Turnos Mais Vendidos */}
        <div className="p-4 rounded-xl bg-gray-50 border border-gray-200/80 space-y-1">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
            Distribuição por Turno
          </span>
          <div className="text-xs space-y-1 pt-0.5">
            <div className="flex justify-between items-center text-gray-700">
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                Manhã:
              </span>
              <strong className="text-gray-900">{shiftCounts['Manhã'] || 0}</strong>
            </div>
            <div className="flex justify-between items-center text-gray-700">
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                Noite:
              </span>
              <strong className="text-gray-900">{shiftCounts['Noite'] || 0}</strong>
            </div>
            <div className="flex justify-between items-center text-gray-700">
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Virtual:
              </span>
              <strong className="text-gray-900">{shiftCounts['Virtual'] || 0}</strong>
            </div>
          </div>
        </div>

        {/* Card 3: Bolsa Convênio */}
        <div className="p-4 rounded-xl bg-gray-50 border border-gray-200/80 space-y-1">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
            Bolsa Convênio
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-purple-700 font-['Space_Grotesk']">
              {bolsaConvenioCount}
            </span>
            <span className="text-[11px] text-gray-500">
              ({productSales.length > 0 ? Math.round((bolsaConvenioCount / productSales.length) * 100) : 0}%)
            </span>
          </div>
          <p className="text-[10px] text-gray-400">
            {productSales.length - bolsaConvenioCount} matrículas sem convênio
          </p>
        </div>

        {/* Card 4: Parcela Leve */}
        <div className="p-4 rounded-xl bg-gray-50 border border-gray-200/80 space-y-1">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
            Condição Parcela Leve
          </span>
          <div className="text-xs space-y-0.5 pt-0.5 text-gray-700">
            <div className="flex justify-between">
              <span>3 Parcelas:</span>
              <strong className="text-emerald-700">{parcelaLeveCounts['3 parcelas'] || 0}</strong>
            </div>
            <div className="flex justify-between">
              <span>2 Parcelas:</span>
              <strong className="text-emerald-700">{parcelaLeveCounts['2 parcelas'] || 0}</strong>
            </div>
            <div className="flex justify-between">
              <span>Sem parcelas:</span>
              <strong className="text-gray-600">{parcelaLeveCounts['Sem parcelas'] || 0}</strong>
            </div>
          </div>
        </div>

      </div>

      {/* 3. BUSINESS UNITS & MODALITIES BREAKDOWN (According to the user spreadsheet) */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4 shadow-2xs">
        <div>
          <h3 className="text-sm font-bold text-gray-900 font-['Space_Grotesk'] flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#0052cc]" />
            Estrutura de Modalidades & Turnos Cadastrados
          </h3>
          <p className="text-xs text-gray-500">
            Detalhamento por Unidade de Negócio (BU) e Modalidades permitidas para {productType}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {productStructure.businessUnits.map((bu, idx) => (
            <div 
              key={idx}
              className="p-4 rounded-xl bg-gray-50/70 border border-gray-200/80 space-y-3"
            >
              <div className="flex items-center justify-between pb-2 border-b border-gray-200/60">
                <span className="text-xs font-bold text-gray-900 uppercase tracking-wide">
                  {bu.name}
                </span>
                <span className="text-[10px] text-gray-500 font-medium">
                  {bu.modalities.length} {bu.modalities.length === 1 ? 'modalidade' : 'modalidades'}
                </span>
              </div>

              <div className="space-y-2">
                {bu.modalities.map((mod, mIdx) => {
                  const count = modalityCounts[mod.name] || modalityCounts[mod.key] || 0;
                  const isSelected = selectedModalityFilter === mod.key;

                  return (
                    <div 
                      key={mIdx}
                      onClick={() => {
                        setSelectedModalityFilter(isSelected ? 'all' : mod.key);
                      }}
                      className={`p-3 rounded-lg border transition-all cursor-pointer flex items-center justify-between ${
                        isSelected 
                          ? 'bg-blue-50/80 border-blue-400 shadow-xs' 
                          : 'bg-white border-gray-200/70 hover:border-gray-300 hover:bg-gray-50/50'
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-[#0052cc]' : 'bg-gray-400'}`} />
                          <span className="text-xs font-bold text-gray-900">
                            {mod.name}
                          </span>
                        </div>
                        <span className="text-[11px] text-gray-500 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-gray-400" />
                          Turnos: {mod.defaultShifts}
                        </span>
                      </div>

                      <div className="text-right">
                        <span className="text-sm font-bold text-gray-900 font-['Space_Grotesk'] block">
                          {count}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          {count === 1 ? 'venda' : 'vendas'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. FILTERABLE TABLE OF PRODUCT SALES */}
      <div className="space-y-3 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-gray-900 font-['Space_Grotesk'] flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[#0052cc]" />
              Matrículas & Oportunidades Registradas ({filteredSales.length})
            </h3>
            <p className="text-xs text-gray-500">
              Lançamentos específicos do produto {productType}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                placeholder="Buscar por oportunidade, candidato, FDI..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-[#0052cc] w-full sm:w-64 shadow-2xs"
              />
            </div>

            {/* Modality Filter Pill */}
            {selectedModalityFilter !== 'all' && (
              <button
                onClick={() => setSelectedModalityFilter('all')}
                className="px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer hover:bg-blue-100"
              >
                <span>Mod: {selectedModalityFilter}</span>
                <span>✕</span>
              </button>
            )}

            {/* Shift Filter Select */}
            <select
              value={selectedShiftFilter}
              onChange={(e) => setSelectedShiftFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-white border border-gray-200 rounded-xl text-xs text-gray-700 focus:outline-none focus:border-[#0052cc]"
            >
              <option value="all">Todos os Turnos</option>
              <option value="Manhã">Manhã</option>
              <option value="Noite">Noite</option>
              <option value="Virtual">Virtual</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-2xl bg-white border border-gray-200 overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-600">
              <thead className="bg-gray-50 border-b border-gray-200 uppercase font-bold text-gray-500 text-[11px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Oportunidade & Data</th>
                  <th className="py-3 px-4">Candidato</th>
                  <th className="py-3 px-4">Canal (FDI)</th>
                  <th className="py-3 px-4">Modalidade & Turno</th>
                  <th className="py-3 px-4">Condição Pagamento</th>
                  <th className="py-3 px-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredSales.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-gray-400">
                      Nenhuma matrícula encontrada para este filtro.
                    </td>
                  </tr>
                ) : (
                  filteredSales.map((sale) => {
                    const oppNumber = sale.custom_data?.opportunity_number || sale.id.slice(0, 8);
                    const candidate = sale.custom_data?.candidate_name || sale.client_name;
                    const fdi = getSaleFdiDisplay(sale);
                    const mod = sale.custom_data?.modality || 'Presencial';
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
                          <span className="text-gray-400 text-[10px] flex items-center gap-1 mt-0.5">
                            <Calendar className="w-2.5 h-2.5" />
                            {dateFormatted}
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          <span className="font-bold text-gray-900 block text-xs">
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
                            <span className="w-2 h-2 rounded-full bg-[#0052cc]" />
                            <span className="font-medium text-gray-800">{mod}</span>
                          </div>
                          <span className="text-[10px] text-gray-500 block">
                            Turno: {shift}
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          <span className="text-[11px] font-medium text-gray-700 block">
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

                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => setSelectedSaleDetail(sale)}
                            className="p-1.5 text-gray-400 hover:text-[#0052cc] rounded-lg hover:bg-blue-50 transition-colors cursor-pointer"
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
      </div>

      {/* 5. SALE DETAIL MODAL */}
      {selectedSaleDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="relative w-full max-w-lg bg-white border border-gray-200 rounded-2xl shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#00478f] text-white flex items-center justify-center font-bold text-xs">
                  R9
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">
                    Detalhes do Lançamento • {productType}
                  </h3>
                  <p className="text-[11px] text-gray-400">
                    Oportunidade #{selectedSaleDetail.custom_data?.opportunity_number || selectedSaleDetail.id}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedSaleDetail(null)} 
                className="text-gray-400 hover:text-gray-700 text-xs p-1 rounded-lg hover:bg-gray-100"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-gray-50 p-3 rounded-xl border border-gray-100">
                <div>
                  <span className="text-gray-400 block text-[10px]">Nº da Oportunidade</span>
                  <span className="font-bold text-blue-900 font-mono">
                    {selectedSaleDetail.custom_data?.opportunity_number || selectedSaleDetail.id}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[10px]">Data do Registro</span>
                  <span className="font-semibold text-gray-800">
                    {selectedSaleDetail.custom_data?.sale_date || new Date(selectedSaleDetail.created_at).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              </div>

              <div className="flex justify-between py-1.5 border-b border-gray-100">
                <span className="text-gray-500">Nome do Candidato:</span>
                <span className="font-bold text-gray-900">
                  {selectedSaleDetail.custom_data?.candidate_name || selectedSaleDetail.client_name}
                </span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-gray-100">
                <span className="text-gray-500">Produto Principal:</span>
                <span className="font-bold text-blue-800">
                  {productType}
                </span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-gray-100">
                <span className="text-gray-500">Produto / Canal (FDI):</span>
                <span className="font-semibold text-blue-700">
                  {getSaleFdiDisplay(selectedSaleDetail)}
                </span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-gray-100">
                <span className="text-gray-500">Modalidade & Turno:</span>
                <span className="font-medium text-gray-900">
                  {selectedSaleDetail.custom_data?.modality || 'Presencial'} ({selectedSaleDetail.custom_data?.shift || 'Noite'})
                </span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-gray-100">
                <span className="text-gray-500">Parcela Leve:</span>
                <span className="font-medium text-emerald-700">
                  {selectedSaleDetail.custom_data?.parcela_leve || 'Sem parcelas'}
                </span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-gray-100">
                <span className="text-gray-500">Bolsa Convênio:</span>
                <span className="font-medium text-gray-900">
                  {selectedSaleDetail.custom_data?.has_bolsa_convenio
                    ? `Sim (${selectedSaleDetail.custom_data.empresa_convenio || 'Parceiro'})`
                    : 'Não'}
                </span>
              </div>

              {selectedSaleDetail.notes && (
                <div className="pt-2">
                  <span className="text-gray-500 block mb-1 font-semibold">Observações:</span>
                  <p className="text-gray-700 bg-gray-50 p-2.5 rounded-xl border border-gray-200 text-xs leading-relaxed whitespace-pre-wrap">
                    {selectedSaleDetail.notes}
                  </p>
                </div>
              )}
            </div>

            <div className="pt-2 flex items-center gap-2">
              {isAdmin && (
                <button
                  onClick={() => {
                    const saleToEdit = selectedSaleDetail;
                    setSelectedSaleDetail(null);
                    setEditingSale(saleToEdit);
                  }}
                  className="flex-1 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                  <span>Editar Venda (Admin)</span>
                </button>
              )}

              <button
                onClick={() => setSelectedSaleDetail(null)}
                className="flex-1 py-2.5 bg-[#0052cc] hover:bg-[#00478f] text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE EDIÇÃO DE VENDA (ADMIN) */}
      <EditSaleModal
        isOpen={!!editingSale}
        sale={editingSale}
        onClose={() => setEditingSale(null)}
      />

    </div>
  );
};
