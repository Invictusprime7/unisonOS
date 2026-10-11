/**
 * Hero Variant: Spatial Depth
 *
 * Adapted from the 21st.dev community component "Spatial Depth Hero"
 * (21st:30683). The upstream `motion/react` scroll-driven scatter and pointer
 * tilt were NOT carried over: this adaptation is a CSS-only perspective scene
 * — image cards start stacked and fan out to fixed depth coordinates on
 * load, using theme tokens and canonical `data-ut-*` slots. Under
 * `prefers-reduced-motion` the cards render already spread, without motion.
 * No WebGL, no extra runtime dependency.
 *
 * Provenance is recorded on the registry entry (`source`), never at runtime.
 */

import React from 'react';
import type { BaseSectionProps } from '../../types';
import { hsl, hsla } from '../../themeUtils';

/** Upstream spatial coordinates (vw / vh / px depth), kept verbatim. */
export const SPATIAL_DEPTH_COORDS = [
  { x: -28, y: -18, z: 250 },
  { x: 30, y: -22, z: 150 },
  { x: -32, y: 20, z: 80 },
  { x: 28, y: 18, z: -50 },
  { x: -16, y: 28, z: -150 },
  { x: 18, y: -32, z: -250 },
  { x: -12, y: -30, z: -350 },
  { x: 12, y: 32, z: -450 },
] as const;

export function spatialDepthTransform(i: number): string {
  const c = SPATIAL_DEPTH_COORDS[i % SPATIAL_DEPTH_COORDS.length];
  return `translate3d(calc(-50% + ${c.x}vw), calc(-50% + ${c.y}vh), ${c.z}px) rotateX(${c.y * 0.5}deg) rotateY(${c.x * -0.5}deg) rotateZ(${((i - 3.5) * 1.5).toFixed(1)}deg) scale(.8)`;
}

const styles = `
@keyframes ut-spatial-spread { from { transform: translate3d(-50%, -50%, 0) scale(.4); opacity: 0; } }
[data-ut-variant="hero:spatial-depth"] [data-ut-depth-card] { animation: ut-spatial-spread 1.6s cubic-bezier(.2,.8,.2,1) both; }
@media (prefers-reduced-motion: reduce) {
  [data-ut-variant="hero:spatial-depth"] [data-ut-depth-card] { animation: none; }
}
`;

export const HeroSpatialDepth: React.FC<BaseSectionProps<'hero'>> = ({ section, theme }) => {
  const { headline, subheadline, description, ctas = [], badge, image, backgroundImage, images } = section.props;
  const lead = subheadline || description;
  const supplied = (images ?? []).filter((item) => typeof item?.src === 'string' && item.src.trim());
  const fallback = backgroundImage || image;
  const media = supplied.length
    ? supplied.map((item) => ({ src: item.src, alt: item.alt ?? '' }))
    : fallback ? [{ src: fallback, alt: '' }] : [];
  const cards = media.length ? SPATIAL_DEPTH_COORDS.map((_, i) => media[i % media.length]) : [];

  return (
    <section
      data-ut-variant="hero:spatial-depth"
      data-ut-slot="hero"
      className="relative w-full overflow-hidden"
      style={{ background: hsl(theme.colors.background), minHeight: '100vh' }}
    >
      <style>{styles}</style>
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ perspective: '1200px' }}>
        <div className="absolute inset-0" style={{ transformStyle: 'preserve-3d' }}>
          {cards.map((card, i) => (
            <div
              key={i}
              data-ut-depth-card
              className="absolute left-1/2 top-1/2 overflow-hidden rounded-xl shadow-2xl"
              style={{
                width: '14vw',
                minWidth: '7rem',
                aspectRatio: '3 / 4',
                transform: spatialDepthTransform(i),
                animationDelay: `${i * 0.06}s`,
                border: `1px solid ${hsla(theme.colors.foreground, 0.12)}`,
              }}
            >
              <img src={card.src} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" draggable={false} />
            </div>
          ))}
        </div>
        <div
          className="absolute inset-0"
          style={{ backgroundImage: `radial-gradient(circle at center, ${hsla(theme.colors.background, 0.92)} 0%, ${hsla(theme.colors.background, 0.4)} 45%, transparent 75%)` }}
        />
      </div>

      <div
        className="relative z-10 mx-auto flex min-h-screen flex-col items-center justify-center text-center"
        style={{ maxWidth: theme.containerWidth, padding: theme.sectionPadding }}
      >
        {badge && (
          <span data-ut-slot="hero.badge" className="mb-6 text-xs uppercase tracking-[0.3em]" style={{ color: hsl(theme.colors.mutedForeground ?? theme.colors.foreground) }}>
            {badge}
          </span>
        )}
        {headline && (
          <h1 data-ut-slot="hero.headline" className="text-balance text-5xl font-semibold leading-[0.95] md:text-7xl lg:text-8xl" style={{ color: hsl(theme.colors.foreground) }}>
            {headline}
          </h1>
        )}
        {lead && (
          <p data-ut-slot="hero.subheadline" className="mt-6 max-w-xl text-base md:text-lg" style={{ color: hsla(theme.colors.foreground, 0.72) }}>
            {lead}
          </p>
        )}
        {ctas.length > 0 && (
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            {ctas.map((cta, index) => (
              <a
                key={`${cta.label}-${index}`}
                href={cta.href || '#'}
                data-ut-intent={cta.intent ?? 'nav.goto'}
                data-ut-cta={index === 0 ? 'cta.hero' : 'cta.hero-secondary'}
                className="inline-flex min-h-11 items-center rounded-full px-6 py-3 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                style={index === 0
                  ? { background: hsl(theme.colors.foreground), color: hsl(theme.colors.background) }
                  : { border: `1px solid ${hsla(theme.colors.foreground, 0.3)}`, color: hsl(theme.colors.foreground) }}
              >
                {cta.label}
              </a>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default HeroSpatialDepth;
