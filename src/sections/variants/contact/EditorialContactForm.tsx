import { editorialCardStyle } from '../shared/editorialStyles';
import React, { useId } from 'react';
import type { SectionPropsMap, ThemeTokens } from '../../types';
import { hsl } from '../../themeUtils';


/** Submit bubbles to the canonical form runtime; this component never invents success. */
export function EditorialContactForm({
  props,
  theme,
}: {
  props: SectionPropsMap['contact'];
  theme: ThemeTokens;
}) {
  const prefix = useId();
  const fields = props.fields?.length
    ? props.fields
    : [
        { name: 'name', type: 'text', placeholder: 'Your name', required: true },
        { name: 'email', type: 'email', placeholder: 'you@example.com', required: true },
        { name: 'message', type: 'textarea', placeholder: 'How can we help?', required: true },
      ];
  return (
    <form
      data-demo-form="true"
      data-ut-slot="form"
      data-ut-intent={props.submitIntent || 'contact.submit'}
      className="grid gap-5 sm:grid-cols-2"
    >
      {fields.map((field, index) => (
        <div key={`${field.name}-${index}`} className={field.type === 'textarea' ? 'sm:col-span-2' : ''}>
          <label htmlFor={`${prefix}-${index}`} className="mb-2 block text-sm font-medium">
            {field.label || field.name.replace(/[_-]+/g, ' ').replace(/^\w/, (c) => c.toUpperCase())}
            {field.required && <span aria-hidden="true"> *</span>}
          </label>
          {field.type === 'textarea' ? (
            <textarea
              id={`${prefix}-${index}`}
              name={field.name}
              placeholder={field.placeholder}
              required={field.required}
              rows={5}
              className="w-full px-4 py-3"
              style={{ ...editorialCardStyle(theme), background: hsl(theme.colors.background) }}
            />
          ) : (
            <input
              id={`${prefix}-${index}`}
              name={field.name}
              type={field.type || 'text'}
              placeholder={field.placeholder}
              required={field.required}
              autoComplete={['name', 'email', 'tel'].includes(field.name) ? field.name : undefined}
              className="min-h-12 w-full px-4 py-3"
              style={{ ...editorialCardStyle(theme), background: hsl(theme.colors.background) }}
            />
          )}
        </div>
      ))}
      <button data-ut-intent="contact.submit"
        type="submit"
        className="min-h-12 px-6 py-3 text-sm font-semibold sm:col-span-2 motion-safe:transition-transform motion-safe:hover:-translate-y-0.5"
        style={{
          borderRadius: theme.radius,
          background: hsl(theme.colors.primary),
          color: hsl(theme.colors.primaryForeground),
        }}
      >
        {props.submitLabel || 'Send message'}
      </button>
    </form>
  );
}

export function EditorialContactDetails({ props }: { props: SectionPropsMap['contact'] }) {
  return (
    <address className="space-y-4 break-words text-sm not-italic leading-relaxed">
      {props.email && (
        <div>
          <span className="mb-1 block text-xs uppercase tracking-widest">Email</span>
          <a data-ut-intent="nav.goto" href={`mailto:${props.email}`} data-ut-cta="cta.email">
            {props.email}
          </a>
        </div>
      )}
      {props.phone && (
        <div>
          <span className="mb-1 block text-xs uppercase tracking-widest">Phone</span>
          <a data-ut-intent="nav.goto" href={`tel:${props.phone}`} data-ut-cta="cta.phone">
            {props.phone}
          </a>
        </div>
      )}
      {props.address && (
        <div>
          <span className="mb-1 block text-xs uppercase tracking-widest">Visit</span>
          <a data-ut-intent="nav.goto"
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(props.address)}`}
            target="_blank"
            rel="noopener noreferrer"
            data-ut-cta="cta.address"
          >
            {props.address}
            <span className="mt-2 block underline">Get directions ↗</span>
          </a>
        </div>
      )}
    </address>
  );
}
