import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  ChevronDown, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  Download, 
  Plus, 
  X, 
  FileSpreadsheet, 
  Check, 
  Edit3, 
  ExternalLink,
  RotateCcw,
  SlidersHorizontal,
  Shield
} from 'lucide-react';
import { Sale, MainProductType } from '../../types';
import { useSales } from '../../context/SalesContext';
import { useAuth } from '../../context/AuthContext';
import { EditSaleModal } from '../sales/EditSaleModal';

interface SalesSpreadsheetTableProps {
  onOpenNewSaleModal?: () => void;
  onlyToday?: boolean;
}

type SortField = 
  | 'collaborator'
  | 'opportunity'
  | 'candidate'
  | 'date'
  | 'fdi'
  | 'modality'
  | 'shift'
  | 'parcela_leve'
  | 'bolsa_convenio'
  | 'empresa'
  | 'notes';

type SortDirection = 'asc' | 'desc' | null;

interface ColumnFilterState {
  [key: string]: string[]; // array of selected distinct values
}

export const SalesSpreadsheetTable: React.FC<SalesSpreadsheetTableProps> = ({
  onOpenNewSaleModal,
  onlyToday = false
}) => {
  const { sales, deleteSale, updateSaleStatus } = useSales();
  const { currentUser } = useAuth();

  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [selectedProductFilter, setSelectedProductFilter] = useState<'Todos' | MainProductType>('Todos');
  
  // Excel-like Column Filters
  const [columnFilters, setColumnFilters] = useState<ColumnFilterState>({});
  const [openFilterColumn, setOpenFilterColumn] = useState<string | null>(null);
  const filterMenuRef = useRef<HTMLDivElement>(null);

  // Selected row for detail modal or quick view
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);

  const isAdmin = currentUser?.role === 'admin';

  // Close filter dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterMenuRef.current && !filterMenuRef.current.contains(event.target as Node)) {
        setOpenFilterColumn(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Helper to extract clean cell values for a sale
  const getSaleRowData = (sale: Sale) => {
    const collaborator = sale.seller_name || 'Consultor';
    const opportunity = sale.custom_data?.opportunity_number || sale.id.replace('sale-', '955');
    const candidate = sale.custom_data?.candidate_name || sale.client_name || '';
    
    // Format date DD/MM/YYYY
    let dateStr = sale.custom_data?.sale_date;
    if (!dateStr) {
      const d = new Date(sale.created_at);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      dateStr = `${day}/${month}/${year}`;
    }

    const fdi = sale.custom_data?.fdi_channel || 'Simplificada';
    const modality = sale.custom_data?.modality || 'Presencial';
    const shift = sale.custom_data?.shift || 'Noite';
    const parcelaLeve = sale.custom_data?.parcela_leve || 'Sem parcelas';
    const hasBolsa = sale.custom_data?.has_bolsa_convenio ? 'Sim' : 'Não';
    const empresa = sale.custom_data?.empresa_convenio || '';
    const notes = sale.notes || '';
    const mainProduct = sale.custom_data?.main_product || 'Graduação';

    return {
      collaborator,
      opportunity,
      candidate,
      date: dateStr,
      fdi,
      modality,
      shift,
      parcelaLeve,
      hasBolsa,
      empresa,
      notes,
      mainProduct,
      raw: sale
    };
  };

  // Distinct values for each column (for the Excel filter dropdowns)
  const distinctColumnValues = useMemo(() => {
    const values: { [key: string]: Set<string> } = {
      collaborator: new Set(),
      opportunity: new Set(),
      candidate: new Set(),
      date: new Set(),
      fdi: new Set(),
      modality: new Set(),
      shift: new Set(),
      parcela_leve: new Set(),
      bolsa_convenio: new Set(),
      empresa: new Set(),
      notes: new Set()
    };

    sales.forEach(sale => {
      const data = getSaleRowData(sale);
      values.collaborator.add(data.collaborator);
      values.opportunity.add(data.opportunity);
      values.candidate.add(data.candidate);
      values.date.add(data.date);
      values.fdi.add(data.fdi);
      values.modality.add(data.modality);
      values.shift.add(data.shift);
      values.parcela_leve.add(data.parcelaLeve);
      values.bolsa_convenio.add(data.hasBolsa);
      if (data.empresa) values.empresa.add(data.empresa);
      if (data.notes) values.notes.add(data.notes);
    });

    return {
      collaborator: Array.from(values.collaborator).sort(),
      opportunity: Array.from(values.opportunity).sort(),
      candidate: Array.from(values.candidate).sort(),
      date: Array.from(values.date).sort(),
      fdi: Array.from(values.fdi).sort(),
      modality: Array.from(values.modality).sort(),
      shift: Array.from(values.shift).sort(),
      parcela_leve: Array.from(values.parcela_leve).sort(),
      bolsa_convenio: Array.from(values.bolsa_convenio).sort(),
      empresa: Array.from(values.empresa).sort(),
      notes: Array.from(values.notes).sort()
    };
  }, [sales]);

  // Handle column filtering toggle
  const toggleColumnFilterValue = (columnKey: string, value: string) => {
    setColumnFilters(prev => {
      const current = prev[columnKey] || [];
      const updated = current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value];
      
      if (updated.length === 0) {
        const next = { ...prev };
        delete next[columnKey];
        return next;
      }
      return { ...prev, [columnKey]: updated };
    });
  };

  const clearColumnFilter = (columnKey: string) => {
    setColumnFilters(prev => {
      const next = { ...prev };
      delete next[columnKey];
      return next;
    });
  };

  const clearAllFilters = () => {
    setColumnFilters({});
    setSearchTerm('');
    setSelectedProductFilter('Todos');
  };

  // Handle column sorting
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDirection === 'asc') setSortDirection('desc');
      else if (sortDirection === 'desc') {
        setSortField('date');
        setSortDirection('desc');
      } else setSortDirection('asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Filtered & Sorted Sales rows
  const processedRows = useMemo(() => {
    const today = new Date();
    const todayFormatted = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;

    return sales
      .map(sale => getSaleRowData(sale))
      .filter(row => {
        // Only today filter
        if (onlyToday) {
          const isToday = row.date === todayFormatted || row.date === '02/09/2026';
          if (!isToday) return false;
        }

        // Product category filter
        if (selectedProductFilter !== 'Todos' && row.mainProduct !== selectedProductFilter) {
          return false;
        }

        // Global search query
        if (searchTerm.trim()) {
          const q = searchTerm.toLowerCase();
          const match = 
            row.collaborator.toLowerCase().includes(q) ||
            row.opportunity.toLowerCase().includes(q) ||
            row.candidate.toLowerCase().includes(q) ||
            row.date.toLowerCase().includes(q) ||
            row.fdi.toLowerCase().includes(q) ||
            row.modality.toLowerCase().includes(q) ||
            row.shift.toLowerCase().includes(q) ||
            row.parcelaLeve.toLowerCase().includes(q) ||
            row.empresa.toLowerCase().includes(q) ||
            row.notes.toLowerCase().includes(q);
          if (!match) return false;
        }

        // Column individual filters
        for (const [colKey, selectedVals] of Object.entries(columnFilters) as [string, string[]][]) {
          if (!selectedVals || selectedVals.length === 0) continue;
          let rowVal = '';
          switch (colKey) {
            case 'collaborator': rowVal = row.collaborator; break;
            case 'opportunity': rowVal = row.opportunity; break;
            case 'candidate': rowVal = row.candidate; break;
            case 'date': rowVal = row.date; break;
            case 'fdi': rowVal = row.fdi; break;
            case 'modality': rowVal = row.modality; break;
            case 'shift': rowVal = row.shift; break;
            case 'parcela_leve': rowVal = row.parcelaLeve; break;
            case 'bolsa_convenio': rowVal = row.hasBolsa; break;
            case 'empresa': rowVal = row.empresa; break;
            case 'notes': rowVal = row.notes; break;
          }
          if (!selectedVals.includes(rowVal)) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (!sortDirection) return 0;
        let valA = '';
        let valB = '';

        switch (sortField) {
          case 'collaborator': valA = a.collaborator; valB = b.collaborator; break;
          case 'opportunity': valA = a.opportunity; valB = b.opportunity; break;
          case 'candidate': valA = a.candidate; valB = b.candidate; break;
          case 'date': valA = a.date; valB = b.date; break;
          case 'fdi': valA = a.fdi; valB = b.fdi; break;
          case 'modality': valA = a.modality; valB = b.modality; break;
          case 'shift': valA = a.shift; valB = b.shift; break;
          case 'parcela_leve': valA = a.parcelaLeve; valB = b.parcelaLeve; break;
          case 'bolsa_convenio': valA = a.hasBolsa; valB = b.hasBolsa; break;
          case 'empresa': valA = a.empresa; valB = b.empresa; break;
          case 'notes': valA = a.notes; valB = b.notes; break;
        }

        const comp = valA.localeCompare(valB, 'pt-BR', { numeric: true });
        return sortDirection === 'asc' ? comp : -comp;
      });
  }, [sales, searchTerm, sortField, sortDirection, selectedProductFilter, columnFilters]);

  // Export to CSV / Excel spreadsheet format
  const exportToCSV = () => {
    const headers = [
      'Nome do Colaborador',
      'Número da Oportunidade',
      'Nome do Candidato',
      'Data',
      'FDI',
      'Modalidade',
      'Turno',
      'Parcela Leve',
      'Bolsa Convênio Aplicada',
      'Qual Empresa?',
      'Observação'
    ];

    const rows = processedRows.map(r => [
      `"${r.collaborator}"`,
      `"${r.opportunity}"`,
      `"${r.candidate.replace(/"/g, '""')}"`,
      `"${r.date}"`,
      `"${r.fdi}"`,
      `"${r.modality}"`,
      `"${r.shift}"`,
      `"${r.parcelaLeve}"`,
      `"${r.hasBolsa}"`,
      `"${r.empresa}"`,
      `"${r.notes.replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + 
      [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `R9_Planilha_Vendas_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper for filter popover dropdown
  const renderFilterMenu = (columnKey: string, columnLabel: string, distinctList: string[]) => {
    if (openFilterColumn !== columnKey) return null;
    const selectedList = columnFilters[columnKey] || [];

    return (
      <div 
        ref={filterMenuRef}
        className="absolute left-0 top-full mt-1 w-56 bg-white rounded-lg shadow-xl border border-gray-200 z-50 p-2 text-xs text-gray-700 animate-in fade-in duration-150"
      >
        <div className="flex items-center justify-between pb-2 border-b border-gray-100 mb-2">
          <span className="font-bold text-gray-800 text-[11px] truncate max-w-[140px]">
            Filtrar {columnLabel}
          </span>
          {selectedList.length > 0 && (
            <button
              onClick={() => clearColumnFilter(columnKey)}
              className="text-[10px] text-blue-600 hover:text-blue-800 font-medium"
            >
              Limpar
            </button>
          )}
        </div>

        {/* Sort quick actions */}
        <div className="flex items-center gap-1 mb-2">
          <button
            onClick={() => {
              setSortField(columnKey as SortField);
              setSortDirection('asc');
              setOpenFilterColumn(null);
            }}
            className="flex-1 px-2 py-1 bg-gray-50 hover:bg-gray-100 rounded text-[11px] font-medium text-gray-600 flex items-center justify-center gap-1"
          >
            <ArrowUp className="w-3 h-3 text-gray-500" /> A-Z
          </button>
          <button
            onClick={() => {
              setSortField(columnKey as SortField);
              setSortDirection('desc');
              setOpenFilterColumn(null);
            }}
            className="flex-1 px-2 py-1 bg-gray-50 hover:bg-gray-100 rounded text-[11px] font-medium text-gray-600 flex items-center justify-center gap-1"
          >
            <ArrowDown className="w-3 h-3 text-gray-500" /> Z-A
          </button>
        </div>

        {/* Checkbox list */}
        <div className="max-h-40 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
          {distinctList.length === 0 ? (
            <p className="text-gray-400 italic text-[11px] py-1">Nenhum valor disponível</p>
          ) : (
            distinctList.map(val => {
              const isChecked = selectedList.includes(val);
              return (
                <label 
                  key={val}
                  className="flex items-center gap-2 px-1.5 py-1 hover:bg-blue-50 rounded cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleColumnFilterValue(columnKey, val)}
                    className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-[11px] text-gray-700 truncate">{val}</span>
                </label>
              );
            })
          )}
        </div>

        <div className="pt-2 mt-2 border-t border-gray-100 flex justify-end">
          <button
            onClick={() => setOpenFilterColumn(null)}
            className="px-2.5 py-1 bg-[#0052cc] text-white text-[11px] font-semibold rounded hover:bg-[#00478f]"
          >
            Aplicar
          </button>
        </div>
      </div>
    );
  };

  const hasActiveFilters = Object.keys(columnFilters).length > 0 || searchTerm !== '' || selectedProductFilter !== 'Todos';

  return (
    <div className="w-full space-y-3 font-sans">
      
      {/* Top Controls Toolbar: Search, Filters & Export */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-1">
        
        {/* Left: Global Search & Product Chips */}
        <div className="flex flex-wrap items-center gap-2">
          
          {/* Search Box */}
          <div className="relative min-w-[220px] max-w-xs">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar em toda a planilha..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-800 placeholder-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Product Filter Pills */}
          <div className="inline-flex bg-gray-100/80 p-0.5 rounded-lg border border-gray-200 text-xs font-medium">
            {(['Todos', 'Graduação', 'Pós Graduação', 'Curso Técnico'] as const).map((prod) => (
              <button
                key={prod}
                onClick={() => setSelectedProductFilter(prod)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                  selectedProductFilter === prod
                    ? 'bg-white text-gray-900 shadow-2xs font-bold'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                {prod}
              </button>
            ))}
          </div>

          {/* Reset Filters */}
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
              title="Limpar todos os filtros"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Limpar Filtros</span>
            </button>
          )}

        </div>

        {/* Right: Record count, Export & Add sale */}
        <div className="flex items-center gap-2">
          
          <div className="text-[11px] text-gray-500 font-medium px-2 py-1 bg-gray-50 rounded-md border border-gray-200">
            <span className="font-bold text-gray-800">{processedRows.length}</span> registros
          </div>

          {/* Export to CSV/Excel */}
          <button
            id="export-excel-btn"
            onClick={exportToCSV}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-2xs"
            title="Exportar dados para planilha Excel (.csv)"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Exportar Excel</span>
          </button>

          {/* Lançar Venda */}
          {onOpenNewSaleModal && (
            <button
              id="new-sale-spreadsheet-btn"
              onClick={onOpenNewSaleModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0052cc] hover:bg-[#00478f] text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Lançar Venda</span>
            </button>
          )}

        </div>

      </div>

      {/* SPREADSHEET GRID CONTAINER (Exact Excel Design) */}
      <div className="w-full bg-white rounded-xl border border-gray-300 shadow-xs overflow-hidden">
        
        <div className="overflow-x-auto max-h-[700px] overflow-y-auto">
          
          <table className="w-full border-collapse text-left text-xs font-sans whitespace-nowrap">
            
            {/* Excel-style Column Headers */}
            <thead className="sticky top-0 z-20 bg-[#F4F5F7] border-b-2 border-gray-300 select-none shadow-xs">
              <tr className="divide-x divide-gray-300">
                
                {/* 1. Nome do Colaborador */}
                <th className="relative px-3 py-2.5 font-semibold text-gray-800 text-xs tracking-tight bg-[#F4F5F7] hover:bg-gray-200/80 transition-colors">
                  <div className="flex items-center justify-between gap-1.5">
                    <span 
                      onClick={() => handleSort('collaborator')}
                      className="cursor-pointer hover:text-blue-700"
                    >
                      Nome do Colaborador
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenFilterColumn(openFilterColumn === 'collaborator' ? null : 'collaborator');
                      }}
                      className={`p-0.5 rounded hover:bg-gray-300 transition-colors ${columnFilters['collaborator'] ? 'text-blue-600 font-bold' : 'text-gray-500'}`}
                      title="Filtrar Colaborador"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {renderFilterMenu('collaborator', 'Colaborador', distinctColumnValues.collaborator)}
                </th>

                {/* 2. Número da Oportunidade */}
                <th className="relative px-3 py-2.5 font-semibold text-gray-800 text-xs tracking-tight bg-[#F4F5F7] hover:bg-gray-200/80 transition-colors">
                  <div className="flex items-center justify-between gap-1.5">
                    <span 
                      onClick={() => handleSort('opportunity')}
                      className="cursor-pointer hover:text-blue-700"
                    >
                      Número da Oportunidade
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenFilterColumn(openFilterColumn === 'opportunity' ? null : 'opportunity');
                      }}
                      className={`p-0.5 rounded hover:bg-gray-300 transition-colors ${columnFilters['opportunity'] ? 'text-blue-600 font-bold' : 'text-gray-500'}`}
                      title="Filtrar Oportunidade"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {renderFilterMenu('opportunity', 'Oportunidade', distinctColumnValues.opportunity)}
                </th>

                {/* 3. Nome do Candidato */}
                <th className="relative px-3 py-2.5 font-semibold text-gray-800 text-xs tracking-tight bg-[#F4F5F7] hover:bg-gray-200/80 transition-colors min-w-[200px]">
                  <div className="flex items-center justify-between gap-1.5">
                    <span 
                      onClick={() => handleSort('candidate')}
                      className="cursor-pointer hover:text-blue-700"
                    >
                      Nome do Candidato
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenFilterColumn(openFilterColumn === 'candidate' ? null : 'candidate');
                      }}
                      className={`p-0.5 rounded hover:bg-gray-300 transition-colors ${columnFilters['candidate'] ? 'text-blue-600 font-bold' : 'text-gray-500'}`}
                      title="Filtrar Candidato"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {renderFilterMenu('candidate', 'Candidato', distinctColumnValues.candidate)}
                </th>

                {/* 4. Data */}
                <th className="relative px-3 py-2.5 font-semibold text-gray-800 text-xs tracking-tight bg-[#F4F5F7] hover:bg-gray-200/80 transition-colors">
                  <div className="flex items-center justify-between gap-1.5">
                    <span 
                      onClick={() => handleSort('date')}
                      className="cursor-pointer hover:text-blue-700"
                    >
                      Data
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenFilterColumn(openFilterColumn === 'date' ? null : 'date');
                      }}
                      className={`p-0.5 rounded hover:bg-gray-300 transition-colors ${columnFilters['date'] ? 'text-blue-600 font-bold' : 'text-gray-500'}`}
                      title="Filtrar Data"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {renderFilterMenu('date', 'Data', distinctColumnValues.date)}
                </th>

                {/* 5. FDI */}
                <th className="relative px-3 py-2.5 font-semibold text-gray-800 text-xs tracking-tight bg-[#F4F5F7] hover:bg-gray-200/80 transition-colors">
                  <div className="flex items-center justify-between gap-1.5">
                    <span 
                      onClick={() => handleSort('fdi')}
                      className="cursor-pointer hover:text-blue-700"
                    >
                      FDI
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenFilterColumn(openFilterColumn === 'fdi' ? null : 'fdi');
                      }}
                      className={`p-0.5 rounded hover:bg-gray-300 transition-colors ${columnFilters['fdi'] ? 'text-blue-600 font-bold' : 'text-gray-500'}`}
                      title="Filtrar FDI"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {renderFilterMenu('fdi', 'FDI', distinctColumnValues.fdi)}
                </th>

                {/* 6. Modalidade */}
                <th className="relative px-3 py-2.5 font-semibold text-gray-800 text-xs tracking-tight bg-[#F4F5F7] hover:bg-gray-200/80 transition-colors">
                  <div className="flex items-center justify-between gap-1.5">
                    <span 
                      onClick={() => handleSort('modality')}
                      className="cursor-pointer hover:text-blue-700"
                    >
                      Modalidade
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenFilterColumn(openFilterColumn === 'modality' ? null : 'modality');
                      }}
                      className={`p-0.5 rounded hover:bg-gray-300 transition-colors ${columnFilters['modality'] ? 'text-blue-600 font-bold' : 'text-gray-500'}`}
                      title="Filtrar Modalidade"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {renderFilterMenu('modality', 'Modalidade', distinctColumnValues.modality)}
                </th>

                {/* 7. Turno */}
                <th className="relative px-3 py-2.5 font-semibold text-gray-800 text-xs tracking-tight bg-[#F4F5F7] hover:bg-gray-200/80 transition-colors">
                  <div className="flex items-center justify-between gap-1.5">
                    <span 
                      onClick={() => handleSort('shift')}
                      className="cursor-pointer hover:text-blue-700"
                    >
                      Turno
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenFilterColumn(openFilterColumn === 'shift' ? null : 'shift');
                      }}
                      className={`p-0.5 rounded hover:bg-gray-300 transition-colors ${columnFilters['shift'] ? 'text-blue-600 font-bold' : 'text-gray-500'}`}
                      title="Filtrar Turno"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {renderFilterMenu('shift', 'Turno', distinctColumnValues.shift)}
                </th>

                {/* 8. Parcela Leve */}
                <th className="relative px-3 py-2.5 font-semibold text-gray-800 text-xs tracking-tight bg-[#F4F5F7] hover:bg-gray-200/80 transition-colors">
                  <div className="flex items-center justify-between gap-1.5">
                    <span 
                      onClick={() => handleSort('parcela_leve')}
                      className="cursor-pointer hover:text-blue-700"
                    >
                      Parcela Leve
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenFilterColumn(openFilterColumn === 'parcela_leve' ? null : 'parcela_leve');
                      }}
                      className={`p-0.5 rounded hover:bg-gray-300 transition-colors ${columnFilters['parcela_leve'] ? 'text-blue-600 font-bold' : 'text-gray-500'}`}
                      title="Filtrar Parcela Leve"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {renderFilterMenu('parcela_leve', 'Parcela Leve', distinctColumnValues.parcela_leve)}
                </th>

                {/* 9. Bolsa Convênio Aplicada */}
                <th className="relative px-3 py-2.5 font-semibold text-gray-800 text-xs tracking-tight bg-[#F4F5F7] hover:bg-gray-200/80 transition-colors">
                  <div className="flex items-center justify-between gap-1.5">
                    <span 
                      onClick={() => handleSort('bolsa_convenio')}
                      className="cursor-pointer hover:text-blue-700"
                    >
                      Bolsa Convênio Aplicada
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenFilterColumn(openFilterColumn === 'bolsa_convenio' ? null : 'bolsa_convenio');
                      }}
                      className={`p-0.5 rounded hover:bg-gray-300 transition-colors ${columnFilters['bolsa_convenio'] ? 'text-blue-600 font-bold' : 'text-gray-500'}`}
                      title="Filtrar Bolsa Convênio"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {renderFilterMenu('bolsa_convenio', 'Bolsa Convênio', distinctColumnValues.bolsa_convenio)}
                </th>

                {/* 10. Qual Empresa? */}
                <th className="relative px-3 py-2.5 font-semibold text-gray-800 text-xs tracking-tight bg-[#F4F5F7] hover:bg-gray-200/80 transition-colors min-w-[140px]">
                  <div className="flex items-center justify-between gap-1.5">
                    <span 
                      onClick={() => handleSort('empresa')}
                      className="cursor-pointer hover:text-blue-700"
                    >
                      Qual Empresa?
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenFilterColumn(openFilterColumn === 'empresa' ? null : 'empresa');
                      }}
                      className={`p-0.5 rounded hover:bg-gray-300 transition-colors ${columnFilters['empresa'] ? 'text-blue-600 font-bold' : 'text-gray-500'}`}
                      title="Filtrar Empresa"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {renderFilterMenu('empresa', 'Qual Empresa?', distinctColumnValues.empresa)}
                </th>

                {/* 11. Observação */}
                <th className="relative px-3 py-2.5 font-semibold text-gray-800 text-xs tracking-tight bg-[#F4F5F7] hover:bg-gray-200/80 transition-colors min-w-[130px]">
                  <div className="flex items-center justify-between gap-1.5">
                    <span 
                      onClick={() => handleSort('notes')}
                      className="cursor-pointer hover:text-blue-700"
                    >
                      Observação
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenFilterColumn(openFilterColumn === 'notes' ? null : 'notes');
                      }}
                      className={`p-0.5 rounded hover:bg-gray-300 transition-colors ${columnFilters['notes'] ? 'text-blue-600 font-bold' : 'text-gray-500'}`}
                      title="Filtrar Observações"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {renderFilterMenu('notes', 'Observação', distinctColumnValues.notes)}
                </th>

                {/* 12. Ações (Exclusivo Administrador) */}
                {isAdmin && (
                  <th className="px-3 py-2.5 font-semibold text-gray-800 text-xs text-center bg-[#F4F5F7] w-24">
                    Ações
                  </th>
                )}

              </tr>
            </thead>

            {/* Excel-style Rows with alternating stripe coloring (#FFFFFF and #EDF5FD / #F0F7FF) */}
            <tbody className="divide-y divide-gray-200">
              {processedRows.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 12 : 11} className="py-14 text-center text-gray-400 bg-white">
                    <div className="flex flex-col items-center justify-center space-y-2.5 max-w-sm mx-auto">
                      <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-500 flex items-center justify-center">
                        <FileSpreadsheet className="w-6 h-6" />
                      </div>
                      {sales.length === 0 ? (
                        <>
                          <p className="text-sm font-bold text-gray-800">Planilha de Vendas Zerada</p>
                          <p className="text-xs text-gray-500">
                            Nenhuma venda cadastrada no sistema. Utilize o botão abaixo para lançar novos registros.
                          </p>
                          {onOpenNewSaleModal && (
                            <button
                              onClick={onOpenNewSaleModal}
                              className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-[#0052cc] hover:bg-[#00478f] text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                            >
                              <Plus className="w-4 h-4" />
                              <span>Lançar Nova Venda</span>
                            </button>
                          )}
                        </>
                      ) : (
                        <>
                          <p className="text-xs font-semibold text-gray-700">Nenhum lançamento encontrado na planilha com os filtros atuais.</p>
                          <button
                            onClick={clearAllFilters}
                            className="text-xs text-blue-600 hover:underline font-semibold cursor-pointer"
                          >
                            Limpar todos os filtros
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                processedRows.map((row, idx) => {
                  // Alternating zebra color: even = #FFFFFF, odd = #EDF5FD (soft excel ice blue)
                  const isEven = idx % 2 === 0;
                  const rowBgClass = isEven ? 'bg-white hover:bg-blue-50/70' : 'bg-[#EDF5FD] hover:bg-blue-100/70';

                  return (
                    <tr 
                      key={row.raw.id || idx}
                      onClick={() => setSelectedSale(row.raw)}
                      className={`${rowBgClass} transition-colors divide-x divide-gray-200 cursor-pointer group`}
                    >
                      
                      {/* 1. Nome do Colaborador */}
                      <td className="px-3 py-1.5 text-gray-800 font-normal">
                        <span className="font-medium text-gray-900">{row.collaborator}</span>
                      </td>

                      {/* 2. Número da Oportunidade */}
                      <td className="px-3 py-1.5 text-gray-700 font-mono text-[11px]">
                        {row.opportunity}
                      </td>

                      {/* 3. Nome do Candidato */}
                      <td className="px-3 py-1.5 text-gray-900 font-medium">
                        {row.candidate}
                      </td>

                      {/* 4. Data */}
                      <td className="px-3 py-1.5 text-gray-600 text-[11px]">
                        {row.date}
                      </td>

                      {/* 5. FDI */}
                      <td className="px-3 py-1.5 text-gray-700">
                        {row.fdi}
                      </td>

                      {/* 6. Modalidade */}
                      <td className="px-3 py-1.5 text-gray-800">
                        {row.modality}
                      </td>

                      {/* 7. Turno */}
                      <td className="px-3 py-1.5 text-gray-700">
                        {row.shift}
                      </td>

                      {/* 8. Parcela Leve */}
                      <td className="px-3 py-1.5 text-gray-700">
                        {row.parcelaLeve}
                      </td>

                      {/* 9. Bolsa Convênio Aplicada */}
                      <td className="px-3 py-1.5 text-gray-800">
                        {row.hasBolsa === 'Sim' ? (
                          <span className="text-emerald-700 font-bold">Sim</span>
                        ) : (
                          <span className="text-gray-600">Não</span>
                        )}
                      </td>

                      {/* 10. Qual Empresa? */}
                      <td className="px-3 py-1.5 text-gray-700">
                        {row.empresa || '-'}
                      </td>

                      {/* 11. Observação */}
                      <td className="px-3 py-1.5 text-gray-600 italic">
                        {row.notes || ''}
                      </td>

                      {/* 12. Ações (Exclusivo Administrador) */}
                      {isAdmin && (
                        <td className="px-2 py-1 text-center" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => setEditingSale(row.raw)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-blue-50 text-blue-700 hover:text-blue-800 border border-blue-200 hover:border-blue-400 rounded-lg text-[11px] font-semibold transition-all shadow-2xs cursor-pointer"
                            title="Editar Lançamento (Admin)"
                          >
                            <Edit3 className="w-3 h-3 text-blue-600" />
                            <span>Editar</span>
                          </button>
                        </td>
                      )}

                    </tr>
                  );
                })
              )}
            </tbody>

          </table>

        </div>

        {/* Excel Bottom Status Bar */}
        <div className="bg-[#F8F9FA] px-4 py-2 border-t border-gray-300 flex items-center justify-between text-[11px] text-gray-500 font-medium">
          <div className="flex items-center gap-4">
            <span>Linhas visíveis: <strong className="text-gray-800">{processedRows.length}</strong></span>
            <span>Com Bolsa Convênio: <strong className="text-gray-800">{processedRows.filter(r => r.hasBolsa === 'Sim').length}</strong></span>
            <span>Com Parcela Leve: <strong className="text-gray-800">{processedRows.filter(r => r.parcelaLeve !== 'Sem parcelas' && r.parcelaLeve !== 'Sem Parcelas').length}</strong></span>
          </div>

          <div className="flex items-center gap-2 text-gray-400">
            <span>Dica: Clique nas setas dos cabeçalhos para ordenar e filtrar</span>
          </div>
        </div>

      </div>

      {/* MODAL DE DETALHES DO LANÇAMENTO AO CLICAR NA LINHA */}
      {selectedSale && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-200 animate-in fade-in zoom-in-95 duration-150 space-y-4">
            
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#00478f] flex items-center justify-center font-bold">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">
                    Detalhes do Lançamento
                  </h3>
                  <p className="text-[11px] text-gray-500 font-mono">
                    {selectedSale.custom_data?.opportunity_number || selectedSale.id}
                  </p>
                </div>
              </div>

              <button 
                onClick={() => setSelectedSale(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-100">
                <span className="text-[10px] text-gray-400 font-medium block">Colaborador</span>
                <span className="font-semibold text-gray-800">{selectedSale.seller_name || 'Consultor'}</span>
              </div>

              <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-100">
                <span className="text-[10px] text-gray-400 font-medium block">Candidato / Aluno</span>
                <span className="font-semibold text-gray-800">{selectedSale.custom_data?.candidate_name || selectedSale.client_name}</span>
              </div>

              <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-100">
                <span className="text-[10px] text-gray-400 font-medium block">Produto & Modalidade</span>
                <span className="font-semibold text-gray-800">
                  {selectedSale.custom_data?.main_product || 'Graduação'} - {selectedSale.custom_data?.modality || 'Presencial'}
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-100">
                <span className="text-[10px] text-gray-400 font-medium block">FDI & Turno</span>
                <span className="font-semibold text-gray-800">
                  {selectedSale.custom_data?.fdi_channel || 'Simplificada'} ({selectedSale.custom_data?.shift || 'Noite'})
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-100">
                <span className="text-[10px] text-gray-400 font-medium block">Condições de Pagamento</span>
                <span className="font-semibold text-gray-800">
                  {selectedSale.custom_data?.parcela_leve || 'Sem parcelas'}
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-100">
                <span className="text-[10px] text-gray-400 font-medium block">Bolsa Convênio</span>
                <span className="font-semibold text-gray-800">
                  {selectedSale.custom_data?.has_bolsa_convenio ? `Sim (${selectedSale.custom_data.empresa_convenio || 'Parceiro'})` : 'Não'}
                </span>
              </div>
            </div>

            {selectedSale.notes && (
              <div className="p-2.5 rounded-lg bg-amber-50/60 border border-amber-200/60 text-xs">
                <span className="text-[10px] text-amber-800 font-bold block">Observações</span>
                <p className="text-amber-900 mt-0.5">{selectedSale.notes}</p>
              </div>
            )}

            <div className="pt-2 flex items-center justify-between gap-2 border-t border-gray-100">
              {isAdmin ? (
                <button
                  type="button"
                  onClick={() => {
                    const saleToEdit = selectedSale;
                    setSelectedSale(null);
                    setEditingSale(saleToEdit);
                  }}
                  className="px-3.5 py-2 bg-[#0052cc] hover:bg-[#00478f] text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Editar Lançamento (Admin)</span>
                </button>
              ) : (
                <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                  <Shield className="w-3.5 h-3.5 text-gray-400" />
                  <span>Somente leitura</span>
                </div>
              )}

              <button
                onClick={() => setSelectedSale(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
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
