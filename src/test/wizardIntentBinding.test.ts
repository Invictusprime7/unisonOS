import { describe, expect, it } from 'vitest';
import { getIntentDef } from '@/platform/core';
import { getIndustryIntentProfile } from '@/platform/core/industryIntentProfiles';
import { resolveCapabilities } from '@/services/wizardCapabilityResolver';
import { materializePlayground } from '@/services/wizardPlaygroundMaterializer';
import { applyWizardBindingsToVfs, getWizardBindingMarkers } from '@/services/wizardBindingBridge';
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
});
