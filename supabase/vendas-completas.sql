-- =====================================================================
-- R9 Hub · Toda venda com o formulário completo
--
-- 1. Copia para as colunas oficiais os dados que vendas antigas só tinham
--    dentro de custom_data (não inventa nada: só usa o que já estava gravado).
-- 2. Trava: venda NOVA sem oportunidade, aluno, data, consultor, produto,
--    modalidade, turno ou FDI é recusada pelo banco.
--    Vendas antigas não são bloqueadas; elas aparecem como "Falta preencher"
--    na tela de Vendas para serem completadas pela edição.
-- 3. Mostra quantas vendas ainda estão incompletas, por campo.
--
-- Rodar no Supabase: SQL Editor → colar tudo → Run. Pode rodar mais de uma vez.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Colunas oficiais a partir do custom_data
-- ---------------------------------------------------------------------
create or replace function public.r9_vazio(p text) returns boolean
language sql immutable as $$
  select p is null or trim(p) = '' or lower(trim(p)) in ('null', 'undefined')
$$;

create or replace function public.r9_fdi_invalido(p text) returns boolean
language sql immutable as $$
  select public.r9_vazio(p) or lower(trim(p)) in ('true', 'false', 't', 'f', 'sim', 'nao', 'não')
$$;

update public.sales set opportunity = custom_data->>'opportunity_number'
where public.r9_vazio(opportunity) and not public.r9_vazio(custom_data->>'opportunity_number');

update public.sales set client_name = custom_data->>'candidate_name'
where public.r9_vazio(client_name) and not public.r9_vazio(custom_data->>'candidate_name');

update public.sales set product = coalesce(nullif(trim(product_name), ''), custom_data->>'main_product')
where public.r9_vazio(product)
  and not public.r9_vazio(coalesce(nullif(trim(product_name), ''), custom_data->>'main_product'));

update public.sales set modality = custom_data->>'modality'
where public.r9_vazio(modality) and not public.r9_vazio(custom_data->>'modality');

update public.sales set turn = custom_data->>'shift'
where public.r9_vazio(turn) and not public.r9_vazio(custom_data->>'shift');

update public.sales set fdi = coalesce(
    case when public.r9_fdi_invalido(custom_data->>'fdi') then null else custom_data->>'fdi' end,
    case when public.r9_fdi_invalido(custom_data->>'fdi_channel') then null else custom_data->>'fdi_channel' end)
where public.r9_fdi_invalido(fdi)
  and (not public.r9_fdi_invalido(custom_data->>'fdi') or not public.r9_fdi_invalido(custom_data->>'fdi_channel'));

update public.sales set seller_id = coalesce(
    nullif(trim(custom_data->>'seller_id'), ''), nullif(trim(custom_data->>'collaborator_id'), ''))
where public.r9_vazio(seller_id::text)
  and coalesce(nullif(trim(custom_data->>'seller_id'), ''), nullif(trim(custom_data->>'collaborator_id'), '')) is not null;

-- ---------------------------------------------------------------------
-- 2. Trava para vendas novas
-- ---------------------------------------------------------------------
create or replace function public.require_complete_sale()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  faltando text[] := '{}';
begin
  if public.r9_vazio(new.opportunity) then faltando := array_append(faltando, 'oportunidade'); end if;
  if public.r9_vazio(coalesce(new.client_name, new.candidate_name)) then faltando := array_append(faltando, 'aluno'); end if;
  if new.sale_date is null then faltando := array_append(faltando, 'data'); end if;
  if public.r9_vazio(new.seller_id::text) then faltando := array_append(faltando, 'consultor'); end if;
  if public.r9_vazio(coalesce(new.product, new.product_name)) then faltando := array_append(faltando, 'produto'); end if;
  if public.r9_vazio(new.modality) then faltando := array_append(faltando, 'modalidade'); end if;
  if public.r9_vazio(new.turn) then faltando := array_append(faltando, 'turno'); end if;
  if public.r9_fdi_invalido(new.fdi) then faltando := array_append(faltando, 'FDI'); end if;

  if array_length(faltando, 1) > 0 then
    raise exception 'Venda incompleta: falta %', array_to_string(faltando, ', ');
  end if;
  return new;
end;
$$;

drop trigger if exists require_complete_sale on public.sales;
create trigger require_complete_sale
  before insert on public.sales
  for each row execute function public.require_complete_sale();

-- ---------------------------------------------------------------------
-- 3. Conferência: vendas ainda incompletas, por campo
-- ---------------------------------------------------------------------
select 'oportunidade' as campo, count(*) as vendas from public.sales where public.r9_vazio(opportunity)
union all select 'aluno', count(*) from public.sales where public.r9_vazio(coalesce(client_name, candidate_name))
union all select 'data', count(*) from public.sales where sale_date is null
union all select 'consultor', count(*) from public.sales where public.r9_vazio(seller_id::text)
union all select 'produto', count(*) from public.sales where public.r9_vazio(coalesce(product, product_name))
union all select 'modalidade', count(*) from public.sales where public.r9_vazio(modality)
union all select 'turno', count(*) from public.sales where public.r9_vazio(turn)
union all select 'FDI', count(*) from public.sales where public.r9_fdi_invalido(fdi)
union all select 'TOTAL de vendas incompletas', count(*) from public.sales
  where public.r9_vazio(opportunity) or public.r9_vazio(coalesce(client_name, candidate_name)) or sale_date is null
     or public.r9_vazio(seller_id::text) or public.r9_vazio(coalesce(product, product_name)) or public.r9_vazio(modality)
     or public.r9_vazio(turn) or public.r9_fdi_invalido(fdi);
