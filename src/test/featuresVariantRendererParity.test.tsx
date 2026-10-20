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

const template = getCompositionById('saas-dark')!;
const files = compositionToReactFileSet(template, '/src/pages/Home.tsx');
const themeModule = loadModule(files['/src/components/theme.ts']);
const Features = loadModule(files['/src/components/Features.tsx'], {
  './theme': themeModule,
  './recipes/Features': loadModule(files['/src/components/recipes/Features.ts']),
}).default as React.ComponentType<{
  props: SectionEntry<'features'>['props'] & { layout?: string };
  variantId?: string;
}>;
const props: SectionEntry<'features'>['props'] = {
  headline: 'Details designed around you',
  subheadline: 'Every visit includes thoughtful support.',
  items: [{ icon: '01', title: 'Personal guidance', description: 'Clear recommendations for your next step.' }],
};

describe('Features registry and emitted renderer parity', () => {
  it.each(getVariantsForSection('features'))('renders the registered structure for $id', variant => {
    const Registered = variant.component;
    const section = { id: 'features-proof', type: 'features', variantId: variant.id, props } as SectionEntry;
    const registryView = render(<Registered section={section} theme={themeModule.THEME as ThemeTokens} />);
    const expectedMarkup = registryView.container.innerHTML;
    registryView.unmount();

    const generatedView = render(<Features props={props} variantId={variant.id} />);
    expect(generatedView.container.innerHTML).toBe(expectedMarkup);
  });

  it('prefers explicit identity and preserves registered legacy layouts', () => {
    const view = render(<Features props={{ ...props, layout: 'grid' }} variantId="features:icon-left" />);
    expect(view.container.querySelector('[data-ut-variant]')).toHaveAttribute('data-ut-variant', 'features:icon-left');
    view.rerender(<Features props={{ ...props, layout: 'centered' }} />);
    expect(view.container.querySelector('[data-ut-variant]')).toHaveAttribute('data-ut-variant', 'features:minimal-centered');
  });
});