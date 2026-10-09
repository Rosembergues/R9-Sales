# R9 Planner — revisão profunda do fluxo de tarefas

## Correções incluídas

1. **Criação direta em um dia do calendário:** `NewTaskModal` mantinha o estado inicial de `scheduleType` e `scheduledDate` entre aberturas. Ao abrir o modal com outra data, o estado interno podia continuar como fila e a tarefa era salva sem `data_agendada`. O componente agora é remontado quando o modal abre/fecha ou a data padrão muda, garantindo que o formulário reflita o dia selecionado.
2. **Navegação semanal/mensal:** a camada de serviço normaliza `data_agendada` para `YYYY-MM-DD` ao converter os registros. As views semanal e mensal comparam as chaves de data nesse formato, evitando comparar um timestamp PostgreSQL com uma string de data.
3. **Recorrência:** a próxima ocorrência só é tentada após o Supabase confirmar que a tarefa original foi atualizada. Antes, um `UPDATE` filtrado por RLS podia retornar sem erro e sem atualizar nenhuma linha, e o fluxo continuava como se a conclusão tivesse sido salva.
4. **Deduplicação de recorrência:** a verificação agora usa `recurrenceSeriesId` no JSONB, em vez de bloquear por título global. Isso evita que uma tarefa independente com o mesmo título na mesma data impeça a recorrência. As próximas ocorrências herdam esse identificador de série.
5. **Diagnóstico:** logs explícitos foram adicionados para diferenciar falha de gravação, ausência de linha atualizada, erro ao verificar duplicidade e falha ao calcular a próxima data.

## Validações necessárias no ambiente do usuário

Não foi possível executar `npm install` neste ambiente dentro do tempo disponível; portanto `npm run lint` e `npm run build` não foram confirmados aqui.

Antes de publicar, executar:

- `npm install`
- `npm run lint`
- `npm run build`

## Roteiro funcional obrigatório

1. Abrir Nova Tarefa a partir do botão geral e criar uma tarefa na fila; confirmar `data_agendada IS NULL`.
2. Clicar no `+` de um dia específico e criar tarefa; confirmar no Supabase que `data_agendada` corresponde à data clicada e que ela aparece nessa coluna.
3. Navegar para outra semana e voltar; a tarefa deve continuar aparecendo na semana da data gravada.
4. Arrastar tarefa da fila para o calendário e entre datas; confirmar persistência após recarregar.
5. Criar uma recorrência personalizada e concluir como responsável; confirmar a próxima data selecionada, status `pendente`, valores de formulário reiniciados e `recurrenceSeriesId` preservado.
6. Criar duas tarefas diferentes com o mesmo título; concluir uma recorrente e confirmar que a outra não bloqueia a geração da próxima ocorrência.
7. Testar tarefa com múltiplos responsáveis: a recorrência deve nascer somente quando todos os responsáveis concluírem, conforme a regra original.
8. Testar admin e membro para confirmar que bloqueios RLS são exibidos como erro e não tratados como sucesso.

Nenhuma alteração foi executada no Supabase. Este ZIP contém apenas mudanças no código e documentação.
