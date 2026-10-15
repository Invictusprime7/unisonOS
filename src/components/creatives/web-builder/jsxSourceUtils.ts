/**
 * jsxSourceUtils — pure JSX/CSS-selector source manipulation helpers.
 * Extracted from WebBuilder.tsx as part of Pass 5 decomposition.
 */

/**
 * Escape special characters in CSS selectors (e.g., Tailwind brackets like `min-h-[85vh]`)
 */
export function escapeCSSSelector(selector: string): string {
  return selector.replace(/(\.)([^.\s#>+~:[\]]+)/g, (match, dot, className) => {
    const escaped = className
      .replace(/\[/g, '\\[')
      .replace(/\]/g, '\\]')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)')
      .replace(/:/g, '\\:')
      .replace(/\//g, '\\/');
    return dot + escaped;
  });
}

/**
 * Extract the JSX return body from a React component.
 * Handles both `return (...)` and arrow `=> (...)` patterns.
 */
export function extractJsxReturnBody(code: string): { jsx: string; before: string; after: string } | null {
  let returnIdx = code.search(/return\s*\(/);
  if (returnIdx === -1) {
    returnIdx = code.search(/=>\s*\(/);
  }
  if (returnIdx === -1) return null;

  const parenStart = code.indexOf('(', returnIdx);
  let depth = 0;
  let parenEnd = -1;
  let inString: string | null = null;
  let escaped = false;
  for (let i = parenStart; i < code.length; i++) {
    const ch = code[i];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\') { escaped = true; continue; }
    if (inString) {
      if (ch === inString) inString = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { inString = ch; continue; }
    if (ch === '(') depth++;
    else if (ch === ')') {
      depth--;
      if (depth === 0) { parenEnd = i; break; }
    }
  }
  if (parenEnd === -1) return null;

  const jsx = code.slice(parenStart + 1, parenEnd).trim();
  const before = code.slice(0, parenStart + 1);
  const after = code.slice(parenEnd);
  return { jsx, before, after };
}

/**
 * Find an element's start and end offsets in a JSX source string by a CSS-like selector.
 * Supports: tag, #id, tag:nth-of-type(n), and nested selectors with >.
 * Returns the character offsets in the source, or null if not found.
 */
export function findElementBoundsInJSX(
  source: string,
  selector: string
): { start: number; end: number } | null {
  if (!selector) return null;

  // Selectors from the runtime can be comma-separated alternates,
  // e.g. `[data-ut-binding-key="x"], [data-element-key="x"]`. Try each.
  const alternates = splitTopLevelCommas(selector);
  for (const alt of alternates) {
    const result = findBoundsForSingleSelector(source, alt.trim());
    if (result) return result;
  }
  return null;
}

export function splitTopLevelCommas(input: string): string[] {
  const out: string[] = [];
  let buf = '';
  let bracket = 0;
  let paren = 0;
  let quote: string | null = null;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (quote) {
      if (ch === '\\') { buf += ch + (input[++i] ?? ''); continue; }
      if (ch === quote) quote = null;
      buf += ch;
      continue;
    }
    if (ch === '"' || ch === "'") { quote = ch; buf += ch; continue; }
    if (ch === '[') bracket++;
    else if (ch === ']') bracket--;
    else if (ch === '(') paren++;
    else if (ch === ')') paren--;
    if (ch === ',' && bracket === 0 && paren === 0) {
      out.push(buf);
      buf = '';
      continue;
    }
    buf += ch;
  }
  if (buf.trim()) out.push(buf);
  return out;
}

export type UniqueSourceMutation =
  | { kind: 'match'; path: string; before: string; after: string }
  | { kind: 'ambiguous'; paths: string[] }
  | { kind: 'none' };

/** Evidence that narrows an ambiguous selector match to the file that actually rendered the element. */
export interface SourceMatchHints {
  /** Literal strings the owning source must contain (e.g. the current image link or alt text). */
  evidence?: Array<string | null | undefined>;
  /** Page whose import graph rendered the element; reachable files are preferred. */
  pagePath?: string | null;
  /** Explicit owner file from the selection descriptor, when known. */
  ownerPath?: string | null;
  /** Clicked element's tag and own text runs; anchors the edit to that element, not its position. */
  anchor?: { tag?: string; runs?: string[] } | null;
}

/**
 * Identity clues captured from a clicked element at click time: its own class
 * list, link/alt attributes and the separate text runs inside its markup
 * (source splits text across tags, so the joined textContent rarely matches).
 */
export function selectionEvidence(el: { html?: string; textContent?: string; attributes?: Record<string, string> } | null | undefined): string[] {
  if (!el) return [];
  const out: string[] = [];
  const a = el.attributes ?? {};
  const cls = a.className || a.class;
  if (cls && cls.length > 8) out.push(cls);
  for (const k of ['href', 'src', 'id', 'data-ut-path', 'aria-label']) if (a[k] && a[k].length > 3) out.push(a[k]);
  if (a.alt) out.push(`alt="${a.alt}"`);
  const runs = (el.html ?? '').replace(/<[^>]*>/g, '\n').split('\n')
    .map((t) => t.replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').trim())
    .filter((t) => t.length >= 6 && t.length <= 120);
  out.push(...[...new Set(runs)].sort((x, y) => y.length - x.length).slice(0, 6));
  const text = String(el.textContent ?? '').trim();
  if (!runs.length && text.length >= 6 && text.length <= 120) out.push(text);
  return out;
}

function resolveImport(from: string, spec: string, files: Record<string, string>): string | null {
  let base: string;
  if (spec.startsWith('@/')) base = `/src/${spec.slice(2)}`;
  else if (spec.startsWith('.')) {
    const parts = from.split('/').slice(0, -1);
    for (const seg of spec.split('/')) {
      if (seg === '.' || seg === '') continue;
      if (seg === '..') parts.pop(); else parts.push(seg);
    }
    base = parts.join('/') || '/';
  } else return null;
  for (const c of [base, `${base}.tsx`, `${base}.jsx`, `${base}.ts`, `${base}/index.tsx`, `${base}/index.jsx`]) if (c in files) return c;
  return null;
}

/** Files rendered by a page: the page plus everything it imports, transitively. */
export function collectReachableSources(files: Record<string, string>, entry: string | null | undefined): Set<string> {
  const seen = new Set<string>();
  if (!entry || !(entry in files)) return seen;
  const stack = [entry];
  while (stack.length) {
    const path = stack.pop()!;
    if (seen.has(path)) continue;
    seen.add(path);
    const src = files[path] ?? '';
    for (const m of src.matchAll(/(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g)) {
      const next = resolveImport(path, m[1] ?? m[2], files);
      if (next && !seen.has(next)) stack.push(next);
    }
  }
  return seen;
}

/** Count of literal occurrences of an image link across editable source files. */
export function countImageLiteral(files: Record<string, string>, literal: string): number {
  if (!literal || literal.length < 8 || literal.startsWith('data:')) return 0;
  let n = 0;
  for (const [path, code] of Object.entries(files)) {
    if (!/\.(tsx|jsx)$/i.test(path)) continue;
    let i = code.indexOf(literal);
    while (i >= 0) { n++; i = code.indexOf(literal, i + literal.length); }
  }
  return n;
}

/** Replace an image link only when it occurs exactly once in this file. */
export function replaceImageLiteral(code: string, literal: string, next: string): string | null {
  const i = code.indexOf(literal);
  if (i < 0 || code.indexOf(literal, i + literal.length) >= 0) return null;
  return code.slice(0, i) + next.replace(/"/g, '%22') + code.slice(i + literal.length);
}

export function findUniqueSourceMutation(
  files: Record<string, string>,
  excludedPath: string | null | undefined,
  mutate: (source: string) => string | null,
  hints: SourceMatchHints = {},
): UniqueSourceMutation {
  const matches: Array<Extract<UniqueSourceMutation, { kind: 'match' }>> = [];
  for (const [path, before] of Object.entries(files)) {
    if (path === excludedPath || !/\.(tsx|jsx)$/i.test(path)) continue;
    const after = mutate(before);
    if (after && after !== before) matches.push({ kind: 'match', path, before, after });
  }
  if (matches.length === 1) return matches[0];
  if (matches.length === 0) return { kind: 'none' };

  // Narrow with real identity evidence, strongest first; never guess.
  let pool = matches;
  if (hints.ownerPath) {
    const owned = pool.filter((m) => m.path === hints.ownerPath);
    if (owned.length === 1) return owned[0];
  }
  const evidence = (hints.evidence ?? [])
    .filter((e): e is string => typeof e === 'string' && e.length > 3 && !e.startsWith('data:'))
    .flatMap((e) => {
      // The preview reports resolved links; source may hold the path or file name only.
      if (!/^https?:\/\//.test(e)) return [e];
      try { const u = new URL(e); const file = u.pathname.split('/').pop() ?? ''; return [e, e.split('?')[0], u.pathname, file].filter((x) => x.length > 4); } catch { return [e]; }
    });
  if (evidence.length) {
    // Score by how many distinct clues each file contains; a unique best wins.
    const unique = [...new Set(evidence)];
    const scored = pool.map((m) => ({ m, score: unique.filter((e) => m.before.includes(e)).length }));
    const best = Math.max(...scored.map((s) => s.score));
    if (best > 0) {
      const top = scored.filter((s) => s.score === best).map((s) => s.m);
      if (top.length === 1) return top[0];
      pool = top;
    }
  }
  if (hints.pagePath) {
    const reachable = collectReachableSources(files, hints.pagePath);
    const onPage = pool.filter((m) => reachable.has(m.path));
    if (onPage.length === 1) return onPage[0];
    if (onPage.length > 1) pool = onPage;
  }
  return { kind: 'ambiguous', paths: pool.map(({ path }) => path).sort() };
}

export function findBoundsForSingleSelector(
  source: string,
  selector: string
): { start: number; end: number } | null {
  // Parse the selector into segments. Split on `>` at top level only so
  // attribute selectors like `[data-x="a > b"]` aren't broken.
  const allParts = splitTopLevelCombinator(selector)
    .map(s => s.trim())
    .filter(s => s && s !== 'body' && s !== 'html');

  if (allParts.length === 0) return null;

  // Try the full path first; if no match, progressively drop leading segments.
  for (let drop = 0; drop < allParts.length; drop++) {
    const result = findBoundsForParts(source, allParts.slice(drop));
    if (result) return result;
  }
  // Final fallback: try just the leaf segment with index 0 (best-effort)
  const leaf = allParts[allParts.length - 1];
  if (leaf) {
    const stripped = leaf.replace(/:nth-of-type\(\d+\)/, '');
    if (stripped !== leaf) {
      const result = findBoundsForParts(source, [stripped]);
      if (result) return result;
    }
  }
  return null;
}

export function splitTopLevelCombinator(input: string): string[] {
  const out: string[] = [];
  let buf = '';
  let bracket = 0;
  let paren = 0;
  let quote: string | null = null;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (quote) {
      if (ch === '\\') { buf += ch + (input[++i] ?? ''); continue; }
      if (ch === quote) quote = null;
      buf += ch;
      continue;
    }
    if (ch === '"' || ch === "'") { quote = ch; buf += ch; continue; }
    if (ch === '[') bracket++;
    else if (ch === ']') bracket--;
    else if (ch === '(') paren++;
    else if (ch === ')') paren--;
    if (ch === '>' && bracket === 0 && paren === 0) {
      out.push(buf);
      buf = '';
      continue;
    }
    buf += ch;
  }
  if (buf.trim()) out.push(buf);
  return out;
}

export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function unescapeCssString(value: string): string {
  return value.replace(/\\(?:([0-9a-fA-F]{1,6})\s?|([\r\n\f])|(.))/g, (_match, hexEscape: string | undefined, lineContinuation: string | undefined, escapedCharacter: string | undefined) => {
    if (hexEscape) {
      const codePoint = parseInt(hexEscape, 16);
      return codePoint === 0 || codePoint > 0x10ffff ? '\uFFFD' : String.fromCodePoint(codePoint);
    }
    return lineContinuation ? '' : escapedCharacter ?? '';
  });
}

/** Parse leading `[name="value"]` / `[name=value]` / `[name]` selectors. */
export function parseAttributeSelectors(part: string): { attrs: Array<{ name: string; value: string | null }>; rest: string } {
  const attrs: Array<{ name: string; value: string | null }> = [];
  let rest = part;
  const re = /\[([a-zA-Z_:][\w:.-]*)\s*(?:([~|^$*]?)=\s*(?:"([^"]*)"|'([^']*)'|([^\]]+)))?\]/;
  while (true) {
    const m = rest.match(re);
    if (!m) break;
    const rawValue = m[3] ?? m[4] ?? m[5] ?? null;
    attrs.push({ name: m[1], value: rawValue !== null ? unescapeCssString(rawValue.trim()) : null });
    rest = (rest.slice(0, m.index!) + rest.slice(m.index! + m[0].length)).trim();
  }
  return { attrs, rest };
}

export function findBoundsForParts(
  source: string,
  parts: string[]
): { start: number; end: number } | null {
  if (parts.length === 0) return null;

  let searchSource = source;
  let baseOffset = 0;

  for (let pi = 0; pi < parts.length; pi++) {
    const part = parts[pi];
    const isLast = pi === parts.length - 1;

    // Extract any [attr=...] selectors first
    const { attrs, rest } = parseAttributeSelectors(part);

    let tagName = '';
    let nthIndex = 0; // 0-based
    let id = '';

    const idMatch = rest.match(/#([a-zA-Z0-9_-]+)/);
    if (idMatch) {
      id = idMatch[1];
      tagName = rest.split('#')[0] || '';
    }

    const nthMatch = rest.match(/:nth-of-type\((\d+)\)/);
    if (nthMatch) {
      nthIndex = parseInt(nthMatch[1], 10) - 1;
      tagName = rest.split(':')[0] || tagName;
    }

    if (!tagName && !id) {
      tagName = rest.split('.')[0].split(':')[0].split('[')[0];
    }

    // If we have neither tag/id nor any attribute selector, this part is unusable
    if (!tagName && !id && attrs.length === 0) return null;

    let start = -1;
    let end = -1;
    let foundTag = '';

    if (id) {
      const idPattern = new RegExp(`<(\\w+)\\b[^>]*\\bid=["'{]${escapeRegex(id)}["'}][^>]*>`, 'i');
      const idFound = idPattern.exec(searchSource);
      if (!idFound) return null;
      foundTag = idFound[1];
      start = baseOffset + idFound.index;
      end = findJSXClosingTag(source, start, foundTag);
    } else if (attrs.length > 0) {
      // Match an opening tag carrying every required attribute.
      // Optionally constrained by tagName.
      const tagPart = tagName ? escapeRegex(tagName) : '[A-Za-z][\\w.-]*';
      // Walk every opening tag and test attributes
      const openRe = new RegExp(`<(${tagPart})\\b([^>]*)>`, 'gi');
      let m: RegExpExecArray | null;
      let count = 0;
      while ((m = openRe.exec(searchSource)) !== null) {
        const attrSegment = m[2] || '';
        const allMatch = attrs.every(a => attrMatches(attrSegment, a.name, a.value));
        if (!allMatch) continue;
        if (nthMatch && count !== nthIndex) { count++; continue; }
        foundTag = m[1];
        start = baseOffset + m.index;
        end = findJSXClosingTag(source, start, foundTag);
        break;
      }
      if (start === -1) return null;
    } else {
      // tag + optional nth
      const tagPattern = new RegExp(`<${escapeRegex(tagName)}\\b`, 'gi');
      let match: RegExpExecArray | null;
      let count = 0;
      while ((match = tagPattern.exec(searchSource)) !== null) {
        if (count === nthIndex) {
          start = baseOffset + match.index;
          foundTag = tagName;
          end = findJSXClosingTag(source, start, tagName);
          break;
        }
        count++;
      }
      if (start === -1) return null;
    }

    if (end === -1) return null;
    if (isLast) return { start, end };
    const openEnd = source.indexOf('>', start) + 1;
    searchSource = source.substring(openEnd, end);
    baseOffset = openEnd;
  }

  return null;
}

export function attrMatches(attrSegment: string, name: string, value: string | null): boolean {
  // Match name="value" / name='value' / name={"value"} / name (boolean)
  const re = new RegExp(`\\b${escapeRegex(name)}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|\\{\\s*['"\`]([^'"\`]*)['"\`]\\s*\\})`, 'i');
  const m = attrSegment.match(re);
  if (!m) {
    if (value === null) {
      // boolean attribute presence
      return new RegExp(`\\b${escapeRegex(name)}\\b`, 'i').test(attrSegment);
    }
    return false;
  }
  if (value === null) return true;
  const actual = m[1] ?? m[2] ?? m[3] ?? '';
  return actual === value;
}

/**
 * Find the closing tag offset for a JSX element, handling nested same-tag elements.
 */
export function findJSXClosingTag(source: string, openStart: number, tagName: string): number {
  // Check for self-closing tag first
  const selfCloseCheck = source.substring(openStart, openStart + 500);
  const selfCloseMatch = selfCloseCheck.match(new RegExp(`^<${tagName}\\b[^>]*/>`,'i'));
  if (selfCloseMatch) return openStart + selfCloseMatch[0].length;

  const lcTag = tagName.toLowerCase();
  let depth = 0;
  let i = openStart;

  while (i < source.length) {
    const openMatch = source.substring(i).match(new RegExp(`^<${lcTag}\\b`, 'i'));
    if (openMatch) {
      const afterOpen = source.substring(i).match(new RegExp(`^<${lcTag}\\b[^>]*/>`,'i'));
      if (afterOpen) {
        i += afterOpen[0].length;
        continue;
      }
      depth++;
      i += openMatch[0].length;
      continue;
    }

    const closeMatch = source.substring(i).match(new RegExp(`^<\\/${lcTag}\\s*>`, 'i'));
    if (closeMatch) {
      depth--;
      if (depth === 0) {
        return i + closeMatch[0].length;
      }
      i += closeMatch[0].length;
      continue;
    }

    // Skip string literals
    if (source[i] === '"' || source[i] === "'") {
      const q = source[i];
      i++;
      while (i < source.length && source[i] !== q) {
        if (source[i] === '\\') i++;
        i++;
      }
      i++;
      continue;
    }
    if (source[i] === '`') {
      i++;
      while (i < source.length && source[i] !== '`') {
        if (source[i] === '\\') i++;
        i++;
      }
      i++;
      continue;
    }

    i++;
  }
  return -1;
}

/**
 * Perform a source-level manipulation on TSX code.
 * The operation receives the return body JSX and returns modified JSX, or null on failure.
 * For TSX: extracts return body, applies op, reconstructs.
 */
export function withSourceManipulation(
  code: string,
  sourceOp: (jsx: string) => string | null
): { ok: true; code: string } | { ok: false; code: string } {
  const trimmed = (code || '').trim();
  if (!trimmed) return { ok: false, code };

  const extracted = extractJsxReturnBody(trimmed);
  if (!extracted) {
    // Try operating on the code directly (e.g., JSX fragment)
    const result = sourceOp(trimmed);
    if (result === null) return { ok: false, code };
    return { ok: true, code: result };
  }

  const result = sourceOp(extracted.jsx);
  if (result === null) return { ok: false, code };

  const newCode = `${extracted.before}\n    ${result}\n  ${extracted.after}`;
  return { ok: true, code: newCode };
}

/**
 * Safely query a selector with escaping, trying multiple fallback strategies
 */
export function safeFindElement(doc: Document, selector: string): Element | null {
  // Strategy 1: Try escaped selector
  try {
    const escaped = escapeCSSSelector(selector);
    const el = doc.querySelector(escaped);
    if (el) return el;
  } catch { /* noop */ }

  // Strategy 2: Strip html > body prefix with escaping
  try {
    const stripped = selector
      .replace(/^html\s*>\s*body[^\s>]*\s*>\s*/, '')
      .replace(/^body[^\s>]*\s*>\s*/, '');
    if (stripped !== selector) {
      const escaped = escapeCSSSelector(stripped);
      const el = doc.querySelector(escaped);
      if (el) return el;
    }
  } catch { /* noop */ }

  // Strategy 3: Remove all :nth-child() qualifiers with escaping
  try {
    const noNth = selector.replace(/:nth-child\(\d+\)/g, '');
    const escaped = escapeCSSSelector(noNth);
    const el = doc.querySelector(escaped);
    if (el) return el;
    
    const strippedNoNth = noNth
      .replace(/^html\s*>\s*body[^\s>]*\s*>\s*/, '')
      .replace(/^body[^\s>]*\s*>\s*/, '');
    if (strippedNoNth !== noNth) {
      const escapedStripped = escapeCSSSelector(strippedNoNth);
      const el2 = doc.querySelector(escapedStripped);
      if (el2) return el2;
    }
  } catch { /* noop */ }

  // Strategy 4: Tag-only path fallback (most permissive)
  try {
    const tagPath = selector
      .split(/\s*>\s*/)
      .map(part => part.replace(/[.#:[][^\s>]*/g, '').trim())
      .filter(Boolean)
      .filter(t => t !== 'html' && t !== 'body')
      .join(' > ');
    if (tagPath) {
      const el = doc.querySelector(tagPath);
      if (el) return el;
    }
  } catch { /* noop */ }

  return null;
}
