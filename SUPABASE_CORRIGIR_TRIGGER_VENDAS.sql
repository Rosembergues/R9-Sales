-- Corrige o trigger de proteção de vendas. public.sales não possui collaborator_id.
-- A coluna real para autoria é seller_id. Não altera nem apaga vendas.
begin;
create or replace function public.protect_sale_owner_fields()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_profile_name text; v_profile_email text;
begin
  if auth.uid() is not null and not exists (
    select 1 from public.profiles where id::text = auth.uid()::text and role = 'admin'
  ) then
    if tg_op = 'INSERT' then
      if new.seller_id is distinct from auth.uid()::text then
        raise exception 'Consultores só podem cadastrar vendas em seu próprio nome';
      end if;
      select name, email into v_profile_name, v_profile_email
      from public.profiles where id::text = auth.uid()::text;
      new.seller_name := coalesce(v_profile_name, new.seller_name);
      new.collaborator_name := coalesce(v_profile_name, new.collaborator_name, new.seller_name);
      new.seller_email := coalesce(v_profile_email, new.seller_email);
    else
      if new.seller_id is distinct from old.seller_id
         or new.seller_name is distinct from old.seller_name
         or new.collaborator_name is distinct from old.collaborator_name
         or new.seller_email is distinct from old.seller_email then
        raise exception 'Apenas administradores podem alterar o vendedor da venda';
      end if;
    end if;
    new.custom_data := coalesce(new.custom_data, '{}'::jsonb) || jsonb_build_object(
      'seller_id', new.seller_id, 'collaborator_id', new.seller_id,
      'seller_name', new.seller_name, 'collaborator_name', new.collaborator_name,
      'seller_email', new.seller_email
    );
  end if;
  return new;
end;
$$;
commit;
