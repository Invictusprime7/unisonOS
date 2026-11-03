/** @jsxRuntime classic */
/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
// UNISON GENERATED UI FOUNDATION v1.12
import * as React from 'react';
import { cn } from './cn';
import * as __LucideIcons from 'lucide-react';
const __LucideFallback = (props) => React.createElement('svg', Object.assign({ viewBox: '0 0 24 24', width: 24, height: 24, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }, props), React.createElement('circle', { cx: 12, cy: 12, r: 10 }), React.createElement('line', { x1: 12, y1: 8, x2: 12, y2: 12 }), React.createElement('line', { x1: 12, y1: 16, x2: 12.01, y2: 16 }));
const Type = __LucideIcons['Type'] || __LucideFallback;
const Tag = __LucideIcons['Tag'] || __LucideFallback;

/**
 * COMPOSITION VOCABULARY — content.
 * Type sizes, tracking and transforms come from the sealed art-direction
 * tokens, so the same authored copy re-renders correctly under a new pack.
 */

export function Eyebrow({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn(
        'font-body text-xs font-semibold text-primary',
        'tracking-[var(--ut-eyebrow-tracking)] [text-transform:var(--ut-eyebrow-transform)]',
        className,
      )}
      {...props}
    />
  );
}

export type HeadingLevel = 1 | 2 | 3 | 4;
export type HeadingSize = 'hero' | 'display' | 'title' | 'subtitle';

const headingSize: Record<HeadingSize, string> = {
  hero: 'text-[length:var(--ut-type-hero)] leading-none font-[number:var(--ut-weight-display)]',
  display: 'text-[length:var(--ut-type-display)] leading-[var(--ut-display-leading)] font-[number:var(--ut-weight-display)]',
  title: 'text-[length:var(--ut-type-title)] leading-tight font-[number:var(--ut-weight-display)]',
  subtitle: 'text-xl font-[number:var(--ut-weight-display)] leading-snug',
};

export interface HeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
  level?: HeadingLevel;
  size?: HeadingSize;
  /** Fill the headline with the pack's gradient text recipe. */
  gradient?: boolean;
}

export function Heading({ level = 2, size = 'title', gradient = false, className, ...props }: HeadingProps) {
  const Tag = ('h' + level) as 'h1' | 'h2' | 'h3' | 'h4';
  return (
    <Tag
      className={cn(
        'font-heading text-foreground',
        'tracking-[var(--ut-heading-tracking)] [text-transform:var(--ut-heading-transform)]',
        headingSize[size],
        gradient && 'bg-[image:var(--ut-gradient-text)] bg-clip-text text-transparent',
        className,
      )}
      {...props}
    />
  );
}

export function Lead({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('font-body text-[length:var(--ut-type-lead)] leading-relaxed text-muted-foreground max-w-[var(--ut-measure)]', className)} {...props} />;
}

export function Body({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('font-body text-base leading-7 text-muted-foreground max-w-[var(--ut-measure)]', className)} {...props} />;
}

// Compatibility name used by previously generated pages.
export const Paragraph = Body;

export function Badge({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 border',
        'rounded-[var(--ut-pill-radius)] bg-[var(--ut-pill-fill)] border-[color:var(--ut-pill-stroke)] text-[color:var(--ut-pill-color)]',
        'p-[var(--ut-pill-padding)] tracking-[var(--ut-pill-tracking)] [text-transform:var(--ut-pill-transform)] font-[number:var(--ut-pill-weight)]',
        'text-xs',
        className,
      )}
      {...props}
    />
  );
}

export interface StatProps extends React.HTMLAttributes<HTMLDivElement> {
  value: React.ReactNode;
  label: React.ReactNode;
  hint?: React.ReactNode;
}

export function Stat({ value, label, hint, className, ...props }: StatProps) {
  return (
    <div className={cn('flex flex-col gap-1', className)} {...props}>
      <span className="font-heading text-[length:var(--ut-type-title)] font-[number:var(--ut-weight-display)] leading-none text-foreground">{value}</span>
      <span className="text-sm font-medium text-foreground">{label}</span>
      {hint && <span className="text-sm text-muted-foreground">{hint}</span>}
    </div>
  );
}

export interface QuoteProps extends React.HTMLAttributes<HTMLElement> {
  attribution?: React.ReactNode;
  role?: string;
  media?: React.ReactNode;
}

export function Quote({ attribution, role, media, className, children, ...props }: QuoteProps) {
  return (
    <figure className={cn('flex flex-col gap-[var(--ut-stack-gap)]', className)} {...props}>
      <blockquote className="font-heading text-[length:var(--ut-type-lead)] leading-relaxed text-foreground">{children}</blockquote>
      {(attribution || media) && (
        <figcaption className="flex items-center gap-3 text-sm">
          {media}
          <span className="flex flex-col">
            {attribution && <span className="font-medium text-foreground">{attribution}</span>}
            {role && <span className="text-muted-foreground">{role}</span>}
          </span>
        </figcaption>
      )}
    </figure>
  );
}

/** Groups primary/secondary actions with the pack's rhythm and wrapping. */
export function CTAGroup({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-wrap items-center gap-3', className)} {...props} />;
}

/** Heading cluster used at the top of a section: eyebrow + heading + lead. */
export interface SectionHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  lead?: React.ReactNode;
  align?: 'start' | 'center';
  level?: HeadingLevel;
  size?: HeadingSize;
}

export function SectionHeader({ eyebrow, title, lead, align = 'start', level = 2, size = 'title', className, ...props }: SectionHeaderProps) {
  return (
    <div className={cn('flex flex-col gap-3', align === 'center' && 'items-center text-center', className)} {...props}>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <Heading level={level} size={size}>{title}</Heading>
      {lead && <Lead className={cn(align === 'center' && 'mx-auto')}>{lead}</Lead>}
    </div>
  );
}
