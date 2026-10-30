import { serve } from "serve";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { errorResponse, secureJsonResponse } from "../_shared/response.ts";
import { applyExpectedFilters } from "../_shared/recordCompareAndSet.ts";
import { isValidUUID, safeParseBody } from "../_shared/validate.ts";
import {
  getCmsResourceContract,
  type CmsFieldType,
} from "../_shared/catalogSurfaceSummary.ts";

type CatalogCmsAction = "list" | "get" | "create" | "update" | "delete";
type ContentCmsAction =
  | "content-type-list"
  | "content-type-create"
  | "content-type-update"
  | "content-entry-list"
  | "content-entry-get"
  | "content-entry-create"
  | "content-entry-update"
  | "content-entry-transition"
  | "content-entry-revisions";
type CmsAction = CatalogCmsAction | ContentCmsAction;

const catalogActions: CatalogCmsAction[] = ["list", "get", "create", "update", "delete"];
const contentActions: ContentCmsAction[] = [
  "content-type-list",
  "content-type-create",
  "content-type-update",
  "content-entry-list",
  "content-entry-get",
  "content-entry-create",
  "content-entry-update",
  "content-entry-transition",
  "content-entry-revisions",
];
const contentStatuses = ["draft", "review", "published", "archived"];

interface CmsRequest {
  action: CmsAction;
  businessId: string;
  projectId?: string;
  siteId?: string;
  resource?: string;
  recordId?: string;
  values?: Record<string, unknown>;
  expected?: Record<string, unknown>;
  expectedUpdatedAt?: string;
  idempotencyKey?: string;
  contentTypeId?: string;
  status?: string;
  changeSummary?: string;
}

function jsonError(message: string, status: number, corsHeaders: Record<string, string>) {
  return errorResponse(message, status, corsHeaders);
}

/** Safe, actionable write-failure text: Postgres class + column name only, never row values. */
function describeWriteFailure(verb: string, resource: string, error: { code?: string; message?: string } | null): string {
  const base = `Could not ${verb} ${resource} record`;
  const column = error?.message?.match(/column "([a-z_]+)"/i)?.[1];
  switch (error?.code) {
    case "42703": return `${base}: the backend is missing column "${column ?? "unknown"}" (run the latest database migration).`;
    case "23502": return `${base}: required field "${column ?? "unknown"}" was empty.`;
    case "22P02": return `${base}: a value had the wrong type${column ? ` for "${column}"` : ""}.`;
    case "23505": return `${base}: a matching record already exists.`;
    case "42501": return `${base}: the backend refused permission for this table.`;
    case undefined: return `${base}: no record was returned.`;
    default: return `${base} (database error ${error.code}).`;
  }
}

function validateValues(
  values: Record<string, unknown> | undefined,
  fields: Record<string, CmsFieldType>,
  requiredFields: string[],
  action: "create" | "update",
): { values: Record<string, unknown> } | { error: string } {
  if (!values || typeof values !== "object" || Array.isArray(values)) {
    return { error: "values must be an object" };
  }

  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(values)) {
    const type = fields[key];
    if (!type) return { error: `Field "${key}" is not editable for this resource` };
    if (type === "boolean" && typeof value !== "boolean") return { error: `Field "${key}" must be boolean` };
    if (["number", "money", "money-cents", "rating"].includes(type) && (typeof value !== "number" || !Number.isFinite(value))) {
      return { error: `Field "${key}" must be a finite number` };
    }
    if (["text", "textarea", "image"].includes(type) && typeof value !== "string") {
      return { error: `Field "${key}" must be a string` };
    }
    if (type === "rating") {
      const rating = value as number;
      if (rating < 0 || rating > 5) return { error: `Field "${key}" must be between 0 and 5` };
    }
    // "number"/"money-cents" columns are Postgres integers; fractional seeds (e.g. 1.5) would fail the insert.
    cleaned[key] = type === "number" || type === "money-cents" ? Math.round(value as number) : value;
  }
  if (Object.keys(cleaned).length === 0) return { error: "At least one editable value is required" };
  if (action === "create") {
    for (const field of requiredFields) {
      const value = cleaned[field];
      if (value === undefined || value === null || (typeof value === "string" && !value.trim())) {
        return { error: `Field "${field}" is required` };
      }
    }
  }
  return { values: cleaned };
}

type ContentFieldDefinition = {
  key: string;
  type: "text" | "textarea" | "image" | "boolean" | "number";
  required?: boolean;
};

function validateContentTypeValues(values: Record<string, unknown> | undefined): { values: Record<string, unknown> } | { error: string } {
  if (!values || typeof values !== "object" || Array.isArray(values)) return { error: "values must be an object" };
  const apiKey = values.apiKey;
  const displayName = values.displayName;
  if (typeof apiKey !== "string" || !/^[a-z][a-z0-9_]{1,62}$/.test(apiKey)) return { error: "apiKey is invalid" };
  if (typeof displayName !== "string" || !displayName.trim()) return { error: "displayName is required" };
  if (values.description !== undefined && typeof values.description !== "string") return { error: "description must be a string" };
  if (values.fieldSchema !== undefined && (typeof values.fieldSchema !== "object" || !values.fieldSchema || Array.isArray(values.fieldSchema))) {
    return { error: "fieldSchema must be an object" };
  }
  if (values.workflow !== undefined && (typeof values.workflow !== "object" || !values.workflow || Array.isArray(values.workflow))) {
    return { error: "workflow must be an object" };
  }
  return { values };
}

function parseContentFields(fieldSchema: unknown): { fields: ContentFieldDefinition[] } | { error: string } {
  if (!fieldSchema || typeof fieldSchema !== "object" || Array.isArray(fieldSchema)) return { error: "Content type schema is invalid" };
  const rawFields = (fieldSchema as Record<string, unknown>).fields;
  if (!Array.isArray(rawFields)) return { error: "Content type schema must define fields" };
  const fields: ContentFieldDefinition[] = [];
  const keys = new Set<string>();
  for (const field of rawFields) {
    if (!field || typeof field !== "object" || Array.isArray(field)) return { error: "Content type has an invalid field definition" };
    const definition = field as Record<string, unknown>;
    if (typeof definition.key !== "string" || !/^[a-z][a-z0-9_]{0,62}$/.test(definition.key) || keys.has(definition.key)) {
      return { error: "Content type has an invalid or duplicate field key" };
    }
    if (!["text", "textarea", "image", "boolean", "number"].includes(String(definition.type))) {
      return { error: `Content type field "${definition.key}" has an unsupported type` };
    }
    if (definition.required !== undefined && typeof definition.required !== "boolean") return { error: `Content type field "${definition.key}" has an invalid required flag` };
    keys.add(definition.key);
    fields.push({ key: definition.key, type: definition.type as ContentFieldDefinition["type"], required: definition.required as boolean | undefined });
  }
  return { fields };
}

function validateContentEntryValues(
  values: Record<string, unknown> | undefined,
  fields: ContentFieldDefinition[],
): { title: string; slug: string | null; locale: string; data: Record<string, unknown> } | { error: string } {
  if (!values || typeof values !== "object" || Array.isArray(values)) return { error: "values must be an object" };
  const title = values.title;
  const locale = values.locale ?? "en";
  const slug = values.slug ?? null;
  const data = values.data;
  if (typeof title !== "string" || !title.trim()) return { error: "title is required" };
  if (typeof locale !== "string" || locale.length < 2 || locale.length > 35) return { error: "locale is invalid" };
  if (slug !== null && typeof slug !== "string") return { error: "slug must be a string or null" };
  if (!data || typeof data !== "object" || Array.isArray(data)) return { error: "data must be an object" };
  const cleanedData: Record<string, unknown> = {};
  const fieldsByKey = new Map(fields.map((field) => [field.key, field]));
  for (const [key, value] of Object.entries(data)) {
    const field = fieldsByKey.get(key);
    if (!field) return { error: `Data field "${key}" is not defined by this content type` };
    if (["text", "textarea", "image"].includes(field.type) && typeof value !== "string") return { error: `Data field "${key}" must be a string` };
    if (field.type === "boolean" && typeof value !== "boolean") return { error: `Data field "${key}" must be boolean` };
    if (field.type === "number" && (typeof value !== "number" || !Number.isFinite(value))) return { error: `Data field "${key}" must be a finite number` };
    cleanedData[key] = value;
  }
  for (const field of fields) {
    const value = cleanedData[field.key];
    if (field.required && (value === undefined || value === null || (typeof value === "string" && !value.trim()))) {
      return { error: `Data field "${field.key}" is required` };
    }
  }
  return { title: title.trim(), slug: slug === null ? null : slug.trim() || null, locale, data: cleanedData };
}

async function authorize(
  client: SupabaseClient,
  businessId: string,
  permission: string,
): Promise<boolean> {
  const { data, error } = await client.rpc("business_has_permission", {
    p_business_id: businessId,
    p_permission: permission,
  });
  return !error && data === true;
}

async function assertProjectScope(
  admin: SupabaseClient,
  projectId: string | undefined,
  businessId: string,
): Promise<boolean> {
  if (!projectId) return true;
  const { data, error } = await admin
    .from("projects")
    .select("business_id")
    .eq("id", projectId)
    .maybeSingle();
  return !error && data?.business_id === businessId;
}

async function resolveCmsScope(
  admin: SupabaseClient,
  input: { businessId: string; projectId?: string; siteId?: string },
): Promise<{ projectId?: string } | null> {
  if (!input.siteId) {
    if (!await assertProjectScope(admin, input.projectId, input.businessId)) return null;
    if (input.projectId) return { projectId: input.projectId };
    // Unambiguous only: a business with exactly one site. Otherwise caller must name the site.
    const { data: only } = await admin.from("projects").select("id").eq("business_id", input.businessId).limit(2);
    return { projectId: only?.length === 1 ? String(only[0].id) : undefined };
  }

  const { data: site, error: siteError } = await admin
    .from("sites")
    .select("id,business_id")
    .eq("id", input.siteId)
    .maybeSingle();
  if (siteError || !site || site.business_id !== input.businessId) return null;

  const { data: project, error: projectError } = await admin
    .from("projects")
    .select("id,business_id,site_id")
    .eq("site_id", input.siteId)
    .eq("business_id", input.businessId)
    .maybeSingle();
  if (projectError || !project || (input.projectId && project.id !== input.projectId)) return null;
  return { projectId: project.id };
}

/** Guidebook §12: project-owned rows are filtered by business + project. NULL project = shared-legacy row, read-only visible. */
function projectReadFilter(projectId: string | undefined): string {
  // Account-level callers (Business Center, post-edit checks) name no site: business scope only.
  if (!projectId) return "id.not.is.null";
  return `project_id.eq.${projectId},project_id.is.null`;
}

async function audit(admin: SupabaseClient, args: { userId: string; businessId: string; projectId?: string; siteId?: string; resource: string; action: CmsAction; recordId?: string }) {
  const { error } = await admin.from("resource_mutation_audit").insert({
    business_id: args.businessId,
    project_id: args.projectId ?? null,
    site_id: args.siteId ?? null,
    actor_id: args.userId,
    resource_key: args.resource,
    action: args.action,
    record_id: args.recordId ?? null,
    metadata: {},
  });
  if (error) {
    console.error('[cms-records] Mutation succeeded but audit insert failed', {
      businessId: args.businessId,
      projectId: args.projectId ?? null,
      resource: args.resource,
      action: args.action,
      recordId: args.recordId ?? null,
      error,
    });
  }
}

function contentPermission(action: ContentCmsAction, status?: string): string {
  if (action === "content-type-create" || action === "content-type-update") return "content.publish";
  if (action === "content-entry-transition") return status === "review" ? "content.write" : "content.publish";
  if (action === "content-entry-create" || action === "content-entry-update") return "content.write";
  return "content.read";
}

async function getContentType(admin: SupabaseClient, businessId: string, contentTypeId: string) {
  return await admin
    .from("content_types")
    .select("id,business_id,api_key,display_name,field_schema")
    .eq("id", contentTypeId)
    .eq("business_id", businessId)
    .maybeSingle();
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const preflight = handleCorsPreflightRequest(req, corsHeaders);
  if (preflight) return preflight;
  if (req.method !== "POST") return jsonError("Method not allowed", 405, corsHeaders);

  const authorization = req.headers.get("Authorization");
  if (!authorization) return jsonError("Authentication required", 401, corsHeaders);
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceRoleKey) return jsonError("CMS service is not configured", 503, corsHeaders);

  const caller = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
  const { data: userResult, error: userError } = await caller.auth.getUser();
  if (userError || !userResult.user) return jsonError("Authentication required", 401, corsHeaders);

  const { data: rawBody, error: parseError } = await safeParseBody<CmsRequest>(req, 65_536);
  if (parseError || !rawBody) return jsonError(parseError || "Invalid request body", 400, corsHeaders);
  const body = rawBody;
  const isCatalogAction = catalogActions.includes(body.action as CatalogCmsAction);
  const isContentAction = contentActions.includes(body.action as ContentCmsAction);
  if (!isCatalogAction && !isContentAction) return jsonError("Unsupported CMS action", 400, corsHeaders);
  if (!isValidUUID(body.businessId)) return jsonError("Invalid businessId", 400, corsHeaders);
  if (body.projectId && !isValidUUID(body.projectId)) return jsonError("Invalid projectId", 400, corsHeaders);
  if (body.siteId && !isValidUUID(body.siteId)) return jsonError("Invalid siteId", 400, corsHeaders);
  if (body.expectedUpdatedAt !== undefined && !Number.isFinite(Date.parse(body.expectedUpdatedAt))) {
    return jsonError("Invalid expectedUpdatedAt", 400, corsHeaders);
  }
  if (body.idempotencyKey !== undefined && !isValidUUID(body.idempotencyKey)) return jsonError("Invalid idempotencyKey", 400, corsHeaders);
  if (body.contentTypeId && !isValidUUID(body.contentTypeId)) return jsonError("Invalid contentTypeId", 400, corsHeaders);
  if (["get", "update", "delete", "content-entry-get", "content-entry-update", "content-entry-transition", "content-entry-revisions"].includes(body.action) && !isValidUUID(body.recordId)) {
    return jsonError("Invalid recordId", 400, corsHeaders);
  }
  if (["content-type-update", "content-entry-create"].includes(body.action) && !body.contentTypeId) {
    return jsonError("Invalid contentTypeId", 400, corsHeaders);
  }
  const admin = createClient(url, serviceRoleKey);
  const scope = await resolveCmsScope(admin, body);
  if (!scope) return jsonError("Site, project, or business scope is invalid", 403, corsHeaders);
  const projectId = scope.projectId;

  if (isContentAction) {
    const action = body.action as ContentCmsAction;
    const permission = contentPermission(action, body.status);
    if (!await authorize(caller, body.businessId, permission)) return jsonError("You do not have permission for this content action", 403, corsHeaders);

    if (action === "content-type-list") {
      const { data, error } = await admin
        .from("content_types")
        .select("id,api_key,display_name,description,field_schema,workflow,created_at,updated_at")
        .eq("business_id", body.businessId)
        .or(projectReadFilter(projectId))
        .order("display_name", { ascending: true });
      if (error) return jsonError("Could not load content types", 500, corsHeaders);
      return secureJsonResponse({ success: true, resource: "content-types", records: data ?? [] }, 200, corsHeaders);
    }

    if (action === "content-type-create" || action === "content-type-update") {
      const validation = validateContentTypeValues(body.values);
      if ("error" in validation) return jsonError(validation.error, 400, corsHeaders);
      const typeValues = validation.values;
      const writeValues = {
        api_key: typeValues.apiKey as string,
        display_name: (typeValues.displayName as string).trim(),
        description: typeValues.description ?? null,
        field_schema: typeValues.fieldSchema ?? { fields: [] },
        workflow: typeValues.workflow ?? { states: contentStatuses },
        updated_by: userResult.user.id,
      };
      const schemaValidation = parseContentFields(writeValues.field_schema);
      if ("error" in schemaValidation) return jsonError(schemaValidation.error, 400, corsHeaders);
      const query = action === "content-type-create"
        ? admin.from("content_types").insert({ ...writeValues, business_id: body.businessId, project_id: projectId, created_by: userResult.user.id })
        : admin.from("content_types").update(writeValues).eq("id", body.contentTypeId!).eq("business_id", body.businessId).or(projectReadFilter(projectId));
      const { data, error } = await query.select("id,api_key,display_name,description,field_schema,workflow,created_at,updated_at").maybeSingle();
      if (error || !data) return jsonError(action === "content-type-create" ? "Could not create content type" : "Content type not found or could not be updated", action === "content-type-create" ? 500 : 404, corsHeaders);
      await audit(admin, { userId: userResult.user.id, businessId: body.businessId, projectId: scope.projectId, siteId: body.siteId, resource: "content-type", action, recordId: String(data.id) });
      return secureJsonResponse({ success: true, resource: "content-type", record: data }, action === "content-type-create" ? 201 : 200, corsHeaders);
    }

    if (action === "content-entry-list") {
      let query = admin
        .from("content_entries")
        .select("id,content_type_id,site_id,locale,slug,title,status,published_at,updated_at")
        .eq("business_id", body.businessId)
        .or(projectReadFilter(projectId))
        .order("updated_at", { ascending: false });
      if (body.siteId) query = query.eq("site_id", body.siteId);
      if (body.contentTypeId) query = query.eq("content_type_id", body.contentTypeId);
      const { data, error } = await query;
      if (error) return jsonError("Could not load content entries", 500, corsHeaders);
      return secureJsonResponse({ success: true, resource: "content-entries", records: data ?? [] }, 200, corsHeaders);
    }

    if (action === "content-entry-get" || action === "content-entry-revisions") {
      const { data: entry, error: entryError } = await admin
        .from("content_entries")
        .select("*")
        .eq("id", body.recordId!)
        .eq("business_id", body.businessId)
        .or(projectReadFilter(projectId))
        .maybeSingle();
      if (entryError || !entry) return jsonError("Content entry not found", 404, corsHeaders);
      if (action === "content-entry-get") return secureJsonResponse({ success: true, resource: "content-entry", record: entry }, 200, corsHeaders);
      const { data, error } = await admin
        .from("content_entry_revisions")
        .select("id,revision_number,snapshot,change_summary,created_by,created_at")
        .eq("entry_id", body.recordId!)
        .eq("business_id", body.businessId)
        .order("revision_number", { ascending: false });
      if (error) return jsonError("Could not load content entry revisions", 500, corsHeaders);
      return secureJsonResponse({ success: true, resource: "content-entry-revisions", records: data ?? [] }, 200, corsHeaders);
    }

    let entry: Record<string, unknown> | null = null;
    let contentTypeId = body.contentTypeId;
    if (action === "content-entry-update" || action === "content-entry-transition") {
      const { data, error } = await admin
        .from("content_entries")
        .select("id,content_type_id,site_id,locale,slug,title,data,status")
        .eq("id", body.recordId!)
        .eq("business_id", body.businessId)
        .or(projectReadFilter(projectId))
        .maybeSingle();
      if (error || !data) return jsonError("Content entry not found", 404, corsHeaders);
      entry = data;
      contentTypeId = String(data.content_type_id);
    }
    const { data: contentType, error: contentTypeError } = await getContentType(admin, body.businessId, contentTypeId!);
    if (contentTypeError || !contentType) return jsonError("Content type not found", 404, corsHeaders);
    const parsedSchema = parseContentFields(contentType.field_schema);
    if ("error" in parsedSchema) return jsonError(parsedSchema.error, 400, corsHeaders);

    if (action === "content-entry-transition") {
      if (!contentStatuses.includes(body.status ?? "")) return jsonError("Content status is invalid", 400, corsHeaders);
      const command = body.idempotencyKey
        ? "cms_apply_content_entry_command_idempotent"
        : "cms_apply_content_entry_command_audited";
      const args = {
        p_action: "transition",
        p_business_id: body.businessId,
        p_project_id: scope.projectId,
        p_actor_id: userResult.user.id,
        p_entry_id: body.recordId,
        p_content_type_id: contentTypeId,
        p_site_id: entry!.site_id,
        p_locale: entry!.locale,
        p_slug: entry!.slug,
        p_title: entry!.title,
        p_data: entry!.data,
        p_target_status: body.status,
        p_change_summary: body.changeSummary ?? null,
        p_expected_updated_at: body.expectedUpdatedAt ?? null,
        ...(body.idempotencyKey ? { p_idempotency_key: body.idempotencyKey } : {}),
      };
      const { data, error } = await admin.rpc(command, args).maybeSingle();
      if (error?.message.includes('CONTENT_ENTRY_CONFLICT')) return jsonError("Conflict: this content changed elsewhere. Reload the item and try again.", 409, corsHeaders);
      if (error?.message.includes('IDEMPOTENCY_KEY_REUSED')) return jsonError("This idempotency key was already used for a different content command.", 409, corsHeaders);
      if (error || !data) return jsonError("Could not transition content entry", 500, corsHeaders);
      return secureJsonResponse({ success: true, resource: "content-entry", record: data }, 200, corsHeaders);
    }

    const entryValidation = validateContentEntryValues(body.values, parsedSchema.fields);
    if ("error" in entryValidation) return jsonError(entryValidation.error, 400, corsHeaders);
    const command = body.idempotencyKey
      ? "cms_apply_content_entry_command_idempotent"
      : "cms_apply_content_entry_command_audited";
    const commandArgs = {
      p_action: action === "content-entry-create" ? "create" : "update",
      p_business_id: body.businessId,
      p_project_id: scope.projectId,
      p_actor_id: userResult.user.id,
      p_entry_id: body.recordId ?? null,
      p_content_type_id: contentTypeId,
      p_site_id: body.siteId ?? entry?.site_id ?? null,
      p_locale: entryValidation.locale,
      p_slug: entryValidation.slug,
      p_title: entryValidation.title,
      p_data: entryValidation.data,
      // Required by both RPC signatures; creation/update do not transition workflow.
      p_target_status: null,
      p_change_summary: body.changeSummary ?? null,
      p_expected_updated_at: body.expectedUpdatedAt ?? null,
      ...(body.idempotencyKey ? { p_idempotency_key: body.idempotencyKey } : {}),
    };
    const { data, error } = await admin.rpc(command, commandArgs).maybeSingle();
    if (error?.message.includes('CONTENT_ENTRY_CONFLICT')) return jsonError("Conflict: this content changed elsewhere. Reload the item and try again.", 409, corsHeaders);
    if (error?.message.includes('IDEMPOTENCY_KEY_REUSED')) return jsonError("This idempotency key was already used for a different content command.", 409, corsHeaders);
    if (error || !data) return jsonError(action === "content-entry-create" ? "Could not create content entry" : "Could not update content entry", 500, corsHeaders);
    const contentEntry = data as Record<string, unknown>;
    // Stamp ownership (adopts legacy NULL rows into the editing site).
    if (projectId) await admin.from("content_entries").update({ project_id: projectId }).eq("id", String(contentEntry.id)).is("project_id", null);
    contentEntry.project_id = contentEntry.project_id ?? projectId;
    return secureJsonResponse({ success: true, resource: "content-entry", record: data }, action === "content-entry-create" ? 201 : 200, corsHeaders);
  }

  if (!body.resource) return jsonError("CMS resource is required", 400, corsHeaders);
  const resource = getCmsResourceContract(body.resource);
  if (!resource) return jsonError("Unknown CMS resource", 400, corsHeaders);
  const permission = body.action === "delete"
    ? "catalog.delete"
    : body.action === "create" || body.action === "update"
      ? "catalog.write"
      : "catalog.read";
  if (!await authorize(caller, body.businessId, permission)) return jsonError("You do not have permission for this catalog action", 403, corsHeaders);

  if (body.action === "list") {
    const { data, error } = await admin
      .from(resource.sourceTable)
      .select("*")
      .eq("business_id", body.businessId)
      .or(projectReadFilter(projectId))
      .order(resource.sortField, { ascending: true });
    if (error) return jsonError("Could not load CMS records", 500, corsHeaders);
    return secureJsonResponse({ success: true, resource: resource.resource, records: data ?? [] }, 200, corsHeaders);
  }

  if (body.action === "get") {
    const { data, error } = await admin
      .from(resource.sourceTable)
      .select("*")
      .eq("id", body.recordId!)
      .eq("business_id", body.businessId)
      .or(projectReadFilter(projectId))
      .maybeSingle();
    if (error || !data) return jsonError("CMS record not found", 404, corsHeaders);
    return secureJsonResponse({ success: true, resource: resource.resource, record: data }, 200, corsHeaders);
  }

  const validation = validateValues(
    body.values,
    resource.editableFields,
    resource.requiredFields,
    body.action as "create" | "update",
  );
  if ("error" in validation) return jsonError(validation.error, 400, corsHeaders);

  if (body.action === "create") {
    const { data, error } = await admin
      .from(resource.sourceTable)
      .insert({ ...validation.values, business_id: body.businessId, project_id: projectId ?? null })
      .select("*")
      .single();
    if (error || !data) {
      console.error("[cms-records] create failed", resource.resource, error?.code, error?.message, error?.details);
      return jsonError(describeWriteFailure("create", resource.resource, error), error?.code === "23505" ? 409 : 500, corsHeaders);
    }
    await audit(admin, { userId: userResult.user.id, businessId: body.businessId, projectId: scope.projectId, siteId: body.siteId, resource: resource.resource, action: body.action, recordId: String(data.id) });
    return secureJsonResponse({ success: true, resource: resource.resource, record: data }, 201, corsHeaders);
  }

  if (body.action === "update") {
    let update = admin
      .from(resource.sourceTable)
      .update(projectId ? { ...validation.values, project_id: projectId } : validation.values)
      .eq("id", body.recordId!)
      .eq("business_id", body.businessId)
      .or(projectReadFilter(projectId));
    if (body.expected) {
      try { update = applyExpectedFilters(update, body.expected, resource.editableFields); }
      catch { return jsonError("Invalid expected fields", 400, corsHeaders); }
    }
    const { data, error } = await update.select("*").maybeSingle();
    if (!error && !data && body.expected) return jsonError("Conflict: this item changed elsewhere. Reload the item and try again.", 409, corsHeaders);
    if (error || !data) return jsonError("CMS record not found or could not be updated", 404, corsHeaders);
    await audit(admin, { userId: userResult.user.id, businessId: body.businessId, projectId: scope.projectId, siteId: body.siteId, resource: resource.resource, action: body.action, recordId: body.recordId });
    return secureJsonResponse({ success: true, resource: resource.resource, record: data }, 200, corsHeaders);
  }

  let del = admin
    .from(resource.sourceTable)
    .delete()
    .eq("id", body.recordId!)
    .eq("business_id", body.businessId);
  if (projectId) del = del.eq("project_id", projectId);
  const { data, error } = await del
    .select("id")
    .maybeSingle();
  if (error || !data) return jsonError("CMS record not found or could not be deleted", 404, corsHeaders);
  await audit(admin, { userId: userResult.user.id, businessId: body.businessId, projectId: scope.projectId, siteId: body.siteId, resource: resource.resource, action: body.action, recordId: body.recordId });
  return secureJsonResponse({ success: true, resource: resource.resource, record: data }, 200, corsHeaders);
});