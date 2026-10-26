import { describe, expect, it } from 'vitest';
import { resolvePreviewSource } from '@/services/editor/previewSourceResolver';

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
const at = (locator: string, extra: Record<string, unknown> = {}) =>
  resolvePreviewSource({ locator, files, pagePath: '/src/pages/Home.tsx', registeredPagePaths: ['/src/pages/Home.tsx'], ...extra });

describe('preview source resolution', () => {
  it('resolves a custom static node to its source span and owner', () => {
    const r = at('/src/pages/Home.tsx:3:5');
    expect(r).toMatchObject({ mode: 'editable', reason: 'static-node', tagName: 'h1', ownerPath: '/src/pages/Home.tsx', repeated: false });
    expect(page.slice(r.span!.start, r.span!.end)).toBe('<h1>Welcome</h1>');
  });
  it('requires an instance index for repeated list nodes and flags dynamic text', () => {
    expect(at('/src/pages/Home.tsx:4:29')).toMatchObject({ mode: 'inspect-only', reason: 'repeated-instance-unknown', repeated: true });
    expect(at('/src/pages/Home.tsx:4:29', { instanceIndex: 2 })).toMatchObject({ mode: 'inspect-only', reason: 'dynamic-content', instanceIndex: 2 });
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
});
