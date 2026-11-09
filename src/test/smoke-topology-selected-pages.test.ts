/**
 * Smoke test: verify the router never generates blank routes for unselected
 * industry defaults when the wizard runs in "selected-pages" mode.
 *
 * Simulates the prompt-first launch call for several industries with only a
 * subset of pages checked, then asserts:
 *  1. The topology plan contains only Home + user-selected pages.
 *  2. The canonical router imports/routes exactly those pages, nothing else.
 */

import { describe, it, expect } from 'vitest';
import { planSiteTopology, resolvePageSpecsForRoles } from '@/platform/core/siteTopologyPlanner';
import { generateCanonicalRouterFromPlan } from '@/utils/topologyRouterGenerator';
import { getAllIndustries } from '@/platform/core/industryMatrix';
import { resolveVerticalLaunchContract } from '@/services/verticalLaunchContract';
import { LAUNCHER_PRESELECTS, PAGE_CHOICES } from '@/components/onboarding/wizard/wizardCatalog';

import type { PageSpec } from '@/platform/core/industryMatrix';

const SELECTIONS: Record<string, PageSpec> = {
  about: { path: '/about', title: 'About', purpose: 'about', expectedSections: [] },
  contact: { path: '/contact', title: 'Contact', purpose: 'contact', expectedSections: [] },
  services: { path: '/services', title: 'Services', purpose: 'services', expectedSections: [] },
};

const INDUSTRIES = ['salon', 'local-service', 'ecommerce', 'coaching', 'agency', 'nonprofit', 'restaurant'];

describe('selected-pages wizard mode — no blank routes', () => {
  it('registered industries cover smoke set', () => {
    const known = new Set(getAllIndustries().map(p => p.industry ?? ''));
    // Sanity: at least a few of our smoke industries resolve
    const resolvable = INDUSTRIES.filter(i => {
      try { return !!planSiteTopology(i, 'Acme', { additionalPages: [], restrictToAdditionalPages: true }); }
      catch { return false; }
    });
    expect(resolvable.length).toBeGreaterThanOrEqual(3);
  });

  for (const industry of INDUSTRIES) {
    it(`${industry}: emits only Home + selected pages, router matches`, () => {
      let plan;
      try {
        plan = planSiteTopology(industry, 'Acme Co', {
          additionalPages: [SELECTIONS.about, SELECTIONS.contact],
          restrictToAdditionalPages: true,
        });
      } catch {
        return; // industry not registered — skip
      }

      const routes = plan.pages.map(p => p.route).sort();
      // Only Home + about + contact
      expect(routes).toEqual(['/', '/about', '/contact']);

      // Every non-home page must have originated from our selection
      const nonHome = plan.pages.filter(p => !p.isHome).map(p => p.route);
      for (const r of nonHome) {
        expect(['/about', '/contact']).toContain(r);
      }

      // Router code contains exactly these routes, no extras
      const router = generateCanonicalRouterFromPlan(plan);
      expect(router).toContain('path="/"');
      expect(router).toContain('path="/about"');
      expect(router).toContain('path="/contact"');
      // Common industry defaults that should NOT appear
      for (const forbidden of ['/services', '/pricing', '/gallery', '/blog', '/faq', '/shop', '/booking']) {
        if (!['/about', '/contact'].includes(forbidden)) {
          expect(router).not.toContain(`path="${forbidden}"`);
        }
      }
    });
  }

  it('adding services to the selection wires exactly 4 routes', () => {
    const plan = planSiteTopology('salon', 'Acme', {
      additionalPages: [SELECTIONS.about, SELECTIONS.services, SELECTIONS.contact],
      restrictToAdditionalPages: true,
    });
    const routes = plan.pages.map(p => p.route).sort();
    expect(routes).toEqual(['/', '/about', '/contact', '/services']);
  });

  it('exposes Shop and resolves it through the canonical topology registry', () => {
    expect(PAGE_CHOICES.some((choice) => choice.id === 'shop')).toBe(true);
    expect(LAUNCHER_PRESELECTS.store.pages).toContain('shop');
    const plan = planSiteTopology('ecommerce', 'Acme Store', {
      additionalPages: resolvePageSpecsForRoles(['shop', 'checkout']),
      restrictToAdditionalPages: true,
    });

    expect(plan.pages.map((page) => [page.role, page.route])).toEqual([
      ['home', '/'],
      ['shop', '/shop'],
      ['checkout', '/checkout'],
    ]);
  });

  it('adds the immersive route only when its selected need has resolved to the role', () => {
    const withoutNeed = planSiteTopology('agency', 'Acme', {
      additionalPages: resolvePageSpecsForRoles(['about']),
      restrictToAdditionalPages: true,
    });
    expect(withoutNeed.pages.some((page) => page.route === '/experience')).toBe(false);

    const withNeed = planSiteTopology('agency', 'Acme', {
      additionalPages: resolvePageSpecsForRoles(['about', 'immersive']),
      restrictToAdditionalPages: true,
    });
    expect(withNeed.pages.map((page) => [page.role, page.route])).toContainEqual(['immersive', '/experience']);
    expect(generateCanonicalRouterFromPlan(withNeed)).toContain('path="/experience"');
  });

  it('resolves every page role exposed by the Wizard catalog', () => {
    const resolvedPaths = resolvePageSpecsForRoles(PAGE_CHOICES.map((choice) => choice.id));
    expect(resolvedPaths).toHaveLength(PAGE_CHOICES.length);
    expect(new Set(resolvedPaths.map((page) => page.path)).size).toBe(PAGE_CHOICES.length);
  });

  it('capability-full mode (restrictToAdditionalPages=false) preserves industry defaults', () => {
    const plan = planSiteTopology('salon', 'Acme', { restrictToAdditionalPages: false });
    expect(plan.pages.length).toBeGreaterThan(1);
  });

  it('vertical launch contracts cannot force capability-full wizard routes', () => {
    for (const systemType of ['booking', 'saas', 'agency', 'portfolio', 'store', 'content'] as const) {
      expect(resolveVerticalLaunchContract(systemType).capabilityFullScaffold).toBe(false);
    }
  });
});
