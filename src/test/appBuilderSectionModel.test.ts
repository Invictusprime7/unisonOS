import { describe, expect, it } from 'vitest';
import { inspectAppBuilderPageSectionClosure, inspectAppBuilderPageSections, materializeAppBuilderSectionModels } from '@/services/app-builder/appBuilderSectionModel';
import { collectLocalImportClosure } from '@/services/laneBCompanionModules';
import { buildSystemGraph } from '@/services/agent-runtime/systemGraph';

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
  it('replaces unavailable variants with the first eligible implementation of the same family', () => {
    const source = `import Navbar from "@/unison/design-sources/Navbar";
import Services from "@/unison/design-sources/Services";
import Gallery from "@/unison/design-sources/Gallery";
import Footer from "@/unison/design-sources/Footer";
export default function Home(){return <><header data-ut-section-id="site:navbar" data-ut-section-type="navbar" data-ut-variant="navbar:unavailable"><Navbar sectionId="site:navbar" variantId="navbar:unavailable" props={{ links: [] }} /></header><main><section data-ut-section-id="home:services:0" data-ut-section-type="services" data-ut-variant="services:unavailable"><Services sectionId="home:services:0" variantId="services:unavailable" props={{ headline: "Treatments", items: [{ title: "Cut", description: "Tailored" }] }} /></section><section data-ut-section-id="home:gallery:0" data-ut-variant="gallery:editorial-mosaic"><Gallery variantId="gallery:editorial-mosaic" props={{ headline: "Work", items: [] }} /></section></main><footer data-ut-section-id="site:footer" data-ut-section-type="footer" data-ut-variant="footer:unavailable"><Footer sectionId="site:footer" variantId="footer:unavailable" props={{ links: [] }} /></footer></>}`;
    const sectionImplementations = {
      ...implementations,
      'gallery:editorial-grid': {
        modulePath: '/src/unison/design-sources/Gallery.tsx',
        sectionType: 'gallery',
      },
    };
    const files = materializeAppBuilderSectionModels(
      { '/src/pages/Home.tsx': source },
      [{ id: 'home', filePath: '/src/pages/Home.tsx' }],
      sectionImplementations,
      { home: Object.keys(sectionImplementations) },
    );

    expect(files['/src/pages/Home.tsx']).toContain('data-ut-variant="navbar:standard"');
    expect(files['/src/pages/Home.tsx']).toContain('variantId="navbar:standard"');
    expect(files['/src/pages/Home.tsx']).toContain('data-ut-variant="services:editorial-rows"');
    expect(files['/src/pages/Home.tsx']).toContain('variantId="services:editorial-rows"');
    expect(files['/src/pages/Home.tsx']).toContain('data-ut-section-type="gallery"');
    expect(files['/src/pages/Home.tsx']).toContain('data-ut-variant="gallery:editorial-grid"');
    expect(files['/src/pages/Home.tsx']).toContain('variantId="gallery:editorial-grid"');
    expect(files['/src/pages/Home.tsx']).toContain('data-ut-variant="footer:columns"');
    expect(files['/src/pages/Home.tsx']).toContain('variantId="footer:columns"');
    expect(inspectAppBuilderPageSectionClosure('/src/pages/Home.tsx', files, sectionImplementations).issues).toEqual([]);
    expect(Object.keys(files).some((path) => path.endsWith('/Home.json'))).toBe(true);
  });

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
      [{ id: 'treatments', filePath: '/src/pages/treatments.tsx', route: '/treatments' }],
      implementations,
    );
    const page = files['/src/pages/treatments.tsx'];

    expect(page).toContain('<header data-ut-section-id="site:navbar" data-ut-section-type="navbar" data-ut-variant="navbar:standard" data-ut-entity-id="section:treatments:site:navbar" data-ut-page-id="treatments" data-ut-page-path="/treatments">');
    expect(page).toContain('<section data-ut-section-id="treatments:services:0" data-ut-section-type="services" data-ut-variant="services:editorial-rows" data-ut-entity-id="section:treatments:treatments:services:0" data-ut-page-id="treatments" data-ut-page-path="/treatments">');
    expect(page).toContain('<footer data-ut-section-id="site:footer" data-ut-section-type="footer" data-ut-variant="footer:columns" data-ut-entity-id="section:treatments:site:footer" data-ut-page-id="treatments" data-ut-page-path="/treatments">');
    expect(inspectAppBuilderPageSectionClosure('/src/pages/treatments.tsx', files, implementations).issues).toEqual([]);
    const graph = buildSystemGraph({
      files,
      pageIdentities: [{ id: 'treatments', path: '/treatments', filePath: '/src/pages/treatments.tsx', title: 'Treatments', role: 'services' }],
    });
    const servicesNode = graph.sections.find((section) => section.id === 'treatments:services:0');
    expect(servicesNode?.nodeId).toBe('section:treatments:treatments:services:0');
    expect(graph.entities.some((entity) => entity.id === servicesNode?.nodeId)).toBe(true);
    expect(graph.aliases['section:/treatments#treatments:services:0']).toBe(servicesNode?.nodeId);
    expect(graph.aliases['page:services']).toBe('treatments');

    const repaired = materializeAppBuilderSectionModels({
      ...files,
      '/.unison/compositions/pages/treatments.json': JSON.stringify({
        version: '1.0', compiledBy: 'app-builder', pageFilePath: '/src/pages/treatments.tsx', sections: [],
      }),
      '/src/pages/treatments.tsx': source,
    }, [{ id: 'treatments', filePath: '/src/pages/treatments.tsx' }], implementations);
    expect(repaired['/.unison/compositions/pages/treatments.json']).toContain('treatments:services:0');
  });

  it('repairs unannotated section roots that render one certified named variant', () => {
    const namedImplementations = {
      ...implementations,
      'navbar:standard': { ...implementations['navbar:standard'], exportName: 'NavbarStandard' },
      'footer:columns': { ...implementations['footer:columns'], exportName: 'FooterColumns' },
      'hero:split-image': { modulePath: '/src/unison/design-sources/Hero.tsx', sectionType: 'hero', exportName: 'HeroSplitImage' },
      'services:editorial-rows': { ...implementations['services:editorial-rows'], exportName: 'ServicesEditorialRows' },
    };
    const source = `import { HeroSplitImage } from "@/unison/design-sources/Hero";
import { ServicesEditorialRows } from "@/unison/design-sources/Services";
import { SiteNav } from "../project-components/site/SiteNav";
import { SiteFooter } from "../project-components/site/SiteFooter";
export default function Home(){return <><SiteNav/><main><section><HeroSplitImage headline="Northstar" image="https://images.unsplash.com/photo-1" /></section><section><ServicesEditorialRows headline="Care" items={[]} /></section></main><SiteFooter/></>}`;
    const sourceFiles = {
      '/src/pages/Home.tsx': source,
      '/src/project-components/site/SiteNav.tsx': `import { NavbarStandard } from "@/unison/design-sources/Navbar";
export function SiteNav(){return <header data-ut-section-id="site:navbar"><NavbarStandard brand="Northstar" links={[]} /></header>}`,
      '/src/project-components/site/SiteFooter.tsx': `import { FooterColumns } from "@/unison/design-sources/Footer";
export function SiteFooter(){return <footer data-ut-section-id="site:footer"><FooterColumns brand="Northstar" columns={[]} /></footer>}`,
    };
    const files = materializeAppBuilderSectionModels(
      sourceFiles,
      [{ id: 'home', filePath: '/src/pages/Home.tsx', route: '/' }],
      namedImplementations,
      { home: Object.keys(namedImplementations) },
    );

    expect(files['/src/pages/Home.tsx']).toContain('data-ut-section-type="hero"');
    expect(files['/src/pages/Home.tsx']).toContain('data-ut-variant="hero:split-image"');
    expect(files['/src/pages/Home.tsx']).toContain('variantId="hero:split-image"');
    expect(files['/src/pages/Home.tsx']).toContain('props={{"headline":"Northstar","image":"https://images.unsplash.com/photo-1"}}');
    expect(inspectAppBuilderPageSectionClosure('/src/pages/Home.tsx', files, namedImplementations).issues).toEqual([]);
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

  it('accepts named certified variants consistently across page and shared-shell closure checks', () => {
    const namedImplementations = {
      'navbar:standard': { ...implementations['navbar:standard'], exportName: 'NavbarStandard' },
      'services:editorial-rows': { ...implementations['services:editorial-rows'], exportName: 'ServicesEditorialRows' },
      'footer:columns': { ...implementations['footer:columns'], exportName: 'FooterColumns' },
    };
    const files = {
      '/src/pages/Home.tsx': `import { SiteNav } from "../project-components/site/SiteNav";
import { SiteFooter } from "../project-components/site/SiteFooter";
import { ServicesEditorialRows } from "@/unison/design-sources/Services";
export default function Home(){return <><SiteNav/><main><section data-ut-section-id="home:services:0" data-ut-section-type="services" data-ut-variant="services:editorial-rows"><ServicesEditorialRows headline="Care" items={[]} /></section></main><SiteFooter/></>}`,
      '/src/project-components/site/SiteNav.tsx': `import { NavbarStandard } from "@/unison/design-sources/Navbar";
export function SiteNav(){return <header data-ut-section-id="site:navbar" data-ut-section-type="navbar" data-ut-variant="navbar:standard"><NavbarStandard brand="Northstar" links={[]} /></header>}`,
      '/src/project-components/site/SiteFooter.tsx': `import { FooterColumns } from "@/unison/design-sources/Footer";
export function SiteFooter(){return <footer data-ut-section-id="site:footer" data-ut-section-type="footer" data-ut-variant="footer:columns"><FooterColumns brand="Northstar" columns={[]} /></footer>}`,
    };
    const normalized = materializeAppBuilderSectionModels(
      files,
      [{ id: 'home', filePath: '/src/pages/Home.tsx', route: '/' }],
      namedImplementations,
      { home: Object.keys(namedImplementations) },
    );

    expect(normalized['/src/project-components/site/SiteNav.tsx']).toContain('props={{"brand":"Northstar","links":[]}}');
    expect(normalized['/src/project-components/site/SiteFooter.tsx']).toContain('props={{"brand":"Northstar","columns":[]}}');
    expect(inspectAppBuilderPageSectionClosure('/src/pages/Home.tsx', normalized, namedImplementations).issues).toEqual([]);
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

  it('accepts a custom body section from an authored local component and materializes its sidecar', () => {
    const files = {
      '/src/pages/Home.tsx': `import Navbar from "@/unison/design-sources/Navbar";
import Footer from "@/unison/design-sources/Footer";
import FeaturePanel from "@/project-components/FeaturePanel";
export default function Home(){return <><header data-ut-section-id="site:navbar" data-ut-section-type="navbar" data-ut-variant="navbar:standard"><Navbar sectionId="site:navbar" variantId="navbar:standard" props={{links:[]}} /></header><main><section data-ut-section-id="home:services:0" data-ut-section-type="services" data-ut-variant="custom:service-panel"><FeaturePanel title="Care, made personal" /></section></main><footer data-ut-section-id="site:footer" data-ut-section-type="footer" data-ut-variant="footer:columns"><Footer sectionId="site:footer" variantId="footer:columns" props={{links:[]}} /></footer></>}`,
      '/src/project-components/FeaturePanel.tsx': `export default function FeaturePanel({title}:{title:string}){return <article>{title}</article>}`,
    };
    const normalized = materializeAppBuilderSectionModels(
      files,
      [{ id: 'home', filePath: '/src/pages/Home.tsx' }],
      implementations,
      { home: Object.keys(implementations) },
    );
    const inspection = inspectAppBuilderPageSectionClosure('/src/pages/Home.tsx', normalized, implementations);
    const sidecar = JSON.parse(normalized['/.unison/compositions/pages/Home.json']);

    expect(normalized['/src/pages/Home.tsx']).toContain('variantId="custom:service-panel"');
    expect(normalized['/src/pages/Home.tsx']).toContain('props={{"title":"Care, made personal"}}');
    expect(inspection.issues).toEqual([]);
    expect(inspection.sections.find((section) => section.sectionId === 'home:services:0')).toMatchObject({
      semanticType: 'services',
      variantId: 'custom:service-panel',
      sourceModulePath: '/src/project-components/FeaturePanel.tsx',
      data: { title: 'Care, made personal' },
    });
    expect(sidecar.sections.find((section: { sectionId: string }) => section.sectionId === 'home:services:0'))
      .toMatchObject({ variantId: 'custom:service-panel', data: { title: 'Care, made personal' } });
  });

  it('rejects custom sections without exactly one authorized local component import', () => {
    const shell = `import Navbar from "@/unison/design-sources/Navbar";
import Footer from "@/unison/design-sources/Footer";
export function Shell(){return <><header data-ut-section-id="site:navbar" data-ut-section-type="navbar" data-ut-variant="navbar:standard"><Navbar sectionId="site:navbar" variantId="navbar:standard" props={{links:[]}} /></header><footer data-ut-section-id="site:footer" data-ut-section-type="footer" data-ut-variant="footer:columns"><Footer sectionId="site:footer" variantId="footer:columns" props={{links:[]}} /></footer></>}`;
    const unauthorized = {
      '/src/pages/Unauthorized.tsx': `import Services from "@/unison/design-sources/Services";
${shell}
export default function Unauthorized(){return <><Shell/><main><section data-ut-section-id="home:services:0" data-ut-section-type="services" data-ut-variant="custom:service-panel"><Services /></section></main></>}`,
    };
    const ambiguous = {
      '/src/pages/Ambiguous.tsx': `import FeaturePanel from "@/project-components/FeaturePanel";
import OtherPanel from "@/project-components/OtherPanel";
${shell}
export default function Ambiguous(){return <><Shell/><main><section data-ut-section-id="home:services:0" data-ut-section-type="services" data-ut-variant="custom:service-panel"><><FeaturePanel /><OtherPanel /></></section></main></>}`,
      '/src/project-components/FeaturePanel.tsx': 'export default function FeaturePanel(){return <article/>}',
      '/src/project-components/OtherPanel.tsx': 'export default function OtherPanel(){return <article/>}',
    };

    expect(inspectAppBuilderPageSectionClosure('/src/pages/Unauthorized.tsx', unauthorized, implementations).issues)
      .toContainEqual(expect.stringContaining('uses unavailable services variant "custom:service-panel"'));
    expect(inspectAppBuilderPageSectionClosure('/src/pages/Ambiguous.tsx', ambiguous, implementations).issues)
      .toContainEqual(expect.stringContaining('uses unavailable services variant "custom:service-panel"'));
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