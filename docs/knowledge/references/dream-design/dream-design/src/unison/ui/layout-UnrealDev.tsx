/** @jsxRuntime classic */
/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
// UNISON GENERATED UI FOUNDATION v1.12
import * as React from 'react';
import { cn } from './cn';
import * as __LucideIcons from 'lucide-react';
const __LucideFallback = (props) => React.createElement('svg', Object.assign({ viewBox: '0 0 24 24', width: 24, height: 24, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }, props), React.createElement('circle', { cx: 12, cy: 12, r: 10 }), React.createElement('line', { x1: 12, y1: 8, x2: 12, y2: 12 }), React.createElement('line', { x1: 12, y1: 16, x2: 12.01, y2: 16 }));
const Tag = __LucideIcons['Tag'] || __LucideFallback;

/**
 * COMPOSITION VOCABULARY — layout.
 * Every primitive consumes theme tokens. None accepts geometry or color
 * literals: pass `className` only for token-backed or standard-scale
 * utilities. This is what keeps an authored page correct under any style card.
 */

type Div = React.HTMLAttributes<HTMLDivElement>;

export type SectionTone = 'default' | 'muted' | 'accent' | 'gradient' | 'inverted';

const sectionTone: Record<SectionTone, string> = {
  default: 'bg-background text-foreground',
  muted: 'bg-muted text-foreground',
  accent: 'bg-accent text-accent-foreground',
  gradient: 'bg-[image:var(--ut-gradient-panel)] text-foreground',
  inverted: 'bg-primary text-primary-foreground',
};

export interface SectionProps extends React.HTMLAttributes<HTMLElement> {
  tone?: SectionTone;
  /** Renders the wash defined by the pack's accent policy behind the content. */
  wash?: boolean;
  /** Collapse the vertical rhythm (for tightly-paired bands). */
  flush?: boolean;
  as?: 'section' | 'header' | 'footer' | 'aside' | 'div';
}

export function Section({ tone = 'default', wash = false, flush = false, as: Tag = 'section', className, children, ...props }: SectionProps) {
  return (
    <Tag
      className={cn(
        'relative w-full',
        flush ? 'py-0' : 'py-[var(--ut-rhythm-space)]',
        sectionTone[tone],
        className,
      )}
      {...props}
    >
      {wash && <div aria-hidden className="pointer-events-none absolute inset-0 bg-[image:var(--ut-accent-wash)]" />}
      <div className="relative">{children}</div>
    </Tag>
  );
}

export type ContainerWidth = 'measure' | 'content' | 'wide' | 'full';

const containerWidth: Record<ContainerWidth, string> = {
  measure: 'max-w-[var(--ut-measure)]',
  content: 'max-w-[var(--ut-content-width)]',
  wide: 'max-w-[var(--ut-shell-width)]',
  full: 'max-w-none',
};

export function Container({ width = 'content', className, ...props }: Div & { width?: ContainerWidth }) {
  return <div className={cn('mx-auto w-full px-[var(--ut-inline-gutter)]', containerWidth[width], className)} {...props} />;
}

export type StackGap = 'tight' | 'block' | 'section';

const stackGap: Record<StackGap, string> = {
  tight: 'gap-[var(--ut-stack-gap)]',
  block: 'gap-[var(--ut-block-gap)]',
  section: 'gap-[var(--ut-rhythm-space)]',
};

export interface StackProps extends Div {
  gap?: StackGap;
  align?: 'start' | 'center' | 'end' | 'stretch';
  direction?: 'vertical' | 'horizontal';
  wrap?: boolean;
}

export function Stack({ gap = 'block', align = 'stretch', direction = 'vertical', wrap = false, className, ...props }: StackProps) {
  return (
    <div
      className={cn(
        'flex',
        direction === 'vertical' ? 'flex-col' : 'flex-row',
        wrap && 'flex-wrap',
        stackGap[gap],
        align === 'start' && 'items-start',
        align === 'center' && 'items-center',
        align === 'end' && 'items-end',
        className,
      )}
      {...props}
    />
  );
}

export interface GridProps extends Div {
  /** Column count at the large breakpoint. Responsive steps are automatic. */
  columns?: 2 | 3 | 4;
  gap?: StackGap;
}

const gridColumns: Record<2 | 3 | 4, string> = {
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-2 lg:grid-cols-3',
  4: 'sm:grid-cols-2 lg:grid-cols-4',
};

export function Grid({ columns = 3, gap = 'tight', className, ...props }: GridProps) {
  return <div className={cn('grid grid-cols-1', gridColumns[columns], stackGap[gap], className)} {...props} />;
}

export interface SplitProps extends Div {
  /** Flip the visual order without changing DOM/reading order. */
  reverse?: boolean;
  align?: 'start' | 'center';
}

export function Split({ reverse = false, align = 'center', className, children, ...props }: SplitProps) {
  const items = React.Children.toArray(children);
  return (
    <div
      className={cn(
        'grid grid-cols-1 lg:grid-cols-[var(--ut-hero-columns)]',
        'gap-[var(--ut-block-gap)]',
        align === 'center' ? 'items-center' : 'items-start',
        className,
      )}
      {...props}
    >
      {reverse ? [...items].reverse() : items}
    </div>
  );
}

/** Full-bleed band that escapes the container without breaking the rhythm. */
export function Bleed({ className, ...props }: Div) {
  return <div className={cn('relative w-full', className)} {...props} />;
}

/** Token-driven horizontal rule using the pack's divider gradient. */
export function Divider({ className, ...props }: Div) {
  return <div aria-hidden className={cn('h-px w-full bg-[image:var(--ut-gradient-divider)]', className)} {...props} />;
}
