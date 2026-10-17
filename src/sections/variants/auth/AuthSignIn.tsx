import React from 'react';
import type { BaseSectionProps } from '../../types';
import { hsl } from '../../themeUtils';

/**
 * auth-form:split-panel — a calm split-panel sign-in screen. Visual only:
 * wiring real authentication is a separate, later step.
 */
export const AuthSignIn: React.FC<BaseSectionProps<'auth-form'>> = ({ section, theme }) => {
  const p = section.props;
  const heading = p.heading ?? 'Welcome back';
  const subheading = p.subheading ?? 'Sign in to continue to your account.';
  const submitLabel = p.submitLabel ?? 'Sign in';
  const footerNote = p.footerNote ?? 'Protected area — authorized users only.';

  return (
    <section
      data-ut-variant="auth-form:split-panel"
      className="grid min-h-[70vh] grid-cols-1 md:grid-cols-2"
      style={{ background: hsl(theme.colors.background) }}
    >
      <div
        className="hidden md:flex flex-col justify-between p-10"
        style={{ background: hsl(theme.colors.primary), color: hsl(theme.colors.primaryForeground) }}
      >
        <span data-ut-slot="auth.brand" className="text-lg font-semibold tracking-tight">
          Unison
        </span>
        <p data-ut-slot="auth.panelCopy" className="max-w-sm text-2xl font-medium leading-snug">
          Everything you need, one sign-in away.
        </p>
      </div>
      <div className="flex items-center justify-center px-6 py-16 sm:px-10">
        <form className="w-full max-w-sm space-y-5" data-ut-intent="auth.login">
          <div className="space-y-2">
            <h1
              data-ut-slot="auth.heading"
              className="text-2xl font-semibold tracking-tight sm:text-3xl"
              style={{
                fontFamily: theme.typography.headingFont,
                fontWeight: theme.typography.headingWeight,
                color: hsl(theme.colors.foreground),
              }}
            >
              {heading}
            </h1>
            <p data-ut-slot="auth.subheading" className="text-sm" style={{ color: hsl(theme.colors.mutedForeground) }}>
              {subheading}
            </p>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="unison-auth-email" className="text-sm font-medium" style={{ color: hsl(theme.colors.foreground) }}>
              Email
            </label>
            <input
              id="unison-auth-email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full px-3 py-2 text-sm outline-none motion-reduce:transition-none transition-colors focus-visible:ring-2"
              style={{
                borderRadius: theme.radius,
                border: `1px solid ${hsl(theme.colors.border)}`,
                background: 'transparent',
                color: hsl(theme.colors.foreground),
              }}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="unison-auth-password" className="text-sm font-medium" style={{ color: hsl(theme.colors.foreground) }}>
              Password
            </label>
            <input
              id="unison-auth-password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="w-full px-3 py-2 text-sm outline-none motion-reduce:transition-none transition-colors focus-visible:ring-2"
              style={{
                borderRadius: theme.radius,
                border: `1px solid ${hsl(theme.colors.border)}`,
                background: 'transparent',
                color: hsl(theme.colors.foreground),
              }}
            />
          </div>
          <button
            type="submit"
            data-ut-intent="auth.login"
            className="w-full px-4 py-2.5 text-sm font-medium motion-reduce:transition-none transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{
              borderRadius: theme.radius,
              background: hsl(theme.colors.primary),
              color: hsl(theme.colors.primaryForeground),
            }}
          >
            {submitLabel}
          </button>
          <p data-ut-slot="auth.footerNote" className="text-center text-xs" style={{ color: hsl(theme.colors.mutedForeground) }}>
            {footerNote}
          </p>
        </form>
      </div>
    </section>
  );
};
