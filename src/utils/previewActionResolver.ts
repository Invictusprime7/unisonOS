/**
 * Preview Action Resolver
 *
 * Given an intent + button label + the DOM inventory collected by
 * PREVIEW_NAV_BRIDGE + the current VFS file list, deterministically
 * decides WHAT should happen — without generating a new page unless
 * there is genuinely nowhere to route.
 *
 * Decision priority (highest → lowest):
 *  1. Scroll  — the target section / form already exists on the current page
 *  2. Navigate — the target page already exists in VFS or was listed in nav hrefs
 *  3. Generate — last resort: ask AI to create the missing page
 *  4. Acknowledge — no visible action needed (cart.add visual feedback already done)
 */

import type { ClassificationResult } from './redirectLabelClassifier';
import { extractRenderedRoutes } from '@/components/creatives/web-builder/previewRouteTabs';
import {
  hasInlineIntentTarget,
  resolveDeterministicIntentSurface,
  type PreviewIntentInventory,
} from '@/runtime/deterministicIntentUi';
import { resolveActionPageAffinity } from '@/platform/core/actionAffinity';

// ── Types ────────────────────────────────────────────────────────────────────

export type PageInventory = PreviewIntentInventory;

export type ResolvedAction =
  | { action: 'scroll';      command: string }
  | { action: 'navigate';    route: string; vfsPath: string }
  | { action: 'overlay';     overlayId: string }
  | { action: 'cart';        step: 'cart' | 'checkout' }
  | { action: 'acknowledge' }
  | { action: 'generate';    pageType: string; label: string };

// ── Intent → scroll landmark map ─────────────────────────────────────────────

interface ScrollDef {
  /** INTENT_COMMAND value sent to the iframe */
  command: string;
  /** formIntents / sectionIntents that confirm the section exists */
  matchIntents: string[];
  /** presentIds that confirm the section exists */
  matchIds: string[];
}

const SCROLL_DEFS: Partial<Record<string, ScrollDef>> = {
  'booking.create': {
    command: 'booking.scroll',
    matchIntents: ['booking.create'],
    matchIds: ['booking', 'book', 'reservation', 'schedule', 'reserve'],
  },
  'contact.submit': {
    command: 'contact.scroll',
    matchIntents: ['contact.submit'],
    matchIds: ['contact', 'contact-form', 'get-in-touch', 'reach-out'],
  },
  'newsletter.subscribe': {
    command: 'newsletter.scroll',
    matchIntents: ['newsletter.subscribe'],
    matchIds: ['newsletter', 'subscribe', 'waitlist'],
  },
  'quote.request': {
    command: 'quote.scroll',
    matchIntents: ['quote.request'],
    matchIds: ['quote', 'estimate', 'get-a-quote'],
  },
  'lead.capture': {
    command: 'lead.scroll',
    matchIntents: ['lead.capture', 'contact.submit'],
    matchIds: ['lead', 'contact', 'contact-form'],
  },
  'auth.login': {
    command: 'auth.scroll',
    matchIntents: ['auth.login'],
    matchIds: ['login', 'auth', 'signin', 'sign-in'],
  },
  'auth.register': {
    command: 'auth.scroll',
    matchIntents: ['auth.register'],
    matchIds: ['register', 'signup', 'sign-up', 'auth'],
  },
  'pay.checkout': {
    command: 'checkout.scroll',
    matchIntents: ['pay.checkout', 'cart.checkout'],
    matchIds: ['pricing', 'plans', 'checkout', 'subscribe'],
  },
  'cart.checkout': {
    command: 'checkout.scroll',
    matchIntents: ['cart.checkout', 'pay.checkout'],
    matchIds: ['cart', 'checkout', 'pricing'],
  },
};

// ── Intent → preferred page name (for VFS/nav-href lookup) ──────────────────

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalise(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/**
 * Given a page name (e.g. "checkout", "products"), return the VFS path
 * that would hold it, and check whether it exists in the current VFS.
 */
function findVfsPath(pageName: string, vfsFiles: Record<string, string>): string | null {
  const componentName = pageName
    .replace(/[-_\s]+(.)/g, (_, c: string) => c.toUpperCase())
    .replace(/^\w/, (c: string) => c.toUpperCase());
  const candidates = [
    `/src/pages/${componentName}.tsx`,
    `/src/pages/${componentName}.jsx`,
    `/src/pages/${pageName}.tsx`,
    `/src/pages/${pageName}.jsx`,
  ];
  for (const p of candidates) {
    if (vfsFiles[p]) return p;
  }
  return null;
}

/**
 * Check whether any of the candidate page names appear in the nav hrefs
 * reported by the bridge, or exist in VFS.
 */
function resolveToExistingPage(
  candidates: string[],
  navHrefs: string[],
  vfsFiles: Record<string, string>,
): { route: string; vfsPath: string } | null {
  for (const candidate of candidates) {
    const norm = normalise(candidate);
    // Check nav hrefs first (page is already in the site)
    const href = navHrefs.find(h => normalise(h) === norm) ?? navHrefs.find(h => normalise(h).startsWith(norm));
    if (href) {
      const hrefNorm = normalise(href);
      const vfsPath = findVfsPath(hrefNorm, vfsFiles) ?? findVfsPath(norm, vfsFiles) ?? `/src/pages/${candidate.replace(/^\w/, c => c.toUpperCase())}.tsx`;
      return { route: `/${hrefNorm}`, vfsPath };
    }
    // Check VFS directly
    const vfsPath = findVfsPath(norm, vfsFiles);
    if (vfsPath) return { route: `/${norm}`, vfsPath };
  }
  return null;
}

// ── Main resolver ─────────────────────────────────────────────────────────────

/**
 * Deterministically resolve the best UI action for an INTENT_TRIGGER.
 *
 * @param intent         Canonical intent string (e.g. "booking.create")
 * @param buttonLabel    The visible button text
 * @param inventory      DOM snapshot from PREVIEW_NAV_BRIDGE (may be null for older clients)
 * @param vfsFiles       Current VFS sandpack files
 * @param classification Result of classifyLabel()
 * @param inPreviewHandled Whether the bridge already executed an in-iframe action
 */
export function resolvePreviewAction(
  intent: string,
  buttonLabel: string,
  inventory: PageInventory | null | undefined,
  vfsFiles: Record<string, string>,
  classification: ClassificationResult,
  inPreviewHandled: boolean,
  payload?: Record<string, unknown>,
): ResolvedAction {
  let inv: PageInventory = inventory ?? { sectionIntents: [], presentIds: [], formIntents: [], navHrefs: [] };

  // ── 1. Already handled in-preview (cart.add, form.submit, scroll done) ──────
  // Only trust "handled" when the target section really is on this page;
  // otherwise the bridge had nothing to scroll to and we must navigate.
  if (inPreviewHandled && hasInlineIntentTarget(intent, inv)) {
    const handledIntents = ['contact.submit', 'newsletter.subscribe', 'quote.request',
                            'lead.capture', 'form.submit', 'booking.create', 'auth.login', 'auth.register'];
    if (handledIntents.includes(intent)) return { action: 'acknowledge' };
  }

  // Routes the preview actually renders count as existing pages.
  const renderedRoutes = extractRenderedRoutes(vfsFiles['/src/App.tsx']).filter((r) => r !== '/');
  if (renderedRoutes.length) {
    inv = { ...inv, navHrefs: Array.from(new Set([...inv.navHrefs, ...renderedRoutes])) };
  }

  // ── 2. Scroll — section exists on current page ────────────────────────────
  const scrollDef = SCROLL_DEFS[intent];
  if (scrollDef && hasInlineIntentTarget(intent, inv)) {
    return { action: 'scroll', command: scrollDef.command };
  }

  // ── 3. Navigate — page already exists in VFS or in the site nav ──────────
  // 3a. Check intent-specific page affinity candidates
  const affinityCandidates = resolveActionPageAffinity(intent, buttonLabel);
  const surface = resolveDeterministicIntentSurface(intent, payload, inv);
  if (surface.kind === 'cart') {
    return { action: 'cart', step: surface.step };
  }
  if (surface.kind === 'overlay') {
    return { action: 'overlay', overlayId: surface.overlayId };
  }
  const affinityMatch = resolveToExistingPage(affinityCandidates, inv.navHrefs, vfsFiles);
  if (affinityMatch) return { action: 'navigate', ...affinityMatch };

  // 3b. For redirect-classified labels, check suggestedPageType from classifier
  if (classification.category === 'redirect' && classification.suggestedPageType) {
    const labelMatch = resolveToExistingPage(
      [classification.suggestedPageType],
      inv.navHrefs,
      vfsFiles,
    );
    if (labelMatch) return { action: 'navigate', ...labelMatch };
  }

  // 3c. Try matching the button label itself as a page name (nav links)
  if (buttonLabel) {
    const normLabel = normalise(buttonLabel);
    if (inv.navHrefs.some(h => normalise(h) === normLabel)) {
      const vfsPath = findVfsPath(normLabel, vfsFiles) ?? `/src/pages/${normLabel}.tsx`;
      return { action: 'navigate', route: `/${normLabel}`, vfsPath };
    }
    // Direct VFS hit by label
    const labelVfsPath = findVfsPath(normLabel, vfsFiles);
    if (labelVfsPath) return { action: 'navigate', route: `/${normLabel}`, vfsPath: labelVfsPath };
  }

  // ── 4. Generate — nothing found, last resort ──────────────────────────────
  // Determine the best page type to generate
  const pageType =
    (affinityCandidates[0]) ||
    classification.suggestedPageType ||
    (classification.category === 'redirect' ? 'details' : null);

  // Form intents without an on-page section still should NOT generate pages —
  // they scroll to a section that simply doesn't exist yet, so we acknowledge
  // and let the existing booking/contact flow handle it through the backend.
  // Form / commerce / auth intents must NOT auto-generate pages or open
  // overlays anymore. Wiring is AI-driven: if the user wants a button to
  // do something, they ask the assistant which writes an explicit binding.
  // Until then these intents are inert (acknowledged silently).
  const formOnlyIntents = ['contact.submit', 'newsletter.subscribe', 'quote.request',
                           'lead.capture', 'booking.create', 'auth.login', 'auth.register',
                           'cart.add', 'cart.view', 'cart.checkout', 'checkout.start',
                           'pay.checkout', 'form.submit'];
  if (formOnlyIntents.includes(intent)) {
    return { action: 'acknowledge' };
  }

  // nav.external and button.click(redirect) with no existing page → generate
  if (pageType) {
    return { action: 'generate', pageType, label: buttonLabel };
  }

  // Absolute fallback — acknowledge rather than generate noise
  return { action: 'acknowledge' };
}
