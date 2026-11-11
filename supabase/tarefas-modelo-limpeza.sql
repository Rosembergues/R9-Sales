-- =====================================================================
-- R9 Hub · Limpeza pós-migração das tarefas
--
-- Ocorrências antigas gravadas sem código de série viraram, na migração,
-- "cadastros" inativos com uma única execução concluída. Este script junta
-- cada um deles à tarefa ATIVA de mesmo nome (ignorando maiúsculas/espaços)
-- e apaga o cadastro que ficou vazio. Nenhuma execução é apagada.
--
-- Rodar no Supabase: SQL Editor → colar tudo → Run. Pode rodar mais de uma vez.
-- =====================================================================

do $$
declare
  frag record;
  alvo uuid;
  ex record;
  juntados int := 0;
  -- Nomes antigos que mudaram: nome antigo → nome atual
  renomeados constant jsonb := '{"class. técnico": "classificados técnico"}'::jsonb;
begin
  for frag in
    select m.id, lower(trim(m.titulo)) as nome
    from public.tarefas_modelo m
    where not m.ativa
  loop
    select a.id into alvo
    from public.tarefas_modelo a
    where a.ativa
      and lower(trim(a.titulo)) = coalesce(renomeados->>frag.nome, frag.nome)
    order by a.criado_em
    limit 1;

    continue when alvo is null;

    -- Uma execução por vez: se a tarefa ativa já tem aquele dia previsto, a antiga entra sem data prevista.
    for ex in select id, data_prevista from public.tarefas where modelo_id = frag.id loop
      update public.tarefas t
      set modelo_id = alvo,
          data_prevista = case
            when ex.data_prevista is not null and not exists (
              select 1 from public.tarefas o where o.modelo_id = alvo and o.data_prevista = ex.data_prevista)
            then ex.data_prevista end
      where t.id = ex.id;
    end loop;

    delete from public.tarefas_modelo where id = frag.id;
    juntados := juntados + 1;
  end loop;

  raise notice '% cadastros fragmentados juntados às tarefas ativas', juntados;
end $$;

-- Conferência: o que sobrou de cadastro inativo (deveria ser só histórico real, de tarefas que não existem mais)
select titulo, recorrencia, count(*) as cadastros_inativos
from public.tarefas_modelo
where not ativa
group by 1, 2
order by 1;

-- E as tarefas ativas, agora com o histórico completo
select m.titulo, m.recorrencia,
       count(t.id) filter (where t.status = 'concluida') as concluidas,
       count(t.id) filter (where coalesce(t.status, 'pendente') <> 'concluida') as em_aberto
from public.tarefas_modelo m
left join public.tarefas t on t.modelo_id = m.id
where m.ativa
group by m.id
order by m.titulo;
