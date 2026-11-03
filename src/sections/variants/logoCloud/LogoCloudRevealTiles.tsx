import React from 'react';
import type { BaseSectionProps } from '../../types';
import { hsl } from '../../themeUtils';
import { LogoCloudFrame, LogoMark, normalizeLogos } from './LogoCloudFrame';
/** Original canonical logo tiles informed by 21st:18216; no demo marks or timer loop. */
export const LogoCloudRevealTiles: React.FC<BaseSectionProps<'logo-cloud'>> = ({section,theme}) => {
 const logos = normalizeLogos(section.props.logos,(section.props as {items?:unknown}).items);
 if (!logos.length) return null;
 return <LogoCloudFrame variantId="logo-cloud:reveal-tiles" theme={theme} headline={section.props.headline}>
 <div className="grid grid-cols-2 gap-px sm:grid-cols-3 lg:grid-cols-6" style={{background:hsl(theme.colors.border)}}>{logos.map((logo,i)=><div key={i} className="flex min-h-24 items-center justify-center px-5 py-7" style={{background:hsl(theme.colors.background)}}><div className="transition-transform hover:scale-105 motion-reduce:transform-none motion-reduce:transition-none"><LogoMark theme={theme} logo={logo}/></div></div>)}</div>
 </LogoCloudFrame>;
};
