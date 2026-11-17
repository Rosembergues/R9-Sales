import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createDocumentId } from '../src/utils/templateStore';

describe('shared template library contract', () => {
  it('generates unique UUID document identifiers for Supabase records', () => {
    const first = createDocumentId();
    const second = createDocumentId();
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(first).toMatch(uuidPattern);
    expect(second).toMatch(uuidPattern);
    expect(second).not.toBe(first);
  });

  it('defines online library and private cloud drafts with RLS policies', () => {
    const migrationPath = resolve(process.cwd(), 'supabase/migrations/202610160001_shared_mailer_library.sql');
    const sql = readFileSync(migrationPath, 'utf8');
    expect(sql).toContain('create table if not exists public.mailer_templates');
    expect(sql).toContain('create table if not exists public.mailer_template_versions');
    expect(sql).toContain('create table if not exists public.mailer_drafts');
    expect(sql).toContain('source_template_id uuid references public.mailer_templates(id) on delete set null');
    expect(sql).toContain('Only admins can delete mailer templates');
    expect(sql).toContain('Owners and admins can update mailer templates');
    expect(sql).toContain('Users can read their own drafts');
    expect(sql).toContain('Template ownership cannot be changed');
  });
});
