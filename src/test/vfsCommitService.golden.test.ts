/**
 * Move 6 — Golden E2E suite for VFSCommitService.
 *
 * Walks the salon launcher → AI edits → fast-path binding → refresh →
 * publish-block scenario, asserting that:
 *   • Every mutation source funnels through commitMutation.
 *   • Persisted revision rows chain via parentRevisionId.
 *   • Hydration prefers loadLatestRevisionForProject over sessionStorage.
 *   • Capability + intent readiness gates surface in readinessReport.
 *   • Publish-blocking intent failures persist as committed revisions but
 *     leave publishBlocked > 0 for the publish UI to enforce.
 *
 * Canonical pipeline, preflight, intent-readiness resolver, and Supabase
 * are mocked — this suite is about the commit service's orchestration and
 * persistence contract, not the downstream subsystems (which have their
 * own focused tests).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getMutationEvents, resetMutationEvents } from '@/services/editor/editorTelemetry';

const { runtimeReconcileInvoke } = vi.hoisted(() => ({
  runtimeReconcileInvoke: vi.fn(async () => ({ data: { success: true }, error: null })),
}));

// -- Mocks ------------------------------------------------------------------

vi.mock('@/platform/core/commitToPipeline', () => ({
  commitToPipeline: vi.fn(),
}));

vi.mock('@/services/runFullPreflight', () => ({
  runFullPreflight: vi.fn(),
}));

vi.mock('@/services/canonicalLaunchVfs', () => ({
  buildCanonicalLaunchArtifacts: vi.fn(),
}));

vi.mock('@/services/playgroundControlPlaneResolver', () => ({
  resolvePlaygroundControlPlane: vi.fn(),
}));

vi.mock('@/services/backendOpExecutor', () => ({
  executeBackendOps: vi.fn(),
}));

vi.mock('@/platform/core/gates', () => ({
  PreviewGate: { evaluate: vi.fn(() => ({ ok: true, reasons: [] })) },
  PublishGate: { evaluate: vi.fn(() => ({ ok: true, reasons: [] })) },
}));

type RevisionRow = {
  id: string;
  project_id: string;
  business_id: string;
  draft_id: string;
  parent_revision_id: string | null;
  source: string;
  status: 'committed' | 'rejected' | 'quarantined';
  patch_json: Record<string, unknown>;
  vfs_files: Record<string, unknown>;
  site_bundle_snapshot: Record<string, unknown>;
  runtime_manifest: Record<string, unknown>;
  playground_state: Record<string, unknown>;
  readiness_report: Record<string, unknown>;
  diagnostics: unknown[];
  candidate_id: string | null;
  operation_ids: string[];
  file_provenance: Record<string, unknown>;
  created_by: string;
  created_at: string;
};

const revisionStore: RevisionRow[] = [];
const draftProjectionUpdates: Array<{ id: unknown; userId: unknown; revisionId: unknown }> = [];
let canonicalCommitRpcError: { message: string } | null = null;
let canonicalCommitRpcWait: Promise<void> | null = null;
let lastCanonicalCommitPayload: Record<string, unknown> | null = null;

vi.mock('@/integrations/supabase/client', () => {
  const insert = (payload: Record<string, unknown>) => ({
    select: (_cols: string) => ({
      single: async () => {
        const seq = String(revisionStore.length + 1).padStart(12, '0');
        const id = `00000000-0000-0000-0000-${seq}`;
        const row: RevisionRow = {
          id,
          parent_revision_id: null,
          status: 'committed',
          patch_json: {},
          vfs_files: {},
          site_bundle_snapshot: {},
          runtime_manifest: {},
          playground_state: {},
          readiness_report: {},
          diagnostics: [],
          candidate_id: null,
          operation_ids: [],
          file_provenance: {},
          created_at: new Date().toISOString(),
          ...(payload as Partial<RevisionRow>),
        } as RevisionRow;
        revisionStore.push(row);
        return { data: { id: row.id }, error: null };
      },
    }),
  });

  const selectChain = (filter: (rows: RevisionRow[]) => RevisionRow[]) => {
    const chain = {
      eq: (col: string, val: unknown) => {
        const next = (rows: RevisionRow[]) =>
          filter(rows).filter((r) => (r as unknown as Record<string, unknown>)[col] === val);
        return selectChain(next);
      },
      is: (col: string, val: unknown) => selectChain((rows) =>
        filter(rows).filter((row) => (row as unknown as Record<string, unknown>)[col] === val)),
      order: (_col: string, _opts: unknown) => selectChain((rows) => [...filter(rows)].reverse()),
      limit: (n: number) => selectChain((rows) => filter(rows).slice(0, n)),
      maybeSingle: async () => {
        const r = filter(revisionStore)[0];
        return { data: r ?? null, error: null };
      },
    };
    return chain;
  };

  return {
    supabase: {
      from: (table: string) => {
        if (table === 'builder_drafts') return {
            update: (payload: { last_revision_id?: unknown }) => ({
              eq: (_column: string, id: unknown) => ({
                eq: async (_userColumn: string, userId: unknown) => {
                  draftProjectionUpdates.push({ id, userId, revisionId: payload.last_revision_id });
                  return { error: null };
                },
              }),
            }),
          };
        if (table === 'projects') return {
          select: (_columns: string) => ({
            eq: (_projectColumn: string, _projectId: unknown) => ({
              eq: (_businessColumn: string, _businessId: unknown) => ({
                single: async () => ({
                  data: { site_id: '55555555-5555-4555-8555-555555555555' },
                  error: null,
                }),
              }),
            }),
          }),
        };
        return {
          insert,
          select: (_cols: string) => selectChain((rows) => rows),
        };
      },
      functions: { invoke: runtimeReconcileInvoke },
      rpc: async (functionName: string, payload: Record<string, unknown>) => {
        if (functionName !== 'commit_canonical_site_revision_v2') {
          return { data: null, error: { message: `Unexpected RPC ${functionName}` } };
        }
        lastCanonicalCommitPayload = payload;
        if (canonicalCommitRpcWait) await canonicalCommitRpcWait;
        if (canonicalCommitRpcError) return { data: null, error: canonicalCommitRpcError };
        const seq = String(revisionStore.length + 1).padStart(12, '0');
        const id = `00000000-0000-0000-0000-${seq}`;
        const patchJson = { ...((payload.p_patch_json ?? {}) as Record<string, unknown>) };
        const commitMetadata = (patchJson._commitMetadata ?? {}) as {
          candidateId?: string | null;
          operationIds?: string[];
          fileProvenance?: Record<string, Record<string, unknown>>;
        };
        delete patchJson._commitMetadata;
        const stampedProvenance = Object.fromEntries(Object.entries(commitMetadata.fileProvenance ?? {}).map(
          ([path, record]) => [path, record.authoredRevisionId ? record : { ...record, authoredRevisionId: id }],
        ));
        const vfsDelta = (commitMetadata as { vfsDelta?: { files?: Record<string, string>; deletedPaths?: string[] } }).vfsDelta;
        const previousFiles = [...revisionStore].reverse().find((revision) => revision.status === 'committed')?.vfs_files ?? {};
        const fullVfs = vfsDelta
          ? {
              ...previousFiles,
              ...vfsDelta.files,
            }
          : (payload.p_vfs_files ?? {}) as Record<string, unknown>;
        for (const path of vfsDelta?.deletedPaths ?? []) delete fullVfs[path];
        const runtimeVfs = Object.fromEntries(Object.entries(fullVfs)
          .filter(([path]) => !path.startsWith('/.unison/') && !path.startsWith('.unison/')));
        const row: RevisionRow = {
          id,
          project_id: String(payload.p_project_id),
          business_id: String(payload.p_business_id),
          draft_id: String(payload.p_draft_id),
          parent_revision_id: (payload.p_parent_revision_id as string | null) ?? null,
          source: String(payload.p_source),
          status: payload.p_status as RevisionRow['status'],
          patch_json: patchJson,
          vfs_files: (payload.p_vfs_files ?? {}) as Record<string, unknown>,
          site_bundle_snapshot: {
            ...((payload.p_site_bundle_snapshot ?? {}) as Record<string, unknown>),
            vfsFiles: runtimeVfs,
          },
          runtime_manifest: (payload.p_runtime_manifest ?? {}) as Record<string, unknown>,
          playground_state: (payload.p_playground_state ?? {}) as Record<string, unknown>,
          readiness_report: (payload.p_readiness_report ?? {}) as Record<string, unknown>,
          diagnostics: (payload.p_diagnostics ?? []) as unknown[],
          candidate_id: commitMetadata.candidateId ?? null,
          operation_ids: commitMetadata.operationIds ?? [],
          file_provenance: stampedProvenance,
          created_by: IDENTITY.userId,
          created_at: new Date().toISOString(),
          publish_ready: payload.p_publish_ready,
          publish_blockers: payload.p_publish_blockers,
          vfs_hash: payload.p_vfs_hash,
        } as RevisionRow;
        revisionStore.push(row);
        if (row.status === 'committed') {
          draftProjectionUpdates.push({
            id: payload.p_draft_id,
            userId: IDENTITY.userId,
            revisionId: id,
          });
        }
        return { data: id, error: null };
      },
    },
  };
});

// -- Imports (after mocks) ---------------------------------------------------

import {
  CommitRejectedError,
  commitMutation,
  loadRevision,
  loadLatestRevisionForProject,
  loadLatestPublishReadyRevisionForProject,
  hashVfsFiles,
  restoreRevision,
  __resetPersistCircuitForTests,
  rebaseQueuedCommit,
  type CommitMutationInput,
  type CommitMutationResult,
} from '@/services/vfsCommitService';
import { commitToPipeline } from '@/platform/core/commitToPipeline';
import { runFullPreflight } from '@/services/runFullPreflight';
import { buildCanonicalLaunchArtifacts } from '@/services/canonicalLaunchVfs';
import { resolvePlaygroundControlPlane } from '@/services/playgroundControlPlaneResolver';
import { executeBackendOps } from '@/services/backendOpExecutor';
import type { BuilderIdentity } from '@/types/builderIdentity';
import { emptyPatchPlan, legacyFilesToPatchPlan } from '@/types/patchPlan';
import { compilerOwnershipHash, resolvedCompositionPathFor } from '@/platform/core/resolvedComposition';

const IDENTITY: BuilderIdentity = {
  userId: '11111111-1111-1111-1111-111111111111',
  businessId: '22222222-2222-2222-2222-222222222222',
  projectId: '33333333-3333-3333-3333-333333333333',
  draftId: '44444444-4444-4444-4444-444444444444',
  revisionId: '',
  sessionId: 'session-golden',
};

function mockPipeline(files: Record<string, string>) {
  (commitToPipeline as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    source: 'wizard-launch',
    committedAt: new Date().toISOString(),
    siteBundleSnapshot: { vfsFiles: files, routerFile: { path: '/src/App.tsx', content: files['/src/App.tsx'] ?? '' }, meta: {} },
    runtimeManifest: { version: 1 },
    playground: { pages: [], theme: {} } as never,
    capabilities: [],
    gate: { previewReady: true, publishReady: true, preview: { ok: true, reasons: [] }, publish: { ok: true, reasons: [] } },
  });
}

function mockPreflight(files: Record<string, string>) {
  (runFullPreflight as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    files,
    stages: {
      earlyRepair: 'ok', finalRepair: 'ok',
      runtimeCompatibility: {
        runtimeProfile: 'test-runtime', dependencyGraphFingerprint: 'site-deps-v1-test',
        dependenciesResolvable: true, importsApproved: true, reactRuntimeCompatible: true,
        fallbackPresent: true, budgetValid: true, capabilitiesUsed: [], warnings: [], blockers: [], ok: true,
      },
    },
  });
}

function mockIntents(previewBlocked = 0, publishBlocked = 0) {
  (resolvePlaygroundControlPlane as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    readinessReport: { summary: { previewBlocked, publishBlocked } },
    validationSummary: {},
    overview: {},
  });
}

beforeEach(() => {
  resetMutationEvents();
  revisionStore.length = 0;
  draftProjectionUpdates.length = 0;
  canonicalCommitRpcError = null;
  canonicalCommitRpcWait = null;
  lastCanonicalCommitPayload = null;
  __resetPersistCircuitForTests();
  vi.clearAllMocks();
  vi.mocked(buildCanonicalLaunchArtifacts).mockImplementation((input) => ({
    files: input.generatedFiles,
    siteBundleSnapshot: input.siteBundleSnapshot,
    runtimeManifest: { version: 1 },
    generatedSiteRuntimeManifest: { siteId: '55555555-5555-4555-8555-555555555555', agents: [] },
  } as unknown as ReturnType<typeof buildCanonicalLaunchArtifacts>));
  runtimeReconcileInvoke.mockResolvedValue({ data: { success: true }, error: null });
});

describe('Golden E2E — salon launcher → AI edits → publish gate', () => {
  it('rejects authored replacements of compiler-owned composition records', async () => {
    const path = '/.unison/compositions/home.json';
    await expect(commitMutation({ source: 'ai-builder', identity: IDENTITY,
      current: { vfsFiles: { [path]: '{"activation":"sealed"}' } },
      patch: legacyFilesToPatchPlan({ [path]: '{"activation":"changed"}' }),
    })).rejects.toThrow('compiler-owned');
    expect(revisionStore).toHaveLength(0);
    expect(getMutationEvents().at(-1)?.rejection).toMatchObject({
      code: 'PROTECTED_INFRASTRUCTURE',
      stage: 'file-protection',
      affectedPaths: [path],
      expectedVfsHash: expect.any(String),
      attemptedOperations: [{ path, type: expect.any(String) }],
      expectedOwners: [{ path, owner: 'immutable-infrastructure' }],
      reason: expect.stringContaining('compiler-owned'),
    });
  });
  it('records stale overlapping queued edits with their conflicting path', async () => {
    const files = {
      '/src/App.tsx': 'x',
      '/src/pages/Home.tsx': '<Home />',
    };
    const firstEditFiles = { ...files, '/src/pages/Home.tsx': '<Home title="first" />' };
    const identity = {
      ...IDENTITY,
      projectId: '73333333-3333-4333-8333-333333333333',
      draftId: '74444444-4444-4444-8444-444444444444',
    };
    mockPipeline(firstEditFiles);
    mockPreflight(firstEditFiles);
    mockIntents();

    await commitMutation({
      source: 'ai-builder',
      identity,
      current: { vfsFiles: files },
      patch: legacyFilesToPatchPlan({ '/src/pages/Home.tsx': '<Home title="first" />' }, 'first home edit'),
    });

    await expect(commitMutation({
      source: 'ai-builder',
      identity,
      current: { vfsFiles: files },
      patch: legacyFilesToPatchPlan({ '/src/pages/Home.tsx': '<Home title="second" />' }, 'stale home edit'),
    })).rejects.toThrow(/overlaps a newer saved revision/);

    expect(getMutationEvents().at(-1)?.rejection).toMatchObject({
      code: 'STALE_REVISION',
      stage: 'queue-rebase',
      affectedPaths: ['/src/pages/Home.tsx'],
      expectedVfsHash: expect.any(String),
    });
  });
  it('allows Builder-authored replacement of generated presentation recipes after handoff', async () => {
    const path = '/src/components/recipes/Features.ts';
    const pagePath = '/src/pages/Home.tsx';
    const source = 'export const REGISTERED_VARIANTS = {};';
    const descriptorPath = resolvedCompositionPathFor(pagePath);
    const descriptor = JSON.stringify({
      version: '1.0',
      compiledBy: 'stage-4b',
      pageFilePath: pagePath,
      sections: [],
      compilerOwnership: { [path]: compilerOwnershipHash(source) },
    });
    const after = 'export const REGISTERED_VARIANTS = { authored: true };';
    const files = { [path]: after, [descriptorPath]: descriptor };
    mockPipeline(files); mockPreflight(files); mockIntents();
    const result = await commitMutation({ source: 'playground-edit', identity: IDENTITY,
      current: {
        vfsFiles: { [path]: source, [descriptorPath]: descriptor },
        siteBundleSnapshot: { meta: { authorshipAuthority: {
          phase: 'builder-authoring', creativeAuthority: 'builder', commitAuthority: 'vfs-commit-service',
          launchRevisionId: IDENTITY.revisionId,
        } } } as never,
      },
      patch: legacyFilesToPatchPlan({ [path]: after }),
      options: { requireReadinessPass: false },
    });
    expect(result.vfsFiles[path]).toBe(after);
    expect(revisionStore).toHaveLength(1);
  });
  it('does not infer compiler ownership from conventional component filenames', async () => {
    const path = '/src/components/Hero.tsx';
    const before = { [path]: 'export default function Hero(){return <section>Before</section>}' };
    const after = { [path]: 'export default function Hero(){return <section>Authored</section>}' };
    mockPipeline(after); mockPreflight(after); mockIntents();

    const result = await commitMutation({
      source: 'playground-edit',
      identity: IDENTITY,
      current: { vfsFiles: before },
      patch: legacyFilesToPatchPlan(after, 'edit conventional component'),
      options: { requireReadinessPass: false },
    });

    expect(result.vfsFiles[path]).toContain('Authored');
  });
  it('keeps launch composition provenance while returning a revision-bound authored projection', async () => {
    const baseRevisionId = '55555555-5555-4555-8555-555555555555';
    const pagePath = '/src/pages/Home.tsx';
    const descriptorPath = resolvedCompositionPathFor(pagePath);
    const originalPage = 'export default function Home(){return <main>Launch</main>}';
    const authoredPage = 'export default function Home(){return <main><section data-ut-section-id="authored-hero" data-ut-section-type="hero" data-ut-variant="hero:invented-editorial"><img src="/hero.jpg" alt="Hero" /></section></main>}';
    const descriptor = JSON.stringify({
      version: '1.0',
      compiledBy: 'stage-4b',
      pageFilePath: pagePath,
      sections: [{ sectionId: 'launch-hero', semanticType: 'hero', primitiveId: 'Hero', variantId: 'hero:split' }],
      compilerOwnership: { [pagePath]: compilerOwnershipHash(originalPage) },
    });
    const before = {
      '/src/App.tsx': 'export default function App(){return null}',
      [pagePath]: originalPage,
      [descriptorPath]: descriptor,
    };
    const candidateFiles = { ...before, [pagePath]: authoredPage };
    const snapshot = {
      snapshotId: 'snapshot-home',
      vfsFiles: before,
      routerFile: { path: '/src/App.tsx', content: before['/src/App.tsx'] },
      pageRegistry: { pages: { home: { pageId: 'home', path: '/', filePath: pagePath, title: 'Home' } } },
      meta: { source: 'manual', systemId: null, industry: 'salon', verticalContractId: null },
    } as never;
    vi.mocked(commitToPipeline).mockReturnValue({
      source: 'playground-edit',
      committedAt: new Date().toISOString(),
      siteBundleSnapshot: { ...snapshot, vfsFiles: candidateFiles },
      runtimeManifest: { version: 1 },
      playground: { pages: [], theme: {} } as never,
      capabilities: [],
      gate: { previewReady: true, publishReady: true, preview: { ok: true, reasons: [] }, publish: { ok: true, reasons: [] } },
    } as never);
    mockPreflight(candidateFiles);
    mockIntents();

    const result = await commitMutation({
      source: 'ai-builder',
      identity: { ...IDENTITY, revisionId: baseRevisionId },
      current: { vfsFiles: before, siteBundleSnapshot: snapshot },
      patch: legacyFilesToPatchPlan({ [pagePath]: authoredPage }, 'authored home redesign'),
    });

    expect(result.status).toBe('committed');
    expect(result.publishBlockers).toEqual([]);
    expect(result.readinessReport.runtimeCompatibility).toMatchObject({
      dependencyGraphFingerprint: 'site-deps-v1-test',
    });
    expect(result.vfsFiles[descriptorPath]).toBe(descriptor);
    expect(result.fileProvenance[pagePath]).toMatchObject({
      lastEditorOrigin: 'ai-builder',
      currentHash: expect.any(String),
    });
    expect(result.siteBundleSnapshot?.meta.effectiveComposition).toMatchObject({
      revisionId: result.persistedRevisionId,
      baseRevisionId,
      vfsHash: result.vfsHash,
      pages: {
        home: {
          pageId: 'home',
          sourcePath: pagePath,
          sections: [{ sectionId: 'authored-hero', semanticType: 'hero', variantId: 'hero:invented-editorial' }],
          mediaUses: [{ src: '/hero.jpg', alt: 'Hero', sectionId: 'authored-hero' }],
        },
      },
    });
    expect(result.siteBundleSnapshot?.meta.effectiveComposition?.pages.home.registryEvidence)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          registry: 'section-type', id: 'hero', status: 'registered', sourcePath: pagePath,
        }),
        expect.objectContaining({
          registry: 'design-implementation', id: 'hero:invented-editorial', status: 'unregistered', sourcePath: pagePath,
        }),
      ]));
  });
  it('allows post-launch Builder authorship of presentation CSS sealed by the Wizard', async () => {
    const path = '/src/index.css';
    const before = { [path]: ':root { --accent: 1 2% 3%; }' };
    const after = { [path]: ':root { --accent: 220 80% 55%; }\n.hero { min-height: 80vh; }' };
    const snapshot = {
      vfsFiles: before,
      routerFile: { path: '/src/App.tsx', content: '' },
      pageRegistry: { pages: {} },
      meta: {
        authorshipAuthority: {
          phase: 'builder-authoring', creativeAuthority: 'builder',
          commitAuthority: 'vfs-commit-service', launchRevisionId: IDENTITY.revisionId,
        },
        seal: {
          registeredPageBodyAuthority: 'canonical-compiler',
          protectedFilePatterns: ['/src/index.css'],
        },
      },
    };
    mockPipeline(after); mockPreflight(after); mockIntents();

    const result = await commitMutation({
      source: 'playground-edit', identity: IDENTITY,
      current: { vfsFiles: before, siteBundleSnapshot: snapshot as never },
      patch: legacyFilesToPatchPlan(after),
      options: { requireReadinessPass: false },
    });

    expect(result.vfsFiles[path]).toBe(after[path]);
  });
  it('keeps capability-sensitive integration adapters behind typed operations', async () => {
    const path = '/src/integrations/supabase/client.ts';
    await expect(commitMutation({
      source: 'ai-builder', identity: IDENTITY,
      current: { vfsFiles: { [path]: 'export const client = {};' } },
      patch: legacyFilesToPatchPlan({ [path]: 'export const client = { bypass: true };' }),
    })).rejects.toThrow('capability-sensitive');
    expect(revisionStore).toHaveLength(0);
  });
  it('allows authenticated AI rewrites of sealed page source while retaining the canonical router boundary', async () => {
    const routerPath = '/src/App.tsx';
    const pagePath = '/src/pages/Home.tsx';
    const before = { [routerPath]: 'export default function App(){return null}', [pagePath]: 'export default function Home(){return null}' };
    const snapshot = {
      vfsFiles: before,
      routerFile: { path: routerPath, content: before[routerPath] },
      pageRegistry: { pages: { home: { filePath: pagePath } } },
      meta: {
        authorshipAuthority: {
          phase: 'builder-authoring', creativeAuthority: 'builder',
          commitAuthority: 'vfs-commit-service', launchRevisionId: '99999999-9999-4999-8999-999999999999',
        },
        seal: { registeredPageBodyAuthority: 'canonical-compiler' },
      },
    };
    const afterPage = 'export default function Home(){return <main>Governed AI rewrite</main>}';
    const files = { ...before, [pagePath]: afterPage };
    mockPipeline(files); mockPreflight(files); mockIntents();
    const aiPatch = legacyFilesToPatchPlan({ [pagePath]: afterPage });
    aiPatch.operationIds = ['pending-ai-operation'];
    aiPatch.candidate = {
      id: 'candidate-governed-rewrite',
      origin: 'builder',
      knowledgeVersion: '2026-09-29.2',
      targetPages: [pagePath],
      attempt: 1,
    };
    const rewritten = await commitMutation({ source: 'ai-builder', identity: { ...IDENTITY, revisionId: '99999999-9999-4999-8999-999999999999' },
      current: { vfsFiles: before, siteBundleSnapshot: snapshot as never },
      patch: aiPatch,
    });
    expect(rewritten.vfsFiles[pagePath]).toBe(afterPage);
    expect(rewritten.siteBundleSnapshot?.meta.authorshipAuthority).toEqual({
      phase: 'builder-authoring', creativeAuthority: 'builder',
      commitAuthority: 'vfs-commit-service', launchRevisionId: '99999999-9999-4999-8999-999999999999',
    });
    expect(rewritten.candidateId).toBe('candidate-governed-rewrite');
    expect(rewritten.operationIds).toEqual(['pending-ai-operation']);
    expect(rewritten.fileProvenance[pagePath]).toMatchObject({
      ownership: 'ai',
      candidateId: 'candidate-governed-rewrite',
      lastOperationIds: ['pending-ai-operation'],
      authoredRevisionId: rewritten.persistedRevisionId,
    });
    expect(revisionStore[0]).toMatchObject({
      candidate_id: 'candidate-governed-rewrite',
      operation_ids: ['pending-ai-operation'],
    });
    expect(revisionStore[0].file_provenance[pagePath]).toEqual(rewritten.fileProvenance[pagePath]);
    expect(revisionStore[0].patch_json).not.toHaveProperty('_commitMetadata');
    expect(revisionStore).toHaveLength(1);

    await expect(commitMutation({ source: 'ai-builder', identity: { ...IDENTITY, revisionId: rewritten.persistedRevisionId! },
      current: { vfsFiles: rewritten.vfsFiles, siteBundleSnapshot: { ...snapshot, vfsFiles: rewritten.vfsFiles } as never },
      patch: legacyFilesToPatchPlan({ [routerPath]: 'export default function App(){return <main>Unauthorized router</main>}' }),
    })).rejects.toThrow('Canonical App.tsx is compiler-owned');
  });

  it('rejects an implicit Wizard relaunch after Builder receives creative authority', async () => {
    const path = '/src/pages/Home.tsx';
    const before = { [path]: 'export default function Home(){return <main>Accepted</main>}' };
    const snapshot = {
      vfsFiles: before,
      pageRegistry: { pages: { home: { filePath: path } } },
      meta: {
        authorshipAuthority: {
          phase: 'builder-authoring', creativeAuthority: 'builder',
          commitAuthority: 'vfs-commit-service', launchRevisionId: IDENTITY.revisionId,
        },
      },
    };

    await expect(commitMutation({
      source: 'wizard-launch', identity: IDENTITY,
      current: { vfsFiles: before, siteBundleSnapshot: snapshot as never },
      patch: legacyFilesToPatchPlan({
        [path]: 'export default function Home(){return <main>Regenerated</main>}',
      }),
    })).rejects.toThrow('explicit regeneration/reset');

    expect(runFullPreflight).not.toHaveBeenCalled();
    expect(revisionStore).toHaveLength(0);
  });

  it('atomically adds page source, registry topology and the compiler-owned route', async () => {
    const homePath = '/src/pages/Home.tsx';
    const pricingPath = '/src/pages/Pricing.tsx';
    const homePage = {
      pageId: 'home', title: 'Home', path: '/', filePath: homePath, pageType: 'home',
      source: {}, output: {}, showInNav: true, navOrder: 0, isHome: true,
      createdAt: '2026-09-29T00:00:00.000Z', updatedAt: '2026-09-29T00:00:00.000Z', createdBy: 'ai',
    };
    const registry = { version: 1, pages: { home: homePage }, funnels: {}, homePageId: 'home' };
    const before = {
      '/src/App.tsx': 'export default function App(){return null}',
      [homePath]: 'export default function Home(){return <main>Home</main>}',
    };
    const playground = { pageRegistry: registry, creatorData: {}, bindings: {}, calendars: {}, popups: {} } as never;
    const snapshot = {
      businessName: 'Topology Co', pageRegistry: registry, vfsFiles: before,
      routerFile: { path: '/src/App.tsx', content: before['/src/App.tsx'] }, meta: {},
    };
    const pricingSource = 'export default function Pricing(){return <main>Pricing</main>}';
    vi.mocked(commitToPipeline).mockImplementationOnce((canonicalInput) => {
      const files = canonicalInput.existingVfsFiles!;
      return {
        source: 'ai-builder', committedAt: new Date().toISOString(),
        siteBundleSnapshot: {
          ...snapshot,
          pageRegistry: canonicalInput.playground!.pageRegistry,
          vfsFiles: files,
          routerFile: { path: '/src/App.tsx', content: files['/src/App.tsx'] },
        },
        runtimeManifest: { version: 1 }, playground: canonicalInput.playground,
        capabilities: [],
        gate: { previewReady: true, publishReady: true, preview: { ok: true, reasons: [] }, publish: { ok: true, reasons: [] } },
      } as never;
    });
    vi.mocked(runFullPreflight).mockImplementation((files) => ({
      files, stages: { earlyRepair: 'ok', finalRepair: 'ok' },
    }) as never);
    mockIntents();

    const patch = legacyFilesToPatchPlan({ [pricingPath]: pricingSource }, 'add pricing route');
    patch.routeOps = [{
      type: 'add_page', pageId: 'pricing', title: 'Pricing', route: '/pricing',
      pageType: 'pricing', createdBy: 'ai', showInNav: true,
    }];
    const committed = await commitMutation({
      source: 'ai-builder', identity: IDENTITY,
      current: { vfsFiles: before, siteBundleSnapshot: snapshot, playground },
      patch,
    });

    expect(committed.vfsFiles[pricingPath]).toBe(pricingSource);
    expect(committed.vfsFiles['/src/App.tsx']).toContain('<Route path="/pricing"');
    expect(committed.siteBundleSnapshot?.pageRegistry.pages.pricing).toMatchObject({
      pageId: 'pricing', path: '/pricing', filePath: pricingPath,
    });
    expect(committed.fileProvenance['/src/App.tsx'].ownership).toBe('compiler');
    const reopened = await loadRevision(committed.persistedRevisionId!);
    expect((reopened?.siteBundleSnapshot as { pageRegistry?: { pages?: Record<string, unknown> } })
      .pageRegistry?.pages?.pricing).toBeTruthy();
    expect(reopened?.vfsFiles['/src/App.tsx']).toContain('<Route path="/pricing"');
  });
  it('restores an undeclared ordinary AI source rewrite from the canonical projection', async () => {
    const pagePath = '/src/pages/Home.tsx';
    const hookPath = '/src/hooks/useBooking.ts';
    const before = {
      '/src/App.tsx': 'export default function App(){return null}',
      [pagePath]: 'export default function Home(){return <main>Before</main>}',
      [hookPath]: 'export const useBooking = () => "original";',
    };
    const requested = 'export default function Home(){return <main>Requested</main>}';
    mockPipeline({ ...before, [pagePath]: requested, [hookPath]: 'export const useBooking = () => "rewritten";' });
    mockPreflight({ ...before, [pagePath]: requested });
    mockIntents();
    const result = await commitMutation({
      source: 'ai-builder', identity: IDENTITY,
      current: { vfsFiles: before },
      patch: legacyFilesToPatchPlan({ [pagePath]: requested }),
      options: { dryRun: true, requireReadinessPass: false },
    });
    expect(result.vfsFiles[pagePath]).toBe(requested);
    expect(result.vfsFiles[hookPath]).toBe(before[hookPath]);
  });
  it('rejects an undeclared ordinary AI source rewrite from preflight before persistence', async () => {
    const pagePath = '/src/pages/Home.tsx';
    const hookPath = '/src/hooks/useBooking.ts';
    const before = {
      '/src/App.tsx': 'export default function App(){return null}',
      [pagePath]: 'export default function Home(){return <main>Before</main>}',
      [hookPath]: 'export const useBooking = () => "original";',
    };
    const requested = 'export default function Home(){return <main>Requested</main>}';
    mockPipeline({ ...before, [pagePath]: requested });
    mockPreflight({ ...before, [pagePath]: requested, [hookPath]: 'export const useBooking = () => "rewritten";' });
    mockIntents();
    await expect(commitMutation({
      source: 'ai-builder', identity: IDENTITY,
      current: { vfsFiles: before },
      patch: legacyFilesToPatchPlan({ [pagePath]: requested }),
    })).rejects.toThrow(/before backend effects/);
    expect(revisionStore).toHaveLength(0);
    expect(executeBackendOps).not.toHaveBeenCalled();
  });
  it('accepts the exact scratch composition without regenerating and rejects stale reviews', async () => {
    const before = { '/src/App.tsx': 'export default function App(){return <main>Before</main>}' };
    const after = { '/src/App.tsx': 'export default function App(){return <main>Enhanced</main>}' };
    mockPipeline(after); mockPreflight(after); mockIntents();
    const candidate = await commitMutation({ source: 'playground-edit', identity: IDENTITY,
      current: { vfsFiles: before, playground: { pages: [], theme: {} } as never },
      patch: legacyFilesToPatchPlan(after), options: { dryRun: true },
    });
    expect(candidate.status).toBe('committed');
    expect(revisionStore).toHaveLength(0);
    const reviewedComposition = { baseVfsHash: await hashVfsFiles(before), candidate };
    const pipelineCalls = vi.mocked(commitToPipeline).mock.calls.length;
    await expect(commitMutation({ source: 'playground-edit', identity: IDENTITY,
      current: { vfsFiles: after }, patch: emptyPatchPlan(), options: { reviewedComposition },
    })).rejects.toMatchObject({ code: 'COMPOSITION_PROVENANCE_MISMATCH' });
    await expect(commitMutation({ source: 'playground-edit', identity: { ...IDENTITY, projectId: 'another-project' },
      current: { vfsFiles: before }, patch: emptyPatchPlan(), options: { reviewedComposition },
    })).rejects.toMatchObject({ code: 'IDENTITY_MISMATCH' });
    await expect(commitMutation({ source: 'playground-edit', identity: { ...IDENTITY, revisionId: '66666666-6666-4666-8666-666666666666' },
      current: { vfsFiles: before }, patch: emptyPatchPlan(), options: { reviewedComposition },
    })).rejects.toMatchObject({ code: 'COMPOSITION_PROVENANCE_MISMATCH' });
    await expect(commitMutation({ source: 'playground-edit', identity: IDENTITY,
      current: { vfsFiles: before }, patch: legacyFilesToPatchPlan(after), options: { reviewedComposition },
    })).rejects.toMatchObject({ code: 'SCOPE_ESCAPE' });
    const result = await commitMutation({ source: 'playground-edit', identity: IDENTITY,
      current: { vfsFiles: before }, patch: emptyPatchPlan(), options: { reviewedComposition },
    });
    expect(vi.mocked(commitToPipeline).mock.calls).toHaveLength(pipelineCalls);
    expect(result.vfsFiles).toEqual(after);
    expect(result.vfsHash).toBe(candidate.vfsHash);
    expect(revisionStore).toHaveLength(1);
  });
  it('rolls the exact previous composition forward and reloads it without regeneration', async () => {
    const before = { '/src/App.tsx': 'export default function App(){return <main>Original content</main>}' };
    mockPipeline(before); mockPreflight(before); mockIntents();
    const original = await commitMutation({ source: 'playground-edit', identity: IDENTITY,
      current: { vfsFiles: before }, patch: emptyPatchPlan(),
    });
    const after = { '/src/App.tsx': 'export default function App(){return <main>Enhanced content</main>}' };
    mockPipeline(after); mockPreflight(after);
    const enhanced = await commitMutation({ source: 'playground-edit', identity: { ...IDENTITY, revisionId: original.persistedRevisionId! },
      current: { vfsFiles: before }, patch: legacyFilesToPatchPlan(after),
    });
    mockPreflight(before);
    const calls = vi.mocked(commitToPipeline).mock.calls.length;
    const restored = await restoreRevision({ targetRevisionId: original.persistedRevisionId!, identity: { ...IDENTITY, revisionId: enhanced.persistedRevisionId! } });
    expect(restored.status).toBe('committed');
    expect(restored.vfsFiles).toEqual(before);
    expect(restored.parentRevisionId).toBe(enhanced.persistedRevisionId);
    expect(vi.mocked(commitToPipeline).mock.calls).toHaveLength(calls);
    expect((await loadLatestRevisionForProject(IDENTITY.projectId))?.vfsFiles).toEqual(before);
    expect(revisionStore).toHaveLength(3);
  });
  it('restores the candidate when a Playground projection rewrites source outside it', async () => {
    const files = { '/src/App.tsx': 'export default function App(){return null}' };
    const repairedFiles = { '/src/App.tsx': 'export default function App(){return <main>Repaired</main>}' };
    mockPipeline(files);
    mockPreflight(files);
    mockIntents();
    vi.mocked(buildCanonicalLaunchArtifacts).mockImplementationOnce((input) => ({
      files: repairedFiles,
      siteBundleSnapshot: {
        ...input.siteBundleSnapshot,
        vfsFiles: repairedFiles,
        routerFile: { path: '/src/App.tsx', content: repairedFiles['/src/App.tsx'] },
      },
      runtimeManifest: { version: 1 },
      generatedSiteRuntimeManifest: { siteId: '55555555-5555-4555-8555-555555555555', agents: [] },
    } as unknown as ReturnType<typeof buildCanonicalLaunchArtifacts>));

    const result = await commitMutation({
      source: 'playground-edit',
      identity: IDENTITY,
      current: { vfsFiles: files },
      patch: emptyPatchPlan(),
      options: { requireReadinessPass: false, dryRun: true },
    });

    expect(result.vfsFiles['/src/App.tsx']).toBe(files['/src/App.tsx']);
    expect(result.diagnostics.some((d) => /restored the exact candidate source/.test(d.message))).toBe(true);
  });

  it('rejects runtime incompatibility even when both repair stages report success', async () => {
    const files = { '/src/App.tsx': 'export default function App(){return null}' };
    mockPipeline(files);
    mockIntents();
    vi.mocked(runFullPreflight).mockReturnValue({
      files,
      stages: {
        earlyRepair: 'ok',
        finalRepair: 'ok',
        runtimeCompatibility: { ok: false, blockers: ['Missing canonical runtime module'] },
      },
    } as unknown as ReturnType<typeof runFullPreflight>);

    await expect(commitMutation({
      source: 'playground-edit',
      identity: IDENTITY,
      current: { vfsFiles: files },
      patch: emptyPatchPlan(),
      options: { dryRun: true, requirePreviewPass: true, requireReadinessPass: false },
    })).rejects.toMatchObject({ result: { status: 'rejected' } });

    expect(runFullPreflight).toHaveBeenCalledTimes(5);
    expect(executeBackendOps).not.toHaveBeenCalled();
    expect(runtimeReconcileInvoke).not.toHaveBeenCalled();
    expect(revisionStore).toEqual([]);
  });

  it('adopts validated deterministic preflight normalization into the explicit candidate', async () => {
    const files = { '/src/App.tsx': 'export default function App(){return <main data-ut-intent="nav.goto">Safe</main>}' };
    const normalized = { '/src/App.tsx': 'export default function App(){return <main data-ut-intent="nav.goto" data-ut-slot="primary">Safe</main>}' };
    mockPipeline(files);
    mockIntents();
    vi.mocked(runFullPreflight)
      .mockReturnValueOnce({
        files,
        mode: 'acceptance',
        mutated: false,
        mutatedFiles: [],
        violations: ['/src/App.tsx'],
        stages: { earlyRepair: 'ok', finalRepair: 'ok', runtimeCompatibility: { ok: true } },
      } as unknown as ReturnType<typeof runFullPreflight>)
      .mockReturnValueOnce({
        files: normalized,
        mode: 'repair',
        mutated: true,
        mutatedFiles: ['/src/App.tsx'],
        violations: [],
        stages: { earlyRepair: 'ok', finalRepair: 'ok', runtimeCompatibility: { ok: true } },
      } as unknown as ReturnType<typeof runFullPreflight>)
      .mockReturnValueOnce({
        files: normalized,
        mode: 'acceptance',
        mutated: false,
        mutatedFiles: [],
        violations: [],
        stages: { earlyRepair: 'ok', finalRepair: 'ok', runtimeCompatibility: { ok: true } },
      } as unknown as ReturnType<typeof runFullPreflight>);

    const result = await commitMutation({
      source: 'ai-builder',
      identity: IDENTITY,
      current: { vfsFiles: files },
      patch: emptyPatchPlan(),
      options: { dryRun: true, requireReadinessPass: false },
    });

    expect(result.status).toBe('committed');
    expect(result.vfsFiles?.['/src/App.tsx']).toBe(normalized['/src/App.tsx']);
    expect(runFullPreflight).toHaveBeenCalledTimes(3);
  });

  it.each(['playground-edit', 'binding-fast-path', 'preview-toolbar'] as const)(
    'restores hidden projection rewrites for %s commits', async (source) => {
      const files = {
        '/src/App.tsx': 'export default function App(){return null}',
        '/src/hooks/useBooking.ts': 'export const useBooking = () => "accepted";',
        '/src/styles/custom.css': '.hero { display: grid; }',
        '/public/logo.svg': '<svg><title>Accepted</title></svg>',
      };
      const projected = { ...files, '/src/hooks/useBooking.ts': 'export const useBooking = () => "hidden rewrite";' };
      mockPipeline(projected);
      mockPreflight(projected);
      mockIntents();

      mockPreflight(files);
      const result = await commitMutation({
        source,
        identity: IDENTITY,
        current: { vfsFiles: files },
        patch: emptyPatchPlan(),
        options: { dryRun: true, requireReadinessPass: false },
      });
      expect(result.vfsFiles['/src/hooks/useBooking.ts']).toBe(files['/src/hooks/useBooking.ts']);
    },
  );

  it('preserves arbitrary source and assets byte-for-byte when they are outside an explicit edit', async () => {
    const files = {
      '/src/App.tsx': 'export default function App(){return null}',
      '/src/components/Hero.tsx': 'export const Hero = () => <section>Exact</section>;',
      '/src/features/gallery/useGallery.ts': 'export const useGallery = () => 1;',
      '/src/styles/custom.css': '.gallery { gap: 3rem; }',
      '/public/logo.svg': '<svg><title>Exact</title></svg>',
    };
    const changedApp = 'export default function App(){return <main>Explicit</main>}';
    const candidate = { ...files, '/src/App.tsx': changedApp };
    mockPipeline(candidate);
    mockPreflight(candidate);
    mockIntents();

    const result = await commitMutation({
      source: 'playground-edit',
      identity: IDENTITY,
      current: { vfsFiles: files },
      patch: legacyFilesToPatchPlan({ '/src/App.tsx': changedApp }, 'explicit app edit'),
    });

    expect(result.vfsFiles).toEqual(candidate);
    expect(revisionStore[0]?.vfs_files).toEqual(candidate);
  });

  it('carries unchanged provenance forward while stamping changed files with the new revision', async () => {
    const original = {
      '/src/App.tsx': 'export default function App(){return null}',
      '/src/hooks/useStable.ts': 'export const useStable = () => true;',
    };
    mockPipeline(original);
    mockPreflight(original);
    mockIntents();
    const first = await commitMutation({
      source: 'playground-edit', identity: IDENTITY,
      current: { vfsFiles: {} },
      patch: { ...legacyFilesToPatchPlan(original), operationIds: ['operation-1'] },
    });

    const next = { ...original, '/src/App.tsx': 'export default function App(){return <main>Next</main>}' };
    mockPipeline(next);
    mockPreflight(next);
    const second = await commitMutation({
      source: 'playground-edit',
      identity: { ...IDENTITY, revisionId: first.persistedRevisionId! },
      // Autosave's local VFS already contains the pending mutation. The
      // durable parent revision still defines provenance's prior hash.
      current: { vfsFiles: next },
      patch: { ...legacyFilesToPatchPlan(next), operationIds: ['operation-2'] },
    });

    expect(second.fileProvenance['/src/hooks/useStable.ts'].authoredRevisionId).toBe(first.persistedRevisionId);
    expect(second.fileProvenance['/src/App.tsx']).toMatchObject({
      authoredRevisionId: second.persistedRevisionId,
      lastOperationIds: ['operation-2'],
      priorHash: first.fileProvenance['/src/App.tsx'].currentHash,
    });
    expect(revisionStore[1].file_provenance).toEqual(second.fileProvenance);
  });

  it('records Wizard capabilities without provisioning before revision persistence', async () => {
    const files = {
      '/src/App.tsx': 'export default function App(){return null}',
      '/.unison/wizard-seed.json': JSON.stringify({
        canonical: { capabilities: ['booking', 'contact'] },
      }),
    };
    mockPipeline(files);
    mockPreflight(files);
    mockIntents(0, 0);

    const launch = await commitMutation({
      source: 'wizard-launch',
      identity: IDENTITY,
      current: { vfsFiles: {}, activePagePath: '/src/App.tsx' },
      patch: legacyFilesToPatchPlan(files, 'capability request'),
      options: { selections: { industry: 'salon' } as never },
    });

    expect(executeBackendOps).not.toHaveBeenCalled();
    expect(launch.siteBundleSnapshot?.businessSystem?.capabilities).toEqual([
      expect.objectContaining({ id: 'booking', status: 'approved' }),
      expect.objectContaining({ id: 'contact', status: 'approved' }),
    ]);
  });

  it('persists a reviewed wizard artifact without regenerating it', async () => {
    const reviewedFiles = {
      '/src/App.tsx': 'export default function Reviewed(){return <main>Reviewed</main>}',
      '/src/pages/Home.tsx': 'export default function Home(){return <h1>Exact AI output</h1>}',
      '/src/project-components/Gallery.tsx': 'export const Gallery = () => <div>Original layout</div>;',
      '/src/hooks/useGallery.ts': 'export const useGallery = () => 1;',
      '/src/styles/gallery.css': '.gallery { gap: 3rem; }',
      '/public/cover.svg': '<svg/>',
    };
    const launcherFiles = {
      ...reviewedFiles,
      '/src/pages/Home.tsx': 'export default function Home(){return <h1>Auxiliary launcher copy</h1>}',
      '/src/hooks/useGallery.ts': 'export const useGallery = () => 0;',
      '/.unison/wizard-seed.json': '{"version":1}',
    };
    const snapshot = {
      vfsFiles: reviewedFiles,
      routerFile: { path: '/src/App.tsx', content: reviewedFiles['/src/App.tsx'] },
      pageRegistry: {
        pages: {
          home: { pageId: 'home', filePath: '/src/pages/Home.tsx', path: '/', isHome: true },
        },
      },
      meta: { seal: { laneAProtectedFiles: ['/src/App.tsx'] } },
    } as never;
    mockPreflight(reviewedFiles);
    mockIntents(0, 0);

    const launch = await commitMutation({
      source: 'wizard-launch',
      identity: IDENTITY,
      current: { vfsFiles: {} },
      patch: legacyFilesToPatchPlan(launcherFiles, 'reviewed launch'),
      options: {
        selections: { industry: 'salon' } as never,
        reviewedArtifact: {
          siteBundleSnapshot: snapshot,
          runtimeManifest: { entryPoint: '/src/App.tsx' } as never,
        },
      },
    });

    expect(commitToPipeline).not.toHaveBeenCalled();
    expect(launch.vfsFiles['/src/pages/Home.tsx']).toBe(reviewedFiles['/src/pages/Home.tsx']);
    expect(launch.vfsFiles['/src/hooks/useGallery.ts']).toBe(reviewedFiles['/src/hooks/useGallery.ts']);
    expect(launch.vfsFiles['/.unison/wizard-seed.json']).toBe('{"version":1}');
    expect(revisionStore[0]?.vfs_files['/.unison/wizard-seed.json']).toBe('{"version":1}');
    expect((revisionStore[0]?.site_bundle_snapshot as { vfsFiles?: Record<string, string> }).vfsFiles)
      .toEqual(reviewedFiles);
    expect((revisionStore[0]?.site_bundle_snapshot as { vfsFiles?: Record<string, string> }).vfsFiles)
      .not.toHaveProperty('/.unison/wizard-seed.json');
    expect(launch.diagnostics).toContainEqual(expect.objectContaining({
      stage: 'canonical',
      message: expect.stringContaining('regeneration skipped'),
    }));
  });

  it.each(['replace', 'delete', 'create', 'mutate-in-place'] as const)(
    'rejects %s of reviewed non-page source before backend effects or persistence', async (mutation) => {
      const reviewedFiles = {
        '/src/App.tsx': 'export default function App(){return null}',
        '/src/hooks/useGallery.ts': 'export const useGallery = () => 1;',
        '/public/cover.svg': '<svg/>',
      };
      const snapshot = { vfsFiles: reviewedFiles, routerFile: { path: '/src/App.tsx', content: reviewedFiles['/src/App.tsx'] }, meta: {} } as never;
      vi.mocked(runFullPreflight).mockImplementation((incoming) => {
        const changed: Record<string, string> = mutation === 'mutate-in-place' ? incoming : { ...incoming };
        if (mutation === 'delete') delete changed['/public/cover.svg'];
        else if (mutation === 'create') changed['/src/styles/surprise.css'] = '.surprise{}';
        else changed['/src/hooks/useGallery.ts'] = 'export const useGallery = () => 9;';
        return { files: changed, stages: { earlyRepair: 'ok', finalRepair: 'ok' } } as never;
      });
      mockIntents();
      await expect(commitMutation({
        source: 'wizard-launch', identity: IDENTITY, current: { vfsFiles: {} },
        patch: { ...legacyFilesToPatchPlan(reviewedFiles), backendOps: [{ type: 'requireCapability', capability: 'booking' }] },
        options: { reviewedArtifact: { siteBundleSnapshot: snapshot, runtimeManifest: { version: 1 } as never } },
      })).rejects.toThrow('before backend effects changed reviewed source');
      expect(executeBackendOps).not.toHaveBeenCalled();
      expect(runtimeReconcileInvoke).not.toHaveBeenCalled();
      expect(revisionStore).toHaveLength(0);
      expect(draftProjectionUpdates).toHaveLength(0);
      expect(reviewedFiles['/src/hooks/useGallery.ts']).toContain('=> 1');
    },
  );

  it('hard-fails when the atomic canonical revision transaction fails', async () => {
    const files = { '/src/App.tsx': 'export default function App(){return null}' };
    mockPipeline(files);
    mockPreflight(files);
    mockIntents(0, 0);
    canonicalCommitRpcError = { message: 'draft projection update denied' };

    await expect(commitMutation({
      source: 'wizard-launch',
      identity: IDENTITY,
      current: { vfsFiles: {}, activePagePath: '/src/App.tsx' },
      patch: legacyFilesToPatchPlan(files, 'atomic failure'),
      options: { selections: { industry: 'salon' } as never },
    })).rejects.toThrow('canonical revision transaction failed');

    expect(revisionStore).toEqual([]);
    expect(draftProjectionUpdates).toEqual([]);
  });

  it('recovers a committed revision when the RPC response times out after commit', async () => {
    const files = { '/src/App.tsx': 'export default function App(){return null}' };
    mockPipeline(files);
    mockPreflight(files);
    mockIntents(0, 0);
    canonicalCommitRpcError = { message: 'upstream request timeout' };
    const vfsHash = await hashVfsFiles(files);
    const recoveredRevisionId = '00000000-0000-0000-0000-999999999999';
    revisionStore.push({
      id: recoveredRevisionId,
      project_id: IDENTITY.projectId,
      business_id: IDENTITY.businessId,
      draft_id: IDENTITY.draftId,
      parent_revision_id: null,
      source: 'ai-builder',
      status: 'committed',
      patch_json: {},
      vfs_files: files,
      site_bundle_snapshot: {},
      runtime_manifest: {},
      playground_state: {},
      readiness_report: {},
      diagnostics: [],
      candidate_id: null,
      operation_ids: [],
      file_provenance: {},
      created_by: IDENTITY.userId,
      created_at: new Date().toISOString(),
      vfs_hash: vfsHash,
    } as RevisionRow);

    const result = await commitMutation({
      source: 'ai-builder',
      identity: IDENTITY,
      current: { vfsFiles: {}, activePagePath: '/src/App.tsx' },
      patch: legacyFilesToPatchPlan(files, 'recover timed out commit'),
      options: { selections: { industry: 'portfolio' } as never },
    });

    expect(result.status).toBe('committed');
    expect(result.persistedRevisionId).toBe(recoveredRevisionId);
    expect(revisionStore).toHaveLength(1);
    const persistedPatch = lastCanonicalCommitPayload?.p_patch_json as {
      fileOps?: Array<Record<string, unknown>>;
    } | undefined;
    expect(persistedPatch?.fileOps?.[0]).not.toHaveProperty('contents');
  });

  it('waits for a late commit and does not recover an older same-hash revision from another parent', async () => {
    const files = { '/src/App.tsx': 'export default function App(){return null}' };
    mockPipeline(files);
    mockPreflight(files);
    mockIntents(0, 0);
    canonicalCommitRpcError = { message: 'upstream request timeout' };
    const vfsHash = await hashVfsFiles(files);
    const recoveredRevisionId = '00000000-0000-0000-0000-999999999999';
    const recoveredRow = {
      id: recoveredRevisionId,
      project_id: IDENTITY.projectId,
      business_id: IDENTITY.businessId,
      draft_id: IDENTITY.draftId,
      parent_revision_id: null,
      source: 'ai-builder',
      status: 'committed',
      patch_json: {},
      vfs_files: files,
      site_bundle_snapshot: {},
      runtime_manifest: {},
      playground_state: {},
      readiness_report: {},
      diagnostics: [],
      candidate_id: null,
      operation_ids: [],
      file_provenance: {},
      created_by: IDENTITY.userId,
      created_at: new Date().toISOString(),
      vfs_hash: vfsHash,
    } as RevisionRow;
    revisionStore.push({ ...recoveredRow, id: 'stale-revision', parent_revision_id: 'different-parent' });
    vi.useFakeTimers();
    try {
      setTimeout(() => revisionStore.push(recoveredRow), 3_000);

      const pending = commitMutation({
        source: 'ai-builder',
        identity: IDENTITY,
        current: { vfsFiles: {}, activePagePath: '/src/App.tsx' },
        patch: legacyFilesToPatchPlan(files, 'recover timed out commit'),
        options: { selections: { industry: 'portfolio' } as never },
      });

      await vi.waitFor(() => expect(lastCanonicalCommitPayload).not.toBeNull());
      const queuedDuplicate = commitMutation({
        source: 'ai-builder',
        identity: IDENTITY,
        current: { vfsFiles: {}, activePagePath: '/src/App.tsx' },
        patch: legacyFilesToPatchPlan(files, 'overlap during timeout recovery'),
        options: { selections: { industry: 'portfolio' } as never },
      });
      await vi.runAllTimersAsync();
      const result = await pending;
      const duplicate = await queuedDuplicate;
      expect(result.status).toBe('committed');
      expect(result.persistedRevisionId).toBe(recoveredRevisionId);
      expect(duplicate.persistedRevisionId).toBe(recoveredRevisionId);
      expect(revisionStore).toHaveLength(2);
      const persistedPatch = lastCanonicalCommitPayload?.p_patch_json as {
        fileOps?: Array<Record<string, unknown>>;
      } | undefined;
      expect(persistedPatch?.fileOps?.[0]).not.toHaveProperty('contents');
    } finally { vi.useRealTimers(); }
  });

  it('queues and coalesces an identical AI save while the same draft is being persisted', async () => {
    const files = { '/src/App.tsx': 'export default function App(){return null}' };
    mockPipeline(files);
    mockPreflight(files);
    mockIntents(0, 0);
    let release!: () => void;
    canonicalCommitRpcWait = new Promise<void>((resolve) => { release = resolve; });
    const input = {
      source: 'ai-builder' as const,
      identity: IDENTITY,
      current: { vfsFiles: {}, activePagePath: '/src/App.tsx' },
      patch: legacyFilesToPatchPlan(files, 'one accepted AI edit'),
      options: { selections: { industry: 'portfolio' } as never },
    };
    const first = commitMutation(input);
    let secondSettled = false;
    const second = commitMutation(input).finally(() => { secondSettled = true; });
    try {
      await vi.waitFor(() => expect(lastCanonicalCommitPayload).not.toBeNull());
      await Promise.resolve();
      expect(secondSettled).toBe(false);
    } finally { release(); }
    const firstResult = await first;
    const secondResult = await second;
    expect(firstResult.status).toBe('committed');
    expect(secondResult.persistedRevisionId).toBe(firstResult.persistedRevisionId);
    expect(revisionStore).toHaveLength(1);
  });

  it('rebases queued non-overlapping file edits onto the latest accepted VFS', async () => {
    const baseFiles = {
      '/src/App.tsx': 'export default function App(){return null}',
      '/src/pages/Home.tsx': 'export default function Home(){return <h1>Home</h1>}',
      '/src/pages/About.tsx': 'export default function About(){return <h1>About</h1>}',
    };
    mockPipeline(baseFiles);
    mockPreflight(baseFiles);
    mockIntents();
    const launch = await commitMutation({
      source: 'wizard-launch',
      identity: IDENTITY,
      current: { vfsFiles: {} },
      patch: legacyFilesToPatchPlan(baseFiles, 'queue rebase fixture'),
      options: { selections: { industry: 'portfolio' } as never },
    });

    (commitToPipeline as unknown as ReturnType<typeof vi.fn>).mockImplementation((canonicalInput: { existingVfsFiles: Record<string, string> }) => {
      const files = canonicalInput.existingVfsFiles;
      return {
        source: 'playground-edit',
        committedAt: new Date().toISOString(),
        siteBundleSnapshot: { vfsFiles: files, routerFile: { path: '/src/App.tsx', content: files['/src/App.tsx'] }, meta: {} },
        runtimeManifest: { version: 1 },
        playground: { pages: [], theme: {} } as never,
        capabilities: [],
        gate: { previewReady: true, publishReady: true, preview: { ok: true, reasons: [] }, publish: { ok: true, reasons: [] } },
      };
    });
    (runFullPreflight as unknown as ReturnType<typeof vi.fn>).mockImplementation((files: Record<string, string>) => ({
      files,
      stages: { earlyRepair: 'ok', finalRepair: 'ok' },
    }));

    const home = commitMutation({
      source: 'preview-toolbar',
      identity: { ...IDENTITY, revisionId: launch.persistedRevisionId! },
      current: { vfsFiles: launch.vfsFiles, siteBundleSnapshot: launch.siteBundleSnapshot ?? undefined },
      patch: legacyFilesToPatchPlan({ '/src/pages/Home.tsx': 'export default function Home(){return <h1>Home edit</h1>}' }, 'home edit'),
    });
    const about = commitMutation({
      source: 'ai-builder',
      identity: { ...IDENTITY, revisionId: launch.persistedRevisionId! },
      current: { vfsFiles: launch.vfsFiles, siteBundleSnapshot: launch.siteBundleSnapshot ?? undefined },
      patch: {
        ...legacyFilesToPatchPlan({ '/src/pages/About.tsx': 'export default function About(){return <h1>About edit</h1>}' }, 'about edit'),
        candidate: {
          id: 'candidate-about', baseRevisionId: launch.persistedRevisionId ?? undefined,
          origin: 'builder', knowledgeVersion: 'test', targetPages: ['/about'], attempt: 1,
        },
      },
    });

    const [homeResult, aboutResult] = await Promise.all([home, about]);
    expect(homeResult.status).toBe('committed');
    expect(aboutResult.status).toBe('committed');
    expect(aboutResult.parentRevisionId).toBe(homeResult.persistedRevisionId);
    expect(aboutResult.vfsFiles['/src/pages/Home.tsx']).toContain('Home edit');
    expect(aboutResult.vfsFiles['/src/pages/About.tsx']).toContain('About edit');
    expect(aboutResult.candidateId).toBe('candidate-about');
    expect((revisionStore[revisionStore.length - 1]?.patch_json.candidate as { baseRevisionId?: string }).baseRevisionId).toBe(homeResult.persistedRevisionId);

    const rowsBeforeUnsafeRetries = revisionStore.length;
    await expect(commitMutation({
      source: 'ai-builder',
      identity: { ...IDENTITY, revisionId: launch.persistedRevisionId ?? '' },
      current: { vfsFiles: launch.vfsFiles },
      patch: {
        ...legacyFilesToPatchPlan({ '/src/pages/About.tsx': baseFiles['/src/pages/About.tsx'] }, 'stale page creation'),
        routeOps: [{ type: 'add_page', pageId: 'new-page', title: 'New', route: '/new' }],
      },
    })).rejects.toThrow('missing captured registry');
    await expect(commitMutation({
      source: 'ai-builder',
      identity: { ...IDENTITY, revisionId: launch.persistedRevisionId ?? '' },
      current: { vfsFiles: launch.vfsFiles },
      patch: {
        ...legacyFilesToPatchPlan({ '/src/pages/About.tsx': baseFiles['/src/pages/About.tsx'] }, 'wrong candidate base'),
        candidate: {
          id: 'wrong-base', baseRevisionId: 'another-revision', origin: 'builder',
          knowledgeVersion: 'test', targetPages: ['/about'], attempt: 1,
        },
      },
    })).rejects.toThrow('captured base revision');
    expect(revisionStore).toHaveLength(rowsBeforeUnsafeRetries);

    const conflictingBase = {
      source: 'preview-toolbar' as const,
      identity: { ...IDENTITY, revisionId: aboutResult.persistedRevisionId! },
      current: { vfsFiles: aboutResult.vfsFiles, siteBundleSnapshot: aboutResult.siteBundleSnapshot ?? undefined },
    };
    const firstHomeEdit = commitMutation({
      ...conflictingBase,
      patch: legacyFilesToPatchPlan({ '/src/pages/Home.tsx': 'export default function Home(){return <h1>First edit</h1>}' }, 'first overlapping edit'),
    });
    const secondHomeEdit = commitMutation({
      ...conflictingBase,
      source: 'ai-builder',
      patch: {
        ...legacyFilesToPatchPlan({ '/src/pages/Home.tsx': 'export default function Home(){return <h1>Second edit</h1>}' }, 'second overlapping edit'),
        candidate: {
          id: 'candidate-home', baseRevisionId: aboutResult.persistedRevisionId ?? undefined,
          origin: 'builder', knowledgeVersion: 'test', targetPages: ['/'], attempt: 1,
        },
      },
    });
    const [firstConflictResult, secondConflictResult] = await Promise.allSettled([firstHomeEdit, secondHomeEdit]);

    expect(firstConflictResult.status).toBe('fulfilled');
    expect(secondConflictResult.status).toBe('rejected');
    if (secondConflictResult.status === 'rejected') {
      expect(String(secondConflictResult.reason)).toContain('overlaps a newer saved revision');
    }
  });

  describe('structured queue dependency checks', () => {
    function fixture(patch: Partial<CommitMutationInput['patch']>) {
      const files = { '/src/pages/Home.tsx': 'home', '/src/pages/About.tsx': 'about', '/src/index.css': 'theme' };
      const registry = { version: 1, pages: { home: { pageId: 'home', path: '/', filePath: '/src/pages/Home.tsx' } }, funnels: {} };
      const snapshot = { pageRegistry: registry, themeTokens: { accent: 'original' }, meta: {
        themePresetId: 'modern', designIntervention: { activeVariants: {}, motionBudget: 'restrained' },
      } };
      const playground = { pageRegistry: registry, bindings: {} };
      const input = {
        source: 'ai-builder', identity: { ...IDENTITY, revisionId: 'base' },
        current: { vfsFiles: files, playground, siteBundleSnapshot: snapshot },
        patch: { ...emptyPatchPlan(), ...patch },
      } as unknown as CommitMutationInput;
      const latest = {
        identity: input.identity, persistedRevisionId: 'latest',
        vfsFiles: { ...files, '/src/pages/About.tsx': 'new about' },
        playground, siteBundleSnapshot: snapshot, diagnostics: [], operationIds: [], candidateId: null,
      } as unknown as CommitMutationResult;
      return { input, latest };
    }

    it('rebases page creation after an unrelated source save', () => {
      const { input, latest } = fixture({ routeOps: [{ type: 'add_page', pageId: 'contact', title: 'Contact', route: '/contact' }],
        fileOps: [{ type: 'create', path: '/src/pages/Contact.tsx', contents: 'contact' }] });
      const prepared = rebaseQueuedCommit(input, latest);
      expect('input' in prepared).toBe(true);
      if ('input' in prepared) {
        expect(prepared.input.identity.revisionId).toBe('latest');
        expect(prepared.input.current.vfsFiles['/src/pages/About.tsx']).toBe('new about');
        expect(prepared.input.patch.routeOps?.[0].pageId).toBe('contact');
      }
    });

    it('rebases theme and motion edits without discarding their operations', () => {
      for (const patch of [
        { themeEdit: { version: '1.0' as const, snapshotId: 'snapshot', revisionId: 'base', set: { '--primary': 'red' }, reset: [] } },
        { presentationOps: [{ type: 'setMotionBudget' as const, motionBudget: 'expressive' as const }] },
      ]) {
        const { input, latest } = fixture(patch);
        const prepared = rebaseQueuedCommit(input, latest);
        expect('input' in prepared).toBe(true);
        if ('input' in prepared) expect(prepared.input.patch).toMatchObject(patch);
      }
    });

    it('rejects a theme edit when newer theme CSS changed', () => {
      const { input, latest } = fixture({ themeEdit: { version: '1.0', snapshotId: 'snapshot', revisionId: 'base', set: {}, reset: [] } });
      latest.vfsFiles['/src/index.css'] = 'new theme';
      expect(() => rebaseQueuedCommit(input, latest)).toThrow('theme CSS');
    });

    it('rejects page deletion when the target page has newer content', () => {
      const { input, latest } = fixture({ routeOps: [{ type: 'remove_page', pageId: 'home' }] });
      latest.vfsFiles['/src/pages/Home.tsx'] = 'new home';
      expect(() => rebaseQueuedCommit(input, latest)).toThrow('/src/pages/Home.tsx');
    });

    it('rejects a topology edit after a newer topology change', () => {
      const { input, latest } = fixture({ routeOps: [{ type: 'toggle_nav', pageId: 'home', showInNav: false }] });
      latest.playground = { ...latest.playground, pageRegistry: { ...latest.playground?.pageRegistry, homePageId: 'other' } } as CommitMutationResult['playground'];
      expect(() => rebaseQueuedCommit(input, latest)).toThrow('page topology');
    });

    it('keeps binding projection guarded when rendered source changed', () => {
      const { input, latest } = fixture({ bindingOps: [{ type: 'unbindIntent', elementId: 'button' }] });
      expect(() => rebaseQueuedCommit(input, latest)).toThrow('binding source');
    });

    it('rejects queue reuse across projects even for an identical no-op', () => {
      const { input, latest } = fixture({});
      latest.identity = { ...latest.identity, projectId: 'another-project' };
      let rejection: unknown;
      try {
        rebaseQueuedCommit(input, latest);
      } catch (error) {
        rejection = error;
      }
      expect(rejection).toMatchObject({ code: 'IDENTITY_MISMATCH', stage: 'queue-rebase' });
      expect(String(rejection)).toContain('different project or account');
    });

    it('keeps reviewed restores tied to their reviewed revision', () => {
      const { input, latest } = fixture({});
      input.source = 'system-restore';
      expect(() => rebaseQueuedCommit(input, latest)).toThrow('reviewed launch or restore');
    });
  });

  it('chains five commits across sources and persists a revision per step', async () => {
    const salonFiles = {
      '/src/App.tsx': 'export default function App(){return null}',
      '/src/pages/Home.tsx': '<Hero/>',
    };
    mockPipeline(salonFiles);
    mockPreflight(salonFiles);
    mockIntents(0, 0);

    // 1. Wizard launch
    const launch = await commitMutation({
      source: 'wizard-launch',
      identity: IDENTITY,
      current: { vfsFiles: {} },
      patch: legacyFilesToPatchPlan(salonFiles, 'salon launch'),
      options: { selections: { industry: 'salon' } as never },
    });
    expect(launch.status).toBe('committed');
    expect(launch.persistedRevisionId).toBe('00000000-0000-0000-0000-000000000001');
    expect(draftProjectionUpdates).toEqual([{
      id: IDENTITY.draftId,
      userId: IDENTITY.userId,
      revisionId: launch.persistedRevisionId,
    }]);
    expect(launch.parentRevisionId).toBeNull();

    // 2. AI Builder edits hero
    const heroFiles = { ...salonFiles, '/src/pages/Home.tsx': '<Hero variant="bold"/>' };
    mockPipeline(heroFiles);
    mockPreflight(heroFiles);
    const heroEdit = await commitMutation({
      source: 'ai-builder',
      identity: { ...IDENTITY, revisionId: launch.persistedRevisionId! },
      current: { vfsFiles: launch.vfsFiles, playground: launch.playground ?? undefined },
      patch: legacyFilesToPatchPlan({ '/src/pages/Home.tsx': '<Hero variant="bold"/>' }, 'hero bold'),
    });
    expect(heroEdit.status).toBe('committed');
    expect(heroEdit.parentRevisionId).toBe('00000000-0000-0000-0000-000000000001');

    // 3. AI Builder adds Services page
    const withServices = { ...heroFiles, '/src/pages/Services.tsx': '<Services/>' };
    mockPipeline(withServices);
    mockPreflight(withServices);
    const addPage = await commitMutation({
      source: 'ai-builder',
      identity: { ...IDENTITY, revisionId: heroEdit.persistedRevisionId! },
      current: { vfsFiles: heroEdit.vfsFiles, playground: heroEdit.playground ?? undefined },
      patch: legacyFilesToPatchPlan({ '/src/pages/Services.tsx': '<Services/>' }, 'add services'),
    });
    expect(addPage.parentRevisionId).toBe('00000000-0000-0000-0000-000000000002');

    // 4. Binding fast-path wires CTA
    const ctaPatch = emptyPatchPlan('wire cta');
    // The golden orchestration mock has no canonical Playground binding map.
    // Binding semantics are covered by bindingOperationExecutor; this step
    // verifies that a binding-fast-path revision still chains correctly.
    mockPipeline(withServices);
    mockPreflight(withServices);
    const wire = await commitMutation({
      source: 'binding-fast-path',
      identity: { ...IDENTITY, revisionId: addPage.persistedRevisionId! },
      current: { vfsFiles: addPage.vfsFiles, playground: addPage.playground ?? undefined },
      patch: ctaPatch,
    });
    expect(wire.parentRevisionId).toBe('00000000-0000-0000-0000-000000000003');
    expect(revisionStore).toHaveLength(4);

    // 5. Refresh → hydration prefers latest revision row, not sessionStorage
    const hydrated = await loadLatestRevisionForProject(IDENTITY.projectId);
    expect(hydrated?.id).toBe('00000000-0000-0000-0000-000000000004');
    expect(hydrated?.source).toBe('binding-fast-path');
  });

  it('persists a committed revision but reports publishBlocked when availability is removed', async () => {
    const files = { '/src/App.tsx': 'x', '/src/pages/Booking.tsx': '<Booking/>' };
    mockPipeline(files);
    mockPreflight(files);
    // Preview passes, publish fails — matches "remove availability" scenario.
    mockIntents(0, 2);

    const result = await commitMutation({
      source: 'ai-builder',
      identity: IDENTITY,
      current: { vfsFiles: files, playground: { pages: [] } as never },
      patch: legacyFilesToPatchPlan({ '/src/pages/Booking.tsx': '<Booking/>' }, 'remove availability'),
    });

    expect(result.status).toBe('committed');
    const intentReadiness = (result.readinessReport as { intentReadiness?: { summary: { publishBlocked: number; previewBlocked: number } } }).intentReadiness;
    expect(intentReadiness?.summary.publishBlocked).toBe(2);
    expect(intentReadiness?.summary.previewBlocked).toBe(0);
  });

  it('hard-rejects when intent preview blockers remain after auto-repair', async () => {
    const files = { '/src/App.tsx': 'x' };
    mockPipeline(files);
    mockPreflight(files);
    mockIntents(3, 3);

    await expect(
      commitMutation({
        source: 'ai-builder',
        identity: IDENTITY,
        current: { vfsFiles: files, playground: { pages: [] } as never },
        patch: legacyFilesToPatchPlan(files, 'broken edit'),
      }),
    ).rejects.toThrow(/rejected/i);

    // Rejected revisions are still persisted for forensics.
    expect(revisionStore[revisionStore.length - 1]?.status).toBe('rejected');
    expect(revisionStore[revisionStore.length - 1]?.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'LOCKED_INTENT_OR_DATA_FIELD' }),
    ]));
  });

  it('records an actionable rejection code and unresolved module for import failures', async () => {
    const files = {
      '/src/App.tsx': 'x',
      '/src/pages/Home.tsx': "import Missing from './Missing';\nexport default function Home(){ return <Missing/>; }",
    };
    mockPipeline(files);
    mockPreflight(files);
    mockIntents();
    const patch = legacyFilesToPatchPlan({ '/src/pages/Home.tsx': files['/src/pages/Home.tsx'] }, 'custom home layout');
    patch.operationIds = ['op-home-import'];
    patch.candidate = {
      id: 'candidate-import',
      origin: 'builder',
      knowledgeVersion: 'golden-test',
      targetPages: ['home'],
      attempt: 1,
    };

    let rejection: CommitRejectedError | undefined;
    try {
      await commitMutation({
        source: 'ai-builder',
        identity: IDENTITY,
        current: { vfsFiles: files, playground: { pages: [] } as never },
        patch,
      });
    } catch (error) {
      if (error instanceof CommitRejectedError) rejection = error;
      else throw error;
    }

    expect(rejection).toBeDefined();
    expect(rejection?.result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ stage: 'gate', level: 'error', code: 'INVALID_JSX_OR_IMPORT' }),
    ]));
    expect(JSON.stringify(rejection?.result.diagnostics)).toContain('./Missing');
    expect(rejection?.result.diagnostics.find((diagnostic) => diagnostic.code === 'INVALID_JSX_OR_IMPORT')?.correlation)
      .toMatchObject({
        mutationId: expect.any(String),
        candidateId: 'candidate-import',
        operationIds: ['op-home-import'],
        pageIds: ['home'],
        baseRevisionId: null,
        expectedVfsHash: expect.any(String),
        affectedPaths: ['/src/pages/Home.tsx'],
      });
    expect(revisionStore[revisionStore.length - 1]?.status).toBe('rejected');
  });

  it('does not execute backend operations when pre-execution gates reject the commit', async () => {
    const files = { '/src/App.tsx': 'x' };
    mockPipeline(files);
    mockPreflight(files);
    mockIntents(3, 3);
    const patch = emptyPatchPlan('rejected booking install');
    patch.backendOps.push({ type: 'requireCapability', capability: 'booking' });

    await expect(
      commitMutation({
        source: 'ai-builder',
        identity: IDENTITY,
        current: { vfsFiles: files, playground: { pages: [] } as never },
        patch,
      }),
    ).rejects.toThrow(/rejected/i);

    expect(executeBackendOps).not.toHaveBeenCalled();
  });

  it('rejects the revision when a backend operation fails', async () => {
    const files = { '/src/App.tsx': 'x' };
    mockPipeline(files);
    mockPreflight(files);
    mockIntents(0, 0);
    (executeBackendOps as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      failedCount: 1,
      results: [{
        op: { type: 'requireCapability', capability: 'booking' },
        status: 'failed',
      }],
    });
    const patch = emptyPatchPlan('failed booking install');
    patch.backendOps.push({ type: 'requireCapability', capability: 'booking' });

    await expect(
      commitMutation({
        source: 'ai-builder',
        identity: IDENTITY,
        current: { vfsFiles: files, playground: { pages: [] } as never },
        patch,
      }),
    ).rejects.toThrow(/rejected/i);

    expect(revisionStore[revisionStore.length - 1]?.status).toBe('rejected');
  });

  it('persists provisioned capability state on a successful approved transaction', async () => {
    const files = { '/src/App.tsx': 'x' };
    mockPipeline(files);
    mockPreflight(files);
    mockIntents(0, 0);
    (executeBackendOps as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      failedCount: 0,
      results: [{ op: { type: 'requireCapability', capability: 'booking' }, status: 'ok' }],
    });
    const patch = emptyPatchPlan('approved booking install');
    patch.backendOps.push({ type: 'requireCapability', capability: 'booking' });
    patch.businessSystem = {
      version: '1.0',
      requestedCapabilities: ['booking.appointments'],
      capabilities: [{
        id: 'booking',
        provides: ['booking.appointments'],
        status: 'approved',
        approval: { approvedBy: 'user-123', approvedAt: '2026-07-25T23:00:00.000Z' },
      }],
    };

    const result = await commitMutation({
      source: 'ai-builder',
      identity: IDENTITY,
      current: { vfsFiles: files, playground: { pages: [] } as never },
      patch,
    });

    expect((result.siteBundleSnapshot as { businessSystem?: { capabilities: Array<{ status: string }> } })
      .businessSystem?.capabilities[0]?.status).toBe('provisioned');
  });
});

describe('Guard 1 — preview artifact leakage', () => {
  it('sanitizes a preview-only Lucide fallback declaration back to a plain import before canonical commit', async () => {
    const contactWithPreviewArtifact = [
      "import * as __LucideIcons from 'lucide-react';",
      "const __LucideFallback = (props) => React.createElement('svg', props);",
      "const MapPin = __LucideIcons['MapPin'] || __LucideFallback;",
      'export default function Contact(){',
      '  return <main><MapPin /></main>;',
      '}',
    ].join('\n');
    const files = { '/src/pages/Contact.tsx': contactWithPreviewArtifact };
    const sanitizedFiles = {
      '/src/pages/Contact.tsx': [
        "import { MapPin } from 'lucide-react';",
        'export default function Contact(){',
        '  return <main><MapPin /></main>;',
        '}',
      ].join('\n'),
    };
    mockPipeline(sanitizedFiles);
    mockPreflight(sanitizedFiles);
    mockIntents();

    const result = await commitMutation({
      source: 'catalog-binding' as never,
      identity: IDENTITY,
      current: { vfsFiles: {}, playground: {} as never },
      patch: legacyFilesToPatchPlan(files, 'catalog binding regenerated Contact section'),
    });

    expect(result.status).toBe('committed');
    const passedFiles = (commitToPipeline as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0][0].existingVfsFiles as Record<string, string>;
    const committedContact = passedFiles['/src/pages/Contact.tsx'];
    expect(committedContact).not.toContain('__LucideIcons');
    expect(committedContact).not.toContain('__LucideFallback');
    expect(committedContact).toContain("import { MapPin } from 'lucide-react';");
    expect(
      result.diagnostics.some((d) => d.stage === 'fileOps' && d.level === 'warn' && /preview-only artifact/i.test(d.message)),
    ).toBe(true);
  });

  it('leaves canonical files without preview artifacts untouched', async () => {
    const files = { '/src/pages/Contact.tsx': "import { MapPin } from 'lucide-react'; export default function Contact(){ return <MapPin />; }" };
    mockPipeline(files);
    mockPreflight(files);
    mockIntents();

    await commitMutation({
      source: 'ai-builder',
      identity: IDENTITY,
      current: { vfsFiles: {}, playground: {} as never },
      patch: legacyFilesToPatchPlan(files, 'plain edit'),
    });

    const passedFiles = (commitToPipeline as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0][0].existingVfsFiles as Record<string, string>;
    expect(passedFiles['/src/pages/Contact.tsx']).toBe(files['/src/pages/Contact.tsx']);
  });
});

describe('VFS commit Stage 4b handoff', () => {
  it('forwards the original snapshot tokens for a non-wizard recompile', async () => {
    const themeTokens = {
      colors: {
        primary: '120 50% 40%', primaryForeground: '0 0% 100%', secondary: '180 40% 40%', secondaryForeground: '0 0% 100%',
        accent: '45 80% 50%', accentForeground: '0 0% 10%', background: '0 0% 100%', foreground: '0 0% 10%',
        muted: '0 0% 95%', mutedForeground: '0 0% 40%', card: '0 0% 100%', cardForeground: '0 0% 10%', border: '0 0% 90%',
      },
      typography: { headingFont: 'serif', bodyFont: 'sans-serif', headingWeight: '700', bodyWeight: '400' },
      radius: '0.5rem', sectionPadding: '5rem 1rem', containerWidth: '1200px',
    };
    const files = { '/src/App.tsx': 'export default function App(){ return null; }' };
    const canonicalFiles = { ...files, '/src/pages/Home.tsx': 'export default function Home(){ return null; }' };
    mockPipeline(canonicalFiles);
    mockPreflight(canonicalFiles);
    mockIntents();

    await commitMutation({
      source: 'ai-builder',
      identity: IDENTITY,
      current: {
        vfsFiles: files,
        playground: {} as never,
        siteBundleSnapshot: {
          meta: { themeStyleVersion: '2.0', themePresetId: 'organic', templateId: 'salon-minimal' },
          themeTokens,
        } as never,
      },
      patch: legacyFilesToPatchPlan({ '/src/pages/Home.tsx': 'export default function Home(){ return null; }' }),
    });

    expect(commitToPipeline).toHaveBeenCalledWith(expect.objectContaining({
      themePresetId: 'organic',
      selectedTemplateId: 'salon-minimal',
      themeTokens,
    }), 'ai-builder');
  });
});

describe('Snapshot-owned presentation mutations', () => {
  it('projects the legacy launch-showcase selection into canonical metadata and VFS mirrors', async () => {
    const files = { '/src/App.tsx': 'export default function App(){ return null; }' };
    mockPipeline(files);
    mockPreflight(files);
    mockIntents();
    const patch = emptyPatchPlan('Select image fan hero');
    patch.presentationOps.push({
      type: 'setVariant',
      sectionId: 'home-hero',
      variantId: 'hero:image-fan',
    });
    const snapshot = {
      meta: {
        designIntervention: {
          activeVariants: { 'home-hero': 'hero:launch-showcase' },
        },
      },
    } as never;

    await commitMutation({
      source: 'playground-edit',
      identity: IDENTITY,
      current: { vfsFiles: files, playground: {} as never, siteBundleSnapshot: snapshot },
      patch,
    });

    const canonicalInput = (commitToPipeline as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(canonicalInput.existingVfsFiles['/.unison/design-intervention.json']).toContain('hero:image-fan');
    expect(canonicalInput.existingVfsFiles['/.unison/site-bundle-snapshot.json']).toContain('hero:image-fan');
    expect(canonicalInput.themeTokens).toBeUndefined();
  });

  it('rejects a variant from a different section family', async () => {
    const patch = emptyPatchPlan('Invalid service variant for hero');
    patch.presentationOps.push({
      type: 'setVariant',
      sectionId: 'home-hero',
      variantId: 'services:card-grid',
    });

    await expect(commitMutation({
      source: 'playground-edit',
      identity: IDENTITY,
      current: {
        vfsFiles: {},
        playground: {} as never,
        siteBundleSnapshot: {
          meta: {
            designIntervention: { activeVariants: { 'home-hero': 'hero:centered' } },
          },
        } as never,
      },
      patch,
    })).rejects.toThrow(/invalid variant/);
  });
});

describe('Move D — publish-ready ledger', () => {
  it('persists publish_ready=false when publish blockers exist and loadLatestPublishReadyRevisionForProject returns null', async () => {
    const files = { '/src/App.tsx': 'x', '/src/pages/Booking.tsx': '<Booking/>' };
    mockPipeline(files);
    mockPreflight(files);
    mockIntents(0, 2); // publish blocked

    const result = await commitMutation({
      source: 'ai-builder',
      identity: IDENTITY,
      current: { vfsFiles: files, playground: { pages: [] } as never },
      patch: legacyFilesToPatchPlan(files, 'unbooked'),
    });

    expect(result.status).toBe('committed');
    expect(result.publishReady).toBe(false);
    expect(result.publishBlockers.length).toBeGreaterThan(0);
    expect(result.publishBlockers.some((b) => b.source === 'intentReadiness')).toBe(true);
    expect(typeof result.vfsHash).toBe('string');
    expect(result.vfsHash.length).toBeGreaterThan(0);

    // Latest revision exists, but publish-ready loader must refuse it.
    const latest = await loadLatestRevisionForProject(IDENTITY.projectId);
    expect(latest?.publishReady).toBe(false);
    const ready = await loadLatestPublishReadyRevisionForProject(IDENTITY.projectId);
    expect(ready).toBeNull();
  });

  it('marks publish_ready=true when all gates pass and exposes it via loadLatestPublishReadyRevisionForProject', async () => {
    const files = { '/src/App.tsx': 'x', '/src/pages/Home.tsx': '<Hero/>' };
    mockPipeline(files);
    mockPreflight(files);
    mockIntents(0, 0); // clean

    const result = await commitMutation({
      source: 'ai-builder',
      identity: IDENTITY,
      current: { vfsFiles: files, playground: { pages: [] } as never },
      patch: legacyFilesToPatchPlan(files, 'clean'),
    });

    expect(result.publishReady).toBe(true);
    expect(result.publishBlockers).toHaveLength(0);
    expect(runtimeReconcileInvoke).toHaveBeenCalledWith('reconcile-generated-runtime', {
      body: expect.objectContaining({
        businessId: IDENTITY.businessId,
        projectId: IDENTITY.projectId,
        manifest: expect.objectContaining({
          siteId: '55555555-5555-4555-8555-555555555555',
          agents: [],
        }),
      }),
    });
    expect(buildCanonicalLaunchArtifacts).toHaveBeenCalledOnce();
    expect(result.vfsFiles).toEqual(files);
    expect(result.siteBundleSnapshot?.vfsFiles).toEqual(files);

    const ready = await loadLatestPublishReadyRevisionForProject(IDENTITY.projectId);
    expect(ready?.id).toBe(result.persistedRevisionId);
    expect(ready?.publishReady).toBe(true);
  });

  it('preserves the committed revision but blocks publish when generated runtime reconciliation fails', async () => {
    const files = { '/src/App.tsx': 'x', '/src/pages/Home.tsx': '<Hero/>' };
    mockPipeline(files);
    mockPreflight(files);
    mockIntents(0, 0);
    runtimeReconcileInvoke.mockResolvedValueOnce({
      data: null,
      error: { message: 'runtime control plane unavailable' },
    });

    const result = await commitMutation({
      source: 'ai-builder',
      identity: IDENTITY,
      current: { vfsFiles: files, playground: { pages: [] } as never },
      patch: legacyFilesToPatchPlan(files, 'runtime reconciliation failure'),
    });

    expect(result.status).toBe('committed');
    expect(result.publishReady).toBe(false);
    expect(result.publishBlockers).toContainEqual(expect.objectContaining({
      code: 'generated-runtime-reconciliation-failed',
      message: 'runtime control plane unavailable',
    }));
    expect(revisionStore).toHaveLength(1);
    expect(revisionStore[0].status).toBe('committed');
    expect(draftProjectionUpdates).toHaveLength(1);
  });

  it('rejects a candidate whose local module graph is not closed (P0.4)', async () => {
    const files = {
      '/src/App.tsx': "import Hero from './components/Hero';\nexport default function App(){return <Hero />}",
    };
    mockPipeline(files); mockPreflight(files); mockIntents();

    await expect(commitMutation({
      source: 'ai-builder',
      identity: IDENTITY,
      current: { vfsFiles: files },
      patch: legacyFilesToPatchPlan(files, 'missing module'),
      options: { requireReadinessPass: false },
    })).rejects.toThrow(CommitRejectedError);
    expect(revisionStore.filter((r) => r.status === 'committed')).toHaveLength(0);
  });

  it('rejects a local component import the target module never exports (P0.4)', async () => {
    const files = {
      '/src/App.tsx': "import { Hero } from './components/Hero';\nexport default function App(){return <Hero />}",
      '/src/components/Hero.tsx': 'export const Banner = () => null;',
    };
    mockPipeline(files); mockPreflight(files); mockIntents();

    await expect(commitMutation({
      source: 'ai-builder',
      identity: IDENTITY,
      current: { vfsFiles: files },
      patch: legacyFilesToPatchPlan(files, 'missing export'),
      options: { requireReadinessPass: false },
    })).rejects.toThrow(CommitRejectedError);
    expect(revisionStore.filter((r) => r.status === 'committed')).toHaveLength(0);
  });
});

describe('P0 rejection fixtures', () => {
  const app = 'export default function App(){return null}';
  const run = (before: Record<string, string>, after: Record<string, string>, previewBlocked = 0, requireReadinessPass = false) => {
    const next = { ...before, ...after };
    mockPipeline(next); mockPreflight(next); mockIntents(previewBlocked);
    return commitMutation({
      source: 'ai-builder', identity: IDENTITY,
      current: { vfsFiles: before },
      patch: legacyFilesToPatchPlan(after),
      options: { dryRun: true, requirePreviewPass: true, requireReadinessPass },
    });
  };
  const codes = (err: unknown) => ((err as { result?: CommitMutationResult }).result?.diagnostics ?? []).map(d => d.code).filter(Boolean);

  it('accepts a free-form AI hero that is not in the seed', async () => {
    const page = '/src/pages/Home.tsx';
    const hero = 'export default function Home(){return <main><section data-ut-section="hero-custom"><h1>Tide</h1></section></main>}';
    const result = await run({ '/src/App.tsx': app, [page]: 'export default function Home(){return <main/>}' }, { [page]: hero });
    expect(result.status).toBe('committed');
    expect(result.vfsFiles[page]).toBe(hero);
  });

  it('accepts a new multi-file component with its importing page', async () => {
    const result = await run({ '/src/App.tsx': app, '/src/pages/Home.tsx': 'export default function Home(){return <main/>}' }, {
      '/src/components/TideCard.tsx': 'export default function TideCard(){return <article>Card</article>}',
      '/src/pages/Home.tsx': "import TideCard from '../components/TideCard';\nexport default function Home(){return <main><TideCard/></main>}",
    });
    expect(result.status).toBe('committed');
    expect(Object.keys(result.vfsFiles)).toContain('/src/components/TideCard.tsx');
  });

  it('rejects a broken local import as INVALID_JSX_OR_IMPORT', async () => {
    const err = await run({ '/src/App.tsx': app, '/src/pages/Home.tsx': 'export default function Home(){return <main/>}' }, {
      '/src/pages/Home.tsx': "import Missing from '../components/Missing';\nexport default function Home(){return <Missing/>}",
    }).catch(e => e);
    expect(codes(err)).toContain('INVALID_JSX_OR_IMPORT');
    expect(revisionStore).toHaveLength(0);
  });

  it('rejects a broken required business binding as LOCKED_INTENT_OR_DATA_FIELD', async () => {
    const err = await run({ '/src/App.tsx': app, '/src/pages/Home.tsx': 'export default function Home(){return <main/>}' }, {
      '/src/pages/Home.tsx': 'export default function Home(){return <main><button data-ut-intent="booking.create">Book</button></main>}',
    }, 1, true).catch(e => e);
    expect(codes(err)).toContain('LOCKED_INTENT_OR_DATA_FIELD');
    expect(revisionStore).toHaveLength(0);
  });

  it('records uploaded project media in the same canonical candidate as the source reference', async () => {
    const page = '/src/pages/Home.tsx';
    const url = 'https://storage.example.test/storage/v1/object/sign/user-files/user-1/site-uploads/project-1/11111111-1111-4111-8111-111111111111-hero.webp?token=temporary';
    const files = {
      '/src/App.tsx': app,
      [page]: `export default function Home(){return <main><img src="${url}" alt="Hero" /></main>}`,
    };
    mockPipeline(files); mockPreflight(files); mockIntents();

    const result = await commitMutation({
      source: 'ai-builder', identity: IDENTITY,
      current: { vfsFiles: { '/src/App.tsx': app } },
      patch: legacyFilesToPatchPlan({ [page]: files[page] }),
      options: { dryRun: true, requireReadinessPass: false },
    });

    const manifest = JSON.parse(result.vfsFiles['/public/media/manifest.json']);
    expect(manifest.assets).toEqual([expect.objectContaining({
      bucket: 'user-files',
      storagePath: 'user-1/site-uploads/project-1/11111111-1111-4111-8111-111111111111-hero.webp',
      usedBy: [page],
    })]);
  });
});
