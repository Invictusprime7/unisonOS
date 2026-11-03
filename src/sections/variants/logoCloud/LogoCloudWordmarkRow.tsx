/**
 * Logo Cloud Variant: Wordmark Row
 *
 * Adapted from the trust row of the 21st.dev community component
 * "Product Hero with Demo Panel" (21st:26630): a quiet, rule-topped band of
 * centred wordmarks. Normalized to the Unison runtime — no `motion/react`,
 * no `react-wrap-balancer`, no shadcn registry imports — with every value
 * rebound to Stage 4b semantic theme tokens.
 *
 * Provenance is recorded on the registry entry (`source`), never at runtime.
 */

import React from 'react';
import type { BaseSectionProps } from '../../types';
import { LogoCloudFrame, LogoMark, normalizeLogos } from './LogoCloudFrame';
import { hsl } from '../../themeUtils';

export const LogoCloudWordmarkRow: React.FC<BaseSectionProps<'logo-cloud'>> = ({ section, theme }) => {
  const logos = normalizeLogos(section.props.logos, (section.props as { items?: unknown }).items);
  if (!logos.length) return null;

  return (
    <LogoCloudFrame variantId="logo-cloud:wordmark-row" theme={theme} headline={section.props.headline}>
      <div
        className="flex w-full flex-wrap items-center justify-center gap-x-10 gap-y-4 pt-8 sm:pt-10"
        style={{ borderTop: `1px solid ${hsl(theme.colors.border)}` }}
      >
        {logos.map((logo, i) => (
          <div key={i} className="flex items-center justify-center opacity-70">
            <LogoMark theme={theme} logo={logo} height="1.5rem" />
          </div>
        ))}
      </div>
    </LogoCloudFrame>
  );
};
