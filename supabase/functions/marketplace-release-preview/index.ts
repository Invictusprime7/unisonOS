/**
 * Public preview for published marketplace releases.
 *
 * Anyone may read the preview of a listing that is published AND whose
 * current release is published. Files come from the release's sealed
 * revision with every non-redistributable asset rewritten to the same
 * neutral placeholder buyers receive, so the preview never exposes
 * restricted media, snapshots, package paths or creator identity.
 */
import { serve } from 'serve';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';
import { getServiceRoleClient } from '../_shared/auth.ts';
import { safeParseBody } from '../_shared/validate.ts';
import { buildReleasePackageFiles } from '../marketplace-stage-release/releaseStaging.ts';

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

serve(async (req) => {
  const cors = getCorsHeaders(req);
  const preflight = handleCorsPreflightRequest(req, cors);
  if (preflight) return preflight;
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' },
  });
  if (req.method !== 'POST') return json({ success: false, error: 'Method not allowed.' }, 405);

  const parsed = await safeParseBody<Record<string, unknown>>(req);
  const body = (parsed && 'data' in parsed ? parsed.data : parsed) as Record<string, unknown> | null;
  const slug = String(body?.slug ?? '');
  if (!SLUG_RE.test(slug) || slug.length > 120) return json({ success: false, error: 'A valid slug is required.' }, 400);

  const admin = getServiceRoleClient();
  const { data: listing } = await admin
    .from('marketplace_listings')
    .select('id, status, current_release_id')
    .eq('slug', slug)
    .maybeSingle();
  if (!listing || listing.status !== 'published' || !listing.current_release_id) {
    return json({ success: false, error: 'Preview unavailable for this listing.' }, 404);
  }

  const { data: release } = await admin
    .from('marketplace_releases')
    .select('id, listing_id, status, version, manifest_json, snapshot_path')
    .eq('id', listing.current_release_id)
    .maybeSingle();
  if (!release || release.listing_id !== listing.id || release.status !== 'published') {
    return json({ success: false, error: 'Preview unavailable for this listing.' }, 404);
  }

  const revisionId = String(release.snapshot_path ?? '').replace(/^site_revisions\//, '');
  const { data: revision } = await admin
    .from('site_revisions')
    .select('site_bundle_snapshot')
    .eq('id', revisionId)
    .maybeSingle();
  const snapshot = revision?.site_bundle_snapshot as { vfsFiles?: Record<string, unknown> } | null;
  if (!snapshot?.vfsFiles || typeof snapshot.vfsFiles !== 'object') {
    return json({ success: false, error: 'Preview unavailable for this listing.' }, 404);
  }

  const manifest = (release.manifest_json ?? {}) as {
    assets?: Array<{ path: string; licenseClass: string }>;
    pageRoles?: string[];
    design?: { artDirectionPackId?: string };
    requirements?: { capabilityIds?: string[] };
  };
  const assets = Array.isArray(manifest.assets) ? manifest.assets : [];
  const excludedRefs = assets
    .filter((a) => a.licenseClass !== 'redistributable' && a.licenseClass !== 'owned')
    .map((a) => a.path);
  const { files } = buildReleasePackageFiles(snapshot.vfsFiles, excludedRefs);

  const previewFiles: Record<string, string> = {};
  for (const [path, contents] of Object.entries(files)) {
    if (/^\/?(\.env|supabase\/)/.test(path)) continue;
    previewFiles[path.startsWith('/') ? path : `/${path}`] = contents;
  }

  return json({
    success: true,
    version: release.version,
    files: previewFiles,
    details: {
      pageRoles: Array.isArray(manifest.pageRoles) ? manifest.pageRoles : [],
      artDirectionPackId: manifest.design?.artDirectionPackId ?? null,
      capabilityIds: manifest.requirements?.capabilityIds ?? [],
      assetCount: assets.length,
      placeholderAssetCount: excludedRefs.length,
      fileCount: Object.keys(previewFiles).length,
    },
  });
});
