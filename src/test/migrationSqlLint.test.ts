import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { lintMigrationSql } from '@/services/migrationSqlLint';

const GOOD = `
CREATE TABLE public.widgets (id uuid primary key, user_id uuid not null);
GRANT SELECT, INSERT ON public.widgets TO authenticated;
GRANT ALL ON public.widgets TO service_role;
ALTER TABLE public.widgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "widgets_owner" ON public.widgets FOR SELECT USING (auth.uid() = user_id);
`;

describe('lintMigrationSql', () => {
  it('passes a fully-granted, RLS-protected table', () => {
    const result = lintMigrationSql(GOOD);
    expect(result.ok).toBe(true);
    expect(result.createdTables).toContain('widgets');
  });

  it('blocks a created table without GRANT, RLS or policy', () => {
    const result = lintMigrationSql('CREATE TABLE public.widgets (id uuid primary key);');
    expect(result.ok).toBe(false);
    const codes = result.blockers.map((b) => b.code);
    expect(codes).toEqual(expect.arrayContaining(['missing-grant', 'missing-rls', 'missing-policy']));
  });

  it('blocks managed-schema and destructive statements', () => {
    expect(lintMigrationSql('DROP TABLE public.widgets;').ok).toBe(false);
    expect(lintMigrationSql('CREATE TABLE auth.users_extra (id uuid);').ok).toBe(false);
    expect(lintMigrationSql('ALTER TABLE public.widgets DISABLE ROW LEVEL SECURITY;').ok).toBe(false);
  });

  it('blocks empty SQL', () => {
    expect(lintMigrationSql('   ').ok).toBe(false);
  });

  it('warns but does not block on fully public policies', () => {
    const result = lintMigrationSql(`${GOOD}\nCREATE POLICY "p" ON public.widgets FOR SELECT USING (true);`);
    expect(result.ok).toBe(true);
    expect(result.warnings.map((w) => w.code)).toContain('permissive-policy');
  });

  it('accepts the site_profiles migration with grants, RLS, and scoped policies', () => {
    const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261022225127_site_profiles.sql'), 'utf8');
    const result = lintMigrationSql(sql);

    expect(result.ok, JSON.stringify(result.blockers)).toBe(true);
    expect(result.createdTables).toContain('site_profiles');
  });
});
