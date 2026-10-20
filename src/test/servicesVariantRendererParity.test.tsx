import React from 'react';
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
const Services = loadModule(files['/src/components/Services.tsx'], {
  './theme': themeModule,
  './recipes/Services': loadModule(files['/src/components/recipes/Services.ts']),
}).default as React.ComponentType<{
  props: SectionEntry<'services'>['props'] & { layout?: string };
  variantId?: string;
}>;
const props: SectionEntry<'services'>['props'] = {
  headline: 'Services made for the moment',
  subheadline: 'Choose the right experience for your next visit.',
  items: [{ title: 'Signature service', description: 'A complete, considered appointment.', price: '$120', badge: 'Popular' }],
};

describe('Services registry and emitted renderer parity', () => {
  it.each(getVariantsForSection('services'))('renders the registered structure for $id', variant => {
    const Registered = variant.component;
    const section = { id: 'services-proof', type: 'services', variantId: variant.id, props } as SectionEntry;
    const registryView = render(<Registered section={section} theme={themeModule.THEME as ThemeTokens} />);
    const expectedMarkup = registryView.container.innerHTML;
    registryView.unmount();

    const generatedView = render(<Services props={props} variantId={variant.id} />);
    expect(generatedView.container.innerHTML).toBe(expectedMarkup);
  });

  it('prefers explicit identity and preserves legacy layouts', () => {
    const view = render(<Services props={{ ...props, layout: 'grid' }} variantId="services:alternating" />);
    expect(view.container.querySelector('[data-ut-variant]')).toHaveAttribute('data-ut-variant', 'services:alternating');
    view.rerender(<Services props={{ ...props, layout: 'list' }} />);
    expect(view.container.querySelector('[data-ut-variant]')).toHaveAttribute('data-ut-variant', 'services:compact-list');
  });
});