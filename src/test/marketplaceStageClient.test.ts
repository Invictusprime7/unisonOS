import { afterEach, describe, expect, it, vi } from 'vitest';

const functionHeaders = vi.fn();

vi.mock('@/integrations/supabase/supabaseFunctionRequest', () => ({
  getSupabaseFunctionHeaders: (...args: unknown[]) => functionHeaders(...args),
  getSupabaseFunctionUrl: (name: string) => `https://unison.test/functions/v1/${name}`,
}));

import { stageMarketplaceRelease } from '@/marketplace/stageReleaseClient';

const okPayload = {
  success: true,
  listingId: 'listing-1',
  slug: 'flixx-by-ariann-59c5ef14',
  releaseId: 'release-1',
  version: 'r-abc12345',
  status: 'in_review',
  acceptedRevisionId: 'rev-1',
  snapshotSha256: 'hash',
};

describe('marketplace stage release client', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    functionHeaders.mockReset();
  });

  it('sends the project id to the staging service with the signed-in session', async () => {
    functionHeaders.mockResolvedValue({ apikey: 'key', Authorization: 'Bearer token' });
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(okPayload), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await stageMarketplaceRelease('59c5ef14-4fd0-4c57-bedf-6a6659d6cfaf');

    expect(result.releaseId).toBe('release-1');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://unison.test/functions/v1/marketplace-stage-release',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ projectId: '59c5ef14-4fd0-4c57-bedf-6a6659d6cfaf' }),
      }),
    );
    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer token');
  });

  it('surfaces the service error message instead of inventing one', async () => {
    functionHeaders.mockResolvedValue({ apikey: 'key' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: false, error: 'You need the admin role.' }), { status: 403 }),
    ));

    await expect(stageMarketplaceRelease('project-2')).rejects.toThrow('You need the admin role.');
  });
});
