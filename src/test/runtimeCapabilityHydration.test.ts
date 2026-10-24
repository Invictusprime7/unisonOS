import { describe, expect, it } from 'vitest';
import { compileGeneratedSiteRuntimeManifest } from '@/services/generatedSiteRuntimeManifest';

describe('saved runtime capability hydration', () => {
  const snapshot = {
    snapshotId: 'saved', componentInstances: {},
    businessSystem: {
      version: '1.0' as const, requestedCapabilities: [],
      capabilities: [{ id: 'commerce' as const, status: 'provisioned' as const, provides: [], approval: { approvedBy: 'owner', approvedAt: '2026-10-24' } }],
    },
  };
  it('retains saved commerce when caller does not repeat the capability selection', () => {
    expect(compileGeneratedSiteRuntimeManifest({ snapshot }).enabledCapabilities).toEqual(['commerce']);
  });
  it('honors an explicit removal rather than reviving saved commerce', () => {
    expect(compileGeneratedSiteRuntimeManifest({ snapshot, enabledCapabilities: [] }).enabledCapabilities).toEqual([]);
  });
});