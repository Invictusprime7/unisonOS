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
const CTA = loadModule(files['/src/components/CTA.tsx'], {
  './theme': themeModule,
  './recipes/CTA': loadModule(files['/src/components/recipes/CTA.ts']),
}).default as React.ComponentType<{ props: SectionEntry<'cta'>['props']; variantId?: string }>;
const props: SectionEntry<'cta'>['props'] = {
  headline: 'Plan your next visit',
  description: 'Choose a time that suits you.',
  ctas: [{ label: 'Book now', href: '/booking', intent: 'booking.create', variant: 'primary' }],
};

describe('CTA registry and emitted renderer parity', () => {
  it.each(getVariantsForSection('cta'))('renders the registered structure for $id', variant => {
    const Registered = variant.component;
    const section = { id: 'cta-proof', type: 'cta', variantId: variant.id, props } as SectionEntry;
    const registryView = render(<Registered section={section} theme={themeModule.THEME as ThemeTokens} />);
    const expectedMarkup = registryView.container.innerHTML;
    registryView.unmount();

    const generatedView = render(<CTA props={props} variantId={variant.id} />);
    expect(generatedView.container.innerHTML).toBe(expectedMarkup);
    expect(generatedView.getByRole('link', { name: 'Book now' })).toHaveAttribute('data-ut-intent', 'booking.create');
  });

  it('prefers explicit identity and preserves registered legacy layouts', () => {
    const view = render(<CTA props={{ ...props, layout: 'centered' }} variantId="cta:split-card" />);
    expect(view.container.querySelector('[data-ut-variant]')).toHaveAttribute('data-ut-variant', 'cta:split-card');
    view.rerender(<CTA props={{ ...props, layout: 'centered' }} />);
    expect(view.container.querySelector('[data-ut-variant]')).toHaveAttribute('data-ut-variant', 'cta:centered');
  });
});