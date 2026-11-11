-- =====================================================================
-- R9 Hub · Metas por peso
--
-- Cada consultor tem um percentual por BU (a soma de cada BU deve dar 100%).
-- A meta oficial importada de cada semana/mês é distribuída automaticamente
-- por esses percentuais e gravada em public.goals (as telas de Início,
-- Desempenho e Rankings continuam lendo de lá).
--
-- goals.ajuste_manual = true marca a meta de uma pessoa ajustada à mão naquele
-- período: o cálculo automático não a sobrescreve.
--
-- Rodar no Supabase: SQL Editor → colar tudo → Run. Pode rodar mais de uma vez.
-- =====================================================================

create table if not exists public.metas_pesos (
  user_id uuid not null references public.profiles(id) on delete cascade,
  bu text not null check (bu in ('bu_presencial', 'bu_digital', 'pos', 'tecnico')),
  percentual numeric not null default 0 check (percentual >= 0 and percentual <= 100),
  updated_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_by uuid,
  primary key (user_id, bu)
);

alter table public.goals add column if not exists ajuste_manual boolean not null default false;

alter table public.metas_pesos enable row level security;

drop policy if exists "Somente usuários autorizados" on public.metas_pesos;
create policy "Somente usuários autorizados" on public.metas_pesos as restrictive for all to anon, authenticated
  using (public.is_approved_user()) with check (public.is_approved_user());

drop policy if exists "Pesos visíveis por autenticados" on public.metas_pesos;
create policy "Pesos visíveis por autenticados" on public.metas_pesos
  for select using (auth.role() = 'authenticated');

drop policy if exists "Admins gerenciam pesos" on public.metas_pesos;
create policy "Admins gerenciam pesos" on public.metas_pesos
  for all using (public.is_admin_user()) with check (public.is_admin_user());
