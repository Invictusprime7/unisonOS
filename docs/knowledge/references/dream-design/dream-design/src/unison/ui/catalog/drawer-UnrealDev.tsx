/** @jsxRuntime classic */
/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
// UNISON GENERATED UI FOUNDATION v1.12
import * as React from 'react';
import { Drawer as DrawerPrimitive } from 'vaul';
import { cn } from '../cn';

export function Drawer(props: React.ComponentProps<typeof DrawerPrimitive.Root>) {
  return <DrawerPrimitive.Root shouldScaleBackground {...props} />;
}

export const DrawerTrigger = DrawerPrimitive.Trigger;
export const DrawerClose = DrawerPrimitive.Close;

export function DrawerContent({ className, children, ...props }: React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Content>) {
  return (
    <DrawerPrimitive.Portal>
      <DrawerPrimitive.Overlay data-ut-radix="overlay" className="fixed inset-0 z-50 bg-foreground/40" />
      <DrawerPrimitive.Content
        data-ut-radix="content"
        className={cn('fixed inset-x-0 bottom-0 z-50 flex max-h-[85vh] flex-col rounded-t-[var(--radius)] border border-border bg-card text-card-foreground', className)}
        {...props}
      >
        <div aria-hidden className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-muted" />
        {children}
      </DrawerPrimitive.Content>
    </DrawerPrimitive.Portal>
  );
}

export function DrawerHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-1.5 p-5', className)} {...props} />;
}

export function DrawerFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mt-auto flex flex-col gap-2 p-5', className)} {...props} />;
}

export function DrawerTitle({ className, ...props }: React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Title>) {
  return <DrawerPrimitive.Title className={cn('font-heading text-lg font-semibold', className)} {...props} />;
}

export function DrawerDescription({ className, ...props }: React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Description>) {
  return <DrawerPrimitive.Description className={cn('text-sm text-muted-foreground', className)} {...props} />;
}
