import { serve } from "serve";
import { createClient } from "@supabase/supabase-js";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { errorResponse, secureJsonResponse } from "../_shared/response.ts";
import { verifyAuth, verifyBusinessAccess, verifyProjectAccess } from "../_shared/auth.ts";
import { isValidUUID, safeParseBody } from "../_shared/validate.ts";
import { mutateCrmResource, type CrmMutationAction, type CrmResourceName } from "../_shared/canonicalCrm.ts";

interface CrmCommandRequest {
  resource: CrmResourceName;
  action: CrmMutationAction;
  businessId?: string | null;
  projectId?: string | null;
  recordId?: string;
  values?: Record<string, unknown>;
  expected?: Record<string, unknown>;
}

const resources = new Set<CrmResourceName>(['contacts', 'leads', 'deals', 'workflows', 'automations']);
const actions = new Set<CrmMutationAction>(['create', 'update', 'delete']);

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const preflight = handleCorsPreflightRequest(req, corsHeaders);
  if (preflight) return preflight;
  if (req.method !== 'POST') return errorResponse('Method not allowed', 405, corsHeaders);

  const auth = await verifyAuth(req);
  if (!auth.user) return errorResponse(auth.error || 'Authentication required', auth.status, corsHeaders);

  const { data: body, error: parseError } = await safeParseBody<CrmCommandRequest>(req, 32_768);
  if (parseError || !body) return errorResponse(parseError || 'Invalid request body', 400, corsHeaders);
  if (!resources.has(body.resource) || !actions.has(body.action)) return errorResponse('Unsupported CRM command', 400, corsHeaders);
  if (body.businessId && !isValidUUID(body.businessId)) return errorResponse('Invalid businessId', 400, corsHeaders);
  if (body.projectId && !isValidUUID(body.projectId)) return errorResponse('Invalid projectId', 400, corsHeaders);
  if ((body.action === 'update' || body.action === 'delete') && (!body.recordId || !isValidUUID(body.recordId))) {
    return errorResponse('Invalid recordId', 400, corsHeaders);
  }
  if (body.action !== 'delete' && (!body.values || typeof body.values !== 'object' || Array.isArray(body.values))) {
    return errorResponse('values must be an object', 400, corsHeaders);
  }
  if (!body.businessId && !body.projectId) return errorResponse('Business or project scope is required', 400, corsHeaders);

  let businessId = body.businessId || null;
  if (businessId) {
    const access = await verifyBusinessAccess(auth.user.id, businessId);
    if (!access.allowed) return errorResponse(access.error || 'Access denied', 403, corsHeaders);
  }

  if (body.projectId) {
    const access = await verifyProjectAccess(auth.user.id, body.projectId);
    if (!access.allowed) return errorResponse(access.error || 'Access denied', 403, corsHeaders);
    if (businessId && access.businessId !== businessId) return errorResponse('Project does not belong to the requested business', 403, corsHeaders);
    if (!businessId) businessId = access.businessId ?? null;
  }

  const url = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceRoleKey) return errorResponse('CRM command service is not configured', 503, corsHeaders);
  const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

  try {
    const result = await mutateCrmResource(admin, { businessId, projectId: body.projectId || null }, {
      resource: body.resource,
      action: body.action,
      recordId: body.recordId,
      values: body.values,
      expected: body.expected,
    });
    return secureJsonResponse({ success: true, ...result }, 200, corsHeaders);
  } catch (error) {
    console.error('[crm-command] Mutation failed', { resource: body.resource, action: body.action, error });
    return errorResponse(error instanceof Error ? error.message : 'CRM command failed', 400, corsHeaders);
  }
});