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
