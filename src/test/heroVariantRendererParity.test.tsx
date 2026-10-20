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
const Hero = loadModule(files['/src/components/Hero.tsx'], {
  './theme': themeModule,
  './recipes/Hero': loadModule(files['/src/components/recipes/Hero.ts']),
}).default as React.ComponentType<{
  props: SectionEntry<'hero'>['props'] & { layout?: string };
  variantId?: string;
}>;
const props: SectionEntry<'hero'>['props'] = {
  headline: 'A considered point of view',
  subheadline: 'Clear work, designed around the people it serves.',
  badge: 'New work',
  image: '/hero.jpg',
  backgroundImage: '/hero.jpg',
  ctas: [{ label: 'Start a project', href: '#contact', intent: 'contact.submit' }],
};

describe('Hero registry and emitted renderer parity', () => {
  it.each(getVariantsForSection('hero'))('renders the registered structure for $id', variant => {
    const Registered = variant.component;
    const section = { id: 'hero-proof', type: 'hero', variantId: variant.id, props } as SectionEntry;
    const registryView = render(<Registered section={section} theme={themeModule.THEME as ThemeTokens} />);
    const expectedMarkup = registryView.container.innerHTML;
    registryView.unmount();

    const generatedView = render(<Hero props={props} variantId={variant.id} />);
    expect(generatedView.container.innerHTML).toBe(expectedMarkup);
  });

  it('prefers explicit identity and preserves legacy layout aliases', () => {
    const view = render(<Hero props={{ ...props, layout: 'centered' }} variantId="hero:full-bleed" />);
    expect(view.container.querySelector('[data-ut-variant]')).toHaveAttribute('data-ut-variant', 'hero:full-bleed');

    view.rerender(<Hero props={{ ...props, layout: 'split' }} />);
    expect(view.container.querySelector('[data-ut-variant]')).toHaveAttribute('data-ut-variant', 'hero:split-image');
    view.rerender(<Hero props={{ ...props, layout: 'page-title' }} />);
    expect(view.container.querySelector('[data-ut-variant]')).toHaveAttribute('data-ut-variant', 'hero:page-title');
  });
});