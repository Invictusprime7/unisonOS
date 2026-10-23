import { describe, expect, it } from 'vitest';
import type { SiteBundleSnapshot } from '@/platform/core/canonicalPipeline';
import type { LoadedRevision } from '@/services/vfsCommitService';
import type { DesignReleaseManifestV1 } from '@/marketplace/contracts';
import type { AcceptedRevisionEvidenceReader } from '@/marketplace/certification/acceptedRevisionEvidence';
import { validateAcceptedDesignRelease } from '@/marketplace/certification/validateAcceptedDesignRelease';
import { listDesignImplementations } from '@/services/designImplementationRegistry';
import { explainImplementationExclusion } from '@/services/designImplementationEligibility';
import { computeSiteBundleSnapshotSha256 } from '@/marketplace/snapshotFingerprint';

const projectId = '11111111-1111-4111-8111-111111111111';
const revisionId = '22222222-2222-4222-8222-222222222222';
const businessId = '33333333-3333-4333-8333-333333333333';
const userId = '44444444-4444-4444-8444-444444444444';
const snapshot = {
  snapshotId: 'snapshot-1',
  vfsFiles: { '/src/App.tsx': 'export default function App() { return null; }' },
  meta: { seal: { version: '1.0' } },
} as unknown as SiteBundleSnapshot;

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
  source: { acceptedRevisionId: revisionId, snapshotSha256: '' },
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
  export: { formats: ['unison-project'], licenseTier: 'personal' },
};

const committedRevision = {
  id: revisionId,
  projectId,
  businessId,
  draftId: '55555555-5555-4555-8555-555555555555',
  source: 'wizard-launch',
  status: 'committed',
  vfsFiles: snapshot.vfsFiles,
  siteBundleSnapshot: snapshot,
  runtimeManifest: null,
  playground: null,
  readinessReport: {},
  diagnostics: [],
  publishReady: false,
  publishBlockers: [],
  vfsHash: null,
  candidateId: null,
  operationIds: [],
  fileProvenance: {},
  createdAt: '2026-10-22T00:00:00.000Z',
} satisfies LoadedRevision;

const reader: AcceptedRevisionEvidenceReader = {
  getCurrentUserId: async () => userId,
  getProject: async () => ({ ownerId: userId, businessId }),
  getRevision: async () => committedRevision,
};

describe('validateAcceptedDesignRelease', () => {
  it('uses the trusted committed snapshot hash and revision identity', async () => {
    const result = await validateAcceptedDesignRelease({
      manifest,
      projectId,
      acceptedRevisionId: revisionId,
      assetReviews: [],
      privateValues: [],
    }, reader);

    expect(result.design.issues.map((issue) => issue.code)).toContain('accepted-revision-mismatch');
    expect(result.snapshotSha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it('passes when the manifest is bound to the trusted revision evidence', async () => {
    const evidence = await validateAcceptedDesignRelease({
      manifest: { ...manifest, source: { ...manifest.source, snapshotSha256: '' } },
      projectId,
      acceptedRevisionId: revisionId,
      assetReviews: [],
      privateValues: [],
    }, reader);
    const matching = await validateAcceptedDesignRelease({
      manifest: {
        ...manifest,
        source: { ...manifest.source, snapshotSha256: evidence.snapshotSha256 },
      },
      projectId,
      acceptedRevisionId: revisionId,
      assetReviews: [],
      privateValues: [],
    }, reader);

    expect(matching.checksPassed).toBe(true);
    expect(matching.publicationEligible).toBe(false);
  });

  it('fails the accepted release gate when a declared asset lacks a rights review', async () => {
    const withAsset = {
      ...manifest,
      source: { ...manifest.source, snapshotSha256: '' },
      assets: [{ path: '/assets/hero.webp', sha256: 'a'.repeat(64), licenseClass: 'owned' as const }],
    };
    const firstPass = await validateAcceptedDesignRelease({
      manifest: withAsset,
      projectId,
      acceptedRevisionId: revisionId,
      assetReviews: [],
      privateValues: [],
    }, reader);
    const matching = await validateAcceptedDesignRelease({
      manifest: {
        ...withAsset,
        source: { ...withAsset.source, snapshotSha256: firstPass.snapshotSha256 },
      },
      projectId,
      acceptedRevisionId: revisionId,
      assetReviews: [],
      privateValues: [],
    }, reader);

    expect(matching.checksPassed).toBe(false);
    expect(matching.publicationEligible).toBe(false);
    expect(matching.redistribution.issues.map((issue) => issue.code)).toContain('review-missing');
  });

  it('fails source sanitization when trusted owner-specific data remains in a source file', async () => {
    const privateEmail = 'owner@private.example';
    const privateSnapshot = {
      ...snapshot,
      vfsFiles: { '/src/contact.tsx': `export const contact = '${privateEmail}';` },
    } as SiteBundleSnapshot;
    const privateReader: AcceptedRevisionEvidenceReader = {
      ...reader,
      getRevision: async () => ({ ...committedRevision, siteBundleSnapshot: privateSnapshot }),
    };
    const privateHash = await computeSiteBundleSnapshotSha256(privateSnapshot);
    const result = await validateAcceptedDesignRelease({
      manifest: { ...manifest, source: { acceptedRevisionId: revisionId, snapshotSha256: privateHash } },
      projectId,
      acceptedRevisionId: revisionId,
      assetReviews: [],
      privateValues: [privateEmail],
    }, privateReader);

    expect(result.design.passed).toBe(true);
    expect(result.sourceScan.passed).toBe(false);
    expect(result.sourceScan.issues.map((issue) => issue.code)).toContain('private-value-present');
    expect(JSON.stringify(result.sourceScan)).not.toContain(privateEmail);
  });
});