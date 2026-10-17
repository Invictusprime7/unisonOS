/**
 * Gallery Variant: Collection Tiles
 *
 * Adapted from the 21st.dev community component "Commerce Hero" (21st:4927,
 * @bankkroll) — specifically its category tile grid. Normalized for the Unison
 * runtime: `@/components/ui/*` and lucide imports removed (arrow rendered as
 * inline SVG), framer-motion hover/stagger replaced with CSS transitions that
 * respect `prefers-reduced-motion`, colors / radii / spacing rebound to Stage
 * 4b semantic theme tokens, and the tile behavior routed through the shared
 * GalleryFrame filter + lightbox contract used by every gallery variant.
 */

import React from 'react';
import type { BaseSectionProps } from '../../types';
import { hsl, hsla } from '../../themeUtils';
import { GalleryFrame } from './GalleryFrame';
import { GalleryImage } from './GalleryImage';

const ArrowUpRight: React.FC = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M7 17 17 7" />
    <path d="M7 7h10v10" />
  </svg>
);

export const GalleryCollectionTiles: React.FC<BaseSectionProps<'gallery'>> = ({ section, theme }) => {
  const { headline, subheadline, items, filterable, columns = 4 } = section.props;
  const desktopColumns =
    columns === 2 ? 'lg:grid-cols-2' : columns === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-4';

  return (
    <GalleryFrame
      variantId="gallery:collection-tiles"
      theme={theme}
      headline={headline}
      subheadline={subheadline}
      items={items}
      filterable={filterable}
    >
      {({ items: media, open }) => (
        <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 ${desktopColumns}`}>
          {media.map((item, i) => (
            <div
              key={i}
              className="group relative overflow-hidden"
              style={{
                borderRadius: `calc(${theme.radius} * 3)`,
                background: hsla(theme.colors.muted, 0.5),
                border: `1px solid ${hsla(theme.colors.border, 0.4)}`,
                minHeight: '18rem',
              }}
            >
              <button
                type="button"
                onClick={() => open(i)}
                aria-label={item.alt || item.caption || 'Open image'}
                className="block h-full w-full cursor-pointer border-0 bg-transparent p-6 text-center"
              >
                <span
                  className="relative z-10 block text-2xl font-bold sm:text-3xl"
                  style={{
                    fontFamily: theme.typography.headingFont,
                    fontWeight: theme.typography.headingWeight,
                    color: hsl(theme.colors.primary),
                  }}
                >
                  {item.caption || item.category || item.alt}
                </span>
                <span className="absolute inset-0 flex items-center justify-center p-6">
                  <GalleryImage
                    src={item.src}
                    alt={item.alt || ''}
                    theme={theme}
                    loading="lazy"
                    className="h-auto w-full max-w-[45%] object-contain opacity-90 transition-transform duration-500 motion-reduce:transition-none group-hover:scale-110"
                  />
                </span>
              </button>
              <span
                aria-hidden="true"
                className="pointer-events-none absolute bottom-0 right-0 z-10 flex h-16 w-16 items-center justify-center md:h-20 md:w-20"
                style={{
                  background: hsl(theme.colors.background),
                  borderTopLeftRadius: `calc(${theme.radius} * 2)`,
                  borderLeft: `1px solid ${hsla(theme.colors.border, 0.4)}`,
                  borderTop: `1px solid ${hsla(theme.colors.border, 0.4)}`,
                }}
              >
                <span
                  className="flex h-10 w-10 items-center justify-center transition-transform duration-300 motion-reduce:transition-none group-hover:scale-110 md:h-12 md:w-12"
                  style={{
                    borderRadius: '9999px',
                    background: hsl(theme.colors.secondary),
                    color: hsl(theme.colors.secondaryForeground),
                  }}
                >
                  <ArrowUpRight />
                </span>
              </span>
            </div>
          ))}
        </div>
      )}
    </GalleryFrame>
  );
};
