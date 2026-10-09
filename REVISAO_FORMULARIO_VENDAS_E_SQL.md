# Revisão do formulário de vendas e SQL

## Causa confirmada
O erro `record "new" has no field "collaborator_id"` é gerado pelo trigger `protect_sale_owner_fields`. A tabela `public.sales` não possui essa coluna; a coluna real de autoria é `seller_id`. A remoção de campos do payload não corrige um trigger do banco.

## Correções
- Trigger ajustado para validar `seller_id`.
- `collaborator_id` é preservado apenas em `custom_data`.
- SQL de segurança e script de configuração embutido alinhados.
- Índice passa a usar `seller_id`.
- Payload continua sem `client_email` e `client_phone` como colunas.

## Ação obrigatória
Execute `SUPABASE_CORRIGIR_TRIGGER_VENDAS.sql` no SQL Editor do Supabase antes de testar. Publicar apenas o frontend não corrige o trigger instalado no banco.

Build completo e teste conectado ao banco ainda precisam ser executados.
