import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  hasAnySiteCapability,
  hasRequiredSiteCapabilities,
  requiredSiteCapabilitiesForIntent,
} from '../../supabase/functions/_shared/siteCapabilityPolicy';

describe('backend site capability policy', () => {
  it('denies booking without the installed booking pack', () => {
    expect(hasRequiredSiteCapabilities([], requiredSiteCapabilitiesForIntent('booking.create') ?? [])).toBe(false);
  });

  it('requires every pack for ecommerce cart writes', () => {
    const required = requiredSiteCapabilitiesForIntent('cart.add') ?? [];
    expect(hasRequiredSiteCapabilities(['commerce.cart'], required)).toBe(false);
    expect(hasRequiredSiteCapabilities(['catalog.products', 'commerce.cart'], required)).toBe(true);
  });

  it('denies checkout until commerce checkout is enabled', () => {
    const required = requiredSiteCapabilitiesForIntent('cart.checkout') ?? [];
    expect(hasRequiredSiteCapabilities(['commerce.cart', 'catalog.products'], required)).toBe(false);
    expect(hasRequiredSiteCapabilities(['commerce.checkout'], required)).toBe(true);
  });

  it('accepts a legacy booking alias without weakening pack requirements', () => {
    expect(hasAnySiteCapability(['booking'], ['booking', 'booking.appointments'])).toBe(true);
    expect(hasAnySiteCapability([], ['booking', 'booking.appointments'])).toBe(false);
  });

  it('checks enabled site capabilities before intent and direct checkout dispatch', () => {
    const intentExec = readFileSync(resolve(process.cwd(), 'supabase/functions/intent-exec/index.ts'), 'utf8');
    const checkout = readFileSync(resolve(process.cwd(), 'supabase/functions/create-order-checkout/index.ts'), 'utf8');
    const articleReader = readFileSync(resolve(process.cwd(), 'supabase/functions/site-runtime-read/index.ts'), 'utf8');

    expect(intentExec).toContain('requiredSiteCapabilitiesForIntent(intentId)');
    expect(intentExec).toContain('hasRequiredSiteCapabilities(enabledIds, requiredSiteCapabilities)');
    expect(checkout).toContain('requiredSiteCapabilitiesForIntent("cart.checkout")');
    expect(checkout.indexOf('hasRequiredSiteCapabilities(enabledIds, requiredCapabilities)'))
      .toBeLessThan(checkout.indexOf('const { data: order, error: orderError }'));
    expect(articleReader).toContain('hasRequiredSiteCapabilities(');
    expect(articleReader).toContain('["cms.content"]');
  });
});