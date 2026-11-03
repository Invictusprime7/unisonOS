import type { SiteBundleSnapshot } from '@/platform/core/canonicalPipeline';
import { inspectNativeForms } from '@/services/app-builder/nativeFormContract';

export type PublicFormIntent =
  | 'contact.submit'
  | 'quote.request'
  | 'booking.request'
  | 'newsletter.subscribe'
  | 'application.submit';

export interface PlannedFormDefinition {
  externalId: PublicFormIntent;
  name: string;
  intent: PublicFormIntent;
  fields: Array<{ name: string; required: boolean }>;
}

const GENERATED_FORM_DEFINITIONS: readonly PlannedFormDefinition[] = [
  { externalId: 'contact.submit', name: 'Contact request', intent: 'contact.submit', fields: [] },
  { externalId: 'quote.request', name: 'Quote request', intent: 'quote.request', fields: [] },
  { externalId: 'booking.request', name: 'Booking request', intent: 'booking.request', fields: [] },
  { externalId: 'newsletter.subscribe', name: 'Newsletter subscription', intent: 'newsletter.subscribe', fields: [] },
  { externalId: 'application.submit', name: 'Application', intent: 'application.submit', fields: [] },
];

/**
 * Intent-bearing forms are projected from JSX into their site-scoped public
 * contracts. The intent remains the runtime external id; form and component
 * identities are reported separately by the shared inspector.
 */
export function planLaunchFormDefinitions(
  siteBundleSnapshot: Pick<SiteBundleSnapshot, 'vfsFiles'> | undefined,
): PlannedFormDefinition[] {
  const forms = inspectNativeForms(siteBundleSnapshot?.vfsFiles ?? {}, GENERATED_FORM_DEFINITIONS.map(({ intent }) => intent));
  const byIntent = new Map<PublicFormIntent, PlannedFormDefinition>();
  for (const form of forms) {
    if (form.verdict !== 'recognized' || !form.intent) continue;
    const definition = GENERATED_FORM_DEFINITIONS.find((candidate) => candidate.intent === form.intent);
    if (!definition) continue;
    byIntent.set(definition.intent, { ...definition, fields: form.fields });
  }

  const hasLegacyUnspecifiedForm = forms.some((form) => form.demoForm && !form.intent);
  if (hasLegacyUnspecifiedForm) {
    for (const definition of GENERATED_FORM_DEFINITIONS) {
      if (!byIntent.has(definition.intent)) byIntent.set(definition.intent, { ...definition });
    }
  }

  return [...byIntent.values()];
}