-- R9 Sales — hardening de permissões identificado na revisão técnica.
-- Executar no Supabase Dashboard > SQL Editor do projeto usado pelo R9 Sales.
-- Não apaga dados. Revise previamente políticas antigas adicionais (políticas RLS permissivas
-- são combinadas com OR; uma política ampla antiga pode anular uma política mais restritiva).

begin;

alter table public.profiles enable row level security;
alter table public.sales enable row level security;

-- Impede que um usuário autenticado promova o próprio perfil a administrador via REST.
create or replace function public.protect_profile_role_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null
     and not exists (
       select 1 from public.profiles
       where id::text = auth.uid()::text and role = 'admin'
     ) then
    raise exception 'Apenas administradores podem alterar o papel do usuário';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_role_changes on public.profiles;
create trigger protect_profile_role_changes
  before update on public.profiles
  for each row execute function public.protect_profile_role_changes();

-- Substitui a política antiga que permitia inserir vendas de qualquer responsável.
drop policy if exists "Usuários autenticados podem inserir vendas" on public.sales;
drop policy if exists "Usuários podem inserir vendas próprias ou admins" on public.sales;
create policy "Usuários podem inserir vendas próprias ou admins"
  on public.sales for insert
  with check (
    seller_id = auth.uid()::text
    or exists (
      select 1 from public.profiles
      where id::text = auth.uid()::text and role = 'admin'
    )
  );

-- Protege os campos de autoria tanto nas colunas normais como em custom_data.
-- O papel de administrador vem sempre de public.profiles, nunca de user_metadata do cliente.
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
  if auth.uid() is not null
     and not exists (
       select 1 from public.profiles
       where id::text = auth.uid()::text and role = 'admin'
     ) then
    if tg_op = 'INSERT' then
      if new.seller_id is distinct from auth.uid()::text
         or (new.collaborator_id is not null and new.collaborator_id is distinct from auth.uid()::text) then
        raise exception 'Consultores só podem cadastrar vendas em seu próprio nome';
      end if;

      select name, email into v_profile_name, v_profile_email
      from public.profiles where id::text = auth.uid()::text;

      new.seller_name := coalesce(v_profile_name, new.seller_name);
      new.collaborator_name := coalesce(v_profile_name, new.collaborator_name, new.seller_name);
      new.seller_email := coalesce(v_profile_email, new.seller_email);
    else
      if new.seller_id is distinct from old.seller_id
         or new.collaborator_id is distinct from old.collaborator_id
         or new.seller_name is distinct from old.seller_name
         or new.collaborator_name is distinct from old.collaborator_name
         or new.seller_email is distinct from old.seller_email then
        raise exception 'Apenas administradores podem alterar o vendedor da venda';
      end if;
    end if;

    new.custom_data := coalesce(new.custom_data, '{}'::jsonb) || jsonb_build_object(
      'seller_id', new.seller_id,
      'collaborator_id', new.collaborator_id,
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

commit;
