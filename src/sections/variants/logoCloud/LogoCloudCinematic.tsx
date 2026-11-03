import React from 'react';
import type { BaseSectionProps } from '../../types';
import { hsl } from '../../themeUtils';
import { LogoCloudFrame, LogoMark, normalizeLogos } from './LogoCloudFrame';
/** Unison original, inspired by the 21st.dev listing "Cinematic Logo Cloud — nexus-ui" (layout idea only; no third-party code). */
export const LogoCloudCinematic: React.FC<BaseSectionProps<'logo-cloud'>> = ({section,theme}) => {
  const logos = normalizeLogos(section.props.logos);
  if (!logos.length) return null;
  return <LogoCloudFrame variantId="logo-cloud:cinematic" theme={theme} headline={section.props.headline} surface="background">
    <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4" style={{borderTop:`1px solid ${hsl(theme.colors.border)}`,borderLeft:`1px solid ${hsl(theme.colors.border)}`}}>
      {logos.map((l,i)=><li key={i} className="group flex h-24 items-center justify-center md:h-32" style={{borderRight:`1px solid ${hsl(theme.colors.border)}`,borderBottom:`1px solid ${hsl(theme.colors.border)}`}}><span className="opacity-50 grayscale motion-safe:transition-[opacity,filter] motion-safe:duration-500 group-hover:opacity-100 group-hover:grayscale-0"><LogoMark theme={theme} logo={l} /></span></li>)}
    </ul></LogoCloudFrame>;
};
