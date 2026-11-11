-- =====================================================================
-- R9 Hub · Proteções da Gestão de Equipe
--
-- 1. Só administradores mudam a função (admin/consultor) de alguém.
--    Antes, a regra de update de profiles deixava o próprio usuário editar a
--    sua linha inteira, inclusive a coluna role.
-- 2. O sistema nunca fica sem administrador: o último admin com acesso não
--    pode ser rebaixado, bloqueado nem excluído.
-- 3. Ninguém bloqueia o próprio acesso.
--
-- Editar o nome continua liberado para o admin (e para a própria pessoa).
--
-- Rodar no Supabase: SQL Editor → colar tudo → Run. Pode rodar mais de uma vez.
-- =====================================================================

create or replace function public.protect_profile_role_changes()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  outros_admins integer;
  perde_admin boolean;
begin
  -- Rotinas internas (SQL Editor / service role) não têm auth.uid(): passam direto.
  if auth.uid() is null then
    return new;
  end if;

  if new.role is distinct from old.role and not public.is_admin_user() then
    raise exception 'Apenas administradores podem mudar a função de um usuário';
  end if;

  if old.id = auth.uid()
     and new.status is distinct from old.status
     and new.status in ('pending', 'rejected') then
    raise exception 'Você não pode bloquear o seu próprio acesso';
  end if;

  perde_admin := old.role = 'admin'
    and old.status in ('active', 'inactive')
    and (new.role <> 'admin' or new.status not in ('active', 'inactive'));

  if perde_admin then
    select count(*) into outros_admins
    from public.profiles
    where role = 'admin' and status in ('active', 'inactive') and id <> old.id;
    if outros_admins = 0 then
      raise exception 'Este é o último administrador. Promova outra pessoa a admin antes.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists protect_profile_role_changes on public.profiles;
create trigger protect_profile_role_changes
  before update on public.profiles
  for each row execute function public.protect_profile_role_changes();

create or replace function public.protect_last_admin_delete()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is not null
     and old.role = 'admin'
     and old.status in ('active', 'inactive')
     and not exists (
       select 1 from public.profiles
       where role = 'admin' and status in ('active', 'inactive') and id <> old.id
     ) then
    raise exception 'Este é o último administrador e não pode ser excluído.';
  end if;
  return old;
end;
$$;

drop trigger if exists protect_last_admin_delete on public.profiles;
create trigger protect_last_admin_delete
  before delete on public.profiles
  for each row execute function public.protect_last_admin_delete();

-- Conferência: deve listar pelo menos um administrador com acesso.
select name, email, role, status from public.profiles where role = 'admin' order by name;
