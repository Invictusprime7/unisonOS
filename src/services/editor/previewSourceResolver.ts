import * as ts from 'typescript';
import { classifyVfsProtection, type VfsProtectionDecision } from '@/services/vfsProtectionMatrix';
import { createAstIdentityForOpening, hashSourceIdentity } from '@/services/editor/sourceIdentity';

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
  | 'repeated-instance-unknown'
  | 'repeated-source-template'
  | 'ast-identity-ambiguous'
  | 'source-identity-unknown'
  | 'revision-unknown'
  | 'source-hash-mismatch'
  | 'ast-identity-mismatch'
  | 'revision-mismatch';

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
  sourceHash: string | null;
  astIdentity: string | null;
  revisionId: string | null;
  rebased: boolean;
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
  sourceHash?: string | null;
  astIdentity?: string | null;
  sourceRevisionId?: string | null;
  acceptedRevisionId?: string | null;
}): PreviewSourceResolution {
  const empty: PreviewSourceResolution = {
    mode: 'inspect-only', reason: 'malformed-locator', ownerPath: null, tagName: null, repeated: false,
    instanceIndex: null, sharedComponent: false, dynamicText: false, protection: null, span: null,
    sourceHash: null, astIdentity: null, revisionId: null,
    rebased: false,
  };
  const parsed = parseSourceLocator(input.locator);
  if (!parsed) return empty;
  const source = input.files[parsed.path];
  if (typeof source !== 'string') return { ...empty, reason: 'file-missing', ownerPath: parsed.path };

  const file = ts.createSourceFile(parsed.path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const sourceHash = hashSourceIdentity(parsed.path, source);
  let offset: number | null = null;
  try {
    offset = file.getPositionOfLineAndCharacter(parsed.line - 1, parsed.column - 1);
  } catch { /* a stable identity may still reacquire a moved node */ }
  let located: ts.JsxOpeningElement | ts.JsxSelfClosingElement | null = null;
  const identityMatches: Array<ts.JsxOpeningElement | ts.JsxSelfClosingElement> = [];
  const visit = (node: ts.Node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      if (offset !== null && node.getStart(file) === offset) located = node;
      if (input.astIdentity && createAstIdentityForOpening(parsed.path, node, file) === input.astIdentity) {
        identityMatches.push(node);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  const exactAcceptedSource = input.sourceHash === sourceHash
    && Boolean(input.sourceRevisionId)
    && input.sourceRevisionId === input.acceptedRevisionId;
  const locatedIdentity = located
    ? createAstIdentityForOpening(parsed.path, located, file)
    : null;
  const exactLocatorProven = exactAcceptedSource && locatedIdentity === input.astIdentity;
  if (identityMatches.length > 1 && !exactLocatorProven) {
    return { ...empty, reason: 'ast-identity-ambiguous', ownerPath: parsed.path };
  }
  const opening = exactLocatorProven
    ? located as ts.JsxOpeningElement | ts.JsxSelfClosingElement
    : identityMatches[0] ?? (located as ts.JsxOpeningElement | ts.JsxSelfClosingElement | null);
  if (!opening) return { ...empty, reason: input.astIdentity ? 'ast-identity-mismatch' : 'node-missing', ownerPath: parsed.path };
  if (!input.sourceHash) return { ...empty, reason: 'source-identity-unknown', ownerPath: parsed.path, sourceHash };
  const element = ts.isJsxOpeningElement(opening) ? opening.parent : opening;
  const astIdentity = createAstIdentityForOpening(parsed.path, opening, file);
  if (!input.astIdentity) return { ...empty, reason: 'source-identity-unknown', ownerPath: parsed.path, sourceHash, astIdentity };
  if (input.astIdentity !== astIdentity) {
    return { ...empty, reason: input.sourceHash !== sourceHash ? 'source-hash-mismatch' : 'ast-identity-mismatch', ownerPath: parsed.path, sourceHash, astIdentity };
  }
  if (!input.sourceRevisionId || !input.acceptedRevisionId) {
    return { ...empty, reason: 'revision-unknown', ownerPath: parsed.path, sourceHash, astIdentity };
  }

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
    sourceHash,
    astIdentity,
    revisionId: input.acceptedRevisionId,
    rebased: input.sourceHash !== sourceHash || input.sourceRevisionId !== input.acceptedRevisionId
      || (offset !== null && opening.getStart(file) !== offset),
  };
  if (protection.directMutation === 'denied') return { ...base, mode: 'inspect-only', reason: 'protected-owner' };
  if (repeated && base.instanceIndex === null) return { ...base, mode: 'inspect-only', reason: 'repeated-instance-unknown' };
  if (repeated) return { ...base, mode: 'inspect-only', reason: 'repeated-source-template' };
  if (dynamicText) return { ...base, mode: 'inspect-only', reason: 'dynamic-content' };
  return base;
}
