import { describe, it, expect, vi, beforeEach } from 'vitest';

const listContentRecords = vi.fn();
const listCmsRecords = vi.fn(async () => [{ id: 'p1', name: 'Tee', price: 20 }]);
const updateCmsRecord = vi.fn();
const resolveProjectBackend = vi.fn();
vi.mock('@/services/cmsRecordService', () => ({
  listCmsRecords: () => listCmsRecords(),
  createCmsRecord: vi.fn(), removeCmsRecord: vi.fn(), updateCmsRecord: (...a: unknown[]) => updateCmsRecord(...a),
  listContentRecords: (...a: unknown[]) => listContentRecords(...a),
  getContentRecord: vi.fn(), createContentRecord: vi.fn(), updateContentRecord: vi.fn(),
}));
vi.mock('@/services/project-backend/projectBackendResolver', () => ({
  projectBackendResolver: { resolve: (...a: unknown[]) => resolveProjectBackend(...a), invalidate: vi.fn() },
}));
vi.mock('@/services/businessProfileService', () => ({
  loadSiteProfile: vi.fn(async (id: string) => ({ businessId: id, name: 'Acme' })),
  saveSiteProfile: vi.fn(async (id: string, _project: unknown, p: object) => ({ businessId: id, name: 'Acme', ...p })),
}));

import { getResource, listResources, registerContentTypes } from '@/services/resources/resourceRegistry';
import { applyResourceOp, buildDuplicateResourceValues, onResourceInvalidated, parseResourceProvenance, queryResource, validateResourceOp } from '@/services/resources/resourceRuntime';

const ctx = { businessId: 'b1', mode: 'builder' as const };

describe('Resource Runtime', () => {
  beforeEach(() => { registerContentTypes([{ id: 't1', slug: 'faq', name: 'FAQ', field_schema: [{ key: 'question' }, { key: 'answer', type: 'textarea' }] }]); });

  it('registers catalog, content and business profile under one registry', () => {
    const kinds = new Set(listResources().map((r) => r.kind));
    expect(kinds).toEqual(new Set(['catalog', 'content', 'business-profile']));
    expect(getResource('products')?.storage.adapter).toBe('catalog');
    expect(getResource('products')?.catalogKind).toBe('product');
    expect(getResource('services')?.catalogKind).toBe('service');
    expect(getResource('menu')?.catalogKind).toBe('menu_item');
    expect(getResource('menu')?.schema.find((field) => field.key === 'dietary_tags')?.type).toBe('tags');
    expect(getResource('pricing')?.capabilities?.commerce).toBe(true);
    expect(getResource('offers')?.capabilities?.commerce).toBe(true);
    expect(getResource('products')?.capabilities?.ordering).toBe(true);
    expect(getResource('products')?.schema.map((field) => field.key)).toContain('inventory_count');
    expect(getResource('products')?.schema.map((field) => field.key)).not.toContain('duration_minutes');
    expect(getResource('services')?.schema.map((field) => field.key)).toContain('duration_minutes');
    expect(getResource('services')?.schema.map((field) => field.key)).not.toContain('inventory_count');
    expect(getResource('content:faq')?.lifecycle?.publicStatus).toBe('published');
    expect(getResource('business-profile')?.cardinality).toBe('single-record');
  });

  it('rejects an inline resource ref whose declared catalog kind disagrees with its resource key', () => {
    expect(validateResourceOp({
      op: 'update',
      ref: { resourceKey: 'products', kind: 'catalog', catalogKind: 'service', recordId: 'p1' },
      values: { price: 10 },
    })).toMatchObject({ ok: false, reason: expect.stringContaining('is product, not service') });
    expect(validateResourceOp({
      op: 'update',
      ref: { resourceKey: 'services', kind: 'catalog', catalogKind: 'service', recordId: 's1' },
      values: { inventory_count: 3 },
    }).ok).toBe(false);
    expect(validateResourceOp({
      op: 'update',
      ref: { resourceKey: 'products', kind: 'catalog', catalogKind: 'product', recordId: 'p1' },
      values: { duration_minutes: 30 },
    }).ok).toBe(false);
  });

  it('catalog reads go through the catalog adapter', async () => {
    expect((await queryResource('products', ctx))[0].id).toBe('p1');
  });

  it('rejects a project/site mismatch before using the shared resource adapter', async () => {
    resolveProjectBackend.mockResolvedValue({
      bindingId: 'binding-1', projectId: 'project-1', siteId: 'site-other',
      mode: 'shared-legacy', provider: 'supabase', status: 'ready',
    });
    listCmsRecords.mockClear();

    await expect(queryResource('products', {
      ...ctx, projectId: 'project-1', siteId: 'site-1',
    })).rejects.toThrow('bound to another site');
    expect(listCmsRecords).not.toHaveBeenCalled();
  });

  it('published runtime never returns draft content', async () => {
    listContentRecords.mockResolvedValue([{ id: 'e1', status: 'draft', data: { question: 'Q?' } }, { id: 'e2', status: 'published', data: { question: 'Live?' } }]);
    const rows = await queryResource('content:faq', { ...ctx, mode: 'published' });
    expect(rows.map((r) => r.id)).toEqual(['e2']);
    expect(rows[0].question).toBe('Live?');
    const builder = await queryResource('content:faq', ctx);
    expect(builder).toHaveLength(2);
  });

  it('rejects unknown fields, profile create/delete, and content delete', () => {
    expect(validateResourceOp({ op: 'update', ref: { resourceKey: 'business-profile', kind: 'business-profile', recordId: 'b1' }, values: { ownerId: 'x' } }).ok).toBe(false);
    expect(validateResourceOp({ op: 'create', resourceKey: 'business-profile', values: {} }).ok).toBe(false);
    expect(validateResourceOp({ op: 'delete', ref: { resourceKey: 'content:faq', kind: 'content', recordId: 'e1' } }).ok).toBe(false);
  });

  it('builds safe duplicate values from editable schema fields and keeps content unpublished', () => {
    const baseDefinition = getResource('content:faq')!;
    const definition = {
      ...baseDefinition,
      schema: [
        ...baseDefinition.schema,
        { key: 'slug', label: 'Slug', type: 'text' as const, editable: true },
        { key: 'status', label: 'Status', type: 'text' as const, editable: true },
      ],
    };
    const values = buildDuplicateResourceValues(definition, {
      id: 'faq-1',
      question: 'Do you ship?',
      answer: 'Yes',
      slug: 'shipping',
      status: 'published',
      internal_id: 'do-not-copy',
    });

    expect(values.question).toBe('Do you ship? (copy)');
    expect(values.status).toBe('draft');
    expect(values.slug).toMatch(/^shipping-copy-/);
    expect(values).not.toHaveProperty('id');
    expect(values).not.toHaveProperty('internal_id');
  });

  it('a write emits RESOURCE_INVALIDATED for the record', async () => {
    const seen: string[] = [];
    const off = onResourceInvalidated((i) => seen.push(`${i.resourceKey}#${i.recordIds[0]}`));
    await applyResourceOp({ op: 'update', ref: { resourceKey: 'business-profile', kind: 'business-profile', recordId: 'b1' }, values: { tagline: 'Hi' } }, ctx);
    off();
    expect(seen).toEqual(['business-profile#b1']);
  });

  it('a catalog write tells the live preview which table changed', async () => {
    const seen: string[][] = [];
    const off = onResourceInvalidated((i) => seen.push(i.sourceTables ?? []));
    await applyResourceOp({ op: 'update', ref: { resourceKey: 'products', kind: 'catalog', recordId: 'p1' }, values: { name: 'x' } }, ctx).catch(() => undefined);
    off();
    if (seen.length) expect(seen[0].length).toBeGreaterThan(0);
    vi.mocked(updateCmsRecord).mockClear();
  });

  it('published mode cannot write', async () => {
    await expect(applyResourceOp({ op: 'update', ref: { resourceKey: 'products', kind: 'catalog', recordId: 'p1' }, values: { name: 'x' } }, { ...ctx, mode: 'published' })).rejects.toThrow();
    expect(updateCmsRecord).not.toHaveBeenCalled();
  });

  it('parses resource provenance attributes', () => {
    expect(parseResourceProvenance('content:faq#e1.question')).toEqual({ resourceKey: 'content:faq', kind: 'content', recordId: 'e1', field: 'question' });
    expect(parseResourceProvenance('nope#1')).toBeNull();
  });
});
