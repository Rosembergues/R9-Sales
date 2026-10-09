# Correções do Planner: recorrência e navegação entre semanas

## O que foi ajustado
- Datas de `data_agendada`, `data_inicio` e valores equivalentes agora são normalizadas para `YYYY-MM-DD` ao mapear os registros do Supabase. Isso corrige a comparação exata usada nas colunas semanais/mensais quando o banco devolve timestamps como `2026-10-09 00:00:00+00`.
- A geração da próxima ocorrência normaliza a data-base antes de calcular a recorrência.
- A verificação de duplicidade de ocorrências busca tarefas do mesmo título e compara as datas normalizadas no cliente, em vez de depender de igualdade de timestamp no filtro PostgREST.

## Testes pendentes
A instalação de dependências excedeu o limite de tempo deste ambiente, portanto `npm run lint` e `npm run build` não puderam ser executados. Validar localmente antes de publicar.

## Teste recomendado
1. Abra uma tarefa agendada e navegue para outra semana e volte; a tarefa deve continuar aparecendo na semana correspondente.
2. Crie uma tarefa com recorrência personalizada para os dias de semana selecionados.
3. Conclua a tarefa como responsável; deve ser criada uma ocorrência pendente na próxima data elegível.
4. Confirme no Supabase que a nova ocorrência tem `data_agendada` como data correta e os campos personalizados reiniciados.
