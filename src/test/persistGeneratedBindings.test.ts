import { describe, expect, it } from 'vitest';
import { countExpectedGeneratedBindingReceipts } from '@/services/persistGeneratedBindings';

describe('generated intent binding receipt counts', () => {
  it('matches the persister page-slot deduplication key and excludes inactive bindings', () => {
    expect(countExpectedGeneratedBindingReceipts([
      { route: '/', sourceSlot: 'primary-cta', missingCapabilities: [] },
      { route: '/', sourceSlot: 'primary-cta', missingCapabilities: [] },
      { route: '/', sourceSlot: 'icon-search', missingCapabilities: [] },
      { route: '/contact', sourceSlot: 'form-submit', missingCapabilities: [] },
      { route: '/booking', sourceSlot: 'form-submit', missingCapabilities: ['booking'] },
    ])).toBe(3);
  });
});