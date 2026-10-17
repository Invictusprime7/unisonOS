/**
 * JSX Element Mutation Utilities
 *
 * Mutates a JSX element inside a TSX source string, using a CSS-like selector
 * (matching the format produced by the preview selection bridge:
 *   tag > tag:nth-of-type(n) > #id > tag).
 *
 * These helpers operate on the *source string* so that edits flow through the
 * canonical preview pipeline (TSX → VFS → Sandpack) instead of being applied
 * as transient DOM patches that get wiped on the next Sandpack rebuild.
 *
 * NOTE: `findElementBoundsInJSX` lives in WebBuilder.tsx — this module accepts
 * a finder callback to keep it decoupled from that file's internals.
 */

import { parseExpression } from '@babel/parser';
import * as t from '@babel/types';

export type JSXBounds = { start: number; end: number };
export type BoundsFinder = (jsx: string, selector: string) => JSXBounds | null;

// ─── style attribute helpers ────────────────────────────────────────────────

const camelCase = (k: string): string =>
  k.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

/**
 * Parse a JSX style={{ ... }} attribute body into a key/value record.
 * Supports object-literal syntax with string and unquoted keys.
 * Returns null if parsing fails (we leave the attr untouched in that case).
 */
function parseStyleObject(body: string): Record<string, string> | null {
  // Strip outer braces {{ ... }} → leave inner object body
  const cleaned = body.trim();
  // Body is the inner object: key: 'value', key: "value", 'key': 'value'
  const out: Record<string, string> = {};
  const re = /(?:'([^']+)'|"([^"]+)"|([A-Za-z_$][\w$-]*))\s*:\s*(?:'([^']*)'|"([^"]*)"|`([^`]*)`)\s*,?/g;
  let m: RegExpExecArray | null;
  let matched = false;
  while ((m = re.exec(cleaned)) !== null) {
    matched = true;
    const key = m[1] || m[2] || m[3];
    const val = m[4] ?? m[5] ?? m[6] ?? '';
    if (key) out[camelCase(key)] = val;
  }
  if (!matched && cleaned.replace(/[{}\s]/g, '').length > 0) return null;
  return out;
}

function serializeStyleObject(styles: Record<string, string>): string {
  const entries = Object.entries(styles)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${camelCase(k)}: '${String(v).replace(/'/g, "\\'")}'`);
  return `{{ ${entries.join(', ')} }}`;
}

// ─── opening-tag mutation ───────────────────────────────────────────────────

interface OpenTag {
  /** offset of the leading `<` */
  start: number;
  /** offset just past the closing `>` */
  end: number;
  /** offset just past the tag name (where attributes start) */
  attrsStart: number;
  /** offset of the closing `>` (or `/>`) */
  attrsEnd: number;
  /** whether the tag is self-closing `<.../>` */
  selfClose: boolean;
  raw: string;
}

function findOpenTag(source: string, elStart: number): OpenTag | null {
  if (source[elStart] !== '<') return null;
  // Tag name
  const tagMatch = source.substring(elStart).match(/^<([A-Za-z][\w-]*)/);
  if (!tagMatch) return null;
  const attrsStart = elStart + tagMatch[0].length;

  // Walk forward, respecting strings, template literals, and balanced braces (JSX expressions)
  let i = attrsStart;
  let depth = 0;
  while (i < source.length) {
    const ch = source[i];
    if (depth === 0) {
      if (ch === '>') {
        const selfClose = source[i - 1] === '/';
        return {
          start: elStart,
          end: i + 1,
          attrsStart,
          attrsEnd: i,
          selfClose,
          raw: source.substring(elStart, i + 1),
        };
      }
    }
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    else if (ch === '"' || ch === "'") {
      const q = ch;
      i++;
      while (i < source.length && source[i] !== q) {
        if (source[i] === '\\') i++;
        i++;
      }
    } else if (ch === '`') {
      i++;
      while (i < source.length && source[i] !== '`') {
        if (source[i] === '\\') i++;
        i++;
      }
    }
    i++;
  }
  return null;
}

/**
 * Find an attribute on an opening tag.
 * Returns offsets relative to `source` for the whole `key=value` span,
 * plus the value span (without quotes/braces).
 */
interface AttrSpan {
  fullStart: number;
  fullEnd: number;
  valueStart: number;
  valueEnd: number;
  /** delimiter: `"` `'` or `{` */
  delimiter: '"' | "'" | '{';
}

function findAttribute(source: string, tag: OpenTag, attrName: string): AttrSpan | null {
  const region = source.substring(tag.attrsStart, tag.attrsEnd);
  // Match: <space>name=  → followed by ", ', or {
  const re = new RegExp(`(^|\\s)(${attrName.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')})\\s*=\\s*`, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(region)) !== null) {
    const nameStart = tag.attrsStart + m.index + m[1].length;
    const eqEnd = tag.attrsStart + m.index + m[0].length;
    const delim = source[eqEnd];
    if (delim === '"' || delim === "'") {
      const valueStart = eqEnd + 1;
      let i = valueStart;
      while (i < source.length && source[i] !== delim) {
        if (source[i] === '\\') i++;
        i++;
      }
      const valueEnd = i;
      return {
        fullStart: nameStart,
        fullEnd: valueEnd + 1,
        valueStart,
        valueEnd,
        delimiter: delim,
      };
    }
    if (delim === '{') {
      const valueStart = eqEnd + 1;
      let i = valueStart;
      let depth = 1;
      while (i < source.length && depth > 0) {
        const c = source[i];
        if (c === '{') depth++;
        else if (c === '}') depth--;
        else if (c === '"' || c === "'") {
          const q = c;
          i++;
          while (i < source.length && source[i] !== q) {
            if (source[i] === '\\') i++;
            i++;
          }
        } else if (c === '`') {
          i++;
          while (i < source.length && source[i] !== '`') {
            if (source[i] === '\\') i++;
            i++;
          }
        }
        if (depth > 0) i++;
      }
      const valueEnd = i; // position of closing brace
      return {
        fullStart: nameStart,
        fullEnd: valueEnd + 1,
        valueStart,
        valueEnd,
        delimiter: '{',
      };
    }
  }
  return null;
}

function setAttribute(source: string, tag: OpenTag, attrName: string, valueLiteral: string): string {
  const existing = findAttribute(source, tag, attrName);
  if (existing) {
    return source.substring(0, existing.fullStart) +
      `${attrName}=${valueLiteral}` +
      source.substring(existing.fullEnd);
  }
  // Insert before closing `>` or `/>`
  const insertAt = tag.selfClose ? tag.attrsEnd - 1 : tag.attrsEnd;
  const padded = ` ${attrName}=${valueLiteral}`;
  return source.substring(0, insertAt) + padded + source.substring(insertAt);
}

function removeAttribute(source: string, tag: OpenTag, attrName: string): string {
  const existing = findAttribute(source, tag, attrName);
  if (!existing) return source;
  // Trim a leading whitespace so we don't leave `  ` gaps
  let cutStart = existing.fullStart;
  while (cutStart > tag.attrsStart && /\s/.test(source[cutStart - 1])) cutStart--;
  return source.substring(0, cutStart) + source.substring(existing.fullEnd);
}

// ─── public mutators ────────────────────────────────────────────────────────

export function mutateJSXStyles(
  source: string,
  selector: string,
  styleUpdates: Record<string, string>,
  findBounds: BoundsFinder,
): string | null {
  const bounds = findBounds(source, selector);
  if (!bounds) return null;
  const tag = findOpenTag(source, bounds.start);
  if (!tag) return null;

  const styleAttr = findAttribute(source, tag, 'style');
  let merged: Record<string, string> = {};
  if (styleAttr && styleAttr.delimiter === '{') {
    const raw = source.substring(styleAttr.valueStart, styleAttr.valueEnd).trim();
    // Styles with numbers, variables, spreads or expressions can't be re-written
    // faithfully: keep them intact and layer the updates on top instead.
    const simple = parseStyleObject(raw);
    const lossy = !simple || /\.\.\.|:\s*[^'"`\s]/.test(raw.replace(/^\{|\}$/g, '').replace(/'[^']*'|"[^"]*"|`[^`]*`/g, "''"));
    if (lossy) {
      const extra = Object.entries(styleUpdates).map(([k, v]) => `${camelCase(k)}: '${String(v).replace(/'/g, "\\'")}'`).join(', ');
      const base = raw.startsWith('{') ? raw : `{ ${raw} }`;
      return setAttribute(source, tag, 'style', `{{ ...${raw.startsWith('{') ? base : `(${raw})`}, ${extra} }}`);
    }
  }
  if (styleAttr && styleAttr.delimiter === '{') {
    // value is `{ ... }` — strip outer braces from {{ ... }} to get the inner object literal `{ ... }`
    const inner = source.substring(styleAttr.valueStart, styleAttr.valueEnd);
    const parsed = parseStyleObject(inner);
    if (parsed) merged = parsed;
  }
  const next: Record<string, string> = { ...merged };
  for (const [k, v] of Object.entries(styleUpdates)) {
    next[camelCase(k)] = v;
  }
  return setAttribute(source, tag, 'style', serializeStyleObject(next));
}

export function mutateJSXAttributes(
  source: string,
  selector: string,
  attributes: Record<string, string>,
  findBounds: BoundsFinder,
): string | null {
  const bounds = findBounds(source, selector);
  if (!bounds) return null;
  let working = source;
  // Re-find tag for each mutation since offsets change
  for (const [key, raw] of Object.entries(attributes)) {
    const b = findBounds(working, selector);
    if (!b) return null;
    const tag = findOpenTag(working, b.start);
    if (!tag) return null;
    const value = (raw ?? '').toString();
    if (value === '') {
      working = removeAttribute(working, tag, key);
    } else {
      const escaped = value.replace(/"/g, '&quot;');
      working = setAttribute(working, tag, key, `"${escaped}"`);
    }
  }
  return working;
}

export function mutateJSXImageSrc(
  source: string,
  selector: string,
  src: string,
  findBounds: BoundsFinder,
): string | null {
  return mutateJSXAttributes(source, selector, { src }, findBounds);
}

/**
 * Replace source-owned text without dropping inline elements or icon children.
 * Dynamic data expressions refuse: their saved-record owner must handle edits.
 */
export function mutateJSXText(
  source: string,
  selector: string,
  text: string,
  findBounds: BoundsFinder,
): string | null {
  const bounds = findBounds(source, selector);
  if (!bounds) return null;
  const tag = findOpenTag(source, bounds.start);
  if (!tag) return null;
  if (tag.selfClose) return null;

  // Children span: just past the opening tag, up to the closing `</tag>` at bounds.end
  const childStart = tag.end;
  const closeTagMatch = source.substring(0, bounds.end).match(/<\/[A-Za-z][\w-]*\s*>\s*$/);
  if (!closeTagMatch) return null;
  const childEnd = bounds.end - closeTagMatch[0].length;
  if (childEnd < childStart) return null;

  const existing = source.substring(childStart, childEnd);
  if (/<[A-Za-z]|\{/.test(existing)) {
    const fragment = source.slice(bounds.start, bounds.end);
    const leaves: Array<{ start: number; end: number; value: string }> = [];
    const inline = new Set(['span', 'strong', 'em', 'b', 'i', 'u', 's', 'small', 'mark', 'a', 'sup', 'sub', 'code']);
    let valid = true;
    try {
      const root = parseExpression(fragment, { plugins: ['jsx', 'typescript'] });
      if (!t.isJSXElement(root)) return null;
      const collect = (node: t.JSXElement | t.JSXFragment) => {
        for (const child of node.children) {
          if (t.isJSXText(child)) {
            // React's JSX whitespace cleanup, not DOM textContent's indentation.
            const lines = child.value.split(/\r\n|\n|\r/);
            const last = lines.reduce((found, line, i) => /[^ \t]/.test(line) ? i : found, 0);
            const value = lines.map((line, i) => {
              let next = line.replace(/\t/g, ' ');
              if (i !== 0) next = next.replace(/^ +/, '');
              if (i !== lines.length - 1) next = next.replace(/ +$/, '');
              return next && i !== last ? next + ' ' : next;
            }).join('');
            if (value && child.start != null && child.end != null) leaves.push({ start: child.start, end: child.end, value });
          } else if (t.isJSXFragment(child)) collect(child);
          else if (t.isJSXElement(child)) {
            const name = child.openingElement.name;
            if (t.isJSXIdentifier(name) && inline.has(name.name)) collect(child);
            else if (!child.openingElement.selfClosing && !(t.isJSXIdentifier(name) && name.name === 'svg')) valid = false;
          } else if (t.isJSXExpressionContainer(child)) {
            if (t.isJSXEmptyExpression(child.expression)) continue;
            const expr = child.expression;
            const value = t.isStringLiteral(expr) ? expr.value : t.isTemplateLiteral(expr) && !expr.expressions.length ? expr.quasis[0]?.value.cooked : null;
            if (value == null) valid = false;
            else if (child.start != null && child.end != null) leaves.push({ start: child.start, end: child.end, value });
          } else valid = false;
        }
      };
      collect(root);
    } catch { return null; }
    if (!valid || !leaves.length) return null;
    const old = leaves.map(leaf => leaf.value).join('');
    if (old === text) return source;
    let prefix = 0;
    while (prefix < old.length && prefix < text.length && old[prefix] === text[prefix]) prefix++;
    let suffix = 0;
    while (suffix < old.length - prefix && suffix < text.length - prefix && old[old.length - suffix - 1] === text[text.length - suffix - 1]) suffix++;
    const cutEnd = old.length - suffix;
    const insertion = text.slice(prefix, text.length - suffix);
    let offset = 0;
    let inserted = false;
    const edits = leaves.map(leaf => {
      const from = offset;
      const to = offset + leaf.value.length;
      offset = to;
      const insertHere = !inserted && prefix >= from && (prefix < to || prefix === old.length && to === old.length);
      const before = leaf.value.slice(0, Math.max(0, Math.min(leaf.value.length, prefix - from)));
      const after = leaf.value.slice(Math.max(0, Math.min(leaf.value.length, cutEnd - from)));
      if (to < prefix || from > cutEnd) return null;
      if (insertHere) inserted = true;
      return { ...leaf, next: before + (insertHere ? insertion : '') + after };
    }).filter((edit) => edit !== null);
    let next = source;
    for (const edit of edits.reverse()) {
      // A literal expression renders &, braces and angle brackets as text, never JSX.
      const value = edit.next ? `{${JSON.stringify(edit.next)}}` : '';
      next = next.slice(0, bounds.start + edit.start) + value + next.slice(bounds.start + edit.end);
    }
    return next;
  }

  // Escape JSX-significant characters in the new text
  const safe = /[&{}<>]/.test(text) ? `{${JSON.stringify(text)}}` : text;
  return source.substring(0, childStart) + safe + source.substring(childEnd);
}

// ─────────────────────────────────────────────────────────────────────────────
// className mutation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Add/remove Tailwind tokens in the className attribute of a JSX element.
 * Removal patterns can be exact tokens or `prefix-*` wildcards.
 *
 * Supports:
 *   • className="static string"
 *   • className={'literal'} / className={"literal"} / className={`tpl`}
 *   • className={cn('a', 'b')} — appends a trailing string arg with the deltas
 *
 * Returns the updated source, or null if the element/className couldn't be
 * mutated safely (we never silently drop dynamic expressions).
 */
export function mutateJSXClassName(
  source: string,
  selector: string,
  add: string[],
  remove: string[],
  findBounds: BoundsFinder,
): string | null {
  const bounds = findBounds(source, selector);
  if (!bounds) return null;
  const tag = findOpenTag(source, bounds.start);
  if (!tag) return null;

  const applyTokens = (existing: string): string => {
    const tokens = new Set(existing.split(/\s+/).filter(Boolean));
    for (const r of remove) {
      if (r.endsWith('*')) {
        const prefix = r.slice(0, -1);
        for (const t of Array.from(tokens)) if (t.startsWith(prefix)) tokens.delete(t);
      } else {
        tokens.delete(r);
      }
    }
    for (const a of add) if (a) tokens.add(a);
    return Array.from(tokens).join(' ');
  };

  const existing = findAttribute(source, tag, 'className');
  if (!existing) {
    // No className attribute — insert a new one.
    const next = applyTokens('');
    if (!next) return source;
    return setAttribute(source, tag, 'className', `"${next}"`);
  }

  // Static string: className="..."
  if (existing.delimiter === '"' || existing.delimiter === "'") {
    const current = source.substring(existing.valueStart, existing.valueEnd);
    const next = applyTokens(current);
    return setAttribute(source, tag, 'className', `"${next.replace(/"/g, '&quot;')}"`);
  }

  // Expression: className={ ... }
  const inner = source.substring(existing.valueStart, existing.valueEnd).trim();

  // Plain string literal in braces: {'foo bar'} or {"foo bar"} or {`foo bar`}
  const literalMatch = inner.match(/^(['"`])([\s\S]*)\1$/);
  if (literalMatch) {
    const current = literalMatch[2];
    const next = applyTokens(current);
    return setAttribute(source, tag, 'className', `"${next.replace(/"/g, '&quot;')}"`);
  }

  // cn(...) / clsx(...) / classnames(...) call — append a trailing string arg
  // containing the additions, and a comment for removals (we can't rewrite
  // arbitrary JS expressions safely).
  const callMatch = inner.match(/^(cn|clsx|classnames|twMerge)\s*\(([\s\S]*)\)$/);
  if (callMatch) {
    const fnName = callMatch[1];
    const args = callMatch[2].trim();
    const additions = add.filter(Boolean).join(' ');
    if (!additions && remove.length === 0) return source;
    const trailing = additions ? `, '${additions.replace(/'/g, "\\'")}'` : '';
    const newInner = `${fnName}(${args}${trailing})`;
    return setAttribute(source, tag, 'className', `{${newInner}}`);
  }

  // Unrecognised dynamic expression — refuse to mutate (avoid breaking the build).
  return null;
}

