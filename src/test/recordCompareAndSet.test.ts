import { describe, expect, it } from 'vitest';
import { applyExpectedFilters } from '../../supabase/functions/_shared/recordCompareAndSet';

describe('atomic record conditional filters', () => {
  it('conditions the mutation on numeric, image and nullable saved field values', () => {
    const filters: Array<[string, string, unknown]> = [];
    const query = {
      eq(key: string, value: unknown) { filters.push(['eq', key, value]); return this; },
      is(key: string, value: null) { filters.push(['is', key, value]); return this; },
    };
    applyExpectedFilters(query, { price: 10, image_url: 'old.jpg', description: null }, { price: 'money', image_url: 'text', description: 'text' });
    expect(filters).toEqual([['eq', 'price', 10], ['eq', 'image_url', 'old.jpg'], ['is', 'description', null]]);
  });
  it('rejects ownership fields and injected filter keys', () => {
    const query = { eq() { return this; }, is() { return this; } };
    expect(() => applyExpectedFilters(query, { project_id: 'other' }, { price: 'money' })).toThrow('Invalid expected field');
    expect(() => applyExpectedFilters(query, { 'price.or': 10 }, { 'price.or': 'money' })).toThrow('Invalid expected field');
  });
});