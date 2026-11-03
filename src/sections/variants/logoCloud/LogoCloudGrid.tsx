/**
 * Logo Cloud Variant: Grid
 * Even, quiet grid of partner marks — the dependable default.
 */

import React from 'react';
import type { BaseSectionProps } from '../../types';
import { LogoCloudFrame, LogoMark, normalizeLogos } from './LogoCloudFrame';
import { hsl } from '../../themeUtils';

export const LogoCloudGrid: React.FC<BaseSectionProps<'logo-cloud'>> = ({ section, theme }) => {
  const logos = normalizeLogos(section.props.logos, (section.props as { items?: unknown }).items);
  if (!logos.length) return null;

  return (
    <LogoCloudFrame variantId="logo-cloud:grid" theme={theme} headline={section.props.headline}>
      <div className="grid grid-cols-2 items-center gap-8 sm:grid-cols-3 md:grid-cols-5">
        {logos.map((logo, i) => (
          <div
            key={i}
            className="flex items-center justify-center py-4"
            style={{ borderRadius: theme.radius, border: `1px solid ${hsl(theme.colors.border)}` }}
          >
            <LogoMark theme={theme} logo={logo} />
          </div>
        ))}
      </div>
    </LogoCloudFrame>
  );
};
