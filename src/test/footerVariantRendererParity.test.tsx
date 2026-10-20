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
const iconFacade = new Proxy({} as Record<string, unknown>, { get: () => () => null });
const Footer = loadModule(files['/src/components/Footer.tsx'], {
  './theme': themeModule,
  './SocialIcon': loadModule(files['/src/components/SocialIcon.tsx'], { '@/unison/ui/icons': iconFacade }),
  './recipes/Footer': loadModule(files['/src/components/recipes/Footer.ts'], { '@/unison/ui/icons': iconFacade }),
}).default as React.ComponentType<{ props: SectionEntry<'footer'>['props']; variantId?: string }>;
const props: SectionEntry<'footer'>['props'] = {
  brand: 'Atelier North',
  columns: [{ title: 'Explore', links: [{ label: 'Services', href: '/services' }] }],
  socials: [],
  newsletter: true,
};

describe('Footer registry and emitted renderer parity', () => {
  it.each(getVariantsForSection('footer'))('renders the registered structure for $id', variant => {
    const Registered = variant.component;
    const section = { id: 'footer-proof', type: 'footer', variantId: variant.id, props } as SectionEntry;
    const registryView = render(<Registered section={section} theme={themeModule.THEME as ThemeTokens} />);
    const expectedMarkup = registryView.container.innerHTML;
    registryView.unmount();

    const generatedView = render(<Footer props={props} variantId={variant.id} />);
    expect(generatedView.container.innerHTML).toBe(expectedMarkup);
  });

  it('prefers explicit identity and preserves registered legacy layouts', () => {
    const view = render(<Footer props={{ ...props, layout: 'columns' }} variantId="footer:dark-band" />);
    expect(view.container.querySelector('[data-ut-variant]')).toHaveAttribute('data-ut-variant', 'footer:dark-band');
    view.rerender(<Footer props={{ ...props, layout: 'centered-minimal' }} />);
    expect(view.container.querySelector('[data-ut-variant]')).toHaveAttribute('data-ut-variant', 'footer:centered-minimal');
  });
});