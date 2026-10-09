import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { Campaign, Sale, LeaderboardEntry } from '../types';
import { supabase, getSupabaseClient, LocalSyncEngine } from '../lib/supabase';
import { normalizeRemoteSale, buildR9SalePayload, buildStandardSalePayload, logSupabaseError } from '../lib/salesMapper';
import { useAuth } from './AuthContext';
import confetti from 'canvas-confetti';

interface SalesContextType {
  campaigns: Campaign[];
  sales: Sale[];
  leaderboard: LeaderboardEntry[];
  activeCampaigns: Campaign[];
  addSale: (saleData: {
    campaign_id: string;
    client_name: string;
    client_document?: string;
    client_phone?: string;
    client_email?: string;
    product_name: string;
    custom_data?: Record<string, any>;
    notes?: string;
    seller_id?: string;
    seller_name?: string;
    seller_email?: string;
    collaborator_name?: string;
  }) => Promise<{ success: boolean; sale?: Sale; error?: string }>;
  updateSale: (saleId: string, updatedData: Partial<Sale>, baseSale?: Sale) => Promise<{ success: boolean; error?: string; sale?: Sale }>;
  deleteSale: (saleId: string) => Promise<{ success: boolean; error?: string }>;
  createCampaign: (campaignData: Omit<Campaign, 'id' | 'created_at'>) => Promise<{ success: boolean; campaign?: Campaign; error?: string }>;
  toggleCampaignStatus: (campaignId: string) => Promise<{ success: boolean; error?: string }>;
  deleteCampaign: (campaignId: string) => Promise<{ success: boolean; error?: string }>;
  triggerConfetti: () => void;
  fetchSalesPage: (params: {
    page: number;
    pageSize?: number;
    searchTerm?: string;
    productFilter?: string;
    sortField?: string;
    sortDirection?: 'asc' | 'desc';
    onlyToday?: boolean;
  }) => Promise<{ data: Sale[]; count: number; error?: string }>;
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

export const SalesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, profiles } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);

  // Load initial sales & campaigns
  const loadData = useCallback(async () => {
    const client = getSupabaseClient();
    const localCampaigns = LocalSyncEngine.getCampaigns();
    const localSales = LocalSyncEngine.getSales();
    const deletedIds = LocalSyncEngine.getDeletedSaleIds();

    // O cache local é apenas fallback inicial/offline. Quando o servidor responde,
    // seus dados passam a ser a fonte oficial e substituem o snapshot local.
    setCampaigns(localCampaigns);
    setSales(localSales.filter(s => !deletedIds.has(String(s.id))));

    if (client) {
      try {
        const { data: remoteCampaigns, error: campaignsError } = await client
          .from('campaigns')
          .select('*')
          .order('created_at', { ascending: false });

        if (!campaignsError && remoteCampaigns) {
          setCampaigns(remoteCampaigns as Campaign[]);
          LocalSyncEngine.saveCampaigns(remoteCampaigns as Campaign[]);
        }

        const { data: remoteSales, error: salesError } = await client
          .from('sales')
          .select('*')
          .order('created_at', { ascending: false });

        if (salesError) {
          logSupabaseError('loadData - Consulta tabela sales', salesError);
          // Mantém o cache somente quando a consulta ao servidor falha.
          return;
        }

        try {
          const currentDeleted = LocalSyncEngine.getDeletedSaleIds();
          const normalized = (remoteSales || [])
            .map(row => {
              const sale = normalizeRemoteSale(row);
              if (!sale.seller_name || sale.seller_name.trim() === '' || sale.seller_name === 'Consultor') {
                const matchedProfile = profiles.find(p => p.id === sale.seller_id || p.id === (row as { created_by?: string }).created_by);
                if (matchedProfile) sale.seller_name = matchedProfile.name;
                else if (row.collaborator_name && row.collaborator_name !== 'Consultor') sale.seller_name = row.collaborator_name;
              }
              return sale;
            })
            .filter(sale => !currentDeleted.has(String(sale.id)));

          // Tenta primeiro sincronizar vendas que ficaram offline.
          const pendingSales = LocalSyncEngine.getPendingSales();
          const stillPending: Sale[] = [];
          for (const pendingSale of pendingSales) {
            // Se a venda foi excluída, NUNCA ressuscita no Supabase
            if (currentDeleted.has(String(pendingSale.id))) {
              continue;
            }

            const { error: pendingError } = await client.from('sales').insert(buildR9SalePayload(pendingSale));
            if (pendingError) {
              // Se o erro for chave primária duplicada (23505), a venda já existe no banco.
              // Não a mantemos na fila para evitar que seja ressuscitada caso seja excluída depois.
              if (pendingError.code === '23505' || pendingError.message?.includes('duplicate key')) {
                continue;
              }
              stillPending.push(pendingSale);
            }
          }
          LocalSyncEngine.savePendingSales(stillPending);

          // Reconsulta somente quando havia itens pendentes sincronizados com sucesso
          let authoritative = normalized;
          if (pendingSales.length > 0 && stillPending.length < pendingSales.length) {
            const { data: refreshed } = await client.from('sales').select('*').order('created_at', { ascending: false });
            if (refreshed) {
              authoritative = refreshed
                .map(row => normalizeRemoteSale(row))
                .filter(sale => !currentDeleted.has(String(sale.id)));
            }
          }

          setSales(authoritative);
          LocalSyncEngine.saveSales(authoritative);
        } catch (normErr) {
          console.error('Erro ao normalizar/sincronizar vendas do Supabase:', normErr);
        }
      } catch (err) {
        // Sem resposta do servidor: mantém o snapshot local como fallback offline.
      }
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
        (payload: any) => {
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
                LocalSyncEngine.addDeletedSaleId(deletedId);
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

  // Sincroniza o cache local sempre que a lista de vendas for atualizada
  useEffect(() => {
    if (sales.length > 0) {
      LocalSyncEngine.saveSales(sales);
    }
  }, [sales]);

  const fetchSalesPage = useCallback(async ({
    page,
    pageSize = 50,
    searchTerm = '',
    productFilter = 'Todos',
    sortField = 'date',
    sortDirection = 'desc',
    onlyToday = false,
  }: {
    page: number;
    pageSize?: number;
    searchTerm?: string;
    productFilter?: string;
    sortField?: string;
    sortDirection?: 'asc' | 'desc';
    onlyToday?: boolean;
  }) => {
    const client = getSupabaseClient();
    if (!client) return { data: [], count: 0, error: 'Supabase não configurado.' };

    const from = Math.max(0, (page - 1) * pageSize);
    const to = from + pageSize - 1;
    const sortMap: Record<string, string> = {
      date: 'sale_date',
      collaborator: 'seller_name',
      candidate: 'client_name',
      opportunity: 'opportunity',
      fdi: 'fdi',
      modality: 'modality',
      shift: 'turn',
      empresa: 'client_name',
    };

    let query = client
      .from('sales')
      .select('*', { count: 'exact' });

    const q = searchTerm.trim();
    if (q) {
      const escaped = q.replace(/[%,_()\\]/g, ' ');
      query = query.or([
        `seller_name.ilike.%${escaped}%`,
        `client_name.ilike.%${escaped}%`,
        `opportunity.ilike.%${escaped}%`,
        `fdi.ilike.%${escaped}%`,
        `product_name.ilike.%${escaped}%`,
        `notes.ilike.%${escaped}%`,
      ].join(','));
    }

    if (productFilter && productFilter !== 'Todos') {
      const escapedProduct = productFilter.replace(/[%,_()\\]/g, ' ');
      query = query.or(`product_name.ilike.%${escapedProduct}%,product.ilike.%${escapedProduct}%`);
    }

    if (onlyToday) {
      // sale_date é persistida como TIMESTAMPTZ no banco. O formulário pode
      // receber a data no fuso local, então os limites também são locais.
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).toISOString();
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0).toISOString();
      query = query.gte('sale_date', start).lt('sale_date', end);
    }

    const sortColumn = sortMap[sortField] || 'sale_date';
    query = query.order(sortColumn, { ascending: sortDirection === 'asc' });
    if (sortColumn !== 'created_at') query = query.order('created_at', { ascending: sortDirection === 'asc' });
    query = query.range(from, to);

    const { data, count, error } = await query;
    if (error) {
      logSupabaseError('fetchSalesPage', error);
      return { data: [], count: 0, error: error.message };
    }

    const deletedIds = LocalSyncEngine.getDeletedSaleIds();
    const normalized = (data || [])
      .map(row => normalizeRemoteSale(row))
      .filter(s => !deletedIds.has(String(s.id)));
    return { data: normalized, count: Math.max(0, (count || 0) - ((data?.length || 0) - normalized.length)) };
  }, []);

  const activeCampaigns = useMemo(() => {
    return campaigns.filter(c => c.active);
  }, [campaigns]);

  // Live Leaderboard calculation based on quantity of boletos / sales
  const leaderboard = useMemo<LeaderboardEntry[]>(() => {
    const sellerProfiles = profiles.filter(p => p.role === 'seller');
    const result: LeaderboardEntry[] = sellerProfiles.map(seller => {
      const sName = (seller.name || '').trim().toLowerCase();
      const sellerSales = sales.filter(s => {
        const matchId = s.seller_id === seller.id;
        const matchName = (s.seller_name || '').trim().toLowerCase() === sName;
        const matchCustomName = (s.custom_data?.seller_name || '').trim().toLowerCase() === sName;
        return matchId || matchName || matchCustomName;
      });

      const totalCount = sellerSales.length;
      const graduacaoCount = sellerSales.filter(s => {
        const p = s.custom_data?.main_product || s.product_name || '';
        return p.includes('Graduação') || (!p.includes('Pós') && !p.includes('Técnico'));
      }).length;
      const posCount = sellerSales.filter(s => {
        const p = s.custom_data?.main_product || s.product_name || '';
        return p.includes('Pós');
      }).length;
      const tecnicoCount = sellerSales.filter(s => {
        const p = s.custom_data?.main_product || s.product_name || '';
        return p.includes('Técnico');
      }).length;

      // Target in boletos (e.g. 5 boletos)
      const target = 5;
      const percentage = Math.round((totalCount / target) * 100);

      let rank_tier: 'Bronze' | 'Prata' | 'Ouro' | 'Diamante' = 'Bronze';
      if (totalCount >= 4) rank_tier = 'Diamante';
      else if (totalCount >= 3) rank_tier = 'Ouro';
      else if (totalCount >= 1) rank_tier = 'Prata';

      return {
        seller_id: seller.id,
        name: seller.name,
        email: seller.email,
        avatar_url: seller.avatar_url,
        total_sales: totalCount,
        target,
        percentage_reached: percentage,
        position: 1,
        rank_tier,
        graduacao_count: graduacaoCount,
        pos_count: posCount,
        tecnico_count: tecnicoCount,
      };
    });

    // Sort by total_sales desc
    result.sort((a, b) => b.total_sales - a.total_sales);

    // Assign positions
    return result.map((item, index) => ({
      ...item,
      position: index + 1,
    }));
  }, [profiles, sales]);

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

  // Add Sale
  const addSale = async (saleData: {
    campaign_id: string;
    client_name: string;
    client_document?: string;
    client_phone?: string;
    client_email?: string;
    product_name: string;
    custom_data?: Record<string, any>;
    notes?: string;
    seller_id?: string;
    seller_name?: string;
    seller_email?: string;
    collaborator_name?: string;
  }) => {
    if (!currentUser) {
      return { success: false, error: 'Usuário não autenticado.' };
    }

    const campaign = campaigns.find(c => c.id === saleData.campaign_id);

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

    const resolvedFdi = (saleData as any).fdi || saleData.custom_data?.fdi || saleData.custom_data?.fdi_channel || 'Simplificada';
    const rawSaleDate = saleData.custom_data?.sale_date || (saleData as any).sale_date || new Date().toISOString();

    const newSaleId = createEntityId('sale');
    const newSale: Sale = {
      id: newSaleId,
      campaign_id: saleData.campaign_id,
      campaign_name: campaign ? campaign.title : 'Venda Direta',
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
        fdi: resolvedFdi,
        fdi_channel: resolvedFdi,
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

    if (client) {
      try {
        // Tenta os dois formatos conhecidos e, somente quando o Supabase informa
        // explicitamente uma coluna inexistente, remove essa coluna e repete.
        // Erros de validação/permissão não são contornados por esta lógica.
        const payloadCandidates: Array<{ label: string; payload: Record<string, unknown> }> = [
          { label: 'Formato R9', payload: buildR9SalePayload(newSale) },
          { label: 'Formato Padrão', payload: buildStandardSalePayload(newSale) },
        ];
        let inserted = false;
        const removedColumns = new Set<string>();

        for (const candidate of payloadCandidates) {
          let payload = { ...candidate.payload };
          for (let attempt = 0; attempt < 12; attempt++) {
            const { error: insertErr } = await client.from('sales').insert(payload).select();
            if (!insertErr) {
              inserted = true;
              supabaseErrorDetails = undefined;
              break;
            }

            logSupabaseError(`addSale - ${candidate.label} (tentativa ${attempt + 1})`, insertErr, payload);
            supabaseErrorDetails = insertErr.message || 'Erro ao registrar a venda no Supabase.';

            const missingColumn =
              insertErr.message?.match(/Could not find the '([^']+)' column of 'sales' in the schema cache/i)?.[1] ||
              insertErr.message?.match(/column ["']?([a-zA-Z_][a-zA-Z0-9_]*)["']? of relation ["']?sales["']? does not exist/i)?.[1];
            const isSchemaError = insertErr.code === 'PGRST204' || insertErr.code === '42703' || Boolean(missingColumn);

            if (isSchemaError && missingColumn && Object.prototype.hasOwnProperty.call(payload, missingColumn)) {
              delete payload[missingColumn];
              removedColumns.add(missingColumn);
              continue; // Erro de coluna inexistente garante que esta tentativa não inseriu a venda.
            }

            // Um erro não relacionado a coluna inexistente não deve ser contornado.
            break;
          }
          if (inserted) break;
        }

        if (inserted) {
          LocalSyncEngine.clearPendingSale(newSale.id);
          if (removedColumns.size) {
            console.warn('[Supabase Sales] Colunas ausentes omitidas do payload:', [...removedColumns]);
          }
        } else {
          LocalSyncEngine.savePendingSales([...LocalSyncEngine.getPendingSales(), newSale]);
        }
      } catch (err: any) {
        console.error('💥 [Supabase Sales] Exceção inesperada no insert:', err);
        supabaseErrorDetails = err.message || 'Erro de conexão com Supabase';
        LocalSyncEngine.savePendingSales([...LocalSyncEngine.getPendingSales(), newSale]);
      }
    } else {
      LocalSyncEngine.savePendingSales([...LocalSyncEngine.getPendingSales(), newSale]);
    }

    const updatedSales = [newSale, ...sales];
    setSales(updatedSales);
    LocalSyncEngine.saveSales(updatedSales);

    triggerConfetti();

    return {
      success: !supabaseErrorDetails,
      sale: newSale,
      error: supabaseErrorDetails
        ? `A venda foi mantida localmente para sincronização, mas não foi confirmada no servidor: ${supabaseErrorDetails}`
        : undefined,
    };
  };

  // Update Sale (Admin editing registered sales)
  const updateSale = async (saleId: string, updatedData: Partial<Sale>, baseSale?: Sale) => {
    let updatedItem: Sale | undefined;

    const updated = sales.map(s => {
      if (s.id === saleId) {
        // 4. Certifique-se de que se o usuário alterar o consultor em uma edição de venda,
        // esses 4 campos sejam sobrescritos e atualizados juntos: seller_id, collaborator_id, seller_name, collaborator_name, seller_email
        let updatedSellerName = updatedData.seller_name || updatedData.collaborator_name || s.seller_name;
        let updatedSellerId = updatedData.seller_id || (updatedData as any).collaborator_id || s.seller_id;
        let updatedSellerEmail = updatedData.seller_email !== undefined ? updatedData.seller_email : s.seller_email;

        // Se veio indicação de troca de consultor (seller_id, collaborator_id, seller_name ou collaborator_name), busca no perfil
        if (updatedData.seller_id || (updatedData as any).collaborator_id || updatedData.seller_name || updatedData.collaborator_name) {
          const checkId = updatedData.seller_id || (updatedData as any).collaborator_id;
          const matchedProfile = 
            (checkId ? profiles.find(p => p.id === checkId) : undefined) ||
            (updatedData.seller_name ? profiles.find(p => p.name.toLowerCase() === updatedData.seller_name!.toLowerCase()) : undefined) ||
            (updatedData.collaborator_name ? profiles.find(p => p.name.toLowerCase() === updatedData.collaborator_name!.toLowerCase()) : undefined);

          if (matchedProfile) {
            updatedSellerName = matchedProfile.name;
            updatedSellerId = matchedProfile.id;
            updatedSellerEmail = matchedProfile.email || '';
          }
        }

        const resolvedUpdatedFdi = (updatedData as any).fdi || updatedData.custom_data?.fdi || updatedData.custom_data?.fdi_channel || s.fdi || 'Simplificada';
        const mergedCustomData = {
          ...(s.custom_data || {}),
          ...(updatedData.custom_data || {}),
          fdi: resolvedUpdatedFdi,
          fdi_channel: resolvedUpdatedFdi,
          seller_name: updatedSellerName,
          collaborator_name: updatedSellerName,
          seller_id: updatedSellerId,
          collaborator_id: updatedSellerId,
          seller_email: updatedSellerEmail,
        };

        updatedItem = {
          ...s,
          ...updatedData,
          seller_name: updatedSellerName,
          collaborator_name: updatedSellerName,
          seller_id: updatedSellerId,
          collaborator_id: updatedSellerId,
          seller_email: updatedSellerEmail,
          fdi: resolvedUpdatedFdi,
          custom_data: mergedCustomData,
        };
        return updatedItem;
      }
      return s;
    });

    // A página de Vendas é paginada e a venda em edição pode não estar
    // presente no array global `sales`. Nesse caso usamos a própria venda
    // recebida pelo modal como base para montar o payload completo.
    if (!updatedItem && baseSale && baseSale.id === saleId) {
      let updatedSellerName = updatedData.seller_name || updatedData.collaborator_name || baseSale.seller_name;
      let updatedSellerId = updatedData.seller_id || (updatedData as any).collaborator_id || baseSale.seller_id;
      let updatedSellerEmail = updatedData.seller_email !== undefined ? updatedData.seller_email : baseSale.seller_email;

      const checkId = updatedData.seller_id || (updatedData as any).collaborator_id;
      const matchedProfile =
        (checkId ? profiles.find(p => p.id === checkId) : undefined) ||
        (updatedData.seller_name ? profiles.find(p => p.name.toLowerCase() === updatedData.seller_name!.toLowerCase()) : undefined) ||
        (updatedData.collaborator_name ? profiles.find(p => p.name.toLowerCase() === updatedData.collaborator_name!.toLowerCase()) : undefined);

      if (matchedProfile) {
        updatedSellerName = matchedProfile.name;
        updatedSellerId = matchedProfile.id;
        updatedSellerEmail = matchedProfile.email || '';
      }

      const resolvedUpdatedFdi = (updatedData as any).fdi || updatedData.custom_data?.fdi || updatedData.custom_data?.fdi_channel || baseSale.fdi || 'Simplificada';
      const mergedCustomData = {
        ...(baseSale.custom_data || {}),
        ...(updatedData.custom_data || {}),
        fdi: resolvedUpdatedFdi,
        fdi_channel: resolvedUpdatedFdi,
        seller_name: updatedSellerName,
        collaborator_name: updatedSellerName,
        seller_id: updatedSellerId,
        collaborator_id: updatedSellerId,
        seller_email: updatedSellerEmail,
      };

      updatedItem = {
        ...baseSale,
        ...updatedData,
        seller_name: updatedSellerName,
        collaborator_name: updatedSellerName,
        seller_id: updatedSellerId,
        collaborator_id: updatedSellerId,
        seller_email: updatedSellerEmail,
        fdi: resolvedUpdatedFdi,
        custom_data: mergedCustomData,
      };
    }

    const wasInLoadedSales = sales.some(s => s.id === saleId);

    // Regra de permissão: vendedor pode editar somente a própria venda e nunca pode
    // transferi-la para outro vendedor. Apenas administradores podem alterar o responsável.
    if (currentUser?.role !== 'admin') {
      const originalSale = baseSale || sales.find(s => s.id === saleId);
      if (!originalSale || originalSale.seller_id !== currentUser?.id) {
        return { success: false, error: 'Você só pode editar suas próprias vendas.' };
      }

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
      const r9Payload = buildR9SalePayload(updatedItem);
      let updateQuery = client.from('sales').update(r9Payload).eq('id', saleId);
      if (currentUser?.role !== 'admin') {
        updateQuery = updateQuery.eq('seller_id', currentUser!.id);
      }
      const { error: updateErr } = await updateQuery;
      if (updateErr) {
        logSupabaseError('updateSale - Formato R9', updateErr, r9Payload);
        const standardPayload = buildStandardSalePayload(updatedItem);
        let altUpdateQuery = client.from('sales').update(standardPayload).eq('id', saleId);
        if (currentUser?.role !== 'admin') {
          altUpdateQuery = altUpdateQuery.eq('seller_id', currentUser!.id);
        }
        const { error: altErr } = await altUpdateQuery;
        if (altErr) {
          logSupabaseError('updateSale - Formato Padrão', altErr, standardPayload);
          return { success: false, error: altErr.message || updateErr.message || 'Erro ao atualizar a venda.' };
        }
      }

      if (wasInLoadedSales) {
        setSales(updated);
        LocalSyncEngine.saveSales(updated);
      }
    } catch (err: any) {
      console.error('💥 [Supabase Sales] Exceção no update:', err);
      return { success: false, error: err?.message || 'Erro ao atualizar a venda.' };
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
      // 1. Marca imediatamente a exclusão nas travas locais contra ressuscitação
      LocalSyncEngine.addDeletedSaleId(saleId);
      LocalSyncEngine.clearPendingSale(saleId);
      const remainingLocal = LocalSyncEngine.getSales().filter(s => s.id !== saleId);
      LocalSyncEngine.saveSales(remainingLocal);

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
          .select('id, seller_id, collaborator_id')
          .eq('id', saleId)
          .maybeSingle();

        if (!checkErr && existingRow) {
          console.error('❌ [Supabase Sales] Falha de RLS: O registro existe no banco mas o DELETE afetou 0 linhas.', existingRow);
          return {
            success: false,
            error: 'Permissão insuficiente no Supabase (RLS): O banco de dados recusou a exclusão desta venda. Verifique se seu perfil possui cargo de administrador ativo no banco de dados ou se você é o autor do lançamento.'
          };
        }
      }

      // 4. Exclusão confirmada no servidor ou o item já não existia no banco
      const updated = sales.filter(s => s.id !== saleId);
      setSales(updated);
      LocalSyncEngine.saveSales(updated);
      return { success: true };
    } catch (err: any) {
      console.error('💥 [Supabase Sales] Exceção no delete:', err);
      return { success: false, error: err?.message || 'Erro inesperado ao excluir a venda.' };
    }
  };

  // Create Campaign
  const createCampaign = async (campaignData: Omit<Campaign, 'id' | 'created_at'>) => {
    const newId = createEntityId('camp');
    const newCampaign: Campaign = {
      ...campaignData,
      id: newId,
      created_at: new Date().toISOString(),
    };

    const client = getSupabaseClient();
    if (!client) {
      return { success: false, error: 'Supabase não está configurado.' };
    }

    try {
      const { error } = await client.from('campaigns').insert(newCampaign);
      if (error) {
        logSupabaseError('createCampaign', error, newCampaign);
        return { success: false, error: error.message || 'Erro ao criar campanha.' };
      }

      const updated = [newCampaign, ...campaigns];
      setCampaigns(updated);
      LocalSyncEngine.saveCampaigns(updated);
      return { success: true, campaign: newCampaign };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Erro ao criar campanha.' };
    }
  };

  const toggleCampaignStatus = async (campaignId: string) => {
    const campaign = campaigns.find(c => c.id === campaignId);
    if (!campaign) return { success: false, error: 'Campanha não encontrada.' };

    const client = getSupabaseClient();
    if (!client) {
      return { success: false, error: 'Supabase não está configurado.' };
    }

    const newStatus = !campaign.active;
    try {
      const { error } = await client.from('campaigns').update({ active: newStatus }).eq('id', campaignId);
      if (error) {
        logSupabaseError('toggleCampaignStatus', error, { campaignId, active: newStatus });
        return { success: false, error: error.message || 'Erro ao alterar status da campanha.' };
      }

      const updated = campaigns.map(c => c.id === campaignId ? { ...c, active: newStatus } : c);
      setCampaigns(updated);
      LocalSyncEngine.saveCampaigns(updated);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Erro ao alterar status da campanha.' };
    }
  };

  const deleteCampaign = async (campaignId: string) => {
    const client = getSupabaseClient();
    if (!client) {
      return { success: false, error: 'Supabase não está configurado.' };
    }

    try {
      const { error } = await client.from('campaigns').delete().eq('id', campaignId);
      if (error) {
        logSupabaseError('deleteCampaign', error, { campaignId });
        return { success: false, error: error.message || 'Erro ao excluir campanha.' };
      }

      const updated = campaigns.filter(c => c.id !== campaignId);
      setCampaigns(updated);
      LocalSyncEngine.saveCampaigns(updated);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Erro ao excluir campanha.' };
    }
  };

  return (
    <SalesContext.Provider
      value={{
        campaigns,
        sales,
        leaderboard,
        activeCampaigns,
        addSale,
        updateSale,
        deleteSale,
        createCampaign,
        toggleCampaignStatus,
        deleteCampaign,
        triggerConfetti,
        fetchSalesPage,
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
