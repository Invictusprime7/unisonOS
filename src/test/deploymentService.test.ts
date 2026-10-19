import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const projectQuery: Record<string, ReturnType<typeof vi.fn>> = {};
  projectQuery.update = vi.fn(() => projectQuery);
  projectQuery.eq = vi.fn(() => projectQuery);
  projectQuery.select = vi.fn(() => projectQuery);
  projectQuery.maybeSingle = vi.fn();
  return {
    invoke: vi.fn(),
    resolveBackend: vi.fn(),
    rpc: vi.fn(),
    from: vi.fn(() => projectQuery),
    loadLatestPublishReadyRevisionForProject: vi.fn(),
    recordRepublishEvent: vi.fn(),
    projectQuery,
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: { invoke: mocks.invoke },
    from: mocks.from,
    rpc: mocks.rpc,
  },
}));

vi.mock('@/services/vfsCommitService', () => ({
  loadLatestPublishReadyRevisionForProject: mocks.loadLatestPublishReadyRevisionForProject,
  recordRepublishEvent: mocks.recordRepublishEvent,
}));
vi.mock('@/services/project-backend/projectBackendResolver', () => ({
  projectBackendResolver: { resolve: mocks.resolveBackend },
}));

import { deployToProvider } from '@/services/deploymentService';

const publishedRevision = {
  id: 'revision-1',
  projectId: 'project-1',
  businessId: 'business-1',
  draftId: 'draft-1',
  vfsFiles: { '/index.html': '<!doctype html><html><head></head><body>Live</body></html>' },
  siteBundleSnapshot: null,
  vfsHash: 'hash-1',
};

describe('deployToProvider publication projection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveBackend.mockResolvedValue({ bindingId: 'shared:project-1', projectId: 'project-1', siteId: null, mode: 'shared-legacy', status: 'ready' });
    mocks.loadLatestPublishReadyRevisionForProject.mockResolvedValue(publishedRevision);
    mocks.invoke.mockImplementation(async (functionName: string) => functionName === 'resolve-project-backend'
      ? {
          data: { success: true, data: { bindingId: 'shared:project-1', projectId: 'project-1', siteId: null, mode: 'shared-legacy', status: 'ready' } },
          error: null,
        }
      : {
          data: { status: 'success', provider: 'vercel', url: 'https://example.test' },
          error: null,
        });
    mocks.projectQuery.maybeSingle.mockResolvedValue({ data: { id: 'project-1' }, error: null });
    mocks.rpc.mockResolvedValue({
      data: { bindingId: 'binding-1', projectId: 'project-1', siteId: null, mode: 'shared-legacy', status: 'ready' },
      error: null,
    });
  });

  it('publishes a backend-free project without resolving a backend binding', async () => {
    mocks.loadLatestPublishReadyRevisionForProject.mockResolvedValue({
      ...publishedRevision,
      runtimeManifest: { backendRequired: false },
    });

    const result = await deployToProvider({
      provider: 'vercel',
      projectId: 'project-1',
      files: { '/index.html': 'stale caller state' },
    });

    expect(result.status).toBe('success');
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.invoke).toHaveBeenCalledWith('publish-site', expect.anything());
  });

  it('sets the project active published revision after deployment', async () => {
    const result = await deployToProvider({
      provider: 'vercel',
      projectId: 'project-1',
      files: { '/index.html': 'stale caller state' },
    });

    expect(result).toMatchObject({ status: 'success', url: 'https://example.test' });
    expect(result.synchronizationWarning).toBeUndefined();
    expect(mocks.from).toHaveBeenCalledWith('projects');
    expect(mocks.projectQuery.update).toHaveBeenCalledWith(expect.objectContaining({
      active_published_revision_id: 'revision-1',
      publish_status: 'published',
    }));
    expect(mocks.projectQuery.eq).toHaveBeenNthCalledWith(1, 'id', 'project-1');
    expect(mocks.projectQuery.eq).toHaveBeenNthCalledWith(2, 'business_id', 'business-1');
  });

  it('checks saved surfaces and never publishes an incompatible dedicated database', async () => {
    mocks.resolveBackend.mockResolvedValue({ bindingId: 'dedicated', projectId: 'project-1', siteId: 'site-1', mode: 'dedicated', status: 'ready', projectUrl: 'https://site.example.test', publishableKey: 'public' });
    mocks.loadLatestPublishReadyRevisionForProject.mockResolvedValue({ ...publishedRevision,
      vfsFiles: { '/index.html': '<div data-ut-resource="content:articles#article.title">Article</div>' },
    });
    mocks.invoke.mockResolvedValue({ data: { success: false, error: 'Missing content_entries structure' }, error: null });
    const result = await deployToProvider({ provider: 'vercel', projectId: 'project-1', files: { '/index.html': '<div data-ut-resource="products#ignored.name" />' } });
    expect(result.status).toBe('error');
    expect(result.error).toContain('Missing content_entries structure');
    expect(mocks.invoke).toHaveBeenCalledWith('project-backend', { body: { projectId: 'project-1', action: 'check', resource: 'content:articles' } });
    expect(mocks.invoke.mock.calls.some(([name]) => name === 'publish-site')).toBe(false);
    expect(mocks.projectQuery.update).not.toHaveBeenCalled();
  });

  it('keeps deployment successful and reports a synchronization warning when projection fails', async () => {
    mocks.projectQuery.maybeSingle.mockResolvedValue({
      data: null,
      error: { message: 'project update blocked' },
    });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const result = await deployToProvider({
      provider: 'vercel',
      projectId: 'project-1',
      files: { '/index.html': 'stale caller state' },
    });

    expect(result.status).toBe('success');
    expect(result.synchronizationWarning).toBe('project update blocked');
    expect(result.note).toContain('Site deployed, but project synchronization requires attention.');
  });
});
