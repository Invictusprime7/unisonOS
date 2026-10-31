import { describe, expect, it } from 'vitest';
import { INDUSTRY_MATRIX } from '@/platform/core/industryMatrix';
import { resolveVerticalLaunchContract } from '@/services/verticalLaunchContract';

describe('industry capability defaults', () => {
  for (const profile of Object.values(INDUSTRY_MATRIX)) {
    it(`${profile.industry} enables lead-capture when its vertical forces lead capture`, () => {
      const vertical = resolveVerticalLaunchContract(profile.systemType);
      if (vertical.forcedNeeds?.leadCapture) {
        expect(profile.defaultCapabilities).toContain('lead-capture');
      }
    });
  }
});
