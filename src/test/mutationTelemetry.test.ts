import { beforeEach, describe, expect, it } from 'vitest';
import {
  getMutationEvents,
  onMutationEvent,
  recordMutationEvent,
  resetMutationEvents,
  newEditorCorrelationId,
} from '@/services/editor/editorTelemetry';
import { runExclusive } from '@/services/builder/builderMutationCoordinator';

describe('mutation telemetry (M0)', () => {
  beforeEach(() => resetMutationEvents());

  it('records commit events with base → result revision IDs', () => {
    const id = newEditorCorrelationId();
    recordMutationEvent({
      correlationId: id,
      at: Date.now(),
      kind: 'commit',
      surface: 'ai-builder',
      baseRevisionId: 'rev_1',
      resultRevisionId: 'rev_2',
      ok: true,
      durationMs: 12,
    });
    const events = getMutationEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      correlationId: id,
      kind: 'commit',
      surface: 'ai-builder',
      baseRevisionId: 'rev_1',
      resultRevisionId: 'rev_2',
      ok: true,
    });
  });

  it('records resource-op events with key, op and record id', () => {
    recordMutationEvent({
      correlationId: newEditorCorrelationId(),
      at: Date.now(),
      kind: 'resource-op',
      surface: 'resource-runtime',
      baseRevisionId: null,
      resultRevisionId: null,
      resourceKey: 'catalog:products',
      resourceOp: 'update',
      recordId: 'rec_9',
      ok: false,
      error: 'permission denied',
      durationMs: 3,
    });
    const [e] = getMutationEvents();
    expect(e.resourceKey).toBe('catalog:products');
    expect(e.resourceOp).toBe('update');
    expect(e.recordId).toBe('rec_9');
    expect(e.ok).toBe(false);
  });

  it('notifies listeners and caps the ring buffer', () => {
    const seen: string[] = [];
    const off = onMutationEvent((e) => seen.push(e.correlationId));
    for (let i = 0; i < 205; i++) {
      recordMutationEvent({
        correlationId: `m_${i}`,
        at: Date.now(),
        kind: 'surface-run',
        surface: 'toolbar',
        baseRevisionId: null,
        resultRevisionId: null,
        ok: true,
        durationMs: 1,
      });
    }
    off();
    expect(seen).toHaveLength(205);
    expect(getMutationEvents().length).toBe(200);
    expect(getMutationEvents()[0].correlationId).toBe('m_5');
  });

  it('runExclusive emits a surface-run event on success and failure', async () => {
    await runExclusive('toolbar', async () => 'done');
    await expect(runExclusive('terminal', async () => { throw new Error('boom'); })).rejects.toThrow('boom');
    const events = getMutationEvents();
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ kind: 'surface-run', surface: 'toolbar', ok: true });
    expect(events[1]).toMatchObject({ kind: 'surface-run', surface: 'terminal', ok: false, error: 'boom' });
  });
});
