# R9 Sales + Planner — Revamp de UI/UX

## Mudanças aplicadas

- Navegação do Planner movida para o menu lateral principal do R9 Sales, em um submenu expansível.
- Removido da experiência integrada o menu lateral interno do Planner, eliminando a duplicidade de perfil, navegação e administração.
- Calendário ampliado para usar a área principal disponível do Sales.
- Cabeçalho interno do Planner adaptado para o padrão do R9 Sales e sem nome de usuário / botão de sair duplicados.
- Fila de tarefas exposta pelo menu principal; nessa visão, o calendário permanece visível junto à fila para manter o arrastar-e-soltar entre fila e dias.
- Minhas tarefas colocada no submenu do Planejamento.
- Tags e categorias colocadas no submenu do Planejamento, disponível apenas para administradores em modo Admin.
- Resumo Executivo Semanal movido para a seção Desempenho da navegação do Sales.
- O acesso a Gerenciar Equipe usa o menu de Administração já existente no R9 Sales; a segunda navegação interna do Planner fica oculta no modo integrado.
- Rótulos da fila ajustados para português.

## Preservação

- Nenhuma migração SQL foi incluída ou executada.
- Nenhuma alteração foi feita no Supabase.
- Os serviços de criação/edição/exclusão, recorrência, formulários e permissões de tarefas foram mantidos sem alterações funcionais intencionais nesta etapa visual.

## Validação

- Os quatro arquivos TypeScript/TSX modificados/criados foram analisados com o parser TypeScript (sintaxe OK).
- Não foi possível concluir `npm install` neste ambiente dentro do tempo limite; portanto, o build completo não está confirmado.

## Teste local recomendado

1. Abrir Planejamento pelo menu principal e confirmar que há apenas uma sidebar de navegação.
2. Entrar em Calendário, Minhas tarefas, Fila de tarefas e Tags e categorias.
3. Na Fila, arrastar uma ação para um dia e arrastar uma ação do calendário de volta à fila.
4. Abrir Resumo semanal na seção Desempenho.
5. Abrir Gerenciar Equipe pelo menu de Administração do R9 Sales e confirmar que não aparece outro gerenciador de equipe dentro do Planner.
6. Testar criação, edição, exclusão e recorrência para garantir que a revisão visual não alterou esses fluxos.
