/** @jsxRuntime classic */
/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
// UNISON GENERATED UI FOUNDATION v1.12
import * as React from 'react';
import { DayPicker } from 'react-day-picker';
import { cn } from '../cn';

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

export function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('rounded-[var(--radius)] border border-border bg-card p-3 text-card-foreground', className)}
      classNames={{
        months: 'flex flex-col gap-4',
        month_caption: 'flex items-center justify-center py-2 font-semibold',
        weekday: 'text-xs font-medium text-muted-foreground',
        day_button: 'size-9 rounded-[var(--ut-control-radius)] text-sm hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        selected: 'bg-primary text-primary-foreground',
        today: 'font-semibold text-primary',
        outside: 'text-muted-foreground/60',
        disabled: 'opacity-40',
        ...classNames,
      }}
      {...props}
    />
  );
}
