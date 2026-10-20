import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as icons from 'lucide-react';
import { transform } from '@babel/standalone';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { compositionToReactFileSet } from '@/sections/compositionToFileSet';
import { getCompositionById } from '@/sections/templates';
import { getLayoutForVariantId, getRequiredRadixPrimitives, getVariantsForSection } from '@/sections/variants';
import { buildGeneratedUiFoundation } from '@/platform/core/generatedUiFoundation';
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

const template = getCompositionById('salon-premium')!;
const files = compositionToReactFileSet(template, '/src/pages/Home.tsx');
const themeModule = loadModule(files['/src/components/theme.ts']);
const Gallery = loadModule(files['/src/components/Gallery.tsx'], {
  './theme': themeModule,
  './recipes/Gallery': loadModule(files['/src/components/recipes/Gallery.ts']),
}).default as React.ComponentType<{
  props: SectionEntry<'gallery'>['props'] & { layout?: string }; variantId?: string;
}>;
const props: SectionEntry<'gallery'>['props'] = {
  headline: 'Our Work', filterable: true,
  items: [
    { src: '/first.jpg', alt: 'First result', category: 'Cut' },
    { src: '/second.jpg', alt: 'Second result', category: 'Color' },
  ],
};

describe('Gallery registry and emitted renderer parity', () => {
  it.each(getVariantsForSection('gallery'))('keeps failed media usable in emitted $id', variant => {
    render(<Gallery props={props} variantId={variant.id} />);
    fireEvent.error(screen.getByRole('img', { name: 'First result' }));
    expect(screen.getByRole('img', { name: 'First result: image unavailable' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'First result' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.error(within(dialog).getByRole('img', { name: 'First result' }));
    expect(within(dialog).getByRole('img', { name: 'First result: image unavailable' })).toBeVisible();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Next image' }));
    expect(within(dialog).getByRole('img', { name: 'Second result' })).toHaveAttribute('src', '/second.jpg');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close gallery' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it.each(['gallery:masonry', 'gallery:cinematic-grid', 'gallery:lightbox-grid'])('keeps %s responsive while honoring desktop columns', variantId => {
    for (const columns of [2, 3, 4] as const) {
      const view = render(<Gallery props={{ ...props, columns }} variantId={variantId} />);
      const figure = view.container.querySelector('figure')!;
      const layout = variantId === 'gallery:masonry' ? figure.parentElement!.parentElement! : figure.parentElement!;
      const prefix = variantId === 'gallery:masonry' ? 'columns' : 'grid-cols';
      expect(layout).toHaveClass(`${prefix}-1`, `sm:${prefix}-2`, `lg:${prefix}-${columns}`);
      expect(layout.style.columnCount).toBe('');
      expect(layout.style.gridTemplateColumns).toBe('');
      view.unmount();
    }
  });

  it.each(getVariantsForSection('gallery'))('traps and restores focus for $id', async variant => {
    render(<Gallery props={props} variantId={variant.id} />);
    const trigger = screen.getByRole('button', { name: 'First result' });
    trigger.focus();
    fireEvent.click(trigger);
    const close = screen.getByRole('button', { name: 'Close gallery' });
    const next = screen.getByRole('button', { name: 'Next image' });
    expect(close).toHaveFocus();
    expect(trigger.closest('[aria-hidden="true"]')).not.toBeNull();
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
    expect(next).toHaveFocus();
    fireEvent.keyDown(next, { key: 'Tab' });
    expect(close).toHaveFocus();
    trigger.focus();
    expect(screen.getByRole('dialog')).toContainElement(document.activeElement as HTMLElement);
    fireEvent.click(close);
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(trigger.closest('[aria-hidden="true"]')).toBeNull();
  });

  it('releases background isolation when live gallery items disappear', async () => {
    const view = render(<Gallery props={props} variantId="gallery:editorial-mosaic" />);
    const trigger = screen.getByRole('button', { name: 'First result' });
    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.getByRole('dialog')).toBeVisible();
    view.rerender(<Gallery props={{ ...props, items: [] }} variantId="gallery:editorial-mosaic" />);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(view.container.closest('[aria-hidden="true"]')).toBeNull();
    expect(document.body.style.pointerEvents).not.toBe('none');
  });

  it('resolves declared Gallery behavior through the generated Dialog facade', () => {
    const variants = getVariantsForSection('gallery');
    for (const variant of variants) expect(variant.radixPrimitives).toContain('dialog');
    const required = getRequiredRadixPrimitives(variants.map(variant => variant.id));
    expect(required).toEqual(['dialog']);
    const foundation = buildGeneratedUiFoundation({ industry: 'salon', themePresetId: 'editorial', requiredRadixPrimitives: required });
    expect(foundation.files['/src/unison/ui/radix/dialog.ts']).toContain('@radix-ui/react-dialog');
    const recipe = files['/src/components/recipes/Gallery.ts'];
    expect(recipe).toContain('@/unison/ui/radix/dialog');
    expect(recipe).toContain('@/unison/ui/icons');
    expect(recipe).not.toContain('@radix-ui/react-dialog');
    expect(recipe).not.toContain('lucide-react');
  });

  it.each(getVariantsForSection('gallery'))('resolves legacy layout aliases to registered $id', variant => {
    for (const layout of [getLayoutForVariantId(variant.id), variant.slug]) {
      const view = render(<Gallery props={{ ...props, layout }} />);
      expect(view.container.querySelector('[data-ut-variant]')).toHaveAttribute('data-ut-variant', variant.id);
      view.unmount();
    }
  });

  it('prefers explicit identity over layout and preserves the legacy reel', () => {
    const view = render(<Gallery props={{ ...props, layout: 'masonry' }} variantId="gallery:feature-split" />);
    expect(view.container.querySelector('[data-ut-variant]')).toHaveAttribute('data-ut-variant', 'gallery:feature-split');
    view.rerender(<Gallery props={{ ...props, layout: 'reel' }} />);
    expect(view.container.querySelector('[data-ut-variant]')).toHaveAttribute('data-ut-variant', 'gallery:horizontal-reel');
  });

  it.each(getVariantsForSection('gallery'))('does not fabricate content for empty $id', variant => {
    render(<Gallery props={{ headline: 'Our Work', items: [] }} variantId={variant.id} />);
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it.each(getVariantsForSection('gallery'))('renders the same structure and behavior for $id', variant => {
    const Registered = variant.component;
    const section = { id: 'gallery-proof', type: 'gallery', variantId: variant.id, props } as SectionEntry;
    const registryView = render(<Registered section={section} theme={themeModule.THEME as ThemeTokens} />);
    const expectedMarkup = registryView.container.innerHTML;
    registryView.unmount();

    const generatedView = render(<Gallery props={props} variantId={variant.id} />);
    expect(generatedView.container.innerHTML).toBe(expectedMarkup);
    fireEvent.click(screen.getByRole('button', { name: 'First result' }));
    expect(screen.getByRole('dialog', { name: 'First result' })).toBeVisible();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'ArrowRight' });
    expect(screen.getByRole('dialog', { name: 'Second result' })).toBeVisible();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Color' }));
    expect(screen.queryByRole('button', { name: 'First result' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Second result' })).toBeVisible();
  });
});