# Correção do erro de lançamento de vendas

## Causa identificada
O Supabase rejeitava o payload alternativo com `PGRST204` porque a tabela `public.sales` em produção não possui a coluna `client_email`. O campo era enviado mesmo quando vazio/nulo.

## Correção aplicada
- Removido `client_email` do payload padrão usado pelo fluxo de inserção/compatibilidade.
- A correção não altera o banco de dados nem remove dados.
- Os demais campos, o payload principal R9 e os ajustes mais recentes de interface foram preservados.

## Validação
- Conferida a alteração no construtor do payload padrão.
- O ZIP passou na verificação de integridade.
- O build completo precisa ser executado com as dependências instaladas.
- Após publicar, teste um lançamento de venda e confira se ele aparece na listagem antes de orientar a equipe a repetir lançamentos pendentes.
