/**
 * Logo Cloud Variant: Marquee
 * Continuous horizontal band of marks; duplicated track keeps the loop seamless.
 */

import React from 'react';
import type { BaseSectionProps } from '../../types';
import { LogoCloudFrame, LogoMark, normalizeLogos } from './LogoCloudFrame';

export const LogoCloudMarquee: React.FC<BaseSectionProps<'logo-cloud'>> = ({ section, theme }) => {
  const logos = normalizeLogos(section.props.logos, (section.props as { items?: unknown }).items);
  if (!logos.length) return null;
  const track = logos.length ? [...logos, ...logos] : [];

  return (
    <LogoCloudFrame
      variantId="logo-cloud:marquee"
      theme={theme}
      headline={section.props.headline}
      surface="background"
    >
      <div style={{ overflow: 'hidden', maskImage: 'linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)' }}>
        <div
          className="ut-logo-marquee flex w-max items-center gap-10 md:gap-16"
        >
          {track.map((logo, i) => (
            <div key={i} aria-hidden={i >= logos.length || undefined} className={`flex shrink-0 items-center${i >= logos.length ? ' ut-logo-dup' : ''}`} style={{ opacity: 0.75 }}>
              <LogoMark theme={theme} logo={logo} />
            </div>
          ))}
        </div>
      </div>
      <style>{'@keyframes ut-logo-marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}@media (prefers-reduced-motion: no-preference){.ut-logo-marquee{animation:ut-logo-marquee 28s linear infinite}}@media (prefers-reduced-motion: reduce){.ut-logo-marquee{flex-wrap:wrap;width:auto;justify-content:center}.ut-logo-dup{display:none}}'}</style>
    </LogoCloudFrame>
  );
};
