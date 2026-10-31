/**
 * Contact Variant: Centered Form
 * Default centered contact form with info below. 
 */

import React from 'react';
import type { BaseSectionProps } from '../../types';
import { hsl, hsla } from '../../themeUtils';

export const ContactCentered: React.FC<BaseSectionProps<'contact'>> = ({ section, theme }) => {
  const { headline, description, fields, submitLabel = 'Send Message', submitIntent = 'contact.submit', phone, email, address } = section.props;
  const formFields = fields?.length ? fields : [
    { name: 'name', type: 'text', placeholder: 'Your name' },
    { name: 'email', type: 'email', placeholder: 'your@email.com' },
    { name: 'message', type: 'textarea', placeholder: 'How can we help?' },
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
      data-ut-variant="contact:centered"
      style={{ padding: theme.sectionPadding, background: hsl(theme.colors.muted) }}
    >
      <div className="mx-auto px-5 sm:px-6 lg:px-8" style={{ maxWidth: '44rem' }}>
        {headline && (
          <div className="text-center mb-8">
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

        <div
          className="p-6 sm:p-10 shadow-sm transition-all"
          style={{
            background: hsl(theme.colors.card),
            borderRadius: theme.radius,
            border: `1px solid ${hsla(theme.colors.border, 0.6)}`,
          }}
        >
          <form data-demo-form="true" data-ut-intent={submitIntent} className="flex flex-col gap-4">
            {formFields.map((field) => field.type === 'textarea' ? (
              <textarea key={field.name} name={field.name} placeholder={field.placeholder || field.label || field.name} aria-label={field.label || field.name} required={field.required} rows={4} style={inputStyle} className="transition-all focus:ring-2 focus:ring-primary/20" />
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

          {(phone || email || address) && (
            <div
              className="mt-8 pt-6 border-t flex flex-wrap gap-4 justify-center text-center text-sm"
              style={{ borderColor: hsla(theme.colors.border, 0.4), color: hsl(theme.colors.mutedForeground) }}
            >
              {phone && <p><a data-ut-intent="nav.goto" href={`tel:${phone}`} data-ut-cta="cta.phone" style={{ color: 'inherit', textDecoration: 'none' }}>{phone}</a></p>}
              {email && <p><a data-ut-intent="nav.goto" href={`mailto:${email}`} data-ut-cta="cta.email" style={{ color: 'inherit', textDecoration: 'none' }}>{email}</a></p>}
              {address && <p><a data-ut-intent="nav.goto" href={`https://maps.google.com/?q=${encodeURIComponent(address)}`} target="_blank" rel="noopener noreferrer" data-ut-cta="cta.address" style={{ color: 'inherit', textDecoration: 'none' }}>{address}</a></p>}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
