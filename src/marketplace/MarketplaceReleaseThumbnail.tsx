import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { loadMarketplaceReleasePreview, type MarketplaceReleasePreview } from '@/marketplace/stageReleaseClient';

const VFSPreview = lazy(() => import('@/components/VFSPreview').then((module) => ({ default: module.VFSPreview })));

/** Read-only thumbnail of the published, placeholder-safe package, loaded near the viewport. */
export function MarketplaceReleaseThumbnail({ slug, releaseId }: { slug: string; releaseId: string }) {
  const container = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [preview, setPreview] = useState<MarketplaceReleasePreview | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        setVisible(true);
        observer.disconnect();
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    let active = true;
    setPreview(null);
    setFailed(false);
    void loadMarketplaceReleasePreview(slug).then((result) => {
      if (active) setPreview(result);
    }).catch(() => {
      if (active) setFailed(true);
    });
    return () => { active = false; };
  }, [visible, slug, releaseId]);

  return (
    <div ref={container} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', pointerEvents: 'none' }} aria-hidden="true">
      <div style={{ position: 'absolute', inset: 0 }}>
        {failed ? 'Preview unavailable' : preview ? (
          <Suspense fallback="Loading preview…">
            <VFSPreview nodes={[]} files={preview.files} activeFile="/src/App.tsx" device="desktop"
              forceBackend="sandpack" showToolbar={false} showConsole={false} showBackendIndicator={false}
              enableSelection={false} />
          </Suspense>
        ) : 'Loading preview…'}
      </div>
    </div>
  );
}