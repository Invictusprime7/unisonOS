/** @jsxRuntime classic */
/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
// UNISON GENERATED UI FOUNDATION v1.12
import * as React from 'react';
import { Image as SiteImage } from '../media';
import { cn } from '..';
import { WebglLayer } from './lazy';

export interface FloatingMediaProps {
  src: string;
  alt: string;
  caption?: string;
  className?: string;
}

/** Single image plane with gentle parallax float and a DOM image fallback. */
export function FloatingMedia({ src, alt, caption, className }: FloatingMediaProps) {
  const [failedSource, setFailedSource] = React.useState<string | null>(null);
  const onFailure = React.useCallback(() => setFailedSource(src), [src]);
  const domImage = <SiteImage src={src} alt={alt} loading="lazy" className="size-full object-cover" />;
  return (
    <figure
      data-ut-component="floating-media"
      data-ut-editable="src,alt,caption"
      className={cn('relative overflow-hidden rounded-[var(--ut-media-radius)]', className)}
    >
      <div className="relative min-h-[var(--ut-media-block)]">
        {failedSource === src ? domImage : (
          <WebglLayer scene="FloatingMediaScene" sceneProps={{ src, onFailure }} fallback={domImage} />
        )}
        <span className="sr-only">{alt}</span>
      </div>
      {caption ? <figcaption className="mt-3 text-sm text-muted-foreground">{caption}</figcaption> : null}
    </figure>
  );
}

export interface DepthGalleryItem {
  src: string;
  alt: string;
  caption?: string;
}

/** Depth-staggered media wall. Falls back to a responsive image grid. */
export function DepthGallery({ items, className }: { items: DepthGalleryItem[]; className?: string }) {
  const planes = items.slice(0, 8);
  const sourceKey = JSON.stringify(planes.map(item => item.src));
  const [failedSources, setFailedSources] = React.useState<string | null>(null);
  const onFailure = React.useCallback(() => setFailedSources(sourceKey), [sourceKey]);
  const fallback = <div className="grid size-full grid-cols-2 gap-3 md:grid-cols-3">{planes.map((item, index) => <SiteImage key={item.src + index} src={item.src} alt={item.alt} className="size-full object-cover" />)}</div>;
  return (
    <div
      data-ut-component="depth-gallery"
      data-ut-editable="items"
      className={cn('relative overflow-hidden rounded-[var(--ut-media-radius)]', className)}
    >
      <div className="relative min-h-[var(--ut-media-block-lg)]">
        {failedSources === sourceKey ? fallback : (
          <WebglLayer scene="DepthGalleryScene" sceneProps={{ items: planes, onFailure }} fallback={fallback} />
        )}
      </div>
      <ul className="sr-only">
        {planes.map((item) => (
          <li key={item.src}>{item.caption || item.alt}</li>
        ))}
      </ul>
    </div>
  );
}
