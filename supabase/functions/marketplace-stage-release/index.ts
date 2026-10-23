/**
 * R6-P1 trusted release staging.
 *
 * Admin-only. Reads the project's newest committed, sealed revision with the
 * service role (never trusting browser-supplied snapshots or hashes), computes
 * the canonical snapshot SHA-256, runs a high-confidence secret scan, and
 * records a draft listing plus an `in_review` release. It never publishes:
 * publication is gated by the database certification trigger, which requires
 * an all-pass admin review and a private artifact.
 */
import { serve } from 'serve';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';
import { authError, getServiceRoleClient, verifyAuth } from '../_shared/auth.ts';
import { isValidUUID, safeParseBody } from '../_shared/validate.ts';
import { buildDesignOnlyManifest, scanSnapshotForSecrets, sha256StableJson, slugifyListing } from './releaseStaging.ts';

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

  const parsed = await safeParseBody<Record<string, unknown>>(req);
  const body = (parsed && 'data' in parsed ? parsed.data : parsed) as Record<string, unknown> | null;
  const projectId = String(body?.projectId ?? '');
  if (!isValidUUID(projectId)) return json({ success: false, error: 'A valid projectId is required.' }, 400);

  const admin = getServiceRoleClient();
  const { data: isAdmin, error: roleError } = await admin.rpc('has_role', { _user_id: auth.user.id, _role: 'admin' });
  if (roleError) return json({ success: false, error: 'Reviewer role could not be verified.' }, 503);
  if (isAdmin !== true) return json({ success: false, error: 'Only Unison staff reviewers can stage marketplace releases.' }, 403);

  const { data: project, error: projectError } = await admin
    .from('projects')
    .select('id, name, owner_id, business_id')
    .eq('id', projectId)
    .maybeSingle();
  if (projectError) return json({ success: false, error: 'Project could not be read.' }, 500);
  if (!project || typeof project.business_id !== 'string') {
    return json({ success: false, error: 'Project not found or has no canonical business.' }, 404);
  }

  const { data: business } = await admin
    .from('businesses')
    .select('industry')
    .eq('id', project.business_id)
    .maybeSingle();

  const { data: revision, error: revisionError } = await admin
    .from('site_revisions')
    .select('id, project_id, business_id, status, site_bundle_snapshot')
    .eq('project_id', projectId)
    .eq('status', 'committed')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (revisionError) return json({ success: false, error: 'Accepted revision could not be read.' }, 500);
  if (!revision || typeof revision.id !== "string" || revision.business_id !== project.business_id) {
    return json({ success: false, error: 'Project has no accepted committed revision for its business.' }, 409);
  }
  const snapshot = revision.site_bundle_snapshot as Record<string, unknown> | null;
  const meta = (snapshot?.meta ?? {}) as Record<string, any>;
  if (!snapshot || typeof snapshot.vfsFiles !== 'object' || !meta?.seal?.version) {
    return json({ success: false, error: 'Accepted revision is missing a sealed site snapshot.' }, 409);
  }

  const secretFindings = scanSnapshotForSecrets(snapshot.vfsFiles as Record<string, unknown>);
  if (secretFindings.length > 0) {
    return json({ success: false, error: 'Release source contains secrets or private credentials.', findings: secretFindings }, 422);
  }

  const snapshotSha256 = await sha256StableJson(snapshot);
  const industryKey = typeof business?.industry === 'string' && business.industry.trim() ? business.industry : 'general';
  const manifest = buildDesignOnlyManifest({ revisionId: revision.id, snapshotSha256, industryKey, meta });
  const slug = slugifyListing(String(project.name ?? 'template'), projectId);

  const { data: existing } = await admin
    .from('marketplace_listings')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();
  let listingId = existing?.id as string | undefined;
  if (!listingId) {
    const { data: listing, error: listingError } = await admin
      .from('marketplace_listings')
      .insert({
        slug,
        creator_user_id: auth.user.id,
        product_type: 'site_template',
        title: String(project.name ?? 'Untitled template'),
        industry_key: industryKey,
        summary: 'Design-only site template. Bookings and checkout are not included.',
        status: 'draft',
        price_cents: 0,
      })
      .select('id')
      .single();
    if (listingError || !listing) return json({ success: false, error: listingError?.message ?? 'Listing could not be created.' }, 500);
    listingId = listing.id as string;
  }

  const { data: release, error: releaseError } = await admin
    .from('marketplace_releases')
    .insert({
      listing_id: listingId,
      version: `r-${revision.id.slice(0, 8)}`,
      manifest_json: manifest,
      snapshot_path: `site_revisions/${revision.id}`,
      snapshot_sha256: snapshotSha256,
      status: 'in_review',
    })
    .select('id, version, status')
    .single();
  if (releaseError || !release) {
    const duplicate = releaseError?.code === '23505';
    return json({ success: false, error: duplicate ? 'This accepted revision is already staged.' : (releaseError?.message ?? 'Release could not be staged.') }, duplicate ? 409 : 500);
  }

  return json({
    success: true,
    listingId,
    slug,
    releaseId: release.id,
    version: release.version,
    status: release.status,
    acceptedRevisionId: revision.id,
    snapshotSha256,
    nextSteps: [
      'Record asset rights for every bundled image.',
      'Run the isolated export build and reimport, then upload the private package.',
      'Record an all-pass staff review; only then can the release be published.',
    ],
  });
});
