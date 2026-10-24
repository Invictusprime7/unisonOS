import { describe, expect, it } from 'vitest';
import { extractRuntimeRequirements } from '../../supabase/functions/marketplace-stage-release/runtimeRequirements';

describe('marketplace reusable capability requirements', () => {
  it('retains declared commerce and booking rather than silently making a functional template design-only', () => {
    const result = extractRuntimeRequirements({ businessSystem: { capabilities: [
      { id: 'commerce', status: 'provisioned', provides: ['commerce.cart'], approval: { approvedBy: 'creator' } },
      { id: 'booking', status: 'approved' }, { id: 'auth', status: 'failed' },
    ] } });
    expect(result.capabilityIds).toEqual(['booking', 'commerce']);
    expect(result.runtimeMode).toBe('requires-provisioning');
    expect(result.requiredResourceKeys).toContain('cart_items');
    expect(result.requiredResourceKeys).toContain('products');
    expect(JSON.stringify(result)).not.toContain('creator');
  });
  it('preserves slot intent identities but excludes creator record payloads and connected targets', () => {
    const result = extractRuntimeRequirements({ bindings: { add: {
      elementKey: 'home.shop-grid.product-cta', coreIntent: 'cart.add', sourceSlot: 'product-cta',
      requiredCapabilities: ['commerce'], targetId: 'creator-product',
      payloadTemplate: { businessId: 'creator-business', productId: 'creator-product' },
    } } });
    expect(result.bindings).toEqual([{ elementKey: 'home.shop-grid.product-cta', intent: 'cart.add', sourceSlot: 'product-cta', requiredCapabilities: ['commerce'] }]);
    expect(result.capabilityIds).toEqual(['commerce']);
    expect(JSON.stringify(result)).not.toContain('creator');
  });
  it('keeps unconfigured design templates design-only', () => {
    expect(extractRuntimeRequirements({}).runtimeMode).toBe('design-only');
  });
});