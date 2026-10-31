import { describe, expect, it } from 'vitest';
import { materializeDeterministicAppBuilderScaffold } from '@/services/app-builder/design/appBuilderScaffold';
import { planSiteComposition } from '@/services/composition';
import type { AppBuildContract } from '@/services/app-builder/appBuilderContracts';
import { materializeAppBuilderSectionModelsWithDiagnostics } from '@/services/app-builder/appBuilderSectionModel';
import { resolvedCompositionPathFor } from '@/platform/core/resolvedComposition';

const page = (id: string, title: string, route: string, role: string, isHome = false) => ({
  id,
  title,
  route,
  role,
  filePath: `/src/pages/${title.replace(/\s+/g, '')}.tsx`,
  isHome,
});

function scaffoldRegistry(contract: AppBuildContract) {
  const industry = contract.business.industry
    ?? contract.design.resolvedSiteDesignContext.contract.industry;
  const pages = contract.topology.sitePlan.pages;
  const compositionPlan = planSiteComposition(
    industry,
    pages.map((page) => ({ pageId: page.id, role: page.role })),
    'scaffold-registry-test',
    { availableCapabilities: contract.business.capabilities ?? [] },
  );
  (contract.design as { compositionPlan: AppBuildContract['design']['compositionPlan'] }).compositionPlan = compositionPlan;
  const implementations: Record<string, { modulePath: string; sectionType: string; props: string }> = {};
  const eligibleByPage: Record<string, string[]> = {};
  for (const planned of compositionPlan.pages) {
    eligibleByPage[planned.pageId] = [...new Set(planned.target.sectionOrder)].map((sectionType) => {
      const variantId = `${sectionType}:test`;
      const moduleName = sectionType.split(/[-_]/).map((part) => part[0].toUpperCase() + part.slice(1)).join('');
      implementations[variantId] = {
        modulePath: `/src/unison/design-sources/${moduleName}.tsx`,
        sectionType,
        props: 'eyebrow, headline, description, imageUrl?, items[]{title|description}',
      };
      return variantId;
    });
  }
  return { implementations, eligibleByPage };
}

describe('deterministic App Builder scaffold', () => {
  it('uses pinned variants and preserves repeated planned sections', () => {
    const target = page('home', 'Home', '/', 'home', true);
    const contract = { topology: { sitePlan: { pages: [target] }, pageRegistry: { pages: {} } },
      business: { industry: 'salon', capabilities: [], businessName: 'Studio', businessProfile: {}, parameters: {}, intentBindings: [] },
      design: { seed: 'stable', resolvedSiteDesignContext: { contract: { industry: 'salon' } } },
    } as unknown as AppBuildContract;
    const registry = scaffoldRegistry(contract);
    registry.implementations['services:pinned'] = { ...registry.implementations['services:test'] };
    registry.eligibleByPage.home.push('services:pinned');
    contract.design.registryContext = { pinnedImplementationIdsByPage: { home: ['services:pinned'] } } as never;
    contract.design.compositionPlan.pages[0].target.sectionOrder = ['hero', 'services', 'services', 'cta'];
    const source = materializeDeterministicAppBuilderScaffold(contract, registry)[target.filePath];
    expect(source.match(/data-ut-variant="services:pinned"/g)).toHaveLength(2);
    expect(source.match(/data-ut-section-type="services"/g)).toHaveLength(2);
    expect(materializeDeterministicAppBuilderScaffold(contract, registry)[target.filePath]).toBe(source);
  });
  it('creates all canonical ecommerce pages and places active route/cart controls on their bound pages', () => {
    const pages = [
      page('home', 'Home', '/', 'home', true),
      page('about', 'About', '/about', 'about'),
      page('contact', 'Contact', '/contact', 'contact'),
      page('checkout', 'Checkout', '/checkout', 'checkout'),
      page('shop', 'Shop', '/shop', 'shop'),
    ];
    const contract = {
      topology: {
        sitePlan: { pages },
        pageRegistry: {
          pages: {
            home: { pageId: 'home', path: '/', title: 'Home' },
            about: { pageId: 'about', path: '/about', title: 'About' },
            contact: { pageId: 'contact', path: '/contact', title: 'Contact' },
            checkout: { pageId: 'checkout', path: '/checkout', title: 'Checkout' },
            shop: { pageId: 'shop', path: '/shop', title: 'Shop' },
          },
        },
      },
      business: {
        industry: 'ecommerce',
        capabilities: ['commerce'],
        businessName: 'Northstar Market',
        businessProfile: { description: 'Owner-provided store description.' },
        parameters: {},
        intentBindings: [
          {
            pageId: 'checkout', domIntent: 'nav.goto', sourceLabel: 'Return to shop',
            sourceSlot: 'checkout-cta', ctaMarkers: ['cta.nav-link'], missingCapabilities: [],
            targetType: 'page', targetId: 'shop',
          },
          {
            pageId: 'shop', domIntent: 'cart.checkout', sourceLabel: 'Checkout',
            sourceSlot: 'checkout-cta', ctaMarkers: ['cta.checkout'], missingCapabilities: [],
            targetType: 'url', targetId: 'cart-overlay',
          },
          {
            pageId: 'home', domIntent: 'cart.view', sourceLabel: 'View cart',
            sourceSlot: 'icon-cart', ctaMarkers: ['icon.cart'], missingCapabilities: [],
            targetType: 'popup', targetId: 'cart-overlay',
          },
          {
            pageId: 'home', domIntent: 'search.open', sourceLabel: 'Search',
            sourceSlot: 'icon-search', ctaMarkers: ['icon.search'], missingCapabilities: [],
            targetType: 'popup', targetId: 'search-overlay',
          },
          {
            pageId: 'shop', domIntent: 'favorite.toggle', sourceLabel: 'Save favorite',
            sourceSlot: 'icon-favorite', ctaMarkers: ['icon.favorite'], missingCapabilities: [],
            targetType: 'product', targetId: 'product-1',
          },
          {
            pageId: 'shop', domIntent: 'catalog.filter', sourceLabel: 'Filter products',
            sourceSlot: 'icon-filter', ctaMarkers: ['icon.filter'], missingCapabilities: [],
            targetType: 'popup', targetId: 'filters',
          },
          {
            pageId: 'shop', domIntent: 'catalog.sort', sourceLabel: 'Sort products',
            sourceSlot: 'icon-sort', ctaMarkers: ['icon.sort'], missingCapabilities: [],
            targetType: 'popup', targetId: 'sort-options',
          },
        ],
      },
      design: { resolvedSiteDesignContext: { contract: { industry: 'ecommerce' } } },
    } as unknown as AppBuildContract;

    const registry = scaffoldRegistry(contract);
    const files = materializeDeterministicAppBuilderScaffold(contract, registry);

    expect(Object.keys(files).filter((path) => path.startsWith('/src/pages/'))).toHaveLength(5);
    for (const target of pages) {
      const source = files[target.filePath];
      const planned = contract.design.compositionPlan.pages.find((entry) => entry.pageId === target.id)!;
      expect(source).toContain('<SiteNav />');
      expect(source).toContain('<SiteFooter />');
      expect([...source.matchAll(/data-ut-section-type="([^"]+)"/g)].map((match) => match[1]))
        .toEqual(planned.target.sectionOrder);
      expect(source).toContain('data-ut-section-id=');
      expect(source).toContain('@/unison/design-sources/');
      expect(source).not.toContain('custom:');
    }
    expect(files['/src/pages/Checkout.tsx']).toContain('href="#/shop" data-ut-cta="cta.nav-link"');
    expect(files['/src/pages/Shop.tsx']).toContain('type="button" data-ut-cta="cta.checkout"');
    expect(files['/src/pages/Home.tsx']).toContain('aria-label="View cart" data-ut-cta="icon.cart"');
    expect(files['/src/pages/Home.tsx']).toContain('aria-label="Search" data-ut-cta="icon.search"');
    expect(files['/src/pages/Shop.tsx']).toContain('aria-label="Save favorite" data-ut-cta="icon.favorite"');
    expect(files['/src/pages/Shop.tsx']).toContain('aria-label="Filter products" data-ut-cta="icon.filter"');
    expect(files['/src/pages/Shop.tsx']).toContain('aria-label="Sort products" data-ut-cta="icon.sort"');
    const home = files['/src/pages/Home.tsx'];
    expect(home).not.toContain('AppBuilderScaffoldSection');
    for (const variantId of registry.eligibleByPage.home) expect(home).toContain(`data-ut-variant="${variantId}"`);
    expect(files['/src/pages/Home.tsx']).not.toContain('data-ut-intent=');
    const shellImplementations = {
      ...registry.implementations,
      'navbar:test': { modulePath: '/src/unison/design-sources/Navbar.tsx', sectionType: 'navbar' },
      'footer:test': { modulePath: '/src/unison/design-sources/Footer.tsx', sectionType: 'footer' },
    };
    const modeled = materializeAppBuilderSectionModelsWithDiagnostics({
      ...files,
      '/src/project-components/site/SiteNav.tsx': 'import Navbar from "@/unison/design-sources/Navbar"; export function SiteNav(){return <header data-ut-section-id="site:navbar" data-ut-section-type="navbar" data-ut-variant="navbar:test"><Navbar sectionId="site:navbar" variantId="navbar:test" props={{links:[]}} /></header>}',
      '/src/project-components/site/SiteFooter.tsx': 'import Footer from "@/unison/design-sources/Footer"; export function SiteFooter(){return <footer data-ut-section-id="site:footer" data-ut-section-type="footer" data-ut-variant="footer:test"><Footer sectionId="site:footer" variantId="footer:test" props={{links:[]}} /></footer>}',
    }, pages, shellImplementations, registry.eligibleByPage, ['navbar:test', 'footer:test']);
    expect(modeled.diagnostics).toEqual([]);
    for (const target of pages) {
      const sidecar = JSON.parse(modeled.files[resolvedCompositionPathFor(target.filePath)]);
      expect(sidecar.compiledBy).toBe('app-builder');
      const planned = contract.design.compositionPlan.pages.find(entry => entry.pageId === target.id);
      expect(sidecar.sections.filter((section: { sourcePath: string }) => section.sourcePath === target.filePath)
        .map((section: { semanticType: string }) => section.semanticType)).toEqual(planned?.target.sectionOrder);
    }
  });

  it('does not emit controls for bindings disabled by missing capabilities', () => {
    const contract = {
      topology: { sitePlan: { pages: [page('shop', 'Shop', '/shop', 'shop')] }, pageRegistry: { pages: {} } },
      business: {
        industry: 'ecommerce',
        capabilities: [],
        businessName: 'Northstar Market', businessProfile: {}, parameters: {},
        intentBindings: [{
          pageId: 'shop', domIntent: 'cart.checkout', sourceLabel: 'Checkout', sourceSlot: 'checkout-cta',
          ctaMarkers: ['cta.checkout'], missingCapabilities: ['commerce'], targetType: 'url', targetId: 'cart-overlay',
        }],
      },
      design: { resolvedSiteDesignContext: { contract: { industry: 'ecommerce' } } },
    } as unknown as AppBuildContract;

    const registry = scaffoldRegistry(contract);
    expect(materializeDeterministicAppBuilderScaffold(contract, registry)['/src/pages/Shop.tsx']).not.toContain('cta.checkout');
  });
});