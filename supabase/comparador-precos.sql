-- =====================================================================
-- R9 Hub · Comparador de Preços
-- Rodar no Supabase: SQL Editor → colar tudo → Run. Pode rodar mais de uma vez.
--
-- Cada planilha importada vira um registro em price_imports (uma "foto" da semana).
-- Nada é sobrescrito: o histórico fica guardado e as telas mostram sempre a
-- importação ativa com a data de referência mais recente.
-- =====================================================================

-- 1. Importações (uma por planilha enviada)
create table if not exists public.price_imports (
  id uuid primary key default gen_random_uuid(),
  reference_date date not null,           -- data de atualização lida da planilha
  reference_week date not null,           -- segunda-feira da semana de reference_date
  campus text,
  file_name text,
  row_count integer not null default 0,
  imported_by text,
  imported_by_name text,
  imported_at timestamp with time zone not null default timezone('utc'::text, now()),
  -- draft: gravando (invisível) · active: vigente · replaced: substituída por outra da mesma semana
  status text not null default 'draft' check (status in ('draft', 'active', 'replaced'))
);

create index if not exists price_imports_status_ref_idx
  on public.price_imports (status, reference_date desc, imported_at desc);

-- 2. Linhas da planilha: o nosso curso/turno + as ofertas das concorrentes
create table if not exists public.price_courses (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.price_imports(id) on delete cascade,
  sort_order integer not null default 0,
  campus text,
  course_code text,
  course_name text not null,
  shift text,
  modality text,
  list_price numeric,                    -- PREÇO DE
  scholarship_label text,                -- % DE BOLSA como veio (ex.: "65% 1ºS + 60% CT")
  scholarship_first_pct numeric,         -- bolsa do 1º semestre (0–1), quando houver
  scholarship_ct_pct numeric,            -- bolsa contínua (0–1)
  price_first numeric,                   -- preço por com a bolsa do 1º semestre
  price_ct numeric,                      -- preço por com a bolsa contínua
  our_price numeric,                     -- preço usado na comparação (1ºS quando a bolsa é composta)
  -- [{ "name": "IBMR", "price_from": 2169, "discount_pct": 0.62, "price_to": 823.39, "offered": true }, ...]
  competitors jsonb not null default '[]'::jsonb
);

create index if not exists price_courses_import_idx on public.price_courses (import_id);
create index if not exists price_courses_course_idx on public.price_courses (course_code, shift);

-- 3. Configurações do comparador (ex.: limite de "ofensa")
create table if not exists public.price_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_by text
);

insert into public.price_settings (key, value)
values ('offense_threshold_pct', '8'::jsonb)
on conflict (key) do nothing;

-- 4. Segurança: todos os autenticados leem; só admin grava
alter table public.price_imports enable row level security;
alter table public.price_courses enable row level security;
alter table public.price_settings enable row level security;

drop policy if exists "Importações de preços visíveis por autenticados" on public.price_imports;
create policy "Importações de preços visíveis por autenticados" on public.price_imports
  for select using (auth.role() = 'authenticated');
drop policy if exists "Admins gerenciam importações de preços" on public.price_imports;
create policy "Admins gerenciam importações de preços" on public.price_imports
  for all using (exists (select 1 from public.profiles where id::text = auth.uid()::text and role = 'admin'));

drop policy if exists "Preços visíveis por autenticados" on public.price_courses;
create policy "Preços visíveis por autenticados" on public.price_courses
  for select using (auth.role() = 'authenticated');
drop policy if exists "Admins gerenciam preços" on public.price_courses;
create policy "Admins gerenciam preços" on public.price_courses
  for all using (exists (select 1 from public.profiles where id::text = auth.uid()::text and role = 'admin'));

drop policy if exists "Configurações de preços visíveis por autenticados" on public.price_settings;
create policy "Configurações de preços visíveis por autenticados" on public.price_settings
  for select using (auth.role() = 'authenticated');
drop policy if exists "Admins gerenciam configurações de preços" on public.price_settings;
create policy "Admins gerenciam configurações de preços" on public.price_settings
  for all using (exists (select 1 from public.profiles where id::text = auth.uid()::text and role = 'admin'));
