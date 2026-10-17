import { describe, it, expect } from 'vitest';
import { buildRenderedResourceIndex, detectUsedAssetKeys, isRelevantAsset, listAssetTypes, normalizeIndustry } from '@/services/resources/assetCatalog';
import { registerContentTypes } from '@/services/resources/resourceRegistry';

describe('asset catalog', () => {
  it('ranks by industry and marks used types', () => {
    const files = { '/src/pages/Home.tsx': '<ServiceGrid /><div data-ut-resource="testimonials#t1.quote" />' };
    const types = listAssetTypes({ industry: 'barber', vfsFiles: files });
    expect(normalizeIndustry('barber')).toBe('salon');
    expect(types[0].used).toBe(true);
    const services = types.find((t) => t.key === 'services')!;
    expect(services.group).toBe('catalog');
    expect(types.find((t) => t.key === 'testimonials')?.group).toBe('content');
    expect(isRelevantAsset(services)).toBe(true);
    expect(detectUsedAssetKeys(files).has('testimonials')).toBe(true);
  });
  it('indexes rendered record marks', () => {
    const idx = buildRenderedResourceIndex({ '/a.tsx': '<p data-ut-resource="products#p1.name">x</p>' });
    expect(idx.get('products#p1')).toEqual(['/a.tsx']);
  });
  it('recognizes historical CMS marks as the canonical asset collection', () => {
    registerContentTypes([{ id: 'faq-type', api_key: 'faq' }, { id: 'case-type', api_key: 'case_studies' }]);
    try {
      const used = detectUsedAssetKeys({ '/src/pages/Home.tsx': '<p data-ut-resource="content:faqs#q1.answer" /><p data-ut-resource="content:case_studies#c1.title" />' });
      expect(used.has('content:faq')).toBe(true);
      expect(used.has('content:case-studies')).toBe(true);
      expect(used.has('content:faqs')).toBe(false);
    } finally { registerContentTypes([]); }
  });
});
