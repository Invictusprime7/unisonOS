/** @jsxRuntime classic */
/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
// UNISON GENERATED UI FOUNDATION v1.12
import * as React from 'react';
import { Slot as RadixSlot, Slottable } from '@radix-ui/react-slot';

export { Slottable };

/**
 * Radix's Slot throws when `asChild` receives text, fragments, or multiple
 * children (a very common shape in generated pages: icon + label).
 * This wrapper degrades to a plain <span> instead of crashing the preview.
 */
export const Slot = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode }>(
  ({ children, ...props }, ref) => {
    const list = React.Children.toArray(children).filter((child) => child !== null && child !== undefined && child !== false && child !== '');
    const only = list.length === 1 ? list[0] : null;
    const slottable = list.some(
      (child) => React.isValidElement(child) && (child.type as { displayName?: string } | undefined)?.displayName === 'Slottable',
    );

    if (slottable || (React.isValidElement(only) && only.type !== React.Fragment)) {
      return <RadixSlot ref={ref as never} {...props}>{children}</RadixSlot>;
    }

    return <span ref={ref as React.Ref<HTMLSpanElement>} {...props}>{children}</span>;
  },
);
Slot.displayName = 'Slot';
