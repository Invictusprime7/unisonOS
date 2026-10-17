/**
 * project-backend — guidebook §27–29 gateway for sites with their own database.
 * Order: authenticate → project membership → resolve binding → decrypt secret
 * (dedicated only) → verify runtime identity → run resource command → audit.
 * Shared-legacy sites are told to use cms-records; nothing silently falls back.
 */
import { serve } from "serve";
import { createClient } from "@supabase/supabase-js";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { verifyAuth, authError } from "../_shared/auth.ts";
import { isValidUUID, safeParseBody } from "../_shared/validate.ts";
import { getCmsResourceContract } from "../_shared/catalogSurfaceSummary.ts";
import { decryptConnectedProjectSecret } from "../_shared/connectedProjectCrypto.ts";
import { applyExpectedFilters } from "../_shared/recordCompareAndSet.ts";

type Action = "list" | "get" | "create" | "update" | "delete";
const ACTIONS: Action[] = ["list", "get", "create", "update", "delete"];

/**
 * One tenant-scoped contract for every resource kind (guidebook §41–43):
 * catalog surfaces come from the canonical summary; the site profile and
 * CMS content entries are declared here against the dedicated runtime schema
 * (`site_profiles`, `content_entries`). Unknown resources are rejected cleanly.
 */
interface DedicatedContract {
  resource: string;
  sourceTable: string;
  sortField: string;
  editableFields: Record<string, string>;
  requiredFields: string[];
  /** CMS content entries are filtered by this type and store fields in `data`. */
  contentType?: string;
  /** Single-record resources resolve to the site's one row. */
  singleRecord?: boolean;
}

function contractFor(resource: string): DedicatedContract | null {
  const cms = getCmsResourceContract(resource);
  if (cms) return cms;
  if (resource === "business-profile") {
    return {
      resource,
      sourceTable: "site_profiles",
      sortField: "id",
      editableFields: {
        name: "text", tagline: "text", description: "textarea", logoUrl: "text",
        phone: "text", email: "text", website: "text", address: "json", hours: "json", socialLinks: "json",
      },
      requiredFields: ["name"],
      singleRecord: true,
    };
  }
  if (resource.startsWith("content:")) {
    return {
      resource,
      sourceTable: "content_entries",
      sortField: "created_at",
      editableFields: { title: "text", slug: "text", status: "text", data: "json" },
      requiredFields: [],
      contentType: resource.slice("content:".length),
    };
  }
  return null;
}

serve(async (req) => {
  const pre = handleCorsPreflightRequest(req);
  if (pre) return pre;
  const cors = getCorsHeaders(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

  const auth = await verifyAuth(req);
  if (!auth.user) return authError(auth.error ?? "Please sign in.", auth.status, cors);

  const parsed = await safeParseBody<Record<string, unknown>>(req);
  const body = (parsed && "data" in parsed ? parsed.data : parsed) as Record<string, unknown> | null;
  const projectId = String(body?.projectId ?? "");
  const action = body?.action as Action;
  const resource = String(body?.resource ?? "");
  if (!isValidUUID(projectId)) return json({ success: false, error: "A site is required." }, 400);
  if (!ACTIONS.includes(action)) return json({ success: false, error: "Unknown action." }, 400);
  const contract = contractFor(resource);
  if (!contract) return json({ success: false, error: "Unknown kind of saved item." }, 400);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  const { data: member } = await admin.rpc("is_project_member", { _user_id: auth.user.id, _project_id: projectId });
  if (!member) return json({ success: false, error: "You don't have access to this site." }, 403);

  const { data: project, error: projectError } = await admin.from("projects")
    .select("id,business_id,site_id")
    .eq("id", projectId)
    .maybeSingle();
  if (projectError || !project?.site_id) {
    return json({ success: false, error: "This site's project identity is unavailable." }, 404);
  }

  const { data: siteRecord, error: siteError } = await admin.from("sites")
    .select("id,business_id")
    .eq("id", project.site_id)
    .maybeSingle();
  if (siteError || !siteRecord || siteRecord.business_id !== project.business_id) {
    return json({ success: false, error: "This site's project identity is invalid." }, 409);
  }

  const { data: binding } = await admin.from("connected_supabase_projects")
    .select("id, business_id, unison_project_id, project_url, secret_key_ciphertext, provisioning_status")
    .eq("unison_project_id", projectId).neq("provisioning_status", "disconnected").maybeSingle();
  if (!binding) return json({ success: false, mode: "shared-legacy", error: "This site uses the shared database; use cms-records." }, 409);
  if (binding.business_id !== project.business_id || binding.unison_project_id !== project.id) {
    return json({ success: false, error: "This site's backend binding does not match its project." }, 409);
  }
  if (binding.provisioning_status !== "ready") return json({ success: false, error: "This site's database isn't ready yet." }, 503);

  const encKey = Deno.env.get("CONNECTED_PROJECT_TOKEN_ENCRYPTION_KEY");
  if (!encKey || !binding.secret_key_ciphertext || !binding.project_url) {
    return json({ success: false, error: "This site's own database isn't connected yet." }, 503);
  }

  let secret: string;
  try { secret = await decryptConnectedProjectSecret(binding.secret_key_ciphertext, encKey); }
  catch { return json({ success: false, error: "This site's database key could not be read." }, 500); }
  const site = createClient(binding.project_url, secret, { auth: { persistSession: false } });

  // §9 — refuse to touch a database that belongs to a different site.
  const { data: identity } = await site.from("unison_runtime_identity").select("project_id, site_id").maybeSingle();
  if (!identity || identity.project_id !== project.id || identity.site_id !== siteRecord.id) {
    return json({ success: false, error: "This site's database belongs to a different site." }, 409);
  }

  const table = contract.sourceTable;
  let recordId = body?.recordId ? String(body.recordId) : undefined;
  const values = (body?.values ?? {}) as Record<string, unknown>;
  let expected = body?.expected as Record<string, unknown> | undefined;

  // Content entries keep their field values inside a `data` jsonb column,
  // filtered by content type; the site profile is the site's single row.
  const scoped = () => {
    let q = site.from(table).select("*");
    if (contract.contentType) q = q.eq("content_type", contract.contentType);
    return q;
  };
  if (contract.singleRecord && action !== "list" && action !== "create") {
    const { data: row } = await scoped().order(contract.sortField).limit(1).maybeSingle();
    if (!row) return json({ success: false, error: "This site's profile isn't provisioned yet." }, 404);
    recordId = String((row as { id: unknown }).id);
  }

  let allowed = Object.fromEntries(Object.entries(values).filter(([k]) => k in contract.editableFields));
  if (contract.contentType) {
    const { title, slug, status, ...dataFields } = values;
    allowed = {};
    if (typeof title === "string") allowed.title = title;
    if (typeof slug === "string") allowed.slug = slug;
    if (typeof status === "string") allowed.status = status;
    if (action === "update" && recordId) {
      const { data: current, error: readError } = await scoped().eq("id", recordId).maybeSingle();
      if (readError || !current) return json({ success: false, error: "This content item is unavailable." }, 404);
      const currentData = (current as { data?: Record<string, unknown> } | null)?.data ?? {};
      const flattened = { ...currentData, ...current };
      if (expected && Object.entries(expected).some(([key, seen]) => JSON.stringify(flattened[key] ?? null) !== JSON.stringify(seen ?? null))) {
        return json({ success: false, error: "Conflict: this content changed elsewhere." }, 409);
      }
      expected = { data: currentData, title: current.title, slug: current.slug ?? null };
      allowed.data = { ...currentData, ...dataFields };
    } else {
      allowed.data = dataFields;
    }
    if (action === "create") allowed.content_type = contract.contentType;
  }

  let result: { data: unknown; error: { message: string } | null };
  if (action === "list") result = await scoped().order(contract.sortField);
  else if (!recordId && action !== "create") return json({ success: false, error: "An item is required." }, 400);
  else if (action === "get") result = await scoped().eq("id", recordId ?? "").maybeSingle();
  else if (action === "create") result = await site.from(table).insert(allowed).select().single();
  else if (action === "update") {
    let update = site.from(table).update(allowed).eq("id", recordId ?? "");
    if (contract.contentType) update = update.eq("content_type", contract.contentType);
    if (expected) {
      try { update = applyExpectedFilters(update, expected, contract.editableFields); }
      catch { return json({ success: false, error: "Invalid expected fields." }, 400); }
    }
    result = await update.select().maybeSingle();
    if (!result.error && !result.data) return json({ success: false, error: "Conflict: this item changed elsewhere or is no longer available." }, 409);
  } else {
    let remove = site.from(table).delete().eq("id", recordId ?? "");
    if (contract.contentType) remove = remove.eq("content_type", contract.contentType);
    result = await remove;
  }

  if (action !== "list" && action !== "get") {
    await admin.from("audit_logs").insert({
      user_id: auth.user.id, user_email: auth.user.email, business_id: binding.business_id,
      action: `project-backend.${action}`, resource_type: resource, resource_id: recordId ?? null,
      status: result.error ? "failed" : "success", metadata: { projectId, bindingId: binding.id },
    });
  }
  if (result.error) return json({ success: false, error: result.error.message }, 400);
  const flatten = (row: Record<string, unknown>) => contract.contentType ? { ...(row.data as Record<string, unknown> ?? {}), ...row } : row;
  return json({ success: true, data: Array.isArray(result.data) ? result.data.map(flatten) : result.data ? flatten(result.data as Record<string, unknown>) : result.data });
});
