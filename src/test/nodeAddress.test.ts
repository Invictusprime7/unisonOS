import { describe, it, expect } from 'vitest';
import { parseNodeAddress, resolveMutableNode } from '@/services/agent-runtime/nodeAddress';

const files = {
  '/src/pages/About.tsx': `import { SiteNav as Header } from '../components/SiteNav';\nexport default () => <main><Header/><section id="hero"><a data-ut-intent="nav.goto" data-ut-path="/contact">Book now</a></section></main>;`,
  '/src/components/SiteNav.tsx': 'export default () => <nav/>;',
};

describe('node addressing', () => {
  it('parses and rejects', () => {
    expect(parseNodeAddress('section:/about#hero')).toEqual({ kind: 'section', path: '/about', fragment: 'hero' });
    expect(parseNodeAddress('section:/about')).toBeNull();
    expect(parseNodeAddress('nope')).toBeNull();
  });
  it('resolves page, section, button, file to their owner file', () => {
    for (const a of ['page:/about', 'section:/about#hero', 'button:/about#book', 'file:/src/pages/About.tsx']) {
      const r = resolveMutableNode(a, files);
      expect(r.ok, a).toBe(true);
      if (r.ok) {
        expect(r.ownerPath).toBe('/src/pages/About.tsx');
        expect(r.canonicalId).toBeTruthy();
      }
    }
  });
  it('resolves component aliases to the canonical component ID and source file', () => {
    const result = resolveMutableNode('component:Header', files);
    expect(result).toMatchObject({
      ok: true,
      canonicalId: 'component:SiteNav',
      ownerPath: '/src/components/SiteNav.tsx',
    });
  });
  it('reports missing nodes', () => {
    const r = resolveMutableNode('section:/about#pricing', files);
    expect(r.ok).toBe(false);
  });
});
