import { describe, expect, it, vi, beforeEach } from 'vitest';

const persistAiCommit = vi.fn();

vi.mock('@/services/aiApplyGate', () => ({
  persistAiCommit: (...args: unknown[]) => persistAiCommit(...args),
}));

// The real module installs global runtime listeners; only the rejection type
// matters to the transaction, so it is stubbed here.
vi.mock('@/services/vfsCommitService', () => ({
  CommitRejectedError: class extends Error {
    result: unknown;
    constructor(message: string, result: unknown) { super(message); this.name = 'CommitRejectedError'; this.result = result; }
  },
}));

import { runBuilderAiMutation } from '@/services/builder/builderMutationService';
import { CommitRejectedError as RejectedError } from '@/services/vfsCommitService';

const ctx = {
  businessId: 'b1',
  projectId: 'p1',
  draftId: 'd1',
  beforeFiles: { '/src/pages/Home.tsx': 'old' },
  nextFiles: { '/src/pages/Home.tsx': 'new' },
  activePagePath: '/',
  candidate: {
    id: 'candidate-home',
    baseRevisionId: 'rev-1',
    fileOps: [{ type: 'replace', path: '/src/pages/Home.tsx', content: 'new' }],
    targetPages: ['/src/pages/Home.tsx'],
    attempt: 1,
  },
} as never as Parameters<typeof runBuilderAiMutation>[0];

beforeEach(() => { persistAiCommit.mockReset(); });

describe('builder AI mutation transaction', () => {
  it('commits once and reports applied only after the mirror succeeds', async () => {
    persistAiCommit.mockResolvedValue({
      vfsFiles: { '/src/pages/Home.tsx': 'new' },
      persistedRevisionId: 'rev-2',
    });
    const mirror = vi.fn(() => ({ success: true, filesWritten: ['/src/pages/Home.tsx'] }));

    const outcome = await runBuilderAiMutation(ctx, { mirror });

    expect(persistAiCommit).toHaveBeenCalledTimes(1);
    expect(mirror).toHaveBeenCalledWith({ '/src/pages/Home.tsx': 'new' });
    expect(outcome.state).toBe('applied');
    expect(outcome.success).toBe(true);
    expect(outcome.revisionId).toBe('rev-2');
  });

  it('reports rejected without mirroring when the canonical gate refuses', async () => {
    persistAiCommit.mockImplementation(async () => {
      throw new (RejectedError as any)('blocked', {
        publishBlockers: [{ source: 'preview', code: 'syntax', message: 'Preview would break.' }],
      } as never);
    });
    const mirror = vi.fn(() => ({ success: true }));

    const outcome = await runBuilderAiMutation(ctx, { mirror });

    expect(mirror).not.toHaveBeenCalled();
    expect(outcome.state).toBe('rejected');
    expect(outcome.success).toBe(false);
    expect(outcome.reason).toBe('Preview would break.');
  });

  it('reports the durable revision when the committed-state mirror fails', async () => {
    persistAiCommit.mockResolvedValue({
      vfsFiles: { '/src/pages/Home.tsx': 'new' },
      persistedRevisionId: 'rev-3',
    });
    const outcome = await runBuilderAiMutation(ctx, {
      mirror: () => ({ success: false, errors: ['write failed'] }),
    });

    expect(outcome.state).toBe('failed');
    expect(outcome.success).toBe(false);
    expect(outcome.errors).toEqual(['write failed']);
    expect(outcome.revisionId).toBe('rev-3');
    expect(outcome.committedFiles).toEqual({ '/src/pages/Home.tsx': 'new' });
    expect(outcome.changedPaths).toEqual(['/src/pages/Home.tsx']);
  });

  it('never reports success when the commit itself throws', async () => {
    persistAiCommit.mockImplementation(async () => { throw new Error('network down'); });
    const outcome = await runBuilderAiMutation(ctx, { mirror: () => ({ success: true }) });
    expect(outcome.state).toBe('failed');
    expect(outcome.success).toBe(false);
  });

  it('surfaces typed early refusals as actionable rejected outcomes', async () => {
    persistAiCommit.mockImplementation(async () => {
      throw Object.assign(new Error('The edit overlaps a newer revision.'), {
        code: 'STALE_REVISION',
        stage: 'queue-rebase',
      });
    });
    const outcome = await runBuilderAiMutation(ctx, { mirror: () => ({ success: true }) });
    expect(outcome.state).toBe('rejected');
    expect(outcome.errors[0]).toBe('[STALE_REVISION at queue-rebase] The edit overlaps a newer revision.');
    expect(outcome.reason).toBe(outcome.errors[0]);
  });

  it('asks for clarification instead of committing an ambiguous interpreted request', async () => {
    const outcome = await runBuilderAiMutation({
      ...ctx,
      editIntent: {
        editScope: 'section', operation: 'replace', operations: ['replace'],
        allowedPaths: ['/src/pages/Home.tsx'], requiredBindings: [],
        ambiguities: ['Which page should change?'], expectedRevisionId: 'rev-1',
        dependencyPlan: { newFiles: 'scoped-components', packages: 'declared-only' },
        consent: { crossPage: false, backend: false },
      },
    }, { mirror: () => ({ success: true }) });

    expect(outcome.state).toBe('rejected');
    expect(outcome.reason).toContain('Which page should change?');
    expect(persistAiCommit).not.toHaveBeenCalled();
  });

  it('mirrors the complete committed map and reports deleted paths', async () => {
    const deletionCtx = {
      ...ctx,
      beforeFiles: {
        '/src/pages/Home.tsx': 'old',
        '/src/pages/Removed.tsx': 'remove me',
      },
    };
    persistAiCommit.mockResolvedValue({
      vfsFiles: { '/src/pages/Home.tsx': 'new' },
      persistedRevisionId: 'rev-4',
    });
    const mirror = vi.fn(() => ({ success: true }));

    const outcome = await runBuilderAiMutation(deletionCtx, { mirror });

    expect(mirror).toHaveBeenCalledWith({ '/src/pages/Home.tsx': 'new' });
    expect(outcome.state).toBe('applied');
    expect(outcome.changedPaths).toEqual(['/src/pages/Home.tsx', '/src/pages/Removed.tsx']);
  });
});
