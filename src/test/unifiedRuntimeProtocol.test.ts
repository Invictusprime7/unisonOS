import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolve: vi.fn(),
  callProjectBackend: vi.fn(),
  listCmsRecords: vi.fn(),
}));

vi.mock('@/services/project-backend/projectBackendResolver', () => ({
  projectBackendResolver: { resolve: mocks.resolve, invalidate: vi.fn() },
}));
vi.mock('@/services/project-backend/projectBackendClient', () => ({
  callProjectBackend: mocks.callProjectBackend,
}));
vi.mock('@/services/cmsRecordService', () => ({
  listCmsRecords: mocks.listCmsRecords,
  createCmsRecord: vi.fn(),
  removeCmsRecord: vi.fn(),
  updateCmsRecord: vi.fn(),
  listContentRecords: vi.fn(async () => []),
  getContentRecord: vi.fn(),
  createContentRecord: vi.fn(),
  updateContentRecord: vi.fn(),
}));
vi.mock('@/services/businessProfileService', () => ({
  loadBusinessProfile: vi.fn(),
  saveBusinessProfile: vi.fn(),
}));

import { registerContentTypes } from '@/services/resources/resourceRegistry';
import { executeBackendCommandV2, type RuntimeContextV2 } from '@/services/project-backend/runtimeProtocol';

const context: RuntimeContextV2 = {
  protocolVersion: 2,
  projectId: 'project-1',
  siteId: 'site-1',
  businessId: 'business-1',
  operationId: 'operation-1',
  actorKind: 'studio-user',
};

describe('unified runtime protocol v2', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registerContentTypes([]);
    mocks.resolve.mockResolvedValue({
      bindingId: 'binding-1', projectId: 'project-1', siteId: 'site-1',
      mode: 'shared-legacy', provider: 'supabase', status: 'ready',
    });
    mocks.listCmsRecords.mockResolvedValue([{ id: 'product-1', name: 'Tea' }]);
  });

  it('keeps the v2 operation ID on the existing shared resource facade result', async () => {
    const result = await executeBackendCommandV2(context, { kind: 'resource.list', resourceKey: 'products' });

    expect(result).toEqual({
      ok: true, operationId: 'operation-1', data: [{ id: 'product-1', name: 'Tea' }],
    });
    expect(mocks.listCmsRecords).toHaveBeenCalledWith({
      businessId: 'business-1', projectId: 'project-1', resource: 'products',
    });
  });

  it('requires project, site, business, and operation identity', async () => {
    const result = await executeBackendCommandV2({ ...context, projectId: '' }, {
      kind: 'resource.list', resourceKey: 'products',
    });

    expect(result).toMatchObject({ ok: false, error: { code: 'VALIDATION' } });
    expect(mocks.resolve).not.toHaveBeenCalled();
  });

  it('reports a missing resolver RPC as backend unavailable', async () => {
    mocks.resolve.mockRejectedValue(new Error(
      'Could not find the function public.resolve_project_backend(p_project_id) in the schema cache',
    ));

    const result = await executeBackendCommandV2(context, { kind: 'runtime.health' });

    expect(result).toMatchObject({
      ok: false,
      operationId: context.operationId,
      error: { code: 'BACKEND_UNAVAILABLE', retryable: false },
    });
  });

  it('rejects arbitrary table names that are not registered resources', async () => {
    const result = await executeBackendCommandV2(context, {
      kind: 'resource.list', resourceKey: 'public.users',
    });

    expect(result).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
    expect(mocks.resolve).not.toHaveBeenCalled();
    expect(mocks.listCmsRecords).not.toHaveBeenCalled();
  });

  it('does not fall through to shared storage when a dedicated backend is unavailable', async () => {
    mocks.resolve.mockResolvedValue({
      bindingId: 'binding-1', projectId: 'project-1', siteId: 'site-1',
      mode: 'dedicated', provider: 'supabase', status: 'ready',
    });
    mocks.callProjectBackend.mockRejectedValue(new Error("This site's database could not be reached."));

    const result = await executeBackendCommandV2(context, {
      kind: 'resource.list', resourceKey: 'products',
    });

    expect(result).toMatchObject({ ok: false, error: { code: 'BACKEND_UNAVAILABLE', retryable: true } });
    expect(mocks.callProjectBackend).toHaveBeenCalledWith({
      projectId: 'project-1', action: 'list', resource: 'products',
    });
    expect(mocks.listCmsRecords).not.toHaveBeenCalled();
  });

  it.each(['content:faq', 'business-profile'])('fails closed for dedicated %s without using shared CMS', async (resourceKey) => {
    registerContentTypes([{ id: 'type-1', api_key: 'faq', display_name: 'FAQ', field_schema: [{ key: 'question' }] }]);
    mocks.resolve.mockResolvedValue({
      bindingId: 'binding-1', projectId: 'project-1', siteId: 'site-1',
      mode: 'dedicated', provider: 'supabase', status: 'ready',
    });

    const result = await executeBackendCommandV2(context, { kind: 'resource.list', resourceKey });

    expect(result).toMatchObject({ ok: false, error: { code: 'UNSUPPORTED' } });
    expect(mocks.callProjectBackend).not.toHaveBeenCalled();
    expect(mocks.listCmsRecords).not.toHaveBeenCalled();
  });

  it('does not treat a caller-declared visitor as a resource writer', async () => {
    const result = await executeBackendCommandV2({ ...context, actorKind: 'visitor' }, {
      kind: 'resource.mutate', resourceKey: 'products', action: 'update',
      recordId: 'product-1', values: { name: 'Changed' },
    });

    expect(result).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    expect(mocks.resolve).not.toHaveBeenCalled();
    expect(mocks.listCmsRecords).not.toHaveBeenCalled();
  });

  it.each([
    { kind: 'asset.link', assetId: 'asset-1', targetId: 'element-1', property: 'src' },
    { kind: 'intent.execute', intentId: 'booking.create', payload: {} },
  ] as const)('reports unmigrated $kind commands as unsupported', async (command) => {
    const result = await executeBackendCommandV2(context, command);

    expect(result).toMatchObject({ ok: false, error: { code: 'UNSUPPORTED' } });
    expect(mocks.resolve).not.toHaveBeenCalled();
  });
});