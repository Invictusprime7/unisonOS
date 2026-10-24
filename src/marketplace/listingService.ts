import type { MarketplaceProductType, PublicMarketplaceListing } from '@/marketplace/contracts';
import { supabase } from '@/integrations/supabase/client-compat';

const PUBLIC_LISTING_COLUMNS =
  'id, slug, product_type, title, industry_key, summary, price_cents, currency, cover_image_url, current_release_id, created_at, updated_at';
const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 60;

interface ListingQueryResult {
  data: unknown[] | null;
  error: unknown;
}

interface PublicListingQuery {
  eq(column: string, value: string): PublicListingQuery;
  gte(column: string, value: number): PublicListingQuery;
  lte(column: string, value: number): PublicListingQuery;
  order(column: string, options: { ascending: boolean }): PublicListingQuery;
  limit(count: number): PromiseLike<ListingQueryResult>;
}

export interface PublicListingQueryClient {
  from(table: 'marketplace_public_listings'): {
    select(columns: string): PublicListingQuery;
  };
}

export interface MarketplaceListingFilters {
  slug?: string;
  industryKey?: string;
  productType?: MarketplaceProductType;
  minPriceCents?: number;
  maxPriceCents?: number;
  limit?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parsePublicListing(value: unknown): PublicMarketplaceListing {
  if (!isRecord(value)) throw new Error('Marketplace listing response was not an object.');

  const productTypes: MarketplaceProductType[] = [
    'site_template',
    'brand_ui_kit',
    'industry_launch_kit',
    'section_pack',
  ];

  if (
    typeof value.id !== 'string'
    || typeof value.slug !== 'string'
    || typeof value.product_type !== 'string'
    || !productTypes.includes(value.product_type as MarketplaceProductType)
    || typeof value.title !== 'string'
    || typeof value.industry_key !== 'string'
    || typeof value.summary !== 'string'
    || typeof value.price_cents !== 'number'
    || !Number.isInteger(value.price_cents)
    || value.price_cents < 0
    || typeof value.currency !== 'string'
    || typeof value.current_release_id !== 'string'
    || typeof value.created_at !== 'string'
    || typeof value.updated_at !== 'string'
  ) {
    throw new Error('Marketplace listing response did not match the public listing contract.');
  }

  return {
    id: value.id,
    slug: value.slug,
    productType: value.product_type as MarketplaceProductType,
    title: value.title,
    industryKey: value.industry_key,
    summary: value.summary,
    priceCents: value.price_cents,
    currency: value.currency,
    currentReleaseId: value.current_release_id,
    coverImageUrl: typeof value.cover_image_url === 'string' && value.cover_image_url.length > 0
      ? value.cover_image_url
      : undefined,
    createdAt: value.created_at,
    updatedAt: value.updated_at,
  };
}

function normalizeLimit(limit: number | undefined): number {
  if (limit === undefined) return DEFAULT_LIMIT;
  if (!Number.isInteger(limit) || limit < 1) {
    throw new RangeError('Marketplace listing limit must be a positive integer.');
  }
  return Math.min(limit, MAX_LIMIT);
}

export async function listPublicMarketplaceListings(
  filters: MarketplaceListingFilters = {},
  client = supabase as unknown as PublicListingQueryClient,
): Promise<PublicMarketplaceListing[]> {
  if (
    filters.minPriceCents !== undefined
    && (!Number.isInteger(filters.minPriceCents) || filters.minPriceCents < 0)
  ) {
    throw new RangeError('Minimum marketplace price must be a non-negative integer.');
  }
  if (
    filters.maxPriceCents !== undefined
    && (!Number.isInteger(filters.maxPriceCents) || filters.maxPriceCents < 0)
  ) {
    throw new RangeError('Maximum marketplace price must be a non-negative integer.');
  }
  if (
    filters.minPriceCents !== undefined
    && filters.maxPriceCents !== undefined
    && filters.minPriceCents > filters.maxPriceCents
  ) {
    throw new RangeError('Minimum marketplace price cannot exceed maximum price.');
  }

  let query = client.from('marketplace_public_listings').select(PUBLIC_LISTING_COLUMNS);
  if (filters.slug) query = query.eq('slug', filters.slug);
  if (filters.industryKey) query = query.eq('industry_key', filters.industryKey);
  if (filters.productType) query = query.eq('product_type', filters.productType);
  if (filters.minPriceCents !== undefined) query = query.gte('price_cents', filters.minPriceCents);
  if (filters.maxPriceCents !== undefined) query = query.lte('price_cents', filters.maxPriceCents);

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(normalizeLimit(filters.limit));

  if (error) throw error;
  return (data ?? []).map(parsePublicListing);
}