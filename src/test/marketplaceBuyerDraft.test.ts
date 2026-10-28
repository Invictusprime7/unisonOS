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

  it('rekeys seller products and remaps collection and binding references for the buyer', () => {
    const seller = {
      creatorData: {
        products: { 'seller-product': { productId: 'seller-product', name: 'Sunday cup', price: 38, currency: 'USD', sortOrder: 0 } },
        collections: { featured: { collectionId: 'featured', name: 'Featured', type: 'products', itemIds: ['seller-product'], sortOrder: 0 } },
        componentInstances: {},
      },
      bindings: { add: { bindingId: 'add', sourcePageId: 'home', sourceLabel: 'Add', intent: 'checkout.start', coreIntent: 'cart.add', targetId: 'seller-product', targetType: 'product', confidence: 1, source: 'manual', isValid: true } },
    } as unknown as SiteBundleSnapshot;
    const buyer = buyerDraftSnapshot(seller);
    const [buyerProductId] = Object.keys(buyer.creatorData.products);

    expect(buyerProductId).not.toBe('seller-product');
    expect(buyer.creatorData.products[buyerProductId].productId).toBe(buyerProductId);
    expect(buyer.creatorData.collections.featured.itemIds).toEqual([buyerProductId]);
    expect(buyer.bindings.add.targetId).toBe(buyerProductId);
    expect(seller.bindings.add.targetId).toBe('seller-product');
  });
});