import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ resolve: vi.fn(), call: vi.fn() }));
vi.mock('@/services/project-backend/projectBackendResolver', () => ({ projectBackendResolver: { resolve: mocks.resolve } }));
vi.mock('@/services/project-backend/projectBackendClient', () => ({ callProjectBackend: mocks.call }));
import { runDeployBackendPreflight } from '@/services/project-backend/deployBackendPreflight';
const backend = { bindingId: 'binding', projectId: 'project', siteId: 'site', mode: 'dedicated', status: 'ready', provider: 'supabase', projectUrl: 'https://site.example.test', publishableKey: 'public-key' };
describe('publication resource compatibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolve.mockResolvedValue(backend);
    mocks.call.mockImplementation(async ({ resource }) => ({ resource, compatible: true }));
  });
  it('checks each required surface once using the read-only gateway action', async () => {
    const result = await runDeployBackendPreflight({ projectId: 'project', resources: ['services', 'content:articles', 'services'] });
    expect(result.ok).toBe(true);
    expect(mocks.call.mock.calls.map(([request]) => request)).toEqual([
      { projectId: 'project', action: 'check', resource: 'content:articles' },
      { projectId: 'project', action: 'check', resource: 'services' },
    ]);
    expect(result.manifest?.resources).toEqual(['content:articles', 'services']);
  });
  it('blocks missing schema without producing deployable environment values', async () => {
    mocks.call.mockRejectedValue(new Error('Missing content_entries structure'));
    const result = await runDeployBackendPreflight({ projectId: 'project', resources: ['content:articles'] });
    expect(result).toEqual({ ok: false, reason: 'Missing content_entries structure' });
    expect(result.publicEnv).toBeUndefined();
  });
  it('rejects a response that did not attest the requested resource', async () => {
    mocks.call.mockResolvedValue({ resource: 'products', compatible: true });
    expect((await runDeployBackendPreflight({ projectId: 'project', resources: ['services'] })).ok).toBe(false);
  });
  it('preserves shared routing without calling the dedicated gateway', async () => {
    mocks.resolve.mockResolvedValue({ ...backend, mode: 'shared-legacy' });
    expect((await runDeployBackendPreflight({ projectId: 'project', resources: ['products'] })).ok).toBe(true);
    expect(mocks.call).not.toHaveBeenCalled();
  });
});