/**
 * R6-P1 trusted release certification.
 *
 * Admin-only companion to marketplace-stage-release. Three actions:
 *  - recordAssetRights: record a per-asset include/exclude decision with
 *    license evidence; updates the in-review manifest so the package build
 *    and the publish gate read the same truth.
 *  - recordReview: insert an immutable six-verdict staff review. An asset
 *    'pass' is refused while any manifest asset lacks a recorded decision.
 *  - buildPackage: build the private ZIP from the sealed revision, rewriting
 *    excluded assets to a neutral placeholder, upload it to private storage,
 *    and attach the immutable artifact row to an existing review.
 *
 * It never publishes: the database certification trigger requires an all-pass
 * admin review plus a matching private artifact before status 'published'.
 */
import { serve } from 'serve';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — npm specifier resolved by the edge runtime
import JSZip from 'npm:jszip@3.10.1';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';
import { authError, getServiceRoleClient, verifyAuth } from '../_shared/auth.ts';
import { isValidUUID, safeParseBody } from '../_shared/validate.ts';
import {
  buildReleasePackageFiles,
  sha256Bytes,
  sha256StableJson,
} from '../marketplace-stage-release/releaseStaging.ts';
import {
  applyAssetRightsToManifest,
  validateAssetRightsDecisions,
  validateReviewVerdicts,
  type AssetRightsDecision,
  type ManifestAssetEntry,
  type ReviewVerdicts,
} from './certifyRelease.ts';

type Json = Record<string, unknown>;

const PACKAGE_BUCKET = 'marketplace-releases';

async function requireAdmin(userId: string): Promise<string | null> {
  const admin = getServiceRoleClient();
  const { data: isAdmin, error } = await admin.rpc('has_role', { _user_id: userId, _role: 'admin' });
  if (error) return 'Reviewer role could not be verified.';
  if (isAdmin !== true) return 'Only Unison staff reviewers can certify marketplace releases.';
  return null;
}

async function loadRelease(releaseId: string) {
  const admin = getServiceRoleClient();
  const { data, error } = await admin
    .from('marketplace_releases')
    .select('id, listing_id, version, status, manifest_json, snapshot_path, snapshot_sha256')
    .eq('id', releaseId)
    .maybeSingle();
  if (error) return { error: 'Release could not be read.' as const };
  if (!data) return { error: 'Release not found.' as const };
  return { release: data };
}

async function recordAssetRights(body: Json, reviewerId: string) {
  const releaseId = String(body.releaseId ?? '');
  if (!isValidUUID(releaseId)) return { status: 400, body: { success: false, error: 'A valid releaseId is required.' } };
  const decisions = Array.isArray(body.decisions) ? (body.decisions as AssetRightsDecision[]) : null;
  if (!decisions || decisions.length === 0) {
    return { status: 400, body: { success: false, error: 'At least one asset decision is required.' } };
  }

  const loaded = await loadRelease(releaseId);
  if ('error' in loaded) return { status: 404, body: { success: false, error: loaded.error } };
  const { release } = loaded;
  if (release.status !== 'in_review' && release.status !== 'draft') {
    return { status: 409, body: { success: false, error: 'Asset rights can only change while the release is in review.' } };
  }

  const manifest = release.manifest_json as { assets?: ManifestAssetEntry[] };
  const manifestAssets = Array.isArray(manifest?.assets) ? manifest.assets : [];
  const issues = validateAssetRightsDecisions(manifestAssets, decisions);
  if (issues.length > 0) return { status: 422, body: { success: false, error: 'Asset rights decisions were rejected.', issues } };

  const admin = getServiceRoleClient();
  for (const decision of decisions) {
    const { error } = await admin.from('marketplace_asset_rights').upsert({
      asset_sha256: decision.sha256.toLowerCase(),
      asset_source: decision.path,
      license: decision.decision === 'include' ? decision.license.trim() : 'Not redistributed',
      evidence_ref: decision.decision === 'include' ? decision.evidenceSource.trim() : 'excluded-from-release',
      commercial_use: decision.decision === 'include' && decision.commercialUseAllowed,
      bundled_redistribution: decision.decision === 'include' && decision.bundleRedistributionAllowed,
      reviewer_user_id: reviewerId,
    }, { onConflict: 'asset_sha256' });
    if (error) return { status: 500, body: { success: false, error: 'Asset rights could not be recorded.' } };
  }

  const updatedManifest = applyAssetRightsToManifest(manifest as { assets: ManifestAssetEntry[] }, decisions);
  const { error: updateError } = await admin
    .from('marketplace_releases')
    .update({ manifest_json: updatedManifest })
    .eq('id', releaseId)
    .in('status', ['draft', 'in_review']);
  if (updateError) return { status: 500, body: { success: false, error: 'Release manifest could not be updated.' } };

  return { status: 200, body: { success: true, releaseId, decided: decisions.length } };
}

async function recordReview(body: Json, reviewerId: string) {
  const releaseId = String(body.releaseId ?? '');
  if (!isValidUUID(releaseId)) return { status: 400, body: { success: false, error: 'A valid releaseId is required.' } };
  const verdicts = body.verdicts as ReviewVerdicts | undefined;
  if (!verdicts || typeof verdicts !== 'object') {
    return { status: 400, body: { success: false, error: 'All six review verdicts are required.' } };
  }
  const evidenceRefs = Array.isArray(body.evidenceRefs) ? body.evidenceRefs.map(String) : [];

  const loaded = await loadRelease(releaseId);
  if ('error' in loaded) return { status: 404, body: { success: false, error: loaded.error } };
  const { release } = loaded;
  if (release.status !== 'in_review') {
    return { status: 409, body: { success: false, error: 'Reviews can only be recorded while the release is in review.' } };
  }

  const manifest = release.manifest_json as { assets?: ManifestAssetEntry[]; source?: { acceptedRevisionId?: string } };
  const issues = validateReviewVerdicts(Array.isArray(manifest?.assets) ? manifest.assets : [], verdicts);
  if (issues.length > 0) return { status: 422, body: { success: false, error: 'Review verdicts were rejected.', issues } };

  const admin = getServiceRoleClient();
  const { data: review, error } = await admin
    .from('marketplace_release_reviews')
    .insert({
      release_id: releaseId,
      accepted_revision_id: String(manifest?.source?.acceptedRevisionId ?? ''),
      snapshot_sha256: String(release.snapshot_sha256 ?? ''),
      reviewer_user_id: reviewerId,
      evidence_refs: evidenceRefs,
      design_verdict: verdicts.design,
      asset_verdict: verdicts.asset,
      security_verdict: verdicts.security,
      build_verdict: verdicts.build,
      a11y_verdict: verdicts.a11y,
      mobile_verdict: verdicts.mobile,
    })
    .select('id')
    .single();
  if (error || !review) return { status: 500, body: { success: false, error: 'Review could not be recorded.' } };

  return { status: 200, body: { success: true, releaseId, reviewId: review.id } };
}

async function buildPackage(body: Json) {
  const releaseId = String(body.releaseId ?? '');
  const reviewId = String(body.reviewId ?? '');
  if (!isValidUUID(releaseId) || !isValidUUID(reviewId)) {
    return { status: 400, body: { success: false, error: 'Valid releaseId and reviewId are required.' } };
  }

  const loaded = await loadRelease(releaseId);
  if ('error' in loaded) return { status: 404, body: { success: false, error: loaded.error } };
  const { release } = loaded;

  const admin = getServiceRoleClient();
  const { data: review } = await admin
    .from('marketplace_release_reviews')
    .select('id, release_id, revoked_at')
    .eq('id', reviewId)
    .maybeSingle();
  if (!review || review.release_id !== releaseId || review.revoked_at) {
    return { status: 409, body: { success: false, error: 'The package must attach to an active review of this release.' } };
  }

  const revisionId = String(release.snapshot_path ?? '').replace(/^site_revisions\//, '');
  const { data: revision } = await admin
    .from('site_revisions')
    .select('id, site_bundle_snapshot')
    .eq('id', revisionId)
    .maybeSingle();
  const snapshot = revision?.site_bundle_snapshot as { vfsFiles?: Record<string, unknown> } | null;
  if (!snapshot?.vfsFiles || typeof snapshot.vfsFiles !== 'object') {
    return { status: 409, body: { success: false, error: 'The sealed revision snapshot is unavailable.' } };
  }

  const manifest = release.manifest_json as { assets?: ManifestAssetEntry[] };
  const excludedRefs = (Array.isArray(manifest?.assets) ? manifest.assets : [])
    .filter((asset) => asset.licenseClass !== 'redistributable' && asset.licenseClass !== 'owned')
    .map((asset) => asset.path);
  const { files, rewrittenRefs } = buildReleasePackageFiles(snapshot.vfsFiles, excludedRefs);

  const zip = new JSZip();
  for (const [path, contents] of Object.entries(files)) {
    zip.file(path.replace(/^\//, ''), contents);
  }
  const zipBytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
  const packageSha256 = await sha256Bytes(zipBytes);
  const previewArtifactSha256 = await sha256StableJson(Object.keys(files).sort());
  const storagePath = `${releaseId}/package.zip`;
  const storageKey = `${PACKAGE_BUCKET}/${storagePath}`;

  await admin.storage.createBucket(PACKAGE_BUCKET, { public: false }).catch(() => undefined);
  const { error: uploadError } = await admin.storage
    .from(PACKAGE_BUCKET)
    .upload(storagePath, zipBytes, { contentType: 'application/zip', upsert: true });
  if (uploadError) return { status: 500, body: { success: false, error: 'Package could not be stored.' } };

  const { error: artifactError } = await admin.from('marketplace_release_artifacts').insert({
    release_id: releaseId,
    storage_key: storageKey,
    package_sha256: packageSha256,
    size_bytes: zipBytes.byteLength,
    build_report: { fileCount: Object.keys(files).length, rewrittenRefs },
    preview_artifact_sha256: previewArtifactSha256,
    review_id: reviewId,
  });
  if (artifactError) {
    return { status: 409, body: { success: false, error: 'A package artifact already exists for this release.' } };
  }

  const { error: pathError } = await admin
    .from('marketplace_releases')
    .update({ package_path: storageKey })
    .eq('id', releaseId);
  if (pathError) return { status: 500, body: { success: false, error: 'Release package path could not be recorded.' } };

  return {
    status: 200,
    body: { success: true, releaseId, reviewId, storageKey, packageSha256, sizeBytes: zipBytes.byteLength, rewrittenRefs },
  };
}

serve(async (req) => {
  const cors = getCorsHeaders(req);
  const preflight = handleCorsPreflightRequest(req, cors);
  if (preflight) return preflight;
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
  if (req.method !== 'POST') return json({ success: false, error: 'Method not allowed.' }, 405);

  const auth = await verifyAuth(req);
  if (!auth.user) return authError(auth.error ?? 'Please sign in.', auth.status, cors);
  const adminError = await requireAdmin(auth.user.id);
  if (adminError) return json({ success: false, error: adminError }, 403);

  const parsed = await safeParseBody<Json>(req);
  const body = (parsed && 'data' in parsed ? parsed.data : parsed) as Json | null;
  const action = String(body?.action ?? '');

  const result = action === 'recordAssetRights'
    ? await recordAssetRights(body ?? {}, auth.user.id)
    : action === 'recordReview'
      ? await recordReview(body ?? {}, auth.user.id)
      : action === 'buildPackage'
        ? await buildPackage(body ?? {})
        : { status: 400, body: { success: false, error: 'Unknown action.' } };

  return json(result.body, result.status);
});
