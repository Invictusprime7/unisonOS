import React from 'react';
import type { BaseSectionProps } from '../../types';
import { hsl } from '../../themeUtils';
import { GalleryFrame, GalleryFigure } from './GalleryFrame';

export function GalleryCaseStudy({ section, theme }: BaseSectionProps<'gallery'>) {
  const { headline, subheadline, items, filterable } = section.props;
  return (
    <GalleryFrame
      variantId="gallery:case-study"
      theme={theme}
      headline={headline}
      subheadline={subheadline}
      items={items}
      filterable={filterable}
    >
      {({ items: media, open }) => (
        <div className="space-y-10">
          {media.map((item, index) => (
            <article
              key={index}
              data-ut-slot={`project-${index}`}
              className="grid items-center gap-6 border-t pt-8 md:grid-cols-[2fr_1fr] md:gap-10"
              style={{ borderColor: hsl(theme.colors.border) }}
            >
              <GalleryFigure item={item} theme={theme} aspect="16 / 10" onOpen={() => open(index)} />
              <div>
                <p
                  className="mb-4 text-xs uppercase tracking-widest"
                  style={{ color: hsl(theme.colors.mutedForeground) }}
                >
                  {item.category || `Project ${String(index + 1).padStart(2, '0')}`}
                </p>
                <h3
                  className="text-2xl sm:text-3xl"
                  style={{ fontFamily: theme.typography.headingFont, color: hsl(theme.colors.foreground) }}
                >
                  {item.caption || item.alt}
                </h3>
                <button
                  type="button"
                  onClick={() => open(index)}
                  className="mt-6 min-h-11 text-sm underline underline-offset-4"
                  style={{ color: hsl(theme.colors.foreground) }}
                >
                  View image<span className="sr-only">: {item.alt}</span> ↗
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </GalleryFrame>
  );
}
