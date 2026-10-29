/**
 * Intent Normalizer regression tests.
 * Locks the playground → CoreIntent mapping so renames cannot silently drift.
 */

import { describe, it, expect } from 'vitest';
import { inferUIAction, normalizePlaygroundIntent } from '@/platform/core/intentNormalizer';

describe('normalizePlaygroundIntent', () => {
  it('maps navigation intents to nav.goto', () => {
    expect(normalizePlaygroundIntent('nav.goto_page')).toBe('nav.goto');
    expect(normalizePlaygroundIntent('funnel.goto_step')).toBe('nav.goto');
    expect(normalizePlaygroundIntent('product.view')).toBe('product.view');
  });

  it('maps form.open to contact.submit by default', () => {
    expect(normalizePlaygroundIntent('form.open')).toBe('contact.submit');
  });

  it('routes form.open to quote.request when targetType=quote', () => {
    expect(normalizePlaygroundIntent('form.open', 'quote')).toBe('quote.request');
    expect(normalizePlaygroundIntent('form.open', 'quote_request')).toBe('quote.request');
  });

  it('routes form.open to lead.capture when targetType=lead', () => {
    expect(normalizePlaygroundIntent('form.open', 'lead')).toBe('lead.capture');
    expect(normalizePlaygroundIntent('form.open', 'lead_capture')).toBe('lead.capture');
  });

  it('routes reusable intake and inquiry forms to lead.capture', () => {
    expect(normalizePlaygroundIntent('form.open', 'demo_request')).toBe('lead.capture');
    expect(normalizePlaygroundIntent('form.open', 'project_inquiry')).toBe('lead.capture');
    expect(normalizePlaygroundIntent('form.open', 'volunteer')).toBe('lead.capture');
  });

  it('routes newsletter forms to newsletter.subscribe', () => {
    expect(normalizePlaygroundIntent('form.open', 'newsletter')).toBe('newsletter.subscribe');
    expect(normalizePlaygroundIntent('form.open', 'waitlist')).toBe('newsletter.subscribe');
  });

  it('maps booking and checkout intents canonically', () => {
    expect(normalizePlaygroundIntent('calendar.open')).toBe('booking.create');
    expect(normalizePlaygroundIntent('checkout.start')).toBe('pay.checkout');
  });

  it('maps external/anchor intents', () => {
    expect(normalizePlaygroundIntent('external.open')).toBe('nav.external');
    expect(normalizePlaygroundIntent('popup.open')).toBe('nav.anchor');
  });

  it('preserves canonical icon intents and classifies their UI actions', () => {
    for (const intent of ['account.open', 'menu.open', 'search.open', 'filter.open', 'sort.open', 'favorite.toggle', 'share.open', 'chat.open'] as const) {
      expect(normalizePlaygroundIntent(intent)).toBe(intent);
    }
    expect(inferUIAction('search.open')).toBe('state');
    expect(inferUIAction('favorite.toggle')).toBe('state');
    expect(inferUIAction('menu.open')).toBe('overlay');
  });

  it('falls back to nav.goto for unknown intents', () => {
    expect(normalizePlaygroundIntent('totally.unknown' as never)).toBe('nav.goto');
  });
});
