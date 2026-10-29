import * as ts from 'typescript';

export interface SourceNodeIdentity {
  sourceHash: string;
  astIdentity: string;
}

export function hashSourceIdentity(path: string, source: string): string {
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  const input = `${path}\0${source}`;
  for (let index = 0; index < input.length; index += 1) {
    const code = input.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193);
    second = Math.imul(second ^ code, 0x85ebca6b);
  }
  return `${(first >>> 0).toString(16).padStart(8, '0')}${(second >>> 0).toString(16).padStart(8, '0')}`;
}

export function createAstIdentityFromText(path: string, nodeSource: string): string {
  return `${path}#${hashSourceIdentity(path, nodeSource)}`;
}

const STABLE_ID_ATTRIBUTES = new Set([
  'data-ut-section-id', 'data-ut-section', 'data-ut-slot', 'data-ut-component-id',
  'data-ut-component-instance-id', 'data-ut-binding-key', 'data-element-key', 'id', 'key',
]);

export function createAstIdentityFromSignature(
  path: string,
  tagName: string,
  attributes: ReadonlyArray<readonly [string, string]>,
): string {
  const stableAttributes = attributes
    .filter(([name]) => STABLE_ID_ATTRIBUTES.has(name))
    .map(([name, value]) => `${name}=${value}`)
    .sort();
  return createAstIdentityFromText(path, JSON.stringify({
    tag: tagName,
    attributes: stableAttributes,
  }));
}

export function createAstIdentityForOpening(
  path: string,
  opening: ts.JsxOpeningLikeElement,
  file: ts.SourceFile,
): string {
  const attributes = opening.attributes.properties
    .filter((attribute): attribute is ts.JsxAttribute => ts.isJsxAttribute(attribute)
      && ts.isIdentifier(attribute.name))
    .flatMap((attribute): Array<readonly [string, string]> => {
      const value = attribute.initializer;
      const name = attribute.name.getText(file);
      if (value && ts.isStringLiteral(value)) return [[name, value.text]];
      if (value && ts.isJsxExpression(value) && value.expression && ts.isStringLiteral(value.expression)) {
        return [[name, value.expression.text]];
      }
      return [];
    });
  return createAstIdentityFromSignature(path, opening.tagName.getText(file), attributes);
}

export function createAstIdentity(path: string, start: number, end: number, source: string): string {
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let identity: string | null = null;
  const visit = (node: ts.Node) => {
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node))
      && node.getStart(file) === start && node.end === end) {
      identity = createAstIdentityForOpening(path, node, file);
      return;
    }
    if (!identity) ts.forEachChild(node, visit);
  };
  visit(file);
  return identity ?? createAstIdentityFromText(path, source.slice(start, end));
}