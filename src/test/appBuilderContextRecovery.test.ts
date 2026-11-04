// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { THEME_PRESETS } from '@/components/onboarding/themePresets';
import { ALL_COMPOSITIONS } from '@/sections/templates';
import { curateMarketplaceTemplate } from '@/marketplace/curateMarketplaceTemplate';
import { buildAppBuilderGenerationContext } from '@/services/app-builder/appBuilderGenerationContext';
import { COMPOSER_CONTEXT_LIMIT, packContextBlocks } from '@/services/app-builder/contextBudget';
import { adoptContactSectionHost, bodyInsertionIndex } from '@/services/app-builder/registeredComponentMaterializer';
import { materializeAppBuilderSectionModelsWithDiagnostics } from '@/services/app-builder/appBuilderSectionModel';

const curated = (id: string) => curateMarketplaceTemplate(ALL_COMPOSITIONS.find((c) => c.id === id)!, THEME_PRESETS[0]);

describe('App Builder context recovery', () => {
  it('drops low-priority blocks whole instead of cutting design vocabulary', () => {
    const packed = packContextBlocks([
      { priority: 1, text: 'MODULES ' + 'm'.repeat(50) },
      { priority: 5, text: 'RESOURCES ' + 'r'.repeat(80) },
      { priority: 1, text: 'FORMS rule' },
    ], 80);
    expect(packed.text).toContain('FORMS rule');
    expect(packed.text).not.toContain('RESOURCES');
    expect(packed.dropped).toBe(1);
  });

  it('keeps design modules, form placement and bindings for every page within the request limit', () => {
    for (const id of ['salon-premium', 'agency-consulting', 'restaurant-premium']) {
      const c = curated(id);
      const generation = buildAppBuilderGenerationContext(c.contract);
      for (const page of c.contract.topology.sitePlan.pages) {
        const context = generation.runtimeContextForPage(page.id);
        expect(context.length).toBeLessThanOrEqual(COMPOSER_CONTEXT_LIMIT);
        expect(context).toContain('ORIGINAL BODY DESIGN IS REQUIRED');
        expect(context).toContain('custom:<kebab-slug>');
        expect(context).toContain('Do not import or render registry design-source modules');
        expect(context).not.toContain('use only listed IDs');
        expect(context).toContain('FORM');
        expect(context).toContain('CANONICAL INTENT BINDINGS');
      }
    }
  });

  it('offers several style variants for each planned family instead of one', () => {
    const c = curated('salon-premium');
    const generation = buildAppBuilderGenerationContext(c.contract);
    const home = c.contract.design.compositionPlan.pages.find((page) => page.role === 'home')!;
    const eligible = generation.designSources.eligibleByPage[home.pageId];
    for (const family of ['hero', 'services', 'cta']) {
      expect(eligible.filter((id) => id.startsWith(`${family}:`)).length).toBeGreaterThanOrEqual(3);
    }
  });

  it('persists an authored custom body component through the canonical section sidecar', () => {
    const implementations = {
      'navbar:test': { modulePath: '/src/project-components/site/Nav.tsx', sectionType: 'navbar' },
      'footer:test': { modulePath: '/src/project-components/site/Footer.tsx', sectionType: 'footer' },
    };
    const files = {
      '/src/pages/Home.tsx': `import Nav from '@/project-components/site/Nav';
import Footer from '@/project-components/site/Footer';
import HeroStory from '@/project-components/hero/HeroStory';
export default function Home() { return <><nav data-ut-section-id="site:navbar" data-ut-section-type="navbar" data-ut-variant="navbar:test"><Nav /></nav><main><section data-ut-section-id="home:hero:0" data-ut-section-type="hero" data-ut-variant="custom:hero-story"><HeroStory sectionId="home:hero:0" variantId="custom:hero-story" props={{ headline: 'A new story' }} /></section></main><footer data-ut-section-id="site:footer" data-ut-section-type="footer" data-ut-variant="footer:test"><Footer /></footer></>; }`,
      '/src/project-components/site/Nav.tsx': 'export default function Nav() { return <a href="/">Home</a>; }',
      '/src/project-components/site/Footer.tsx': 'export default function Footer() { return <small>Northstar</small>; }',
      '/src/project-components/hero/HeroStory.tsx': 'export default function HeroStory({ headline }: { headline: string }) { return <div><h1>{headline}</h1></div>; }',
    };
    const result = materializeAppBuilderSectionModelsWithDiagnostics(
      files,
      [{ id: 'home', filePath: '/src/pages/Home.tsx', route: '/' }],
      implementations,
      { home: ['navbar:test', 'footer:test'] },
    );

    expect(result.diagnostics).toEqual([]);
    expect(result.files['/.unison/compositions/pages/Home.json']).toContain('custom:hero-story');
    expect(result.files['/.unison/compositions/pages/Home.json']).toContain('"semanticType": "hero"');
  });
});

describe('Form placement', () => {
  const component = { targetType: 'form', runtime: { writeIntent: 'contact.submit', componentSlug: 'contact-form', instanceId: 'cmp_1' } } as never;
  const page = `import Contact from "@/unison/design-sources/Contact";
export default function P() { return (<div><SiteNav /><main>
<section data-ut-section-id="p:contact:0" data-ut-section-type="contact" data-ut-variant="contact:split-card"><Contact sectionId="p:contact:0" variantId="contact:split-card" props={{ headline: "Talk" }} /></section>
</main><SiteFooter /></div>); }`;

  it('adopts a Contact section as the registered form host instead of adding a second form', () => {
    const adopted = adoptContactSectionHost(page, component)!;
    expect(adopted).toContain('data-ut-component-slug="contact-form"');
    expect(adopted).toContain('data-ut-component-instance-id="cmp_1"');
    expect(adopted.match(/<form/g)).toBeNull();
  });

  it('inserts platform forms before the shared footer when the page has no <main>', () => {
    const source = '<div><SiteNav /><section>a</section><SiteFooter /></div>';
    expect(bodyInsertionIndex(source)).toBe(source.indexOf('<SiteFooter'));
  });
});
