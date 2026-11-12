# Banco de dados (Supabase)

Todos os scripts são rodados no Supabase em **SQL Editor → colar o arquivo inteiro → Run**.
Todos podem ser rodados mais de uma vez sem estragar nada, exceto quando o próprio arquivo avisa.

## Montar um banco do zero (na ordem)

| # | Arquivo | O que faz |
|---|---------|-----------|
| 1 | `schema.sql` | Tabelas principais (perfis, metas, importações de metas, vendas, mensagens, tarefas, tags) com RLS e gatilhos. |
| 2 | `vendas-ajustes.sql` | Colunas de vendas que o app grava, regra "consultor lança para colega" e correções de vendas antigas. |
| 3 | `vendas-duplicadas.sql` | Lista vendas com a mesma oportunidade e cria o índice que impede duplicar. Pode pedir para resolver duplicadas antes. |
| 4 | `comparador-precos.sql` | Tabelas do Comparador de Preços (importações, cursos, limite de ofensividade). |
| 5 | `acesso-autorizacao.sql` | Cadastro só com @estacio.br/@yduqs.com.br, aprovação por admin e a trava "somente usuários autorizados" em **todas** as tabelas existentes. |
| 6 | `tarefas-modelo.sql` | Planejamento: cadastro de tarefas × execuções, gerador de execuções e regras de quem edita. |
| 7 | `metas-pesos.sql` | Peso de cada consultor por BU e marcação de ajuste manual nas metas. |
| 8 | `equipe-protecoes.sql` | Só admin muda função; ninguém se bloqueia; o último admin não pode ser removido. |
| 9 | `vendas-completas.sql` | Recusa venda nova incompleta e mostra quantas vendas antigas estão incompletas. |

`tarefas-modelo-limpeza.sql` foi uma limpeza única, depois da migração das tarefas antigas. Não precisa rodar num banco novo.

> Tabela nova criada depois do passo 5 precisa da sua própria política
> "Somente usuários autorizados" (veja `metas-pesos.sql` como exemplo), ou o passo 5 deve ser rodado de novo.

## Regras que valem para qualquer SQL novo

- **`profiles.id` é texto** no banco em produção. Coluna que aponta para um perfil é `text`, e comparações usam `auth.uid()::text`.
- Comece o arquivo com um cabeçalho dizendo o que ele faz e se pode rodar mais de uma vez.
- Prefira `create ... if not exists`, `drop policy if exists` e `create or replace function` para o script poder ser repetido.
- Rotinas chamadas pelo SQL Editor não têm `auth.uid()` (fica nulo); os gatilhos de proteção deixam essas passar.
