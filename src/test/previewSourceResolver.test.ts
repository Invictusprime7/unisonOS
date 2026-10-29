import { describe, expect, it } from 'vitest';
import { resolvePreviewSource } from '@/services/editor/previewSourceResolver';
import { createAstIdentity, hashSourceIdentity } from '@/services/editor/sourceIdentity';
import * as ts from 'typescript';
import { parseSourceLocator } from '@/services/editor/previewSourceResolver';

const page = [
  'export default function Home({ items }: { items: string[] }) {',
  '  return <main>',
  '    <h1>Welcome</h1>',
  '    {items.map((item, i) => <li key={i}>{item}</li>)}',
  '    <p>Static</p>',
  '  </main>;',
  '}',
].join('\n');
const card = 'export function Card() {\n  return <div>Card</div>;\n}';
const files = { '/src/pages/Home.tsx': page, '/src/components/Card.tsx': card, '/src/App.tsx': 'export default () => <div>router</div>;' };
function identityForLocator(locator: string): { sourceHash?: string; astIdentity?: string } {
  const parsed = parseSourceLocator(locator);
  const source = parsed ? files[parsed.path as keyof typeof files] : undefined;
  if (!parsed || typeof source !== 'string') return {};
  const file = ts.createSourceFile(parsed.path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  try {
    const offset = file.getPositionOfLineAndCharacter(parsed.line - 1, parsed.column - 1);
    let opening: ts.JsxOpeningElement | ts.JsxSelfClosingElement | undefined;
    const visit = (node: ts.Node) => {
      if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.getStart(file) === offset) opening = node;
      if (!opening && node.getStart(file) <= offset && offset < node.end) ts.forEachChild(node, visit);
    };
    visit(file);
    return opening ? {
      sourceHash: hashSourceIdentity(parsed.path, source),
      astIdentity: createAstIdentity(parsed.path, opening.getStart(file), opening.end, source),
    } : {};
  } catch {
    return {};
  }
}
const at = (locator: string, extra: Record<string, unknown> = {}) => resolvePreviewSource({
  locator,
  files,
  pagePath: '/src/pages/Home.tsx',
  registeredPagePaths: ['/src/pages/Home.tsx'],
  ...identityForLocator(locator),
  sourceRevisionId: 'rev-1',
  acceptedRevisionId: 'rev-1',
  ...extra,
});

describe('preview source resolution', () => {
  it('resolves a custom static node to its source span and owner', () => {
    const r = at('/src/pages/Home.tsx:3:5');
    expect(r).toMatchObject({ mode: 'editable', reason: 'static-node', tagName: 'h1', ownerPath: '/src/pages/Home.tsx', repeated: false });
    expect(page.slice(r.span!.start, r.span!.end)).toBe('<h1>Welcome</h1>');
  });
  it('requires an instance index for repeated list nodes and flags dynamic text', () => {
    expect(at('/src/pages/Home.tsx:4:29')).toMatchObject({ mode: 'inspect-only', reason: 'repeated-instance-unknown', repeated: true });
    expect(at('/src/pages/Home.tsx:4:29', { instanceIndex: 2 })).toMatchObject({ mode: 'inspect-only', reason: 'repeated-source-template', instanceIndex: 2 });
  });
  it('marks nodes from imported components as shared', () => {
    expect(at('/src/components/Card.tsx:2:10')).toMatchObject({ mode: 'editable', sharedComponent: true, ownerPath: '/src/components/Card.tsx' });
  });
  it('falls back to inspect-only for protected owners, missing files and stale locators', () => {
    expect(at('/src/App.tsx:1:22').reason).toBe('protected-owner');
    expect(at('/src/pages/Gone.tsx:1:1').reason).toBe('file-missing');
    expect(at('/src/pages/Home.tsx:3:2').reason).toBe('node-missing');
    expect(at('not-a-locator').reason).toBe('malformed-locator');
  });
  it('requires the exact source hash, AST opening node, and accepted revision before editing', () => {
    const path = '/src/pages/Home.tsx';
    const file = ts.createSourceFile(path, page, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let opening: ts.JsxOpeningElement | undefined;
    const visit = (node: ts.Node) => {
      if (ts.isJsxOpeningElement(node) && node.tagName.getText(file) === 'h1') opening = node;
      if (!opening) ts.forEachChild(node, visit);
    };
    visit(file);
    const astIdentity = createAstIdentity(path, opening!.getStart(file), opening!.end, page);
    const sourceHash = hashSourceIdentity(path, page);
    const locator = '/src/pages/Home.tsx:3:5';

    expect(resolvePreviewSource({
      locator, files, sourceHash, astIdentity, sourceRevisionId: 'rev-2', acceptedRevisionId: 'rev-2',
    })).toMatchObject({ mode: 'editable', sourceHash, astIdentity, revisionId: 'rev-2', rebased: false });
    expect(resolvePreviewSource({
      locator, files, sourceHash: 'stale', astIdentity, sourceRevisionId: 'rev-1', acceptedRevisionId: 'rev-2',
    })).toMatchObject({ mode: 'editable', reason: 'static-node', rebased: true, revisionId: 'rev-2' });
    expect(resolvePreviewSource({ locator, files, sourceHash, astIdentity: 'stale' }).reason).toBe('ast-identity-mismatch');
    expect(resolvePreviewSource({ locator, files }).reason).toBe('source-identity-unknown');
    expect(resolvePreviewSource({ locator, files, sourceHash, astIdentity }).reason).toBe('revision-unknown');
  });

  it('reacquires an unchanged JSX node after unrelated edits shift its locator', () => {
    const path = '/src/pages/Home.tsx';
    const file = ts.createSourceFile(path, page, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let opening: ts.JsxOpeningElement | undefined;
    const visit = (node: ts.Node) => {
      if (ts.isJsxOpeningElement(node) && node.tagName.getText(file) === 'h1') opening = node;
      if (!opening) ts.forEachChild(node, visit);
    };
    visit(file);
    const originalIdentity = createAstIdentity(path, opening!.getStart(file), opening!.end, page);
    const updatedPage = `// unrelated edit\n${page}`;
    const resolved = resolvePreviewSource({
      locator: '/src/pages/Home.tsx:3:5',
      files: { [path]: updatedPage },
      sourceHash: hashSourceIdentity(path, page),
      astIdentity: originalIdentity,
      sourceRevisionId: 'rev-1',
      acceptedRevisionId: 'rev-2',
    });

    expect(resolved).toMatchObject({ mode: 'editable', reason: 'static-node', rebased: true, revisionId: 'rev-2' });
    expect(updatedPage.slice(resolved.span!.start, resolved.span!.end)).toBe('<h1>Welcome</h1>');
  });

  it('keeps node identity when only its text and mutable style attributes change', () => {
    const path = '/src/pages/Home.tsx';
    const original = '<main><h1 data-ut-slot="hero.title" className="old">Welcome</h1></main>;';
    const updated = '<main><h1 className="new" data-ut-slot="hero.title" style={{ color: "red" }}>A new headline</h1></main>;';
    const file = ts.createSourceFile(path, original, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let opening: ts.JsxOpeningElement | undefined;
    const visit = (node: ts.Node) => {
      if (ts.isJsxOpeningElement(node) && node.tagName.getText(file) === 'h1') opening = node;
      if (!opening) ts.forEachChild(node, visit);
    };
    visit(file);
    const resolved = resolvePreviewSource({
      locator: `${path}:1:${opening!.getStart(file) + 1}`,
      files: { [path]: updated },
      sourceHash: hashSourceIdentity(path, original),
      astIdentity: createAstIdentity(path, opening!.getStart(file), opening!.end, original),
      sourceRevisionId: 'rev-1',
      acceptedRevisionId: 'rev-2',
    });

    expect(resolved).toMatchObject({ mode: 'editable', reason: 'static-node', rebased: true, revisionId: 'rev-2' });
  });

  it('refuses to rebase when the same JSX identity is no longer unique', () => {
    const path = '/src/pages/Home.tsx';
    const original = 'export default () => <main><p>Same</p></main>;';
    const file = ts.createSourceFile(path, original, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let opening: ts.JsxOpeningElement | undefined;
    const visit = (node: ts.Node) => {
      if (ts.isJsxOpeningElement(node) && node.tagName.getText(file) === 'p') opening = node;
      if (!opening) ts.forEachChild(node, visit);
    };
    visit(file);
    const resolved = resolvePreviewSource({
      locator: `${path}:1:27`,
      files: { [path]: 'export default () => <main><p>Same</p><p>Same</p></main>;' },
      sourceHash: hashSourceIdentity(path, original),
      astIdentity: createAstIdentity(path, opening!.getStart(file), opening!.end, original),
      sourceRevisionId: 'rev-1',
      acceptedRevisionId: 'rev-2',
    });

    expect(resolved).toMatchObject({ mode: 'inspect-only', reason: 'ast-identity-ambiguous' });
  });

  it('keeps repeated JSX templates inspect-only even when an instance index is known', () => {
    const path = '/src/pages/Repeated.tsx';
    const source = 'export default ({ items }) => <ul>{items.map((item) => <li>Static</li>)}</ul>;';
    const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let opening: ts.JsxOpeningElement | undefined;
    const visit = (node: ts.Node) => {
      if (ts.isJsxOpeningElement(node) && node.tagName.getText(file) === 'li') opening = node;
      if (!opening) ts.forEachChild(node, visit);
    };
    visit(file);
    const position = file.getLineAndCharacterOfPosition(opening!.getStart(file));
    const resolved = resolvePreviewSource({
      locator: `${path}:${position.line + 1}:${position.character + 1}`,
      files: { [path]: source },
      instanceIndex: 1,
      sourceHash: hashSourceIdentity(path, source),
      astIdentity: createAstIdentity(path, opening!.getStart(file), opening!.end, source),
      sourceRevisionId: 'rev-1',
      acceptedRevisionId: 'rev-1',
    });

    expect(resolved).toMatchObject({ mode: 'inspect-only', reason: 'repeated-source-template', repeated: true, instanceIndex: 1 });
  });
});
