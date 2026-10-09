# Correção do erro de cadastro de vendas (PGRST204)

## O que a captura revelou
A tabela `sales` no Supabase não possui `client_phone`. O fluxo anterior tentava outro payload, falhava novamente e, mesmo assim, retornava `success: true`, exibindo “Venda registrada!”. Esse falso positivo foi corrigido.

## Alterações
- Removido `client_phone` do payload alternativo; os dados de formulário continuam preservados em `custom_data`.
- O cadastro tenta os formatos R9 e padrão. Se o Supabase indicar explicitamente uma coluna inexistente no schema cache, essa coluna é omitida e a tentativa é repetida, até 12 colunas por formato.
- Erros de permissão, validação ou outros erros que não sejam de coluna inexistente não são contornados.
- Se ambas as tentativas falharem, a venda fica na fila local de sincronização, mas a interface recebe `success: false` e não deve afirmar que foi registrada no servidor.
- Não há alteração ou remoção de dados no banco.

## Teste obrigatório após publicar
1. Fazer um único lançamento de teste.
2. Confirmar que a venda aparece na lista após atualizar a página.
3. Se houver erro, copiar a mensagem mais recente do console e verificar se a venda ficou apenas na fila local antes de tentar novamente.

O build completo ainda precisa ser executado com as dependências instaladas.
