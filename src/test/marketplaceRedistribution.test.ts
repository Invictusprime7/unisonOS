import { describe, expect, it } from 'vitest';
import type { DesignReleaseManifestV1 } from '@/marketplace/contracts';
import {
  validateRedistribution,
  type AssetRedistributionReview,
} from '@/marketplace/certification/validateRedistribution';

const manifest: DesignReleaseManifestV1 = {
  schemaVersion: 'marketplace-design-release/1',
  productType: 'site_template',
  industryKey: 'salon',
  pageRoles: ['home'],
  source: { acceptedRevisionId: 'revision-1', snapshotSha256: 'a'.repeat(64) },
  design: {
    artDirectionPackId: 'editorial-noir',
    implementationIds: ['hero:editorial'],
    registrySignature: 'registry-v1',
  },
  requirements: {
    runtimeMode: 'design-only',
    capabilityIds: [],
    requiredResourceKeys: [],
    optionalIntegrations: [],
  },
  assets: [{ path: '/assets/hero.webp', sha256: 'b'.repeat(64), licenseClass: 'redistributable' }],
  export: { formats: ['vite-react-zip'], licenseTier: 'commercial' },
};

const verifiedReview: AssetRedistributionReview = {
  path: '/assets/hero.webp',
  sha256: 'b'.repeat(64),
  licenseClass: 'redistributable',
  reviewStatus: 'verified',
  license: 'Commercial redistribution license',
  evidenceSource: 'https://licenses.example.test/asset-hero',
  reviewedBy: 'reviewer-1',
  verifiedAt: '2026-10-22T12:00:00.000Z',
  commercialUseAllowed: true,
  bundleRedistributionAllowed: true,
  includedInRelease: true,
};

describe('validateRedistribution', () => {
  it('accepts a verified asset whose evidence matches the release hash and scope', () => {
    expect(validateRedistribution(manifest, [verifiedReview])).toEqual({ passed: true, issues: [] });
  });

  it('blocks missing or incomplete rights evidence and denied bundle rights', () => {
    expect(validateRedistribution(manifest, []).issues.map((issue) => issue.code))
      .toContain('review-missing');

    const result = validateRedistribution(manifest, [{
      ...verifiedReview,
      reviewStatus: 'unverified',
      evidenceSource: '',
      bundleRedistributionAllowed: false,
    }]);
    expect(result.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'review-not-verified',
      'review-evidence-incomplete',
      'bundle-redistribution-not-allowed',
    ]));
  });

  it('blocks reference-only files, bundled buyer assets, and mismatched hashes', () => {
    const result = validateRedistribution({
      ...manifest,
      assets: [
        { path: '/reference.png', sha256: 'c'.repeat(64), licenseClass: 'reference-only' },
        { path: '/buyer/logo.svg', sha256: 'd'.repeat(64), licenseClass: 'buyer-supplied' },
        manifest.assets[0],
      ],
    }, [
      { ...verifiedReview, path: '/reference.png', sha256: 'c'.repeat(64), licenseClass: 'reference-only' },
      { ...verifiedReview, path: '/buyer/logo.svg', sha256: 'd'.repeat(64), licenseClass: 'buyer-supplied' },
      { ...verifiedReview, sha256: 'e'.repeat(64) },
    ]);

    expect(result.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'reference-only-asset',
      'buyer-asset-included',
      'asset-hash-mismatch',
    ]));
  });
});