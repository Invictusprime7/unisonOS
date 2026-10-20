import React from 'react';
import { normalizeReactIds } from './helpers/normalizeReactIds';
import { transform } from '@babel/standalone';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { compositionToReactFileSet } from '@/sections/compositionToFileSet';
import { getCompositionById } from '@/sections/templates';
import { getVariantsForSection } from '@/sections/variants';
import type { SectionEntry, ThemeTokens } from '@/sections/types';

afterEach(cleanup);

function loadModule(source: string, dependencies: Record<string, unknown> = {}) {
  const module = { exports: {} as Record<string, unknown> };
  const code = transform(source, {
    filename: 'generated.tsx', presets: ['typescript', 'react'], plugins: ['transform-modules-commonjs'],
  }).code!;
  new Function('require', 'module', 'exports', code)((name: string) => {
    if (name === 'react') return React;
    if (!(name in dependencies)) throw new Error(`Unexpected portable import: ${name}`);
    return dependencies[name];
  }, module, module.exports);
  return module.exports;
}

const template = getCompositionById('salon-premium')!;
const files = compositionToReactFileSet(template, '/src/pages/Home.tsx');
const themeModule = loadModule(files['/src/components/theme.ts']);
const Contact = loadModule(files['/src/components/Contact.tsx'], {
  './theme': themeModule,
  './recipes/Contact': loadModule(files['/src/components/recipes/Contact.ts']),
}).default as React.ComponentType<{
  props: SectionEntry<'contact'>['props'];
  variantId?: string;
}>;
const props: SectionEntry<'contact'>['props'] = {
  headline: 'Start a conversation',
  description: 'Tell us what would be most helpful.',
  submitLabel: 'Request a consultation',
  submitIntent: 'quote.request',
  email: 'hello@example.test',
  fields: [
    { name: 'name', type: 'text', placeholder: 'Your name', required: true },
    { name: 'project', type: 'text', placeholder: 'Project details' },
    { name: 'notes', type: 'textarea', placeholder: 'Anything else?' },
  ],
};

describe('Contact registry and emitted renderer parity', () => {
  it.each(getVariantsForSection('contact'))('renders the registered structure for $id', variant => {
    const Registered = variant.component;
    const section = { id: 'contact-proof', type: 'contact', variantId: variant.id, props } as SectionEntry;
    const registryView = render(<Registered section={section} theme={themeModule.THEME as ThemeTokens} />);
    const expectedMarkup = normalizeReactIds(registryView.container.innerHTML);
    registryView.unmount();

    const generatedView = render(<Contact props={props} variantId={variant.id} />);
    expect(normalizeReactIds(generatedView.container.innerHTML)).toBe(expectedMarkup);
    expect(generatedView.container.querySelector('form')).toHaveAttribute('data-ut-intent', 'quote.request');
    expect(generatedView.getByPlaceholderText('Project details')).toHaveAttribute('name', 'project');
  });

  it('prefers explicit identity and preserves registered legacy layouts', () => {
    const view = render(<Contact props={{ ...props, layout: 'centered' }} variantId="contact:split-card" />);
    expect(view.container.querySelector('[data-ut-variant]')).toHaveAttribute('data-ut-variant', 'contact:split-card');
    view.rerender(<Contact props={{ ...props, layout: 'minimal-inline' }} />);
    expect(view.container.querySelector('[data-ut-variant]')).toHaveAttribute('data-ut-variant', 'contact:minimal-inline');
  });
});