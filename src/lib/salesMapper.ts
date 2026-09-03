import { Sale } from '../types';

/**
 * Valida se uma string é um UUID v4 válido
 */
export function isValidUuid(str?: string | null): boolean {
  if (!str) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

/**
 * Converte data em formato DD/MM/YYYY ou ISO para string ISO 8601 segura para PostgreSQL TIMESTAMPTZ
 */
export function toValidIsoTimestamp(dateInput?: string | null): string {
  if (!dateInput) return new Date().toISOString();

  // Caso esteja no formato DD/MM/YYYY
  if (typeof dateInput === 'string' && dateInput.includes('/')) {
    const parts = dateInput.split('/');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      const d = new Date(Date.UTC(year, month, day, 12, 0, 0));
      if (!isNaN(d.getTime())) {
        return d.toISOString();
      }
    }
  }

  // Caso seja YYYY-MM-DD
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    return `${dateInput}T12:00:00.000Z`;
  }

  const parsed = new Date(dateInput);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }

  return new Date().toISOString();
}

/**
 * Converte timestamp ISO para string formatada DD/MM/YYYY
 */
export function formatIsoToBr(isoStr?: string | null): string {
  if (!isoStr) return '';
  try {
    const d = new Date(isoStr);
    if (!isNaN(d.getTime())) {
      const day = String(d.getUTCDate()).padStart(2, '0');
      const month = String(d.getUTCMonth() + 1).padStart(2, '0');
      const year = d.getUTCFullYear();
      return `${day}/${month}/${year}`;
    }
  } catch {
    // fallback
  }
  return String(isoStr);
}

/**
 * Retorna a data atual de hoje no formato estrito DD/MM/YYYY
 */
export function getTodayBrDate(): string {
  const today = new Date();
  const day = String(today.getDate()).padStart(2, '0');
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const year = today.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Retorna a Data da Venda no formato estrito DD/MM/YYYY.
 * PRIORIDADE TOTAL para a Data da Venda informada no lançamento (sale_date)
 * e NUNCA a data do registro no sistema (created_at).
 * Se alguém subir hoje um boleto com data de ontem, esta função retorna a data de ontem!
 */
export function getSaleDateBr(sale: Partial<Sale> & { custom_data?: any; sale_date?: string }): string {
  if (!sale) return '';

  // 1. Data da venda informada explicitamente no custom_data ou campo sale_date
  const explicitSaleDate = sale.custom_data?.sale_date || (sale as any).sale_date;
  if (explicitSaleDate && typeof explicitSaleDate === 'string') {
    const trimmed = explicitSaleDate.trim();
    // Formato DD/MM/YYYY
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(trimmed)) {
      const parts = trimmed.split('/');
      return `${parts[0].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[2]}`;
    }
    // Formato YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      const [y, m, d] = trimmed.slice(0, 10).split('-');
      return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
    }
    // Formato ISO
    try {
      const parsed = new Date(trimmed);
      if (!isNaN(parsed.getTime())) {
        const day = String(parsed.getUTCDate()).padStart(2, '0');
        const month = String(parsed.getUTCMonth() + 1).padStart(2, '0');
        const year = parsed.getUTCFullYear();
        return `${day}/${month}/${year}`;
      }
    } catch {}
    return trimmed;
  }

  // 2. Apenas se não houver data da venda definida (fallback para registros legados)
  if (sale.created_at) {
    try {
      const d = new Date(sale.created_at);
      if (!isNaN(d.getTime())) {
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
      }
    } catch {}
  }

  return '';
}

/**
 * Normaliza um registro vindo do Supabase para o modelo interno Sale
 */
export function normalizeRemoteSale(row: any): Sale {
  if (!row) throw new Error('Objeto vazio recebido do Supabase');

  const custom = row.custom_data && typeof row.custom_data === 'object' ? row.custom_data : {};
  
  const candidate = 
    row.candidate_name || 
    row.client_name || 
    custom.candidate_name || 
    'Aluno / Candidato';

  const collaborator = 
    row.collaborator_name || 
    row.seller_name || 
    custom.collaborator_name || 
    'Consultor R9';

  const opportunity = 
    row.opportunity || 
    row.opportunity_number || 
    custom.opportunity_number || 
    (row.id ? String(row.id).replace('sale-', 'OP-') : 'OP-000');

  const product = 
    row.product || 
    row.product_name || 
    custom.main_product || 
    'Graduação';

  const turn = 
    row.turn || 
    row.shift || 
    custom.shift || 
    'Noite';

  const modality = 
    row.modality || 
    custom.modality || 
    'Presencial';

  // Boolean flags
  const fdiBool = typeof row.fdi === 'boolean' 
    ? row.fdi 
    : Boolean(custom.fdi_channel);

  const lightInstallmentBool = typeof row.light_installment === 'boolean'
    ? row.light_installment
    : Boolean(custom.parcela_leve && custom.parcela_leve !== 'Sem parcelas');

  const partnerScholarshipBool = typeof row.partner_scholarship === 'boolean'
    ? row.partner_scholarship
    : Boolean(custom.has_bolsa_convenio);

  const rawDate = custom.sale_date || row.sale_date || row.created_at;
  const dateBr = typeof rawDate === 'string' && rawDate.includes('/') 
    ? rawDate 
    : formatIsoToBr(rawDate);

  return {
    id: String(row.id),
    campaign_id: row.campaign_id || '',
    campaign_name: row.campaign_name || 'Captação 2026',
    seller_id: row.seller_id || '',
    seller_name: collaborator,
    seller_email: row.seller_email || '',
    client_name: candidate,
    client_document: row.client_document || '',
    client_phone: row.client_phone || '',
    client_email: row.client_email || '',
    product_name: product,
    value: Number(row.value) || 1200,
    payment_method: row.payment_method || 'PIX',
    status: row.status || 'Aprovada',
    commission: Number(row.commission) || 60,
    notes: row.notes || '',
    created_at: row.created_at || new Date().toISOString(),
    custom_data: {
      ...custom,
      candidate_name: candidate,
      opportunity_number: opportunity,
      sale_date: dateBr,
      main_product: product,
      modality: modality,
      shift: turn,
      fdi_channel: custom.fdi_channel || (fdiBool ? 'Vestibular' : 'Simplificada'),
      parcela_leve: custom.parcela_leve || (lightInstallmentBool ? '3 parcelas' : 'Sem parcelas'),
      has_bolsa_convenio: partnerScholarshipBool,
      empresa_convenio: row.empresa_convenio || custom.empresa_convenio || '',
      business_unit: custom.business_unit || (modality === 'EAD' || modality === 'FLEX' || modality === 'Pós Digital' ? 'BU Digital' : 'BU Presencial')
    }
  };
}

/**
 * Payload específico para a estrutura R9 Sales (tabela sales padrão com collaborator_name, candidate_name, etc.)
 */
export function buildR9SalePayload(sale: Sale): Record<string, any> {
  const custom = sale.custom_data || {};
  
  const fdiBool = Boolean(custom.fdi_channel);

  const lightInstallmentBool = Boolean(
    custom.parcela_leve && custom.parcela_leve !== 'Sem parcelas'
  );

  const partnerScholarshipBool = Boolean(custom.has_bolsa_convenio);

  return {
    id: sale.id,
    collaborator_name: sale.seller_name || 'Consultor',
    candidate_name: custom.candidate_name || sale.client_name || 'Candidato',
    opportunity: custom.opportunity_number || sale.id.replace('sale-', 'OP-'),
    product: custom.main_product || sale.product_name || 'Graduação',
    turn: custom.shift || 'Noite',
    modality: custom.modality || 'Presencial',
    fdi: fdiBool,
    light_installment: lightInstallmentBool,
    partner_scholarship: partnerScholarshipBool,
    notes: sale.notes || '',
    sale_date: toValidIsoTimestamp(custom.sale_date || (sale as any).sale_date || sale.created_at),
    campaign_id: sale.campaign_id || null,
    created_at: toValidIsoTimestamp(sale.created_at),
  };
}

/**
 * Payload alternativo compatível com o schema completo/clássico
 */
export function buildStandardSalePayload(sale: Sale): Record<string, any> {
  const payload: Record<string, any> = {
    id: sale.id,
    campaign_id: sale.campaign_id || null,
    campaign_name: sale.campaign_name || 'Captação R9',
    seller_name: sale.seller_name || 'Consultor',
    seller_email: sale.seller_email || '',
    client_name: sale.custom_data?.candidate_name || sale.client_name || 'Candidato',
    client_document: sale.client_document || null,
    client_phone: sale.client_phone || null,
    client_email: sale.client_email || null,
    product_name: sale.custom_data?.main_product || sale.product_name || 'Graduação',
    value: Number(sale.value) || 1200,
    payment_method: sale.payment_method || 'PIX',
    status: sale.status || 'Aprovada',
    commission: Number(sale.commission) || 0,
    custom_data: sale.custom_data || {},
    notes: sale.notes || '',
    created_at: toValidIsoTimestamp(sale.created_at),
  };

  // Se seller_id for um UUID válido, inclui no payload (senão omite para evitar erro 400 de sintaxe uuid)
  if (isValidUuid(sale.seller_id)) {
    payload.seller_id = sale.seller_id;
  }

  return payload;
}

/**
 * Exibe logs de erro com formatação rica no console para diagnóstico imediato
 */
export function logSupabaseError(
  context: string, 
  error: { message?: string; details?: string; hint?: string; code?: string } | null,
  payloadSent?: any
) {
  if (!error) return;

  console.group(`%c🚨 Supabase Erro [${context}]`, 'background: #dc2626; color: white; padding: 4px 8px; border-radius: 4px; font-weight: bold;');
  console.error('Mensagem:', error.message || 'Sem mensagem descritiva');
  if (error.code) console.error('Código PostgreSQL/PostgREST:', error.code);
  if (error.details) console.error('Detalhes:', error.details);
  if (error.hint) console.error('Dica (Hint):', error.hint);
  if (payloadSent) {
    console.info('Objeto enviado no .insert() / .update():', payloadSent);
  }
  console.groupEnd();
}
