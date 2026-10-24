import type { SiteBundleSnapshot } from '@/platform/core/canonicalPipeline';

/** Carry design and intent identities, never the seller's operational approvals. */
export function buyerDraftSnapshot(snapshot: SiteBundleSnapshot): SiteBundleSnapshot {
  return { ...snapshot, businessSystem: undefined, calendars: {}, popups: {},
    componentInstances: Object.fromEntries(Object.entries(snapshot.componentInstances ?? {}).map(([id, component]) => [id, { ...component, bindings: {} }])),
  };
}