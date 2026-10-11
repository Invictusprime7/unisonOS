/**
 * Hero Variant: Tunnel Immersive
 *
 * Adapted from the 21st.dev community component "Tunnel Hero" (21st:6588,
 * @m.umairwaheedansari). The raw three.js shader canvas was NOT carried over:
 * the WebGL tunnel is delivered by the canonical experience layer
 * (`SceneBackground variant="tunnel"` via the scene-backdrop enhancement),
 * which owns device checks, canvas budgets and fallbacks. This component is
 * the always-safe DOM layer: concentric CSS rings receding into depth,
 * theme-token colours, paused under `prefers-reduced-motion`, and canonical
 * `data-ut-*` slots.
 *
 * Provenance is recorded on the registry entry (`source`), never at runtime.
 */

import React from 'react';
import type { BaseSectionProps } from '../../types';
import { hsl, hsla } from '../../themeUtils';

const RINGS = 9;

const tunnelStyles = `
@keyframes ut-tunnel-recede {
  from { transform: translate(-50%, -50%) scale(1.6); opacity: 0; }
  20%  { opacity: 1; }
  to   { transform: translate(-50%, -50%) scale(0.05); opacity: 0; }
}
[data-ut-variant="hero:tunnel-immersive"] [data-ut-ring] {
  animation: ut-tunnel-recede 9s linear infinite;
}
@media (prefers-reduced-motion: reduce) {
  [data-ut-variant="hero:tunnel-immersive"] [data-ut-ring] { animation: none; opacity: 0.5; }
}
`;

export const HeroTunnelImmersive: React.FC<BaseSectionProps<'hero'>> = ({ section, theme }) => {
  const { headline, subheadline, description, ctas = [], badge } = section.props;
  const lead = subheadline || description;

  return (
    <section
      data-ut-variant="hero:tunnel-immersive"
      data-ut-slot="hero"
      className="relative w-full overflow-hidden"
      style={{ background: hsl(theme.colors.foreground), minHeight: '100vh' }}
    >
      <style>{tunnelStyles}</style>
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {Array.from({ length: RINGS }, (_, index) => (
          <span
            key={index}
            data-ut-ring
            className="absolute left-1/2 top-1/2 aspect-square w-[140vmax] rounded-full"
            style={{
              border: `1px dashed ${hsla(theme.colors.background, 0.35)}`,
              animationDelay: `-${(index * 9) / RINGS}s`,
              transform: `translate(-50%, -50%) scale(${1 - index / RINGS})`,
            }}
          />
        ))}
        <div
          className="absolute inset-0"
          style={{ backgroundImage: `radial-gradient(circle at center, transparent 0%, ${hsla(theme.colors.foreground, 0.85)} 70%)` }}
        />
      </div>

      <div
        className="relative z-10 mx-auto flex min-h-screen flex-col items-center justify-center text-center"
        style={{ maxWidth: theme.containerWidth, padding: theme.sectionPadding }}
      >
        {badge && (
          <span data-ut-slot="hero.badge" className="mb-6 text-xs uppercase tracking-[0.3em]" style={{ color: hsla(theme.colors.background, 0.7) }}>
            {badge}
          </span>
        )}
        {headline && (
          <h1 data-ut-slot="hero.headline" className="text-balance text-5xl font-semibold leading-[0.95] md:text-7xl lg:text-8xl" style={{ color: hsl(theme.colors.background) }}>
            {headline}
          </h1>
        )}
        {lead && (
          <p data-ut-slot="hero.subheadline" className="mt-6 max-w-xl text-base md:text-lg" style={{ color: hsla(theme.colors.background, 0.75) }}>
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
                className="inline-flex items-center rounded-full px-6 py-3 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                style={index === 0
                  ? { background: hsl(theme.colors.background), color: hsl(theme.colors.foreground) }
                  : { border: `1px solid ${hsla(theme.colors.background, 0.5)}`, color: hsl(theme.colors.background) }}
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

export default HeroTunnelImmersive;
