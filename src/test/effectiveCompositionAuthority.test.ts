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

describe('withRebuiltComposition (open-time rebuild)', () => {
  const base = {
    id: 'rev-1', projectId: 'p', businessId: 'b', draftId: 'd', source: 'ai' as never, status: 'committed' as const,
    vfsFiles: { '/src/pages/Home.tsx': 'export default function Home(){return <main><section data-section="hero">Hi</section></main>}' },
    runtimeManifest: null, playground: null, readinessReport: {}, diagnostics: [], publishReady: false, publishBlockers: [],
    vfsHash: 'h1', candidateId: null, operationIds: [], fileProvenance: {}, createdAt: '', parentRevisionId: null, label: null,
  };
  it('rebuilds a provisional index from saved files and keeps it unstamped', async () => {
    const { withRebuiltComposition } = await import('@/services/vfsCommitService');
    const out = await withRebuiltComposition({
      ...base,
      siteBundleSnapshot: { meta: {}, pageRegistry: { pages: { home: { filePath: '/src/pages/Home.tsx' } } } },
      compositionAuthority: { status: 'provisional', reason: 'absent', revisionId: null, uncertainPages: [], complete: false },
    } as never);
    const ec = (out.siteBundleSnapshot as { meta: { effectiveComposition: { revisionId?: string; pages: object } } }).meta.effectiveComposition;
    expect(Object.keys(ec.pages)).toEqual(['home']);
    expect(ec.revisionId).toBeUndefined();
    expect(out.compositionAuthority?.status).toBe('provisional');
    expect(out.compositionAuthority?.rebuilt).toBe(true);
  });
  it('leaves a durable revision untouched', async () => {
    const { withRebuiltComposition } = await import('@/services/vfsCommitService');
    const rev = { ...base, siteBundleSnapshot: { meta: {} }, compositionAuthority: { status: 'durable', reason: 'revision-stamped', revisionId: 'rev-1', uncertainPages: [], complete: true } } as never;
    expect(await withRebuiltComposition(rev)).toBe(rev);
  });
});
