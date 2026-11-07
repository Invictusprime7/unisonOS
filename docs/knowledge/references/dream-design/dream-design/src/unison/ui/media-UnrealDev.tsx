/** @jsxRuntime classic */
/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
// UNISON GENERATED UI FOUNDATION v1.12
import * as React from 'react';
import * as Dialog from './radix/dialog';
import { Expand } from './icons';
import { cn } from './cn';

export interface StaticImageData { src: string; width: number; height: number; blurDataURL?: string }
export type ImageSource = string | Partial<StaticImageData> | { default: string | Partial<StaticImageData> };
export interface ImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'children' | 'src'> {
  src?: ImageSource | null;
  children?: React.ReactNode;
  ratio?: string;
  fill?: boolean;
  priority?: boolean;
  layout?: 'fill' | 'responsive' | 'intrinsic' | 'fixed';
  objectFit?: React.CSSProperties['objectFit'];
  objectPosition?: React.CSSProperties['objectPosition'];
  placeholder?: string;
  blurDataURL?: string;
  quality?: number;
  unoptimized?: boolean;
  loader?: unknown;
  onLoadingComplete?: (image: HTMLImageElement) => void;
}

export function resolveImageSource(value: ImageProps['src']): Partial<StaticImageData> {
  const asset = value && typeof value === 'object' && 'default' in value ? value.default : value;
  if (typeof asset === 'string') return { src: asset.trim() || undefined };
  if (!asset || typeof asset !== 'object' || typeof asset.src !== 'string') return {};
  return { src: asset.src.trim() || undefined, width: Number(asset.width) > 0 ? Number(asset.width) : undefined, height: Number(asset.height) > 0 ? Number(asset.height) : undefined };
}

export const Image = React.forwardRef<HTMLImageElement, ImageProps>(
  ({ src, ratio, fill = false, priority = false, alt = '', className, loading, style, width, height, layout, objectFit = 'cover', objectPosition, children: _children, placeholder: _placeholder, blurDataURL: _blur, quality: _quality, unoptimized: _unoptimized, loader: _loader, onLoadingComplete, onError, onLoad, ...props }, ref) => {
    const asset = resolveImageSource(src);
    const [failedSrc, setFailedSrc] = React.useState<string | null>(null);
    const fills = fill || layout === 'fill';
    const imageWidth = width ?? asset.width, imageHeight = height ?? asset.height;
    const aspectRatio = ratio ?? (Number(imageWidth) > 0 && Number(imageHeight) > 0 ? String(imageWidth) + ' / ' + String(imageHeight) : '4 / 3');
    const frameStyle: React.CSSProperties = { width: fills ? '100%' : undefined, height: fills ? '100%' : undefined, aspectRatio: fills ? undefined : aspectRatio, objectFit, objectPosition, ...style };
    const classes = cn('w-full rounded-[var(--ut-media-frame-radius)] object-cover', fills && 'absolute inset-0 h-full', className);
    if (!asset.src || failedSrc === asset.src) return <span role={alt ? 'img' : undefined} aria-label={alt ? alt + ': image unavailable' : undefined} aria-hidden={alt ? undefined : true} data-image-fallback="true" className={cn(classes, 'inline-grid place-items-center bg-muted text-muted-foreground')} style={frameStyle}><span className="p-4 text-sm">Image unavailable</span></span>;
    return <img ref={ref} {...props} src={asset.src} alt={alt} width={imageWidth} height={imageHeight} loading={priority ? 'eager' : loading ?? 'lazy'} fetchPriority={priority ? 'high' : undefined} decoding="async" style={frameStyle} className={classes} onError={(event) => { setFailedSrc(asset.src!); onError?.(event); }} onLoad={(event) => { setFailedSrc(null); onLoad?.(event); onLoadingComplete?.(event.currentTarget); }} />;
  },
);
Image.displayName = 'Image';
export default Image;

export function ImageLightbox({ src, alt, className }: { src: string; alt: string; className?: string }) {
  return <Dialog.Root><Dialog.Trigger asChild><button type="button" className={cn('group relative block overflow-hidden rounded-[var(--radius)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', className)}><Image src={src} alt={alt} className="aspect-[4/3] w-full object-cover transition-transform duration-300 group-hover:scale-105" /><span className="absolute inset-0 grid place-items-center bg-foreground/0 text-background transition-colors group-hover:bg-foreground/45"><Expand className="size-6 opacity-0 transition-opacity group-hover:opacity-100" /></span></button></Dialog.Trigger><Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/70 backdrop-blur-sm" /><Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[var(--ut-overlay-block)] w-[min(92vw,var(--ut-content-width))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[var(--radius)] bg-card shadow-2xl"><Dialog.Title className="sr-only">{alt}</Dialog.Title><Image src={src} alt={alt} className="max-h-[var(--ut-overlay-block)] w-full object-contain" /></Dialog.Content></Dialog.Portal></Dialog.Root>;
}
