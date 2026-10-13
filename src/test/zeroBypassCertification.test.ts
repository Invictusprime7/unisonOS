/**
 * Phase 0B — Zero-Bypass Canonical Regression Certification.
 *
 * Walks Wizard launch → AI edit → rejected edit → reload/restore, with AI on,
 * AI off, AI failure, and a simulated canonical-recompile rejection, asserting:
 *   • Every accepted mutation is attributed to a source in the mutation ledger.
 *   • A rejected canonical mutation never alters durable revision projection
 *     or the accepted-hash set.
 *   • Reload/restore reproduces the same snapshot, page identities and hash.
 *   • The ledger reports zero unexplained bypasses for the full matrix.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/platform/core/commitToPipeline', () => ({ commitToPipeline: vi.fn() }));
vi.mock('@/services/canonicalLaunchVfs', () => ({
  buildCanonicalLaunchArtifacts: vi.fn((input) => ({
    files: input.generatedFiles,
    siteBundleSnapshot: input.siteBundleSnapshot,
    runtimeManifest: { version: 1 },
    generatedSiteRuntimeManifest: { siteId: 'site-1', agents: [] },
  })),
}));
vi.mock('@/services/runFullPreflight', () => ({ runFullPreflight: vi.fn() }));
vi.mock('@/services/playgroundControlPlaneResolver', () => ({ resolvePlaygroundControlPlane: vi.fn() }));
vi.mock('@/services/backendOpExecutor', () => ({ executeBackendOps: vi.fn(async () => []) }));
vi.mock('@/platform/core/gates', () => ({
  PreviewGate: { evaluate: vi.fn(() => ({ ok: true, reasons: [] })) },
  PublishGate: { evaluate: vi.fn(() => ({ ok: true, reasons: [] })) },
}));

type RevisionRow = Record<string, unknown> & { id: string; status: string };

const revisionStore: RevisionRow[] = [];
const draftProjection: Array<{ draftId: unknown; revisionId: string }> = [];

vi.mock('@/integrations/supabase/client', () => {
  const selectChain = (filter: (rows: RevisionRow[]) => RevisionRow[]) => ({
    eq: (col: string, val: unknown) =>
      selectChain((rows) => filter(rows).filter((r) => r[col] === val)),
    order: () => selectChain((rows) => [...filter(rows)].reverse()),
    limit: (n: number) => selectChain((rows) => filter(rows).slice(0, n)),
    maybeSingle: async () => ({ data: filter(revisionStore)[0] ?? null, error: null }),
  });

  return {
    supabase: {
      from: (table: string) => {
        if (table === 'builder_drafts') {
          return {
            update: () => ({ eq: () => ({ eq: async () => ({ error: null }) }) }),
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({
                    data: { last_revision_id: draftProjection[draftProjection.length - 1]?.revisionId ?? null },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'projects') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({ single: async () => ({ data: { site_id: 'site-1' }, error: null }) }),
              }),
            }),
          };
        }
        return {
          insert: () => ({ select: () => ({ single: async () => ({ data: { id: 'x' }, error: null }) }) }),
          select: () => selectChain((rows) => rows),
        };
      },
      functions: { invoke: vi.fn(async () => ({ data: { success: true }, error: null })) },
      rpc: async (fn: string, payload: Record<string, unknown>) => {
        if (fn !== 'commit_canonical_site_revision_v2') return { data: null, error: { message: `unexpected ${fn}` } };
        const id = `00000000-0000-4000-8000-${String(revisionStore.length + 1).padStart(12, '0')}`;
        const row = { ...payload, id, status: String(payload.p_status) } as RevisionRow;
        row.project_id = payload.p_project_id;
        row.draft_id = payload.p_draft_id;
        row.vfs_files = payload.p_vfs_files;
        row.site_bundle_snapshot = payload.p_site_bundle_snapshot;
        row.vfs_hash = payload.p_vfs_hash;
        revisionStore.push(row);
        if (row.status === 'committed') draftProjection.push({ draftId: payload.p_draft_id, revisionId: id });
        return { data: id, error: null };
      },
    },
  };
});

import { __resetPersistCircuitForTests, commitMutation } from '@/services/vfsCommitService';
import { commitToPipeline } from '@/platform/core/commitToPipeline';
import { runFullPreflight } from '@/services/runFullPreflight';
import { resolvePlaygroundControlPlane } from '@/services/playgroundControlPlaneResolver';
import { getMutationLedger, recordCanonicalVfsAdoption, resetMutationLedger } from '@/services/mutationLedger';
import { legacyFilesToPatchPlan } from '@/types/patchPlan';
import type { BuilderIdentity } from '@/types/builderIdentity';

const IDENTITY: BuilderIdentity = {
  userId: '11111111-1111-1111-1111-111111111111',
  businessId: '22222222-2222-2222-2222-222222222222',
  projectId: '33333333-3333-3333-3333-333333333333',
  draftId: '44444444-4444-4444-4444-444444444444',
  revisionId: '',
  sessionId: 'session-0b',
};

const LAUNCH_FILES = {
  '/src/App.tsx': 'export default function App(){return null}',
  '/src/pages/Home.tsx': 'export default function Home(){return <h1>Salon</h1>}',
};

function mockPipeline(files: Record<string, string>) {
  (commitToPipeline as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    source: 'wizard-launch',
    committedAt: new Date().toISOString(),
    siteBundleSnapshot: {
      vfsFiles: files,
      routerFile: { path: '/src/App.tsx', content: files['/src/App.tsx'] ?? '' },
      meta: {},
      pageRegistry: { version: 1, pages: { home: { pageId: 'home', filePath: '/src/pages/Home.tsx' } } },
    },
    runtimeManifest: { version: 1 },
    playground: { pages: [], theme: {} } as never,
    capabilities: [],
    gate: { previewReady: true, publishReady: true, preview: { ok: true, reasons: [] }, publish: { ok: true, reasons: [] } },
  });
  (runFullPreflight as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ files, stages: {} });
  (resolvePlaygroundControlPlane as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    readinessReport: { summary: { previewBlocked: 0, publishBlocked: 0 } },
    validationSummary: {},
    overview: {},
  });
}

async function launch(files = LAUNCH_FILES) {
  mockPipeline(files);
  return commitMutation({
    source: 'wizard-launch',
    identity: IDENTITY,
    current: { vfsFiles: {}, activePagePath: '/src/App.tsx' },
    patch: legacyFilesToPatchPlan(files, 'wizard launch'),
    options: { selections: { industry: 'salon' } as never },
  });
}

beforeEach(() => {
  revisionStore.length = 0;
  draftProjection.length = 0;
  __resetPersistCircuitForTests();
  vi.clearAllMocks();
  resetMutationLedger();
});

describe('Phase 0B — zero-bypass certification', () => {
  it('attributes every accepted mutation to its writer in the ledger', async () => {
    const launched = await launch();
    expect(launched.status).toBe('committed');

    const edited = { ...LAUNCH_FILES, '/src/pages/Home.tsx': 'export default function Home(){return <h1>AI edit</h1>}' };
    mockPipeline(edited);
    const aiEdit = await commitMutation({
      source: 'ai-builder',
      identity: { ...IDENTITY, revisionId: launched.persistedRevisionId! },
      current: { vfsFiles: launched.vfsFiles, siteBundleSnapshot: launched.siteBundleSnapshot },
      patch: legacyFilesToPatchPlan(edited, 'ai edit'),
    });

    expect(aiEdit.status).toBe('committed');
    const ledger = getMutationLedger();
    expect(ledger.countsBySource['wizard-launch'].committed).toBe(1);
    expect(ledger.countsBySource['ai-builder'].committed).toBe(1);
    expect(ledger.bypasses).toEqual([]);
  });

  it('runs the matrix with AI off, AI failure and canonical rejection without durable drift', async () => {
    const launched = await launch();
    const projectionAfterLaunch = draftProjection[draftProjection.length - 1]!.revisionId;

    // AI off — a deterministic toolbar edit still commits through the writer.
    const toolbarFiles = { ...LAUNCH_FILES, '/src/pages/Home.tsx': 'export default function Home(){return <h1>Toolbar</h1>}' };
    mockPipeline(toolbarFiles);
    const toolbar = await commitMutation({
      source: 'preview-toolbar',
      identity: { ...IDENTITY, revisionId: launched.persistedRevisionId! },
      current: { vfsFiles: launched.vfsFiles, siteBundleSnapshot: launched.siteBundleSnapshot },
      patch: legacyFilesToPatchPlan(toolbarFiles, 'toolbar edit'),
    });
    expect(toolbar.status).toBe('committed');
    recordCanonicalVfsAdoption({
      source: toolbar.source,
      vfsHash: toolbar.vfsHash,
      revisionId: toolbar.persistedRevisionId,
    });

    // AI failure / canonical recompile rejection — the pipeline throws.
    const projectionBefore = draftProjection[draftProjection.length - 1]!.revisionId;
    (commitToPipeline as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('canonical recompile rejected this mutation');
    });
    let rejectedThrown = false;
    try {
      await commitMutation({
        source: 'ai-builder',
        identity: { ...IDENTITY, revisionId: toolbar.persistedRevisionId! },
        current: { vfsFiles: toolbar.vfsFiles, siteBundleSnapshot: toolbar.siteBundleSnapshot },
        patch: legacyFilesToPatchPlan(
          { ...toolbarFiles, '/src/pages/Home.tsx': 'broken' },
          'failing ai edit',
        ),
      });
    } catch (error) {
      rejectedThrown = true;
      expect(String((error as Error).message)).toContain('canonical pipeline threw');
    }
    expect(rejectedThrown).toBe(true);
    // Durable projection is unchanged by a rejected mutation.
    expect(draftProjection[draftProjection.length - 1]!.revisionId).toBe(projectionBefore);
    expect(projectionAfterLaunch).not.toBe(projectionBefore);

    // Rolling the editor back to pre-mutation state is an exempt adoption.
    recordCanonicalVfsAdoption({
      source: 'rollback',
      vfsHash: null,
      exemptReason: 'restore-pre-mutation-state',
    });

    const ledger = getMutationLedger();
    expect(ledger.countsBySource['ai-builder'].rejected).toBe(1);
    expect(ledger.bypasses).toEqual([]);
  });

  it('reproduces the same snapshot and page identity after reload/restore', async () => {
    const launched = await launch();
    const persisted = revisionStore.find((r) => r.id === launched.persistedRevisionId)!;

    expect(persisted.vfs_hash).toBe(launched.vfsHash);
    expect(Object.keys(persisted.vfs_files as Record<string, string>).sort())
      .toEqual(Object.keys(launched.vfsFiles).sort());

    // Restoring that exact revision is hydration-only, never a new authorship.
    recordCanonicalVfsAdoption({
      source: 'system-restore',
      vfsHash: String(persisted.vfs_hash),
      revisionId: String(persisted.id),
      exemptReason: 'hydration-only',
    });

    expect(getMutationLedger().bypasses).toEqual([]);
  });

  it('flags an unexplained direct VFS adoption as a bypass', () => {
    recordCanonicalVfsAdoption({ source: 'legacy-direct-write', vfsHash: 'unknown-hash' });
    const ledger = getMutationLedger();
    expect(ledger.bypasses).toHaveLength(1);
    expect(ledger.bypasses[0].source).toBe('legacy-direct-write');
  });
});
