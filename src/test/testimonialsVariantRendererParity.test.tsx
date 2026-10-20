import React from 'react';
import { transform } from '@babel/standalone';
import { cleanup, render, screen } from '@testing-library/react';
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
const Testimonials = loadModule(files['/src/components/Testimonials.tsx'], {
  './theme': themeModule,
  './recipes/Testimonials': loadModule(files['/src/components/recipes/Testimonials.ts']),
}).default as React.ComponentType<{
  props: SectionEntry<'testimonials'>['props'] & { layout?: string };
  variantId?: string;
}>;
const props: SectionEntry<'testimonials'>['props'] = {
  headline: 'Client Stories',
  subheadline: 'Trusted by people who value their time.',
  items: [
    { quote: 'The process was thoughtful from the first visit.', author: 'Alex Morgan', role: 'Client', rating: 5 },
    { quote: 'Every detail felt considered and easy.', author: 'Sam Lee', role: 'Client', rating: 4 },
  ],
};

describe('Testimonials registry and emitted renderer parity', () => {
  it.each(getVariantsForSection('testimonials'))('renders the registered structure for $id', variant => {
    const Registered = variant.component;
    const section = { id: 'testimonials-proof', type: 'testimonials', variantId: variant.id, props } as SectionEntry;
    const registryView = render(<Registered section={section} theme={themeModule.THEME as ThemeTokens} />);
    const expectedMarkup = registryView.container.innerHTML;
    registryView.unmount();

    const generatedView = render(<Testimonials props={props} variantId={variant.id} />);
    expect(generatedView.container.innerHTML).toBe(expectedMarkup);
  });

  it('prefers explicit identity and preserves legacy layout aliases', () => {
    const view = render(<Testimonials props={{ ...props, layout: 'grid' }} variantId="testimonials:rail" />);
    expect(view.container.querySelector('[data-ut-variant]')).toHaveAttribute('data-ut-variant', 'testimonials:rail');
    expect(screen.getByRole('button', { name: 'Previous testimonials' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Next testimonials' })).toBeVisible();

    view.rerender(<Testimonials props={{ ...props, layout: 'carousel' }} />);
    expect(view.container.querySelector('[data-ut-variant]')).toHaveAttribute('data-ut-variant', 'testimonials:rail');
    view.rerender(<Testimonials props={{ ...props, layout: 'single' }} />);
    expect(view.container.querySelector('[data-ut-variant]')).toHaveAttribute('data-ut-variant', 'testimonials:spotlight');
  });
});