/**
 * Contact Variant: Split Card
 * Two-column layout — form on the left, contact info card on the right.
 */

import React from 'react';
import type { BaseSectionProps } from '../../types';
import { hsl, hsla } from '../../themeUtils';

export const ContactSplitCard: React.FC<BaseSectionProps<'contact'>> = ({ section, theme }) => {
  const { headline, description, fields, submitLabel = 'Send Message', submitIntent = 'contact.submit', phone, email, address } = section.props;
  const formFields = fields?.length ? fields : [
    { name: 'name', type: 'text', placeholder: 'Your name' },
    { name: 'email', type: 'email', placeholder: 'your@email.com' },
    { name: 'message', type: 'textarea', placeholder: 'Your message...' },
  ];

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.75rem 1rem',
    borderRadius: theme.radius,
    border: `1px solid ${hsla(theme.colors.border, 0.8)}`,
    background: hsl(theme.colors.background),
    color: hsl(theme.colors.foreground),
    fontFamily: theme.typography.bodyFont,
    fontSize: '0.875rem',
    outline: 'none',
  };

  return (
    <section
      data-ut-variant="contact:split-card"
      style={{ padding: theme.sectionPadding, background: hsl(theme.colors.background) }}
    >
      <div className="mx-auto px-5 sm:px-6 lg:px-8" style={{ maxWidth: theme.containerWidth }}>
        {headline && (
          <div className="text-center mb-12">
            <h2 data-ut-slot="contact.headline"
              className="text-3xl sm:text-4xl mb-3 font-semibold tracking-tight"
              style={{
                fontFamily: theme.typography.headingFont,
                fontWeight: theme.typography.headingWeight,
                color: hsl(theme.colors.foreground),
              }}
            >
              {headline}
            </h2>
            {description && (
              <p data-ut-slot="contact.description" className="text-base max-w-lg mx-auto" style={{ color: hsl(theme.colors.mutedForeground) }}>
                {description}
              </p>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start max-w-5xl mx-auto">
          <div
            className="p-6 sm:p-8 rounded-[var(--radius)] shadow-sm"
            style={{
              background: hsl(theme.colors.card),
              border: `1px solid ${hsla(theme.colors.border, 0.6)}`,
            }}
          >
            <form data-demo-form="true" data-ut-intent={submitIntent} className="flex flex-col gap-4">
              {formFields.map((field) => field.type === 'textarea' ? (
                <textarea key={field.name} name={field.name} placeholder={field.placeholder || field.label || field.name} aria-label={field.label || field.name} required={field.required} rows={5} style={inputStyle} className="transition-all focus:ring-2 focus:ring-primary/20" />
              ) : (
                <input key={field.name} name={field.name} type={field.type || 'text'} placeholder={field.placeholder || field.label || field.name} aria-label={field.label || field.name} required={field.required} style={inputStyle} className="transition-all focus:ring-2 focus:ring-primary/20" />
              ))}
              <button data-ut-intent="contact.submit"
                type="submit"
                className="w-full text-sm font-semibold py-3.5 motion-safe:transition-opacity hover:opacity-90 active:scale-[0.99] cursor-pointer shadow-sm"
                style={{
                  background: hsl(theme.colors.primary),
                  color: hsl(theme.colors.primaryForeground),
                  borderRadius: theme.radius,
                  border: 'none',
                  fontFamily: theme.typography.bodyFont,
                }}
              >
                {submitLabel}
              </button>
            </form>
          </div>

          <div
            className="p-6 sm:p-8 flex flex-col gap-6 rounded-[var(--radius)] shadow-sm"
            style={{
              background: hsl(theme.colors.card),
              border: `1px solid ${hsla(theme.colors.border, 0.6)}`,
              borderRadius: theme.radius,
            }}
          >
            <h3
              className="text-xl font-semibold"
              style={{
                fontFamily: theme.typography.headingFont,
                fontWeight: theme.typography.headingWeight,
                color: hsl(theme.colors.cardForeground),
              }}
            >
              Get in Touch
            </h3>
            {email && (
              <div>
                <p className="text-xs uppercase tracking-wider mb-1 font-semibold" style={{ color: hsl(theme.colors.mutedForeground) }}>Email</p>
                <p className="text-sm font-medium" style={{ color: hsl(theme.colors.cardForeground) }}><a data-ut-intent="nav.goto" href={`mailto:${email}`} data-ut-cta="cta.email" style={{ color: 'inherit', textDecoration: 'none' }}>{email}</a></p>
              </div>
            )}
            {phone && (
              <div>
                <p className="text-xs uppercase tracking-wider mb-1 font-semibold" style={{ color: hsl(theme.colors.mutedForeground) }}>Phone</p>
                <p className="text-sm font-medium" style={{ color: hsl(theme.colors.cardForeground) }}><a data-ut-intent="nav.goto" href={`tel:${phone}`} data-ut-cta="cta.phone" style={{ color: 'inherit', textDecoration: 'none' }}>{phone}</a></p>
              </div>
            )}
            {address && (
              <div>
                <p className="text-xs uppercase tracking-wider mb-1 font-semibold" style={{ color: hsl(theme.colors.mutedForeground) }}>Address</p>
                <p className="text-sm font-medium" style={{ color: hsl(theme.colors.cardForeground) }}><a data-ut-intent="nav.goto" href={`https://maps.google.com/?q=${encodeURIComponent(address)}`} target="_blank" rel="noopener noreferrer" data-ut-cta="cta.address" style={{ color: 'inherit', textDecoration: 'none' }}>{address}</a></p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
