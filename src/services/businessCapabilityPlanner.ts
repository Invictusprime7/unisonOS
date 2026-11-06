import {
  CAPABILITY_REGISTRY,
  type BusinessCapability,
  type BusinessSystemState,
  type CapabilityApprovalRecord,
  type CapabilityDefinition,
  type CapabilityId,
} from '@/platform/core/capabilityRegistry';
import { emptyPatchPlan, type PatchPlan } from '@/types/patchPlan';
import type { BuilderRequestEnvelope as InterpreterEnvelope } from '@/types/builderRequestEnvelope';
import {
  bindingsForCapabilities,
  expandBusinessCapabilities,
  interpretCapabilities,
  operationsCapabilitiesFor,
  resolveBuilderScope,
  type BuilderScope,
} from '@/services/capabilityInterpretation';
import {
  packAssertions,
  packFunctions,
  packSettings,
  packSlots,
  packTables,
  resolveCapabilityPacks,
  type CapabilityPack,
} from '@/platform/core/capabilityPacks';

export type { BuilderScope };



export interface BuilderRequestEnvelope {
  requestId: string;
  prompt: string;
  /**
   * Optional caller hint. When `interpretation` is present the scope is
   * re-derived from it, because the interpreter is authoritative.
   */
  scope?: BuilderScope;
  /** Authoritative classification from `builder-request-interpreter`. */
  interpretation?: InterpreterEnvelope | null;
  context: {
    businessId?: string;
    projectId?: string;
    industry?: string;
    installedCapabilities?: CapabilityId[];
  };
}

export interface CapabilityIntentBinding {
  target: string;
  intent: string;
}

export type CapabilityPlanApproval = CapabilityApprovalRecord;

export interface CapabilityProposal {
  status: 'proposed' | 'approved';
  requiresApproval: true;
  approval?: CapabilityPlanApproval;
  summary: string;
  dataAffected: string[];
  operationalCapabilities: CapabilityId[];
  intentBindings: CapabilityIntentBinding[];
  readinessAssertions: string[];
  /** Full-stack packs to install, dependency-first. */
  packs: BusinessCapability[];
  /** Edge functions the packs require. */
  edgeFunctions: string[];
  /** Configuration the owner must supply before the packs are usable. */
  settingsRequired: { accountFields: string[]; projectFields: string[] };
  /** Requested capabilities that have no pack contract yet. */
  unsupportedCapabilities: BusinessCapability[];
}

export interface CapabilityPlan {
  envelope: BuilderRequestEnvelope;
  /** Internal routing scope: website | business-system | developer. */
  scope: BuilderScope;
  /** How the capability set was derived (envelope / recipe / hint / none). */
  interpretationSource: 'envelope' | 'vertical-recipe' | 'hint' | 'none';
  requestedCapabilities: BusinessCapability[];
  operationalCapabilities: CapabilityDefinition[];
  /** Resolved full-stack pack contracts in dependency-first install order. */
  packs: CapabilityPack[];
  /** Slots the packs allow the AI to bind — nothing else may be wired. */
  bindableSlots: string[];
  proposal: CapabilityProposal;
}


export interface ApprovedCapabilityPlan extends CapabilityPlan {
  proposal: CapabilityProposal & {
    status: 'approved';
    approval: CapabilityPlanApproval;
  };
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}


const OPERATIONAL_PACKS: Record<BusinessCapability, CapabilityId[]> = {
  business_profile: [],
  // A services catalog on its own is read-only content — it must NOT drag the
  // booking pack in. `booking.appointments` pulls services via the business
  // dependency closure instead.
  'catalog.services': [],
  'catalog.products': [],
  'catalog.menu': [],
  'crm.leads': ['lead-capture'],
  'crm.contacts': ['contact'],
  'booking.appointments': ['booking'],
  'commerce.cart': ['commerce'],
  'commerce.checkout': ['commerce'],
  'forms.contact': ['contact'],
  'forms.quote': ['quoting'],
  'auth.customer': ['auth'],
  'portal.customer': ['auth'],
  'cms.content': [],
  'automation.follow_up': ['lead-capture'],
  'notifications.email': [],
};

function resolveOperationalCapabilities(requested: BusinessCapability[]): CapabilityId[] {
  const selected = new Set<CapabilityId>();
  for (const capability of requested) {
    OPERATIONAL_PACKS[capability].forEach((pack) => selected.add(pack));
  }

  const addDependencies = (capabilityId: CapabilityId): void => {
    for (const dependency of CAPABILITY_REGISTRY[capabilityId].dependencies) {
      if (selected.has(dependency)) continue;
      selected.add(dependency);
      addDependencies(dependency);
    }
  };
  for (const capabilityId of [...selected]) addDependencies(capabilityId);
  return [...selected];
}

// ---------------------------------------------------------------------------
// Plain-English proposal copy
// ---------------------------------------------------------------------------

const CAPABILITY_PHRASE: Record<BusinessCapability, string> = {
  business_profile: 'business profile details',
  'catalog.services': 'a live service catalog',
  'catalog.products': 'a live product catalog',
  'catalog.menu': 'a live menu',
  'crm.leads': 'lead records',
  'crm.contacts': 'customer records',
  'booking.appointments': 'appointment booking and availability',
  'commerce.cart': 'a shopping cart',
  'commerce.checkout': 'checkout and orders',
  'forms.contact': 'contact form handling',
  'forms.quote': 'quote request handling',
  'auth.customer': 'customer accounts',
  'portal.customer': 'a customer portal',
  'cms.content': 'site-scoped article management and publishing',
  'automation.follow_up': 'automated follow-ups',
  'notifications.email': 'email notifications',
};

function buildSummary(
  capabilities: BusinessCapability[],
  bindingCount: number,
  tables: string[],
): string {
  if (capabilities.length === 0) return 'No business capability changes are required for this request.';
  const phrases = capabilities.map((cap) => CAPABILITY_PHRASE[cap]);
  const head = phrases.length === 1
    ? phrases[0]
    : `${phrases.slice(0, -1).join(', ')} and ${phrases[phrases.length - 1]}`;
  const parts = [`This will set up ${head}.`];
  if (bindingCount > 0) {
    parts.push(`It will connect ${bindingCount} button${bindingCount === 1 ? '' : 's'} on your site to the new actions.`);
  }
  if (tables.length > 0) {
    parts.push(`Data affected: ${tables.join(', ')}.`);
  }
  return parts.join(' ');
}

/**
 * Converts a business request into a reviewable plan. This function is pure:
 * it neither applies migrations nor invokes Edge Functions.
 *
 * Classification is envelope-driven (Milestone 5, Step 1). Prompt regexes are
 * consulted only when no interpreter envelope is supplied.
 */
export function planBusinessCapabilities(envelope: BuilderRequestEnvelope): CapabilityPlan {
  const interpretation = interpretCapabilities({
    prompt: envelope.prompt,
    envelope: envelope.interpretation ?? null,
    industry: envelope.context.industry,
  });

  const scope = envelope.interpretation
    ? resolveBuilderScope(envelope.interpretation)
    : (envelope.scope ?? interpretation.scope);

  return planFromCapabilities({
    envelope,
    scope,
    interpretationSource: interpretation.source,
    requestedCapabilities: interpretation.resolved,
    uiTargets: interpretation.uiTargets,
  });
}

function planFromCapabilities(input: {
  envelope: BuilderRequestEnvelope;
  scope: BuilderScope;
  interpretationSource: CapabilityPlan['interpretationSource'];
  requestedCapabilities: BusinessCapability[];
  uiTargets?: string[];
}): CapabilityPlan {
  const { envelope, scope, requestedCapabilities } = input;
  const operationalCapabilityIds = resolveOperationalCapabilities(requestedCapabilities);
  const operationalCapabilities = operationalCapabilityIds.map((id) => CAPABILITY_REGISTRY[id]);

  // Full-stack pack contracts, dependency-first (Milestone 5 / Step 2).
  const { order: packs, unsupported } = resolveCapabilityPacks(requestedCapabilities);
  const bindableSlots = packSlots(packs);

  const intentBindings = bindingsForCapabilities(requestedCapabilities, input.uiTargets ?? []);
  const dataAffected = unique([
    ...operationalCapabilities.flatMap((capability) => capability.database.requiredTables),
    ...packTables(packs),
  ]);
  const readinessAssertions = unique([
    ...operationalCapabilities.flatMap((capability) => capability.readiness.assertions),
    ...packAssertions(packs).map((assertion) => assertion.id),
  ]);

  return {
    envelope,
    scope,
    interpretationSource: input.interpretationSource,
    requestedCapabilities,
    operationalCapabilities,
    packs,
    bindableSlots,
    proposal: {
      status: 'proposed',
      requiresApproval: true,
      summary: buildSummary(requestedCapabilities, intentBindings.length, dataAffected),
      dataAffected,
      operationalCapabilities: operationalCapabilityIds,
      intentBindings,
      readinessAssertions,
      packs: packs.map((pack) => pack.id),
      edgeFunctions: packFunctions(packs),
      settingsRequired: packSettings(packs),
      unsupportedCapabilities: unsupported,
    },
  };
}

// ---------------------------------------------------------------------------
// Wizard Launcher entry (auto-apply path)
// ---------------------------------------------------------------------------

/** Section types a generated site can contain → the capability they require. */
const SECTION_CAPABILITIES: Record<string, BusinessCapability[]> = {
  services: ['catalog.services'],
  menu: ['catalog.menu'],
  products: ['catalog.products'],
  shop: ['catalog.products', 'commerce.cart', 'commerce.checkout'],
  pricing: ['catalog.services'],
  booking: ['booking.appointments'],
  contact: ['forms.contact', 'crm.leads'],
  quote: ['forms.quote', 'crm.leads'],
  cart: ['commerce.cart', 'commerce.checkout'],
  checkout: ['commerce.cart', 'commerce.checkout'],
  newsletter: ['crm.leads', 'notifications.email'],
  testimonials: [],
  gallery: [],
};

export interface WizardCapabilityInput {
  industry?: string | null;
  /** Section types present in the resolved SiteBundleSnapshot. */
  sectionTypes?: string[];
  /** Page slugs selected in the wizard (booking, shop, contact…). */
  pageSlugs?: string[];
  businessId?: string;
  projectId?: string;
  installedCapabilities?: CapabilityId[];
}

/**
 * Derives the full-stack capability plan implied by a wizard launch. Pure —
 * the caller decides whether to auto-approve and apply.
 */
export function capabilityPlanFromWizard(input: WizardCapabilityInput): CapabilityPlan {
  const requested = new Set<BusinessCapability>(['business_profile']);

  const surfaces = [...(input.sectionTypes ?? []), ...(input.pageSlugs ?? [])];

  // Additive: universal baseline + industry hint + selected catalog surfaces.
  operationsCapabilitiesFor(input.industry, surfaces).forEach((cap) => requested.add(cap));

  for (const surface of surfaces) {
    const key = String(surface ?? '').toLowerCase().trim();
    SECTION_CAPABILITIES[key]?.forEach((cap) => requested.add(cap));
  }


  const requestedCapabilities = expandBusinessCapabilities([...requested]);

  return planFromCapabilities({
    envelope: {
      requestId: `wizard-launch-${input.projectId ?? input.businessId ?? 'unknown'}`,
      prompt: `Wizard launch for ${input.industry ?? 'business'}`,
      scope: 'business-system',
      context: {
        businessId: input.businessId,
        projectId: input.projectId,
        industry: input.industry ?? undefined,
        installedCapabilities: input.installedCapabilities,
      },
    },
    scope: 'business-system',
    interpretationSource: 'vertical-recipe',
    requestedCapabilities,
  });
}



/** Stamps a review decision; callers must provide the identity and time. */
export function approveCapabilityPlan(
  plan: CapabilityPlan,
  approval: CapabilityPlanApproval,
): ApprovedCapabilityPlan {
  if (!approval.approvedBy.trim()) {
    throw new Error('Capability plan approval requires an approver identity.');
  }
  if (Number.isNaN(Date.parse(approval.approvedAt))) {
    throw new Error('Capability plan approval requires a valid approval timestamp.');
  }

  return {
    ...plan,
    proposal: {
      ...plan.proposal,
      status: 'approved',
      approval,
    },
  };
}

/**
 * Creates the backend half of a capability transaction. The adapter refuses
 * proposed plans so no caller can accidentally provision infrastructure before
 * the user has reviewed and approved its data impact.
 */
export function approvedCapabilityPlanToPatchPlan(plan: CapabilityPlan): PatchPlan {
  if (plan.proposal.status !== 'approved' || !plan.proposal.approval) {
    throw new Error('Capability plan must be explicitly approved before execution.');
  }

  const patch = emptyPatchPlan(plan.proposal.summary);
  const approval = plan.proposal.approval;
  patch.businessSystem = {
    version: '1.0',
    requestedCapabilities: plan.requestedCapabilities,
    capabilities: plan.operationalCapabilities.map((capability) => ({
      id: capability.id,
      provides: capability.provides.filter((provided) => plan.requestedCapabilities.includes(provided)),
      status: 'approved',
      approval,
    })),
  } satisfies BusinessSystemState;
  for (const capability of plan.proposal.operationalCapabilities) {
    patch.backendOps.push({
      type: 'requireCapability',
      capability,
      payload: { approval },
    });
  }
  for (const capability of plan.proposal.operationalCapabilities) {
    patch.backendOps.push({
      type: 'seedCapability',
      capability,
      payload: { approval },
    });
  }
  return patch;
}