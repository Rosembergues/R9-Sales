-- =====================================================================
-- R9 Sales · Ajustes de vendas
-- Rodar no Supabase: SQL Editor → colar tudo → Run. Pode rodar mais de uma vez.
-- =====================================================================

-- 1. Colunas que o aplicativo grava (formato único). Cria só as que faltarem.
alter table public.sales add column if not exists seller_id text;
alter table public.sales add column if not exists seller_name text;
alter table public.sales add column if not exists seller_email text;
alter table public.sales add column if not exists collaborator_name text;
alter table public.sales add column if not exists candidate_name text;
alter table public.sales add column if not exists client_name text;
alter table public.sales add column if not exists client_document text;
alter table public.sales add column if not exists opportunity text;
alter table public.sales add column if not exists product text;
alter table public.sales add column if not exists product_name text;
alter table public.sales add column if not exists turn text;
alter table public.sales add column if not exists modality text;
alter table public.sales add column if not exists fdi text default 'Simplificada';
alter table public.sales add column if not exists light_installment boolean default false;
alter table public.sales add column if not exists partner_scholarship boolean default false;
alter table public.sales add column if not exists notes text;
alter table public.sales add column if not exists sale_date timestamp with time zone default timezone('utc'::text, now());
alter table public.sales add column if not exists campaign_id text;
alter table public.sales add column if not exists custom_data jsonb default '{}'::jsonb;

-- 2. Consultor pode lançar venda para outro consultor.
--    Quem pode EDITAR/EXCLUIR continua sendo só o dono da venda (seller_id) ou um admin,
--    então quem lançou para outro não consegue editar depois.
drop policy if exists "Usuários podem inserir vendas próprias ou admins" on public.sales;
drop policy if exists "Autenticados podem inserir vendas" on public.sales;
create policy "Autenticados podem inserir vendas"
  on public.sales for insert
  with check (auth.role() = 'authenticated');

create or replace function public.protect_sale_owner_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_name text;
  v_profile_email text;
begin
  -- service_role/SQL administrativo (auth.uid() nulo) não passa por estas regras.
  if auth.uid() is not null
     and not exists (select 1 from public.profiles where id::text = auth.uid()::text and role = 'admin') then
    if tg_op = 'INSERT' then
      -- O dono da venda precisa ser um consultor cadastrado; nome e e-mail vêm do cadastro dele.
      select name, email into v_profile_name, v_profile_email
      from public.profiles where id::text = new.seller_id;
      if v_profile_name is null then
        raise exception 'Consultor da venda não encontrado no cadastro';
      end if;
      new.seller_name := v_profile_name;
      new.collaborator_name := v_profile_name;
      new.seller_email := v_profile_email;
      -- Registra quem lançou (pode ser diferente do dono).
      new.custom_data := coalesce(new.custom_data, '{}'::jsonb)
        || jsonb_build_object('registered_by', auth.uid()::text);
    else
      if new.seller_id is distinct from old.seller_id
         or new.seller_name is distinct from old.seller_name
         or new.collaborator_name is distinct from old.collaborator_name
         or new.seller_email is distinct from old.seller_email then
        raise exception 'Apenas administradores podem alterar o vendedor da venda';
      end if;
      -- Quem lançou nunca muda.
      new.custom_data := coalesce(new.custom_data, '{}'::jsonb)
        || jsonb_build_object('registered_by', old.custom_data->>'registered_by');
    end if;

    -- Campos espelhados no JSON acompanham as colunas oficiais.
    new.custom_data := coalesce(new.custom_data, '{}'::jsonb) || jsonb_build_object(
      'seller_id', new.seller_id,
      'collaborator_id', new.seller_id,
      'seller_name', new.seller_name,
      'collaborator_name', new.collaborator_name,
      'seller_email', new.seller_email
    );
  end if;
  return new;
end;
$$;

drop trigger if exists protect_sale_owner_fields on public.sales;
create trigger protect_sale_owner_fields
  before insert or update on public.sales
  for each row execute function public.protect_sale_owner_fields();

-- 3. Corrige vendas antigas
-- 3.1 BU: Pós e Técnico tinham sido gravados como "BU Presencial".
update public.sales
set custom_data = coalesce(custom_data, '{}'::jsonb) || jsonb_build_object('business_unit',
  case
    when coalesce(product, custom_data->>'main_product', product_name, '') ilike 'p_s%' then 'Pós-Graduação'
    when coalesce(product, custom_data->>'main_product', product_name, '') ilike '%t%cnico%'
      or coalesce(modality, custom_data->>'modality', '') ilike '%t%cnico%' then 'Curso Técnico'
    when upper(coalesce(modality, custom_data->>'modality', '')) in ('EAD', 'FLEX', 'DLEX') then 'BU Digital'
    else 'BU Presencial'
  end)
where custom_data is not null;

-- 3.2 Produto: "Graduação - Presencial (Noite)" vira só "Graduação"
--     (modalidade e turno já ficam nas colunas modality e turn).
update public.sales
set product_name = coalesce(nullif(product, ''), custom_data->>'main_product', split_part(product_name, ' - ', 1))
where product_name like '% - %';
