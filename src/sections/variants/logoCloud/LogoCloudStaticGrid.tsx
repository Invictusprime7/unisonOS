import React from 'react';
import type { BaseSectionProps } from '../../types';
import { hsl } from '../../themeUtils';
import { LogoCloudFrame, LogoMark, normalizeLogos } from './LogoCloudFrame';
/** Unison original, inspired by the 21st.dev listing "Logo Cloud 3 / 4 — Efferd" (layout idea only; no third-party code). */
export const LogoCloudStaticGrid: React.FC<BaseSectionProps<'logo-cloud'>> = ({section,theme}) => {
  const logos = normalizeLogos(section.props.logos);
  if (!logos.length) return null;
  return <LogoCloudFrame variantId="logo-cloud:static-grid" theme={theme} headline={section.props.headline}>
    <ul className="grid grid-cols-2 items-center gap-x-8 gap-y-10 sm:grid-cols-3 lg:grid-cols-6">{logos.map((l,i)=><li key={i} className="flex justify-center"><LogoMark theme={theme} logo={l} height="1.75rem" /></li>)}</ul>
  </LogoCloudFrame>;
};
