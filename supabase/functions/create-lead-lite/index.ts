/**
 * CREATE LEAD LITE - Simplified lead creation without npm dependencies
 *
 * Uses fetch for Resend API instead of npm:resend package.
 */

// deno-lint-ignore-file no-import-prefix
import { serve } from "serve";
import { createClient } from "@supabase/supabase-js";
import { publicCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { secureJsonResponse, errorResponse } from "../_shared/response.ts";
import { safeParseBody, sanitizeString, isValidUUID , escapeHtml } from "../_shared/validate.ts";
import { checkRateLimit, getClientIp, rateLimitHeaders } from "../_shared/rateLimit.ts";

const corsHeaders = publicCorsHeaders;
const RATE_LIMIT_CONFIG = { maxRequests: 20, windowSeconds: 300 };

interface LeadPayload {
  businessId?: string;
  name?: string;
  email?: string;
  phone?: string;
  source?: string;
  message?: string;
  metadata?: Record<string, unknown>;
}

function safeEmail(email: unknown): string | null {
  if (typeof email !== "string") return null;
  const trimmed = email.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? trimmed : null;
}

async function sendEmail(to: string, subject: string, html: string, replyTo?: string) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) return false;

  try {
    const res = await fetch("https://connector-gateway.lovable.dev/resend/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY") ?? ""}`, "X-Connection-Api-Key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `Unison <${Deno.env.get("RESEND_FROM_EMAIL") || "onboarding@resend.dev"}>`,
        to: [to], subject, html, reply_to: replyTo,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

serve(async (req) => {
  const preflight = handleCorsPreflightRequest(req, corsHeaders);
  if (preflight) {
    return preflight;
  }

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405, corsHeaders);
  }

  const limiter = checkRateLimit("create-lead-lite", getClientIp(req), RATE_LIMIT_CONFIG);
  const rateHeaders = rateLimitHeaders(limiter, RATE_LIMIT_CONFIG);
  if (!limiter.allowed) {
    return secureJsonResponse(
      { success: false, error: "Too many lead submissions. Please try again later." },
      429,
      corsHeaders,
      rateHeaders,
    );
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: rawBody, error: parseError } = await safeParseBody<LeadPayload>(req, 32_768);
    if (parseError || !rawBody) {
      const status = parseError?.includes("exceeds") ? 413 : 400;
      return errorResponse(parseError || "Invalid request body", status, corsHeaders);
    }

    const businessId = sanitizeString(rawBody.businessId || "", 100);
    const name = sanitizeString(rawBody.name || "", 200) || undefined;
    const email = sanitizeString(rawBody.email || "", 255);
    const phone = sanitizeString(rawBody.phone || "", 30) || undefined;
    const source = sanitizeString(rawBody.source || "", 100) || "website";
    const message = sanitizeString(rawBody.message || "", 2_000) || undefined;
    const metadata = rawBody.metadata && typeof rawBody.metadata === "object" && !Array.isArray(rawBody.metadata)
      ? rawBody.metadata
      : {};

    if (!businessId) {
      return errorResponse("businessId required", 400, corsHeaders);
    }

    if (!isValidUUID(businessId)) {
      return errorResponse("Invalid business ID", 400, corsHeaders);
    }

    const validEmail = safeEmail(email);
    if (!validEmail) {
      return errorResponse("Valid email required", 400, corsHeaders);
    }

    const { data: existing } = await supabase
      .from("leads")
      .select("id")
      .eq("business_id", businessId)
      .eq("email", validEmail)
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .maybeSingle();

    if (existing) {
      return secureJsonResponse(
        {
          success: true,
          message: "Already received",
          leadId: existing.id,
          duplicate: true,
        },
        200,
        corsHeaders,
      );
    }

    const { data: lead, error } = await supabase.from("leads").insert({
      business_id: businessId,
      email: validEmail,
      name: name || null,
      phone: phone || null,
      source,
      message: message || null,
      metadata,
    }).select().single();

    if (error) {
      console.error("[create-lead-lite] Insert error:", error);
      return errorResponse("Failed to create lead", 500, corsHeaders);
    }

    const { data: business } = await supabase
      .from("businesses")
      .select("name, notification_email")
      .eq("id", businessId)
      .maybeSingle();

    if (business?.notification_email) {
      await sendEmail(
        business.notification_email,
        `New Lead: ${name || validEmail}`,
        `<h2>New Lead</h2>
        <p><strong>Name:</strong> ${escapeHtml(name || "N/A")}</p>
        <p><strong>Email:</strong> ${escapeHtml(validEmail)}</p>
        <p><strong>Phone:</strong> ${escapeHtml(phone || "N/A")}</p>
        <p><strong>Source:</strong> ${escapeHtml(source)}</p>
        <p><strong>Message:</strong> ${escapeHtml(message || "N/A")}</p>
        <hr>
        <p style="color:#666">Lead ID: ${escapeHtml(lead.id)}</p>`,
        validEmail
      );
    }

    return secureJsonResponse(
      {
        success: true,
        message: "Thank you! We'll be in touch.",
        leadId: lead.id,
      },
      200,
      corsHeaders,
    );
  } catch (err) {
    console.error("[create-lead-lite] Error:", err);
    return errorResponse("Internal error", 500, corsHeaders);
  }
});
