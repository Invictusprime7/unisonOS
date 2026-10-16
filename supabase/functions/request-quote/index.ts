/**
 * request-quote — Milestone 5 outcome function.
 *
 * Persists a quote request as a CRM lead + deal, notifies the owner, sends
 * the visitor a confirmation, and creates a follow-up task.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { sendResendEmail, DEFAULT_FROM_EMAIL } from "../_shared/resend.ts";
import { publicCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { safeParseBody, isValidUUID } from "../_shared/validate.ts";
import { errorResponse, secureJsonResponse } from "../_shared/response.ts";
import { checkRateLimit, getClientIp, rateLimitHeaders } from "../_shared/rateLimit.ts";

const corsHeaders = publicCorsHeaders;
const RATE_LIMIT_CONFIG = { maxRequests: 10, windowSeconds: 300 };

interface QuotePayload {
  businessId: string;
  name?: string;
  email: string;
  phone?: string;
  serviceInterest?: string;
  budget?: string;
  timeline?: string;
  message?: string;
  metadata?: Record<string, unknown>;
}

function safeEmail(email: unknown): string | null {
  if (typeof email !== "string") return null;
  const trimmed = email.trim();
  if (!trimmed) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? trimmed : null;
}

async function sendEmailSafe(params: { to: string; subject: string; html: string; replyTo?: string | null }) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) return;
  try {
    const r = await sendResendEmail({
      from: `Unison Quotes <${DEFAULT_FROM_EMAIL}>`,
      to: [params.to],
      subject: params.subject,
      html: params.html,
      reply_to: params.replyTo || undefined,
    });
    if (!r.ok) console.warn(`[request-quote] email not delivered: ${r.status} ${r.error ?? ""}`);
  } catch (err) {
    console.warn("[request-quote] email send failed", err);
  }
}

serve(async (req) => {
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;

  const ip = getClientIp(req);
  const rate = await checkRateLimit(`quote:${ip}`, RATE_LIMIT_CONFIG);
  if (!rate.allowed) {
    return errorResponse("Too many requests", 429, { ...corsHeaders, ...rateLimitHeaders(rate) });
  }

  const parsed = await safeParseBody<QuotePayload>(req);
  if (!parsed.ok || !parsed.data) return errorResponse("Invalid body", 400, corsHeaders);
  const body = parsed.data;

  if (!body.businessId || !isValidUUID(body.businessId)) {
    return errorResponse("businessId required", 400, corsHeaders);
  }
  const normalizedEmail = safeEmail(body.email);
  if (!normalizedEmail) return errorResponse("Valid email required", 400, corsHeaders);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: biz } = await supabase
    .from("businesses")
    .select("id,name,notification_email")
    .eq("id", body.businessId)
    .maybeSingle();

  const leadTitle = `Quote: ${body.name?.trim() || normalizedEmail}${body.serviceInterest ? ` — ${body.serviceInterest}` : ""}`;

  // Contact
  let contactId: string | null = null;
  try {
    const { data: existing } = await supabase
      .from("crm_contacts")
      .select("id")
      .eq("email", normalizedEmail)
      .maybeSingle();
    if (existing?.id) {
      contactId = existing.id;
    } else {
      const [first, ...rest] = (body.name || "").trim().split(/\s+/);
      const { data: created } = await supabase
        .from("crm_contacts")
        .insert({
          email: normalizedEmail,
          first_name: first || null,
          last_name: rest.join(" ") || null,
          phone: body.phone || null,
          source: "quote_request",
        })
        .select("id")
        .single();
      contactId = created?.id ?? null;
    }
  } catch (e) {
    console.warn("[request-quote] contact upsert failed", e);
  }

  // Lead
  let leadId: string | null = null;
  try {
    const { data: lead } = await supabase
      .from("crm_leads")
      .insert({
        business_id: body.businessId,
        email: normalizedEmail,
        name: body.name?.trim() || null,
        intent: "quote_request",
        contact_id: contactId,
        title: leadTitle,
        status: "new",
        source: "quote_form",
        notes: body.message || null,
        metadata: {
          serviceInterest: body.serviceInterest || null,
          budget: body.budget || null,
          timeline: body.timeline || null,
          ...(body.metadata || {}),
        },
      })
      .select("id")
      .single();
    leadId = lead?.id ?? null;
  } catch (e) {
    console.warn("[request-quote] lead insert failed", e);
  }

  // Deal in "quote" stage
  try {
    await supabase.from("crm_deals").insert({
      business_id: body.businessId,
      contact_id: contactId,
      lead_id: leadId,
      title: leadTitle,
      stage: "quote",
      value: null,
      metadata: {
        serviceInterest: body.serviceInterest || null,
        budget: body.budget || null,
        timeline: body.timeline || null,
      },
    });
  } catch (e) {
    console.warn("[request-quote] deal insert failed", e);
  }

  // Activity + follow-up task
  try {
    await supabase.from("crm_activities").insert({
      business_id: body.businessId,
      contact_id: contactId,
      lead_id: leadId,
      activity_type: "quote_requested",
      title: leadTitle,
      description: body.message || null,
      metadata: { serviceInterest: body.serviceInterest || null },
    });
    await supabase.from("tasks").insert({
      business_id: body.businessId,
      title: `Send quote to ${body.name?.trim() || normalizedEmail}`,
      description: body.message || `Quote requested${body.serviceInterest ? ` for ${body.serviceInterest}` : ""}.`,
      status: "todo",
      priority: "high",
      due_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      metadata: { type: "follow_up", lead_id: leadId, contact_id: contactId },
    });
  } catch (e) {
    console.warn("[request-quote] activity/task insert failed", e);
  }

  // Notifications
  const ownerTo = safeEmail(biz?.notification_email);
  if (ownerTo) {
    await sendEmailSafe({
      to: ownerTo,
      subject: `New quote request — ${body.name?.trim() || normalizedEmail}`,
      replyTo: normalizedEmail,
      html: `
        <div>
          <h1>New quote request</h1>
          <p><strong>Business:</strong> ${biz?.name ?? body.businessId}</p>
          <p><strong>Name:</strong> ${escapeHtml(body.name || "—")}</p>
          <p><strong>Email:</strong> ${escapeHtml(normalizedEmail)}</p>
          ${body.phone ? `<p><strong>Phone:</strong> ${escapeHtml(body.phone)}</p>` : ""}
          ${body.serviceInterest ? `<p><strong>Interested in:</strong> ${escapeHtml(body.serviceInterest)}</p>` : ""}
          ${body.budget ? `<p><strong>Budget:</strong> ${escapeHtml(body.budget)}</p>` : ""}
          ${body.timeline ? `<p><strong>Timeline:</strong> ${escapeHtml(body.timeline)}</p>` : ""}
          ${body.message ? `<p><strong>Message:</strong><br/>${escapeHtml(body.message)}</p>` : ""}
        </div>
      `,
    });
  }

  await sendEmailSafe({
    to: normalizedEmail,
    subject: `We received your quote request${biz?.name ? ` — ${biz.name}` : ""}`,
    replyTo: ownerTo,
    html: `
      <div>
        <h1>Thanks for reaching out${body.name ? `, ${escapeHtml(body.name)}` : ""}</h1>
        <p>We received your request and will send a personalized quote within one business day.</p>
        ${body.serviceInterest ? `<p><strong>You asked about:</strong> ${escapeHtml(body.serviceInterest)}</p>` : ""}
        <p>Talk soon,<br/>${biz?.name ?? "The team"}</p>
      </div>
    `,
  });

  return secureJsonResponse(
    { success: true, data: { leadId, message: "Quote request received. We'll be in touch shortly." } },
    200,
    corsHeaders,
  );
});
