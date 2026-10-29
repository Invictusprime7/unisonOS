/**
 * SiteBundle v1 (canonical output)
 * 
 * The complete representation of a site including identity, provenance,
 * blueprint, pages, assets, intents, automations, and runtime config.
 * This is the single source of truth for site state.
 */

import type { Asset, AssetReference } from "./asset";
import type { AutomationWorkflow } from "./automation";
import type { CreatorData } from "./creatorData";
import type { PageRegistry } from "./pageRegistry";

// ============================================================================
// Core ID Types
// ============================================================================

export type SiteBundleVersion = "1.0.0";
export type PageId = string;
export type AssetId = string;
export type IntentId = string;
export type ElementId = string;

// ============================================================================
// UTP (Unison Transport Protocol) Message
// ============================================================================

export type UTPMessage<T extends string, P = unknown> = {
  protocol: "UTP/1";
  type: T;
  requestId: string;     // uuid
  siteId: string;
  pageId?: string;
  ts: number;            // Date.now()
  payload: P;
};

// Host -> Preview
export type HostInitPayload = {
  engine: "simple" | "vfs" | "worker";
  entryPageId: string;
  manifest: SiteManifest;
  entitlements: EntitlementSystem;
  clientIntents?: Record<IntentId, IntentDefinition["handler"]["clientAction"]>;
};
export type HostInit = UTPMessage<"UTP/HOST_INIT", HostInitPayload>;

// Preview -> Host
export type PreviewReadyPayload = {
  capabilities: {
    canNavigate: boolean;
    canOverlay: boolean;
    canState: boolean;
  };
};
export type PreviewReady = UTPMessage<"UTP/PREVIEW_READY", PreviewReadyPayload>;

// Preview -> Host (user clicked link OR intent wants nav)
export type NavRequestPayload = {
  to: string;          // "/about"
  reason: "user" | "intent" | "system";
};
export type NavRequest = UTPMessage<"UTP/NAV_REQUEST", NavRequestPayload>;

// Host -> Preview (approve + instruct render)
export type NavCommitRender = {
  html?: string;
  css?: string;
  js?: string;
  artifacts?: unknown;
};
export type NavCommitPayload = {
  to: string;
  pageId: string;
  render: NavCommitRender;
};
export type NavCommit = UTPMessage<"UTP/NAV_COMMIT", NavCommitPayload>;

// Preview -> Host (button click, form submit, etc.)
export type IntentExecuteContext = {
  label?: string;
  elementId?: string;
  pagePath?: string;
};
export type IntentExecutePayload = {
  bindingId?: string;    // if coming from binding
  intentId: string;
  params: Record<string, unknown>;
  context?: IntentExecuteContext;
};
export type IntentExecute = UTPMessage<"UTP/INTENT_EXECUTE", IntentExecutePayload>;

// Host -> Preview (ack now, result later)
export type IntentAckPayload = {
  accepted: boolean;
  reason?: string; // gating / validation / unknown intent
};
export type IntentAck = UTPMessage<"UTP/INTENT_ACK", IntentAckPayload>;

// Host -> Preview (final result)
export type IntentResultError = { code: string; message: string };
export type IntentResultPayload = {
  ok: boolean;
  intentId: string;
  result?: unknown;
  clientActions?: ClientAction[]; // overlays, toasts, state updates, nav
  error?: IntentResultError;
};
export type IntentResult = UTPMessage<"UTP/INTENT_RESULT", IntentResultPayload>;

// Overlay messages
export type OverlayOpenPayload = { overlayId: string; data?: unknown };
export type OverlayOpen = UTPMessage<"UTP/OVERLAY_OPEN", OverlayOpenPayload>;

export type OverlayClosePayload = { overlayId?: string };
export type OverlayClose = UTPMessage<"UTP/OVERLAY_CLOSE", OverlayClosePayload>;

// State patch messages
export type StatePatchOp = { op: "set" | "merge" | "delete"; key: string; value?: unknown };
export type StatePatchPayload = { patch: StatePatchOp[] };
export type StatePatch = UTPMessage<"UTP/STATE_PATCH", StatePatchPayload>;

// Log event messages
export type LogEventPayload = {
  level: "info" | "warn" | "error";
  event: string;          // "intent.clicked", "nav.commit"
  data?: unknown;
};
export type LogEvent = UTPMessage<"UTP/LOG_EVENT", LogEventPayload>;

// Protocol error messages
export type ProtocolErrorPayload = {
  code: string;
  message: string;
  data?: any;
};
export type ProtocolError = UTPMessage<"UTP/ERROR", ProtocolErrorPayload>;

// ============================================================================
// Site Identity
// ============================================================================

export type SiteStatus = "draft" | "preview" | "published" | "archived";

export interface SiteIdentity {
  siteId: string;        // uuid
  businessId: string;    // uuid (tenant boundary)
  ownerUserId: string;   // uuid
  createdAt: string;     // ISO
  updatedAt: string;     // ISO
  status: SiteStatus;
  slug?: string;         // optional for published routes
  domain?: string;       // optional custom domain
}

// ============================================================================
// Build Provenance & Tracing
// ============================================================================

export type BuildMode = "systems_ai" | "builder_ai" | "manual";

export type BuildStage =
  | "blueprint"
  | "layout"
  | "pages"
  | "intents"
  | "assets"
  | "automations"
  | "preview"
  | "publish";

export type BuildTraceEvent = {
  ts: string;
  stage: BuildStage;
  level: "info" | "warn" | "error";
  message: string;
  data?: Record<string, unknown>;
};

export type BuildWarning = { code: string; message: string; data?: unknown };
export type BuildError = { code: string; message: string; data?: unknown };

export interface BuildProvenance {
  buildId: string;        // uuid
  buildMode: BuildMode;
  prompt?: string;        // original user prompt if applicable
  model?: string;         // e.g. google/gemini-3.8-flash
  seed?: string;          // optional deterministic seed
  temperature?: number;
  startedAt: string;      // ISO
  finishedAt?: string;    // ISO
  durationMs?: number;

  // allows "why did it do that?"
  trace: BuildTraceEvent[];
  warnings: BuildWarning[];
  errors: BuildError[];
}

// ============================================================================
// Brand Primitives
// ============================================================================

export type BrandTone = 
  | "luxury" 
  | "minimal" 
  | "bold" 
  | "playful" 
  | "corporate" 
  | "editorial" 
  | "tech";

export interface BrandColors {
  primary: string;
  secondary?: string;
  accent?: string;
  background?: string;
  foreground?: string;
  muted?: string;
  danger?: string;
  success?: string;
  warning?: string;
}

export interface BrandTypography {
  headingFont?: string;
  bodyFont?: string;
}

export interface BrandPrimitives {
  name: string;
  tagline?: string;
  logo?: AssetRef;
  colors: BrandColors;
  typography?: BrandTypography;
  tone?: BrandTone;
  locale?: string; // e.g. en-US
}

// ============================================================================
// Navigation & Manifest
// ============================================================================

export interface RouteDef {
  path: string;              // "/about"
  pageId: PageId;
  isHome?: boolean;
  requiresAuth?: boolean;
}

export interface NavItem {
  label: string;
  path: string;
  pageId: PageId;
  type?: "link" | "dropdown";
  children?: NavItem[];
}

export type LayoutHeaderStyle = "default" | "minimal" | "none";
export type LayoutFooterStyle = "default" | "minimal" | "none";

export interface SiteManifest {
  routes: RouteDef[];        // canonical routing table
  nav: NavItem[];            // canonical nav display
  layout: {
    header?: LayoutHeaderStyle;
    footer?: LayoutFooterStyle;
  };
  metadata: {
    title: string;
    description?: string;
    ogImage?: AssetRef;
  };
}

// ============================================================================
// Pages
// ============================================================================

export type PageSourceKind = "template_ast" | "html" | "react_tsx";

export interface PageSource {
  kind: PageSourceKind;
  content: string;          // raw source
  contentHash: string;
}

export interface PageOutputArtifacts {
  type: "vite";
  entryJs: string;
  assets: string[];         // file paths in artifact store
}

export interface PageOutput {
  // Simple/VFS can render HTML; worker can render built assets
  html?: string;
  css?: string;
  js?: string;

  // for worker builds (vite bundle refs)
  artifacts?: PageOutputArtifacts;
}

export interface PageBundle {
  pageId: PageId;
  title: string;
  path: string;

  // editable/AI regen source-of-truth
  source: PageSource;

  // runtime render target(s)
  output: PageOutput;

  // intent bindings local to this page (optional convenience)
  intentBindings?: IntentBinding[];

  // page-scoped data (e.g. product list, hours, etc.)
  data?: Record<string, unknown>;
}

// ============================================================================
// Assets
// ============================================================================

export type AssetRef = { assetId: AssetId };

export interface AssetStorage {
  kind: "supabase" | "s3" | "inline";
  bucket?: string;
  path?: string;
  url?: string;       // signed/public
  inlineBase64?: string;
}

export interface AssetMeta {
  width?: number;
  height?: number;
  sizeBytes?: number;
  alt?: string;
  tags?: string[];
}

export interface AssetBundle {
  assetId: AssetId;
  type: "image" | "video" | "file" | "font" | "icon";
  mimeType: string;
  name: string;
  storage: AssetStorage;
  meta?: AssetMeta;
}

// ============================================================================
// Intents
// ============================================================================

export type IntentCategory = 
  | "nav"
  | "overlay"
  | "form"
  | "commerce"
  | "auth"
  | "crm"
  | "automation";

/**
 * JSON Schema - simplified for runtime validation
 */
export type JsonSchema = Record<string, unknown>;

/**
 * Reference to an edge function
 */
export type EdgeFunctionRef = {
  name: string;          // "intent-exec" or "crm-lead-submit"
  path: string;          // "/functions/v1/intent-exec"
  method: "POST";
};

/**
 * Client-side actions that can be executed without server roundtrip
 */
export type ClientAction =
  | { type: "NAVIGATE"; to: string }
  | { type: "OPEN_OVERLAY"; overlayId: string }
  | { type: "CLOSE_OVERLAY"; overlayId?: string }
  | { type: "SET_STATE"; key: string; value: unknown }
  | { type: "TOAST"; message: string; level?: "info" | "success" | "warning" | "error" };

export interface IntentDefinition {
  intentId: IntentId;                 // "lead.submit" "nav.to" "cart.open"
  category: IntentCategory;
  description: string;

  // runtime-safe params schema (Zod-like JSON schema)
  paramsSchema: JsonSchema;

  // what runtime does when executed
  handler: {
    kind: "client" | "edge" | "both";
    clientAction?: ClientAction;      // overlays, navigation, state
    edgeFunction?: EdgeFunctionRef;   // supabase function name + route
  };

  // gating
  requires?: {
    featureFlag?: string;
    minPlan?: "free" | "starter" | "pro" | "agency" | "enterprise";
    integrations?: string[]; // e.g. ["stripe", "gmail"]
  };
}

/**
 * Target selector for intent binding
 */
export type BindingTargetStrategy = "data-attr" | "css" | "xpath";

export interface BindingTarget {
  strategy: BindingTargetStrategy;
  selector: string; // prefer data-ut-id="..."
}

export interface IntentBinding {
  bindingId: string;    // uuid
  pageId: PageId;
  
  // stable selector path so regen doesn't break
  target: BindingTarget;
  
  intentId: IntentId;
  params: Record<string, unknown>;
  
  // optional metadata for debugging
  label?: string;  // original button text, etc.
}

export interface IntentSystem {
  catalogVersion: string; // e.g. "2026-02-18"
  definitions: Record<IntentId, IntentDefinition>;
  bindings: IntentBinding[];
}

// ============================================================================
// Automations
// ============================================================================

export type AutomationTrigger =
  | { type: "intent"; intentId: IntentId }
  | { type: "event"; eventName: string }
  | { type: "schedule"; cron: string };

export type AutomationRuntime = {
  kind: "inngest" | "edge" | "internal";
  entrypoint: string; // function name or workflow id
};

export type AutomationInstall = {
  installId: string;          // uuid
  recipeId: string;           // "local_service.lead_followup.v1"
  enabled: boolean;
  triggers: AutomationTrigger[];
  runtime: AutomationRuntime;
  config?: Record<string, unknown>; // user toggles, delays, templates, etc.
};

export type SecretRequirement = {
  provider: string;       // "stripe" "gmail"
  scopes?: string[];
  reason: string;
};

export interface AutomationSystem {
  installed: AutomationInstall[];
  secretsRequired: SecretRequirement[];
}

// ============================================================================
// Integrations
// ============================================================================

export type ProviderConfig = {
  provider: string;
  enabled: boolean;
  publicConfig?: Record<string, unknown>;
  // secrets always outside bundle
};

export interface IntegrationSystem {
  providers: ProviderConfig[];
}

// ============================================================================
// Entitlements
// ============================================================================

export type PlanTier = "free" | "starter" | "pro" | "agency" | "enterprise";

export interface EntitlementSystem {
  plan: PlanTier;
  features: Record<string, boolean>;
  limits: Record<string, number>;
}

// ============================================================================
// Runtime
// ============================================================================

export type PreviewEngine = "simple" | "vfs" | "worker";

export interface RuntimeConfig {
  preferredEngine: PreviewEngine;
  enginesAllowed: PreviewEngine[];
  entry: {
    type: "html" | "react";
    pageId: PageId;
  };
}

// ============================================================================
// Publishing
// ============================================================================

export type PublishArtifact =
  | { type: "static"; indexHtml: AssetRef; files: AssetRef[] }
  | { type: "worker"; bundleId: string; entry: string; files: string[] };

export interface PublishInfo {
  publishedAt: string;
  artifact: PublishArtifact;
  version?: string;
  changelog?: string;
}

// ============================================================================
// Business Blueprint (optional - from Systems AI)
// ============================================================================

export type BlueprintPage = { title: string; path: string; purpose: string };
export type BlueprintCta = { label: string; intentId: IntentId; params?: unknown };

export type BusinessBlueprint = {
  industry: string;                 // "contractor"
  businessName: string;
  primaryGoal: "leads" | "bookings" | "sales" | "newsletter";
  pages: BlueprintPage[];
  ctas: BlueprintCta[];
  offerings?: string[];
  locations?: string[];
  contact?: { phone?: string; email?: string };
};

// ============================================================================
// Main SiteBundle Type
// ============================================================================

export interface SiteBundle {
  version: SiteBundleVersion;

  // identity + tenancy
  site: SiteIdentity;

  // provenance + reproducibility
  build: BuildProvenance;

  // business blueprint (Systems AI output; optional for manual)
  blueprint?: BusinessBlueprint;

  // brand primitives
  brand: BrandPrimitives;

  // navigation + routing
  manifest: SiteManifest;

  // page sources (builder + runtime)
  pages: Record<PageId, PageBundle>;

  // assets referenced by pages/components
  assets: Record<AssetId, AssetBundle>;

  // canonical intent/action wiring (what makes buttons "work")
  intents: IntentSystem;

  // automation recipes installed for this site (hidden tree)
  automations: AutomationSystem;

  // integration config (kept minimal in bundle; secrets not stored here)
  integrations: IntegrationSystem;

  // entitlement + gating data to drive UI + runtime enforcement
  entitlements: EntitlementSystem;

  // runtime metadata (preview engines)
  runtime: RuntimeConfig;

  // publish artifact pointers (optional until published)
  publish?: PublishInfo;

  // ═══════════════════════════════════════════════════════════════════════════
  // Creator Data Layer — structured business content that all pages consume
  // ═══════════════════════════════════════════════════════════════════════════
  creatorData?: CreatorData;

  // ═══════════════════════════════════════════════════════════════════════════
  // Page Registry + Funnel Graph — canonical page management + funnel flow
  // ═══════════════════════════════════════════════════════════════════════════
  pageRegistry?: PageRegistry;
}

// ============================================================================
// API Contracts
// ============================================================================

// A) POST /functions/v1/site-build - Systems AI build
export interface SiteBuildRequest {
  businessId: string;
  ownerUserId: string;
  mode: BuildMode;
  prompt: string;
  industry?: string;
  constraints?: {
    pagesMax?: number;
    tone?: string;
    [key: string]: unknown;
  };
  assets?: Array<{ assetId: string }>;
}

export interface SiteBuildResponse {
  ok: true;
  siteId: string;
  buildId: string;
  bundle: SiteBundle;
}

// B) PATCH /functions/v1/site-bundle - Bundle mutation
export type BundleOpType =
  | "page.create"
  | "page.update"
  | "page.updateSource"
  | "page.delete"
  | "intent.bind"
  | "intent.unbind"
  | "asset.add"
  | "asset.remove"
  | "manifest.update";

export interface BundleOpPageUpdateSource {
  op: "page.updateSource";
  pageId: string;
  source: PageSource;
}

export interface BundleOpIntentBind {
  op: "intent.bind";
  binding: IntentBinding;
}

export interface BundleOpIntentUnbind {
  op: "intent.unbind";
  bindingId: string;
}

export interface BundleOpPageCreate {
  op: "page.create";
  page: PageBundle;
}

export interface BundleOpPageUpdate {
  op: "page.update";
  pageId: string;
  updates: Partial<PageBundle>;
}

export interface BundleOpPageDelete {
  op: "page.delete";
  pageId: string;
}

export interface BundleOpAssetAdd {
  op: "asset.add";
  asset: AssetBundle;
}

export interface BundleOpAssetRemove {
  op: "asset.remove";
  assetId: string;
}

export interface BundleOpManifestUpdate {
  op: "manifest.update";
  updates: Partial<SiteManifest>;
}

export type BundleOp =
  | BundleOpPageCreate
  | BundleOpPageUpdate
  | BundleOpPageUpdateSource
  | BundleOpPageDelete
  | BundleOpIntentBind
  | BundleOpIntentUnbind
  | BundleOpAssetAdd
  | BundleOpAssetRemove
  | BundleOpManifestUpdate;

export interface SiteBundlePatchRequest {
  siteId: string;
  buildId: string;
  ops: BundleOp[];
}

export interface SiteBundlePatchResponse {
  ok: true;
  bundle: SiteBundle;
}

// C) POST /functions/v1/intent-execute - Intent execution
export interface IntentExecuteRequest {
  siteId: string;
  pageId: string;
  intentId: string;
  params: Record<string, unknown>;
  context: {
    bindingId: string;
    [key: string]: unknown;
  };
}

export interface IntentExecuteResponse {
  ok: true;
  clientActions: ClientAction[];
  result: Record<string, unknown>;
}

// D) POST /functions/v1/site-publish - Publish site
export type PublishMode = "static" | "ssr" | "hybrid";

export interface SitePublishRequest {
  siteId: string;
  buildId: string;
  publishMode: PublishMode;
}

export interface SitePublishResponse {
  ok: true;
  publishedAt: string; // ISO
  artifact: PublishArtifact;
}

// Generic API error response
export interface ApiErrorResponse {
  ok: false;
  error: {
    code: string;
    message: string;
    data?: unknown;
  };
}

export type ApiResponse<T> = T | ApiErrorResponse;

// ============================================================================
// Database Row Types
// ============================================================================

export interface SiteRow {
  siteId: string;
  businessId: string;
  ownerUserId: string;
  status: SiteStatus;
  slug?: string;
  domain?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SiteBuildRow {
  buildId: string;
  siteId: string;
  mode: BuildMode;
  startedAt: string;
  finishedAt?: string;
  warningsCount: number;
  errorsCount: number;
}

export interface SiteBundleRow {
  siteId: string;
  buildId: string;
  version: SiteBundleVersion;
  bundleJson: string; // JSON-serialized SiteBundle
  createdAt: string;
}

export interface IntentEventRow {
  eventId: string;
  siteId: string;
  pageId: string;
  intentId: string;
  bindingId: string;
  ok: boolean;
  createdAt: string;
  metaJson?: string; // JSON-serialized metadata
}

export interface WorkflowRunRow {
  runId: string;
  siteId: string;
  recipeId: string;
  ok: boolean;
  createdAt: string;
  metaJson?: string;
}

export interface PublishArtifactRow {
  siteId: string;
  buildId: string;
  artifactJson: string; // JSON-serialized PublishArtifact
  publishedAt: string;
}

// ============================================================================
// Preview Engine Types
// ============================================================================

export interface PreviewEngineConfig {
  engine: PreviewEngine;
  reason: string;
  capabilities: {
    multiPage: boolean;
    hotReload: boolean;
    tsxBuild: boolean;
    isolation: boolean;
  };
}

// ============================================================================
// Build Pipeline Types
// ============================================================================

export type BuildPipelineStage =
  | "init"          // Stage 0: Create site + build record
  | "blueprint"     // Stage 1: Generate BusinessBlueprint  
  | "brand"         // Stage 2: Produce brand kit
  | "pages"         // Stage 3: Pages + manifest
  | "intents"       // Stage 4: Intent wiring
  | "automations"   // Stage 5: Automations install
  | "entitlements"  // Stage 6: Entitlements + gating
  | "persist";      // Stage 7: Persist bundle

export type BuildPipelineStatus = "pending" | "running" | "completed" | "failed" | "skipped";

export interface BuildStageResult {
  stage: BuildPipelineStage;
  status: BuildPipelineStatus;
  startedAt?: string;
  completedAt?: string;
  error?: BuildError;
  warnings?: BuildWarning[];
}

export interface BuildPipelineState {
  buildId: string;
  siteId: string;
  mode: BuildMode;
  currentStage: BuildPipelineStage;
  stages: Record<BuildPipelineStage, BuildStageResult>;
  bundle: SiteBundle;
  startedAt: string;
  completedAt?: string;
}

export interface BuildPipelineContext {
  businessId: string;
  ownerUserId: string;
  prompt?: string;
  industry?: string;
  constraints?: Record<string, unknown>;
  existingAssets?: Array<{ assetId: string }>;
}

// Intent wiring rule types
export interface IntentWiringRule {
  pattern: string | RegExp;
  intentId: IntentId;
  priority: number;
  source: "deterministic" | "ai";
}

export interface IntentWiringResult {
  elementId: string;        // data-ut-id value
  intentId: IntentId;
  params: Record<string, unknown>;
  source: "deterministic" | "ai";
  confidence?: number;      // AI confidence score (0-1)
}

// ============================================================================
// Client Orchestration Types
// ============================================================================

export interface ClientOrchestrationState {
  siteId: string;
  buildId: string;
  engine: PreviewEngine;
  status: "loading" | "initializing" | "ready" | "error";
  currentPage: string;
  error?: string;
}

export interface PreviewBootPayload {
  manifest: SiteManifest;
  entitlements: EntitlementSystem;
  initialPage: {
    pageId: string;
    html: string;
    css?: string;
    js?: string;
  };
}

// ============================================================================
// Helper Types
// ============================================================================

export type PartialSiteBundle = Partial<SiteBundle> & {
  version: SiteBundleVersion;
  site: SiteIdentity;
};

export interface SiteBundleDiff {
  added: string[];
  removed: string[];
  modified: string[];
  unchanged: string[];
}

export interface SiteBundleValidationResult {
  valid: boolean;
  errors: Array<{
    path: string;
    message: string;
    code: string;
  }>;
  warnings: Array<{
    path: string;
    message: string;
    code: string;
  }>;
}
