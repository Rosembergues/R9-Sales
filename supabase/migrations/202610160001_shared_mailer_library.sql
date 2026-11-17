-- R9Bot Mailer: shared template library and per-user cloud drafts.
-- Apply this migration in the Supabase SQL editor or through the project's migration workflow.

create extension if not exists pgcrypto;

create table if not exists public.mailer_library_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.mailer_library_admins enable row level security;
revoke all on public.mailer_library_admins from anon, authenticated;
grant select on public.mailer_library_admins to authenticated;
drop policy if exists "Users can read their own library admin status" on public.mailer_library_admins;
create policy "Users can read their own library admin status"
  on public.mailer_library_admins for select to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.is_mailer_library_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.mailer_library_admins a
    where a.user_id = (select auth.uid())
  );
$$;
revoke all on function public.is_mailer_library_admin() from public;
grant execute on function public.is_mailer_library_admin() to authenticated;

create table if not exists public.mailer_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Meu template',
  subject text not null default 'E-mail sem assunto',
  description text not null default '',
  blocks jsonb not null default '[]'::jsonb,
  email_data jsonb not null default '{}'::jsonb,
  is_public boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mailer_templates_public_updated_idx
  on public.mailer_templates (is_public, updated_at desc);
create index if not exists mailer_templates_created_by_idx
  on public.mailer_templates (created_by);

create table if not exists public.mailer_template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.mailer_templates(id) on delete cascade,
  version_number integer not null,
  name text not null,
  subject text not null,
  blocks jsonb not null,
  email_data jsonb not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint mailer_template_versions_unique unique (template_id, version_number)
);
create index if not exists mailer_template_versions_lookup_idx
  on public.mailer_template_versions (template_id, version_number desc);

create table if not exists public.mailer_drafts (
  user_id uuid not null references auth.users(id) on delete cascade,
  document_id uuid not null,
  source_template_id uuid references public.mailer_templates(id) on delete set null,
  blocks jsonb not null default '[]'::jsonb,
  email_data jsonb not null default '{}'::jsonb,
  saved_at timestamptz not null default now(),
  primary key (user_id, document_id)
);
-- Keep this ALTER for environments where the draft table was created by an earlier iteration.
alter table public.mailer_drafts
  add column if not exists source_template_id uuid references public.mailer_templates(id) on delete set null;

create index if not exists mailer_drafts_saved_at_idx
  on public.mailer_drafts (user_id, saved_at desc);

alter table public.mailer_templates enable row level security;
alter table public.mailer_template_versions enable row level security;
alter table public.mailer_drafts enable row level security;

grant select, insert, update, delete on public.mailer_templates to authenticated;
grant select on public.mailer_template_versions to authenticated;
grant select, insert, update, delete on public.mailer_drafts to authenticated;
revoke all on public.mailer_templates from anon;
revoke all on public.mailer_template_versions from anon;
revoke all on public.mailer_drafts from anon;

-- Anyone authenticated can see public models. Ownership/admin constraints protect writes.
drop policy if exists "Authenticated users can read public mailer templates" on public.mailer_templates;
create policy "Authenticated users can read public mailer templates"
  on public.mailer_templates for select to authenticated
  using (is_public = true or created_by = (select auth.uid()) or public.is_mailer_library_admin());

drop policy if exists "Authenticated users can publish public mailer templates" on public.mailer_templates;
create policy "Authenticated users can publish public mailer templates"
  on public.mailer_templates for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and updated_by = (select auth.uid())
    and is_public = true
  );

drop policy if exists "Owners and admins can update mailer templates" on public.mailer_templates;
create policy "Owners and admins can update mailer templates"
  on public.mailer_templates for update to authenticated
  using (created_by = (select auth.uid()) or public.is_mailer_library_admin())
  with check (
    (created_by = (select auth.uid()) or public.is_mailer_library_admin())
    and updated_by = (select auth.uid())
    and is_public = true
  );

drop policy if exists "Only admins can delete mailer templates" on public.mailer_templates;
create policy "Only admins can delete mailer templates"
  on public.mailer_templates for delete to authenticated
  using (public.is_mailer_library_admin());

-- Version history is readable wherever its parent template is readable. Changes are written by a trigger.
drop policy if exists "Users can read versions of visible templates" on public.mailer_template_versions;
create policy "Users can read versions of visible templates"
  on public.mailer_template_versions for select to authenticated
  using (
    exists (
      select 1 from public.mailer_templates t
      where t.id = template_id
        and (t.is_public = true or t.created_by = (select auth.uid()) or public.is_mailer_library_admin())
    )
  );

-- Drafts are private to the owning authenticated user.
drop policy if exists "Users can read their own drafts" on public.mailer_drafts;
create policy "Users can read their own drafts"
  on public.mailer_drafts for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists "Users can create their own drafts" on public.mailer_drafts;
create policy "Users can create their own drafts"
  on public.mailer_drafts for insert to authenticated
  with check (user_id = (select auth.uid()));
drop policy if exists "Users can update their own drafts" on public.mailer_drafts;
create policy "Users can update their own drafts"
  on public.mailer_drafts for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
drop policy if exists "Users can delete their own drafts" on public.mailer_drafts;
create policy "Users can delete their own drafts"
  on public.mailer_drafts for delete to authenticated
  using (user_id = (select auth.uid()));

-- Ownership is fixed at creation. Admin edits update updated_by but never transfer ownership.
create or replace function public.enforce_mailer_template_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := (select auth.uid());
    new.updated_by := (select auth.uid());
    new.is_public := true;
  else
    if new.created_by is distinct from old.created_by then
      raise exception 'Template ownership cannot be changed';
    end if;
    new.updated_by := (select auth.uid());
    new.updated_at := now();
    new.is_public := true;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_mailer_template_identity on public.mailer_templates;
create trigger enforce_mailer_template_identity
  before insert or update on public.mailer_templates
  for each row execute function public.enforce_mailer_template_identity();
revoke all on function public.enforce_mailer_template_identity() from public, anon, authenticated;

-- Add a version whenever template content or metadata materially changes.
create or replace function public.record_mailer_template_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_version integer;
begin
  if tg_op = 'UPDATE'
    and old.name is not distinct from new.name
    and old.subject is not distinct from new.subject
    and old.description is not distinct from new.description
    and old.blocks is not distinct from new.blocks
    and old.email_data is not distinct from new.email_data then
    return new;
  end if;

  select coalesce(max(v.version_number), 0) + 1
    into next_version
    from public.mailer_template_versions v
    where v.template_id = new.id;

  insert into public.mailer_template_versions (
    template_id, version_number, name, subject, blocks, email_data, created_by
  ) values (
    new.id, next_version, new.name, new.subject, new.blocks, new.email_data,
    coalesce((select auth.uid()), new.updated_by, new.created_by)
  );

  -- Match the editor's prior behavior: retain the 20 most recent versions per template.
  delete from public.mailer_template_versions v
    where v.template_id = new.id
      and v.version_number <= next_version - 20;

  return new;
end;
$$;

drop trigger if exists record_mailer_template_version on public.mailer_templates;
create trigger record_mailer_template_version
  after insert or update on public.mailer_templates
  for each row execute function public.record_mailer_template_version();
revoke all on function public.record_mailer_template_version() from public, anon, authenticated;

-- Set an initial administrator after applying the migration, replacing the email:
-- insert into public.mailer_library_admins (user_id)
-- select id from auth.users where lower(email) = lower('admin@example.com')
-- on conflict (user_id) do nothing;
