/**
 * INTENT ACTION - Handles CRM action intents (contact, lead capture, newsletter)
 * 
 * Split from intent-router for smaller bundle size.
 */
// @ts-nocheck - Supabase Edge Function types differ from local TS
// deno-lint-ignore-file no-import-prefix

import { publicBusinessWriteAllowed } from "../_shared/publicBusinessGate.ts";
import { serve } from "serve";
import { createClient } from "@supabase/supabase-js";
import { publicCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { errorResponse } from "../_shared/response.ts";
import { safeParseBody, sanitizeString, isValidUUID , escapeHtml } from "../_shared/validate.ts";
import { checkRateLimit, getClientIp, rateLimitHeaders } from "../_shared/rateLimit.ts";
import { createCrmLead } from "../_shared/canonicalCrm.ts";

// deno-lint-ignore no-explicit-any
type AnySupabase = any;

const corsHeaders = publicCorsHeaders;
const INTENT_PATTERN = /^[a-zA-Z0-9._-]+$/;
const RATE_LIMIT_CONFIG = { maxRequests: 30, windowSeconds: 300 };

interface IntentPayload {
  intent: string;
  businessId: string;
  projectId?: string;
  data: Record<string, unknown>;
  source?: string;
  sourceUrl?: string;
}

function getSupabaseAdmin() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key);
}

async function loadBusinessSettings(supabase: AnySupabase, businessId: string) {
  const { data, error } = await supabase
    .from("businesses")
    .select("id, name, notification_email, owner_id")
    .eq("id", businessId)
    .maybeSingle();
  
  if (error || !data) return null;
  
  if (!data.notification_email && data.owner_id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", data.owner_id)
      .maybeSingle();
    if (profile?.email) data.notification_email = profile.email;
  }
  
  return data;
}

async function sendEmail(to: string, subject: string, html: string, replyTo?: string) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) return false;
  
  try {
    const res = await fetch("https://connector-gateway.lovable.dev/resend/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY") ?? ""}`, "X-Connection-Api-Key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `Notifications <${Deno.env.get("RESEND_FROM_EMAIL") || "onboarding@resend.dev"}>`,
        to: [to], subject, html, reply_to: replyTo,
      }),
    });
    return res.ok;
  } catch { return false; }
}

async function createLead(supabase: AnySupabase, businessId: string, projectId: string | undefined, data: Record<string, unknown>) {
  const email = typeof data.email === "string" ? data.email : null;
  const name = typeof data.name === "string" ? data.name : typeof data.fullName === "string" ? data.fullName : null;
  const result = await createCrmLead(supabase, { businessId, projectId }, {
    title: name || email || "New lead",
    email,
    name,
    phone: typeof data.phone === "string" ? data.phone : null,
    source: typeof data.source === "string" ? data.source : "website",
    notes: typeof data.message === "string" ? data.message : null,
    intent: typeof data.intent === "string" ? data.intent : null,
    metadata: data,
    contact: { email, firstName: name, phone: typeof data.phone === "string" ? data.phone : null, source: 'website' },
  });
  return { id: result.leadId, contact_id: result.contactId };
}

serve(async (req) => {
  const preflight = handleCorsPreflightRequest(req, corsHeaders);
  if (preflight) {
    return preflight;
  }

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405, corsHeaders);
  }

  const limiter = checkRateLimit("intent-action", getClientIp(req), RATE_LIMIT_CONFIG);
  const rateHeaders = rateLimitHeaders(limiter, RATE_LIMIT_CONFIG);
  if (!limiter.allowed) {
    return new Response(JSON.stringify({ error: "Too many action requests. Please try again later." }), {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json", ...rateHeaders },
    });
  }

  try {
    const { data: rawBody, error: parseError } = await safeParseBody<IntentPayload>(req, 65_536);
    if (parseError || !rawBody) {
      const status = parseError?.includes("exceeds") ? 413 : 400;
      return errorResponse(parseError || "Invalid request body", status, corsHeaders);
    }

    const payload: IntentPayload = {
      ...rawBody,
      intent: sanitizeString(rawBody.intent || "", 120),
      businessId: sanitizeString(rawBody.businessId || "", 100),
      projectId: sanitizeString(rawBody.projectId || "", 100) || undefined,
      source: sanitizeString(rawBody.source || "", 120) || undefined,
      sourceUrl: sanitizeString(rawBody.sourceUrl || "", 500) || undefined,
      data: rawBody.data && typeof rawBody.data === "object" && !Array.isArray(rawBody.data) ? rawBody.data : {},
    };
    const { intent, businessId, projectId, data } = payload;
    
    if (!businessId || !intent) {
      return errorResponse("Missing businessId or intent", 400, corsHeaders);
    }

    if (!INTENT_PATTERN.test(intent)) {
      return errorResponse("Invalid intent format", 400, corsHeaders);
    }

    if (!isValidUUID(businessId)) {
      return errorResponse("Invalid businessId format", 400, corsHeaders);
    }

    if (rawBody.data && (typeof rawBody.data !== "object" || Array.isArray(rawBody.data))) {
      return errorResponse("data must be an object", 400, corsHeaders);
    }

    const supabase = getSupabaseAdmin();
    if (!(await publicBusinessWriteAllowed(supabase, req, businessId))) {
      return errorResponse("This business is not accepting submissions", 403, corsHeaders);
    }
    const bizSettings = await loadBusinessSettings(supabase, businessId);
    const email = data.email as string || "";
    const name = data.name as string || "";

    // Handle contact.submit
    if (intent === "contact.submit" || intent === "lead.capture") {
      const lead = await createLead(supabase, businessId, projectId, data);
      
      if (bizSettings?.notification_email) {
        await sendEmail(
          bizSettings.notification_email,
          `New Lead: ${name || email}`,
          `<h2>New Lead</h2><p>Name: ${escapeHtml(name)}</p><p>Email: ${escapeHtml(email)}</p><p>Phone: ${escapeHtml(data.phone || "N/A")}</p><p>Message: ${escapeHtml(data.message || "N/A")}</p>`,
          email || undefined
        );
      }
      
      return new Response(JSON.stringify({
        success: true,
        message: "Thank you! We'll be in touch.",
        data: { leadId: lead?.id },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Handle newsletter.subscribe
    if (intent === "newsletter.subscribe") {
      if (!email) {
        return new Response(JSON.stringify({ success: false, error: "Email required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      const { data: existing } = await supabase
        .from("newsletter_subscribers")
        .select("id")
        .eq("business_id", businessId)
        .eq("email", email)
        .maybeSingle();
      
      if (!existing) {
        const { error: subError } = await supabase.from("newsletter_subscribers").insert({
          business_id: businessId,
          email,
          name: name || null,
          status: "active",
          source: "website",
        }).select().single();
        
        if (subError) {
          // Fallback - create as lead
          await createLead(supabase, businessId, projectId, { ...data, source: "newsletter" });
        }
      }
      
      return new Response(JSON.stringify({
        success: true,
        message: "Thanks for subscribing!",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Handle quote.request
    if (intent === "quote.request") {
      const lead = await createLead(supabase, businessId, projectId, { ...data, source: "quote_request" });
      
      if (bizSettings?.notification_email) {
        await sendEmail(
          bizSettings.notification_email,
          `Quote Request from ${name || email}`,
          `<h2>Quote Request</h2><p>Name: ${escapeHtml(name)}</p><p>Email: ${escapeHtml(email)}</p><p>Details: ${escapeHtml(data.message || JSON.stringify(data))}</p>`,
          email || undefined
        );
      }
      
      return new Response(JSON.stringify({
        success: true,
        message: "Quote request received!",
        data: { leadId: lead?.id },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Unknown action intent
    return new Response(JSON.stringify({ error: `Unknown action intent: ${intent}` }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("[intent-action] Error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
