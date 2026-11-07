/** @jsxRuntime classic */
/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
// UNISON GENERATED UI FOUNDATION v1.12
import * as React from 'react';
import { Image } from './media';
import { cn } from './cn';

/**
 * COMPOSITION VOCABULARY — surfaces and media.
 * Fill, stroke, elevation, radius and media filtering all come from the
 * pack's surface + media treatment tokens.
 */

type Div = React.HTMLAttributes<HTMLDivElement>;

export type PanelTone = 'surface' | 'gradient' | 'outline' | 'plain';

export interface PanelProps extends Div {
  tone?: PanelTone;
  /** Marks a surface as interactive without prescribing motion or geometry. */
  interactive?: boolean;
  padded?: boolean;
}

const panelTone: Record<PanelTone, string> = {
  surface: 'bg-[var(--ut-surface-fill)] border-[color:var(--ut-surface-stroke)] shadow-[var(--ut-surface-elevation)]',
  gradient: 'bg-[image:var(--ut-gradient-panel)] border-[color:var(--ut-surface-stroke)]',
  outline: 'bg-transparent border-border',
  plain: 'bg-transparent border-transparent',
};

export function Panel({ tone = 'surface', interactive = false, padded = true, className, ...props }: PanelProps) {
  return (
    <div
      className={cn(
        'border border-[length:var(--ut-border-weight)] rounded-[var(--ut-radius-lg)]',
        panelTone[tone],
        padded && 'p-[var(--ut-card-padding)]',
        interactive && 'cursor-pointer',
        className,
      )}
      {...props}
    />
  );
}

export interface MediaFrameProps extends React.HTMLAttributes<HTMLDivElement> {
  src: string;
  alt: string;
  /** Aspect ratio token to honour. Defaults to the pack's media ratio. */
  ratio?: 'media' | 'hero' | 'square';
  loading?: 'lazy' | 'eager';
  overlay?: React.ReactNode;
}

const mediaRatio = {
  media: 'aspect-[var(--ut-media-ratio)]',
  hero: 'aspect-[var(--ut-hero-media-ratio)]',
  square: 'aspect-square',
} as const;

export function MediaFrame({ src, alt, ratio = 'media', loading = 'lazy', overlay, className, ...props }: MediaFrameProps) {
  return (
    <div
      className={cn(
        'relative w-full overflow-hidden rounded-[var(--ut-media-frame-radius)]',
        mediaRatio[ratio],
        className,
      )}
      {...props}
    >
      <Image src={src} alt={alt} loading={loading} className="size-full object-cover [filter:var(--ut-media-filter)]" />
      {overlay && <div className="absolute inset-0">{overlay}</div>}
    </div>
  );
}

/** A card built from the vocabulary: media, header cluster and actions. */
export interface FeaturePanelProps extends Omit<PanelProps, 'title'> {
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  media?: React.ReactNode;
  actions?: React.ReactNode;
}

export function FeaturePanel({ title, description, icon, media, actions, className, ...props }: FeaturePanelProps) {
  return (
    <Panel interactive className={cn('flex h-full flex-col gap-[var(--ut-stack-gap)]', className)} {...props}>
      {media}
      {icon && <span className="inline-flex size-11 items-center justify-center rounded-[var(--ut-radius-base)] bg-accent text-accent-foreground">{icon}</span>}
      <div className="flex flex-col gap-2">
        <h3 className="font-heading text-lg font-[number:var(--ut-weight-display)] text-foreground">{title}</h3>
        {description && <p className="text-sm leading-6 text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="mt-auto flex flex-wrap gap-2 pt-2">{actions}</div>}
    </Panel>
  );
}
