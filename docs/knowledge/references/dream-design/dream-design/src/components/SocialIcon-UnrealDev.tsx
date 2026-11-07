/** @jsxRuntime classic */
/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
import React from 'react';
import { Instagram, Facebook, Twitter, Linkedin, Youtube, Github, Twitch, Dribbble, Figma, Globe } from '../unison/ui/icons';

export interface SocialIconProps {
  platform: string;
  size?: number;
  className?: string;
  color?: string;
}

const isComponent = (comp: any): boolean =>
  typeof comp === 'function' || (typeof comp === 'object' && comp !== null);

export function SocialIcon({ platform, size = 16, className, color }: SocialIconProps) {
  const key = String(platform || '').toLowerCase().trim();
  const common = { size, className, color, 'aria-hidden': true } as const;

  const fallbackGlobe = (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className} data-ut-source-locator="/src/components/SocialIcon.tsx:19:5" data-ut-source-ast="/src/components/SocialIcon.tsx#eda5b02e7b914542" data-ut-source-hash="ee497b3291e20c56">
      <circle cx="12" cy="12" r="10" data-ut-source-locator="/src/components/SocialIcon.tsx:20:7" data-ut-source-ast="/src/components/SocialIcon.tsx#68f110eca7800f60" data-ut-source-hash="ee497b3291e20c56"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" data-ut-source-locator="/src/components/SocialIcon.tsx:20:39" data-ut-source-ast="/src/components/SocialIcon.tsx#8fe75fe72fd9c663" data-ut-source-hash="ee497b3291e20c56"/><path d="M2 12h20" data-ut-source-locator="/src/components/SocialIcon.tsx:20:98" data-ut-source-ast="/src/components/SocialIcon.tsx#8fe75fe72fd9c663" data-ut-source-hash="ee497b3291e20c56"/>
    </svg>
  );

  const fallbackX = (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color || "currentColor"} aria-hidden="true" className={className} data-ut-source-locator="/src/components/SocialIcon.tsx:25:5" data-ut-source-ast="/src/components/SocialIcon.tsx#eda5b02e7b914542" data-ut-source-hash="ee497b3291e20c56"><path d="M18.244 2H21l-6.52 7.45L22 22h-6.83l-4.79-6.27L4.8 22H2l6.97-7.97L2 2h6.91l4.34 5.75L18.24 2zm-1.2 18h1.66L7.05 4H5.27l11.77 16z" data-ut-source-locator="/src/components/SocialIcon.tsx:25:129" data-ut-source-ast="/src/components/SocialIcon.tsx#8fe75fe72fd9c663" data-ut-source-hash="ee497b3291e20c56"/></svg>
  );

  const fallbackTikTok = (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color || "currentColor"} aria-hidden="true" className={className} data-ut-source-locator="/src/components/SocialIcon.tsx:29:5" data-ut-source-ast="/src/components/SocialIcon.tsx#eda5b02e7b914542" data-ut-source-hash="ee497b3291e20c56"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5.8 20.1a6.34 6.34 0 0 0 10.86-4.43V8.83a8.16 8.16 0 0 0 4.77 1.52V6.94a4.85 4.85 0 0 1-1.84-.25z" data-ut-source-locator="/src/components/SocialIcon.tsx:29:129" data-ut-source-ast="/src/components/SocialIcon.tsx#8fe75fe72fd9c663" data-ut-source-hash="ee497b3291e20c56"/></svg>
  );

  const fallbackPinterest = (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color || "currentColor"} aria-hidden="true" className={className} data-ut-source-locator="/src/components/SocialIcon.tsx:33:5" data-ut-source-ast="/src/components/SocialIcon.tsx#eda5b02e7b914542" data-ut-source-hash="ee497b3291e20c56"><path d="M12 0a12 12 0 0 0-4.37 23.17c-.06-.94-.11-2.38.02-3.4.12-.93 1.27-5.93 1.27-5.93s-.32-.65-.32-1.6c0-1.5.87-2.62 1.95-2.62.92 0 1.36.69 1.36 1.51 0 .92-.59 2.3-.89 3.58-.25 1.07.54 1.95 1.6 1.95 1.92 0 3.4-2.03 3.4-4.95 0-2.59-1.86-4.4-4.52-4.4-3.08 0-4.89 2.31-4.89 4.7 0 .93.36 1.93.81 2.47.09.11.1.2.07.32-.08.34-.27 1.07-.31 1.22-.05.2-.16.24-.37.15-1.38-.64-2.25-2.66-2.25-4.28 0-3.49 2.53-6.69 7.3-6.69 3.83 0 6.81 2.73 6.81 6.38 0 3.81-2.4 6.87-5.74 6.87-1.12 0-2.18-.58-2.54-1.27 0 0-.55 2.11-.69 2.62-.25.96-.93 2.17-1.39 2.9A12 12 0 1 0 12 0z" data-ut-source-locator="/src/components/SocialIcon.tsx:33:129" data-ut-source-ast="/src/components/SocialIcon.tsx#8fe75fe72fd9c663" data-ut-source-hash="ee497b3291e20c56"/></svg>
  );

  const fallbackGithub = (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className} data-ut-source-locator="/src/components/SocialIcon.tsx:37:5" data-ut-source-ast="/src/components/SocialIcon.tsx#eda5b02e7b914542" data-ut-source-hash="ee497b3291e20c56"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" data-ut-source-locator="/src/components/SocialIcon.tsx:37:204" data-ut-source-ast="/src/components/SocialIcon.tsx#8fe75fe72fd9c663" data-ut-source-hash="ee497b3291e20c56"/><path d="M9 18c-4.51 2-5-2-7-2" data-ut-source-locator="/src/components/SocialIcon.tsx:37:464" data-ut-source-ast="/src/components/SocialIcon.tsx#8fe75fe72fd9c663" data-ut-source-hash="ee497b3291e20c56"/></svg>
  );

  const fallbackLinkedin = (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className} data-ut-source-locator="/src/components/SocialIcon.tsx:41:5" data-ut-source-ast="/src/components/SocialIcon.tsx#eda5b02e7b914542" data-ut-source-hash="ee497b3291e20c56"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" data-ut-source-locator="/src/components/SocialIcon.tsx:41:204" data-ut-source-ast="/src/components/SocialIcon.tsx#8fe75fe72fd9c663" data-ut-source-hash="ee497b3291e20c56"/><rect width="4" height="12" x="2" y="9" data-ut-source-locator="/src/components/SocialIcon.tsx:41:294" data-ut-source-ast="/src/components/SocialIcon.tsx#bc8d05fee48fde82" data-ut-source-hash="ee497b3291e20c56"/><circle cx="4" cy="4" r="2" data-ut-source-locator="/src/components/SocialIcon.tsx:41:335" data-ut-source-ast="/src/components/SocialIcon.tsx#68f110eca7800f60" data-ut-source-hash="ee497b3291e20c56"/></svg>
  );

  const fallbackTwitter = (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className} data-ut-source-locator="/src/components/SocialIcon.tsx:45:5" data-ut-source-ast="/src/components/SocialIcon.tsx#eda5b02e7b914542" data-ut-source-hash="ee497b3291e20c56"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" data-ut-source-locator="/src/components/SocialIcon.tsx:45:204" data-ut-source-ast="/src/components/SocialIcon.tsx#8fe75fe72fd9c663" data-ut-source-hash="ee497b3291e20c56"/></svg>
  );

  if (key === 'instagram' || key === 'ig') return isComponent(Instagram) ? <Instagram {...common} /> : fallbackGlobe;
  if (key === 'facebook' || key === 'fb' || key === 'meta') return isComponent(Facebook) ? <Facebook {...common} /> : fallbackGlobe;
  if (key === 'twitter') return isComponent(Twitter) ? <Twitter {...common} /> : fallbackTwitter;
  if (key === 'x' || key === 'x.com') return fallbackX;
  if (key === 'linkedin' || key === 'in') return isComponent(Linkedin) ? <Linkedin {...common} /> : fallbackLinkedin;
  if (key === 'youtube' || key === 'yt') return isComponent(Youtube) ? <Youtube {...common} /> : fallbackGlobe;
  if (key === 'github' || key === 'gh') return isComponent(Github) ? <Github {...common} /> : fallbackGithub;
  if (key === 'twitch') return isComponent(Twitch) ? <Twitch {...common} /> : fallbackGlobe;
  if (key === 'dribbble') return isComponent(Dribbble) ? <Dribbble {...common} /> : fallbackGlobe;
  if (key === 'figma') return isComponent(Figma) ? <Figma {...common} /> : fallbackGlobe;
  if (key === 'tiktok') return fallbackTikTok;
  if (key === 'pinterest') return fallbackPinterest;
  return isComponent(Globe) ? <Globe {...common} /> : fallbackGlobe;
}

export function socialAriaLabel(platform: string): string {
  const key = String(platform || '').toLowerCase().trim();
  if (!key) return 'Social link';
  return 'Visit our ' + key.charAt(0).toUpperCase() + key.slice(1) + ' page';
}

export default SocialIcon;
