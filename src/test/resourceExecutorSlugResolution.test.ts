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

  it('creates the record on the spot when no saved record matches the mark', async () => {
    runtime.queryResource.mockResolvedValueOnce([]);
    runtime.applyResourceOp.mockResolvedValueOnce({ id: 'new-1', name: 'Ghost Item' });
    const result = await executeResourceCommand(setTextCommand('products#ghost-item'), ctx);
    expect(result.ok).toBe(true);
    expect(result.savedTo).toContain('created');
    expect(runtime.applyResourceOp).toHaveBeenCalledWith(
      expect.objectContaining({ op: 'create', resourceKey: 'products', values: expect.objectContaining({ name: 'New name' }) }),
      ctx,
    );
  });

  it('reports a clear failure when the auto-create write fails', async () => {
    runtime.queryResource.mockResolvedValueOnce([]);
    runtime.applyResourceOp.mockRejectedValueOnce(new Error('boom'));
    const result = await executeResourceCommand(setTextCommand('products#ghost-item'), ctx);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Couldn't save");
    expect(result.error).not.toContain('Save the site first');
  });

  it('skips the lookup when the mark already carries a saved record id', async () => {
    runtime.getResourceRecord.mockResolvedValueOnce({ id: REAL_ID, name: 'Old' });
    const result = await executeResourceCommand(setTextCommand(`products#${REAL_ID}`), ctx);
    expect(result.ok).toBe(true);
    expect(runtime.queryResource).not.toHaveBeenCalled();
  });
});

describe('expected-revision concurrency', () => {
  it('flags fields changed elsewhere and ignores already-applied values', async () => {
    const { staleFields } = await import('@/services/editor/executors/resourceExecutor');
    const cmd = { type: 'update-resource-field', target: {}, values: { price: 12, name: 'Soup' }, expected: { price: 10, name: 'Old' } } as never;
    expect(staleFields(cmd, { id: 'x', price: 11, name: 'Soup' }, { price: 12, name: 'Soup' })).toEqual(['price']);
    expect(staleFields(cmd, { id: 'x', price: 10, name: 'Old' }, { price: 12, name: 'Soup' })).toEqual([]);
  });
});
