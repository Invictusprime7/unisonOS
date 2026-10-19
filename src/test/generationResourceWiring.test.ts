import { describe, expect, it } from 'vitest';
import { INDUSTRY_SEED_DATA_TARGETS, buildIndustryIconContext, buildRegisteredResourceContext } from '@/services/app-builder/appBuilderGenerationContext';
import { EDITABLE_CATALOG_SURFACES } from '@/services/agent-runtime/catalogOps';
import { resolveProductCatalogSurface } from '@/services/resources/seedLaunchAssets';
import { registerContentTypes } from '@/services/resources/resourceRegistry';

describe('generation resource wiring', () => {
  it.each([
    ['business_name', 'business-profile', 'businessInfo.businessName'],
    ['business_email', 'business-profile', 'businessInfo.email'],
    ['operating_hours', 'business-profile', 'businessInfo.hours'],
    ['mission_statement', 'business-profile', 'businessInfo.description'],
    ['programs', 'services', 'services'],
    ['specialties', 'services', 'services.category'],
    ['credentials', 'content:team', 'team'],
    ['portfolio_items', 'content:gallery', 'gallery'],
    ['case_studies', 'content:case-studies', 'caseStudies'],
  ])('routes %s to its declared record and CreatorData target', (key, resourceKey, creatorDataPath) => {
    expect(INDUSTRY_SEED_DATA_TARGETS[key]).toMatchObject({ resourceKey, creatorDataPath });
  });
  it.each([['pricing_tiers', 'pricing'], ['services', 'services'], ['menu_items', 'menu'], ['products', 'products']])(
    'routes %s to the requested catalog', (key, catalogSurface) => {
      expect(INDUSTRY_SEED_DATA_TARGETS[key]?.catalogSurface).toBe(catalogSurface);
    });
  it.each(['features', 'service_areas', 'shipping_info'])('never promotes %s into a catalog', (key) => {
    expect(INDUSTRY_SEED_DATA_TARGETS[key]).toBeDefined();
    expect(INDUSTRY_SEED_DATA_TARGETS[key]?.catalogSurface).toBeUndefined();
    expect(INDUSTRY_SEED_DATA_TARGETS[key]?.resourceKey).toBeUndefined();
  });
  it('exposes all editable registered catalogs to agent operations', () => {
    expect(EDITABLE_CATALOG_SURFACES).toEqual(['services', 'products', 'menu', 'pricing', 'offers', 'testimonials', 'portfolio', 'availability']);
  });
  it('uses registered price and intent support for cart eligibility', () => {
    const text = buildIndustryIconContext('coaching', ['commerce'], ['cart.add'], ['menu', 'offers', 'pricing']);
    expect(text).toContain('cart actions for products, menu;');
    expect(text).not.toContain('cart actions for services');
    expect(text).not.toContain('cart actions for offers');
    expect(text).toContain('persisted product IDs');
  });
  it.each([['commerce', 'contact.submit'], ['booking', 'cart.add']])('requires commerce and explicit cart intent (%s/%s)', (capability, intent) => {
    expect(buildIndustryIconContext('restaurant', [capability], [intent])).toContain('omit shopping bag/cart actions');
  });
  it('includes selected cross-industry and dynamic CMS surfaces without inventing tables', () => {
    registerContentTypes([{ id: 'article-type', api_key: 'articles', field_schema: { fields: [{ key: 'body', type: 'textarea' }] } }]);
    try {
      expect(buildRegisteredResourceContext()).toContain('content:articles → CMS articles');
      expect(buildRegisteredResourceContext()).toContain('body:textarea');
      expect(buildIndustryIconContext('restaurant', [], [], ['portfolio'])).toContain('menu, portfolio');
    } finally { registerContentTypes([]); }
  });
  it.each(['products', 'menu', 'pricing'] as const)('honors explicit %s seed targets across industries', (catalogSurface) => {
    expect(resolveProductCatalogSurface('coaching', { name: 'Owner supplied', catalogSurface })).toBe(catalogSurface);
  });
});