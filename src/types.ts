export type UserRole = 'admin' | 'seller';

export type MainProductType = 'Graduação' | 'Pós Graduação' | 'Curso Técnico';

export type ProductChannelFDI = 
  | 'Simplificada' 
  | 'MSV' 
  | 'Reabertura' 
  | 'Transferência Externa' 
  | 'Vestibular' 
  | 'ENEM' 
  | 'Técnico' 
  | 'Pós Graduação';

export type ModalityType = 
  | 'Presencial' 
  | 'Semipresencial' 
  | 'Ao Vivo' 
  | 'EAD' 
  | 'FLEX' 
  | 'Técnico' 
  | 'Técnico Presencial'
  | 'Pós Presencial' 
  | 'Pós Ao Vivo'
  | 'Pós Digital';

export type ShiftType = 'Manhã' | 'Noite' | 'Virtual' | 'Manhã e Noite';

export type ParcelaLeveOption = '3 parcelas' | '2 parcelas' | '1 parcela' | 'Sem parcelas';

export interface SaleCustomData {
  opportunity_number?: string;
  candidate_name?: string;
  sale_date?: string; // dd/MM/yyyy
  main_product?: MainProductType;
  business_unit?: 'BU Presencial' | 'BU Digital';
  fdi?: string | ProductChannelFDI; // Texto exclusivo do canal selecionado
  fdi_channel?: ProductChannelFDI;
  modality?: ModalityType;
  shift?: ShiftType;
  parcela_leve?: ParcelaLeveOption;
  has_bolsa_convenio?: boolean;
  empresa_convenio?: string;
  [key: string]: any;
}

export interface Profile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar_url?: string;
  created_at: string;
  status: 'active' | 'inactive';
  phone?: string;
  target_monthly?: number;
}

export interface CampaignField {
  id: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'currency' | 'date';
  required: boolean;
  options?: string[];
  placeholder?: string;
  default_value?: string;
}

export interface Campaign {
  id: string;
  title: string;
  description: string;
  code: string;
  active: boolean;
  commission_rate: number; // e.g. 5 for 5%
  target_amount: number;
  start_date: string;
  end_date: string;
  fields: CampaignField[];
  created_by: string;
  created_at: string;
}

export type PaymentMethod = 
  | 'PIX' 
  | 'Cartão de Crédito' 
  | 'Boleto Bancário' 
  | 'Faturado / Transferência';

export type SaleStatus = 'Aprovada' | 'Pendente' | 'Em Análise';

export interface Sale {
  id: string;
  campaign_id: string;
  campaign_name: string;
  seller_id: string;
  seller_name: string;
  seller_email: string;
  client_name: string;
  client_document?: string;
  client_phone?: string;
  client_email?: string;
  product_name: string;
  value: number;
  payment_method: PaymentMethod;
  status: SaleStatus;
  commission: number;
  fdi?: string | ProductChannelFDI;
  custom_data?: SaleCustomData;
  notes?: string;
  created_at: string;
}

export interface LeaderboardEntry {
  seller_id: string;
  name: string;
  email: string;
  avatar_url?: string;
  total_sales: number;
  total_value?: number;
  target: number;
  percentage_reached: number;
  position: number;
  rank_tier: 'Bronze' | 'Prata' | 'Ouro' | 'Diamante';
  commission_earned?: number;
  recent_trend?: 'up' | 'down' | 'same';
  graduacao_count?: number;
  pos_count?: number;
  tecnico_count?: number;
}

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  isCustom: boolean;
  connected: boolean;
}

export type GoalType = 'semanal' | 'mensal';

export interface Goal {
  id: string;
  user_id: string;
  type: GoalType;
  target_value: number;
  created_at?: string;
  updated_at?: string;
  month?: number;
  year?: number;
}
