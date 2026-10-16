import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { secureJsonResponse, errorResponse } from "../_shared/response.ts";
import { verifyAuth, verifyBusinessAccess, authError } from "../_shared/auth.ts";
import { safeParseBody, sanitizeString, isValidUUID } from "../_shared/validate.ts";

const GHL_API_BASE = "https://services.leadconnectorhq.com";
const GHL_API_VERSION = "2021-07-28";
const INTERNAL_AUTH_HEADERS = ["authorization"] as const;
const ALLOWED_ACTIONS = new Set([
  "getContact",
  "getContacts",
  "getCustomFields",
  "getLocation",
  "getTemplateData",
  "getWorkflows",
  "triggerWorkflow",
  "upsertContact",
  "createOpportunity",
  "addContactTag",
]);

interface GhlRequestBody {
  action?: string;
  businessId?: string;
  contactId?: string;
  locationId?: string;
  workflowId?: string;
  pipelineId?: string;
  stageId?: string;
  tags?: string[];
  customFields?: unknown;
  contact?: {
    email?: string;
    phone?: string;
    firstName?: string;
    lastName?: string;
    name?: string;
    source?: string;
    tags?: string[];
    customFields?: unknown;
  };
  opportunity?: {
    name?: string;
    monetaryValue?: number;
    status?: string;
  };
  payload?: Record<string, unknown>;
}

function isAuthorizedInternalRequest(req: Request): boolean {
  const authHeader = req.headers.get("authorization");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  return Boolean(serviceKey && authHeader === `Bearer ${serviceKey}`);
}

function buildGhlHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    Version: GHL_API_VERSION,
  };
}

async function fetchGhlJson(
  path: string,
  apiKey: string,
): Promise<Record<string, unknown>> {
  const response = await fetch(`${GHL_API_BASE}${path}`, {
    headers: buildGhlHeaders(apiKey),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    console.error("[gohighlevel-crm] GHL API error:", response.status, errorText);
    throw new Error(`GoHighLevel request failed with status ${response.status}`);
  }

  return await response.json() as Record<string, unknown>;
}

async function postGhlJson(
  path: string,
  apiKey: string,
  body: Record<string, unknown>,
  method: "POST" | "PUT" = "POST",
): Promise<Record<string, unknown>> {
  const response = await fetch(`${GHL_API_BASE}${path}`, {
    method,
    headers: buildGhlHeaders(apiKey),
    body: JSON.stringify(body),
  });

  const text = await response.text().catch(() => "");
  if (!response.ok) {
    console.error("[gohighlevel-crm] GHL API error:", response.status, text);
    throw new Error(`GoHighLevel ${method} ${path} failed with status ${response.status}: ${text}`);
  }
  try {
    return text ? JSON.parse(text) as Record<string, unknown> : {};
  } catch {
    return { raw: text };
  }
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const preflight = handleCorsPreflightRequest(req, corsHeaders);
  if (preflight) {
    return preflight;
  }

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405, corsHeaders);
  }

  const isInternalRequest = isAuthorizedInternalRequest(req);
  if (!isInternalRequest) {
    const auth = await verifyAuth(req);
    if (!auth.user) {
      return authError(auth.error || "Unauthorized", auth.status, corsHeaders);
    }
  }

  try {
    const apiKey = Deno.env.get("GOHIGHLEVEL_API_KEY");
    if (!apiKey) {
      console.error("[gohighlevel-crm] GOHIGHLEVEL_API_KEY not configured");
      return errorResponse("CRM integration is not configured", 503, corsHeaders);
    }

    const { data: body, error: parseError } = await safeParseBody<GhlRequestBody>(req, 16_384);
    if (parseError || !body) {
      const status = parseError?.includes("exceeds") ? 413 : 400;
      return errorResponse(parseError || "Invalid request body", status, corsHeaders);
    }

    const action = sanitizeString(body.action || "", 80);
    const contactId = sanitizeString(body.contactId || "", 120);
    const locationId = sanitizeString(body.locationId || "", 120);
    const businessId = sanitizeString(body.businessId || "", 100);
    const workflowId = sanitizeString(body.workflowId || "", 120);
    const pipelineId = sanitizeString(body.pipelineId || "", 120);
    const stageId = sanitizeString(body.stageId || "", 120);
    const contactPayload = body.contact && typeof body.contact === "object" ? body.contact : null;
    const opportunityPayload = body.opportunity && typeof body.opportunity === "object" ? body.opportunity : null;
    const extraPayload = body.payload && typeof body.payload === "object" ? body.payload : {};

    if (!action || !ALLOWED_ACTIONS.has(action)) {
      return errorResponse("Invalid action", 400, corsHeaders);
    }

    if (businessId && !isValidUUID(businessId)) {
      return errorResponse("businessId must be a valid UUID", 400, corsHeaders);
    }

    if (!isInternalRequest && businessId) {
      const auth = await verifyAuth(req);
      if (!auth.user) {
        return authError(auth.error || "Unauthorized", auth.status, corsHeaders);
      }
      const access = await verifyBusinessAccess(auth.user.id, businessId);
      if (!access.allowed) {
        return authError(access.error || "Access denied", 403, corsHeaders);
      }
    }

    console.log(
      "[gohighlevel-crm] action=%s contactId=%s locationId=%s internal=%s",
      action,
      contactId || "n/a",
      locationId || "n/a",
      isInternalRequest,
    );

    let result: Record<string, unknown>;

    switch (action) {
      case "getContact": {
        if (!contactId) {
          return errorResponse("contactId is required", 400, corsHeaders);
        }
        result = await fetchGhlJson(`/contacts/${encodeURIComponent(contactId)}`, apiKey);
        break;
      }

      case "getContacts": {
        if (!locationId) {
          return errorResponse("locationId is required", 400, corsHeaders);
        }
        result = await fetchGhlJson(`/contacts/?locationId=${encodeURIComponent(locationId)}`, apiKey);
        break;
      }

      case "getCustomFields": {
        if (!locationId) {
          return errorResponse("locationId is required", 400, corsHeaders);
        }
        result = await fetchGhlJson(`/locations/${encodeURIComponent(locationId)}/customFields`, apiKey);
        break;
      }

      case "getLocation": {
        if (!locationId) {
          return errorResponse("locationId is required", 400, corsHeaders);
        }
        result = await fetchGhlJson(`/locations/${encodeURIComponent(locationId)}`, apiKey);
        break;
      }

      case "getTemplateData": {
        if (!contactId && !locationId) {
          return errorResponse("contactId or locationId is required", 400, corsHeaders);
        }

        const templateData: Record<string, unknown> = {};

        if (contactId) {
          const contactData = await fetchGhlJson(`/contacts/${encodeURIComponent(contactId)}`, apiKey);
          templateData.contact = contactData.contact;
          templateData.customFieldValues = (contactData.contact as Record<string, unknown> | undefined)?.customFields || [];
        }

        if (locationId) {
          const locationData = await fetchGhlJson(`/locations/${encodeURIComponent(locationId)}`, apiKey);
          templateData.location = locationData.location;
          templateData.businessName = (locationData.location as Record<string, unknown> | undefined)?.name;
          templateData.businessAddress = (locationData.location as Record<string, unknown> | undefined)?.address;
          templateData.businessPhone = (locationData.location as Record<string, unknown> | undefined)?.phone;
          templateData.businessEmail = (locationData.location as Record<string, unknown> | undefined)?.email;
          templateData.businessLogo = (locationData.location as Record<string, unknown> | undefined)?.logoUrl;

          const fieldsData = await fetchGhlJson(`/locations/${encodeURIComponent(locationId)}/customFields`, apiKey);
          templateData.customFieldDefinitions = fieldsData.customFields || [];
        }

        result = templateData;
        break;
      }

      case "getWorkflows": {
        if (!locationId) return errorResponse("locationId is required", 400, corsHeaders);
        result = await fetchGhlJson(`/workflows/?locationId=${encodeURIComponent(locationId)}`, apiKey);
        break;
      }

      case "triggerWorkflow": {
        if (!workflowId) return errorResponse("workflowId is required", 400, corsHeaders);
        if (!contactId) return errorResponse("contactId is required to trigger a workflow", 400, corsHeaders);
        if (!isInternalRequest) {
          // A signed-in caller may only trigger workflows for a contact that
          // already belongs to a business they have access to.
          if (!businessId) return errorResponse("businessId is required to trigger a workflow", 400, corsHeaders);
          const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
          const { data: known } = await admin
            .from("ghl_webhook_events")
            .select("id")
            .eq("business_id", businessId)
            .eq("contact_id", contactId)
            .limit(1)
            .maybeSingle();
          if (!known) return authError("This contact does not belong to your business", 403, corsHeaders);
        }
        result = await postGhlJson(
          `/contacts/${encodeURIComponent(contactId)}/workflow/${encodeURIComponent(workflowId)}`,
          apiKey,
          { eventStartTime: new Date().toISOString(), ...extraPayload },
        );
        break;
      }

      case "upsertContact": {
        if (!locationId) return errorResponse("locationId is required", 400, corsHeaders);
        if (!contactPayload || (!contactPayload.email && !contactPayload.phone)) {
          return errorResponse("contact.email or contact.phone is required", 400, corsHeaders);
        }
        result = await postGhlJson(`/contacts/upsert`, apiKey, {
          locationId,
          ...contactPayload,
        });
        break;
      }

      case "createOpportunity": {
        if (!pipelineId) return errorResponse("pipelineId is required", 400, corsHeaders);
        if (!stageId) return errorResponse("stageId is required", 400, corsHeaders);
        if (!locationId) return errorResponse("locationId is required", 400, corsHeaders);
        result = await postGhlJson(`/opportunities/`, apiKey, {
          locationId,
          pipelineId,
          pipelineStageId: stageId,
          contactId: contactId || undefined,
          name: opportunityPayload?.name || "New opportunity",
          monetaryValue: opportunityPayload?.monetaryValue,
          status: opportunityPayload?.status || "open",
        });
        break;
      }

      case "addContactTag": {
        if (!contactId) return errorResponse("contactId is required", 400, corsHeaders);
        const tags = Array.isArray(body.tags) ? body.tags.filter(t => typeof t === "string") : [];
        if (tags.length === 0) return errorResponse("tags array is required", 400, corsHeaders);
        result = await postGhlJson(`/contacts/${encodeURIComponent(contactId)}/tags`, apiKey, { tags });
        break;
      }

      default:
        return errorResponse("Invalid action", 400, corsHeaders);
    }

    return secureJsonResponse(result, 200, corsHeaders);
  } catch (error) {
    console.error("[gohighlevel-crm] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return errorResponse(message, 500, corsHeaders);
  }
});
