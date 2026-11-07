/** @jsxRuntime classic */
/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
// UNISON GENERATED UI FOUNDATION v1.12
import * as React from 'react';
import * as Dialog from '../radix/dialog';
import { cn } from '../cn';
import { X } from '../icons';

export const Sheet = Dialog.Root;
export const SheetTrigger = Dialog.Trigger;
export const SheetClose = Dialog.Close;

type Side = 'top' | 'right' | 'bottom' | 'left';

const sides: Record<Side, string> = {
  top: 'inset-x-0 top-0 border-b',
  right: 'inset-y-0 right-0 h-full w-full max-w-sm border-l',
  bottom: 'inset-x-0 bottom-0 border-t',
  left: 'inset-y-0 left-0 h-full w-full max-w-sm border-r',
};

export function SheetContent({ side = 'right', className, children, ...props }: React.ComponentPropsWithoutRef<typeof Dialog.Content> & { side?: Side }) {
  return (
    <Dialog.Portal>
      <Dialog.Overlay data-ut-radix="overlay" className="fixed inset-0 z-50 bg-foreground/40 motion-safe:transition-opacity" />
      <Dialog.Content
        data-ut-radix="content"
        className={cn('fixed z-50 flex flex-col gap-4 overflow-y-auto border-border bg-card p-6 text-card-foreground', sides[side], className)}
        {...props}
      >
        {children}
        <Dialog.Close aria-label="Close" className="absolute right-4 top-4 inline-flex size-8 items-center justify-center rounded-[var(--ut-control-radius)] text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <X />
        </Dialog.Close>
      </Dialog.Content>
    </Dialog.Portal>
  );
}

export function SheetHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-1.5', className)} {...props} />;
}

export function SheetFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mt-auto flex flex-col gap-2', className)} {...props} />;
}

export function SheetTitle({ className, ...props }: React.ComponentPropsWithoutRef<typeof Dialog.Title>) {
  return <Dialog.Title className={cn('font-heading text-lg font-semibold', className)} {...props} />;
}

export function SheetDescription({ className, ...props }: React.ComponentPropsWithoutRef<typeof Dialog.Description>) {
  return <Dialog.Description className={cn('text-sm text-muted-foreground', className)} {...props} />;
}
