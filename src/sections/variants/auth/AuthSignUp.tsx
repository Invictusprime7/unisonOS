import React from 'react';
import type { BaseSectionProps } from '../../types';
import { hsl } from '../../themeUtils';

/**
 * auth-form:sign-up-card — a centered account-creation card. Visual only:
 * wiring real accounts is a separate, later step.
 * Motion: a subtle card rise on hover, disabled under reduced motion
 * (motion-safe only), so the reduced-motion fallback is a static card.
 */
export const AuthSignUp: React.FC<BaseSectionProps<'auth-form'>> = ({ section, theme }) => {
  const p = section.props;
  const heading = p.heading ?? 'Create your account';
  const subheading = p.subheading ?? 'It takes less than a minute.';
  const submitLabel = p.submitLabel ?? 'Create account';
  const footerNote = p.footerNote ?? 'By continuing you agree to the terms of service.';
  const altLabel = p.altActionLabel ?? 'Already have an account? Sign in';
  const altHref = p.altActionHref ?? '#sign-in';

  const field = (id: string, label: string, type: string, autoComplete: string) => (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium" style={{ color: hsl(theme.colors.foreground) }}>
        {label}
      </label>
      <input
        id={id}
        name={id.replace('unison-signup-', '')}
        type={type}
        required
        autoComplete={autoComplete}
        className="w-full px-3 py-2 text-sm outline-none focus-visible:ring-2 motion-safe:transition-colors motion-reduce:transition-none"
        style={{
          borderRadius: theme.radius,
          border: `1px solid ${hsl(theme.colors.border)}`,
          background: 'transparent',
          color: hsl(theme.colors.foreground),
        }}
      />
    </div>
  );

  return (
    <section
      data-ut-variant="auth-form:sign-up-card"
      className="flex min-h-[70vh] items-center justify-center px-4 py-16 sm:px-6"
      style={{ background: hsl(theme.colors.muted) }}
    >
      <form
        data-ut-intent="auth.register"
        className="w-full max-w-md space-y-5 p-6 sm:p-8 motion-safe:transition-transform motion-safe:duration-300 motion-safe:hover:-translate-y-0.5 motion-reduce:transform-none"
        style={{
          borderRadius: theme.radius,
          background: hsl(theme.colors.background),
          border: `1px solid ${hsl(theme.colors.border)}`,
        }}
      >
        <div className="space-y-2">
          <h1
            data-ut-slot="auth.heading"
            className="text-2xl font-semibold tracking-tight sm:text-3xl"
            style={{ fontFamily: theme.typography.headingFont, fontWeight: theme.typography.headingWeight, color: hsl(theme.colors.foreground) }}
          >
            {heading}
          </h1>
          <p data-ut-slot="auth.subheading" className="text-sm" style={{ color: hsl(theme.colors.mutedForeground) }}>
            {subheading}
          </p>
        </div>
        {field('unison-signup-name', 'Full name', 'text', 'name')}
        {field('unison-signup-email', 'Email', 'email', 'email')}
        {field('unison-signup-password', 'Password', 'password', 'new-password')}
        <button
          type="submit"
          data-ut-intent="auth.register"
          className="w-full px-4 py-2.5 text-sm font-medium hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 motion-safe:transition-opacity motion-reduce:transition-none"
          style={{ borderRadius: theme.radius, background: hsl(theme.colors.primary), color: hsl(theme.colors.primaryForeground) }}
        >
          {submitLabel}
        </button>
        <a
          href={altHref}
          data-ut-slot="auth.altAction"
          data-ut-intent="auth.login"
          className="block text-center text-sm underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2"
          style={{ color: hsl(theme.colors.primary) }}
        >
          {altLabel}
        </a>
        <p data-ut-slot="auth.footerNote" className="text-center text-xs" style={{ color: hsl(theme.colors.mutedForeground) }}>
          {footerNote}
        </p>
      </form>
    </section>
  );
};
