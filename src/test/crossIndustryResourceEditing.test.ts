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
const M2_FIXTURES = [
  { fixture: 'salon', resource: 'services', titleField: 'name', imageField: 'image_url', row: { id, name: 'Haircut', image_url: 'haircut.jpg' } },
  { fixture: 'ecommerce', resource: 'products', titleField: 'name', imageField: 'image_url', row: { id, name: 'Tee', image_url: 'tee.jpg' } },
  { fixture: 'restaurant', resource: 'menu', titleField: 'name', imageField: 'image_url', row: { id, name: 'Soup', image_url: 'soup.jpg' } },
  { fixture: 'offers', resource: 'offers', titleField: 'title', imageField: 'image_url', row: { id, title: 'Lunch special', image_url: 'offer.jpg', cta_href: '/old-offer' } },
  { fixture: 'testimonials', resource: 'testimonials', titleField: 'author_name', imageField: 'author_avatar_url', row: { id, author_name: 'Alex', author_avatar_url: 'avatar.jpg' } },
  { fixture: 'portfolio', resource: 'portfolio', titleField: 'title', imageField: 'cover_image_url', row: { id, title: 'Studio', cover_image_url: 'studio.jpg' } },
] as const;

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
    for (const fixture of M2_FIXTURES) {
      const key = `a:${fixture.resource}`;
      const rows = state.rows.get(key);
      if (!rows) {
        state.rows.set(key, [structuredClone(fixture.row)]);
      } else {
        const row = rows.find((candidate) => candidate.id === id);
        if (row) {
          for (const [field, value] of Object.entries(fixture.row)) {
            if (row[field] === undefined) row[field] = value;
          }
        } else {
          rows.push(structuredClone(fixture.row));
        }
      }
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

  it('reopens six Preview data fixtures with inline text and image edits persisted', async () => {
    for (const fixture of M2_FIXTURES) {
      const textResult = await executeEditorCommand({
        type: 'set-text',
        target: { resourceMark: `${fixture.resource}#${id}.${fixture.titleField}`, projectId: 'a' },
        text: `${fixture.fixture} revised`,
      }, { source: 'inline', resource: ctx });
      expect(textResult.ok, `${fixture.fixture} text edit`).toBe(true);

      const imageResult = await executeEditorCommand({
        type: 'replace-asset',
        target: { resourceMark: `${fixture.resource}#${id}.${fixture.imageField}`, projectId: 'a' },
        url: `https://assets.test/${fixture.fixture}.jpg`,
      }, { source: 'toolbar', resource: ctx });
      expect(imageResult.ok, `${fixture.fixture} image edit`).toBe(true);

      const reopened = await queryResource(fixture.resource, ctx);
      const reopenedRecord = reopened.find((record) => record.id === id);
      expect(reopenedRecord?.[fixture.titleField], `${fixture.fixture} title after reopen`).toBe(`${fixture.fixture} revised`);
      expect(reopenedRecord?.[fixture.imageField], `${fixture.fixture} image after reopen`).toBe(`https://assets.test/${fixture.fixture}.jpg`);
    }
  });

  it('persists an editable CTA URL in the selected offer record after reopening', async () => {
    const result = await executeEditorCommand({
      type: 'update-resource-field',
      target: { resourceMark: `offers#${id}.cta_href`, projectId: 'a' },
      values: { cta_href: '/offers/featured' },
      expected: { cta_href: '/old-offer' },
    }, { source: 'inspector', resource: ctx });

    expect(result).toMatchObject({ ok: true, lane: 'resource', changedFields: ['cta_href'] });
    expect((await queryResource('offers', ctx)).find((record) => record.id === id)?.cta_href).toBe('/offers/featured');
  });
});