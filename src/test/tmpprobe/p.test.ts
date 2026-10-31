// @vitest-environment node
import { it } from 'vitest';
import { THEME_PRESETS } from '@/components/onboarding/themePresets';
import { ALL_COMPOSITIONS } from '@/sections/templates';
import { curateMarketplaceTemplate } from '@/marketplace/curateMarketplaceTemplate';
import { buildAppBuilderGenerationContext } from '@/services/app-builder/appBuilderGenerationContext';
it('p', () => {
  for (const id of ['salon-premium', 'agency-consulting', 'restaurant-premium']) {
    const c = curateMarketplaceTemplate(ALL_COMPOSITIONS.find(x => x.id === id)!, THEME_PRESETS[0]);
    const g = buildAppBuilderGenerationContext(c.contract);
    for (const p of c.contract.topology.sitePlan.pages) {
      const s = g.runtimeContextForPage(p.id, 1e6);
      const marks = ['CANONICAL PAGE NODE','AI ENRICHMENT','REGISTERED COMPONENT BLUEPRINTS','FORM','Certified design-source','PAGE DESIGN FIT','PERSISTABLE','CANONICAL SHARED SHELL','PAGE CANONICAL INTENT','REGISTERED COMPONENT CONTRACT','PUBLIC BUSINESS'];
      const pos = marks.map(m => [m, s.indexOf(m)] as const).filter(([, i]) => i >= 0).sort((a, b) => a[1] - b[1]);
      console.log(id, p.role, s.length, pos.map(([m, i], k) => `${m.slice(0, 14)}=${(pos[k + 1]?.[1] ?? s.length) - i}`).join(' '));
    }
  }
});
