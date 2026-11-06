/**
 * Page Registry & Funnel Graph — Canonical page management + funnel orchestration.
 * 
 * Every page has a stable record with funnel role, data bindings, redirect rules,
 * and SEO config. Funnels are first-class graph objects, not just nav links.
 */

import type { PageId, PageSource, PageOutput, IntentId } from "./siteBundle";

// ============================================================================
// Page Types
// ============================================================================

export type BuilderPageType =
  | "landing"
  | "home"
  | "about"
  | "contact"
  | "shop"
  | "product"
  | "checkout"
  | "cart"
  | "thankyou"
  | "booking"
  | "gallery"
  | "blog"
  | "faq"
  | "pricing"
  | "immersive"
  | "legal"
  | "custom";

export type BuilderPageRole =
  | "home"
  | "landing"
  | "service"
  | "contact"
  | "checkout"
  | "thank_you"
  | "upsell"
  | "booking"
  | "shop"
  | "gallery"
  | "faq"
  | "blog"
  | "about"
  | "pricing"
  | "immersive"
  | "legal"
  | "custom";

export type BuilderRouteState =
  | "draft"
  | "generated"
  | "rendering"
  | "preview_ready"
  | "preview_error"
  | "published";

export type BuilderPublishedStatus =
  | "unpublished"
  | "published"
  | "stale";

export type BuilderSetupStatus =
  | "not_started"
  | "partial"
  | "ready";

export type BuilderReadinessStatus =
  | "unknown"
  | "ready"
  | "partial"
  | "blocked";

export type FunnelRole =
  | "entry"
  | "offer"
  | "checkout"
  | "upsell"
  | "downsell"
  | "confirmation"
  | "thankyou";

export type FunnelType =
  | "lead"
  | "booking"
  | "checkout"
  | "application"
  | "custom";

export type RedirectCondition =
  | "afterSubmit"
  | "afterPurchase"
  | "afterBooking"
  | "onTimer"
  | "manual";

// ============================================================================
// Page Data Bindings
// ============================================================================

export interface PageDataBindings {
  /** Which product collection this page displays */
  productsCollectionId?: string;
  /** Which service collection this page displays */
  servicesCollectionId?: string;
  /** Hero image asset reference */
  heroImageAssetId?: string;
  /** Form displayed on this page */
  formId?: string;
  /** Gallery collection */
  galleryCollectionId?: string;
  /** Testimonials collection */
  testimonialsCollectionId?: string;
  /** FAQ collection */
  faqCollectionId?: string;
  /** Team collection */
  teamCollectionId?: string;
  /** Component instances used on this page */
  componentInstanceIds?: string[];
  /** Generic key-value bindings */
  custom?: Record<string, string>;
}

// ============================================================================
// Redirect Rules
// ============================================================================

export interface RedirectRule {
  ruleId: string;
  condition: RedirectCondition;
  /** Target page ID or external URL */
  to: string;
  /** Is target a pageId or an external URL? */
  targetType: "page" | "url";
  /** Optional delay before redirect (ms) */
  delayMs?: number;
  /** Intent that triggers this redirect */
  triggerIntentId?: IntentId;
}

// ============================================================================
// Page SEO
// ============================================================================

export interface PageSeo {
  title?: string;
  description?: string;
  ogImage?: string;
  noIndex?: boolean;
  canonicalUrl?: string;
}

// ============================================================================
// Builder Page — The canonical page record
// ============================================================================

export interface BuilderPage {
  pageId: PageId;
  title: string;
  path: string;
  /** Stable VFS file path (e.g. /src/pages/Contact.tsx) */
  filePath?: string;
  pageType: BuilderPageType;
  /** Canonical operational role used by the Playground control plane */
  pageRole?: BuilderPageRole;
  /** Visitor-authored purpose, kept distinct from operational page role. */
  purpose?: string;

  /** Funnel role (optional — only set if page is part of a funnel) */
  funnelRole?: FunnelRole;
  /** Which funnel this page belongs to */
  funnelId?: string;
  /** All funnel memberships for this page */
  funnelIds?: string[];

  /** Route lifecycle in preview/publish flows */
  routeState?: BuilderRouteState;
  previewLastSyncedAt?: string;
  previewThumbnailUrl?: string;
  previewError?: string;
  publishedStatus?: BuilderPublishedStatus;
  setupStatus?: BuilderSetupStatus;
  readinessSummary?: {
    preview: BuilderReadinessStatus;
    publish: BuilderReadinessStatus;
  };

  /** Source code (the editable/AI-generated source of truth) */
  source: PageSource;
  /** Rendered output */
  output: PageOutput;

  /** What structured data this page consumes */
  dataBindings?: PageDataBindings;

  /** Where this page redirects under certain conditions */
  redirectRules?: RedirectRule[];

  /** SEO configuration */
  seo?: PageSeo;

  /** Visibility in navigation */
  showInNav: boolean;
  /** Sort order in nav */
  navOrder: number;

  /** Is this the homepage? */
  isHome: boolean;

  /**
   * Homepage-first visual language. The homepage establishes the site's design
   * language; every other page records which page it inherited from and the
   * signature it inherited, so drift is detectable by the topology validator.
   */
  visualLanguageSourcePageId?: PageId;
  visualLanguageSignature?: string;

  /** Creation metadata */
  createdAt: string;
  updatedAt: string;
  createdBy: "ai" | "manual" | "template";
}

// ============================================================================
// Funnel Step
// ============================================================================

export interface FunnelStep {
  stepId: string;
  pageId: PageId;
  role: FunnelRole;
  /** Next step ID (null = end of funnel) */
  nextStepId: string | null;
  /** Conditions to advance (default = form submit) */
  advanceOn?: RedirectCondition;
  /** Optional: override redirect target */
  overrideTarget?: string;
  sortOrder: number;
}

// ============================================================================
// Funnel Graph — First-class funnel object
// ============================================================================

export interface FunnelGraph {
  funnelId: string;
  name: string;
  description?: string;
  funnelType?: FunnelType;
  /** Ordered steps */
  steps: FunnelStep[];
  /** Entry step ID */
  entryStepId: string;
  /** Is this funnel active? */
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Page Registry — All pages + funnels for a site
// ============================================================================

export interface PageRegistry {
  /** All pages indexed by pageId */
  pages: Record<PageId, BuilderPage>;
  /** All funnels indexed by funnelId */
  funnels: Record<string, FunnelGraph>;
  /** Homepage page ID */
  homePageId: PageId;
  /**
   * The visual language the homepage established, inherited by every other
   * page. Stamped once the homepage body is authored and accepted.
   */
  visualLanguage?: {
    sourcePageId: PageId;
    signature: string;
    establishedAt: string;
  };
  /** Version for change detection */
  version: number;
}

// ============================================================================
// Utility functions
// ============================================================================

export function createEmptyPageRegistry(): PageRegistry {
  return {
    pages: {},
    funnels: {},
    homePageId: "",
    version: 1,
  };
}

export function createBuilderPage(
  pageId: string,
  title: string,
  path: string,
  pageType: BuilderPageType = "custom",
  options?: Partial<BuilderPage>
): BuilderPage {
  const now = new Date().toISOString();
  return {
    pageId,
    title,
    path,
    pageType,
    pageRole: inferPageRoleFromType(pageType),
    routeState: "draft",
    publishedStatus: "unpublished",
    setupStatus: "not_started",
    readinessSummary: {
      preview: "unknown",
      publish: "unknown",
    },
    source: { kind: "react_tsx", content: "", contentHash: "" },
    output: {},
    showInNav: true,
    navOrder: 0,
    isHome: false,
    createdAt: now,
    updatedAt: now,
    createdBy: "manual",
    ...options,
  };
}

export function createFunnelGraph(
  funnelId: string,
  name: string,
  steps: FunnelStep[] = [],
  options?: Partial<FunnelGraph>
): FunnelGraph {
  const now = new Date().toISOString();
  return {
    funnelId,
    name,
    funnelType: "custom",
    steps,
    entryStepId: steps[0]?.stepId || "",
    isActive: true,
    createdAt: now,
    updatedAt: now,
    ...options,
  };
}

export function inferPageRoleFromType(pageType: BuilderPageType): BuilderPageRole {
  switch (pageType) {
    case "home":
      return "home";
    case "landing":
      return "landing";
    case "contact":
      return "contact";
    case "checkout":
      return "checkout";
    case "thankyou":
      return "thank_you";
    case "booking":
      return "booking";
    case "shop":
    case "product":
    case "cart":
      return "shop";
    case "gallery":
      return "gallery";
    case "faq":
      return "faq";
    case "blog":
      return "blog";
    case "about":
      return "about";
    case "pricing":
      return "pricing";
    case "immersive":
      return "immersive";
    case "legal":
      return "legal";
    case "custom":
    default:
      return "custom";
  }
}

/**
 * Resolve the next page for a funnel step
 */
export function resolveNextFunnelPage(
  registry: PageRegistry,
  currentPageId: string
): BuilderPage | null {
  for (const funnel of Object.values(registry.funnels)) {
    const currentStep = funnel.steps.find(s => s.pageId === currentPageId);
    if (currentStep?.nextStepId) {
      const nextStep = funnel.steps.find(s => s.stepId === currentStep.nextStepId);
      if (nextStep) {
        return registry.pages[nextStep.pageId] || null;
      }
    }
  }
  return null;
}

/**
 * Get pages sorted by nav order
 */
export function getNavPages(registry: PageRegistry): BuilderPage[] {
  return Object.values(registry.pages)
    .filter(p => p.showInNav)
    .sort((a, b) => a.navOrder - b.navOrder);
}

/**
 * Get all pages for a funnel in step order
 */
export function getFunnelPages(registry: PageRegistry, funnelId: string): BuilderPage[] {
  const funnel = registry.funnels[funnelId];
  if (!funnel) return [];
  return funnel.steps
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(step => registry.pages[step.pageId])
    .filter(Boolean);
}
