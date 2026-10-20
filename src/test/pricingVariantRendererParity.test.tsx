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
const pricingTemplate = { ...template, sections: template.pageCompositions!.pricing!.sections };
const files = compositionToReactFileSet(pricingTemplate, '/src/pages/Pricing.tsx');
const themeModule = loadModule(files['/src/components/theme.ts']);
const Pricing = loadModule(files['/src/components/Pricing.tsx'], {
  './theme': themeModule,
  './recipes/Pricing': loadModule(files['/src/components/recipes/Pricing.ts']),
}).default as React.ComponentType<{ props: SectionEntry<'pricing'>['props']; variantId?: string }>;
const props: SectionEntry<'pricing'>['props'] = {
  headline: 'Choose your membership',
  subheadline: 'Simple plans for the experience you need.',
  tiers: [{
    name: 'Signature', price: '$120', period: 'visit', description: 'The complete appointment.',
    features: ['Consultation', 'Finishing touch'], highlighted: true,
    cta: { label: 'Reserve now', href: '/booking', intent: 'booking.create', variant: 'primary' },
  }],
};

describe('Pricing registry and emitted renderer parity', () => {
  it.each(getVariantsForSection('pricing'))('renders the registered structure for $id', variant => {
    const Registered = variant.component;
    const section = { id: 'pricing-proof', type: 'pricing', variantId: variant.id, props } as SectionEntry;
    const registryView = render(<Registered section={section} theme={themeModule.THEME as ThemeTokens} />);
    const expectedMarkup = registryView.container.innerHTML;
    registryView.unmount();

    const generatedView = render(<Pricing props={props} variantId={variant.id} />);
    expect(generatedView.container.innerHTML).toBe(expectedMarkup);
    expect(generatedView.getByRole('link', { name: 'Reserve now' })).toHaveAttribute('data-ut-intent', 'booking.create');
  });

  it('prefers explicit identity and preserves legacy layouts', () => {
    const view = render(<Pricing props={{ ...props, layout: 'tiers' } as typeof props} variantId="pricing:comparison" />);
    expect(view.container.querySelector('[data-ut-variant]')).toHaveAttribute('data-ut-variant', 'pricing:comparison');
    view.rerender(<Pricing props={{ ...props, layout: 'accordion' } as typeof props} />);
    expect(view.container.querySelector('[data-ut-variant]')).toHaveAttribute('data-ut-variant', 'pricing:accordion');
  });
});