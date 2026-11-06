const INTENT_SITE_CAPABILITIES: Readonly<Record<string, readonly string[]>> = {
  'booking.create': ['booking.appointments'],
  'product.view': ['catalog.products'],
  'cart.add': ['catalog.products', 'commerce.cart'],
  'cart.view': ['commerce.cart'],
  'cart.update': ['commerce.cart'],
  'cart.remove': ['commerce.cart'],
  'cart.checkout': ['commerce.checkout'],
  'pay.checkout': ['commerce.checkout'],
  'contact.submit': ['crm.leads'],
  'lead.capture': ['crm.leads'],
  'quote.request': ['crm.leads'],
  'newsletter.subscribe': ['crm.leads'],
  'auth.login': ['auth.customer'],
  'auth.register': ['auth.customer'],
  'auth.logout': ['auth.customer'],
};

export function requiredSiteCapabilitiesForIntent(intentId: string): readonly string[] | null {
  return INTENT_SITE_CAPABILITIES[intentId] ?? null;
}

export function hasRequiredSiteCapabilities(
  enabledCapabilityIds: readonly string[],
  requiredCapabilityIds: readonly string[],
): boolean {
  if (requiredCapabilityIds.length === 0) return false;
  const enabled = new Set(enabledCapabilityIds);
  return requiredCapabilityIds.every((capabilityId) => enabled.has(capabilityId));
}

export function hasAnySiteCapability(
  enabledCapabilityIds: readonly string[],
  acceptedCapabilityIds: readonly string[],
): boolean {
  const enabled = new Set(enabledCapabilityIds);
  return acceptedCapabilityIds.some((capabilityId) => enabled.has(capabilityId));
}