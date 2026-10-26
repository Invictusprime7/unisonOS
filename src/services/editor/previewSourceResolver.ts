import * as ts from 'typescript';
import { classifyVfsProtection, type VfsProtectionDecision } from '@/services/vfsProtectionMatrix';

/**
 * P2 — universal preview selection.
 *
 * Resolves a preview click's `data-ut-source-locator` ("/path:line:col") to the
 * exact JSX node in saved source, its mutation owner, and whether a direct
 * source rewrite is safe. Anything that cannot be rewritten safely resolves to
 * `inspect-only` with a reason instead of guessing (fallback inspector).
 */
export type PreviewSourceReason =
  | 'static-node'
  | 'malformed-locator'
  | 'file-missing'
  | 'node-missing'
  | 'protected-owner'
  | 'dynamic-content'
  | 'repeated-instance-unknown';

export interface PreviewSourceResolution {
  mode: 'editable' | 'inspect-only';
  reason: PreviewSourceReason;
  ownerPath: string | null;
  tagName: string | null;
  /** True when the node renders inside a `.map(...)` callback (one source node, many preview nodes). */
  repeated: boolean;
  /** Preview instance index for repeated nodes; rewrites change every instance. */
  instanceIndex: number | null;
  /** True when the node is defined in a file other than the page being edited (shared component). */
  sharedComponent: boolean;
  /** Text children are expressions, so text edits cannot be written as literals. */
  dynamicText: boolean;
  protection: VfsProtectionDecision | null;
  span: { start: number; end: number } | null;
}

export function parseSourceLocator(locator: string | null | undefined): { path: string; line: number; column: number } | null {
  const match = /^(\/.+):(\d+):(\d+)$/.exec(locator ?? '');
  if (!match) return null;
  return { path: match[1], line: Number(match[2]), column: Number(match[3]) };
}

export function resolvePreviewSource(input: {
  locator: string | null | undefined;
  files: Record<string, string>;
  pagePath?: string | null;
  instanceIndex?: number | null;
  registeredPagePaths?: readonly string[];
  compilerGeneratedPaths?: readonly string[];
}): PreviewSourceResolution {
  const empty: PreviewSourceResolution = {
    mode: 'inspect-only', reason: 'malformed-locator', ownerPath: null, tagName: null, repeated: false,
    instanceIndex: null, sharedComponent: false, dynamicText: false, protection: null, span: null,
  };
  const parsed = parseSourceLocator(input.locator);
  if (!parsed) return empty;
  const source = input.files[parsed.path];
  if (typeof source !== 'string') return { ...empty, reason: 'file-missing', ownerPath: parsed.path };

  const file = ts.createSourceFile(parsed.path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let offset: number;
  try {
    offset = file.getPositionOfLineAndCharacter(parsed.line - 1, parsed.column - 1);
  } catch {
    return { ...empty, reason: 'node-missing', ownerPath: parsed.path };
  }
  let found: ts.JsxOpeningElement | ts.JsxSelfClosingElement | null = null;
  const visit = (node: ts.Node) => {
    if (found) return;
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.getStart(file) === offset) {
      found = node;
      return;
    }
    if (node.getStart(file) <= offset && offset < node.getEnd()) ts.forEachChild(node, visit);
  };
  visit(file);
  const opening = found as ts.JsxOpeningElement | ts.JsxSelfClosingElement | null;
  if (!opening) return { ...empty, reason: 'node-missing', ownerPath: parsed.path };

  const element = ts.isJsxOpeningElement(opening) ? opening.parent : opening;
  let repeated = false;
  for (let cur: ts.Node | undefined = element.parent; cur; cur = cur.parent) {
    if (ts.isCallExpression(cur) && ts.isPropertyAccessExpression(cur.expression)
      && ['map', 'flatMap'].includes(cur.expression.name.text)) { repeated = true; break; }
  }
  const dynamicText = ts.isJsxElement(element)
    && element.children.some((child) => ts.isJsxExpression(child) && !!child.expression);
  const protection = classifyVfsProtection({
    path: parsed.path,
    registeredPagePaths: input.registeredPagePaths,
    compilerGeneratedPaths: input.compilerGeneratedPaths,
  });
  const base: PreviewSourceResolution = {
    mode: 'editable', reason: 'static-node', ownerPath: parsed.path,
    tagName: opening.tagName.getText(file), repeated,
    instanceIndex: repeated ? input.instanceIndex ?? null : null,
    sharedComponent: !!input.pagePath && input.pagePath !== parsed.path,
    dynamicText, protection, span: { start: element.getStart(file), end: element.getEnd() },
  };
  if (protection.directMutation === 'denied') return { ...base, mode: 'inspect-only', reason: 'protected-owner' };
  if (repeated && base.instanceIndex === null) return { ...base, mode: 'inspect-only', reason: 'repeated-instance-unknown' };
  if (dynamicText) return { ...base, mode: 'inspect-only', reason: 'dynamic-content' };
  return base;
}
