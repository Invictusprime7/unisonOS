/** @jsxRuntime classic */
/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
// UNISON GENERATED UI FOUNDATION v1.12
import * as React from 'react';
import { motion, useReducedMotion } from './animation';
import { Image } from './media';
import { cn } from './cn';
import * as __LucideIcons from 'lucide-react';
const __LucideFallback = (props) => React.createElement('svg', Object.assign({ viewBox: '0 0 24 24', width: 24, height: 24, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }, props), React.createElement('circle', { cx: 12, cy: 12, r: 10 }), React.createElement('line', { x1: 12, y1: 8, x2: 12, y2: 12 }), React.createElement('line', { x1: 12, y1: 16, x2: 12.01, y2: 16 }));
const Film = __LucideIcons['Film'] || __LucideFallback;

/**
 * COMPOSITION VOCABULARY — decorative backgrounds.
 * 21st-derived backdrop primitives, normalized to Stage 4b tokens: every
 * color is a semantic HSL token and every duration/easing comes from the
 * pack's motion tokens. All are aria-hidden, pointer-events-none layers;
 * place one as the first child of a relative <Section>. Reduced motion
 * freezes every animated layer in its final visible state.
 */

export interface BackdropProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 0–1 layer opacity multiplier; defaults to the subtle band strength. */
  intensity?: number;
}

function BackdropLayer({ className, intensity, ...props }: BackdropProps) {
  return (
    <div
      aria-hidden
      className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
      style={intensity !== undefined ? { opacity: intensity } : undefined}
      {...props}
    />
  );
}

/** Slow conic orbital rings radiating from the pack's primary/accent tokens. */
export function OrbitalBackdrop({ className, ...props }: BackdropProps) {
  const reduceMotion = useReducedMotion();
  return (
    <BackdropLayer className={className} {...props}>
      <motion.div
        className="absolute left-1/2 top-1/2 size-[var(--ut-hero-block)] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[color:hsl(var(--primary)/0.18)]"
        animate={reduceMotion ? undefined : { rotate: 360 }}
        transition={reduceMotion ? undefined : { duration: 60, ease: 'linear', repeat: Infinity }}
      />
      <motion.div
        className="absolute left-1/2 top-1/2 size-[calc(var(--ut-hero-block)*0.66)] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-[color:hsl(var(--accent)/0.22)]"
        animate={reduceMotion ? undefined : { rotate: -360 }}
        transition={reduceMotion ? undefined : { duration: 45, ease: 'linear', repeat: Infinity }}
      />
      <div className="absolute left-1/2 top-1/2 size-[calc(var(--ut-hero-block)*0.33)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle_at_center,hsl(var(--primary)/0.14),transparent_70%)]" />
    </BackdropLayer>
  );
}

/** Soft radial token glows anchored to the band corners. */
export function GlowField({ className, ...props }: BackdropProps) {
  return (
    <BackdropLayer className={className} {...props}>
      <div className="absolute -left-24 -top-24 size-[var(--ut-hero-media-max)] rounded-full bg-[radial-gradient(circle_at_center,hsl(var(--primary)/0.22),transparent_70%)] blur-3xl" />
      <div className="absolute -bottom-24 -right-24 size-[var(--ut-hero-media-max)] rounded-full bg-[radial-gradient(circle_at_center,hsl(var(--accent)/0.18),transparent_70%)] blur-3xl" />
    </BackdropLayer>
  );
}

/** Drifting blueprint grid drawn from the border token. */
export function AnimatedGrid({ className, ...props }: BackdropProps) {
  const reduceMotion = useReducedMotion();
  return (
    <BackdropLayer className={className} {...props}>
      <motion.div
        className="absolute -inset-16 bg-[linear-gradient(to_right,hsl(var(--border)/0.5)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border)/0.5)_1px,transparent_1px)] bg-[size:3rem_3rem] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]"
        animate={reduceMotion ? undefined : { x: [0, 48], y: [0, 48] }}
        transition={reduceMotion ? undefined : { duration: 24, ease: 'linear', repeat: Infinity }}
      />
    </BackdropLayer>
  );
}

const NOISE_TEXTURE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")";

/** Film-grain texture that adds depth without introducing new color. */
export function NoiseField({ className, ...props }: BackdropProps) {
  return (
    <BackdropLayer className={className} {...props}>
      <div
        className="absolute inset-0 opacity-[0.06] mix-blend-overlay"
        style={{ backgroundImage: NOISE_TEXTURE }}
      />
    </BackdropLayer>
  );
}

/** Floating blurred orbs in the pack's primary/accent/secondary tokens. */
export function GradientOrbs({ className, ...props }: BackdropProps) {
  const reduceMotion = useReducedMotion();
  const float = (delay: number) =>
    reduceMotion
      ? {}
      : {
          animate: { y: [0, -18, 0] },
          transition: { duration: 9, ease: 'easeInOut', repeat: Infinity, delay },
        };
  return (
    <BackdropLayer className={className} {...props}>
      <motion.div className="absolute left-[8%] top-[12%] size-[var(--ut-hero-media-block)] rounded-full bg-primary/25 blur-3xl" {...float(0)} />
      <motion.div className="absolute right-[10%] top-[30%] size-[var(--ut-media-block-lg)] rounded-full bg-accent/25 blur-3xl" {...float(1.4)} />
      <motion.div className="absolute bottom-[8%] left-[35%] size-[var(--ut-tile-block)] rounded-full bg-secondary/40 blur-3xl" {...float(2.8)} />
    </BackdropLayer>
  );
}

export interface MediaCanvasProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  src: string;
  alt: string;
  /** Paint the pack's hero gradient over the media for legible overlay copy. */
  overlay?: boolean;
}

/** Full-bleed media backdrop with the pack's hero gradient scrim. */
export function MediaCanvas({ src, alt, overlay = true, className, ...props }: MediaCanvasProps) {
  return (
    <div aria-hidden className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)} {...props}>
      <Image src={src} alt={alt} priority className="absolute inset-0 h-full w-full object-cover" />
      {overlay && <div className="absolute inset-0 bg-[image:var(--ut-gradient-hero)] opacity-70" />}
    </div>
  );
}
