import { getCapability, type CapabilityId } from '@/platform/core/capabilityRegistry';
import { normalizeIndustryKey } from '@/platform/core/industryMatrix';
import type { CustomerNeed, PrimaryGoal } from '@/components/onboarding/wizard/wizardCatalog';

const GOAL_CAPABILITIES: Partial<Record<PrimaryGoal, CapabilityId>> = {
  collect_leads: 'lead-capture',
  book_appointments: 'booking',
  sell_offers: 'commerce',
  drive_calls: 'contact',
  grow_email_list: 'newsletter',
};

const NEED_CAPABILITIES: Partial<Record<CustomerNeed, CapabilityId>> = {
  request_quote: 'quoting',
  book_service: 'booking',
  buy_offer: 'commerce',
  fill_form: 'lead-capture',
  browse_services: 'booking',
};

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