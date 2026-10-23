import { describe, expect, it, vi } from 'vitest';
import {
  listPublicMarketplaceListings,
  type PublicListingQueryClient,
} from '@/marketplace/listingService';

const row = {
  id: 'listing-1',
  slug: 'editorial-salon',
  product_type: 'site_template',
  title: 'Editorial Salon',
  industry_key: 'salon',
  summary: 'A design-only site template.',
  price_cents: 4900,
  currency: 'usd',
  current_release_id: 'release-1',
  created_at: '2026-10-22T12:00:00.000Z',
  updated_at: '2026-10-22T12:00:00.000Z',
};

function createClient(result: { data: unknown[] | null; error: unknown }) {
  const calls: Array<[string, ...unknown[]]> = [];
  const query = {
    eq: vi.fn((column: string, value: string) => {
      calls.push(['eq', column, value]);
      return query;
    }),
    gte: vi.fn((column: string, value: number) => {
      calls.push(['gte', column, value]);
      return query;
    }),
    lte: vi.fn((column: string, value: number) => {
      calls.push(['lte', column, value]);
      return query;
    }),
    order: vi.fn((column: string, options: { ascending: boolean }) => {
      calls.push(['order', column, options]);
      return query;
    }),
    limit: vi.fn((count: number) => {
      calls.push(['limit', count]);
      return Promise.resolve(result);
    }),
  };

  const client: PublicListingQueryClient = {
    from: vi.fn((table) => {
      calls.push(['from', table]);
      return {
        select: vi.fn((columns: string) => {
          calls.push(['select', columns]);
          return query;
        }),
      };
    }),
  };

  return { client, calls };
}

describe('listPublicMarketplaceListings', () => {
  it('reads the sanitized public view and maps its records to the app contract', async () => {
    const { client, calls } = createClient({ data: [row], error: null });

    await expect(listPublicMarketplaceListings({}, client)).resolves.toEqual([{
      id: 'listing-1',
      slug: 'editorial-salon',
      productType: 'site_template',
      title: 'Editorial Salon',
      industryKey: 'salon',
      summary: 'A design-only site template.',
      priceCents: 4900,
      currency: 'usd',
      currentReleaseId: 'release-1',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }]);
    expect(calls[0]).toEqual(['from', 'marketplace_public_listings']);
    expect(calls.find(([kind]) => kind === 'select')?.[1]).not.toContain('snapshot_path');
    expect(calls.find(([kind]) => kind === 'select')?.[1]).not.toContain('creator_user_id');
  });

  it('applies supported browse filters and caps page size', async () => {
    const { client, calls } = createClient({ data: [], error: null });

    await listPublicMarketplaceListings({
      industryKey: 'salon',
      productType: 'site_template',
      minPriceCents: 1000,
      maxPriceCents: 10000,
      limit: 500,
    }, client);

    expect(calls).toContainEqual(['eq', 'industry_key', 'salon']);
    expect(calls).toContainEqual(['eq', 'product_type', 'site_template']);
    expect(calls).toContainEqual(['gte', 'price_cents', 1000]);
    expect(calls).toContainEqual(['lte', 'price_cents', 10000]);
    expect(calls).toContainEqual(['limit', 60]);
  });

  it('rejects invalid filters and malformed public rows', async () => {
    const { client } = createClient({ data: [row], error: null });
    await expect(listPublicMarketplaceListings({ minPriceCents: 200, maxPriceCents: 100 }, client))
      .rejects.toThrow(/cannot exceed/i);

    const malformed = createClient({ data: [{ ...row, price_cents: 4.5 }], error: null });
    await expect(listPublicMarketplaceListings({}, malformed.client))
      .rejects.toThrow(/public listing contract/i);
  });

  it('surfaces database read failures to the caller', async () => {
    const failure = new Error('catalog unavailable');
    const { client } = createClient({ data: null, error: failure });
    await expect(listPublicMarketplaceListings({}, client)).rejects.toBe(failure);
  });
});