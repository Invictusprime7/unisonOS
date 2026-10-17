import { describe, expect, it, vi, beforeEach } from 'vitest';

const runtime = vi.hoisted(() => ({
  applyResourceOp: vi.fn(async () => null),
  getResourceRecord: vi.fn(async () => null),
  queryResource: vi.fn(async () => [] as Array<Record<string, unknown>>),
}));

vi.mock('@/services/resources/resourceRuntime', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/resources/resourceRuntime')>();
  return {
    ...actual,
    applyResourceOp: runtime.applyResourceOp,
    getResourceRecord: runtime.getResourceRecord,
    queryResource: runtime.queryResource,
  };
});

vi.mock('@/services/project-backend/runtimeProtocol', () => ({
  executeResourceCommandCompatible: (_ctx: unknown, _command: unknown, legacy: () => Promise<unknown>) => legacy(),
}));

import { executeResourceCommand } from '@/services/editor/executors/resourceExecutor';

const ctx = { businessId: 'b1', projectId: 'p1', siteId: 's1', mode: 'legacy' } as never;
const REAL_ID = '11111111-2222-3333-4444-555555555555';

function setTextCommand(mark: string) {
  return {
    type: 'set-text' as const,
    target: { resourceMark: mark },
    text: 'New name',
  } as never;
}

describe('resource executor slug resolution', () => {
  beforeEach(() => vi.clearAllMocks());

  it('resolves a generated slug mark to the saved record id before updating', async () => {
    runtime.queryResource.mockResolvedValueOnce([{ id: REAL_ID, slug: 'precision-chrono-shell', name: 'Precision Chrono Shell' }]);
    runtime.getResourceRecord.mockResolvedValueOnce({ id: REAL_ID, name: 'Precision Chrono Shell' });
    const result = await executeResourceCommand(setTextCommand('products#precision-chrono-shell'), ctx);
    expect(result.ok).toBe(true);
    expect(runtime.applyResourceOp).toHaveBeenCalledWith(
      expect.objectContaining({ op: 'update', ref: expect.objectContaining({ recordId: REAL_ID }) }),
      ctx,
    );
  });

  it('matches by name-derived slug when the record has no slug field', async () => {
    runtime.queryResource.mockResolvedValueOnce([{ id: REAL_ID, name: 'Haptic Audio Node' }]);
    runtime.getResourceRecord.mockResolvedValueOnce({ id: REAL_ID, name: 'Haptic Audio Node' });
    const result = await executeResourceCommand(setTextCommand('products#haptic-audio-node'), ctx);
    expect(result.ok).toBe(true);
    expect(runtime.applyResourceOp).toHaveBeenCalledWith(
      expect.objectContaining({ ref: expect.objectContaining({ recordId: REAL_ID }) }),
      ctx,
    );
  });

  it('fails with a clear message when no saved record matches the mark', async () => {
    runtime.queryResource.mockResolvedValueOnce([]);
    const result = await executeResourceCommand(setTextCommand('products#ghost-item'), ctx);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('No saved');
    expect(runtime.applyResourceOp).not.toHaveBeenCalled();
  });

  it('skips the lookup when the mark already carries a saved record id', async () => {
    runtime.getResourceRecord.mockResolvedValueOnce({ id: REAL_ID, name: 'Old' });
    const result = await executeResourceCommand(setTextCommand(`products#${REAL_ID}`), ctx);
    expect(result.ok).toBe(true);
    expect(runtime.queryResource).not.toHaveBeenCalled();
  });
});
