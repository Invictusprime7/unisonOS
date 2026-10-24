import { lazy, Suspense, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { listPublicMarketplaceListings } from '@/marketplace/listingService';
import type { PublicMarketplaceListing } from '@/marketplace/contracts';
import { loadMarketplaceReleasePreview, type MarketplaceReleasePreview } from '@/marketplace/stageReleaseClient';

const VFSPreview = lazy(() => import('@/components/VFSPreview').then((m) => ({ default: m.VFSPreview })));
type Device = 'desktop' | 'tablet' | 'mobile';

function formatPrice(priceCents: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: currency.toUpperCase(),
    maximumFractionDigits: 0,
  }).format(priceCents / 100);
}

export default function MarketplaceListing() {
  const { slug = '' } = useParams();
  const [listing, setListing] = useState<PublicMarketplaceListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [preview, setPreview] = useState<MarketplaceReleasePreview | null>(null);
  const [previewState, setPreviewState] = useState<'idle' | 'loading' | 'ready' | 'unavailable'>('idle');
  const [device, setDevice] = useState<Device>('desktop');

  useEffect(() => {
    if (!listing) return;
    let active = true;
    setPreviewState('loading');
    void loadMarketplaceReleasePreview(listing.slug).then((result) => {
      if (!active) return;
      setPreview(result);
      setPreviewState('ready');
    }).catch(() => {
      if (active) setPreviewState('unavailable');
    });
    return () => { active = false; };
  }, [listing]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    void listPublicMarketplaceListings({ slug, limit: 1 }).then((results) => {
      if (active) setListing(results[0] ?? null);
    }).catch(() => {
      if (active) setError(true);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [slug]);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5">
          <Link to="/marketplace" className="font-semibold tracking-tight">Unison Design Market</Link>
          <Link to="/auth?next=%2Fmarketplace" className="text-sm text-muted-foreground hover:text-foreground">Sign in</Link>
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-5 py-8">
        <Link to="/marketplace" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft aria-hidden="true" className="h-4 w-4" /> Marketplace
        </Link>
        {loading ? (
          <p role="status" className="py-16 text-sm text-muted-foreground">Loading listing…</p>
        ) : error ? (
          <p role="alert" className="py-16 text-sm text-destructive">Listing details could not be loaded.</p>
        ) : !listing ? (
          <section className="border-b border-border py-16">
            <h1 className="text-2xl font-semibold">Listing not found</h1>
            <p className="mt-2 text-sm text-muted-foreground">This listing is unavailable or is no longer published.</p>
          </section>
        ) : (
          <article className="grid gap-10 py-10 md:grid-cols-[minmax(0,1.4fr)_minmax(260px,0.6fr)]">
            <div>
              {previewState === 'ready' && preview ? (
                <div>
                  <div role="group" aria-label="Preview device" className="mb-3 flex gap-2">
                    {(['desktop', 'tablet', 'mobile'] as Device[]).map((d) => (
                      <button key={d} type="button" aria-pressed={device === d} onClick={() => setDevice(d)}
                        className={`border border-border px-3 py-1 text-xs capitalize ${device === d ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'}`}>
                        {d}
                      </button>
                    ))}
                  </div>
                  <div className="aspect-[16/10] overflow-hidden border border-border bg-muted">
                    <Suspense fallback={<p role="status" className="p-6 text-sm text-muted-foreground">Loading preview…</p>}>
                      <VFSPreview nodes={[]} files={preview.files} activeFile="/src/App.tsx" device={device}
                        forceBackend="sandpack" showToolbar={false} showConsole={false} enableSelection={false} />
                    </Suspense>
                  </div>
                </div>
              ) : (
                <div className="flex aspect-[16/10] items-center justify-center border border-border bg-muted text-sm text-muted-foreground">
                  {previewState === 'loading' ? 'Loading preview…' : 'Certified preview unavailable'}
                </div>
              )}
              <p className="mt-8 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                {listing.industryKey} · {listing.productType.replace(/_/g, ' ')}
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">{listing.title}</h1>
              <p className="mt-4 max-w-2xl whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{listing.summary}</p>
              {preview && (
                <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-border pt-6 text-sm sm:grid-cols-3">
                  <div><dt className="text-muted-foreground">Version</dt><dd className="mt-1">{preview.version}</dd></div>
                  <div><dt className="text-muted-foreground">Pages</dt><dd className="mt-1 capitalize">{preview.details.pageRoles.join(', ') || '—'}</dd></div>
                  <div><dt className="text-muted-foreground">Design direction</dt><dd className="mt-1">{preview.details.artDirectionPackId ?? '—'}</dd></div>
                  <div><dt className="text-muted-foreground">Media</dt><dd className="mt-1">{preview.details.placeholderAssetCount} of {preview.details.assetCount} replaced with “add your own” placeholders</dd></div>
                  <div><dt className="text-muted-foreground">Files</dt><dd className="mt-1">{preview.details.fileCount}</dd></div>
                  <div><dt className="text-muted-foreground">Published</dt><dd className="mt-1">{new Date(listing.updatedAt).toLocaleDateString()}</dd></div>
                </dl>
              )}
            </div>
            <aside className="border-t border-border pt-6 md:border-l md:border-t-0 md:pl-8">
              <p className="text-2xl font-semibold">{formatPrice(listing.priceCents, listing.currency)}</p>
              <p className="mt-3 text-sm text-muted-foreground">{previewState === 'ready' ? 'Live preview shown with placeholder media. Install opens soon.' : 'Preview and install are unavailable until this release has certified preview and licensing evidence.'}</p>
              <button disabled className="mt-6 h-11 w-full border border-input bg-muted text-sm text-muted-foreground disabled:cursor-not-allowed">
                Install unavailable
              </button>
            </aside>
          </article>
        )}
      </div>
    </main>
  );
}