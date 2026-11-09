/**
 * Vertical Launch Contract
 * ─────────────────────────
 * Single typed source-of-truth for what each business vertical (booking, saas,
 * agency, portfolio, store, content) guarantees at launch time. Replaces the
 * ad-hoc `forceSalonPreviewReady` boolean that was scattered across
 * prompt-first launch.
 *
 * Why this exists:
 * - prompt-first launch previously branched off a single bool for every per-vertical
 *   decision (booking on/off, lead capture on/off, selected-page scaffold,
 *   native-publish guarantee, etc). That conflated "is preselected?" with
 *   "what does this vertical promise?".
 * - The Readiness Center, deployment service, and downstream readiness manifest
 *   need a stable, typed contract they can inspect — not a magic boolean.
 *
 * This module is **pure** and has no side effects. It does NOT mutate readiness
 * — that remains owned by `nativePublishReadiness` + `deploymentService`.
 */

import type { BusinessSystemType } from '@/lib/infrastructureContext';

export interface VerticalLaunchContract {
  /** The vertical this contract applies to, or null for "no system selected". */
  systemType: BusinessSystemType | null;

  /**
   * Deterministic preview path: when true, the launcher must produce a
   * preview-ready site (Lane B AI required) while still honoring only the
   * pages the user checked in the wizard.
   */
  previewReady: boolean;

  /**
   * The vertical may publish through the first-party native publish pipeline
   * (provided owner email and other readiness checks pass). This does NOT mean
   * the site IS publish-ready — only that the contract permits it.
   */
  nativePublishCapable: boolean;

  /**
   * @deprecated Must remain false. Wizard launches may only scaffold Home +
   * explicitly selected pages; capability objects cannot add routes.
   */
  capabilityFullScaffold: boolean;

  /**
   * Forced wizard needs flags. The wizard's own `goalNeeds` + customer needs
   * are still OR-ed on top; these only force-enable when the vertical demands
   * the capability regardless of user input (e.g. booking vertical always
   * needs booking).
   */
  forcedNeeds: {
    booking: boolean;
    leadCapture: boolean;
    products: boolean;
  };

  /** Tag stamped into the wizard seed `generation.previewGuarantee`. */
  previewGuaranteeTag: 'lane-b-ai-required' | undefined;

  /** Tag stamped into the wizard seed `generation.publishGuarantee`. */
  publishGuaranteeTag: 'native-first-party-publish-ready' | undefined;

  /**
   * Track 6 — capability schema. Capabilities the vertical promises to wire
   * by launch. Readiness probes and the publish gate cross-check these
   * against the compiled contract's provisioningReport.
   */
  requiredCapabilities: ReadonlyArray<VerticalCapabilityId>;

  /**
   * Track 6 — readiness fixtures. Minimum acceptable counts/flags the
   * Readiness Center can fixture-test against (e.g. booking vertical must
   * have at least 1 service wired). These are assertions, not seed data;
   * they never write to the database.
   */
  readinessFixtures: VerticalReadinessFixtures;
}

export type VerticalCapabilityId =
  | 'lead-capture'
  | 'booking'
  | 'commerce'
  | 'payments'
  | 'donation'
  | 'quoting'
  | 'auth'
  | 'cms-content';

export interface VerticalReadinessFixtures {
  /** Minimum number of canonical pages required for preview readiness. */
  minCanonicalPages: number;
  /** Minimum number of bound CTAs (intents) required for preview readiness. */
  minBoundIntents: number;
  /** Vertical-specific row-count assertions checked by Readiness Center v2. */
  rowCountAssertions: ReadonlyArray<{
    table: string;
    min: number;
    reason: string;
  }>;
}

const NULL_CONTRACT: VerticalLaunchContract = {
  systemType: null,
  previewReady: false,
  nativePublishCapable: false,
  capabilityFullScaffold: false,
  forcedNeeds: { booking: false, leadCapture: false, products: false },
  previewGuaranteeTag: undefined,
  publishGuaranteeTag: undefined,
  requiredCapabilities: [],
  readinessFixtures: { minCanonicalPages: 0, minBoundIntents: 0, rowCountAssertions: [] },
};

/**
 * Per-vertical contract table. Today every preselected vertical promises the
 * same hardened preview-ready + native-publish-capable surface while still
 * honoring the wizard page checklist. Differentiation (e.g. booking forces
 * booking capability) lives in `forcedNeeds`, not route expansion.
 */
const VERTICAL_CONTRACTS: Record<BusinessSystemType, VerticalLaunchContract> = {
  booking: {
    systemType: 'booking',
    previewReady: true,
    nativePublishCapable: true,
    capabilityFullScaffold: false,
    forcedNeeds: { booking: true, leadCapture: true, products: false },
    previewGuaranteeTag: 'lane-b-ai-required',
    publishGuaranteeTag: 'native-first-party-publish-ready',
    requiredCapabilities: ['booking', 'lead-capture'],
    readinessFixtures: {
      minCanonicalPages: 4,
      minBoundIntents: 3,
      rowCountAssertions: [
        { table: 'services', min: 1, reason: 'Booking vertical needs at least one bookable service.' },
        { table: 'availability_slots', min: 1, reason: 'Booking vertical needs at least one availability slot.' },
      ],
    },
  },
  saas: {
    systemType: 'saas',
    previewReady: true,
    nativePublishCapable: true,
    capabilityFullScaffold: false,
    forcedNeeds: { booking: false, leadCapture: true, products: false },
    previewGuaranteeTag: 'lane-b-ai-required',
    publishGuaranteeTag: 'native-first-party-publish-ready',
    requiredCapabilities: ['lead-capture', 'auth'],
    readinessFixtures: {
      minCanonicalPages: 4,
      minBoundIntents: 2,
      rowCountAssertions: [],
    },
  },
  agency: {
    systemType: 'agency',
    previewReady: true,
    nativePublishCapable: true,
    capabilityFullScaffold: false,
    forcedNeeds: { booking: false, leadCapture: true, products: false },
    previewGuaranteeTag: 'lane-b-ai-required',
    publishGuaranteeTag: 'native-first-party-publish-ready',
    requiredCapabilities: ['lead-capture', 'quoting'],
    readinessFixtures: {
      minCanonicalPages: 4,
      minBoundIntents: 2,
      rowCountAssertions: [],
    },
  },
  portfolio: {
    systemType: 'portfolio',
    previewReady: true,
    nativePublishCapable: true,
    capabilityFullScaffold: false,
    forcedNeeds: { booking: false, leadCapture: true, products: false },
    previewGuaranteeTag: 'lane-b-ai-required',
    publishGuaranteeTag: 'native-first-party-publish-ready',
    requiredCapabilities: ['lead-capture'],
    readinessFixtures: {
      minCanonicalPages: 3,
      minBoundIntents: 1,
      rowCountAssertions: [],
    },
  },
  store: {
    systemType: 'store',
    previewReady: true,
    nativePublishCapable: true,
    capabilityFullScaffold: false,
    forcedNeeds: { booking: false, leadCapture: true, products: true },
    previewGuaranteeTag: 'lane-b-ai-required',
    publishGuaranteeTag: 'native-first-party-publish-ready',
    requiredCapabilities: ['commerce', 'payments', 'lead-capture'],
    readinessFixtures: {
      minCanonicalPages: 4,
      minBoundIntents: 3,
      rowCountAssertions: [
        { table: 'products', min: 1, reason: 'Store vertical needs at least one purchasable product.' },
      ],
    },
  },
  content: {
    systemType: 'content',
    previewReady: true,
    nativePublishCapable: true,
    capabilityFullScaffold: false,
    forcedNeeds: { booking: false, leadCapture: true, products: false },
    previewGuaranteeTag: 'lane-b-ai-required',
    publishGuaranteeTag: 'native-first-party-publish-ready',
    requiredCapabilities: ['lead-capture', 'cms-content'],
    readinessFixtures: {
      minCanonicalPages: 3,
      minBoundIntents: 1,
      rowCountAssertions: [],
    },
  },
};

/**
 * Resolve the launch contract for a vertical. Returns a safe NULL_CONTRACT if
 * no system has been selected yet (e.g. early renders).
 */
export function resolveVerticalLaunchContract(
  systemId: BusinessSystemType | null | undefined,
): VerticalLaunchContract {
  if (!systemId) return NULL_CONTRACT;
  return VERTICAL_CONTRACTS[systemId] ?? NULL_CONTRACT;
}

