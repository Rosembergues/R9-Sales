-- =====================================================================
-- R9 Sales · Vendas duplicadas por número de oportunidade
-- Rodar no Supabase: SQL Editor → colar → Run.
-- O número da oportunidade é comparado sem espaços e em maiúsculas.
-- =====================================================================

-- PASSO 1 · Ver os duplicados que já existem (só leitura, não altera nada)
with base as (
  select
    id,
    upper(regexp_replace(coalesce(nullif(opportunity, ''), custom_data->>'opportunity_number'), '[[:space:]]', '', 'g')) as oportunidade,
    coalesce(nullif(candidate_name, ''), client_name, custom_data->>'candidate_name') as aluno,
    coalesce(nullif(seller_name, ''), collaborator_name) as consultor,
    coalesce(nullif(modality, ''), custom_data->>'modality') as modalidade,
    sale_date,
    created_at
  from public.sales
)
select
  oportunidade,
  count(*) as vezes,
  json_agg(json_build_object(
    'id', id, 'aluno', aluno, 'consultor', consultor, 'modalidade', modalidade,
    'data_venda', sale_date::date, 'lancada_em', created_at
  ) order by created_at) as vendas
from base
where oportunidade is not null and oportunidade <> ''
group by oportunidade
having count(*) > 1
order by vezes desc, oportunidade;

-- PASSO 2 · Apagar as cópias, mantendo o lançamento mais antigo de cada oportunidade.
-- Confira o resultado do passo 1 antes. Para rodar, tire os "--" das linhas abaixo.
-- with ranked as (
--   select id,
--     row_number() over (
--       partition by upper(regexp_replace(coalesce(nullif(opportunity, ''), custom_data->>'opportunity_number'), '[[:space:]]', '', 'g'))
--       order by created_at, id
--     ) as n
--   from public.sales
--   where coalesce(nullif(opportunity, ''), custom_data->>'opportunity_number') is not null
--     and coalesce(nullif(opportunity, ''), custom_data->>'opportunity_number') <> ''
-- )
-- delete from public.sales s using ranked r where s.id = r.id and r.n > 1;

-- PASSO 3 · Trava no banco: impede duas vendas com a mesma oportunidade.
-- Só é criada quando não há mais duplicados (senão avisa e não faz nada).
do $$
begin
  if exists (
    select 1 from public.sales
    where coalesce(nullif(opportunity, ''), custom_data->>'opportunity_number') is not null
      and coalesce(nullif(opportunity, ''), custom_data->>'opportunity_number') <> ''
    group by upper(regexp_replace(coalesce(nullif(opportunity, ''), custom_data->>'opportunity_number'), '[[:space:]]', '', 'g'))
    having count(*) > 1
  ) then
    raise notice 'Ainda existem oportunidades duplicadas. Resolva-as (passos 1 e 2) e rode este passo de novo.';
  else
    create unique index if not exists sales_opportunity_unique
      on public.sales (upper(regexp_replace(coalesce(nullif(opportunity, ''), custom_data->>'opportunity_number'), '[[:space:]]', '', 'g')))
      where coalesce(nullif(opportunity, ''), custom_data->>'opportunity_number') is not null
        and coalesce(nullif(opportunity, ''), custom_data->>'opportunity_number') <> '';
    raise notice 'Trava de oportunidade única criada (sales_opportunity_unique).';
  end if;
end $$;
