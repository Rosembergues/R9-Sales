import { SupabaseClient } from '@supabase/supabase-js';
import { Profile, Campaign, Sale } from '../types';
import { 
  supabase, 
  getSupabaseClient, 
  setSupabaseCredentials, 
  isSupabaseConfigured,
  SUPABASE_CONFIG_KEY 
} from '../supabase';

// Re-export shared Supabase client and helpers
export { supabase, getSupabaseClient, setSupabaseCredentials, isSupabaseConfigured, SUPABASE_CONFIG_KEY };

// Storage keys
const LOCAL_PROFILES_KEY = 'salesflow_profiles_v4';
const LOCAL_CAMPAIGNS_KEY = 'salesflow_campaigns_v1';
const LOCAL_SALES_KEY = 'salesflow_sales_v3';
const LOCAL_CURRENT_USER_KEY = 'salesflow_current_user_v4';

export const INITIAL_CAMPAIGNS: Campaign[] = [
  {
    id: 'camp-q1-2026',
    title: 'Campanha Acelera Vendas Q1',
    description: 'Campanha de expansão comercial com bônus de 5% sobre faturamento de soluções corporativas.',
    code: 'ACELERA-Q1',
    active: true,
    commission_rate: 5.0,
    target_amount: 250000,
    start_date: '2026-01-01',
    end_date: '2026-03-31',
    created_by: '',
    created_at: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString(),
    fields: [
      {
        id: 'f_client_cnpj',
        label: 'CNPJ / CPF da Empresa',
        type: 'text',
        required: true,
        placeholder: '00.000.000/0001-00',
      },
      {
        id: 'f_plan_type',
        label: 'Plano / Solução Contratada',
        type: 'select',
        required: true,
        options: ['Plano Enterprise Anual', 'Plano Growth Semestral', 'Consultoria e Implantação', 'Licenciamento SaaS Cloud'],
      },
      {
        id: 'f_installments',
        label: 'Número de Parcelas',
        type: 'select',
        required: false,
        options: ['À Vista', '2x', '3x', '6x', '12x'],
      }
    ]
  },
  {
    id: 'camp-saas-enterprise',
    title: 'Campanha Novos Clientes Cloud & IA',
    description: 'Foco em aquisição de novas contas para a plataforma de Inteligência e Automação de Processos.',
    code: 'CLOUD-IA-2026',
    active: true,
    commission_rate: 6.5,
    target_amount: 180000,
    start_date: '2026-02-01',
    end_date: '2026-04-30',
    created_by: '',
    created_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    fields: [
      {
        id: 'f_tech_lead',
        label: 'Canal de Origem do Lead',
        type: 'select',
        required: true,
        options: ['Inbound / Site', 'Outbound / Prospecção', 'Indicação / Parceiro', 'Evento Presencial'],
      },
      {
        id: 'f_contract_duration',
        label: 'Duração do Contrato',
        type: 'select',
        required: true,
        options: ['12 Meses', '24 Meses (Fidelidade)', '36 Meses (Enterprise VIP)'],
      }
    ]
  }
];

export const INITIAL_SALES: Sale[] = [];

// Supabase SQL Setup Script for user convenience
export const SUPABASE_SQL_SCHEMA = `-- ============================================================
-- SCHEMA OFICIAL SUPABASE PARA R9 SALES (GESTÃO DE VENDAS)
-- Execute este script no SQL Editor do seu Dashboard Supabase:
-- https://supabase.com/dashboard/project/_/sql
-- ============================================================

-- 1. Habilitar extensões
create extension if not exists "uuid-ossp";

-- 2. Tabela de Perfis de Usuários (Profiles)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  name text not null,
  email text not null,
  role text not null check (role in ('admin', 'seller')),
  avatar_url text,
  phone text,
  status text default 'active' check (status in ('active', 'inactive')),
  target_monthly numeric default 50000,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Tabela de Campanhas e Formulários Dinâmicos (Campaigns)
create table if not exists public.campaigns (
  id text primary key default ('camp-' || substr(md5(random()::text), 1, 10)),
  title text not null,
  description text,
  code text unique not null,
  active boolean default true,
  commission_rate numeric default 5.0,
  target_amount numeric default 100000,
  start_date date not null,
  end_date date not null,
  fields jsonb default '[]'::jsonb,
  created_by uuid references public.profiles(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Tabela de Vendas e Lançamentos (Sales)
create table if not exists public.sales (
  id text primary key,
  collaborator_name text,
  candidate_name text,
  opportunity text,
  product text,
  turn text,
  modality text,
  fdi text default 'Simplificada', -- Canal de captação FDI gravado como TEXT ('Simplificada', 'Vestibular', 'MSV', 'ENEM', etc.)
  light_installment boolean default false,
  partner_scholarship boolean default false,
  notes text,
  sale_date timestamp with time zone default timezone('utc'::text, now()),
  campaign_id text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  -- Colunas complementares opcionais para compatibilidade total
  seller_id text,
  seller_name text,
  seller_email text,
  client_name text,
  product_name text,
  value numeric default 1200,
  payment_method text default 'PIX',
  status text default 'Aprovada',
  commission numeric default 60,
  custom_data jsonb default '{}'::jsonb
);

-- 5. Habilitar Row Level Security (RLS)
alter table public.profiles enable row level security;
alter table public.campaigns enable row level security;
alter table public.sales enable row level security;

-- Políticas para Sales
drop policy if exists "Leitura de vendas permitida" on public.sales;
create policy "Leitura de vendas permitida" 
  on public.sales for select 
  using (true);

drop policy if exists "Gravação de vendas permitida" on public.sales;
create policy "Gravação de vendas permitida" 
  on public.sales for all 
  using (true)
  with check (true);

-- Políticas para Profiles
create policy "Perfis são visíveis por todos os autenticados" 
  on public.profiles for select 
  using (auth.role() = 'authenticated');

create policy "Usuários podem atualizar seus próprios perfis ou admins podem atualizar qualquer perfil" 
  on public.profiles for update 
  using (
    auth.uid() = id or 
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins ou registro público podem inserir perfis" 
  on public.profiles for insert 
  with check (true);

-- Políticas para Campaigns
create policy "Campanhas visíveis por todos os autenticados" 
  on public.campaigns for select 
  using (auth.role() = 'authenticated');

create policy "Admins podem criar, editar ou excluir campanhas" 
  on public.campaigns for all 
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- 6. Trigger automático para criar perfil ao criar usuário via Supabase Auth
create or replace function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.profiles (id, name, email, role, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'seller'),
    'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Habilitar Realtime
alter publication supabase_realtime add table public.profiles;
alter publication supabase_realtime add table public.campaigns;
alter publication supabase_realtime add table public.sales;

-- 7. Migração de Dados Históricos (Garante responsável preenchido em registros legados)
update public.sales s
set 
  collaborator_name = coalesce(
    nullif(s.collaborator_name, ''),
    nullif(s.seller_name, ''),
    p.name,
    'Consultor R9'
  ),
  seller_name = coalesce(
    nullif(s.seller_name, ''),
    nullif(s.collaborator_name, ''),
    p.name,
    'Consultor R9'
  )
from public.profiles p
where (s.seller_id = p.id::text or s.seller_id = cast(p.id as text))
  and (s.collaborator_name is null or s.collaborator_name = '' or s.seller_name is null or s.seller_name = '');

update public.sales
set 
  collaborator_name = coalesce(nullif(collaborator_name, ''), nullif(seller_name, ''), 'Consultor R9'),
  seller_name = coalesce(nullif(seller_name, ''), nullif(collaborator_name, ''), 'Consultor R9')
where collaborator_name is null or collaborator_name = '' or seller_name is null or seller_name = '';
`;

// Local Storage Sync Engine for seamless, 100% resilient operation
export class LocalSyncEngine {
  private static purged = false;
  private static ensurePurged() {
    if (this.purged) return;
    try {
      // Limpa dados legados de demonstração anteriores
      localStorage.removeItem('salesflow_sales_v1');
      localStorage.removeItem('salesflow_sales_v2');
      localStorage.removeItem('salesflow_profiles_v1');
      localStorage.removeItem('salesflow_profiles_v2');
      localStorage.removeItem('salesflow_profiles_v3');
      localStorage.removeItem('salesflow_current_user_v1');
      localStorage.removeItem('salesflow_current_user_v2');
      localStorage.removeItem('salesflow_current_user_v3');
      this.purged = true;
    } catch {
      this.purged = true;
    }
  }

  static getProfiles(): Profile[] {
    this.ensurePurged();
    try {
      const stored = localStorage.getItem(LOCAL_PROFILES_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
      return [];
    } catch {
      return [];
    }
  }

  static saveProfiles(profiles: Profile[]) {
    try {
      localStorage.setItem(LOCAL_PROFILES_KEY, JSON.stringify(profiles));
    } catch (e) {
      console.error('Failed to save profiles locally', e);
    }
  }

  static getCampaigns(): Campaign[] {
    try {
      const stored = localStorage.getItem(LOCAL_CAMPAIGNS_KEY);
      if (stored) return JSON.parse(stored);
      localStorage.setItem(LOCAL_CAMPAIGNS_KEY, JSON.stringify(INITIAL_CAMPAIGNS));
      return INITIAL_CAMPAIGNS;
    } catch {
      return INITIAL_CAMPAIGNS;
    }
  }

  static saveCampaigns(campaigns: Campaign[]) {
    try {
      localStorage.setItem(LOCAL_CAMPAIGNS_KEY, JSON.stringify(campaigns));
    } catch (e) {
      console.error('Failed to save campaigns locally', e);
    }
  }

  static getSales(): Sale[] {
    this.ensurePurged();
    try {
      const stored = localStorage.getItem(LOCAL_SALES_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
      return [];
    } catch {
      return [];
    }
  }

  static saveSales(sales: Sale[]) {
    try {
      localStorage.setItem(LOCAL_SALES_KEY, JSON.stringify(sales));
    } catch (e) {
      console.error('Failed to save sales locally', e);
    }
  }

  static getCurrentUser(): Profile | null {
    this.ensurePurged();
    try {
      const stored = localStorage.getItem(LOCAL_CURRENT_USER_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.id && parsed.email) {
          return parsed;
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  static setCurrentUser(profile: Profile | null) {
    try {
      if (profile) {
        localStorage.setItem(LOCAL_CURRENT_USER_KEY, JSON.stringify(profile));
      } else {
        localStorage.removeItem(LOCAL_CURRENT_USER_KEY);
      }
    } catch (e) {
      console.error('Failed to save current user', e);
    }
  }

  static clearAllSales() {
    try {
      localStorage.setItem(LOCAL_SALES_KEY, JSON.stringify([]));
    } catch (e) {
      console.error('Failed to clear sales locally', e);
    }
  }

  static resetUsersToAdminOnly() {
    try {
      localStorage.removeItem(LOCAL_PROFILES_KEY);
      localStorage.removeItem(LOCAL_CURRENT_USER_KEY);
    } catch (e) {
      console.error('Failed to reset profiles locally', e);
    }
  }
}
