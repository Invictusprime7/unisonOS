import * as ts from 'typescript';
import { parseSourceLocator, resolvePreviewSource } from '@/services/editor/previewSourceResolver';
import { findElementBoundsInJSX } from './jsxSourceUtils';
import { anchoredFinder, textRunsFromHtml } from './pictureInsertion';

export type SelectionBoundsFinder = typeof findElementBoundsInJSX;
export interface SourceSelection {
  tagName?: string;
  html?: string;
  descriptor?: { sourceLocator?: string | null; instanceId?: number | null };
}

/** Exact source coordinates win over DOM positions; stale/protected locators never guess. */
export function selectedSourceFinder(selection?: SourceSelection | null): SelectionBoundsFinder {
  const locator = selection?.descriptor?.sourceLocator;
  const parsed = parseSourceLocator(locator);
  if (locator) return (source) => {
    if (!parsed) return null;
    const resolved = resolvePreviewSource({
      locator, files: { [parsed.path]: source }, instanceIndex: selection?.descriptor?.instanceId,
    });
    if (!resolved.span || resolved.protection?.directMutation === 'denied'
      || resolved.reason === 'repeated-instance-unknown'
      || (selection?.tagName && resolved.tagName?.toLowerCase() !== selection.tagName.toLowerCase())) return null;
    // Dynamic children forbid literal text rewriting in mutateJSXText, not changing the container's style.
    return resolved.span;
  };
  return anchoredFinder(findElementBoundsInJSX, {
    tag: selection?.tagName?.toLowerCase(), runs: textRunsFromHtml(selection?.html),
  });
}

/** Structural edits operate on whole source, including non-first returns and imported components. */
export function mutateSelectedStructure(
  source: string, selector: string, operation: 'delete' | 'duplicate' | 'up' | 'down',
  findBounds: SelectionBoundsFinder,
): string | null {
  const bounds = findBounds(source, selector);
  if (!bounds) return null;
  const file = ts.createSourceFile('selection.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let selected: ts.JsxElement | ts.JsxSelfClosingElement | undefined;
  const visit = (node: ts.Node) => {
    if ((ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node))
      && node.getStart(file) === bounds.start && node.end === bounds.end) selected = node;
    if (!selected) ts.forEachChild(node, visit);
  };
  visit(file);
  if (!selected) return null;
  const parent = selected.parent;
  // A root return cannot be deleted/duplicated without changing component semantics.
  if (!ts.isJsxElement(parent) && !ts.isJsxFragment(parent)) return null;
  const literal = source.slice(bounds.start, bounds.end);
  if (operation === 'delete') return source.slice(0, bounds.start) + source.slice(bounds.end);
  if (operation === 'duplicate') return source.slice(0, bounds.end) + '\n' + literal + source.slice(bounds.end);
  const children = parent.children.filter((child) => !ts.isJsxText(child) || child.text.trim());
  const index = children.indexOf(selected);
  const sibling = children[index + (operation === 'up' ? -1 : 1)];
  if (!sibling || (!ts.isJsxElement(sibling) && !ts.isJsxSelfClosingElement(sibling))) return null;
  const other = { start: sibling.getStart(file), end: sibling.end };
  const first = operation === 'up' ? other : bounds;
  const last = operation === 'up' ? bounds : other;
  return source.slice(0, first.start) + source.slice(last.start, last.end)
    + source.slice(first.end, last.start) + source.slice(first.start, first.end) + source.slice(last.end);
}