/**
 * Native Publish Readiness
 *
 * Builds a deterministic PlaygroundSetupSnapshot and a publish-readiness
 * manifest for Unison's native first-party publish path (no third-party
 * provider required). This is the source of truth that the launcher hands to
 * WebBuilder/CreatorPlayground so the booking/contact preview already counts
 * as publish-ready when the owner email is known.
 *
 * Wired with Unison:
 *   - Snapshot feeds resolvePlaygroundControlPlane via setupSnapshot.setupSteps
 *   - Manifest is persisted into /.unison/launch-readiness.json so the in-VFS
 *     setup wizard + intent inspector see the same state as the launcher.
 */

import type {
  PlaygroundSetupSnapshot,
  PlaygroundSetupStepSnapshot,
  PlaygroundState,
} from '@/platform/core/playground';
import { getIndustryIntentProfile } from '@/platform/core/industryIntentProfiles';

export type NativeSetupStepId =
  | 'database'
  | 'notifications'
  | 'booking_calendar'
  | 'payments';

export interface BuildNativePublishSetupSnapshotInput {
  enabled: boolean;
  ownerEmail?: string;
  businessName?: string;
  businessId?: string;
  systemType?: string | null;
  commerceRequired?: boolean;
  paymentProviderConfigured?: boolean;
  paymentProvider?: string | null;
  /** True when an outbound email transport (Resend/SMTP/etc.) is configured for this project. */
  emailTransportConfigured?: boolean;
  /** True when Unison's native owner inbox / intent_execution_log sink is enabled (default true). */
  nativeInboxEnabled?: boolean;
}

export interface BuildNativePublishReadinessManifestInput {
  state: PlaygroundState;
  validations?: unknown;
  setupSnapshot?: PlaygroundSetupSnapshot;
  capabilitiesAwaitingConfirmation?: Array<{ capabilityId: string; reason: string }>;
  enabled: boolean;
  systemType?: string | null;
  commerceRequired?: boolean;
  paymentProviderConfigured?: boolean;
  /** Industry overlay (e.g. 'salon') used to verify required intents are bound. */
  industryOverlay?: string | null;
  emailTransportConfigured?: boolean;
  nativeInboxEnabled?: boolean;
}

const completed = (): PlaygroundSetupStepSnapshot['status'] => 'completed';
const skipped = (): PlaygroundSetupStepSnapshot['status'] => 'skipped';
const pending = (): PlaygroundSetupStepSnapshot['status'] => 'pending';

/**
 * Build a PlaygroundSetupSnapshot that represents Unison's first-party
 * publish path. Returns `undefined` when native mode is disabled so the
 * caller can fall back to its default cloud-state snapshot.
 */
export function buildNativePublishSetupSnapshot(
  input: BuildNativePublishSetupSnapshotInput,
): PlaygroundSetupSnapshot | undefined {
  if (!input.enabled) return undefined;

  const normalizedEmail = (input.ownerEmail || '').trim();
  const hasEmail = normalizedEmail.includes('@');
  const isBooking = input.systemType === 'booking';
  // Unison always writes intents to intent_execution_log, which is the
  // native owner inbox sink. Callers can disable it explicitly if needed.
  const nativeInboxEnabled = input.nativeInboxEnabled !== false;
  const emailTransportConfigured = input.emailTransportConfigured === true;
  // A notification sink is "ready" when the owner can actually see new
  // leads/bookings — either via email transport OR the native inbox.
  // Owner email alone is no longer enough.
  const notificationSinkReady = hasEmail && (emailTransportConfigured || nativeInboxEnabled);
  const notificationProvider = emailTransportConfigured
    ? 'unison-native-email'
    : nativeInboxEnabled
      ? 'unison-native-inbox'
      : 'none';
  const commerceRequired = input.commerceRequired === true;
  const paymentProviderConfigured = input.paymentProviderConfigured === true;
  const paymentsReady = !commerceRequired || paymentProviderConfigured;

  const steps: PlaygroundSetupStepSnapshot[] = [
    {
      id: 'database',
      status: completed(),
      config: {
        provider: 'unison-native',
        destination: 'unison_crm',
        autoProvisioned: true,
        businessId: input.businessId || null,
      },
    },
    {
      id: 'notifications',
      status: notificationSinkReady ? completed() : pending(),
      config: {
        provider: notificationProvider,
        notificationEmail: hasEmail ? normalizedEmail : null,
        emailTransportConfigured,
        nativeInboxEnabled,
        emailDelivery: emailTransportConfigured ? 'configured' : 'optional',
        autoProvisioned: notificationSinkReady,
      },
    },
    {
      id: 'booking_calendar',
      status: isBooking ? completed() : skipped(),
      config: {
        provider: 'unison-native-booking-requests',
        bookingOwner: hasEmail ? normalizedEmail : null,
        businessDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
        opensAt: '09:00',
        closesAt: '17:00',
        autoProvisioned: true,
      },
    },
    {
      id: 'payments',
      status: commerceRequired ? paymentProviderConfigured ? completed() : pending() : skipped(),
      config: {
        commerceRequired,
        paymentProvider: paymentProviderConfigured ? input.paymentProvider || 'configured' : null,
        paymentProviderConfigured,
        ...(!commerceRequired ? { reason: 'No checkout capability is requested.' } : {}),
        autoProvisioned: paymentsReady,
      },
    },
  ];

  return {
    publishStatus: notificationSinkReady && paymentsReady ? 'ready' : 'pending',
    customDomain: null,
    notificationEmail: hasEmail ? normalizedEmail : null,
    projectName: input.businessName || null,
    setupSteps: steps,
  };
}

/**
 * Build a JSON-serializable readiness manifest. This is the same surface the
 * in-Builder Intent Inspector + Launch Health pill consume to decide whether
 * the site can publish without further wiring.
 */
export function buildNativePublishReadinessManifest(
  input: BuildNativePublishReadinessManifestInput,
): Record<string, unknown> {
  const bindings = input.state?.bindings || {};
  const bindingList = Object.values(bindings);
  const previewReady = bindingList.filter((b) => b.previewStatus === 'ready').length;
  const publishReady = bindingList.filter((b) => b.publishStatus === 'ready').length;
  const blocked = bindingList.filter((b) => b.publishStatus === 'blocked').length;

  const notificationStep = input.setupSnapshot?.setupSteps?.find((s) => s.id === 'notifications');
  const bookingStep = input.setupSnapshot?.setupSteps?.find((s) => s.id === 'booking_calendar');
  const paymentsStep = input.setupSnapshot?.setupSteps?.find((s) => s.id === 'payments');

  // Industry intent coverage — verifies the synthesis pass left no required
  // intent unbound and no forbidden intent leaked through.
  const profile = input.industryOverlay ? getIndustryIntentProfile(input.industryOverlay) : undefined;
  const boundIntents = new Set(bindingList.map((b) => b.coreIntent).filter(Boolean) as string[]);
  const unsatisfiedRequired = profile
    ? profile.required.filter((intent) => !boundIntents.has(intent))
    : [];
  const forbiddenLeaked = profile
    ? bindingList
        .filter((b) => b.coreIntent && profile.forbidden.includes(b.coreIntent))
        .map((b) => b.coreIntent as string)
    : [];
  const industryReady = !profile || (unsatisfiedRequired.length === 0 && forbiddenLeaked.length === 0);

  const notifConfig = (notificationStep?.config || {}) as Record<string, unknown>;
  const hasOwnerEmail = typeof notifConfig.notificationEmail === 'string'
    && (notifConfig.notificationEmail as string).includes('@');
  const emailTransportConfigured =
    input.emailTransportConfigured === true || notifConfig.emailTransportConfigured === true;
  const nativeInboxEnabled =
    input.nativeInboxEnabled !== false && notifConfig.nativeInboxEnabled !== false;
  // Honest rule: notifications are ready only if an owner can actually
  // receive them. Email transport OR a native inbox sink is required.
  const notificationsReady =
    hasOwnerEmail && (emailTransportConfigured || nativeInboxEnabled);
  const paymentConfig = (paymentsStep?.config || {}) as Record<string, unknown>;
  const commerceRequired = input.commerceRequired
    ?? paymentConfig.commerceRequired === true;
  const paymentProviderConfigured = input.paymentProviderConfigured
    ?? paymentConfig.paymentProviderConfigured === true;
  const paymentsReady = !commerceRequired || paymentProviderConfigured;

  return {
    publishMode: input.enabled ? 'native-first-party' : 'manual-setup',
    systemType: input.systemType || null,
    industry: input.industryOverlay || null,
    enabled: Boolean(input.enabled),
    notificationsReady,
    notifications: {
      ownerEmail: hasOwnerEmail,
      emailTransportConfigured,
      nativeInboxEnabled,
      sink: emailTransportConfigured
        ? 'email'
        : nativeInboxEnabled
          ? 'native-inbox'
          : 'none',
      stepStatus: notificationStep?.status || 'unknown',
    },
    bookingReady: bookingStep?.status === 'completed',
    commerceRequired,
    paymentsReady,
    payments: {
      required: commerceRequired,
      configured: paymentProviderConfigured,
      stepStatus: paymentsStep?.status || 'unknown',
    },
    capabilitiesAwaitingConfirmation: (input.capabilitiesAwaitingConfirmation ?? []).filter(
      (item) => item.capabilityId.trim() && item.reason.trim(),
    ),
    industryReady,
    bindings: {
      total: bindingList.length,
      previewReady,
      publishReady,
      blocked,
    },
    industryIntentCoverage: profile
      ? {
          industry: profile.industry,
          requiredTotal: profile.required.length,
          requiredSatisfied: profile.required.length - unsatisfiedRequired.length,
          unsatisfiedRequired,
          forbiddenLeaked,
        }
      : null,
    setupSnapshot: input.setupSnapshot || null,
    validationsSummary: summarizeValidations(input.validations),
    generatedAt: new Date().toISOString(),
  };
}

function summarizeValidations(validations: unknown): Record<string, unknown> | null {
  if (!validations || typeof validations !== 'object') return null;
  const v = validations as Record<string, unknown>;
  const errors = Array.isArray(v.errors) ? v.errors.length : 0;
  const warnings = Array.isArray(v.warnings) ? v.warnings.length : 0;
  return { errors, warnings };
}
