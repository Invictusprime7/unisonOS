import type { DesignReleaseManifestV1 } from '@/marketplace/contracts';

export interface AssetRedistributionReview {
  path: string;
  sha256: string;
  licenseClass: DesignReleaseManifestV1['assets'][number]['licenseClass'];
  reviewStatus: 'unverified' | 'verified' | 'rejected';
  license: string;
  evidenceSource: string;
  reviewedBy: string;
  verifiedAt: string | null;
  commercialUseAllowed: boolean;
  bundleRedistributionAllowed: boolean;
  includedInRelease: boolean;
}

export type RedistributionIssueCode =
  | 'duplicate-review'
  | 'review-missing'
  | 'asset-hash-mismatch'
  | 'license-class-mismatch'
  | 'reference-only-asset'
  | 'buyer-asset-included'
  | 'review-not-verified'
  | 'review-evidence-incomplete'
  | 'commercial-use-not-allowed'
  | 'bundle-redistribution-not-allowed';

export interface RedistributionIssue {
  code: RedistributionIssueCode;
  message: string;
  assetPath: string;
}

export interface RedistributionValidationResult {
  passed: boolean;
  issues: RedistributionIssue[];
}

const SHA256_RE = /^[a-f0-9]{64}$/i;

export function validateRedistribution(
  manifest: DesignReleaseManifestV1,
  reviews: readonly AssetRedistributionReview[],
): RedistributionValidationResult {
  const issues: RedistributionIssue[] = [];
  const reviewByPath = new Map<string, AssetRedistributionReview>();

  for (const review of reviews) {
    if (reviewByPath.has(review.path)) {
      issues.push({
        code: 'duplicate-review',
        message: `Asset ${review.path} has multiple rights reviews.`,
        assetPath: review.path,
      });
    } else {
      reviewByPath.set(review.path, review);
    }
  }

  const seenPaths = new Set<string>();
  for (const asset of manifest.assets) {
    if (seenPaths.has(asset.path)) {
      issues.push({
        code: 'duplicate-review',
        message: `Release asset ${asset.path} is declared more than once.`,
        assetPath: asset.path,
      });
      continue;
    }
    seenPaths.add(asset.path);

    const review = reviewByPath.get(asset.path);
    if (!review) {
      issues.push({
        code: 'review-missing',
        message: `Release asset ${asset.path} has no rights review.`,
        assetPath: asset.path,
      });
      continue;
    }

    if (!SHA256_RE.test(asset.sha256) || asset.sha256.toLowerCase() !== review.sha256.toLowerCase()) {
      issues.push({
        code: 'asset-hash-mismatch',
        message: `Rights review for ${asset.path} does not match the release asset hash.`,
        assetPath: asset.path,
      });
    }
    if (review.licenseClass !== asset.licenseClass) {
      issues.push({
        code: 'license-class-mismatch',
        message: `Rights review for ${asset.path} has a different license class than the release manifest.`,
        assetPath: asset.path,
      });
    }
    if (asset.licenseClass === 'reference-only') {
      issues.push({
        code: 'reference-only-asset',
        message: `Reference-only asset ${asset.path} cannot be redistributed.`,
        assetPath: asset.path,
      });
      continue;
    }
    if (asset.licenseClass === 'buyer-supplied') {
      if (review.includedInRelease) {
        issues.push({
          code: 'buyer-asset-included',
          message: `Buyer-supplied asset ${asset.path} must not be bundled in the release.`,
          assetPath: asset.path,
        });
      }
      continue;
    }
    if (review.reviewStatus !== 'verified') {
      issues.push({
        code: 'review-not-verified',
        message: `Commercial redistribution rights for ${asset.path} have not been verified.`,
        assetPath: asset.path,
      });
    }

    const hasEvidence = Boolean(
      review.license.trim()
      && review.evidenceSource.trim()
      && review.reviewedBy.trim()
      && review.verifiedAt
      && Number.isFinite(Date.parse(review.verifiedAt)),
    );
    if (!hasEvidence) {
      issues.push({
        code: 'review-evidence-incomplete',
        message: `Rights evidence for ${asset.path} is incomplete.`,
        assetPath: asset.path,
      });
    }
    if (!review.commercialUseAllowed) {
      issues.push({
        code: 'commercial-use-not-allowed',
        message: `Commercial use is not approved for ${asset.path}.`,
        assetPath: asset.path,
      });
    }
    if (!review.bundleRedistributionAllowed) {
      issues.push({
        code: 'bundle-redistribution-not-allowed',
        message: `Bundled redistribution is not approved for ${asset.path}.`,
        assetPath: asset.path,
      });
    }
  }

  return { passed: issues.length === 0, issues };
}