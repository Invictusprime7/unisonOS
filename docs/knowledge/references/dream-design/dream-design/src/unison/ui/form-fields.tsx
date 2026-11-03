/** @jsxRuntime classic */
/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
// UNISON GENERATED UI FOUNDATION v1.12
import * as React from 'react';
  import * as LabelPrimitive from './radix/label';
import { cn } from './cn';

export function FieldLabel({ className, ...props }: React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>) {
  return <LabelPrimitive.Root className={cn('text-sm font-medium text-foreground', className)} {...props} />;
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn('flex h-10 w-full rounded-[var(--ut-control-radius)] border border-input bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50', className)} {...props} />;
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn('flex min-h-28 w-full rounded-[var(--ut-control-radius)] border border-input bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50', className)} {...props} />;
}

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn('flex h-10 w-full rounded-[var(--ut-control-radius)] border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50', className)} {...props} />;
}

export function Checkbox({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input type="checkbox" className={cn('size-4 rounded border border-input text-primary accent-primary focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50', className)} {...props} />;
}

type GeneratedFormFieldProps = React.HTMLAttributes<HTMLDivElement> & {
  label?: React.ReactNode;
  name?: string;
  control?: unknown;
  render?: (context: { field: { name?: string; value: string; onChange: () => void; onBlur: () => void } }) => React.ReactNode;
};

export function FormField({ label, name, control: _control, render, children, className, ...props }: GeneratedFormFieldProps) {
  if (render) {
    return <>{render({ field: { name, value: '', onChange: () => {}, onBlur: () => {} } })}</>;
  }
  return <div className={cn('grid gap-2', className)} {...props}>{label ? <FieldLabel>{label}</FieldLabel> : null}{children}</div>;
}

export function FormFields({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('grid gap-4', className)} {...props} />;
}

export function FormGrid({ columns = 2, className, ...props }: React.HTMLAttributes<HTMLDivElement> & { columns?: 1 | 2 | 3 }) {
  const layouts = { 1: 'grid-cols-1', 2: 'grid-cols-1 sm:grid-cols-2', 3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' };
  return <div className={cn('grid gap-4', layouts[columns], className)} {...props} />;
}

export function FormHint({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-xs leading-relaxed text-muted-foreground', className)} {...props} />;
}

export function FormError({ className, role = 'alert', ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p role={role} className={cn('text-xs font-medium text-destructive', className)} {...props} />;
}

// Alias surface: generated pages frequently import shadcn-style names.
// Keep these exported so a naming choice never breaks the VFS import contract.
export const Label = FieldLabel;
export const FormLabel = FieldLabel;
export const TextInput = Input;
export const TextArea = Textarea;

/** shadcn-style <Form> wrapper: a plain semantic form element. */
export function Form({ className, ...props }: React.FormHTMLAttributes<HTMLFormElement>) {
  return <form className={cn('grid gap-4', className)} {...props} />;
}

export function FormItem({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('grid gap-2', className)} {...props} />;
}

export const FormControl = FormItem;
export const FormDescription = FormHint;
export const FormMessage = FormError;
