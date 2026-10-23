import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, Search } from 'lucide-react';
import { listPublicMarketplaceListings } from '@/marketplace/listingService';
import type { MarketplaceProductType, PublicMarketplaceListing } from '@/marketplace/contracts';

const PRODUCT_TYPES: Array<{ value: MarketplaceProductType; label: string }> = [
  { value: 'site_template', label: 'Site template' },
  { value: 'brand_ui_kit', label: 'Brand UI kit' },
  { value: 'industry_launch_kit', label: 'Industry launch kit' },
  { value: 'section_pack', label: 'Section pack' },
];

function formatPrice(priceCents: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: currency.toUpperCase(),
    maximumFractionDigits: 0,
  }).format(priceCents / 100);
}

export function MarketplaceCatalog({ embedded = false, enabled = true }: { embedded?: boolean; enabled?: boolean }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') ?? '';
  const industryKey = searchParams.get('industry') ?? '';
  const productType = searchParams.get('type') as MarketplaceProductType | '';
  const [listings, setListings] = useState<PublicMarketplaceListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    setLoading(true);
    setError(null);
    void listPublicMarketplaceListings({
      industryKey: industryKey || undefined,
      productType: productType || undefined,
      limit: 60,
    }).then((result) => {
      if (active) setListings(result);
    }).catch(() => {
      if (active) setError('Marketplace listings could not be loaded.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [enabled, industryKey, productType]);

  const visibleListings = listings.filter((listing) => {
    const needle = query.trim().toLocaleLowerCase();
    return !needle || `${listing.title} ${listing.summary} ${listing.industryKey}`.toLocaleLowerCase().includes(needle);
  });

  function updateFilter(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next, { replace: true });
  }

  return (
    <div className={embedded ? 'w-full' : 'mx-auto max-w-7xl px-5 pb-20 pt-10'}>
      <div className="flex flex-col gap-2 border-b border-border pb-8">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Design Marketplace</p>
        <h1 className={embedded ? 'text-2xl font-semibold tracking-tight' : 'text-3xl font-semibold tracking-tight'}>Browse templates</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Certified, editable releases for the Unison App Builder.
        </p>
      </div>

      <section aria-label="Marketplace filters" className="grid gap-3 border-b border-border py-5 md:grid-cols-[minmax(220px,1fr)_220px_190px]">
        <label className="relative block">
          <span className="sr-only">Search marketplace</span>
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(event) => updateFilter('q', event.target.value)}
            placeholder="Search templates"
            className="h-10 w-full border border-input bg-background pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Product type
          <select
            value={productType}
            onChange={(event) => updateFilter('type', event.target.value)}
            className="h-10 border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">All types</option>
            {PRODUCT_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Industry
          <input
            value={industryKey}
            onChange={(event) => updateFilter('industry', event.target.value.trim().toLowerCase())}
            placeholder="All industries"
            className="h-10 border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
      </section>

      <div className="flex min-h-14 items-center justify-between border-b border-border text-sm">
        <p className="text-muted-foreground" aria-live="polite">
          {loading ? 'Loading listings…' : `${visibleListings.length} ${visibleListings.length === 1 ? 'listing' : 'listings'}`}
        </p>
        {!embedded && <span className="text-xs text-muted-foreground">Browse free, preview before install</span>}
      </div>

      {error ? (
        <div role="alert" className="py-12 text-sm text-destructive">{error}</div>
      ) : loading ? (
        <div role="status" className="py-16 text-sm text-muted-foreground">Loading listings…</div>
      ) : visibleListings.length === 0 ? (
        <div className="border-b border-border py-12">
          <h2 className="text-lg font-medium">{query || industryKey || productType ? 'No matching templates' : 'No templates published yet'}</h2>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            {query || industryKey || productType
              ? 'Try changing or clearing your filters.'
              : 'Certified releases will appear here when they are ready to preview and install.'}
          </p>
        </div>
      ) : (
        <ul className="grid gap-x-6 md:grid-cols-2 xl:grid-cols-3">
          {visibleListings.map((listing) => (
            <li key={listing.id} className="border-b border-border py-6">
              <div className="mb-4 flex aspect-[16/10] items-center justify-center border border-border bg-muted text-sm text-muted-foreground">
                Preview image unavailable
              </div>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">{listing.industryKey} · {PRODUCT_TYPES.find((type) => type.value === listing.productType)?.label}</p>
                  <h2 className="mt-1 text-lg font-medium">{listing.title}</h2>
                </div>
                <span className="shrink-0 text-sm">{formatPrice(listing.priceCents, listing.currency)}</span>
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{listing.summary}</p>
              <Link to={`/marketplace/${encodeURIComponent(listing.slug)}`} className="mt-4 inline-flex items-center gap-2 text-sm font-medium hover:underline">
                View details <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}