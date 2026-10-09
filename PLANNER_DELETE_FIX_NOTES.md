# Correção da exclusão de tarefas

- A autorização do handler de exclusão agora usa `isRealAdmin`, derivado do perfil real do usuário, em vez de `userRole`, que é alterado pelo seletor de visualização Admin/Membro.
- Isso evita que o modo de visualização simulado bloqueie operações administrativas legítimas.
- O serviço de exclusão continua exigindo confirmação do ID retornado pelo Supabase; se a RLS bloquear ou remover zero linhas, a tarefa não é removida da interface e um aviso é exibido.
- Se o Supabase ainda bloquear exclusões, revisar `PLANNER_DELETE_RLS.sql` antes de executá-lo no projeto principal.
