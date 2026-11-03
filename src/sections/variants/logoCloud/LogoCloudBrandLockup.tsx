/**
 * Logo Cloud Variant: Brand Lockup
 * Statement line locked beside the marks — reads as endorsement, not wallpaper.
 */

import React from 'react';
import type { BaseSectionProps } from '../../types';
import { LogoCloudFrame, LogoMark, normalizeLogos } from './LogoCloudFrame';
import { hsl } from '../../themeUtils';

export const LogoCloudBrandLockup: React.FC<BaseSectionProps<'logo-cloud'>> = ({ section, theme }) => {
  const logos = normalizeLogos(section.props.logos, (section.props as { items?: unknown }).items);
  if (!logos.length) return null;

  return (
    <LogoCloudFrame variantId="logo-cloud:brand-lockup" theme={theme}>
      <div className="grid items-center gap-10 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
        <p
          className="text-2xl"
          style={{
            fontFamily: theme.typography.headingFont,
            fontWeight: theme.typography.headingWeight,
            color: hsl(theme.colors.foreground),
          }}
        >
          {section.props.headline}
        </p>
        <div className="grid grid-cols-2 gap-x-10 gap-y-6 sm:grid-cols-3">
          {logos.map((logo, i) => (
            <div
              key={i}
              className="flex items-center justify-start"
              style={{ paddingBottom: '0.75rem', borderBottom: `1px solid ${hsl(theme.colors.border)}` }}
            >
              <LogoMark theme={theme} logo={logo} height="1.75rem" />
            </div>
          ))}
        </div>
      </div>
    </LogoCloudFrame>
  );
};
