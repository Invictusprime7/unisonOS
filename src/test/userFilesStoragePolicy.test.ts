// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { lintMigrationSql } from '@/services/migrationSqlLint';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20261015223554_restrict_user_files_storage_policies.sql'),
  'utf8',
);
const metadataMigration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20261015234046_restrict_anonymous_file_metadata_inserts.sql'),
  'utf8',
);
const imageEditor = readFileSync(resolve(process.cwd(), 'src/components/creatives/ImageEditor.tsx'), 'utf8');
const catalogPanel = readFileSync(resolve(process.cwd(), 'src/components/creatives/web-builder/ai-chat/CatalogPanel.tsx'), 'utf8');

describe('user-files storage policy remediation', () => {
  it('passes the repository SQL safety lint', () => {
    expect(lintMigrationSql(metadataMigration).ok).toBe(true);
  });

  it('drops the bucket-wide public CRUD policies', () => {
    for (const policy of [
      'Anyone can upload to user-files',
      'Anyone can view user-files',
      'Anyone can update user-files',
      'Anyone can delete user-files',
    ]) {
      expect(migration).toContain(`DROP POLICY IF EXISTS "${policy}" ON storage.objects`);
    }
  });

  it('limits owner object operations to authenticated user folders', () => {
    const ownerPolicies = [
      'Users can upload their own files',
      'Users can view their own files',
      'Users can update their own files',
      'Users can delete their own files',
    ];
    for (const policy of ownerPolicies) expect(migration).toContain(`CREATE POLICY "${policy}"`);
    expect(migration).toContain('TO authenticated');
    expect(migration).toContain("auth.uid()::text = (storage.foldername(name))[1]");
    expect(migration).toContain('WITH CHECK (');
  });

  it('keeps public access limited to unexpired explicitly shared objects', () => {
    const publicRead = migration.slice(migration.indexOf('CREATE POLICY "Public can view shared files"'));
    expect(publicRead).toContain('FOR SELECT');
    expect(publicRead).toContain('sf.is_public = true');
    expect(publicRead).toContain('sf.expires_at IS NULL OR sf.expires_at > now()');
    expect(publicRead).not.toMatch(/FOR (?:INSERT|UPDATE|DELETE)/);
  });

  it('keeps authenticated recipient shares read-only and expiry-scoped', () => {
    const recipientRead = migration.slice(migration.indexOf('CREATE POLICY "Users can view files shared with them"'));
    expect(recipientRead).toContain('FOR SELECT TO authenticated');
    expect(recipientRead).toContain('sf.shared_with = auth.uid()');
    expect(recipientRead).toContain('sf.expires_at IS NULL OR sf.expires_at > now()');
    expect(recipientRead).not.toMatch(/FOR (?:INSERT|UPDATE|DELETE)/);
  });

  it('does not create anonymous owner-folder paths in active upload clients', () => {
    expect(imageEditor).toMatch(/if \(!user\) throw new Error\("Sign in to save generated images\."\);[\s\S]*?storage\.from\("user-files"\)\.upload/);
    expect(imageEditor).not.toContain('anonymous/');
    expect(catalogPanel).toMatch(/if \(!auth\.user\) throw new Error\('Sign in to upload catalog photos\.'\);[\s\S]*?storage\.from\('user-files'\)\.upload/);
    expect(catalogPanel).not.toMatch(/\?\.id\s*\?\?\s*'anon'/);
  });

  it('allows authenticated metadata inserts, rejects anonymous inserts, and preserves legacy rows', async () => {
    const db = new PGlite();
    const userId = '11111111-1111-4111-8111-111111111111';
    try {
      await db.exec(`
        CREATE ROLE anon;
        CREATE ROLE authenticated;
        CREATE SCHEMA auth;
        GRANT USAGE ON SCHEMA auth TO anon, authenticated;
        CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
          SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
        $$;
        GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;
        CREATE TABLE public.files (id integer PRIMARY KEY, user_id uuid);
        ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;
        CREATE POLICY "Anonymous can insert files" ON public.files FOR INSERT WITH CHECK (user_id IS NULL);
        CREATE POLICY "Authenticated users can insert own files" ON public.files FOR INSERT WITH CHECK (user_id = auth.uid());
        GRANT INSERT ON public.files TO anon, authenticated;
        INSERT INTO public.files (id, user_id) VALUES (1, NULL);
      `);
      await db.exec(metadataMigration);

      await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [userId]);
      await db.exec('SET ROLE authenticated');
      await db.query('INSERT INTO public.files (id, user_id) VALUES (2, $1)', [userId]);
      await db.exec('RESET ROLE');

      await db.exec('SET ROLE anon');
      await expect(db.query('INSERT INTO public.files (id, user_id) VALUES (3, NULL)'))
        .rejects.toThrow(/row-level security policy/i);
      await db.exec('RESET ROLE');

      const rows = await db.query<{ id: number; user_id: string | null }>(
        'SELECT id, user_id FROM public.files ORDER BY id',
      );
      expect(rows.rows).toEqual([{ id: 1, user_id: null }, { id: 2, user_id: userId }]);
    } finally {
      await db.close();
    }
  });
});