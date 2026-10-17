/**
 * Gallery Frame
 *
 * Shared chrome for every gallery variant: section shell, editorial intro,
 * category filter chips and lightbox wiring. Variants supply only the grid.
 */

import React, { useMemo, useState } from 'react';
import type { ThemeTokens } from '../../types';
import { hsl, hsla } from '../../themeUtils';
import { GalleryLightbox, type LightboxItem } from './GalleryLightbox';
import { galleryCategories, normalizeGalleryItems } from './galleryUtils';
import { GalleryImage } from './GalleryImage';

interface GalleryFrameProps {
  variantId: string;
  theme: ThemeTokens;
  headline?: string;
  subheadline?: string;
  items: unknown;
  filterable?: boolean;
  children: (args: { items: LightboxItem[]; open: (index: number) => void }) => React.ReactNode;
}

export const GalleryFrame: React.FC<GalleryFrameProps> = ({
  variantId, theme, headline, subheadline, items, filterable, children,
}) => {
  const media = useMemo(() => normalizeGalleryItems(items), [items]);
  const categories = useMemo(() => galleryCategories(media), [media]);
  const [selected, setActive] = useState('all');
  // A selected category that no longer exists (or disabled filtering) falls back to all images.
  const active = filterable !== false && categories.length > 1 && categories.includes(selected) ? selected : 'all';
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const visible = active === 'all' ? media : media.filter((item) => item.category === active);

  return (
    <section
      data-ut-variant={variantId}
      style={{ padding: theme.sectionPadding, background: hsl(theme.colors.background) }}
    >
      <div className="mx-auto px-5 sm:px-6 lg:px-8" style={{ maxWidth: theme.containerWidth }}>
        {(headline || subheadline) && (
          <div className="mb-8 text-center md:mb-12">
            {headline && (
              <h2 data-ut-slot="gallery.headline"
                className="mb-3 text-2xl sm:text-3xl md:text-4xl"
                style={{
                  fontFamily: theme.typography.headingFont,
                  fontWeight: theme.typography.headingWeight,
                  color: hsl(theme.colors.foreground),
                }}
              >
                {headline}
              </h2>
            )}
            {subheadline && (
              <p data-ut-slot="gallery.subheadline"
                className="mx-auto max-w-xl text-base"
                style={{ fontFamily: theme.typography.bodyFont, color: hsl(theme.colors.mutedForeground) }}
              >
                {subheadline}
              </p>
            )}
          </div>
        )}

        {filterable !== false && categories.length > 1 && (
          <div className="mb-10 flex flex-wrap justify-center gap-2">
            {['all', ...categories].map((category) => (
              <button
                key={category}
                type="button"
                aria-pressed={active === category}
                onClick={() => setActive(category)}
                className="rounded-full border px-4 py-1.5 text-xs font-semibold capitalize transition-colors"
                style={
                  active === category
                    ? {
                        background: hsl(theme.colors.primary),
                        color: hsl(theme.colors.primaryForeground),
                        borderColor: hsl(theme.colors.primary),
                      }
                    : {
                        background: 'transparent',
                        color: hsl(theme.colors.mutedForeground),
                        borderColor: hsla(theme.colors.border, 0.7),
                      }
                }
              >
                {category}
              </button>
            ))}
          </div>
        )}

        {children({ items: visible, open: setLightboxIndex })}
      </div>

      <GalleryLightbox
        items={visible}
        index={lightboxIndex}
        theme={theme}
        onClose={() => setLightboxIndex(null)}
        onNavigate={setLightboxIndex}
      />
    </section>
  );
};

export const GalleryFigure: React.FC<{
  item: LightboxItem;
  theme: ThemeTokens;
  className?: string;
  aspect?: string;
  onOpen: () => void;
}> = ({ item, theme, className = '', aspect, onOpen }) => (
  <figure
    className={`group relative m-0 overflow-hidden ${className}`}
    style={{
      borderRadius: theme.radius,
      border: `1px solid ${hsla(theme.colors.border, 0.4)}`,
      background: hsl(theme.colors.muted),
      aspectRatio: aspect,
    }}
  >
    <button
      type="button"
      onClick={onOpen}
      aria-label={item.alt || item.caption || 'Open image'}
      className="block h-full w-full cursor-zoom-in border-0 bg-transparent p-0"
    >
      <GalleryImage
        src={item.src}
        alt={item.alt || ''}
        theme={theme}
        loading="lazy"
        className="h-full w-full object-cover transition-transform duration-500 motion-reduce:transition-none group-hover:scale-105"
      />
    </button>
    {item.caption && (
      <figcaption
        className="pointer-events-none absolute inset-x-0 bottom-0 p-4 text-sm opacity-0 transition-opacity motion-reduce:transition-none group-hover:opacity-100"
        style={{
          background: `linear-gradient(to top, ${hsla(theme.colors.foreground, 0.82)}, transparent)`,
          color: hsl(theme.colors.background),
          fontFamily: theme.typography.bodyFont,
        }}
      >
        {item.caption}
        {item.category && <span className="ml-2 text-xs uppercase tracking-widest opacity-80">{item.category}</span>}
      </figcaption>
    )}
  </figure>
);
