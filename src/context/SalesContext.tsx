import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { Campaign, Sale, LeaderboardEntry, Profile, PaymentMethod } from '../types';
import { supabase, getSupabaseClient, LocalSyncEngine, INITIAL_CAMPAIGNS, INITIAL_SALES } from '../lib/supabase';
import { 
  normalizeRemoteSale, 
  buildR9SalePayload, 
  buildStandardSalePayload, 
  logSupabaseError 
} from '../lib/salesMapper';
import { useAuth } from './AuthContext';
import confetti from 'canvas-confetti';

interface SalesContextType {
  campaigns: Campaign[];
  sales: Sale[];
  leaderboard: LeaderboardEntry[];
  activeCampaigns: Campaign[];
  totalCompanyRevenue: number;
  totalCompanySalesCount: number;
  overallTargetPercentage: number;
  averageTicket: number;
  addSale: (saleData: {
    campaign_id: string;
    client_name: string;
    client_document?: string;
    client_phone?: string;
    client_email?: string;
    product_name: string;
    value: number;
    payment_method: PaymentMethod;
    custom_data?: Record<string, any>;
    notes?: string;
    seller_id?: string;
    seller_name?: string;
    seller_email?: string;
    collaborator_name?: string;
  }) => Promise<{ success: boolean; sale?: Sale; error?: string }>;
  updateSale: (saleId: string, updatedData: Partial<Sale>) => Promise<{ success: boolean; error?: string }>;
  deleteSale: (saleId: string) => Promise<{ success: boolean; error?: string }>;
  clearAllSales: () => Promise<{ success: boolean; error?: string }>;
  createCampaign: (campaignData: Omit<Campaign, 'id' | 'created_at'>) => Promise<{ success: boolean; campaign?: Campaign; error?: string }>;
  toggleCampaignStatus: (campaignId: string) => Promise<{ success: boolean; error?: string }>;
  deleteCampaign: (campaignId: string) => Promise<{ success: boolean; error?: string }>;
  getSellerStats: (sellerId: string) => {
    totalSales: number;
    totalRevenue: number;
    target: number;
    targetPercentage: number;
    rankPosition: number;
    averageTicket: number;
  };
  triggerConfetti: () => void;
  exportSalesToCSV: () => void;
  fetchSalesPage: (params: {
    page: number;
    pageSize?: number;
    searchTerm?: string;
    productFilter?: string;
    sortField?: string;
    sortDirection?: 'asc' | 'desc';
    onlyToday?: boolean;
  }) => Promise<{ data: Sale[]; count: number; error?: string }>;
  recentLiveActivity: { id: string; message: string; time: string; value: number; seller: string }[];
}

const SalesContext = createContext<SalesContextType | undefined>(undefined);

export const SalesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, profiles } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [recentLiveActivity, setRecentLiveActivity] = useState<
    { id: string; message: string; time: string; value: number; seller: string }[]
  >([]);

  // Load initial sales & campaigns
  const loadData = useCallback(async () => {
    const client = getSupabaseClient();
    const localCampaigns = LocalSyncEngine.getCampaigns();
    const localSales = LocalSyncEngine.getSales();

    // O cache local é apenas fallback inicial/offline. Quando o servidor responde,
    // seus dados passam a ser a fonte oficial e substituem o snapshot local.
    setCampaigns(localCampaigns);
    setSales(localSales);

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
          const normalized = (remoteSales || []).map(row => {
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
            const { error: pendingError } = await client.from('sales').insert(buildR9SalePayload(pendingSale));
            if (pendingError) stillPending.push(pendingSale);
          }
          LocalSyncEngine.savePendingSales(stillPending);

          // Reconsulta somente quando havia itens pendentes; assim o cache nunca
          // é tratado como uma segunda fonte de verdade.
          let authoritative = normalized;
          if (pendingSales.length > 0 && stillPending.length < pendingSales.length) {
            const { data: refreshed } = await client.from('sales').select('*').order('created_at', { ascending: false });
            if (refreshed) authoritative = refreshed.map(row => normalizeRemoteSale(row));
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

              // Atualiza o feed de atividades recentes
              const sellerName = newSale.seller_name || 'Consultor';
              const formattedVal = (Number(newSale.value) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
              setRecentLiveActivity((prev) => [
                {
                  id: `realtime-act-${Date.now()}`,
                  message: `${sellerName} acabou de fechar R$ ${formattedVal}!`,
                  time: 'Agora mesmo',
                  value: Number(newSale.value) || 0,
                  seller: sellerName,
                },
                ...prev.slice(0, 7)
              ]);
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
      const escaped = q.replace(/[%_,]/g, ' ');
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
      const escapedProduct = productFilter.replace(/[%_,]/g, ' ');
      query = query.or(`product_name.ilike.%${escapedProduct}%,product.ilike.%${escapedProduct}%`);
    }

    if (onlyToday) {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
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

    const normalized = (data || []).map(row => normalizeRemoteSale(row));
    return { data: normalized, count: count || 0 };
  }, []);

  const activeCampaigns = useMemo(() => {
    return campaigns.filter(c => c.active);
  }, [campaigns]);

  // Total metrics
  const totalCompanyRevenue = useMemo(() => {
    return sales
      .reduce((acc, s) => acc + (Number(s.value) || 0), 0);
  }, [sales]);

  const totalCompanySalesCount = useMemo(() => {
    return sales.length;
  }, [sales]);

  const averageTicket = useMemo(() => {
    if (sales.length === 0) return 0;
    return totalCompanyRevenue / sales.length;
  }, [sales, totalCompanyRevenue]);

  const overallTargetPercentage = useMemo(() => {
    const totalTarget = campaigns.reduce((acc, c) => acc + (c.active ? Number(c.target_amount) || 0 : 0), 0) || 300000;
    if (totalTarget === 0) return 0;
    return Math.min(Math.round((totalCompanyRevenue / totalTarget) * 100), 100);
  }, [campaigns, totalCompanyRevenue]);

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
        total_value: totalCount,
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
    value: number;
    payment_method: PaymentMethod;
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

    const newSaleId = `sale-${Date.now().toString().slice(-6)}`;
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
      value: Number(saleData.value),
      payment_method: saleData.payment_method,
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
        // Tentativa 1: Estrutura oficial da tabela R9 Sales
        const r9Payload = buildR9SalePayload(newSale);
        
        const { error: insertErr } = await client
          .from('sales')
          .insert(r9Payload)
          .select();

        if (insertErr) {
          logSupabaseError('addSale - Formato R9 (tentativa 1)', insertErr, r9Payload);
          supabaseErrorDetails = insertErr.message;

          // Se o erro foi por incompatibilidade de colunas (PGRST204 ou 42703), tenta o formato alternativo
          if (
            insertErr.code === 'PGRST204' || 
            insertErr.code === '42703' ||
            insertErr.message?.includes('column') ||
            insertErr.message?.includes('schema cache')
          ) {
            const standardPayload = buildStandardSalePayload(newSale);
            const { error: altErr } = await client
              .from('sales')
              .insert(standardPayload)
              .select();

            if (altErr) {
              logSupabaseError('addSale - Formato Padrão (tentativa 2)', altErr, standardPayload);
              supabaseErrorDetails = `${insertErr.message} | ${altErr.message}`;
            } else {
              supabaseErrorDetails = undefined;
            }
          }
        }
      } catch (err: any) {
        console.error('💥 [Supabase Sales] Exceção inesperada no insert:', err);
        supabaseErrorDetails = err.message || 'Erro de conexão com Supabase';
      }

      if (supabaseErrorDetails) {
        LocalSyncEngine.savePendingSales([...LocalSyncEngine.getPendingSales(), newSale]);
      } else {
        LocalSyncEngine.clearPendingSale(newSale.id);
      }
    } else {
      LocalSyncEngine.savePendingSales([...LocalSyncEngine.getPendingSales(), newSale]);
    }

    const updatedSales = [newSale, ...sales];
    setSales(updatedSales);
    LocalSyncEngine.saveSales(updatedSales);

    // Live Activity Feed item
    const activityItem = {
      id: `act-${Date.now()}`,
      message: `${selectedSellerName} acabou de fechar R$ ${newSale.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}!`,
      time: 'Agora mesmo',
      value: newSale.value,
      seller: selectedSellerName,
    };
    setRecentLiveActivity(prev => [activityItem, ...prev.slice(0, 7)]);

    triggerConfetti();

    return { 
      success: true, 
      sale: newSale,
      error: supabaseErrorDetails
    };
  };

  // Update Sale (Admin editing registered sales)
  const updateSale = async (saleId: string, updatedData: Partial<Sale>) => {
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

        const newDocValue = updatedData.value !== undefined ? Number(updatedData.value) : Number(s.value);
        updatedItem = {
          ...s,
          ...updatedData,
          seller_name: updatedSellerName,
          collaborator_name: updatedSellerName,
          seller_id: updatedSellerId,
          collaborator_id: updatedSellerId,
          seller_email: updatedSellerEmail,
          fdi: resolvedUpdatedFdi,
          value: newDocValue,
          custom_data: mergedCustomData,
        };
        return updatedItem;
      }
      return s;
    });

    setSales(updated);
    LocalSyncEngine.saveSales(updated);

    const client = getSupabaseClient();
    if (client && updatedItem) {
      try {
        const r9Payload = buildR9SalePayload(updatedItem);
        const { error: updateErr } = await client.from('sales').update(r9Payload).eq('id', saleId);
        if (updateErr) {
          logSupabaseError('updateSale - Formato R9', updateErr, r9Payload);
          const standardPayload = buildStandardSalePayload(updatedItem);
          const { error: altErr } = await client.from('sales').update(standardPayload).eq('id', saleId);
          if (altErr) {
            logSupabaseError('updateSale - Formato Padrão', altErr, standardPayload);
          }
        }
      } catch (err) {
        console.error('💥 [Supabase Sales] Exceção no update:', err);
      }
    }

    return { success: true };
  };

  // Delete Sale (Admin)
  const deleteSale = async (saleId: string) => {
    const updated = sales.filter(s => s.id !== saleId);
    setSales(updated);
    LocalSyncEngine.saveSales(updated);

    const client = getSupabaseClient();
    if (client) {
      try {
        const { error: delErr } = await client.from('sales').delete().eq('id', saleId);
        if (delErr) {
          logSupabaseError('deleteSale', delErr, { saleId });
        }
      } catch (err) {
        console.error('💥 [Supabase Sales] Exceção no delete:', err);
      }
    }

    return { success: true };
  };

  const clearAllSales = async () => {
    setSales([]);
    LocalSyncEngine.clearAllSales();
    const client = getSupabaseClient();
    if (client) {
      try {
        const { error: clearErr } = await client.from('sales').delete().neq('id', 'dummy_never_match');
        if (clearErr) {
          logSupabaseError('clearAllSales', clearErr);
        }
      } catch (err) {
        console.error('💥 [Supabase Sales] Exceção no clearAllSales:', err);
      }
    }
    return { success: true };
  };


  // Create Campaign (dynamic form replacement for MS Forms)
  const createCampaign = async (campaignData: Omit<Campaign, 'id' | 'created_at'>) => {
    const newId = `camp-${Date.now().toString().slice(-6)}`;
    const newCampaign: Campaign = {
      ...campaignData,
      id: newId,
      created_at: new Date().toISOString(),
    };

    const client = getSupabaseClient();
    if (client) {
      try {
        await client.from('campaigns').insert(newCampaign);
      } catch {
        // Fallback local
      }
    }

    const updated = [newCampaign, ...campaigns];
    setCampaigns(updated);
    LocalSyncEngine.saveCampaigns(updated);

    return { success: true, campaign: newCampaign };
  };

  const toggleCampaignStatus = async (campaignId: string) => {
    let newStatus = true;
    const updated = campaigns.map(c => {
      if (c.id === campaignId) {
        newStatus = !c.active;
        return { ...c, active: !c.active };
      }
      return c;
    });

    setCampaigns(updated);
    LocalSyncEngine.saveCampaigns(updated);

    const client = getSupabaseClient();
    if (client) {
      try {
        await client.from('campaigns').update({ active: newStatus }).eq('id', campaignId);
      } catch {
        // Fallback local
      }
    }

    return { success: true };
  };

  const deleteCampaign = async (campaignId: string) => {
    const updated = campaigns.filter(c => c.id !== campaignId);
    setCampaigns(updated);
    LocalSyncEngine.saveCampaigns(updated);

    const client = getSupabaseClient();
    if (client) {
      try {
        await client.from('campaigns').delete().eq('id', campaignId);
      } catch {
        // Fallback local
      }
    }

    return { success: true };
  };

  const getSellerStats = (sellerId: string) => {
    const sellerSales = sales.filter(s => s.seller_id === sellerId);
    const approvedSales = sellerSales;
    const totalRevenue = approvedSales.reduce((acc, s) => acc + (Number(s.value) || 0), 0);
    const sellerProfile = profiles.find(p => p.id === sellerId);
    const target = sellerProfile?.target_monthly || 50000;
    const targetPercentage = target > 0 ? Math.min(Math.round((totalRevenue / target) * 100), 100) : 0;
    
    const rankEntry = leaderboard.find(l => l.seller_id === sellerId);
    const rankPosition = rankEntry?.position || 1;
    const averageTicket = approvedSales.length > 0 ? totalRevenue / approvedSales.length : 0;

    return {
      totalSales: approvedSales.length,
      totalRevenue,
      target,
      targetPercentage,
      rankPosition,
      averageTicket,
    };
  };

  const exportSalesToCSV = () => {
    if (sales.length === 0) return;
    const headers = ['ID', 'Data', 'Campanha', 'Vendedor', 'Email Vendedor', 'Cliente', 'Documento', 'Telefone', 'Email Cliente', 'Produto', 'Valor (R$)', 'Forma Pagamento', 'Observações'];
    const rows = sales.map(s => [
      s.id,
      new Date(s.created_at).toLocaleDateString('pt-BR'),
      `"${s.campaign_name || ''}"`,
      `"${s.seller_name}"`,
      s.seller_email,
      `"${s.client_name}"`,
      s.client_document || '',
      s.client_phone || '',
      s.client_email || '',
      `"${s.product_name}"`,
      s.value,
      `"${s.payment_method}"`,
      `"${(s.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `relatorio_vendas_salesflow_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <SalesContext.Provider
      value={{
        campaigns,
        sales,
        leaderboard,
        activeCampaigns,
        totalCompanyRevenue,
        totalCompanySalesCount,
        overallTargetPercentage,
        averageTicket,
        addSale,
        updateSale,
        deleteSale,
        clearAllSales,
        createCampaign,
        toggleCampaignStatus,
        deleteCampaign,
        getSellerStats,
        triggerConfetti,
        exportSalesToCSV,
      fetchSalesPage,
        recentLiveActivity,
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
