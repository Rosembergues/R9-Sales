import { SupabaseClient } from '@supabase/supabase-js';
import { Profile, Campaign, Sale, Goal } from '../types';
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
const LOCAL_PENDING_SALES_KEY = 'salesflow_pending_sales_v1';
const LOCAL_CURRENT_USER_KEY = 'salesflow_current_user_v4';
const LOCAL_GOALS_KEY = 'salesflow_goals_v1';

export const INITIAL_CAMPAIGNS: Campaign[] = [];

function stripLegacyFinancialFields<T extends Record<string, unknown>>(record: T): T {
  const cleaned = { ...record };
  delete cleaned.value;
  delete cleaned.target_amount;
  delete cleaned.target_value;
  delete cleaned.total_value;
  delete cleaned.payment_method;
  return cleaned;
}



// Supabase SQL Setup Script for user convenience
export const SUPABASE_SQL_SCHEMA = `-- ============================================================
-- SCHEMA OFICIAL SUPABASE PARA R9 SALES (GESTÃO DE VENDAS)
-- Execute este script no SQL Editor do seu Dashboard Supabase:
-- https://supabase.com/dashboard/project/_/sql
-- ============================================================

-- 1. Habilitar extensões
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- 2. Tabela de Perfis de Usuários (Profiles)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  name text not null,
  email text not null,
  role text not null check (role in ('admin', 'seller')),
  avatar_url text,
  phone text,
  status text default 'active' check (status in ('active', 'inactive')),
  target_monthly numeric default 30,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Tabela de Metas por Produto (Goals)
create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  type text not null check (type in ('month', 'week', 'mensal', 'semanal')),
  reference_start date not null,
  reference_end date not null,
  target_graduacao integer default 0 check (target_graduacao >= 0),
  target_pos integer default 0 check (target_pos >= 0),
  target_tecnico integer default 0 check (target_tecnico >= 0),
  target_total integer default 0 check (target_total >= 0),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint goals_user_type_ref_unique unique (user_id, type, reference_start)
);

-- 4. Tabela de Campanhas e Formulários Dinâmicos (Campaigns)
create table if not exists public.campaigns (
  id text primary key default ('camp-' || substr(md5(random()::text), 1, 10)),
  title text not null,
  description text,
  code text unique not null,
  active boolean default true,
  start_date date not null,
  end_date date not null,
  fields jsonb default '[]'::jsonb,
  created_by uuid references public.profiles(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null default timezone('utc'::text, now())
);

-- 5. Tabela de Vendas e Lançamentos (Sales)
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
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null default timezone('utc'::text, now()),
  -- Colunas complementares opcionais para compatibilidade total
  seller_id text,
  collaborator_id text,
  seller_name text,
  seller_email text,
  client_name text,
  client_document text,
  client_phone text,
  client_email text,
  product_name text,
  custom_data jsonb default '{}'::jsonb
);

-- Campos canônicos usados pelo aplicativo:
-- seller_id = identificador do responsável; seller_name/email são snapshots históricos.
-- client_name/product_name são os campos canônicos da venda.
-- custom_data permanece reservado para dados específicos de campanhas/compatibilidade.


-- 6. Habilitar Row Level Security (RLS) nas Tabelas Críticas
alter table public.profiles enable row level security;
alter table public.goals enable row level security;
alter table public.sales enable row level security;
alter table public.campaigns enable row level security;

-- ============================================================
-- POLÍTICAS RLS (Row Level Security)
-- ============================================================

-- Políticas para Profiles
drop policy if exists "Perfis são visíveis por todos os autenticados" on public.profiles;
create policy "Perfis são visíveis por todos os autenticados" 
  on public.profiles for select 
  using (auth.role() = 'authenticated');

drop policy if exists "Usuários podem atualizar seus próprios perfis ou admins podem atualizar qualquer perfil" on public.profiles;
create policy "Usuários podem atualizar seus próprios perfis ou admins podem atualizar qualquer perfil" 
  on public.profiles for update 
  using (
    auth.uid() = id or 
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Perfis são criados exclusivamente pelo trigger handle_new_user (SECURITY DEFINER)
-- ou por uma operação administrativa autenticada. Não permitir INSERT público.
drop policy if exists "Admins ou registro público podem inserir perfis" on public.profiles;
drop policy if exists "Admins podem inserir perfis" on public.profiles;
create policy "Admins podem inserir perfis"
  on public.profiles for insert
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

drop policy if exists "Apenas admins podem excluir perfis" on public.profiles;
create policy "Apenas admins podem excluir perfis" 
  on public.profiles for delete 
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Políticas para Goals (Metas)
-- Leitura pública para autenticados (consultores e admins visualizam metas e ranking)
-- Escrita EXCLUSIVA para Administradores
drop policy if exists "Metas visíveis por todos os autenticados" on public.goals;
create policy "Metas visíveis por todos os autenticados" 
  on public.goals for select 
  using (auth.role() = 'authenticated');

drop policy if exists "Apenas administradores podem gerenciar metas" on public.goals;
create policy "Apenas administradores podem gerenciar metas" 
  on public.goals for all 
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Políticas para Sales (Vendas)
-- Leitura para todos os autenticados
-- Inserção para consultores e admins
-- Atualização/Exclusão restrita a administradores ou autor da venda
drop policy if exists "Leitura de vendas permitida" on public.sales;
create policy "Leitura de vendas permitida" 
  on public.sales for select 
  using (auth.role() = 'authenticated');

drop policy if exists "Usuários autenticados podem inserir vendas" on public.sales;
create policy "Usuários autenticados podem inserir vendas" 
  on public.sales for insert 
  with check (auth.role() = 'authenticated');

drop policy if exists "Admins ou autor podem atualizar vendas" on public.sales;
create policy "Admins ou autor podem atualizar vendas" 
  on public.sales for update 
  using (
    seller_id = auth.uid()::text or 
    collaborator_id = auth.uid()::text or 
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

drop policy if exists "Apenas administradores podem excluir vendas" on public.sales;
create policy "Apenas administradores podem excluir vendas" 
  on public.sales for delete 
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Políticas para Campaigns
drop policy if exists "Campanhas visíveis por todos os autenticados" on public.campaigns;
create policy "Campanhas visíveis por todos os autenticados" 
  on public.campaigns for select 
  using (auth.role() = 'authenticated');

drop policy if exists "Admins podem criar, editar ou excluir campanhas" on public.campaigns;
create policy "Admins podem criar, editar ou excluir campanhas" 
  on public.campaigns for all 
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- ============================================================
-- 6.1 Índices para consultas operacionais e paginação
-- Mantém filtros/ordenação rápidos sem alterar o contrato atual da aplicação.
create index if not exists idx_sales_created_at_desc on public.sales (created_at desc);
create index if not exists idx_sales_sale_date_desc on public.sales (sale_date desc);
create index if not exists idx_sales_seller_id on public.sales (seller_id);
create index if not exists idx_sales_collaborator_id on public.sales (collaborator_id);
create index if not exists idx_sales_campaign_id on public.sales (campaign_id);
create index if not exists idx_sales_product_name on public.sales (product_name);
create index if not exists idx_sales_fdi on public.sales (fdi);

-- 7. Função e Triggers de auditoria updated_at
-- ============================================================
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.handle_updated_at();

drop trigger if exists set_goals_updated_at on public.goals;
create trigger set_goals_updated_at
  before update on public.goals
  for each row execute procedure public.handle_updated_at();

drop trigger if exists set_sales_updated_at on public.sales;
create trigger set_sales_updated_at
  before update on public.sales
  for each row execute procedure public.handle_updated_at();

-- ============================================================
-- 8. Trigger automático de criação de perfil ao cadastrar no Supabase Auth
-- ============================================================
create or replace function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.profiles (id, name, email, role, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    'seller',
    'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- 9. Habilitar Supabase Realtime para tabelas críticas
-- ============================================================
do $$
begin
  alter publication supabase_realtime add table public.profiles;
exception when others then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.goals;
exception when others then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.campaigns;
exception when others then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.sales;
exception when others then null;
end $$;

-- 10. Migração de Dados Históricos (Garante responsável preenchido em registros legados)
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

-- Sincroniza a coluna canônica sale_date com a data real armazenada em custom_data
-- em registros históricos criados antes da persistência correta de sale_date.
update public.sales
set sale_date = case
  when custom_data->>'sale_date' ~ '^\\d{1,2}/\\d{1,2}/\\d{4}$'
    then to_date(custom_data->>'sale_date', 'DD/MM/YYYY')::timestamp with time zone
  when custom_data->>'sale_date' ~ '^\\d{4}-\\d{2}-\\d{2}$'
    then (custom_data->>'sale_date')::date::timestamp with time zone
  else sale_date
end
where custom_data ? 'sale_date'
  and nullif(custom_data->>'sale_date', '') is not null;
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
          return parsed.map((sale) => stripLegacyFinancialFields(sale));
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
      localStorage.setItem(LOCAL_SALES_KEY, JSON.stringify(sales.map((sale) => stripLegacyFinancialFields(sale as unknown as Record<string, unknown>))));
    } catch (e) {
      console.error('Failed to save sales locally', e);
    }
  }

  // Fila offline: o Supabase continua sendo a fonte oficial; somente vendas
  // que ainda não foram confirmadas no servidor ficam nesta fila temporária.
  static getPendingSales(): Sale[] {
    try {
      const stored = localStorage.getItem(LOCAL_PENDING_SALES_KEY);
      const parsed = stored ? JSON.parse(stored) : [];
      return Array.isArray(parsed) ? parsed.map((sale) => stripLegacyFinancialFields(sale)) : [];
    } catch {
      return [];
    }
  }

  static savePendingSales(sales: Sale[]) {
    try {
      localStorage.setItem(LOCAL_PENDING_SALES_KEY, JSON.stringify(sales.map((sale) => stripLegacyFinancialFields(sale as unknown as Record<string, unknown>))));
    } catch (e) {
      console.error('Failed to save pending sales locally', e);
    }
  }

  static clearPendingSale(saleId: string) {
    const pending = this.getPendingSales().filter(s => s.id !== saleId);
    this.savePendingSales(pending);
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

  static getGoals(): Goal[] {
    try {
      const stored = localStorage.getItem(LOCAL_GOALS_KEY);
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

  static saveGoals(goals: Goal[]) {
    try {
      // Deduplica por (user_id, type, reference_start) para garantir integridade idêntica ao Supabase
      const uniqueMap = new Map<string, Goal>();
      goals.forEach(g => {
        const key = `${g.user_id}_${g.type}_${g.reference_start || ''}`;
        uniqueMap.set(key, g);
      });
      const deduplicated = Array.from(uniqueMap.values());
      localStorage.setItem(LOCAL_GOALS_KEY, JSON.stringify(deduplicated));
    } catch (e) {
      console.error('Failed to save goals locally', e);
    }
  }
}
