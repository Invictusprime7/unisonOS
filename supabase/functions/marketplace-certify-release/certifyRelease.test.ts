import { assertEquals, assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  applyAssetRightsToManifest,
  validateAssetRightsDecisions,
  validateReviewVerdicts,
  type AssetRightsDecision,
  type ManifestAssetEntry,
} from './certifyRelease.ts';

const manifestAssets: ManifestAssetEntry[] = [
  { path: 'https://cdn.example.test/hero.webp', sha256: 'a'.repeat(64), licenseClass: 'reference-only' },
  { path: '/assets/logo.svg', sha256: 'b'.repeat(64), licenseClass: 'reference-only' },
];

const includeDecision: AssetRightsDecision = {
  path: 'https://cdn.example.test/hero.webp',
  sha256: 'a'.repeat(64),
  decision: 'include',
  license: 'CC0',
  evidenceSource: 'https://licenses.example.test/hero',
  commercialUseAllowed: true,
  bundleRedistributionAllowed: true,
};

Deno.test('rights decisions must match a manifest asset and its fingerprint', () => {
  const issues = validateAssetRightsDecisions(manifestAssets, [
    { ...includeDecision, path: 'https://cdn.example.test/unknown.webp' },
    { ...includeDecision, sha256: 'c'.repeat(64) },
  ]);
  assertEquals(issues.map((issue) => issue.code), ['asset-not-in-manifest', 'asset-hash-mismatch']);
});

Deno.test('included assets require license, evidence, and both rights', () => {
  const issues = validateAssetRightsDecisions(manifestAssets, [
    { ...includeDecision, license: ' ', evidenceSource: '', bundleRedistributionAllowed: false },
  ]);
  assertEquals(issues.map((issue) => issue.code), [
    'include-missing-license',
    'include-missing-evidence',
    'include-rights-not-granted',
  ]);
});

Deno.test('applying decisions marks included assets redistributable and excluded ones buyer-supplied', () => {
  const manifest = applyAssetRightsToManifest({ assets: manifestAssets }, [
    includeDecision,
    { ...includeDecision, path: '/assets/logo.svg', sha256: 'b'.repeat(64), decision: 'exclude', buyerSupplied: true },
  ]);
  assertEquals(manifest.assets[0].licenseClass, 'redistributable');
  assertEquals(manifest.assets[1].licenseClass, 'buyer-supplied');
});

Deno.test('an asset pass verdict is refused while any asset lacks a decision', () => {
  const verdicts = { design: 'pass', asset: 'pass', security: 'pass', build: 'pass', a11y: 'pass', mobile: 'pass' } as const;
  const blocked = validateReviewVerdicts(manifestAssets, verdicts);
  assert(blocked.some((issue) => issue.code === 'undecided-asset'));

  const decided = applyAssetRightsToManifest({ assets: manifestAssets }, [
    includeDecision,
    { ...includeDecision, path: '/assets/logo.svg', sha256: 'b'.repeat(64), decision: 'exclude' },
  ]);
  assertEquals(validateReviewVerdicts(decided.assets, verdicts), []);
});
