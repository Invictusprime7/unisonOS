/** @jsxRuntime classic */
/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
// UNISON GENERATED UI FOUNDATION v1.12
import * as React from 'react';
import { ResponsiveContainer } from 'recharts';
import { cn } from '../cn';

export * from 'recharts';

/** Chart series read theme tokens; charts never carry literal colors. */
export const CHART_SERIES_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
] as const;

export function ChartContainer({ className, children, label }: { className?: string; children: React.ReactElement; label?: string }) {
  return (
    <figure aria-label={label} className={cn('h-[var(--ut-media-block)] w-full', className)}>
      <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
    </figure>
  );
}

export function ChartTooltipContent({ active, payload, label }: { active?: boolean; payload?: Array<{ name?: string; value?: number | string }>; label?: React.ReactNode }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-[var(--radius)] border border-border bg-card px-3 py-2 text-xs text-card-foreground shadow-sm">
      {label ? <div className="mb-1 font-semibold">{label}</div> : null}
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-2">
          <span className="text-muted-foreground">{entry.name}</span>
          <span className="font-medium">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}
