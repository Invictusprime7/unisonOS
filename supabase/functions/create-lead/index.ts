import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { sendResendEmail, DEFAULT_FROM_EMAIL } from "../_shared/resend.ts";
import { publicCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { safeParseBody, sanitizeString, isValidUUID , escapeHtml } from "../_shared/validate.ts";
import { errorResponse, secureJsonResponse } from "../_shared/response.ts";
import { checkRateLimit, getClientIp, rateLimitHeaders } from "../_shared/rateLimit.ts";

const corsHeaders = publicCorsHeaders;
const RATE_LIMIT_CONFIG = { maxRequests: 20, windowSeconds: 300 };

interface LeadPayload {
  businessId: string;
  name?: string;
  email: string;
  phone?: string;
  source?: string;
  message?: string;
  metadata?: Record<string, unknown>;
}

type BusinessSettings = {
  id: string;
  name: string;
  notification_email: string | null;
};

function safeEmail(email: unknown): string | null {
  if (typeof email !== "string") return null;
  const trimmed = email.trim();
  if (!trimmed) return null;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(trimmed) ? trimmed : null;
}

function splitName(fullName?: string): { first: string | null; last: string | null } {
  const raw = (fullName || "").trim();
  if (!raw) return { first: null, last: null };
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return { first: parts[0].slice(0, 120), last: null };
  return {
    first: parts[0].slice(0, 120),
    last: parts.slice(1).join(" ").slice(0, 120),
  };
}

async function loadBusinessSettings(supabase: any, businessId: string): Promise<BusinessSettings | null> {
  const { data, error } = await supabase
    .from("businesses")
    .select("id,name,notification_email")
    .eq("id", businessId)
    .maybeSingle();

  if (error) {
    console.warn("[create-lead] failed to load business settings", error);
    return null;
  }
  if (!data?.id) return null;
  return data as BusinessSettings;
}

async function sendEmailSafe(params: {
  to: string;
  subject: string;
  html: string;
  replyTo?: string | null;
}) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    console.warn("[create-lead] RESEND_API_KEY missing; skipping email");
    return;
  }
  const r = await sendResendEmail({
      from: `Unison <${DEFAULT_FROM_EMAIL}>`,
    to: [params.to],
    subject: params.subject,
    html: params.html,
    reply_to: params.replyTo || undefined,
  });
    if (!r.ok) console.warn(`[create-lead] email not delivered: ${r.status} ${r.error ?? ""}`);
}

serve(async (req) => {
  const preflight = handleCorsPreflightRequest(req, corsHeaders);
  if (preflight) {
    return preflight;
  }

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405, corsHeaders);
  }

  const limiter = checkRateLimit("create-lead", getClientIp(req), RATE_LIMIT_CONFIG);
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    
    const { data: rawBody, error: parseError } = await safeParseBody<LeadPayload>(req, 32_768);
    if (parseError || !rawBody) {
      const status = parseError?.includes("exceeds") ? 413 : 400;
      return errorResponse(parseError || "Invalid request body", status, corsHeaders);
    }

    const body: LeadPayload = {
      ...rawBody,
      businessId: sanitizeString(rawBody.businessId || "", 100),
      name: sanitizeString(rawBody.name || "", 120) || undefined,
      email: sanitizeString(rawBody.email || "", 255),
      phone: sanitizeString(rawBody.phone || "", 40) || undefined,
      source: sanitizeString(rawBody.source || "", 120) || undefined,
      message: sanitizeString(rawBody.message || "", 2_000) || undefined,
      metadata: rawBody.metadata && typeof rawBody.metadata === "object" && !Array.isArray(rawBody.metadata) ? rawBody.metadata : {},
    };
    const { businessId, name, email, phone, source, message, metadata } = body;

    // Validate required fields
    if (!email) {
      return errorResponse("Email is required", 400, corsHeaders);
    }

    if (!businessId) {
      return errorResponse("Business ID is required", 400, corsHeaders);
    }

    // Validate businessId format early to avoid DB 22P02 errors
    if (!isValidUUID(businessId)) {
      return errorResponse("Invalid business ID", 400, corsHeaders);
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return errorResponse("Invalid email format", 400, corsHeaders);
    }

    // Insert lead into database
    const { data: lead, error: insertError } = await supabase
      .from("leads")
      .insert({
        business_id: businessId,
        name: name || null,
        email,
        phone: phone || null,
        source: source || 'web_form',
        message: message || null,
        metadata: metadata || {},
      })
      .select()
      .single();

    if (insertError) {
      console.error("Failed to create lead:", insertError);
      return errorResponse("Failed to submit form", 500, corsHeaders);
    }

    // Also create/update CRM entities (best-effort)
    try {
      const normalizedEmail = email.toLowerCase();
      const { first, last } = splitName(name);

      // Upsert contact by email (no unique constraint guaranteed; we take first match)
      const { data: existingContact } = await supabase
        .from("crm_contacts")
        .select("id")
        .eq("email", normalizedEmail)
        .eq("business_id", businessId)
        .limit(1)
        .maybeSingle();

      let contactId: string | null = existingContact?.id ?? null;
      if (contactId) {
        // Public submissions never overwrite an existing contact's details.
      } else {
        const { data: createdContact } = await supabase
          .from("crm_contacts")
          .insert({
            business_id: businessId,
            email: normalizedEmail,
            first_name: first,
            last_name: last,
            phone: phone || null,
            source: source || "web_form",
          })
          .select("id")
          .single();
        contactId = createdContact?.id ?? null;
      }

      const leadTitle = name?.trim()
        ? `${name.trim()} (${email})`
        : email;

      // NEW: Write to crm_leads with business_id, email, name, intent
      await supabase.from("crm_leads").insert({
        business_id: businessId,
        email: normalizedEmail,
        name: name?.trim() || null,
        intent: source || "lead_capture",
        contact_id: contactId,
        title: leadTitle,
        status: "new",
        source: source || "web_form",
        notes: message || null,
        value: null,
        metadata: metadata || {},
      });

      // CRM activity + owner follow-up task (Milestone 5)
      try {
        await supabase.from("crm_activities").insert({
          business_id: businessId,
          contact_id: contactId,
          activity_type: "lead_captured",
          title: `New lead: ${leadTitle}`,
          description: message || null,
          metadata: { source: source || "web_form", ...(metadata || {}) },
        });
      } catch (activityErr) {
        console.warn("[create-lead] activity insert failed", activityErr);
      }

      try {
        await supabase.from("tasks").insert({
          business_id: businessId,
          title: `Follow up with ${name?.trim() || email}`,
          description: message ? `Lead message: ${message}` : `New lead from ${source || "web_form"}`,
          status: "todo",
          priority: "high",
          due_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          metadata: { type: "follow_up", lead_email: normalizedEmail, contact_id: contactId },
        });
      } catch (taskErr) {
        console.warn("[create-lead] follow-up task insert failed", taskErr);
      }
    } catch (e) {
      console.warn("[create-lead] CRM create/update failed", e);
    }


    // Notifications (best-effort)
    try {
      const biz = await loadBusinessSettings(supabase, businessId);
      const internalTo = safeEmail(biz?.notification_email ?? null);

      // Customer confirmation (only if intent looks like newsletter/waitlist)
      const sourceStr = (source || "web_form").toLowerCase();
      const shouldConfirmCustomer =
        sourceStr.includes("newsletter") ||
        sourceStr.includes("waitlist") ||
        sourceStr.includes("beta");

      if (shouldConfirmCustomer) {
        await sendEmailSafe({
          to: email,
          subject: "You’re subscribed",
          html: `
            <div>
              <h1>Thanks for signing up</h1>
              <p>You’re on the list. We’ll be in touch soon.</p>
            </div>
          `,
          replyTo: internalTo,
        });
      }

      if (internalTo) {
        await sendEmailSafe({
          to: internalTo,
          subject: "New lead captured",
          html: `
            <div>
              <h1>New lead</h1>
              <p><strong>Business:</strong> ${biz?.name ?? businessId}</p>
              <p><strong>Email:</strong> ${escapeHtml(email)}</p>
              ${name ? `<p><strong>Name:</strong> ${escapeHtml(name)}</p>` : ""}
              ${phone ? `<p><strong>Phone:</strong> ${escapeHtml(phone)}</p>` : ""}
              <p><strong>Source:</strong> ${escapeHtml(source || "web_form")}</p>
              ${message ? `<p><strong>Message:</strong><br/>${escapeHtml(message)}</p>` : ""}
            </div>
          `,
          replyTo: internalTo,
        });
      }
    } catch (e) {
      console.warn("[create-lead] email notification failed", e);
    }

    // Optionally trigger workflows (check for active workflows)
    try {
      const { data: workflows } = await supabase
        .from("crm_workflows")
        .select("id, steps")
        .eq("trigger_type", "form_submission")
        .eq("is_active", true);

      if (workflows && workflows.length > 0) {
        // Trigger workflow for each matching workflow
        for (const workflow of workflows) {
          await supabase
            .from("crm_workflow_runs")
            .insert({
              workflow_id: workflow.id,
              status: "pending",
              trigger_data: {
                type: "lead_created",
                lead_id: lead.id,
                email,
                source,
              },
            });
        }
      }
    } catch (workflowError) {
      // Log but don't fail the request
      console.warn("Workflow trigger warning:", workflowError);
    }

    return secureJsonResponse({ 
        success: true, 
        data: { 
          id: lead.id,
          message: "Thank you! We'll be in touch soon." 
        }
      }, 200, corsHeaders);
  } catch (error) {
    console.error("Create lead error:", error);
    return errorResponse("Unable to process request. Please try again.", 500, corsHeaders);
  }
});
