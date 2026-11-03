/** @jsxRuntime classic */
/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
// UNISON GENERATED UI FOUNDATION v1.12
import * as React from 'react';
import { OTPInput, OTPInputContext } from 'input-otp';
import { cn } from '../cn';

export function InputOTP({ className, containerClassName, ...props }: React.ComponentPropsWithoutRef<typeof OTPInput> & { containerClassName?: string }) {
  return (
    <OTPInput
      containerClassName={cn('flex items-center gap-2', containerClassName)}
      className={cn('disabled:cursor-not-allowed', className)}
      {...props}
    />
  );
}

export function InputOTPGroup({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex items-center gap-2', className)} {...props} />;
}

export function InputOTPSlot({ index, className, ...props }: React.HTMLAttributes<HTMLDivElement> & { index: number }) {
  const context = React.useContext(OTPInputContext);
  const slot = context?.slots?.[index];
  return (
    <div
      className={cn('flex size-10 items-center justify-center rounded-[var(--ut-control-radius)] border border-border bg-background text-sm', slot?.isActive && 'ring-2 ring-ring', className)}
      {...props}
    >
      {slot?.char ?? ''}
    </div>
  );
}

export function InputOTPSeparator(props: React.HTMLAttributes<HTMLDivElement>) {
  return <div role="separator" aria-hidden className="h-px w-3 bg-border" {...props} />;
}
