import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, Edit3, FileSpreadsheet, Plus, RotateCcw, Search, Shield, X,
} from 'lucide-react';
import { Sale } from '../../types';
import { useSales } from '../../context/SalesContext';
import { useAuth } from '../../context/AuthContext';
import { EditSaleModal } from './EditSaleModal';
import { getSaleDateBr, getSaleFdiDisplay } from '../../lib/salesMapper';
import { ALL_FDI, ALL_MODALITIES, ALL_SHIFTS, MAIN_PRODUCTS, REQUIRED_FIELD_LABEL, modalitiesFor } from '../../lib/saleOptions';
import { SalesQueryFilters, SalesSortField } from '../../lib/salesQuery';
import { fdiStyle } from '../../lib/saleStyles';
import { toLocalIso } from '../../lib/dates';

export type SalesPeriod = 'all' | 'today' | 'yesterday' | 'week' | 'month' | 'custom';

interface SalesSpreadsheetTableProps {
  onOpenNewSaleModal?: () => void;
  initialPeriod?: SalesPeriod;
}

const PAGE_SIZE = 50;

const PERIODS: Array<{ id: SalesPeriod; label: string }> = [
  { id: 'all', label: 'Todas' },
  { id: 'today', label: 'Hoje' },
  { id: 'yesterday', label: 'Ontem' },
  { id: 'week', label: 'Esta semana' },
  { id: 'month', label: 'Este mês' },
  { id: 'custom', label: 'Escolher datas' },
];

const isoOf = toLocalIso;

/** Intervalo de datas (aaaa-mm-dd) do período escolhido. Semana = segunda a hoje. */
function periodRange(period: SalesPeriod, customFrom: string, customTo: string): { dateFrom?: string; dateTo?: string } {
  const now = new Date();
  const today = isoOf(now);
  if (period === 'today') return { dateFrom: today, dateTo: today };
  if (period === 'yesterday') {
    const y = isoOf(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
    return { dateFrom: y, dateTo: y };
  }
  if (period === 'week') {
    const offset = (now.getDay() + 6) % 7;
    return { dateFrom: isoOf(new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset)), dateTo: today };
  }
  if (period === 'month') return { dateFrom: isoOf(new Date(now.getFullYear(), now.getMonth(), 1)), dateTo: today };
  if (period === 'custom') return { dateFrom: customFrom || undefined, dateTo: customTo || undefined };
  return {};
}

const MissingCell: React.FC = () => (
  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-600">
    <AlertTriangle className="w-3 h-3" /> Falta preencher
  </span>
);

/** Valores de exibição de uma venda. `null` = campo obrigatório que a venda não tem. */
function rowOf(sale: Sale) {
  const miss = new Set(sale.missing_fields || []);
  const c = sale.custom_data || {};
  return {
    sale,
    collaborator: miss.has('seller') ? null : sale.seller_name || '—',
    opportunity: miss.has('opportunity') ? null : c.opportunity_number || '—',
    candidate: miss.has('candidate') ? null : c.candidate_name || sale.client_name || '—',
    date: miss.has('date') ? null : getSaleDateBr(sale),
    fdi: miss.has('fdi') ? null : getSaleFdiDisplay(sale),
    product: miss.has('product') ? null : c.main_product || sale.product_name || '—',
    modality: miss.has('modality') ? null : c.modality || '—',
    shift: miss.has('shift') ? null : c.shift || '—',
    parcelaLeve: c.parcela_leve || 'Sem parcelas',
    hasBolsa: c.has_bolsa_convenio ? 'Sim' : 'Não',
    empresa: c.empresa_convenio || '',
    notes: sale.notes || '',
    incomplete: miss.size > 0,
  };
}

type Row = ReturnType<typeof rowOf>;

const COLUMNS: Array<{ key: SalesSortField; label: string; className?: string; render: (r: Row) => React.ReactNode }> = [
  { key: 'collaborator', label: 'Consultor', render: r => r.collaborator ?? <MissingCell />, className: 'font-medium text-gray-900' },
  { key: 'opportunity', label: 'Oportunidade', render: r => r.opportunity ?? <MissingCell />, className: 'font-mono text-[11px] text-gray-700' },
  { key: 'candidate', label: 'Aluno', render: r => r.candidate ?? <MissingCell />, className: 'font-medium text-gray-900 min-w-[180px]' },
  { key: 'date', label: 'Data', render: r => r.date ?? <MissingCell />, className: 'text-[11px] text-gray-600' },
  {
    key: 'fdi', label: 'FDI', render: r => (r.fdi === null ? <MissingCell /> : (
      <span className={`inline-flex px-2 py-0.5 rounded border text-[11px] font-medium ${fdiStyle(r.fdi).badge}`}>{r.fdi}</span>
    )),
  },
  { key: 'modality', label: 'Modalidade', render: r => r.modality ?? <MissingCell /> },
  { key: 'shift', label: 'Turno', render: r => r.shift ?? <MissingCell /> },
  { key: 'parcela_leve', label: 'Parcela Leve', render: r => r.parcelaLeve },
  { key: 'bolsa_convenio', label: 'Bolsa Convênio', render: r => (r.hasBolsa === 'Sim' ? <span className="text-emerald-700 font-bold">Sim</span> : 'Não') },
  { key: 'empresa', label: 'Empresa', render: r => r.empresa || '—', className: 'min-w-[120px]' },
  { key: 'notes', label: 'Observação', render: r => r.notes, className: 'italic text-gray-600 max-w-[240px] truncate' },
];

const selectCls = (active: boolean) =>
  `h-8 pl-2.5 pr-7 rounded-lg border text-xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
    active ? 'bg-blue-50 border-blue-300 text-blue-800 font-semibold' : 'bg-white border-gray-200 text-gray-700'
  }`;

export const SalesSpreadsheetTable: React.FC<SalesSpreadsheetTableProps> = ({ onOpenNewSaleModal, initialPeriod = 'all' }) => {
  const { fetchSalesPage, fetchSalesSummary, fetchAllFilteredSales, sales: liveSales } = useSales();
  const { currentUser, profiles } = useAuth();
  const isAdmin = currentUser?.role === 'admin';

  // Filtros
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [period, setPeriod] = useState<SalesPeriod>(initialPeriod);
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [sellerId, setSellerId] = useState('');
  const [onlyMine, setOnlyMine] = useState(false);
  const [product, setProduct] = useState('');
  const [modality, setModality] = useState('');
  const [fdi, setFdi] = useState('');
  const [shift, setShift] = useState('');
  const [incompleteOnly, setIncompleteOnly] = useState(false);

  // Ordenação e página
  const [sortField, setSortField] = useState<SalesSortField>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);

  // Dados
  const [pageSales, setPageSales] = useState<Sale[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState({ withBolsa: 0, withParcela: 0, incomplete: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);

  const canEditSale = (sale: Sale) => Boolean(currentUser && (isAdmin || sale.seller_id === currentUser.id));

  useEffect(() => {
    const t = setTimeout(() => setSearchTerm(searchInput.trim()), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const filters = useMemo<SalesQueryFilters>(() => ({
    searchTerm,
    product: product || undefined,
    modality: modality || undefined,
    fdi: fdi || undefined,
    shift: shift || undefined,
    sellerId: onlyMine ? currentUser?.id : sellerId || undefined,
    incompleteOnly,
    ...periodRange(period, customFrom, customTo),
  }), [searchTerm, product, modality, fdi, shift, onlyMine, currentUser?.id, sellerId, incompleteOnly, period, customFrom, customTo]);

  const filtersKey = JSON.stringify(filters);
  useEffect(() => setCurrentPage(1), [filtersKey, sortField, sortDirection]);

  const requestId = useRef(0);
  const load = useCallback(async () => {
    const id = ++requestId.current;
    setIsLoading(true);
    setPageError(null);
    try {
      const [page, sum] = await Promise.all([
        fetchSalesPage({ ...filters, page: currentPage, pageSize: PAGE_SIZE, sortField, sortDirection }),
        fetchSalesSummary(filters),
      ]);
      if (id !== requestId.current) return;
      setPageSales(page.data);
      setTotal(page.count);
      setPageError(page.error || null);
      setSummary(sum);
    } catch (err) {
      if (id !== requestId.current) return;
      setPageSales([]);
      setTotal(0);
      setPageError(err instanceof Error ? err.message : 'Não foi possível carregar as vendas.');
    } finally {
      if (id === requestId.current) setIsLoading(false);
    }
  }, [fetchSalesPage, fetchSalesSummary, filters, currentPage, sortField, sortDirection]);

  useEffect(() => { load(); }, [load]);
  const loadRef = useRef(load);
  loadRef.current = load;

  // Venda lançada, editada ou excluída por qualquer pessoa: a lista do contexto muda
  // (tempo real) e a página é recarregada.
  const firstLive = useRef(true);
  useEffect(() => {
    if (firstLive.current) { firstLive.current = false; return; }
    const t = setTimeout(() => loadRef.current(), 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveSales]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  useEffect(() => { if (currentPage > totalPages) setCurrentPage(totalPages); }, [currentPage, totalPages]);

  const rows = useMemo(() => pageSales.map(rowOf), [pageSales]);

  const consultants = useMemo(
    () => [...profiles].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [profiles],
  );
  const modalityOptions = product ? modalitiesFor(product as never).map(m => m.name) : ALL_MODALITIES;

  const hasFilters = Boolean(searchInput || period !== 'all' || sellerId || onlyMine || product || modality || fdi || shift || incompleteOnly);
  const clearAll = () => {
    setSearchInput(''); setSearchTerm(''); setPeriod('all'); setCustomFrom(''); setCustomTo('');
    setSellerId(''); setOnlyMine(false); setProduct(''); setModality(''); setFdi(''); setShift(''); setIncompleteOnly(false);
  };

  const handleSort = (field: SalesSortField) => {
    if (sortField !== field) { setSortField(field); setSortDirection('asc'); return; }
    if (sortDirection === 'asc') { setSortDirection('desc'); return; }
    setSortField('date'); setSortDirection('desc');
  };

  const exportToCSV = async () => {
    setIsExporting(true);
    const { data, error } = await fetchAllFilteredSales(filters, sortField, sortDirection);
    setIsExporting(false);
    if (error) { setPageError(error); return; }
    const q = (v: string | null) => `"${(v ?? 'Falta preencher').replace(/"/g, '""')}"`;
    const header = ['Consultor', 'Oportunidade', 'Aluno', 'Data', 'Produto', 'FDI', 'Modalidade', 'Turno', 'Parcela Leve', 'Bolsa Convênio', 'Empresa', 'Observação'];
    const lines = data.map(rowOf).map(r => [
      q(r.collaborator), q(r.opportunity), q(r.candidate), q(r.date), q(r.product), q(r.fdi), q(r.modality), q(r.shift),
      q(r.parcelaLeve), q(r.hasBolsa), q(r.empresa), q(r.notes),
    ].join(';'));
    const blob = new Blob(['﻿' + [header.join(';'), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `R9_Vendas_${isoOf(new Date())}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const rangeStart = total === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(currentPage * PAGE_SIZE, total);

  return (
    <div className="w-full space-y-3 font-sans">
      {/* Linha 1: busca, período e ações */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px]">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar aluno, oportunidade, consultor..."
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              className="w-full h-8 pl-8 pr-7 bg-white border border-gray-200 rounded-lg text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              name="sales_search"
            />
            {searchInput && (
              <button onClick={() => setSearchInput('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer" title="Limpar busca">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="inline-flex flex-wrap bg-gray-100/80 p-0.5 rounded-lg border border-gray-200">
            {PERIODS.map(p => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                  period === p.id ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          {period === 'custom' && (
            <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
              <input type="date" value={customFrom} max={customTo || undefined} onChange={e => setCustomFrom(e.target.value)} className="h-8 px-2 border border-gray-200 rounded-lg text-xs" name="sales_from" />
              <span>até</span>
              <input type="date" value={customTo} min={customFrom || undefined} onChange={e => setCustomTo(e.target.value)} className="h-8 px-2 border border-gray-200 rounded-lg text-xs" name="sales_to" />
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="text-[11px] text-gray-500 font-medium px-2 py-1 bg-gray-50 rounded-md border border-gray-200 whitespace-nowrap">
            <span className="font-bold text-gray-800">{total}</span> {total === 1 ? 'venda' : 'vendas'}
          </div>
          <button
            onClick={exportToCSV}
            disabled={isExporting || total === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold cursor-pointer disabled:opacity-50"
            title="Exporta todas as vendas do filtro atual"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>{isExporting ? 'Exportando...' : 'Exportar Excel'}</span>
          </button>
          {onOpenNewSaleModal && (
            <button
              onClick={onOpenNewSaleModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0052cc] hover:bg-[#00478f] text-white rounded-lg text-xs font-bold cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Lançar Venda</span>
            </button>
          )}
        </div>
      </div>

      {/* Linha 2: filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <select value={onlyMine ? '' : sellerId} disabled={onlyMine} onChange={e => setSellerId(e.target.value)} className={selectCls(Boolean(sellerId) && !onlyMine)} name="sales_seller">
          <option value="">Todos os consultores</option>
          {consultants.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={product} onChange={e => { setProduct(e.target.value); setModality(''); }} className={selectCls(Boolean(product))} name="sales_product">
          <option value="">Todos os produtos</option>
          {MAIN_PRODUCTS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={modality} onChange={e => setModality(e.target.value)} className={selectCls(Boolean(modality))} name="sales_modality">
          <option value="">Todas as modalidades</option>
          {modalityOptions.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={fdi} onChange={e => setFdi(e.target.value)} className={selectCls(Boolean(fdi))} name="sales_fdi">
          <option value="">Todas as FDI</option>
          {ALL_FDI.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
        <select value={shift} onChange={e => setShift(e.target.value)} className={selectCls(Boolean(shift))} name="sales_shift">
          <option value="">Todos os turnos</option>
          {ALL_SHIFTS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <label className={`h-8 inline-flex items-center gap-1.5 px-2.5 rounded-lg border text-xs cursor-pointer ${onlyMine ? 'bg-blue-50 border-blue-300 text-blue-800 font-semibold' : 'bg-white border-gray-200 text-gray-700'}`}>
          <input type="checkbox" checked={onlyMine} onChange={e => setOnlyMine(e.target.checked)} className="w-3.5 h-3.5" name="sales_only_mine" />
          Só as minhas
        </label>
        <button
          onClick={() => setIncompleteOnly(v => !v)}
          className={`h-8 inline-flex items-center gap-1.5 px-2.5 rounded-lg border text-xs font-semibold cursor-pointer ${
            incompleteOnly ? 'bg-red-600 border-red-600 text-white' : summary.incomplete > 0 ? 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100' : 'bg-white border-gray-200 text-gray-500'
          }`}
          title="Vendas sem algum campo obrigatório"
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          Cadastros incompletos{summary.incomplete > 0 || incompleteOnly ? ` (${summary.incomplete})` : ''}
        </button>
        {hasFilters && (
          <button onClick={clearAll} className="h-8 inline-flex items-center gap-1 px-2 rounded-lg text-[11px] font-medium text-gray-500 hover:text-red-600 hover:bg-red-50 cursor-pointer">
            <RotateCcw className="w-3 h-3" /> Limpar filtros
          </button>
        )}
      </div>

      {incompleteOnly && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800">
          Vendas gravadas sem algum campo obrigatório. Abra a venda e clique em <strong>Editar</strong> para completar
          {isAdmin ? '.' : ' (só o dono da venda ou um admin consegue editar).'}
        </div>
      )}

      {/* Planilha */}
      <div className="w-full bg-white rounded-xl border border-gray-300 shadow-xs overflow-hidden">
        <div className="overflow-x-auto max-h-[700px] overflow-y-auto">
          <table className="w-full border-collapse text-left text-xs whitespace-nowrap">
            <thead className="sticky top-0 z-20 bg-[#F4F5F7] border-b-2 border-gray-300 select-none">
              <tr className="divide-x divide-gray-300">
                {COLUMNS.map(col => {
                  const active = sortField === col.key;
                  const Icon = !active ? ArrowUpDown : sortDirection === 'asc' ? ArrowUp : ArrowDown;
                  return (
                    <th key={col.key} className="px-3 py-2.5 font-semibold text-gray-800 bg-[#F4F5F7]">
                      <button onClick={() => handleSort(col.key)} className={`inline-flex items-center gap-1.5 cursor-pointer hover:text-blue-700 ${active ? 'text-blue-700' : ''}`}>
                        {col.label}
                        <Icon className={`w-3 h-3 ${active ? '' : 'text-gray-400'}`} />
                      </button>
                    </th>
                  );
                })}
                <th className="px-3 py-2.5 font-semibold text-gray-800 text-center bg-[#F4F5F7] w-24">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {isLoading && rows.length === 0 ? (
                <tr><td colSpan={COLUMNS.length + 1} className="py-12 text-center text-gray-500">Carregando vendas...</td></tr>
              ) : pageError ? (
                <tr><td colSpan={COLUMNS.length + 1} className="py-12 text-center text-red-500">{pageError}</td></tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNS.length + 1} className="py-14 text-center">
                    <p className="text-xs font-semibold text-gray-700">
                      {hasFilters ? 'Nenhuma venda encontrada com esses filtros.' : 'Nenhuma venda cadastrada ainda.'}
                    </p>
                    {hasFilters && (
                      <button onClick={clearAll} className="mt-2 text-xs text-blue-600 hover:underline font-semibold cursor-pointer">Limpar filtros</button>
                    )}
                  </td>
                </tr>
              ) : (
                rows.map((row, idx) => (
                  <tr
                    key={row.sale.id}
                    onClick={() => setSelectedSale(row.sale)}
                    className={`${idx % 2 === 0 ? 'bg-white' : 'bg-[#EDF5FD]'} hover:bg-blue-100/60 divide-x divide-gray-200 cursor-pointer ${isLoading ? 'opacity-60' : ''}`}
                  >
                    {COLUMNS.map(col => (
                      <td key={col.key} className={`px-3 py-1.5 text-gray-800 ${col.className || ''}`}>{col.render(row)}</td>
                    ))}
                    <td className="px-2 py-1 text-center" onClick={e => e.stopPropagation()}>
                      {canEditSale(row.sale) ? (
                        <button
                          type="button"
                          onClick={() => setEditingSale(row.sale)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border cursor-pointer ${
                            row.incomplete ? 'bg-red-600 border-red-600 text-white hover:bg-red-700' : 'bg-white border-blue-200 text-blue-700 hover:bg-blue-50'
                          }`}
                        >
                          <Edit3 className="w-3 h-3" />
                          {row.incomplete ? 'Completar' : 'Editar'}
                        </button>
                      ) : (
                        <span className="text-[11px] text-gray-300">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="bg-[#F8F9FA] px-4 py-2 border-t border-gray-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-gray-500">
          <div className="flex flex-wrap items-center gap-4">
            <span>{total === 0 ? 'Nenhuma venda' : `Mostrando ${rangeStart}–${rangeEnd} de ${total}`}</span>
            <span>Com Bolsa Convênio: <strong className="text-gray-800">{summary.withBolsa}</strong></span>
            <span>Com Parcela Leve: <strong className="text-gray-800">{summary.withParcela}</strong></span>
          </div>
          <div className="flex items-center gap-1">
            <button type="button" disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))} className="px-2.5 py-1 rounded border border-gray-200 bg-white disabled:opacity-40 hover:bg-gray-100 cursor-pointer">Anterior</button>
            <span className="px-2">Página <strong className="text-gray-800">{currentPage}</strong> / {totalPages}</span>
            <button type="button" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} className="px-2.5 py-1 rounded border border-gray-200 bg-white disabled:opacity-40 hover:bg-gray-100 cursor-pointer">Próxima</button>
          </div>
        </div>
      </div>

      {/* Detalhes da venda */}
      {selectedSale && (() => {
        const r = rowOf(selectedSale);
        const Field = ({ label, value }: { label: string; value: React.ReactNode }) => (
          <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-100">
            <span className="text-[10px] text-gray-400 font-medium block">{label}</span>
            <span className="font-semibold text-gray-800">{value ?? <MissingCell />}</span>
          </div>
        );
        return (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4" onClick={() => setSelectedSale(null)}>
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-200 space-y-4" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Detalhes da venda</h3>
                  <p className="text-[11px] text-gray-500 font-mono">Oportunidade {r.opportunity ?? '—'}</p>
                </div>
                <button onClick={() => setSelectedSale(null)} className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 cursor-pointer" title="Fechar">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {r.incomplete && (
                <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                  Cadastro incompleto: falta {selectedSale.missing_fields!.map(f => REQUIRED_FIELD_LABEL[f].toLowerCase()).join(', ')}.
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 text-xs">
                <Field label="Consultor" value={r.collaborator} />
                <Field label="Aluno" value={r.candidate} />
                <Field label="Data" value={r.date} />
                <Field label="Produto" value={r.product} />
                <Field label="Modalidade" value={r.modality} />
                <Field label="Turno" value={r.shift} />
                <Field label="FDI" value={r.fdi} />
                <Field label="Parcela Leve" value={r.parcelaLeve} />
                <Field label="Bolsa Convênio" value={r.hasBolsa === 'Sim' ? `Sim (${r.empresa || 'empresa não informada'})` : 'Não'} />
              </div>

              {r.notes && (
                <div className="p-2.5 rounded-lg bg-amber-50/60 border border-amber-200/60 text-xs">
                  <span className="text-[10px] text-amber-800 font-bold block">Observação</span>
                  <p className="text-amber-900 mt-0.5 whitespace-pre-wrap">{r.notes}</p>
                </div>
              )}

              <div className="pt-2 flex items-center justify-between gap-2 border-t border-gray-100">
                {canEditSale(selectedSale) ? (
                  <button
                    type="button"
                    onClick={() => { const s = selectedSale; setSelectedSale(null); setEditingSale(s); }}
                    className="px-3.5 py-2 bg-[#0052cc] hover:bg-[#00478f] text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" /> {r.incomplete ? 'Completar cadastro' : 'Editar venda'}
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                    <Shield className="w-3.5 h-3.5" /> Somente leitura
                  </div>
                )}
                <button onClick={() => setSelectedSale(null)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-lg cursor-pointer">
                  Fechar
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      <EditSaleModal
        isOpen={!!editingSale}
        sale={editingSale}
        onClose={() => setEditingSale(null)}
        onSuccess={() => { setSelectedSale(null); loadRef.current(); }}
      />
    </div>
  );
};
