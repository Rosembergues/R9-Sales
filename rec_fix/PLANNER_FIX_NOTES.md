# Correção do desaparecimento da tarefa após criação

## Causa identificada
Os componentes `NewTaskModal`, `TaskDetailModal` e `TaskCompletionModal` executavam `return null` antes de chamar seus hooks (`useState`, `useMemo` e/ou `useEffect`). Quando o modal abria/fechava ou a tarefa mudava de `null` para um objeto, o número/ordem de hooks mudava entre renders, podendo provocar o erro React `Expected static flag was missing`.

## Alteração
Os três componentes agora usam um wrapper que verifica se devem ser exibidos e monta um componente interno separado para os hooks. Assim, os hooks não são condicionais dentro do mesmo componente.

## Banco de dados
Nenhuma alteração foi feita no Supabase. O registro já confirmado no banco permanece lá. A correção trata o erro de renderização no cliente; ela não apaga nem recria tarefas.

## Validação
O build não foi executado neste ambiente porque `npm install` excedeu o tempo limite e não foi possível instalar as dependências. Execute localmente:

```bash
npm install
npm run lint
npm run build
npm run dev
```

Teste: criar tarefa, verificar que ela permanece visível após fechar o modal, abrir seus detalhes e fechar o modal; depois abrir/concluir uma tarefa com formulário.
