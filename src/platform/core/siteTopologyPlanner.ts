/**
 * Site Topology Planner
 * 
 * Generates a structured site plan (GeneratedSitePlan) from industry profile
 * BEFORE any file generation occurs. This is the canonical source of truth
 * for what pages exist, which are navigable, and how CTAs resolve.
 * 
 * Flow:
 *   IndustryProfile → planSiteTopology() → GeneratedSitePlan
 *   GeneratedSitePlan → populateRegistryFromTopology() → PageRegistry
 *   PageRegistry → VFS scaffolding → Preview
 * 
 * RULE: The topology drives the files, not the other way around.
 */

import type { IndustryProfile, PageSpec } from './industryMatrix';
import { getIndustryProfile, normalizeIndustryKey } from './industryMatrix';
import type {
  PageRegistry,
  BuilderPage,
  BuilderPageType,
  RedirectRule,
  FunnelType,
} from '@/types/pageRegistry';
import {
  createEmptyPageRegistry,
  createBuilderPage,
  inferPageRoleFromType,
} from '@/types/pageRegistry';
import { generateUUID } from '@/utils/uuid';

// ============================================================================
// Site Topology Types
// ============================================================================

export type PageRole =
  | 'home'
  | 'about'
  | 'services'
  | 'contact'
  | 'pricing'
  | 'gallery'
  | 'faq'
  | 'booking'
  | 'checkout'
  | 'thank_you'
  | 'blog'
  | 'shop'
  | 'immersive'
  | 'custom';

const PAGE_ROLE_SPECS: Partial<Record<PageRole, PageSpec>> = {
  about:    { title: 'About',    path: '/about',    purpose: 'about', expectedSections: [] },
  services: { title: 'Services', path: '/services', purpose: 'services', expectedSections: [] },
  pricing:  { title: 'Pricing',  path: '/pricing',  purpose: 'pricing', expectedSections: [] },
  gallery:  { title: 'Gallery',  path: '/gallery',  purpose: 'portfolio', expectedSections: [] },
  faq:      { title: 'FAQ',      path: '/faq',      purpose: 'faq', expectedSections: [] },
  contact:  { title: 'Contact',  path: '/contact',  purpose: 'contact', expectedSections: [] },
  booking:  { title: 'Book',     path: '/booking',  purpose: 'booking', expectedSections: [] },
  checkout: { title: 'Checkout', path: '/checkout', purpose: 'checkout', expectedSections: [] },
  blog:     { title: 'Blog',     path: '/blog',     purpose: 'blog', expectedSections: [] },
  shop:     { title: 'Shop',     path: '/shop',     purpose: 'shop', expectedSections: [] },
  immersive:{ title: 'Experience', path: '/experience', purpose: 'immersive', expectedSections: [] },
};
const PAGE_ROLE_ALIASES: Record<string, PageRole> = {
  index: 'home', landing: 'services', service: 'services', room: 'services', rooms: 'services',
  accommodation: 'services', accommodations: 'services', stay: 'services', stays: 'services',
  portfolio: 'gallery', work: 'gallery', listings: 'gallery',
  book: 'booking', 'book-now': 'booking', reserve: 'booking', reservations: 'booking',
  thankyou: 'thank_you', 'thank-you': 'thank_you', 'booking-confirmation': 'thank_you', booking_confirmation: 'thank_you',
  experience: 'immersive',
};

/** Resolve legacy route/page-type spellings to the topology's canonical role. */
export function resolveTopologyPageRoleAlias(value: string): PageRole | null {
  const key = value.trim().toLowerCase().replace(/\\/g, '/')
    .replace(/\.(?:tsx?|jsx?)$/, '').split('/').filter(Boolean).pop()
    ?.replace(/[\s_]+/g, '-') ?? '';
  if (!key) return null;
  const alias = PAGE_ROLE_ALIASES[key];
  if (alias) return alias;
  const normalized = key.replace(/-/g, '_') as PageRole;
  return normalized in PAGE_ROLE_SPECS || normalized === 'home' || normalized === 'custom'
    ? normalized
    : null;
}

export function listTopologyPageRoleAliases(value: string): string[] {
  const canonical = resolveTopologyPageRoleAlias(value);
  if (!canonical) return [];
  return [canonical, ...Object.entries(PAGE_ROLE_ALIASES)
    .filter(([, target]) => target === canonical)
    .map(([alias]) => alias)];
}

export function resolvePageSpecsForRoles(
  roles: readonly string[],
  industryKey?: string | null,
): PageSpec[] {
  const profile = industryKey ? getIndustryProfile(industryKey) : undefined;
  return roles.flatMap((role) => {
    const canonicalRole = resolveTopologyPageRoleAlias(role) ?? role as PageRole;
    // Preserve the selected semantic role while recovering the industry's
    // authored page identity. Example: contractor `gallery` => Projects
    // (/projects), real-estate `gallery` => Listings (/listings), restaurant
    // `services` => Menu (/menu). Falling back to PAGE_ROLE_SPECS keeps this
    // API safe for callers that intentionally operate without an industry.
    const industrySpec = profile?.defaultPages.find(
      (candidate) => PURPOSE_TO_ROLE[candidate.purpose] === canonicalRole,
    );
    const spec = industrySpec ?? PAGE_ROLE_SPECS[canonicalRole];
    return spec ? [{ ...spec, expectedSections: [...spec.expectedSections] }] : [];
  });
}

export interface PageRouteNode {
  id: string;
  name: string;
  title: string;
  route: string;
  role: PageRole;
  filePath: string;
  visibleInNav: boolean;
  isHome: boolean;
  generatedBy: 'wizard' | 'ai' | 'manual';
  funnelId?: string | null;
  seo?: {
    title?: string;
    description?: string;
  };
}

export interface RedirectBinding {
  id: string;
  sourcePageId: string;
  sourceElementLabel: string;
  intent: 'nav.goto_page';
  targetPageId: string;
  targetRoute: string;
  fallbackRoute?: string;
}

export interface FunnelPlan {
  funnelId: string;
  name: string;
  funnelType?: FunnelType;
  steps: Array<{
    pageId: string;
    role: string;
    sortOrder: number;
  }>;
}

export interface GeneratedSitePlan {
  siteId: string;
  industry: string;
  businessName: string;
  homePageId: string;
  pages: PageRouteNode[];
  navItems: string[]; // page IDs visible in nav
  funnels: FunnelPlan[];
  redirects: RedirectBinding[];
  generatedAt: string;
  /** Validation errors detected during planning */
  validationErrors?: string[];
  /**
   * Optional template composition id (from src/sections/templates) selected via
   * the Wizard Launcher chip. The VFS scaffolder uses this to drive sub-page
   * layouts as role-filtered subsets of the chosen template.
   */
  selectedTemplateId?: string;
  /**
   * Resolved wizard Style-card ThemePreset id. Route scaffolds use this to
   * stamp the same token seed into inline section compositions that cannot
   * inherit from `/src/index.css` alone.
   */
  selectedThemePresetId?: string;
  /**
   * Optional WizardSeed payload (see /.unison/wizard-seed.json). When present,
   * page scaffolders apply seed-derived brand/contact/tagline overrides to
   * every composed page so subpages reflect the wizard selections — not the
   * template's static sample content. Threaded by `compilePlayground` after
   * parsing the seed file from `existingVfsFiles`.
   */
  wizardSeed?: Record<string, unknown>;
}

// ============================================================================
// Purpose-to-PageType mapping
// ============================================================================

const PURPOSE_TO_PAGE_TYPE: Record<string, BuilderPageType> = {
  landing: 'home',
  services: 'landing',     // services page uses landing layout
  portfolio: 'gallery',
  contact: 'contact',
  about: 'about',
  blog: 'blog',
  shop: 'shop',
  checkout: 'checkout',
  booking: 'booking',
  pricing: 'landing',
  faq: 'landing',
  immersive: 'immersive',
};

const PURPOSE_TO_ROLE: Record<string, PageRole> = {
  landing: 'home',
  services: 'services',
  portfolio: 'gallery',
  contact: 'contact',
  about: 'about',
  blog: 'blog',
  shop: 'shop',
  checkout: 'checkout',
  booking: 'booking',
  pricing: 'pricing',
  faq: 'faq',
  immersive: 'immersive',
};

// ============================================================================
// CTA Redirect Inference
// ============================================================================

/** Maps hero CTA labels to their target page roles */
const CTA_TARGET_MAP: Record<string, PageRole> = {
  'Book Now': 'booking',
  'Book Appointment': 'booking',
  'Schedule': 'booking',
  'Get Quote': 'contact',
  'Get Started': 'contact',
  'Contact Us': 'contact',
  'View Services': 'services',
  'Our Services': 'services',
  'View Pricing': 'pricing',
  'See Pricing': 'pricing',
  'Shop Now': 'shop',
  'Browse Products': 'shop',
  'View Gallery': 'gallery',
  'See Our Work': 'gallery',
  'Learn More': 'about',
  'About Us': 'about',
};

// Hidden pages that should not appear in navigation
const HIDDEN_ROLES: Set<PageRole> = new Set([
  'thank_you',
  'checkout',
]);

// ============================================================================
// Core Planner
// ============================================================================

/**
 * Generate a site topology from an industry key + business name.
 * This runs BEFORE file generation.
 */
export function planSiteTopology(
  industryKey: string,
  businessName: string,
  options?: {
    additionalPages?: PageSpec[];
    primaryIntent?: string;
    /** Template composition id selected by the wizard chip — drives sub-page scaffolding. */
    selectedTemplateId?: string;
    /** Resolved ThemePreset id selected by the wizard Style card. */
    selectedThemePresetId?: string;
    /**
     * When true, only the Home page from the industry profile plus the
     * caller-supplied `additionalPages` are scaffolded. Industry default
     * pages the user did NOT select in the 4-step wizard are excluded so
     * the preview never renders blank/irrelevant routes.
     */
    restrictToAdditionalPages?: boolean;
  }
): GeneratedSitePlan {
  const profile = getIndustryProfile(industryKey);
  if (!profile) {
    throw new Error(
      `[SiteTopologyPlanner] Unknown industry "${industryKey}" (normalized "${normalizeIndustryKey(industryKey)}"). ` +
      'Refusing to emit generic/minimal topology; route generation must use a registered wizard industry profile.',
    );
  }

  return planFromProfile(profile, businessName, options);
}

function planFromProfile(
  profile: IndustryProfile,
  businessName: string,
  options?: {
    additionalPages?: PageSpec[];
    primaryIntent?: string;
    selectedTemplateId?: string;
    selectedThemePresetId?: string;
    restrictToAdditionalPages?: boolean;
  }
): GeneratedSitePlan {
  const siteId = generateUUID();
  const pages: PageRouteNode[] = [];
  const navItems: string[] = [];
  const redirects: RedirectBinding[] = [];
  let homePageId = '';

  // 1. Build pages from industry defaultPages
  // In "selected-pages" mode (restrictToAdditionalPages=true) only Home is
  // retained from the industry defaults; every other route MUST come from
  // the user's explicit wizard selection to avoid blank scaffolded pages.
  const homeSpec =
    profile.defaultPages.find((p) => p.path === '/') || profile.defaultPages[0];
  const baseSpecs = options?.restrictToAdditionalPages
    ? (homeSpec ? [homeSpec] : [])
    : profile.defaultPages;

  // Deduplicate by path so a user selection matching a default doesn't double-emit.
  const seenPaths = new Set<string>();
  const allPageSpecs: PageSpec[] = [];
  for (const spec of [...baseSpecs, ...(options?.additionalPages || [])]) {
    const key = (spec.path || '').toLowerCase();
    if (seenPaths.has(key)) continue;
    seenPaths.add(key);
    allPageSpecs.push(spec);
  }

  for (const spec of allPageSpecs) {
    const pageId = generateUUID();
    const role = PURPOSE_TO_ROLE[spec.purpose] || 'custom';
    const isHome = spec.path === '/';
    const slug = spec.path.replace(/^\//, '') || 'index';

    if (isHome) homePageId = pageId;

    const node: PageRouteNode = {
      id: pageId,
      name: spec.title,
      title: spec.title,
      route: spec.path,
      role,
      filePath: isHome
        ? '/src/pages/Home.tsx'
        : `/src/pages/${capitalize(slug)}.tsx`,
      visibleInNav: !HIDDEN_ROLES.has(role),
      isHome,
      generatedBy: 'wizard',
      seo: {
        title: `${spec.title} | ${businessName}`,
        description: `${spec.title} page for ${businessName}`,
      },
    };

    pages.push(node);
    if (node.visibleInNav) {
      navItems.push(pageId);
    }
  }

  // Ensure we have a home page
  if (!homePageId && pages.length > 0) {
    homePageId = pages[0].id;
    pages[0].isHome = true;
  }

  // 2. Build funnels from industry conversion patterns
  const funnels: FunnelPlan[] = [];
  const primaryIntent = options?.primaryIntent || profile.primaryIntent;

  // Booking funnel: landing → booking → thank you
  if (primaryIntent.startsWith('booking.')) {
    const bookingPage = pages.find(p => p.role === 'booking');
    const thankYouPage = pages.find(p => p.role === 'thank_you');
    const homePage = pages.find(p => p.isHome);
    if (homePage && bookingPage) {
      const funnelId = generateUUID();
      const steps: FunnelPlan['steps'] = [
        { pageId: homePage.id, role: 'entry', sortOrder: 0 },
        { pageId: bookingPage.id, role: 'offer', sortOrder: 1 },
      ];
      if (thankYouPage) {
        steps.push({ pageId: thankYouPage.id, role: 'confirmation', sortOrder: 2 });
      }
      // Tag pages with funnelId
      bookingPage.funnelId = funnelId;
      if (thankYouPage) thankYouPage.funnelId = funnelId;
      funnels.push({ funnelId, name: 'Booking Funnel', funnelType: 'booking', steps });
    }
  }

  // E-commerce funnel: shop → checkout → thank you
  if (primaryIntent === 'cart.add') {
    const shopPage = pages.find(p => p.role === 'shop');
    const checkoutPage = pages.find(p => p.role === 'checkout');
    const thankYouPage = pages.find(p => p.role === 'thank_you');
    if (shopPage && checkoutPage) {
      const funnelId = generateUUID();
      const steps: FunnelPlan['steps'] = [
        { pageId: shopPage.id, role: 'offer', sortOrder: 0 },
        { pageId: checkoutPage.id, role: 'checkout', sortOrder: 1 },
      ];
      if (thankYouPage) {
        steps.push({ pageId: thankYouPage.id, role: 'confirmation', sortOrder: 2 });
      }
      shopPage.funnelId = funnelId;
      checkoutPage.funnelId = funnelId;
      if (thankYouPage) thankYouPage.funnelId = funnelId;
      funnels.push({ funnelId, name: 'Purchase Funnel', funnelType: 'checkout', steps });
    }
  }

  // Lead capture funnel: home → contact → thank you
  if (primaryIntent.startsWith('contact.') || primaryIntent.startsWith('quote.')) {
    const contactPage = pages.find(p => p.role === 'contact');
    const thankYouPage = pages.find(p => p.role === 'thank_you');
    const homePage = pages.find(p => p.isHome);
    if (homePage && contactPage) {
      const funnelId = generateUUID();
      const steps: FunnelPlan['steps'] = [
        { pageId: homePage.id, role: 'entry', sortOrder: 0 },
        { pageId: contactPage.id, role: 'offer', sortOrder: 1 },
      ];
      if (thankYouPage) {
        steps.push({ pageId: thankYouPage.id, role: 'confirmation', sortOrder: 2 });
      }
      contactPage.funnelId = funnelId;
      if (thankYouPage) thankYouPage.funnelId = funnelId;
      funnels.push({ funnelId, name: 'Lead Capture Funnel', funnelType: 'lead', steps });
    }
  }

  // 3. Infer CTA redirects based on industry primary intent
  const contactPage = pages.find(p => p.role === 'contact');
  const bookingPage = pages.find(p => p.role === 'booking');
  const servicesPage = pages.find(p => p.role === 'services');
  const homePage = pages.find(p => p.isHome);

  // Hero CTA → primary action page
  if (homePage) {
    let targetPage: PageRouteNode | undefined;
    if (primaryIntent.startsWith('booking.') && bookingPage) {
      targetPage = bookingPage;
    } else if (primaryIntent.startsWith('contact.') && contactPage) {
      targetPage = contactPage;
    } else if (primaryIntent.startsWith('quote.') && contactPage) {
      targetPage = contactPage;
    } else if (contactPage) {
      targetPage = contactPage;
    }

    if (targetPage) {
      redirects.push({
        id: generateUUID(),
        sourcePageId: homePage.id,
        sourceElementLabel: getCTALabel(primaryIntent),
        intent: 'nav.goto_page',
        targetPageId: targetPage.id,
        targetRoute: targetPage.route,
      });
    }

    // Secondary CTA: "View Services" → services page
    if (servicesPage) {
      redirects.push({
        id: generateUUID(),
        sourcePageId: homePage.id,
        sourceElementLabel: 'View Services',
        intent: 'nav.goto_page',
        targetPageId: servicesPage.id,
        targetRoute: servicesPage.route,
      });
    }
  }

  // Nav CTAs → their respective pages
  for (const [label, role] of Object.entries(CTA_TARGET_MAP)) {
    const target = pages.find(p => p.role === role);
    if (target && homePage) {
      const exists = redirects.some(
        r => r.sourcePageId === homePage.id && r.targetPageId === target.id
      );
      if (!exists) {
        redirects.push({
          id: generateUUID(),
          sourcePageId: homePage.id,
          sourceElementLabel: label,
          intent: 'nav.goto_page',
          targetPageId: target.id,
          targetRoute: target.route,
        });
      }
    }
  }

  const plan: GeneratedSitePlan = {
    siteId,
    industry: profile.industry,
    businessName,
    homePageId,
    pages,
    navItems,
    funnels,
    redirects,
    generatedAt: new Date().toISOString(),
    selectedTemplateId: options?.selectedTemplateId,
    selectedThemePresetId: options?.selectedThemePresetId,
  };

  // 4. Validate the plan
  plan.validationErrors = validateSitePlan(plan);

  // 5. STRICT SELECTED-PAGES GUARD ─────────────────────────────────────────
  // When the wizard restricted scaffolding to explicit user selections, we
  // must never allow an industry-default page to leak into the plan. Doing
  // so is exactly what caused "default template preset" bodies to render
  // for pages the user did not select.
  if (options?.restrictToAdditionalPages) {
    const allowedPaths = new Set<string>(['/']);
    for (const spec of options.additionalPages || []) {
      allowedPaths.add((spec.path || '').toLowerCase());
    }
    const stray = plan.pages
      .map((p) => p.route)
      .filter((route) => !allowedPaths.has((route || '').toLowerCase()));
    if (stray.length > 0) {
      throw new Error(
        `[SiteTopologyPlanner] Selected-pages guard violated for industry "${profile.industry}": ` +
        `unselected industry-default routes leaked into the plan: ${stray.join(', ')}. ` +
        `Only Home + wizard-selected pages are permitted.`,
      );
    }
  }

  return plan;
}


// ============================================================================
// Registry Population
// ============================================================================

/**
 * Convert a GeneratedSitePlan into a fully populated PageRegistry.
 * This is the canonical bridge between planning and runtime.
 */
export function populateRegistryFromTopology(plan: GeneratedSitePlan): PageRegistry {
  const registry = createEmptyPageRegistry();
  registry.homePageId = plan.homePageId;

  for (let i = 0; i < plan.pages.length; i++) {
    const node = plan.pages[i];
    const pageType = roleToPageType(node.role);

    // Build redirect rules from the plan's redirect bindings
    const pageRedirects: RedirectRule[] = plan.redirects
      .filter(r => r.sourcePageId === node.id)
      .map(r => ({
        ruleId: r.id,
        condition: 'manual' as const,
        to: r.targetPageId,
        targetType: 'page' as const,
        triggerIntentId: r.intent,
      }));

    const page = createBuilderPage(
      node.id,
      node.title,
      node.route,
      pageType,
      {
        filePath: node.filePath,
        showInNav: node.visibleInNav,
        navOrder: i * 10,
        isHome: node.isHome,
        createdBy: node.generatedBy === 'wizard' ? 'template' : node.generatedBy === 'ai' ? 'ai' : 'manual',
        seo: node.seo,
        redirectRules: pageRedirects.length > 0 ? pageRedirects : undefined,
        pageRole: node.role === 'services' ? 'service' : inferPageRoleFromType(pageType),
        routeState: 'generated',
        publishedStatus: 'unpublished',
        funnelId: node.funnelId || undefined,
        funnelIds: node.funnelId ? [node.funnelId] : [],
      }
    );

    registry.pages[node.id] = page;
  }

  // Add funnels
  for (const funnelPlan of plan.funnels) {
    registry.funnels[funnelPlan.funnelId] = {
      funnelId: funnelPlan.funnelId,
      name: funnelPlan.name,
      funnelType: funnelPlan.funnelType || 'custom',
      steps: funnelPlan.steps.map(s => ({
        stepId: generateUUID(),
        pageId: s.pageId,
        role: s.role as any,
        nextStepId: null,
        sortOrder: s.sortOrder,
      })),
      entryStepId: '',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  for (const funnel of Object.values(registry.funnels)) {
    for (const step of funnel.steps) {
      const page = registry.pages[step.pageId];
      if (!page) continue;
      const funnelIds = new Set(page.funnelIds || []);
      funnelIds.add(funnel.funnelId);
      page.funnelIds = Array.from(funnelIds);
      page.funnelId = page.funnelId || funnel.funnelId;
      page.funnelRole = step.role;
    }
  }

  registry.version = 1;
  return registry;
}

// ============================================================================
// Helpers
// ============================================================================

export function roleToPageType(role: PageRole): BuilderPageType {
  const map: Record<PageRole, BuilderPageType> = {
    home: 'home',
    about: 'about',
    services: 'landing',
    contact: 'contact',
    pricing: 'pricing',
    gallery: 'gallery',
    faq: 'faq',
    booking: 'booking',
    checkout: 'checkout',
    thank_you: 'thankyou',
    blog: 'blog',
    shop: 'shop',
    immersive: 'immersive',
    custom: 'custom',
  };
  return map[role] || 'custom';
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/-(\w)/g, (_, c) => c.toUpperCase());
}

function getCTALabel(intent: string): string {
  const map: Record<string, string> = {
    'booking.create': 'Book Now',
    'contact.submit': 'Contact Us',
    'quote.request': 'Get a Quote',
    'cart.add': 'Shop Now',
    'newsletter.subscribe': 'Subscribe',
    'pay.checkout': 'Donate Now',
  };
  return map[intent] || 'Get Started';
}

// ============================================================================
// Validation
// ============================================================================

function validateSitePlan(plan: GeneratedSitePlan): string[] {
  const errors: string[] = [];

  if (!plan.homePageId) {
    errors.push('No home page defined');
  } else if (!plan.pages.find(p => p.id === plan.homePageId)) {
    errors.push('Home page ID does not match any page');
  }

  // Duplicate slugs
  const slugs = new Map<string, string>();
  for (const page of plan.pages) {
    const existing = slugs.get(page.route);
    if (existing) {
      errors.push(`Duplicate route "${page.route}" on pages "${existing}" and "${page.name}"`);
    } else {
      slugs.set(page.route, page.name);
    }
  }

  // Orphan redirect targets
  const pageIds = new Set(plan.pages.map(p => p.id));
  for (const r of plan.redirects) {
    if (!pageIds.has(r.targetPageId)) {
      errors.push(`Redirect "${r.sourceElementLabel}" targets unknown page`);
    }
  }

  // Funnel step references
  for (const funnel of plan.funnels) {
    for (const step of funnel.steps) {
      if (!pageIds.has(step.pageId)) {
        errors.push(`Funnel "${funnel.name}" step references unknown page`);
      }
    }
  }

  return errors;
}
