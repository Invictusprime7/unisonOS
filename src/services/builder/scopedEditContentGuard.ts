import { parse } from '@babel/parser';
import type * as t from '@babel/types';

const IMPORT_PATTERN = /^\s*import\s[\s\S]*?;?$/gm;
const COMPONENT_DECLARATION_PATTERN = /(?:function|const)\s+([A-Z][A-Za-z0-9_]*)/g;
const JSX_TAG_PATTERN = /<\s*([A-Za-z][A-Za-z0-9_.-]*)\b/g;

const SIDE_EFFECT_TAGS = new Set([
  'form', 'input', 'textarea', 'select', 'option', 'button', 'dialog',
  'nav', 'header', 'footer', 'section', 'article', 'aside', 'table',
  'video', 'audio', 'iframe',
]);

function collectMatches(content: string, pattern: RegExp): Set<string> {
  const matches = new Set<string>();
  for (const match of content.matchAll(pattern)) matches.add(match[1]);
  return matches;
}

function addedValues(before: Set<string>, after: Set<string>): string[] {
  return [...after].filter((value) => !before.has(value));
}

function promptAllows(prompt: string, token: string): boolean {
  const lower = prompt.toLowerCase();
  if (token === 'form' || token === 'input' || token === 'textarea' || token === 'select' || token === 'option') {
    return /\b(form|contact|signup|sign up|register|checkout|booking|appointment|submit|field|input|textarea|select)\b/.test(lower);
  }
  if (token === 'button') return /\b(button|cta|call to action|submit|action|form|contact|signup|checkout|booking)\b/.test(lower);
  if (/^[A-Z]/.test(token)) {
    return /\b(add|create|introduce|new|component|form|widget|section|block)\b/.test(lower);
  }
  return false;
}

/**
 * Detect UI structures introduced by a scoped candidate that the prompt did
 * not request. This is deliberately conservative: copy/style edits must not
 * silently become new forms, controls, sections, or component composition.
 */
export function findUnrequestedScopedSideEffects(
  original: string,
  candidate: string,
  prompt: string,
): string[] {
  const reasons: string[] = [];
  const originalImports = new Set([...original.matchAll(IMPORT_PATTERN)].map((match) => match[0].trim()));
  const candidateImports = new Set([...candidate.matchAll(IMPORT_PATTERN)].map((match) => match[0].trim()));
  const addedImports = addedValues(originalImports, candidateImports);
  if (addedImports.length > 0 && !/\b(add|create|introduce|import|use|icon|motion|animat\w*|3d|parallax|scroll|immersive|webgl|hover|transition|form|button|component)\b/i.test(prompt)) {
    reasons.push(`new imports (${addedImports.length})`);
  }

  const originalTags = collectMatches(original, JSX_TAG_PATTERN);
  const candidateTags = collectMatches(candidate, JSX_TAG_PATTERN);
  for (const tag of addedValues(originalTags, candidateTags)) {
    const normalizedTag = tag.toLowerCase();
    if ((SIDE_EFFECT_TAGS.has(normalizedTag) || /^[A-Z]/.test(tag)) && !promptAllows(prompt, tag)) {
      reasons.push(`new <${tag}> element`);
    }
  }

  const originalDeclarations = collectMatches(original, COMPONENT_DECLARATION_PATTERN);
  const candidateDeclarations = collectMatches(candidate, COMPONENT_DECLARATION_PATTERN);
  for (const name of addedValues(originalDeclarations, candidateDeclarations)) {
    if (!promptAllows(prompt, name)) reasons.push(`new ${name} component`);
  }

  return [...new Set(reasons)];
}

const NAVIGATION_PRESENTATION_PROMPT = /\b(?:nav(?:igation)?\s*bar|navbar|nav|menu)\b/i;
const PRESENTATION_CHANGE_PROMPT = /\b(?:float(?:ing)?|sticky|fixed|restyl\w*|redesign|style|position|appearance|layout)\b/i;
const EXPLICIT_SECTION_REMOVAL_PROMPT = /\b(?:remove|delete|hide|drop|strip|omit)\b[^.!?]{0,80}\b(?:hero|section|banner|intro|masthead)\b|\b(?:hero|section|banner|intro|masthead)\b[^.!?]{0,80}\b(?:remove|delete|hide|drop|strip|omit)\b/i;

export function isNavigationPresentationPrompt(prompt: string): boolean {
  return NAVIGATION_PRESENTATION_PROMPT.test(prompt) && PRESENTATION_CHANGE_PROMPT.test(prompt);
}

function staticJsxAttributeValue(attribute: t.JSXAttribute): string | null {
  const value = attribute.value;
  if (!value) return null;
  if (value.type === 'StringLiteral') return value.value;
  if (value.type === 'JSXExpressionContainer') {
    if (value.expression.type === 'StringLiteral') return value.expression.value;
    if (value.expression.type === 'TemplateLiteral' && value.expression.expressions.length === 0) {
      return value.expression.quasis[0]?.value.cooked ?? null;
    }
  }
  return null;
}

function jsxTagName(name: t.JSXElement['openingElement']['name'] | t.JSXOpeningElement['name']): string {
  if (name.type === 'JSXIdentifier') return name.name;
  if (name.type === 'JSXMemberExpression') return jsxTagName(name.property);
  if (name.type === 'JSXNamespacedName') return `${name.namespace.name}:${name.name.name}`;
  return '';
}

function isBabelNode(value: unknown): value is t.Node {
  return typeof value === 'object' && value !== null &&
    'type' in value && typeof (value as { type?: unknown }).type === 'string';
}

function collectSectionStructure(source: string): Map<string, number> {
  const counts = new Map<string, number>();
  let file: t.File;
  try {
    file = parse(source, { sourceType: 'unambiguous', plugins: ['jsx', 'typescript'] });
  } catch {
    return counts;
  }

  const visit = (node: t.Node) => {
    const opening = node.type === 'JSXElement'
      ? node.openingElement
      : node.type === 'JSXFragment'
        ? null
        : node.type === 'JSXExpressionContainer'
          ? null
          : node.type === 'JSXOpeningElement'
            ? node
            : null;
    if (opening) {
      const tagName = jsxTagName(opening.name).split('.').pop() ?? '';
      const attributes = opening.attributes
        .filter((attribute): attribute is t.JSXAttribute => attribute.type === 'JSXAttribute')
        .map((attribute) => `${jsxTagName(attribute.name as t.JSXAttribute['name'])} ${staticJsxAttributeValue(attribute) ?? ''}`);
      const identity = `${tagName} ${attributes.join(' ')}`.toLowerCase();
      let key: string | null = null;
      if (/\b(?:hero|masthead|intro|banner|top[-_ ]section)\b/.test(identity)) {
        key = 'hero';
      } else if (/^(?:section|article)$/i.test(tagName)) {
        key = 'section';
      } else if (/section$/i.test(tagName)) {
        key = `component:${tagName.toLowerCase()}`;
      }
      if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    for (const [key, value] of Object.entries(node)) {
      if (key === 'loc' || key === 'comments' || key === 'tokens') continue;
      if (Array.isArray(value)) {
        for (const child of value) if (isBabelNode(child)) visit(child);
      } else if (isBabelNode(value)) {
        visit(value);
      }
    }
  };
  visit(file.program);
  return counts;
}

/** Detect navbar presentation edits whose candidate also drops existing page sections. */
export function findUnrequestedNavigationSectionRemovals(
  original: string,
  candidate: string,
  prompt: string,
): string[] {
  if (!isNavigationPresentationPrompt(prompt) || EXPLICIT_SECTION_REMOVAL_PROMPT.test(prompt)) return [];

  const before = collectSectionStructure(original);
  const after = collectSectionStructure(candidate);
  return [...before]
    .filter(([section, count]) => (after.get(section) ?? 0) < count)
    .map(([section]) => section === 'hero' ? 'hero' : section.replace(/^component:/, ''));
}

export function getUnrequestedNavigationSectionRemovalReason(
  originalFiles: Record<string, string>,
  candidateFiles: Record<string, string>,
  prompt: string,
): string | null {
  for (const [path, candidate] of Object.entries(candidateFiles)) {
    const normalized = path.startsWith('/') ? path : `/${path}`;
    if (!/\.(?:tsx|jsx)$/.test(normalized)) continue;
    const original = originalFiles[normalized] ?? originalFiles[normalized.slice(1)];
    if (typeof original !== 'string' || original === candidate) continue;
    const removedSections = findUnrequestedNavigationSectionRemovals(original, candidate, prompt);
    if (removedSections.length > 0) {
      return `The navigation restyle removed existing ${removedSections.join(', ')} page content from ${normalized}.`;
    }
  }
  return null;
}

const JSX_TEXT_PATTERN = />\s*([^<>{}]*[A-Za-z][^<>{}]*?)\s*</g;
const COPY_PROP_PATTERN = /\b(?:headline|subheadline|title|subtitle|eyebrow|badge|description|label|caption|quote|body|text|cta|ctaLabel|placeholder|alt)\s*[:=]\s*(?:\{\s*)?(["'`])((?:(?!\1)[^\\]|\\.){2,})\1/g;

const COPY_REQUEST_PATTERN = /\b(text|copy|wording|words|reword|rephrase|rewrite|rename|say|says|read|reads|shorter|longer|shorten|lengthen|concise|tone|formal|casual|friendly|professional|playful|translate|spelling|typo|grammar|replace .* with|change .* to|write)\b/i;

function normalizeCopy(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function collectCopy(source: string): Map<string, number> {
  const counts = new Map<string, number>();
  const add = (raw: string) => {
    const value = normalizeCopy(raw);
    if (value.length < 2 || !/[A-Za-z]/.test(value)) return;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  };
  for (const match of source.matchAll(JSX_TEXT_PATTERN)) add(match[1]);
  for (const match of source.matchAll(COPY_PROP_PATTERN)) add(match[2]);
  return counts;
}

/** True when the prompt asks for a wording change rather than a visual one. */
export function promptRequestsCopyChange(prompt: string): boolean {
  return COPY_REQUEST_PATTERN.test(prompt);
}

/**
 * Detect visible copy the candidate removed or rewrote that the request did
 * not cover. A style/layout request may not change any copy; a wording request
 * on a clicked element may only change copy that belongs to that element.
 * Returns the removed strings (truncated) — empty means no collateral copy.
 */
export function findUnrequestedCopyChanges(
  original: string,
  candidate: string,
  prompt: string,
  targetText?: string | null,
): string[] {
  const before = collectCopy(original);
  const after = collectCopy(candidate);
  const removed: string[] = [];
  for (const [value, count] of before) {
    if ((after.get(value) ?? 0) < count) removed.push(value);
  }
  if (removed.length === 0) return [];
  const wordingRequest = promptRequestsCopyChange(prompt);
  const target = normalizeCopy(targetText ?? '').toLowerCase();
  const outOfScope = removed.filter((value) => {
    if (!wordingRequest) return true;
    // No clicked element: a wording request may rewrite copy on the target file.
    if (!target) return false;
    const lower = value.toLowerCase();
    return !(target.includes(lower) || lower.includes(target.slice(0, 40)));
  });
  return outOfScope.map((value) => (value.length > 60 ? `${value.slice(0, 57)}…` : value));
}
