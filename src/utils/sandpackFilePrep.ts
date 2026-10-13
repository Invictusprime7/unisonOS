import * as Babel from '@babel/standalone';
import { normalizeImageCompatibility } from '@/utils/imageCompatibility';
import { rewritePreviewModuleSpecifiers } from '@/utils/previewModuleSpecifiers';
import { GENERATED_RUNTIME_PROFILE } from '@/platform/core/generatedRuntimeCapabilities';
/**
 * Sandpack File Preparation Utilities
 * 
 * THE canonical preview compiler for Unison.
 * 
 * Sandpack's react-ts template expects files at ROOT level (e.g., /App.tsx, not /src/App.tsx).
 * Entry point MUST be /index.tsx (not /main.tsx) — Sandpack react-ts uses /index.tsx.
 * This module flattens VFS paths, processes imports, and ensures essential files exist.
 * 
 * CRITICAL GUARANTEE: Wizard Launcher NEVER generates component stubs.
 * Every missing component is auto-injected with a real industry-appropriate UI chip
 * from the detected industry's template toolkit (menu, treatments, classes, products, etc).
 * This ensures stable, high-quality preview rendering across all industries.
 *
 * Pipeline:
 *   Launcher → normalizeLauncherFiles() → source VFS
 *   source VFS → prepareSandpackFiles() → Sandpack overlay
 *   or:
 *   Launcher → compileLauncherOutputForPreview() → Sandpack overlay (combines both steps)
 */

import { ensureReactImports, sanitizeSvgElements } from '@/utils/aiCodeCleaner';
import { LAUNCHER_BASE_THEME } from '@/sections/themes';
import {
  isSandpackAllowedImport,
  resolvePinnedRuntimeVersion,
} from '@/utils/sandpackDependencies';
import { isValidAesthetic } from '@/utils/aestheticToCSS';
import { withRuntimeConfigDefaults } from '@/sections/runtimeConfigDefaults';
import { buildThemedIndexCss } from '@/components/onboarding/themePresetToIndexCss';
import { THEME_PRESETS } from '@/components/onboarding/themePresets';
import { themePresetToThemeTokens } from '@/components/onboarding/themePresetToTokens';
import { PreviewPipelineError } from '@/services/previewPipelineError';
import { isLiveEditedVfsPath, resolveSnapshot } from '@/services/snapshotProjector';
import { UNISON_VFS_STYLE_BRIDGE } from '@/utils/unisonVfsStyleBridge';
import { buildGeneratedUiFoundation, normalizeFoundationLocalImports } from '@/platform/core/generatedUiFoundation';
import { repairThemeFontImportLine } from '@/components/onboarding/themeFonts';

const UI_MANIFEST_PATH = '/.unison/ui-manifest.json';

function injectPreviewSourceLocators(source: string, filePath: string): string {
  if (source.length > 200_000) return source;
  const packages = (Babel as any).packages;
  const edits: Array<{ position: number; attribute: string }> = [];
  try {
    const ast = packages.parser.parse(source, { sourceType: 'unambiguous', plugins: ['jsx', 'typescript'] });
    packages.traverse.default(ast, {
      JSXOpeningElement(path: any) {
        const node = path.node;
        const tagName = node.name?.type === 'JSXIdentifier' ? node.name.name : '';
        if (!/^[a-z]/.test(tagName)) return;
        const hasLocator = node.attributes.some((attribute: any) => (
          attribute.type === 'JSXAttribute' && attribute.name?.name === 'data-ut-source-locator'
        ));
        const start = node.loc?.start;
        if (hasLocator || !start || typeof node.end !== 'number') return;
        const position = node.end - (node.selfClosing ? 2 : 1);
        const locator = `${filePath}:${start.line}:${start.column + 1}`;
        edits.push({ position, attribute: ` data-ut-source-locator="${locator}"` });
      },
    });
  } catch {
    return source;
  }
  if (edits.length === 0) return source;
  let instrumented = source;
  for (const edit of edits.sort((left, right) => right.position - left.position)) {
    instrumented = instrumented.slice(0, edit.position) + edit.attribute + instrumented.slice(edit.position);
  }
  return instrumented;
}

/**
 * Single source of truth for re-materializing the Unison UI foundation into a
 * VFS. Every runtime module, the root barrel, the CSS bridge, and the manifest
 * are refreshed together so parents, children, and tokens can never drift out
 * of sync between the VFS, the preview, and the Playground.
 */
export function syncGeneratedUiFoundationFiles(
  files: Record<string, string>,
  themePresetId?: string | null,
): void {
  const foundation = buildGeneratedUiFoundation({
    themePresetId: themePresetId || 'snapshot-recovery',
  });

  for (const [path, content] of Object.entries(foundation.files)) {
    if (path === UI_MANIFEST_PATH) continue;
    // Every path emitted by buildGeneratedUiFoundation is registry-owned.
    // Refresh it atomically even when a legacy snapshot predates the marker;
    // unknown user files outside this path set remain untouched.
    files[path] = content;
  }

  // Keep the manifest in lockstep with the runtime files we just wrote. A
  // stale-version manifest reads back as `null` and makes downstream contract
  // checks treat a healthy snapshot as invalid.
  // Only refresh an existing manifest — non-wizard drafts intentionally have
  // none, and fabricating one would make them look snapshot-owned.
  const existingManifest = files[UI_MANIFEST_PATH];
  if (!existingManifest) return;
  try {
    const parsed = JSON.parse(existingManifest) as Record<string, unknown>;
    if (parsed.version === foundation.manifest.version) return;
    const extraRequirements = Array.isArray(parsed.requirements)
      ? (parsed.requirements as string[]).filter(
          (requirement) => !foundation.manifest.requirements.includes(requirement),
        )
      : [];
    files[UI_MANIFEST_PATH] = JSON.stringify(
      {
        ...foundation.manifest,
        requirements: [...foundation.manifest.requirements, ...extraRequirements],
      },
      null,
      2,
    );
  } catch {
    files[UI_MANIFEST_PATH] = foundation.files[UI_MANIFEST_PATH];
  }
}

const LAUNCHER_THEME_JSON = JSON.stringify(LAUNCHER_BASE_THEME, null, 2);

/**
 * Build /src/index.css from a wizard ThemePreset id.
 * This unifies all CSS-injection sites on a SINGLE wizard-driven token system.
 * No path may hard-code or default to 'modern' — the resolved preset (from
 * wizard pick or industry selection) MUST flow through to here.
 */
function buildBaseCssForPreset(presetId?: string | null): string {
  // Contract: the wizard Style-card selection SHOULD thread a registered
  // themePresetId. When absent (imported project, blank draft, cold hydration
  // before wizard state is threaded), synthesize a minimal Tailwind shell so
  // the preview does not hard-crash. Wizard-draft paths remain guarded by
  // resolveSnapshot() + PreviewPipelineError checks downstream — those still
  // refuse to render an untokenized wizard draft.
  const preset = presetId ? THEME_PRESETS.find((p) => p.id === presetId) : null;
  if (!preset) {
    console.warn(
      `[sandpackFilePrep] No registered themePresetId (received="${presetId ?? 'null'}"); emitting minimal Tailwind shell for /src/index.css.`,
    );
    return `@tailwind base;\n@tailwind components;\n@tailwind utilities;\n`;
  }
  return buildThemedIndexCss(preset);
}


// SEMANTIC_CSS_VARS removed — CSS authority now flows through snapshotProjector
// (see src/services/snapshotProjector.ts). Wizard drafts get themed tokens from
// snapshot.meta.themePresetId; blank drafts get the minimal Tailwind shell.

/**
 * index.html with Tailwind CDN configured to recognize semantic design tokens.
 * Without this config, classes like bg-primary, text-foreground, bg-muted etc.
 * are unknown to the CDN and compile to nothing — causing invisible elements.
 */
const PREVIEW_INDEX_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preview</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <script src="https://cdn.tailwindcss.com"></script>
  <script data-unison-semantic-tailwind>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            border: 'hsl(var(--border))',
            input: 'hsl(var(--input))',
            ring: 'hsl(var(--ring))',
            background: 'hsl(var(--background))',
            foreground: 'hsl(var(--foreground))',
            primary: {
              DEFAULT: 'hsl(var(--primary))',
              foreground: 'hsl(var(--primary-foreground))',
            },
            secondary: {
              DEFAULT: 'hsl(var(--secondary))',
              foreground: 'hsl(var(--secondary-foreground))',
            },
            destructive: {
              DEFAULT: 'hsl(var(--destructive))',
              foreground: 'hsl(var(--destructive-foreground))',
            },
            muted: {
              DEFAULT: 'hsl(var(--muted))',
              foreground: 'hsl(var(--muted-foreground))',
            },
            accent: {
              DEFAULT: 'hsl(var(--accent))',
              foreground: 'hsl(var(--accent-foreground))',
            },
            popover: {
              DEFAULT: 'hsl(var(--popover))',
              foreground: 'hsl(var(--popover-foreground))',
            },
            card: {
              DEFAULT: 'hsl(var(--card))',
              foreground: 'hsl(var(--card-foreground))',
            },
          },
          borderRadius: {
            lg: 'var(--radius)',
            md: 'calc(var(--radius) - 2px)',
            sm: 'calc(var(--radius) - 4px)',
          },
          fontFamily: {
            heading: ['var(--font-heading)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
            body: ['var(--font-body)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
            sans: ['var(--font-body)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
            serif: ['var(--font-heading)', 'ui-serif', 'Georgia', 'serif'],
          },
        },
      },
    }
  </script>
</head>
<body>
  <div id="root"></div>
</body>
</html>`;

const SEMANTIC_TAILWIND_CONFIG = PREVIEW_INDEX_HTML.match(
  /<script data-unison-semantic-tailwind>[\s\S]*?<\/script>/,
)?.[0] || '';

function ensureSemanticTailwindPreviewHtml(html: string): string {
  if (html.includes('data-unison-semantic-tailwind')) return html;

  const needsTailwindRuntime = !/cdn\.tailwindcss\.com/i.test(html);
  const bridge = [
    needsTailwindRuntime ? '<script src="https://cdn.tailwindcss.com"></script>' : '',
    SEMANTIC_TAILWIND_CONFIG,
  ].filter(Boolean).join('\n  ');

  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, `  ${bridge}\n</head>`);
  }
  return `${bridge}\n${html}`;
}


const PREVIEW_NAV_BRIDGE = `function __initUnisonPreviewNavBridge() {
  const bridgeWindow = window as Window & { __unisonPreviewNavBridgeInstalled?: boolean };
  if (bridgeWindow.__unisonPreviewNavBridgeInstalled) return;
  bridgeWindow.__unisonPreviewNavBridgeInstalled = true;

  const normalizePath = (rawPath: string) => rawPath.replace(/^\\//, '').replace(/\\.html(?:[?#].*)?$/, '').replace(/[?#].*$/, '') || 'index';

  // ── In-preview action helpers ─────────────────────────────────────────────

  /** Render a transient feedback toast directly inside the preview iframe */
  function __showPreviewFeedback(message: string, bgColor: string) {
    const existing = document.getElementById('__ut-preview-feedback');
    if (existing) existing.remove();
    const fb = document.createElement('div');
    fb.id = '__ut-preview-feedback';
    fb.setAttribute('style',
      'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);' +
      'background:' + (bgColor || '#18181b') + ';color:#fff;padding:10px 18px;' +
      'border-radius:8px;font-size:13px;font-weight:500;z-index:99999;' +
      'box-shadow:0 4px 16px rgba(0,0,0,0.25);pointer-events:none;' +
      'transition:opacity 0.25s ease;white-space:nowrap;'
    );
    fb.textContent = message;
    document.body.appendChild(fb);
    setTimeout(function() { fb.style.opacity = '0'; setTimeout(function() { fb.remove(); }, 250); }, 2200);
  }

  /** Priority-ordered CSS selector lists for each canonical intent's target section */
  function __intentSelectors(intent: string): string[] {
    const MAP: Record<string, string[]> = {
      'booking.create':       ['form[data-ut-intent="booking.create"]','[data-ut-intent="booking.create"]:not(button):not(a)','form[data-ut-intent*="booking"]','#booking','[id*="booking-form"]','[class*="booking-form"]','section[id*="book"]','.booking'],
      'contact.submit':       ['form[data-ut-intent="contact.submit"]','[data-ut-intent="contact.submit"]:not(button):not(a)','form[data-ut-intent*="contact"]','#contact','[id*="contact-form"]','[class*="contact-form"]','section[id*="contact"]','.contact-section'],
      'newsletter.subscribe': ['form[data-ut-intent="newsletter.subscribe"]','[data-ut-intent="newsletter.subscribe"]:not(button):not(a)','form[data-ut-intent*="newsletter"]','#newsletter','[id*="newsletter"]','[class*="newsletter"]','input[type="email"]'],
      'quote.request':        ['form[data-ut-intent="quote.request"]','[data-ut-intent="quote.request"]:not(button):not(a)','form[data-ut-intent*="quote"]','#quote','[id*="quote-form"]','[class*="quote-form"]','section[id*="quote"]'],
      'lead.capture':         ['form[data-ut-intent="lead.capture"]','[data-ut-intent="lead.capture"]:not(button):not(a)','form[data-ut-intent*="lead"]','#lead','#contact','[id*="lead-form"]','input[type="email"]'],
      'auth.login':           ['form[data-ut-intent="auth.login"]','[data-ut-intent="auth.login"]:not(button):not(a)','form[data-ut-intent*="auth"]','#login','#auth','[id*="login-form"]','[class*="auth-form"]'],
      'auth.register':        ['form[data-ut-intent="auth.register"]','[data-ut-intent="auth.register"]:not(button):not(a)','form[data-ut-intent*="register"]','#register','#signup','[id*="register-form"]','[class*="auth-form"]'],
      'pay.checkout':         ['[data-ut-intent="pay.checkout"]:not(button):not(a)','#pricing','[id*="pricing"]','[class*="pricing-section"]','#checkout','[class*="checkout"]'],
      'cart.checkout':        ['[data-ut-intent="cart.checkout"]:not(button):not(a)','#cart','[id*="cart"]','[class*="cart-section"]','#checkout','[class*="checkout"]'],
    };
    return MAP[intent] || [];
  }

  /** Find the best scroll-target element for an intent, skipping the clicked element */
  function __findIntentTarget(intent: string, clicked: Element): Element | null {
    for (const sel of __intentSelectors(intent)) {
      const found = Array.from(document.querySelectorAll(sel)).find(function(t) {
        return t !== clicked && !t.contains(clicked) && !clicked.contains(t);
      });
      if (found) return found;
    }
    return null;
  }

  /**
   * Build a lightweight inventory of what UI sections/forms currently exist on the page.
   * Sent with every INTENT_TRIGGER so the parent can make smarter routing decisions
   * without having to re-parse the VFS source.
   */
  function __buildPageInventory(): Record<string, unknown> {
    // Collect all unique data-ut-intent values present on page (not buttons/anchors — structural elements)
    const sectionIntents = Array.from(
      new Set(
        Array.from(document.querySelectorAll('[data-ut-intent]:not(button):not(a)'))
          .map(function(e) { return e.getAttribute('data-ut-intent'); })
          .filter(Boolean)
      )
    );
    // Collect important landmark IDs
    const LANDMARK_IDS = ['pricing','booking','contact','newsletter','hero','features','services','about','team','gallery','faq','testimonials','portfolio','products','shop','cart','checkout','login','signup','register','auth'];
    const presentIds = LANDMARK_IDS.filter(function(id) { return !!document.getElementById(id); });
    // Detect forms by their intent
    const formIntents = Array.from(
      new Set(
        Array.from(document.querySelectorAll('form[data-ut-intent]'))
          .map(function(e) { return e.getAttribute('data-ut-intent'); })
          .filter(Boolean)
      )
    );
    // Detect nav links (page names discoverable without generating)
    const navHrefs = Array.from(
      new Set(
        Array.from(document.querySelectorAll('nav a[href], header a[href]'))
          .map(function(e) {
            const h = e.getAttribute('href') || '';
            return h.replace(/^#\\//, '/').replace(/^\\//, '').replace(/\\.html$/, '').replace(/[?#].*$/, '').toLowerCase().trim();
          })
          .filter(function(h) { return h && h !== '' && h !== 'index' && !h.startsWith('http'); })
      )
    );
    return { sectionIntents, presentIds, formIntents, navHrefs };
  }

  /**
   * Attempt an in-preview UI action for the given intent.
   * Returns true if an action was taken so the parent can skip its own duplicate feedback.
   */
  function __handleIntentInPreview(intent: string, clicked: Element): boolean {
    // Visual-feedback-only intents
    if (intent === 'cart.add') {
      __showPreviewFeedback('Added to cart \u2713', '#16a34a');
      return true;
    }
    if (intent === 'form.submit') {
      __showPreviewFeedback('Submitted \u2713', '#2563eb');
      return true;
    }
    // Slot-aware feedback for direct-action intents that may have no scroll
    // target on the current page (select option, reserve, confirm, etc.).
    const FEEDBACK_LABEL: Record<string, { msg: string; color: string }> = {
      'cart.remove':          { msg: 'Removed from cart',             color: '#dc2626' },
      'cart.checkout':        { msg: 'Opening checkout \u2026',       color: '#2563eb' },
      'pay.checkout':         { msg: 'Opening checkout \u2026',       color: '#2563eb' },
      'booking.create':       { msg: 'Booking request sent \u2713',   color: '#16a34a' },
      'booking.confirm':      { msg: 'Booking confirmed \u2713',      color: '#16a34a' },
      'reservation.create':   { msg: 'Reservation sent \u2713',       color: '#16a34a' },
      'order.place':          { msg: 'Order placed \u2713',           color: '#16a34a' },
      'product.select':       { msg: 'Option selected',                color: '#2563eb' },
      'plan.select':          { msg: 'Plan selected',                  color: '#2563eb' },
      'option.select':        { msg: 'Option selected',                color: '#2563eb' },
      'contact.submit':       { msg: 'Message sent \u2713',           color: '#2563eb' },
      'newsletter.subscribe': { msg: 'Subscribed \u2713',             color: '#2563eb' },
      'quote.request':        { msg: 'Quote requested \u2713',        color: '#2563eb' },
      'lead.capture':         { msg: 'Thanks! We\u2019ll be in touch',color: '#2563eb' },
    };
    // Scroll-to-section intents
    const target = __findIntentTarget(intent, clicked);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Focus the first relevant input inside the target section after scroll settles
      const input = (target as HTMLElement).querySelector(
        'input:not([type="hidden"]):not([type="submit"]):not([type="checkbox"]):not([type="radio"]), textarea'
      ) as HTMLElement | null;
      if (input) setTimeout(function() { input.focus(); }, 480);
      return true;
    }
    // Fallback toast so every slot intent click is visibly responsive.
    const fb = FEEDBACK_LABEL[intent];
    if (fb) {
      __showPreviewFeedback(fb.msg, fb.color);
      return true;
    }
    return false;
  }

  // ─────────────────────────────────────────────────────────────────────────
  document.addEventListener('click', function (event) {
    const target = event.target as HTMLElement | null;
    const el = target?.closest?.('a[href], [data-ut-intent], [data-ut-path], button[data-ut-intent]') as HTMLElement | null;
    if (!el) return;

    const utIntent = el.getAttribute('data-ut-intent') || '';
    const path = el.getAttribute('data-ut-path') || el.getAttribute('href') || '';

    // ── Action intents: execute in-preview first, then notify parent ──
    if (utIntent && utIntent !== 'nav.goto' && utIntent !== 'nav.goto_page' && utIntent !== 'nav.anchor' && utIntent !== 'nav.external') {
      // Only suppress default anchor navigation. Never stopPropagation —
      // React-bound onClick handlers (booking overlays, cart drawers, plan
      // selectors, etc.) must still run alongside the intent broadcast,
      // otherwise UI controls appear unresponsive on every generated site.
      const tagName = el.tagName ? el.tagName.toLowerCase() : '';
      if (tagName === 'a') {
        event.preventDefault();
      }
      const reqId = 'intent-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
      const intentPayload: Record<string, unknown> = {};
      for (const attr of Array.from(el.attributes)) {
        if (attr.name.startsWith('data-ut-') && attr.name !== 'data-ut-intent') {
          intentPayload[attr.name.replace('data-ut-', '')] = attr.value;
        }
      }
      intentPayload.buttonLabel = el.textContent ? el.textContent.trim().substring(0, 60) : '';
      intentPayload.source = 'preview';
      // Attempt the direct in-preview action; tell the parent whether we handled it
      intentPayload.inPreviewHandled = __handleIntentInPreview(utIntent, el);
      // Send a lightweight DOM inventory so the parent can route intelligently
      intentPayload.pageInventory = __buildPageInventory();
      window.parent.postMessage({
        type: 'INTENT_TRIGGER',
        intent: utIntent,
        payload: intentPayload,
        requestId: reqId,
      }, '*');
      return;
    }

    // ── nav.goto / nav.goto_page: navigate directly via hash router ──
    if (utIntent === 'nav.goto' || utIntent === 'nav.goto_page') {
      event.preventDefault();
      event.stopPropagation();
      const navPath = el.getAttribute('data-ut-path') || path;
      const targetPageId = el.getAttribute('data-ut-target-page-id');
      if (navPath && navPath !== '#') {
        const route = navPath.startsWith('/') ? navPath : '/' + navPath;
        window.location.hash = route;
      } else if (targetPageId) {
        // Fallback: ask parent to resolve page ID to route
        window.parent.postMessage({
          type: 'INTENT_TRIGGER',
          intent: 'nav.goto_page',
          payload: { targetPageId, buttonLabel: el.textContent?.trim()?.substring(0, 40) || '', source: 'preview' },
          requestId: 'nav-' + Date.now(),
        }, '*');
      }
      return;
    }

    // ── Anchor scroll ──
    if (!path || path === '#' || path.startsWith('http') || path.startsWith('mailto:') || path.startsWith('tel:') || path.startsWith('javascript:')) return;

    if (path.startsWith('#') && !path.startsWith('#/')) {
      const section = document.querySelector(path);
      if (section) {
        section.scrollIntoView({ behavior: 'smooth' });
        event.preventDefault();
      }
      return;
    }

    // ── Hash route links (e.g. href="#/services") — navigate directly ──
    if (path.startsWith('#/')) {
      event.preventDefault();
      window.location.hash = path.substring(1);
      return;
    }

    const pageName = normalizePath(path);
    if (pageName === 'index') return;

    event.preventDefault();
    event.stopPropagation();

    const targetRoute = '/' + pageName;

    // Check if this page exists in the hash router by trying hash navigation first
    // The router will render a fallback/404 if it doesn't exist
    const targetPageId = el.getAttribute('data-ut-target-page-id');
    if (targetPageId) {
      window.location.hash = targetRoute;
      return;
    }

    // Try direct hash navigation — if the route is in the router it renders immediately
    window.location.hash = targetRoute;

    // Also notify parent so it can generate the page if missing
    window.parent.postMessage({
      type: 'NAV_PAGE_GENERATE',
      pageName,
      navLabel: el.textContent ? el.textContent.trim().substring(0, 40) : pageName,
      requestId: 'click-' + Date.now(),
    }, '*');
  }, true);

  // ── Form submission bridge: intercept forms with data-ut-intent ──
  document.addEventListener('submit', function (event) {
    const form = event.target as HTMLFormElement;
    if (!form || form.tagName !== 'FORM') return;
    const formIntent = form.getAttribute('data-ut-intent');
    if (!formIntent) return;
    event.preventDefault();
    const formData = new FormData(form);
    const payload: Record<string, unknown> = {};
    formData.forEach((value, key) => { payload[key] = value.toString(); });
    payload.source = 'preview-form';
    // Show immediate in-preview confirmation
    __showPreviewFeedback('Submitted \u2713', '#2563eb');
    window.parent.postMessage({
      type: 'INTENT_TRIGGER',
      intent: formIntent,
      payload,
      requestId: 'form-' + Date.now(),
    }, '*');
  }, true);

  // ── Message handlers for navigation and intent commands ──
  window.addEventListener('message', function (event) {
    if (event.data?.type === 'NAV_ROUTE' && event.data.route) {
      window.location.hash = event.data.route;
    }
    // Reveal a saved record's real rendered instance (Playground Assets).
    if (event.data?.type === 'REVEAL_RESOURCE' && typeof event.data.mark === 'string') {
      var mark = event.data.mark;
      var tries = 0;
      var reveal = function () {
        var el = document.querySelector('[data-ut-resource^="' + mark.replace(/"/g, '') + '"]');
        if (!el) { if (++tries < 20) setTimeout(reveal, 150); return; }
        var host = el.closest('article, li, section, [data-ut-section]') || el;
        host.scrollIntoView({ behavior: 'smooth', block: 'center' });
        var prev = host.style.outline;
        host.style.outline = '2px solid hsl(var(--primary, 221 83% 53%))';
        host.style.outlineOffset = '4px';
        setTimeout(function () { host.style.outline = prev; }, 1800);
      };
      reveal();
    }
    // Send back a record's real rendered markup + the page's own CSS so the
    // Playground Assets panel can show its actual on-site appearance.
    if (event.data?.type === 'SNAPSHOT_RESOURCE' && typeof event.data.mark === 'string') {
      var snapMark = event.data.mark;
      var snapTries = 0;
      var snap = function () {
        var el = document.querySelector('[data-ut-resource^="' + snapMark.replace(/"/g, '') + '"]');
        // Older sites carry no marks: fall back to the record's visible name.
        if (!el && typeof event.data.name === 'string' && event.data.name.trim().length > 2) {
          var want = event.data.name.trim().toLowerCase();
          var cands = document.querySelectorAll('h1,h2,h3,h4,h5,h6,p,span,strong,dt,figcaption,blockquote,a');
          for (var k = 0; k < cands.length; k++) {
            var t = (cands[k].textContent || '').trim().toLowerCase();
            if (t === want || (t.length < want.length + 40 && t.indexOf(want) !== -1)) { el = cands[k]; break; }
          }
          if (el) {
            var card = el.closest('article, li, [data-ut-section] > * > *');
            if (!card) { card = el; while (card.parentElement && (card.parentElement.textContent || '').length < 600 && card.parentElement.tagName !== 'SECTION') card = card.parentElement; }
            el = card;
          }
        }
        if (!el) {
          if (++snapTries < 20) { setTimeout(snap, 150); return; }
          window.parent.postMessage({ type: 'RESOURCE_SNAPSHOT', mark: snapMark, html: null, css: null }, '*');
          return;
        }
        var host = el.matches('article, li') ? el : (el.closest('article, li, section, [data-ut-section]') || el);
        var css = '';
        try {
          for (var i = 0; i < document.styleSheets.length; i++) {
            var sheet = document.styleSheets[i];
            try {
              var rules = sheet.cssRules;
              for (var j = 0; j < rules.length; j++) css += rules[j].cssText + '\\n';
            } catch (e) { /* cross-origin sheet — skip */ }
          }
        } catch (e) { /* ignore */ }
        window.parent.postMessage({ type: 'RESOURCE_SNAPSHOT', mark: snapMark, html: host.outerHTML, css: css }, '*');
      };
      snap();
    }
    // Playground graph cards use isolated runtime iframes. Navigate each clone
    // to its assigned route, then return the exact rendered resource/component
    // with the generated site's own styles.
    if (event.data?.type === 'SNAPSHOT_PLAYGROUND_GRAPH' && typeof event.data.requestId === 'string') {
      var graphRequest = event.data;
      var graphTries = 0;
      var graphSnapshot = function () {
        var node = null;
        var clean = function (value) { return String(value || '').replace(/"/g, ''); };
        if (graphRequest.kind === 'resource' && graphRequest.targetId) {
          node = document.querySelector('[data-ut-resource^="' + clean(graphRequest.targetId) + '"]');
        }
        if (graphRequest.kind === 'component') {
          if (graphRequest.targetId) {
            node = document.querySelector('[data-ut-component-instance-id="' + clean(graphRequest.targetId) + '"], [data-ut-component-id="' + clean(graphRequest.targetId) + '"]');
          }
          if (!node && graphRequest.componentSlug) {
            node = document.querySelector('[data-ut-component-slug="' + clean(graphRequest.componentSlug) + '"], [data-component="' + clean(graphRequest.componentSlug) + '"], [data-component*="' + clean(graphRequest.componentSlug) + '"]');
          }
        }
        // Legacy authored sites may lack runtime marks. Visible labels still
        // provide a deterministic fallback without fabricating a preview.
        if (!node && typeof graphRequest.name === 'string' && graphRequest.name.trim().length > 2) {
          var wanted = graphRequest.name.trim().toLowerCase();
          var labels = document.querySelectorAll('h1,h2,h3,h4,h5,h6,p,span,strong,dt,figcaption,blockquote,a,button');
          for (var n = 0; n < labels.length; n++) {
            var labelText = (labels[n].textContent || '').trim().toLowerCase();
            if (labelText === wanted || (labelText.length < wanted.length + 40 && labelText.indexOf(wanted) !== -1)) { node = labels[n]; break; }
          }
        }
        if (!node) {
          if (++graphTries < 18) { setTimeout(graphSnapshot, 160); return; }
          window.parent.postMessage({ type: 'PLAYGROUND_GRAPH_SNAPSHOT', requestId: graphRequest.requestId, html: null, css: null }, '*');
          return;
        }
        var graphHost = node.matches('article,li,section,form,[data-component]') ? node : (node.closest('article,li,section,form,[data-component],[data-ut-section]') || node);
        var graphCss = '';
        try {
          for (var si = 0; si < document.styleSheets.length; si++) {
            try {
              var graphRules = document.styleSheets[si].cssRules;
              for (var ri = 0; ri < graphRules.length; ri++) graphCss += graphRules[ri].cssText + '\\n';
            } catch (e) { /* cross-origin stylesheet */ }
          }
        } catch (e) { /* ignore */ }
        window.parent.postMessage({ type: 'PLAYGROUND_GRAPH_SNAPSHOT', requestId: graphRequest.requestId, html: graphHost.outerHTML, css: graphCss }, '*');
      };
      graphSnapshot();
    }
    // Live Preview asset scan (Playground Assets): read-only discovery of
    // repeated items actually rendered on the page, saved or not.
    if (event.data?.type === 'SCAN_ASSETS') {
      var KINDS = [
        ['articles', /insight|journal|blog|article|essay|news|writing|perspective/i],
        ['testimonials', /testimonial|review|what (our )?(clients|customers)|kind words/i],
        ['faqs', /faq|frequently asked|questions/i],
        ['team', /team|our (people|staff|stylists|barbers|experts)|meet (the|our)/i],
        ['gallery', /gallery|portfolio|our work|work|projects|lookbook|case stud|selected/i],
        ['products', /product|shop|menu|collection|store|featured/i],
        ['services', /service|treatment|what we (do|offer)|pricing|packages/i]
      ];
      var txt = function (n) { return n ? (n.textContent || '').replace(/[ ]+/g, ' ').trim() : ''; };
      var css = '';
      try { for (var a = 0; a < document.styleSheets.length; a++) { try { var rr = document.styleSheets[a].cssRules; for (var b = 0; b < rr.length; b++) css += rr[b].cssText + ' '; } catch (e) {} } } catch (e) {}
      var out = [];
      var sections = document.querySelectorAll('section, [data-ut-section]');
      for (var si = 0; si < sections.length; si++) {
        var sec = sections[si];
        var head = sec.querySelector('h1,h2,h3');
        if (sec.closest('nav, header, footer') || (sec.parentElement && sec.parentElement.closest('section, [data-ut-section]'))) continue;
        var sig = (sec.getAttribute('id') || '') + ' ' + (sec.getAttribute('data-ut-section') || '') + ' ' + (sec.getAttribute('data-ut-section-type') || '') + ' ' + (sec.getAttribute('aria-label') || '') + ' ' + txt(head);
        var kind = null;
        for (var ki = 0; ki < KINDS.length; ki++) { if (KINDS[ki][1].test(sig)) { kind = KINDS[ki][0]; break; } }
        // Largest group of same-tag siblings with text = the repeated items.
        var best = [], all = sec.querySelectorAll('*');
        for (var ci = 0; ci < all.length; ci++) {
          var kids = Array.prototype.filter.call(all[ci].children, function (c) { return txt(c).length > 2; });
          if (kids.length < 2) continue;
          var tag = kids[0].tagName;
          var same = kids.filter(function (c) { return c.tagName === tag; });
          if (same.length >= 2 && same.length > best.length && same.length >= kids.length - 1) best = same;
        }
        if (!best.length) continue;
        // No telling heading: infer the kind from what the repeated items hold.
        if (!kind) {
          var sample = best[0];
          var sText = txt(sample);
          if (sample.querySelector('blockquote, q') || /^[\u201c"]/.test(sText)) kind = 'testimonials';
          else if (/[$\u00a3\u20ac][ ]?[0-9]/.test(sText)) kind = 'products';
          else if (sample.querySelector('details, summary')) kind = 'faqs';
          else if (sample.querySelector('img') && sText.length < 160) kind = 'gallery';
          else if (sample.querySelector('h3, h4') && sText.length > 30) kind = 'services';
          else continue;
        }
        for (var ii = 0; ii < best.length && ii < 24; ii++) {
          var it = best[ii];
          var h = it.querySelector('h2,h3,h4,h5,h6,dt,summary,strong,figcaption');
          var paras = it.querySelectorAll('p, blockquote, dd');
          var body = paras.length ? txt(paras[0]) : '';
          var all2 = txt(it);
          var price = all2.match(/[$£€][ ]?[0-9][0-9.,]*/);
          var img = it.querySelector('img');
          var name = txt(it.querySelector('h1,h2,h3,h4')) || txt(h) || body.slice(0, 60);
          if (!name) continue;
          if (kind === 'testimonials') { var cite = it.querySelector('cite, figcaption, footer, strong'); name = txt(cite) || name; body = txt(it.querySelector('blockquote, p')) || body; }
          var meta = null;
          if (kind === 'articles') { var tm = it.querySelector('time'); var by = it.querySelector('[class*="author"], address'); meta = { date: tm ? (tm.getAttribute('datetime') || txt(tm)) : (all2.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* [0-9]{1,2},? [0-9]{4}/) || [null])[0], readTime: (all2.match(/[0-9]+ min read/i) || [null])[0], author: by ? txt(by).slice(0, 80) : null }; }
          out.push({ meta: meta, kind: kind, section: txt(head), name: name.slice(0, 120), description: body.slice(0, 500), price: price ? price[0] : null, image: img ? img.getAttribute('src') : null, html: it.outerHTML.slice(0, 20000) });
        }
      }
      window.parent.postMessage({ type: 'ASSET_SCAN', requestId: event.data.requestId, items: out, css: css, route: window.location.hash }, '*');
    }
    // Handle intent-based scroll/focus commands from parent
    if (event.data?.type === 'INTENT_COMMAND') {
      const { command, requestId: cmdReqId } = event.data;
      let handled = false;
      // Derive the canonical intent from the command name
      // e.g. "booking.scroll" → "booking.create", "contact.scroll" → "contact.submit"
      const intentKey: string = (
        command === 'booking.scroll'     ? 'booking.create'       :
        command === 'contact.scroll'     ? 'contact.submit'       :
        command === 'newsletter.scroll'  ? 'newsletter.subscribe' :
        command === 'quote.scroll'       ? 'quote.request'        :
        command === 'lead.scroll'        ? 'lead.capture'         :
        command === 'auth.scroll'        ? 'auth.login'           :
        command === 'checkout.scroll'    ? 'pay.checkout'         :
        command
      );
      const target = __findIntentTarget(intentKey, document.documentElement);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        handled = true;
      }
      window.parent.postMessage({ type: 'INTENT_COMMAND_RESULT', command, requestId: cmdReqId, handled }, '*');
    }
  });
}
`;

/**
 * PREVIEW_SELECTION_BRIDGE — element selection bridge for the Web Builder
 * "Edit / Select" mode. Injected into Sandpack's /index.tsx alongside the
 * navigation bridge.
 *
 * Responsibilities:
 *  - Listen for EDIT_MODE_TOGGLE from the parent (with an activationKey).
 *  - When active: install hover outline + click capture that suppresses
 *    default navigation/intents and posts ELEMENT_SELECTED to the parent
 *    with a stable selector + minimal element metadata.
 *  - When inactive: tear everything down so the preview behaves normally.
 *
 * This is the missing half of the Edit-mode wiring referenced in
 * mem://features/web-builder/edit-mode-selection-bridge — the parent already
 * had ElementFloatingToolbar and onElementSelect plumbing, but no script in
 * the iframe ever produced the ELEMENT_SELECTED message.
 */
const PREVIEW_SELECTION_BRIDGE = `function __initUnisonPreviewSelectionBridge() {
  const bridgeWindow = window as Window & { __unisonPreviewSelectionBridgeInstalled?: boolean };
  if (bridgeWindow.__unisonPreviewSelectionBridgeInstalled) return;
  bridgeWindow.__unisonPreviewSelectionBridgeInstalled = true;

  let active = false;
  let activationKey = 0;
  let revisionId: string | null = null;
  let hoverEl: HTMLElement | null = null;
  let selectedEl: HTMLElement | null = null;

  const STYLE_ID = '__ut-select-style';
  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '.__ut-hover { outline: 2px dashed hsl(190 95% 55%) !important; outline-offset: 2px !important; cursor: pointer !important; }',
      '.__ut-selected { outline: 2px solid hsl(190 95% 55%) !important; outline-offset: 2px !important; box-shadow: 0 0 0 4px hsla(190, 95%, 55%, 0.18) !important; }',
      'html.__ut-select-mode, html.__ut-select-mode body { cursor: crosshair !important; }',
    ].join('\\n');
    document.head.appendChild(style);
  }

  function clearHover() { if (hoverEl) { hoverEl.classList.remove('__ut-hover'); hoverEl = null; } }
  function clearSelected() { if (selectedEl) { selectedEl.classList.remove('__ut-selected'); selectedEl = null; } }

  function cssEscape(s: string): string {
    return (window as any).CSS && (window as any).CSS.escape
      ? (window as any).CSS.escape(s)
      : s.replace(/([^\\\\w-])/g, '\\\\$1');
  }
  function findAncestorAttr(el: Element, attr: string): string | null {
    let cur: Element | null = el.parentElement;
    let depth = 0;
    while (cur && cur !== document.body && depth < 24) {
      const v = cur.getAttribute(attr);
      if (v) return v;
      cur = cur.parentElement;
      depth++;
    }
    return null;
  }
  function computeSelector(el: Element): string {
    if (!el || el === document.body || el === document.documentElement) return 'body';
    if ((el as HTMLElement).id) return '#' + cssEscape((el as HTMLElement).id);
    const dataKey = el.getAttribute('data-ut-key');
    if (dataKey) return '[data-ut-key="' + cssEscape(dataKey) + '"]';
    const dataBinding = el.getAttribute('data-ut-binding-id');
    if (dataBinding) return '[data-ut-binding-id="' + cssEscape(dataBinding) + '"]';
    // Slot identity — scope by nearest section so duplicate slot names across
    // sections (e.g. two "primary-cta" slots) still resolve uniquely.
    const slotId = el.getAttribute('data-ut-slot');
    if (slotId) {
      const secId =
        findAncestorAttr(el, 'data-ut-section-id') ||
        findAncestorAttr(el, 'data-ut-section');
      if (secId) {
        return '[data-ut-section-id="' + cssEscape(secId) + '"] [data-ut-slot="' + cssEscape(slotId) + '"], '
          + '[data-ut-section="' + cssEscape(secId) + '"] [data-ut-slot="' + cssEscape(slotId) + '"]';
      }
      return '[data-ut-slot="' + cssEscape(slotId) + '"]';
    }
    // Intent identity — canonical action-carrying elements (buttons/links) are
    // rarely duplicated within a section and give the AI a durable target.
    const intent = el.getAttribute('data-ut-intent');
    if (intent) {
      const secId =
        findAncestorAttr(el, 'data-ut-section-id') ||
        findAncestorAttr(el, 'data-ut-section');
      if (secId) {
        return '[data-ut-section-id="' + cssEscape(secId) + '"] [data-ut-intent="' + cssEscape(intent) + '"], '
          + '[data-ut-section="' + cssEscape(secId) + '"] [data-ut-intent="' + cssEscape(intent) + '"]';
      }
      return '[data-ut-intent="' + cssEscape(intent) + '"]';
    }
    const bindingKey = el.getAttribute('data-ut-binding-key') || el.getAttribute('data-element-key');
    if (bindingKey) return '[data-ut-binding-key="' + cssEscape(bindingKey) + '"], [data-element-key="' + cssEscape(bindingKey) + '"]';
    const elementIdAttr = el.getAttribute('data-ut-element');
    if (elementIdAttr) return '[data-ut-element="' + cssEscape(elementIdAttr) + '"]';
    const componentInstanceId = el.getAttribute('data-ut-component-instance-id');
    if (componentInstanceId) return '[data-ut-component-instance-id="' + cssEscape(componentInstanceId) + '"]';
    const componentSlug = el.getAttribute('data-component');
    if (componentSlug) return '[data-component="' + cssEscape(componentSlug) + '"]';
    const parts: string[] = [];
    let node: Element | null = el;
    let depth = 0;
    while (node && node !== document.body && depth < 6) {
      const tag = node.tagName.toLowerCase();
      const parent = node.parentElement;
      if (!parent) { parts.unshift(tag); break; }
      const sameTag = Array.from(parent.children).filter(c => c.tagName === node!.tagName);
      if (sameTag.length === 1) {
        parts.unshift(tag);
      } else {
        const idx = sameTag.indexOf(node) + 1;
        parts.unshift(tag + ':nth-of-type(' + idx + ')');
      }
      node = parent;
      depth++;
    }
    return parts.join(' > ');
  }

  function findSection(el: Element): string | null {
    let cur: Element | null = el;
    while (cur && cur !== document.body) {
      if (cur.tagName === 'SECTION') {
        return cur.getAttribute('id') || cur.getAttribute('data-section') || cur.tagName.toLowerCase();
      }
      const dataSection = cur.getAttribute('data-section') || cur.getAttribute('data-ut-section') || cur.getAttribute('data-ut-section-id');
      if (dataSection) return dataSection;
      cur = cur.parentElement;
    }
    return null;
  }

  // Walk ancestors and collect Unison scope IDs + intent bindings so the
  // floating toolbar's EditScopeResolver can pick element/block/section scope.
  function collectScopeAncestors(el: Element): {
    elementId: string | null;
    slotId: string | null;
    blockId: string | null;
    sectionId: string | null;
    sectionType: string | null;
    surfaceId: string | null;
    componentType: string | null;
    componentInstanceId: string | null;
    artifactId: string | null;
    elementRole: string | null;
    entityKind: string | null;
    sourceLocator: string | null;
    bindingId: string | null;
    bindingKey: string | null;
    sourceTable: string | null;
    rowId: string | null;
    field: string | null;
    targetPath: string | null;
    pageId: string | null;
    pagePath: string | null;
    intents: string[];
    primaryIntent: string | null;
    clickedTag: string;
  } {
    let elementId: string | null = el.getAttribute('data-ut-element-id') || el.getAttribute('data-ut-element') || null;
    let slotId: string | null = null;
    let blockId: string | null = null;
    let sectionId: string | null = null;
    let sectionType: string | null = null;
    let surfaceId: string | null = null;
    let componentType: string | null = null;
    let componentInstanceId: string | null = null;
    let artifactId: string | null = null;
    let elementRole: string | null = null;
    let entityKind: string | null = null;
    let sourceLocator: string | null = null;
    let bindingId: string | null = null;
    let bindingKey: string | null = null;
    let sourceTable: string | null = null;
    let rowId: string | null = null;
    let resource: string | null = null;
    let field: string | null = null;
    let targetPath: string | null = el.getAttribute('data-ut-path') || el.getAttribute('href') || null;
    let pageId: string | null = null;
    let pagePath: string | null = null;
    const intents: string[] = [];
    const primaryIntent: string | null = el.getAttribute('data-ut-intent') || null;
    let cur: Element | null = el;
    let depth = 0;
    while (cur && cur !== document.body && depth < 24) {
      if (!elementId) elementId = cur.getAttribute('data-ut-element-id') || cur.getAttribute('data-ut-element') || elementId;
      if (!slotId) slotId = cur.getAttribute('data-ut-slot');
      if (!blockId) blockId = cur.getAttribute('data-ut-block');
      if (!sectionId) {
        sectionId = cur.getAttribute('data-ut-section-id')
          || cur.getAttribute('data-ut-section')
          || (cur.tagName === 'SECTION' ? (cur.getAttribute('id') || null) : null);
      }
      if (!sectionType) sectionType = cur.getAttribute('data-ut-section-type');
      if (!surfaceId) surfaceId = cur.getAttribute('data-ut-surface');
      if (!componentType) componentType = cur.getAttribute('data-ut-component-type') || cur.getAttribute('data-component');
      if (!componentInstanceId) componentInstanceId = cur.getAttribute('data-ut-component-id') || cur.getAttribute('data-ut-component-instance-id');
      if (!artifactId) artifactId = cur.getAttribute('data-ut-registry-key');
      if (!elementRole) elementRole = cur.getAttribute('data-ut-role');
      if (!entityKind) entityKind = cur.getAttribute('data-ut-entity');
      if (!sourceLocator) sourceLocator = cur.getAttribute('data-ut-source-locator');
      if (!bindingId) bindingId = cur.getAttribute('data-ut-binding-id');
      if (!bindingKey) bindingKey = cur.getAttribute('data-ut-binding-key') || cur.getAttribute('data-element-key');
      if (!sourceTable) sourceTable = cur.getAttribute('data-ut-source-table');
      if (!rowId) rowId = cur.getAttribute('data-ut-row-id') || cur.getAttribute('data-ut-product-id');
      if (!field) field = cur.getAttribute('data-ut-field');
      if (!resource) resource = cur.getAttribute('data-ut-resource');
      if (!targetPath) targetPath = cur.getAttribute('data-ut-path') || cur.getAttribute('href') || cur.getAttribute('data-ut-target-page-id');
      if (!pageId) pageId = cur.getAttribute('data-ut-page');
      if (!pagePath) pagePath = cur.getAttribute('data-ut-page-path') || cur.getAttribute('data-page-path');
      const intent = cur.getAttribute('data-ut-intent');
      if (intent && !intents.includes(intent)) intents.push(intent);
      cur = cur.parentElement;
      depth++;
    }
    // Generated pages rarely carry data-ut-page-path; the HashRouter route the
    // element was clicked on is the authoritative page identity.
    if (!pagePath) {
      try {
        const hashRoute = (window.location.hash || '#/').replace(/^#/, '').split('?')[0];
        pagePath = hashRoute || '/';
      } catch (_) { pagePath = '/'; }
    }
    // M1 identity: index among repeated siblings (cards in a grid) and a
    // structural locator so the same item is re-found after rerender.
    let repeatIndex: number | null = null;
    let structuralPath = '';
    try {
      let n: Element | null = el; let hops = 0; const parts: string[] = [];
      while (n && n.parentElement && hops < 12) {
        const p = n.parentElement;
        const same = Array.prototype.filter.call(p.children, (c: Element) => c.tagName === n!.tagName && c.className === n!.className) as Element[];
        if (repeatIndex === null && same.length > 1) repeatIndex = same.indexOf(n);
        parts.unshift(n.tagName.toLowerCase() + (same.length > 1 ? '[]' : ''));
        if (n.tagName === 'SECTION' || n.hasAttribute('data-ut-section-id')) break;
        n = p; hops++;
      }
      structuralPath = parts.join('>');
    } catch (_) { /* best effort */ }
    return {
      repeatIndex,
      structuralPath,
      sourceLocator,
      elementId,
      slotId,
      blockId,
      sectionId,
      sectionType,
      surfaceId,
      componentType,
      componentInstanceId,
      artifactId,
      elementRole,
      entityKind,
      bindingId,
      bindingKey,
      sourceTable,
      rowId,
      field,
      resource,
      targetPath,
      pageId,
      pagePath,
      intents,
      primaryIntent,
      clickedTag: el.tagName.toLowerCase(),
    };
  }

  function snapshotStyles(el: Element): Record<string, string> {
    const cs = window.getComputedStyle(el);
    return {
      color: cs.color, backgroundColor: cs.backgroundColor, backgroundImage: cs.backgroundImage,
      fontSize: cs.fontSize, fontWeight: cs.fontWeight,
      fontStyle: cs.fontStyle, fontFamily: cs.fontFamily,
      textDecoration: cs.textDecoration, textAlign: cs.textAlign,
      padding: cs.padding, margin: cs.margin, borderRadius: cs.borderRadius,
      width: cs.width, height: cs.height, objectFit: cs.objectFit,
    };
  }

  function extractBackgroundImageUrl(value: string | null): string | null {
    if (!value || value === 'none') return null;
    const match = value.match(/url\\((['"]?)(.*?)\\1\\)/i);
    return match?.[2] || null;
  }

  function findImageTarget(el: Element): { kind: 'img' | 'background'; selector: string; src?: string } | null {
    if (el.tagName === 'IMG') {
      return { kind: 'img', selector: computeSelector(el), src: el.getAttribute('src') || undefined };
    }
    const nestedImg = el.querySelector('img');
    if (nestedImg) {
      return { kind: 'img', selector: computeSelector(nestedImg), src: nestedImg.getAttribute('src') || undefined };
    }
    let cur: Element | null = el;
    let depth = 0;
    while (cur && cur !== document.body && depth < 6) {
      const bg = window.getComputedStyle(cur).backgroundImage;
      const src = extractBackgroundImageUrl(bg);
      if (src) return { kind: 'background', selector: computeSelector(cur), src };
      cur = cur.parentElement;
      depth++;
    }
    return null;
  }

  function snapshotAttrs(el: Element): Record<string, string> {
    const out: Record<string, string> = {};
    for (const a of Array.from(el.attributes)) out[a.name] = a.value;
    return out;
  }

  function isUiChrome(el: Element | null): boolean {
    if (!el) return true;
    const id = (el as HTMLElement).id || '';
    if (id.startsWith('__ut-')) return true;
    return false;
  }

  function onMouseOver(e: MouseEvent) {
    if (!active) return;
    const t = e.target as HTMLElement | null;
    if (!t || isUiChrome(t) || t === hoverEl) return;
    clearHover();
    hoverEl = t;
    t.classList.add('__ut-hover');
  }
  function onMouseOut(e: MouseEvent) {
    if (!active) return;
    if (e.target === hoverEl) clearHover();
  }
  function onClickCapture(e: MouseEvent) {
    if (!active) return;
    const t = e.target as HTMLElement | null;
    if (!t || isUiChrome(t)) return;
    e.preventDefault();
    e.stopPropagation();
    if (typeof (e as any).stopImmediatePropagation === 'function') (e as any).stopImmediatePropagation();
    clearHover();
    clearSelected();
    selectedEl = t;
    t.classList.add('__ut-selected');
    const selector = computeSelector(t);
    const html = t.outerHTML.length > 4000 ? t.outerHTML.slice(0, 4000) : t.outerHTML;
    const scopeAncestors = collectScopeAncestors(t);
    window.parent.postMessage({
      type: 'ELEMENT_SELECTED',
      activationKey,
      element: {
        revisionId,
        tagName: t.tagName.toLowerCase(),
        textContent: (t.textContent || '').trim().slice(0, 500),
        selector, html,
        styles: snapshotStyles(t),
        attributes: snapshotAttrs(t),
        imageTarget: findImageTarget(t),
        section: findSection(t),
        scopeAncestors,
      },
    }, '*');
  }

  function activate() {
    if (active) return;
    active = true;
    ensureStyles();
    document.documentElement.classList.add('__ut-select-mode');
    document.addEventListener('mouseover', onMouseOver, true);
    document.addEventListener('mouseout', onMouseOut, true);
    document.addEventListener('click', onClickCapture, true);
  }
  function deactivate() {
    if (!active) return;
    active = false;
    clearHover();
    clearSelected();
    document.documentElement.classList.remove('__ut-select-mode');
    document.removeEventListener('mouseover', onMouseOver, true);
    document.removeEventListener('mouseout', onMouseOut, true);
    document.removeEventListener('click', onClickCapture, true);
  }

  window.addEventListener('message', function (event) {
    const data = event.data;
    if (!data || typeof data !== 'object') return;
    if (data.type === 'EDIT_MODE_TOGGLE') {
      activationKey = typeof data.activationKey === 'number' ? data.activationKey : activationKey + 1;
      revisionId = typeof data.revisionId === 'string' ? data.revisionId : null;
      if (data.enabled) activate(); else deactivate();
      window.parent.postMessage({ type: 'EDIT_MODE_READY', activationKey, enabled: !!data.enabled }, '*');
    }
    if (data.type === 'EDIT_MODE_CLEAR_SELECTION') {
      clearSelected();
    }
    // M1c: after a Sandpack rebuild the iframe document is recreated and the
    // previous selection is lost. The parent replays the last selection
    // identity; we resolve the same object and re-apply the highlight.
    if (data.type === 'UT_REACQUIRE_SELECTION' && data.selection) {
      const sel = data.selection;
      let resolved: Element | null = null;
      try {
        // 1) Resource mark is the strongest identity for saved-record values.
        if (sel.resource) {
          const marked = Array.prototype.slice.call(
            document.querySelectorAll('[data-ut-resource="' + String(sel.resource).replace(/"/g, '') + '"]')
          ) as Element[];
          if (marked.length === 1) resolved = marked[0];
          else if (marked.length > 1 && typeof sel.repeatIndex === 'number') resolved = marked[sel.repeatIndex] || null;
        }
        // 2) Stable selector, disambiguated by repeat index when duplicated.
        if (!resolved && sel.selector) {
          const matches = Array.prototype.slice.call(document.querySelectorAll(String(sel.selector))) as Element[];
          if (matches.length === 1) resolved = matches[0];
          else if (matches.length > 1 && typeof sel.repeatIndex === 'number') resolved = matches[sel.repeatIndex] || null;
        }
        // 3) Structural path within the same section (tag chain + repeat index).
        if (!resolved && sel.structuralPath) {
          const parts = String(sel.structuralPath).split('>').filter(Boolean);
          let scope: Element | null = null;
          if (sel.sectionId) {
            scope = document.querySelector('[data-ut-section-id="' + String(sel.sectionId).replace(/"/g, '') + '"]')
              || document.querySelector('[data-ut-section="' + String(sel.sectionId).replace(/"/g, '') + '"]');
          }
          let cur: Element | null = scope || document.body;
          let ok = true;
          for (let i = 0; i < parts.length; i++) {
            if (!cur) { ok = false; break; }
            const part = parts[i];
            const repeated = part.endsWith('[]');
            const tag = repeated ? part.slice(0, -2) : part;
            const kids = Array.prototype.filter.call(cur.children, (c: Element) => c.tagName.toLowerCase() === tag) as Element[];
            if (!kids.length) { ok = false; break; }
            cur = (repeated && typeof sel.repeatIndex === 'number' && i === parts.length - 1)
              ? (kids[sel.repeatIndex] || null)
              : kids[0];
          }
          if (ok && cur && cur !== document.body) resolved = cur;
        }
      } catch (_) { resolved = null; }
      if (resolved) {
        clearSelected();
        selectedEl = resolved as HTMLElement;
        (resolved as HTMLElement).classList.add('__ut-selected');
      }
      window.parent.postMessage({ type: 'UT_REACQUIRE_RESULT', ok: !!resolved }, '*');
    }
    // Read-only verification probe: answers what is actually painted.
    if (data.type === 'UT_PROBE' && Array.isArray(data.checks)) {
      const bodyText = (document.body && document.body.innerText) || '';
      const results = data.checks.map(function (c) {
        try {
          if (c.kind === 'text') return { kind: c.kind, value: c.value, ok: bodyText.toLowerCase().indexOf(String(c.value).toLowerCase()) >= 0 };
          if (c.kind === 'selector') { const n = document.querySelectorAll(String(c.value)).length; return { kind: c.kind, value: c.value, ok: n > 0, count: n }; }
          if (c.kind === 'intent') { const n = document.querySelectorAll('[data-ut-intent="' + String(c.value).replace(/"/g, '') + '"]').length; return { kind: c.kind, value: c.value, ok: n > 0, count: n }; }
        } catch (e) { return { kind: c.kind, value: c.value, ok: false, error: String(e) }; }
        return { kind: c.kind, value: c.value, ok: false, error: 'unknown check' };
      });
      window.parent.postMessage({ type: 'UT_PROBE_RESULT', probeId: data.probeId, route: location.hash || location.pathname, results }, '*');
    }
  });

  window.parent.postMessage({ type: 'EDIT_MODE_BRIDGE_READY' }, '*');
}
`;

/**
 * DEFAULT_INDEX — the canonical Sandpack entry point.
 * Sandpack react-ts uses /index.tsx, NOT /main.tsx.
 *
 * Runtime React monkey-patches (SafeCreateElement / jsx-runtime sanitization)
 * are gated behind ENABLE_REACT_RUNTIME_PATCH. These shims historically masked
 * malformed component returns by wrapping every function component and every
 * React.createElement / jsx() / jsxs() / jsxDEV() call. They are EXPENSIVE
 * (WeakMap wrap on every render), break reference-equality libraries
 * (React Router's Route discovery, framer-motion's variant matching, etc.),
 * and can mask the real source bug we want to repair upstream.
 *
 * Default OFF: the per-file repair passes (concise-arrow children, prose
 * fallback, raw-CSS wrapping) should be the canonical fix. Flip to true only
 * as a temporary mitigation while a regression is being root-caused.
 */
const ENABLE_REACT_RUNTIME_PATCH = false;

const REACT_RUNTIME_PATCH_BLOCK = `
// ── Runtime guard: intercept undefined components BEFORE they crash React ──
// This prevents "Element type is invalid" errors by replacing undefined/null
// component references with a visible placeholder instead of a hard crash.
const _origCreateElement = React.createElement;
const _undefinedComponents = new Set<string>();
const _badChildLogged = new Set<string>();
function _sanitizeChild(child: any): any {
  if (child == null || typeof child === 'string' || typeof child === 'number' || typeof child === 'boolean') return child;
  if (Array.isArray(child)) return child.map(_sanitizeChild);
  if (typeof child === 'object') {
    if ((child as any).$$typeof) return child;
    const keys = Object.keys(child);
    const sig = keys.sort().join(',');
    if (!_badChildLogged.has(sig)) {
      _badChildLogged.add(sig);
      console.error('[Preview] Non-renderable object child intercepted. Keys:', keys);
    }
    if ('children' in child) return _sanitizeChild((child as any).children);
    if ('text' in child || 'label' in child || 'title' in child) {
      return String((child as any).text ?? (child as any).label ?? (child as any).title ?? '');
    }
    try { return JSON.stringify(child); } catch { return ''; }
  }
  return child;
}
const _wrappedComponentCache = new WeakMap<any, any>();
const _SKIP_WRAP_NAMES = new Set([
  'Route','Routes','Router','BrowserRouter','HashRouter','MemoryRouter',
  'Outlet','Navigate','Switch','Link','NavLink','RouterProvider',
  'Suspense','Fragment','Profiler','StrictMode',
  'AnimatePresence','MotionConfig','LazyMotion','Reorder',
]);
function _wrapComponent(type: any): any {
  if (typeof type !== 'function') return type;
  if (type.prototype && type.prototype.isReactComponent) return type;
  const name = (type as any).displayName || (type as any).name;
  if (name && _SKIP_WRAP_NAMES.has(name)) return type;
  if ((type as any).$$typeof) return type;
  const cached = _wrappedComponentCache.get(type);
  if (cached) return cached;
  const Wrapped = function _SafeFC(props: any, ref: any) {
    let result;
    try { result = (type as any)(props, ref); } catch (e) { throw e; }
    if (result == null || typeof result === 'string' || typeof result === 'number' || typeof result === 'boolean') return result;
    if (typeof result === 'object' && (result as any).$$typeof) return result;
    if (Array.isArray(result)) return result.map(_sanitizeChild);
    return _sanitizeChild(result);
  };
  try { (Wrapped as any).displayName = (type as any).displayName || (type as any).name || 'SafeFC'; } catch {}
  _wrappedComponentCache.set(type, Wrapped);
  return Wrapped;
}

(React as any).createElement = function SafeCreateElement(type: any, props: any, ...children: any[]) {
  if (type === undefined || type === null) {
    const caller = new Error().stack?.split('\\n')[2]?.trim() || 'unknown';
    const id = caller.slice(0, 80);
    if (!_undefinedComponents.has(id)) {
      _undefinedComponents.add(id);
      console.error('[Preview] Undefined component intercepted. Caller:', caller);
    }
    return _origCreateElement('div', {
      style: { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', margin: 2, borderRadius: 6, border: '1px dashed hsl(0 60% 50%)', background: 'hsl(0 60% 97%)', color: 'hsl(0 60% 40%)', fontSize: 11, fontFamily: 'monospace' },
      title: 'This component resolved to undefined — check imports',
    }, '⚠ missing component');
  }
  const safeChildren = children.map(_sanitizeChild);
  if (safeChildren.length === 0 && props && typeof props === 'object' && 'children' in props) {
    const sanitized = _sanitizeChild((props as any).children);
    if (sanitized !== (props as any).children) {
      props = { ...props, children: sanitized };
    }
  }
  return _origCreateElement(_wrapComponent(type), props, ...safeChildren);
};

try {
  const __jsxRT: any = __JsxRuntime;
  const __jsxDEVRT: any = __JsxDevRuntime;
  const __makePlaceholder = () => _origCreateElement('div', {
    style: { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', margin: 2, borderRadius: 6, border: '1px dashed hsl(0 60% 50%)', background: 'hsl(0 60% 97%)', color: 'hsl(0 60% 40%)', fontSize: 11, fontFamily: 'monospace' },
    title: 'This component resolved to undefined — check imports',
  }, '⚠ missing component');
  const __wrapJsx = (orig: any) => function PatchedJsx(type: any, props: any, key: any) {
    if (type === undefined || type === null) return __makePlaceholder();
    if (props && typeof props === 'object' && 'children' in props) {
      const sanitized = _sanitizeChild((props as any).children);
      if (sanitized !== (props as any).children) {
        props = { ...props, children: sanitized };
      }
    }
    return orig(_wrapComponent(type), props, key);
  };
  if (__jsxRT) {
    if (typeof __jsxRT.jsx === 'function') __jsxRT.jsx = __wrapJsx(__jsxRT.jsx);
    if (typeof __jsxRT.jsxs === 'function') __jsxRT.jsxs = __wrapJsx(__jsxRT.jsxs);
  }
  if (__jsxDEVRT && typeof __jsxDEVRT.jsxDEV === 'function') {
    const origDev = __jsxDEVRT.jsxDEV;
    __jsxDEVRT.jsxDEV = function PatchedJsxDEV(type: any, props: any, key: any, isStatic: any, source: any, self: any) {
      if (type === undefined || type === null) return __makePlaceholder();
      if (props && typeof props === 'object' && 'children' in props) {
        const sanitized = _sanitizeChild((props as any).children);
        if (sanitized !== (props as any).children) {
          props = { ...props, children: sanitized };
        }
      }
      return origDev(_wrapComponent(type), props, key, isStatic, source, self);
    };
  }
} catch (e) {
  console.warn('[Preview] Failed to patch jsx-runtime:', e);
}
`;

const DEFAULT_INDEX = `import React, { Component } from 'react';
import ReactDOM from 'react-dom/client';
import * as __JsxRuntime from 'react/jsx-runtime';
import * as __JsxDevRuntime from 'react/jsx-dev-runtime';
import * as AppModule from './App';
import './index.css';
import { HashRouter as __PreviewHashRouter, useInRouterContext as __useInRouterContext } from 'react-router-dom';
const __RouterGuard = ({ children }: { children: React.ReactNode }) => {
  let inRouter = false;
  try { inRouter = __useInRouterContext(); } catch { inRouter = false; }
  return inRouter ? <>{children}</> : <__PreviewHashRouter>{children}</__PreviewHashRouter>;
};

${ENABLE_REACT_RUNTIME_PATCH ? REACT_RUNTIME_PATCH_BLOCK : '// React runtime patch disabled — per-file repair passes are authoritative.'}


// ── Robust App resolution: handle default + named exports gracefully ──
const App = (() => {
  if (AppModule.default && (typeof AppModule.default === 'function' || (typeof AppModule.default === 'object' && (AppModule.default as any).$$typeof))) {
    return AppModule.default;
  }
  for (const [key, value] of Object.entries(AppModule)) {
    if (key === '__esModule' || key === 'default') continue;
    if (/^[A-Z]/.test(key) && (typeof value === 'function' || (typeof value === 'object' && value !== null && (value as any).$$typeof))) {
      return value;
    }
  }
  return null;
})();

// Sandpack replaces the VFS index.html with its own shell, so scripts placed
// there never run. Bootstrap Tailwind here, before the site mounts, to compile
// the generated utility classes alongside the snapshot-owned token stylesheet.
const __tailwindConfig = {
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
        destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
        popover: { DEFAULT: 'hsl(var(--popover))', foreground: 'hsl(var(--popover-foreground))' },
        card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        heading: 'var(--font-heading, ui-sans-serif, system-ui, sans-serif)',
        body: 'var(--font-body, ui-sans-serif, system-ui, sans-serif)',
      },
    },
  },
};

const __loadTailwindUtilities = () => new Promise<void>((resolve) => {
  if (document.querySelector('[data-unison-tailwind-runtime]')) {
    resolve();
    return;
  }

  (window as any).tailwind = { config: __tailwindConfig };
  const source = document.createElement('style');
  source.type = 'text/tailwindcss';
  source.dataset.unisonTailwindSource = 'true';
  source.textContent = '@tailwind base; @tailwind components; @tailwind utilities;';
  document.head.appendChild(source);

  const loader = document.createElement('script');
  loader.src = 'https://cdn.tailwindcss.com';
  loader.async = true;
  loader.dataset.unisonTailwindRuntime = 'true';
  const finish = () => window.setTimeout(resolve, 0);
  loader.onload = finish;
  loader.onerror = finish;
  document.head.appendChild(loader);
  window.setTimeout(finish, 5000);
});

${PREVIEW_NAV_BRIDGE}
__initUnisonPreviewNavBridge();

${PREVIEW_SELECTION_BRIDGE}
__initUnisonPreviewSelectionBridge();

// Error boundary as secondary safety net
class PreviewErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: any) {
    console.error('[Preview] Render crash:', error.message, info?.componentStack?.slice(0, 500));
    window.parent.postMessage({ type: 'UNISON_PREVIEW_RENDER_ERROR', error: error.message }, '*');
  }
  render() {
    if (this.state.hasError) {
      return React.createElement('div', {
        style: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui', padding: 32, background: '#0a0a0a', color: '#e5e5e5' }
      },
        React.createElement('div', { style: { maxWidth: 480, textAlign: 'center' } },
          React.createElement('div', { style: { fontSize: 48, marginBottom: 16 } }, '⚠️'),
          React.createElement('h2', { style: { fontSize: 20, fontWeight: 600, marginBottom: 8 } }, 'Preview render error'),
          React.createElement('p', { style: { color: '#a3a3a3', fontSize: 14, marginBottom: 16, lineHeight: 1.6 } }, this.state.error?.message || 'A component failed to render. This usually means an import resolved to undefined.'),
          React.createElement('details', { style: { textAlign: 'left', fontSize: 12, color: '#737373', marginBottom: 16 } },
            React.createElement('summary', { style: { cursor: 'pointer', marginBottom: 8 } }, 'Technical details'),
            React.createElement('pre', { style: { whiteSpace: 'pre-wrap', wordBreak: 'break-word' } }, String(this.state.error?.stack || '').slice(0, 600))
          ),
          React.createElement('button', {
            onClick: () => { this.setState({ hasError: false, error: null }); },
            style: { padding: '8px 20px', borderRadius: 6, border: '1px solid #333', background: '#1a1a1a', color: '#e5e5e5', cursor: 'pointer', fontSize: 14 }
          }, 'Retry')
        )
      );
    }
    return this.props.children;
  }
}

// Sandpack's "running" status confirms its bundler connected, before React
// necessarily mounts. Only a successful app commit may unlock launch review.
function __PreviewRenderReady({ children }: { children: React.ReactNode }) {
  React.useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      window.parent.postMessage({ type: 'UNISON_PREVIEW_RENDER_READY' }, '*');
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);
  return children;
}

const __mountPreview = () => {
if (App) {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <PreviewErrorBoundary>
        <__PreviewRenderReady>
        <__RouterGuard>
          <App />
        </__RouterGuard>
        </__PreviewRenderReady>
      </PreviewErrorBoundary>
    </React.StrictMode>
  );
} else {
  window.parent.postMessage({ type: 'UNISON_PREVIEW_RENDER_ERROR', error: 'App.tsx does not export a renderable component.' }, '*');
  // App module has no valid export — render diagnostic
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui', padding: 32 }}>
      <div style={{ textAlign: 'center', maxWidth: 420 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📦</div>
        <h2 style={{ fontSize: 18, marginBottom: 8 }}>No renderable component found</h2>
        <p style={{ color: '#888', fontSize: 14 }}>App.tsx does not export a valid React component. Check that it uses "export default" or a named PascalCase export.</p>
      </div>
    </div>
  );
}
};

void __loadTailwindUtilities().finally(__mountPreview);
`;

const HOOKS_SHIM = `
import { useState as reactUseState, useEffect as reactUseEffect, useCallback as reactUseCallback, useMemo as reactUseMemo, useRef as reactUseRef, useContext as reactUseContext, createContext } from 'react';

export const useState = reactUseState;
export const useEffect = reactUseEffect;
export const useCallback = reactUseCallback;
export const useMemo = reactUseMemo;
export const useRef = reactUseRef;
export const useContext = reactUseContext;

export const useToast = () => {
  const toast = (opts) => { console.log('[Toast]', opts.title, opts.description); };
  return { toast, dismiss: () => {} };
};
export const useMobile = () => false;
export const useSidebar = () => ({ open: false, toggle: () => {}, setOpen: () => {} });
export const useTheme = () => {
  const [theme, setTheme] = reactUseState('light');
  return { theme, setTheme, toggleTheme: () => setTheme(t => t === 'light' ? 'dark' : 'light') };
};
export const useRouter = () => ({ push: () => {}, replace: () => {}, pathname: '/', back: () => {} });
export const useParams = () => ({});
export const useSearchParams = () => [new URLSearchParams(), () => {}];
export const useQuery = () => ({ data: null, loading: false, error: null, refetch: () => Promise.resolve() });
export const useMutation = () => [() => Promise.resolve(), { loading: false, error: null }];
export const useForm = () => ({ register: () => ({}), handleSubmit: (fn) => fn, watch: () => '', errors: {}, reset: () => {} });
export const useDebounce = (value) => value;
export const useLocalStorage = (key, initial) => {
  const [value, setValue] = reactUseState(initial);
  return [value, setValue];
};
export const useMediaQuery = () => false;
export const useOnClickOutside = () => {};
export const useWindowSize = () => ({ width: 1024, height: 768 });
export const useIntersectionObserver = () => ({ ref: { current: null }, inView: true });
export const useAnimation = () => ({ ref: { current: null }, controls: {} });
export const useReducer = (reducer, initial) => [initial, () => {}];
export const useLayoutEffect = reactUseEffect;
export const useAuth = () => ({
  user: null, session: null, loading: false, isAuthenticated: false,
  signIn: () => Promise.resolve({ error: 'Preview mode' }),
  signUp: () => Promise.resolve({ error: 'Preview mode' }),
  signOut: () => Promise.resolve(),
});
export const supabase = {
  auth: {
    signInWithPassword: () => Promise.resolve({ data: null, error: { message: 'Preview mode' } }),
    signUp: () => Promise.resolve({ data: null, error: { message: 'Preview mode' } }),
    signOut: () => Promise.resolve({ error: null }),
    getSession: () => Promise.resolve({ data: { session: null }, error: null }),
    getUser: () => Promise.resolve({ data: { user: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
  },
  from: () => ({
    select: () => Promise.resolve({ data: [], error: null }),
    insert: () => Promise.resolve({ data: null, error: null }),
    update: () => Promise.resolve({ data: null, error: null }),
    delete: () => Promise.resolve({ data: null, error: null }),
  }),
};
export const useAssetRegistry = () => ({ assets: [], registerAsset: () => {}, getAsset: () => null, removeAsset: () => {} });
export const useSceneModel = () => ({ scene: null, updateScene: () => {}, selectedNode: null, selectNode: () => {} });
export const useDesignStudio = () => ({ scene: null, updateScene: () => {}, undo: () => {}, redo: () => {}, canUndo: false, canRedo: false });
export const useVirtualFileSystem = () => ({ files: {}, createFile: () => {}, updateFile: () => {}, deleteFile: () => {}, readFile: () => '' });
export const usePreviewSession = () => ({ session: null, isLoading: false, error: null, refresh: () => {} });
export const useAIFileAnalysis = () => ({ analyze: () => Promise.resolve({}), isAnalyzing: false });
export const useAITemplate = () => ({ generate: () => Promise.resolve(''), isGenerating: false });
export const useCodeHistory = () => ({ history: [], push: () => {}, undo: () => '', redo: () => '', canUndo: false, canRedo: false });
export const useDocument = () => ({ document: null, isLoading: false, save: () => Promise.resolve() });
export const useGoHighLevelCRM = () => ({ contacts: [], pipelines: [], isLoading: false });
export const useKeyboardShortcuts = () => {};
export const usePageGenerator = () => ({ generate: () => Promise.resolve(''), isGenerating: false });
export const useSubscription = () => ({ subscription: null, isLoading: false, tier: 'free' });
export const useCanvasHistory = () => ({ history: [], push: () => {}, undo: () => {}, redo: () => {}, canUndo: false, canRedo: false });
export const useTemplateAutomation = () => ({ automate: () => Promise.resolve(), isAutomating: false });
export const useTemplateFiles = () => ({ files: [], upload: () => Promise.resolve(), delete: () => Promise.resolve() });
export const useTemplateState = () => ({ state: {}, setState: () => {}, reset: () => {} });
export const useWebBuilder = () => ({ pages: [], components: [], addPage: () => {}, addComponent: () => {} });
export const useWebBuilderAI = () => ({ generate: () => Promise.resolve(''), isGenerating: false });
export const useWebBuilderState = () => ({ state: {}, setState: () => {} });
export const useWorkflowTrigger = () => ({ trigger: () => Promise.resolve(), isTriggering: false });
export const useCounter = (initial = 0) => { const [count, setCount] = reactUseState(initial); return { count, increment: () => setCount(c => c + 1), decrement: () => setCount(c => c - 1) }; };
export const useToggle = (initial = false) => { const [value, setValue] = reactUseState(initial); return [value, () => setValue(v => !v)]; };
export const useIntentHandlers = () => ({
  handleBooking: (service) => {
    const sel = 'form[data-ut-intent="booking.create"],form[data-ut-intent*="booking"],#booking,[id*="booking-form"],[class*="booking-form"],.booking';
    const el = document.querySelector(sel);
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); const inp = el.querySelector('input:not([type="hidden"]):not([type="submit"]),textarea'); if (inp) setTimeout(() => (inp as HTMLElement).focus(), 480); }
    else console.log('[Intent] booking.create:', service);
  },
  handleContact: (data) => {
    const sel = 'form[data-ut-intent="contact.submit"],form[data-ut-intent*="contact"],#contact,[id*="contact-form"],[class*="contact-form"]';
    const el = document.querySelector(sel);
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); const inp = el.querySelector('input:not([type="hidden"]):not([type="submit"]),textarea'); if (inp) setTimeout(() => (inp as HTMLElement).focus(), 480); }
    else console.log('[Intent] contact.submit:', data);
  },
  handleNewsletter: (email) => {
    const sel = 'form[data-ut-intent="newsletter.subscribe"],form[data-ut-intent*="newsletter"],#newsletter,[id*="newsletter"],[class*="newsletter"],input[type="email"]';
    const el = document.querySelector(sel);
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); const inp = (el as HTMLElement).tagName === 'INPUT' ? el : el.querySelector('input[type="email"]'); if (inp) setTimeout(() => (inp as HTMLElement).focus(), 480); }
    else console.log('[Intent] newsletter.subscribe:', email);
  },
  handleNavigation: (path) => { const section = document.querySelector(path); if (section) section.scrollIntoView({ behavior: 'smooth' }); },
  handleAuth: (action) => {
    const sel = 'form[data-ut-intent^="auth."],#login,#auth,#register,[id*="login-form"],[class*="auth-form"]';
    const el = document.querySelector(sel);
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); const inp = el.querySelector('input:not([type="hidden"]):not([type="submit"])'); if (inp) setTimeout(() => (inp as HTMLElement).focus(), 480); }
    else console.log('[Intent] auth.' + action);
  },
});
export const useNavigate = () => (path) => {
  if (path.startsWith('#')) {
    const el = document.querySelector(path);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  } else {
    // Post to parent for page generation / routing
    const requestId = 'nav-' + Date.now();
    const pageName = path.replace(/^[/]/, '').replace(/[.]html$/, '') || 'index';
    window.parent.postMessage({
      type: 'NAV_PAGE_GENERATE',
      pageName,
      navLabel: pageName.charAt(0).toUpperCase() + pageName.slice(1),
      requestId,
    }, '*');
  }
};

export default {
  useState, useEffect, useCallback, useMemo, useRef, useContext,
  useToast, useMobile, useSidebar, useTheme, useAuth, useRouter,
  useParams, useSearchParams, useQuery, useMutation, useForm,
  useDebounce, useLocalStorage, useMediaQuery, useOnClickOutside,
  useWindowSize, useIntersectionObserver, useAnimation, useReducer,
  useLayoutEffect, useAssetRegistry, useSceneModel, useDesignStudio,
  useVirtualFileSystem, usePreviewSession, useAIFileAnalysis,
  useAITemplate, useCodeHistory, useDocument, useGoHighLevelCRM,
  useKeyboardShortcuts, usePageGenerator, useSubscription,
  useCanvasHistory, useTemplateAutomation, useTemplateFiles,
  useTemplateState, useWebBuilder, useWebBuilderAI, useWebBuilderState,
  useWorkflowTrigger, useCounter, useToggle, useIntentHandlers, useNavigate, supabase,
};
`;

// ── Lib/utils shim — provides real cn() function ─────────────────────────────
const LIB_UTILS_SHIM = `
export function cn(...inputs) {
  return inputs.filter(Boolean).join(' ');
}
export function clsx(...args) {
  return args.flat(Infinity).filter(x => typeof x === 'string' && x).join(' ');
}
export default { cn, clsx };
`;

// ── UI components shim — provides real React component stubs ─────────────────
const UI_COMPONENTS_SHIM = `
import React from 'react';

// Utility
function cn(...inputs) { return inputs.filter(Boolean).join(' '); }

// Button
export function Button({ children, className, variant, size, asChild, ...props }) {
  return React.createElement('button', { className: cn('inline-flex items-center justify-center rounded-md text-sm font-medium px-4 py-2', className), ...props }, children);
}

// Card
export function Card({ children, className, ...props }) { return React.createElement('div', { className: cn('rounded-lg border bg-card text-card-foreground shadow-sm', className), ...props }, children); }
export function CardHeader({ children, className, ...props }) { return React.createElement('div', { className: cn('flex flex-col space-y-1.5 p-6', className), ...props }, children); }
export function CardTitle({ children, className, ...props }) { return React.createElement('h3', { className: cn('text-2xl font-semibold leading-none tracking-tight', className), ...props }, children); }
export function CardDescription({ children, className, ...props }) { return React.createElement('p', { className: cn('text-sm text-muted-foreground', className), ...props }, children); }
export function CardContent({ children, className, ...props }) { return React.createElement('div', { className: cn('p-6 pt-0', className), ...props }, children); }
export function CardFooter({ children, className, ...props }) { return React.createElement('div', { className: cn('flex items-center p-6 pt-0', className), ...props }, children); }

// Input
export function Input({ className, type = 'text', ...props }) { return React.createElement('input', { type, className: cn('flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm', className), ...props }); }

// Label
export function Label({ children, className, ...props }) { return React.createElement('label', { className: cn('text-sm font-medium leading-none', className), ...props }, children); }

// Badge
export function Badge({ children, className, variant, ...props }) { return React.createElement('span', { className: cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold', className), ...props }, children); }

// Separator
export function Separator({ className, orientation = 'horizontal', ...props }) { return React.createElement('div', { className: cn(orientation === 'horizontal' ? 'h-[1px] w-full' : 'h-full w-[1px]', 'shrink-0 bg-border', className), ...props }); }

// Textarea
export function Textarea({ className, ...props }) { return React.createElement('textarea', { className: cn('flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm', className), ...props }); }

// Avatar
export function Avatar({ children, className, ...props }) { return React.createElement('span', { className: cn('relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full', className), ...props }, children); }
export function AvatarImage({ src, alt, className, ...props }) { return React.createElement('img', { src, alt, className: cn('aspect-square h-full w-full', className), ...props }); }
export function AvatarFallback({ children, className, ...props }) { return React.createElement('span', { className: cn('flex h-full w-full items-center justify-center rounded-full bg-muted', className), ...props }, children); }

// ScrollArea
export function ScrollArea({ children, className, ...props }) { return React.createElement('div', { className: cn('overflow-auto', className), ...props }, children); }

// Tabs
export function Tabs({ children, className, defaultValue, ...props }) { return React.createElement('div', { className, ...props }, children); }
export function TabsList({ children, className, ...props }) { return React.createElement('div', { className: cn('inline-flex h-10 items-center justify-center rounded-md bg-muted p-1', className), ...props }, children); }
export function TabsTrigger({ children, className, value, ...props }) { return React.createElement('button', { className: cn('inline-flex items-center justify-center rounded-sm px-3 py-1.5 text-sm font-medium', className), ...props }, children); }
export function TabsContent({ children, className, value, ...props }) { return React.createElement('div', { className, ...props }, children); }

// Dialog
export function Dialog({ children, ...props }) { return React.createElement(React.Fragment, null, children); }
export function DialogTrigger({ children, asChild, ...props }) { return React.createElement(React.Fragment, null, children); }
export function DialogContent({ children, className, ...props }) { return React.createElement('div', { className: cn('fixed inset-0 z-50 flex items-center justify-center', className), ...props }, children); }
export function DialogHeader({ children, className, ...props }) { return React.createElement('div', { className: cn('flex flex-col space-y-1.5 text-center sm:text-left', className), ...props }, children); }
export function DialogTitle({ children, className, ...props }) { return React.createElement('h2', { className: cn('text-lg font-semibold', className), ...props }, children); }
export function DialogDescription({ children, className, ...props }) { return React.createElement('p', { className: cn('text-sm text-muted-foreground', className), ...props }, children); }

// Sheet
export function Sheet({ children, ...props }) { return React.createElement(React.Fragment, null, children); }
export function SheetTrigger({ children, ...props }) { return React.createElement(React.Fragment, null, children); }
export function SheetContent({ children, className, ...props }) { return React.createElement('div', { className, ...props }, children); }

// Select  
export function Select({ children, ...props }) { return React.createElement('div', null, children); }
export function SelectTrigger({ children, className, ...props }) { return React.createElement('button', { className: cn('flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm', className), ...props }, children); }
export function SelectValue({ placeholder, ...props }) { return React.createElement('span', props, placeholder); }
export function SelectContent({ children, ...props }) { return React.createElement('div', props, children); }
export function SelectItem({ children, value, ...props }) { return React.createElement('div', props, children); }

// Switch
export function Switch({ className, ...props }) { return React.createElement('button', { className: cn('peer inline-flex h-[24px] w-[44px] rounded-full border-2', className), role: 'switch', ...props }); }

// Accordion
export function Accordion({ children, ...props }) { return React.createElement('div', props, children); }
export function AccordionItem({ children, value, ...props }) { return React.createElement('div', props, children); }
export function AccordionTrigger({ children, ...props }) { return React.createElement('button', props, children); }
export function AccordionContent({ children, ...props }) { return React.createElement('div', props, children); }

// Progress
export function Progress({ value = 0, className, ...props }) { return React.createElement('div', { className: cn('relative h-4 w-full overflow-hidden rounded-full bg-secondary', className), ...props }, React.createElement('div', { style: { width: value + '%' }, className: 'h-full bg-primary transition-all' })); }

// Tooltip
export function Tooltip({ children, ...props }) { return React.createElement(React.Fragment, null, children); }
export function TooltipTrigger({ children, asChild, ...props }) { return React.createElement(React.Fragment, null, children); }
export function TooltipContent({ children, ...props }) { return null; }
export function TooltipProvider({ children, ...props }) { return React.createElement(React.Fragment, null, children); }

// Skeleton
export function Skeleton({ className, ...props }) { return React.createElement('div', { className: cn('animate-pulse rounded-md bg-muted', className), ...props }); }

// Checkbox
export function Checkbox({ className, ...props }) { return React.createElement('input', { type: 'checkbox', className, ...props }); }

// RadioGroup
export function RadioGroup({ children, ...props }) { return React.createElement('div', props, children); }
export function RadioGroupItem({ value, ...props }) { return React.createElement('input', { type: 'radio', value, ...props }); }

// Sonner toast
export function Toaster(props) { return null; }
export function toast(message) { console.log('[Toast]', message); }

// Form
export function Form({ children, ...props }) { return React.createElement('form', props, children); }
export function FormField({ render, name, control, ...props }) { return render ? render({ field: { name, value: '', onChange: () => {}, onBlur: () => {} } }) : null; }
export function FormItem({ children, ...props }) { return React.createElement('div', { className: 'space-y-2', ...props }, children); }
export function FormLabel({ children, ...props }) { return React.createElement('label', props, children); }
export function FormControl({ children, ...props }) { return React.createElement('div', props, children); }
export function FormMessage({ ...props }) { return null; }

// DropdownMenu
export function DropdownMenu({ children, ...props }) { return React.createElement(React.Fragment, null, children); }
export function DropdownMenuTrigger({ children, asChild, ...props }) { return React.createElement(React.Fragment, null, children); }
export function DropdownMenuContent({ children, ...props }) { return null; }
export function DropdownMenuItem({ children, ...props }) { return React.createElement('div', props, children); }

// Popover
export function Popover({ children, ...props }) { return React.createElement(React.Fragment, null, children); }
export function PopoverTrigger({ children, asChild, ...props }) { return React.createElement(React.Fragment, null, children); }
export function PopoverContent({ children, ...props }) { return null; }

// Collapsible
export function Collapsible({ children, ...props }) { return React.createElement('div', props, children); }
export function CollapsibleTrigger({ children, ...props }) { return React.createElement('div', props, children); }
export function CollapsibleContent({ children, ...props }) { return React.createElement('div', props, children); }

// NavigationMenu
export function NavigationMenu({ children, className, ...props }) { return React.createElement('nav', { className, ...props }, children); }
export function NavigationMenuList({ children, ...props }) { return React.createElement('ul', props, children); }
export function NavigationMenuItem({ children, ...props }) { return React.createElement('li', props, children); }
export function NavigationMenuTrigger({ children, ...props }) { return React.createElement('button', props, children); }
export function NavigationMenuContent({ children, ...props }) { return React.createElement('div', props, children); }
export function NavigationMenuLink({ children, ...props }) { return React.createElement('a', props, children); }

// Breadcrumb
export function Breadcrumb({ children, ...props }) { return React.createElement('nav', props, children); }
export function BreadcrumbList({ children, ...props }) { return React.createElement('ol', { className: 'flex items-center gap-1.5', ...props }, children); }
export function BreadcrumbItem({ children, ...props }) { return React.createElement('li', props, children); }
export function BreadcrumbLink({ children, ...props }) { return React.createElement('a', props, children); }
export function BreadcrumbSeparator({ ...props }) { return React.createElement('span', props, '/'); }

// Table
export function Table({ children, className, ...props }) { return React.createElement('table', { className: cn('w-full caption-bottom text-sm', className), ...props }, children); }
export function TableHeader({ children, ...props }) { return React.createElement('thead', props, children); }
export function TableBody({ children, ...props }) { return React.createElement('tbody', props, children); }
export function TableRow({ children, className, ...props }) { return React.createElement('tr', { className: cn('border-b', className), ...props }, children); }
export function TableHead({ children, className, ...props }) { return React.createElement('th', { className: cn('h-12 px-4 text-left align-middle font-medium', className), ...props }, children); }
export function TableCell({ children, className, ...props }) { return React.createElement('td', { className: cn('p-4 align-middle', className), ...props }, children); }

// Carousel
export function Carousel({ children, className, ...props }) { return React.createElement('div', { className, ...props }, children); }
export function CarouselContent({ children, ...props }) { return React.createElement('div', { className: 'flex', ...props }, children); }
export function CarouselItem({ children, ...props }) { return React.createElement('div', { className: 'min-w-0 flex-shrink-0 flex-grow-0 basis-full', ...props }, children); }
export function CarouselPrevious({ ...props }) { return React.createElement('button', props, '<'); }
export function CarouselNext({ ...props }) { return React.createElement('button', props, '>'); }

// AspectRatio
export function AspectRatio({ children, ratio = 1, className, ...props }) { return React.createElement('div', { style: { position: 'relative', paddingBottom: (1 / ratio * 100) + '%' }, className, ...props }, React.createElement('div', { style: { position: 'absolute', inset: 0 } }, children)); }

// HoverCard
export function HoverCard({ children, ...props }) { return React.createElement(React.Fragment, null, children); }
export function HoverCardTrigger({ children, ...props }) { return React.createElement(React.Fragment, null, children); }
export function HoverCardContent({ children, ...props }) { return null; }

// Command
export function Command({ children, className, ...props }) { return React.createElement('div', { className, ...props }, children); }
export function CommandInput({ ...props }) { return React.createElement('input', { type: 'text', ...props }); }
export function CommandList({ children, ...props }) { return React.createElement('div', props, children); }
export function CommandEmpty({ children, ...props }) { return React.createElement('div', props, children); }
export function CommandGroup({ children, ...props }) { return React.createElement('div', props, children); }
export function CommandItem({ children, ...props }) { return React.createElement('div', props, children); }

// Calendar
export function Calendar({ ...props }) { return React.createElement('div', { className: 'p-3 text-center text-sm text-muted-foreground' }, 'Calendar'); }

export default {};
`;

// Legacy compatibility for packages not yet verified in Sandpack. Accordion,
// Dialog and Slot retain their real runtime behavior below.
const RADIX_PREVIEW_SHIM = `
import React from 'react';

const passthrough = (tag = 'div') => React.forwardRef(({ children, ...props }, ref) =>
  React.createElement(tag, { ...props, ref }, children)
);

export const Root = passthrough();
export const Trigger = passthrough('button');
export const Content = passthrough();
export const Portal = ({ children }) => React.createElement(React.Fragment, null, children);
export const Overlay = passthrough();
export const Title = passthrough('h2');
export const Description = passthrough('p');
export const Close = passthrough('button');
export const Item = passthrough();
export const ItemText = passthrough('span');
export const ItemIndicator = passthrough('span');
export const Group = passthrough();
export const Label = passthrough('label');
export const Separator = passthrough();
export const Viewport = passthrough();
export const Scrollbar = passthrough();
export const Thumb = passthrough();
export const Icon = passthrough('span');
export const Arrow = passthrough();
export const Value = passthrough('span');
export const Indicator = passthrough('span');
export const Toggle = passthrough('button');
export const ToggleGroup = Root;
export const ToggleGroupItem = Trigger;
export const List = passthrough();
export const Link = passthrough('a');
export const Collection = passthrough();
export const CollectionItem = passthrough();
export const AspectRatio = passthrough();
export const Image = passthrough('img');
export const Fallback = passthrough('span');
export const Provider = ({ children }) => React.createElement(React.Fragment, null, children);
export const ToastProvider = Provider;
export const ToastViewport = Viewport;
export const Toast = Root;
export const ToastTitle = Title;
export const ToastDescription = Description;
export const ToastAction = Trigger;
export const ToastClose = Close;
export const createSlot = () => Slot;
export const Slottable = ({ children }) => React.createElement(React.Fragment, null, children);
export const Slot = React.forwardRef(({ children, ...props }, ref) => {
  const child = React.Children.toArray(children).find(React.isValidElement);
  return child
    ? React.cloneElement(child, { ...props, ref })
    : React.createElement('span', { ...props, ref }, children);
});
export const createContextScope = () => [() => [Provider, () => ({})], () => ({})];
export const createCollection = () => [{ Provider, Slot, ItemSlot: Item }, () => [], () => ({})];
export const unstable_createCollection = createCollection;
export const createPopperScope = () => () => ({});
export const createMenuScope = () => () => ({});
export const createDialogScope = () => () => ({});
export const createSelectScope = () => () => ({});
export const createTooltipScope = () => () => ({});
export const createTabsScope = () => () => ({});
export const createAccordionScope = () => () => ({});
export const useControllableState = ({ defaultProp, prop, onChange }) => {
  const [value, setValue] = React.useState(prop === undefined ? defaultProp : prop);
  const set = (next) => { const resolved = typeof next === 'function' ? next(value) : next; setValue(resolved); onChange?.(resolved); };
  return [prop === undefined ? value : prop, set];
};
export const useComposedRefs = (...refs) => (node) => refs.forEach((ref) => {
  if (typeof ref === 'function') ref(node);
  else if (ref) ref.current = node;
});
`;

// Sandpack's CommonJS transform for Framer Motion has the same dependency
// collector failure as Radix. Generated previews need declarative motion
// components, not the animation runtime, while compiling.
const MOTION_PREVIEW_SHIM = `
import React from 'react';

const MOTION_ONLY_PROPS = new Set([
  'animate', 'initial', 'exit', 'transition', 'variants', 'whileHover',
  'whileTap', 'whileFocus', 'whileInView', 'layout', 'layoutId', 'drag',
  'dragConstraints', 'onAnimationStart', 'onAnimationComplete',
]);
const component = (tag = 'div') => React.forwardRef(({ children, ...props }, ref) => {
  const domProps = Object.fromEntries(
    Object.entries(props).filter(([name]) => !MOTION_ONLY_PROPS.has(name))
  );
  return React.createElement(tag, { ...domProps, ref }, children);
});
const motionComponent = (tag) => component(String(tag));
export const motion = new Proxy({}, { get: (_target, tag) => motionComponent(tag) });
export const m = motion;
export const AnimatePresence = ({ children }) => React.createElement(React.Fragment, null, children);
export const LazyMotion = AnimatePresence;
export const LayoutGroup = AnimatePresence;
export const MotionConfig = AnimatePresence;
export const Reorder = { Group: component(), Item: component() };
export const useMotionValue = (initial) => {
  const value = React.useRef(initial);
  return React.useMemo(() => ({ get: () => value.current, set: (next) => { value.current = next; }, on: () => () => {} }), []);
};
export const useSpring = (value) => value;
export const useTransform = (value) => value;
export const useScroll = () => ({ scrollX: useMotionValue(0), scrollY: useMotionValue(0), scrollXProgress: useMotionValue(0), scrollYProgress: useMotionValue(0) });
export const useInView = () => true;
export const useAnimation = () => ({ start: () => Promise.resolve(), set: () => {}, stop: () => {} });
export const useReducedMotion = () => false;
`;

/**
 * Preserve verified interaction packages and adapt the remaining legacy imports.
 * Also runs after canonical overlays written after the main preparation pass.
 */
export function applyRadixPreviewShim(files: Record<string, string>): Record<string, string> {
  const previewFiles = { ...files };

  for (const [filePath, content] of Object.entries(previewFiles)) {
    if (!/\.[cm]?[jt]sx?$/.test(filePath)) continue;

    const sandpackPath = filePath.replace(/^\/src\//, '/');
    const radixShimImport = toRelativeSandpackImport(sandpackPath, '/radix-shim');
    previewFiles[filePath] = content.replace(
      /(['"])@radix-ui\/react-(?!(?:accordion|dialog|slot)\1)[^'"]+\1/g,
      (_match, quote: string) => `${quote}${radixShimImport}${quote}`,
    );
  }

  previewFiles['/radix-shim.tsx'] = RADIX_PREVIEW_SHIM;
  return previewFiles;
}

/** Replace Framer Motion imports only in Sandpack artifact files. */
export function applyFramerMotionPreviewShim(files: Record<string, string>): Record<string, string> {
  const previewFiles = { ...files };

  for (const [filePath, content] of Object.entries(previewFiles)) {
    if (!/\.[cm]?[jt]sx?$/.test(filePath)) continue;

    const sandpackPath = filePath.replace(/^\/src\//, '/');
    const motionShimImport = toRelativeSandpackImport(sandpackPath, '/motion-shim');
    previewFiles[filePath] = content.replace(
      /(['"])framer-motion\1/g,
      (_match, quote: string) => `${quote}${motionShimImport}${quote}`,
    );
  }

  previewFiles['/motion-shim.tsx'] = MOTION_PREVIEW_SHIM;
  return previewFiles;
}

export function applySandpackRuntimeShims(files: Record<string, string>): Record<string, string> {
  return applyFramerMotionPreviewShim(applyRadixPreviewShim(files));
}

// ── Industry-contextual fallback images ──────────────────────────────────────
export const CONTEXTUAL_IMAGES: Record<string, string[]> = {
  restaurant: [
    'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80',
    'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80',
    'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80',
    'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&q=80',
  ],
  salon: [
    'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&q=80',
    'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800&q=80',
    'https://images.unsplash.com/photo-1521590832167-7228f0829e2e?w=800&q=80',
    'https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=800&q=80',
  ],
  fitness: [
    'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&q=80',
    'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=800&q=80',
    'https://images.unsplash.com/photo-1549060279-7e168fcee0c2?w=800&q=80',
    'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=800&q=80',
  ],
  medical: [
    'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=800&q=80',
    'https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=800&q=80',
    'https://images.unsplash.com/photo-1631217868264-e5b90bb7e133?w=800&q=80',
    'https://images.unsplash.com/photo-1666214280557-091e203c7096?w=800&q=80',
  ],
  saas: [
    'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=80',
    'https://images.unsplash.com/photo-1551434678-e076c223a692?w=800&q=80',
    'https://images.unsplash.com/photo-1531482615713-2afd69097998?w=800&q=80',
    'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800&q=80',
  ],
  ecommerce: [
    'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&q=80',
    'https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=800&q=80',
    'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=800&q=80',
    'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&q=80',
  ],
  portfolio: [
    'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800&q=80',
    'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&q=80',
    'https://images.unsplash.com/photo-1558655146-9f40138edfeb?w=800&q=80',
  ],
  contractor: [
    'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800&q=80',
    'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=800&q=80',
    'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?w=800&q=80',
    'https://images.unsplash.com/photo-1585704032915-c3400ca199e7?w=800&q=80',
  ],
  agency: [
    'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80',
    'https://images.unsplash.com/photo-1553877522-43269d4ea984?w=800&q=80',
    'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=800&q=80',
  ],
  coaching: [
    'https://images.unsplash.com/photo-1552581234-26160f608093?w=800&q=80',
    'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=800&q=80',
    'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&q=80',
  ],
  'local-service': [
    'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800&q=80',
    'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?w=800&q=80',
    'https://images.unsplash.com/photo-1585704032915-c3400ca199e7?w=800&q=80',
  ],
  default: [
    'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80',
    'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=80',
    'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&q=80',
  ],
};

export const PORTRAIT_IMAGES = [
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80',
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&q=80',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&q=80',
];

/**
 * Replace broken/fake Unsplash URLs and empty image sources with real contextual images.
 * Catches patterns like photo-1234567890 (sequential digits = fake), empty src, and placeholder.com.
 */
function repairBrokenImageUrls(code: string): string {
  let imgIndex = 0;
  const fallbackImages = CONTEXTUAL_IMAGES.default;

  // Fix fake Unsplash URLs (sequential digits like photo-1234567890)
  code = code.replace(
    /https:\/\/images\.unsplash\.com\/photo-(\d{10,})\?[^"'\s)]+/g,
    (match, photoId) => {
      // Check if digits are sequential (fake) — e.g. 1234567890
      const isSequential = /^0?1234/.test(photoId) || /^(\d)\1+$/.test(photoId);
      if (isSequential) {
        const replacement = fallbackImages[imgIndex % fallbackImages.length];
        imgIndex++;
        return replacement;
      }
      return match;
    }
  );

  // Fix placeholder.com URLs
  code = code.replace(
    /https?:\/\/(?:via\.)?placeholder\.com\/[^"'\s)]+/g,
    () => {
      const replacement = fallbackImages[imgIndex % fallbackImages.length];
      imgIndex++;
      return replacement;
    }
  );

  // Fix empty src attributes
  code = code.replace(/src=["']\s*["']/g, () => {
    const replacement = fallbackImages[imgIndex % fallbackImages.length];
    imgIndex++;
    return `src="${replacement}"`;
  });

  // Fix avatar/portrait placeholder URLs (small images in testimonials)
  code = code.replace(
    /src=["'](https?:\/\/(?:randomuser|i\.pravatar|ui-avatars)[^"']*?)["']/g,
    () => {
      const replacement = PORTRAIT_IMAGES[imgIndex % PORTRAIT_IMAGES.length];
      imgIndex++;
      return `src="${replacement}"`;
    }
  );

  return code;
}

/**
 * Parse an HSL CSS variable value like "222.2 84% 4.9%" and return the lightness as a number.
 */
function extractLightness(hslValue: string): number | null {
  const match = hslValue.match(/[\d.]+\s+[\d.]+%\s+([\d.]+)%/);
  return match ? parseFloat(match[1]) : null;
}

/**
 * Enforce minimum contrast between background/foreground pairs in CSS custom properties.
 * If both bg and fg have similar lightness, fix the foreground to guarantee visibility.
 */
function enforceContrastInCSS(css: string): string {
  // SNAPSHOT CHAIN-OF-CUSTODY: CSS produced by buildThemedIndexCss(preset)
  // carries the `WIZARD THEME:` marker and is the canonical pipeline's
  // authoritative output (Stage 4b). Wizard presets intentionally sit at
  // mid-lightness primaries (~55-65%) with white foregrounds (Δ≈35-40) — a
  // naive lightness-delta contrast check below mis-inverts those foregrounds
  // to near-black and collapses the entire generated site to a "default" look.
  // The snapshot is trusted; do not post-process it.
  if (/(?:WIZARD THEME|AESTHETIC):.*(?:Stage 4b HSL token injection|wizard token injection)/i.test(css)) {
    return css;
  }
  const pairs = [
    ['--background', '--foreground'],
    ['--card', '--card-foreground'],
    ['--primary', '--primary-foreground'],
    ['--secondary', '--secondary-foreground'],
    ['--muted', '--muted-foreground'],
    ['--accent', '--accent-foreground'],
    ['--popover', '--popover-foreground'],
    ['--destructive', '--destructive-foreground'],
  ];


  // Extract all CSS variable values
  const varValues: Record<string, string> = {};
  const varRegex = /(--[\w-]+)\s*:\s*([\d.]+\s+[\d.]+%\s+[\d.]+%)/g;
  let m;
  while ((m = varRegex.exec(css)) !== null) {
    varValues[m[1]] = m[2];
  }

  for (const [bgVar, fgVar] of pairs) {
    const bgVal = varValues[bgVar];
    const fgVal = varValues[fgVar];
    if (!bgVal || !fgVal) continue;

    const bgL = extractLightness(bgVal);
    const fgL = extractLightness(fgVal);
    if (bgL === null || fgL === null) continue;

    const contrast = Math.abs(bgL - fgL);
    if (contrast < 40) {
      // Insufficient contrast — fix the foreground
      const newFgL = bgL < 50 ? '98%' : '4.9%';
      const fgParts = fgVal.match(/([\d.]+)\s+([\d.]+%)\s+[\d.]+%/);
      if (fgParts) {
        const newFgVal = `${fgParts[1]} ${fgParts[2]} ${newFgL}`;
        css = css.replace(
          new RegExp(`(${fgVar.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:\\s*)${fgVal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
          `$1${newFgVal}`
        );
        console.warn(`[contrast-fix] ${fgVar}: ${fgVal} → ${newFgVal} (bg lightness: ${bgL}%)`);
      }
    }
  }

  return css;
}

/**
 * Detect if content is raw CSS (not valid JSX/TSX).
 * Returns true if the content looks like a stylesheet rather than a React component.
 */
function isRawCss(content: string): boolean {
  const trimmed = content.trim();
  // Must NOT have React indicators
  if (/\b(import\s+|export\s+(default\s+)?|function\s+\w+|const\s+\w+\s*=|class\s+\w+)/.test(trimmed)) {
    return false;
  }
  // Must have CSS indicators
  return /^(\s*(@import|@font-face|@media|@keyframes|@tailwind|:root|html|body|\*|\.[\w-]|#[\w-])\s*[{(])/m.test(trimmed);
}

function injectPreviewNavBridge(code: string, filePath: string): string {
  // Only inject into /index.tsx or /index.jsx (the canonical Sandpack entry)
  if (!/^\/index\.(?:tsx?|jsx?)$/.test(filePath)) return code;
  if (code.includes('__initUnisonPreviewNavBridge')) return code;

  const bridges = `${PREVIEW_NAV_BRIDGE}\n__initUnisonPreviewNavBridge();\n\n${PREVIEW_SELECTION_BRIDGE}\n__initUnisonPreviewSelectionBridge();`;

  const importBlock = code.match(/^(?:import[^\n]*\n)+/);
  if (importBlock) {
    return `${importBlock[0]}\n${bridges}\n\n${code.slice(importBlock[0].length)}`;
  }

  return `${bridges}\n\n${code}`;
}

function getFileDirectory(filePath: string): string {
  const normalized = filePath.startsWith('/') ? filePath : `/${filePath}`;
  const lastSlash = normalized.lastIndexOf('/');
  return lastSlash <= 0 ? '/' : normalized.slice(0, lastSlash);
}

function toRelativeSandpackImport(fromFilePath: string, targetPath: string): string {
  const fromParts = getFileDirectory(fromFilePath).split('/').filter(Boolean);
  const targetParts = targetPath.replace(/^\//, '').split('/').filter(Boolean);

  let shared = 0;
  while (
    shared < fromParts.length &&
    shared < targetParts.length &&
    fromParts[shared] === targetParts[shared]
  ) {
    shared += 1;
  }

  const upLevels = fromParts.length - shared;
  const downParts = targetParts.slice(shared);
  const relativeParts = [...Array(upLevels).fill('..'), ...downParts];
  const relativePath = relativeParts.join('/');

  return relativePath.startsWith('.') ? relativePath : `./${relativePath}`;
}

function aliasModuleToRelativeImport(fromFilePath: string, aliasModulePath: string): string {
  const normalizedModulePath = aliasModulePath.replace(/^@\//, '');
  return toRelativeSandpackImport(fromFilePath, `/${normalizedModulePath}`);
}

function resolveUiShimDefaultImportName(modulePath: string, localName?: string): string {
  const moduleBasename = modulePath
    .split('/')
    .filter(Boolean)
    .pop()
    ?.replace(/\.(tsx?|jsx?)$/, '') ?? '';

  const uiExportMap: Record<string, string> = {
    'accordion': 'Accordion',
    'aspect-ratio': 'AspectRatio',
    'avatar': 'Avatar',
    'badge': 'Badge',
    'breadcrumb': 'Breadcrumb',
    'button': 'Button',
    'calendar': 'Calendar',
    'card': 'Card',
    'carousel': 'Carousel',
    'checkbox': 'Checkbox',
    'collapsible': 'Collapsible',
    'command': 'Command',
    'dialog': 'Dialog',
    'dropdown-menu': 'DropdownMenu',
    'form': 'Form',
    'hover-card': 'HoverCard',
    'input': 'Input',
    'label': 'Label',
    'navigation-menu': 'NavigationMenu',
    'popover': 'Popover',
    'progress': 'Progress',
    'radio-group': 'RadioGroup',
    'scroll-area': 'ScrollArea',
    'select': 'Select',
    'separator': 'Separator',
    'sheet': 'Sheet',
    'skeleton': 'Skeleton',
    'switch': 'Switch',
    'table': 'Table',
    'tabs': 'Tabs',
    'textarea': 'Textarea',
    'tooltip': 'Tooltip',
  };

  if (uiExportMap[moduleBasename]) return uiExportMap[moduleBasename];
  if (localName && /^[A-Z]/.test(localName)) return localName;

  const inferredName = moduleBasename
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');

  return inferredName || 'Button';
}

function formatNamedImport(exportName: string, localName?: string): string {
  if (!localName || exportName === localName) return exportName;
  return `${exportName} as ${localName}`;
}

/**
 * Wrap raw CSS content in a valid React component so Sandpack can render it.
 * Uses JSON.stringify to safely embed CSS as a string constant (avoids template literal parsing issues).
 */
function wrapCssInReactComponent(css: string): string {
  const cssJsonStr = JSON.stringify(css);
  return `import React from 'react';

const CSS_CONTENT = ${cssJsonStr};

export default function App() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS_CONTENT }} />
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Styles applied. Add HTML content to see the design.</p>
      </div>
    </>
  );
}
`;
}

function toPascalCaseIdentifier(filePath: string): string {
  const basename = filePath
    .split('/')
    .filter(Boolean)
    .pop()
    ?.replace(/\.(tsx|jsx|ts|js)$/, '') ?? 'App';

  return basename
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('') || 'App';
}

function findBestComponentExportName(content: string, filePath: string): string | null {
  if (/export\s+default\b/.test(content) || /export\s*\{[^}]*\bas\s+default\b[^}]*\}/.test(content)) {
    return null;
  }

  const candidates: string[] = [];
  const seen = new Set<string>();
  const pushCandidate = (name: string) => {
    if (!/^[A-Z][A-Za-z0-9_]*$/.test(name) || seen.has(name)) return;
    seen.add(name);
    candidates.push(name);
  };

  for (const match of content.matchAll(/export\s+(?:async\s+)?function\s+([A-Z][A-Za-z0-9_]*)/g)) {
    pushCandidate(match[1]);
  }
  for (const match of content.matchAll(/export\s+(?:const|let|var|class)\s+([A-Z][A-Za-z0-9_]*)/g)) {
    pushCandidate(match[1]);
  }
  for (const match of content.matchAll(/(?:const|let|var|function|class)\s+([A-Z][A-Za-z0-9_]*)/g)) {
    pushCandidate(match[1]);
  }

  for (const match of content.matchAll(/export\s*\{([^}]+)\}/g)) {
    const specifiers = match[1].split(',');
    for (const specifier of specifiers) {
      const [localName] = specifier.trim().split(/\s+as\s+/i);
      if (localName) pushCandidate(localName.trim());
    }
  }

  const preferred = toPascalCaseIdentifier(filePath);
  if (seen.has(preferred)) return preferred;
  if (seen.has('App')) return 'App';
  return candidates[0] || null;
}

function ensureDefaultExportForReactModule(content: string, filePath: string): string {
  if (!/\.(tsx|jsx)$/.test(filePath) || /\/(?:src\/)?unison\/ui\//.test(filePath)) return content;
  if (/export\s+default\b/.test(content) || /export\s*\{[^}]*\bas\s+default\b[^}]*\}/.test(content)) {
    return content;
  }

  const exportName = findBestComponentExportName(content, filePath);
  if (!exportName) return content;

  return `${content}\nexport default ${exportName};\n`;
}

/**
 * Inject `useState` declarations for common boolean toggle identifiers the AI
 * frequently references (mobile menus, modals, accordions) without declaring.
 * Without this repair the preview throws "isMenuOpen is not defined" at runtime.
 *
 * For each detected pair `<name>` + `set<Name>`, we:
 *   1. Ensure `useState` is imported from react
 *   2. Inject `const [name, setName] = React.useState(false);` at the top of
 *      the first component function body that references it.
 */
function injectMissingToggleState(content: string, filePath: string): string {
  if (!/\.(tsx|jsx)$/.test(filePath)) return content;

  // Common AI-emitted toggle pairs. Keep names ASCII; setter is capitalized.
  const PAIRS: Array<{ getter: string; setter: string }> = [
    { getter: 'isMenuOpen', setter: 'setIsMenuOpen' },
    { getter: 'isMobileMenuOpen', setter: 'setIsMobileMenuOpen' },
    { getter: 'isOpen', setter: 'setIsOpen' },
    { getter: 'menuOpen', setter: 'setMenuOpen' },
    { getter: 'mobileMenuOpen', setter: 'setMobileMenuOpen' },
    { getter: 'isDrawerOpen', setter: 'setIsDrawerOpen' },
    { getter: 'isModalOpen', setter: 'setIsModalOpen' },
  ];

  const declaredRe = (name: string) =>
    new RegExp(`\\b(const|let|var)\\s+\\[\\s*${name}\\b|\\b(const|let|var)\\s+${name}\\b|\\bfunction\\s+${name}\\b`);

  const missing = PAIRS.filter(({ getter, setter }) => {
    const usesGetter = new RegExp(`\\b${getter}\\b`).test(content);
    const usesSetter = new RegExp(`\\b${setter}\\b`).test(content);
    if (!usesGetter && !usesSetter) return false;
    return !declaredRe(getter).test(content) && !declaredRe(setter).test(content);
  });

  if (missing.length === 0) return content;

  let next = content;

  // Ensure React import exists (we use React.useState to avoid clobbering existing imports).
  if (!/from\s+['"]react['"]/.test(next)) {
    next = `import React from 'react';\n${next}`;
  }

  // Find the first function/arrow component body and inject declarations there.
  const fnMatch =
    next.match(/(function\s+[A-Z][A-Za-z0-9_]*\s*\([^)]*\)\s*\{)/) ||
    next.match(/(const\s+[A-Z][A-Za-z0-9_]*\s*=\s*(?:\([^)]*\)|[A-Za-z_][A-Za-z0-9_]*)\s*=>\s*\{)/);

  const declarations = missing
    .map(({ getter, setter }) => `  const [${getter}, ${setter}] = React.useState(false);`)
    .join('\n');

  if (fnMatch && fnMatch.index !== undefined) {
    const insertAt = fnMatch.index + fnMatch[0].length;
    next = next.slice(0, insertAt) + `\n${declarations}\n` + next.slice(insertAt);
    return next;
  }

  // Pattern: `const Name = ( <jsx/> );` — JSX assigned to const at module
  // scope. Hooks cannot run at module scope, so wrap into a function component.
  const jsxConstMatch = next.match(/const\s+([A-Z][A-Za-z0-9_]*)\s*=\s*(\(\s*<|<)/);
  if (jsxConstMatch && jsxConstMatch.index !== undefined) {
    const compName = jsxConstMatch[1];
    next = next.replace(
      new RegExp(`const\\s+${compName}\\s*=\\s*`),
      `function ${compName}() {\n${declarations}\n  return `,
    );
    const exportRe = new RegExp(`(\\n\\s*export\\s+default\\s+${compName}\\b)`);
    if (exportRe.test(next)) {
      next = next.replace(exportRe, '\n}$1');
    } else {
      next = `${next}\n}\n`;
    }
    return next;
  }

  // Do NOT inject module-level hooks — that throws at module init and blanks
  // the section. Leave a comment marker instead.
  next = `${next}\n// [sandpack] missing toggle state for: ${missing.map((m) => m.getter).join(', ')}\n`;
  return next;
}

function createProxyApp(targetPath: string): string {
  const importPath = toRelativeSandpackImport('/App.tsx', targetPath).replace(/\.(tsx?|jsx?)$/, '');

  return `import React from 'react';
import * as PreviewEntryModule from '${importPath}';

// Robust component discovery: prefer default export, then find first PascalCase function/class component
function findRenderableComponent(mod) {
  if (mod.default && (typeof mod.default === 'function' || (typeof mod.default === 'object' && mod.default.$$typeof))) {
    return mod.default;
  }
  for (const [key, value] of Object.entries(mod)) {
    if (key === '__esModule' || key === 'default') continue;
    if (/^[A-Z]/.test(key) && (typeof value === 'function' || (typeof value === 'object' && value !== null && value.$$typeof))) {
      return value;
    }
  }
  return null;
}

const PreviewEntry = findRenderableComponent(PreviewEntryModule);

// Error boundary to catch render errors from PreviewEntry
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error('[Sandpack Preview] Component render error:', error);
    console.error('[Sandpack Preview] Error details:', errorInfo?.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return React.createElement('div', {
        style: { display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui', backgroundColor: '#f5f5f5' }
      }, React.createElement('div', {
        style: { textAlign: 'center', maxWidth: 600, padding: 32, backgroundColor: 'white', borderRadius: 8, border: '1px solid #e5e5e5', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }
      }, React.createElement('div', { style: { fontSize: 32, marginBottom: 12 } }, '⚠️'), React.createElement('h2', { style: { fontSize: 18, marginBottom: 8, color: '#d32f2f', fontWeight: 500 } }, 'Component Render Error'), React.createElement('p', { style: { color: '#888', fontSize: 14, marginBottom: 16, lineHeight: '1.5' } }, 'An error occurred while rendering the preview component. Check the browser console for details.'), React.createElement('div', { style: { backgroundColor: '#f5f5f5', padding: 12, borderRadius: 4, textAlign: 'left', fontSize: 12, color: '#666', fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 200, overflow: 'auto', marginBottom: 12 } }, React.createElement('div', { style: { fontWeight: 'bold', color: '#333', marginBottom: 4 } }, 'Error:'), this.state.error?.toString(), this.state.errorInfo && React.createElement(React.Fragment, null, React.createElement('div', { style: { fontWeight: 'bold', color: '#333', marginTop: 12, marginBottom: 4 } }, 'Stack:'), this.state.errorInfo.componentStack)), React.createElement('div', { style: { backgroundColor: '#f9f9f9', padding: 12, borderRadius: 4, textAlign: 'left', fontSize: 11, color: '#666', border: '1px solid #eee' } }, React.createElement('div', { style: { fontWeight: 'bold', color: '#333', marginBottom: 6 } }, 'Debugging Tips:'), React.createElement('ul', { style: { margin: 0, paddingLeft: 20 } }, React.createElement('li', null, 'Check the browser console (F12) for detailed error messages'), React.createElement('li', null, 'Verify all imported components exist and export a valid React component'), React.createElement('li', null, "Ensure components use 'export default' or named PascalCase exports"), React.createElement('li', null, 'Source: ${targetPath}')))));
    }

    return this.props.children;
  }
}

export default function App() {
  if (!PreviewEntry) {
    return React.createElement('div', {
      style: { display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui' }
    }, React.createElement('div', {
      style: { textAlign: 'center', maxWidth: 420, padding: 32 }
    }, React.createElement('h2', { style: { fontSize: 18, marginBottom: 8 } }, 'No renderable component found'), React.createElement('p', { style: { color: '#888', fontSize: 14 } }, 'The entry file does not export a valid React component. Check that your component uses "export default" or a named PascalCase export.'), React.createElement('p', { style: { color: '#aaa', fontSize: 12, marginTop: 12 } }, 'Source: ${targetPath}')));
  }

  return React.createElement(ErrorBoundary, null, React.createElement(PreviewEntry));
}
`;
}

// createMissingEntryApp() was intentionally removed. Wizard/launcher-generated
// sites must never be replaced with a diagnostic fallback template — if the
// preview cannot render the AI output, surface the real runtime error from
// DEFAULT_INDEX instead of substituting a placeholder.


// ── Built-in HTML/React elements that should NOT be treated as custom components ──
const BUILTIN_JSX_ELEMENTS = new Set([
  'React', 'Fragment', 'Suspense', 'StrictMode',
  // Common variable names that look PascalCase but aren't components
  'Array', 'Object', 'String', 'Number', 'Boolean', 'Date', 'Map', 'Set', 'Promise',
  'Error', 'JSON', 'Math', 'RegExp', 'Symbol', 'Proxy', 'Reflect',
  // DOM and React type names can appear in TSX generics such as
  // `querySelectorAll<HTMLElement>()`; they are never JSX components.
  'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'KeyboardEvent',
  'PointerEvent', 'ChangeEvent', 'FormEvent', 'ReactNode', 'ReactElement',
  'CSSProperties', 'SVGElement', 'SVGSVGElement', 'HTMLDivElement',
  'HTMLButtonElement', 'HTMLInputElement', 'HTMLAnchorElement', 'HTMLFormElement',
  'HTMLImageElement', 'HTMLTextAreaElement', 'HTMLSelectElement',
  'HTMLLabelElement', 'HTMLSpanElement', 'HTMLParagraphElement', 'HTMLHeadingElement',
  // Component from error boundary / React internals
  'Component', 'PureComponent',
]);

/**
 * Remove unused imports from a source file.
 * Detects named imports that are never referenced in the rest of the file body.
 */
function removeUnusedImports(source: string): string {
  if (!source) return source;

  // Split into lines for import detection
  return source.replace(
    /^import\s+\{([^}]+)\}\s+from\s+['"][^'"]+['"]\s*;?\s*$/gm,
    (fullMatch, namedGroup: string) => {
      const names = namedGroup.split(',').map((n: string) => n.trim()).filter(Boolean);
      // Resolve alias: "Foo as Bar" → check usage of "Bar"
      const usedNames = names.filter((n: string) => {
        const alias = n.includes(' as ') ? n.split(' as ')[1].trim() : n.trim();
        // Check if alias appears in the rest of the source (outside import statements)
        const bodyWithoutImports = source.replace(/^import\s+.*$/gm, '');
        // Must appear as identifier (word boundary), not just substring
        const regex = new RegExp(`\\b${escapeRegExp(alias)}\\b`);
        return regex.test(bodyWithoutImports);
      });

      if (usedNames.length === 0) return ''; // Remove entire import
      if (usedNames.length === names.length) return fullMatch; // All used

      // Reconstruct with only used names
      return fullMatch.replace(`{${namedGroup}}`, `{ ${usedNames.join(', ')} }`);
    }
  );
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Detect and rewrite self-referencing relative imports.
 *
 * A common failure mode: AI generates `/src/pages/Services.tsx` that does
 * `import Services from './Services'` (or `import { Services } from './Services'`)
 * intending to pull the section component from `/src/components/Services.tsx`.
 * The relative path actually resolves to the page file itself, producing a
 * self-referential module whose named export is undefined at eval time and
 * React throws "Element type is invalid ... Check the render method of Services".
 *
 * Fix: for any relative import whose resolved target equals the current file,
 * rewrite the specifier to point at `/components/<Name>` when that file exists.
 * Otherwise drop the offending import so downstream synthesis inserts a
 * placeholder rather than crashing render.
 */
function rewriteSelfReferencingImports(sandpackFiles: Record<string, string>): void {
  const existingPaths = new Set(Object.keys(sandpackFiles));
  // Match only an import binding list. A side-effect CSS import must never
  // send this pass searching through the page body for a later `from`.
  // The previous unrestricted scan backtracked quadratically over whitespace.
  const importRegex = /^([ \t]*import\s+(?:type\s+)?(?:[\w$]+\s*,\s*)?(?:\{[^{};'"`]*\}|\*\s+as\s+[\w$]+|[\w$]+)\s+from\s+['"])(\.\.?\/[^'"\r\n]+)(['"];?)/gm;

  for (const [filePath, content] of Object.entries({ ...sandpackFiles })) {
    if (!/\.(tsx?|jsx?)$/.test(filePath)) continue;
    let changed = false;
    const next = content.replace(importRegex, (stmt, prefix: string, rawPath: string, suffix: string) => {
      const resolved = resolveRelativeModuleTarget(filePath, rawPath, existingPaths);
      if (!resolved || resolved !== filePath) return stmt;

      const baseName = (rawPath.split('/').pop() || '').replace(/\.\w+$/, '');
      const componentCandidates = [
        `/src/components/${baseName}.tsx`,
        `/src/components/${baseName}.jsx`,
        `/components/${baseName}.tsx`,
        `/components/${baseName}.jsx`,
      ];
      const redirectTarget = componentCandidates.find((p) => existingPaths.has(p));
      if (redirectTarget) {
        const dir = filePath.substring(0, filePath.lastIndexOf('/')) || '/';
        const targetNoExt = redirectTarget.replace(/\.\w+$/, '');
        const rel = toRelativeFromDir(dir, targetNoExt);
        console.warn(
          `[sandpackFilePrep] Rewriting self-import in ${filePath}: '${rawPath}' → '${rel}' (was pointing at ${resolved})`,
        );
        changed = true;
        return `${prefix}${rel}${suffix}`;
      }

      console.warn(
        `[sandpackFilePrep] Dropping self-referencing import in ${filePath}: '${rawPath}'`,
      );
      changed = true;
      return `// [sandpackFilePrep] dropped self-import: ${stmt.trim().replace(/\s+/g, ' ')}`;
    });
    if (changed) sandpackFiles[filePath] = next;
  }
}

function toRelativeFromDir(fromDir: string, toPath: string): string {
  const fromParts = fromDir.replace(/\/+$/, '').split('/').filter(Boolean);
  const toParts = toPath.split('/').filter(Boolean);
  let i = 0;
  while (i < fromParts.length && i < toParts.length && fromParts[i] === toParts[i]) i++;
  const up = fromParts.slice(i).map(() => '..');
  const down = toParts.slice(i);
  const rel = [...up, ...down].join('/');
  return rel.startsWith('.') ? rel : `./${rel}`;
}

/**
 * Scan JSX in all files for PascalCase component usage (e.g. `<Gallery />`)
 * that has NO corresponding import statement. For each missing component,
 * inject a relative import pointing to `./components/ComponentName`.
 * Imports are only normalized here; unresolved modules must be authored by the
 * AI (Lane B) — no template/chip component is ever synthesized in their place.
 */
function autoInjectMissingJsxImports(sandpackFiles: Record<string, string>): void {
  const existingPaths = new Set(Object.keys(sandpackFiles));

  for (const [filePath, content] of Object.entries({ ...sandpackFiles })) {
    if (!/\.(tsx|jsx)$/.test(filePath)) continue;

    if (/\/(?:src\/)?unison\/ui\//.test(filePath)) continue;

    // Extract all PascalCase component names used in JSX: <ComponentName or <ComponentName>
    const jsxUsages = new Set<string>();
    const jsxPattern = /<([A-Z][A-Za-z0-9]+)[\s/>]/g;
    let m;
    while ((m = jsxPattern.exec(content)) !== null) {
      const name = m[1];
      // TypeScript generics such as React.TextareaHTMLAttributes<HTMLTextAreaElement>
      // contain the same `<PascalCase>` token shape as JSX. DOM element types are
      // never renderable components and must not produce synthesized imports.
      if (!BUILTIN_JSX_ELEMENTS.has(name) && !/^HTML[A-Z][A-Za-z0-9]*Element$/.test(name)) {
        jsxUsages.add(name);
      }
    }

    if (jsxUsages.size === 0) continue;

    // Find all currently imported names in this file
    const importedNames = new Set<string>();
    const importNamePattern = /import\s+(?:(\w+)\s*,?\s*)?(?:\{([^}]*)\})?\s*from/g;
    let im;
    while ((im = importNamePattern.exec(content)) !== null) {
      if (im[1]) importedNames.add(im[1]);
      if (im[2]) {
        im[2].split(',').forEach(n => {
          const cleaned = n.trim().split(/\s+as\s+/).pop()?.trim();
          if (cleaned) importedNames.add(cleaned);
        });
      }
    }

    // Also check for local function/const/class declarations
    const localDeclPattern = /(?:function|const|class|let|var|interface|type)\s+([A-Z]\w*)/g;
    let ld;
    while ((ld = localDeclPattern.exec(content)) !== null) {
      importedNames.add(ld[1]);
    }

    // Dynamic components are often received through a destructured prop alias,
    // for example `function Icon({ icon: Glyph }) { return <Glyph />; }`.
    // `Glyph` is a local binding, not a module that needs an inferred import.
    const destructuredAliasPattern = /\b[A-Za-z_$][\w$]*\s*:\s*([A-Z]\w*)\s*(?=[,}])/g;
    let alias;
    while ((alias = destructuredAliasPattern.exec(content)) !== null) {
      importedNames.add(alias[1]);
    }

    // Find missing components
    const missing: string[] = [];
    for (const name of jsxUsages) {
      if (importedNames.has(name)) continue;
      missing.push(name);
    }

    if (missing.length === 0) continue;

    // Inject import statements for missing components
    const imports = missing.map(name => {
      // Check if the component file already exists somewhere in the VFS
      const possiblePaths = [
        `/components/${name}.tsx`, `/${name}.tsx`,
        `/components/${name}.jsx`, `/${name}.jsx`,
        `/pages/${name}.tsx`, `/pages/${name}.jsx`,
      ];
      const existing = possiblePaths.find(p => existingPaths.has(p));
      const importPath = existing
        ? toRelativeSandpackImport(filePath, existing.replace(/\.(tsx|jsx)$/, ''))
        : `./components/${name}`;
      return `import ${name} from '${importPath}';`;
    }).join('\n');

    // Insert imports after the last existing import line
    const lines = content.split('\n');
    let lastImportIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*import\s/.test(lines[i])) lastImportIdx = i;
    }

    if (lastImportIdx >= 0) {
      lines.splice(lastImportIdx + 1, 0, imports);
    } else {
      // No imports at all — prepend
      lines.unshift(imports);
    }

    sandpackFiles[filePath] = lines.join('\n');
    console.log(`[sandpackFilePrep] Auto-injected imports for ${missing.join(', ')} in ${filePath}`);
  }
}

function resolveRelativeModuleTarget(
  filePath: string,
  rawImportPath: string,
  existingPaths: Set<string>,
): string | null {
  const extensions = ['.tsx', '.jsx', '.ts', '.js'];
  const dir = filePath.substring(0, filePath.lastIndexOf('/')) || '/';
  let resolved = rawImportPath.startsWith('/')
    ? rawImportPath
    : `${dir}/${rawImportPath}`.replace(/\/\.\//g, '/');

  const parts = resolved.split('/');
  const stack: string[] = [];
  for (const part of parts) {
    if (part === '..') stack.pop();
    else if (part !== '.' && part !== '') stack.push(part);
  }

  resolved = '/' + stack.join('/');
  const candidates = /\.\w+$/.test(resolved)
    ? [resolved]
    : [
        resolved,
        ...extensions.map((ext) => `${resolved}${ext}`),
        ...extensions.map((ext) => `${resolved}/index${ext}`),
      ];

  return candidates.find((candidate) => existingPaths.has(candidate)) || null;
}

function inspectModuleExports(content: string): {
  hasDefault: boolean;
  named: Set<string>;
  primaryName: string | null;
  hasStarReExport: boolean;
} {
  const key = moduleExportsCacheKey(content);
  const cached = moduleExportsCache.get(key);
  if (cached) return cached;
  const result = computeModuleExports(content);
  if (moduleExportsCache.size >= MODULE_EXPORTS_CACHE_LIMIT) moduleExportsCache.clear();
  moduleExportsCache.set(key, result);
  return result;
}

// Import-contract validation re-scans the same shared modules (a components
// barrel imported by every page) on every importer and on every
// prepareSandpackFiles() call in the launch → preview pipeline. Memoizing on
// content makes repeat scans of unchanged files free.
const MODULE_EXPORTS_CACHE_LIMIT = 4000;
const moduleExportsCache = new Map<string, ReturnType<typeof computeModuleExports>>();

function moduleExportsCacheKey(content: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < content.length; i++) {
    h ^= content.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `${content.length}:${(h >>> 0).toString(36)}`;
}

function computeModuleExports(content: string): {
  hasDefault: boolean;
  named: Set<string>;
  primaryName: string | null;
  hasStarReExport: boolean;
} {
  const named = new Set<string>();
  const exportPatterns = [
    /export\s+function\s+([A-Z]\w*)/g,
    /export\s+const\s+([A-Z]\w*)/g,
    /export\s+class\s+([A-Z]\w*)/g,
  ];

  for (const pattern of exportPatterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(content)) !== null) {
      named.add(match[1]);
    }
  }

  const reExportPattern = /export\s*\{([^}]+)\}(?:\s+from\s+['"][^'"]+['"])?/g;
  let reExportMatch: RegExpExecArray | null;
  while ((reExportMatch = reExportPattern.exec(content)) !== null) {
    reExportMatch[1]
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
      .forEach((part) => {
        const [sourceName, aliasName] = part.split(/\s+as\s+/).map((item) => item.trim());
        const exportName = aliasName || sourceName;
        if (/^[A-Z]/.test(exportName)) {
          named.add(exportName);
        }
      });
  }

  const hasDefault = /export\s+default\b/.test(content);
  const hasStarReExport = /export\s*\*\s*(?:as\s+\w+\s*)?from\s+['"][^'"]+['"]/.test(content);
  const primaryName =
    content.match(/export\s+default\s+function\s+([A-Z]\w*)/)?.[1] ||
    content.match(/export\s+default\s+class\s+([A-Z]\w*)/)?.[1] ||
    content.match(/export\s+default\s+([A-Z]\w*)\s*;?/)?.[1] ||
    [...named][0] ||
    null;

  return { hasDefault, named, primaryName, hasStarReExport };
}

function repairLocalImportContracts(sandpackFiles: Record<string, string>): void {
  const existingPaths = new Set(Object.keys(sandpackFiles));

  for (const [filePath, originalContent] of Object.entries({ ...sandpackFiles })) {
    if (!/\.(tsx?|jsx?)$/.test(filePath)) continue;

    const namedImportRegex = /import\s+\{([^}]+)\}\s+from\s+['"](\.\.?\/[^'"]+)['"];?/g;
    const defaultImportRegex = /import\s+([A-Z]\w*)(?:\s*,\s*\{([^}]*)\})?\s+from\s+['"](\.\.?\/[^'"]+)['"];?/g;
    let content = originalContent;

    content = content.replace(namedImportRegex, (statement, specifierBlock: string, rawImportPath: string) => {
      const targetPath = resolveRelativeModuleTarget(filePath, rawImportPath, existingPaths);
      if (!targetPath) return statement;
      const targetContent = sandpackFiles[targetPath];
      if (!targetContent) return statement;

      const moduleExports = inspectModuleExports(targetContent);
      const specifiers = specifierBlock.split(',').map((part) => part.trim()).filter(Boolean).map((part) => {
        const [imported, local] = part.split(/\s+as\s+/).map((value) => value.trim());
        return { imported, local: local || imported };
      });
      const missingPascalExports = specifiers.filter(({ imported, local }) => (
        /^[A-Z]/.test(imported) &&
        !moduleExports.named.has(imported) &&
        new RegExp(`(?<![\\w$.])<${escapeRegExp(local)}(?:\\s|/|>)`).test(content)
      ));

      if (missingPascalExports.length === 0) return statement;

      // Sibling-module resolution: a missing named component is very often
      // exported by a neighbouring module in the same folder (e.g. `Label`
      // living in ./form-fields vs ./label). Re-point just that specifier
      // instead of failing the whole preflight.
      const targetDir = targetPath.slice(0, targetPath.lastIndexOf('/'));
      const rawDir = rawImportPath.slice(0, rawImportPath.lastIndexOf('/'));
      const relocated = new Map<string, string>();
      for (const missing of missingPascalExports) {
        const donor = Object.keys(sandpackFiles).find((candidate) => (
          candidate !== targetPath &&
          candidate.startsWith(`${targetDir}/`) &&
          !candidate.slice(targetDir.length + 1).includes('/') &&
          /\.(tsx?|jsx?)$/.test(candidate) &&
          inspectModuleExports(sandpackFiles[candidate] || '').named.has(missing.imported)
        ));
        if (!donor) continue;
        const donorName = donor.slice(targetDir.length + 1).replace(/\.(tsx?|jsx?)$/, '');
        relocated.set(missing.imported, rawDir ? `${rawDir}/${donorName}` : `./${donorName}`);
      }

      if (relocated.size > 0) {
        const kept = specifiers.filter(({ imported }) => !relocated.has(imported));
        const lines: string[] = [];
        if (kept.length > 0) {
          lines.push(`import { ${kept.map(({ imported, local }) => imported === local ? imported : `${imported} as ${local}`).join(', ')} } from '${rawImportPath}';`);
        }
        const byModule = new Map<string, string[]>();
        for (const { imported, local } of specifiers) {
          const moved = relocated.get(imported);
          if (!moved) continue;
          const spec = imported === local ? imported : `${imported} as ${local}`;
          byModule.set(moved, [...(byModule.get(moved) || []), spec]);
        }
        for (const [modulePath, specs] of byModule) {
          console.warn(`[sandpackFilePrep] Re-pointing missing named import in ${filePath}: ${specs.join(', ')} -> ${modulePath}`);
          lines.push(`import { ${specs.join(', ')} } from '${modulePath}';`);
        }
        return lines.join('\n');
      }

      // An external export-star does not prove a local component exists. For
      // example animation re-exports Framer Motion, but Reveal is owned by the
      // sibling motion facade. Try declared sibling exports before deferring
      // genuinely external names to the package runtime.
      if (moduleExports.hasStarReExport) return statement;

      if (moduleExports.hasDefault && missingPascalExports.length === 1) {
        const missing = missingPascalExports[0];
        const remaining = specifiers.filter((item) => item !== missing);
        const namedLine = remaining.length > 0
          ? `\nimport { ${remaining.map(({ imported, local }) => imported === local ? imported : `${imported} as ${local}`).join(', ')} } from '${rawImportPath}';`
          : '';
        console.warn(`[sandpackFilePrep] Rewriting named import to default import in ${filePath}: ${missing.imported} -> ${missing.local}`);
        return `import ${missing.local} from '${rawImportPath}';${namedLine}`;
      }

      if (!moduleExports.hasDefault && moduleExports.named.size === 1 && missingPascalExports.length === 1) {
        const [actual] = [...moduleExports.named];
        const missing = missingPascalExports[0];
        const rewritten = specifiers.map(({ imported, local }) => {
          if (imported !== missing.imported) return imported === local ? imported : `${imported} as ${local}`;
          return actual === local ? actual : `${actual} as ${local}`;
        });
        console.warn(`[sandpackFilePrep] Rewriting incompatible named import in ${filePath}: ${missing.imported} -> ${actual} as ${missing.local}`);
        return `import { ${rewritten.join(', ')} } from '${rawImportPath}';`;
      }

      return statement;
    });

    content = content.replace(defaultImportRegex, (statement, localName: string, namedBlock: string | undefined, rawImportPath: string) => {
      const targetPath = resolveRelativeModuleTarget(filePath, rawImportPath, existingPaths);
      if (!targetPath) return statement;
      const targetContent = sandpackFiles[targetPath];
      if (!targetContent) return statement;
      const moduleExports = inspectModuleExports(targetContent);
      if (moduleExports.hasDefault || moduleExports.hasStarReExport) return statement;

      const fallback = moduleExports.named.has(localName)
        ? localName
        : moduleExports.named.size === 1
          ? [...moduleExports.named][0]
          : null;
      if (!fallback) return statement;

      const existingNamed = (namedBlock || '').split(',').map((part) => part.trim()).filter(Boolean);
      const defaultAsNamed = fallback === localName ? fallback : `${fallback} as ${localName}`;
      console.warn(`[sandpackFilePrep] Rewriting default import to named import in ${filePath}: ${localName} -> ${fallback}`);
      return `import { ${[defaultAsNamed, ...existingNamed].join(', ')} } from '${rawImportPath}';`;
    });

    if (content !== originalContent) sandpackFiles[filePath] = content;
  }
}

function assertLocalJsxImportContracts(sandpackFiles: Record<string, string>): void {
  const existingPaths = new Set(Object.keys(sandpackFiles));
  const violations: Array<{ filePath: string; message: string }> = [];

  for (const [filePath, content] of Object.entries(sandpackFiles)) {
    if (!/\.(tsx|jsx)$/.test(filePath)) continue;

    // `[^}]` (not `[\s\S]`) keeps the named block inside a single import
    // statement — otherwise a package import (`{ Float } from '@react-three/drei'`)
    // pairs with the NEXT relative import and reports a phantom violation.
    const namedImportRegex = /import\s+(?:[A-Z]\w*\s*,\s*)?\{([^}]*)\}\s+from\s+['"](\.\.?\/[^'"]+)['"];?/g;
    let namedMatch: RegExpExecArray | null;
    while ((namedMatch = namedImportRegex.exec(content)) !== null) {
      const targetPath = resolveRelativeModuleTarget(filePath, namedMatch[2], existingPaths);
      if (!targetPath) continue;
      const moduleExports = inspectModuleExports(sandpackFiles[targetPath] || '');
      if (moduleExports.hasStarReExport) continue;

      for (const part of namedMatch[1].split(',').map((item) => item.trim()).filter(Boolean)) {
        const [imported, localAlias] = part.split(/\s+as\s+/).map((item) => item.trim());
        const local = localAlias || imported;
        if (
          /^[A-Z]/.test(imported) &&
          new RegExp(`(?<![\\w$.])<${escapeRegExp(local)}(?:\\s|/|>)`).test(content) &&
          !moduleExports.named.has(imported)
        ) {
          const available = [...moduleExports.named].join(', ') || (moduleExports.hasDefault ? 'default' : 'none');
          violations.push({
            filePath,
            message: `${filePath} imports JSX component "${imported}" from "${namedMatch[2]}", but ${targetPath} does not export it (available: ${available}).`,
          });
        }
      }
    }

    const defaultImportRegex = /import\s+([A-Z]\w*)(?:\s*,\s*\{[^}]*\})?\s+from\s+['"](\.\.?\/[^'"]+)['"];?/g;
    let defaultMatch: RegExpExecArray | null;
    while ((defaultMatch = defaultImportRegex.exec(content)) !== null) {
      const local = defaultMatch[1];
      if (!new RegExp(`(?<![\\w$.])<${escapeRegExp(local)}(?:\\s|/|>)`).test(content)) continue;
      const targetPath = resolveRelativeModuleTarget(filePath, defaultMatch[2], existingPaths);
      if (!targetPath) continue;
      const moduleExports = inspectModuleExports(sandpackFiles[targetPath] || '');
      if (!moduleExports.hasDefault && !moduleExports.hasStarReExport) {
        const available = [...moduleExports.named].join(', ') || 'none';
        violations.push({
          filePath,
          message: `${filePath} default-imports JSX component "${local}" from "${defaultMatch[2]}", but ${targetPath} has no default export (named exports: ${available}).`,
        });
      }
    }
  }

  if (violations.length > 0) {
    throw new PreviewPipelineError(
      'prep',
      `VFS JSX import/export incompatibility: ${violations.map(({ message }) => message).join(' ')}`,
      { blockedFiles: [...new Set(violations.map(({ filePath }) => filePath))] },
    );
  }
}

function buildCanonicalThemeModule(themePresetId?: string | null): string | null {
  const preset = themePresetId
    ? THEME_PRESETS.find((candidate) => candidate.id === themePresetId)
    : null;
  if (!preset) return null;

  const theme = JSON.stringify(themePresetToThemeTokens(preset), null, 2);
  return `// Canonical wizard theme contract, restored during Sandpack preparation.
import type React from 'react';

export const THEME = ${theme} as const;
export const theme = THEME;
export const colors = THEME.colors;
export const typography = THEME.typography;
export const radius = THEME.radius;

export const hsl = (token: string) => \`hsl(\${token})\`;
export const hsla = (token: string, alpha: number) => \`hsla(\${token}, \${alpha})\`;

export const headingStyle: React.CSSProperties = {
  fontFamily: THEME.typography.headingFont,
  fontWeight: THEME.typography.headingWeight as React.CSSProperties['fontWeight'],
  color: hsl(THEME.colors.foreground),
};

export const bodyStyle: React.CSSProperties = {
  fontFamily: THEME.typography.bodyFont,
  fontWeight: THEME.typography.bodyWeight as React.CSSProperties['fontWeight'],
  color: hsl(THEME.colors.mutedForeground),
};

export const containerStyle: React.CSSProperties = {
  maxWidth: THEME.containerWidth,
  margin: '0 auto',
  padding: '0 clamp(1rem, 4vw, 2rem)',
};

export const sectionPad: React.CSSProperties = {
  padding: 'clamp(3rem, 8vw, 6rem) clamp(1rem, 4vw, 2rem)',
};

export const primaryBtnStyle: React.CSSProperties = {
  background: \`linear-gradient(135deg, hsl(\${THEME.colors.primary}), hsl(\${THEME.colors.secondary}))\`,
  color: hsl(THEME.colors.primaryForeground),
  padding: '0.75rem 2rem',
  borderRadius: THEME.radius,
  fontWeight: 600,
  border: 'none',
  cursor: 'pointer',
  fontFamily: THEME.typography.bodyFont,
};

export const outlineBtnStyle: React.CSSProperties = {
  background: 'transparent',
  color: hsl(THEME.colors.foreground),
  padding: '0.75rem 2rem',
  borderRadius: THEME.radius,
  border: \`1px solid \${hsla(THEME.colors.border, 1)}\`,
  cursor: 'pointer',
  fontFamily: THEME.typography.bodyFont,
};

export const cardStyle: React.CSSProperties = {
  background: hsl(THEME.colors.card),
  color: hsl(THEME.colors.cardForeground),
  borderRadius: THEME.radius,
  border: \`1px solid \${hsla(THEME.colors.border, 1)}\`,
  overflow: 'hidden',
};

export default THEME;
`;
}

function buildCanonicalIconModule(): string {
  return `// Canonical icon primitive, restored during Sandpack preparation.
import * as React from 'react';
import * as LucideIcons from 'lucide-react';

export interface IconProps extends Omit<React.SVGProps<SVGSVGElement>, 'name'> {
  name?: string;
  icon?: string;
  size?: number | string;
  fallback?: React.ReactNode;
}

const iconLibrary = LucideIcons as unknown as Record<string, React.ComponentType<React.SVGProps<SVGSVGElement>>>;

const toPascalCase = (value: string) => value
  .trim()
  .replace(/[^a-zA-Z0-9]+(.)/g, (_match, character: string) => character.toUpperCase())
  .replace(/^./, (character) => character.toUpperCase());

export function Icon({ name, icon, size = 20, fallback = null, ...props }: IconProps) {
  const requestedName = icon || name || 'Circle';
  const IconComponent = iconLibrary[requestedName] || iconLibrary[toPascalCase(requestedName)];
  if (!IconComponent) return <>{fallback}</>;

  return React.createElement(IconComponent, {
    width: size,
    height: size,
    'aria-hidden': props['aria-label'] ? undefined : true,
    ...props,
  });
}

export default Icon;
`;
}

// Chrome is authored by the page body only. No platform-owned navbar/footer
// module exists, so nothing is synthesized for shared chrome imports.
function buildCanonicalWizardChromeModules(): Record<string, string> {
  return {};
}

/**
 * Safety net for unresolved relative imports.
 *
 * Wizard sites never substitute template/chip components for missing modules —
 * that tier has been removed entirely. But when the in-builder AI Builder writes a file
 * that references a sibling module which doesn't exist yet, the preview crashes
 * with "Could not find module" before any other repair can run.
 *
 * We synthesize a minimal `() => null` placeholder file (NOT a fake chip) so the
 * preview renders an empty slot. The placeholder is clearly marked so authors
 * can find and replace it. This matches the no-op default-export safety net in
 * `repairLocalImportContracts`.
 */
function synthesizeMissingLocalImports(
  sandpackFiles: Record<string, string>,
  options: {
    failOnMissingImport?: boolean;
    themeModule?: string | null;
    iconModule?: string | null;
    sharedModules?: Record<string, string>;
  } = {},
): void {
  const existingPaths = new Set(Object.keys(sandpackFiles));
  const extensions = ['.tsx', '.jsx', '.ts', '.js'];

  for (const [filePath, content] of Object.entries({ ...sandpackFiles })) {
    if (!/\.(tsx?|jsx?)$/.test(filePath)) continue;

    // Match: import X from './foo'  |  import { X } from './foo'  |  import X, { Y } from './foo'  |  import * as X from './foo'
    const importRegex =
      /import\s+(?:[\w*{},\s]+?)\s+from\s+['"](\.\.?\/[^'"]+)['"];?/g;
    let match: RegExpExecArray | null;
    while ((match = importRegex.exec(content)) !== null) {
      const rawImportPath = match[1];
      // Skip stylesheet imports.
      if (/\.(css|scss|less)$/.test(rawImportPath)) continue;

      const targetPath = resolveRelativeModuleTarget(filePath, rawImportPath, existingPaths);
      if (targetPath) continue; // module exists

      // Resolve to an absolute synthesized path.
      const dir = filePath.substring(0, filePath.lastIndexOf('/')) || '/';
      let resolved = rawImportPath.startsWith('/')
        ? rawImportPath
        : `${dir}/${rawImportPath}`.replace(/\/\.\//g, '/');
      const parts = resolved.split('/');
      const stack: string[] = [];
      for (const p of parts) {
        if (p === '..') stack.pop();
        else if (p !== '.' && p !== '') stack.push(p);
      }
      resolved = '/' + stack.join('/');
      const writePath = /\.\w+$/.test(resolved) ? resolved : `${resolved}.tsx`;
      if (existingPaths.has(writePath)) continue;
      if (extensions.some((ext) => existingPaths.has(resolved + ext))) continue;

      if (/(^|\/)theme$/i.test(resolved) && options.themeModule) {
        const themePath = /\.\w+$/.test(resolved) ? resolved : `${resolved}.ts`;
        sandpackFiles[themePath] = options.themeModule;
        existingPaths.add(themePath);
        console.warn(
          `[sandpackFilePrep] Restored canonical theme module ${themePath} for unresolved import "${rawImportPath}" in ${filePath}`,
        );
        continue;
      }

      if (/(^|\/)components\/icon$/i.test(resolved) && options.iconModule) {
        sandpackFiles[writePath] = options.iconModule;
        existingPaths.add(writePath);
        console.warn(
          `[sandpackFilePrep] Restored canonical icon module ${writePath} for unresolved import "${rawImportPath}" in ${filePath}`,
        );
        continue;
      }

      const sharedModuleKey = resolved.replace(/\.(?:tsx|jsx|ts|js)$/i, '').toLowerCase();
      const sharedModule = options.sharedModules?.[sharedModuleKey];
      if (sharedModule) {
        sandpackFiles[writePath] = sharedModule;
        existingPaths.add(writePath);
        console.warn(
          `[sandpackFilePrep] Restored canonical wizard shared module ${writePath} for unresolved import "${rawImportPath}" in ${filePath}`,
        );
        continue;
      }

      if (options.failOnMissingImport) {
        throw new PreviewPipelineError(
          'prep',
          `Wizard VFS is missing local module "${rawImportPath}" required by ${filePath}; refusing to synthesize an empty component.`,
          { blockedFiles: [filePath], recoverableByRelaunch: true },
        );
      }

      // Derive a component name from the import statement (default OR first named).
      const stmt = match[0];
      const defaultMatch = stmt.match(/import\s+([A-Z]\w*)/);
      const namedMatch = stmt.match(/import\s+(?:[A-Z]\w*\s*,\s*)?\{([^}]+)\}/);
      const namedFirst = namedMatch?.[1]
        ?.split(',')
        .map((s) => s.trim().split(/\s+as\s+/).pop()?.trim())
        .filter((n): n is string => !!n && /^[A-Z]/.test(n))[0];
      const compName =
        defaultMatch?.[1] || namedFirst || (resolved.split('/').pop() || 'MissingModule');
      const safeName = /^[A-Z]\w*$/.test(compName) ? compName : 'MissingComponent';

      // Synthesize a placeholder that satisfies BOTH default and named import
      // contracts, so consumers using either shape resolve cleanly.
      const placeholder = [
        `// Auto-synthesized placeholder for unresolved import "${rawImportPath}" from "${filePath}".`,
        `// Replace with a real implementation when ready.`,
        `import React from 'react';`,
        `export function ${safeName}(_props: Record<string, unknown> = {}) { return null as unknown as React.ReactElement; }`,
        `export default ${safeName};`,
        ``,
      ].join('\n');

      sandpackFiles[writePath] = placeholder;
      existingPaths.add(writePath);
      console.warn(
        `[sandpackFilePrep] Synthesized placeholder module ${writePath} for unresolved import "${rawImportPath}" in ${filePath}`,
      );
    }
  }
}






function pickPrimaryComponentPath(paths: string[]): string | null {
  const uniquePaths = [...new Set(paths)].filter(
    (path) => path !== '/hooks-shim.ts' && !/(^|\/)unison\//i.test(path),
  );

  return uniquePaths.find((path) => path === '/App.tsx' || path === '/App.jsx')
    || uniquePaths.find((path) => /\/pages\/(Home|Index)[^/]*\.(tsx|jsx)$/i.test(path))
    || uniquePaths.find((path) => /\/pages\//.test(path))
    || uniquePaths.find((path) => !/\/(index)\.(tsx|jsx)$/.test(path))
    || uniquePaths[0]
    || null;
}

function repairMalformedDefaultExportClosures(content: string): string {
  return content.replace(
    /export\s+default\s+([A-Z]\w*)\s*;\s*\}/g,
    '}\n\nexport default $1;'
  );
}

function hasReactValueImport(content: string): boolean {
  return (
    /^[ \t]*import\s+(?:React\b(?:\s*,[^;{}]*(?:\{[^}]*\})?)?|\*\s+as\s+React\b)\s+from\s+['"]react['"]/m.test(content) ||
    /^[ \t]*import\s+\{[^}]*\bdefault\s+as\s+React\b[^}]*\}\s+from\s+['"]react['"]/m.test(content)
  );
}

function forceClassicReactJsxRuntime(content: string): string {
  if (!content) return content;

  let patched = content;
  const hasJsxSyntax = /<([A-Za-z][\w.:~-]*)[\s/>]|<>|<\/>|<\/([A-Za-z][\w.:~-]*)>/.test(patched);
  const hasCompiledJsxRuntimeImport = /from\s+['"]react\/jsx(?:-dev)?-runtime['"]/.test(patched);
  const alreadyHasReactValueImport = hasReactValueImport(patched);

  if (hasCompiledJsxRuntimeImport) {
    patched = patched.replace(
      /^[ \t]*import\s+\{?\s*jsx(?:DEV| as \w+)?\s*,?\s*jsxs?(?: as \w+)?\s*,?\s*Fragment(?: as \w+)?\s*\}?\s+from\s+['"]react\/jsx-runtime['"];?\s*$/gm,
      ''
    );
    patched = patched.replace(
      /^[ \t]*import\s+\{?\s*jsxDEV(?: as \w+)?\s*,?\s*Fragment(?: as \w+)?\s*\}?\s+from\s+['"]react\/jsx-dev-runtime['"];?\s*$/gm,
      ''
    );
    patched = patched.replace(/\b_jsxDEV\(/g, 'React.createElement(');
    patched = patched.replace(/\bjsxDEV\(/g, 'React.createElement(');
    patched = patched.replace(/\b_jsxs\(/g, 'React.createElement(');
    patched = patched.replace(/\bjsxs\(/g, 'React.createElement(');
    patched = patched.replace(/\b_jsx\(/g, 'React.createElement(');
    patched = patched.replace(/\bjsx\(/g, 'React.createElement(');
    patched = patched.replace(/\bFragment\b/g, 'React.Fragment');

    if (!alreadyHasReactValueImport) {
      patched = `import * as React from 'react';\n${patched.replace(/^\n+/, '')}`;
    }

    return patched.replace(/\n{3,}/g, '\n\n');
  }

  if (!hasJsxSyntax) {
    return patched.replace(/\n{3,}/g, '\n\n');
  }

  // Multiline anchors must consume horizontal indentation only. With \s*,
  // each blank line restarts a scan of every remaining blank line: six such
  // passes can exhaust the worker budget on whitespace-heavy generated JSX.
  patched = patched.replace(/^[ \t]*\/\*\*?\s*@jsxRuntime\s+[^\n*]+\*\/\s*\n?/gm, '');
  patched = patched.replace(/^[ \t]*\/\*\*?\s*@jsxImportSource\s+[^\n*]+\*\/\s*\n?/gm, '');
  patched = patched.replace(/^[ \t]*\/\*\*?\s*@jsx\s+[^\n*]+\*\/\s*\n?/gm, '');
  patched = patched.replace(/^[ \t]*\/\*\*?\s*@jsxFrag\s+[^\n*]+\*\/\s*\n?/gm, '');

  const pragmaBlock = [
    '/** @jsxRuntime classic */',
    '/** @jsx React.createElement */',
    '/** @jsxFrag React.Fragment */',
  ].join('\n');

  patched = `${pragmaBlock}\n${patched.replace(/^\n+/, '')}`;

  if (!alreadyHasReactValueImport) {
    patched = patched.replace(
      pragmaBlock,
      `${pragmaBlock}\nimport * as React from 'react';`
    );
  }

  return patched.replace(/\n{3,}/g, '\n\n');
}

/**
 * Find a safe position to insert a new top-level statement after the last
 * *syntactically complete* import statement in `code`.
 *
 * A naive `code.lastIndexOf('\nimport ')` matches the literal text
 * "\nimport " and can anchor on a truncated/unterminated import (e.g. the AI
 * emitted `import { ` with no closing brace or `from` clause). Splicing
 * injected code right after that dangling line corrupts the file — the
 * injected statement lands in the middle of the broken import instead of
 * after it, producing an "Unexpected keyword 'import'" parse error.
 *
 * This only anchors on imports that have an actual `from '...'` clause
 * (single- or multi-line), and falls back to the very top of the file
 * (after any leading directive prologue like `"use client";`) when no
 * complete import can be found.
 */
function findSafeImportInsertionPoint(code: string): number {
  const completeImportRe = /^[ \t]*import\s+(?:type\s+)?(?:[\w$]+\s*,\s*)?(?:\{[^{};'"`]*\}|\*\s+as\s+[\w$]+|[\w$]+)\s+from\s*(['"])[^'"\r\n]+\1[ \t]*;?[ \t]*$/gm;
  let lastEnd = -1;
  let match: RegExpExecArray | null;
  while ((match = completeImportRe.exec(code)) !== null) {
    lastEnd = match.index + match[0].length;
    if (completeImportRe.lastIndex === match.index) {
      completeImportRe.lastIndex += 1;
    }
  }

  if (lastEnd === -1) {
    const directiveMatch = code.match(/^(['"])use [a-z]+\1;?[ \t]*\n/);
    return directiveMatch ? directiveMatch[0].length : 0;
  }

  const nextNewline = code.indexOf('\n', lastEnd);
  return nextNewline === -1 ? code.length : nextNewline + 1;
}

/**
 * Collect the local names of every top-level binding already present in
 * `code`: named/default/namespace imports, `const`/`let`/`var` declarations,
 * function declarations, and class declarations. Used to make repair passes
 * (e.g. the Lucide icon fallback injector) idempotent — a binding must never
 * be declared twice, whether it came from a real import or a previously
 * generated fallback declaration.
 */
function collectTopLevelBindingNames(code: string): Set<string> {
  const bindings = new Set<string>();

  const namedImportRe = /(?:^|[;\n])\s*import\s+(?:type\s+)?(?:[A-Za-z_$][\w$]*\s*,\s*)?\{([^}]*)\}\s+from\s+['"][^'"]+['"];?/g;
  let m: RegExpExecArray | null;
  while ((m = namedImportRe.exec(code)) !== null) {
    for (const spec of m[1].split(',')) {
      const parts = spec.trim().split(/\s+as\s+/);
      const local = (parts[1] || parts[0]).trim().replace(/^type\s+/, '');
      if (local) bindings.add(local);
    }
  }

  const defaultOrNamespaceImportRe = /(?:^|[;\n])\s*import\s+(?:\*\s+as\s+([A-Za-z_$][\w$]*)|([A-Za-z_$][\w$]*))\s*(?:,\s*\{[^}]*\})?\s+from\s+['"][^'"]+['"];?/g;
  while ((m = defaultOrNamespaceImportRe.exec(code)) !== null) {
    const name = m[1] || m[2];
    if (name) bindings.add(name);
  }

  // `export default function Home()` must count as a binding too — otherwise a
  // page component that shares a Lucide icon name (Home, Search, Map…) gets a
  // duplicate `const Home = …` injected and the file fails to parse.
  // Type annotations (`const Home: React.FC = …`) must count too — otherwise a
  // typed page component sharing a Lucide icon name still gets a duplicate
  // lookup injected. The annotation is non-greedy and stops at the first `=`.
  const declarationRe = /^(?:export\s+(?:default\s+)?)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=;\n]*)?=|^(?:export\s+(?:default\s+)?)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)\s*\(|^(?:export\s+(?:default\s+)?)?class\s+([A-Za-z_$][\w$]*)\b/gm;
  while ((m = declarationRe.exec(code)) !== null) {
    const name = m[1] || m[2] || m[3];
    if (name) bindings.add(name);
  }

  return bindings;
}

/**
 * Process code to strip/transform imports that Sandpack can't resolve.
 * Also fixes dangerouslySetInnerHTML template literals that contain CSS (which crash Babel).
 */
export function processCode(code: string, filePath: string): string {
  if (!/\.(tsx?|jsx?|mjs)$/.test(filePath)) {
    return code;
  }

  // ── Repair: strip dangling/unterminated import openers ─────────────────
  // AI generation (or an earlier repair pass) sometimes leaves a truncated
  // `import { ` opener with no closing brace / `from` clause — e.g. the rest
  // of the specifier list and the module source never got written. Left in
  // place, this dangling line can be mistaken by later anchor-based repairs
  // (or by Sandpack/Babel itself) for the start of a real statement,
  // producing "Unexpected keyword" parse errors. Since there is nothing
  // usable to recover (no specifiers, no module source), remove the opener
  // line outright when it never resolves to a closing `} from '...'`.
  {
    const lines = code.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (!/^\s*import\s*\{\s*$/.test(lines[i])) continue;
      // Check the whole import, allowing multiple specifiers per line and a
      // following statement after its semicolon. A new brace-delimited
      // statement cannot complete an earlier dangling import opener.
      const closed = /^\s*import\s*\{[^{}]*\}\s*from\s*['"][^'"]+['"]/.test(
        lines.slice(i).join('\n'),
      );
      if (!closed) {
        lines[i] = '';
      }
    }
    code = lines.join('\n');
  }

  // ── Safe lucide-react imports ──────────────────────────────────────────
  // Transform all `import { Icon } from 'lucide-react'` into safe namespace
  // lookups with fallback aliases for commonly-missing social-media icons.
  // Handles multiple import statements without duplicate declarations.
  const __LUCIDE_ALIAS_MAP: Record<string, string> = {
    // Canonical brand icon spellings → exact lucide-react export names
    facebook: 'Facebook',
    facebookicon: 'FacebookIcon',
    FacebookLogo: 'Facebook',
    twitter: 'Twitter',
    twittericon: 'TwitterIcon',
    TwitterLogo: 'Twitter',
    XTwitter: 'Twitter',
    TwitterX: 'Twitter',
    instagram: 'Instagram',
    instagramicon: 'InstagramIcon',
    InstagramLogo: 'Instagram',
    github: 'Github',
    githubicon: 'GithubIcon',
    GitHub: 'Github',
    GitHubIcon: 'GithubIcon',
    GithubLogo: 'Github',
    linkedin: 'Linkedin',
    linkedinicon: 'LinkedinIcon',
    LinkedIn: 'Linkedin',
    LinkedInIcon: 'LinkedinIcon',
    LinkedinLogo: 'Linkedin',
    youtube: 'Youtube',
    youtubeicon: 'YoutubeIcon',
    YouTube: 'Youtube',
    YouTubeIcon: 'YoutubeIcon',
    YoutubeLogo: 'Youtube',
    // Social media icons missing from lucide-react → best visual alternative
    TikTok: 'Music', Tiktok: 'Music',
    Pinterest: 'Pin', Pintrest: 'Pin',
    Snapchat: 'Camera', SnapChat: 'Camera',
    WhatsApp: 'MessageCircle', Whatsapp: 'MessageCircle',
    Telegram: 'Send',
    Discord: 'MessageSquare',
    Reddit: 'MessageCircle',
    Threads: 'AtSign',
    Signal: 'Radio',
    WeChat: 'MessageCircle', Wechat: 'MessageCircle',
    Spotify: 'Music',
    SoundCloud: 'CloudRain', Soundcloud: 'CloudRain',
    Vimeo: 'Video',
    Behance: 'Palette',
    Medium: 'BookOpen',
    Mastodon: 'Globe',
    // Common AI hallucinations
    ShieldCheck: 'Shield',
    BadgeCheck: 'Award',
    UserCheck: 'UserCheck',
  };

  let __lucideImportDone = false;
  const __allLucideIcons: Array<{ original: string; alias: string }> = [];
  const __seenLucideAliases = new Set<string>();
  const lucideImportRe = /import\s+\{([^}]+)\}\s+from\s+['"]lucide-react['"];?/g;

  // Remove only our generated lookup declarations when a real binding now
  // supplies that name (or a prior preparation emitted the lookup twice).
  const generatedLookup = /^[ \t]*const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:__LucideIcons\[['"][^'"]+['"]\]\s*\|\|\s*)+__LucideFallback;[ \t]*$/gm;
  const authoredBindings = collectTopLevelBindingNames(code.replace(generatedLookup, '').replace(lucideImportRe, ''));
  const retainedLookups = new Set<string>();
  code = code.replace(generatedLookup, (declaration, name: string) => {
    if (authoredBindings.has(name) || retainedLookups.has(name)) return '';
    retainedLookups.add(name);
    return declaration;
  });

  const getLucideLookupCandidates = (original: string): string[] => {
    const trimmed = original.trim();
    const normalized = trimmed.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const pascalized = normalized
      ? normalized.charAt(0).toUpperCase() + normalized.slice(1)
      : trimmed;

    return Array.from(new Set([
      trimmed,
      __LUCIDE_ALIAS_MAP[trimmed],
      __LUCIDE_ALIAS_MAP[normalized],
      pascalized,
    ].filter((value): value is string => Boolean(value))));
  };

  // Collect all lucide-react imports
  let lucideMatch: RegExpExecArray | null;
  while ((lucideMatch = lucideImportRe.exec(code)) !== null) {
    // Collapse all whitespace (including newlines) before splitting
    const rawNames = lucideMatch[1].replace(/\s+/g, ' ');
    const names = rawNames.split(',')
      .map(n => n.trim())
      .filter(Boolean)
      .map(n => {
        const parts = n.split(/\s+as\s+/);
        const orig = parts[0].replace(/\s+/g, '');
        const al = (parts[1] || parts[0]).replace(/\s+/g, '');
        return { original: orig, alias: al };
      });
    for (const name of names) {
      if (__seenLucideAliases.has(name.alias)) continue;
      __seenLucideAliases.add(name.alias);
      __allLucideIcons.push(name);
    }
  }

  if (__allLucideIcons.length > 0) {
    // ── Idempotency guard ──────────────────────────────────────────────
    // A Live Business Data operation (catalog binding, AI patch, Playground
    // recompile) can reintroduce a plain `import { MapPin } from
    // 'lucide-react'` into a file that a PRIOR prepareSandpackFiles() pass
    // already rewrote into `const MapPin = __LucideIcons['MapPin'] ||
    // __LucideFallback;`. Emitting a second `const MapPin = ...` declaration
    // produces "Identifier 'MapPin' has already been declared". Check every
    // existing top-level binding (imports, consts, functions, classes —
    // including previously generated Lucide aliases) BEFORE emitting a new
    // fallback declaration for that alias, so repeated preparation passes
    // are idempotent. The stale named import is always removed regardless.
    const existingBindings = collectTopLevelBindingNames(code.replace(lucideImportRe, ''));

    code = code.replace(lucideImportRe, (_match) => {
      if (__lucideImportDone) return '/* lucide import merged above */';
      __lucideImportDone = true;

      const iconLines: string[] = [];
      for (const { original, alias } of __allLucideIcons) {
        if (existingBindings.has(alias)) continue;
        const candidates = getLucideLookupCandidates(original);
        const lookup = `${candidates.map((name) => `__LucideIcons['${name}']`).join(' || ')} || __LucideFallback`;
        iconLines.push(`const ${alias} = ${lookup};`);
      }

      if (iconLines.length === 0) {
        // Every requested icon already has a binding somewhere in the file
        // (typically from a prior preparation pass). Nothing new to emit —
        // still drop the stale named import so it isn't left dangling.
        return '/* lucide import already satisfied by existing bindings */';
      }

      const lines: string[] = [
        `import * as __LucideIcons from 'lucide-react';`,
        `const __LucideFallback = (props) => React.createElement('svg', Object.assign({ viewBox: '0 0 24 24', width: 24, height: 24, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }, props), React.createElement('circle', { cx: 12, cy: 12, r: 10 }), React.createElement('line', { x1: 12, y1: 8, x2: 12, y2: 12 }), React.createElement('line', { x1: 12, y1: 16, x2: 12.01, y2: 16 }));`,
        ...iconLines,
      ];
      return lines.join('\n');
    });
  }

  // ── Fix: hoist __LucideFallback & deduplicate namespace import ────────
  // The AI sometimes generates a file that already has the namespace import
  // + hand-written `const X = __LucideIcons['X'] || __LucideFallback;` lines
  // (without the fallback defined), then a remaining named import gets processed
  // and the replacement inserts __LucideFallback *below* those existing lookups,
  // causing a TDZ ReferenceError.  Remove duplicate namespace imports and ensure
  // the fallback declaration always sits right after the first namespace import.
  {
    const nsLine = `import * as __LucideIcons from 'lucide-react';`;
    const fbDecl = `const __LucideFallback = (props) => React.createElement('svg', Object.assign({ viewBox: '0 0 24 24', width: 24, height: 24, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }, props), React.createElement('circle', { cx: 12, cy: 12, r: 10 }), React.createElement('line', { x1: 12, y1: 8, x2: 12, y2: 12 }), React.createElement('line', { x1: 12, y1: 16, x2: 12.01, y2: 16 }));`;

    const hasNs = code.includes(nsLine);
    const hasFb = code.includes('const __LucideFallback =');
    const hasFbRef = code.includes('__LucideFallback');

    if (hasNs && hasFbRef) {
      // 1. Strip all existing __LucideFallback declarations (may be misplaced or duplicated)
      if (hasFb) {
        code = code.replace(/^const __LucideFallback\s*=.*$/m, '');
      }

      // 2. Deduplicate the namespace import (keep only the first occurrence)
      let seenNs = false;
      code = code.split('\n').filter(line => {
        if (line.trim() === nsLine) {
          if (seenNs) return false;
          seenNs = true;
        }
        return true;
      }).join('\n');

      // 3. Insert fallback declaration immediately after the namespace import
      code = code.replace(nsLine, nsLine + '\n' + fbDecl);
    }
  }

  // ── Auto-inject missing lucide icon references ────────────────────────
  // AI sometimes uses lucide icon names (e.g. `icon: Database`) without
  // importing them. Detect PascalCase identifiers that look like lucide
  // icons but have no declaration, and inject safe proxy declarations.
  const COMMON_LUCIDE_ICONS = new Set([
    'Activity','AlertCircle','AlertTriangle','Archive','ArrowDown','ArrowLeft',
    'ArrowRight','ArrowUp','Award','BarChart','Bell','Bookmark','Box','Briefcase',
    'Calendar','Camera','Check','CheckCircle','ChevronDown','ChevronLeft',
    'ChevronRight','ChevronUp','Circle','Clock','Cloud','Code','Coffee',
    'Cpu','CreditCard','Database','Download','Edit','ExternalLink','Eye',
    'EyeOff','Facebook','File','FileText','Film','Filter','Flag','Folder',
    'Gift','Github','Globe','Grid','Hash','Heart','HelpCircle','Home',
    'Inbox','Info','Instagram','Key','Layers','Layout','Link',
    'List','Loader','Lock','LogIn','LogOut','Mail','Map','MapPin','Menu',
    'MessageCircle','MessageSquare','Mic','Monitor','Moon','MoreHorizontal',
    'MoreVertical','Move','Music','Navigation','Package','Paperclip','Pause',
    'PenTool','Phone','PieChart','Play','Plus','Pocket','Power','Printer',
    'Radio','RefreshCw','Repeat','RotateCw','Rss','Save','Search','Send',
    'Server','Settings','Share','Shield','ShoppingBag','ShoppingCart','Sidebar',
    'Slash','Sliders','Smartphone','Speaker','Square','Star','Sun','Sunrise',
    'Sunset','Tablet','Tag','Target','Terminal','ThumbsDown','ThumbsUp',
    'ToggleLeft','ToggleRight','Tool','Trash','TrendingDown','TrendingUp',
    'Triangle','Truck','Tv','Twitter','Type','Umbrella','Underline','Unlock',
    'Upload','User','UserCheck','UserPlus','UserX','Users','Video','Voicemail',
    'Volume','Watch','Wifi','Wind','X','XCircle','Youtube','Zap','ZapOff',
    'Rocket','Sparkles','Wand','Bot','Brain','Lightbulb','Flame','Crown',
    'Gem','HandHeart','Headphones','Languages','Laugh','PaintBucket','Palette',
    'Puzzle','Receipt','Scale','ScrollText','Shrub','Wrench',
  ]);

  // Find all PascalCase identifiers used in the body (outside imports/declarations)
  const bodyWithoutDecls = code.replace(/^(?:import\s+.*|const\s+\w+\s*=).*$/gm, '');
  const usedIdentifiers = new Set<string>();
  const identRe = /\b([A-Z][a-zA-Z0-9]+)\b/g;
  let idMatch: RegExpExecArray | null;
  while ((idMatch = identRe.exec(bodyWithoutDecls)) !== null) {
    usedIdentifiers.add(idMatch[1]);
  }

  // Check which are missing declarations
  const missingIcons: string[] = [];
  const existingIconBindings = collectTopLevelBindingNames(code);
  for (const name of usedIdentifiers) {
    if (!COMMON_LUCIDE_ICONS.has(name)) continue;
    // Check if already declared (import, const, function, class)
    if (!existingIconBindings.has(name)) {
      missingIcons.push(name);
    }
  }

  if (missingIcons.length > 0) {
    // Inject lucide proxy declarations for missing icons
    const hasLucideNamespace = code.includes("import * as __LucideIcons from 'lucide-react'");
    const hasFallbackDecl = code.includes('const __LucideFallback =');
    const injections: string[] = [];
    if (!hasLucideNamespace) {
      injections.push(`import * as __LucideIcons from 'lucide-react';`);
    }
    // Always ensure fallback is declared BEFORE lookup lines we emit, even if
    // the namespace import already exists — otherwise lookups TDZ-crash on
    // `__LucideFallback`.
    if (!hasFallbackDecl) {
      injections.push(`const __LucideFallback = (props) => React.createElement('svg', Object.assign({ viewBox: '0 0 24 24', width: 24, height: 24, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }, props), React.createElement('circle', { cx: 12, cy: 12, r: 10 }), React.createElement('line', { x1: 12, y1: 8, x2: 12, y2: 12 }), React.createElement('line', { x1: 12, y1: 16, x2: 12.01, y2: 16 }));`);
    }
    for (const name of missingIcons) {
      injections.push(`const ${name} = __LucideIcons['${name}'] || __LucideFallback;`);
    }
    // Insert after the fallback declaration when it already exists; otherwise
    // insert after the last import. This preserves the invariant that every
    // `const Icon = ... || __LucideFallback` line appears below the fallback.
    const fallbackDeclMatch = code.match(/^const __LucideFallback\s*=.*$/m);
    if (fallbackDeclMatch?.index !== undefined) {
      const fallbackLineEnd = code.indexOf('\n', fallbackDeclMatch.index);
      const insertAt = fallbackLineEnd === -1 ? code.length : fallbackLineEnd + 1;
      code = code.slice(0, insertAt) + injections.join('\n') + '\n' + code.slice(insertAt);
    } else {
      const insertAt = findSafeImportInsertionPoint(code);
      code = code.slice(0, insertAt) + injections.join('\n') + '\n' + code.slice(insertAt);
    }
  }

  // ── Safe framer-motion imports ─────────────────────────────────────────
  // The AI frequently imports { motion, AnimatePresence } from 'framer-motion'.
  // If framer-motion fails to load or specific exports are missing, provide safe fallbacks.
  code = code.replace(
    /import\s+\{([^}]+)\}\s+from\s+['"]framer-motion['"];?/g,
    (_match, names: string) => {
      const fmNames = names.split(',')
        .map(n => n.trim())
        .filter(Boolean)
        .map(n => {
          const parts = n.split(/\s+as\s+/);
          return { original: parts[0].trim(), alias: (parts[1] || parts[0]).trim() };
        });
      if (fmNames.length === 0) return _match;

      const lines: string[] = [
        `import * as __FramerMotion from 'framer-motion';`,
        // motion fallback: a Proxy that returns the HTML tag as a plain element
        `const __motionFallback = typeof Proxy !== 'undefined' ? new Proxy({}, { get: (_, tag) => (props) => React.createElement(String(tag), Object.fromEntries(Object.entries(props || {}).filter(([k]) => !k.startsWith('while') && !k.startsWith('animate') && !k.startsWith('initial') && !k.startsWith('exit') && !k.startsWith('transition') && !k.startsWith('variants') && k !== 'layout' && k !== 'layoutId'))) }) : {};`,
        `const __AnimatePresenceFallback = ({ children }) => React.createElement(React.Fragment, null, children);`,
      ];
      for (const { original, alias } of fmNames) {
        if (original === 'motion') {
          lines.push(`const ${alias} = __FramerMotion['motion'] || __motionFallback;`);
        } else if (original === 'AnimatePresence') {
          lines.push(`const ${alias} = __FramerMotion['AnimatePresence'] || __AnimatePresenceFallback;`);
        } else {
          lines.push(`const ${alias} = __FramerMotion['${original}'] || (() => null);`);
        }
      }
      return lines.join('\n');
    }
  );

  let processed = code;
  const hooksShimImport = toRelativeSandpackImport(filePath, '/hooks-shim');
  const radixShimImport = toRelativeSandpackImport(filePath, '/radix-shim');

  processed = repairMalformedDefaultExportClosures(processed);

  // Strip leaked markdown code-fence artifacts (```, </code></pre>)
  // Start at the closing marker, then trim its preceding whitespace once.
  // An unanchored leading \s* retries at every character of JSX whitespace
  // when no marker exists, consuming the worker's entire compile budget.
  if (/```\s*$/.test(processed)) {
    processed = processed.replace(/```\s*$/, '').trimEnd();
  }
  if (/<\/code>\s*<\/pre>\s*$/.test(processed)) {
    processed = processed.replace(/<\/code>\s*<\/pre>\s*$/, '').trimEnd();
  }
  processed = processed.replace(/^```(?:html|jsx|tsx|javascript|js|typescript|ts)?\s*\n/g, '');

  // FIX: Repair broken template-literal image URLs generated by AI
  // e.g. src={`https://images.unsplash.com/photo-15${7003211169-...}`} → plain string URLs
  // These contain invalid JS expressions inside ${} that crash Babel
  processed = processed.replace(
    /\{`(https?:\/\/[^`]*?\$\{[^}]*\}[^`]*?)`\}/g,
    (_match, inner: string) => {
      // Detect broken template expressions: arithmetic on Unsplash IDs, commas, queries, etc.
      const hasInvalidExpr = /\$\{[^}]*[,?|&]/.test(inner) ||
        /\$\{\s*\d+[a-zA-Z-]/.test(inner) ||         // e.g. ${1472099645785-5658abf4ff4e}
        /\$\{[^}]*\+[^}]*\}/.test(inner) ||           // e.g. ${someId + i}
        /\$\{[^}]*photo-/.test(inner);                 // e.g. ${...photo-xxx...}
      if (hasInvalidExpr) {
        // Try to extract a clean Unsplash photo URL
        const urlMatch = inner.match(/(https?:\/\/images\.unsplash\.com\/photo-[a-zA-Z0-9-]+)\??/);
        if (urlMatch) {
          return `"${urlMatch[1]}?w=800&q=80"`;
        }
        // Fallback: strip template literal syntax entirely
        const cleaned = inner.replace(/\$\{[^}]*\}/g, '').replace(/[`{}]/g, '');
        const firstUrl = cleaned.match(/(https?:\/\/[^\s"',]+)/);
        return `"${firstUrl ? firstUrl[1] : 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&q=80'}"`;
      }
      return _match;
    }
  );

  // FIX: Convert dangerouslySetInnerHTML={{ __html: `...CSS...` }} to use a string constant
  // Babel crashes when template literals contain CSS syntax like :root { --var: value }
  processed = processed.replace(
    /dangerouslySetInnerHTML=\{\{\s*__html:\s*`([\s\S]*?)`\s*\}\}/g,
    (_match, cssContent: string) => {
      // Only fix if content looks like CSS (not simple HTML)
      if (/:root|@import|@font-face|@media|@keyframes|--[\w-]+\s*:/.test(cssContent)) {
        const jsonStr = JSON.stringify(cssContent);
        return `dangerouslySetInnerHTML={{ __html: ${jsonStr} }}`;
      }
      return _match;
    }
  );

  // Handle @/ path alias imports — convert to correct relative paths for flattened Sandpack files
  processed = processed.replace(
    /^(import\s+[^'";\n]*from\s*['"])@\/([^'"\n]+)(['"];?[ \t]*)$/gm,
    (match, importPrefix, modulePath, importSuffix) => {
      // Shim @/lib/utils → real cn() function
      if (modulePath === 'lib/utils') {
        const utilsShimImport = toRelativeSandpackImport(filePath, '/lib-utils-shim');
        const namedMatch = match.match(/import\s+\{([^}]+)\}/);
        const defaultMatch = match.match(/import\s+(\w+)\s+from/);
        if (namedMatch) return `import { ${namedMatch[1]} } from '${utilsShimImport}';`;
        if (defaultMatch) return `import ${defaultMatch[1]} from '${utilsShimImport}';`;
        return `import { cn } from '${utilsShimImport}';`;
      }

      // Shim @/components/ui/* → real React component stubs
      if (modulePath.startsWith('components/ui/') || modulePath.startsWith('components/ui')) {
        const uiShimImport = toRelativeSandpackImport(filePath, '/ui-shim');
        const namedMatch = match.match(/import\s+\{([^}]+)\}/);
        const defaultMatch = match.match(/import\s+(\w+)\s+from/);
        if (namedMatch) return `import { ${namedMatch[1]} } from '${uiShimImport}';`;
        if (defaultMatch) {
          const exportName = resolveUiShimDefaultImportName(modulePath, defaultMatch[1]);
          return `import { ${formatNamedImport(exportName, defaultMatch[1])} } from '${uiShimImport}';`;
        }
        return match.replace(/@\/[^'"]+/, uiShimImport.replace(/^\.\//, './'));
      }

      if (modulePath.startsWith('hooks/') || modulePath === 'hooks') {
        const namedMatch = match.match(/import\s+\{([^}]+)\}/);
        const defaultMatch = match.match(/import\s+(\w+)\s+from/);
        if (namedMatch) return `import { ${namedMatch[1]} } from '${hooksShimImport}';`;
        if (defaultMatch) return `import ${defaultMatch[1]} from '${hooksShimImport}';`;
        return `import hooks from '${hooksShimImport}'; // [Preview] Shimmed: @/${modulePath}`;
      }

      if (modulePath.startsWith('integrations/supabase')) {
        const namedMatch = match.match(/import\s+\{([^}]+)\}/);
        const defaultMatch = match.match(/import\s+(\w+)\s+from/);
        if (namedMatch) return `import { ${namedMatch[1]} } from '${hooksShimImport}';`;
        if (defaultMatch) return `import ${defaultMatch[1]} from '${hooksShimImport}';`;
        return `import { supabase } from '${hooksShimImport}'; // [Preview] Shimmed: @/${modulePath}`;
      }

      return `${importPrefix}${aliasModuleToRelativeImport(filePath, `@/${modulePath}`)}${importSuffix}`;
    }
  );

  processed = processed.replace(
    /^(\s*import\s+['"])@\/([^'"]+)(['"];?\s*)$/gm,
    (_match, importPrefix, modulePath, importSuffix) => (
      `${importPrefix}${aliasModuleToRelativeImport(filePath, `@/${modulePath}`)}${importSuffix}`
    ),
  );

  // Process remaining imports — strip unresolvable npm packages to prevent Sandpack crashes

  // Generated Unison Radix facades re-export the external primitive. Sandpack
  // cannot collect its CommonJS transform helpers reliably, so preserve the
  // facade API while resolving it against the local preview shim.
  processed = processed.replace(
    /export\s+\*\s+from\s+['"]@radix-ui\/react-(?!(?:accordion|dialog|slot)['"])[^'"]+['"];?/g,
    `export * from '${radixShimImport}';`,
  );
  processed = processed.replace(
    /^import\s+[^'";\n]*from\s*['"]([^'"\n]+)['"];?[ \t]*$/gm,
    (match, modulePath) => {
      if (isSandpackAllowedImport(modulePath)) return match;
      if (modulePath.startsWith('@/')) {
      if (/^@radix-ui\/react-/.test(modulePath)) {
        return match.replace(modulePath, radixShimImport);
      }
        return match.replace(modulePath, aliasModuleToRelativeImport(filePath, modulePath));
      }
      if (/\.(css|scss|less)$/.test(modulePath)) return match;

      if (modulePath.startsWith('./') || modulePath.startsWith('../')) {
        // Redirect relative components/ui/* imports to the UI shim
        if (/components\/ui(\/|$)/.test(modulePath)) {
          const uiShimImport = toRelativeSandpackImport(filePath, '/ui-shim');
          const importMatch = match.match(/import\s+(?:\{([^}]+)\}|([\w]+))/);
          if (importMatch) {
            const namedImports = importMatch[1];
            const defaultImport = importMatch[2];
            if (namedImports) return `import { ${namedImports} } from '${uiShimImport}';`;
            if (defaultImport) {
              const exportName = resolveUiShimDefaultImportName(modulePath, defaultImport);
              return `import { ${formatNamedImport(exportName, defaultImport)} } from '${uiShimImport}';`;
            }
          }
          return match;
        }
        // Redirect relative lib/utils imports to the utils shim
        if (/lib\/utils/.test(modulePath)) {
          const utilsShimImport = toRelativeSandpackImport(filePath, '/lib-utils-shim');
          const importMatch = match.match(/import\s+(?:\{([^}]+)\}|([\w]+))/);
          if (importMatch) {
            const namedImports = importMatch[1];
            const defaultImport = importMatch[2];
            if (namedImports) return `import { ${namedImports} } from '${utilsShimImport}';`;
            if (defaultImport) return `import ${defaultImport} from '${utilsShimImport}';`;
          }
          return match;
        }
        if (modulePath.includes('hooks/')) {
          const importMatch = match.match(/import\s+(?:\{([^}]+)\}|([\w]+))/);
          if (importMatch) {
            const namedImports = importMatch[1];
            const defaultImport = importMatch[2];
            if (namedImports) return `import { ${namedImports} } from '${hooksShimImport}';`;
            if (defaultImport) return `import ${defaultImport} from '${hooksShimImport}';`;
          }
          return `import hooks from '${hooksShimImport}'; // [Preview] Shimmed: ${modulePath}`;
        }
        return match;
      }

      // Unknown npm package — pass through to Sandpack for real resolution.
      // The dependency extractor will pick it up and add it to customSetup.dependencies.
      return match;
    }
  );

  // Remove unsupported hook calls
  const unsupportedHooks = [
    'useAssetRegistry', 'useTemplateState', 'useGoHighLevelCRM', 'useSupabaseClient',
  ];
  for (const hook of unsupportedHooks) {
    processed = processed.replace(
      new RegExp(`const\\s+\\{[^}]*\\}\\s*=\\s*${hook}\\([^)]*\\);?`, 'g'),
      `// [Preview] Stripped ${hook} call`
    );
    processed = processed.replace(
      new RegExp(`const\\s+\\w+\\s*=\\s*${hook}\\([^)]*\\);?`, 'g'),
      `// [Preview] Stripped ${hook} call`
    );
    processed = processed.replace(
      new RegExp(`${hook}\\([^)]*\\)`, 'g'),
      '{}'
    );
  }

  processed = processed.replace(/\n{3,}/g, '\n\n');
  if (/\.[cm]?[jt]sx?$/.test(filePath)) {
    processed = rewritePreviewModuleSpecifiers(processed, (specifier) => {
      if (specifier === '@/lib/utils') return toRelativeSandpackImport(filePath, '/lib-utils-shim');
      if (/^@\/components\/ui(?:\/|$)/.test(specifier)) return toRelativeSandpackImport(filePath, '/ui-shim');
      if (/^@\/hooks(?:\/|$)/.test(specifier) || specifier.startsWith('@/integrations/supabase')) return hooksShimImport;
      if (specifier.startsWith('@/')) return aliasModuleToRelativeImport(filePath, specifier);
      if (specifier.startsWith('/src/')) return aliasModuleToRelativeImport(filePath, `@/${specifier.slice(5)}`);
      return specifier;
    });
  }
  return processed;
}

/**
 * Normalize raw launcher/wizard VFS files before handing off to the Web Builder.
 * Ensures consistent paths, entry files, and CSS tokens.
 */
function normalizeLauncherPath(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;

  if (/^\/(App|main|index)\.(tsx|jsx|ts|js)$/.test(normalized) || normalized === '/index.css') {
    return `/src${normalized}`;
  }

  if (/^\/(pages|components|styles)\//.test(normalized)) {
    return `/src${normalized}`;
  }

  return normalized;
}

function isBootstrapSourceEntry(path?: string | null): boolean {
  return !!path && /\/(main|index)\.(tsx|jsx|ts|js)$/.test(path);
}

function pickRenderableLauncherEntry(
  files: Record<string, string>,
  preferredEntryPoint?: string,
): string | null {
  const normalizedPreferred = preferredEntryPoint ? normalizeLauncherPath(preferredEntryPoint) : null;

  if (normalizedPreferred && files[normalizedPreferred] && !isBootstrapSourceEntry(normalizedPreferred)) {
    return normalizedPreferred;
  }

  return (
    Object.keys(files).find((path) => /\/src\/pages\/(Home|Index)[^/]*\.(tsx|jsx)$/i.test(path)) ||
    Object.keys(files).find((path) => /\/src\/pages\/.+\.(tsx|jsx)$/.test(path)) ||
    Object.keys(files).find(
      (path) =>
        /\/src\/.+\.(tsx|jsx)$/.test(path) &&
        !/\/(App|main|index)\.(tsx|jsx)$/.test(path),
    ) ||
    null
  );
}

export function normalizeLauncherFiles(
  files: Record<string, string>,
  options?: {
    entryPoint?: string;
    themePresetId?: string | null;
    /** Internal launch-assembly path: router/CSS may be added after canonical snapshot merge. */
    allowMissingWizardArtifacts?: boolean;
    /** Preview artifact path should preserve VFS CSS and let snapshotProjector gate missing CSS. */
    injectCssIfMissing?: boolean;
  }
): Record<string, string> {
  // ── Unwrap JSON envelope leaked into file content ──────────────────────
  // The AI sometimes wraps output in {"files":{...}} — if ANY file's content
  // is such a wrapper, extract the inner files and replace the input map.
  let resolvedFiles = files;
  for (const [fPath, fContent] of Object.entries(files)) {
    if (typeof fContent === 'string' && fContent.trimStart().startsWith('{')) {
      try {
        const parsed = JSON.parse(fContent);
        if (parsed && typeof parsed === 'object' && parsed.files && typeof parsed.files === 'object') {
          console.warn(`[normalizeLauncherFiles] Unwrapping JSON envelope in ${fPath}`);
          resolvedFiles = {};
          for (const [innerPath, innerContent] of Object.entries(parsed.files)) {
            if (typeof innerContent === 'string') {
              resolvedFiles[innerPath] = innerContent;
            }
          }
          // Also check for entryPoint in the JSON envelope
          if (parsed.entryPoint && !options?.entryPoint) {
            options = { ...options, entryPoint: parsed.entryPoint };
          }
          break;
        }
      } catch {
        // Not valid JSON — check if JSON is embedded mid-file
        const jsonIdx = fContent.indexOf('{"files"');
        if (jsonIdx > 0) {
          try {
            const embedded = JSON.parse(fContent.slice(jsonIdx));
            if (embedded?.files && typeof embedded.files === 'object') {
              console.warn(`[normalizeLauncherFiles] Extracting embedded JSON from ${fPath}`);
              resolvedFiles = {};
              for (const [innerPath, innerContent] of Object.entries(embedded.files)) {
                if (typeof innerContent === 'string') {
                  resolvedFiles[innerPath] = innerContent;
                }
              }
              if (embedded.entryPoint && !options?.entryPoint) {
                options = { ...options, entryPoint: embedded.entryPoint };
              }
              break;
            }
          } catch {
            // Not JSON either
          }
        }
      }
    }
  }

  // Generated runtime hooks (catalog hydration, forms, published actions) import
  // the two canonical runtime config modules. Fill inert defaults when a file set
  // was produced outside a full launch so those imports resolve to real config
  // instead of a synthesized null-component placeholder.
  resolvedFiles = withRuntimeConfigDefaults(resolvedFiles);

  const out: Record<string, string> = {};

  // Normalize all paths to have leading slash
  for (const [path, content] of Object.entries(resolvedFiles)) {
    const normalized = normalizeLauncherPath(path);
    // Sanitize image URLs and enforce contrast in all files
    let sanitized = content;
    if (/\.(tsx?|jsx?)$/.test(normalized) && !normalized.startsWith('/src/unison/')) {
      const imageCompatibility = normalizeImageCompatibility(sanitized, normalized);
      if (imageCompatibility.issues.length) throw new Error(imageCompatibility.issues.join('\n'));
      sanitized = imageCompatibility.code;
    }
    if (/\.(tsx?|jsx?|css)$/.test(normalized)) {
      sanitized = repairBrokenImageUrls(sanitized);
    }
    if (normalized.endsWith('.css')) {
      sanitized = enforceContrastInCSS(sanitized);
    }
    if (/\.(tsx|jsx)$/.test(normalized)) {
      sanitized = ensureDefaultExportForReactModule(sanitized, normalized);
      sanitized = injectMissingToggleState(sanitized, normalized);
    }
    out[normalized] = sanitized;

  }

  // Ensure /src/main.tsx exists
  if (!out['/src/main.tsx']) {
    out['/src/main.tsx'] = `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`;
  }

  const normalizationResolution = resolveSnapshot(out, null);

  // Ensure /src/index.css exists only for callers that are still assembling the
  // canonical VFS. Preview artifact rendering preserves injected VFS CSS and
  // fails later if a wizard draft is missing it.
  if (!out['/src/index.css'] && options?.injectCssIfMissing !== false) {
    out['/src/index.css'] = buildBaseCssForPreset(options?.themePresetId);
  }

  // Existing wizard snapshots can carry an earlier marker-owned UI facade.
  // Refresh those runtime modules before routing or preview compilation so
  // generated pages never import an API absent from their own foundation.
  // Non-wizard drafts have no ui-manifest, but AI-generated code is sanitized
  // onto the `@/unison/ui/*` facade, so seed the foundation whenever anything
  // references it — otherwise the edit "applies" and the preview fails to resolve.
  if (
    out['/.unison/ui-manifest.json'] ||
    Object.entries(out).some(([path, content]) => (
      path.startsWith('/src/unison/ui/') || /@\/unison\/ui(?:\/[^'"\s]+)?/.test(content)
    ))
  ) {
    syncGeneratedUiFoundationFiles(out, options?.themePresetId);

    // Radix's raw Slot throws ("Slot failed to slot onto its children") whenever
    // `asChild` receives text, a fragment, or multiple children — a shape AI
    // pages produce constantly (icon + label). Route every direct import onto
    // the tolerant foundation slot so the preview degrades instead of crashing.
    for (const [path, content] of Object.entries(out)) {
      if (!path.startsWith('/src/') || path.startsWith('/src/unison/ui/radix/')) continue;
      if (!content.includes('@radix-ui/react-slot')) continue;
      out[path] = content.replace(
        /(["'])@radix-ui\/react-slot\1/g,
        "'@/unison/ui/radix/slot'",
      );
    }

  }

  if (
    /@import\s+(?:url\(\s*)?['"](?:\.\/)?unison\/ui\/tailwind\.css['"]/.test(out['/src/index.css'] || '') &&
    !out['/src/unison/ui/tailwind.css']
  ) {
    out['/src/unison/ui/tailwind.css'] = UNISON_VFS_STYLE_BRIDGE;
    console.info('[sandpackFilePrep] Restored the token-consuming VFS CSS bridge.');
  }

  // ── Inject conventional IDE JSON / config files ──────────────────────────
  // Ensures the VFS looks like a real project with package.json, tsconfig, etc.
  if (!out['/package.json']) {
    const detectedDeps: Record<string, string> = {
      react: GENERATED_RUNTIME_PROFILE.react,
      'react-dom': GENERATED_RUNTIME_PROFILE.reactDom,
    };
    // Scan source for common imports to auto-populate dependencies
    const allCode = Object.values(out).join('\n');
    const importMatches = allCode.matchAll(/from\s+['"]([a-z@][a-z0-9\-_@/.]*)['"]/g);
    for (const m of importMatches) {
      const pkg = m[1].startsWith('@') ? m[1].split('/').slice(0, 2).join('/') : m[1].split('/')[0];
      if (pkg && !pkg.startsWith('.') && !pkg.startsWith('/') && !detectedDeps[pkg]) {
        // Runtime-critical packages (Radix facade graph, framer-motion, the
        // three.js experience capability) must resolve to their pinned
        // versions — `latest` can install a major incompatible with the
        // generated React runtime profile and crash the preview.
        detectedDeps[pkg] = resolvePinnedRuntimeVersion(pkg) ?? 'latest';
      }
    }
    out['/package.json'] = JSON.stringify({
      name: 'vfs-project',
      private: true,
      version: '0.0.1',
      type: 'module',
      scripts: {
        dev: 'vite',
        build: 'tsc && vite build',
        preview: 'vite preview',
      },
      dependencies: detectedDeps,
      devDependencies: {
        '@vitejs/plugin-react-swc': '^3.5.0',
        typescript: '^5.3.0',
        vite: '^5.4.0',
        tailwindcss: '^3.4.0',
        autoprefixer: '^10.4.0',
        postcss: '^8.4.0',
      },
    }, null, 2);
  } else {
    // Heal persisted package.json files that recorded `latest` (or an older
    // floating range) for runtime-critical packages. A stale snapshot must
    // not keep installing an incompatible three/fiber or Radix major.
    try {
      const existing = JSON.parse(out['/package.json']) as {
        dependencies?: Record<string, string>;
      };
      if (existing && typeof existing === 'object' && existing.dependencies) {
        let healed = false;
        for (const [name, version] of Object.entries(existing.dependencies)) {
          const pinned = resolvePinnedRuntimeVersion(name);
          if (pinned && pinned !== version) {
            existing.dependencies[name] = pinned;
            healed = true;
          }
        }
        if (healed) out['/package.json'] = JSON.stringify(existing, null, 2);
      }
    } catch { /* leave malformed package.json untouched */ }
  }

  if (!out['/tsconfig.json']) {
    out['/tsconfig.json'] = JSON.stringify({
      compilerOptions: {
        target: 'ES2020',
        useDefineForClassFields: true,
        lib: ['ES2020', 'DOM', 'DOM.Iterable'],
        module: 'ESNext',
        skipLibCheck: true,
        moduleResolution: 'bundler',
        allowImportingTsExtensions: true,
        resolveJsonModule: true,
        isolatedModules: true,
        noEmit: true,
        jsx: 'react-jsx',
        strict: true,
        noUnusedLocals: false,
        noUnusedParameters: false,
        noFallthroughCasesInSwitch: true,
        baseUrl: '.',
        paths: { '@/*': ['./src/*'] },
      },
      include: ['src'],
    }, null, 2);
  }

  if (!out['/vite.config.ts']) {
    out['/vite.config.ts'] = `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
`;
  }

  if (!out['/tailwind.config.ts']) {
    out['/tailwind.config.ts'] = `import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: { extend: {} },
  plugins: [],
} satisfies Config;
`;
  }

  if (!out['/postcss.config.js']) {
    out['/postcss.config.js'] = `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
`;
  }

  if (!out['/index.html']) {
    out['/index.html'] = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>VFS Project</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;
  }

  // Ensure /src/App.tsx exists for blank/non-wizard drafts only. Wizard drafts
  // must arrive with the deterministic router generated from PageRegistry;
  // deriving App from the first page silently renders a minimal single-route
  // shell and bypasses SiteBundleSnapshot authority.
  if (!out['/src/App.tsx'] && !out['/src/App.jsx']) {
    if (normalizationResolution.isWizardDraft && !options?.allowMissingWizardArtifacts) {
      throw new PreviewPipelineError(
        'prep',
        'Wizard draft is missing deterministic /src/App.tsx router — refusing to derive a minimal preview shell.',
        { recoverableByRelaunch: true },
      );
    }

    const targetImport = pickRenderableLauncherEntry(out, options?.entryPoint);

    if (targetImport) {
      const importPath = targetImport.replace('/src/', './').replace(/\.(tsx|jsx)$/, '');
      out['/src/App.tsx'] = `import React from 'react';
import Entry from '${importPath}';

export default function App() {
  return <Entry />;
}`;
    }
  }

  return out;
}

/**
 * Compile source VFS files (in /src/ structure) into a Sandpack-compatible overlay.
 * This is the canonical preview compiler — the SINGLE source of truth for preview prep.
 * 
 * Source VFS: /src/App.tsx, /src/main.tsx, /src/components/...
 * Sandpack overlay: /App.tsx, /index.tsx, /index.css, /components/...
 * 
 * Key rules:
 * - /src/ prefix is stripped (flattened to root)
 * - /main.tsx is ALWAYS renamed to /index.tsx (Sandpack react-ts entry point)
 * - /index.tsx is the ONLY valid entry — never /main.tsx
 * - Missing /App.tsx gets a proxy to the primary component
 * - Missing /index.tsx gets DEFAULT_INDEX injected
 */

/**
 * Detect "prose-only" TSX/JSX modules — the AI sometimes emits a sentence
 * describing what it WILL build instead of the actual component. We replace
 * the file with a safe fallback component so the preview doesn't blow up.
 */
function isProseOnlyModule(content: string): boolean {
  if (!content) return false;
  const trimmed = content.trim();
  if (!trimmed) return false;
  // If it has any JSX, import, export, function, class, const/let/var
  // declaration, JSDoc/pragma block, or a meaningful keyword → not prose.
  if (/<[A-Za-z/!?]/.test(trimmed)) return false;
  if (/\b(import|export|function|class|const|let|var|return|=>|interface|type|enum)\b/.test(trimmed)) return false;
  if (/^\s*\/[*/]/.test(trimmed)) return false;
  if (/[{};]/.test(trimmed)) return false;
  // Looks like a sentence: contains alphabetic words and (often) ends with a period.
  return /[A-Za-z]/.test(trimmed) && /\s/.test(trimmed);
}

function buildProseFallback(normalizedPath: string): string {
  const safeName = (normalizedPath.split('/').pop() || 'Page').replace(/\.[jt]sx?$/, '').replace(/[^A-Za-z0-9]/g, '') || 'Page';
  const componentName = /^[A-Z]/.test(safeName) ? safeName : `Page${safeName}`;
  return `import React from 'react';

// [sandpackFilePrep] Original module at ${normalizedPath} was prose-only;
// a safe fallback was injected so the Preview recovered without crashing.
export default function ${componentName}() {
  return (
    <main style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32, fontFamily: 'system-ui' }}>
      <div style={{ maxWidth: 480, textAlign: 'center' }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>📝</div>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 6 }}>Preview recovered</h2>
        <p style={{ color: '#666', fontSize: 14, lineHeight: 1.5 }}>
          The source for <code>${normalizedPath}</code> contained narration instead of a React component, so a safe fallback was injected.
        </p>
      </div>
    </main>
  );
}
`;
}

/**
 * Repair concise-arrow / object-literal returns where a component accidentally
 * returns <code>{ children }</code> as a plain object instead of JSX. The
 * symptom in React is "Objects are not valid as a React child". We rewrite
 * the obvious shapes to a Fragment-wrapped JSX return so the component renders.
 *
 * Handles:
 *   () =&gt; ({ children })           → () =&gt; (&lt;&gt;{children}&lt;/&gt;)
 *   () =&gt; ({ children, })          → () =&gt; (&lt;&gt;{children}&lt;/&gt;)
 *   () =&gt; ({ children: x })        → () =&gt; (&lt;&gt;{x}&lt;/&gt;)
 *   return ({ children });          → return &lt;&gt;{children}&lt;/&gt;;
 *   return ({ children: children }); → return &lt;&gt;{children}&lt;/&gt;;
 *   return { children: x };         → return &lt;&gt;{x}&lt;/&gt;;
 *   return { children: x ?? null }; → return &lt;&gt;{x ?? null}&lt;/&gt;;
 */
function repairConciseArrowChildren(content: string): string {
  if (!content || !/children/.test(content)) return content;
  let out = content;
  // Concise-arrow: => ({ children })  or  => ({ children, })  or  => ({ children: <expr> })
  out = out.replace(
    /=>\s*\(\s*\{\s*children\s*(?::\s*([^},]+?))?\s*,?\s*\}\s*\)/g,
    (_m, expr) => `=> (<>{${(expr ?? 'children').trim()}}</>)`,
  );
  // return ({ children: <expr> })  or  return ({ children })
  out = out.replace(
    /return\s*\(\s*\{\s*children\s*(?::\s*([^},]+?))?\s*,?\s*\}\s*\)\s*;?/g,
    (_m, expr) => `return <>{${(expr ?? 'children').trim()}}</>;`,
  );
  // return { children: <expr> }   (no surrounding parens)
  out = out.replace(
    /return\s*\{\s*children\s*(?::\s*([^},]+?))?\s*,?\s*\}\s*;/g,
    (_m, expr) => `return <>{${(expr ?? 'children').trim()}}</>;`,
  );
  return out;
}

// The launcher's strict pre-persist validation call and Preview's mount-time
// call run this same full VFS pipeline back-to-back on essentially identical
// files (validate-then-render). `strict` only changes behaviour inside the
// `!hasApp` branch below, so once a run resolves `hasApp === true` its result
// is valid for either strict value — cache on that basis to cut the second,
// otherwise-redundant full pass instead of the coverage it produces.
const PREPARED_FILES_CACHE_LIMIT = 20;
const preparedFilesCache = new Map<string, Record<string, string>>();

function hashFilesRecord(files: Record<string, string>): string {
  let h = 0x811c9dc5;
  for (const path of Object.keys(files).sort()) {
    const entry = `${path}\u0000${files[path]}\u0000`;
    for (let i = 0; i < entry.length; i++) {
      h ^= entry.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
  }
  return (h >>> 0).toString(36);
}

export function prepareSandpackFiles(
  files: Record<string, string>,
  options?: { strict?: boolean; entryPoint?: string; aesthetic?: string; themePresetId?: string | null; onProgress?: (phase: string, path?: string) => void }
): Record<string, string> {
  options?.onProgress?.('projecting runtime');
  const effectiveAesthetic = options?.themePresetId ? null : (options?.aesthetic || null);
  const preparedCacheKey =
    `${hashFilesRecord(files)}::${options?.entryPoint || ''}::${options?.themePresetId || ''}::${effectiveAesthetic || ''}`;
  const cachedPrepared = preparedFilesCache.get(preparedCacheKey);
  if (cachedPrepared) return { ...cachedPrepared };
  const inputSnapshotResolution = resolveSnapshot(files, null);
  const isWizardRuntime = inputSnapshotResolution.isWizardDraft;

  // ═══════════════════════════════════════════════════════════════════════════
  // GUARD: Unwrap JSON-wrapped file maps that leaked through as raw content.
  // If ANY file's content is a JSON object with a "files" key, extract the
  // actual files and merge them into the VFS instead of treating the JSON
  // string as source code.
  // ═══════════════════════════════════════════════════════════════════════════
  // Foundation primitives imported from an unauthored relative path are an
  // import-specifier mistake, not a missing module: point them at the canonical
  // barrel before any unresolved-import enforcement runs.
  let resolvedFiles = withRuntimeConfigDefaults(normalizeFoundationLocalImports(files));
  const fileKeys = Object.keys(resolvedFiles);

  // Case 1: The entire VFS has a single file whose content is a JSON files wrapper
  // e.g. { "/App.tsx": '{"files":{"src/App.tsx":"import React..."}}' }
  if (fileKeys.length === 1 || fileKeys.length <= 3) {
    for (const [fPath, fContent] of Object.entries(files)) {
      if (typeof fContent === 'string' && fContent.trim().length > 100 && fContent.trimStart().startsWith('{')) {
        try {
          const parsed = JSON.parse(fContent);
          if (parsed && typeof parsed === 'object' && parsed.files && typeof parsed.files === 'object') {
            console.warn(`[sandpackFilePrep] Detected JSON wrapper at ${fPath} — unwrapping nested files structure`);
            resolvedFiles = {};
            for (const [innerPath, innerContent] of Object.entries(parsed.files)) {
              if (typeof innerContent === 'string') {
                // Strip leading "src/" so "/src/App.tsx" becomes "/App.tsx"
                let normalizedInner = innerPath.startsWith('/') ? innerPath : `/${innerPath}`;
                normalizedInner = normalizedInner.replace(/^\/src\//, '/');
                // Recursively unwrap if innerContent is also a JSON string, passing the path hint
                const unwrappedContent = recursivelyUnwrapJson(innerContent, normalizedInner);
                resolvedFiles[normalizedInner] = unwrappedContent;
              }
            }
            console.log(`[sandpackFilePrep] Unwrapped ${Object.keys(resolvedFiles).length} files from JSON wrapper`);
            break; // Only one wrapper expected
          }
        } catch (e) {
          // Not JSON — continue normally
          console.warn(`[sandpackFilePrep] Attempted JSON parse of ${fPath} failed:`, (e as Error).message);
        }
      }
    }
  }

  // Case 2: Individual file content is a JSON wrapper (defensive per-file check)
  // This catches cases where a single file contains the full JSON structure
  const finalFiles: Record<string, string> = {};
  for (const [path, content] of Object.entries(resolvedFiles)) {
    if (typeof content === 'string' && content.trim().length > 100 && content.trimStart().startsWith('{')) {
      try {
        // Aggressive check: try to parse any large JSON-like content
        const parsed = JSON.parse(content);
        if (parsed && typeof parsed === 'object' && parsed.files && typeof parsed.files === 'object' && Object.keys(parsed.files).length > 0) {
          console.warn(`[sandpackFilePrep] Per-file JSON structure detected in ${path} — extracting files`);
          for (const [innerPath, innerContent] of Object.entries(parsed.files)) {
            if (typeof innerContent === 'string') {
              let norm = innerPath.startsWith('/') ? innerPath : `/${innerPath}`;
              norm = norm.replace(/^\/src\//, '/');
              // Recursively unwrap if innerContent is also a JSON string, passing the path hint
              const unwrappedContent = recursivelyUnwrapJson(innerContent, norm);
              finalFiles[norm] = unwrappedContent;
            }
          }
          console.log(`[sandpackFilePrep] Extracted ${Object.keys(finalFiles).length} files from JSON in ${path}`);
          continue; // Skip adding this JSON wrapper as a file
        }
      } catch {
        // Not JSON — treat as normal file
      }
    }
    finalFiles[path] = content;
  }

  const referencesGeneratedUiFoundation = Object.entries(finalFiles).some(([path, content]) => (
    path.startsWith('/src/unison/ui/') || /@\/unison\/ui(?:\/[^'"\s]+)?/.test(content)
  ));

  if (!isWizardRuntime && (finalFiles['/.unison/ui-manifest.json'] || referencesGeneratedUiFoundation)) {
    syncGeneratedUiFoundationFiles(finalFiles, options?.themePresetId);
  }

  const sandpackFiles: Record<string, string> = {};
  let hasApp = false;
  let hasIndex = false;
  let hasCSS = false;
  const componentFilePaths: string[] = [];

  console.log('[sandpackFilePrep] Input VFS files:', Object.keys(finalFiles));

  for (const [path, content] of Object.entries(finalFiles)) {
    options?.onProgress?.('preparing module', path);
    let normalizedPath = path.startsWith('/') ? path : `/${path}`;

    // Skip files Sandpack doesn't need
    if (normalizedPath.includes('node_modules') ||
        normalizedPath.includes('/.') ||
        normalizedPath.endsWith('.json') ||
        normalizedPath.endsWith('.config.ts') ||
        normalizedPath.endsWith('.config.js')) {
      continue;
    }

    // Flatten /src/ paths to root for Sandpack compatibility
    if (normalizedPath.startsWith('/src/')) {
      normalizedPath = normalizedPath.replace('/src/', '/');
    }

    // Flatten /styles/ to root
    if (normalizedPath.startsWith('/styles/')) {
      normalizedPath = normalizedPath.replace('/styles/', '/');
    }

    // *** CRITICAL FIX: Rename /main.tsx → /index.tsx ***
    // Sandpack react-ts template uses /index.tsx as its entry point, NOT /main.tsx.
    if (normalizedPath === '/main.tsx') {
      normalizedPath = '/index.tsx';
    } else if (normalizedPath === '/main.jsx') {
      normalizedPath = '/index.jsx';
    } else if (normalizedPath === '/main.ts') {
      normalizedPath = '/index.ts';
    }

    // Fix imports in content to match flattened paths
    let processedContent = /\.(tsx|jsx)$/i.test(path) && !path.startsWith('/src/unison/')
      ? injectPreviewSourceLocators(content, path)
      : content;

    // Repair legacy/generated payloads that serialized THEME as undefined/null.
    if (!isWizardRuntime && /\.(tsx?|jsx?)$/.test(normalizedPath) && /const\s+THEME\s*=\s*(undefined|null);/.test(processedContent)) {
      processedContent = processedContent.replace(
        /const\s+THEME\s*=\s*(undefined|null);/,
        `const THEME = ${LAUNCHER_THEME_JSON};`
      );
    }

    // NO-FALLBACK: prose-only TSX and raw-CSS-in-TSX are hard failures.
    // The runtime cannot silently fabricate a component for them; surface the
    // problem via PreviewPipelineError so the user sees it.
    if (/\.(tsx?|jsx?)$/.test(normalizedPath) && isProseOnlyModule(processedContent)) {
      throw new PreviewPipelineError(
        'prep',
        `Prose-only module at ${normalizedPath} — AI emitted narration instead of a React component.`,
        { blockedFiles: [normalizedPath], recoverableByRelaunch: true },
      );
    }
    if (/\.(tsx?|jsx?)$/.test(normalizedPath) && isRawCss(processedContent)) {
      throw new PreviewPipelineError(
        'prep',
        `Raw CSS in TSX module at ${normalizedPath} — module did not parse as React code.`,
        { blockedFiles: [normalizedPath], recoverableByRelaunch: true },
      );
    }

    // SAFETY NET: Ensure React imports are present for files using hooks
    if (/\.(tsx?|jsx?)$/.test(normalizedPath) && !isRawCss(processedContent)) {
      processedContent = ensureReactImports(processedContent);
      // Fix broken SVG elements (dc.path, svg.circle, etc.)
      processedContent = sanitizeSvgElements(processedContent);
      // Repair `=> ({ children })` and `return { children: x }` style returns
      // before the JSX runtime pragma pass so the rewritten JSX is normalized.
      processedContent = repairConciseArrowChildren(processedContent);
      processedContent = forceClassicReactJsxRuntime(processedContent);
    }

    processedContent = processedContent
      .replace(/from\s+['"]\.\/src\//g, "from './")
      .replace(/from\s+['"]src\//g, "from './")
      .replace(/from\s+['"]\.\/styles\//g, "from './")
      .replace(/import\s+['"]\.\/styles\//g, "import './");

    processedContent = processedContent.replace(
      /(\bfrom\s+['"])@\/unison\/([^'"]+)(['"])/g,
      (_match, importPrefix, modulePath, importSuffix) => (
        `${importPrefix}${aliasModuleToRelativeImport(normalizedPath, `@/unison/${modulePath}`)}${importSuffix}`
      ),
    );

    if (/\.css$/i.test(normalizedPath)) {
      // Compatibility repair for drafts persisted before the complete-line
      // Google Fonts replacement fix. Keep all other authored CSS unchanged.
      processedContent = repairThemeFontImportLine(processedContent);
      processedContent = processedContent.replace(
        /(@import\s+(?:url\(\s*)?['"])@\/([^'"]+)(['"]\s*\)?\s*;)/g,
        (_match, importPrefix, modulePath, importSuffix) => (
          `${importPrefix}${aliasModuleToRelativeImport(normalizedPath, `@/${modulePath}`)}${importSuffix}`
        ),
      );
    }

    processedContent = processCode(processedContent, normalizedPath);
    if (!/\.css$/i.test(normalizedPath)) {
      processedContent = repairBrokenImageUrls(processedContent);
    }
    processedContent = injectPreviewNavBridge(processedContent, normalizedPath);
    sandpackFiles[normalizedPath] = processedContent;

    if (/\.(tsx?|jsx?)$/.test(normalizedPath) && normalizedPath !== '/hooks-shim.ts' && !/(^|\/)unison\//i.test(normalizedPath)) {
      componentFilePaths.push(normalizedPath);
    }
    if (normalizedPath === '/App.tsx' || normalizedPath === '/App.jsx') hasApp = true;
    if (normalizedPath === '/index.tsx' || normalizedPath === '/index.jsx') hasIndex = true;
    if (normalizedPath.endsWith('.css')) hasCSS = true;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CSS THREADING (snapshot-as-primary): Preview must consume the injected VFS
  // stylesheet. Rebuilding CSS here from themePresetId was a hidden hardcoded
  // themed fallback and could overwrite the SiteBundleSnapshot/WizardSeed CSS.
  // Only blank/non-wizard drafts may receive a Tailwind shell below; wizard
  // drafts without CSS fail loudly.
  // ─────────────────────────────────────────────────────────────────────────
  const resolvedPresetId = options?.themePresetId || (options?.aesthetic && isValidAesthetic(options.aesthetic) ? options.aesthetic : null);

  // ── CSS authority (snapshot-as-primary, no SEMANTIC_CSS_VARS fallback) ──
  // Wizard-draft classification is derived strictly from artifacts present in
  // resolvedFiles (snapshot file, wizard-seed, or live launchState upstream).
  // No cold-hydration hinting — the snapshot must be imported to count.
  const cssResolution = resolveSnapshot(resolvedFiles, null);

  if (!hasCSS) {
    if (cssResolution.isWizardDraft) {
      throw new PreviewPipelineError(
        'prep',
        'Wizard draft has no injected /src/index.css from SiteBundleSnapshot — refusing to render fallback CSS.',
        { recoverableByRelaunch: true },
      );
    } else {
      // Blank draft → minimal Tailwind shell, no themed palette.
      sandpackFiles['/index.css'] = `@tailwind base;\n@tailwind components;\n@tailwind utilities;\n`;
    }
  } else {
    const existingIndexCSS = sandpackFiles['/index.css'] || '';
    if (existingIndexCSS && !existingIndexCSS.includes('--primary:')) {
      if (cssResolution.isWizardDraft) {
        if (isLiveEditedVfsPath('/src/index.css')) {
          console.info('[prepareSandpackFiles] Preserving live-edited wizard stylesheet without legacy semantic tokens.');
        } else {
          throw new PreviewPipelineError(
            'prep',
            'Wizard draft /src/index.css is missing semantic tokens (--primary); CSS recovery is not allowed after Stage 4b.',
            { recoverableByRelaunch: true },
          );
        }
      }
      // Blank draft: leave AI-authored CSS as-is, no token injection.
    }
  }

  if (resolvedPresetId && hasCSS) {
    console.log(`[prepareSandpackFiles] Preserving injected VFS CSS for themePresetId: ${resolvedPresetId}`);
  }

  // Enforce contrast on final CSS
  if (sandpackFiles['/index.css'] && !isWizardRuntime) {
    sandpackFiles['/index.css'] = enforceContrastInCSS(sandpackFiles['/index.css']);
  }

  if (!hasApp) {
    if (cssResolution.isWizardDraft) {
      throw new PreviewPipelineError(
        'prep',
        'Wizard draft is missing /App.tsx — deterministic PageRegistry router was not injected.',
        { recoverableByRelaunch: true },
      );
    }

    if (options?.strict && options?.entryPoint) {
      const entryFlattened = options.entryPoint.replace(/^\/src\//, '/');
      if (sandpackFiles[entryFlattened]) {
        sandpackFiles['/App.tsx'] = createProxyApp(entryFlattened);
      } else {
        throw new PreviewPipelineError(
          'prep',
          `Preview is missing strict entry ${entryFlattened} and no App.tsx exists — refusing to emit a minimal template.`,
          { blockedFiles: [entryFlattened], recoverableByRelaunch: true },
        );
      }
    } else {
      // Non-wizard (blank) draft missing /App.tsx — synthesize a proxy that
      // mounts the first available component module so the preview can render
      // user-authored code without inventing a themed minimal template.
      const proxyTarget =
        componentFilePaths.find((p) => /\/pages\/Home\.(tsx|jsx)$/i.test(p)) ||
        componentFilePaths.find((p) => /\/pages\//i.test(p)) ||
        componentFilePaths.find((p) => p !== '/index.tsx' && p !== '/index.jsx');
      if (proxyTarget) {
        sandpackFiles['/App.tsx'] = createProxyApp(proxyTarget);
        hasApp = true;
      } else {
        throw new PreviewPipelineError(
          'prep',
          'Preview is missing /App.tsx — refusing to emit a minimal template.',
          { recoverableByRelaunch: true },
        );
      }
    }
  }


  // Boilerplate mounts use the controlled entry. Saved provider trees and
  // initial App props are application state and must survive projection.
  const savedBootstrap = sandpackFiles['/index.tsx'] || sandpackFiles['/index.jsx'];
  const preserveSavedBootstrap = Boolean(savedBootstrap && /(?:createRoot|ReactDOM\.render)\s*\(/.test(savedBootstrap)
    && ([...savedBootstrap.matchAll(/<([A-Z][\w.]*)\b/g)].some((match) => !['App', 'StrictMode', 'React.StrictMode'].includes(match[1]))
      || /<App\s+[^/\s>]/.test(savedBootstrap)));
  sandpackFiles['/index.tsx'] = preserveSavedBootstrap
    ? savedBootstrap + `\n// Saved provider tree owns mounting; report its actual DOM commit.
const __savedPreviewObserver = new MutationObserver(() => {
  const root = document.getElementById('root');
  if (root?.childElementCount) {
    window.parent.postMessage({ type: 'UNISON_PREVIEW_RENDER_READY' }, '*');
    __savedPreviewObserver.disconnect();
  }
});
__savedPreviewObserver.observe(document.body, { childList: true, subtree: true });
window.addEventListener('error', (event) => window.parent.postMessage({ type: 'UNISON_PREVIEW_RENDER_ERROR', error: event.message }, '*'));
window.addEventListener('unhandledrejection', (event) => window.parent.postMessage({ type: 'UNISON_PREVIEW_RENDER_ERROR', error: String(event.reason?.message || event.reason) }, '*'));
`
    : DEFAULT_INDEX;

  // Remove any stale /main.tsx that might have leaked through
  delete sandpackFiles['/main.tsx'];
  delete sandpackFiles['/main.jsx'];

  sandpackFiles['/hooks-shim.ts'] = HOOKS_SHIM;
  sandpackFiles['/lib-utils-shim.ts'] = LIB_UTILS_SHIM;
  sandpackFiles['/ui-shim.tsx'] = UI_COMPONENTS_SHIM;
  sandpackFiles['/radix-shim.tsx'] = RADIX_PREVIEW_SHIM;

  // Canonical tsconfig so consumers (and tests) can rely on the modern
  // automatic JSX runtime being active. The per-file `forceClassicReactJsxRuntime`
  // pass adds `/** @jsx React.createElement */` pragmas at the top of source
  // files when it needs the classic transform — tsconfig stays on `react-jsx`.
  if (!sandpackFiles['/tsconfig.json']) {
    sandpackFiles['/tsconfig.json'] = JSON.stringify({
      compilerOptions: {
        target: 'ES2020',
        lib: ['ES2020', 'DOM', 'DOM.Iterable'],
        module: 'ESNext',
        moduleResolution: 'bundler',
        jsx: 'react-jsx',
        strict: false,
        skipLibCheck: true,
        isolatedModules: true,
        resolveJsonModule: true,
        baseUrl: '.',
        paths: { '@/*': ['./*'] },
      },
      include: ['.'],
    }, null, 2);
  }


  // ── SAFETY: Strip Router wrappers from ALL VFS files ──
  // DEFAULT_INDEX (always installed at /index.tsx) wraps <App /> in a
  // __RouterGuard that mounts a single canonical <HashRouter>. Any additional
  // <BrowserRouter>/<HashRouter>/<MemoryRouter> inside App.tsx or page
  // components creates a nested-router situation. In React Router v6 the
  // inner router either throws ("You cannot render a <Router> inside another
  // <Router>") or silently desyncs from `hashchange` — clicks update the URL
  // but routes never re-render and the preview-nav-bridge appears
  // "disconnected" (matches the wizard-handoff regression). Strip routers from
  // EVERY *.tsx/*.jsx file so the RouterGuard is the sole router host.
  // <Routes>/<Route>/<Link>/<Navigate> are preserved so the canonical wizard
  // App.tsx — `<HashRouter><Routes>…</Routes></HashRouter>` — becomes
  // `<Routes>…</Routes>` inside the guard's router and multi-page navigation
  // (plus the INTENT_TRIGGER → navigateToBuilderPage round-trip) works again.
  for (const [filePath, content] of Object.entries(sandpackFiles)) {
    if (preserveSavedBootstrap) {
      // Preserve the authored provider/router tree. Browser history inside the
      // runner starts at /sandpack/index.html, so use hash history in the overlay.
      if (/\.(tsx?|jsx?)$/.test(filePath)) sandpackFiles[filePath] = content.replace(
        /import\s*\{[^}]*\}\s*from\s*['"]react-router-dom['"]/g,
        (statement) => statement.replace(/\bBrowserRouter\b(?:\s+as\s+(\w+))?/g,
          (_match, alias) => `HashRouter as ${alias || 'BrowserRouter'}`),
      );
      continue;
    }
    if (!/\.(tsx?|jsx?)$/.test(filePath)) continue;
    if (filePath === '/index.tsx' || filePath === '/index.jsx') continue;
    if (filePath === '/hooks-shim.ts' || filePath === '/lib-utils-shim.ts' || filePath === '/ui-shim.tsx') continue;

    // Detect aliased router imports like `BrowserRouter as Router`
    const aliasMatch = content.match(/(?:BrowserRouter|HashRouter|MemoryRouter)\s+as\s+(\w+)/);
    const routerAlias = aliasMatch ? aliasMatch[1] : null;

    // Build list of all Router-like tag names to strip
    const routerTags = ['BrowserRouter', 'HashRouter', 'MemoryRouter'];
    if (routerAlias && !routerTags.includes(routerAlias)) {
      routerTags.push(routerAlias);
    }
    const routerTagPattern = routerTags.join('|');
    const tagRegex = new RegExp(`<(?:${routerTagPattern})(?:\\s[^>]*)?>`, '');

    if (tagRegex.test(content)) {
      const fixed = content
        .replace(/import\s*\{[^}]*(?:BrowserRouter|HashRouter|MemoryRouter)[^}]*\}\s*from\s*['"]react-router-dom['"];?\n?/g, (match) => {
          // Keep non-Router imports from the same line
          const keepTokens = ['Routes', 'Route', 'Link', 'Navigate', 'useNavigate', 'useLocation', 'useParams', 'NavLink', 'Outlet'];
          const otherImports = match.match(new RegExp(`\\b(?:${keepTokens.join('|')})\\b`, 'g'));
          if (otherImports && otherImports.length > 0) {
            return `import { ${Array.from(new Set(otherImports)).join(', ')} } from 'react-router-dom';\n`;
          }
          return '';
        })
        .replace(new RegExp(`<(?:${routerTagPattern})(?:\\s[^>]*)?>`, 'g'), '')
        .replace(new RegExp(`</(?:${routerTagPattern})>`, 'g'), '');
      if (fixed !== content) {
        sandpackFiles[filePath] = fixed;
      }
    }
  }

  // ── REWRITE self-referencing relative imports ──
  // AI often writes `import Services from './Services'` inside
  // `/src/pages/Services.tsx`, which self-imports and evaluates to undefined
  // at render time (React: "Element type is invalid ... Check the render
  // method of Services"). Redirect to /components/<Name> when available.
  rewriteSelfReferencingImports(sandpackFiles);

  // ── AUTO-INJECT imports for JSX-used but un-imported components ──
  autoInjectMissingJsxImports(sandpackFiles);

  // Missing relative imports must surface as preview diagnostics. Do not
  // synthesize fallback/template components into wizard-generated sites.
  // EXCEPTION: the in-builder AI Builder commonly writes a file that
  // references a sibling module before creating it. To prevent
  // "Could not find module" crashes from killing the preview, we synthesize
  // a minimal `() => null` placeholder (NOT a fake chip). Authors see the
  // empty slot and replace it on the next turn.
  // Foundation primitives imported from an unauthored relative path are an
  // import-specifier mistake, not a missing module. Normalize them onto the
  // canonical barrel here too: sandpackFiles may be projected from the sealed
  // snapshot rather than the argument map.
  Object.assign(sandpackFiles, normalizeFoundationLocalImports(sandpackFiles));

  synthesizeMissingLocalImports(
    sandpackFiles,
    {
      failOnMissingImport: cssResolution.isWizardDraft,
      themeModule: buildCanonicalThemeModule(resolvedPresetId || cssResolution.themePresetId),
      iconModule: buildCanonicalIconModule(),
      sharedModules: buildCanonicalWizardChromeModules(),
    },
  );

  for (const [filePath, content] of Object.entries(sandpackFiles)) {
    if (/\.(tsx?|jsx?)$/.test(filePath)) {
      sandpackFiles[filePath] = repairMalformedDefaultExportClosures(content);
    }
  }

  repairLocalImportContracts(sandpackFiles);
  assertLocalJsxImportContracts(sandpackFiles);


  // ── SAFETY: Validate App.tsx has a default export ──
  // If AI-generated App.tsx only uses named exports (e.g., `export function App`),
  // `import App from './App'` in index.tsx resolves to undefined → crash.
  const appContent = sandpackFiles['/App.tsx'] || sandpackFiles['/App.jsx'] || '';
  if (appContent && !appContent.includes('export default')) {
    const appPath = sandpackFiles['/App.tsx'] ? '/App.tsx' : '/App.jsx';
    const ensured = ensureDefaultExportForReactModule(appContent, appPath);
    if (ensured !== appContent) {
      const exportName = findBestComponentExportName(appContent, appPath);
      sandpackFiles[appPath] = ensured;
      console.warn(`[sandpackFilePrep] App.tsx missing default export — added: export default ${exportName}`);
    } else {
      // No usable export found — leave AI content untouched. The DEFAULT_INDEX
      // entry shell will surface a "No renderable component" diagnostic with
      // the actual source, instead of replacing the wizard output with a
      // fallback template (per "no fallback" architecture).
      console.warn('[sandpackFilePrep] App.tsx has no detectable component export — leaving AI content untouched');
    }
  }

  // ── SAFETY: Validate ALL generated .tsx/.jsx files have a default export ──
  // Prevents "Element type is invalid" when any component is default-imported.
  for (const [filePath, content] of Object.entries(sandpackFiles)) {
    if (!/\.(tsx|jsx)$/.test(filePath)) continue;
    if (filePath === '/index.tsx' || filePath === '/hooks-shim.ts') continue;
    if (content.includes('export default')) continue;

    sandpackFiles[filePath] = ensureDefaultExportForReactModule(content, filePath);
  }

  // The default-export completion pass above can make one more import rewrite
  // possible. Reconcile again, then fail with the exact file/symbol pair before
  // React receives an undefined JSX element type.
  repairLocalImportContracts(sandpackFiles);
  assertLocalJsxImportContracts(sandpackFiles);

  // ── CLEANUP: Remove unused imports from VFS files ──
  // AI often imports components/icons it doesn't actually use in the template,
  // producing "'X' is declared but its value is never read" warnings.
  for (const [filePath, content] of Object.entries(sandpackFiles)) {
    if (!/\.(tsx|jsx|ts|js)$/.test(filePath)) continue;
    options?.onProgress?.('checking imports', filePath);
    sandpackFiles[filePath] = removeUnusedImports(content);
  }

  // ── CLEANUP: Strip non-null assertions from .jsx files ──
  // TypeScript non-null assertions (foo!) are invalid in plain .jsx files.
  for (const [filePath, content] of Object.entries(sandpackFiles)) {
    if (!filePath.endsWith('.jsx')) continue;
    // Replace non-null assertions: identifier! followed by . or [ or ) or , or ;
    sandpackFiles[filePath] = content.replace(/(\w)!(?=[[.),;\s}])/g, '$1');
  }

  // Ensure template.css exists if any file imports it
  const anyImportsTemplateCss = Object.values(sandpackFiles).some(c =>
    typeof c === 'string' && /import\s+['"]\.\/template\.css['"]/.test(c)
  );
  if (anyImportsTemplateCss && !sandpackFiles['/template.css']) {
    sandpackFiles['/template.css'] = '/* template styles */\n';
  }

  // Ensure index.html exists with Tailwind CDN + semantic theme config
  if (!sandpackFiles['/index.html']) {
    sandpackFiles['/index.html'] = PREVIEW_INDEX_HTML;
  } else {
    sandpackFiles['/index.html'] = ensureSemanticTailwindPreviewHtml(sandpackFiles['/index.html']);
  }

  // ── FINAL SAFETY: Detect any remaining JSON wrappers that leaked through ──
  // This catches cases where the unwrapping logic missed nested or double-serialized JSON.
  for (const [filePath, content] of Object.entries(sandpackFiles)) {
    if (!/\.(tsx|jsx|ts|js)$/.test(filePath)) continue;
    if (typeof content === 'string' && content.trim().startsWith('{"files"')) {
      console.error(
        `[sandpackFilePrep] CRITICAL: File ${filePath} still contains unparsed JSON! ` +
        `First 100 chars: ${content.substring(0, 100)}`
      );
      // Try one more aggressive unwrap
      try {
        const parsed = JSON.parse(content);
        if (parsed?.files && typeof parsed.files === 'object') {
          const unwrapped = recursivelyUnwrapJson(content, filePath);
          if (unwrapped !== content) {
            console.warn(`[sandpackFilePrep] Applied final unwrap to ${filePath}`);
            sandpackFiles[filePath] = unwrapped;
          }
        }
      } catch (e) {
        console.error(`[sandpackFilePrep] Final unwrap attempt failed for ${filePath}:`, (e as Error).message);
      }
    }
  }

  console.log('[sandpackFilePrep] Prepared files:', Object.keys(sandpackFiles));
  options?.onProgress?.('applying runtime shims');
  const prepared = applySandpackRuntimeShims(sandpackFiles);
  if (hasApp) {
    if (preparedFilesCache.size >= PREPARED_FILES_CACHE_LIMIT) preparedFilesCache.clear();
    // Store a copy — `prepared` escapes to the caller, who may mutate it
    // in place (e.g. Preview's debug metadata injection), which would
    // otherwise leak into every later cache hit for this content.
    preparedFilesCache.set(preparedCacheKey, { ...prepared });
  }
  return prepared;
}

// ─────────────────────────────────────────────────────────────────────────────
// RECURSIVE JSON UNWRAPPER: Handle deeply nested JSON strings
// When a file's content is itself a JSON object with a "files" structure,
// extract and recursively unwrap the actual component code.
// ─────────────────────────────────────────────────────────────────────────────
function recursivelyUnwrapJson(content: string, hintPath?: string, depth = 0): string {
  // Prevent infinite recursion
  if (depth > 5) {
    console.warn(`[recursivelyUnwrapJson] Max depth (5) reached, returning content as-is`);
    return content;
  }

  // Check if content is a JSON string
  if (typeof content !== 'string') return content;
  if (!content.trim().startsWith('{')) return content;
  if (content.trim().length < 50) return content; // Too small to be meaningful JSON

  try {
    const parsed = JSON.parse(content);
    
    // If it's a files object, extract the appropriate file
    if (parsed && typeof parsed === 'object' && parsed.files && typeof parsed.files === 'object') {
      const files = parsed.files as Record<string, string>;
      let extractedContent: string | undefined;
      
      // Strategy 1: If hint path provided, try exact paths variations
      if (hintPath) {
        const variations = [
          hintPath,
          '/' + hintPath.replace(/^\//, ''),
          hintPath.replace(/^\/src\//, '/'),
          '/' + hintPath.replace(/^\//, '').replace(/^src\//, ''),
          'src/' + hintPath.replace(/^\/|^src\//, ''),
          hintPath.split('/').pop(), // Just filename
        ];
        for (const variant of variations) {
          if (files[variant]) {
            extractedContent = files[variant];
            break;
          }
        }
      }
      
      // Strategy 2: If no hint or hint didn't work, find the most likely file
      // (usually the file with most content, or .tsx/.jsx files first)
      if (!extractedContent) {
        const sortedFiles = Object.entries(files)
          .sort(([aPath], [bPath]) => {
            const aIsTsx = /\.(tsx|jsx)$/.test(aPath);
            const bIsTsx = /\.(tsx|jsx)$/.test(bPath);
            if (aIsTsx && !bIsTsx) return -1;
            if (!aIsTsx && bIsTsx) return 1;
            return (files[bPath]?.length || 0) - (files[aPath]?.length || 0); // Longer first
          });
        
        if (sortedFiles.length > 0) {
          extractedContent = sortedFiles[0][1];
        }
      }
      
      if (extractedContent && typeof extractedContent === 'string') {
        // Recursively unwrap the extracted content in case it's also JSON-wrapped
        return recursivelyUnwrapJson(extractedContent, hintPath, depth + 1);
      }
    }
    
    // If it's just plain JSON (not a files object), return original
    return content;
  } catch {
    // Not valid JSON — return as-is
    return content;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SiteBundle → VFS Compiler
// ═══════════════════════════════════════════════════════════════════════════════
// This is the CANONICAL path for SiteBundle → preview. All preview rendering
// flows through prepareSandpackFiles(). This function converts a SiteBundle
// into a standard /src/ VFS that prepareSandpackFiles() can then compile into
// a Sandpack-ready overlay.
//
// Architecture:
//   SiteBundle → compileSiteBundleToVFS() → /src/ VFS → prepareSandpackFiles() → Sandpack
//
// There is NO alternative preview path. The old SandpackRuntimeWrapper has been removed.
// ═══════════════════════════════════════════════════════════════════════════════

interface SiteBundlePage {
  path: string;
  title?: string;
  source?: { kind?: string; content?: string };
  output?: { html?: string; react?: string };
  sections?: Array<{ type: string; html?: string }>;
}

interface SiteBundleCompileConfig {
  siteBundle: {
    pages?: Record<string, SiteBundlePage> | SiteBundlePage[];
    theme?: Record<string, any>;
    metadata?: { name?: string; industry?: string };
  };
  entryPath?: string;
  debug?: boolean;
}

function readThemeValue(theme: Record<string, any>, key: string): string | null {
  const flat = theme[key] ?? theme[`--${key}`];
  if (typeof flat === 'string' && flat.trim()) return flat.trim();
  const camel = key.replace(/-([a-z])/g, (_, char: string) => char.toUpperCase());
  const nestedColor = theme.colors?.[camel];
  if (typeof nestedColor === 'string' && nestedColor.trim()) return nestedColor.trim();
  if (key === 'radius' && typeof theme.radius === 'string') return theme.radius.trim();
  if (key === 'font-heading' && typeof theme.typography?.headingFont === 'string') return theme.typography.headingFont.trim();
  if (key === 'font-body' && typeof theme.typography?.bodyFont === 'string') return theme.typography.bodyFont.trim();
  return null;
}

function siteBundleThemeToCss(theme: Record<string, any> | undefined): string {
  if (!theme || Object.keys(theme).length === 0) {
    throw new PreviewPipelineError(
      'vfs',
      'SiteBundle is missing theme tokens — refusing to compile a default/minimal template preset.',
      { recoverableByRelaunch: true },
    );
  }

  const semanticKeys = [
    'background',
    'foreground',
    'card',
    'card-foreground',
    'primary',
    'primary-foreground',
    'secondary',
    'secondary-foreground',
    'muted',
    'muted-foreground',
    'accent',
    'accent-foreground',
    'border',
  ];
  const vars = new Map<string, string>();
  for (const key of semanticKeys) {
    const value = readThemeValue(theme, key);
    if (value) vars.set(key, value);
  }
  const radius = readThemeValue(theme, 'radius') || '0.75rem';
  const headingFont = readThemeValue(theme, 'font-heading') || 'ui-sans-serif, system-ui, sans-serif';
  const bodyFont = readThemeValue(theme, 'font-body') || 'ui-sans-serif, system-ui, sans-serif';

  if (!vars.has('background') || !vars.has('foreground') || !vars.has('primary') || !vars.has('border')) {
    throw new PreviewPipelineError(
      'vfs',
      'SiteBundle theme tokens are incomplete — refusing to compile a default/minimal template preset.',
      { recoverableByRelaunch: true, cause: { missingKeys: semanticKeys.filter((key) => !vars.has(key)) } },
    );
  }

  const background = vars.get('background')!;
  const foreground = vars.get('foreground')!;
  const border = vars.get('border')!;
  vars.set('card', vars.get('card') || background);
  vars.set('card-foreground', vars.get('card-foreground') || foreground);
  vars.set('primary-foreground', vars.get('primary-foreground') || foreground);
  vars.set('secondary', vars.get('secondary') || vars.get('primary')!);
  vars.set('secondary-foreground', vars.get('secondary-foreground') || foreground);
  vars.set('muted', vars.get('muted') || background);
  vars.set('muted-foreground', vars.get('muted-foreground') || foreground);
  vars.set('accent', vars.get('accent') || vars.get('secondary')!);
  vars.set('accent-foreground', vars.get('accent-foreground') || foreground);
  vars.set('input', readThemeValue(theme, 'input') || border);
  vars.set('ring', readThemeValue(theme, 'ring') || vars.get('primary')!);

  const themeVars = Array.from(vars.entries())
    .map(([key, value]) => `  --${key}: ${value};`)
    .join('\n');

  return [
    '@tailwind base;',
    '@tailwind components;',
    '@tailwind utilities;',
    '',
    ':root {',
    themeVars,
    `  --radius: ${radius};`,
    `  --font-heading: ${headingFont};`,
    `  --font-body: ${bodyFont};`,
    '}',
    '',
    '* { border-color: hsl(var(--border)); }',
    'html, body { min-height: 100vh; margin: 0; background: hsl(var(--background)); color: hsl(var(--foreground)); font-family: var(--font-body); }',
    'h1, h2, h3, h4, h5, h6 { font-family: var(--font-heading); }',
    '',
  ].join('\n');
}

/**
 * Compile a SiteBundle into a source VFS (/src/ structure).
 * The result can be passed directly to prepareSandpackFiles() for Sandpack rendering,
 * or stored in the VFS context for editor use.
 *
 * This replaces the old SandpackRuntimeWrapper.generateSandpackFiles().
 */
export function compileSiteBundleToVFS(config: SiteBundleCompileConfig): Record<string, string> {
  const { siteBundle, entryPath = '/', debug = false } = config;
  const pages: SiteBundlePage[] = siteBundle.pages
    ? Array.isArray(siteBundle.pages) ? siteBundle.pages : Object.values(siteBundle.pages)
    : [];

  if (pages.length === 0) {
    throw new PreviewPipelineError(
      'vfs',
      'SiteBundle contains no pages — refusing to compile a default/minimal template.',
      { recoverableByRelaunch: true },
    );
  }

  const vfs: Record<string, string> = {};

  // 1. Generate page components
  for (const page of pages) {
    const compName = sanitizeSiteBundleComponentName(page.path);
    const fileName = sanitizeSiteBundleFilename(page.path);

    let pageCode: string;
    if (page.output?.react) {
      pageCode = page.output.react;
    } else if (page.source?.kind === 'react_tsx' && page.source.content?.trim()) {
      pageCode = page.source.content;
    } else {
      const html = page.output?.html || (page.source?.kind === 'html' ? page.source.content : undefined);
      if (!html) {
        throw new PreviewPipelineError(
          'vfs',
          `SiteBundle page "${page.path}" has no generated React or HTML output — refusing to emit placeholder content.`,
          { blockedFiles: ['/src/pages/' + fileName + '.tsx'], recoverableByRelaunch: true },
        );
      }
      const jsx = html
        .replace(/ class="/g, ' className="')
        .replace(/<!--([\s\S]*?)-->/g, '{/* $1 */}')
        .replace(/<br>/gi, '<br />')
        .replace(/<hr>/gi, '<hr />')
        .replace(/<img([^>]*?)(?<!\/)>/gi, '<img$1 />');

      pageCode = [
        "import React from 'react';",
        '',
        'export default function ' + compName + '() {',
        '  return (',
        '    <div className="page-container min-h-screen">',
        '      ' + jsx,
        '    </div>',
        '  );',
        '}',
      ].join('\n');
    }

    vfs['/src/pages/' + fileName + '.tsx'] = pageCode;
  }

  // 2. Generate App.tsx with routing
  const importLines = pages.map(p => {
    const name = sanitizeSiteBundleComponentName(p.path);
    const file = sanitizeSiteBundleFilename(p.path);
    return 'import ' + name + " from './pages/" + file + "';";
  });

  const routeLines = pages.map(p => {
    const name = sanitizeSiteBundleComponentName(p.path);
    return '        <Route path="' + p.path + '" element={<' + name + ' />} />';
  });

  vfs['/src/App.tsx'] = [
    "import React from 'react';",
    "import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';",
    ...importLines,
    '',
    'export default function App() {',
    '  return (',
    '    <HashRouter>',
    '      <Routes>',
    ...routeLines,
    '        <Route path="*" element={<Navigate to="' + entryPath + '" replace />} />',
    '      </Routes>',
    '    </HashRouter>',
    '  );',
    '}',
  ].join('\n');

  // 3. Generate main.tsx entry
  vfs['/src/main.tsx'] = [
    "import React from 'react';",
    "import ReactDOM from 'react-dom/client';",
    "import App from './App';",
    "import './index.css';",
    '',
    "ReactDOM.createRoot(document.getElementById('root')!).render(",
    '  <React.StrictMode>',
    '    <App />',
    '  </React.StrictMode>',
    ');',
  ].join('\n');

  // 4. Generate index.css from SiteBundle theme tokens only. No default
  // template preset is allowed here — SiteBundle/wizard context is authority.
  const css = siteBundleThemeToCss(siteBundle.theme);
  vfs['/src/index.css'] = css;

  if (debug) {
    console.log('[compileSiteBundleToVFS] Generated VFS:', Object.keys(vfs));
  }

  return vfs;
}

function sanitizeSiteBundleFilename(path: string): string {
  if (path === '/' || path === '') return 'Home';
  return path.replace(/^\//, '').replace(/\//g, '-').replace(/[^\w-]/g, '').replace(/^-+|-+$/g, '') || 'Page';
}

function sanitizeSiteBundleComponentName(path: string): string {
  const filename = sanitizeSiteBundleFilename(path);
  const pascalName = filename
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join('');
  return (pascalName || 'Page') + 'Page';
}

// ═══════════════════════════════════════════════════════════════════════════════
// Canonical Launcher → Preview Compiler
// ═══════════════════════════════════════════════════════════════════════════════
// This is the SINGLE function that all launchers should call to produce a
// Sandpack-ready preview bundle. It combines normalization + compilation in
// one step, driven by a RuntimeManifest.
//
// Nothing else is allowed to feed Sandpack directly.
// ═══════════════════════════════════════════════════════════════════════════════

import type { RuntimeManifest, LauncherHandoff } from '@/types/runtimeManifest';

/**
 * The ONE canonical function that converts launcher output into a Sandpack-ready
 * preview bundle. All preview paths must flow through here.
 *
 * Usage:
 *   const { previewFiles, manifest } = compileLauncherOutputForPreview(handoff);
 *   // Feed previewFiles to Sandpack
 *   // Use manifest for engine selection, route awareness, etc.
 */
export function compileLauncherOutputForPreview(
  handoff: Pick<LauncherHandoff, 'sourceFiles' | 'runtimeManifest' | 'siteBundle'>
): { previewFiles: Record<string, string>; manifest: RuntimeManifest } {
  const { sourceFiles, runtimeManifest, siteBundle } = handoff;

  // Step 1: If we have a SiteBundle, compile it to source VFS and merge
  const mergedSource = { ...sourceFiles };
  if (siteBundle) {
    const siteBundleVFS = compileSiteBundleToVFS({
      siteBundle,
      entryPath: runtimeManifest.routes[0] || '/',
    });
    // SiteBundle VFS fills gaps — source files take priority
    for (const [path, content] of Object.entries(siteBundleVFS)) {
      if (!mergedSource[path]) {
        mergedSource[path] = content;
      }
    }
  }

  // Step 2: Normalize launcher files (fix paths, add entry files, repair images)
  const themePresetId =
    runtimeManifest.appContext?.themePresetId ||
    runtimeManifest.aesthetic ||
    null;
  const normalized = normalizeLauncherFiles(mergedSource, {
    entryPoint: runtimeManifest.entryPoint,
    themePresetId,
  });

  // Step 3: Compile to Sandpack overlay (flatten /src/, inject shims, apply themed CSS, etc.)
  const previewFiles = prepareSandpackFiles(normalized, {
    strict: true,
    entryPoint: runtimeManifest.entryPoint,
    aesthetic: runtimeManifest.aesthetic,  // legacy alias
    themePresetId,                         // canonical source of truth
  });

  console.log('[compileLauncherOutputForPreview] Compiled preview:', {
    sourceFileCount: Object.keys(sourceFiles).length,
    previewFileCount: Object.keys(previewFiles).length,
    engine: runtimeManifest.previewEngine,
    routes: runtimeManifest.routes,
    backendRequired: runtimeManifest.backendRequired,
    aesthetic: runtimeManifest.aesthetic,
  });

  return { previewFiles, manifest: runtimeManifest };
}
