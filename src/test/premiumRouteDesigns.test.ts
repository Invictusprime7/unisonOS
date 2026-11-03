import { describe, expect, it } from 'vitest';
import { getCompositionById } from '@/sections/templates';
import { getVariantById } from '@/sections/variants';
import { planSiteComposition } from '@/services/composition';
import { buildWizardAggregatedRegistryContext } from '@/services/launch/wizardRegistryAggregation';
import { generateTopologyPlaceholderFiles } from '@/utils/topologyVFSScaffolder';
import { collectResolvedCompositions } from '@/platform/core/resolvedComposition';
import type { GeneratedSitePlan, PageRouteNode, PageRole } from '@/platform/core/siteTopologyPlanner';
import type { SectionEntry } from '@/sections/types';

const template = getCompositionById('salon-premium')!;
function compile(role: PageRole, seed: string, id = role, selectedTemplate = template, selectedThemePresetId = 'editorial') {
  const page: PageRouteNode = { id, name: role, title: role, route: '/' + role, role, filePath: '/src/pages/' + role + '.tsx', visibleInNav: true, isHome: role === 'home', generatedBy: 'wizard' };
  const plan: GeneratedSitePlan = { siteId: 'proof', industry: selectedTemplate.industry, businessName: 'Studio', homePageId: 'home', pages: [page], navItems: [id], funnels: [], redirects: [], generatedAt: '2026-09-17', selectedTemplateId: selectedTemplate.id, selectedThemePresetId };
  const files = generateTopologyPlaceholderFiles(page, plan, selectedTemplate, { designIntervention: { seed, motionRecipes: [], sectionVariants: [], activeVariants: {} } });
  const match = files[page.filePath].match(/const SECTIONS = ([\s\S]*?);\nconst HYDRATABLE/)!;
  return { files, sections: JSON.parse(match[1]) as SectionEntry[], descriptor: collectResolvedCompositions(files)[page.filePath] };
}
describe('seeded route design projection', () => {
  it.each(['services','about','contact','gallery','booking','checkout'] as PageRole[])('%s preserves topology and chooses executable role-eligible designs', role => {
    const seen = new Set<string>();
    for (let index = 0; index < 4; index++) {
      const seed = 'route-' + index;
      const result = compile(role, seed);
      seen.add(result.descriptor.compositionAlternativeId!);
      expect(result.files).toEqual(compile(role, seed).files);
      expect(result.sections[0].type).toBe('navbar');
      expect(result.sections[result.sections.length - 1]?.type).toBe('footer');
      for (const section of result.sections) {
        const variant = section.variantId && getVariantById(section.variantId);
        if (variant && variant.tags?.includes('route-design')) {
          expect(variant.pageRoles).toContain(role);
          expect(variant.vfs?.certification).toBe('approved');
          expect(result.files['/src/pages/' + role + '.tsx']).toContain(variant.id);
        }
      }
      if (role === 'checkout') expect(result.sections.find(section => section.type === 'contact')?.variantId).toBe('contact:checkout-panel');
    }
    expect(seen.size).toBe(2);
  });
  it('preserves explicit authored pricing and FAQ alternatives', () => {
    for (const role of ['pricing','faq'] as const) {
      const result = compile(role, 'route-1');
      expect(template.pageCompositions![role]!.alternatives.map(a => a.id)).toContain(result.descriptor.compositionAlternativeId);
    }
  });
  it('does not change Home when assigning interior route designs', () => {
    const result = compile('home', 'route-1');
    expect(result.sections.map(s => s.type)).toEqual(template.sections.map(s => s.type));
    expect(result.sections.some(s => s.variantId === 'contact:checkout-panel')).toBe(false);
  });

  it('applies an explicit certified home composition when the selected template declares one', () => {
    const homeTemplate = {
      ...template,
      pageCompositions: {
        ...template.pageCompositions,
        home: {
          sections: [],
          alternatives: [{
            id: 'salon-home-editorial-proof',
            heroVariantId: 'hero:launch-showcase',
            sectionIds: [...template.sections].reverse().map(section => section.id),
          }],
        },
      },
    };
    const result = compile('home', 'home-composition', 'home-page', homeTemplate);

    expect(result.sections.map(section => section.id)).toEqual([...homeTemplate.sections].reverse().map(section => `home-page-${section.id}`));
    expect(result.descriptor.compositionAlternativeId).toBe('salon-home-editorial-proof');
    expect(result.sections.find(section => section.type === 'hero')?.variantId).toBe('hero:launch-showcase');
  });

  it('scaffolds the SaaS technical home composition from registered portable variants', () => {
    const saasTemplate = getCompositionById('saas-developer')!;
    const definition = saasTemplate.pageCompositions?.home;
    expect(definition).toBeDefined();
    const alternative = definition!.alternatives.find(candidate => candidate.id === 'saas-tech-home-glass-v1')!;
    const result = compile('home', 'glass-tech-home', 'saas-home', saasTemplate, 'glass-tech');

    expect(result.descriptor.compositionAlternativeId).toBe(alternative.id);
    expect(result.sections.map(section => section.id)).toEqual(alternative.sectionIds.map(id => `saas-home-${id}`));
    expect(result.sections.map(section => section.type)).toEqual(['navbar', 'hero', 'logo-cloud', 'features', 'pricing', 'cta', 'footer']);
    for (const section of result.sections) {
      if (!section.variantId) continue;
      expect(getVariantById(section.variantId)?.vfs?.certification, section.variantId).toBe('approved');
    }
    const emittedSource = Object.values(result.files).join('\n');
    expect(emittedSource).toContain('data-ut-intent');
    expect(emittedSource).toContain('data-section={section.id}');

    const registry = buildWizardAggregatedRegistryContext({ industry: 'saas', templateId: saasTemplate.id, themePresetId: 'glass-tech' });
    const projectedAlternative = registry.pageCompositions?.find(composition => composition.role === 'home')?.alternatives.find(candidate => candidate.id === alternative.id);
    expect(projectedAlternative?.implementationIds).toHaveLength(alternative.sectionIds.length);
    expect(projectedAlternative?.implementationIds).toContain('hero:launch-showcase');
    expect(projectedAlternative?.implementationIds).toContain('features:bento-mosaic');

    const planned = planSiteComposition('saas', [{ pageId: 'saas-home', role: 'home' }], 'glass-tech-home');
    expect(planned.pages[0].target.sectionOrder).toEqual(expect.arrayContaining(['hero', 'logo-cloud', 'features', 'pricing', 'cta']));
    expect(planned.pages[0].target).toEqual(planSiteComposition('saas', [{ pageId: 'saas-home', role: 'home' }], 'glass-tech-home').pages[0].target);

    const incompatiblePack = compile('home', 'fallback', 'saas-home', saasTemplate, 'editorial');
    expect(incompatiblePack.sections.map(section => section.type)).toEqual(saasTemplate.sections.map(section => section.type));
  });
});
