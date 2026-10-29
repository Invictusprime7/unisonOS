import { describe, expect, it } from 'vitest';
import { materializeDeterministicAppBuilderScaffold } from '@/services/app-builder/design/appBuilderScaffold';
import type { AppBuildContract } from '@/services/app-builder/appBuilderContracts';

const page = (id: string, title: string, route: string, role: string, isHome = false) => ({
  id,
  title,
  route,
  role,
  filePath: `/src/pages/${title.replace(/\s+/g, '')}.tsx`,
  isHome,
});

describe('deterministic App Builder scaffold', () => {
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

    const files = materializeDeterministicAppBuilderScaffold(contract);

    expect(Object.keys(files).filter((path) => path.startsWith('/src/pages/'))).toHaveLength(5);
    for (const target of pages) {
      const source = files[target.filePath];
      expect(source).toContain('<SiteNav />');
      expect(source).toContain('<SiteFooter />');
      expect(source.match(/<section\b/g)).toHaveLength(target.role === 'home' ? 3 : 2);
      expect(source).toContain('data-ut-section-id=');
    }
    expect(files['/src/pages/Checkout.tsx']).toContain('href="#/shop" data-ut-cta="cta.nav-link"');
    expect(files['/src/pages/Shop.tsx']).toContain('type="button" data-ut-cta="cta.checkout"');
    expect(files['/src/pages/Home.tsx']).toContain('aria-label="View cart" data-ut-cta="icon.cart"');
    expect(files['/src/pages/Home.tsx']).toContain('aria-label="Search" data-ut-cta="icon.search"');
    expect(files['/src/pages/Shop.tsx']).toContain('aria-label="Save favorite" data-ut-cta="icon.favorite"');
    expect(files['/src/pages/Shop.tsx']).toContain('aria-label="Filter products" data-ut-cta="icon.filter"');
    expect(files['/src/pages/Shop.tsx']).toContain('aria-label="Sort products" data-ut-cta="icon.sort"');
    expect(files['/src/project-components/AppBuilderScaffoldSection.tsx']).toContain('<img src={props.imageUrl}');
    expect(files['/src/pages/Home.tsx']).not.toContain('data-ut-intent=');
  });

  it('does not emit controls for bindings disabled by missing capabilities', () => {
    const contract = {
      topology: { sitePlan: { pages: [page('shop', 'Shop', '/shop', 'shop')] }, pageRegistry: { pages: {} } },
      business: {
        businessName: 'Northstar Market', businessProfile: {}, parameters: {},
        intentBindings: [{
          pageId: 'shop', domIntent: 'cart.checkout', sourceLabel: 'Checkout', sourceSlot: 'checkout-cta',
          ctaMarkers: ['cta.checkout'], missingCapabilities: ['commerce'], targetType: 'url', targetId: 'cart-overlay',
        }],
      },
      design: { resolvedSiteDesignContext: { contract: { industry: 'ecommerce' } } },
    } as unknown as AppBuildContract;

    expect(materializeDeterministicAppBuilderScaffold(contract)['/src/pages/Shop.tsx']).not.toContain('cta.checkout');
  });
});