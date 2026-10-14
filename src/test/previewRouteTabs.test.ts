import { describe, expect, it } from 'vitest';
import { buildPreviewRouteTabs, extractRenderedRoutes } from '@/components/creatives/web-builder/previewRouteTabs';

const app = `
<HashRouter><Routes>
        <Route path="/" element={<Home />} />
        <Route path="/services" element={<Services />} />
        <Route path="/book-now" element={<UnisonPendingPage title="Book" route="/book-now" />} />
        <Route path="*" element={<Navigate to="/" replace />} />
</Routes></HashRouter>`;

describe('preview route tabs', () => {
  it('extracts rendered routes in order, excluding catch-all', () => {
    expect(extractRenderedRoutes(app)).toEqual(['/', '/services', '/book-now']);
  });

  it('shows exactly the rendered routes, hiding unrouted registry pages', () => {
    const tabs = buildPreviewRouteTabs([
      { pageId: 'home', path: '/', title: 'Home', isHome: true },
      { pageId: 'svc', path: '/services', title: 'Our Services' },
      { pageId: 'ghost', path: '/ghost', title: 'Ghost' },
    ], app);
    expect(tabs.map((t) => t.path)).toEqual(['home', 'svc', 'route:/book-now']);
    expect(tabs.map((t) => t.label)).toEqual(['Home', 'Our Services', 'Book Now']);
  });
});

import { resolveExplicitPageTarget, resolveRouteSourceFile, resolveLocalImports } from '@/components/creatives/web-builder/previewRouteTabs';
describe('resolveRouteSourceFile (click-to-edit page identity)', () => {
  const files = {
    '/src/App.tsx': `import Home from './pages/Home.tsx';\nimport About from './pages/About.tsx';\n<Route path="/" element={<Home />} />\n<Route path="/about" element={<About />} />`,
    '/src/pages/Home.tsx': 'export default function Home() {}',
    '/src/pages/About.tsx': `import { SiteNav } from '@/project-components/site/SiteNav';\nimport { Hero } from '@/unison/design-sources/Hero';`,
    '/src/project-components/site/SiteNav.tsx': 'export function SiteNav() {}',
    '/src/unison/design-sources/Hero.tsx': 'export function Hero() {}',
  };
  it('maps the clicked route to the page file the preview renders', () => {
    expect(resolveRouteSourceFile(files, '/about')).toBe('/src/pages/About.tsx');
    expect(resolveRouteSourceFile(files, '/')).toBe('/src/pages/Home.tsx');
    expect(resolveRouteSourceFile(files, '/missing')).toBeNull();
  });
  it('lists project components but never shared design sources', () => {
    expect(resolveLocalImports(files, '/src/pages/About.tsx')).toEqual(['/src/project-components/site/SiteNav.tsx']);
  });
});

describe('resolveExplicitPageTarget', () => {
  const targets = [
    { title: 'Home', route: '/', filePath: '/src/pages/Home.tsx', isHome: true },
    { title: 'Our Services', route: '/services', filePath: '/src/pages/Services.tsx' },
  ];

  it('resolves home page requests to the component rendered at the root route', () => {
    expect(resolveExplicitPageTarget('Update the home page hero.', targets)).toEqual(targets[0]);
    expect(resolveExplicitPageTarget('Refresh the homepage design.', targets)).toEqual(targets[0]);
  });

  it('resolves a named non-home page by its title or route', () => {
    expect(resolveExplicitPageTarget('Update the Our Services page.', targets)).toEqual(targets[1]);
    expect(resolveExplicitPageTarget('Change the /services page.', targets)).toEqual(targets[1]);
  });

  it('does not treat a section mention as a page request', () => {
    expect(resolveExplicitPageTarget('Update the services section on the home page.', targets)).toEqual(targets[0]);
  });
});
