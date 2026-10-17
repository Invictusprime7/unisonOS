import React from 'react';
import * as Accordion from '@radix-ui/react-accordion';
import * as Dialog from '@radix-ui/react-dialog';
import * as icons from 'lucide-react';
import { transform } from '@babel/standalone';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import recipes from '@/sections/recipes/stylexRecipes.generated.json';
import { buildGeneratedUiFoundation } from '@/platform/core/generatedUiFoundation';
import { getVariantsForSection } from '@/sections/variants';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function loadRecipe(source: string) {
  const dependencies: Record<string, unknown> = {
    react: React,
    '@/unison/ui/radix/accordion': Accordion,
    '@/unison/ui/radix/dialog': Dialog,
    '@/unison/ui/icons': icons,
  };
  const module = { exports: {} as { default: React.FunctionComponent<Record<string, unknown>> } };
  const code = transform(source, { plugins: ['transform-modules-commonjs'] }).code!;
  new Function('require', 'module', 'exports', code)((name: string) => {
    if (!(name in dependencies)) throw new Error(`Unexpected generated dependency: ${name}`);
    return dependencies[name];
  }, module, module.exports);
  return module.exports.default;
}

const loadFaq = () => loadRecipe(recipes.faqModule);

describe('precompiled Radix and StyleX recipes', () => {
  it.each(['centered', 'split', 'unknown', 'toString', undefined])('maps non-variant FAQ layout %s to the registered accordion', layout => {
    const FAQ = loadFaq();
    const { container } = render(<FAQ props={{ layout, items: [{ question: 'Question?', answer: 'Answer.' }] }} />);
    expect(container.querySelector('[data-ut-variant]')?.getAttribute('data-ut-variant')).toBe('faq:accordion');
    expect(screen.getByRole('button', { name: 'Question?' }).getAttribute('aria-expanded')).toBe('false');
  });

  it('rejects an invalid explicit FAQ identity instead of silently replacing it', () => {
    const FAQ = loadFaq();
    expect(() => FAQ({ variantId: 'faq:not-registered', props: { layout: 'cards' } })).toThrow('Unsupported FAQ variant: faq:not-registered');
  });

  it('dismisses an open menu at the desktop breakpoint and releases its listener', async () => {
    const desktop = new EventTarget() as EventTarget & { matches: boolean };
    desktop.matches = false;
    const removeListener = vi.spyOn(desktop, 'removeEventListener');
    vi.stubGlobal('matchMedia', vi.fn(() => desktop));
    const Navigation = loadRecipe(recipes.mobileNavigationModule);
    render(<Navigation brand="Studio" />);
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }));
    expect(screen.getByRole('dialog')).toBeVisible();
    act(() => { desktop.matches = true; desktop.dispatchEvent(new Event('change')); });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(removeListener).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('opens navigation, preserves intents, dismisses with Escape and restores focus', async () => {
    const Navigation = loadRecipe(recipes.mobileNavigationModule);
    render(<Navigation brand="A studio with a very long business name" links={[{ label: 'Services', href: '#services', intent: 'nav.goto' }]} cta={{ label: 'Book Appointment', href: '#booking', intent: 'booking.create' }} />);
    const trigger = screen.getByRole('button', { name: 'Open navigation' });
    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.getByRole('dialog', { name: 'Navigation' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Services' })).toHaveAttribute('href', '#services');
    expect(screen.getByRole('link', { name: 'Book Appointment' })).toHaveAttribute('data-ut-intent', 'booking.create');
    expect(screen.getByRole('button', { name: 'Close navigation' })).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(trigger).toHaveFocus());
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('link', { name: 'Services' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('declares Dialog for every registered navbar and keeps StyleX out of runtime imports', () => {
    for (const variant of getVariantsForSection('navbar')) expect(variant.radixPrimitives).toContain('dialog');
    expect(recipes.mobileNavigationModule).toContain('export default');
    expect(recipes.mobileNavigationModule).not.toMatch(/from ["']@stylexjs|stylex\.create|injectStyle/);
  });

  it.each(getVariantsForSection('faq').filter(variant => ['faq:accordion', 'faq:two-column', 'faq:cards'].includes(variant.id)))('executes legacy StyleX $id without losing identity', variant => {
    const FAQ = loadFaq();
    const { container } = render(<FAQ variantId={variant.id} props={{
      headline: 'Questions', items: [{ question: 'Can I book?', answer: 'Choose a time.' }],
    }} />);
    expect(container.querySelector('[data-ut-variant]')).toHaveAttribute('data-ut-variant', variant.id);
    if (variant.id === 'faq:accordion') {
      expect(screen.getByRole('button', { name: 'Can I book?' })).toHaveAttribute('aria-expanded', 'false');
      expect(variant.radixPrimitives).toContain('accordion');
    } else {
      expect(screen.getByText('Choose a time.')).toBeVisible();
      expect(screen.queryByRole('button')).toBeNull();
    }
  });

  it('handles sparse and legacy question content without inventing answers', () => {
    const FAQ = loadFaq();
    render(<FAQ variantId="faq:cards" props={{ items: [null, {}, { title: 'Legacy question', body: 'Existing answer' }] }} />);
    expect(screen.getAllByRole('heading')).toHaveLength(1);
    expect(screen.getByText('Existing answer')).toBeVisible();
  });

  it('ships static styles through the canonical foundation without a StyleX compiler dependency', () => {
    expect(recipes.css).toContain('hsl(var(--background))');
    expect(recipes.css).toContain(':focus-visible');
    expect(recipes.css).toContain('overflow-wrap:anywhere');
    expect(recipes.faqModule).not.toMatch(/from ["']@stylexjs|stylex\.create|injectStyle/);
    const foundation = buildGeneratedUiFoundation({ industry: 'salon', themePresetId: 'editorial' });
    expect(foundation.files['/src/unison/ui/tailwind.css']).toContain(recipes.css);
    expect(foundation.files['/src/unison/ui/radix/accordion.ts']).toContain('@radix-ui/react-accordion');
  });

  it('renders accessible disclosure controls and preserves question content', () => {
    const FAQ = loadFaq();
    render(<FAQ props={{ headline: 'Planning Your Visit', items: [
      { question: 'How do I book?', answer: 'Choose an appointment.' },
      { question: 'Can I reschedule?', answer: 'Contact the studio.' },
    ] }} />);
    const first = screen.getByRole('button', { name: 'How do I book?' });
    const second = screen.getByRole('button', { name: 'Can I reschedule?' });
    expect(first).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(first);
    expect(first).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Choose an appointment.')).toBeVisible();
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowDown' });
    expect(second).toHaveFocus();
    fireEvent.click(second);
    expect(first).toHaveAttribute('aria-expanded', 'false');
    expect(second).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(second);
    expect(second).toHaveAttribute('aria-expanded', 'false');
  });
});