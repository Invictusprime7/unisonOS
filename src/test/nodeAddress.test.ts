import { describe, it, expect } from 'vitest';
import { parseNodeAddress, resolveMutableNode } from '@/services/agent-runtime/nodeAddress';
import { buildSystemGraph } from '@/services/agent-runtime/systemGraph';

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

  it('refuses a role alias claimed by multiple pages but keeps canonical routes addressable', () => {
    const pageFiles = {
      '/src/pages/Rooms.tsx': 'export default () => <main><section id="rooms" /></main>;',
      '/src/pages/Amenities.tsx': 'export default () => <main><section id="amenities" /></main>;',
    };
    const graph = buildSystemGraph({
      files: pageFiles,
      pageIdentities: [
        { id: 'rooms', path: '/rooms', filePath: '/src/pages/Rooms.tsx', title: 'Rooms', role: 'services' },
        { id: 'amenities', path: '/amenities', filePath: '/src/pages/Amenities.tsx', title: 'Amenities', role: 'services' },
      ],
    });

    expect(graph.aliases).not.toHaveProperty('page:services');
    expect(graph.ambiguousAliases).toContain('page:services');
    expect(resolveMutableNode('page:services', pageFiles, graph)).toMatchObject({
      ok: false,
      error: expect.stringContaining('Ambiguous page alias'),
    });
    expect(resolveMutableNode('page:/rooms', pageFiles, graph)).toMatchObject({ ok: true, canonicalId: 'rooms' });
  });
});
