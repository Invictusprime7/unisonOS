import { afterEach, describe, expect, it } from 'vitest';
import { getCatalogSurface } from '@/platform/core/catalogSurfaceRegistry';
import { canonicalContentSlug, getResource, listRecordCollections, registerContentTypes } from '@/services/resources/resourceRegistry';

afterEach(() => registerContentTypes([]));
describe('canonical record collections and legacy aliases', () => {
  it.each(['Testimonials', 'testimonials', 'testimonial', 'reviews', 'review', 'social_proof', 'social-proof', 'customer_reviews'])('keeps %s on the testimonial catalog owner', (alias) => {
    expect(getResource(alias)).toMatchObject({ key: 'testimonials', kind: 'catalog', storage: { table: 'testimonials' } });
  });
  it.each(['PortfolioGrid', 'Portfolio', 'portfolio_grid', 'portfolio', 'projects', 'project', 'portfolio_projects', 'case_studies', 'gallery', 'work'])('preserves existing catalog alias %s', (alias) => {
    expect(getCatalogSurface(alias)?.surfaceId).toBe('portfolio');
  });
  it('keeps renderer aliases separate from content aliases instead of stealing old bindings', () => {
    registerContentTypes([{ id: 'case-1', api_key: 'case_studies', field_schema: { fields: [{ key: 'body', type: 'textarea' }] } }]);
    expect(getResource('case_studies')?.key).toBe('portfolio');
    expect(getResource('content:case_studies')).toMatchObject({ key: 'content:case-studies', kind: 'content', storage: { contentTypeId: 'case-1' } });
    expect(getResource('content:caseStudies')?.key).toBe('content:case-studies');
  });
  it.each(['faq', 'faqs', 'frequently_asked_questions', 'questions-and-answers', 'q_and_a'])('normalizes FAQ alias %s', (alias) => {
    expect(canonicalContentSlug(alias)).toBe('faq');
  });
  it('lists each logical record collection once while retaining every historical type ID and field', () => {
    registerContentTypes([
      { id: 'faq-old', api_key: 'faqs', field_schema: [{ key: 'answer', type: 'textarea' }] },
      { id: 'faq-main', api_key: 'faq', field_schema: [{ key: 'question', type: 'text' }] },
      { id: 'case-old', api_key: 'case_studies' },
      { id: 'case-main', api_key: 'case-studies' },
      { id: 'reviews-old', api_key: 'reviews' },
      { id: 'projects-old', api_key: 'projects' },
    ]);
    const collections = listRecordCollections();
    expect(collections.map((collection) => collection.kind)).toEqual(expect.arrayContaining(['testimonials', 'projects', 'case-studies', 'faqs']));
    expect(new Set(collections.map((collection) => collection.kind)).size).toBe(collections.length);
    expect(getResource('content:faqs')).toMatchObject({ key: 'content:faq', storage: { contentTypeId: 'faq-main', contentTypeIds: ['faq-main', 'faq-old'] } });
    expect(getResource('content:faq')?.schema.map((f) => f.key)).toEqual(['title', 'question', 'answer']);
    expect(getResource('content:case-study')?.storage.contentTypeIds).toEqual(['case-main', 'case-old']);
    expect(listRecordCollections().find((c) => c.kind === 'testimonials')?.resources.map((r) => r.key)).toEqual(['testimonials', 'content:testimonials']);
  });
});