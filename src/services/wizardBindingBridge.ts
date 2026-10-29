import * as ts from 'typescript';
import type { SiteBundleSnapshot } from '@/platform/core/canonicalPipeline';
import { resolvePlaygroundBindingDomIntent, type PlaygroundBinding, type PlaygroundBindingSpecV2, type PlaygroundPageRole } from '@/types/playground';
import type { BuilderPage, PageRegistry } from '@/types/pageRegistry';
import {
  buildUIIntentContract,
  getUIIntentProfile,
  hasUIIntentProfile,
  resolveUIIntentPlacements,
} from '@/platform/core/uiIntentProfile';
import { getIntentDef } from '@/platform/core/intentSurfaceRegistry';
import { collectLocalImportClosure } from '@/services/laneBCompanionModules';

/** Authored component paths a page may render as part of its own surface. */
const SHARED_SURFACE_PATH = /^\/src\/(?:pages|project-components|components\/generated)\/.+\.[jt]sx?$/;

export interface WizardBindingApplicationResult {
  files: Record<string, string>;
  appliedBindings: number;
  missingBindings: Array<{
    bindingId: string;
    filePath?: string;
    elementKey?: string;
    reason: string;
  }>;
}

export interface WizardBindingMarkerRequirement {
  bindingId: string;
  pageId: string;
  sourceLabel?: string;
  sourceSection?: string;
  sourceSlot: string;
  domIntent?: string;
  targetType?: string;
  targetId?: string;
  targetPath?: string;
  markers: readonly string[];
}

export interface WizardBindingMarkerNormalizationResult {
  files: Record<string, string>;
  unresolvedBindingIds: string[];
}

const INTERACTIVE_TAGS = ['button', 'a', 'Link', 'Button', 'NavLink', 'motion.button', 'motion.a'] as const;
const ICON_TRIGGER_TAGS = [...INTERACTIVE_TAGS, 'div', 'span'] as const;

interface JsxCandidate {
  haystack: string;
  openTagEnd: number;
  openTagStart: number;
  text: string;
  tagName: string;
  href?: string;
  type?: string;
  insideForm: boolean;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildTagPattern(tags: readonly string[]): string {
  return tags.map((tag) => escapeRegex(tag)).join('|');
}

function toComponentName(path: string): string {
  const cleaned = path.replace(/^\//, '').replace(/\.html?$/i, '') || 'home';
  return cleaned
    .split('/')
    .filter(Boolean)
    .map((segment) => segment.replace(/[^a-zA-Z0-9]+/g, ' '))
    .map((segment) => segment.replace(/\b\w/g, (char) => char.toUpperCase()).replace(/\s+/g, ''))
    .join('') || 'Home';
}

function normalizeRoute(path: string): string {
  if (!path || path === '/') return '/';
  const trimmed = path.replace(/\.html?$/i, '').trim();
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

function resolveBindingFilePath(files: Record<string, string>, page: BuilderPage | undefined): string | undefined {
  if (!page) return undefined;

  const candidates = new Set<string>();
  if (page.filePath) candidates.add(page.filePath);

  const route = normalizeRoute(page.path);
  if (page.isHome) {
    // Home page lives at /src/pages/Home.tsx (canonical) — probe it FIRST
    // so SiteBundleSnapshot binding/theme wiring reaches the home route.
    // Legacy /src/App.tsx is checked last as a back-compat fallback only.
    candidates.add('/src/pages/Home.tsx');
    candidates.add('/pages/Home.tsx');
    candidates.add('/src/pages/Index.tsx');
    candidates.add('/src/App.tsx');
    candidates.add('/App.tsx');
  } else {
    const componentName = toComponentName(route);
    candidates.add(`/src/pages/${componentName}.tsx`);
    candidates.add(`/pages/${componentName}.tsx`);
  }

  for (const candidate of candidates) {
    if (candidate && files[candidate]) {
      return candidate;
    }
  }

  return undefined;
}

function getSlotMarkers(binding: PlaygroundBinding): string[] {
  const section = binding.sourceSection as string | undefined;
  const slot = binding.sourceSlot as string | undefined;
  const intent = getDomIntent(binding);

  if (intent === 'nav.goto') return ['cta.nav-link'];
  if (intent === 'cart.checkout') return ['cta.checkout'];

  if (!section || !slot) return [];

  if (section === 'hero' && slot === 'primary-cta') return ['cta.hero'];
  if (section === 'hero' && slot === 'secondary-cta') return ['cta.hero-secondary'];
  if (section === 'navbar' && slot === 'primary-cta') return ['cta.nav'];
  if (slot === 'primary-cta') return ['cta.primary'];
  if (slot === 'secondary-cta') return ['cta.secondary'];
  if (slot === 'card-cta') return ['cta.card'];
  if (slot === 'checkout-cta') return ['cta.checkout'];
  if (slot === 'form-submit') return ['cta.form-submit'];
  if (slot === 'newsletter-submit') return ['cta.newsletter-submit', 'cta.newsletter'];
  if (slot === 'newsletter') return ['cta.newsletter'];
  if (slot === 'booking-submit' || slot === 'quote-submit' || slot === 'contact-submit'
    || slot === 'class-booking' || slot === 'stay-booking') return ['cta.form-submit'];
  if (slot === 'page-route' || slot.endsWith('-link')) return ['cta.nav-link'];
  if (slot === 'primary-action') return section === 'navbar' ? ['cta.nav'] : ['cta.primary'];
  if (slot === 'product-primary-action') return ['cta.card'];
  if (slot === 'signup-action' || slot === 'donation-action') return ['cta.primary'];
  if (slot === 'phone-link') return ['cta.phone', 'icon.phone'];
  if (slot === 'email-link') return ['cta.email', 'icon.email'];
  if (slot === 'address-link') return ['cta.address', 'cta.directions', 'icon.address'];
  if (slot === 'cart-trigger') return ['icon.cart'];
  if (slot.startsWith('icon-')) return [`icon.${slot.replace(/^icon-/, '')}`];
  if (slot === 'nav-link') return ['cta.nav-link'];
  if (slot === 'social-link') return ['cta.social-link'];

  return [];
}

export function getWizardBindingMarkers(binding: PlaygroundBinding): string[] {
  return getSlotMarkers(binding);
}

function normalizeText(value: string): string {
  return value
    .replace(/\{[^}]*\}/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[_.-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

interface BindingMatchTarget {
  sourceSlot?: string;
  sourceLabel?: string;
  targetPath?: string;
}

function getIconKeywords(binding: BindingMatchTarget): string[] {
  const slot = binding.sourceSlot || '';
  const label = binding.sourceLabel || '';
  const target = `${slot} ${label}`.toLowerCase();

  if (target.includes('cart')) return ['cart', 'bag', 'basket'];
  if (target.includes('search')) return ['search'];
  if (target.includes('menu')) return ['menu', 'hamburger', 'nav'];
  if (target.includes('user') || target.includes('account')) return ['user', 'account', 'profile', 'login', 'sign in'];
  if (target.includes('calendar') || target.includes('book')) return ['calendar', 'book', 'appointment', 'reserve'];
  if (target.includes('filter')) return ['filter'];
  if (target.includes('sort')) return ['sort'];
  if (target.includes('favorite')) return ['favorite', 'wishlist', 'heart', 'save'];
  return [];
}

function getFallbackMatchLimit(binding: BindingMatchTarget): number {
  switch (binding.sourceSlot) {
    case 'card-cta':
    case 'nav-link':
    case 'social-link':
      return Number.POSITIVE_INFINITY;
    case 'icon-favorite':
      return Number.POSITIVE_INFINITY;
    default:
      return 1;
  }
}

function getScriptKind(filePath: string): ts.ScriptKind {
  if (/\.tsx$/i.test(filePath)) return ts.ScriptKind.TSX;
  if (/\.jsx$/i.test(filePath)) return ts.ScriptKind.JSX;
  if (/\.ts$/i.test(filePath)) return ts.ScriptKind.TS;
  if (/\.js$/i.test(filePath)) return ts.ScriptKind.JS;
  return ts.ScriptKind.Unknown;
}

function getJsxTagName(node: ts.JsxTagNameExpression, sourceFile: ts.SourceFile): string {
  return node.getText(sourceFile);
}

function findOpeningTagStart(content: string, guess: number): number | undefined {
  for (let index = guess; index >= 0 && guess - index < 200; index -= 1) {
    if (content[index] === '<') {
      return index;
    }
  }
  return undefined;
}

function collectStaticJsxText(children: readonly ts.JsxChild[]): string {
  const parts: string[] = [];

  for (const child of children) {
    if (ts.isJsxText(child)) {
      parts.push(child.getText());
      continue;
    }

    if (ts.isJsxExpression(child)) {
      const expression = child.expression;
      if (!expression) continue;
      if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) {
        parts.push(expression.text);
      }
      continue;
    }

    if (ts.isJsxElement(child)) {
      parts.push(collectStaticJsxText(child.children));
      continue;
    }

    if (ts.isJsxFragment(child)) {
      parts.push(collectStaticJsxText(child.children));
    }
  }

  return parts.join(' ');
}

function staticJsxAttribute(element: ts.JsxOpeningLikeElement, name: string): string | undefined {
  const attribute = element.attributes.properties.find((property): property is ts.JsxAttribute =>
    ts.isJsxAttribute(property) && property.name.getText() === name,
  );
  if (!attribute?.initializer) return undefined;
  if (ts.isStringLiteralLike(attribute.initializer)) return attribute.initializer.text;
  if (ts.isJsxExpression(attribute.initializer) && attribute.initializer.expression
    && (ts.isStringLiteral(attribute.initializer.expression) || ts.isNoSubstitutionTemplateLiteral(attribute.initializer.expression))) {
    return attribute.initializer.expression.text;
  }
  return undefined;
}

function isInsideForm(node: ts.Node): boolean {
  let parent = node.parent;
  while (parent && !ts.isSourceFile(parent)) {
    if (ts.isJsxElement(parent) && getJsxTagName(parent.openingElement.tagName, parent.getSourceFile()).toLowerCase() === 'form') return true;
    parent = parent.parent;
  }
  return false;
}

function collectJsxCandidates(
  content: string,
  filePath: string,
  allowedTags: readonly string[],
): JsxCandidate[] {
  if (!/\.[jt]sx$/i.test(filePath)) {
    return [];
  }

  const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true, getScriptKind(filePath));
  const allowed = new Set(allowedTags);
  const candidates: JsxCandidate[] = [];

  const pushCandidate = (element: ts.JsxOpeningLikeElement, tagName: string, rawStart: number, openTagEnd: number, fullEnd: number, text: string) => {
    if (!allowed.has(tagName)) {
      return;
    }

    const rawElement = content.slice(rawStart, fullEnd);
    candidates.push({
      haystack: normalizeText(`${rawElement} ${text}`),
      openTagEnd,
      openTagStart: rawStart,
      text: normalizeText(text),
      tagName,
      href: staticJsxAttribute(element, 'href'),
      type: staticJsxAttribute(element, 'type'),
      insideForm: isInsideForm(element),
    });
  };

  const visit = (node: ts.Node) => {
    if (ts.isJsxElement(node)) {
      const tagName = getJsxTagName(node.openingElement.tagName, sourceFile);
      const openTagStart = findOpeningTagStart(content, node.openingElement.getStart(sourceFile));
      if (openTagStart !== undefined) {
        pushCandidate(
          node.openingElement,
          tagName,
          openTagStart,
          node.openingElement.getEnd(),
          node.getEnd(),
          collectStaticJsxText(node.children),
        );
      }
    } else if (ts.isJsxSelfClosingElement(node)) {
      const tagName = getJsxTagName(node.tagName, sourceFile);
      const openTagStart = findOpeningTagStart(content, node.getStart(sourceFile));
      if (openTagStart !== undefined) {
        pushCandidate(node, tagName, openTagStart, node.getEnd(), node.getEnd(), '');
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return candidates;
}

function getDomIntent(binding: PlaygroundBinding): string {
  return resolvePlaygroundBindingDomIntent(binding);
}

function bindingIsActive(binding: PlaygroundBinding, enabledCapabilities?: readonly string[]): boolean {
  if (!enabledCapabilities) return true;
  const required = new Set([
    ...(binding.requiredCapabilities ?? []),
    ...(getIntentDef(binding.coreIntent || '')?.requiredCapabilities ?? []),
    ...(getIntentDef(getDomIntent(binding))?.requiredCapabilities ?? []),
  ]);
  return [...required].every((capability) => enabledCapabilities.includes(capability));
}

function getBindingAttrs(binding: PlaygroundBinding, snapshot: SiteBundleSnapshot): Record<string, string> {
  const attrs: Record<string, string> = {
    'data-ut-intent': getDomIntent(binding),
    'data-intent': getDomIntent(binding),
  };

  if (binding.sourceSlot) {
    attrs['data-ut-slot'] = binding.sourceSlot;
  }
  if (binding.sourceSection) {
    attrs['data-ut-section-role'] = binding.sourceSection;
  }
  if (binding.sourcePageId && binding.sourceSection && binding.sourceSlot) {
    attrs['data-ut-slot-id'] = `${binding.sourcePageId}:${binding.sourceSection}:${binding.sourceSlot}`;
  }

  if (binding.sourceLabel) {
    attrs['data-ut-label'] = binding.sourceLabel;
  }
  if (binding.uiAction) {
    attrs['data-ut-ui-action'] = binding.uiAction;
  }
  if (binding.bindingId) {
    attrs['data-ut-binding-id'] = binding.bindingId;
  }
  if (binding.elementKey) {
    attrs['data-ut-binding-key'] = binding.elementKey;
  }

  if (binding.targetType === 'page') {
    const targetPage = snapshot.pageRegistry.pages[binding.targetId];
    if (targetPage) {
      attrs['data-ut-path'] = normalizeRoute(targetPage.path);
      attrs['data-ut-target-page-id'] = binding.targetId;
    }
  }

  attrs['data-ut-target-id'] = binding.targetId;
  attrs['data-ut-target-type'] = binding.targetType;

  if (binding.targetType === 'url') {
    attrs['data-ut-url'] = binding.targetId;
  }

  if (binding.payloadTemplate) {
    for (const [key, value] of Object.entries(binding.payloadTemplate)) {
      if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') continue;
      const stringValue = String(value);
      if (stringValue.startsWith('$')) continue;
      attrs[`data-ut-${key.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`)}`] = stringValue;
    }
  }

  return attrs;
}

function upsertAttrs(tag: string, attrs: Record<string, string>): string {
  // Never modify a closing tag — it has no attributes.
  if (/^<\//.test(tag.trimStart())) return tag;
  let next = tag;
  for (const [attr, value] of Object.entries(attrs)) {
    const attrPattern = new RegExp(`\\s${escapeRegex(attr)}=(["']).*?\\1`, 'i');
    next = next.replace(attrPattern, '');
    if (/\/>$/.test(next.trimEnd())) {
      next = next.replace(/\s*\/>$/, ` ${attr}="${escapeAttr(value)}" />`);
      continue;
    }

    next = next.replace(/>$/, ` ${attr}="${escapeAttr(value)}">`);
  }
  return next;
}

function applyBindingToContent(
  content: string,
  markers: string[],
  attrs: Record<string, string>,
): { content: string; applied: boolean } {
  // JSX-safe attribute chunk: allows > inside {expr} blocks (e.g. onClick={() => fn()})
  const jsxAttrChunk = '(?:[^>{}]|{(?:[^{}]|{[^}]*})*})';

  for (const marker of markers) {
    const markerRegex = new RegExp(
      `<([A-Za-z][^\\s/>]*)(${jsxAttrChunk}*?\\bdata-ut-cta=(["'])${escapeRegex(marker)}\\3${jsxAttrChunk}*)>`,
      'g',
    );
    let applied = false;
    const next = content.replace(markerRegex, (match) => {
      applied = true;
      return upsertAttrs(match, attrs);
    });

    if (applied) {
      return { content: next, applied: true };
    }
  }

  return { content, applied: false };
}

function applyBindingByLabel(
  content: string,
  binding: BindingMatchTarget,
  attrs: Record<string, string>,
): { content: string; applied: boolean } {
  const label = normalizeText(binding.sourceLabel || '');
  if (!label) {
    return { content, applied: false };
  }

  const tagPattern = buildTagPattern(INTERACTIVE_TAGS);
  const elementRegex = new RegExp(
    `<(${tagPattern})(\\s[^>]*)?>([\\s\\S]*?)</\\1>`,
    'g',
  );
  const limit = getFallbackMatchLimit(binding);
  let matchCount = 0;

  const next = content.replace(elementRegex, (match, tagName, attrChunk = '', innerContent = '') => {
    if (matchCount >= limit) return match;

    const normalizedInner = normalizeText(String(innerContent));
    const labelMatches =
      normalizedInner === label ||
      normalizedInner.includes(label) ||
      label.includes(normalizedInner);

    if (!normalizedInner || !labelMatches) {
      return match;
    }

    matchCount += 1;
    // Only rewrite the opening tag — NOT the full element. Passing the full
    // element to upsertAttrs causes attributes to be appended to the closing
    // tag (</button attr="val">) which is invalid JSX and breaks JSON parsing.
    const openTag = `<${tagName}${attrChunk ?? ''}>`;
    const rewrittenOpenTag = upsertAttrs(openTag, attrs);
    return `${rewrittenOpenTag}${innerContent}</${tagName}>`;
  });

  return { content: next, applied: matchCount > 0 };
}

function applyBindingByJsxAst(
  content: string,
  filePath: string,
  binding: BindingMatchTarget,
  attrs: Record<string, string>,
): { content: string; applied: boolean } {
  const label = normalizeText(binding.sourceLabel || '');
  const limit = getFallbackMatchLimit(binding);
  const labelCandidates = collectJsxCandidates(content, filePath, INTERACTIVE_TAGS);
  const iconCandidates = collectJsxCandidates(content, filePath, ICON_TRIGGER_TAGS);
  const keywords = getIconKeywords(binding);
  const matched = new Set<number>();
  const selected: JsxCandidate[] = [];

  if (label) {
    for (const candidate of labelCandidates) {
      if (selected.length >= limit) break;
      const text = candidate.text;
      const labelMatches = text && (text === label || text.includes(label) || label.includes(text));
      if (!labelMatches) continue;

      matched.add(candidate.openTagStart);
      selected.push(candidate);
    }
  }

  if (selected.length < limit && binding.targetPath) {
    const targetPath = binding.targetPath.trim();
    for (const candidate of labelCandidates) {
      if (selected.length >= limit) break;
      if (candidate.href !== targetPath || matched.has(candidate.openTagStart)) continue;
      matched.add(candidate.openTagStart);
      selected.push(candidate);
    }
  }

  const formSubmitSlot = /(?:submit|booking|quote)/i.test(binding.sourceSlot ?? '');
  if (selected.length === 0 && formSubmitSlot) {
    const submitCandidates = labelCandidates.filter((candidate) =>
      candidate.insideForm && candidate.type?.toLowerCase() === 'submit'
      && (candidate.tagName.toLowerCase() === 'button' || candidate.tagName.toLowerCase() === 'input'),
    );
    if (submitCandidates.length === 1) selected.push(submitCandidates[0]);
  }

  if (selected.length < limit && keywords.length > 0) {
    for (const candidate of iconCandidates) {
      if (selected.length >= limit) break;
      if (matched.has(candidate.openTagStart)) continue;
      if (!keywords.some((keyword) => candidate.haystack.includes(normalizeText(keyword)))) {
        continue;
      }

      matched.add(candidate.openTagStart);
      selected.push(candidate);
    }
  }

  if (selected.length === 0) {
    return { content, applied: false };
  }

  let next = content;
  const edits = [...selected].sort((a, b) => b.openTagStart - a.openTagStart);
  for (const candidate of edits) {
    const tag = next.slice(candidate.openTagStart, candidate.openTagEnd);
    const rewrittenTag = upsertAttrs(tag, attrs);
    next = `${next.slice(0, candidate.openTagStart)}${rewrittenTag}${next.slice(candidate.openTagEnd)}`;
  }

  return { content: next, applied: true };
}

function applyBindingByIconAffinity(
  content: string,
  binding: BindingMatchTarget,
  attrs: Record<string, string>,
): { content: string; applied: boolean } {
  const keywords = getIconKeywords(binding);
  if (keywords.length === 0) {
    return { content, applied: false };
  }

  const limit = getFallbackMatchLimit(binding);
  const tagPattern = buildTagPattern(ICON_TRIGGER_TAGS);
  // JSX-safe: allow > inside {expr} blocks (e.g. onClick={() => fn()})
  const jsxAttrChunk = '(?:[^>{}]|{(?:[^{}]|{[^}]*})*})';
  const openTagRegex = new RegExp(`<(${tagPattern})(\\s${jsxAttrChunk}*)?>`, 'g');
  let appliedCount = 0;

  const next = content.replace(openTagRegex, (match, tagName, attrChunk = '') => {
    if (appliedCount >= limit) return match;

    const haystack = normalizeText(String(attrChunk));
    if (!haystack) return match;
    if (!keywords.some((keyword) => haystack.includes(keyword))) {
      return match;
    }

    appliedCount += 1;
    return upsertAttrs(match, attrs);
  });

  return { content: next, applied: appliedCount > 0 };
}

/** Restore deterministic CTA markers before App Builder closure validation. */
export function normalizeWizardBindingMarkers(
  files: Record<string, string>,
  pageRegistry: PageRegistry,
  requirements: readonly WizardBindingMarkerRequirement[],
): WizardBindingMarkerNormalizationResult {
  const nextFiles = { ...files };
  const unresolvedBindingIds: string[] = [];

  for (const requirement of requirements) {
    const page = pageRegistry.pages[requirement.pageId];
    const filePath = resolveBindingFilePath(nextFiles, page);
    if (!page || !filePath) {
      unresolvedBindingIds.push(requirement.bindingId);
      continue;
    }

    const surface = collectLocalImportClosure(nextFiles, filePath, (path) => SHARED_SURFACE_PATH.test(path));
    const target: BindingMatchTarget = {
      sourceSlot: requirement.sourceSlot,
      sourceLabel: requirement.sourceLabel ?? '',
      targetPath: requirement.targetPath,
    };
    const attrs: Record<string, string> = { 'data-ut-cta': requirement.markers[0] };
    if (requirement.sourceSlot) attrs['data-ut-slot'] = requirement.sourceSlot;
    if (requirement.sourceSection) attrs['data-ut-section-role'] = requirement.sourceSection;
    if (requirement.pageId && requirement.sourceSection) {
      attrs['data-ut-slot-id'] = `${requirement.pageId}:${requirement.sourceSection}:${requirement.sourceSlot}`;
    }
    if (requirement.domIntent) {
      attrs['data-ut-intent'] = requirement.domIntent;
      attrs['data-intent'] = requirement.domIntent;
    }
    if (requirement.bindingId) attrs['data-ut-binding-id'] = requirement.bindingId;
    if (requirement.sourceLabel) attrs['data-ut-label'] = requirement.sourceLabel;
    if (requirement.targetType) attrs['data-ut-target-type'] = requirement.targetType;
    if (requirement.targetId) attrs['data-ut-target-id'] = requirement.targetId;
    if (requirement.targetPath) attrs['data-ut-path'] = requirement.targetPath;
    if (requirement.targetType === 'url' && requirement.targetId) attrs['data-ut-url'] = requirement.targetId;
    let applied = false;
    for (const candidatePath of surface) {
      const source = nextFiles[candidatePath] ?? '';
      const jsxResult = applyBindingByJsxAst(source, candidatePath, target, attrs);
      const labelResult = jsxResult.applied
        ? jsxResult
        : applyBindingByLabel(source, target, attrs);
      const result = labelResult.applied
        ? labelResult
        : applyBindingByIconAffinity(source, target, attrs);
      if (!result.applied) continue;
      nextFiles[candidatePath] = result.content;
      applied = true;
      break;
    }
    if (!applied) unresolvedBindingIds.push(requirement.bindingId);
  }

  return { files: nextFiles, unresolvedBindingIds };
}

type WizardBindingGuideSource = Pick<SiteBundleSnapshot, 'pageRegistry' | 'bindings'>;

function describeBindingTarget(binding: PlaygroundBinding, snapshot: WizardBindingGuideSource): string {
  if (binding.targetType === 'page') {
    const targetPage = snapshot.pageRegistry.pages[binding.targetId];
    return targetPage ? `${targetPage.title} (${normalizeRoute(targetPage.path)})` : binding.targetId;
  }
  return binding.targetId;
}

export function buildWizardBindingGuide(
  snapshot: WizardBindingGuideSource,
  options: { industry?: string | null; enabledCapabilities?: readonly string[] } = {},
): string {
  const bindings = Object.values(snapshot.bindings)
    .filter((binding) => binding.sourceSection && binding.sourceSlot)
    .filter((binding) => bindingIsActive(binding, options.enabledCapabilities))
    .sort((a, b) => `${a.sourcePageId}:${a.elementKey || a.bindingId}`.localeCompare(`${b.sourcePageId}:${b.elementKey || b.bindingId}`));

  const lines: string[] = [];

  if (bindings.length > 0) {
    lines.push(
      '--- INTERACTION WIRING CONTRACT ---',
      'Use the exact `data-ut-cta` markers below so the launcher can stamp final hooks before import.',
      'Do not invent alternate CTA marker names for these slots.',
      'Keep the visible CTA/link text equal to the specified label when possible so label-based fallback wiring remains deterministic.',
      'For icon-only triggers, include a descriptive `aria-label` or `title` that matches the intended action.',
    );

    for (const binding of bindings) {
      const sourcePage = snapshot.pageRegistry.pages[binding.sourcePageId];
      const markers = getSlotMarkers(binding);
      if (!sourcePage || markers.length === 0) continue;

      lines.push(
        `- Page ${sourcePage.title} (${normalizeRoute(sourcePage.path)}), slot ${binding.sourceSection}.${binding.sourceSlot}: ` +
        `label "${binding.sourceLabel || 'CTA'}", marker ${markers.map((marker) => `data-ut-cta="${marker}"`).join(' or ')}, ` +
        `intent ${getDomIntent(binding)}, target ${describeBindingTarget(binding, snapshot)}`
      );
    }

    lines.push('Every internal page link must use `data-ut-intent="nav.goto"` with `data-ut-path`.');
    lines.push('Every product/cart CTA must include product payload attrs when real product data exists.');
  }

  // Append UI Intent Contract for industries with a declared profile.
  const industry = options.industry ?? null;
  if (hasUIIntentProfile(industry)) {
    const profile = getUIIntentProfile(industry);
    // Build binding spec snapshot from existing bindings so resolver can mark "covered" placements.
    const specs: PlaygroundBindingSpecV2[] = Object.values(snapshot.bindings)
      .filter((b) => b.sourceSection && b.sourceSlot && b.coreIntent && bindingIsActive(b, options.enabledCapabilities))
      .map((b) => {
        const page = snapshot.pageRegistry.pages[b.sourcePageId];
        return {
          sourcePageRole: ((page?.pageRole || page?.pageType) ?? 'home') as PlaygroundPageRole,
          sourceSection: b.sourceSection!,
          sourceSlot: b.sourceSlot!,
          label: b.sourceLabel || '',
          coreIntent: b.coreIntent!,
          intent: b.intent,
          targetRef: b.targetId,
          uiAction: 'navigate',
        } as PlaygroundBindingSpecV2;
      });
    const availablePages = new Set<PlaygroundPageRole>(
      Object.values(snapshot.pageRegistry.pages).map(
        (p) => ((p.pageRole || p.pageType) ?? 'home') as PlaygroundPageRole,
      ),
    );
    const resolution = resolveUIIntentPlacements(profile, specs, availablePages);
    const contract = buildUIIntentContract(industry, resolution);
    if (contract) {
      if (lines.length > 0) lines.push('');
      lines.push(contract);
    }
  }

  return lines.join('\n');
}


export function applyWizardBindingsToVfs(
  files: Record<string, string>,
  snapshot: SiteBundleSnapshot,
  bindingIds?: readonly string[],
  enabledCapabilities?: readonly string[],
): WizardBindingApplicationResult {
  const nextFiles = { ...files };
  let appliedBindings = 0;
  const missingBindings: WizardBindingApplicationResult['missingBindings'] = [];

  const selectedBindingIds = bindingIds ? new Set(bindingIds) : null;
  for (const binding of Object.values(snapshot.bindings)) {
    if (!bindingIsActive(binding, enabledCapabilities)) continue;
    if (selectedBindingIds && !selectedBindingIds.has(binding.bindingId)) continue;
    const page = snapshot.pageRegistry.pages[binding.sourcePageId];
    const filePath = resolveBindingFilePath(nextFiles, page);
    const markers = getSlotMarkers(binding);

    if (!filePath || !page) {
      missingBindings.push({
        bindingId: binding.bindingId,
        filePath,
        elementKey: binding.elementKey,
        reason: 'No source file resolved for binding page',
      });
      continue;
    }

    if (markers.length === 0) {
      missingBindings.push({
        bindingId: binding.bindingId,
        filePath,
        elementKey: binding.elementKey,
        reason: 'No deterministic slot marker available for binding',
      });
      continue;
    }

    const attrs = { ...getBindingAttrs(binding, snapshot), 'data-ut-cta': markers[0] };
    let result = applyBindingToContent(nextFiles[filePath], markers, attrs);

    if (!result.applied) {
      // Exact markers inside the authored components this page renders
      // (shared nav, footer, newsletter band) are the same page surface.
      const shared = collectLocalImportClosure(nextFiles, filePath, (path) => SHARED_SURFACE_PATH.test(path))
        .filter((path) => path !== filePath);
      let sharedApplied = false;
      for (const sharedPath of shared) {
        const sharedResult = applyBindingToContent(nextFiles[sharedPath], markers, attrs);
        if (!sharedResult.applied) continue;
        nextFiles[sharedPath] = sharedResult.content;
        sharedApplied = true;
        break;
      }
      if (sharedApplied) {
        appliedBindings += 1;
        continue;
      }
    }

    if (!result.applied) {
      result = applyBindingByJsxAst(result.content, filePath, binding, attrs);
    }

    if (!result.applied) {
      result = applyBindingByLabel(result.content, binding, attrs);
    }

    if (!result.applied) {
      result = applyBindingByIconAffinity(result.content, binding, attrs);
    }

    nextFiles[filePath] = result.content;

    if (result.applied) {
      appliedBindings += 1;
    } else {
      missingBindings.push({
        bindingId: binding.bindingId,
        filePath,
        elementKey: binding.elementKey,
        reason: `No matching ${markers.join(', ')} marker or semantic JSX target found in source file`,
      });
    }
  }

  return {
    files: nextFiles,
    appliedBindings,
    missingBindings,
  };
}
