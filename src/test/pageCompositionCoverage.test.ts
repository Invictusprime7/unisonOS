import { describe, expect, it } from 'vitest';
import { pageCompositionCoverage } from '@/services/app-builder/pageCompositionCoverage';
import type { AppBuilderPageSectionMaterialization } from '@/services/app-builder/appBuilderSectionModel';
import { planSiteComposition } from '@/services/composition';

const actual = (families: string[]) => ({ filePath: '/src/pages/Home.tsx', inspection: { sections: families.map(semanticType => ({ semanticType })) } }) as AppBuilderPageSectionMaterialization;
describe('sealed page composition coverage', () => {
  it('rejects an AI page missing an entire planned gallery section', () => {
    const page = planSiteComposition('salon', [{ pageId: 'home', role: 'home' }], 'coverage').pages[0];
    page.target.sectionOrder = ['hero', 'services', 'gallery', 'cta'];
    expect(pageCompositionCoverage(page, actual(['hero', 'services', 'cta']))).toHaveLength(1);
    expect(pageCompositionCoverage(page, actual(page.target.sectionOrder))).toEqual([]);
  });
  it('preserves repeated objects rather than collapsing a family', () => {
    const page = planSiteComposition('salon', [{ pageId: 'home', role: 'home' }], 'coverage').pages[0];
    page.target.sectionOrder = ['hero', 'services', 'services', 'cta'];
    expect(pageCompositionCoverage(page, actual(['hero', 'services', 'cta']))).toHaveLength(1);
    expect(pageCompositionCoverage(page, actual(page.target.sectionOrder))).toEqual([]);
  });
  it('rejects a gallery on checkout even if it is claimed by a supplied plan', () => {
    const page = planSiteComposition('ecommerce', [{ pageId: 'checkout', role: 'checkout' }], 'coverage').pages[0];
    page.target.sectionOrder = ['contact', 'gallery'];
    expect(pageCompositionCoverage(page, actual(['contact', 'gallery']))).toEqual(['pages.checkout.sectionOrder: gallery is forbidden on a checkout page']);
  });
});