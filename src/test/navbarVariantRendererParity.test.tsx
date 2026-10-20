import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as icons from 'lucide-react';
import { transform } from '@babel/standalone';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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
    if (name === '@/unison/ui/radix/dialog') return Dialog;
    if (name === '@/unison/ui/icons') return icons;
    if (!(name in dependencies)) throw new Error(`Unexpected portable import: ${name}`);
    return dependencies[name];
  }, module, module.exports);
  return module.exports;
}

function normalizeRadixIds(markup: string) {
  return markup.replace(/radix-_r_[^_]+_/g, 'radix-_r_ID_');
}

const template = getCompositionById('salon-premium')!;
const files = compositionToReactFileSet(template, '/src/pages/Home.tsx');
const themeModule = loadModule(files['/src/components/theme.ts']);
const MobileNavigation = loadModule(files['/src/components/MobileNavigation.tsx'], {
  '@stylexjs/stylex': { create: () => ({}), props: () => ({}) },
}).default;
const Navbar = loadModule(files['/src/components/Navbar.tsx'], {
  './theme': themeModule,
  './MobileNavigation': MobileNavigation,
  './recipes/Navbar': loadModule(files['/src/components/recipes/Navbar.ts']),
}).default as React.ComponentType<{
  props: SectionEntry<'navbar'>['props'];
  variantId?: string;
}>;
const props: SectionEntry<'navbar'>['props'] = {
  brand: 'Northstar Studio',
  links: [{ label: 'Services', href: '#services', intent: 'navigation.services' }],
  cta: { label: 'Book a consult', href: '#contact', intent: 'booking.create' },
};

describe('Navbar registry and emitted renderer parity', () => {
  it.each(getVariantsForSection('navbar'))('renders the registered structure for $id', variant => {
    const Registered = variant.component;
    const section = { id: 'navbar-proof', type: 'navbar', variantId: variant.id, props } as SectionEntry;
    const registryView = render(<Registered section={section} theme={themeModule.THEME as ThemeTokens} />);
    const expectedMarkup = registryView.container.innerHTML;
    registryView.unmount();

    const generatedView = render(<Navbar props={props} variantId={variant.id} />);
    expect(normalizeRadixIds(generatedView.container.innerHTML)).toBe(normalizeRadixIds(expectedMarkup));
    expect(generatedView.container.querySelector('[data-ut-mobile-navigation]')).toHaveAttribute('data-ut-mobile-navigation', 'radix');
    expect(generatedView.getByText('Book a consult')).toHaveAttribute('data-ut-intent', 'booking.create');
  });

  it('opens a canonical Dialog drawer and prefers explicit identity', () => {
    const view = render(<Navbar props={{ ...props, layout: 'standard' }} variantId="navbar:minimal-dark" />);
    expect(view.container.querySelector('[data-ut-variant]')).toHaveAttribute('data-ut-variant', 'navbar:minimal-dark');
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }));
    expect(screen.getByRole('dialog')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Services' })).toHaveAttribute('data-ut-intent', 'navigation.services');
    fireEvent.click(screen.getByRole('button', { name: 'Close navigation' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    view.rerender(<Navbar props={{ ...props, layout: 'centered-logo' }} />);
    expect(view.container.querySelector('[data-ut-variant]')).toHaveAttribute('data-ut-variant', 'navbar:centered-logo');
  });
});