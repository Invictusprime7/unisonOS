export function canClaimRelease(priceCents: number, activeEntitlement: boolean): boolean {
  return priceCents === 0 || activeEntitlement;
}