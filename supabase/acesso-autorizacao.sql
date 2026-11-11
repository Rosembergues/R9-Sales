-- =====================================================================
-- R9 Hub · Controle de acesso
--   1. Cadastro só com e-mail @estacio.br ou @yduqs.com.br
--   2. Usuário novo entra como "pending" e só acessa os dados depois que um admin autoriza
--
-- Rodar no Supabase: SQL Editor → colar tudo → Run. Pode rodar mais de uma vez.
-- Usuários que já existem continuam com o status atual (não perdem acesso).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Status de acesso no perfil
--    pending  = cadastrou e aguarda autorização
--    active   = autorizado
--    inactive = autorizado, mas fora dos rankings/listas de consultores (uso que já existia)
--    rejected = acesso recusado ou revogado
-- ---------------------------------------------------------------------
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.profiles'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.profiles drop constraint %I', c.conname);
  end loop;
end $$;

update public.profiles set status = 'active' where status is null;

alter table public.profiles
  add constraint profiles_status_check check (status in ('pending', 'active', 'inactive', 'rejected'));
alter table public.profiles alter column status set default 'pending';

alter table public.profiles add column if not exists approved_at timestamp with time zone;
alter table public.profiles add column if not exists approved_by uuid;

-- ---------------------------------------------------------------------
-- 2. Funções de apoio (SECURITY DEFINER para não cair em recursão no RLS de profiles)
-- ---------------------------------------------------------------------
create or replace function public.is_admin_user()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id::text = auth.uid()::text and role = 'admin' and coalesce(status, 'active') in ('active', 'inactive')
  );
$$;

create or replace function public.is_approved_user()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id::text = auth.uid()::text and coalesce(status, 'active') in ('active', 'inactive')
  );
$$;

-- ---------------------------------------------------------------------
-- 3. Cadastro só com domínio corporativo (vale também para o app, a API e o painel)
-- ---------------------------------------------------------------------
create or replace function public.enforce_corporate_email_domain()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.email is null
     or lower(split_part(new.email, '@', 2)) not in ('estacio.br', 'yduqs.com.br') then
    raise exception 'Cadastro permitido apenas para e-mails @estacio.br ou @yduqs.com.br'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_corporate_email_domain on auth.users;
create trigger enforce_corporate_email_domain
  before insert or update of email on auth.users
  for each row execute function public.enforce_corporate_email_domain();

-- ---------------------------------------------------------------------
-- 4. Perfil novo nasce "pending" (exceto quando um admin cria pelo app)
-- ---------------------------------------------------------------------
create or replace function public.set_new_profile_pending()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin_user() then
    new.status := 'pending';
    new.role := 'seller';
    new.approved_at := null;
    new.approved_by := null;
  end if;
  return new;
end;
$$;

drop trigger if exists set_new_profile_pending on public.profiles;
create trigger set_new_profile_pending
  before insert on public.profiles
  for each row execute function public.set_new_profile_pending();

-- ---------------------------------------------------------------------
-- 5. Só admin muda status (o usuário não consegue se autoaprovar)
-- ---------------------------------------------------------------------
create or replace function public.protect_profile_status_changes()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if (new.status is distinct from old.status
      or new.approved_at is distinct from old.approved_at
      or new.approved_by is distinct from old.approved_by)
     and auth.uid() is not null
     and not public.is_admin_user() then
    raise exception 'Apenas administradores podem autorizar ou bloquear acessos';
  end if;
  if new.status = 'active' and old.status is distinct from 'active' and new.approved_at is null then
    new.approved_at := timezone('utc'::text, now());
    new.approved_by := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_status_changes on public.profiles;
create trigger protect_profile_status_changes
  before update on public.profiles
  for each row execute function public.protect_profile_status_changes();

-- ---------------------------------------------------------------------
-- 6. Trava geral: política RESTRITIVA em TODAS as tabelas do schema public.
--    Políticas restritivas somam-se (AND) às que já existem, então nenhuma regra
--    atual é afrouxada: quem não está autorizado simplesmente não lê nem grava nada.
--    Em profiles, o usuário pendente ainda enxerga a própria linha (para ver o status).
-- ---------------------------------------------------------------------
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('drop policy if exists "Somente usuários autorizados" on public.%I', t.tablename);
    if t.tablename = 'profiles' then
      execute format(
        'create policy "Somente usuários autorizados" on public.%I as restrictive for all to anon, authenticated
           using (public.is_approved_user() or id::text = auth.uid()::text)
           with check (public.is_approved_user() or id::text = auth.uid()::text)',
        t.tablename);
    else
      execute format(
        'create policy "Somente usuários autorizados" on public.%I as restrictive for all to anon, authenticated
           using (public.is_approved_user())
           with check (public.is_approved_user())',
        t.tablename);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 7. Conferência: tabelas SEM RLS ligado ficam abertas mesmo com a trava acima.
--    Se esta consulta listar alguma tabela, me avise antes de ligar o RLS nela.
-- ---------------------------------------------------------------------
select tablename as tabela_sem_rls
from pg_tables
where schemaname = 'public' and rowsecurity = false
order by 1;
