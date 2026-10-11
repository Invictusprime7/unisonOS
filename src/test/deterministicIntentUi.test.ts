import { describe, expect, it } from 'vitest';

import {
  hasInlineIntentTarget,
  resolveDeterministicIntentSurface,
  type PreviewIntentInventory,
} from '@/runtime/deterministicIntentUi';
import { buildRoutePolicy } from '@/platform/core/routePolicy';
import { resolvePreviewAction } from '@/utils/previewActionResolver';

const emptyInventory: PreviewIntentInventory = {
  sectionIntents: [],
  presentIds: [],
  formIntents: [],
  navHrefs: [],
};

describe('deterministicIntentUi', () => {
  it('prefers inline handling when a matching form already exists', () => {
    const inventory: PreviewIntentInventory = {
      ...emptyInventory,
      formIntents: ['contact.submit'],
      presentIds: ['contact'],
    };

    expect(hasInlineIntentTarget('contact.submit', inventory)).toBe(true);
    expect(resolveDeterministicIntentSurface('contact.submit', {}, inventory)).toEqual({ kind: 'inline' });
  });

  it('returns "none" for form-driven intents without inline targets (no preset overlay)', () => {
    expect(resolveDeterministicIntentSurface('quote.request', {}, emptyInventory)).toEqual({ kind: 'none' });
    expect(resolveDeterministicIntentSurface('newsletter.subscribe', {}, emptyInventory)).toEqual({ kind: 'none' });
  });

  it('no longer auto-opens the cart drawer for generic checkout buttons', () => {
    expect(resolveDeterministicIntentSurface('checkout.start', {}, emptyInventory)).toEqual({ kind: 'none' });
    expect(resolveDeterministicIntentSurface('pay.checkout', {}, emptyInventory)).toEqual({ kind: 'none' });
  });

  it('returns "none" even for explicit plan checkout — wiring is AI-driven now', () => {
    expect(
      resolveDeterministicIntentSurface('pay.checkout', { plan: 'starter' }, emptyInventory),
    ).toEqual({ kind: 'none' });
  });
});

describe('resolvePreviewAction', () => {
  const neutralClassification = {
    category: 'general',
    suggestedPageType: null,
  } as const;

  it('still scrolls to existing inline targets (passive UX, not a wired action)', () => {
    const inventory: PreviewIntentInventory = {
      ...emptyInventory,
      formIntents: ['contact.submit'],
      presentIds: ['contact'],
    };

    expect(resolvePreviewAction(
      'contact.submit',
      'Contact Us',
      inventory,
      {},
      neutralClassification as never,
      false,
      {},
    )).toEqual({
      action: 'scroll',
      command: 'contact.scroll',
    });
  });

  it('acknowledges (no overlay/cart) when intent has no inline target and no AI-wired binding', () => {
    expect(resolvePreviewAction(
      'contact.submit',
      'Contact Us',
      emptyInventory,
      {},
      neutralClassification as never,
      false,
      {},
    )).toEqual({ action: 'acknowledge' });

    expect(resolvePreviewAction(
      'pay.checkout',
      'Checkout',
      emptyInventory,
      {},
      neutralClassification as never,
      false,
      {},
    )).toEqual({ action: 'acknowledge' });
  });

  it('routes portfolio and case-study labels through the shared affinity vocabulary', () => {
    expect(resolvePreviewAction(
      'nav.goto',
      'View Case Study',
      { ...emptyInventory, navHrefs: ['/case-studies'] },
      { '/src/pages/CaseStudies.tsx': 'export default function CaseStudies(){return null}' },
      { category: 'redirect', confidence: 1, suggestedPageType: 'gallery', reason: 'test' },
      false,
      {},
    )).toEqual({
      action: 'navigate',
      route: '/case-studies',
      vfsPath: '/src/pages/CaseStudies.tsx',
    });
  });
});

describe('buildRoutePolicy', () => {
  it('maps commerce checkout intents to the single canonical checkout route', () => {
    const policy = buildRoutePolicy(
      [{ path: '/', title: 'Home' } as never],
      ['commerce'],
    );

    expect(policy.ctaRouteMap['cart.checkout']).toBe('/checkout');
    expect(policy.ctaRouteMap['pay.checkout']).toBe('/checkout');
    expect(policy.overlayRoutes).toContain('/checkout');
  });
});
