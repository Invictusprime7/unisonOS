import { describe, expect, it } from 'vitest';
import { clarifyBuilderRequest } from '@/services/builder/conversationalClarifier';
import { normalizeColorValue, normalizeThemeTokenValue } from '@/services/theme/themeValueNormalize';
import { findIntentRetargets, isRequestedRetarget } from '@/services/agent-runtime/intentInvariant';
import { permittedBuilderIntents } from '@/services/builder/canonicalAuthoringRequest';
import { rebaseTextEdit } from '@/services/builder/textEditRebase';

describe('conversational clarifier', () => {
  it('offers Unison nav options for an open-ended nav request', () => {
    const ask = clarifyBuilderRequest('make the navbar look more premium');
    expect(ask?.options.map((o) => o.label)).toEqual(['Floating pill nav', 'Minimal dark nav', 'Centered logo nav', 'Your call']);
  });
  it('applies clear requests directly', () => {
    expect(clarifyBuilderRequest('Turn navbar into a floating nav')).toBeNull();
    expect(clarifyBuilderRequest('change the primary color to #1f6f4a')).toBeNull();
  });
  it('never asks again for a chosen option', () => {
    const ask = clarifyBuilderRequest('improve the hero')!;
    for (const option of ask.options) expect(clarifyBuilderRequest(option.reply)).toBeNull();
  });
});

describe('theme value normalization', () => {
  it('turns hex, rgb and named colors into token HSL', () => {
    expect(normalizeColorValue('#ffffff')).toBe('0 0% 100%');
    expect(normalizeColorValue('rgb(0, 0, 0)')).toBe('0 0% 0%');
    expect(normalizeColorValue('hsl(150, 40%, 30%)')).toBe('150 40% 30%');
    expect(normalizeColorValue('deep forest')).toMatch(/^\d+(\.\d+)? \d+(\.\d+)?% \d+(\.\d+)?%$/);
  });
  it('snaps weights and clamps sizes', () => {
    expect(normalizeThemeTokenValue('--ut-weight-display', 'bold', false)).toBe('700');
    expect(normalizeThemeTokenValue('--ut-weight-body', '450', false)).toBe('500');
    expect(normalizeThemeTokenValue('--radius', '400px', false)).toBe('200px');
  });
});

describe('button destinations', () => {
  const before = { '/src/pages/Home.tsx': '<a data-ut-intent="nav.goto" href="/menu">Menu</a>' };
  const after = { '/src/pages/Home.tsx': '<a data-ut-intent="nav.goto" href="/book">Menu</a>' };
  it('allows a change the user asked for', () => {
    const [violation] = findIntentRetargets(before, after);
    expect(isRequestedRetarget('make the menu button link to the booking page', violation)).toBe(true);
  });
  it('still blocks an unrequested change', () => {
    const [violation] = findIntentRetargets(before, after);
    expect(isRequestedRetarget('make the hero bigger', violation)).toBe(false);
  });
});

describe('authoring vocabulary', () => {
  it('approves universal intents and keeps capability-bound ones tied to their capability', () => {
    expect(permittedBuilderIntents(undefined)).toContain('nav.goto');
    expect(permittedBuilderIntents(undefined)).not.toContain('booking.create');
  });
  it('replays a held edit only when its spot is found', () => {
    expect(rebaseTextEdit('<p>a</p><p>b</p>', '<p>A</p><p>b</p>', '<p>a</p><p>b</p><p>c</p>').status).toBe('applied');
  });
});
