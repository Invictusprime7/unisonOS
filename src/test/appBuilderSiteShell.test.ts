import { describe, expect, it } from 'vitest';
import type { DesignSourceBundle } from '@/services/app-builder/design/DesignSourceBundle';
import type { DesignSourceMaterialization } from '@/services/app-builder/design/designSourceMaterializer';
import { materializeAppBuilderSiteShell } from '@/services/app-builder/design/appBuilderSiteShell';
import { findPageStructureIssues, pageStructureRequirement } from '@/services/app-builder/design/pageStructureGate';
import type { PageRegistry } from '@/types/pageRegistry';

const registry = {
  pages: {
    home: { pageId: 'home', title: 'Home', path: '/', filePath: '/src/pages/Home.tsx', pageType: 'home', navOrder: 0, showInNav: true, isHome: true },
    about: { pageId: 'about', title: 'About', path: '/about', filePath: '/src/pages/About.tsx', pageType: 'about', navOrder: 1, showInNav: true, isHome: false },
    checkout: { pageId: 'checkout', title: 'Checkout', path: '/checkout', filePath: '/src/pages/Checkout.tsx', pageType: 'checkout', navOrder: 2, showInNav: false, isHome: false },
  },
} as unknown as PageRegistry;

function sourceBundle(
  homeVariants = ['navbar:standard', 'footer:columns'],
  aboutVariants = ['navbar:standard', 'footer:columns'],
  checkoutVariants: string[] = [],
): DesignSourceBundle {
  return {
    version: '1.0',
    identity: { seed: 'seed', industry: 'salon', templateId: 'template', themePresetId: 'theme', artDirectionPackId: 'pack', designRegistrySignature: 'registry' },
    artDirection: {},
    primitives: { families: [], legalImports: [], experienceCapabilities: [] },
    implementations: [],
    eligibleByPage: {
      home: homeVariants,
      about: aboutVariants,
      checkout: checkoutVariants,
    },
    pageCompositions: [],
    assets: [],
    dependencies: {},
  };
}

const materialization = {
  files: {
    '/src/unison/design-sources/Navbar.tsx': 'export default function Navbar() { return null; }',
    '/src/unison/design-sources/Footer.tsx': 'export default function Footer() { return null; }',
  },
  manifest: {
    version: '1.0',
    root: '/src/unison/design-sources',
    modules: [],
    unresolved: [],
    implementations: {
      'navbar:standard': { modulePath: '/src/unison/design-sources/Navbar.tsx', sectionType: 'navbar', certification: 'approved' },
      'footer:columns': { modulePath: '/src/unison/design-sources/Footer.tsx', sectionType: 'footer', certification: 'approved' },
    },
  },
} as unknown as DesignSourceMaterialization;

describe('App Builder shared site shell', () => {
  it('materializes one registered shared shell from canonical routes and satisfies the page gate', () => {
    const shell = materializeAppBuilderSiteShell({
      registry,
      businessName: 'Northstar Studio',
      bundle: sourceBundle(),
      materialization,
    });
    const page = `import { SiteNav } from "@/project-components/site/SiteNav";
import { SiteFooter } from "@/project-components/site/SiteFooter";
export default function About(){return <><SiteNav/><main><section/><section/></main><SiteFooter/></>}`;
    const files = {
      ...shell,
      '/src/pages/About.tsx': page,
    };

    expect(shell['/src/project-components/site/SiteNav.tsx']).toContain('data-ut-variant="navbar:standard"');
    expect(shell['/src/project-components/site/SiteNav.tsx']).toContain('"href":"#/about"');
    expect(shell['/src/project-components/site/SiteNav.tsx']).not.toContain('#/checkout');
    expect(shell['/src/project-components/site/SiteFooter.tsx']).toContain('data-ut-variant="footer:columns"');
    expect(shell['/src/project-components/site/SiteFooter.tsx']).toContain('"href":"#/about"');
    expect(findPageStructureIssues('/src/pages/About.tsx', page, files, pageStructureRequirement('contact', 2))).toEqual([]);
  });

  it('falls back to the first public route when home has no eligible shell variant', () => {
    expect(Object.keys(materializeAppBuilderSiteShell({
      registry,
      businessName: 'Northstar Studio',
      bundle: sourceBundle([], ['navbar:standard', 'footer:columns']),
      materialization,
    }))).toEqual(['/src/project-components/site/SiteNav.tsx', '/src/project-components/site/SiteFooter.tsx']);
  });

  it('does not materialize shell when no registered page has eligible implementations', () => {
    expect(materializeAppBuilderSiteShell({
      registry,
      businessName: 'Northstar Studio',
      bundle: sourceBundle([], [], []),
      materialization,
    })).toEqual({});
  });
});
