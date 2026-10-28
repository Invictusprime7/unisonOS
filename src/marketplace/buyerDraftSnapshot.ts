import type { SiteBundleSnapshot } from '@/platform/core/canonicalPipeline';

/** Carry design and intent identities, never the seller's operational approvals. */
export function buyerDraftSnapshot(snapshot: SiteBundleSnapshot): SiteBundleSnapshot {
  const productIds = new Map(Object.keys(snapshot.creatorData?.products ?? {})
    .map((id) => [id, `buyer-product:${crypto.randomUUID()}`]));
  const products = Object.fromEntries(Object.entries(snapshot.creatorData?.products ?? {}).map(([id, product]) => {
    const productId = productIds.get(id)!;
    return [productId, { ...product, productId }];
  }));
  const componentInstances = Object.fromEntries(Object.entries(snapshot.componentInstances ?? {})
    .map(([id, component]) => [id, { ...component, bindings: {} }]));
  const bindings = Object.fromEntries(Object.entries(snapshot.bindings ?? {}).map(([id, binding]) => [id, {
    ...binding,
    ...(binding.targetType === 'product' && productIds.has(binding.targetId)
      ? { targetId: productIds.get(binding.targetId)! }
      : {}),
  }]));
  return { ...snapshot, businessSystem: undefined, calendars: {}, popups: {},
    bindings,
    componentInstances,
    creatorData: {
      ...snapshot.creatorData,
      products,
      collections: Object.fromEntries(Object.entries(snapshot.creatorData?.collections ?? {}).map(([id, collection]) => [id, {
        ...collection,
        itemIds: collection.itemIds.map((itemId) => productIds.get(itemId) ?? itemId),
      }])),
      componentInstances,
    },
  };
}