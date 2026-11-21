-- =====================================================================
-- R9 Hub · Automação do Ranking de Unidades (Power Automate → Supabase)
--
-- O Power BI manda por e-mail o PDF "Rankings" (BU Digital / BU Presencial),
-- uma tabela com uma linha por unidade. O que a home quer mostrar é só
-- duas coisas por dia: a posição do R9-Taquara nesse ranking e o total de
-- matrícula do conjunto das unidades (linha "Total" do relatório).
--
-- Mesmo mecanismo do Funil de Captação (ver automacao-funil-captacao.sql):
-- o Power Automate só consegue INSERT na caixa de entrada; um gatilho
-- SECURITY DEFINER mescla isso na tabela final.
--
-- Rodar no Supabase: SQL Editor → colar tudo → Run. Pode rodar mais de uma vez.
-- Reaproveita o role power_automate_ingest criado em automacao-funil-captacao.sql
-- (rode aquele arquivo primeiro se ainda não rodou).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Caixa de entrada: uma linha por PDF de ranking processado.
-- ---------------------------------------------------------------------
create table if not exists public.unit_ranking_inbox (
  id uuid primary key default gen_random_uuid(),
  received_at timestamp with time zone not null default timezone('utc'::text, now()),
  source text not null default 'power_automate',
  reference_date date not null,
  bu text not null check (bu in ('bu_presencial', 'bu_digital')),
  academic_period text,
  our_rank integer,
  our_aa numeric,
  our_meta numeric,
  our_real numeric,
  market_aa numeric,
  market_meta numeric,
  market_real numeric,
  processed boolean not null default false,
  process_error text
);

alter table public.unit_ranking_inbox enable row level security;

drop policy if exists "Somente usuários autorizados" on public.unit_ranking_inbox;
create policy "Somente usuários autorizados" on public.unit_ranking_inbox as restrictive for all to anon, authenticated
  using (public.is_approved_user()) with check (public.is_approved_user());

drop policy if exists "Automação grava na caixa de entrada" on public.unit_ranking_inbox;
create policy "Automação grava na caixa de entrada" on public.unit_ranking_inbox
  for insert to power_automate_ingest with check (true);

drop policy if exists "Admins veem a caixa de entrada" on public.unit_ranking_inbox;
create policy "Admins veem a caixa de entrada" on public.unit_ranking_inbox
  for select using (public.is_admin_user());

drop policy if exists "Automação relê a própria caixa de entrada" on public.unit_ranking_inbox;
create policy "Automação relê a própria caixa de entrada" on public.unit_ranking_inbox
  for select to power_automate_ingest using (true);

grant insert, select on public.unit_ranking_inbox to power_automate_ingest;

-- ---------------------------------------------------------------------
-- 2. Tabela final: uma linha por (dia, BU). A home lê daqui.
-- ---------------------------------------------------------------------
create table if not exists public.unit_ranking_daily (
  id uuid primary key default gen_random_uuid(),
  reference_date date not null,
  bu text not null check (bu in ('bu_presencial', 'bu_digital')),
  academic_period text,
  our_rank integer,
  our_aa numeric,
  our_meta numeric,
  our_real numeric,
  market_aa numeric,
  market_meta numeric,
  market_real numeric,
  updated_at timestamp with time zone not null default timezone('utc'::text, now()),
  unique (reference_date, bu)
);

alter table public.unit_ranking_daily enable row level security;

drop policy if exists "Somente usuários autorizados" on public.unit_ranking_daily;
create policy "Somente usuários autorizados" on public.unit_ranking_daily as restrictive for all to anon, authenticated
  using (public.is_approved_user()) with check (public.is_approved_user());

drop policy if exists "Ranking visível por autenticados" on public.unit_ranking_daily;
create policy "Ranking visível por autenticados" on public.unit_ranking_daily
  for select using (auth.role() = 'authenticated');

drop policy if exists "Admins gerenciam ranking" on public.unit_ranking_daily;
create policy "Admins gerenciam ranking" on public.unit_ranking_daily
  for all using (public.is_admin_user()) with check (public.is_admin_user());

-- ---------------------------------------------------------------------
-- 3. Gatilho: toda linha inserida na caixa de entrada vira um upsert em
--    unit_ranking_daily (SECURITY DEFINER: roda com privilégio de quem
--    criou a função, não do power_automate_ingest).
-- ---------------------------------------------------------------------
create or replace function public.ingest_unit_ranking_from_inbox()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    insert into public.unit_ranking_daily (
      reference_date, bu, academic_period, our_rank, our_aa, our_meta, our_real, market_aa, market_meta, market_real, updated_at
    )
    values (
      new.reference_date, new.bu, new.academic_period, new.our_rank, new.our_aa, new.our_meta, new.our_real, new.market_aa, new.market_meta, new.market_real, timezone('utc'::text, now())
    )
    on conflict (reference_date, bu) do update set
      academic_period = excluded.academic_period,
      our_rank = excluded.our_rank,
      our_aa = excluded.our_aa,
      our_meta = excluded.our_meta,
      our_real = excluded.our_real,
      market_aa = excluded.market_aa,
      market_meta = excluded.market_meta,
      market_real = excluded.market_real,
      updated_at = timezone('utc'::text, now());

    new.processed := true;
    new.process_error := null;
  exception when others then
    new.processed := false;
    new.process_error := sqlerrm;
  end;
  return new;
end;
$$;

drop trigger if exists ingest_unit_ranking_from_inbox on public.unit_ranking_inbox;
create trigger ingest_unit_ranking_from_inbox
  before insert on public.unit_ranking_inbox
  for each row execute function public.ingest_unit_ranking_from_inbox();
