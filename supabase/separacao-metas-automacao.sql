-- Separa os PDFs da automação local das importações manuais em goal_daily_data.
-- Pode ser executado mais de uma vez. Preserva histórico e restaura em goal_daily_data
-- as linhas de 26/11/2026 com os valores dos arquivos Excel manuais enviados.

alter table public.goal_daily_inbox add column if not exists cycle_target numeric;

-- O ciclo final vem da seção "Metas finais" do PDF; estes são os PDFs já recebidos.
update public.goal_daily_inbox
set cycle_target = case goal_group
  when 'graduacao_ead' then 134
  when 'graduacao_semipresencial' then 353
  when 'graduacao_aovivo' then 13
  when 'graduacao_presencial' then 138
  when 'tecnico_presencial' then 91
end
where reference_date = date '2026-11-26'
  and goal_group in ('graduacao_ead', 'graduacao_semipresencial', 'graduacao_aovivo', 'graduacao_presencial', 'tecnico_presencial');

create table if not exists public.official_goal_snapshots (
  academic_period text not null,
  product text not null,
  goal_group text not null,
  reference_date date not null,
  aa_to_date numeric,
  target_to_date numeric,
  actual_to_date numeric,
  cycle_target numeric,
  updated_at timestamptz not null default timezone('utc'::text, now()),
  primary key (academic_period, goal_group, reference_date)
);

alter table public.official_goal_snapshots enable row level security;
drop policy if exists "Somente usuários autorizados" on public.official_goal_snapshots;
create policy "Somente usuários autorizados" on public.official_goal_snapshots
  as restrictive for all to anon, authenticated
  using (public.is_approved_user()) with check (public.is_approved_user());
drop policy if exists "Metas oficiais visíveis por usuários aprovados" on public.official_goal_snapshots;
create policy "Metas oficiais visíveis por usuários aprovados" on public.official_goal_snapshots
  for select to authenticated using (public.is_approved_user());
grant select on public.official_goal_snapshots to authenticated;

-- Copia o que já chegou pela automação sem expor a caixa de entrada aos membros.
insert into public.official_goal_snapshots (
  academic_period, product, goal_group, reference_date, aa_to_date,
  target_to_date, actual_to_date, cycle_target, updated_at
)
select distinct on (academic_period, goal_group, reference_date)
  academic_period, product, goal_group, reference_date, aa_to_date,
  target_to_date, actual_to_date, cycle_target, received_at
from public.goal_daily_inbox
where processed
order by academic_period, goal_group, reference_date, received_at desc
on conflict (academic_period, goal_group, reference_date) do update set
  product = excluded.product,
  aa_to_date = excluded.aa_to_date,
  target_to_date = excluded.target_to_date,
  actual_to_date = excluded.actual_to_date,
  cycle_target = coalesce(excluded.cycle_target, public.official_goal_snapshots.cycle_target),
  updated_at = greatest(public.official_goal_snapshots.updated_at, excluded.updated_at);

-- O snapshot agora tem uma finalidade própria: nunca escreve nas importações manuais.
create or replace function public.ingest_goal_daily_from_inbox()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    insert into public.official_goal_snapshots (
      academic_period, product, goal_group, reference_date, aa_to_date,
      target_to_date, actual_to_date, cycle_target, updated_at
    ) values (
      new.academic_period, new.product, new.goal_group, new.reference_date,
      new.aa_to_date, new.target_to_date, new.actual_to_date, new.cycle_target,
      timezone('utc'::text, now())
    )
    on conflict (academic_period, goal_group, reference_date) do update set
      product = excluded.product,
      aa_to_date = excluded.aa_to_date,
      target_to_date = excluded.target_to_date,
      actual_to_date = excluded.actual_to_date,
      cycle_target = coalesce(excluded.cycle_target, public.official_goal_snapshots.cycle_target),
      updated_at = excluded.updated_at;

    new.processed := true;
    new.process_error := null;
  exception when others then
    new.processed := false;
    new.process_error := sqlerrm;
  end;
  return new;
end;
$$;

drop trigger if exists ingest_goal_daily_from_inbox on public.goal_daily_inbox;
create trigger ingest_goal_daily_from_inbox
  before insert on public.goal_daily_inbox
  for each row execute function public.ingest_goal_daily_from_inbox();
revoke execute on function public.ingest_goal_daily_from_inbox() from public, anon, authenticated;

-- Inclui o novo campo no caminho restrito por token usado pelo importador local.
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
    source, academic_period, product, goal_group, reference_date,
    aa_to_date, target_to_date, actual_to_date, cycle_target
  )
  select coalesce(x.source, 'python_local'), x.academic_period, x.product, x.goal_group,
         x.reference_date, x.aa_to_date, x.target_to_date, x.actual_to_date, x.cycle_target
  from jsonb_populate_record(null::public.goal_daily_inbox, p_row) as x
  returning * into r;

  return jsonb_build_object('id', r.id, 'processed', r.processed, 'process_error', r.process_error);
end;
$$;
revoke execute on function public.ingest_funil_captacao(text, jsonb) from public, authenticated;
grant execute on function public.ingest_funil_captacao(text, jsonb) to anon;

-- Corrige os cinco registros Excel de 26/11 que o trigger anterior sobrescreveu.
update public.goal_daily_data d set aa = 1, target = 2.34313855510611, actual = null
from public.goal_imports i
where i.id = d.import_id and i.file_name = 'data (5).xlsx'
  and i.goal_group = 'graduacao_presencial' and d.reference_date = date '2026-11-26';
update public.goal_daily_data d set aa = 1, target = 1.50654829958832, actual = null
from public.goal_imports i
where i.id = d.import_id and i.file_name = 'data (6).xlsx'
  and i.goal_group = 'graduacao_aovivo' and d.reference_date = date '2026-11-26';
update public.goal_daily_data d set aa = 4, target = 22.7598090996774, actual = null
from public.goal_imports i
where i.id = d.import_id and i.file_name = 'data (7).xlsx'
  and i.goal_group = 'graduacao_semipresencial' and d.reference_date = date '2026-11-26';
update public.goal_daily_data d set aa = 2, target = 1.95833665739726, actual = null
from public.goal_imports i
where i.id = d.import_id and i.file_name = 'data (8).xlsx'
  and i.goal_group = 'graduacao_ead' and d.reference_date = date '2026-11-26';
update public.goal_daily_data d set aa = 1, target = 2.05565794935506, actual = 0
from public.goal_imports i
where i.id = d.import_id and i.file_name = 'data (10).xlsx'
  and i.goal_group = 'tecnico_presencial' and d.reference_date = date '2026-11-26';
