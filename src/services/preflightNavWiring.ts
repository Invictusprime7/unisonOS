/**
 * Preflight Nav Wiring
 *
 * Runs after `applyWizardBindingsToVfs` in the System Launcher pipeline.
 * Walks every JSX file in the generated VFS and, for any interactive element
 * (button / a / Link / NavLink / motion.button / motion.a) that does NOT yet
 * carry a `data-ut-intent` attribute, attempts to bind it to a real page route
 * in `SiteBundleSnapshot.pageRegistry`.
 *
 * Resolution priority:
 *   1. Anchor `href` / `to` matches a known route.
 *   2. Visible label text matches page title / pageRole alias.
 *   3. Otherwise → skipped with a reason.
 *
 * This is purely additive: elements that already have `data-ut-intent` are
 * left untouched, so explicit snapshot bindings always win.
 */
import * as ts from 'typescript';
import type { SiteBundleSnapshot } from '@/platform/core/canonicalPipeline';
import type { BuilderPage } from '@/types/pageRegistry';
import { PAGE_ROLE_ALIASES, resolveActionPageAffinity } from '@/platform/core/actionAffinity';

type PageId = string;

export interface PreflightNavWiringResult {
  files: Record<string, string>;
  wired: number;
  skipped: Array<{ filePath: string; label: string; reason: string }>;
}

// Tags treated as interactive by exact name.
const INTERACTIVE_TAGS = new Set([
  'button',
  'a',
  'Link',
  'NavLink',
  'RouterLink',
  'HashLink',
  'Button',
  'IconButton',
  'motion.button',
  'motion.a',
  'motion.div', // common pattern: motion.div with onClick used as a button
]);

// Tag-name regex for "button-like" or "link-like" custom components emitted by
// templates and AI scaffolds: PrimaryButton, CtaButton, NavLinkItem,
// ServiceCardLink, BookNowCTA, etc.
const INTERACTIVE_TAG_PATTERN = /(Button|Btn|Link|Cta|CTA|Action|Pill|Chip)/;

function isInteractiveTag(tagName: string, attrs: ts.JsxAttributes): boolean {
  if (INTERACTIVE_TAGS.has(tagName)) return true;
  const base = tagName.split('.').pop() || tagName;
  if (/^[A-Z]/.test(base) && INTERACTIVE_TAG_PATTERN.test(base)) {
    return true;
  }
  // Elements explicitly marked as interactive via ARIA role.
  const role = getAttrValue(attrs, 'role');
  if (role === 'button' || role === 'link' || role === 'menuitem' || role === 'tab') return true;
  // Plain divs/spans with an onClick handler behave as buttons.
  if ((tagName === 'div' || tagName === 'span' || tagName === 'li') && hasAttr(attrs, 'onClick')) {
    return true;
  }
  return false;
}

// Label → pageRole alias map. Lowercased, punctuation-stripped form.
function normalizeText(value: string): string {
  return value
    .replace(/\{[^}]*\}/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[_.\-/#]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function normalizeRoute(path: string): string {
  if (!path || path === '/') return '/';
  const trimmed = path.replace(/\.html?$/i, '').trim();
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

interface PageIndex {
  byTitle: Map<string, BuilderPage>;
  byRoute: Map<string, BuilderPage>; // normalized route → page
  byLabel: Map<string, BuilderPage>; // normalized title/role token → page
}

function buildPageIndex(snapshot: SiteBundleSnapshot): PageIndex {
  const byTitle = new Map<string, BuilderPage>();
  const byRoute = new Map<string, BuilderPage>();
  const byLabel = new Map<string, BuilderPage>();

  for (const page of Object.values(snapshot.pageRegistry.pages)) {
    const route = normalizeRoute(page.path);
    byRoute.set(route, page);
    byRoute.set(route.replace(/^\//, ''), page);

    const title = normalizeText(page.title || '');
    if (title) {
      byTitle.set(title, page);
      byLabel.set(title, page);
    }

    const role = (page.pageRole || page.pageType || '').toString().toLowerCase();
    if (role) {
      byLabel.set(role, page);
      const aliases = PAGE_ROLE_ALIASES[role] || [];
      for (const alias of aliases) {
        if (!byLabel.has(alias)) byLabel.set(alias, page);
      }
    }
  }

  return { byRoute, byLabel, byTitle };
}

function getScriptKind(filePath: string): ts.ScriptKind {
  if (/\.tsx$/i.test(filePath)) return ts.ScriptKind.TSX;
  if (/\.jsx$/i.test(filePath)) return ts.ScriptKind.JSX;
  return ts.ScriptKind.TS;
}

function getTagName(node: ts.JsxTagNameExpression, sf: ts.SourceFile): string {
  return node.getText(sf);
}

function collectStaticText(children: readonly ts.JsxChild[]): string {
  const parts: string[] = [];
  for (const child of children) {
    if (ts.isJsxText(child)) {
      parts.push(child.getText());
    } else if (ts.isJsxExpression(child)) {
      const expr = child.expression;
      if (expr && (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr))) {
        parts.push(expr.text);
      }
    } else if (ts.isJsxElement(child)) {
      parts.push(collectStaticText(child.children));
    } else if (ts.isJsxFragment(child)) {
      parts.push(collectStaticText(child.children));
    }
  }
  return parts.join(' ');
}

interface OpeningTagInfo {
  tagName: string;
  openTagStart: number;
  openTagEnd: number;
  attrs: ts.JsxAttributes;
  text: string;
}

function findOpeningTagStart(content: string, guess: number): number {
  for (let i = guess; i >= 0 && guess - i < 300; i -= 1) {
    if (content[i] === '<') return i;
  }
  return guess;
}

function getAttrValue(attrs: ts.JsxAttributes, name: string): string | undefined {
  for (const prop of attrs.properties) {
    if (!ts.isJsxAttribute(prop) || !prop.name || prop.name.getText() !== name) continue;
    const init = prop.initializer;
    if (!init) return '';
    if (ts.isStringLiteral(init)) return init.text;
    if (ts.isJsxExpression(init) && init.expression) {
      const expr = init.expression;
      if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) return expr.text;
    }
    return undefined;
  }
  return undefined;
}

function hasAttr(attrs: ts.JsxAttributes, name: string): boolean {
  for (const prop of attrs.properties) {
    if (ts.isJsxAttribute(prop) && prop.name && prop.name.getText() === name) return true;
  }
  return false;
}

function resolvePageForElement(
  info: OpeningTagInfo,
  index: PageIndex,
  currentPageId: PageId | null,
): BuilderPage | null {
  // 1. href / to
  const href = getAttrValue(info.attrs, 'href') ?? getAttrValue(info.attrs, 'to');
  if (href && !/^(https?:|mailto:|tel:)/i.test(href)) {
    if (href.startsWith('#')) {
      // Hash-style "page route" links. AI templates and legacy scaffolds
      // frequently generate `href="#services"` / `to="#/pricing"` for what
      // is actually a real, separate page rather than an in-page scroll
      // anchor — treating a multi-page site like a single-page site. A bare
      // `#` (placeholder, no fragment) is never a route.
      const fragment = href.replace(/^#\/?/, '').trim();
      if (!fragment) {
        // A bare placeholder is not a route, but its label can still resolve
        // through the canonical affinity vocabulary below.
      } else {

      // Try resolving the fragment as a route path first (`#/services` →
      // `/services`), then fall back to label matching against the
      // fragment itself (`#book-now` → "book now").
      const route = normalizeRoute(`/${fragment}`);
      const byRoute = index.byRoute.get(route) || index.byRoute.get(route.replace(/^\//, ''));
      if (byRoute && byRoute.pageId !== currentPageId) return byRoute;

      const fragmentLabel = normalizeText(fragment.replace(/[-_]+/g, ' '));
      const byFragmentLabel = fragmentLabel ? index.byLabel.get(fragmentLabel) : undefined;
      if (byFragmentLabel && byFragmentLabel.pageId !== currentPageId) return byFragmentLabel;
      }

      // No page matches this hash fragment — it's most likely a genuine
      // same-page scroll anchor (e.g. `#pricing-table` with no separate
      // Pricing page). Leave it alone; fall through to label matching below
      // only continues to consider the element's visible text, not the
      // hash itself, so we don't accidentally hijack real anchor scrolling.
    } else {
      const route = normalizeRoute(href);
      const page = index.byRoute.get(route) || index.byRoute.get(route.replace(/^\//, ''));
      if (page && page.pageId !== currentPageId) return page;
    }
  }

  // 2. label
  const label = normalizeText(info.text);
  if (!label) return null;
  const direct = index.byLabel.get(label);
  if (direct && direct.pageId !== currentPageId) return direct;
  const affinityCandidates = resolveActionPageAffinity(null, label);
  for (const candidate of affinityCandidates) {
    const page = index.byTitle.get(candidate);
    if (page && page.pageId !== currentPageId) return page;
  }
  for (const candidate of affinityCandidates) {
    const page = index.byLabel.get(candidate);
    if (page && page.pageId !== currentPageId) return page;
  }
  // Token-level fallback
  for (const [alias, page] of index.byLabel) {
    if (page.pageId === currentPageId) continue;
    if (label === alias || label.startsWith(`${alias} `) || label.endsWith(` ${alias}`) || label.includes(` ${alias} `)) {
      return page;
    }
  }
  return null;
}

function inferCurrentPageId(filePath: string, snapshot: SiteBundleSnapshot): PageId | null {
  for (const page of Object.values(snapshot.pageRegistry.pages)) {
    if (page.filePath && (page.filePath === filePath || `/${page.filePath}` === filePath)) {
      return page.pageId;
    }
    if (
      page.isHome &&
      (filePath === '/src/pages/Home.tsx' ||
        filePath === '/pages/Home.tsx' ||
        filePath === '/src/pages/Index.tsx' ||
        filePath === '/src/App.tsx' ||
        filePath === '/App.tsx')
    ) {
      return page.pageId;
    }
  }
  return null;
}

function buildAttrInjection(page: BuilderPage, label: string, attrs: ts.JsxAttributes): string {
  const route = normalizeRoute(page.path);
  const candidates: Array<[string, string]> = [
    ['data-ut-intent', 'nav.goto'],
    ['data-intent', 'nav.goto'],
    ['data-ut-target-page-id', page.pageId],
    ['data-ut-path', route],
    ['data-ut-target-id', page.pageId],
    ['data-ut-target-type', 'page'],
    ['data-ut-ui-action', 'navigate'],
    ['data-ut-preflight', '1'],
  ];
  if (label) candidates.push(['data-ut-label', label.slice(0, 80)]);
  return candidates
    .filter(([name]) => !hasAttr(attrs, name))
    .map(([name, value]) => `${name}="${escapeAttr(value)}"`)
    .join(' ');
}

interface Edit {
  start: number;
  end: number;
  replacement: string;
}

function processFile(
  filePath: string,
  content: string,
  index: PageIndex,
  snapshot: SiteBundleSnapshot,
  result: PreflightNavWiringResult,
): string {
  if (!/\.[jt]sx$/i.test(filePath)) return content;

  let sf: ts.SourceFile;
  try {
    sf = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true, getScriptKind(filePath));
  } catch {
    return content;
  }

  const currentPageId = inferCurrentPageId(filePath, snapshot);
  const edits: Edit[] = [];

  const handleOpening = (
    tagName: string,
    attrs: ts.JsxAttributes,
    openTagStart: number,
    openTagEnd: number,
    text: string,
  ) => {
    if (!isInteractiveTag(tagName, attrs)) return;
    const existingIntent = getAttrValue(attrs, 'data-ut-intent') || getAttrValue(attrs, 'data-intent');
    // Preserve explicit non-navigation bindings. Existing nav.goto bindings are
    // enriched below when their required route/page payload is incomplete.
    if (existingIntent && existingIntent !== 'nav.goto' && existingIntent !== 'nav.goto_page') return;
    if (
      existingIntent
      && hasAttr(attrs, 'data-ut-path')
      && hasAttr(attrs, 'data-ut-target-page-id')
    ) return;

    const info: OpeningTagInfo = { tagName, openTagStart, openTagEnd, attrs, text };
    const page = resolvePageForElement(info, index, currentPageId);

    const labelNorm = normalizeText(text);
    if (!page) {
      // Only report buttons/anchors that have a visible label (skip empty wrappers).
      if (labelNorm) {
        result.skipped.push({ filePath, label: labelNorm.slice(0, 60), reason: 'no-matching-route' });
      }
      return;
    }

    // Inject before the closing `>` of the opening tag.
    // openTagEnd points at the position just after `>`.
    const insertionPoint = openTagEnd - (content[openTagEnd - 2] === '/' ? 2 : 1);
    const attrsToInject = buildAttrInjection(page, text.trim(), attrs);
    if (!attrsToInject) return;
    const injection = ` ${attrsToInject}`;
    edits.push({ start: insertionPoint, end: insertionPoint, replacement: injection });
    result.wired += 1;
  };

  const visit = (node: ts.Node) => {
    if (ts.isJsxElement(node)) {
      const opening = node.openingElement;
      const tagName = getTagName(opening.tagName, sf);
      const start = findOpeningTagStart(content, opening.getStart(sf));
      handleOpening(tagName, opening.attributes, start, opening.getEnd(), collectStaticText(node.children));
    } else if (ts.isJsxSelfClosingElement(node)) {
      const tagName = getTagName(node.tagName, sf);
      const start = findOpeningTagStart(content, node.getStart(sf));
      handleOpening(tagName, node.attributes, start, node.getEnd(), '');
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);

  if (edits.length === 0) return content;

  edits.sort((a, b) => b.start - a.start);
  let next = content;
  for (const edit of edits) {
    next = `${next.slice(0, edit.start)}${edit.replacement}${next.slice(edit.end)}`;
  }
  return next;
}

export function preflightNavWiring(
  files: Record<string, string>,
  snapshot: SiteBundleSnapshot | undefined | null,
): PreflightNavWiringResult {
  const result: PreflightNavWiringResult = { files: { ...files }, wired: 0, skipped: [] };
  if (!snapshot || !snapshot.pageRegistry || Object.keys(snapshot.pageRegistry.pages).length <= 1) {
    return result;
  }

  const index = buildPageIndex(snapshot);

  for (const [filePath, content] of Object.entries(result.files)) {
    if (typeof content !== 'string') continue;
    try {
      result.files[filePath] = processFile(filePath, content, index, snapshot, result);
    } catch (err) {
      // Never let a single bad file break the pass.
      console.warn('[preflightNavWiring] skip file due to parse error', filePath, err);
    }
  }

  return result;
}
