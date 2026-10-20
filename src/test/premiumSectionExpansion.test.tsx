import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transform } from '@babel/standalone';
import * as Dialog from '@radix-ui/react-dialog';
import * as icons from 'lucide-react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { getVariantById, getVariantsForSection } from '@/sections/variants';
import { getCompositionById } from '@/sections/templates';
import { compositionToReactFileSet } from '@/sections/compositionToFileSet';
import type { SectionEntry, ThemeTokens } from '@/sections/types';
import type { VariantId } from '@/sections/variants/types';
import { premiumFamilies, premiumSectionProps } from './fixtures/premiumSectionVariants';

const variants = [...premiumFamilies, 'features' as const, 'testimonials' as const].flatMap(family => getVariantsForSection(family).filter(v => v.tags?.includes('route-design') || v.tags?.includes('popular-source')));
const template = getCompositionById('salon-premium')!;
const theme = template.theme!;
afterEach(cleanup);
function loadModule(source: string, dependencies: Record<string, unknown> = {}) {
  const module = { exports: {} as Record<string, unknown> };
  const code = transform(source, { filename: 'generated.tsx', presets: ['typescript', 'react'], plugins: ['transform-modules-commonjs'] }).code!;
  const bare: Record<string, unknown> = { react: React, '@/unison/ui/icons': icons, '@/unison/ui/radix/dialog': Dialog };
  new Function('require', 'module', 'exports', code)((name: string) => {
    if (name in dependencies) return dependencies[name];
    if (name in bare) return bare[name];
    throw new Error('Unexpected portable dependency: ' + name);
  }, module, module.exports);
  return module.exports;
}
function renderVariant(id: VariantId, props = premiumSectionProps[id.split(':')[0] as keyof typeof premiumSectionProps]) {
  const variant = getVariantById(id)!;
  const Component = variant.component;
  return render(<Component section={{ id: 'proof', type: variant.sectionType, variantId: id, props } as SectionEntry} theme={theme} />);
}
describe('premium section registry to executable VFS', () => {
  it.each(variants)('$id renders the same canonical component and content', variant => {
    const section = { id: 'proof', type: variant.sectionType, variantId: variant.id, props: premiumSectionProps[variant.sectionType] } as SectionEntry;
    const files = compositionToReactFileSet({ ...template, sections: [section] }, '/src/pages/Home.tsx');
    const component = variant.sectionType === 'faq' ? 'FAQ' : variant.sectionType[0].toUpperCase() + variant.sectionType.slice(1);
    const themeModule = loadModule(files['/src/components/theme.ts']);
    const recipe = files['/src/components/recipes/' + component + '.ts'];
    const Emitted = loadModule(files['/src/components/' + component + '.tsx'], {
      './theme': themeModule, ['./recipes/' + component]: loadModule(recipe),
    }).default as React.ComponentType<{ props: unknown; variantId: string }>;
    const Registered = variant.component;
    expect(renderToStaticMarkup(<Emitted props={section.props} variantId={variant.id} />)).toBe(renderToStaticMarkup(<Registered section={section} theme={themeModule.THEME as ThemeTokens} />));
    expect(files['/src/pages/Home.tsx']).toContain(variant.id);
    expect(recipe).not.toMatch(/from ["'](?:next|motion|https?:)/);
    expect(variant.source?.sourceUrl).toContain('21st.dev/');
  });
  it('searches FAQ answers, reports empty results and restores every answer', () => {
    const view = renderVariant('faq:searchable');
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'availability' } });
    expect(view.container.querySelectorAll('details')).toHaveLength(1);
    expect(screen.getByText('Can I change my booking?')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'no-such-topic' } });
    expect(screen.getByRole('status')).toHaveTextContent('0 answers');
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '' } });
    expect(view.container.querySelectorAll('details')).toHaveLength(4);
  });
  it('labels every form control, preserves custom fields and delegates submission', () => {
    const view = renderVariant('contact:editorial-form', { ...premiumSectionProps.contact, submitIntent: 'quote.request', fields: [{ name: 'email', type: 'email', required: true }, { name: 'project_details', type: 'textarea', required: true }] });
    expect(screen.getByLabelText('email', { exact: false })).toHaveAttribute('required');
    expect(screen.getByLabelText('project details', { exact: false })).toHaveAttribute('name', 'project_details');
    expect(view.container.querySelector('form')).toHaveAttribute('data-ut-intent', 'quote.request');
    expect(view.container.querySelector('form')?.checkValidity()).toBe(false);
  });
  it('only embeds a map when requested and keeps encoded directions available', () => {
    const view = renderVariant('contact:map-studio');
    expect(view.container.querySelector('iframe')).toBeNull();
    expect(screen.getByRole('link', { name: /Get directions/ })).toHaveAttribute('href', expect.stringContaining('Chicago'));
    view.unmount();
    renderVariant('contact:map-studio', { ...premiumSectionProps.contact, showMap: true });
    expect(screen.getByTitle(/Map of/)).toHaveAttribute('loading', 'lazy');
  });
  it('checkout delegates to the cart runtime and never collects payment credentials', () => {
    const view = renderVariant('contact:checkout-panel');
    expect(screen.getByRole('button', { name: /Continue to checkout/ })).toHaveAttribute('data-ut-intent', 'cart.checkout');
    expect(view.container.querySelector('input[name="cardNumber"]')).toBeNull();
    expect(view.container.querySelector('form')).toHaveAttribute('data-ut-intent', 'contact.submit');
  });
  it('opens and closes the case-study lightbox and filters projects', () => {
    renderVariant('gallery:case-study');
    fireEvent.click(screen.getByRole('button', { name: /View image.*Sunlit/ }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close gallery' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Branding' }));
    expect(screen.queryByText('A quieter kind of workspace')).not.toBeInTheDocument();
  });
});
