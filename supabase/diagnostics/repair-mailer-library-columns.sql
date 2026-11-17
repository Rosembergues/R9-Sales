-- R9Bot Mailer: reparo aditivo e seguro de colunas usadas pela publicação.
-- Pode ser executado depois da migração inicial. Não apaga registros.
-- Adiciona apenas colunas ausentes e preenche metadados de versões existentes.

-- A versão atual do editor consulta estes campos ao publicar um modelo.
alter table public.mailer_templates
  add column if not exists subject text not null default 'E-mail sem assunto';
alter table public.mailer_templates
  add column if not exists description text not null default '';
alter table public.mailer_templates
  add column if not exists created_at timestamptz not null default now();
alter table public.mailer_templates
  add column if not exists updated_at timestamptz not null default now();

-- O histórico consulta todos estes campos. Em bancos que já tinham uma tabela
-- de versões antiga, CREATE TABLE IF NOT EXISTS não acrescenta colunas ausentes.
alter table public.mailer_template_versions
  add column if not exists id uuid default gen_random_uuid();
alter table public.mailer_template_versions
  add column if not exists name text not null default 'Modelo sem nome';
alter table public.mailer_template_versions
  add column if not exists subject text not null default 'E-mail sem assunto';
alter table public.mailer_template_versions
  add column if not exists email_data jsonb not null default '{}'::jsonb;
alter table public.mailer_template_versions
  add column if not exists created_by uuid references auth.users(id) on delete restrict;
alter table public.mailer_template_versions
  add column if not exists created_at timestamptz not null default now();

-- Preenche metadados ausentes com os valores atuais do modelo pai quando disponíveis.
update public.mailer_template_versions v
set
  name = coalesce(nullif(v.name, ''), t.name, 'Modelo sem nome'),
  subject = coalesce(nullif(v.subject, ''), t.subject, 'E-mail sem assunto'),
  email_data = coalesce(v.email_data, t.email_data, '{}'::jsonb),
  created_by = coalesce(v.created_by, t.updated_by, t.created_by),
  created_at = coalesce(v.created_at, t.updated_at, now())
from public.mailer_templates t
where t.id = v.template_id;

-- Atualiza a API do Supabase/PostgREST para ler o schema após o reparo.
notify pgrst, 'reload schema';

-- Confirma os campos necessários. Todo resultado deve ser OK.
with expected(table_name, column_name) as (
  values
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
    ('mailer_template_versions', 'created_at')
)
select
  e.table_name,
  e.column_name,
  case when c.column_name is null then 'FALTA' else 'OK' end as resultado
from expected e
left join information_schema.columns c
  on c.table_schema = 'public'
 and c.table_name = e.table_name
 and c.column_name = e.column_name
order by e.table_name, e.column_name;
