/** @jsxRuntime classic */
/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
// UNISON GENERATED UI FOUNDATION v1.12
import * as React from 'react';
import { Slot } from './radix/slot';
import { cva } from 'class-variance-authority';
import { cn } from './cn';

const buttonVariants = cva(
  'inline-flex min-h-10 items-center justify-center gap-2 rounded-[var(--ut-control-radius)] px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        outline: 'border border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground',
        ghost: 'text-foreground hover:bg-accent hover:text-accent-foreground',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        link: 'h-auto px-0 text-primary underline-offset-4 hover:underline',
      },
      size: { default: 'h-10', sm: 'h-9 px-3 text-xs', lg: 'h-12 px-6 text-base', icon: 'size-10 p-0', 'icon-sm': 'size-8 p-0', 'icon-lg': 'size-12 p-0' },
    },
    defaultVariants: { variant: 'primary', size: 'default' },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, children, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    const safeChildren = React.Children.map(children, (child) => (
      React.isValidElement(child) && !child.type ? null : child
    ));
    return <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props}>{safeChildren}</Comp>;
  },
);
Button.displayName = 'Button';

export type IconButtonProps = Omit<ButtonProps, 'children' | 'size'> & { label: string; children: React.ReactNode; size?: 'icon' | 'icon-sm' | 'icon-lg' };
export function IconButton({ label, size = 'icon', ...props }: IconButtonProps) {
  return <Button {...props} size={size} aria-label={label} title={label} />;
}
