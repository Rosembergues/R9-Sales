import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Sale } from '../types';
import { supabase, getSupabaseClient } from '../lib/supabase';
import { LocalSyncEngine } from '../lib/localCache';
import { normalizeRemoteSale, buildSalePayload, logSupabaseError } from '../lib/salesMapper';
import {
  describeSale,
  findDuplicateByOpportunity,
  isNetworkError,
  isUniqueViolation,
  normalizeOpportunity,
} from '../lib/saleValidation';
import { useAuth } from './AuthContext';
import { SALES_SORT_COLUMN, SalesQueryFilters, SalesSortField, applySalesFilters } from '../lib/salesQuery';
import confetti from 'canvas-confetti';
import { errorText } from '../lib/errors';
import type { SaleCustomData, RemoteSaleRow } from '../types';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import type { ProductChannelFDI } from '../types';

interface SalesContextType {
  /** Todas as vendas (carregadas na abertura e mantidas em tempo real). */
  sales: Sale[];
  addSale: (saleData: {
    client_name: string;
    client_document?: string;
    client_phone?: string;
    client_email?: string;
    product_name: string;
    custom_data?: SaleCustomData;
    fdi?: string;
    sale_date?: string;
    notes?: string;
    seller_id?: string;
    seller_name?: string;
    seller_email?: string;
    collaborator_name?: string;
  }) => Promise<{ success: boolean; sale?: Sale; error?: string; duplicate?: Sale }>;
  /** Procura no servidor uma venda com a mesma oportunidade (ignora `excludeId`). */
  findSaleByOpportunity: (opportunity: string, excludeId?: string) => Promise<Sale | null>;
  updateSale: (saleId: string, updatedData: Partial<Sale>, baseSale?: Sale) => Promise<{ success: boolean; error?: string; sale?: Sale }>;
  deleteSale: (saleId: string) => Promise<{ success: boolean; error?: string }>;
  /** Uma página da planilha de Vendas; os filtros valem para todas as vendas. */
  fetchSalesPage: (params: SalesQueryFilters & {
    page: number;
    pageSize?: number;
    sortField?: SalesSortField;
    sortDirection?: 'asc' | 'desc';
  }) => Promise<{ data: Sale[]; count: number; error?: string }>;
  /** Totais do filtro inteiro (rodapé da planilha). */
  fetchSalesSummary: (filters: SalesQueryFilters) => Promise<{ withBolsa: number; withParcela: number; incomplete: number }>;
  /** Todas as vendas do filtro (exportação). */
  fetchAllFilteredSales: (filters: SalesQueryFilters, sortField?: SalesSortField, sortDirection?: 'asc' | 'desc') => Promise<{ data: Sale[]; error?: string }>;
}

const SalesContext = createContext<SalesContextType | undefined>(undefined);

// Identificadores com apenas os últimos dígitos do relógio repetiam após 16m40s.
// Use UUID quando disponível, com fallback suficientemente único para navegadores antigos.
function createEntityId(prefix: string): string {
  const randomId = typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  return `${prefix}-${randomId}`;
}

const SALES_PAGE = 1000;

/** Mensagem de erro de gravação; coluna inexistente vira instrução para o admin. */
function describeSaveError(error: { code?: string; message?: string } | null | undefined): string {
  const message = errorText(error, 'erro no servidor');
  const column =
    message.match(/Could not find the '([^']+)' column/i)?.[1] ||
    message.match(/column ["']?([a-zA-Z_][a-zA-Z0-9_]*)["']? of relation/i)?.[1];
  if (column || error?.code === 'PGRST204' || error?.code === '42703') {
    return `o banco não tem a coluna "${column || '?'}". Um administrador precisa rodar supabase/vendas-ajustes.sql no Supabase.`;
  }
  return message;
}

/** Busca todas as vendas em páginas: uma consulta única do Supabase para em 1000 linhas. */
async function fetchAllSalesRows(client: NonNullable<ReturnType<typeof getSupabaseClient>>) {
  const rows: RemoteSaleRow[] = [];
  for (let from = 0; ; from += SALES_PAGE) {
    const { data, error } = await client
      .from('sales')
      .select('*')
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
      .range(from, from + SALES_PAGE - 1);
    if (error) return { data: null, error };
    rows.push(...(data || []));
    if (!data || data.length < SALES_PAGE) break;
  }
  return { data: rows, error: null };
}

export const SalesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, profiles } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);

  // Carga inicial: envia as vendas que ficaram na fila offline e lê todas do servidor.
  const loadData = useCallback(async () => {
    const client = getSupabaseClient();
    try {
      const { data: remoteSales, error: salesError } = await fetchAllSalesRows(client);

      if (salesError) {
        logSupabaseError('loadData - Consulta tabela sales', salesError);
        return;
      }

      try {
        const normalized = (remoteSales || [])
          .map(row => {
            const sale = normalizeRemoteSale(row);
            if (!sale.seller_name || sale.seller_name.trim() === '' || sale.seller_name === 'Consultor') {
              const matchedProfile = profiles.find(p => p.id === sale.seller_id || p.id === (row as { created_by?: string }).created_by);
              if (matchedProfile) sale.seller_name = matchedProfile.name;
              else if (row.collaborator_name && row.collaborator_name !== 'Consultor') sale.seller_name = row.collaborator_name;
            }
            return sale;
          });

        // Tenta primeiro sincronizar vendas que ficaram offline.
        const pendingSales = LocalSyncEngine.getPendingSales();
        const stillPending: Sale[] = [];
        for (const pendingSale of pendingSales) {
          const { error: pendingError } = await client.from('sales').insert(buildSalePayload(pendingSale));
          if (pendingError) {
            // Se o erro for chave primária duplicada (23505), a venda já existe no banco.
            // Não a mantemos na fila para evitar que seja ressuscitada caso seja excluída depois.
            if (isUniqueViolation(pendingError)) {
              continue;
            }
            if (!isNetworkError(pendingError)) {
              // Erro definitivo (permissão, validação): não adianta repetir a cada carga.
              logSupabaseError('Venda pendente descartada', pendingError, pendingSale);
              continue;
            }
            stillPending.push(pendingSale);
          }
        }
        LocalSyncEngine.savePendingSales(stillPending);

        // Reconsulta somente quando havia itens pendentes sincronizados com sucesso
        let authoritative = normalized;
        if (pendingSales.length > 0 && stillPending.length < pendingSales.length) {
          const { data: refreshed } = await fetchAllSalesRows(client);
          if (refreshed) {
            authoritative = refreshed.map(row => normalizeRemoteSale(row));
          }
        }

        setSales(authoritative);
      } catch (normErr) {
        console.error('Erro ao normalizar/sincronizar vendas do Supabase:', normErr);
      }
    } catch {
      // Sem resposta do servidor: a tela mostra a lista vazia até a próxima carga.
    }
  }, [profiles]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Inscrição dedicada em Tempo Real (Realtime) na tabela 'sales' do Supabase
  useEffect(() => {
    const channel = supabase
      .channel('public:sales')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sales' },
        (payload: RealtimePostgresChangesPayload<RemoteSaleRow>) => {
          if (payload.eventType === 'INSERT') {
            try {
              // Certifique-se de normalizar/formatar o payload.new de acordo com a tipagem do frontend
              const newSale = normalizeRemoteSale(payload.new);
              setSales((prev) => {
                if (prev.some((sale) => sale.id === newSale.id)) {
                  return prev.map((sale) => (sale.id === newSale.id ? newSale : sale));
                }
                return [newSale, ...prev];
              });
            } catch (err) {
              console.error('💥 Erro ao processar INSERT do Realtime:', err);
            }
          } else if (payload.eventType === 'UPDATE') {
            try {
              const updatedSale = normalizeRemoteSale(payload.new);
              setSales((prev) =>
                prev.map((sale) => (sale.id === updatedSale.id ? updatedSale : sale))
              );
            } catch (err) {
              console.error('💥 Erro ao processar UPDATE do Realtime:', err);
            }
          } else if (payload.eventType === 'DELETE') {
            try {
              const deletedId = String(payload.old?.id || '');
              if (deletedId) {
                LocalSyncEngine.clearPendingSale(deletedId);
                setSales((prev) => prev.filter((sale) => sale.id !== deletedId));
              }
            } catch (err) {
              console.error('💥 Erro ao processar DELETE do Realtime:', err);
            }
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchSalesPage = useCallback(async ({
    page,
    pageSize = 50,
    sortField = 'date',
    sortDirection = 'desc',
    ...filters
  }: SalesQueryFilters & {
    page: number;
    pageSize?: number;
    sortField?: SalesSortField;
    sortDirection?: 'asc' | 'desc';
  }) => {
    const client = getSupabaseClient();
    if (!client) return { data: [], count: 0, error: 'Supabase não configurado.' };

    const from = Math.max(0, (page - 1) * pageSize);
    const sortColumn = SALES_SORT_COLUMN[sortField] || 'sale_date';
    const ascending = sortDirection === 'asc';

    let query = applySalesFilters(client.from('sales').select('*', { count: 'exact' }), filters);
    query = query.order(sortColumn, { ascending, nullsFirst: false });
    if (sortColumn !== 'sale_date') query = query.order('sale_date', { ascending: false });
    query = query.order('id', { ascending: true }).range(from, from + pageSize - 1);

    const { data, count, error } = await query;
    if (error) {
      logSupabaseError('fetchSalesPage', error);
      return { data: [], count: 0, error: error.message };
    }
    return { data: (data || []).map(row => normalizeRemoteSale(row)), count: count || 0 };
  }, []);

  const fetchSalesSummary = useCallback(async (filters: SalesQueryFilters) => {
    const client = getSupabaseClient();
    if (!client) return { withBolsa: 0, withParcela: 0, incomplete: 0 };
    const head = () => applySalesFilters(client.from('sales').select('id', { count: 'exact', head: true }), filters);
    const [bolsa, parcela, incomplete] = await Promise.all([
      head().eq('partner_scholarship', true),
      head().eq('light_installment', true),
      filters.incompleteOnly ? head() : applySalesFilters(client.from('sales').select('id', { count: 'exact', head: true }), { ...filters, incompleteOnly: true }),
    ]);
    return { withBolsa: bolsa.count || 0, withParcela: parcela.count || 0, incomplete: incomplete.count || 0 };
  }, []);

  const fetchAllFilteredSales = useCallback(async (
    filters: SalesQueryFilters,
    sortField: SalesSortField = 'date',
    sortDirection: 'asc' | 'desc' = 'desc',
  ) => {
    const client = getSupabaseClient();
    if (!client) return { data: [], error: 'Supabase não configurado.' };
    const sortColumn = SALES_SORT_COLUMN[sortField] || 'sale_date';
    const rows: RemoteSaleRow[] = [];
    for (let from = 0; ; from += SALES_PAGE) {
      const { data, error } = await applySalesFilters(client.from('sales').select('*'), filters)
        .order(sortColumn, { ascending: sortDirection === 'asc', nullsFirst: false })
        .order('id', { ascending: true })
        .range(from, from + SALES_PAGE - 1);
      if (error) return { data: [], error: error.message };
      rows.push(...(data || []));
      if (!data || data.length < SALES_PAGE) break;
    }
    return { data: rows.map(row => normalizeRemoteSale(row)) };
  }, []);

  const triggerConfetti = () => {
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#3b82f6'],
      });
    } catch {
      // Ignora erro visual de confetti
    }
  };

  // Lançamento de venda
  const addSale = async (saleData: {
    client_name: string;
    client_document?: string;
    client_phone?: string;
    client_email?: string;
    product_name: string;
    custom_data?: SaleCustomData;
    fdi?: string;
    sale_date?: string;
    notes?: string;
    seller_id?: string;
    seller_name?: string;
    seller_email?: string;
    collaborator_name?: string;
  }) => {
    if (!currentUser) {
      return { success: false, error: 'Usuário não autenticado.' };
    }

    // Bloqueia oportunidade repetida: primeiro nas vendas carregadas, depois no servidor.
    const opportunity = normalizeOpportunity(saleData.custom_data?.opportunity_number);
    if (opportunity) {
      const duplicate = findDuplicateByOpportunity(sales, opportunity) || await findSaleByOpportunity(opportunity);
      if (duplicate) {
        return {
          success: false,
          duplicate,
          error: `A oportunidade ${opportunity} já foi registrada (${describeSale(duplicate)}).`,
        };
      }
    }

    // 2. Recupera os dados exatos do consultor selecionado no campo de responsável na lista de perfis/equipe
    const selectedProfile = 
      (saleData.seller_id ? profiles.find(p => p.id === saleData.seller_id) : undefined) ||
      (saleData.seller_name ? profiles.find(p => p.name.toLowerCase() === saleData.seller_name!.toLowerCase()) : undefined) ||
      (saleData.collaborator_name ? profiles.find(p => p.name.toLowerCase() === saleData.collaborator_name!.toLowerCase()) : undefined);

    const isSelfSelected = Boolean(
      currentUser && (
        saleData.seller_id === currentUser.id ||
        (saleData.seller_name && saleData.seller_name.toLowerCase() === currentUser.name.toLowerCase()) ||
        (!saleData.seller_id && !saleData.seller_name && !saleData.collaborator_name)
      )
    );

    // 3. Garante que as três propriedades recebam estritamente os dados do consultor selecionado
    // (e nunca de quem está logado, a menos que ele selecione a si mesmo)
    const selectedSellerName = 
      selectedProfile?.name ||
      saleData.seller_name || 
      saleData.collaborator_name || 
      (isSelfSelected ? currentUser.name : 'Consultor');

    const selectedSellerId = 
      selectedProfile?.id || 
      saleData.seller_id || 
      (isSelfSelected ? currentUser.id : `seller-${selectedSellerName.toLowerCase().replace(/\s+/g, '-')}`);

    const selectedSellerEmail = 
      selectedProfile?.email || 
      saleData.seller_email || 
      (isSelfSelected ? currentUser.email : '');

    const resolvedFdi = saleData.fdi || saleData.custom_data?.fdi || saleData.custom_data?.fdi_channel || 'Simplificada';
    const rawSaleDate = saleData.custom_data?.sale_date || saleData.sale_date || new Date().toISOString();

    const newSaleId = createEntityId('sale');
    const newSale: Sale = {
      id: newSaleId,
      campaign_id: '',
      campaign_name: '',
      seller_id: selectedSellerId,
      collaborator_id: selectedSellerId,
      seller_name: selectedSellerName,
      collaborator_name: selectedSellerName,
      seller_email: selectedSellerEmail,
      client_name: saleData.client_name,
      client_document: saleData.client_document,
      client_phone: saleData.client_phone,
      client_email: saleData.client_email,
      product_name: saleData.product_name,
      fdi: resolvedFdi,
      sale_date: rawSaleDate,
      custom_data: {
        ...saleData.custom_data,
        sale_date: rawSaleDate,
        ...(opportunity ? { opportunity_number: opportunity } : {}),
        registered_by: currentUser.id, // quem lançou (pode ser diferente do dono da venda)
        fdi: resolvedFdi,
        fdi_channel: resolvedFdi as ProductChannelFDI,
        collaborator_name: selectedSellerName,
        collaborator_id: selectedSellerId,
        seller_name: selectedSellerName,
        seller_id: selectedSellerId,
        seller_email: selectedSellerEmail,
      },
      notes: saleData.notes,
      created_at: new Date().toISOString(),
    };

    const client = getSupabaseClient();
    let supabaseErrorDetails: string | undefined;
    /** true quando a venda ficou na fila offline (sem resposta do servidor). */
    let queuedOffline = false;

    const keepLocally = () => {
      LocalSyncEngine.savePendingSales([...LocalSyncEngine.getPendingSales(), newSale]);
      setSales(prev => [newSale, ...prev]);
    };

    if (client) {
      try {
        // Formato único de gravação. Se o banco não tiver alguma coluna, a venda NÃO é
        // gravada pela metade: o erro aparece para o admin rodar o SQL de atualização.
        const payload = buildSalePayload(newSale);
        const { error: insertErr } = await client.from('sales').insert(payload).select('id');
        const inserted = !insertErr;
        const lastError = insertErr;
        if (insertErr) logSupabaseError('addSale', insertErr, payload);

        if (inserted) {
          LocalSyncEngine.clearPendingSale(newSale.id);
          setSales(prev => [newSale, ...prev.filter(s => s.id !== newSale.id)]);
        } else if (isUniqueViolation(lastError)) {
          const existing = opportunity ? await findSaleByOpportunity(opportunity) : null;
          return {
            success: false,
            duplicate: existing || undefined,
            error: `A oportunidade ${opportunity} já foi registrada${existing ? ` (${describeSale(existing)})` : ''}.`,
          };
        } else if (isNetworkError(lastError)) {
          supabaseErrorDetails = lastError?.message;
          queuedOffline = true;
          keepLocally();
        } else {
          // Erro definitivo do servidor (permissão, validação, coluna faltando): NÃO guarda a venda
          // localmente, para o consultor corrigir e tentar de novo sem criar uma cópia escondida na fila.
          return { success: false, error: `A venda não foi registrada: ${describeSaveError(lastError)}` };
        }
      } catch (err) {
        console.error('💥 [Supabase Sales] Exceção inesperada no insert:', err);
        supabaseErrorDetails = errorText(err, 'Erro de conexão com Supabase');
        queuedOffline = true;
        keepLocally();
      }
    } else {
      queuedOffline = true;
      keepLocally();
    }

    triggerConfetti();

    return {
      success: !queuedOffline,
      sale: newSale,
      error: queuedOffline
        ? `Sem conexão com o servidor. A venda ficou guardada neste aparelho e será enviada automaticamente${supabaseErrorDetails ? ` (${supabaseErrorDetails})` : ''}.`
        : undefined,
    };
  };

  async function findSaleByOpportunity(opportunity: string, excludeId?: string): Promise<Sale | null> {
    const client = getSupabaseClient();
    const key = normalizeOpportunity(opportunity);
    if (!client || !key) return null;
    const variants = Array.from(new Set([key, opportunity.trim()].filter(Boolean)));
    try {
      const [byColumn, byJson] = await Promise.all([
        client.from('sales').select('*').in('opportunity', variants).limit(5),
        client.from('sales').select('*').in('custom_data->>opportunity_number', variants).limit(5),
      ]);
      const rows = [...(byColumn.data || []), ...(byJson.data || [])];
      const match = rows.find(r => String(r.id) !== excludeId);
      return match ? normalizeRemoteSale(match) : null;
    } catch {
      return null; // Sem servidor: vale só a checagem nas vendas carregadas.
    }
  }

  /**
   * Aplica a edição sobre a venda. Se o consultor mudou, nome, id e e-mail vêm
   * juntos do cadastro (nunca só um deles).
   */
  const mergeSaleUpdate = (base: Sale, changes: Partial<Sale>): Sale => {
    const changedId = changes.seller_id || changes.collaborator_id;
    const profile =
      (changedId ? profiles.find(p => p.id === changedId) : undefined) ||
      (changes.seller_name ? profiles.find(p => p.name.toLowerCase() === changes.seller_name!.toLowerCase()) : undefined) ||
      (changes.collaborator_name ? profiles.find(p => p.name.toLowerCase() === changes.collaborator_name!.toLowerCase()) : undefined);
    const sellerName = profile?.name || changes.seller_name || changes.collaborator_name || base.seller_name;
    const sellerId = profile?.id || changedId || base.seller_id;
    const sellerEmail = profile ? profile.email || '' : changes.seller_email !== undefined ? changes.seller_email : base.seller_email;
    const fdi = changes.fdi || changes.custom_data?.fdi || changes.custom_data?.fdi_channel || base.fdi || '';
    return {
      ...base,
      ...changes,
      seller_name: sellerName,
      collaborator_name: sellerName,
      seller_id: sellerId,
      collaborator_id: sellerId,
      seller_email: sellerEmail,
      fdi,
      custom_data: {
        ...(base.custom_data || {}),
        ...(changes.custom_data || {}),
        fdi,
        fdi_channel: fdi as never,
        seller_name: sellerName,
        collaborator_name: sellerName,
        seller_id: sellerId,
        collaborator_id: sellerId,
        seller_email: sellerEmail,
      },
    };
  };

  // Edição de venda (dono da venda ou admin)
  const updateSale = async (saleId: string, updatedData: Partial<Sale>, baseSale?: Sale) => {
    let updatedItem: Sale | undefined;

    // Não deixa a edição trocar a oportunidade para uma que já pertence a outra venda.
    const newOpportunity = normalizeOpportunity(updatedData.custom_data?.opportunity_number);
    if (newOpportunity) {
      const duplicate = findDuplicateByOpportunity(sales, newOpportunity, saleId)
        || await findSaleByOpportunity(newOpportunity, saleId);
      if (duplicate) {
        return { success: false, error: `A oportunidade ${newOpportunity} já pertence a outra venda (${describeSale(duplicate)}).` };
      }
      updatedData = { ...updatedData, custom_data: { ...updatedData.custom_data, opportunity_number: newOpportunity } };
    }

    // A venda em edição pode não estar em `sales` (a planilha é paginada no servidor):
    // nesse caso a base é a própria venda que o modal recebeu.
    const base = sales.find(s => s.id === saleId) || (baseSale && baseSale.id === saleId ? baseSale : undefined);
    if (base) updatedItem = mergeSaleUpdate(base, updatedData);

    const wasInLoadedSales = sales.some(s => s.id === saleId);

    // Regra de permissão: vendedor pode editar somente a própria venda e nunca pode
    // transferi-la para outro vendedor. Apenas administradores podem alterar o responsável.
    if (currentUser?.role !== 'admin') {
      const originalSale = baseSale || sales.find(s => s.id === saleId);
      if (!originalSale || originalSale.seller_id !== currentUser?.id) {
        return { success: false, error: 'Você só pode editar suas próprias vendas.' };
      }
      if (!updatedItem) return { success: false, error: 'Venda não encontrada para atualização.' };

      // Mesmo que alguém tente alterar seller_id/seller_name pelo cliente, o contexto
      // restaura os dados originais antes de montar o payload.
      updatedItem = {
        ...updatedItem,
        seller_id: originalSale.seller_id,
        collaborator_id: originalSale.collaborator_id || originalSale.seller_id,
        seller_name: originalSale.seller_name,
        collaborator_name: originalSale.collaborator_name || originalSale.seller_name,
        seller_email: originalSale.seller_email,
        custom_data: {
          ...(updatedItem.custom_data || {}),
          seller_id: originalSale.seller_id,
          collaborator_id: originalSale.collaborator_id || originalSale.seller_id,
          seller_name: originalSale.seller_name,
          collaborator_name: originalSale.collaborator_name || originalSale.seller_name,
          seller_email: originalSale.seller_email,
        },
      };
    }

    const client = getSupabaseClient();
    if (!client) {
      return { success: false, error: 'Supabase não está configurado.' };
    }

    if (!updatedItem) {
      return { success: false, error: 'Venda não encontrada para atualização.' };
    }

    try {
      const payload = buildSalePayload(updatedItem);
      let updateQuery = client.from('sales').update(payload).eq('id', saleId);
      if (currentUser?.role !== 'admin') {
        updateQuery = updateQuery.eq('seller_id', currentUser!.id);
      }
      const { error: updateErr } = await updateQuery;
      if (updateErr) {
        logSupabaseError('updateSale', updateErr, payload);
        if (isUniqueViolation(updateErr)) {
          return { success: false, error: 'Essa oportunidade já pertence a outra venda.' };
        }
        return { success: false, error: describeSaveError(updateErr) };
      }

      if (wasInLoadedSales) setSales(prev => prev.map(s => (s.id === saleId ? updatedItem! : s)));
    } catch (err) {
      console.error('💥 [Supabase Sales] Exceção no update:', err);
      return { success: false, error: errorText(err, 'Erro ao atualizar a venda.') };
    }

    return { success: true, sale: updatedItem };
  };

  // Delete Sale (Admin ou Autor)
  const deleteSale = async (saleId: string) => {
    const client = getSupabaseClient();
    if (!client) {
      return { success: false, error: 'Supabase não está configurado.' };
    }

    try {
      // 1. Tira da fila offline (se a venda ainda não tinha subido, ela some aqui).
      LocalSyncEngine.clearPendingSale(saleId);

      // 2. Executa a exclusão no Supabase com .select('id') para inspecionar os registros afetados
      const { data: deletedRows, error: delErr } = await client
        .from('sales')
        .delete()
        .eq('id', saleId)
        .select('id');

      if (delErr) {
        logSupabaseError('deleteSale', delErr, { saleId });
        return { success: false, error: delErr.message || 'Erro ao excluir a venda no banco de dados.' };
      }

      // 3. Validação de segurança RLS: PostgREST retorna status 200/204 sem erro quando RLS bloqueia o delete
      if (!deletedRows || deletedRows.length === 0) {
        // Verifica se a venda ainda existe no banco
        const { data: existingRow, error: checkErr } = await client
          .from('sales')
          .select('id, seller_id, custom_data')
          .eq('id', saleId)
          .maybeSingle();

        if (checkErr || existingRow) {
          if (existingRow) console.error('❌ [Supabase Sales] Falha de RLS: O registro existe no banco mas o DELETE afetou 0 linhas.', existingRow);
          return {
            success: false,
            error: existingRow
              ? 'Permissão insuficiente no Supabase (RLS): o banco recusou a exclusão desta venda.'
              : 'O Supabase não confirmou a exclusão da venda. Verifique a conexão e tente novamente.'
          };
        }
      }

      // 4. Exclusão confirmada no servidor ou o item já não existia no banco
      setSales(prev => prev.filter(s => s.id !== saleId));
      return { success: true };
    } catch (err) {
      console.error('💥 [Supabase Sales] Exceção no delete:', err);
      return { success: false, error: errorText(err, 'Erro inesperado ao excluir a venda.') };
    }
  };

  return (
    <SalesContext.Provider
      value={{
        sales,
        addSale,
        findSaleByOpportunity,
        updateSale,
        deleteSale,
        fetchSalesPage,
        fetchSalesSummary,
        fetchAllFilteredSales,
      }}
    >
      {children}
    </SalesContext.Provider>
  );
};

export const useSales = () => {
  const context = useContext(SalesContext);
  if (!context) {
    throw new Error('useSales must be used within a SalesProvider');
  }
  return context;
};
