import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20261015223554_restrict_user_files_storage_policies.sql'),
  'utf8',
);
const imageEditor = readFileSync(resolve(process.cwd(), 'src/components/creatives/ImageEditor.tsx'), 'utf8');
const catalogPanel = readFileSync(resolve(process.cwd(), 'src/components/creatives/web-builder/ai-chat/CatalogPanel.tsx'), 'utf8');

describe('user-files storage policy remediation', () => {
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
});