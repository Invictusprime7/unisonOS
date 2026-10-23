import { describe, expect, it } from 'vitest';
import { getRecipePacksForIndustry, normalizeIndustry } from '@/services/automationOrchestrator';

describe('automation industry normalization', () => {
  it('uses canonical industry aliases and an explicit recipe compatibility mapping', () => {
    expect(normalizeIndustry('beauty')).toBe('salon');
    expect(normalizeIndustry('plumber')).toBe('contractor');
    expect(normalizeIndustry('local service')).toBe('contractor');
  });

  it('does not substitute an unrelated recipe pack for unsupported or unknown industries', () => {
    expect(normalizeIndustry('nonprofit')).toBe('nonprofit');
    expect(normalizeIndustry('portfolio')).toBe('portfolio');
    expect(normalizeIndustry('unknown business type')).toBeUndefined();
    expect(getRecipePacksForIndustry('nonprofit')).toEqual([]);
    expect(getRecipePacksForIndustry('unknown business type')).toEqual([]);
  });
});