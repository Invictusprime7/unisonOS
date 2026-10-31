// @vitest-environment node
import { it } from 'vitest';
import { THEME_PRESETS } from '@/components/onboarding/themePresets';
import { ALL_COMPOSITIONS } from '@/sections/templates';
import { curateMarketplaceTemplate } from '@/marketplace/curateMarketplaceTemplate';
import { buildAppBuilderGenerationContext } from '@/services/app-builder/appBuilderGenerationContext';
it('probe', () => {
  for (const id of ['salon-premium', ALL_COMPOSITIONS[3].id, ALL_COMPOSITIONS[10].id]) {
    const t = ALL_COMPOSITIONS.find(c => c.id === id)!;
    const c = curateMarketplaceTemplate(t, THEME_PRESETS[0]);
    const g = buildAppBuilderGenerationContext(c.contract);
    for (const p of c.contract.topology.sitePlan.pages) {
      const s = g.runtimeContextForPage(p.id);
      const mod = s.indexOf('Certified design-source modules');
      const after = s.indexOf('REGISTERED COMPONENT CONTRACT');
      console.log(id, p.role, 'total', s.length, 'modulesAt', mod, 'modulesLen', after - mod, 'eligible', g.designSources.eligibleByPage[p.id]?.length, 'cutAt12k:', s.length > 12000 ? JSON.stringify(s.slice(11900, 12000)) : '-');
    }
  }
});
import { renderPageBrief } from '@/services/launch/siteAuthoringOrchestrator';
import { renderCompositionBrief } from '@/services/composition';
it('brief', () => {
  for (const id of ['salon-premium', 'agency-consulting']) {
    const c = curateMarketplaceTemplate(ALL_COMPOSITIONS.find(x => x.id === id)!, THEME_PRESETS[0]);
    for (const p of c.contract.topology.sitePlan.pages) {
      const planned = c.contract.design.compositionPlan.pages.find(x => x.pageId === p.id);
      const a = renderCompositionBrief(planned as never, [], null);
      const b = renderPageBrief(c.contract.design.resolvedSiteDesignContext as never, { pageId: p.id, role: p.role, title: p.title, route: p.route, filePath: p.filePath } as never, 'X');
      console.log('BRIEF', id, p.role, 'composition', a.length, 'page', b.length, 'sum', a.length + b.length + 1);
    }
  }
});
