/**
 * Canonical SiteShell topology projection (P0.6).
 *
 * Route truth is owned by the PageRegistry alone. Design artifacts own how the
 * navbar and footer LOOK; the business runtime owns identity and CTA intents;
 * Lane B owns the page body. None of them own which routes exist.
 *
 * This module projects the registry into the one navigation shape every
 * consumer must use (generation brief, Lane B prompts, navbar/footer
 * renderers, router, published sitemap) and asserts closure between them, so
 * "Wizard selected pages = router routes = visible chrome" is checkable
 * instead of hoped for.
 *
 * It creates no new registry and no new writer — it is a pure projection of
 * the existing canonical PageRegistry.
 */

import type { PageRegistry, BuilderPage } from '@/types/pageRegistry';

export interface SiteShellRoute {
  pageId: string;
  /** Visitor-facing route path, e.g. "/about". */
  path: string;
  /** HashRouter href the page body must use, e.g. "#/about". */
  href: string;
  /** VFS module path, e.g. "/src/pages/About.tsx". */
  filePath: string;
  label: string;
  isHome: boolean;
  showInNav: boolean;
  navOrder: number;
}

export interface SiteShellTopology {
  home: SiteShellRoute | null;
  /** Every registered route, nav order. */
  routes: SiteShellRoute[];
  /** Links the primary navbar must render, in order. */
  primaryNav: SiteShellRoute[];
  /** Links the footer must render — every route, including hidden-from-nav utility pages is excluded. */
  footerNav: SiteShellRoute[];
}

export interface SiteShellClosureViolation {
  code:
    | 'stale-chrome-link'
    | 'missing-nav-link'
    | 'duplicate-primary-navbar'
    | 'duplicate-footer'
    | 'router-route-missing'
    | 'router-route-unknown';
  message: string;
  pageId?: string;
  path?: string;
}

const NAV_HIDDEN_PAGE_TYPES = new Set(['checkout', 'thankyou', 'confirmation']);

function toHref(path: string): string {
  if (!path) return '#/';
  if (path.startsWith('#')) return path;
  return `#${path.startsWith('/') ? path : `/${path}`}`;
}

function derivedFilePath(page: BuilderPage): string {
  if (page.filePath) return page.filePath;
  const slug = (page.path || '/').replace(/^\//, '') || 'home';
  const name = slug
    .split(/[-/]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('') || 'Home';
  return `/src/pages/${page.isHome ? 'Home' : name}.tsx`;
}

/** Project the canonical PageRegistry into the site shell navigation model. */
export function buildSiteShellTopology(registry: PageRegistry): SiteShellTopology {
  const routes: SiteShellRoute[] = Object.values(registry.pages ?? {})
    .map((page) => ({
      pageId: page.pageId,
      path: page.path || '/',
      href: toHref(page.path),
      filePath: derivedFilePath(page),
      label: page.title || page.path || '/',
      isHome: Boolean(page.isHome),
      showInNav: page.showInNav !== false && !NAV_HIDDEN_PAGE_TYPES.has(String(page.pageType)),
      navOrder: typeof page.navOrder === 'number' ? page.navOrder : 0,
    }))
    .sort((left, right) => left.navOrder - right.navOrder || left.path.localeCompare(right.path));

  return {
    home: routes.find((route) => route.isHome) ?? null,
    routes,
    primaryNav: routes.filter((route) => route.showInNav),
    footerNav: routes.filter((route) => route.showInNav),
  };
}

const INTERNAL_HREF = /(?:href\s*=\s*|["']href["']\s*:\s*)["'](#?\/[^"'#?]*)["']/g;

function normalizeLinkPath(raw: string | undefined | null): string {
  if (!raw) return '/';
  const withoutHash = raw.startsWith('#') ? raw.slice(1) : raw;
  const trimmed = withoutHash.split('?')[0].replace(/\/+$/, '');
  return trimmed || '/';
}

const SECTIONING_TAGS = new Set(['main', 'section', 'article', 'aside']);

/** Count page-level chrome landmarks; <header>/<footer> nested in sectioning content are not site chrome. */
function countChromeLandmarks(source: string, tag: 'header' | 'footer', extra?: RegExp): number {
  let depth = 0;
  let count = extra ? (source.match(extra)?.length ?? 0) : 0;
  for (const match of source.matchAll(/<(\/?)(main|section|article|aside|header|footer)\b[^>]*?(\/?)>/g)) {
    const [, closing, name, selfClosing] = match;
    if (SECTIONING_TAGS.has(name)) {
      if (!selfClosing) depth = Math.max(0, depth + (closing ? -1 : 1));
    } else if (name === tag && !closing && depth === 0) {
      count += 1;
    }
  }
  return count;
}

/**
 * Deterministic closure assertion: page chrome links, router routes and the
 * registry projection must describe exactly the same site.
 */
export function assertSiteShellClosure(
  topology: SiteShellTopology,
  input: {
    /** Authored page sources keyed by VFS path. */
    pageSources?: Record<string, string>;
    /** Route paths the generated router actually renders. */
    routerRoutes?: readonly string[];
  } = {},
): SiteShellClosureViolation[] {
  const violations: SiteShellClosureViolation[] = [];
  const known = new Set(topology.routes.map((route) => normalizeLinkPath(route.path)));
  known.add('/');

  for (const [filePath, source] of Object.entries(input.pageSources ?? {})) {
    if (!source) continue;
    const route = topology.routes.find((candidate) => candidate.filePath === filePath);

    const linked = new Set<string>();
    for (const match of source.matchAll(INTERNAL_HREF)) {
      const linkPath = normalizeLinkPath(match[1]);
      linked.add(linkPath);
      if (!known.has(linkPath)) {
        violations.push({
          code: 'stale-chrome-link',
          message: `${filePath} links to "${match[1]}", which is not a registered route.`,
          pageId: route?.pageId,
          path: linkPath,
        });
      }
    }

    for (const navRoute of topology.primaryNav) {
      const navPath = normalizeLinkPath(navRoute.path);
      if (navPath === '/' || linked.has(navPath)) continue;
      violations.push({
        code: 'missing-nav-link',
        message: `${filePath} chrome omits the registered nav route "${navRoute.path}" (${navRoute.label}).`,
        pageId: navRoute.pageId,
        path: navRoute.path,
      });
    }

    const navbarCount = countChromeLandmarks(source, 'header', /<FloatingNavbar\b/g);
    if (navbarCount > 1) {
      violations.push({
        code: 'duplicate-primary-navbar',
        message: `${filePath} renders ${navbarCount} competing primary nav bars.`,
        pageId: route?.pageId,
      });
    }
    const footerCount = countChromeLandmarks(source, 'footer');
    if (footerCount > 1) {
      violations.push({
        code: 'duplicate-footer',
        message: `${filePath} renders ${footerCount} footers.`,
        pageId: route?.pageId,
      });
    }
  }

  if (input.routerRoutes) {
    const routerSet = new Set(input.routerRoutes.map(normalizeLinkPath));
    for (const route of topology.routes) {
      if (!routerSet.has(normalizeLinkPath(route.path))) {
        violations.push({
          code: 'router-route-missing',
          message: `Router does not render the registered route "${route.path}" (${route.label}).`,
          pageId: route.pageId,
          path: route.path,
        });
      }
    }
    for (const routerRoute of routerSet) {
      if (routerRoute !== '/' && routerRoute !== '*' && !known.has(routerRoute)) {
        violations.push({
          code: 'router-route-unknown',
          message: `Router renders "${routerRoute}", which is not in the PageRegistry.`,
          path: routerRoute,
        });
      }
    }
  }

  return violations;
}

/** Human/AI-readable navigation contract line used by every generation lane. */
export function describeSiteShellNavigation(topology: SiteShellTopology): string {
  const primary = topology.primaryNav.map((route) => `${route.label} → ${route.href}`).join(' | ') || 'none';
  const hidden = topology.routes
    .filter((route) => !route.showInNav)
    .map((route) => `${route.label} → ${route.href}`)
    .join(' | ');
  return [
    `Primary navigation (PageRegistry order, exact labels and hrefs): ${primary}.`,
    hidden ? `Hidden from nav (reachable only from in-page CTAs): ${hidden}.` : '',
    'These links are route truth. Never invent, rename, drop, reorder or re-point them; design freedom applies to the presentation only.',
  ]
    .filter(Boolean)
    .join(' ');
}

// ---------------------------------------------------------------------------
// Deterministic chrome-link projection
// ---------------------------------------------------------------------------

function findMatchingBracket(source: string, open: number): number {
  let depth = 0;
  let quote: string | null = null;
  for (let i = open; i < source.length; i += 1) {
    const ch = source[i];
    if (quote) {
      if (ch === '\\') { i += 1; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
    if (ch === '[') depth += 1;
    else if (ch === ']') { depth -= 1; if (depth === 0) return i; }
  }
  return -1;
}

function navArrayLiteral(routes: SiteShellRoute[], indent: string, jsonStyle: boolean): string {
  if (routes.length === 0) return '[]';
  const q = (value: string) => JSON.stringify(value);
  const key = (name: string) => (jsonStyle ? q(name) : name);
  const items = routes.map(
    (route) => `${indent}  { ${key('label')}: ${q(route.label)}, ${key('href')}: ${q(route.href)} }`,
  );
  return `[\n${items.join(',\n')}\n${indent}]`;
}

const LINK_ITEM = /\{\s*["']?(label|name|title)["']?\s*:\s*(["'])([^"']*)\2\s*,\s*["']?(href|to|path)["']?\s*:\s*(["'])([^"']*)\5\s*,?\s*\}/g;

const CTA_KEYWORDS: Array<[RegExp, string[]]> = [
  [/book|appoint|schedul|reserv/i, ['book', 'appointment', 'schedule', 'reserv']],
  [/contact|quote|lead|call|message|touch/i, ['contact', 'quote']],
  [/shop|cart|buy|order|product|checkout/i, ['shop', 'product', 'store', 'order', 'menu']],
  [/donat|give/i, ['donat', 'give']],
  [/pric|plan|subscri/i, ['pric', 'plan']],
];

/**
 * Resolve the registered route a navbar CTA should open, from its intent and
 * label. Returns null when the site has no matching page (the CTA is dropped
 * rather than pointing at a template default anchor).
 */
export function resolveCtaRoute(
  topology: SiteShellTopology,
  intent: string | undefined,
  label: string | undefined,
  href: string | undefined,
): SiteShellRoute | null {
  const known = topology.routes.filter((route) => !route.isHome);
  const byHref = href ? known.find((route) => normalizeLinkPath(route.path) === normalizeLinkPath(href)) : undefined;
  if (byHref) return byHref;
  const probe = `${intent ?? ''} ${label ?? ''} ${href ?? ''}`;
  for (const [test, keywords] of CTA_KEYWORDS) {
    if (!test.test(probe)) continue;
    const hit = known.find((route) => keywords.some((k) => route.path.toLowerCase().includes(k) || route.label.toLowerCase().includes(k)));
    if (hit) return hit;
  }
  return null;
}

function projectNavbarCta(source: string, from: number, to: number, topology: SiteShellTopology): { source: string; delta: number } {
  const ctaRe = /(["']?)cta\1\s*:\s*\{/g;
  ctaRe.lastIndex = from;
  const m = ctaRe.exec(source);
  if (!m || m.index > to) return { source, delta: 0 };
  const open = m.index + m[0].length - 1;
  let depth = 0; let close = -1; let quote: string | null = null;
  for (let i = open; i < source.length; i += 1) {
    const ch = source[i];
    if (quote) { if (ch === '\\') { i += 1; continue; } if (ch === quote) quote = null; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth += 1;
    else if (ch === '}') { depth -= 1; if (depth === 0) { close = i; break; } }
  }
  if (close === -1) return { source, delta: 0 };
  const body = source.slice(open, close + 1);
  const read = (key: string) => body.match(new RegExp(`["']?${key}["']?\\s*:\\s*["']([^"']*)["']`))?.[1];
  const route = resolveCtaRoute(topology, read('intent'), read('label'), read('href'));
  let next: string;
  if (!route) {
    next = 'null';
  } else if (/["']?href["']?\s*:/.test(body)) {
    next = body.replace(/(["']?href["']?\s*:\s*)(["'])[^"']*\2/, (_s, pre: string, q: string) => `${pre}${q}${route.href}${q}`);
  } else {
    return { source, delta: 0 };
  }
  if (next === body) return { source, delta: 0 };
  return { source: source.slice(0, open) + next + source.slice(close + 1), delta: next.length - body.length };
}

/**
 * Rewrite every navbar/footer link list in page sources so it carries exactly
 * the registry's primary navigation (labels, hrefs, order). Design keeps how
 * the chrome looks; the registry keeps which links it carries. Idempotent.
 */
export function projectSiteShellLinks(
  topology: SiteShellTopology,
  files: Record<string, string>,
): { files: Record<string, string>; changed: string[] } {
  const routes = topology.primaryNav;
  if (routes.length === 0) return { files, changed: [] };
  const known = new Set(topology.routes.map((route) => normalizeLinkPath(route.path)));
  const out: Record<string, string> = { ...files };
  const changed: string[] = [];

  for (const [path, original] of Object.entries(files)) {
    if (!/^\/src\/(pages|project-components)\/.*\.(tsx|jsx)$/.test(path)) continue;
    let source = original;

    // 1. Section-composition chrome: { type: "navbar" | "footer", props: { links: [...] } }
    const typeRe = /["']?type["']?\s*:\s*["'](navbar|header)["']/g;
    let match: RegExpExecArray | null;
    while ((match = typeRe.exec(source))) {
      const nextTypeFor = () => source.slice(match!.index + match![0].length).search(/["']?type["']?\s*:\s*["']/);
      let nextType = nextTypeFor();
      let windowEnd = nextType === -1 ? source.length : match.index + match[0].length + nextType;
      // Navbar CTA must open a page the user selected, never a template anchor.
      const ctaResult = projectNavbarCta(source, match.index, windowEnd, topology);
      if (ctaResult.delta !== 0 || ctaResult.source !== source) {
        source = ctaResult.source;
        nextType = nextTypeFor();
        windowEnd = nextType === -1 ? source.length : match.index + match[0].length + nextType;
      }
      const linksRe = /(["']?)links\1\s*:\s*\[/g;
      linksRe.lastIndex = match.index;
      const linksMatch = linksRe.exec(source);
      if (!linksMatch || linksMatch.index > windowEnd) continue;
      const open = linksMatch.index + linksMatch[0].length - 1;
      const close = findMatchingBracket(source, open);
      if (close === -1) continue;
      const lineStart = source.lastIndexOf('\n', linksMatch.index) + 1;
      const indent = source.slice(lineStart, linksMatch.index).match(/^\s*/)?.[0] ?? '';
      const replacement = navArrayLiteral(routes, indent, linksMatch[1] === '"');
      source = source.slice(0, open) + replacement + source.slice(close + 1);
      typeRe.lastIndex = open + replacement.length;
    }

    // 2. Hand-authored link arrays: [{ label, href }, ...] pointing at site routes.
    source = source.replace(/\[\s*(?:\{[^{}]*\}\s*,?\s*){2,}\]/g, (block, offset: number, whole: string) => {
      const context = whole.slice(Math.max(0, offset - 60), offset);
      if (!/(nav|menu|links)\w*\s*[:=]\s*(\([^)]*\)\s*)?$/i.test(context)) return block;
      const items = Array.from(block.matchAll(LINK_ITEM));
      const count = (block.match(/\{/g) ?? []).length;
      if (items.length !== count) return block;
      const hrefs = items.map((item) => item[6]);
      if (!hrefs.every((href) => /^#?\//.test(href))) return block;
      const matching = hrefs.filter((href) => known.has(normalizeLinkPath(href))).length;
      if (matching < 2) return block;
      const labelKey = items[0][1];
      const hrefKey = items[0][4];
      const jsonStyle = /^\[\s*\{\s*"/.test(block);
      const k = (name: string) => (jsonStyle ? JSON.stringify(name) : name);
      const lineIndent = '  ';
      const body = routes
        // Generated runtime navigation is HashRouter-based. A legacy plain
        // internal path reloads the preview instead of selecting this route.
        .map((route) => `${lineIndent}{ ${k(labelKey)}: ${JSON.stringify(route.label)}, ${k(hrefKey)}: ${JSON.stringify(route.href)} }`)
        .join(',\n');
      return `[\n${body}\n]`;
    });

    if (source !== original) {
      out[path] = source;
      changed.push(path);
    }
  }
  return { files: out, changed };
}
