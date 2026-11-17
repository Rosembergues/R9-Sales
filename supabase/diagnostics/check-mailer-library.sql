-- R9Bot Mailer: diagnóstico somente leitura da biblioteca compartilhada.
-- Execute no Supabase SQL Editor. Não altera dados.

WITH expected_columns(table_name, column_name) AS (
  VALUES
    ('mailer_library_admins', 'user_id'),
    ('mailer_library_admins', 'created_at'),
    ('mailer_templates', 'id'),
    ('mailer_templates', 'name'),
    ('mailer_templates', 'subject'),
    ('mailer_templates', 'description'),
    ('mailer_templates', 'blocks'),
    ('mailer_templates', 'email_data'),
    ('mailer_templates', 'is_public'),
    ('mailer_templates', 'created_by'),
    ('mailer_templates', 'updated_by'),
    ('mailer_templates', 'created_at'),
    ('mailer_templates', 'updated_at'),
    ('mailer_template_versions', 'id'),
    ('mailer_template_versions', 'template_id'),
    ('mailer_template_versions', 'version_number'),
    ('mailer_template_versions', 'name'),
    ('mailer_template_versions', 'subject'),
    ('mailer_template_versions', 'blocks'),
    ('mailer_template_versions', 'email_data'),
    ('mailer_template_versions', 'created_by'),
    ('mailer_template_versions', 'created_at'),
    ('mailer_drafts', 'user_id'),
    ('mailer_drafts', 'document_id'),
    ('mailer_drafts', 'source_template_id'),
    ('mailer_drafts', 'blocks'),
    ('mailer_drafts', 'email_data'),
    ('mailer_drafts', 'saved_at')
)
SELECT
  'COLUNA' AS tipo,
  e.table_name AS objeto,
  e.column_name AS detalhe,
  CASE WHEN c.column_name IS NULL THEN 'FALTA' ELSE 'OK' END AS resultado
FROM expected_columns e
LEFT JOIN information_schema.columns c
  ON c.table_schema = 'public'
 AND c.table_name = e.table_name
 AND c.column_name = e.column_name

UNION ALL

SELECT
  'RLS',
  t.table_name,
  'row level security',
  CASE WHEN cls.relrowsecurity THEN 'OK' ELSE 'FALTA' END
FROM (VALUES
  ('mailer_library_admins'),
  ('mailer_templates'),
  ('mailer_template_versions'),
  ('mailer_drafts')
) AS t(table_name)
LEFT JOIN pg_class cls ON cls.oid = to_regclass('public.' || t.table_name)

UNION ALL

SELECT
  'FUNÇÃO',
  fn.function_name,
  'public.' || fn.function_name,
  CASE WHEN p.oid IS NULL THEN 'FALTA' ELSE 'OK' END
FROM (VALUES
  ('is_mailer_library_admin'),
  ('enforce_mailer_template_identity'),
  ('record_mailer_template_version')
) AS fn(function_name)
LEFT JOIN pg_proc p
  ON p.pronamespace = 'public'::regnamespace
 AND p.proname = fn.function_name

UNION ALL

SELECT
  'POLÍTICA',
  t.table_name,
  COALESCE(p.policyname, 'nenhuma política encontrada'),
  CASE WHEN p.policyname IS NULL THEN 'FALTA' ELSE 'OK' END
FROM (VALUES
  ('mailer_library_admins'),
  ('mailer_templates'),
  ('mailer_template_versions'),
  ('mailer_drafts')
) AS t(table_name)
LEFT JOIN pg_policies p
  ON p.schemaname = 'public'
 AND p.tablename = t.table_name

ORDER BY tipo, objeto, detalhe;

-- Políticas e comandos efetivos (resultado separado):
SELECT schemaname, tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'mailer_library_admins',
    'mailer_templates',
    'mailer_template_versions',
    'mailer_drafts'
  )
ORDER BY tablename, cmd, policyname;

-- Contagem de administradores cadastrados:
SELECT count(*) AS administradores_cadastrados
FROM public.mailer_library_admins;
