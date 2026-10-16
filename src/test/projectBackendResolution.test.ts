import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { functions: { invoke: mocks.invoke } },
}));

import { projectBackendResolver } from '@/services/project-backend/projectBackendResolver';
import {
  invalidatePublishedBackend,
  publishedSiteReadClient,
  resolvePublishedSiteBackend,
} from '@/services/project-backend/publishedRuntimeBackend';

const projectId = '11111111-1111-4111-8111-111111111111';
const sharedBackend = {
  bindingId: 'shared:11111111-1111-4111-8111-111111111111',
  projectId,
  siteId: '22222222-2222-4222-8222-222222222222',
  mode: 'shared-legacy',
  provider: 'supabase',
  status: 'ready',
};
const dedicatedBackend = {
  ...sharedBackend,
  bindingId: 'binding-1',
  mode: 'dedicated',
  projectUrl: 'https://dedicated.supabase.co',
  publishableKey: 'sb_publishable_test_key',
};

beforeEach(() => {
  vi.clearAllMocks();
  projectBackendResolver.invalidate();
  invalidatePublishedBackend();
});

describe('project backend resolution', () => {
  it('resolves authenticated project backend through the protected Edge Function', async () => {
    mocks.invoke.mockResolvedValue({
      data: { success: true, data: dedicatedBackend },
      error: null,
    });

    const backend = await projectBackendResolver.resolve(projectId);

    expect(mocks.invoke).toHaveBeenCalledWith('resolve-project-backend', { body: { projectId } });
    expect(backend).toMatchObject({
      projectId,
      mode: 'dedicated',
      projectUrl: 'https://dedicated.supabase.co',
      publishableKey: 'sb_publishable_test_key',
    });
  });

  it('resolves published dedicated backends through the public-site Edge Function', async () => {
    mocks.invoke.mockResolvedValue({
      data: { success: true, data: dedicatedBackend },
      error: null,
    });

    const backend = await resolvePublishedSiteBackend(projectId);
    const client = await publishedSiteReadClient(projectId);

    expect(mocks.invoke).toHaveBeenCalledWith('resolve-published-site-backend', { body: { projectId } });
    expect(backend).toMatchObject({ mode: 'dedicated', projectUrl: 'https://dedicated.supabase.co' });
    expect(client).not.toBeNull();
  });

  it('keeps shared published sites on the existing runtime read path', async () => {
    mocks.invoke.mockResolvedValue({
      data: { success: true, data: sharedBackend },
      error: null,
    });

    expect(await publishedSiteReadClient(projectId)).toBeNull();
  });
});
