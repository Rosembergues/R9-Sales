import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { Campaign, Sale, LeaderboardEntry, Profile, PaymentMethod, SaleStatus } from '../types';
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
  totalCompanyCommission: number;
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
  updateSaleStatus: (saleId: string, status: SaleStatus) => Promise<{ success: boolean; error?: string }>;
  createCampaign: (campaignData: Omit<Campaign, 'id' | 'created_at'>) => Promise<{ success: boolean; campaign?: Campaign; error?: string }>;
  toggleCampaignStatus: (campaignId: string) => Promise<{ success: boolean; error?: string }>;
  deleteCampaign: (campaignId: string) => Promise<{ success: boolean; error?: string }>;
  getSellerStats: (sellerId: string) => {
    totalSales: number;
    totalRevenue: number;
    commissionEarned: number;
    target: number;
    targetPercentage: number;
    rankPosition: number;
    averageTicket: number;
  };
  triggerConfetti: () => void;
  exportSalesToCSV: () => void;
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

    setCampaigns(localCampaigns);
    setSales(localSales);

    if (client) {
      try {
        const { data: remoteCampaigns } = await client
          .from('campaigns')
          .select('*')
          .order('created_at', { ascending: false });

        if (remoteCampaigns && remoteCampaigns.length > 0) {
          setCampaigns(remoteCampaigns as Campaign[]);
          LocalSyncEngine.saveCampaigns(remoteCampaigns as Campaign[]);
        }

        const { data: remoteSales, error: salesError } = await client
          .from('sales')
          .select('*')
          .order('created_at', { ascending: false });

        if (salesError) {
          logSupabaseError('loadData - Consulta tabela sales', salesError);
        } else if (remoteSales && remoteSales.length > 0) {
          try {
            const normalized = remoteSales.map(row => {
              const sale = normalizeRemoteSale(row);
              // Migração/preenchimento para registros legados sem responsável
              if (!sale.seller_name || sale.seller_name.trim() === '' || sale.seller_name === 'Consultor') {
                const matchedProfile = profiles.find(p => p.id === sale.seller_id || p.id === (row as any).created_by);
                if (matchedProfile) {
                  sale.seller_name = matchedProfile.name;
                } else if (currentUser?.name) {
                  sale.seller_name = currentUser.name;
                }
              }
              return sale;
            });
            setSales(normalized);
            LocalSyncEngine.saveSales(normalized);
          } catch (normErr) {
            console.error('Erro ao normalizar vendas do Supabase:', normErr);
            setSales(remoteSales as Sale[]);
            LocalSyncEngine.saveSales(remoteSales as Sale[]);
          }
        }
      } catch (err) {
        console.warn('Supabase sales load fallback to local:', err);
      }
    }
  }, []);

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
          console.log('🔄 Evento Realtime recebido:', payload);

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
      .subscribe((status) => {
        console.log('📡 Status da Inscrição Realtime:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Sincroniza o cache local sempre que a lista de vendas for atualizada
  useEffect(() => {
    if (sales.length > 0) {
      LocalSyncEngine.saveSales(sales);
    }
  }, [sales]);

  const activeCampaigns = useMemo(() => {
    return campaigns.filter(c => c.active);
  }, [campaigns]);

  // Total metrics
  const totalCompanyRevenue = useMemo(() => {
    return sales
      .filter(s => s.status !== 'Em Análise')
      .reduce((acc, s) => acc + (Number(s.value) || 0), 0);
  }, [sales]);

  const totalCompanySalesCount = useMemo(() => {
    return sales.length;
  }, [sales]);

  const totalCompanyCommission = useMemo(() => {
    return sales.reduce((acc, s) => acc + (Number(s.commission) || 0), 0);
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
        if (s.status === 'Em Análise') return false;
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
    } catch (e) {
      console.warn('Confetti error:', e);
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
    const commissionRate = campaign ? campaign.commission_rate : 5.0;
    const commission = (Number(saleData.value) * commissionRate) / 100;

    const selectedSellerId = saleData.seller_id || currentUser.id;
    const selectedSellerProfile = profiles.find(p => p.id === selectedSellerId);
    const selectedSellerName = saleData.seller_name || saleData.collaborator_name || selectedSellerProfile?.name || currentUser.name;
    const selectedSellerEmail = saleData.seller_email || selectedSellerProfile?.email || currentUser.email;

    const newSaleId = `sale-${Date.now().toString().slice(-6)}`;
    const newSale: Sale = {
      id: newSaleId,
      campaign_id: saleData.campaign_id,
      campaign_name: campaign ? campaign.title : 'Venda Direta',
      seller_id: selectedSellerId,
      seller_name: selectedSellerName,
      seller_email: selectedSellerEmail,
      client_name: saleData.client_name,
      client_document: saleData.client_document,
      client_phone: saleData.client_phone,
      client_email: saleData.client_email,
      product_name: saleData.product_name,
      value: Number(saleData.value),
      payment_method: saleData.payment_method,
      status: 'Aprovada',
      commission,
      custom_data: {
        ...saleData.custom_data,
        collaborator_name: selectedSellerName,
        seller_name: selectedSellerName,
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
        console.info('📤 [Supabase Sales] Executando .insert() com formato R9:', r9Payload);
        
        const { data: insertedData, error: insertErr } = await client
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
            console.warn('🔄 Detectada divergência de colunas. Tentando insert com formato padrão alternativo...');
            const standardPayload = buildStandardSalePayload(newSale);
            const { data: altData, error: altErr } = await client
              .from('sales')
              .insert(standardPayload)
              .select();

            if (altErr) {
              logSupabaseError('addSale - Formato Padrão (tentativa 2)', altErr, standardPayload);
              supabaseErrorDetails = `${insertErr.message} | ${altErr.message}`;
            } else {
              console.info('✅ [Supabase Sales] Venda inserida com sucesso (Formato Padrão):', altData);
              supabaseErrorDetails = undefined;
            }
          }
        } else {
          console.info('✅ [Supabase Sales] Venda inserida com sucesso no Supabase:', insertedData);
        }
      } catch (err: any) {
        console.error('💥 [Supabase Sales] Exceção inesperada no insert:', err);
        supabaseErrorDetails = err.message || 'Erro de conexão com Supabase';
      }
    }

    const updatedSales = [newSale, ...sales];
    setSales(updatedSales);
    LocalSyncEngine.saveSales(updatedSales);

    // Live Activity Feed item
    const activityItem = {
      id: `act-${Date.now()}`,
      message: `${currentUser.name} acabou de fechar R$ ${newSale.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}!`,
      time: 'Agora mesmo',
      value: newSale.value,
      seller: currentUser.name,
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
        const mergedCustomData = updatedData.custom_data
          ? { ...(s.custom_data || {}), ...updatedData.custom_data }
          : s.custom_data;

        // Recalculate commission if value or campaign changed
        const newDocValue = updatedData.value !== undefined ? Number(updatedData.value) : Number(s.value);
        const campaign = campaigns.find(c => c.id === (updatedData.campaign_id || s.campaign_id));
        const commissionRate = campaign ? campaign.commission_rate : 5.0;
        const newCommission = (newDocValue * commissionRate) / 100;

        updatedItem = {
          ...s,
          ...updatedData,
          value: newDocValue,
          commission: updatedData.commission !== undefined ? updatedData.commission : newCommission,
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

  const updateSaleStatus = async (saleId: string, status: SaleStatus) => {
    const updated = sales.map(s => {
      if (s.id === saleId) {
        return { ...s, status };
      }
      return s;
    });

    setSales(updated);
    LocalSyncEngine.saveSales(updated);

    const client = getSupabaseClient();
    if (client) {
      try {
        const { error: statusErr } = await client.from('sales').update({ status }).eq('id', saleId);
        if (statusErr) {
          logSupabaseError('updateSaleStatus', statusErr, { saleId, status });
        }
      } catch (err) {
        console.error('💥 [Supabase Sales] Exceção no updateSaleStatus:', err);
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
      } catch (err) {
        console.warn('Supabase insert campaign fallback:', err);
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
      } catch (err) {
        console.warn('Supabase toggle campaign fallback:', err);
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
      } catch (err) {
        console.warn('Supabase delete campaign fallback:', err);
      }
    }

    return { success: true };
  };

  const getSellerStats = (sellerId: string) => {
    const sellerSales = sales.filter(s => s.seller_id === sellerId);
    const approvedSales = sellerSales.filter(s => s.status !== 'Em Análise');
    const totalRevenue = approvedSales.reduce((acc, s) => acc + (Number(s.value) || 0), 0);
    const commissionEarned = approvedSales.reduce((acc, s) => acc + (Number(s.commission) || 0), 0);
    const sellerProfile = profiles.find(p => p.id === sellerId);
    const target = sellerProfile?.target_monthly || 50000;
    const targetPercentage = target > 0 ? Math.min(Math.round((totalRevenue / target) * 100), 100) : 0;
    
    const rankEntry = leaderboard.find(l => l.seller_id === sellerId);
    const rankPosition = rankEntry?.position || 1;
    const averageTicket = approvedSales.length > 0 ? totalRevenue / approvedSales.length : 0;

    return {
      totalSales: approvedSales.length,
      totalRevenue,
      commissionEarned,
      target,
      targetPercentage,
      rankPosition,
      averageTicket,
    };
  };

  const exportSalesToCSV = () => {
    if (sales.length === 0) return;
    const headers = ['ID', 'Data', 'Campanha', 'Vendedor', 'Email Vendedor', 'Cliente', 'Documento', 'Telefone', 'Email Cliente', 'Produto', 'Valor (R$)', 'Forma Pagamento', 'Status', 'Comissão (R$)', 'Observações'];
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
      s.status,
      s.commission,
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
        totalCompanyCommission,
        averageTicket,
        addSale,
        updateSale,
        deleteSale,
        clearAllSales,
        updateSaleStatus,
        createCampaign,
        toggleCampaignStatus,
        deleteCampaign,
        getSellerStats,
        triggerConfetti,
        exportSalesToCSV,
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
