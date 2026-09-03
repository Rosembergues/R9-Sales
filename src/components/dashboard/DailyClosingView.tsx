import React, { useState, useMemo } from 'react';
import { useSales } from '../../context/SalesContext';
import { Sale } from '../../types';
import { 
  CalendarCheck, 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  Copy, 
  Check, 
  Receipt, 
  Plus, 
  Search, 
  GraduationCap, 
  BookOpen, 
  Wrench, 
  Layers,
  Edit3,
  User
} from 'lucide-react';
import { EditSaleModal } from '../sales/EditSaleModal';
import { getSaleDateBr, getTodayBrDate, getSaleFdiDisplay } from '../../lib/salesMapper';

interface DailyClosingViewProps {
  onOpenNewSaleModal?: () => void;
}

interface ModalityDefinition {
  name: string;
  category: 'Graduação' | 'Pós-Graduação' | 'Curso Técnico';
  tagColor: string;
}

const STANDARD_MODALITIES: ModalityDefinition[] = [
  // Graduação
  { name: 'EAD', category: 'Graduação', tagColor: 'bg-blue-50 text-blue-700 border-blue-200' },
  { name: 'Presencial', category: 'Graduação', tagColor: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { name: 'Semipresencial', category: 'Graduação', tagColor: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { name: 'Flex', category: 'Graduação', tagColor: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  { name: 'Ao Vivo', category: 'Graduação', tagColor: 'bg-sky-50 text-sky-700 border-sky-200' },
  
  // Pós Graduação
  { name: 'Pós Presencial', category: 'Pós-Graduação', tagColor: 'bg-purple-50 text-purple-700 border-purple-200' },
  { name: 'Pós Digital', category: 'Pós-Graduação', tagColor: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200' },
  { name: 'Pós Ao Vivo', category: 'Pós-Graduação', tagColor: 'bg-violet-50 text-violet-700 border-violet-200' },

  // Curso Técnico
  { name: 'Técnico Presencial', category: 'Curso Técnico', tagColor: 'bg-amber-50 text-amber-700 border-amber-200' },
];

export const DailyClosingView: React.FC<DailyClosingViewProps> = ({ onOpenNewSaleModal }) => {
  const { sales } = useSales();

  // Selected date state (defaults to today)
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [copiedSuccess, setCopiedSuccess] = useState(false);
  const [selectedModalityFilter, setSelectedModalityFilter] = useState<string | null>(null);
  const [tableSearch, setTableSearch] = useState('');
  const [editingSale, setEditingSale] = useState<Sale | null>(null);

  // Format date helper (dd/MM/yyyy)
  const formatToBrDate = (d: Date): string => {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  // Format date to ISO (yyyy-MM-dd) for HTML date input
  const formatToIso = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const selectedDateFormatted = useMemo(() => formatToBrDate(selectedDate), [selectedDate]);
  const isToday = useMemo(() => {
    const today = new Date();
    return formatToBrDate(today) === selectedDateFormatted;
  }, [selectedDateFormatted]);

  // Navigate dates
  const handlePrevDay = () => {
    const prev = new Date(selectedDate);
    prev.setDate(prev.getDate() - 1);
    setSelectedDate(prev);
    setSelectedModalityFilter(null);
  };

  const handleNextDay = () => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + 1);
    setSelectedDate(next);
    setSelectedModalityFilter(null);
  };

  const handleSetToday = () => {
    setSelectedDate(new Date());
    setSelectedModalityFilter(null);
  };

  const handleDateInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.value) return;
    const [year, month, day] = e.target.value.split('-').map(Number);
    if (year && month && day) {
      setSelectedDate(new Date(year, month - 1, day));
      setSelectedModalityFilter(null);
    }
  };

  // Normalize modality string to match standard identifiers
  const normalizeModality = (raw?: string): string => {
    if (!raw) return 'Presencial';
    const trimmed = raw.trim();
    const lower = trimmed.toLowerCase();
    if (lower === 'ead') return 'EAD';
    if (lower === 'presencial') return 'Presencial';
    if (lower === 'semipresencial' || lower === 'semi-presencial') return 'Semipresencial';
    if (lower === 'flex') return 'Flex';
    if (lower === 'ao vivo' || lower === 'aovivo') return 'Ao Vivo';
    if (lower === 'pós presencial' || lower === 'pos presencial') return 'Pós Presencial';
    if (lower === 'pós digital' || lower === 'pos digital') return 'Pós Digital';
    if (lower === 'pós ao vivo' || lower === 'pos ao vivo') return 'Pós Ao Vivo';
    if (lower === 'técnico presencial' || lower === 'tecnico presencial') return 'Técnico Presencial';
    if (lower === 'técnico' || lower === 'tecnico') return 'Técnico Presencial';
    return trimmed;
  };

  // Filter sales for the selected date - strictly based on Data da Venda (never created_at)
  const daySales = useMemo(() => {
    return sales.filter((s) => {
      const saleDate = getSaleDateBr(s);
      return saleDate === selectedDateFormatted;
    });
  }, [sales, selectedDateFormatted]);

  // Total metrics of the day
  const dayTotalCount = daySales.length;
  // Breakdown by modality
  const modalityStats = useMemo(() => {
    // Counts map
    const counts: Record<string, { count: number; totalValue: number }> = {};

    // Initialize all standard modalities with 0
    STANDARD_MODALITIES.forEach((mod) => {
      counts[mod.name] = { count: 0, totalValue: 0 };
    });

    // Populate with actual day sales
    daySales.forEach((sale) => {
      const mod = normalizeModality(sale.custom_data?.modality);
      if (!counts[mod]) {
        counts[mod] = { count: 0, totalValue: 0 };
      }
      counts[mod].count += 1;
      counts[mod].totalValue += Number(sale.value) || 0;
    });

    return counts;
  }, [daySales]);

  // Identify any extra modalities that aren't in the standard list
  const extraModalities = useMemo(() => {
    const standardNames = new Set(STANDARD_MODALITIES.map((m) => m.name));
    return Object.keys(modalityStats).filter((name) => !standardNames.has(name) && modalityStats[name].count > 0);
  }, [modalityStats]);

  // Group modalities by category
  const categories = useMemo(() => {
    const list = [
      {
        title: 'Graduação',
        icon: GraduationCap,
        color: 'text-blue-600',
        bgColor: 'bg-blue-50 border-blue-200',
        items: STANDARD_MODALITIES.filter((m) => m.category === 'Graduação')
      },
      {
        title: 'Pós-Graduação',
        icon: BookOpen,
        color: 'text-purple-600',
        bgColor: 'bg-purple-50 border-purple-200',
        items: STANDARD_MODALITIES.filter((m) => m.category === 'Pós-Graduação')
      },
      {
        title: 'Curso Técnico',
        icon: Wrench,
        color: 'text-amber-600',
        bgColor: 'bg-amber-50 border-amber-200',
        items: STANDARD_MODALITIES.filter((m) => m.category === 'Curso Técnico')
      }
    ];

    if (extraModalities.length > 0) {
      list.push({
        title: 'Outras Modalidades',
        icon: Layers,
        color: 'text-gray-600',
        bgColor: 'bg-gray-50 border-gray-200',
        items: extraModalities.map((name) => ({
          name,
          category: 'Graduação' as any,
          tagColor: 'bg-gray-50 text-gray-700 border-gray-200'
        }))
      });
    }

    return list;
  }, [extraModalities]);

  // Filtered sales list for the detailed table below
  const filteredSales = useMemo(() => {
    let result = daySales;

    if (selectedModalityFilter) {
      result = result.filter((s) => normalizeModality(s.custom_data?.modality) === selectedModalityFilter);
    }

    if (tableSearch.trim()) {
      const q = tableSearch.toLowerCase();
      result = result.filter((s) => {
        const candidate = (s.custom_data?.candidate_name || '').toLowerCase();
        const opp = (s.custom_data?.opportunity_number || '').toLowerCase();
        const seller = (s.seller_name || '').toLowerCase();
        const mod = normalizeModality(s.custom_data?.modality).toLowerCase();
        return candidate.includes(q) || opp.includes(q) || seller.includes(q) || mod.includes(q);
      });
    }

    return result;
  }, [daySales, selectedModalityFilter, tableSearch]);

  // Copy structured closing summary to clipboard (ready for WhatsApp / Telegram)
  const handleCopyClosingSummary = async () => {
    let text = `📊 *FECHAMENTO DIÁRIO - ${selectedDateFormatted}*\n`;
    text += `🎯 *Total de Boletos:* ${dayTotalCount}\n\n`;

    // Graduação
    text += `*Graduação:*\n`;
    const gradItems = STANDARD_MODALITIES.filter((m) => m.category === 'Graduação');
    gradItems.forEach((m) => {
      const count = modalityStats[m.name]?.count || 0;
      text += `• ${m.name}: ${count}\n`;
    });

    // Pós-Graduação
    text += `\n*Pós-Graduação:*\n`;
    const posItems = STANDARD_MODALITIES.filter((m) => m.category === 'Pós-Graduação');
    posItems.forEach((m) => {
      const count = modalityStats[m.name]?.count || 0;
      text += `• ${m.name}: ${count}\n`;
    });

    // Curso Técnico
    text += `\n*Curso Técnico:*\n`;
    const tecItems = STANDARD_MODALITIES.filter((m) => m.category === 'Curso Técnico');
    tecItems.forEach((m) => {
      const count = modalityStats[m.name]?.count || 0;
      text += `• ${m.name}: ${count}\n`;
    });

    if (extraModalities.length > 0) {
      text += `\n*Outras Modalidades:*\n`;
      extraModalities.forEach((m) => {
        const count = modalityStats[m]?.count || 0;
        text += `• ${m}: ${count}\n`;
      });
    }

    text += `\n_Gerado automaticamente pelo R9 Corp_`;

    try {
      await navigator.clipboard.writeText(text);
      setCopiedSuccess(true);
      setTimeout(() => setCopiedSuccess(false), 3000);
    } catch (err) {
      console.error('Falha ao copiar:', err);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* 1. HEADER SECTION & DATE CONTROLS */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Title & Subtitle */}
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700 flex items-center justify-center">
                <CalendarCheck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  Fechamento Diário
                  {isToday ? (
                    <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full uppercase tracking-wider">
                      Hoje
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-gray-600 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-full">
                      Histórico
                    </span>
                  )}
                </h2>
                <p className="text-xs text-gray-500">
                  Somatória consolidada dos boletos do dia discriminados por modalidade
                </p>
              </div>
            </div>
          </div>

          {/* Controls: Date Picker, Day Nav & Actions */}
          <div className="flex flex-wrap items-center gap-2">
            
            {/* Date Navigation group */}
            <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl p-1 text-xs font-semibold text-gray-700">
              <button
                onClick={handlePrevDay}
                className="p-1.5 hover:bg-white hover:text-gray-900 rounded-lg transition-colors cursor-pointer"
                title="Dia anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="relative flex items-center gap-1.5 px-3">
                <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                <span>{selectedDateFormatted}</span>
                <input
                  type="date"
                  value={formatToIso(selectedDate)}
                  onChange={handleDateInputChange}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  title="Clique para escolher a data"
                />
              </div>

              <button
                onClick={handleNextDay}
                className="p-1.5 hover:bg-white hover:text-gray-900 rounded-lg transition-colors cursor-pointer"
                title="Próximo dia"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {!isToday && (
              <button
                onClick={handleSetToday}
                className="px-3 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-colors cursor-pointer"
              >
                Voltar p/ Hoje
              </button>
            )}

            {/* Copiar Resumo Button */}
            <button
              id="copy-closing-summary-btn"
              onClick={handleCopyClosingSummary}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl transition-all shadow-2xs cursor-pointer ${
                copiedSuccess
                  ? 'bg-emerald-600 text-white shadow-emerald-600/20'
                  : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-200'
              }`}
              title="Copiar fechamento formatado para enviar no WhatsApp ou chat da equipe"
            >
              {copiedSuccess ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-indigo-600" />
                  <span>Copiar Fechamento</span>
                </>
              )}
            </button>

            {/* Lançar Venda Button */}
            {onOpenNewSaleModal && (
              <button
                onClick={onOpenNewSaleModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-[#0052cc] hover:bg-[#00478f] rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Lançar Venda</span>
              </button>
            )}

          </div>

        </div>

        {/* Highlight KPI: Total Boletos do Dia */}
        <div className="pt-4 mt-4 border-t border-gray-100">
          <div className="inline-flex items-center gap-3.5 p-3 px-4 rounded-xl bg-gradient-to-r from-indigo-50/70 to-blue-50/40 border border-indigo-100/80">
            <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-indigo-900 uppercase tracking-wider block">
                Total de Boletos do Dia
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-gray-900 font-['Space_Grotesk']">
                  {dayTotalCount}
                </span>
                <span className="text-xs text-gray-500 font-medium">
                  {dayTotalCount === 1 ? 'boleto gerado' : 'boletos gerados'} ({selectedDateFormatted})
                </span>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* 2. MAIN BREAKDOWN BY MODALITY (O NÚCLEO DA SOLICITAÇÃO) */}
      <div className="space-y-4">
        
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-gray-900">
              Boletos por Modalidade
            </h3>
            <p className="text-xs text-gray-500">
              Clique em qualquer modalidade para filtrar os lançamentos detalhados na tabela abaixo
            </p>
          </div>

          {selectedModalityFilter && (
            <button
              onClick={() => setSelectedModalityFilter(null)}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
            >
              Limpar filtro ({selectedModalityFilter})
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {categories.map((category) => {
            const CatIcon = category.icon;
            
            // Subtotal of this category
            const categorySubtotal = category.items.reduce(
              (acc, item) => acc + (modalityStats[item.name]?.count || 0),
              0
            );

            return (
              <div
                key={category.title}
                className="bg-white rounded-2xl border border-gray-200/80 shadow-2xs overflow-hidden flex flex-col justify-between"
              >
                {/* Category Header */}
                <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg ${category.bgColor} ${category.color}`}>
                      <CatIcon className="w-4 h-4" />
                    </div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700">
                      {category.title}
                    </h4>
                  </div>
                  <span className="text-xs font-black text-gray-900 px-2 py-0.5 bg-white border border-gray-200 rounded-md">
                    {categorySubtotal} {categorySubtotal === 1 ? 'boleto' : 'boletos'}
                  </span>
                </div>

                {/* Modality Items List */}
                <div className="p-3 divide-y divide-gray-100 flex-1">
                  {category.items.map((mod) => {
                    const count = modalityStats[mod.name]?.count || 0;
                    const value = modalityStats[mod.name]?.totalValue || 0;
                    const isSelected = selectedModalityFilter === mod.name;
                    const percent = dayTotalCount > 0 ? Math.round((count / dayTotalCount) * 100) : 0;

                    return (
                      <div
                        key={mod.name}
                        onClick={() => setSelectedModalityFilter(isSelected ? null : mod.name)}
                        className={`py-2.5 px-3 rounded-xl transition-all cursor-pointer flex items-center justify-between group ${
                          isSelected
                            ? 'bg-blue-50 border border-blue-200'
                            : 'hover:bg-gray-50 border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              count > 0 ? 'bg-emerald-500' : 'bg-gray-300'
                            }`}
                          />
                          <span className={`text-xs font-bold ${count > 0 ? 'text-gray-900' : 'text-gray-600'}`}>
                            {mod.name}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center justify-center min-w-[28px] h-7 px-2 text-xs font-black rounded-lg transition-colors ${
                              count > 0
                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                : 'bg-gray-100 text-gray-400'
                            }`}
                          >
                            {count}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

              </div>
            );
          })}
        </div>

      </div>

      {/* 3. DETAILED TABLE OF THE DAY'S SALES */}
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-2xs overflow-hidden">
        
        {/* Table Header Controls */}
        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <span>Detalhamento dos Boletos do Dia</span>
              <span className="text-xs font-normal text-gray-400">
                ({filteredSales.length} {filteredSales.length === 1 ? 'registro' : 'registros'})
              </span>
            </h4>
            <p className="text-xs text-gray-500">
              {selectedModalityFilter 
                ? `Exibindo apenas boletos da modalidade: ${selectedModalityFilter}`
                : `Exibindo todas as modalidades na data ${selectedDateFormatted}`
              }
            </p>
          </div>

          {/* Search input in table */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar aluno, consultor, oportunidade..."
              value={tableSearch}
              onChange={(e) => setTableSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-gray-50 hover:bg-gray-100/70 focus:bg-white text-xs border border-gray-200 rounded-lg outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
            />
          </div>
        </div>

        {/* Table Body */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-500 font-semibold border-b border-gray-200/80 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Aluno / Candidato</th>
                <th className="py-3 px-3">Oportunidade</th>
                <th className="py-3 px-3">Consultor</th>
                <th className="py-3 px-3">Modalidade</th>
                <th className="py-3 px-3">Turno</th>
                <th className="py-3 px-3">Canal (FDI)</th>
                <th className="py-3 px-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredSales.length > 0 ? (
                filteredSales.map((sale) => {
                  const candidate = sale.custom_data?.candidate_name || sale.product_name || 'Sem nome';
                  const opp = sale.custom_data?.opportunity_number || sale.id.slice(0, 8);
                  const seller = sale.seller_name || 'Consultor';
                  const mod = normalizeModality(sale.custom_data?.modality);
                  const shift = sale.custom_data?.shift || 'Noite';
                  const fdi = getSaleFdiDisplay(sale);

                  return (
                    <tr key={sale.id} className="hover:bg-blue-50/30 transition-colors">
                      <td className="py-3 px-4 font-semibold text-gray-900">
                        {candidate}
                      </td>
                      <td className="py-3 px-3 font-mono text-[11px] text-gray-600">
                        {opp}
                      </td>
                      <td className="py-3 px-3 text-gray-700">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3 h-3 text-gray-400" />
                          <span>{seller}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {mod}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-gray-600">
                        {shift}
                      </td>
                      <td className="py-3 px-3 text-gray-600">
                        {fdi}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => setEditingSale(sale)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          title="Editar lançamento"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400">
                    <Receipt className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                    <p className="font-semibold text-sm text-gray-600">Nenhum boleto encontrado nesta data</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {selectedModalityFilter
                        ? `Não há registros com a modalidade "${selectedModalityFilter}" no dia ${selectedDateFormatted}.`
                        : `Não foram registrados boletos na data ${selectedDateFormatted}.`}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* MODAL DE EDIÇÃO PONTUAL DE VENDA */}
      <EditSaleModal
        isOpen={!!editingSale}
        sale={editingSale}
        onClose={() => setEditingSale(null)}
      />

    </div>
  );
};
