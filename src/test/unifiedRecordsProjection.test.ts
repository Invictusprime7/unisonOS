import { afterEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('@/services/resources/resourceRuntime', () => ({ queryResource: mocks.query }));
import { registerContentTypes } from '@/services/resources/resourceRegistry';
import { loadUnifiedRecords } from '@/services/resources/recordsProjection';
const ctx = { businessId: 'business-a', projectId: 'project-a', mode: 'builder' as const };
afterEach(() => { registerContentTypes([]); vi.clearAllMocks(); });
describe('unified records projection', () => {
  it('shows all four kinds together and retains exact write addresses without title-based deduplication', async () => {
    registerContentTypes([{ id: 'case-type', api_key: 'case_studies' }, { id: 'faq-type', api_key: 'faqs' }]);
    mocks.query.mockImplementation(async (key) => key === 'testimonials' ? [{ id: 'review', author_name: 'Client' }] : key === 'portfolio' ? [{ id: 'project', title: 'Launch' }] : key === 'content:faq' ? [{ id: 'q1', question: 'Shipping?', title: 'Shipping?' }] : key === 'content:case-studies' ? [{ id: 'c1', title: 'Launch' }, { id: 'c2', title: 'Launch' }] : []);
    const result = await loadUnifiedRecords(ctx);
    expect(result.errors).toEqual([]);
    expect(new Set(result.records.map((r) => r.kind))).toEqual(new Set(['testimonials', 'projects', 'case-studies', 'faqs']));
    expect(result.records.map((r) => r.key)).toContain('content:case-studies#c2');
    expect(result.records).toHaveLength(5);
    for (const [key, scope] of mocks.query.mock.calls) { expect(key).toBeTruthy(); expect(scope).toEqual(ctx); }
  });
  it('keeps failed collection reads visible instead of reporting empty success', async () => {
    mocks.query.mockImplementation(async (key) => { if (key === 'testimonials') throw new Error('Access denied'); return []; });
    expect(await loadUnifiedRecords(ctx)).toEqual({ records: [], errors: ['Testimonials: Access denied'] });
  });
});