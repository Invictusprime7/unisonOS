// Pure helpers for trusted release certification: asset-rights decisions and
// review verdict validation. Kept free of I/O so Deno tests can cover every
// gate without a database.

export interface ManifestAssetEntry {
  path: string;
  sha256: string;
  licenseClass: 'owned' | 'redistributable' | 'buyer-supplied' | 'reference-only';
}

export interface AssetRightsDecision {
  path: string;
  sha256: string;
  /** 'include' bundles the asset for buyers; 'exclude' keeps it on the owner's site only. */
  decision: 'include' | 'exclude';
  license: string;
  evidenceSource: string;
  commercialUseAllowed: boolean;
  bundleRedistributionAllowed: boolean;
  /** Excluded assets the buyer must supply themselves (e.g. their own logo). */
  buyerSupplied?: boolean;
}

export interface RightsIssue {
  code:
    | 'asset-not-in-manifest'
    | 'asset-hash-mismatch'
    | 'include-missing-license'
    | 'include-missing-evidence'
    | 'include-rights-not-granted'
    | 'invalid-decision';
  message: string;
  assetPath: string;
}

const SHA256_RE = /^[a-f0-9]{64}$/i;

export function validateAssetRightsDecisions(
  manifestAssets: readonly ManifestAssetEntry[],
  decisions: readonly AssetRightsDecision[],
): RightsIssue[] {
  const issues: RightsIssue[] = [];
  const manifestByPath = new Map(manifestAssets.map((asset) => [asset.path, asset]));
  const seen = new Set<string>();

  for (const decision of decisions) {
    if (seen.has(decision.path)) continue;
    seen.add(decision.path);

    const manifestAsset = manifestByPath.get(decision.path);
    if (!manifestAsset) {
      issues.push({
        code: 'asset-not-in-manifest',
        message: `Asset ${decision.path} is not listed in the release manifest.`,
        assetPath: decision.path,
      });
      continue;
    }
    if (!SHA256_RE.test(decision.sha256) || decision.sha256.toLowerCase() !== manifestAsset.sha256.toLowerCase()) {
      issues.push({
        code: 'asset-hash-mismatch',
        message: `Rights decision for ${decision.path} does not match the staged asset fingerprint.`,
        assetPath: decision.path,
      });
      continue;
    }
    if (decision.decision !== 'include' && decision.decision !== 'exclude') {
      issues.push({
        code: 'invalid-decision',
        message: `Asset ${decision.path} needs an include or exclude decision.`,
        assetPath: decision.path,
      });
      continue;
    }
    if (decision.decision === 'include') {
      if (!decision.license.trim()) {
        issues.push({
          code: 'include-missing-license',
          message: `Bundled asset ${decision.path} needs a named license.`,
          assetPath: decision.path,
        });
      }
      if (!decision.evidenceSource.trim()) {
        issues.push({
          code: 'include-missing-evidence',
          message: `Bundled asset ${decision.path} needs evidence of its license.`,
          assetPath: decision.path,
        });
      }
      if (!decision.commercialUseAllowed || !decision.bundleRedistributionAllowed) {
        issues.push({
          code: 'include-rights-not-granted',
          message: `Bundled asset ${decision.path} needs commercial use and bundled redistribution rights.`,
          assetPath: decision.path,
        });
      }
    }
  }

  return issues;
}

/** Apply recorded decisions to the manifest so the package build and the publish gate read the same truth. */
export function applyAssetRightsToManifest<T extends { assets: ManifestAssetEntry[] }>(
  manifest: T,
  decisions: readonly AssetRightsDecision[],
): T {
  const decisionByPath = new Map(decisions.map((decision) => [decision.path, decision]));
  return {
    ...manifest,
    assets: manifest.assets.map((asset) => {
      const decision = decisionByPath.get(asset.path);
      if (!decision) return asset;
      if (decision.decision === 'include') {
        return { ...asset, licenseClass: 'redistributable' as const };
      }
      return { ...asset, licenseClass: decision.buyerSupplied ? ('buyer-supplied' as const) : ('reference-only' as const) };
    }),
  };
}

export type ReviewVerdict = 'pass' | 'fail';
export interface ReviewVerdicts {
  design: ReviewVerdict;
  asset: ReviewVerdict;
  security: ReviewVerdict;
  build: ReviewVerdict;
  a11y: ReviewVerdict;
  mobile: ReviewVerdict;
}

export interface ReviewIssue {
  code: 'undecided-asset' | 'invalid-verdict';
  message: string;
}

/**
 * An asset verdict of 'pass' is only honest when every manifest asset has a
 * recorded decision: bundled assets cleared for redistribution, everything
 * else excluded from the package.
 */
export function validateReviewVerdicts(
  manifestAssets: readonly ManifestAssetEntry[],
  verdicts: ReviewVerdicts,
): ReviewIssue[] {
  const issues: ReviewIssue[] = [];
  for (const [key, value] of Object.entries(verdicts)) {
    if (value !== 'pass' && value !== 'fail') {
      issues.push({ code: 'invalid-verdict', message: `Verdict ${key} must be pass or fail.` });
    }
  }
  if (verdicts.asset === 'pass') {
    const undecided = manifestAssets.filter((asset) => asset.licenseClass === 'reference-only');
    for (const asset of undecided) {
      issues.push({
        code: 'undecided-asset',
        message: `Asset ${asset.path} has no recorded rights decision.`,
      });
    }
  }
  return issues;
}
