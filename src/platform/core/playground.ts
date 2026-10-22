/**
 * Playground Types — Structured application model for site generation.
 * 
 * These types define the canonical shape of the Creator's Playground state,
 * including bindings, calendars, popups, and the full materialization pipeline.
 */

import type { BuilderPageType, FunnelRole } from '@/types/pageRegistry';
import type { CreatorData } from '@/types/creatorData';
import type { PageRegistry } from '@/types/pageRegistry';
import type { GeneratedSitePlan } from './siteTopologyPlanner';
import type {
  BuilderPageRole,
  BuilderPublishedStatus,
  BuilderRouteState,
  BuilderSetupStatus,
  FunnelType,
} from '@/types/pageRegistry';

// ============================================================================
// Wizard Input
// ============================================================================

export type BusinessModel =
  | 'appointment_service'
  | 'quote_lead'
  | 'ecommerce'
  | 'portfolio_creator'
  | 'restaurant_hospitality'
  | 'saas_digital'
  | 'nonprofit'
  | 'general';

export type IndustryOverlay =
  | 'salon'
  | 'barber'
  | 'medspa'
  | 'wellness'
  | 'dental'
  | 'fitness'
  | 'photographer'
  | 'coaching'
  | 'local-service'
  | 'contractor'
  | 'hvac'
  | 'cleaning'
  | 'landscaping'
  | 'auto_detailing'
  | 'moving'
  | 'legal'
  | 'real_estate'
  | 'restaurant'
  | 'cafe'
  | 'bakery'
  | 'ecommerce'
  | 'creator'
  | 'agency'
  | 'saas'
  | 'portfolio'
  | 'nonprofit'
  | 'general';

export type WizardScaffoldMode = 'selected-pages' | 'capability-full';

export interface WizardBusinessParameters {
  ownerEmail?: string;
  notificationEmail?: string;
  notificationPhone?: string;
  publicEmail?: string;
  phone?: string;
  tagline?: string;
  description?: string;
  website?: string;
  logoUrl?: string;
  brandColor?: string;
  timezone?: string;
  address?: {
    line1?: string;
    city?: string;
    region?: string;
    postalCode?: string;
    country?: string;
  };
  hours?: Array<{ day: string; open?: string; close?: string; closed?: boolean }>;
  crmDestination?: string;
  bookingOwner?: string;
  paymentProvider?: string;
  followUpChannel?: string;
  ctaDestinations?: Partial<Record<'call' | 'email' | 'booking' | 'quote' | 'ordering', string>>;
  industry?: Record<string, string>;
  socialLinks?: Record<string, string>;
}

export interface WizardSelections {
  visionPrompt?: string;
  compositionPlan?: import('@/sections/aiPageComposition').AIPageCompositionPlan;
  /** Durable visual direction, experience posture, and optional section pins. */
  designSelection?: import('@/services/wizardDesignSelection').WizardDesignSelection;
  businessName: string;
  businessParameters?: WizardBusinessParameters;
  businessModel: BusinessModel;
  industryOverlay: IndustryOverlay;
  primaryGoal: string;
  secondaryGoals: string[];
  /**
   * Canonical BusinessSystemType (booking/saas/agency/portfolio/store/content).
   * Threaded by LauncherWizard so the canonical pipeline can stamp
   * `SiteBundleSnapshot.meta.systemId` and resolve the VerticalLaunchContract
   * deterministically downstream — replacing the legacy `activeSystemType`
   * UI state that DeployButton/Readiness Center used to read.
   *
   * Typed as `string` to avoid a cross-package import; values must match
   * `BusinessSystemType` from `@/data/templates/types`.
   */
  systemType?: string | null;
  needsBooking?: boolean;
  sellsProducts?: boolean;
  wantsLeadCapture?: boolean;
  /** User selected an immersive experience and the launch envelope admitted WebGL. */
  needsImmersive?: boolean;
  templateId?: string;
  themeId?: string;
  /**
   * Canonical ThemePreset id resolved from the wizard's Style card. When
   * present, the canonical pipeline emits a themed `/src/index.css` into the
   * compiled VFS + siteBundleSnapshot so preview, playground, and AIBuilder
   * surfaces all share the same Style-card tokens (instead of falling back
   * to the un-themed default that ships with the base scaffold).
   */
  themePresetId?: string;
  /**
   * Fully resolved semantic HSL tokens captured from the selected Style card.
   * Stage 4b consumes these directly instead of reconstructing colors from a
   * hardcoded preset registry.
   */
  themeTokens?: import('@/sections/types').ThemeTokens;
  /**
   * Constrained final interaction plan. Lane B may supply this after page
   * generation; the platform compiler persists and reapplies it on later
   * saves/restores without asking the model to regenerate the plan.
   */
  interactionManifest?: import('@/services/wizardInteractionEnrichment').WizardInteractionManifest;
  /**
   * Primary intent from the industry profile (e.g. 'booking.create', 'contact.submit').
   * Forwarded to the topology planner so the materializer's internal planSiteTopology
   * call produces the same page set as the LauncherWizard's direct call.
   */
  primaryIntent?: string;
  /**
   * Pages the visitor explicitly selected in the wizard's "Pages" step.
   * Values are PlaygroundPageRole strings ("about", "services", "pricing", etc.).
   * Flows into the capability resolver + topology planner when
   * `scaffoldMode === 'selected-pages'`.
   */
  requestedPages?: string[];
  /**
   * Scaffold strategy:
   *  - 'selected-pages' → Home + visitor-selected pages (default).
   *  - 'capability-full'→ deprecated/normalized to selected-pages for wizard launches.
   * Home-only/minimal/capability-expanded scaffold modes are intentionally
   * unsupported; every rendered wizard page must be explicitly selected.
   */
  scaffoldMode?: WizardScaffoldMode;
  /**
   * When true, the launcher should seed first-party Unison defaults so the
   * generated system can pass publish readiness without requiring third-party
   * setup. This is intended for native lead/contact/booking flows.
   */
  nativePublishReady?: boolean;
  /** Owner email from the authenticated launcher session. Used as the default
   * notification destination and booking owner for native publish mode. */
  ownerEmail?: string;
  /** Explicit publish-mode trace for readiness manifests and future migrations. */
  publishMode?: 'native-first-party' | 'manual-setup';
  /**
   * Stable identifier for the wizard seed produced by this launch. Threaded
   * through `commitToPipeline → projectToSiteBundleSnapshot` so the persisted
   * `snapshot.meta.wizardSeedId` matches the `/.unison/wizard-seed.json` file
   * written into the VFS. Recompile + readiness surfaces use it to verify
   * chain-of-custody between the wizard payload and the live snapshot.
   */
  wizardSeedId?: string;
  /**
   * Intentional "regenerate" token. The ONLY nonce allowed to participate in a
   * design decision; launch identity (`wizardSeedId`) never does.
   */
  regenerationNonce?: string | null;
  /**
   * Target Business Profile the generated project should be saved under.
   * Chosen by the creator in the wizard (BusinessSelector) and threaded
   * into LaunchState + builder_drafts so `sync_draft_to_project` stamps
   * the correct `projects.business_id` on first persist.
   */
  businessId?: string;
}


// ============================================================================
// Slot-Bound Section & Slot Types
// ============================================================================

/** Section types for slot-bound binding specs */
export type BindingSectionType =
  | 'navbar'
  | 'hero'
  | 'services'
  | 'pricing'
  | 'gallery'
  | 'shop-grid'
  | 'cart'
  | 'footer'
  | 'cta'
  | 'contact'
  | 'faq'
  | 'testimonials'
  | 'about'
  | 'blog'
  | 'features'
  | 'stats'
  | 'team';

/** Slot roles within a section */
export type BindingSlotRole =
  | 'primary-cta'
  | 'secondary-cta'
  | 'card-cta'
  | 'checkout-cta'
  | 'cart-trigger'
  | 'form-submit'
  | 'newsletter'
  | 'newsletter-submit'
  | 'nav-link'
  | 'social-link'
  | 'phone-link'
  | 'email-link'
  | 'address-link'
  // Icon-driven interactive slots
  | 'icon-search'
  | 'icon-cart'
  | 'icon-user'
  | 'icon-menu'
  | 'icon-notifications'
  | 'icon-filter'
  | 'icon-sort'
  | 'icon-share'
  | 'icon-favorite'
  | 'icon-theme'
  | 'icon-language'
  | 'icon-chat'
  | 'icon-calendar';

// ============================================================================
// Capability Pack
// ============================================================================

export type PlaygroundPageRole =
  | 'home'
  | 'about'
  | 'services'
  | 'pricing'
  | 'gallery'
  | 'contact'
  | 'booking'
  | 'booking_confirmation'
  | 'checkout'
  | 'thankyou'
  | 'faq'
  | 'blog'
  | 'shop'
  | 'immersive'
  | 'custom';

export type PlaygroundFunnelGoal =
  | 'booking'
  | 'lead_capture'
  | 'purchase'
  | 'quote_request';

export interface CapabilityPack {
  id: string;
  requiredPages: PlaygroundPageRole[];
  requiredFunnels: PlaygroundFunnelGoal[];
  requiredForms: string[];
  requiredCalendars: string[];
  requiredProducts: string[];
  recommendedPopups: string[];
  /** @deprecated Use recommendedBindingsV2 for slot-bound specs */
  recommendedBindings: PlaygroundBindingSpec[];
  /** Slot-bound binding specs (V2) — authoritative source */
  recommendedBindingsV2: PlaygroundBindingSpecV2[];
}

/**
 * @deprecated Legacy label-bound binding spec.
 * Kept for backward compatibility during migration.
 * Use PlaygroundBindingSpecV2 instead.
 */
export interface PlaygroundBindingSpec {
  sourcePageRole: PlaygroundPageRole;
  sourceLabel: string;
  intent: PlaygroundBindingIntent;
  targetRef: string;
}

/**
 * Slot-bound binding spec (V2).
 * 
 * Identity is determined by section + slot, NOT by button label.
 * Labels are presentation-only and can be freely changed without
 * breaking binding resolution.
 */
export interface PlaygroundBindingSpecV2 {
  sourcePageRole: PlaygroundPageRole;
  /** Section where this binding lives */
  sourceSection: BindingSectionType;
  /** Slot role within the section */
  sourceSlot: BindingSlotRole;
  /** Optional stable element key override */
  sourceElementKey?: string;
  /** Display label (presentation only, not used for resolution) */
  label?: string;
  /** Canonical intent from CoreIntent surface */
  coreIntent: string; // CoreIntent — string to avoid circular dependency
  /** Playground-layer intent (for authoring UX) */
  intent: PlaygroundBindingIntent;
  /** Target reference (pageRole, formId, calendarId, route, etc.) */
  targetRef: string;
  /** How the UI should respond */
  uiAction?: 'navigate' | 'overlay' | 'state' | 'toast';
  /** Payload template for data-carrying intents */
  payloadTemplate?: Record<string, unknown>;
}

// ============================================================================
// Playground Binding
// ============================================================================

export type PlaygroundBindingIntent =
  | 'nav.goto_page'
  | 'funnel.goto_step'
  | 'form.open'
  | 'popup.open'
  | 'calendar.open'
  | 'checkout.start'
  | 'product.view'
  | 'cart.view'
  | 'external.open';

export interface PlaygroundBinding {
  bindingId: string;
  sourcePageId: string;
  /** @deprecated Use elementKey for resolution */
  sourceLabel: string;
  intent: PlaygroundBindingIntent;
  /** Target object ID (pageId, formId, calendarId, popupId, productId, or URL) */
  targetId: string;
  /** Resolved target type for display */
  targetType: 'page' | 'form' | 'calendar' | 'popup' | 'product' | 'url' | 'funnel_step';
  /** Confidence score from wizard auto-population */
  confidence: number; // 0-1
  /** Who created this binding */
  source: 'wizard' | 'ai' | 'manual';
  /** Is this binding validated as correct? */
  isValid: boolean;
  /** Validation message if invalid */
  validationMessage?: string;

  // ── V2 Slot-Bound Fields ──────────────────────────────────────────────
  /** Stable element key: pageRole.sectionType.slotRole */
  elementKey?: string;
  /** Section where this binding lives */
  sourceSection?: BindingSectionType;
  /** Slot role within the section */
  sourceSlot?: BindingSlotRole;
  /** Canonical CoreIntent (normalized from playground intent) */
  coreIntent?: string;
  /** UI action type */
  uiAction?: 'navigate' | 'overlay' | 'state' | 'toast';
  /** Payload template */
  payloadTemplate?: Record<string, unknown>;
  /** Preview readiness status */
  previewStatus?: PlaygroundReadinessStatus;
  /** Publish readiness status */
  publishStatus?: PlaygroundReadinessStatus;
  /** Required capabilities for this intent to operate end-to-end */
  requiredCapabilities?: string[];
  /** Missing dependencies blocking preview or publish */
  missingDependencies?: string[];
  /** Suggested actions to resolve blockers */
  fixHints?: string[];
  /** Readiness state */
  readiness?: 'preview-ready' | 'publish-ready' | 'stubbed' | 'blocked';
}

/** Runtime DOM intent emitted by the canonical binding bridge for a Playground intent. */
export function resolvePlaygroundBindingDomIntent(binding: PlaygroundBinding): string {
  switch (binding.intent) {
    case 'nav.goto_page':
      return 'nav.goto';
    case 'external.open':
      return 'nav.external';
    case 'checkout.start':
      if (binding.coreIntent === 'cart.add') return 'cart.add';
      if (binding.coreIntent === 'cart.checkout') return 'cart.checkout';
      if (binding.coreIntent === 'pay.checkout') return 'pay.checkout';
      return binding.coreIntent || 'pay.checkout';
    case 'calendar.open':
    case 'form.open':
    case 'popup.open':
      return binding.coreIntent || 'button.click';
    default:
      return binding.coreIntent || binding.intent;
  }
}

// ============================================================================
// Playground Calendar
// ============================================================================

export interface PlaygroundCalendar {
  calendarId: string;
  name: string;
  bookingType: 'appointment' | 'consultation' | 'class' | 'reservation' | 'general';
  /** Duration in minutes */
  defaultDuration: number;
  /** Intake form to show before booking */
  intakeFormId?: string;
  /** Success page after booking */
  successPageId?: string;
  /** Pages this calendar is attached to */
  attachedPageIds: string[];
  sortOrder: number;
}

// ============================================================================
// Playground Popup
// ============================================================================

export interface PlaygroundPopup {
  popupId: string;
  name: string;
  trigger: 'cta_click' | 'timer' | 'scroll' | 'exit_intent' | 'manual';
  triggerConfig?: {
    delayMs?: number;
    scrollPercent?: number;
  };
  contentType: 'form' | 'calendar' | 'offer' | 'custom';
  /** Form/calendar/product to display */
  contentRefId?: string;
  /** Pages this popup is active on */
  activeOnPageIds: string[];
  /** Redisplay rules */
  showOncePerSession?: boolean;
  sortOrder: number;
}

// ============================================================================
// Playground State — Full structured application model
// ============================================================================

export interface PlaygroundState {
  creatorData: CreatorData;
  pageRegistry: PageRegistry;
  bindings: Record<string, PlaygroundBinding>;
  calendars: Record<string, PlaygroundCalendar>;
  popups: Record<string, PlaygroundPopup>;
}

// ============================================================================
// Materialization Result
// ============================================================================

export interface PlaygroundMaterializationResult {
  playground: PlaygroundState;
  sitePlan: GeneratedSitePlan;
  warnings: string[];
}

// ============================================================================
// Validation
// ============================================================================

export interface PlaygroundValidation {
  id: string;
  severity: 'error' | 'warning' | 'info';
  scope: 'pages' | 'funnels' | 'forms' | 'calendars' | 'products' | 'bindings' | 'router' | 'popups' | 'components';
  message: string;
  targetId?: string;
}

// ============================================================================
// Intent Readiness
// ============================================================================

export type PlaygroundReadinessStatus = 'ready' | 'partial' | 'blocked';
export type PlaygroundReadinessMode = 'preview' | 'publish';
export type PlaygroundResolverSection = 'business' | 'launch' | 'forms' | 'calendars' | 'products' | 'popups' | 'pages' | 'components';
export type PlaygroundSetupField =
  | 'businessName'
  | 'email'
  | 'phone'
  | 'address'
  | 'notificationEmail'
  | 'bookingOwner'
  | 'paymentProvider'
  | 'crmDestination'
  | 'publishDomain'
  | 'followUpChannel';

export interface PlaygroundIntentDependency {
  id: string;
  mode: PlaygroundReadinessMode;
  status: PlaygroundReadinessStatus;
  label: string;
  message: string;
  fixHint?: string;
  resolverSection?: PlaygroundResolverSection;
  resolverField?: PlaygroundSetupField;
  resolverStepId?: string;
}

export interface PlaygroundIntentReadiness {
  bindingId: string;
  previewStatus: PlaygroundReadinessStatus;
  publishStatus: PlaygroundReadinessStatus;
  requiredCapabilities: string[];
  missingDependencies: string[];
  fixHints: string[];
  dependencies: PlaygroundIntentDependency[];
  targetSummary: string;
}

export interface PlaygroundComponentReadiness {
  instanceId: string;
  componentType: string;
  label: string;
  previewStatus: PlaygroundReadinessStatus;
  publishStatus: PlaygroundReadinessStatus;
  dependencies: PlaygroundIntentDependency[];
  missingDependencies: string[];
  fixHints: string[];
}

export interface PlaygroundSetupStepSnapshot {
  id: string;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  config?: Record<string, unknown>;
}

export interface PlaygroundSetupSnapshot {
  publishStatus?: string | null;
  customDomain?: string | null;
  notificationEmail?: string | null;
  projectName?: string | null;
  setupSteps?: PlaygroundSetupStepSnapshot[];
}

export interface PlaygroundIntentReadinessReport {
  bindings: Record<string, PlaygroundBinding>;
  readiness: Record<string, PlaygroundIntentReadiness>;
  componentReadiness: Record<string, PlaygroundComponentReadiness>;
  summary: {
    totalIntents: number;
    previewReady: number;
    previewPartial: number;
    previewBlocked: number;
    publishReady: number;
    publishPartial: number;
    publishBlocked: number;
    hardened: number;
    blocked: number;
    previewOnly: number;
    totalComponents: number;
    componentPublishReady: number;
    componentPublishBlocked: number;
  };
}

// ============================================================================
// Control Plane Resolver
// ============================================================================

export type PlaygroundLaunchTaskCategory =
  | 'required_for_publish'
  | 'recommended_first'
  | 'optional'
  | 'growth';

export interface PlaygroundControlPlanePage {
  pageId: string;
  title: string;
  path: string;
  pageType: BuilderPageType;
  pageRole: BuilderPageRole;
  routeState: BuilderRouteState;
  publishedStatus: BuilderPublishedStatus;
  setupStatus: BuilderSetupStatus;
  previewStatus: PlaygroundReadinessStatus;
  publishStatus: PlaygroundReadinessStatus;
  previewThumbnailUrl?: string;
  previewLastSyncedAt?: string;
  previewError?: string;
  navKey: string;
  isHome: boolean;
  showInNav: boolean;
  funnelIds: string[];
  funnelNames: string[];
  funnelRoles: FunnelRole[];
  routeIssues: PlaygroundValidation[];
  boundIntentCount: number;
}

export interface PlaygroundControlPlaneFunnelStep {
  stepId: string;
  pageId: string;
  title: string;
  path: string;
  role: FunnelRole;
  routeState: BuilderRouteState;
  previewStatus: PlaygroundReadinessStatus;
  publishStatus: PlaygroundReadinessStatus;
  previewThumbnailUrl?: string;
  boundIntentCount: number;
}

export interface PlaygroundControlPlaneFunnel {
  funnelId: string;
  name: string;
  funnelType: FunnelType;
  previewStatus: PlaygroundReadinessStatus;
  publishStatus: PlaygroundReadinessStatus;
  steps: PlaygroundControlPlaneFunnelStep[];
  missingDependencies: string[];
}

export interface PlaygroundLaunchTask {
  id: string;
  label: string;
  description: string;
  category: PlaygroundLaunchTaskCategory;
  blockedCount: number;
  relatedCount: number;
  resolverSection?: PlaygroundResolverSection;
  resolverField?: PlaygroundSetupField;
  resolverStepId?: string;
}

export interface PlaygroundBusinessSetupSection {
  id: string;
  label: string;
  status: PlaygroundReadinessStatus;
  fields: PlaygroundSetupField[];
  missingFields: PlaygroundSetupField[];
}

export interface PlaygroundControlPlaneOverview {
  totalPages: number;
  totalFunnels: number;
  totalIntents: number;
  previewReadyPages: number;
  publishReadyPages: number;
  blockedPages: number;
  blockedFunnels: number;
  blockedLaunchTasks: number;
}

export interface PlaygroundControlPlaneModel {
  state: PlaygroundState;
  validations: PlaygroundValidation[];
  validationSummary: {
    errors: number;
    warnings: number;
    info: number;
    isHealthy: boolean;
  };
  readinessReport: PlaygroundIntentReadinessReport;
  pages: PlaygroundControlPlanePage[];
  funnels: PlaygroundControlPlaneFunnel[];
  intentRegistry: PlaygroundBinding[];
  launchTasks: PlaygroundLaunchTask[];
  businessSetupSections: PlaygroundBusinessSetupSection[];
  overview: PlaygroundControlPlaneOverview;
}

// ============================================================================
// Compiler Output
// ============================================================================

export interface PlaygroundCompileResult {
  /** PageRegistry (already exists, pass-through) */
  pageRouteRegistry: PageRegistry;
  /** VFS files to write */
  vfsFiles: Record<string, string>;
  /** Canonical router file */
  routerFile: {
    path: string;
    content: string;
  };
  /** All bindings for runtime resolution */
  bindingManifest: Record<string, PlaygroundBinding>;
  /** Preview-ready manifest */
  previewManifest: {
    routes: string[];
    homeRoute: string;
  };
}
