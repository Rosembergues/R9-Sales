-- =====================================================================
-- R9 Hub · Automação do Funil de Captação (Power BI → Supabase)
--
-- ATUALIZAÇÃO: hoje quem envia é o script Python scripts/run_daily_import.py
-- (o Power Automate saiu). Ele grava pela API REST usando as funções de
-- automacao-token-importacao.sql. O role power_automate_ingest continua
-- aqui só para quem preferir conexão Postgres direta.
--
-- O Power BI manda por e-mail, todo dia, o PDF "Funil de Captação" de cada
-- modalidade (presencial/semi/ao vivo/digital/técnico). Um fluxo no Power
-- Automate lê o e-mail, extrai da linha M.FIN — grupo "QUANTIDADE"
-- (Anterior/Meta/Atual) — e insere uma linha aqui em goal_daily_inbox
-- usando o conector nativo PostgreSQL (sem precisar do conector HTTP,
-- que é Premium).
--
-- Esse relatório só mostra o ACUMULADO do ciclo até hoje (não "quanto
-- entrou hoje"), diferente do Excel manual (que já vem um valor por dia).
-- Por isso esta tabela guarda o acumulado como veio (aa_to_date,
-- target_to_date, actual_to_date), e o gatilho calcula a DIFERENÇA contra
-- o acumulado do último dia já gravado antes de escrever em
-- goal_daily_data — assim cada linha de lá continua sendo "o valor daquele
-- dia", igual ao upload manual, e a soma dos dias fecha certo.
--
-- Rodar no Supabase: SQL Editor → colar tudo → Run. Pode rodar mais de uma vez.
--
-- IMPORTANTE (não está neste arquivo, rode à parte e não commite):
--   alter role power_automate_ingest with password '<escolha uma senha forte>';
-- Essa é a senha que vai na conexão PostgreSQL do Power Automate.
--
-- Depois deste arquivo, rode também separacao-metas-automacao.sql. Ele muda
-- o destino do gatilho para official_goal_snapshots e protege as importações
-- manuais em goal_daily_data.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Role dedicado para a conexão do Power Automate.
--    Só pode INSERT em goal_daily_inbox. Não enxerga mais nada no banco.
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'power_automate_ingest') then
    create role power_automate_ingest with login;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 2. Caixa de entrada: uma linha por PDF processado pelo Power Automate.
--    Guarda o ACUMULADO do ciclo até a data (não o valor do dia isolado —
--    o gatilho na seção 4 converte isso em "valor do dia" na hora de gravar).
-- ---------------------------------------------------------------------
create table if not exists public.goal_daily_inbox (
  id uuid primary key default gen_random_uuid(),
  received_at timestamp with time zone not null default timezone('utc'::text, now()),
  source text not null default 'power_automate',
  academic_period text not null,
  product text not null,
  goal_group text not null,
  reference_date date not null,
  aa_to_date numeric,
  target_to_date numeric,
  actual_to_date numeric,
  cycle_target numeric,
  processed boolean not null default false,
  process_error text
);

-- Renomeia colunas de uma instalação anterior (antes de perceber que o
-- relatório é acumulado, não por dia). Sem efeito numa instalação nova.
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'goal_daily_inbox' and column_name = 'aa')
     and not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'goal_daily_inbox' and column_name = 'aa_to_date') then
    alter table public.goal_daily_inbox rename column aa to aa_to_date;
    alter table public.goal_daily_inbox rename column target to target_to_date;
    alter table public.goal_daily_inbox rename column actual to actual_to_date;
  end if;
end $$;

alter table public.goal_daily_inbox enable row level security;

drop policy if exists "Somente usuários autorizados" on public.goal_daily_inbox;
create policy "Somente usuários autorizados" on public.goal_daily_inbox as restrictive for all to anon, authenticated
  using (public.is_approved_user()) with check (public.is_approved_user());

drop policy if exists "Automação grava na caixa de entrada" on public.goal_daily_inbox;
create policy "Automação grava na caixa de entrada" on public.goal_daily_inbox
  for insert to power_automate_ingest with check (true);

drop policy if exists "Admins veem a caixa de entrada" on public.goal_daily_inbox;
create policy "Admins veem a caixa de entrada" on public.goal_daily_inbox
  for select using (public.is_admin_user());

-- Permite o próprio script local reler o que ele inseriu (sem auth.uid(),
-- a policy acima não cobre essa conexão).
drop policy if exists "Automação relê a própria caixa de entrada" on public.goal_daily_inbox;
create policy "Automação relê a própria caixa de entrada" on public.goal_daily_inbox
  for select to power_automate_ingest using (true);

grant usage on schema public to power_automate_ingest;
grant insert, select on public.goal_daily_inbox to power_automate_ingest;

-- Índice de uma versão anterior, que forçava a automação a ter sua própria
-- importação separada (causava um "reset" ao ignorar o histórico de quem
-- já importava esse período/modalidade manualmente). Não usamos mais isso:
-- a automação agora continua a importação mais recente que já existir.
drop index if exists public.goal_imports_automacao_unique;

-- ---------------------------------------------------------------------
-- 3. Garante que cada dia só aparece uma vez dentro de uma mesma importação
-- (permite o upsert idempotente no passo 4).
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.goal_daily_data'::regclass
      and conname = 'goal_daily_data_import_date_unique'
  ) then
    alter table public.goal_daily_data
      add constraint goal_daily_data_import_date_unique unique (import_id, reference_date);
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 4. Gatilho: toda linha inserida na caixa de entrada vira um dia gravado
--    em goal_daily_data (SECURITY DEFINER: roda com privilégio de quem
--    criou a função, não do power_automate_ingest, que não tem acesso
--    direto a goal_imports/goal_daily_data).
-- ---------------------------------------------------------------------
create or replace function public.ingest_goal_daily_from_inbox()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_import_id uuid;
  v_prior_aa numeric;
  v_prior_target numeric;
  v_prior_actual numeric;
begin
  begin
    -- Continua a importação ATIVA mais recente desse período/modalidade,
    -- não importa se ela foi criada por upload manual ou por essa mesma
    -- automação num dia anterior — assim o histórico nunca é perdido.
    select id into v_import_id
    from public.goal_imports
    where academic_period = new.academic_period
      and product = new.product
      and goal_group = new.goal_group
      and status = 'active'
    order by imported_at desc
    limit 1;

    if v_import_id is null then
      insert into public.goal_imports (academic_period, product, goal_group, file_name, status)
      values (new.academic_period, new.product, new.goal_group, 'automacao-funil-captacao', 'active')
      returning id into v_import_id;
    end if;

    -- Acumulado de todos os dias já gravados ANTES desta data (exclui o de hoje,
    -- então reenviar o mesmo dia de novo recalcula a mesma diferença, sem duplicar).
    select coalesce(sum(aa), 0), coalesce(sum(target), 0), coalesce(sum(actual), 0)
      into v_prior_aa, v_prior_target, v_prior_actual
    from public.goal_daily_data
    where import_id = v_import_id and reference_date < new.reference_date;

    insert into public.goal_daily_data (import_id, academic_period, product, goal_group, reference_date, aa, target, actual)
    values (
      v_import_id, new.academic_period, new.product, new.goal_group, new.reference_date,
      new.aa_to_date - v_prior_aa,
      new.target_to_date - v_prior_target,
      new.actual_to_date - v_prior_actual
    )
    on conflict (import_id, reference_date)
      do update set aa = excluded.aa, target = excluded.target, actual = excluded.actual;

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
