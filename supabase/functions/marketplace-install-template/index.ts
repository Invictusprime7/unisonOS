import { serve } from 'serve';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';
import { verifyAuth, getServiceRoleClient } from '../_shared/auth.ts';
import { safeParseBody, isValidUUID } from '../_shared/validate.ts';
import { canClaimRelease } from './installPolicy.ts';

serve(async req => {
  const cors = getCorsHeaders(req);
  const preflight = handleCorsPreflightRequest(req, cors);
  if (preflight) return preflight;
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  if (req.method !== 'POST') return json({ success: false, error: 'Method not allowed.' }, 405);
  const auth = await verifyAuth(req);
  if (!auth.user) return json({ success: false, error: 'Sign in before installing a template draft.' }, auth.status);
  const parsed = await safeParseBody<Record<string, unknown>>(req);
  const body = (parsed && 'data' in parsed ? parsed.data : parsed) as Record<string, unknown> | null;
  const admin = getServiceRoleClient();
  const buyer = auth.user.id;
  try {
    if (body?.action === 'complete') {
      const { installationId, projectId, draftId, revisionId } = body;
      if (![installationId, projectId, draftId, revisionId].every(v => typeof v === 'string' && isValidUUID(v))) return json({ success: false, error: 'Valid saved draft identifiers are required.' }, 400);
      const { data: revision } = await admin.from('site_revisions').select('id, project_id, draft_id, business_id, status').eq('id', revisionId).eq('project_id', projectId).eq('draft_id', draftId).eq('status', 'committed').maybeSingle();
      const { data: draft } = await admin.from('builder_drafts').select('id, user_id, site_id, last_revision_id').eq('id', draftId).eq('user_id', buyer).maybeSingle();
      if (!revision || !draft?.site_id || draft.last_revision_id !== revisionId) return json({ success: false, error: 'A saved draft owned by your account is required.' }, 403);
      const { data, error } = await admin.from('marketplace_installations').update({ status: 'committed', project_id: projectId, site_id: draft.site_id, business_id: revision.business_id, updated_at: new Date().toISOString() }).eq('id', installationId).eq('buyer_user_id', buyer).eq('status', 'pending').select('id').maybeSingle();
      if (error || !data) return json({ success: false, error: 'Installation receipt could not be recorded.' }, 409);
      return json({ success: true });
    }
    const slug = String(body?.slug ?? '');
    const key = String(body?.idempotencyKey ?? '');
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || !isValidUUID(key)) return json({ success: false, error: 'Valid template and request identifiers are required.' }, 400);
    const { data: listing } = await admin.from('marketplace_listings').select('id, status, current_release_id, price_cents').eq('slug', slug).eq('status', 'published').maybeSingle();
    if (!listing?.current_release_id) return json({ success: false, error: 'Template is no longer published.' }, 404);
    const { data: release } = await admin.from('marketplace_releases').select('id, listing_id, status').eq('id', listing.current_release_id).eq('status', 'published').maybeSingle();
    if (!release || release.listing_id !== listing.id) return json({ success: false, error: 'The published release is unavailable.' }, 409);
    const { data: artifact } = await admin.from('marketplace_release_artifacts').select('storage_key, review_id').eq('release_id', release.id).maybeSingle();
    const { data: review } = artifact ? await admin.from('marketplace_release_reviews').select('id, revoked_at').eq('id', artifact.review_id).eq('release_id', release.id).maybeSingle() : { data: null };
    if (!artifact || !review || review.revoked_at) return json({ success: false, error: 'This template package is unavailable.' }, 409);
    const { data: owned } = await admin.from('marketplace_entitlements').select('id').eq('buyer_user_id', buyer).eq('release_id', release.id).eq('status', 'active').limit(1).maybeSingle();
    if (!canClaimRelease(Number(listing.price_cents), !!owned)) return json({ success: false, error: 'Purchase this template before installing it. Checkout is not available yet.' }, 402);
    let entitlement = owned;
    if (!entitlement) {
      const grantKey = `free-claim:${buyer}:${release.id}`;
      const { data, error } = await admin.from('marketplace_entitlements').insert({ buyer_user_id: buyer, listing_id: listing.id, release_id: release.id, license_tier: 'personal', grant_source: 'free_claim', grant_key: grantKey }).select('id').single();
      if (error) {
        const { data: existing } = await admin.from('marketplace_entitlements').select('id').eq('grant_key', grantKey).eq('buyer_user_id', buyer).eq('status', 'active').maybeSingle();
        entitlement = existing;
      } else entitlement = data;
    }
    if (!entitlement) return json({ success: false, error: 'The template license could not be granted.' }, 409);
    const { data: installation, error } = await admin.from('marketplace_installations').upsert({ buyer_user_id: buyer, entitlement_id: entitlement.id, release_id: release.id, idempotency_key: key, status: 'pending' }, { onConflict: 'buyer_user_id,idempotency_key', ignoreDuplicates: true }).select('id').maybeSingle();
    if (error || !installation) return json({ success: false, error: 'Installation could not be reserved.' }, 409);
    const storagePath = String(artifact.storage_key).replace(/^marketplace-releases\//, '');
    const { data: signed, error: signedError } = await admin.storage.from('marketplace-releases').createSignedUrl(storagePath, 120);
    if (signedError || !signed) return json({ success: false, error: 'The template package could not be opened.' }, 500);
    return json({ success: true, installationId: installation.id, packageUrl: signed.signedUrl });
  } catch { return json({ success: false, error: 'Template installation could not be completed.' }, 500); }
});