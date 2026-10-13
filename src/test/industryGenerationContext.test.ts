import { describe, expect, it, vi } from 'vitest';
import { buildIndustryAuthoringContext } from '@/services/app-builder/appBuilderGenerationContext';
import { resolveLaunchCapabilities } from '@/services/launch/launchCapabilities';
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

  it('adds product checkout only when a focused goal asks to sell offers', () => {
    const restaurantDefaults = ['booking', 'contact'] as const;
    expect(resolveLaunchCapabilities(restaurantDefaults, false)).toEqual(restaurantDefaults);
    expect(resolveLaunchCapabilities(restaurantDefaults, true)).toEqual([
      'booking', 'contact', 'commerce',
    ]);
  });
});