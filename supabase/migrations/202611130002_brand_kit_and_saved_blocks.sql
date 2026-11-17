-- R9Bot Mailer: per-user brand kit and reusable ("saved") blocks.
-- Both are private to the user who created them (RLS). Safe to re-run.

create extension if not exists pgcrypto;

-- ----- brand kit ------------------------------------------------------------
create table if not exists public.mailer_brand_kits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  kit jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint mailer_brand_kits_kit_is_object check (jsonb_typeof(kit) = 'object'),
  constraint mailer_brand_kits_kit_size check (pg_column_size(kit) <= 65536)
);

alter table public.mailer_brand_kits enable row level security;
revoke all on public.mailer_brand_kits from anon;
grant select, insert, update, delete on public.mailer_brand_kits to authenticated;

drop policy if exists "Users manage their own brand kit" on public.mailer_brand_kits;
create policy "Users manage their own brand kit"
  on public.mailer_brand_kits for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ----- saved blocks -----------------------------------------------------------
create table if not exists public.mailer_saved_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  block jsonb not null,
  created_at timestamptz not null default now(),
  constraint mailer_saved_blocks_name_length check (char_length(btrim(name)) between 1 and 80),
  constraint mailer_saved_blocks_block_is_object check (jsonb_typeof(block) = 'object'),
  constraint mailer_saved_blocks_block_size check (pg_column_size(block) <= 262144)
);

create index if not exists mailer_saved_blocks_user_created_idx
  on public.mailer_saved_blocks (user_id, created_at desc);

alter table public.mailer_saved_blocks enable row level security;
revoke all on public.mailer_saved_blocks from anon;
grant select, insert, delete on public.mailer_saved_blocks to authenticated;

drop policy if exists "Users read their own saved blocks" on public.mailer_saved_blocks;
create policy "Users read their own saved blocks"
  on public.mailer_saved_blocks for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Users create their own saved blocks" on public.mailer_saved_blocks;
create policy "Users create their own saved blocks"
  on public.mailer_saved_blocks for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "Users delete their own saved blocks" on public.mailer_saved_blocks;
create policy "Users delete their own saved blocks"
  on public.mailer_saved_blocks for delete to authenticated
  using (user_id = (select auth.uid()));

-- Ask PostgREST to pick up the new tables immediately.
notify pgrst, 'reload schema';
