import { describe, expect, it } from 'vitest';
import { resolveBusinessLaunchPlan } from '@/services/launch/launchCapabilities';

describe('unsupported wizard choices', () => {
  it('drops quoting for a SaaS business instead of adding it', () => {
    const plan = resolveBusinessLaunchPlan({ industry: 'saas', customerNeeds: ['request_quote', 'fill_form'] });
    expect(plan.blockedRequests).toContain('quoting');
    expect(plan.blockedRequests).not.toContain('industry:not-registered');
    expect(plan.operationalCapabilities).not.toContain('quoting');
  });
});
