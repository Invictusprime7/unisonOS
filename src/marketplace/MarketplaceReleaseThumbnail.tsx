import { useEffect, useRef, useState } from 'react';
import { loadMarketplaceReleasePreview } from '@/marketplace/stageReleaseClient';
import { MarketplaceThumbnailSurface } from '@/marketplace/MarketplaceThumbnailSurface';
import { resolveReleaseCoverImage } from '@/marketplace/releaseCoverImage';

/** Static cover from the placeholder-safe package; never mounts a preview runtime. */
export function MarketplaceReleaseThumbnail({ slug, releaseId, category }: { slug: string; releaseId: string; category: string }) {
  const container = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [cover, setCover] = useState<string>();
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
    setCover(undefined);
    setFailed(false);
    void loadMarketplaceReleasePreview(slug).then((result) => {
      if (active) {
        const image = resolveReleaseCoverImage(result.files);
        setCover(image);
        setFailed(!image);
      }
    }).catch(() => {
      if (active) setFailed(true);
    });
    return () => { active = false; };
  }, [visible, slug, releaseId]);

  return (
    <div ref={container}>
      <MarketplaceThumbnailSurface src={cover} category={category}>
        <span className="text-sm text-muted-foreground">{failed ? 'Cover image unavailable' : 'Loading cover…'}</span>
      </MarketplaceThumbnailSurface>
    </div>
  );
}