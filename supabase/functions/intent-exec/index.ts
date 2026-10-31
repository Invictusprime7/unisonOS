/**
 * INTENT-EXEC: Canonical Intent Execution Surface
 * 
 * This is THE single endpoint for all intent execution:
 * 1. Validates entitlement (bundle.entitlements)
 * 2. Logs intent event (intent_events table)
 * 3. Executes client + edge logic
 * 4. Triggers automation runtime
 * 5. Records usage for metering
 * 6. Returns standardized UTP/INTENT_RESULT
 * 
 * POST /functions/v1/intent-exec
 * 
 * Request body matches IntentExecuteRequest from SiteBundle types:
 * {
 *   siteId: string;
 *   intentId: string;
 *   bindingId?: string;
 *   pageId: string;
 *   params: Record<string, unknown>;
 *   context?: { sessionId?: string; userId?: string; }
 * }
 */

import { publicBusinessWriteAllowed } from "../_shared/publicBusinessGate.ts";
import { serve } from "serve";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { publicCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { secureJsonResponse, errorResponse } from "../_shared/response.ts";
import { safeParseBody, sanitizeString, isValidUUID } from "../_shared/validate.ts";
import { checkRateLimit, getClientIp, rateLimitHeaders } from "../_shared/rateLimit.ts";
import { createCrmActivity, createCrmContact, createCrmLead } from "../_shared/canonicalCrm.ts";
import { unsupportedIntentResult } from "../_shared/unsupportedIntent.ts";

// ============================================================================
// Types
// ============================================================================

interface IntentExecuteRequest {
  siteId?: string;         // Optional if businessId provided
  businessId?: string;     // Can be provided directly
  intentId: string;
  bindingId?: string;
  pageId: string;
  params: Record<string, unknown>;
  context?: {
    sessionId?: string;
    userId?: string;
  };
}

interface ClientAction {
  type: "NAVIGATE" | "OVERLAY" | "TOAST" | "STATE_PATCH" | "SUBMIT" | "EXTERNAL";
  [key: string]: unknown;
}

interface IntentExecuteResponse {
  ok: boolean;
  result?: unknown;
  clientActions?: ClientAction[];
  error?: {
    code: string;
    message: string;
  };
}

interface IntentDefinition {
  intentId: string;
  category: string;
  description: string;
  paramsSchema: Record<string, unknown>;
  handler: {
    kind: "client" | "edge" | "both";
    clientAction?: ClientAction;
    edgeFunction?: {
      functionName: string;
      route: string;
    };
  };
  requires?: {
    featureFlag?: string;
    minPlan?: string;
    integrations?: string[];
  };
}

interface EntitlementSystem {
  plan: string;
  features: Record<string, boolean>;
  limits: Record<string, number>;
  gatedIntents?: string[];
  customDomain?: boolean;
  whiteLabel?: boolean;
  expiresAt?: string;
}

interface SiteBundle {
  version: string;
  site: { siteId: string; businessId: string };
  intents: {
    definitions: Record<string, IntentDefinition>;
    bindings: unknown[];
  };
  entitlements: EntitlementSystem;
  automations?: {
    installed: string[];
  };
}

// ============================================================================
// CORS + Headers
// ============================================================================

const INTENT_PATTERN = /^[a-zA-Z0-9._-]+$/;
const RATE_LIMIT_CONFIG = { maxRequests: 60, windowSeconds: 300 };
const EDGE_FUNCTION_NAME_PATTERN = /^[a-z0-9-]{1,80}$/;
const DEFAULT_ALLOWED_INTENT_EDGE_FUNCTIONS = new Set([
  "create-lead",
  "create-lead-lite",
  "create-order-checkout",
  "form-submit",
  "intent-action",
  "template-backend",
  "template-automation",
]);

function getAllowedIntentEdgeFunctions(): Set<string> {
  const configured = Deno.env.get("INTENT_EXEC_ALLOWED_FUNCTIONS");
  if (!configured) {
    return DEFAULT_ALLOWED_INTENT_EDGE_FUNCTIONS;
  }

  return new Set(
    configured
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean),
  );
}

// ============================================================================
// Supabase Client
// ============================================================================

function getSupabaseAdmin(): SupabaseClient {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing Supabase environment variables");
  }
  
  return createClient(supabaseUrl, supabaseServiceKey);
}

// ============================================================================
// Entitlement Validation
// ============================================================================

function checkEntitlement(
  intentId: string,
  intentDef: IntentDefinition | undefined,
  entitlements: EntitlementSystem
): { allowed: boolean; reason?: string } {
  // Check if intent is in gated list
  if (entitlements.gatedIntents?.includes(intentId)) {
    return { allowed: false, reason: `Intent '${intentId}' is not available on your plan` };
  }
  
  // Check intent-specific requirements
  if (intentDef?.requires) {
    // Check feature flag
    if (intentDef.requires.featureFlag) {
      const hasFeature = entitlements.features[intentDef.requires.featureFlag];
      if (!hasFeature) {
        return { allowed: false, reason: `Feature '${intentDef.requires.featureFlag}' is not enabled` };
      }
    }
    
    // Check plan level
    if (intentDef.requires.minPlan) {
      const planHierarchy = ["free", "starter", "pro", "agency", "enterprise"];
      const currentPlanIndex = planHierarchy.indexOf(entitlements.plan);
      const requiredPlanIndex = planHierarchy.indexOf(intentDef.requires.minPlan);
      
      if (currentPlanIndex < requiredPlanIndex) {
        return { 
          allowed: false, 
          reason: `This feature requires '${intentDef.requires.minPlan}' plan or higher` 
        };
      }
    }
    
    // Check integrations
    if (intentDef.requires.integrations?.length) {
      for (const integration of intentDef.requires.integrations) {
        const hasIntegration = entitlements.features[`integration:${integration}`];
        if (!hasIntegration) {
          return { allowed: false, reason: `Integration '${integration}' is required but not configured` };
        }
      }
    }
  }
  
  return { allowed: true };
}

// ============================================================================
// Usage Limit Check
// ============================================================================

async function checkUsageLimit(
  supabase: SupabaseClient,
  businessId: string
): Promise<{ allowed: boolean; reason?: string }> {
  const billingPeriod = new Date().toISOString().slice(0, 7); // 'YYYY-MM'
  
  const { data: summary, error } = await supabase
    .from("usage_summary")
    .select("intent_executions, intent_limit")
    .eq("business_id", businessId)
    .eq("billing_period", billingPeriod)
    .maybeSingle();
  
  if (error) {
    console.error("[intent-exec] Usage check error:", error);
    // Allow on error to avoid blocking users
    return { allowed: true };
  }
  
  if (!summary) {
    // No usage recorded yet, allow
    return { allowed: true };
  }
  
  if (summary.intent_limit && summary.intent_executions >= summary.intent_limit) {
    return { 
      allowed: false, 
      reason: `Monthly intent execution limit reached (${summary.intent_limit})` 
    };
  }
  
  return { allowed: true };
}

// ============================================================================
// Load Site Bundle
// ============================================================================

async function loadSiteBundle(
  supabase: SupabaseClient,
  siteId: string
): Promise<SiteBundle | null> {
  // Get the latest bundle for this site
  const { data, error } = await supabase
    .from("site_bundles")
    .select("bundle, site_id, build_id")
    .eq("site_id", siteId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  
  if (error) {
    console.error("[intent-exec] Failed to load bundle:", error);
    return null;
  }
  
  if (!data) {
    console.warn("[intent-exec] No bundle found for site:", siteId);
    return null;
  }
  
  return data.bundle as SiteBundle;
}

// ============================================================================
// Log Intent Event
// ============================================================================

async function logIntentEvent(
  supabase: SupabaseClient,
  args: {
    siteId?: string;
    businessId: string;
    buildId?: string;
    intentId: string;
    bindingId?: string;
    pageId: string;
    ok: boolean;
    durationMs?: number;
    params?: Record<string, unknown>;
    result?: unknown;
    errorCode?: string;
    errorMessage?: string;
    clientActions?: ClientAction[];
    automationRunId?: string;
    userId?: string;
    sessionId?: string;
    ipAddress?: string;
    userAgent?: string;
  }
): Promise<string | null> {
  const { data, error } = await supabase
    .from("intent_events")
    .insert({
      site_id: args.siteId,
      business_id: args.businessId,
      build_id: args.buildId,
      intent_id: args.intentId,
      binding_id: args.bindingId,
      page_id: args.pageId,
      ok: args.ok,
      duration_ms: args.durationMs,
      params: args.params || {},
      result: args.result || {},
      error_code: args.errorCode,
      error_message: args.errorMessage,
      client_actions: args.clientActions || [],
      automation_run_id: args.automationRunId,
      user_id: args.userId,
      session_id: args.sessionId,
      ip_address: args.ipAddress,
      user_agent: args.userAgent,
    })
    .select("id")
    .single();
  
  if (error) {
    console.error("[intent-exec] Failed to log intent event:", error);
    return null;
  }
  
  return data?.id || null;
}

// ============================================================================
// Record Usage
// ============================================================================

async function recordUsage(
  supabase: SupabaseClient,
  businessId: string,
  intentId: string
): Promise<void> {
  try {
    await supabase.rpc("record_usage_event", {
      p_business_id: businessId,
      p_event_type: "intent_executed",
      p_resource_type: "intent",
      p_metadata: { intentId },
    });
  } catch (error) {
    console.error("[intent-exec] Failed to record usage:", error);
  }
}

// ============================================================================
// Trigger Automation
// ============================================================================

async function triggerAutomation(
  supabase: SupabaseClient,
  businessId: string,
  intentId: string,
  params: Record<string, unknown>,
  siteId?: string
): Promise<string | null> {
  // Map intent to automation event
  const automationIntent = mapIntentToAutomationEvent(intentId);
  
  if (!automationIntent) {
    return null;
  }
  
  // Insert automation event
  const { data, error } = await supabase
    .from("automation_events")
    .insert({
      business_id: businessId,
      intent: automationIntent,
      payload: {
        ...params,
        siteId,
        intentId,
        triggeredAt: new Date().toISOString(),
      },
      source: "intent_exec",
      dedupe_key: `${siteId}:${intentId}:${Date.now()}`,
    })
    .select("id")
    .single();
  
  if (error) {
    console.error("[intent-exec] Failed to trigger automation:", error);
    return null;
  }
  
  console.log("[intent-exec] Automation event created:", data?.id);
  return data?.id || null;
}

function mapIntentToAutomationEvent(intentId: string): string | null {
  const mapping: Record<string, string> = {
    "contact.submit": "lead.capture",
    "lead.capture": "lead.capture",
    "quote.request": "quote.request",
    "newsletter.subscribe": "newsletter.subscribe",
    "form.submit": "form.submit",
    "cta.primary": "cta.click",
    "cta.secondary": "cta.click",
  };
  
  return mapping[intentId] || null;
}

// ============================================================================
// Execute Intent Handler
// ============================================================================

async function executeIntentHandler(
  intentDef: IntentDefinition,
  params: Record<string, unknown>,
  context: { siteId?: string; businessId: string; pageId: string }
): Promise<{ ok: boolean; result: unknown; clientActions: ClientAction[] }> {
  const handler = intentDef.handler;
  const clientActions: ClientAction[] = [];
  let result: unknown = {};
  
  // Execute client action if defined
  if (handler.kind === "client" || handler.kind === "both") {
    if (handler.clientAction) {
      clientActions.push(handler.clientAction);
    }
  }
  
  // Execute edge function if defined
  if (handler.kind === "edge" || handler.kind === "both") {
    if (handler.edgeFunction) {
      try {
        const edgeResult = await callEdgeFunction(
          handler.edgeFunction.functionName,
          handler.edgeFunction.route,
          params,
          context
        );
        result = edgeResult;
        
        // Add success toast if no client action defined
        if (clientActions.length === 0) {
          clientActions.push({
            type: "TOAST",
            message: "Submitted successfully!",
            level: "success",
          });
        }
      } catch (error) {
        console.error("[intent-exec] Edge function error:", error);
        return {
          ok: false,
          result: { error: String(error) },
          clientActions: [{
            type: "TOAST",
            message: "An error occurred. Please try again.",
            level: "error",
          }],
        };
      }
    }
  }
  
  return { ok: true, result, clientActions };
}

async function callEdgeFunction(
  functionName: string,
  route: string,
  params: Record<string, unknown>,
  context: { siteId?: string; businessId: string; pageId: string }
): Promise<unknown> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  
  if (!supabaseUrl || !serviceKey) {
    throw new Error("Missing Supabase config");
  }

  const normalizedFunctionName = sanitizeString(functionName || "", 80);
  const normalizedRoute = sanitizeString(route || "", 300);
  const allowedFunctions = getAllowedIntentEdgeFunctions();

  if (!EDGE_FUNCTION_NAME_PATTERN.test(normalizedFunctionName)) {
    throw new Error("Invalid edge function target");
  }

  if (!allowedFunctions.has(normalizedFunctionName)) {
    throw new Error(`Edge function '${normalizedFunctionName}' is not allowed for intent execution`);
  }
  
  const url = `${supabaseUrl}/functions/v1/${normalizedFunctionName}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...params,
      ...context,
      route: normalizedRoute,
    }),
    signal: controller.signal,
  });
  clearTimeout(timeout);
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Edge function error: ${response.status} - ${errorText}`);
  }
  
  return response.json();
}

// ============================================================================
// Core Intent Fallback Handlers
// ============================================================================

async function executeCoreFallback(
  intentId: string,
  params: Record<string, unknown>,
  context: { siteId?: string; businessId: string; pageId: string }
): Promise<{ ok: boolean; result: unknown; clientActions: ClientAction[] }> {
  const supabase = getSupabaseAdmin();
  
  // Navigation intents - client-side only
  if (intentId.startsWith("nav.")) {
    return handleNavIntent(intentId, params);
  }
  
  // Contact/lead intents - persist to CRM
  if (intentId === "contact.submit" || intentId === "lead.capture") {
    return await handleLeadCapture(supabase, params, context);
  }

  if (intentId === "newsletter.subscribe") {
    return await handleNewsletterSubscribe(supabase, params, context);
  }
  
  // Quote request
  if (intentId === "quote.request") {
    return await handleQuoteRequest(supabase, params, context);
  }
  
  return unsupportedIntentResult(intentId);
}

function handleNavIntent(
  intentId: string,
  params: Record<string, unknown>
): { ok: boolean; result: unknown; clientActions: ClientAction[] } {
  const path = params.path as string || params.to as string || "/";
  
  if (intentId === "nav.external") {
    const url = params.url as string || params.href as string;
    return {
      ok: true,
      result: { navigated: true },
      clientActions: [{
        type: "EXTERNAL",
        url,
        target: params.target || "_blank",
      }],
    };
  }
  
  return {
    ok: true,
    result: { navigated: true },
    clientActions: [{
      type: "NAVIGATE",
      to: path,
    }],
  };
}

async function handleLeadCapture(
  supabase: SupabaseClient,
  params: Record<string, unknown>,
  context: { businessId: string }
): Promise<{ ok: boolean; result: unknown; clientActions: ClientAction[] }> {
  // Leads are only accepted for a business that has a live published site.
  const { data: liveSite } = await supabase
    .from("projects")
    .select("id")
    .eq("business_id", context.businessId)
    .eq("publish_status", "published")
    .not("active_published_revision_id", "is", null)
    .limit(1)
    .maybeSingle();
  if (!liveSite) {
    return { ok: false, result: { error: "This business is not accepting enquiries from this site." }, clientActions: [] };
  }

  const name = String(params.name || params.fullName || '');
  const email = typeof params.email === 'string' ? params.email : null;
  const phone = typeof params.phone === 'string' ? params.phone : null;
  try {
    const result = params.intent === 'contact.submit'
      ? await createCrmContact(supabase, { businessId: context.businessId }, {
        email,
        firstName: name,
        phone,
        source: 'website_form',
        tags: ['lead'],
        customFields: params,
      })
      : await createCrmLead(supabase, { businessId: context.businessId }, {
        title: name || email || 'New lead',
        email,
        name: name || null,
        phone,
        stage: 'new',
        source: 'website_form',
        intent: 'lead.capture',
        notes: typeof params.message === 'string' ? params.message : null,
        metadata: params,
        contact: { email, firstName: name, phone, source: 'website_form', tags: ['lead'], customFields: params },
      });
    return {
      ok: true,
      result,
      clientActions: [{ type: 'TOAST', message: "Thanks for reaching out! We'll be in touch soon.", level: 'success' }],
    };
  } catch (error) {
    console.error('[intent-exec] Canonical CRM command failed:', error);
    return {
      ok: false,
      result: { error: error instanceof Error ? error.message : 'Failed to submit.' },
      clientActions: [{ type: 'TOAST', message: 'Failed to submit. Please try again.', level: 'error' }],
    };
  }
}

async function handleQuoteRequest(
  supabase: SupabaseClient,
  params: Record<string, unknown>,
  context: { businessId: string }
): Promise<{ ok: boolean; result: unknown; clientActions: ClientAction[] }> {
  const email = typeof params.email === 'string' ? params.email : null;
  const name = String(params.name || params.fullName || '');
  try {
    const lead = await createCrmLead(supabase, { businessId: context.businessId }, {
      title: `Quote Request - ${params.service || 'General'}`,
      email,
      name: name || null,
      phone: typeof params.phone === 'string' ? params.phone : null,
      stage: 'new',
      intent: 'quote_request',
      source: 'website_quote_form',
      notes: typeof params.message === 'string' ? params.message : null,
      metadata: params,
      contact: { email, firstName: name || null, phone: typeof params.phone === 'string' ? params.phone : null, source: 'quote_request', tags: ['quote_request'] },
    });
    await createCrmActivity(supabase, { businessId: context.businessId }, {
      type: 'quote_requested',
      title: `Quote Request - ${params.service || 'General'}`,
      description: typeof params.message === 'string' ? params.message : null,
      contactId: lead.contactId,
      leadId: lead.leadId,
      metadata: params,
    });
    return {
      ok: true,
      result: { leadId: lead.leadId, contactId: lead.contactId },
      clientActions: [{ type: 'TOAST', message: "Quote request received! We'll prepare your estimate shortly.", level: 'success' }],
    };
  } catch (error) {
    console.error('[intent-exec] Canonical quote command failed:', error);
    return {
      ok: false,
      result: { error: error instanceof Error ? error.message : 'Could not save quote request.' },
      clientActions: [{ type: 'TOAST', message: 'Could not save your quote request.', level: 'error' }],
    };
  }
}

async function handleNewsletterSubscribe(
  supabase: SupabaseClient,
  params: Record<string, unknown>,
  context: { siteId?: string; businessId: string }
): Promise<{ ok: boolean; result: unknown; clientActions: ClientAction[] }> {
  const email = typeof params.email === "string" ? params.email.trim() : "";
  const name = typeof params.name === "string"
    ? params.name.trim()
    : typeof params.fullName === "string"
      ? params.fullName.trim()
      : "";
  const phone = typeof params.phone === "string" ? params.phone.trim() : "";
  const source = typeof params.source === "string" && params.source.trim()
    ? params.source.trim()
    : "website";

  if (!email) {
    return {
      ok: false,
      result: { error: "Email is required" },
      clientActions: [{
        type: "TOAST",
        message: "Email is required to subscribe.",
        level: "error",
      }],
    };
  }

  const { data: existingSubscriber } = await supabase
    .from("newsletter_subscribers")
    .select("id")
    .eq("business_id", context.businessId)
    .eq("email", email)
    .maybeSingle();

  if (existingSubscriber?.id) {
    return {
      ok: true,
      result: { subscriberId: existingSubscriber.id, duplicate: true },
      clientActions: [{
        type: "TOAST",
        message: "You're already subscribed!",
        level: "info",
      }],
    };
  }

  const { data: subscriber, error: subscriberError } = await supabase
    .from("newsletter_subscribers")
    .insert({
      business_id: context.businessId,
      project_id: context.siteId || null,
      email,
      name: name || null,
      status: "active",
      source,
      created_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (subscriberError) {
    console.error("[intent-exec] Newsletter subscribe error:", subscriberError);

    try {
      await createCrmContact(supabase, { businessId: context.businessId }, {
        email,
        firstName: name || null,
        phone: phone || null,
        source: source || "newsletter_signup",
        tags: ["newsletter"],
        customFields: params,
      });
    } catch (contactError) {
      console.error("[intent-exec] Newsletter fallback contact error:", contactError);
      return {
        ok: false,
        result: { error: contactError instanceof Error ? contactError.message : String(contactError) },
        clientActions: [{
          type: "TOAST",
          message: "Failed to subscribe. Please try again.",
          level: "error",
        }],
      };
    }

    return {
      ok: true,
      result: { fallback: "crm_contact" },
      clientActions: [{
        type: "TOAST",
        message: "Thanks for subscribing!",
        level: "success",
      }],
    };
  }

  return {
    ok: true,
    result: { subscriberId: subscriber?.id },
    clientActions: [{
      type: "TOAST",
      message: "Thanks for subscribing!",
      level: "success",
    }],
  };
}

// ============================================================================
// Main Handler
// ============================================================================

serve(async (req: Request) => {
  const preflight = handleCorsPreflightRequest(req, publicCorsHeaders);
  if (preflight) {
    return preflight;
  }
  
  if (req.method !== "POST") {
    return errorResponse("POST required", 405, publicCorsHeaders, {
      ok: false,
      error: { code: "METHOD_NOT_ALLOWED", message: "POST required" },
    });
  }

  const limiter = checkRateLimit("intent-exec", getClientIp(req), RATE_LIMIT_CONFIG);
  const rateHeaders = rateLimitHeaders(limiter, RATE_LIMIT_CONFIG);
  if (!limiter.allowed) {
    return secureJsonResponse({
      ok: false,
      error: { code: "RATE_LIMITED", message: "Too many intent executions. Please try again later." },
    }, 429, publicCorsHeaders, rateHeaders);
  }
  
  const startTime = Date.now();
  
  // Initialize Supabase client - handle missing env vars gracefully
  let supabase: SupabaseClient;
  try {
    supabase = getSupabaseAdmin();
  } catch (envError) {
    console.error("[intent-exec] Environment error:", envError);
    return secureJsonResponse({
        ok: false,
        error: { code: "CONFIG_ERROR", message: "Service not properly configured" },
      }, 500, publicCorsHeaders);
  }
  
  // Extract client info
  const ipAddress = sanitizeString(req.headers.get("x-forwarded-for")?.split(",")[0] || 
                    req.headers.get("x-real-ip") ||
                    "unknown", 100);
  const userAgent = sanitizeString(req.headers.get("user-agent") || "unknown", 300);
  
  try {
    const { data: rawBody, error: parseError } = await safeParseBody<IntentExecuteRequest>(req, 65_536);
    if (parseError || !rawBody) {
      const status = parseError?.includes("exceeds") ? 413 : 400;
      return errorResponse(parseError || "Invalid request body", status, publicCorsHeaders, {
        ok: false,
        error: { code: "INVALID_REQUEST", message: parseError || "Invalid request body" },
      });
    }

    const body: IntentExecuteRequest = {
      ...rawBody,
      siteId: sanitizeString(rawBody.siteId || "", 100) || undefined,
      businessId: sanitizeString(rawBody.businessId || "", 100) || undefined,
      intentId: sanitizeString(rawBody.intentId || "", 120),
      bindingId: sanitizeString(rawBody.bindingId || "", 120) || undefined,
      pageId: sanitizeString(rawBody.pageId || "", 120),
      params: rawBody.params && typeof rawBody.params === "object" && !Array.isArray(rawBody.params) ? rawBody.params : {},
      context: rawBody.context ? {
        sessionId: sanitizeString(rawBody.context.sessionId || "", 120) || undefined,
        userId: sanitizeString(rawBody.context.userId || "", 100) || undefined,
      } : undefined,
    };
    const { siteId, intentId, bindingId, pageId, params, context } = body;
    
    // Validate required fields
    if (!intentId || !pageId) {
      return secureJsonResponse({
          ok: false,
          error: { code: "INVALID_REQUEST", message: "Missing required fields: intentId, pageId" },
        }, 400, publicCorsHeaders);
    }
    
    // Need either siteId or businessId
    if (!siteId && !body.businessId) {
      return secureJsonResponse({
          ok: false,
          error: { code: "INVALID_REQUEST", message: "Missing required field: siteId or businessId" },
        }, 400, publicCorsHeaders);
    }

    if (!INTENT_PATTERN.test(intentId)) {
      return secureJsonResponse({
        ok: false,
        error: { code: "INVALID_REQUEST", message: "Invalid intentId format" },
      }, 400, publicCorsHeaders);
    }

    if (intentId.startsWith("booking.")) {
      return secureJsonResponse({
        ok: false,
        error: {
          code: "CANONICAL_RUNTIME_REQUIRED",
          message: "Booking actions must use the versioned site-runtime gateway.",
        },
      }, 410, publicCorsHeaders);
    }

    if (siteId && !isValidUUID(siteId)) {
      return secureJsonResponse({
        ok: false,
        error: { code: "INVALID_REQUEST", message: "Invalid siteId format" },
      }, 400, publicCorsHeaders);
    }

    if (body.businessId && !isValidUUID(body.businessId)) {
      return secureJsonResponse({
        ok: false,
        error: { code: "INVALID_REQUEST", message: "Invalid businessId format" },
      }, 400, publicCorsHeaders);
    }

    if (rawBody.params && (typeof rawBody.params !== "object" || Array.isArray(rawBody.params))) {
      return secureJsonResponse({
        ok: false,
        error: { code: "INVALID_REQUEST", message: "params must be an object" },
      }, 400, publicCorsHeaders);
    }
    
    console.log(`[intent-exec] Executing intent: ${intentId} for site: ${siteId || 'N/A'}`);
    
    // Load site bundle if siteId provided
    const bundle = siteId ? await loadSiteBundle(supabase, siteId) : null;
    
    // Get business ID (from request, bundle, or lookup)
    let businessId = body.businessId || bundle?.site?.businessId;
    
    if (!businessId && siteId) {
      // Fallback: lookup from sites table
      const { data: site } = await supabase
        .from("sites")
        .select("business_id")
        .eq("id", siteId)
        .maybeSingle();
      
      businessId = site?.business_id;
    }
    
    if (!businessId) {
      return secureJsonResponse({
          ok: false,
          error: { code: "SITE_NOT_FOUND", message: "Site not found" },
        }, 404, publicCorsHeaders);
    }
    
    // A site-supplied id must belong to the chosen business, and anonymous
    // writes are accepted only for businesses with a live published site.
    if (siteId && body.businessId) {
      const { data: siteRow } = await supabase.from("sites").select("business_id").eq("id", siteId).maybeSingle();
      if (siteRow?.business_id && siteRow.business_id !== body.businessId) {
        return secureJsonResponse({ ok: false, error: { code: "FORBIDDEN", message: "Site does not belong to this business" } }, 403, publicCorsHeaders);
      }
    }
    if (!(await publicBusinessWriteAllowed(supabase, req, businessId))) {
      return secureJsonResponse({ ok: false, error: { code: "FORBIDDEN", message: "This business is not accepting submissions" } }, 403, publicCorsHeaders);
    }

    // Check usage limits
    const usageCheck = await checkUsageLimit(supabase, businessId);
    if (!usageCheck.allowed) {
      const durationMs = Date.now() - startTime;
      await logIntentEvent(supabase, {
        siteId,
        businessId,
        intentId,
        bindingId,
        pageId,
        ok: false,
        durationMs,
        params,
        errorCode: "USAGE_LIMIT_EXCEEDED",
        errorMessage: usageCheck.reason,
        sessionId: context?.sessionId,
        userId: context?.userId,
        ipAddress,
        userAgent,
      });
      
      return new Response(
        JSON.stringify({
          ok: false,
          error: { code: "USAGE_LIMIT_EXCEEDED", message: usageCheck.reason },
        }),
        { status: 429, headers: { ...publicCorsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Get intent definition and entitlements
    const intentDef = bundle?.intents?.definitions?.[intentId];
    const entitlements = bundle?.entitlements || {
      plan: "free",
      features: {},
      limits: {},
    };
    
    // Check entitlement
    const entitlementCheck = checkEntitlement(intentId, intentDef, entitlements);
    if (!entitlementCheck.allowed) {
      const durationMs = Date.now() - startTime;
      await logIntentEvent(supabase, {
        siteId,
        businessId,
        intentId,
        bindingId,
        pageId,
        ok: false,
        durationMs,
        params,
        errorCode: "ENTITLEMENT_DENIED",
        errorMessage: entitlementCheck.reason,
        sessionId: context?.sessionId,
        userId: context?.userId,
        ipAddress,
        userAgent,
      });
      
      return new Response(
        JSON.stringify({
          ok: false,
          error: { code: "ENTITLEMENT_DENIED", message: entitlementCheck.reason },
        }),
        { status: 403, headers: { ...publicCorsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Execute intent
    let result: { ok: boolean; result: unknown; clientActions: ClientAction[] };
    
    if (intentDef) {
      // Use bundle-defined handler
      result = await executeIntentHandler(intentDef, params || {}, {
        siteId,
        businessId,
        pageId,
      });
    } else {
      // Fallback to core intent handlers
      result = await executeCoreFallback(intentId, params || {}, {
        siteId,
        businessId,
        pageId,
      });
    }
    
    const durationMs = Date.now() - startTime;
    
    // Trigger automation if applicable
    let automationRunId: string | undefined;
    if (result.ok) {
      const runId = await triggerAutomation(supabase, businessId, intentId, params || {}, siteId);
      if (runId) {
        automationRunId = runId;
      }
    }
    
    // Log intent event
    await logIntentEvent(supabase, {
      siteId,
      businessId,
      intentId,
      bindingId,
      pageId,
      ok: result.ok,
      durationMs,
      params,
      result: result.result,
      clientActions: result.clientActions,
      automationRunId,
      sessionId: context?.sessionId,
      userId: context?.userId,
      ipAddress,
      userAgent,
    });
    
    // Record usage
    if (result.ok) {
      await recordUsage(supabase, businessId, intentId);
    }
    
    console.log(`[intent-exec] Completed in ${durationMs}ms: ${intentId} -> ${result.ok ? "OK" : "FAIL"}`);
    
    // Return standardized response
    const response: IntentExecuteResponse = {
      ok: result.ok,
      result: result.result,
      clientActions: result.clientActions,
    };
    
    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...publicCorsHeaders, "Content-Type": "application/json" } }
    );
    
  } catch (error) {
    console.error("[intent-exec] Error:", error);
    
    const response: IntentExecuteResponse = {
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: error instanceof Error ? error.message : "Unknown error",
      },
    };
    
    return new Response(
      JSON.stringify(response),
      { status: 500, headers: { ...publicCorsHeaders, "Content-Type": "application/json" } }
    );
  }
});
