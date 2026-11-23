-- =====================================================================
-- R9 Hub · Acesso restrito da importação diária (script Python local)
--
-- O script scripts/run_daily_import.py grava os PDFs do Power BI pela API
-- REST. Antes ele usava a chave service_role, que ignora TODAS as regras de
-- acesso do banco. Este arquivo cria um caminho com o mínimo de acesso:
--
--   * a tabela ingest_tokens guarda só o HASH (sha256) dos tokens válidos;
--   * as funções ingest_funil_captacao / ingest_unit_ranking conferem o
--     token e só fazem INSERT nas caixas de entrada (goal_daily_inbox /
--     unit_ranking_inbox). Os gatilhos de lá continuam fazendo a mescla;
--   * o script usa a chave anon (pública) + o token. Quem pegar o token só
--     consegue inserir linhas nas caixas de entrada.
--
-- Pré-requisito: automacao-funil-captacao.sql e automacao-ranking-unidades.sql.
-- Rodar no Supabase: SQL Editor → colar tudo → Run. Pode rodar mais de uma vez.
--
-- Depois de rodar, gere o token na sua máquina:
--     python scripts/gerar_token_importacao.py
-- Ele mostra a linha para o scripts/.env e o INSERT (só com o hash) para
-- rodar aqui. Para revogar um token:
--     update public.ingest_tokens set revoked_at = now() where label = '...';
-- =====================================================================

create table if not exists public.ingest_tokens (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  token_hash text not null unique,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  revoked_at timestamp with time zone
);

-- RLS ligado e nenhuma política: ninguém lê nem grava pela API.
alter table public.ingest_tokens enable row level security;
revoke all on public.ingest_tokens from anon, authenticated;

create or replace function public.ingest_token_ok(p_token text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_token is not null
     and length(p_token) >= 32
     and exists (
       select 1 from public.ingest_tokens
       where token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
         and revoked_at is null
     );
$$;
revoke execute on function public.ingest_token_ok(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Funil de Captação → goal_daily_inbox
-- ---------------------------------------------------------------------
create or replace function public.ingest_funil_captacao(p_token text, p_row jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.goal_daily_inbox;
begin
  if not public.ingest_token_ok(p_token) then
    raise exception 'token de importação inválido ou revogado' using errcode = '28000';
  end if;

  insert into public.goal_daily_inbox (
    source, academic_period, product, goal_group, reference_date, aa_to_date, target_to_date, actual_to_date
  )
  select coalesce(x.source, 'python_local'), x.academic_period, x.product, x.goal_group, x.reference_date,
         x.aa_to_date, x.target_to_date, x.actual_to_date
  from jsonb_populate_record(null::public.goal_daily_inbox, p_row) as x
  returning * into r;

  return jsonb_build_object('id', r.id, 'processed', r.processed, 'process_error', r.process_error);
end;
$$;
revoke execute on function public.ingest_funil_captacao(text, jsonb) from public, authenticated;
grant execute on function public.ingest_funil_captacao(text, jsonb) to anon;

-- ---------------------------------------------------------------------
-- Ranking de Unidades → unit_ranking_inbox
-- ---------------------------------------------------------------------
create or replace function public.ingest_unit_ranking(p_token text, p_row jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.unit_ranking_inbox;
begin
  if not public.ingest_token_ok(p_token) then
    raise exception 'token de importação inválido ou revogado' using errcode = '28000';
  end if;

  insert into public.unit_ranking_inbox (
    source, reference_date, bu, academic_period, our_rank, our_aa, our_meta, our_real, market_aa, market_meta, market_real
  )
  select coalesce(x.source, 'python_local'), x.reference_date, x.bu, x.academic_period, x.our_rank, x.our_aa,
         x.our_meta, x.our_real, x.market_aa, x.market_meta, x.market_real
  from jsonb_populate_record(null::public.unit_ranking_inbox, p_row) as x
  returning * into r;

  return jsonb_build_object('id', r.id, 'processed', r.processed, 'process_error', r.process_error);
end;
$$;
revoke execute on function public.ingest_unit_ranking(text, jsonb) from public, authenticated;
grant execute on function public.ingest_unit_ranking(text, jsonb) to anon;
