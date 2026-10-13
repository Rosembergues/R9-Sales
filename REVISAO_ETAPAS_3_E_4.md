# R9 Sales — Correções das etapas 3 e 4

## Etapa 3 — Planner
- `taskService.updateTask()` agora solicita `.select('id')` e trata retorno sem linhas como falha, evitando broadcast de sucesso quando RLS não permitiu alterar a tarefa.
- `taskService.updateScheduledDate()` faz a mesma verificação; isso permite ao Drag & Drop identificar tanto erros SQL quanto atualizações que afetaram zero linhas.
- No listener Realtime de DELETE, `payload.old?.id` é validado antes de atualizar a tela; payload incompleto não causa exceção.
- Os dois fluxos de Drag & Drop guardam a tarefa anterior e restauram a posição se a persistência falhar.

## Etapa 4 — Cache e recorrência
- `updateSale()` atualiza o cache local mesmo quando a venda editada não está no array atualmente carregado/paginado. O cache completo é lido, a venda é substituída pelo ID ou acrescentada se não existia, e então salvo sem descartar outras vendas locais.
- A verificação de recorrência existente usa `.contains('campos_customizados', ...)`, que pressupõe JSONB. O código já falha de forma segura quando a consulta de duplicidade retorna erro: não cria a ocorrência se não conseguiu verificar duplicidade. Não foi adicionado fallback em memória porque isso poderia deixar de encontrar duplicatas fora do limite consultado e gerar recorrências duplicadas. A coluna precisa ser confirmada como `jsonb` no banco real antes de qualquer mudança de estratégia.

## Validação e limites
- As alterações foram revisadas diretamente nos arquivos modificados e o ZIP foi verificado quanto à integridade.
- O build completo e testes conectados ao Supabase não foram executados neste ambiente por falta das dependências instaladas.
- Não foi executado SQL no banco remoto; estas mudanças são de frontend/serviços.
