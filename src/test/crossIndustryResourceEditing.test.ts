/** Real editor/runtime orchestration over a persistent in-memory adapter boundary.
 * This is service integration evidence, not authenticated/deployed E2E proof. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
  rows: new Map<string, Record<string, unknown>[]>(),
  failWrite: false,
  race: false,
}));
vi.mock('@/services/project-backend/projectBackendResolver', () => ({ projectBackendResolver: {
  resolve: async (projectId: string) => ({ projectId, siteId: `site-${projectId}`, mode: 'shared-legacy', status: 'ready' }),
} }));
vi.mock('@/services/cmsRecordService', () => ({
  listCmsRecords: async ({ projectId, resource }: { projectId: string; resource: string }) => structuredClone(state.rows.get(`${projectId}:${resource}`) ?? []),
  updateCmsRecord: async ({ projectId, resource, recordId, values, expected }: { projectId: string; resource: string; recordId: string; values: Record<string, unknown>; expected?: Record<string, unknown> }) => {
    if (state.failWrite) throw new Error('Network unavailable');
    const record = state.rows.get(`${projectId}:${resource}`)?.find((r) => r.id === recordId);
    if (!record) throw new Error('Record not found in this project');
    if (state.race) { state.race = false; record.name = 'Concurrent name'; }
    if (expected && Object.entries(expected).some(([key, value]) => JSON.stringify(record[key] ?? null) !== JSON.stringify(value ?? null))) throw new Error('Conflict: changed elsewhere');
    Object.assign(record, values);
    return structuredClone(record);
  },
  createCmsRecord: vi.fn(), removeCmsRecord: vi.fn(), listContentRecords: vi.fn(),
  getContentRecord: vi.fn(), createContentRecord: vi.fn(), updateContentRecord: vi.fn(),
}));
import { executeEditorCommand } from '@/services/editor/editorCommandService';
import { agentOperations } from '@/services/agent-runtime/operations';
import { onResourceInvalidated, queryResource } from '@/services/resources/resourceRuntime';
const ctx = { businessId: 'business', projectId: 'a', siteId: 'site-a', mode: 'builder' as const };
const id = '11111111-2222-3333-4444-555555555555';
const target = (key: string) => ({ resourceMark: `${key}#${id}`, projectId: 'a' });
describe('cross-industry resource edit acceptance at service level', () => {
  beforeEach(() => {
    state.rows.clear(); state.failWrite = false; state.race = false;
    for (const project of ['a', 'b']) {
      state.rows.set(`${project}:products`, [
        { id: 'first', name: 'First', image_url: 'first.jpg' },
        { id, name: 'Second', price: 10, image_url: 'second.jpg' },
        { id: 'third', name: 'Third', image_url: 'third.jpg' },
      ]);
      state.rows.set(`${project}:menu`, [{ id, name: 'Soup', price_cents: 1250, category: 'Starter' }]);
      state.rows.set(`${project}:services`, [{ id, name: 'Haircut', duration_minutes: 30 }]);
      state.rows.set(`${project}:portfolio`, [{ id, title: 'Studio', image_url: 'studio.jpg' }]);
    }
  });
  it('replaces only the second product image and reads it back after reopening the resource', async () => {
    const result = await executeEditorCommand({ type: 'replace-asset', target: target('products'), url: 'https://assets.test/new.jpg' }, { source: 'toolbar', resource: ctx });
    expect(result.ok).toBe(true);
    expect((await queryResource('products', ctx)).map((r) => r.image_url)).toEqual(['first.jpg', 'https://assets.test/new.jpg', 'third.jpg']);
    expect((await queryResource('products', { ...ctx, projectId: 'b', siteId: 'site-b' }))[1].image_url).toBe('second.jpg');
  });
  it('persists restaurant price and category with owning-table refresh evidence', async () => {
    const events: unknown[] = [];
    const off = onResourceInvalidated((inv) => events.push(inv));
    const result = await executeEditorCommand({ type: 'update-resource-field', target: target('menu'), values: { price_cents: 1390, category: 'Main' }, expected: { price_cents: 1250, category: 'Starter' } }, { source: 'inspector', resource: ctx });
    off();
    expect(result.ok).toBe(true);
    expect((await queryResource('menu', ctx))[0]).toMatchObject({ price_cents: 1390, category: 'Main' });
    expect(events).toEqual([expect.objectContaining({ projectId: 'a', sourceTables: ['menu_items'] })]);
  });
  it('AI service edits use the same stored duration field as click edits', async () => {
    const result = await agentOperations.update_resource_field({ files: {}, ...ctx }, `services#${id}.duration_minutes`, 45, undefined, { duration_minutes: 30 });
    expect(result.record?.duration_minutes).toBe(45);
    expect((await queryResource('services', ctx))[0].duration_minutes).toBe(45);
  });
  it('detects a concurrent write after the read and preserves the newer value', async () => {
    state.race = true;
    const result = await executeEditorCommand({ type: 'set-text', target: target('products'), text: 'Mine', originalText: 'Second' }, { source: 'inline', resource: ctx });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('Conflict');
    expect((await queryResource('products', ctx))[1].name).toBe('Concurrent name');
  });
  it('never infers a database write for an unbound element', async () => {
    const result = await executeEditorCommand({ type: 'set-text', target: { ownerKind: 'unbound' }, text: 'Unknown' }, { source: 'inline', resource: ctx });
    expect(result.ok).toBe(false);
    expect((await queryResource('products', ctx))[1].name).toBe('Second');
  });
  it('undo restores the same record and cannot overwrite a later edit', async () => {
    const result = await executeEditorCommand({ type: 'set-text', target: target('products'), text: 'Edited' }, { source: 'inline', resource: ctx });
    await result.undo?.();
    expect((await queryResource('products', ctx))[1].name).toBe('Second');
    const newer = await executeEditorCommand({ type: 'set-text', target: target('products'), text: 'Newest' }, { source: 'inline', resource: ctx });
    expect(newer.ok).toBe(true);
    await expect(result.undo?.()).rejects.toThrow('Conflict');
    expect((await queryResource('products', ctx))[1].name).toBe('Newest');
  });
  it('failed writes do not claim success or invalidate a preview', async () => {
    state.failWrite = true;
    const events: unknown[] = [];
    const off = onResourceInvalidated((event) => events.push(event));
    const result = await executeEditorCommand({ type: 'set-text', target: target('products'), text: 'Offline edit' }, { source: 'inline', resource: ctx });
    off();
    expect(result.ok).toBe(false);
    expect(events).toEqual([]);
    expect((await queryResource('products', ctx))[1].name).toBe('Second');
  });
});