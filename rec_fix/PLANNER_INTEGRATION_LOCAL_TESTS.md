# R9 Planner integrado ao R9 Sales — testes locais

## O que mudou nesta etapa

- O Planner foi incorporado em `src/planner/` e aparece na navegação do R9 Sales como **Planejamento**.
- O módulo recebe a identidade do usuário autenticado pelo contexto do R9 Sales; não inicia uma segunda sessão nem apresenta login próprio.
- As consultas de identidade foram direcionadas à tabela `profiles` do R9 Sales.
- O mapeamento de papel traduz `admin` para administrador e `seller` para membro operacional do Planner.
- Os serviços do Planner usam o cliente Supabase compartilhado em `src/lib/supabase.ts`.
- Os arquivos e tabelas comerciais existentes não foram modificados.

## Importante: esta entrega não migra dados nem altera o banco remoto

Nenhum SQL foi executado em Supabase. Nenhuma tarefa foi copiada ou modificada. O módulo precisa das tabelas `tarefas`, `tags_bucket`, `templates_acao` e `respostas_formulario` no banco de destino para carregar dados reais. Antes de habilitar gravações, ainda é necessário preparar e revisar a migração de teste, mapear os IDs antigos dos responsáveis por e-mail e revisar as políticas RLS.

Até concluir essa etapa, teste a compilação e a navegação localmente. Não use as ações de criação/edição do Planner contra um ambiente com dados reais.

## Executar localmente

1. Extraia este ZIP para uma pasta de trabalho.
2. Instale as dependências com `npm install`.
3. Configure `.env` a partir de `.env.example` com as credenciais do ambiente de teste autorizado.
4. Execute `npm run dev`.
5. Execute `npm run lint` e `npm run build` antes de considerar a integração validada.

## Próxima etapa obrigatória

1. Criar um plano de migração reversível para as tabelas do Planner.
2. Validar a correspondência dos dez perfis pelo e-mail.
3. Reescrever as referências de responsáveis em `responsavel_id` e nos campos JSON (`assigneeIds`, `userSubmissions` e outros campos confirmados no código), preservando o conteúdo restante.
4. Criar políticas RLS por papel e atribuição, sem manter as permissões abertas do banco antigo.
5. Executar a migração em ambiente de teste e comparar contagens e amostras antes de qualquer publicação.
