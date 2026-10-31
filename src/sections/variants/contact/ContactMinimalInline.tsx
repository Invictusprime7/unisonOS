/**
 * Contact Variant: Minimal Inline
 * Compact single-row form with email + message, contact info as pills.
 */

import React from 'react';
import type { BaseSectionProps } from '../../types';
import { hsl, hsla } from '../../themeUtils';

export const ContactMinimalInline: React.FC<BaseSectionProps<'contact'>> = ({ section, theme }) => {
  const { headline, description, fields, submitLabel = 'Send', submitIntent = 'contact.submit', phone, email, address } = section.props;
  const formFields = fields?.length ? fields : [
    { name: 'email', type: 'email', placeholder: 'your@email.com' },
    { name: 'message', type: 'text', placeholder: 'Message' },
  ];

  const inputStyle: React.CSSProperties = {
    flex: '1 1 12rem',
    padding: '0.65rem 0.85rem',
    borderRadius: theme.radius,
    border: `1px solid ${hsla(theme.colors.border, 0.8)}`,
    background: hsl(theme.colors.card),
    color: hsl(theme.colors.cardForeground),
    fontFamily: theme.typography.bodyFont,
    fontSize: '0.875rem',
    outline: 'none',
  };

  return (
    <section
      data-ut-variant="contact:minimal-inline"
      style={{
        padding: theme.sectionPadding,
        background: `linear-gradient(135deg, ${hsla(theme.colors.primary, 0.04)}, ${hsla(theme.colors.secondary, 0.04)})`,
      }}
    >
      <div className="mx-auto px-5 text-center sm:px-6" style={{ maxWidth: '48rem' }}>
        {headline && (
          <h2 data-ut-slot="contact.headline"
            className="mb-3 text-2xl sm:text-3xl"
            style={{
              fontFamily: theme.typography.headingFont,
              fontWeight: theme.typography.headingWeight,
              color: hsl(theme.colors.foreground),
            }}
          >
            {headline}
          </h2>
        )}
        {description && (
          <p data-ut-slot="contact.description" className="text-base mb-8 max-w-md mx-auto" style={{ color: hsl(theme.colors.mutedForeground) }}>
            {description}
          </p>
        )}

        <form
          data-demo-form="true"
          data-ut-intent={submitIntent}
          className="mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap"
          style={{ maxWidth: '36rem', margin: '0 auto' }}
        >
          {formFields.map((field) => (
            <input key={field.name} name={field.name} type={field.type || 'text'} placeholder={field.placeholder || field.label || field.name} aria-label={field.label || field.name} required={field.required} style={inputStyle} />
          ))}
          <button data-ut-intent="contact.submit"
            type="submit"
            className="text-sm font-medium px-6 py-2.5 motion-safe:transition-opacity hover:opacity-90 cursor-pointer flex-shrink-0"
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
          <div className="flex gap-4 justify-center flex-wrap">
            {([
              email ? { value: email, href: `mailto:${email}`, cta: 'cta.email' } : null,
              phone ? { value: phone, href: `tel:${phone}`, cta: 'cta.phone' } : null,
              address ? { value: address, href: `https://maps.google.com/?q=${encodeURIComponent(address)}`, cta: 'cta.address' } : null,
            ].filter(Boolean) as Array<{ value: string; href: string; cta: string }>).map((info, i) => (
              <a data-ut-intent="nav.goto"
                key={i}
                href={info.href}
                data-ut-cta={info.cta}
                target={info.cta === 'cta.address' ? '_blank' : undefined}
                rel={info.cta === 'cta.address' ? 'noopener noreferrer' : undefined}
                className="text-xs px-3 py-1.5 rounded-full"
                style={{
                  background: hsl(theme.colors.card),
                  color: hsl(theme.colors.mutedForeground),
                  border: `1px solid ${hsla(theme.colors.border, 0.5)}`,
                  textDecoration: 'none',
                }}
              >
                {info.value}
              </a>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
