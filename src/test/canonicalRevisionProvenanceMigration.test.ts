import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260929233935_persist_canonical_revision_provenance.sql'),
  'utf8',
);
const deltaMigration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20261025014614_canonical_vfs_delta_parent_revision_base.sql'),
  'utf8',
);

describe('canonical revision provenance migration', () => {
  it('stores candidate, operation and per-file provenance on the revision ledger', () => {
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS candidate_id text');
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS operation_ids text[] NOT NULL DEFAULT '{}'::text[]");
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS file_provenance jsonb NOT NULL DEFAULT '{}'::jsonb");
    expect(migration).toContain("jsonb_set(provenance.record, '{authoredRevisionId}', to_jsonb(NEW.id::text), true)");
    expect(migration).toContain("NEW.patch_json := NEW.patch_json - '_commitMetadata'");
  });

  it('keeps accepted writes behind the existing lock and CAS RPC', () => {
    expect(migration).toContain('REVOKE INSERT ON TABLE public.site_revisions FROM authenticated');
    expect(migration).toMatch(/ALTER FUNCTION public\.commit_canonical_site_revision\([\s\S]+\) SECURITY DEFINER/);
    expect(migration).toContain('Canonical revision operation identities must be a non-empty string array');
    expect(migration).toContain('Every canonical VFS file requires live provenance and a content hash');
  });

  it('reconstructs compact deltas from the canonical parent revision', () => {
    expect(deltaMigration).toContain('FROM public.site_revisions AS revision');
    expect(deltaMigration).toContain('revision.id = p_parent_revision_id');
    expect(deltaMigration).toContain("revision.status = 'committed'");
    expect(deltaMigration).toContain("v_base_vfs := '{}'::jsonb");
    expect(deltaMigration).not.toContain('draft.vfs_files');
    expect(deltaMigration).toContain('Canonical parent revision is unavailable for VFS delta reconstruction');
    expect(deltaMigration).toContain('commit_canonical_site_revision_v2_full');
  });
});
