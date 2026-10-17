import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() }));
vi.mock('@/services/cmsRecordService', () => ({
  listCmsRecords: mocks.list, createCmsRecord: mocks.create, updateCmsRecord: mocks.update, removeCmsRecord: mocks.remove,
  listContentRecords: vi.fn(), getContentRecord: vi.fn(), createContentRecord: vi.fn(), updateContentRecord: vi.fn(),
}));
vi.mock('@/services/project-backend/projectBackendResolver', () => ({
  projectBackendResolver: { resolve: vi.fn(async () => ({
    projectId: 'project-1', siteId: 'site-1', mode: 'shared-legacy', status: 'ready',
  })), invalidate: vi.fn() },
}));
import { agentOperations } from '@/services/agent-runtime/operations';
import { onResourceInvalidated } from '@/services/resources/resourceRuntime';
import { createCatalogItem, deleteCatalogItem, listCatalog } from '@/services/agent-runtime/catalogOps';

const ctx = { businessId: 'business-1', projectId: 'project-1', files: {
  '/src/pages/Home.tsx': '<main><p>Unrelated $10</p><img src="https://assets.example/old.jpg" /></main>',
} };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.list.mockResolvedValue([{ id: 'row-1', name: 'Product', price: 10, image_url: 'https://assets.example/old.jpg' }]);
  mocks.update.mockImplementation(async ({ values }) => ({ id: 'row-1', name: 'Product', ...values }));
  mocks.create.mockImplementation(async ({ values }) => ({ id: 'created-1', ...values }));
});
describe('AI catalog shared resource ownership', () => {
  it('saves one scoped record and invalidates once without rewriting matching source literals', async () => {
    const invalidations: unknown[] = [];
    const off = onResourceInvalidated((event) => invalidations.push(event));
    const result = await agentOperations.update_catalog_item(ctx, 'products', 'row-1', { price: 25, image_url: 'https://assets.example/new.jpg' });
    off();
    expect(mocks.update).toHaveBeenCalledExactlyOnceWith({ businessId: 'business-1', projectId: 'project-1', resource: 'products', recordId: 'row-1', values: { price: 25, image_url: 'https://assets.example/new.jpg' }, expected: { price: 10, image_url: 'https://assets.example/old.jpg' } });
    expect(result.change).toBeNull();
    expect(ctx.files['/src/pages/Home.tsx']).toContain('Unrelated $10');
    expect(ctx.files['/src/pages/Home.tsx']).toContain('old.jpg');
    expect(invalidations).toEqual([expect.objectContaining({ resourceKey: 'products', projectId: 'project-1', recordIds: ['row-1'], sourceTables: ['products'] })]);
  });
  it('preserves service field mapping and project scope on create and delete', async () => {
    const item = await createCatalogItem('business-1', 'services', { name: 'Consultation', price: 12.5 }, 'project-1');
    expect(item.price).toBe(12.5);
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ projectId: 'project-1', resource: 'services', values: expect.objectContaining({ name: 'Consultation', price_cents: 1250 }) }));
    await deleteCatalogItem('business-1', 'services', item.id, 'project-1');
    expect(mocks.remove).toHaveBeenCalledExactlyOnceWith({ businessId: 'business-1', projectId: 'project-1', resource: 'services', recordId: 'created-1' });
  });
  it('surfaces failed reads instead of claiming the catalog is empty', async () => {
    mocks.list.mockRejectedValue(new Error('Catalog unavailable'));
    await expect(listCatalog('business-1', ['products'], 'project-1')).rejects.toThrow('Catalog unavailable');
  });
  it('rejects a stale AI field value without writing or invalidating', async () => {
    const events: unknown[] = [];
    const off = onResourceInvalidated((event) => events.push(event));
    await expect(agentOperations.update_catalog_item(ctx, 'products', 'row-1', { price: 25 }, { price: 9 })).rejects.toThrow('changed elsewhere');
    off();
    expect(mocks.update).not.toHaveBeenCalled();
    expect(events).toEqual([]);
  });
  it('cannot read or update another site record, even under the same business', async () => {
    mocks.list.mockImplementation(async ({ projectId }) => projectId === 'project-1' ? [] : [{ id: 'row-1', price: 10 }]);
    expect(await agentOperations.inspect_data(ctx, 'products')).toEqual([]);
    await expect(agentOperations.update_catalog_item(ctx, 'products', 'row-1', { price: 25 })).rejects.toThrow('this project');
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.list.mock.calls.every(([input]) => input.projectId === 'project-1')).toBe(true);
  });
});