/** @jsxRuntime classic */
/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
// UNISON GENERATED UI FOUNDATION v1.12
import * as React from 'react';
import { cn } from '../cn';
import { ChevronLeft, ChevronRight, MoreHorizontal } from '../icons';

export function Pagination({ className, ...props }: React.ComponentPropsWithoutRef<'nav'>) {
  return <nav aria-label="Pagination" className={cn('mx-auto flex w-full justify-center', className)} {...props} />;
}

export function PaginationContent({ className, ...props }: React.ComponentPropsWithoutRef<'ul'>) {
  return <ul className={cn('flex flex-row items-center gap-1', className)} {...props} />;
}

export function PaginationItem(props: React.ComponentPropsWithoutRef<'li'>) {
  return <li {...props} />;
}

export function PaginationLink({ className, isActive, ...props }: React.ComponentPropsWithoutRef<'a'> & { isActive?: boolean }) {
  return (
    <a
      aria-current={isActive ? 'page' : undefined}
      className={cn('inline-flex size-9 items-center justify-center rounded-[var(--ut-control-radius)] border border-transparent text-sm transition-colors hover:bg-accent hover:text-accent-foreground', isActive && 'border-border bg-card font-semibold text-foreground', className)}
      {...props}
    />
  );
}

export function PaginationPrevious({ className, ...props }: React.ComponentPropsWithoutRef<'a'>) {
  return (
    <a aria-label="Previous page" className={cn('inline-flex h-9 items-center gap-1 rounded-[var(--ut-control-radius)] px-3 text-sm hover:bg-accent hover:text-accent-foreground', className)} {...props}>
      <ChevronLeft /> <span>Previous</span>
    </a>
  );
}

export function PaginationNext({ className, ...props }: React.ComponentPropsWithoutRef<'a'>) {
  return (
    <a aria-label="Next page" className={cn('inline-flex h-9 items-center gap-1 rounded-[var(--ut-control-radius)] px-3 text-sm hover:bg-accent hover:text-accent-foreground', className)} {...props}>
      <span>Next</span> <ChevronRight />
    </a>
  );
}

export function PaginationEllipsis({ className, ...props }: React.ComponentPropsWithoutRef<'span'>) {
  return (
    <span aria-hidden className={cn('inline-flex size-9 items-center justify-center text-muted-foreground', className)} {...props}>
      <MoreHorizontal />
    </span>
  );
}
