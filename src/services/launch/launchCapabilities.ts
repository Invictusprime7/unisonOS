import { getCapability, type CapabilityId } from '@/platform/core/capabilityRegistry';
import type { BusinessCapability } from '@/platform/core/capabilityPacks';
import { getIndustryProfile, normalizeIndustryKey } from '@/platform/core/industryMatrix';
import type { CustomerNeed, PageChoice, PrimaryGoal } from '@/components/onboarding/wizard/wizardCatalog';

export const BUSINESS_LAUNCH_PLAN_VERSION = 'unison-business-launch-plan/1' as const;

export interface BusinessLaunchPlan {
  version: typeof BUSINESS_LAUNCH_PLAN_VERSION;
  canonicalIndustryId: string | null;
  journeyId: string;
  primaryGoal: PrimaryGoal | null;
  customerNeeds: CustomerNeed[];
  requestedIntents: string[];
  primaryIntent: string | null;
  automationPack: string | null;
  operationalCapabilities: CapabilityId[];
  businessCapabilities: BusinessCapability[];
  blockedRequests: string[];
}

const GOAL_CAPABILITIES: Partial<Record<PrimaryGoal, CapabilityId>> = {
  collect_leads: 'lead-capture',
  book_appointments: 'booking',
  sell_offers: 'commerce',
  drive_calls: 'contact',
  grow_email_list: 'newsletter',
  donate: 'donation',
};

const NEED_CAPABILITIES: Partial<Record<CustomerNeed, CapabilityId>> = {
  request_quote: 'quoting',
  book_service: 'booking',
  buy_offer: 'commerce',
  fill_form: 'lead-capture',
};

const GOAL_INTENTS: Partial<Record<PrimaryGoal, readonly string[]>> = {
  collect_leads: ['lead.capture', 'contact.submit'],
  book_appointments: ['booking.create'],
  sell_offers: ['cart.add', 'cart.checkout'],
  drive_calls: ['contact.call', 'contact.submit'],
  grow_email_list: ['newsletter.subscribe'],
  donate: ['donation.start'],
};

const NEED_INTENTS: Partial<Record<CustomerNeed, readonly string[]>> = {
  request_quote: ['quote.request'],
  book_service: ['booking.create'],
  buy_offer: ['cart.add'],
  fill_form: ['contact.submit'],
};

const PAGE_INTENTS: Partial<Record<PageChoice, readonly string[]>> = {
  contact: ['contact.submit'],
  booking: ['booking.create'],
  shop: ['cart.add'],
  checkout: ['cart.checkout'],
};

export function resolveLaunchBusinessCapabilities(
  focusedIntent: { primaryGoal?: PrimaryGoal | null; customerNeeds?: readonly CustomerNeed[] } = {},
): BusinessCapability[] {
  const requested = new Set<BusinessCapability>(['business_profile']);
  const add = (...capabilities: BusinessCapability[]) => capabilities.forEach((capability) => requested.add(capability));

  switch (focusedIntent.primaryGoal) {
    case 'collect_leads':
      add('crm.leads', 'crm.contacts', 'forms.contact');
      break;
    case 'book_appointments':
      add('catalog.services', 'booking.appointments', 'crm.contacts');
      break;
    case 'sell_offers':
      add('catalog.products', 'commerce.cart', 'commerce.checkout', 'crm.contacts');
      break;
    case 'drive_calls':
      add('forms.contact', 'crm.leads');
      break;
    case 'grow_email_list':
      add('crm.leads', 'notifications.email');
      break;
    case 'donate':
      add('commerce.checkout', 'crm.contacts', 'notifications.email');
      break;
  }

  for (const need of focusedIntent.customerNeeds ?? []) {
    switch (need) {
      case 'request_quote':
        add('forms.quote', 'crm.leads');
        break;
      case 'book_service':
        add('catalog.services', 'booking.appointments', 'crm.contacts');
        break;
      case 'buy_offer':
        add('catalog.products', 'commerce.cart', 'commerce.checkout', 'crm.contacts');
        break;
      case 'fill_form':
        add('forms.contact', 'crm.leads');
        break;
      case 'browse_services':
        add('catalog.services');
        break;
    }
  }

  return [...requested];
}

export function resolveLaunchCapabilities(
  industryDefaults: readonly CapabilityId[],
  industry: string,
  focusedIntent: { primaryGoal?: PrimaryGoal | null; customerNeeds?: readonly CustomerNeed[] } = {},
): CapabilityId[] {
  const resolved = [...industryDefaults];
  const seen = new Set(resolved);
  const requested = new Set<CapabilityId>();
  const goalCapability = focusedIntent.primaryGoal && GOAL_CAPABILITIES[focusedIntent.primaryGoal];
  if (goalCapability) requested.add(goalCapability);
  for (const need of focusedIntent.customerNeeds ?? []) {
    const capability = NEED_CAPABILITIES[need];
    if (capability) requested.add(capability);
  }

  const normalizedIndustry = normalizeIndustryKey(industry);
  for (const capability of requested) {
    if (seen.has(capability)) continue;
    if (!getCapability(capability).supportedIndustries.includes(normalizedIndustry)) continue;
    seen.add(capability);
    resolved.push(capability);
  }
  return resolved;
}

export function resolveBusinessLaunchPlan(input: {
  industry: string;
  primaryGoal?: PrimaryGoal | null;
  customerNeeds?: readonly CustomerNeed[];
  selectedPages?: readonly PageChoice[];
}): BusinessLaunchPlan {
  const profile = getIndustryProfile(input.industry);
  const canonicalIndustryId = profile?.industry ?? null;
  const primaryGoal = input.primaryGoal ?? null;
  const customerNeeds = [...new Set(input.customerNeeds ?? [])];
  const focusedIntent = { primaryGoal, customerNeeds };
  const requestedOperational = new Set<CapabilityId>();
  const goalCapability = primaryGoal ? GOAL_CAPABILITIES[primaryGoal] : undefined;
  if (goalCapability) requestedOperational.add(goalCapability);
  for (const need of customerNeeds) {
    const capability = NEED_CAPABILITIES[need];
    if (capability) requestedOperational.add(capability);
  }

  const blockedRequests = profile
    ? [...requestedOperational].filter((capability) =>
        !profile.defaultCapabilities.includes(capability)
        && !getCapability(capability).supportedIndustries.includes(canonicalIndustryId),
      )
    : ['industry:not-registered'];
  const operationalCapabilities = profile
    ? resolveLaunchCapabilities(profile.defaultCapabilities, canonicalIndustryId, focusedIntent)
    : [];
  // Unsupported goal/need choices are dropped, not fatal.
  const blockedSet = new Set(blockedRequests);
  const supportedIntent = {
    primaryGoal: goalCapability && blockedSet.has(goalCapability) ? null : primaryGoal,
    customerNeeds: customerNeeds.filter((need) => {
      const capability = NEED_CAPABILITIES[need];
      return !capability || !blockedSet.has(capability);
    }),
  };
  const requestedIntents = new Set<string>([
    ...(supportedIntent.primaryGoal ? GOAL_INTENTS[supportedIntent.primaryGoal] ?? [] : []),
    ...supportedIntent.customerNeeds.flatMap((need) => NEED_INTENTS[need] ?? []),
    ...(input.selectedPages ?? []).flatMap((page) => PAGE_INTENTS[page] ?? []),
  ]);
  const requestedIntentList = [...requestedIntents];
  const businessCapabilities = profile
    ? resolveLaunchBusinessCapabilities(supportedIntent)
    : ['business_profile' as const];

  return {
    version: BUSINESS_LAUNCH_PLAN_VERSION,
    canonicalIndustryId,
    journeyId: `${canonicalIndustryId ?? normalizeIndustryKey(input.industry)}:${primaryGoal ?? 'unspecified'}`,
    primaryGoal,
    customerNeeds,
    requestedIntents: requestedIntentList,
    primaryIntent: requestedIntentList[0] ?? null,
    automationPack: profile?.automationPack ?? null,
    operationalCapabilities,
    businessCapabilities,
    blockedRequests,
  };
}