/**
 * Contract Compiler — The governing control plane
 * 
 * Sits between SystemsAI and Preview/Builder.
 * 
 * Flow:
 *   BusinessBlueprint → ContractCompiler → Validated CompiledContract
 * 
 * The compiler:
 * 1. Validates the blueprint against capability registry
 * 2. Canonicalizes all intents (rejects non-canonical)
 * 3. Builds route policy from blueprint + capabilities
 * 4. Resolves slot bindings from capabilities + section roles
 * 5. Validates provisioning status
 * 6. Outputs a CompiledContract — the ONLY valid preview input
 * 
 * V2: CompiledBinding upgraded to CompiledInteractionBinding with
 * bindingKey, slotRole, target resolution, payload schema, and readiness.
 * 
 * RULE: Preview launches ONLY if the contract passes.
 */

import {
  isCoreIntent,
  isNavIntent,
  type CoreIntent,
} from './coreIntents';
import { normalizeIntent } from '@/runtime/intentAliases';
import type { BusinessBlueprint, BlueprintPage } from './blueprintSchema';
import {
  CAPABILITY_REGISTRY,
  getAllowedIntents,
  isCapabilitySupportedForIndustry,
  getRequiredTables,
  getRequiredWorkflows,
  type CapabilityId,
  type WorkflowSpec,
} from './capabilityRegistry';
import { getIndustryProfile } from './industryMatrix';
import { getCompositionsByIndustry } from '@/sections/templates';
import { buildRoutePolicy, isOverlayIntent, type RoutePolicy } from './routePolicy';
import { resolveSlotBindings, type SlotBindingPolicy } from './slotBindingPolicy';
import { getIntentRequiredCapabilities } from './intentSurfaceRegistry';
import { validateProvisioning, type ProvisioningReport } from './provisioningValidator';

// ============================================================================
// Validation Types
// ============================================================================

export type ValidationSeverity = 'error' | 'warning' | 'info';

export interface ValidationIssue {
  code: string;
  severity: ValidationSeverity;
  message: string;
  path?: string;
  autoFix?: () => void;
}

export interface ContractValidation {
  valid: boolean;
  issues: ValidationIssue[];
  errors: number;
  warnings: number;
  infos: number;
}

// ============================================================================
// Compiled Contract — The ONLY valid preview input
// ============================================================================

export interface CompiledContract {
  /** Did the contract pass validation? */
  validation: ContractValidation;
  /** Canonical intent list (after normalization) */
  canonicalIntents: CoreIntent[];
  /** Required tables from capabilities */
  requiredTables: string[];
  /** Required workflows from capabilities */
  requiredWorkflows: WorkflowSpec[];
  /** Intent bindings derived from blueprint + section roles */
  intentBindings: CompiledInteractionBinding[];
  /** Pages validated and enriched */
  pages: CompiledPage[];
  /** CRM pipeline config */
  crm: { name: string; stages: string[]; defaultStage: string };
  /** Automation pack */
  automationPack: string;
  /** Route policy — canonical routing contract */
  routePolicy: RoutePolicy;
  /** Slot binding policy — deterministic CTA resolution */
  slotBindingPolicy: SlotBindingPolicy;
  /** Provisioning report — are intents actually operational? */
  provisioningReport: ProvisioningReport;
}

/**
 * @deprecated Use CompiledInteractionBinding
 */
export interface CompiledBinding {
  elementRole: string;
  sectionType: string;
  intent: CoreIntent;
  params: Record<string, unknown>;
  source: 'blueprint' | 'capability-default' | 'section-role' | 'slot-policy';
}

/**
 * V2 Compiled Interaction Binding — Full-fidelity binding artifact.
 * 
 * Every clickable element answers 5 questions:
 * 1. What is this element's stable key? (bindingKey)
 * 2. What canonical intent does it fire? (intent)
 * 3. What target does it affect? (target)
 * 4. What payload does it require? (payloadSchema)
 * 5. Is it preview-ready only, or publish-ready? (readiness)
 */
export interface CompiledInteractionBinding {
  /** Stable key: "pageRole.sectionType.slotRole" */
  bindingKey: string;
  /** Page role where this binding lives */
  pageRole: string;
  /** Section type */
  sectionType: string;
  /** Slot role within section */
  slotRole: string;
  /** Legacy element role (backward compat) */
  elementRole: string;
  /** Canonical CoreIntent */
  intent: CoreIntent;
  /** Display label (presentation only) */
  label?: string;
  /** Resolved target */
  target?: {
    kind: 'route' | 'overlay' | 'form' | 'calendar' | 'product' | 'state';
    ref: string;
  };
  /** Static params */
  params: Record<string, unknown>;
  /** Payload schema for data-carrying intents */
  payloadSchema?: Record<string, string>;
  /** Origin of this binding */
  source: 'blueprint' | 'capability-default' | 'section-role' | 'slot-policy' | 'wizard' | 'system';
  /** Required capabilities for this binding to be operational */
  requiredCapabilities?: string[];
  /** Readiness state */
  readiness: 'preview-ready' | 'publish-ready' | 'stubbed' | 'blocked';
}

export interface CompiledPage {
  title: string;
  path: string;
  purpose: string;
  isHome: boolean;
  sections: string[];
  hasComposition: boolean;
}

// ============================================================================
// Compiler
// ============================================================================

export interface CompileOptions {
  /** Is the backend installed for this business? */
  backendInstalled?: boolean;
}

export function compileContract(
  blueprint: BusinessBlueprint,
  options: CompileOptions = {},
): CompiledContract {
  const issues: ValidationIssue[] = [];
  const { backendInstalled = false } = options;

  // ── 1. Validate identity ──────────────────────────────────────────────
  if (!blueprint.identity.businessName?.trim()) {
    issues.push({
      code: 'MISSING_BUSINESS_NAME',
      severity: 'error',
      message: 'Business name is required',
      path: 'identity.businessName',
    });
  }

  const industryProfile = getIndustryProfile(blueprint.identity.industry);
  if (!industryProfile) {
    issues.push({
      code: 'UNKNOWN_INDUSTRY',
      severity: 'error',
      message: `Unknown industry "${blueprint.identity.industry}"`,
      path: 'identity.industry',
    });
  }

  // ── 2. Validate capabilities ──────────────────────────────────────────
  for (const capId of blueprint.capabilities.enabled) {
    if (!CAPABILITY_REGISTRY[capId]) {
      issues.push({
        code: 'UNKNOWN_CAPABILITY',
        severity: 'error',
        message: `Unknown capability "${capId}"`,
        path: 'capabilities.enabled',
      });
    }

    const cap = CAPABILITY_REGISTRY[capId];
    if (cap && !isCapabilitySupportedForIndustry(capId, blueprint.identity.industry)) {
      issues.push({
        code: 'UNSUPPORTED_CAPABILITY',
        severity: 'warning',
        message: `Capability "${capId}" is not typically used in "${blueprint.identity.industry}" industry`,
        path: 'capabilities.enabled',
      });
    }
  }

  // ── 3. Canonicalize and validate intents ──────────────────────────────
  const allowedIntents = getAllowedIntents(blueprint.capabilities.enabled as CapabilityId[]);
  const canonicalIntents: CoreIntent[] = [];

  for (const intent of blueprint.intents.allowed) {
    const normalized = normalizeIntent(intent);
    if (!isCoreIntent(normalized as string)) {
      issues.push({
        code: 'NON_CANONICAL_INTENT',
        severity: 'error',
        message: `Intent "${intent}" is not a canonical CoreIntent (normalized to "${normalized}")`,
        path: 'intents.allowed',
      });
    } else {
      canonicalIntents.push(normalized as CoreIntent);
    }
  }

  if (!allowedIntents.includes(blueprint.intents.primaryCta)) {
    issues.push({
      code: 'PRIMARY_CTA_NOT_ALLOWED',
      severity: 'error',
      message: `Primary CTA intent "${blueprint.intents.primaryCta}" is not allowed by enabled capabilities`,
      path: 'intents.primaryCta',
    });
  }

  // ── 4. Validate pages ────────────────────────────────────────────────
  const pagePaths = new Set<string>();
  const compiledPages: CompiledPage[] = [];
  let hasHomePage = false;

  for (const page of blueprint.pages) {
    if (pagePaths.has(page.path)) {
      issues.push({
        code: 'DUPLICATE_PAGE_PATH',
        severity: 'error',
        message: `Duplicate page path: "${page.path}"`,
        path: 'pages',
      });
    }
    pagePaths.add(page.path);

    if (page.isHome || page.path === '/') hasHomePage = true;

    const compositions = industryProfile
      ? getCompositionsByIndustry(industryProfile.industry)
      : [];

    compiledPages.push({
      title: page.title,
      path: page.path,
      purpose: page.purpose,
      isHome: page.isHome || page.path === '/',
      sections: page.expectedSections || [],
      hasComposition: compositions.length > 0,
    });
  }

  if (!hasHomePage) {
    issues.push({
      code: 'MISSING_HOME_PAGE',
      severity: 'error',
      message: 'Blueprint must include a home page (path: "/")',
      path: 'pages',
    });
  }

  // ── 5. Build route policy ─────────────────────────────────────────────
  const routePolicy = buildRoutePolicy(
    blueprint.pages,
    blueprint.capabilities.enabled as CapabilityId[],
  );

  for (const page of blueprint.pages) {
    if (!routePolicy.routes.some(r => r.path === page.path)) {
      issues.push({
        code: 'ORPHAN_PAGE_ROUTE',
        severity: 'warning',
        message: `Page "${page.title}" at "${page.path}" has no route policy entry`,
        path: 'pages',
      });
    }
  }

  // ── 6. Resolve slot bindings ──────────────────────────────────────────
  const slotBindingPolicy = resolveSlotBindings(
    blueprint.capabilities.enabled as CapabilityId[],
    blueprint.intents.primaryCta,
  );

  for (const u of slotBindingPolicy.unresolved) {
    issues.push({
      code: 'UNRESOLVED_SLOT_BINDING',
      severity: 'info',
      message: u.reason,
      path: `slots.${u.section}.${u.slot}`,
    });
  }

  // ── 7. Generate interaction bindings (V2) ────────────────────────────
  const intentBindings: CompiledInteractionBinding[] = [];

  // Slot-policy-driven bindings (primary source)
  for (const binding of slotBindingPolicy.resolved) {
    const bindingKey = `${binding.section}.${binding.slot}`;
    const isOverlay = isOverlayIntent(binding.intent);

    intentBindings.push({
      bindingKey,
      pageRole: '*', // Applies to any page containing this section
      sectionType: binding.section,
      slotRole: binding.slot,
      elementRole: `${binding.section}-${binding.slot}`,
      intent: binding.intent,
      target: {
        kind: isOverlay ? 'overlay' : 'route',
        ref: routePolicy.ctaRouteMap[binding.intent] || '/',
      },
      params: {},
      source: 'slot-policy',
      requiredCapabilities: getIntentRequiredCapabilities(binding.intent),
      readiness: backendInstalled ? 'publish-ready' : 'preview-ready',
    });
  }

  // Blueprint-level overrides
  const heroBindingKey = 'hero.primary-cta';
  // Remove any slot-policy hero.primary-cta to avoid duplication
  const existingHeroIdx = intentBindings.findIndex(b => b.bindingKey === heroBindingKey);
  
  const heroBinding: CompiledInteractionBinding = {
    bindingKey: heroBindingKey,
    pageRole: 'home',
    sectionType: 'hero',
    slotRole: 'primary-cta',
    elementRole: 'hero-primary-cta',
    intent: blueprint.intents.primaryCta,
    target: {
      kind: routePolicy.overlayRoutes.includes(routePolicy.ctaRouteMap[blueprint.intents.primaryCta] || '')
        ? 'overlay' : 'route',
      ref: routePolicy.ctaRouteMap[blueprint.intents.primaryCta] || '/',
    },
    params: {},
    source: 'blueprint',
    readiness: backendInstalled ? 'publish-ready' : 'preview-ready',
  };

  if (existingHeroIdx >= 0) {
    intentBindings[existingHeroIdx] = heroBinding;
  } else {
    intentBindings.push(heroBinding);
  }

  if (blueprint.intents.secondaryCta) {
    intentBindings.push({
      bindingKey: 'hero.secondary-cta',
      pageRole: 'home',
      sectionType: 'hero',
      slotRole: 'secondary-cta',
      elementRole: 'hero-secondary-cta',
      intent: blueprint.intents.secondaryCta,
      target: {
        kind: routePolicy.overlayRoutes.includes(routePolicy.ctaRouteMap[blueprint.intents.secondaryCta] || '')
          ? 'overlay' : 'route',
        ref: routePolicy.ctaRouteMap[blueprint.intents.secondaryCta] || '/#services',
      },
      params: {},
      source: 'blueprint',
      readiness: 'preview-ready',
    });
  }

  // ── 8. Validate provisioning ──────────────────────────────────────────
  const provisioningReport = validateProvisioning(
    blueprint.capabilities.enabled as CapabilityId[],
    routePolicy,
    backendInstalled,
  );

  for (const cap of provisioningReport.capabilities) {
    for (const check of cap.checks) {
      if (check.status === 'missing') {
        issues.push({
          code: 'MISSING_PROVISIONING',
          severity: 'error',
          message: `${cap.capabilityName}: ${check.label} is missing`,
          path: `provisioning.${cap.capabilityId}`,
        });
      } else if (check.status === 'stub') {
        issues.push({
          code: 'STUBBED_PROVISIONING',
          severity: 'info',
          message: `${cap.capabilityName}: ${check.label} is stubbed — ${check.detail || 'will work in preview'}`,
          path: `provisioning.${cap.capabilityId}`,
        });
      }
    }
  }

  // ── 9. Update readiness based on provisioning ─────────────────────────
  for (const binding of intentBindings) {
    // If provisioning is not production-ready, downgrade to preview-ready
    if (!provisioningReport.productionReady && binding.readiness === 'publish-ready') {
      binding.readiness = 'preview-ready';
    }
    // Check if specific capability is blocked
    if (binding.requiredCapabilities) {
      const blocked = binding.requiredCapabilities.some(cap => {
        const capReport = provisioningReport.capabilities.find(c => c.capabilityId === cap);
        return capReport?.checks.some(ch => ch.status === 'missing');
      });
      if (blocked) {
        binding.readiness = 'blocked';
      }
    }
  }

  // ── 10. Gather provisioning requirements ──────────────────────────────
  const requiredTables = getRequiredTables(blueprint.capabilities.enabled as CapabilityId[]);
  const requiredWorkflows = getRequiredWorkflows(blueprint.capabilities.enabled as CapabilityId[]);

  // ── 11. Compile result ────────────────────────────────────────────────
  const errors = issues.filter(i => i.severity === 'error').length;
  const warnings = issues.filter(i => i.severity === 'warning').length;
  const infos = issues.filter(i => i.severity === 'info').length;

  return {
    validation: { valid: errors === 0, issues, errors, warnings, infos },
    canonicalIntents: canonicalIntents.length > 0 ? canonicalIntents : allowedIntents,
    requiredTables,
    requiredWorkflows,
    intentBindings,
    pages: compiledPages,
    crm: {
      name: blueprint.crm.pipelineName,
      stages: blueprint.crm.stages,
      defaultStage: blueprint.crm.defaultStage,
    },
    automationPack: blueprint.automationPack,
    routePolicy,
    slotBindingPolicy,
    provisioningReport,
  };
}

// ============================================================================
// Quick Validation (for linting / CI)
// ============================================================================

export function findNonCanonicalIntents(intents: string[]): string[] {
  return intents.filter(intent => !isCoreIntent(intent));
}

export function validateIntentsAgainstCapabilities(
  intents: string[],
  capabilities: CapabilityId[]
): ValidationIssue[] {
  const allowed = new Set(getAllowedIntents(capabilities).map(String));
  const issues: ValidationIssue[] = [];

  for (const intent of intents) {
    const normalized = normalizeIntent(intent);
    if (!allowed.has(normalized as string) && !isNavIntent(normalized as string)) {
      issues.push({
        code: 'INTENT_NOT_IN_CAPABILITY_SET',
        severity: 'warning',
        message: `Intent "${intent}" (→ "${normalized}") is not covered by capabilities [${capabilities.join(', ')}]`,
      });
    }
  }

  return issues;
}

// ============================================================================
// Contract Gate — Rejects non-compiled preview input
// ============================================================================

/**
 * Capabilities whose stub/missing status blocks PUBLISH (but not preview).
 * Stubbing these in production would mean a generated site claims to take
 * money / accept logins / book appointments without actually doing so.
 */
const BUSINESS_CRITICAL_CAPABILITIES: readonly CapabilityId[] = [
  'commerce',
  'auth',
  'booking',
  'lead-capture',
  'quoting',
  'donation',
] as const;

export interface PublishBlocker {
  code:
    | 'preview-not-ready'
    | 'validation-errors'
    | 'production-not-ready'
    | 'unresolved-slots'
    | 'blocked-bindings'
    | 'critical-capability-stub'
    | 'critical-capability-missing'
    | 'critical-workflow-not-provisioned';
  message: string;
  /** Optional capability the blocker is tied to */
  capabilityId?: CapabilityId;
}

export function isPreviewReady(contract: CompiledContract): boolean {
  if (!contract.validation.valid) return false;
  if (!contract.provisioningReport.previewReady) return false;
  if (!contract.routePolicy.routes.some(r => r.path === '/')) return false;
  if (!contract.intentBindings.some(b => b.slotRole?.includes('primary-cta') || b.elementRole.includes('primary-cta'))) return false;
  return true;
}

/**
 * Returns ALL publish blockers (empty array = publish-ready).
 *
 * This is intentionally stricter than `isPreviewReady`:
 *   - Preview tolerates stubs (so creators can iterate on UX).
 *   - Publish does NOT tolerate stubs on business-critical capabilities,
 *     because a published site that "looks" like it accepts payments or
 *     bookings but silently no-ops is the worst possible failure mode.
 */
export function getPublishBlockers(contract: CompiledContract): PublishBlocker[] {
  const blockers: PublishBlocker[] = [];

  if (!isPreviewReady(contract)) {
    blockers.push({
      code: 'preview-not-ready',
      message: 'Preview gate failed — fix preview readiness before publishing.',
    });
  }

  if (!contract.validation.valid) {
    blockers.push({
      code: 'validation-errors',
      message: `Contract has ${contract.validation.errors} validation error(s).`,
    });
  }

  if (!contract.provisioningReport.productionReady) {
    blockers.push({
      code: 'production-not-ready',
      message: 'Provisioning report is not production-ready (backend or capability install incomplete).',
    });
  }

  if (contract.slotBindingPolicy.unresolved.length > 0) {
    blockers.push({
      code: 'unresolved-slots',
      message: `${contract.slotBindingPolicy.unresolved.length} slot(s) have no binding.`,
    });
  }

  const blockedBindings = contract.intentBindings.filter(b => b.readiness === 'blocked');
  if (blockedBindings.length > 0) {
    blockers.push({
      code: 'blocked-bindings',
      message: `${blockedBindings.length} interactive element(s) are blocked (missing handler/payload).`,
    });
  }

  // Business-critical capability gates — stubs are acceptable in preview, not in publish.
  for (const capReport of contract.provisioningReport.capabilities) {
    const isCritical = BUSINESS_CRITICAL_CAPABILITIES.includes(capReport.capabilityId);
    if (!isCritical) continue;

    if (capReport.status === 'missing') {
      blockers.push({
        code: 'critical-capability-missing',
        capabilityId: capReport.capabilityId,
        message: `Critical capability "${capReport.capabilityName}" is missing required handlers.`,
      });
      continue;
    }
    if (capReport.status === 'stub') {
      blockers.push({
        code: 'critical-capability-stub',
        capabilityId: capReport.capabilityId,
        message: `Critical capability "${capReport.capabilityName}" is stubbed — publishing would expose a non-functional flow.`,
      });
    }

    // Workflow-level check: any required workflow that is not provisioned blocks publish.
    const stubbedWorkflowCheck = capReport.checks.find(
      c => c.check === 'workflow' && c.status !== 'provisioned',
    );
    if (stubbedWorkflowCheck) {
      blockers.push({
        code: 'critical-workflow-not-provisioned',
        capabilityId: capReport.capabilityId,
        message: `Workflow "${stubbedWorkflowCheck.label}" for "${capReport.capabilityName}" is not provisioned.`,
      });
    }
  }

  return blockers;
}

export function isPublishReady(contract: CompiledContract): boolean {
  return getPublishBlockers(contract).length === 0;
}
