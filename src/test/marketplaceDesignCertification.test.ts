import { describe, expect, it } from 'vitest';
import type { DesignReleaseManifestV1 } from '@/marketplace/contracts';
import { validateDesignRelease } from '@/marketplace/certification/validateDesignRelease';
import { listDesignImplementations } from '@/services/designImplementationRegistry';
import { explainImplementationExclusion } from '@/services/designImplementationEligibility';

const implementation = listDesignImplementations().find((candidate) =>
  explainImplementationExclusion(candidate.implementationId, {
    sectionType: candidate.sectionType,
    industry: 'salon',
    artDirectionPackId: 'editorial-noir',
    availableCapabilities: [],
  }) === null,
);

const manifest: DesignReleaseManifestV1 = {
  schemaVersion: 'marketplace-design-release/1',
  productType: 'site_template',
  industryKey: 'salon',
  pageRoles: ['home'],
  source: {
    acceptedRevisionId: 'revision-1',
    snapshotSha256: 'a'.repeat(64),
  },
  design: {
    artDirectionPackId: 'editorial-noir',
    implementationIds: implementation ? [implementation.implementationId] : [],
    registrySignature: 'registry-v1',
  },
  requirements: {
    runtimeMode: 'design-only',
    capabilityIds: [],
    requiredResourceKeys: [],
    optionalIntegrations: [],
  },
  assets: [],
  export: {
    formats: ['unison-project'],
    licenseTier: 'personal',
  },
};

const acceptedRevision = {
  revisionId: 'revision-1',
  snapshotSha256: 'a'.repeat(64),
};

describe('validateDesignRelease', () => {
  it('accepts a manifest whose source and implementations match canonical evidence', () => {
    expect(implementation).toBeDefined();
    expect(validateDesignRelease(manifest, acceptedRevision)).toEqual({ passed: true, issues: [] });
  });

  it('rejects a manifest detached from its accepted revision', () => {
    const result = validateDesignRelease(manifest, {
      ...acceptedRevision,
      revisionId: 'different-revision',
    });

    expect(result.passed).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain('accepted-revision-mismatch');
  });

  it('rejects unknown implementations and reference-only assets', () => {
    const result = validateDesignRelease({
      ...manifest,
      design: { ...manifest.design, implementationIds: ['unknown:implementation'] },
      assets: [{ path: '/reference.png', sha256: 'b'.repeat(64), licenseClass: 'reference-only' }],
    }, acceptedRevision);

    expect(result.passed).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual([
      'implementation-unregistered',
      'asset-not-redistributable',
    ]);
  });

  it('does not treat declared requirements as provisioned capabilities', () => {
    const capabilityGated = listDesignImplementations().find((candidate) =>
      explainImplementationExclusion(candidate.implementationId, {
        sectionType: candidate.sectionType,
        industry: 'salon',
        artDirectionPackId: 'editorial-noir',
        availableCapabilities: [],
      })?.startsWith('capability:'),
    );
    if (!capabilityGated) return;

    const result = validateDesignRelease({
      ...manifest,
      design: { ...manifest.design, implementationIds: [capabilityGated.implementationId] },
      requirements: {
        ...manifest.requirements,
        capabilityIds: ['experience.three-d'],
      },
    }, acceptedRevision);

    expect(result.issues.map((issue) => issue.code)).toContain('implementation-ineligible');
  });
});