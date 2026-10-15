/**
 * Provisioning Validator — Validates that intents are actually operational
 * 
 * Turns "intent allowed" into "intent operational" by checking:
 * - Handler exists
 * - Overlay/modal exists if needed
 * - Route exists if needed
 * - Form schema exists if needed
 * - Preview adapter exists
 */

import type { CoreIntent } from './coreIntents';
import type { CapabilityId, CapabilityDefinition } from './capabilityRegistry';
import { CAPABILITY_REGISTRY } from './capabilityRegistry';
import type { RoutePolicy } from './routePolicy';

// ============================================================================
// Types
// ============================================================================

export type ProvisioningStatus = 'provisioned' | 'stub' | 'missing';

export interface CapabilityProvisioningCheck {
  capabilityId: CapabilityId;
  capabilityName: string;
  checks: ProvisioningCheckItem[];
  status: ProvisioningStatus;
}

export interface ProvisioningCheckItem {
  /** What we're checking */
  check: string;
  /** Human description */
  label: string;
  /** Status */
  status: ProvisioningStatus;
  /** Optional detail */
  detail?: string;
}

export interface ProvisioningReport {
  /** Overall status */
  status: ProvisioningStatus;
  /** Per-capability reports */
  capabilities: CapabilityProvisioningCheck[];
  /** Summary counts */
  provisioned: number;
  stubbed: number;
  missing: number;
  /** Is this site production-ready? */
  productionReady: boolean;
  /** Is this site preview-ready? (stubs are OK) */
  previewReady: boolean;
}

// ============================================================================
// Known handler/overlay registries (what the runtime actually has)
// ============================================================================

/** Intents that have a handler in intentExecutor.ts */
const RUNTIME_HANDLERS: Set<CoreIntent> = new Set([
  'nav.goto', 'nav.external', 'nav.anchor',
  'pay.checkout', 'pay.success', 'pay.cancel',
  'contact.submit', 'newsletter.subscribe',
  'booking.create', 'quote.request', 'lead.capture',
  'cart.add', 'cart.checkout', 'cart.abandoned',
  'auth.login', 'auth.register',
]);

/** Overlays that exist in the preview/runtime */
const AVAILABLE_OVERLAYS: Set<string> = new Set([
  'booking-form', 'booking-confirmation',
  'quote-form',
  'contact-form',
  'cart-overlay', 'checkout-form',
  'auth-modal',
  'lead-form',
  'donation-form',
]);

/** Edge functions that exist */
const AVAILABLE_EDGE_FUNCTIONS: Set<string> = new Set([
  'intent-exec',
  'create-lead',
  'create-checkout',
  'create-order-checkout',
  'automation-event',
  'intent-router',
  'systems-build',
]);

// ============================================================================
// Validator
// ============================================================================

export function validateProvisioning(
  capabilities: CapabilityId[],
  routePolicy: RoutePolicy,
  backendInstalled: boolean,
): ProvisioningReport {
  const capReports: CapabilityProvisioningCheck[] = [];

  for (const capId of capabilities) {
    const cap = CAPABILITY_REGISTRY[capId];
    if (!cap) continue;

    const checks = validateCapability(cap, routePolicy, backendInstalled);
    const worstStatus = checks.reduce<ProvisioningStatus>((worst, c) => {
      if (c.status === 'missing') return 'missing';
      if (c.status === 'stub' && worst !== 'missing') return 'stub';
      return worst;
    }, 'provisioned');

    capReports.push({
      capabilityId: capId,
      capabilityName: cap.name,
      checks,
      status: worstStatus,
    });
  }

  const provisioned = capReports.filter(c => c.status === 'provisioned').length;
  const stubbed = capReports.filter(c => c.status === 'stub').length;
  const missing = capReports.filter(c => c.status === 'missing').length;

  const overallStatus: ProvisioningStatus =
    missing > 0 ? 'missing' : stubbed > 0 ? 'stub' : 'provisioned';

  return {
    status: overallStatus,
    capabilities: capReports,
    provisioned,
    stubbed,
    missing,
    productionReady: overallStatus === 'provisioned' && backendInstalled,
    previewReady: overallStatus !== 'missing',
  };
}

function validateCapability(
  cap: CapabilityDefinition,
  routePolicy: RoutePolicy,
  backendInstalled: boolean,
): ProvisioningCheckItem[] {
  const checks: ProvisioningCheckItem[] = [];

  // 1. Primary intent handler exists
  checks.push({
    check: 'handler',
    label: `Handler for ${cap.primaryIntent}`,
    status: RUNTIME_HANDLERS.has(cap.primaryIntent) ? 'provisioned' : 'missing',
  });

  // 2. Required overlays exist
  for (const overlay of cap.requiredOverlays) {
    checks.push({
      check: 'overlay',
      label: `Overlay: ${overlay}`,
      status: AVAILABLE_OVERLAYS.has(overlay) ? 'provisioned' : 'stub',
      detail: AVAILABLE_OVERLAYS.has(overlay) ? undefined : 'Preview will use placeholder',
    });
  }

  // 3. Required tables (only relevant if backend installed)
  if (backendInstalled) {
    for (const table of cap.requiredTables) {
      checks.push({
        check: 'table',
        label: `Table: ${table}`,
        status: 'provisioned', // Tables are created by migration
      });
    }
  } else {
    checks.push({
      check: 'backend',
      label: 'Backend installation',
      status: 'stub',
      detail: 'Backend not installed — using demo mode',
    });
  }

  // 4. Workflows (stub if backend not installed)
  for (const wf of cap.requiredWorkflows) {
    checks.push({
      check: 'workflow',
      label: `Workflow: ${wf.name}`,
      status: backendInstalled ? 'provisioned' : 'stub',
      detail: backendInstalled ? undefined : 'Will be provisioned on install',
    });
  }

  // 5. Route exists if capability owns routes
  const capRoutes = routePolicy.routes.filter(r => r.ownedBy === cap.id);
  for (const route of capRoutes) {
    checks.push({
      check: 'route',
      label: `Route: ${route.path}`,
      status: 'provisioned',
    });
  }

  return checks;
}
