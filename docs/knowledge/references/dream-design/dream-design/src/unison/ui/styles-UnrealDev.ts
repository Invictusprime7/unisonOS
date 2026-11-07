/** @jsxRuntime classic */
/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
import * as React from 'react';
// UNISON GENERATED UI FOUNDATION v1.12
import { cn } from './cn';

export const typography = {
  display: 'font-heading headline-xl text-foreground',
  heading: 'font-heading headline-lg text-foreground',
  subheading: 'font-heading headline-md text-foreground',
  body: 'font-body body-md text-muted-foreground',
  lead: 'font-body body-lg text-muted-foreground',
  eyebrow: 'font-body text-xs font-semibold uppercase tracking-[0.16em] text-primary',
} as const;

export const colorStyles = {
  page: 'bg-background text-foreground',
  surface: 'border border-border bg-card text-card-foreground shadow-sm',
  muted: 'bg-muted text-muted-foreground',
  accent: 'bg-accent text-accent-foreground',
  primary: 'bg-primary text-primary-foreground',
  secondary: 'bg-secondary text-secondary-foreground',
} as const;

export const componentStyles = {
  section: 'px-5 py-16 sm:px-8 lg:py-24',
  container: 'mx-auto w-full max-w-6xl',
  card: 'ut-foundation-card bg-card text-card-foreground',
  interactiveCard: 'ut-foundation-card bg-card text-card-foreground focus-within:ring-2 focus-within:ring-ring',
  button: 'inline-flex min-h-10 items-center justify-center gap-2 rounded-[var(--ut-control-radius)] px-4 py-2 font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
} as const;

export const motionStyles = {
  fade: 'motion-safe:transition-opacity motion-safe:duration-300',
  lift: 'motion-safe:transition-transform motion-safe:duration-300 motion-safe:hover:-translate-y-1',
  scale: 'motion-safe:transition-transform motion-safe:duration-300 motion-safe:hover:scale-[1.02]',
  attention: 'motion-safe:animate-pulse',
} as const;

export function styles(...classNames: Array<string | false | null | undefined>) {
  return cn(...classNames);
}
