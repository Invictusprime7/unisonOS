import { lazy, Suspense, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { MarketplacePreviewShell } from '@/marketplace/MarketplacePreviewShell';
import { MarketplaceInstallButton } from '@/marketplace/MarketplaceInstallButton';
import { listPublicMarketplaceListings } from '@/marketplace/listingService';
import type { PublicMarketplaceListing } from '@/marketplace/contracts';
import { loadMarketplaceReleasePreview, type MarketplaceReleasePreview } from '@/marketplace/stageReleaseClient';

const VFSPreview = lazy(() => import('@/components/VFSPreview').then((m) => ({ default: m.VFSPreview })));
type Device = 'desktop' | 'mobile';

function formatPrice(priceCents: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: currency.toUpperCase(),
    maximumFractionDigits: 0,
  }).format(priceCents / 100);
}

export default function MarketplaceListing() {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
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
    setPreview(null);
    void listPublicMarketplaceListings({ slug, limit: 1 }).then(results => {
      if (active) setListing(results[0] ?? null);
    }).catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [slug]);

  if (loading) return <p role="status">Loading listing…</p>;
  if (error) return <p role="alert">Listing details could not be loaded.</p>;
  if (!listing) return <main><h1>Listing not found</h1><Link to="/marketplace">Marketplace</Link></main>;
  return <MarketplacePreviewShell
    title={listing.title}
    subtitle={`${listing.industryKey} · ${formatPrice(listing.priceCents, listing.currency)} · ${preview?.version ?? ''}`}
    description={listing.summary}
    device={device} onDevice={setDevice} onClose={() => navigate('/marketplace')}
    action={<MarketplaceInstallButton key={listing.slug} selection={{ kind: 'release', slug: listing.slug, title: listing.title }} />}
  >
    {previewState === 'ready' && preview ? <Suspense fallback={<p role="status">Loading preview…</p>}>
      <VFSPreview nodes={[]} files={preview.files} activeFile="/src/App.tsx" device={device}
        forceBackend="sandpack" showToolbar={false} showConsole={false} enableSelection={false} />
    </Suspense> : <p role="status">{previewState === 'loading' ? 'Loading preview…' : 'Certified preview unavailable'}</p>}
  </MarketplacePreviewShell>;
}
