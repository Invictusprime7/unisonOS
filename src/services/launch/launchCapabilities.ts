import type { CapabilityId } from '@/platform/core/capabilityRegistry';

const PRODUCT_COMMERCE_CAPABILITIES: readonly CapabilityId[] = [
  'commerce',
];

export function resolveLaunchCapabilities(
  industryDefaults: readonly CapabilityId[],
  sellsProducts: boolean,
): CapabilityId[] {
  const resolved = [...industryDefaults];
  if (!sellsProducts) return resolved;

  const seen = new Set(resolved);
  for (const capability of PRODUCT_COMMERCE_CAPABILITIES) {
    if (seen.has(capability)) continue;
    seen.add(capability);
    resolved.push(capability);
  }
  return resolved;
}