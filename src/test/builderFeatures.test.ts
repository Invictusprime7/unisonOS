import { describe, expect, it } from 'vitest';
import { BUILDER_FEATURE_DEFAULTS, readBuilderFeatures, requireBuilderFeature, builderAuthoringLane } from '@/services/builder/builderFeatures';

describe('Builder feature settings and authoring authority', () => {
  for (const feature of ['images', 'catalog', 'capabilities', 'repairs', 'tools'] as const) {
    it(`blocks disabled ${feature}`, () => {
      expect(() => requireBuilderFeature({ ...BUILDER_FEATURE_DEFAULTS, [feature]: false }, feature)).toThrow('AI settings');
      expect(() => requireBuilderFeature(BUILDER_FEATURE_DEFAULTS, feature)).not.toThrow();
    });
  }
  it('restores boolean preferences without trusting arbitrary stored values', () => {
    expect(readBuilderFeatures('{"images":false,"catalog":"false"}')).toEqual({ ...BUILDER_FEATURE_DEFAULTS, images: false });
    expect(readBuilderFeatures('invalid')).toEqual(BUILDER_FEATURE_DEFAULTS);
  });
  it('routes source edits only to the validated composer', () => {
    expect(builderAuthoringLane(false, false, { '/src/pages/Home.tsx': 'home' })).toBe('composer');
    expect(() => builderAuthoringLane(false, false, { '/index.html': '<main />' })).toThrow('No legacy');
  });
  it('keeps launch and catalog proposals separate from source authoring', () => {
    expect(builderAuthoringLane(true, false, {})).toBe('launch');
    expect(builderAuthoringLane(false, true, {})).toBe('catalog');
  });
});