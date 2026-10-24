/**
 * Client access to the marketplace staging service. Calls the
 * marketplace-stage-release edge function with the signed-in user's session;
 * the service verifies the admin role server-side before staging anything.
 */
import { getSupabaseFunctionHeaders, getSupabaseFunctionUrl } from '@/integrations/supabase/supabaseFunctionRequest';

export interface MarketplaceStageResult {
  success: true;
  listingId: string;
  slug: string;
  releaseId: string;
  version: string;
  status: string;
  acceptedRevisionId: string;
  snapshotSha256: string;
}

export async function stageMarketplaceRelease(projectId: string): Promise<MarketplaceStageResult> {
  const headers = await getSupabaseFunctionHeaders();
  const response = await fetch(getSupabaseFunctionUrl('marketplace-stage-release'), {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.success !== true) {
    throw new Error(payload?.error ?? `Staging failed (${response.status}).`);
  }
  return payload as MarketplaceStageResult;
}

export interface MarketplaceAssetDecision {
  path: string;
  sha256: string;
  decision: 'include' | 'exclude';
  license: string;
  evidenceSource: string;
  commercialUseAllowed: boolean;
  bundleRedistributionAllowed: boolean;
  buyerSupplied?: boolean;
}

export interface MarketplaceReviewVerdicts {
  design: 'pass' | 'fail';
  asset: 'pass' | 'fail';
  security: 'pass' | 'fail';
  build: 'pass' | 'fail';
  a11y: 'pass' | 'fail';
  mobile: 'pass' | 'fail';
}

async function callCertifyRelease(action: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const headers = await getSupabaseFunctionHeaders();
  const response = await fetch(getSupabaseFunctionUrl('marketplace-certify-release'), {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...body }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.success !== true) {
    const issues = Array.isArray(payload?.issues) ? ` ${JSON.stringify(payload.issues)}` : '';
    throw new Error(`${payload?.error ?? `Certification failed (${response.status}).`}${issues}`);
  }
  return payload as Record<string, unknown>;
}

/** Record per-asset include/exclude decisions with license evidence (staff reviewers only). */
export async function recordMarketplaceAssetRights(
  releaseId: string,
  decisions: readonly MarketplaceAssetDecision[],
): Promise<{ releaseId: string; decided: number }> {
  const payload = await callCertifyRelease('recordAssetRights', { releaseId, decisions });
  return { releaseId: String(payload.releaseId), decided: Number(payload.decided) };
}

/** Record the immutable six-verdict staff review for a staged release. */
export async function recordMarketplaceReview(
  releaseId: string,
  verdicts: MarketplaceReviewVerdicts,
  evidenceRefs: readonly string[] = [],
): Promise<{ releaseId: string; reviewId: string }> {
  const payload = await callCertifyRelease('recordReview', { releaseId, verdicts, evidenceRefs });
  return { releaseId: String(payload.releaseId), reviewId: String(payload.reviewId) };
}

/** Build the private template package from the sealed revision and attach it to a review. */
export async function buildMarketplacePackage(
  releaseId: string,
  reviewId: string,
): Promise<{ storageKey: string; packageSha256: string; sizeBytes: number; rewrittenRefs: string[] }> {
  const payload = await callCertifyRelease('buildPackage', { releaseId, reviewId });
  return {
    storageKey: String(payload.storageKey),
    packageSha256: String(payload.packageSha256),
    sizeBytes: Number(payload.sizeBytes),
    rewrittenRefs: Array.isArray(payload.rewrittenRefs) ? payload.rewrittenRefs.map(String) : [],
  };
}

/** Certify and publish a staged release in one step; unverified assets ship as buyer-supplied placeholders. */
export async function autoReleaseMarketplaceRelease(releaseId: string): Promise<{ releaseId: string; status: string }> {
  const payload = await callCertifyRelease('autoRelease', { releaseId });
  return { releaseId: String(payload.releaseId), status: String(payload.status) };
}

export interface MarketplaceReleasePreview {
  success: true;
  version: string;
  files: Record<string, string>;
  details: {
    pageRoles: string[];
    artDirectionPackId: string | null;
    capabilityIds: string[];
    assetCount: number;
    placeholderAssetCount: number;
    fileCount: number;
  };
}

/** Public: loads the placeholder-safe preview of a published listing. */
export async function loadMarketplaceReleasePreview(slug: string): Promise<MarketplaceReleasePreview> {
  const headers = await getSupabaseFunctionHeaders();
  const response = await fetch(getSupabaseFunctionUrl('marketplace-release-preview'), {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.success !== true) {
    throw new Error(payload?.error ?? `Preview unavailable (${response.status}).`);
  }
  return payload as MarketplaceReleasePreview;
}
