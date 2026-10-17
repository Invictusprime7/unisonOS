import { describe, expect, it } from 'vitest';
import { compileResolvedSiteDesignContext } from '@/services/launch/resolvedSiteDesignContext';
import { validateAppBuildCandidate } from '@/services/app-builder/appBuilderCandidate';
import { APP_BUILDER_PROTOCOL_VERSION, type AppBuildContract } from '@/services/app-builder/appBuilderContracts';

function contract(): AppBuildContract {
  const resolvedSiteDesignContext = compileResolvedSiteDesignContext({
    designSeed: 'candidate-closure', businessModel: 'general' as never,
    industry: 'salon', roles: ['home', 'contact'],
  });
  return {
    protocolVersion: APP_BUILDER_PROTOCOL_VERSION,
    identity: { projectId: 'project-1', businessId: 'business-1', siteId: 'site-1', systemType: 'website' },
    topology: {
      sitePlan: {
        siteId: 'topology-1', industry: 'salon', businessName: 'Northstar', homePageId: 'home',
        pages: [
          { id: 'home', name: 'home', title: 'Home', route: '/', role: 'home', filePath: '/src/pages/Home.tsx', visibleInNav: true, isHome: true, generatedBy: 'wizard' },
          { id: 'contact', name: 'contact', title: 'Contact', route: '/contact', role: 'contact', filePath: '/src/pages/Contact.tsx', visibleInNav: true, isHome: false, generatedBy: 'wizard' },
        ],
        navItems: ['home', 'contact'], funnels: [], redirects: [], generatedAt: '2026-09-30T12:00:00.000Z',
      },
      pageRegistry: { pages: {}, funnels: {}, homePageId: 'home', version: 1 },
    },
    business: {
      industry: 'salon', businessName: 'Northstar', goals: [], intents: [], capabilities: [], bindingGuide: '',
      branding: {
        version: '1.0',
        brandMark: {
          source: { kind: 'business-profile', field: 'logoUrl' },
          placements: [{ artifactId: 'navbar', slotId: 'navbar.brand' }, { artifactId: 'footer', slotId: 'footer.brand' }],
          image: { objectFit: 'contain', preserveAspectRatio: true, maxWidthPx: 180, maxHeightPx: 48 },
          accessibleName: 'Northstar', missingAssetFallback: { kind: 'text-wordmark', text: 'Northstar' },
        },
        logoCloud: { artifactId: 'logo-cloud', source: 'owner-authored', minimumItems: 4, emptyBehavior: 'hide_section', generatedEntriesAllowed: false },
      },
    },
    design: {
      seed: 'candidate-closure', themePresetId: 'editorial', themeTokens: {} as never,
      artDirection: {} as never, resolvedSiteDesignContext, uiFoundation: {} as never,
      registryContext: {} as never, compositionPlan: { industryId: 'salon', seed: 'candidate-closure', pages: [] },
      sourceSelection: { implementationIds: [], portableRecipeIds: [], primitiveFamilyIds: [], experiencePrimitiveIds: [], pageCompositionIds: [] },
    },
    runtime: {
      framework: 'react-vite', language: 'typescript', styling: 'tailwind',
      protectedPaths: ['/src/main.tsx'], approvedDependencies: [], approvedExperienceCapabilities: [],
    },
  };
}

const initialFiles = {
  '/src/main.tsx': 'import React from "react";',
  '/src/pages/Home.tsx': 'export default function Home(){return <main>Baseline</main>}',
  '/src/pages/Contact.tsx': 'export default function Contact(){return <main>Baseline</main>}',
};

describe('App Builder candidate closure', () => {
  it('accepts a complete multi-page candidate with project-local companion modules', async () => {
    const files = {
      ...initialFiles,
      '/src/pages/Home.tsx': 'import Card from "../project-components/Card"; export default function Home(){return <main><Card /></main>}',
      '/src/pages/Contact.tsx': 'export default function Contact(){return <main>Contact</main>}',
      '/src/project-components/Card.tsx': 'export default function Card(){return <section>Card</section>}',
    };
    const report = await validateAppBuildCandidate({ contract: contract(), files, initialFiles });

    expect(report.ok).toBe(true);
    expect(report.issues.filter((issue) => issue.severity === 'blocker')).toEqual([]);
    expect(report.sourceHash).toMatch(/^fnv1a:/);
  });

  it('blocks missing pages, unresolved companions and protected infrastructure changes', async () => {
    const files = {
      '/src/main.tsx': 'changed canonical entry',
      '/src/pages/Home.tsx': 'import Missing from "../project-components/Missing"; export default function Home(){return <Missing />}',
    };
    const report = await validateAppBuildCandidate({ contract: contract(), files, initialFiles });
    const codes = report.issues.filter((issue) => issue.severity === 'blocker').map((issue) => issue.code);

    expect(report.ok).toBe(false);
    expect(codes).toEqual(expect.arrayContaining([
      'page-body-missing',
      'protected-source-changed',
      'module-closure-unresolved-import',
    ]));
  });

  it('blocks a candidate that omits a wizard-selected binding marker', async () => {
    const withBindingGuide = contract();
    withBindingGuide.business.bindingGuide = [
      '--- INTERACTION WIRING CONTRACT ---',
      '- Page Home (/), slot hero.primary-cta: label "Book now", marker data-ut-cta="cta.hero-book", intent booking.create, target booking-form',
    ].join('\n');
    const files = {
      ...initialFiles,
      '/src/pages/Home.tsx': 'export default function Home(){return <main><button>Book now</button></main>}',
      '/src/pages/Contact.tsx': 'export default function Contact(){return <main>Contact</main>}',
    };

    const report = await validateAppBuildCandidate({ contract: withBindingGuide, files, initialFiles });

    expect(report.ok).toBe(false);
    expect(report.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'wizard-binding-marker-missing', path: '/src/pages/Home.tsx' }),
    ]));
  });

  it('accepts a candidate that carries the requested binding marker', async () => {
    const withBindingGuide = contract();
    withBindingGuide.business.bindingGuide = '- Page Home (/), slot hero.primary-cta: label "Book now", marker data-ut-cta="cta.hero-book", intent booking.create, target booking-form';
    const files = {
      ...initialFiles,
      '/src/pages/Home.tsx': 'export default function Home(){return <main><button data-ut-cta="cta.hero-book">Book now</button></main>}',
      '/src/pages/Contact.tsx': 'export default function Contact(){return <main>Contact</main>}',
    };

    const report = await validateAppBuildCandidate({ contract: withBindingGuide, files, initialFiles });

    expect(report.issues.some((issue) => issue.code === 'wizard-binding-marker-missing')).toBe(false);
  });

  it('accepts binding markers placed in the shared nav and footer a page renders', async () => {
    const withBindingGuide = contract();
    withBindingGuide.business.bindingGuide = [
      '- Page Home (/), slot nav.menu: label "Menu", marker data-ut-cta="icon.menu", intent nav.goto, target menu',
      '- Page Home (/), slot footer.newsletter: label "Subscribe", marker data-ut-cta="cta.newsletter-submit" or data-ut-cta="cta.newsletter", intent newsletter.subscribe, target newsletter',
    ].join('\n');
    const files = {
      ...initialFiles,
      '/src/pages/Home.tsx': "import SiteNav from '@/project-components/SiteNav';\nimport SiteFooter from '../project-components/SiteFooter';\nexport default function Home(){return <main><SiteNav /><SiteFooter /></main>}",
      '/src/project-components/SiteNav.tsx': 'export default function SiteNav(){return <nav><button data-ut-cta="icon.menu">Menu</button></nav>}',
      '/src/project-components/SiteFooter.tsx': 'export default function SiteFooter(){return <footer><button data-ut-cta="cta.newsletter">Subscribe</button></footer>}',
      '/src/pages/Contact.tsx': 'export default function Contact(){return <main>Contact</main>}',
    };

    const report = await validateAppBuildCandidate({ contract: withBindingGuide, files, initialFiles });

    expect(report.issues.filter((issue) => issue.code === 'wizard-binding-marker-missing')).toEqual([]);
  });

  it('blocks pages that reach into recipe internals', async () => {
    const files = {
      ...initialFiles,
      '/src/pages/Home.tsx': 'import { HeroImageStream } from "@/components/recipes/Hero"; export default function Home(){return <main><HeroImageStream /></main>}',
      '/src/pages/Contact.tsx': 'import { REGISTERED_VARIANTS } from "../unison/design-sources/recipes/Hero"; export default function Contact(){return <main />}',
    };
    const report = await validateAppBuildCandidate({ contract: contract(), files, initialFiles });
    const blocked = report.issues.filter((issue) => issue.code === 'recipe-internal-import').map((issue) => issue.path);

    expect(blocked.sort()).toEqual(['/src/pages/Contact.tsx', '/src/pages/Home.tsx']);
  });

  it('blocks design-source components rendered without required array props', async () => {
    const manifest = JSON.stringify({ implementations: { 'services:editorial-rows': { exportName: 'ServicesEditorialRows', props: 'headline, items[]' } } });
    const base = { ...initialFiles, '/.unison/design-source-manifest.json': manifest };
    const page = (body: string) => `import { ServicesEditorialRows } from "@/unison/design-sources/Services"; export default function Home(){return <main>${body}</main>}`;
    const run = async (body: string) => (await validateAppBuildCandidate({
      contract: contract(),
      files: { ...base, '/src/pages/Home.tsx': page(body) },
      initialFiles: base,
    })).issues.filter((issue) => issue.code === 'design-source-missing-props');

    expect(await run('<ServicesEditorialRows headline="x" />')).toHaveLength(1);
    expect(await run('<ServicesEditorialRows headline="x" items={[{ title: "a" }]} />')).toHaveLength(0);
    expect(await run('<ServicesEditorialRows {...props} />')).toHaveLength(0);
  });

  it('blocks empty, incomplete and nested-markup design-source usage', async () => {
    const manifest = JSON.stringify({ implementations: { 'services:editorial-rows': { exportName: 'ServicesEditorialRows', props: 'headline, items[]{title|description|price?}' } } });
    const base = { ...initialFiles, '/.unison/design-source-manifest.json': manifest };
    const codes = async (body: string) => (await validateAppBuildCandidate({
      contract: contract(),
      files: { ...base, '/src/pages/Home.tsx': `import { ServicesEditorialRows } from "@/unison/design-sources/Services"; export default function Home(){return <main>${body}</main>}` },
      initialFiles: base,
    })).issues.map((issue) => issue.code);

    expect(await codes('<ServicesEditorialRows headline="x" items={[]} />')).toContain('design-source-empty-array');
    expect(await codes('<ServicesEditorialRows headline="x" items={[{ title: "a" }]} />')).toContain('design-source-incomplete-items');
    expect(await codes('<ServicesEditorialRows headline={<h2>x</h2>} items={[{ title: "a", description: "b" }]} />')).toContain('design-source-nested-block');
    const clean = await codes('<ServicesEditorialRows headline="x" items={[{ title: "a", description: "b" }, { title: "c", description: "d" }]} />');
    expect(clean.filter((code) => code.startsWith('design-source-'))).toEqual([]);
  });

  it('blocks navigation descriptor objects rendered directly as JSX children', async () => {
    const files = {
      ...initialFiles,
      '/src/pages/Home.tsx': `const links = [{ text: 'Home', href: '/', intent: 'nav.goto', dataUiPath: '/home' }]; export default function Home(){return <nav>{links}</nav>}`,
    };
    const report = await validateAppBuildCandidate({ contract: contract(), files, initialFiles });

    expect(report.ok).toBe(false);
    expect(report.issues).toContainEqual(expect.objectContaining({
      severity: 'blocker',
      code: 'jsx-child-not-renderable',
      path: '/src/pages/Home.tsx',
    }));

    const mappedObject = await validateAppBuildCandidate({
      contract: contract(),
      files: {
        ...initialFiles,
        '/src/pages/Home.tsx': `const links = [{ text: 'Home', href: '/', intent: 'nav.goto', dataUiPath: '/home' }]; export default function Home(){return <nav>{links.map(link => link)}</nav>}`,
      },
      initialFiles,
    });
    expect(mappedObject.issues.some((issue) => issue.code === 'jsx-child-not-renderable')).toBe(true);
  });

  it('accepts navigation descriptor objects mapped to renderable elements', async () => {
    const files = {
      ...initialFiles,
      '/src/pages/Home.tsx': `const links = [{ text: 'Home', href: '/', intent: 'nav.goto', dataUiPath: '/home' }]; export default function Home(){return <nav>{links.map(link => <a key={link.href} href={link.href}>{link.text}</a>)}</nav>}`,
    };
    const report = await validateAppBuildCandidate({ contract: contract(), files, initialFiles });

    expect(report.issues.some((issue) => issue.code === 'jsx-child-not-renderable')).toBe(false);

    const passedAsProps = await validateAppBuildCandidate({
      contract: contract(),
      files: {
        ...initialFiles,
        '/src/pages/Home.tsx': `const links = [{ text: 'Home', href: '/', intent: 'nav.goto', dataUiPath: '/home' }]; function Navbar({ links }) { return <nav>{links.map(link => <a key={link.href} href={link.href}>{link.text}</a>)}</nav> } export default function Home(){return <Navbar links={links} />}`,
      },
      initialFiles,
    });
    expect(passedAsProps.issues.some((issue) => issue.code === 'jsx-child-not-renderable')).toBe(false);
  });
});
