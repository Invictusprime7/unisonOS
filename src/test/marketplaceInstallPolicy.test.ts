import { describe, expect, it } from 'vitest';
import { canClaimRelease } from '../../supabase/functions/marketplace-install-template/installPolicy';
describe('marketplace draft license authorization', () => {
  it('allows free published templates without an existing license', () => expect(canClaimRelease(0, false)).toBe(true));
  it('does not turn a paid preview into a free license', () => expect(canClaimRelease(4900, false)).toBe(false));
  it('allows an already licensed paid template', () => expect(canClaimRelease(4900, true)).toBe(true));
});