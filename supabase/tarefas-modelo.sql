-- =====================================================================
-- R9 Hub · Planejamento: TAREFA (cadastro) x EXECUÇÃO (cada dia em que roda)
--
--   public.tarefas_modelo  → o cadastro: título, responsáveis, formulário, regra de repetição
--   public.tarefas         → continua guardando as execuções (como hoje), agora ligadas ao
--                            cadastro por modelo_id / data_prevista
--
-- O banco grava as execuções das próximas 8 semanas e estende esse horizonte todo dia.
-- Editar o cadastro atualiza as execuções FUTURAS e PENDENTES; concluídas ficam como histórico.
--
-- Permissões:
--   · todos (autorizados) veem tudo e podem criar tarefas, inclusive para colegas;
--   · só quem criou a tarefa (ou um admin) altera/exclui o cadastro e mexe nas execuções
--     (data, título, responsáveis...). Responsáveis concluem, preenchem formulário e comentam.
--
-- Rodar no Supabase: SQL Editor → colar tudo → Run. Pode rodar mais de uma vez.
-- Pré-requisito: supabase/acesso-autorizacao.sql (funções is_admin_user / is_approved_user).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Estrutura
-- ---------------------------------------------------------------------
create table if not exists public.tarefas_modelo (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descricao text not null default '',
  prioridade text not null default 'Alta',
  bucket text not null default 'Operacional',
  tags jsonb not null default '[]'::jsonb,
  responsaveis_ids text[] not null default '{}',
  campos jsonb not null default '[]'::jsonb,          -- definição do formulário
  recorrencia text not null default 'Nenhuma',         -- Nenhuma | Diariamente | Segunda a Sexta | Semanalmente | Mensalmente | Personalizado
  dias_recorrencia text[] not null default '{}',       -- Personalizado: {Seg,Qua,Sex}
  data_inicio date,                                    -- avulsa: a data (null = fila); recorrente: início e âncora (dia da semana/do mês)
  data_fim date,
  datas_puladas date[] not null default '{}',          -- execuções excluídas individualmente (não são recriadas)
  serie_legada text,                                   -- série antiga (migração)
  ativa boolean not null default true,
  criado_por uuid,
  criado_em timestamp with time zone not null default timezone('utc'::text, now()),
  atualizado_em timestamp with time zone not null default timezone('utc'::text, now()),
  atualizado_por uuid
);

alter table public.tarefas add column if not exists modelo_id uuid;
alter table public.tarefas add column if not exists data_prevista date;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'tarefas_modelo_id_fkey') then
    alter table public.tarefas
      add constraint tarefas_modelo_id_fkey foreign key (modelo_id)
      references public.tarefas_modelo(id) on delete set null;
  end if;
end $$;

create index if not exists tarefas_modelo_id_idx on public.tarefas (modelo_id);
create unique index if not exists tarefas_modelo_data_prevista_uidx
  on public.tarefas (modelo_id, data_prevista)
  where modelo_id is not null and data_prevista is not null;

-- Os gatilhos são recriados no fim; durante a migração eles não podem disparar.
drop trigger if exists tarefas_modelo_before_write on public.tarefas_modelo;
drop trigger if exists tarefas_modelo_after_write on public.tarefas_modelo;
drop trigger if exists tarefas_modelo_before_delete on public.tarefas_modelo;
drop trigger if exists tarefas_guard_write on public.tarefas;
drop trigger if exists tarefas_guard_delete on public.tarefas;
drop trigger if exists tarefas_after_delete on public.tarefas;

-- ---------------------------------------------------------------------
-- 2. Regras de repetição (mesma lógica do app)
-- ---------------------------------------------------------------------
create or replace function public.r9_hoje()
returns date language sql stable
as $$ select (now() at time zone 'America/Sao_Paulo')::date $$;

create or replace function public.r9_norm(p text)
returns text language sql immutable
as $$ select translate(lower(trim(coalesce(p, ''))), 'áàâãéêíóôõúç', 'aaaaeeiooouc') $$;

create or replace function public.tarefa_modelo_cobre_data(m public.tarefas_modelo, d date)
returns boolean language plpgsql stable
as $$
declare
  rec text := public.r9_norm(m.recorrencia);
  ancora date := coalesce(m.data_inicio, d);
  ultimo_dia int;
begin
  if d is null then return false; end if;
  if m.data_inicio is not null and d < m.data_inicio then return false; end if;
  if m.data_fim is not null and d > m.data_fim then return false; end if;
  if d = any(m.datas_puladas) then return false; end if;

  if rec like '%diari%' then return true; end if;
  if rec like '%segunda%' or rec like '%util%' then return extract(isodow from d) <= 5; end if;
  if rec like '%personaliz%' then
    return exists (
      select 1 from unnest(m.dias_recorrencia) x
      where (case left(public.r9_norm(x), 3)
               when 'dom' then 0 when 'seg' then 1 when 'ter' then 2 when 'qua' then 3
               when 'qui' then 4 when 'sex' then 5 when 'sab' then 6 end) = extract(dow from d)
    );
  end if;
  if rec like '%seman%' then return extract(isodow from d) = extract(isodow from ancora); end if;
  if rec like '%mensa%' then
    ultimo_dia := extract(day from (date_trunc('month', d) + interval '1 month - 1 day'))::int;
    return extract(day from d)::int = least(extract(day from ancora)::int, ultimo_dia);
  end if;
  return false;
end;
$$;

-- Linha de execução a partir do cadastro (jsonb → tipos reais da tabela tarefas)
create or replace function public.tarefa_modelo_payload(m public.tarefas_modelo, d date)
returns jsonb language sql stable
as $$
  select jsonb_build_object(
    'titulo', m.titulo,
    'descricao', m.descricao,
    'prioridade', m.prioridade,
    'recorrencia', m.recorrencia,
    'bucket', m.bucket,
    'tags', m.tags,
    'responsavel_id', m.responsaveis_ids[1],
    'data_inicio', d,
    'data_fim', d,
    'data_agendada', d,
    'status', 'pendente',
    'campos_customizados', jsonb_build_object(
      'fields', m.campos,
      'values', '[]'::jsonb,
      'assigneeIds', to_jsonb(m.responsaveis_ids),
      'recurrenceDays', to_jsonb(m.dias_recorrencia),
      'userSubmissions', '{}'::jsonb,
      'recurrenceSeriesId', coalesce(m.serie_legada, m.id::text)
    ),
    'comentarios', '[]'::jsonb,
    'modelo_id', m.id,
    'data_prevista', d
  )
$$;

-- ---------------------------------------------------------------------
-- 3. Gerador: grava as execuções que faltam até hoje + p_dias
-- ---------------------------------------------------------------------
create or replace function public.gerar_execucoes_tarefas(p_modelo uuid default null, p_dias int default 56)
returns int
language plpgsql security definer set search_path = public
as $$
declare
  m public.tarefas_modelo;
  d date;
  hoje date := public.r9_hoje();
  criadas int := 0;
  n int;
  p jsonb;
begin
  perform set_config('r9.sync', 'on', true);

  for m in select * from public.tarefas_modelo where ativa and (p_modelo is null or id = p_modelo) loop
    if public.r9_norm(m.recorrencia) in ('nenhuma', '') then
      -- Avulsa: uma única execução (na data ou na fila)
      if not exists (select 1 from public.tarefas where modelo_id = m.id) then
        p := public.tarefa_modelo_payload(m, m.data_inicio);
        insert into public.tarefas (titulo, descricao, prioridade, recorrencia, bucket, tags, responsavel_id,
                                    data_inicio, data_fim, data_agendada, status, campos_customizados, comentarios,
                                    modelo_id, data_prevista)
        select r.titulo, r.descricao, r.prioridade, r.recorrencia, r.bucket, r.tags, r.responsavel_id,
               r.data_inicio, r.data_fim, r.data_agendada, r.status, r.campos_customizados, r.comentarios,
               r.modelo_id, r.data_prevista
        from jsonb_populate_record(null::public.tarefas, p) r
        on conflict do nothing;
        get diagnostics n = row_count;
        criadas := criadas + n;
      end if;
    else
      for d in select g::date from generate_series(greatest(hoje, coalesce(m.data_inicio, hoje)), hoje + p_dias, interval '1 day') g loop
        continue when not public.tarefa_modelo_cobre_data(m, d);
        continue when exists (select 1 from public.tarefas where modelo_id = m.id and data_prevista = d);
        p := public.tarefa_modelo_payload(m, d);
        insert into public.tarefas (titulo, descricao, prioridade, recorrencia, bucket, tags, responsavel_id,
                                    data_inicio, data_fim, data_agendada, status, campos_customizados, comentarios,
                                    modelo_id, data_prevista)
        select r.titulo, r.descricao, r.prioridade, r.recorrencia, r.bucket, r.tags, r.responsavel_id,
               r.data_inicio, r.data_fim, r.data_agendada, r.status, r.campos_customizados, r.comentarios,
               r.modelo_id, r.data_prevista
        from jsonb_populate_record(null::public.tarefas, p) r
        on conflict do nothing;
        get diagnostics n = row_count;
        criadas := criadas + n;
      end loop;
    end if;
  end loop;

  perform set_config('r9.sync', 'off', true);
  return criadas;
end;
$$;

revoke all on function public.gerar_execucoes_tarefas(uuid, int) from public, anon;
grant execute on function public.gerar_execucoes_tarefas(uuid, int) to authenticated;

-- ---------------------------------------------------------------------
-- 4. Migração: cada série atual vira UMA tarefa; os registros viram execuções dela
-- ---------------------------------------------------------------------
do $$
declare
  g record;
  tpl public.tarefas;
  v_id uuid;
  v_resp text[];
  v_dias text[];
  v_rec text;
  v_inicio date;
  v_ativa boolean;
begin
  -- Só na primeira vez (rodar de novo não recria cadastros a partir do histórico)
  if exists (select 1 from public.tarefas_modelo) then
    raise notice 'Migração já feita; pulando.';
    return;
  end if;

  for g in
    select coalesce(t.campos_customizados->>'recurrenceSeriesId', t.id::text) as serie
    from public.tarefas t
    where t.modelo_id is null
    group by 1
  loop
    -- Modelo = ocorrência mais recente da série
    select * into tpl from public.tarefas t
    where coalesce(t.campos_customizados->>'recurrenceSeriesId', t.id::text) = g.serie
    order by coalesce(t.data_agendada, t.data_inicio) desc nulls last, t.created_at desc
    limit 1;

    v_resp := coalesce(
      (select array_agg(x) from jsonb_array_elements_text(
         case when jsonb_typeof(tpl.campos_customizados->'assigneeIds') = 'array' then tpl.campos_customizados->'assigneeIds' else '[]'::jsonb end) x),
      case when tpl.responsavel_id is not null then array[tpl.responsavel_id::text] else '{}'::text[] end);
    v_dias := coalesce(
      (select array_agg(x) from jsonb_array_elements_text(
         case when jsonb_typeof(tpl.campos_customizados->'recurrenceDays') = 'array' then tpl.campos_customizados->'recurrenceDays' else '[]'::jsonb end) x),
      '{}'::text[]);
    v_rec := coalesce(nullif(trim(tpl.recorrencia), ''), 'Nenhuma');
    v_inicio := coalesce(tpl.data_agendada, tpl.data_inicio);

    -- Série recorrente só segue ativa se ainda tem execução em aberto (as abandonadas viram histórico).
    -- Avulsa fica "ativa" (visível no cadastro) enquanto não foi concluída.
    select exists (
      select 1 from public.tarefas t
      where coalesce(t.campos_customizados->>'recurrenceSeriesId', t.id::text) = g.serie
        and coalesce(t.status, 'pendente') <> 'concluida'
    ) into v_ativa;

    insert into public.tarefas_modelo (titulo, descricao, prioridade, bucket, tags, responsaveis_ids, campos,
                                       recorrencia, dias_recorrencia, data_inicio, serie_legada, ativa, criado_por)
    values (
      coalesce(nullif(trim(tpl.titulo), ''), 'Sem título'),
      coalesce(tpl.descricao, ''),
      coalesce(tpl.prioridade, 'Alta'),
      coalesce(tpl.bucket, 'Operacional'),
      coalesce(to_jsonb(tpl.tags), '[]'::jsonb),
      v_resp,
      case when jsonb_typeof(tpl.campos_customizados->'fields') = 'array' then tpl.campos_customizados->'fields' else '[]'::jsonb end,
      v_rec,
      v_dias,
      v_inicio,
      g.serie,
      v_ativa,
      null  -- autor desconhecido: só admins alteram as tarefas antigas
    )
    returning id into v_id;

    -- Liga as execuções; se houver duplicadas no mesmo dia, só a primeira ocupa a data prevista.
    update public.tarefas t
    set modelo_id = v_id,
        data_prevista = case when x.rn = 1 then x.d end
    from (
      select id, coalesce(data_agendada, data_inicio) as d,
             row_number() over (partition by coalesce(data_agendada, data_inicio)
                                order by (status = 'concluida') desc, created_at) as rn
      from public.tarefas
      where coalesce(campos_customizados->>'recurrenceSeriesId', id::text) = g.serie
    ) x
    where t.id = x.id;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 5. Gatilhos do cadastro
-- ---------------------------------------------------------------------
create or replace function public.tarefas_modelo_before_write()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.criado_por := coalesce(auth.uid(), new.criado_por);
    new.criado_em := timezone('utc'::text, now());
  else
    new.criado_por := old.criado_por;  -- autoria não muda
    new.criado_em := old.criado_em;
  end if;
  new.atualizado_em := timezone('utc'::text, now());
  new.atualizado_por := auth.uid();
  new.titulo := trim(new.titulo);
  if new.titulo = '' then raise exception 'A tarefa precisa de um título'; end if;
  -- recorrente sem data de início começa hoje (âncora do dia da semana/mês)
  if public.r9_norm(new.recorrencia) not in ('nenhuma', '') and new.data_inicio is null then
    new.data_inicio := public.r9_hoje();
  end if;
  return new;
end;
$$;

create or replace function public.tarefas_modelo_after_write()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  hoje date := public.r9_hoje();
  p jsonb;
  ignorar constant text[] := array['datas_puladas', 'atualizado_em', 'atualizado_por'];
begin
  -- Só anotou um dia pulado (ou só carimbos): nada a sincronizar
  if tg_op = 'UPDATE' and (to_jsonb(new) - ignorar) = (to_jsonb(old) - ignorar) then
    return null;
  end if;

  perform set_config('r9.sync', 'on', true);

  if tg_op = 'UPDATE' then
    -- a) Execuções futuras pendentes recebem o novo cadastro (respostas e comentários são preservados)
    p := public.tarefa_modelo_payload(new, null);
    update public.tarefas t
    set titulo = r.titulo, descricao = r.descricao, prioridade = r.prioridade, recorrencia = r.recorrencia,
        bucket = r.bucket, tags = r.tags, responsavel_id = r.responsavel_id,
        campos_customizados = coalesce(t.campos_customizados, '{}'::jsonb)
          || jsonb_build_object(
               'fields', new.campos,
               'assigneeIds', to_jsonb(new.responsaveis_ids),
               'recurrenceDays', to_jsonb(new.dias_recorrencia))
    from jsonb_populate_record(null::public.tarefas, p) r
    where t.modelo_id = new.id
      and coalesce(t.status, 'pendente') <> 'concluida'
      and (t.data_prevista is null or t.data_prevista >= hoje);

    -- b) Avulsa: mudou a data → move a execução pendente
    if public.r9_norm(new.recorrencia) in ('nenhuma', '') and new.data_inicio is distinct from old.data_inicio then
      update public.tarefas
      set data_agendada = new.data_inicio, data_inicio = new.data_inicio, data_fim = new.data_inicio, data_prevista = new.data_inicio
      where modelo_id = new.id and coalesce(status, 'pendente') <> 'concluida';
    end if;

    -- c) Mudou a regra (ou foi desativada) → remove execuções futuras que não batem mais
    if (new.recorrencia, new.dias_recorrencia, new.data_inicio, new.data_fim, new.ativa)
       is distinct from (old.recorrencia, old.dias_recorrencia, old.data_inicio, old.data_fim, old.ativa)
       and public.r9_norm(new.recorrencia) not in ('nenhuma', '') then
      delete from public.tarefas
      where modelo_id = new.id
        and coalesce(status, 'pendente') = 'pendente'
        and data_prevista is not null and data_prevista >= hoje
        and (not new.ativa or not public.tarefa_modelo_cobre_data(new, data_prevista));
    end if;

    -- d) Virou recorrente: a execução avulsa pendente vira a do seu dia na regra (ou sai)
    if public.r9_norm(old.recorrencia) in ('nenhuma', '') and public.r9_norm(new.recorrencia) not in ('nenhuma', '') then
      delete from public.tarefas
      where modelo_id = new.id and coalesce(status, 'pendente') = 'pendente'
        and (data_prevista is null or not public.tarefa_modelo_cobre_data(new, data_prevista));
    end if;
  end if;

  perform set_config('r9.sync', 'off', true);
  perform public.gerar_execucoes_tarefas(new.id);
  return null;
end;
$$;

-- Excluir a tarefa: remove as execuções em aberto; as concluídas ficam como histórico
create or replace function public.tarefas_modelo_before_delete()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  perform set_config('r9.sync', 'on', true);
  delete from public.tarefas where modelo_id = old.id and coalesce(status, 'pendente') <> 'concluida';
  -- histórico concluído fica solto (sem cadastro); desligado aqui para o "on delete set null" não esbarrar na proteção
  update public.tarefas set modelo_id = null, data_prevista = null where modelo_id = old.id;
  perform set_config('r9.sync', 'off', true);
  return old;
end;
$$;

create trigger tarefas_modelo_before_write
  before insert or update on public.tarefas_modelo
  for each row execute function public.tarefas_modelo_before_write();
create trigger tarefas_modelo_after_write
  after insert or update on public.tarefas_modelo
  for each row execute function public.tarefas_modelo_after_write();
create trigger tarefas_modelo_before_delete
  before delete on public.tarefas_modelo
  for each row execute function public.tarefas_modelo_before_delete();

-- ---------------------------------------------------------------------
-- 6. Proteção das execuções (tabela tarefas)
-- ---------------------------------------------------------------------
create or replace function public.pode_gerenciar_tarefa(p_modelo uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select public.is_admin_user()
      or (p_modelo is not null and exists (
            select 1 from public.tarefas_modelo where id = p_modelo and criado_por = auth.uid()))
$$;

create or replace function public.tarefas_guard_write()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  -- SQL administrativo/cron (sem usuário) e as rotinas internas passam direto
  if auth.uid() is null or current_setting('r9.sync', true) = 'on' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if not public.is_admin_user() then
      raise exception 'Crie tarefas pelo cadastro (aba Tarefas / Nova tarefa)';
    end if;
    return new;
  end if;

  if public.pode_gerenciar_tarefa(old.modelo_id) then
    return new;
  end if;

  -- Responsável/colega: pode concluir, preencher formulário e comentar; não altera a definição.
  if (new.titulo, new.descricao, new.prioridade, new.recorrencia, new.bucket, new.data_agendada,
      new.modelo_id, new.data_prevista)
     is distinct from
     (old.titulo, old.descricao, old.prioridade, old.recorrencia, old.bucket, old.data_agendada,
      old.modelo_id, old.data_prevista)
     or new.responsavel_id is distinct from old.responsavel_id
     or new.tags::text is distinct from old.tags::text
     or (new.campos_customizados->'fields') is distinct from (old.campos_customizados->'fields')
     or (new.campos_customizados->'assigneeIds') is distinct from (old.campos_customizados->'assigneeIds') then
    raise exception 'Só quem criou a tarefa (ou um admin) pode alterar data, título, responsáveis ou formulário';
  end if;
  return new;
end;
$$;

create or replace function public.tarefas_guard_delete()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if current_setting('r9.sync', true) = 'on' then
    return old;
  end if;
  if auth.uid() is not null and not public.pode_gerenciar_tarefa(old.modelo_id) then
    raise exception 'Só quem criou a tarefa (ou um admin) pode excluí-la';
  end if;
  return old;
end;
$$;

-- Depois de excluir uma execução de tarefa recorrente: anota o dia para o gerador não recriá-lo
create or replace function public.tarefas_after_delete()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if current_setting('r9.sync', true) is distinct from 'on'
     and old.modelo_id is not null and old.data_prevista is not null then
    update public.tarefas_modelo
    set datas_puladas = array_append(datas_puladas, old.data_prevista)
    where id = old.modelo_id and not (old.data_prevista = any(datas_puladas));
  end if;
  return null;
end;
$$;

create trigger tarefas_guard_write
  before insert or update on public.tarefas
  for each row execute function public.tarefas_guard_write();
create trigger tarefas_guard_delete
  before delete on public.tarefas
  for each row execute function public.tarefas_guard_delete();
create trigger tarefas_after_delete
  after delete on public.tarefas
  for each row execute function public.tarefas_after_delete();

-- ---------------------------------------------------------------------
-- 7. RLS do cadastro
-- ---------------------------------------------------------------------
alter table public.tarefas_modelo enable row level security;

drop policy if exists "Somente usuários autorizados" on public.tarefas_modelo;
create policy "Somente usuários autorizados" on public.tarefas_modelo as restrictive for all to anon, authenticated
  using (public.is_approved_user()) with check (public.is_approved_user());

drop policy if exists "Tarefas visíveis por todos" on public.tarefas_modelo;
create policy "Tarefas visíveis por todos" on public.tarefas_modelo
  for select using (auth.role() = 'authenticated');

drop policy if exists "Todos criam tarefas" on public.tarefas_modelo;
create policy "Todos criam tarefas" on public.tarefas_modelo
  for insert with check (auth.role() = 'authenticated' and criado_por = auth.uid());

drop policy if exists "Autor ou admin altera tarefa" on public.tarefas_modelo;
create policy "Autor ou admin altera tarefa" on public.tarefas_modelo
  for update using (criado_por = auth.uid() or public.is_admin_user())
  with check (criado_por = auth.uid() or public.is_admin_user());

drop policy if exists "Autor ou admin exclui tarefa" on public.tarefas_modelo;
create policy "Autor ou admin exclui tarefa" on public.tarefas_modelo
  for delete using (criado_por = auth.uid() or public.is_admin_user());

-- Tempo real para a aba Tarefas
do $$ begin
  alter publication supabase_realtime add table public.tarefas_modelo;
exception when others then null;
end $$;

-- ---------------------------------------------------------------------
-- 8. Horizonte: gera agora e agenda a extensão diária (se o pg_cron estiver disponível)
-- ---------------------------------------------------------------------
select public.gerar_execucoes_tarefas() as execucoes_criadas_agora;

do $$
begin
  create extension if not exists pg_cron;
  if exists (select 1 from cron.job where jobname = 'r9-gerar-execucoes') then
    perform cron.unschedule('r9-gerar-execucoes');
  end if;
  perform cron.schedule('r9-gerar-execucoes', '0 6 * * *', 'select public.gerar_execucoes_tarefas()');
exception when others then
  raise notice 'pg_cron indisponível (%). O app chama o gerador ao abrir o Planejamento.', sqlerrm;
end $$;

-- ---------------------------------------------------------------------
-- 9. Conferência: as tarefas cadastradas e quantas execuções cada uma tem
-- ---------------------------------------------------------------------
select m.titulo, m.recorrencia, m.ativa,
       count(t.id) filter (where t.status = 'concluida') as concluidas,
       count(t.id) filter (where coalesce(t.status, 'pendente') <> 'concluida') as em_aberto,
       min(t.data_prevista) filter (where t.data_prevista >= public.r9_hoje()) as proxima
from public.tarefas_modelo m
left join public.tarefas t on t.modelo_id = m.id
group by m.id
order by m.ativa desc, m.titulo;
