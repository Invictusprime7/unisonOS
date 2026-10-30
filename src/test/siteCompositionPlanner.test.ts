import { describe, expect, it } from 'vitest';
import {
  compositionSimilarity,
  extractCompositionSignature,
  findRedundancy,
  listIndustryProfiles,
  planSiteComposition,
  renderCompositionBrief,
  resolvePageCompositionProfile,
} from '@/services/composition';
import { getAllSections } from '@/sections/registry';

const roles = ['home', 'services', 'gallery', 'about', 'booking', 'contact'];
const pages = roles.map((role) => ({ pageId: `p-${role}`, role }));
const key = (t: { hero: string; geometry: string; sectionOrder: string[] }) => `${t.hero}|${t.geometry}|${t.sectionOrder.join('>')}`;

describe('siteCompositionPlanner', () => {
  it.each([
    ['pricing', ['hero', 'pricing', 'faq', 'cta']],
    ['checkout', ['contact', 'faq']],
    ['blog', ['blog-preview']],
    ['shop', ['services', 'gallery', 'cta']],
    ['faq', ['faq', 'cta']],
    ['gallery', ['gallery', 'before-after', 'cta']],
  ])('preserves the %s page responsibility rather than inheriting About', (role, sectionOrder) => {
    const plan = planSiteComposition('ecommerce', [{ pageId: role as string, role: role as string }], 'role-jobs');
    expect(plan.pages[0].profile.pageRole).toBe(role);
    expect(plan.pages[0].target.sectionOrder).toEqual(sectionOrder);
  });

  it('keeps every booking candidate free of unsupported testimonial sections', () => {
    for (const industry of ['salon', 'restaurant', 'ecommerce']) {
      const profile = resolvePageCompositionProfile(industry, 'booking');
      for (const order of profile.sectionOrderCandidates ?? []) {
        expect(order).not.toContain('testimonials');
        expect(order).toContain('contact');
        expect(order).toContain('faq');
      }
    }
  });

  it('inherits generic profiles by role rather than their position in the industry list', () => {
    for (const role of roles) {
      const generic = resolvePageCompositionProfile('ecommerce', role);
      const source = resolvePageCompositionProfile('salon', role);
      expect(generic.pageRole).toBe(role);
      expect(generic.preferredFamilies).toEqual(source.preferredFamilies);
      expect(generic.sectionOrderCandidates).toEqual(source.sectionOrderCandidates);
      expect(generic.narrativeGoals).toEqual(source.narrativeGoals);
    }
  });

  it('plans Contact using its supported contact and FAQ families before sealing', () => {
    for (const industry of ['salon', 'ecommerce']) {
      for (const seed of ['one', 'two', 'three']) {
        const plan = planSiteComposition(industry, [{ pageId: 'contact', role: 'contact' }], seed);
        expect(plan.pages[0].target.sectionOrder).toEqual(['contact', 'faq']);
      }
    }
  });

  it('gives every salon page a distinct composition job', () => {
    const plan = planSiteComposition('salon', pages, 'seed-a');
    expect(plan.pages).toHaveLength(6);
    expect(new Set(plan.pages.map((p) => key(p.target))).size).toBe(6);
    expect(plan.pages.every((p) => p.profile.industryId === 'salon')).toBe(true);
    const immersive = plan.pages.filter((p) => p.target.hero === 'immersive-media');
    expect(immersive.length).toBeLessThanOrEqual(1);
  });

  it('plans a restaurant with the same planner and data only', () => {
    const plan = planSiteComposition('restaurant', [...pages, { pageId: 'p-menu', role: 'menu' }], 'seed-a');
    expect(plan.pages.find((p) => p.role === 'menu')?.profile.industryId).toBe('restaurant');
    expect(new Set(plan.pages.map((p) => key(p.target))).size).toBe(plan.pages.length);
    expect(listIndustryProfiles('restaurant').length).toBeGreaterThanOrEqual(6);
    expect(plan.pages.find((p) => p.role === 'services')?.profile.domainVocabulary).toContain('mains');
  });

  it('is deterministic for the same seed', () => {
    expect(planSiteComposition('salon', pages, 'x')).toEqual(planSiteComposition('salon', pages, 'x'));
  });

  it('selects multiple proven architectures for one industry without losing page intent', () => {
    const orders = new Map<string, string[]>();
    for (let index = 0; index < 24; index += 1) {
      const plan = planSiteComposition('salon', [{ pageId: 'services', role: 'services' }], `seed-${index}`, {
        artDirection: 'soft-editorial', availableCapabilities: ['booking'], businessTraits: ['appointment-led'],
      });
      const page = plan.pages[0];
      orders.set(page.target.sectionOrder.join('>'), page.profile.narrativeGoals);
      expect(page.compositionKey).toContain('salon:services:soft-editorial');
    }
    expect(orders.size).toBeGreaterThanOrEqual(2);
    expect(new Set([...orders.values()].map((goals) => goals.join('|'))).size).toBe(1);
  });

  it('only selects registered executable section families', () => {
    const registered = new Set(Object.keys(getAllSections()));
    for (const industry of ['salon', 'restaurant']) {
      for (const seed of ['one', 'two', 'three']) {
        const plan = planSiteComposition(industry, pages, seed);
        for (const page of plan.pages) {
          for (const family of page.target.sectionOrder) expect(registered.has(family), `${industry}:${page.role}:${family}`).toBe(true);
        }
      }
    }
  });

  it('keeps page jobs regardless of art direction seed', () => {
    const a = planSiteComposition('salon', pages, 'pack-editorial');
    const b = planSiteComposition('salon', pages, 'pack-bold');
    expect(a.pages.map((p) => p.profile.narrativeGoals)).toEqual(b.pages.map((p) => p.profile.narrativeGoals));
  });

  it('falls back to generic role jobs for other industries and aliases', () => {
    const plan = planSiteComposition('agency', [{ pageId: 'h', role: 'home' }, { pageId: 'b', role: 'Book Now' }], 's');
    expect(plan.pages[1].profile.pageRole).toBe('booking');
  });
});

describe('redundancy detection', () => {
  const src = `<section data-ut-section="hero" className="min-h-screen"><img alt=""/></section><section data-ut-section="services"/><section data-ut-section="cta"/>`;
  it('flags near-identical topology and feeds the repair brief', () => {
    const sig = extractCompositionSignature(src);
    expect(sig.sectionOrder).toEqual(['hero', 'services', 'cta']);
    expect(compositionSimilarity(sig, sig)).toBe(1);
    const issue = findRedundancy('b', sig, [{ pageId: 'a', role: 'home', signature: sig }]);
    expect(issue?.conflictsWith).toBe('a');
    const plan = planSiteComposition('salon', pages, 's');
    expect(renderCompositionBrief(plan.pages[1], [], issue)).toContain('REDUNDANCY REPAIR');
  });
});
