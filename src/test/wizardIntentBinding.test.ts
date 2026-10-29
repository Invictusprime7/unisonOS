import { describe, expect, it } from 'vitest';
import { getIntentDef } from '@/platform/core';
import { resolvePlaygroundBindingDomIntent } from '@/platform/core/playground';
import { getIndustryIntentProfile } from '@/platform/core/industryIntentProfiles';
import { resolveCapabilities } from '@/services/wizardCapabilityResolver';
import { materializePlayground } from '@/services/wizardPlaygroundMaterializer';
import { applyWizardBindingsToVfs, getWizardBindingMarkers, normalizeWizardBindingMarkers } from '@/services/wizardBindingBridge';
import type { BusinessModel, IndustryOverlay, WizardSelections } from '@/types/playground';

function selections(
  businessModel: BusinessModel,
  industryOverlay: IndustryOverlay,
  overrides: Partial<WizardSelections> = {},
): WizardSelections {
  return {
    businessName: 'Test Business',
    businessModel,
    industryOverlay,
    primaryGoal: 'collect_leads',
    secondaryGoals: [],
    needsBooking: false,
    sellsProducts: false,
    wantsLeadCapture: false,
    ...overrides,
  };
}

function slotIntent(
  businessModel: BusinessModel,
  industryOverlay: IndustryOverlay,
  pageRole: string,
  section: string,
  slot: string,
  overrides: Partial<WizardSelections> = {},
) {
  const pack = resolveCapabilities(selections(businessModel, industryOverlay, overrides));
  return pack.recommendedBindingsV2.find(
    (binding) =>
      binding.sourcePageRole === pageRole &&
      binding.sourceSection === section &&
      binding.sourceSlot === slot,
  )?.coreIntent;
}

describe('wizard intent binding', () => {
  it('uses canonical capability ids in intent definitions', () => {
    expect(getIntentDef('contact.submit')?.requiredCapabilities).toEqual(['contact']);
    expect(getIntentDef('quote.request')?.requiredCapabilities).toEqual(['quoting']);
    expect(getIntentDef('lead.capture')?.requiredCapabilities).toEqual(['lead-capture']);
    expect(getIntentDef('newsletter.subscribe')?.requiredCapabilities).toEqual(['newsletter']);
  });

  it('uses intent semantics before slot names when choosing CTA markers', () => {
    expect(getWizardBindingMarkers({
      sourceSection: 'checkout',
      sourceSlot: 'checkout-cta',
      intent: 'nav.goto_page',
      coreIntent: 'nav.goto',
    } as never)).toEqual(['cta.nav-link']);
    expect(getWizardBindingMarkers({
      sourceSection: 'cart',
      sourceSlot: 'checkout-cta',
      intent: 'cart.checkout',
      coreIntent: 'cart.checkout',
    } as never)).toEqual(['cta.checkout']);
  });

  it('keeps canonical icon actions from being downgraded to navigation by legacy Playground intents', () => {
    for (const coreIntent of ['search.open', 'filter.open', 'sort.open', 'favorite.toggle']) {
      expect(resolvePlaygroundBindingDomIntent({
        intent: 'nav.goto_page',
        coreIntent,
      } as never)).toBe(coreIntent);
    }
  });

  it('resolves industry-specific hero CTAs deterministically', () => {
    expect(slotIntent('quote_lead', 'contractor', 'home', 'hero', 'primary-cta')).toBe('quote.request');
    expect(slotIntent('appointment_service', 'salon', 'home', 'hero', 'primary-cta')).toBe('booking.create');
    expect(slotIntent('restaurant_hospitality', 'restaurant', 'home', 'hero', 'primary-cta')).toBe('booking.create');
    expect(slotIntent('nonprofit', 'nonprofit', 'home', 'hero', 'primary-cta')).toBe('donation.start');
  });

  it('provisions a generic booking calendar for focused booking journeys without an industry default', () => {
    const capabilities = resolveCapabilities(selections('quote_lead', 'real-estate', { needsBooking: true }));

    expect(capabilities.requiredPages).toContain('booking');
    expect(capabilities.requiredCalendars).toContain('main_booking');
  });

  it('assigns real-estate launch components to canonical generated page IDs', () => {
    const wizardSelections = selections('quote_lead', 'real_estate', {
      needsBooking: true,
      wantsLeadCapture: true,
      requestedPages: ['about', 'services', 'gallery', 'contact', 'booking'],
      primaryIntent: 'contact.submit',
      themePresetId: 'editorial',
    });
    const pack = resolveCapabilities(wizardSelections);
    const { playground, sitePlan } = materializePlayground(wizardSelections, pack);
    const pagesById = new Map(sitePlan.pages.map((page) => [page.id, page]));
    const components = Object.values(playground.creatorData.componentInstances);

    expect(components.map((component) => component.componentSlug)).toContain('booking-scheduler');
    for (const component of components) {
      for (const pageId of component.usedOnPages) {
        expect(pagesById.has(pageId), `${component.componentSlug} -> ${pageId}`).toBe(true);
      }
    }
  });

  it('resolves commerce card, checkout, and icon slots to business behavior', () => {
    expect(slotIntent('ecommerce', 'ecommerce', 'shop', 'shop-grid', 'card-cta')).toBe('cart.add');
    expect(slotIntent('ecommerce', 'ecommerce', 'shop', 'cart', 'checkout-cta')).toBe('cart.checkout');
    expect(slotIntent('ecommerce', 'ecommerce', 'shop', 'shop-grid', 'icon-favorite')).toBe('favorite.toggle');
    expect(slotIntent('ecommerce', 'ecommerce', 'shop', 'shop-grid', 'icon-filter')).toBe('filter.open');
  });

  it('keeps icon binding authoring intents canonical for the marketplace', () => {
    const bindings = resolveCapabilities(selections('ecommerce', 'ecommerce')).recommendedBindingsV2;
    for (const [slot, intent] of [
      ['icon-search', 'search.open'],
      ['icon-cart', 'cart.view'],
      ['icon-filter', 'filter.open'],
      ['icon-sort', 'sort.open'],
      ['icon-favorite', 'favorite.toggle'],
    ] as const) {
      expect(bindings.find((binding) => binding.sourceSlot === slot)?.intent).toBe(intent);
    }
  });

  it('defines industry guardrails for forbidden intents', () => {
    const ecommerce = getIndustryIntentProfile('ecommerce');
    expect(ecommerce?.forbidden).not.toContain('booking.create');
    expect(ecommerce?.intents?.['booking.create']?.level).toBe('optional');
    expect(getIndustryIntentProfile('salon')?.forbidden).toContain('quote.request');
    expect(getIndustryIntentProfile('contractor')?.required).toContain('quote.request');
  });

  it('stamps canonical DOM intents even when playground authoring intent is legacy', () => {
    const result = applyWizardBindingsToVfs(
      {
        '/src/pages/Home.tsx': 'export default function Home() { return <button data-ut-cta="cta.hero">Shop Now</button>; }',
      },
      {
        pageRegistry: {
          homePageId: 'home',
          pages: {
            home: { pageId: 'home', title: 'Home', path: '/', filePath: '/src/pages/Home.tsx', isHome: true },
            shop: { pageId: 'shop', title: 'Shop', path: '/shop', filePath: '/src/pages/Shop.tsx' },
          },
        },
        bindings: {
          bind_home_shop: {
            bindingId: 'bind_home_shop',
            sourcePageId: 'home',
            sourceSection: 'hero',
            sourceSlot: 'primary-cta',
            sourceLabel: 'Shop Now',
            intent: 'nav.goto_page',
            coreIntent: 'nav.goto',
            targetId: 'shop',
            targetType: 'page',
            confidence: 1,
            source: 'wizard',
            isValid: true,
            readiness: 'preview-ready',
          },
        },
      } as any,
    );

    expect(result.appliedBindings).toBe(1);
    expect(result.files['/src/pages/Home.tsx']).toContain('data-ut-intent="nav.goto"');
    expect(result.files['/src/pages/Home.tsx']).not.toContain('data-ut-intent="nav.goto_page"');
    expect(result.files['/src/pages/Home.tsx']).toContain('data-ut-path="/shop"');
    expect(result.files['/src/pages/Home.tsx']).toContain('data-ut-slot="primary-cta"');
    expect(result.files['/src/pages/Home.tsx']).toContain('data-ut-section-role="hero"');
  });

  it('rewrites internal button-link destinations to the registered page route', () => {
    const result = applyWizardBindingsToVfs(
      {
        '/src/pages/Home.tsx': 'export default function Home() { return <a href="#/contact" data-ut-cta="cta.hero">Shop Now</a>; }',
      },
      {
        pageRegistry: {
          homePageId: 'home',
          pages: {
            home: { pageId: 'home', title: 'Home', path: '/', filePath: '/src/pages/Home.tsx', isHome: true },
            shop: { pageId: 'shop', title: 'Shop', path: '/shop', filePath: '/src/pages/Shop.tsx' },
          },
        },
        bindings: {
          bind_home_shop: {
            bindingId: 'bind_home_shop', sourcePageId: 'home', sourceSection: 'hero', sourceSlot: 'primary-cta',
            sourceLabel: 'Shop Now', intent: 'nav.goto_page', coreIntent: 'nav.goto', targetId: 'shop',
            targetType: 'page', confidence: 1, source: 'wizard', isValid: true, readiness: 'preview-ready',
          },
        },
      } as never,
    );

    expect(result.files['/src/pages/Home.tsx']).toContain('href="#/shop"');
    expect(result.files['/src/pages/Home.tsx']).toContain('data-ut-path="/shop"');
  });

  it('materializes a canonical route control in the registered section when AI omitted the CTA', () => {
    const files = {
      '/src/pages/Home.tsx': 'export default function Home(){return <main><section data-ut-section-id="home:hero:0" data-ut-section-type="hero"><h1>Welcome</h1></section></main>}',
    };
    const registry = {
      pages: {
        home: { pageId: 'home', title: 'Home', path: '/', filePath: '/src/pages/Home.tsx', isHome: true },
        shop: { pageId: 'shop', title: 'Shop', path: '/shop', filePath: '/src/pages/Shop.tsx' },
      },
      funnels: {}, homePageId: 'home', version: 1,
    } as never;

    const result = normalizeWizardBindingMarkers(files, registry, [{
      bindingId: 'bind-home-shop', pageId: 'home', sourceLabel: 'Shop now',
      sourceSection: 'hero', sourceSlot: 'primary-cta', domIntent: 'nav.goto',
      targetType: 'page', targetId: 'shop', targetPath: '/shop', markers: ['cta.hero'],
    }]);

    expect(result.unresolvedBindingIds, result.files['/src/pages/Home.tsx']).toEqual([]);
    expect(result.files['/src/pages/Home.tsx']).toContain('data-ut-binding-id="bind-home-shop"');
    expect(result.files['/src/pages/Home.tsx']).toContain('data-ut-intent="nav.goto"');
    expect(result.files['/src/pages/Home.tsx']).toContain('data-ut-path="/shop"');
    expect(result.files['/src/pages/Home.tsx']).toContain('data-ut-cta="cta.hero"');
    expect(result.files['/src/pages/Home.tsx']).toMatch(/data-ut-section-type="hero"[\s\S]*?<a href="#\/shop"/);
  });

  it('keeps duplicate icon bindings on distinct controls with their own IDs', () => {
    const files = {
      '/src/pages/Home.tsx': 'export default function Home(){return <><header data-ut-section-id="home:navbar:0" data-ut-section-type="navbar"><button data-ut-cta="icon.cart" aria-label="Cart">Cart</button></header><main /></>} ',
    };
    const registry = {
      pages: {
        home: { pageId: 'home', title: 'Home', path: '/', filePath: '/src/pages/Home.tsx', isHome: true },
      },
      funnels: {}, homePageId: 'home', version: 1,
    } as never;
    const bindings = [
      { bindingId: 'cart-primary', pageId: 'home', sourceLabel: 'Cart', sourceSection: 'navbar', sourceSlot: 'icon-cart', domIntent: 'commerce.cart.open', markers: ['icon.cart'] },
      { bindingId: 'cart-secondary', pageId: 'home', sourceLabel: 'Mini cart', sourceSection: 'navbar', sourceSlot: 'icon-cart', domIntent: 'commerce.cart.open', markers: ['icon.cart'] },
    ];

    const result = normalizeWizardBindingMarkers(files, registry, bindings as never);
    const output = result.files['/src/pages/Home.tsx'];

    expect(result.unresolvedBindingIds).toEqual([]);
    expect(output.match(/data-ut-binding-id="cart-primary"/g)).toHaveLength(1);
    expect(output.match(/data-ut-binding-id="cart-secondary"/g)).toHaveLength(1);
    expect(output.match(/data-ut-cta="icon\.cart"/g)).toHaveLength(2);
  });
});
