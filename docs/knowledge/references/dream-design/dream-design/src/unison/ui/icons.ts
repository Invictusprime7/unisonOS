/** @jsxRuntime classic */
/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
// UNISON GENERATED UI FOUNDATION v1.12
import * as React from 'react';
import * as Lucide from 'lucide-react';

export * from 'lucide-react';

type IconComponent = React.ComponentType<React.SVGProps<SVGSVGElement>>;

const MissingBrandIcon: IconComponent = (props) => React.createElement(
  'svg',
  { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, ...props },
  React.createElement('circle', { cx: 12, cy: 12, r: 9 }),
  React.createElement('path', { d: 'M8 12h8M12 8v8' }),
);

const brandIcon = (name: string): IconComponent => (
  (Lucide as Record<string, IconComponent | undefined>)[name] || MissingBrandIcon
);

// Sandpack's Lucide runtime omits brand marks; generated social links must still render.
export const Instagram = brandIcon('Instagram');
export const Facebook = brandIcon('Facebook');
export const Linkedin = brandIcon('Linkedin');
export const Youtube = brandIcon('Youtube');
export const Twitter = brandIcon('Twitter');
export const Github = brandIcon('Github');
export const Twitch = brandIcon('Twitch');
export const Dribbble = brandIcon('Dribbble');
export const Figma = brandIcon('Figma');
export const Globe = brandIcon('Globe');
