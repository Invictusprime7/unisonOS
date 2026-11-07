/** @jsxRuntime classic */
/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
// UNISON GENERATED UI FOUNDATION v1.12
import * as React from 'react';
import { cn } from '../cn';

type Tone = 'default' | 'muted' | 'primary' | 'destructive';

const tones: Record<Tone, string> = {
  default: 'border-border bg-card text-card-foreground',
  muted: 'border-border bg-muted text-foreground',
  primary: 'border-primary/40 bg-primary/10 text-foreground',
  destructive: 'border-destructive/40 bg-destructive/10 text-foreground',
};

export function Alert({ tone = 'default', className, ...props }: React.HTMLAttributes<HTMLDivElement> & { tone?: Tone }) {
  return <div role="status" className={cn('w-full rounded-[var(--radius)] border p-4', tones[tone], className)} {...props} />;
}

export function AlertTitle({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('mb-1 font-semibold leading-none tracking-tight', className)} {...props} />;
}

export function AlertDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-sm text-muted-foreground', className)} {...props} />;
}
