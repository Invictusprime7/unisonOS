import { describe, expect, it } from 'vitest';
import { assessEffectiveCompositionAuthority } from '@/services/effectiveCompositionAuthority';

const page = (uncertain: string[] = []) => ({ pageId: 'home', sourcePath: '/src/pages/Home.tsx', sourceHash: 'h', sections: [], mediaUses: [], imports: [], componentUses: [], bindings: [], registryEvidence: [], uncertain });
const row = (projection: Record<string, unknown> | undefined, over: Record<string, unknown> = {}) => ({
  id: 'rev-2', status: 'committed', vfsHash: 'hash-a', parentRevisionId: 'rev-1',
  siteBundleSnapshot: projection ? { meta: { effectiveComposition: projection } } : { meta: {} }, ...over,
});
const stamped = { schemaVersion: '1.0', revisionId: 'rev-2', baseRevisionId: 'rev-1', vfsHash: 'hash-a', compositionHash: 'c', pages: { home: page() } };

describe('effective composition revision authority', () => {
  it('is durable and complete only when stamped for the exact row', () => {
    const result = assessEffectiveCompositionAuthority(row(stamped));
    expect(result).toMatchObject({ status: 'durable', revisionId: 'rev-2', complete: true });
  });
  it('treats an in-memory unstamped projection as provisional', () => {
    expect(assessEffectiveCompositionAuthority(row({ ...stamped, revisionId: undefined })).reason).toBe('unstamped');
  });
  it('rejects projections copied from another revision or stale bytes', () => {
    expect(assessEffectiveCompositionAuthority(row({ ...stamped, revisionId: 'rev-9' })).reason).toBe('revision-mismatch');
    expect(assessEffectiveCompositionAuthority(row({ ...stamped, vfsHash: 'old' })).reason).toBe('vfs-hash-mismatch');
    expect(assessEffectiveCompositionAuthority(row(stamped, { parentRevisionId: 'rev-0' })).reason).toBe('parent-mismatch');
  });
  it('is provisional when absent', () => {
    expect(assessEffectiveCompositionAuthority(row(undefined)).status).toBe('provisional');
  });
  it('never claims full coverage when a page has uncertain source', () => {
    const result = assessEffectiveCompositionAuthority(row({ ...stamped, pages: { home: page(['dynamic media src']) } }));
    expect(result.status).toBe('durable');
    expect(result.complete).toBe(false);
    expect(result.uncertainPages).toEqual(['home']);
  });
});
