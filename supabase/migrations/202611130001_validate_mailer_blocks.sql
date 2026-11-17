-- R9Bot Mailer: structural checks for block payloads.
-- The client normalizes blocks on read and write; these constraints reject
-- malformed payloads written directly through the API (non-array, oversized).
-- NOT VALID keeps existing rows untouched while enforcing the rule on new writes.

alter table public.mailer_templates drop constraint if exists mailer_templates_blocks_shape;
alter table public.mailer_templates
  add constraint mailer_templates_blocks_shape
  check (jsonb_typeof(blocks) = 'array' and jsonb_array_length(blocks) <= 500 and pg_column_size(blocks) <= 2000000)
  not valid;

alter table public.mailer_template_versions drop constraint if exists mailer_template_versions_blocks_shape;
alter table public.mailer_template_versions
  add constraint mailer_template_versions_blocks_shape
  check (jsonb_typeof(blocks) = 'array' and pg_column_size(blocks) <= 2000000)
  not valid;

alter table public.mailer_drafts drop constraint if exists mailer_drafts_blocks_shape;
alter table public.mailer_drafts
  add constraint mailer_drafts_blocks_shape
  check (jsonb_typeof(blocks) = 'array' and jsonb_array_length(blocks) <= 500 and pg_column_size(blocks) <= 2000000)
  not valid;
