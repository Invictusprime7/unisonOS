import { describe, expect, it } from 'vitest';
import { inspectAppBuilderPageSectionClosure, inspectAppBuilderPageSections, materializeAppBuilderSectionModels } from '@/services/app-builder/appBuilderSectionModel';
import { collectLocalImportClosure } from '@/services/laneBCompanionModules';

const implementations = {
  'navbar:standard': {
    modulePath: '/src/unison/design-sources/Navbar.tsx',
    sectionType: 'navbar',
  },
  'services:editorial-rows': {
    modulePath: '/src/unison/design-sources/Services.tsx',
    sectionType: 'services',
  },
  'footer:columns': {
    modulePath: '/src/unison/design-sources/Footer.tsx',
    sectionType: 'footer',
  },
};

describe('App Builder section model', () => {
  it('serializes stable section identity, registered variant, and static props', () => {
    const source = `import Navbar from "@/unison/design-sources/Navbar";
import Services from "@/unison/design-sources/Services";
import Footer from "@/unison/design-sources/Footer";
export default function Home() {
  return <><header data-ut-section-id="site:navbar" data-ut-section-type="navbar" data-ut-variant="navbar:standard"><Navbar sectionId="site:navbar" variantId="navbar:standard" props={{ brand: "Northstar", links: [] }} /></header><main><section data-ut-section-id="home:services:0" data-ut-section-type="services" data-ut-variant="services:editorial-rows">
    <Services sectionId="home:services:0" variantId="services:editorial-rows" props={{ headline: "Treatments", items: [{ title: "Cut", description: "A tailored cut" }] }} />
  </section></main><footer data-ut-section-id="site:footer" data-ut-section-type="footer" data-ut-variant="footer:columns"><Footer sectionId="site:footer" variantId="footer:columns" props={{ links: [] }} /></footer></>;
}`;

    const result = inspectAppBuilderPageSections('/src/pages/Home.tsx', source, implementations);
    expect(result.issues).toEqual([]);
    expect(result.sections.find((section) => section.sectionId === 'home:services:0')).toMatchObject({
      sectionId: 'home:services:0',
      semanticType: 'services',
      primitiveId: 'Services',
      variantId: 'services:editorial-rows',
      data: { headline: 'Treatments', items: [{ title: 'Cut', description: 'A tailored cut' }] },
    });

    const files = materializeAppBuilderSectionModels({ '/src/pages/Home.tsx': source }, [{ id: 'home', filePath: '/src/pages/Home.tsx' }], implementations);
    const sidecar = Object.entries(files).find(([path]) => path.endsWith('/Home.json'))?.[1];
    expect(sidecar).toContain('"compiledBy": "app-builder"');
    expect(sidecar).toContain('"sectionId": "home:services:0"');
    expect(sidecar).toContain('"headline": "Treatments"');
  });

  it('rejects missing and duplicate section identities', () => {
    const source = `<main>
  <section data-ut-section-type="services" data-ut-variant="services:editorial-rows" />
  <section data-ut-section-id="same" data-ut-section-type="services" data-ut-variant="services:editorial-rows" />
  <section data-ut-section-id="same" data-ut-section-type="services" data-ut-variant="services:editorial-rows" />
</main>`;
    const result = inspectAppBuilderPageSections('/src/pages/Home.tsx', source, implementations);
    expect(result.issues.some((issue) => issue.includes('requires literal data-ut-section-id'))).toBe(true);
    expect(result.issues.some((issue) => issue.includes('duplicate section id "same"'))).toBe(true);
  });

  it('stamps missing root identity from one certified family dispatcher', () => {
    const source = `import Navbar from "@/unison/design-sources/Navbar";
import Services from "@/unison/design-sources/Services";
import Footer from "@/unison/design-sources/Footer";
export default function Treatments(){return <><header><Navbar sectionId="site:navbar" variantId="navbar:standard" props={{ links: [] }} /></header><main><section><Services sectionId="treatments:services:0" variantId="services:editorial-rows" props={{ headline: "Treatments", items: [{ title: "Facial", description: "Care" }] }} /></section></main><footer><Footer sectionId="site:footer" variantId="footer:columns" props={{ links: [] }} /></footer></>}`;
    const files = materializeAppBuilderSectionModels(
      { '/src/pages/treatments.tsx': source },
      [{ id: 'treatments', filePath: '/src/pages/treatments.tsx' }],
      implementations,
    );
    const page = files['/src/pages/treatments.tsx'];

    expect(page).toContain('<header data-ut-section-id="site:navbar" data-ut-section-type="navbar" data-ut-variant="navbar:standard">');
    expect(page).toContain('<section data-ut-section-id="treatments:services:0" data-ut-section-type="services" data-ut-variant="services:editorial-rows">');
    expect(page).toContain('<footer data-ut-section-id="site:footer" data-ut-section-type="footer" data-ut-variant="footer:columns">');
    expect(inspectAppBuilderPageSectionClosure('/src/pages/treatments.tsx', files, implementations).issues).toEqual([]);

    const repaired = materializeAppBuilderSectionModels({
      ...files,
      '/.unison/compositions/pages/treatments.json': JSON.stringify({
        version: '1.0', compiledBy: 'app-builder', pageFilePath: '/src/pages/treatments.tsx', sections: [],
      }),
      '/src/pages/treatments.tsx': source,
    }, [{ id: 'treatments', filePath: '/src/pages/treatments.tsx' }], implementations);
    expect(repaired['/.unison/compositions/pages/treatments.json']).toContain('treatments:services:0');
  });

  it('repairs dispatcher identity and wraps static direct props for the registered family', () => {
    const source = `import Services from "@/unison/design-sources/Services";
export default function Treatments(){return <main><section data-ut-section-id="treatments:services:0" data-ut-section-type="services" data-ut-variant="services:editorial-rows"><Services headline="Treatments" items={[{title:"Facial",description:"Care"}]} /></section></main>}`;
    const files = materializeAppBuilderSectionModels(
      { '/src/pages/treatments.tsx': source },
      [{ id: 'treatments', filePath: '/src/pages/treatments.tsx' }],
      implementations,
    );
    const page = files['/src/pages/treatments.tsx'];

    expect(page).toMatch(/<Services\b[^>]*sectionId="treatments:services:0"[^>]*variantId="services:editorial-rows"/);
    expect(page).toContain('props={{"headline":"Treatments","items":[{"title":"Facial","description":"Care"}]}}');
    expect(inspectAppBuilderPageSections('/src/pages/treatments.tsx', page, implementations, { requireChromeRoots: false }).issues).toEqual([]);
  });

  it('normalizes a certified named variant import while preserving its migration identity', () => {
    const namedImplementations = {
      ...implementations,
      'services:editorial-rows': { ...implementations['services:editorial-rows'], exportName: 'ServicesEditorialRows' },
    };
    const source = `import { ServicesEditorialRows } from "@/unison/design-sources/Services";
export default function Treatments(){return <main><section data-ut-section-id="treatments:services:0" data-ut-section-type="services" data-ut-variant="services:editorial-rows"><ServicesEditorialRows headline="Treatments" items={[]} /></section></main>}`;
    const files = materializeAppBuilderSectionModels(
      { '/src/pages/treatments.tsx': source },
      [{ id: 'treatments', filePath: '/src/pages/treatments.tsx' }],
      namedImplementations,
    );
    const page = files['/src/pages/treatments.tsx'];
    const result = inspectAppBuilderPageSections('/src/pages/treatments.tsx', page, namedImplementations, {
      allowNamedExports: true,
      requireChromeRoots: false,
    });

    expect(page).toContain('sectionId="treatments:services:0"');
    expect(page).toContain('variantId="services:editorial-rows"');
    expect(page).toContain('props={{"headline":"Treatments","items":[]}}');
    expect(result.issues).toEqual([]);
    expect(result.sections[0]).toMatchObject({ legacyRendererName: 'ServicesEditorialRows' });
  });

  it('accepts a unique literal const object as dispatcher props', () => {
    const source = `import Services from "@/unison/design-sources/Services";
const SECTION_PROPS = { headline: "Treatments", items: [{ title: "Facial", description: "Care" }] };
export default function Treatments(){return <main><section data-ut-section-id="treatments:services:0" data-ut-section-type="services" data-ut-variant="services:editorial-rows"><Services sectionId="treatments:services:0" variantId="services:editorial-rows" props={SECTION_PROPS} /></section></main>}`;

    const result = inspectAppBuilderPageSections('/src/pages/treatments.tsx', source, implementations, {
      requireChromeRoots: false,
    });

    expect(result.issues).toEqual([]);
    expect(result.sections[0].data).toEqual({ headline: 'Treatments', items: [{ title: 'Facial', description: 'Care' }] });
  });

  it('normalizes registered roots in shared SiteNav and SiteFooter modules', () => {
    const marketplaceImplementations = {
      ...implementations,
      'navbar:minimal-dark': { modulePath: '/src/unison/design-sources/Navbar.tsx', sectionType: 'navbar' },
      'services:product-cards': { modulePath: '/src/unison/design-sources/Services.tsx', sectionType: 'services' },
      'faq:accordion': { modulePath: '/src/unison/design-sources/FAQ.tsx', sectionType: 'faq' },
    };
    const files = {
      '/src/pages/treatments.tsx': `import SiteNav from "../project-components/site/SiteNav";
import SiteFooter from "../project-components/site/SiteFooter";
import Services from "@/unison/design-sources/Services";
import FAQ from "@/unison/design-sources/FAQ";
export default function Treatments(){return <><SiteNav/><main><section><Services sectionId="treatments:services:0" variantId="services:product-cards" props={{headline:"Treatments",items:[]}} /></section><section><FAQ sectionId="treatments:faq:0" variantId="faq:accordion" props={{headline:"Questions",items:[]}} /></section></main><SiteFooter/></>}`,
      '/src/project-components/site/SiteNav.tsx': `import Navbar from "@/unison/design-sources/Navbar";
    export default function SiteNav(){return <header data-ut-section-id="site:navbar" data-ut-section-type="navbar" data-ut-variant="navbar:minimal-dark"><Navbar links={[]} /></header>}`,
      '/src/project-components/site/SiteFooter.tsx': `import Footer from "@/unison/design-sources/Footer";
    export default function SiteFooter(){return <footer data-ut-section-id="site:footer" data-ut-section-type="footer" data-ut-variant="footer:columns"><Footer links={[]} /></footer>}`,
    };
    const normalized = materializeAppBuilderSectionModels(
      files,
      [{ id: 'treatments', filePath: '/src/pages/treatments.tsx' }],
      marketplaceImplementations,
    );

    expect(normalized['/src/project-components/site/SiteNav.tsx']).toContain('data-ut-variant="navbar:minimal-dark"');
    expect(normalized['/src/project-components/site/SiteNav.tsx']).toContain('data-ut-section-id="site:navbar"');
    expect(normalized['/src/pages/treatments.tsx']).toContain('data-ut-section-id="treatments:services:0"');
    expect(normalized['/src/pages/treatments.tsx']).toContain('data-ut-section-id="treatments:faq:0"');
    expect(inspectAppBuilderPageSectionClosure('/src/pages/treatments.tsx', normalized, marketplaceImplementations).issues).toEqual([]);
  });

  it('builds a migration sidecar for one uniquely imported registered variant export', () => {
    const legacyImplementations = {
      ...implementations,
      'services:editorial-rows': {
        ...implementations['services:editorial-rows'],
        exportName: 'ServicesEditorialRows',
      },
    };
    const source = `import Navbar from "@/unison/design-sources/Navbar";
import { ServicesEditorialRows } from "@/unison/design-sources/Services";
import Footer from "@/unison/design-sources/Footer";
export default function Home(){return <><header data-ut-section-id="site:navbar" data-ut-section-type="navbar" data-ut-variant="navbar:standard"><Navbar sectionId="site:navbar" variantId="navbar:standard" props={{ links: [] }} /></header><main><section data-ut-section-id="home:services:0" data-ut-section-type="services" data-ut-variant="services:editorial-rows"><ServicesEditorialRows headline="Owner data" items={[{ title: "Cut", description: "Tailored" }]} /><a data-ut-intent="booking.create">Book</a></section></main><footer data-ut-section-id="site:footer" data-ut-section-type="footer" data-ut-variant="footer:columns"><Footer sectionId="site:footer" variantId="footer:columns" props={{ links: [] }} /></footer></>}`;

    const files = materializeAppBuilderSectionModels(
      { '/src/pages/Home.tsx': source },
      [{ id: 'home', filePath: '/src/pages/Home.tsx' }],
      legacyImplementations,
    );
    const sidecar = Object.entries(files).find(([path]) => path.endsWith('/Home.json'))?.[1];
    const parsed = JSON.parse(sidecar ?? 'null');

    expect(parsed.compiledBy).toBe('app-builder');
    expect(parsed.sections.find((section: { sectionId: string }) => section.sectionId === 'home:services:0')).toMatchObject({
      primitiveId: 'UnisonServices',
      legacyRendererName: 'ServicesEditorialRows',
      sourceModulePath: '/src/unison/design-sources/Services.tsx',
      data: { headline: 'Owner data', items: [{ title: 'Cut', description: 'Tailored' }] },
    });
  });

  it('rejects non-serializable section data and direct implementation exports', () => {
    const source = `import { ServicesEditorialRows } from "@/unison/design-sources/Services";
export default function Home() {
  return <main><section data-ut-section-id="home:services:0" data-ut-section-type="services" data-ut-variant="services:editorial-rows">
    <ServicesEditorialRows variantId="services:editorial-rows" props={{ headline: makeHeadline() }} />
  </section></main>;
}`;
    const result = inspectAppBuilderPageSections('/src/pages/Home.tsx', source, implementations);
    expect(result.issues).toContainEqual(expect.stringContaining('literal serializable props'));
  });

  it('finds and serializes sections in the page import closure', () => {
    const files = {
      '/src/pages/Services.tsx': `import HeroSection from "../project-components/HeroSection";
    import SiteNav from "../project-components/SiteNav";
    import SiteFooter from "../project-components/SiteFooter";
    export default function Services(){return <><SiteNav /><main><HeroSection /></main><SiteFooter /></>}`,
      '/src/project-components/HeroSection.tsx': `import Hero from "@/unison/design-sources/Hero";
export default function HeroSection(){return <section data-ut-section-id="services:hero:0" data-ut-section-type="hero" data-ut-variant="hero:split-image"><Hero sectionId="services:hero:0" variantId="hero:split-image" props={{ headline: "Owner headline" }} /></section>}`,
      '/src/project-components/SiteNav.tsx': `import Navbar from "@/unison/design-sources/Navbar";
export default function SiteNav(){return <header data-ut-section-id="site:navbar" data-ut-section-type="navbar" data-ut-variant="navbar:standard"><Navbar sectionId="site:navbar" variantId="navbar:standard" props={{ links: [] }} /></header>}`,
      '/src/project-components/SiteFooter.tsx': `import Footer from "@/unison/design-sources/Footer";
export default function SiteFooter(){return <footer data-ut-section-id="site:footer" data-ut-section-type="footer" data-ut-variant="footer:columns"><Footer sectionId="site:footer" variantId="footer:columns" props={{ links: [] }} /></footer>}`,
    };
    const implementations = {
      ...({
        'hero:split-image': { modulePath: '/src/unison/design-sources/Hero.tsx', sectionType: 'hero' },
      }),
      'navbar:standard': { modulePath: '/src/unison/design-sources/Navbar.tsx', sectionType: 'navbar' },
      'footer:columns': { modulePath: '/src/unison/design-sources/Footer.tsx', sectionType: 'footer' },
    };

    expect(collectLocalImportClosure(files, '/src/pages/Services.tsx')).toContain('/src/project-components/HeroSection.tsx');
    expect(inspectAppBuilderPageSectionClosure('/src/pages/Services.tsx', files, implementations).issues).toEqual([]);

    const migrated = materializeAppBuilderSectionModels(files, [{ id: 'services', filePath: '/src/pages/Services.tsx' }], implementations);
    const sidecar = Object.entries(migrated).find(([path]) => path.endsWith('/Services.json'))?.[1];
    const sections = JSON.parse(sidecar ?? 'null').sections as Array<{ sectionId: string; sourcePath: string; data: Record<string, unknown> }>;

    expect(sections.find((section) => section.sectionId === 'services:hero:0')).toMatchObject({
      sourcePath: '/src/project-components/HeroSection.tsx',
      data: { headline: 'Owner headline' },
    });
  });
});