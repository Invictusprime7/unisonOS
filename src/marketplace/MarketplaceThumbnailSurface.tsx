import type { ReactNode } from 'react';

/** Shared static cover surface for concept and published marketplace cards. */
export function MarketplaceThumbnailSurface({ src, category, children }: { src?: string; category: string; children?: ReactNode }) {
  return (
    <div className="relative mb-4 aspect-[16/10] overflow-hidden bg-muted">
      {src ? <img src={src} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" /> : children}
      <span className="absolute bottom-3 left-3 bg-background px-2 py-1 text-[10px] font-medium uppercase tracking-[0.1em]">{category}</span>
    </div>
  );
}