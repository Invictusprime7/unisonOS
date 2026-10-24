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

describe('marketplace certification client', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    functionHeaders.mockReset();
  });

  it('records asset rights decisions against the release', async () => {
    functionHeaders.mockResolvedValue({ apikey: 'key', Authorization: 'Bearer token' });
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, releaseId: 'release-1', decided: 1 }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const { recordMarketplaceAssetRights } = await import('@/marketplace/stageReleaseClient');
    const result = await recordMarketplaceAssetRights('release-1', [{
      path: '/assets/logo.svg',
      sha256: 'b'.repeat(64),
      decision: 'exclude',
      license: '',
      evidenceSource: '',
      commercialUseAllowed: false,
      bundleRedistributionAllowed: false,
      buyerSupplied: true,
    }]);

    expect(result).toEqual({ releaseId: 'release-1', decided: 1 });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://unison.test/functions/v1/marketplace-certify-release',
      expect.objectContaining({ body: expect.stringContaining('"action":"recordAssetRights"') }),
    );
  });

  it('records review verdicts and builds the private package', async () => {
    functionHeaders.mockResolvedValue({ apikey: 'key', Authorization: 'Bearer token' });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, releaseId: 'release-1', reviewId: 'review-1' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        success: true,
        storageKey: 'marketplace-releases/release-1/package.zip',
        packageSha256: 'p'.repeat(64),
        sizeBytes: 1234,
        rewrittenRefs: ['https://cdn.example.test/private.webp'],
      }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const { recordMarketplaceReview, buildMarketplacePackage } = await import('@/marketplace/stageReleaseClient');
    const review = await recordMarketplaceReview('release-1', {
      design: 'pass', asset: 'pass', security: 'pass', build: 'pass', a11y: 'pass', mobile: 'pass',
    }, ['evidence-1']);
    const pkg = await buildMarketplacePackage('release-1', review.reviewId);

    expect(review.reviewId).toBe('review-1');
    expect(pkg.storageKey).toBe('marketplace-releases/release-1/package.zip');
    expect(pkg.rewrittenRefs).toEqual(['https://cdn.example.test/private.webp']);
    expect(fetchMock).toHaveBeenLastCalledWith(
      'https://unison.test/functions/v1/marketplace-certify-release',
      expect.objectContaining({ body: expect.stringContaining('"action":"buildPackage"') }),
    );
  });

  it('surfaces rejected decisions with their issues', async () => {
    functionHeaders.mockResolvedValue({ apikey: 'key', Authorization: 'Bearer token' });
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      success: false,
      error: 'Asset rights decisions were rejected.',
      issues: [{ code: 'asset-hash-mismatch', assetPath: '/assets/logo.svg' }],
    }), { status: 422 }));
    vi.stubGlobal('fetch', fetchMock);

    const { recordMarketplaceAssetRights } = await import('@/marketplace/stageReleaseClient');
    await expect(recordMarketplaceAssetRights('release-1', [{
      path: '/assets/logo.svg',
      sha256: 'c'.repeat(64),
      decision: 'include',
      license: 'CC0',
      evidenceSource: 'https://licenses.example.test/logo',
      commercialUseAllowed: true,
      bundleRedistributionAllowed: true,
    }])).rejects.toThrow('asset-hash-mismatch');
  });
});
