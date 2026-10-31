// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { THEME_PRESETS } from '@/components/onboarding/themePresets';
import { ALL_COMPOSITIONS } from '@/sections/templates';
import { curateMarketplaceTemplate } from '@/marketplace/curateMarketplaceTemplate';
import { buildAppBuilderGenerationContext } from '@/services/app-builder/appBuilderGenerationContext';
import { COMPOSER_CONTEXT_LIMIT, packContextBlocks } from '@/services/app-builder/contextBudget';
import { adoptContactSectionHost, bodyInsertionIndex } from '@/services/app-builder/registeredComponentMaterializer';

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
        expect(context).toContain('Certified design-source modules');
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
