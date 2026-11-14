/**
 * Public-write gate for visitor-facing endpoints (lead capture, newsletter,
 * automations, checkout). A business may receive anonymous writes only once
 * it has a live published site; otherwise the caller must be a signed-in
 * member of that business (Builder preview and staff tools).
 */
import { verifyAuth, verifyBusinessAccess } from "./auth.ts";

// deno-lint-ignore no-explicit-any
type AdminClient = any;

export async function businessHasPublishedSite(
  admin: AdminClient,
  businessId: string,
  projectId?: string | null,
): Promise<boolean> {
  let query = admin
    .from("projects")
    .select("id")
    .eq("business_id", businessId)
    .eq("publish_status", "published")
    .not("active_published_revision_id", "is", null);
  // When the visitor names the site they are on, that exact site must be a
  // live published site of this business — not just any of its sites.
  if (projectId) query = query.eq("id", projectId);
  const { data, error } = await query.limit(1);
  return !error && Array.isArray(data) && data.length > 0;
}

export async function callerIsBusinessMember(req: Request, businessId: string): Promise<boolean> {
  if (!req.headers.get("authorization")?.startsWith("Bearer ")) return false;
  const auth = await verifyAuth(req);
  if (!auth.user) return false;
  const access = await verifyBusinessAccess(auth.user.id, businessId);
  return access.allowed;
}

/** True when this request may write public visitor data for `businessId`. */
export async function publicBusinessWriteAllowed(
  admin: AdminClient,
  req: Request,
  businessId: string,
  projectId?: string | null,
): Promise<boolean> {
  if (!businessId) return false;
  if (await businessHasPublishedSite(admin, businessId, projectId)) return true;
  return await callerIsBusinessMember(req, businessId);
}

const SITE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * True when `siteId` (a generated site id or its project id) is a live
 * published site that belongs to `businessId`.
 */
export async function siteIsPublishedForBusiness(
  admin: AdminClient,
  businessId: string,
  siteId: string,
): Promise<boolean> {
  if (!SITE_UUID.test(siteId)) return false;
  const { data, error } = await admin
    .from("projects")
    .select("id")
    .eq("business_id", businessId)
    .eq("publish_status", "published")
    .not("active_published_revision_id", "is", null)
    .or(`site_id.eq.${siteId},id.eq.${siteId}`)
    .limit(1);
  return !error && Array.isArray(data) && data.length > 0;
}

/**
 * Site-bound public-write gate. Anonymous visitors must name the published
 * site they are submitting from, and that site must belong to the business
 * the submission is for; a business id alone never authorizes a write.
 * Signed-in business members (Builder preview, staff tools) are allowed.
 */
export async function publicSiteWriteAllowed(
  admin: AdminClient,
  req: Request,
  businessId: string,
  siteId?: string | null,
): Promise<boolean> {
  if (!businessId) return false;
  if (siteId && await siteIsPublishedForBusiness(admin, businessId, siteId)) return true;
  return await callerIsBusinessMember(req, businessId);
}
