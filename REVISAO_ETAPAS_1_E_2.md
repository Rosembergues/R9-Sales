# R9 Sales — Correções das etapas 1 e 2

## Etapa 1 — Banco e metas
- Corrigido o `upsert` de `goals` para usar `onConflict: user_id,type,reference_start`, compatível com a constraint `goals_user_type_ref_unique` do SQL do projeto.
- Removido `academic_period` do payload de `goals`: o campo pertence a `goal_periods`, e não existe em `goals` no schema do projeto. O vínculo é preservado por `goal_period_id`.
- Alinhado o SQL de setup de `sales` com o esquema de produção informado: não declara `collaborator_id`, `client_phone` ou `client_email` como colunas físicas; inclui `campaign_name`, `value`, `payment_method`, `status` e `commission`. Os dados de compatibilidade `collaborator_id` podem continuar dentro de `custom_data`.
- Removida a referência física a `collaborator_id` da política de exclusão e removido índice duplicado de `seller_id`.
- O setup não instala mais trigger `set_sales_updated_at`, pois a lista de colunas de produção fornecida não inclui `updated_at` em `sales`.

## Etapa 2 — Vendas
- O seletor de consultor no formulário de nova venda fica habilitado apenas para administradores.
- Para usuários comuns, o responsável é forçado ao usuário logado também no submit, além de ser fixado na interface. A proteção no banco continua necessária.
- A carga inicial de vendas agora pagina em blocos de 500, evitando truncamento no limite padrão do PostgREST.
- A meta do leaderboard legado passou a usar `profiles.target_monthly` com fallback de 30; a contagem para esse indicador considera o mês atual para que o percentual seja comparável à meta mensal.

## Validação e limites
- Foram conferidos os usos de `academic_period` e as referências físicas a `collaborator_id` no script de setup.
- O ZIP passou pela verificação de integridade.
- Build/testes integrados com Supabase não foram executados neste ambiente.
- Importante: editar o SQL de setup não altera automaticamente o banco remoto. Para o banco existente, mudanças de triggers/policies devem ser aplicadas como migração separada; estas alterações de código não executam SQL no Supabase.
