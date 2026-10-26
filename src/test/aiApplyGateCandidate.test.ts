import { describe, expect, it } from 'vitest';
import { buildAiCandidatePatch, type AiCommitContext } from '@/services/aiApplyGate';
import { prepareAICandidate } from '@/services/builder/aiCandidateGates';
import { assertPatchPlan } from '@/types/patchPlan';

function context(): AiCommitContext {
  return {
    businessId: 'business-1',
    projectId: 'project-1',
    draftId: 'draft-1',
    revisionId: 'revision-1',
    beforeFiles: { '/src/App.tsx': 'old', '/src/pages/Removed.tsx': 'remove me' },
    nextFiles: { '/src/App.tsx': 'new' },
    activePagePath: '/src/App.tsx',
    candidate: {
      id: 'candidate-1',
      baseRevisionId: 'revision-1',
      provenance: { origin: 'builder', intent: 'navigation', knowledgeVersion: '2026-09-29.2' },
      targetPages: ['/src/App.tsx'],
      attempt: 1,
      routeOps: [{ type: 'remove_page', pageId: 'removed' }],
      fileOps: [
        { type: 'replace', path: '/src/App.tsx', content: 'new' },
        { type: 'delete', path: '/src/pages/Removed.tsx' },
      ],
    },
  };
}

describe('AI candidate commit protocol', () => {
  it('preserves non-file operations through preflight rebuild and canonical patch conversion', async () => {
    const operations = {
      backendOps: [{ type: 'requireCapability' as const, capability: 'booking', payload: { mode: 'appointments' } }],
      bindingOps: [{ type: 'bindIntent' as const, elementId: 'book', intent: 'booking.create', payload: { action: 'createBooking' } }],
      presentationOps: [{ type: 'setMotionBudget' as const, motionBudget: 'restrained' as const }],
      playgroundOps: [{ type: 'updatePage' as const, pageId: 'home', payload: { title: 'Appointments' } }],
    };
    const baseFiles = { '/src/pages/Home.tsx': 'export default function Home(){return <main>Old</main>}' };
    const prepared = await prepareAICandidate({
      ...operations, baseFiles, baseRevisionId: 'revision-1', resolveDependencies: false,
      aiFiles: { '/src/pages/Home.tsx': 'export default function Home(){return <main>New</main>}' },
      preflight: (files) => Object.fromEntries(Object.entries(files).map(([path, content]) => [path, content.replace('New', 'Repaired')])),
    });
    expect(prepared.ok).toBe(true);
    const patch = buildAiCandidatePatch({ ...context(), candidate: prepared.build.changeSet });
    expect(patch).toMatchObject(operations);
    expect(patch.fileOps[0]).toMatchObject({ contents: expect.stringContaining('Repaired') });
    expect(patch.operationIds).toEqual([`ai-candidate:${prepared.build.changeSet.id}`]);
    expect(patch.candidate?.id).toBe(prepared.build.changeSet.id);
    expect(patch.candidate?.dependencyGraphFingerprint).toBe(prepared.build.changeSet.dependencyGraphFingerprint);
    operations.backendOps[0].payload.mode = 'mutated';
    const candidateOp = prepared.build.changeSet.backendOps?.[0];
    const patchOp = patch.backendOps[0];
    expect(candidateOp?.type).toBe('requireCapability');
    if (candidateOp?.type !== 'requireCapability' || patchOp.type !== 'requireCapability') throw new Error('Capability proposal was lost');
    expect(candidateOp.payload?.mode).toBe('appointments');
    patchOp.payload!.mode = 'also mutated';
    expect(candidateOp.payload?.mode).toBe('appointments');
  });

  it('accepts an operation-only candidate without inventing frontend source', async () => {
    const prepared = await prepareAICandidate({
      aiFiles: {}, baseFiles: {}, baseRevisionId: 'revision-1', resolveDependencies: false,
      backendOps: [{ type: 'requireCapability', capability: 'auth' }],
    });
    expect(prepared.ok).toBe(true);
    expect(prepared.nextFiles).toEqual({});
    expect(buildAiCandidatePatch({ ...context(), candidate: prepared.build.changeSet }).backendOps)
      .toEqual([{ type: 'requireCapability', capability: 'auth' }]);
  });

  it('keeps live-demo reservations out of follow-up AI candidate commits', () => {
    const patch = buildAiCandidatePatch(context());
    expect(patch.operationIds).toEqual(['ai-candidate:candidate-1']);
  });

  it('rejects unknown backend operations before they can be silently skipped', () => {
    const patch = buildAiCandidatePatch(context());
    patch.backendOps = [{ type: 'rawSql', capability: 'auth' }] as never;
    expect(() => assertPatchPlan(patch)).toThrow('invalid BackendOp');
    patch.backendOps = [{ type: 'requireCapability', capability: '' }];
    expect(() => assertPatchPlan(patch)).toThrow('invalid BackendOp');
  });
  it('preserves exact candidate creates, replacements, and deletions in the commit plan', () => {
    expect(buildAiCandidatePatch(context())).toMatchObject({
      summary: 'AI candidate candidate-1',
      candidate: {
        id: 'candidate-1', origin: 'builder', intent: 'navigation', knowledgeVersion: '2026-09-29.2',
        targetPages: ['/src/App.tsx'],
      },
      fileOps: [
        { type: 'replace', path: '/src/App.tsx', contents: 'new' },
        { type: 'delete', path: '/src/pages/Removed.tsx' },
      ],
      routeOps: [{ type: 'remove_page', pageId: 'removed' }],
    });
  });

  it('rejects a candidate based on a different accepted revision', () => {
    const stale = context();
    stale.candidate!.baseRevisionId = 'revision-older';
    expect(() => buildAiCandidatePatch(stale)).toThrow('candidate base revision is stale');
  });

  it('requires lineage when an accepted revision already exists', () => {
    const unbased = context();
    unbased.candidate!.baseRevisionId = undefined;
    expect(() => buildAiCandidatePatch(unbased)).toThrow('candidate base revision is stale');
  });

  it('does not judge or rewrite authored presentation', () => {
    const divergent = context();
    const source = 'export default function App(){return <main className="bg-[#101014] text-white grid"><aside/><article/></main>}';
    divergent.candidate!.fileOps = [{ type: 'replace', path: '/src/App.tsx', content: source }];
    expect(buildAiCandidatePatch(divergent).fileOps).toEqual([
      { type: 'replace', path: '/src/App.tsx', contents: source },
    ]);
  });
});
