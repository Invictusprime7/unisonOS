import { describe, expect, it } from 'vitest';
import { selectedSourceFinder, mutateSelectedStructure } from '@/components/creatives/web-builder/selectedSourceMutation';
import { mutateJSXStyles, mutateJSXText } from '@/utils/jsxElementMutation';
import * as ts from 'typescript';
import { createAstIdentity, hashSourceIdentity } from '@/services/editor/sourceIdentity';

const source = 'export default () => <main>\n<section data-component="intent-newsletter">First</section>\n<section data-component="intent-newsletter">Second</section>\n</main>;';
const selector = '[data-component="intent-newsletter"]';
function selectionFor(locator: string, contents = source) {
  const path = /^(\/[^:]+):/.exec(locator)?.[1] ?? '/src/components/News.tsx';
  const file = ts.createSourceFile('selected.tsx', contents, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const match = /:(\d+):(\d+)$/.exec(locator);
  if (!match) return { tagName: 'section', descriptor: { sourceLocator: locator } };
  const offset = file.getPositionOfLineAndCharacter(Number(match[1]) - 1, Number(match[2]) - 1);
  let opening: ts.JsxOpeningElement | ts.JsxSelfClosingElement | undefined;
  const visit = (node: ts.Node) => {
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.getStart(file) === offset) opening = node;
    if (!opening && node.getStart(file) <= offset && offset < node.end) ts.forEachChild(node, visit);
  };
  visit(file);
  return {
    tagName: 'section',
    descriptor: {
      sourceLocator: locator,
      sourceHash: hashSourceIdentity(path, contents),
      astIdentity: opening ? createAstIdentity(path, opening.getStart(file), opening.end, contents) : null,
      sourceRevisionId: 'revision-1',
      revisionId: 'revision-1',
    },
  };
}
const selection = selectionFor('/src/components/News.tsx:3:1');

describe('selected source edits', () => {
  it('deletes the exact clicked imported section instead of the first matching selector', () => {
    const result = mutateSelectedStructure(source, selector, 'delete', selectedSourceFinder(selection));
    expect(result).toContain('First');
    expect(result).not.toContain('Second');
  });
  it('updates text and styles on the located second section', () => {
    const finder = selectedSourceFinder(selection);
    expect(mutateJSXText(source, selector, 'Changed', finder)).toContain('>First</section>\n<section data-component="intent-newsletter">Changed</section>');
    expect(mutateJSXStyles(source, selector, { display: 'none' }, finder)).toContain('>First</section>\n<section data-component="intent-newsletter" style=');
  });
  it('moves adjacent JSX siblings without swallowing earlier siblings', () => {
    const moved = mutateSelectedStructure(source, selector, 'up', selectedSourceFinder(selection));
    expect(moved).toContain('>Second</section>\n<section data-component="intent-newsletter">First</section>');
  });
  it('moves the first section down without losing or duplicating source', () => {
    const finder = selectedSourceFinder(selectionFor('/src/components/News.tsx:2:1'));
    expect(mutateSelectedStructure(source, selector, 'down', finder)).toBe(source.replace('>First</section>\n<section data-component="intent-newsletter">Second', '>Second</section>\n<section data-component="intent-newsletter">First'));
  });
  it('duplicates only the clicked section', () => {
    expect(mutateSelectedStructure(source, selector, 'duplicate', selectedSourceFinder(selection))).toBe(source.replace('>Second</section>', '>Second</section>\n<section data-component="intent-newsletter">Second</section>'));
  });
  it('does not fall back to a matching selector for a stale or protected locator', () => {
    for (const locator of ['/src/components/News.tsx:3:2', 'bad', '/src/unison/News.tsx:3:1']) {
      expect(mutateSelectedStructure(source, selector, 'delete', selectedSourceFinder(selectionFor(locator)))).toBeNull();
    }
  });
  it('allows container styling with dynamic children but refuses literal text replacement', () => {
    const dynamic = 'export default () => <main><section>{title}</section></main>;';
    const finder = selectedSourceFinder(selectionFor('/src/pages/Home.tsx:1:28', dynamic));
    expect(mutateJSXStyles(dynamic, 'section', { display: 'none' }, finder)).toContain("display: 'none'");
    expect(mutateJSXText(dynamic, 'section', 'Changed', finder)).toBeNull();
  });
});