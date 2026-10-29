import { describe, expect, it } from 'vitest';
import { computeCanonicalVfsHash, verifyCanonicalPublishSource } from '../../supabase/functions/_shared/canonicalPublishRevision';

const vfsFiles = {
  '/index.html': '<!doctype html><html><body>Accepted</body></html>',
  '/src/main.tsx': 'export default function App(){return <main/>}',
};
const identity = { projectId: 'project-1', revisionId: 'revision-1', vfsHash: '' };
const revision = async () => ({
  id: identity.revisionId,
  project_id: identity.projectId,
  status: 'committed',
  publish_ready: true,
  vfs_hash: await computeCanonicalVfsHash(vfsFiles),
  vfs_files: vfsFiles,
});

describe('canonical publish revision verification', () => {
  it('accepts only deployment files derived from the exact committed revision', async () => {
    const row = await revision();
    const verdict = await verifyCanonicalPublishSource({
      identity: { ...identity, vfsHash: row.vfs_hash },
      revision: row,
      submittedFiles: {
        'index.html': '<!doctype html><html><body>Accepted<script defer src="/unison-powered-by-unison.js"></script></body></html>',
        'src/main.tsx': vfsFiles['/src/main.tsx'],
        'unison-powered-by-unison.js': 'platform attribution',
        'unison.runtime.json': '{"derived":true}',
      },
      expectedPublishedFiles: {
        'index.html': '<!doctype html><html><body>Accepted<script defer src="/unison-powered-by-unison.js"></script></body></html>',
        'src/main.tsx': vfsFiles['/src/main.tsx'],
        'unison-powered-by-unison.js': 'platform attribution',
      },
    });

    expect(verdict).toEqual({ ok: true });
  });

  it('rejects stale revision identity, stored hash drift, and caller-edited source', async () => {
    const row = await revision();
    const goodIdentity = { ...identity, vfsHash: row.vfs_hash };
    const expectedPublishedFiles = {
      'index.html': vfsFiles['/index.html'],
      'src/main.tsx': vfsFiles['/src/main.tsx'],
    };
    const submittedFiles = { ...expectedPublishedFiles };

    expect(await verifyCanonicalPublishSource({
      identity: { ...goodIdentity, revisionId: 'revision-old' }, revision: row, submittedFiles, expectedPublishedFiles,
    })).toMatchObject({ ok: false, code: 'canonical-revision-mismatch' });
    expect(await verifyCanonicalPublishSource({
      identity: { ...goodIdentity, vfsHash: 'stale-hash' }, revision: row, submittedFiles, expectedPublishedFiles,
    })).toMatchObject({ ok: false, code: 'canonical-revision-mismatch' });
    expect(await verifyCanonicalPublishSource({
      identity: goodIdentity, revision: row, submittedFiles: { ...submittedFiles, 'src/main.tsx': 'malicious replacement' }, expectedPublishedFiles,
    })).toMatchObject({ ok: false, code: 'canonical-publish-source-mismatch' });
  });
});