import { describe, expect, it } from 'vitest';
import { buyerDraftSnapshot } from '@/marketplace/buyerDraftSnapshot';
import type { SiteBundleSnapshot } from '@/platform/core/canonicalPipeline';
describe('marketplace buyer operational isolation', () => {
  it('does not inherit seller capability approvals or bound resources', () => {
    const seller = { businessSystem: { capabilities: [{ id: 'commerce', status: 'approved' }] }, calendars: { seller: {} }, popups: {}, componentInstances: { shop: { bindings: { products: 'seller-products' } } } } as unknown as SiteBundleSnapshot;
    const buyer = buyerDraftSnapshot(seller);
    expect(buyer.businessSystem).toBeUndefined();
    expect(buyer.calendars).toEqual({});
    expect(buyer.componentInstances.shop.bindings).toEqual({});
    expect(seller.componentInstances.shop.bindings).toEqual({ products: 'seller-products' });
  });
});