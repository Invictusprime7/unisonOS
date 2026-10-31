// @vitest-environment node
import { it } from 'vitest';
import { THEME_PRESETS } from '@/components/onboarding/themePresets';
import { ALL_COMPOSITIONS } from '@/sections/templates';
import { curateMarketplaceTemplate } from '@/marketplace/curateMarketplaceTemplate';
import { buildAppBuilderGenerationContext } from '@/services/app-builder/appBuilderGenerationContext';
it('probe', () => {
  for (const id of ['salon-premium', 'agency-consulting', 'restaurant-premium']) {
    const c = curateMarketplaceTemplate(ALL_COMPOSITIONS.find(x => x.id === id)!, THEME_PRESETS[0]);
    const g = buildAppBuilderGenerationContext(c.contract);
    for (const p of c.contract.topology.sitePlan.pages) {
      const s = g.runtimeContextForPage(p.id, 9000);
      const planned = c.contract.design.compositionPlan.pages.find(x => x.pageId === p.id)!;
      const elig = g.designSources.eligibleByPage[p.id];
      const fams = [...new Set(planned.target.sectionOrder)].map(f => `${f}:${elig.filter(e => e.startsWith(f + ':')).length}`).join(' ');
      console.log(id, p.role, 'len', s.length, 'mods', s.includes('Certified design-source modules'), 'forms', s.includes('FORM'), 'bindings', s.includes('CANONICAL INTENT BINDINGS'), '|', fams, '| hero1', elig.find(e => e.startsWith('hero:')));
    }
  }
});
