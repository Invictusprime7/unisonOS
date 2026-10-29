import { describe, expect, it, vi } from 'vitest';
import {
  buildIndustryAuthoringContext,
  getIndustrySeedDataTargets,
  getUnmappedIndustrySeedDataKeys,
} from '@/services/app-builder/appBuilderGenerationContext';
import { resolveBusinessLaunchPlan, resolveLaunchCapabilities } from '@/services/launch/launchCapabilities';
import { getAllIndustries } from '@/platform/core/industryMatrix';
import { getCapabilitiesForIndustry, getCapability, isCapabilitySupportedForIndustry } from '@/platform/core/capabilityRegistry';
import { listCatalogSurfaces } from '@/platform/core/catalogSurfaceRegistry';
import { createEmptyCreatorData } from '@/types/creatorData';

const catalogMocks = vi.hoisted(() => ({
  listCatalog: vi.fn(),
  createCatalogItem: vi.fn(),
}));

vi.mock('@/services/agent-runtime/catalogOps', () => catalogMocks);
vi.mock('@/services/businessProfileService', () => ({
  loadBusinessProfile: vi.fn().mockResolvedValue(null),
  saveBusinessProfile: vi.fn(),
}));
vi.mock('@/services/cmsRecordService', () => ({
  createContentRecord: vi.fn(),
  listContentRecords: vi.fn(),
  listContentTypes: vi.fn(),
  mutateContentRecord: vi.fn(),
}));

import { resolveProductCatalogSurface, resolveProductCatalogSurfaces, seedLaunchAssets } from '@/services/resources/seedLaunchAssets';
import { normalizeIndustry } from '@/services/resources/assetCatalog';

describe('industry-aware generation context', () => {
  it('maps every industry seed key to a canonical target and existing catalog surface', () => {
    expect(getUnmappedIndustrySeedDataKeys()).toEqual([]);
    const catalogSurfaces = new Set(listCatalogSurfaces().map((surface) => surface.surfaceId));

    for (const industry of getAllIndustries()) {
      const targets = getIndustrySeedDataTargets(industry.industry);
      expect(targets.map(({ key }) => key)).toEqual(industry.seedDataKeys);
      for (const { key, target } of targets) {
        expect(target.target, `${industry.industry}.${key}`).toBeTruthy();
        if (target.catalogSurface) {
          expect(catalogSurfaces.has(target.catalogSurface), `${industry.industry}.${key} catalog`).toBe(true);
        }
      }
    }
  });

  it('preserves legacy asset ranking aliases while resolving new cuisine aliases', () => {
    expect(normalizeIndustry('beauty')).toBe('salon');
    expect(normalizeIndustry('fitness')).toBe('fitness');
    expect(normalizeIndustry('food truck')).toBe('restaurant');
    expect(normalizeIndustry('bistro')).toBe('restaurant');
  });

  it('seeds restaurant dishes into menu and mirrors them to products only for focused commerce', async () => {
    catalogMocks.listCatalog.mockResolvedValue([]);
    catalogMocks.createCatalogItem.mockResolvedValue({});
    const creatorData = createEmptyCreatorData('Demo Bistro');
    creatorData.products.dish = {
      productId: 'dish',
      name: 'Roasted squash',
      description: 'Seasonal small plate',
      price: 18,
      currency: 'USD',
      category: 'Small plates',
      featured: true,
      status: 'active',
      sortOrder: 0,
    };

    await seedLaunchAssets({
      businessId: 'business-1',
      projectId: 'project-1',
      industry: 'bistro',
      enableProductCommerce: true,
      creatorData,
    });

    expect(catalogMocks.createCatalogItem).toHaveBeenCalledWith(
      'business-1', 'menu', expect.objectContaining({ name: 'Roasted squash', category: 'Small plates', price: 18 }), 'project-1',
    );
    expect(catalogMocks.createCatalogItem).toHaveBeenCalledWith(
      'business-1', 'products', expect.objectContaining({ name: 'Roasted squash', price: 18 }), 'project-1',
    );
  });

  it('seeds SaaS subscription tiers into pricing and commerce only when selected', async () => {
    catalogMocks.listCatalog.mockResolvedValue([]);
    catalogMocks.createCatalogItem.mockResolvedValue({});
    const creatorData = createEmptyCreatorData('Demo Software');
    creatorData.products.pro = {
      productId: 'pro',
      name: 'Professional',
      description: 'For growing teams',
      price: 49,
      currency: 'USD',
      category: 'Plans',
      billingType: 'subscription',
      billingInterval: 'month',
      featured: true,
      status: 'active',
      sortOrder: 0,
    };

    await seedLaunchAssets({
      businessId: 'business-saas',
      projectId: 'project-saas',
      industry: 'software company',
      enableProductCommerce: true,
      creatorData,
    });

    expect(catalogMocks.createCatalogItem).toHaveBeenCalledWith(
      'business-saas', 'pricing', expect.objectContaining({
        name: 'Professional', price: 49, billing_interval: 'monthly', highlighted: true,
      }), 'project-saas',
    );
    expect(catalogMocks.createCatalogItem).toHaveBeenCalledWith(
      'business-saas', 'products', expect.objectContaining({ name: 'Professional', price: 49, featured: true }), 'project-saas',
    );
  });

  it('keeps service catalog metadata intact for service-led industries', async () => {
    catalogMocks.listCatalog.mockResolvedValue([]);
    catalogMocks.createCatalogItem.mockResolvedValue({});
    const creatorData = createEmptyCreatorData('Demo Service');
    creatorData.services.tuneup = {
      serviceId: 'tuneup',
      name: 'Seasonal Tune-up',
      description: 'Preventative maintenance',
      price: 120,
      duration: 90,
      category: 'Maintenance',
      featured: true,
      visibility: 'public',
      bookable: true,
      sortOrder: 2,
    };

    await seedLaunchAssets({ businessId: 'business-service', industry: 'plumber', creatorData });

    expect(catalogMocks.createCatalogItem).toHaveBeenCalledWith(
      'business-service', 'services', expect.objectContaining({
        name: 'Seasonal Tune-up', category: 'Maintenance', duration_minutes: 90, featured: true, active: true,
      }), undefined,
    );
  });

  it('gives cafe aliases the restaurant seed and catalog contract without locking focused intent', () => {
    const context = buildIndustryAuthoringContext('cafe', ['booking', 'catalog.menu']);

    expect(context).toContain('canonical industry restaurant');
    expect(context).toContain('menu_items');
    expect(context).toContain('catalog.menu');
    expect(context).toContain('focused user intent is additive');
    expect(context).toContain('invent unprovisioned tables');
  });

  it('routes restaurant dishes to the menu catalog and explicitly named merch to products', () => {
    expect(resolveProductCatalogSurface('bistro', {
      name: 'Roasted squash',
      category: 'Small plates',
      tags: ['seasonal'],
    })).toBe('menu');

    expect(resolveProductCatalogSurface('restaurant', {
      name: 'House gift card',
      category: 'Gift cards',
      tags: [],
    })).toBe('products');

    expect(resolveProductCatalogSurface('salon', {
      name: 'Signature treatment',
      category: 'Treatments',
      tags: [],
    })).toBe('products');

    expect(resolveProductCatalogSurfaces('restaurant', {
      name: 'Roasted squash', category: 'Small plates', tags: [],
    }, true)).toEqual(['menu', 'products']);
  });

  it('routes SaaS subscription tiers to pricing and only adds checkout products for focused commerce', () => {
    const plan = {
      name: 'Professional',
      category: 'Plans',
      tags: [],
      fulfillmentType: 'digital' as const,
      billingType: 'subscription' as const,
    };
    expect(resolveProductCatalogSurface('software company', plan)).toBe('pricing');
    expect(resolveProductCatalogSurfaces('saas', plan)).toEqual(['pricing']);
    expect(resolveProductCatalogSurfaces('saas', plan, true)).toEqual(['pricing', 'products']);
  });

  it('adds product checkout only when a focused goal asks to sell offers', () => {
    const restaurantDefaults = ['booking', 'contact'] as const;
    expect(resolveLaunchCapabilities(restaurantDefaults, 'restaurant')).toEqual(restaurantDefaults);
    expect(resolveLaunchCapabilities(restaurantDefaults, 'restaurant', {
      primaryGoal: 'sell_offers', customerNeeds: ['buy_offer'],
    })).toEqual([
      'booking', 'contact', 'commerce',
    ]);
  });

  it('compiles canonical aliases into the same versioned journey and capability plan', () => {
    const canonical = resolveBusinessLaunchPlan({
      industry: 'restaurant',
      primaryGoal: 'reserve_table',
      customerNeeds: ['reserve_table'],
    });
    const alias = resolveBusinessLaunchPlan({
      industry: 'cafe',
      primaryGoal: 'reserve_table',
      customerNeeds: ['reserve_table'],
    });

    expect(canonical.version).toBe('unison-business-launch-plan/1');
    expect(canonical).toEqual(alias);
    expect(resolveBusinessLaunchPlan({
      industry: 'not-a-registered-industry',
      primaryGoal: 'collect_leads',
    })).toMatchObject({
      canonicalIndustryId: null,
      operationalCapabilities: [],
      blockedRequests: ['industry:not-registered'],
    });
  });

  it('keeps industry defaults supported and adds focused packs only when their registry allows them', () => {
    const focusedRequests = [
      { request: { primaryGoal: 'collect_leads' as const }, capability: 'lead-capture' as const },
      { request: { primaryGoal: 'book_appointments' as const }, capability: 'booking' as const },
      { request: { primaryGoal: 'sell_offers' as const }, capability: 'commerce' as const },
      { request: { primaryGoal: 'drive_calls' as const }, capability: 'contact' as const },
      { request: { primaryGoal: 'grow_email_list' as const }, capability: 'newsletter' as const },
      { request: { customerNeeds: ['request_quote'] as const }, capability: 'quoting' as const },
      { request: { customerNeeds: ['book_service'] as const }, capability: 'booking' as const },
      { request: { customerNeeds: ['buy_offer'] as const }, capability: 'commerce' as const },
      { request: { customerNeeds: ['fill_form'] as const }, capability: 'lead-capture' as const },
    ];

    for (const industry of getAllIndustries()) {
      for (const capability of industry.defaultCapabilities) {
        expect(getCapability(capability).supportedIndustries, `${industry.industry}.${capability}`)
          .toContain(industry.industry);
      }

      for (const { request, capability } of focusedRequests) {
        const resolved = resolveLaunchCapabilities(industry.defaultCapabilities, industry.industry, request);
        const expected = industry.defaultCapabilities.includes(capability)
          || getCapability(capability).supportedIndustries.includes(industry.industry);
        expect(resolved.includes(capability), `${industry.industry}.${capability}`).toBe(expected);
      }
    }
  });

  it('compiles every canonical industry into a deterministic non-blocked plan', () => {
    for (const industry of getAllIndustries()) {
      const input = { industry: industry.industry, primaryGoal: null, customerNeeds: [] } as const;
      const first = resolveBusinessLaunchPlan(input);
      const second = resolveBusinessLaunchPlan(input);

      expect(first, industry.industry).toEqual(second);
      expect(first.canonicalIndustryId, industry.industry).toBe(industry.industry);
      expect(first.operationalCapabilities, industry.industry).toEqual(industry.defaultCapabilities);
      expect(first.businessCapabilities, industry.industry).toContain('business_profile');
      expect(first.blockedRequests, industry.industry).toEqual([]);
    }
  });

  it('keeps salon booking and newsletter bindings opt-in when the goal is lead capture', () => {
    const plan = resolveBusinessLaunchPlan({
      industry: 'salon',
      primaryGoal: 'collect_leads',
      customerNeeds: ['fill_form', 'browse_services'],
      selectedPages: ['contact'],
    });

    expect(plan.requestedIntents).toEqual(expect.arrayContaining(['lead.capture', 'contact.submit']));
    expect(plan.primaryIntent).toBe('lead.capture');
    expect(plan.requestedIntents).not.toContain('booking.create');
    expect(plan.requestedIntents).not.toContain('newsletter.subscribe');
  });

  it('requests booking bindings when the goal, action, or page explicitly requests booking', () => {
    expect(resolveBusinessLaunchPlan({ industry: 'salon', primaryGoal: 'book_appointments' }).requestedIntents)
      .toContain('booking.create');
    expect(resolveBusinessLaunchPlan({ industry: 'salon', customerNeeds: ['book_service'] }).requestedIntents)
      .toContain('booking.create');
    expect(resolveBusinessLaunchPlan({ industry: 'salon', selectedPages: ['booking'] }).requestedIntents)
      .toContain('booking.create');
  });

  it('does not request the booking capability just to browse services', () => {
    expect(resolveLaunchCapabilities([], 'saas', { customerNeeds: ['browse_services'] })).toEqual([]);
    expect(resolveBusinessLaunchPlan({ industry: 'salon', customerNeeds: ['browse_services'] }).requestedIntents)
      .not.toContain('booking.create');
  });

  it('resolves capability packs and compiler support through canonical industry aliases', () => {
    expect(getCapabilitiesForIndustry('software company').map((capability) => capability.id))
      .toContain('lead-capture');
    expect(isCapabilitySupportedForIndustry('commerce', 'photography studio')).toBe(true);
    expect(isCapabilitySupportedForIndustry('commerce', 'realtor')).toBe(false);
  });
});