/** @jsxRuntime classic */
/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
import * as React from 'react';
// UNISON GENERATED UI FOUNDATION v1.12
  import type { LucideIcon } from './icons';
import { cn } from './cn';

export function Icon({ icon: Glyph, className, label }: { icon: LucideIcon; className?: string; label?: string }) {
  return <Glyph aria-hidden={label ? undefined : true} aria-label={label} role={label ? 'img' : undefined} className={cn('size-4 shrink-0', className)} />;
}
