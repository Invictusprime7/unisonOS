/** @jsxRuntime classic */
/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
// UNISON GENERATED UI FOUNDATION v1.12
import * as React from 'react';
import { Card, CardContent } from './card';
import { cn } from './cn';

export function BentoFeatureGrid({ children, className }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('grid gap-4 sm:grid-cols-2 lg:grid-cols-3', className)}>{children}</div>;
}

export function FeatureCard({ title, description, media, className }: { title: string; description: string; media?: React.ReactNode; className?: string }) {
  return <Card className={cn('min-h-56 overflow-hidden', className)}><CardContent className="flex h-full flex-col gap-4">{media}<div className="mt-auto"><h3 className="text-lg font-[number:var(--ut-weight-display)]">{title}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p></div></CardContent></Card>;
}
