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
  business_unit?: 'BU Presencial' | 'BU Digital' | 'Pós-Graduação' | 'Curso Técnico';
  fdi?: string | ProductChannelFDI; // Texto exclusivo do canal selecionado
  fdi_channel?: ProductChannelFDI;
  modality?: ModalityType;
  shift?: ShiftType;
  parcela_leve?: ParcelaLeveOption;
  has_bolsa_convenio?: boolean;
  empresa_convenio?: string;
  [key: string]: any;
}

export type ProfileStatus = 'pending' | 'active' | 'inactive' | 'rejected';

/** Pode acessar o sistema (autorizado por um admin). Perfis antigos sem status contam como ativos. */
export const hasApprovedAccess = (p: { status?: string | null } | null | undefined) =>
  !!p && ['active', 'inactive'].includes(p.status ?? 'active');

/** Domínios aceitos no cadastro (a mesma regra está no banco: supabase/acesso-autorizacao.sql). */
export const ALLOWED_EMAIL_DOMAINS = ['estacio.br', 'yduqs.com.br'];

export const isAllowedEmailDomain = (email: string) =>
  ALLOWED_EMAIL_DOMAINS.includes(email.trim().toLowerCase().split('@')[1] ?? '');

export interface Profile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar_url?: string;
  created_at: string;
  /** pending = aguarda autorização · rejected = acesso recusado/revogado · inactive = fora dos rankings. */
  status: ProfileStatus;
  approved_at?: string | null;
  approved_by?: string | null;
  phone?: string;
  target_monthly?: number; // meta mensal em quantidade de lançamentos
}

export interface CampaignField {
  id: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'date';
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
  start_date: string;
  end_date: string;
  fields: CampaignField[];
  created_by: string | null;
  created_at: string;
}

export interface Sale {
  id: string;
  campaign_id: string;
  campaign_name: string;
  seller_id: string;
  collaborator_id?: string;
  seller_name: string;
  collaborator_name?: string;
  seller_email: string;
  client_name: string;
  client_document?: string;
  client_phone?: string;
  client_email?: string;
  product_name: string;
  fdi?: string | ProductChannelFDI;
  sale_date?: string;
  custom_data?: SaleCustomData;
  notes?: string;
  created_at: string;
  /** Campos obrigatórios que a venda gravada não tem (vendas antigas). Só leitura, nunca gravado. */
  missing_fields?: Array<'opportunity' | 'candidate' | 'date' | 'seller' | 'product' | 'modality' | 'shift' | 'fdi'>;
}

export interface LeaderboardEntry {
  seller_id: string;
  name: string;
  email: string;
  avatar_url?: string;
  total_sales: number;
  target: number;
  target_graduacao?: number;
  target_pos?: number;
  target_tecnico?: number;
  target_total?: number;
  percentage_reached: number;
  position: number;
  rank_tier: 'Bronze' | 'Prata' | 'Ouro' | 'Diamante';
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

export type GoalType = 'semanal' | 'mensal' | 'week' | 'month';

export interface Goal {
  id: string;
  user_id: string;
  type: GoalType;
  target_bu_presencial?: number;
  target_bu_digital?: number;
  target_graduacao?: number;
  target_pos?: number;
  target_tecnico?: number;
  target_total?: number;
  reference_start?: string;
  reference_end?: string;
  created_at?: string;
  updated_at?: string;
  month?: number;
  year?: number;
  goal_period_id?: string | null;
}

export interface DatabaseGoalRecord {
  id?: string;
  user_id: string;
  type: GoalType;
  reference_start: string;
  reference_end: string;
  target_bu_presencial?: number;
  target_bu_digital?: number;
  target_graduacao?: number;
  target_pos?: number;
  target_tecnico?: number;
  target_total?: number;
  created_at?: string;
  updated_at?: string;
  month?: number;
  year?: number;
  goal_period_id?: string | null;
}

export interface UserGoalData {
  target_total: number;
  target_bu_presencial?: number;
  target_bu_digital?: number;
  target_graduacao: number;
  target_pos: number;
  target_tecnico: number;
}

export interface ConsultantGoalValues {
  id?: string;
  target_bu_presencial?: number;
  target_bu_digital?: number;
  target_graduacao: number;
  target_pos: number;
  target_tecnico: number;
  target_total: number;
}

export interface RemoteSaleRow {
  id?: string;
  collaborator_name?: string;
  candidate_name?: string;
  opportunity?: string;
  product?: string;
  turn?: string;
  modality?: string;
  fdi?: string | ProductChannelFDI;
  light_installment?: boolean;
  partner_scholarship?: boolean;
  notes?: string;
  sale_date?: string;
  campaign_id?: string;
  created_at?: string;
  updated_at?: string;
  seller_id?: string;
  collaborator_id?: string;
  seller_name?: string;
  seller_email?: string;
  client_name?: string;
  client_document?: string;
  client_phone?: string;
  client_email?: string;
  product_name?: string;
  custom_data?: SaleCustomData;
  user_name?: string;
  created_by_name?: string;
  fdi_channel?: string;
  channel?: string;
  canal?: string;
  [key: string]: unknown;
}
