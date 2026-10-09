-- Use somente se a exclusão ainda for bloqueada pelo Supabase após a correção do frontend.
-- Confirme antes que profiles.role contém 'admin' e profiles.status='active'.
-- A policy usa o e-mail autenticado para mapear a sessão para profiles.

DROP POLICY IF EXISTS "planner_tasks_delete_admin" ON public.tarefas;
CREATE POLICY "planner_tasks_delete_admin"
ON public.tarefas
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE lower(p.email) = lower(auth.jwt() ->> 'email')
      AND p.role = 'admin'
      AND COALESCE(p.status, 'active') = 'active'
  )
);

GRANT DELETE ON public.tarefas TO authenticated;
NOTIFY pgrst, 'reload schema';
