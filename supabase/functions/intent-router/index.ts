/**
 * INTENT ROUTER - Canonical execution surface for all CoreIntents
 * 
 * This is the single backend entrypoint that:
 * - Validates businessId and CoreIntent
 * - Persists CRM records (leads, contacts, etc.)
 * - Sends internal notifications using business settings
 * - Returns success/error payload to UI
 * 
 * Every CoreIntent from published templates routes through here.
 */

import { serve } from "serve";
import { createClient } from "@supabase/supabase-js";
import { publicCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { secureJsonResponse, errorResponse } from "../_shared/response.ts";
import { safeParseBody, isValidUUID, sanitizeString } from "../_shared/validate.ts";

// Navigation intents - client-side only, no backend persistence
const NAV_INTENTS = [
  "nav.goto",
  "nav.anchor",
  "nav.external",
] as const;

// Payment intents - create checkout sessions
const PAY_INTENTS = [
  "pay.checkout",
  "pay.success",
  "pay.cancel",
] as const;

// Action intents - CRM persistence + notifications + industry-scoped writes
const ACTION_INTENTS = [
  "contact.submit",
  "contact.call",
  "contact.email",
  "cta.primary",
  "cta.secondary",
  "quote.request",
  "newsletter.subscribe",
  "lead.capture",
  "cart.add",
  "cart.checkout",
  "donation.start",
] as const;

// Automation intents - event-driven workflow triggers
const AUTOMATION_INTENTS = [
  "button.click",
  "form.submit",
  "auth.login",
  "auth.register",
  "cart.add",
  "cart.checkout",
  "cart.abandoned",
  "booking.confirmed",
  "booking.reminder",
  "booking.cancelled",
  "booking.noshow",
  "order.created",
  "order.shipped",
  "order.delivered",
  "deal.won",
  "deal.lost",
  "proposal.sent",
  "job.completed",
] as const;

// Core Intents that are allowed in production
const CORE_INTENTS = [
  ...NAV_INTENTS,
  ...PAY_INTENTS,
  ...ACTION_INTENTS,
  ...AUTOMATION_INTENTS,
] as const;

type CoreIntent = typeof CORE_INTENTS[number];
type NavIntent = typeof NAV_INTENTS[number];
type PayIntent = typeof PAY_INTENTS[number];
type ActionIntent = typeof ACTION_INTENTS[number];
type AutomationIntent = typeof AUTOMATION_INTENTS[number];

interface IntentPayload {
  intent: string;
  businessId: string;
  projectId?: string;
  data: Record<string, any>;
  source?: "preview" | "published" | "api";
  sourceUrl?: string;
  visitorId?: string;
}

interface IntentResult {
  success: boolean;
  message?: string;
  error?: string;
  data?: Record<string, any>;
}

// Validate that intent is a CoreIntent
function isCoreIntent(intent: string): intent is CoreIntent {
  return CORE_INTENTS.includes(intent as CoreIntent);
}

// Get Supabase admin client
function getSupabaseAdmin() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing Supabase environment variables");
  }
  
  return createClient(supabaseUrl, supabaseServiceKey);
}

// Load business settings for notification dispatch + industry-scoped routing
async function loadBusinessSettings(supabase: any, businessId: string) {
  // industry drives per-vertical intent handling (restaurant booking uses
  // party_size + reservation naming; ecommerce cart.checkout writes orders;
  // nonprofit donation.start writes crm_lead with donation source).
  const { data, error } = await supabase
    .from("businesses")
    .select("id, name, notification_email, notification_phone, owner_id, industry")
    .eq("id", businessId)
    .maybeSingle();
  
  if (error) {
    console.error("[intent-router] Failed to load business settings:", error);
    return null;
  }
  
  // If no notification_email is set, try to get the owner's email from auth
  if (data && !data.notification_email && data.owner_id) {
    console.log("[intent-router] No notification_email, checking owner profile...");
    // Try to get owner's email from profiles or auth metadata
    const { data: profile } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", data.owner_id)
      .maybeSingle();
    
    if (profile?.email) {
      data.notification_email = profile.email;
      console.log("[intent-router] Using owner profile email:", profile.email);
    }
  }
  
  return data;
}

// Get email provider configuration for a business
async function getEmailProvider(supabase: any, businessId: string) {
  // Check installed_packs for email configuration
  const { data: pack } = await supabase
    .from("installed_packs")
    .select("config")
    .eq("business_id", businessId)
    .eq("pack_id", "email")
    .eq("status", "active")
    .maybeSingle();
  
  if (pack?.config) {
    return pack.config;
  }
  
  // Fallback: check business owner's user_settings for legacy email setup
  const { data: biz } = await supabase
    .from("businesses")
    .select("owner_id")
    .eq("id", businessId)
    .maybeSingle();
  
  if (biz?.owner_id) {
    const { data: settings } = await supabase
      .from("user_settings")
      .select("settings")
      .eq("user_id", biz.owner_id)
      .maybeSingle();
    
    if (settings?.settings?.emailProvider) {
      return {
        provider: settings.settings.emailProvider,
        configured: settings.settings[`${settings.settings.emailProvider}_configured`] || false,
      };
    }
  }
  
  return null;
}

// Send notification email using Resend
async function sendNotificationEmail(
  to: string,
  subject: string,
  html: string,
  replyTo?: string | null
): Promise<boolean> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  
  if (!apiKey) {
    console.warn("[intent-router] RESEND_API_KEY not configured, skipping email");
    return false;
  }
  
  try {
    const response = await fetch("https://connector-gateway.lovable.dev/resend/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY") ?? ""}`, "X-Connection-Api-Key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `Notifications <${Deno.env.get("RESEND_FROM_EMAIL") || "onboarding@resend.dev"}>`,
        to: [to],
        subject,
        html,
        reply_to: replyTo || undefined,
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("[intent-router] Resend API error:", response.status, errorText);
      return false;
    }
    
    const result = await response.json();
    console.log("[intent-router] Email sent successfully:", result.id);
    return true;
  } catch (error) {
    console.error("[intent-router] Failed to send email:", error);
    return false;
  }
}

// Create a CRM lead record
async function createLead(
  supabase: any,
  businessId: string,
  projectId: string | undefined,
  data: Record<string, any>
) {
  // First try the 'leads' table (simpler schema)
  const leadsData = {
    business_id: businessId,
    email: data.email || "",
    name: data.name || data.fullName || null,
    phone: data.phone || data.phoneNumber || null,
    message: data.message || data.notes || null,
    source: data.source || "website",
    metadata: {
      projectId: projectId || null,
      firstName: data.firstName || data.first_name || null,
      lastName: data.lastName || data.last_name || null,
      company: data.company || data.organization || null,
      sourceUrl: data.sourceUrl || null,
      rawData: data,
    },
  };
  
  const { data: lead, error } = await supabase
    .from("leads")
    .insert(leadsData)
    .select()
    .single();
  
  if (!error) {
    return lead;
  }
  
  console.log("[intent-router] leads insert failed, trying crm_leads:", error.message);
  
  // Fallback to crm_leads table (different schema)
  const crmLeadsData = {
    business_id: businessId,
    email: data.email || null,
    name: data.name || data.fullName || null,
    status: "new",
    source: data.source || "website",
    notes: data.message || data.notes || null,
    intent: data.intent || null,
    metadata: {
      projectId: projectId || null,
      phone: data.phone || data.phoneNumber || null,
      firstName: data.firstName || data.first_name || null,
      lastName: data.lastName || data.last_name || null,
      company: data.company || data.organization || null,
      sourceUrl: data.sourceUrl || null,
      rawData: data,
    },
  };
  
  const { data: crmLead, error: crmError } = await supabase
    .from("crm_leads")
    .insert(crmLeadsData)
    .select()
    .single();
  
  if (crmError) {
    console.error("[intent-router] Failed to create lead:", crmError);
    throw new Error(`Failed to save lead: ${crmError.message || crmError.code || 'Unknown database error'}`);
  }
  
  return crmLead;
}

// Record intent execution for audit/analytics
async function recordIntentExecution(
  supabase: any,
  payload: IntentPayload,
  result: IntentResult,
  durationMs: number
) {
  try {
    await supabase.from("intent_executions").insert({
      business_id: payload.businessId,
      project_id: payload.projectId || null,
      intent_name: payload.intent,
      intent_payload: payload.data,
      source: payload.source || "published",
      source_url: payload.sourceUrl || null,
      visitor_id: payload.visitorId || null,
      status: result.success ? "success" : "failed",
      result: result.data || null,
      error_message: result.error || null,
      duration_ms: durationMs,
      created_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    });
  } catch (e) {
    console.warn("[intent-router] Failed to record execution:", e);
  }
}

// Handle contact.submit intent
async function handleContactSubmit(
  supabase: any,
  businessId: string,
  projectId: string | undefined,
  data: Record<string, any>
): Promise<IntentResult> {
  const customerEmail = data.email || data.customerEmail || "";
  const customerName = data.name || data.firstName || data.customerName || "";
  
  // 1. Create lead record
  const lead = await createLead(supabase, businessId, projectId, data);
  
  // 2. Load business settings for notification
  const bizSettings = await loadBusinessSettings(supabase, businessId);
  const notificationEmail = bizSettings?.notification_email;
  const businessName = bizSettings?.name || "Your Business";
  
  // 3. Send notification email to business owner
  if (notificationEmail) {
    const subject = `New Contact: ${customerName || customerEmail} - ${businessName}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333; border-bottom: 2px solid #4f46e5; padding-bottom: 10px;">
          New Contact Form Submission
        </h2>
        
        <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Name:</strong> ${escapeHtml(customerName || "Not provided")}</p>
          <p><strong>Email:</strong> <a href="mailto:${escapeHtml(customerEmail)}">${escapeHtml(customerEmail || "Not provided")}</a></p>
          <p><strong>Phone:</strong> ${data.phone ? `<a href="tel:${escapeHtml(data.phone)}">${escapeHtml(data.phone)}</a>` : "Not provided"}</p>
        </div>
        
        <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Message</h3>
          <p>${escapeHtml(data.message || "No message provided")}</p>
        </div>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
        <p style="color: #6b7280; font-size: 12px;">
          Lead ID: ${lead.id}<br/>
          Reply to this email to contact them directly.
        </p>
      </div>
    `;
    
    await sendNotificationEmail(notificationEmail, subject, html, customerEmail);
    console.log("[intent-router] Contact notification sent to:", notificationEmail);
  } else {
    console.warn("[intent-router] No notification_email for business:", businessId);
  }
  
  // 4. Send confirmation to customer
  if (customerEmail) {
    const customerSubject = `Thanks for reaching out to ${businessName}`;
    const customerHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">We received your message!</h2>
        <p>Hi ${escapeHtml(customerName || "there")},</p>
        <p>Thank you for contacting ${escapeHtml(businessName)}. We've received your message and will get back to you as soon as possible.</p>
        <p style="color: #6b7280; font-size: 14px;">Reference: ${escapeHtml(lead.id)}</p>
      </div>
    `;
    await sendNotificationEmail(customerEmail, customerSubject, customerHtml, notificationEmail || undefined);
  }
  
  return {
    success: true,
    message: "Thank you! We'll be in touch soon.",
    data: { leadId: lead.id },
  };
}

// Handle newsletter.subscribe intent
async function handleNewsletterSubscribe(
  supabase: any,
  businessId: string,
  projectId: string | undefined,
  data: Record<string, any>
): Promise<IntentResult> {
  if (!data.email) {
    return { success: false, error: "Email is required" };
  }
  
  // Check for existing subscription
  const { data: existing } = await supabase
    .from("newsletter_subscribers")
    .select("id")
    .eq("business_id", businessId)
    .eq("email", data.email)
    .maybeSingle();
  
  if (existing) {
    return { success: true, message: "You're already subscribed!" };
  }
  
  // Create subscription
  const { data: subscriber, error } = await supabase
    .from("newsletter_subscribers")
    .insert({
      business_id: businessId,
      project_id: projectId || null,
      email: data.email,
      name: data.name || null,
      status: "active",
      source: data.source || "website",
      created_at: new Date().toISOString(),
    })
    .select()
    .single();
  
  if (error) {
    // Table might not exist - just record as a lead
    await createLead(supabase, businessId, projectId, {
      ...data,
      source: "newsletter_signup",
    });
    
    return {
      success: true,
      message: "Thanks for subscribing!",
    };
  }
  
  return {
    success: true,
    message: "Thanks for subscribing!",
    data: { subscriberId: subscriber.id },
  };
}

// Handle quote.request intent
async function handleQuoteRequest(
  supabase: any,
  businessId: string,
  projectId: string | undefined,
  data: Record<string, any>
): Promise<IntentResult> {
  const customerEmail = data.email || data.customerEmail || "";
  const customerName = data.name || data.customerName || "";
  const customerPhone = data.phone || data.customerPhone || null;
  
  // Create lead with quote context
  const lead = await createLead(supabase, businessId, projectId, {
    email: customerEmail,
    name: customerName,
    phone: customerPhone,
    message: data.details || data.message || data.requirements || null,
    source: "quote_request",
  });
  
  // Load business settings
  const bizSettings = await loadBusinessSettings(supabase, businessId);
  const notificationEmail = bizSettings?.notification_email;
  const businessName = bizSettings?.name || "Your Business";
  
  // Send notification to business
  if (notificationEmail) {
    const subject = `New Quote Request - ${businessName}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333; border-bottom: 2px solid #f59e0b; padding-bottom: 10px;">
          New Quote Request
        </h2>
        
        <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #4f46e5;">Customer Details</h3>
          <p><strong>Name:</strong> ${escapeHtml(customerName || "Not provided")}</p>
          <p><strong>Email:</strong> <a href="mailto:${escapeHtml(customerEmail)}">${escapeHtml(customerEmail || "Not provided")}</a></p>
          <p><strong>Phone:</strong> ${customerPhone ? `<a href="tel:${escapeHtml(customerPhone)}">${escapeHtml(customerPhone)}</a>` : "Not provided"}</p>
          <p><strong>Company:</strong> ${escapeHtml(data.company || "Not provided")}</p>
        </div>
        
        <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #92400e;">Quote Details</h3>
          <p>${escapeHtml(data.details || data.message || data.requirements || "No details provided")}</p>
        </div>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
        <p style="color: #6b7280; font-size: 12px;">
          Lead ID: ${lead.id}<br/>
          Reply to this email to contact them directly.
        </p>
      </div>
    `;
    
    await sendNotificationEmail(notificationEmail, subject, html, customerEmail);
    console.log("[intent-router] Quote notification sent to:", notificationEmail);
  } else {
    console.warn("[intent-router] No notification_email for business:", businessId);
  }
  
  // Send confirmation to customer
  if (customerEmail) {
    const customerSubject = `Quote Request Received - ${businessName}`;
    const customerHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">We've received your quote request!</h2>
        <p>Hi ${escapeHtml(customerName || "there")},</p>
        <p>Thank you for reaching out to ${escapeHtml(businessName)}. We've received your quote request and will get back to you with a personalized quote as soon as possible.</p>
        <p style="color: #6b7280; font-size: 14px;">Reference: ${escapeHtml(lead.id)}</p>
      </div>
    `;
    await sendNotificationEmail(customerEmail, customerSubject, customerHtml, notificationEmail || undefined);
  }
  
  return {
    success: true,
    message: "Quote request received! We'll get back to you with a quote soon.",
    data: { leadId: lead.id },
  };
}

// Handle CTA intents (primary/secondary)
async function handleCTA(
  supabase: any,
  businessId: string,
  projectId: string | undefined,
  data: Record<string, any>,
  ctaType: "primary" | "secondary"
): Promise<IntentResult> {
  // CTAs typically navigate or trigger actions, but if they capture data...
  if (data.email || data.name || data.phone) {
    await createLead(supabase, businessId, projectId, {
      ...data,
      source: `cta_${ctaType}`,
    });
  }
  
  // Record the CTA click
  await supabase.from("cta_clicks").insert({
    business_id: businessId,
    project_id: projectId || null,
    cta_type: ctaType,
    cta_label: data.label || data.ctaLabel || null,
    cta_action: data.action || data.href || null,
    visitor_id: data.visitorId || null,
    created_at: new Date().toISOString(),
  }).catch(() => {
    // Table might not exist - that's okay
  });
  
  return {
    success: true,
    message: "Action recorded",
    data: { ctaType },
  };
}

// Handle cart.add intent - append item to cart_items for the visitor session.
async function handleCartAdd(
  supabase: any,
  _businessId: string,
  _projectId: string | undefined,
  data: Record<string, any>
): Promise<IntentResult> {
  const productId = String(data.productId || data.product_id || "");
  const sessionId = typeof (data.sessionId || data.session_id || data.visitorId) === "string"
    ? String(data.sessionId || data.session_id || data.visitorId).slice(0, 200)
    : "";
  const quantity = Number(data.quantity || 1);

  if (!/^[0-9a-f-]{36}$/i.test(productId)) {
    return { success: false, error: "A valid productId is required for cart.add" };
  }
  if (!sessionId) {
    return { success: false, error: "sessionId is required for cart.add" };
  }
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
    return { success: false, error: "Quantity must be between 1 and 100" };
  }
  const { data: product } = await supabase
    .from("products")
    .select("id")
    .eq("id", productId)
    .eq("business_id", _businessId)
    .eq("is_active", true)
    .maybeSingle();
  if (!product) {
    return { success: false, error: "Product is unavailable" };
  }

  // Visitor carts are bound to the session; never trust a client-sent user id.
  const { data: item, error } = await supabase
    .from("cart_items")
    .insert({
      session_id: sessionId,
      user_id: null,
      product_id: productId,
      quantity,
    })
    .select("id")
    .single();

  if (error) {
    console.warn("[intent-router] cart_items insert failed:", error.message);
    return { success: false, error: error.message };
  }

  return {
    success: true,
    message: "Added to cart",
    data: { itemId: item?.id, productId, quantity },
  };
}

// Handle cart.checkout — persist an order row (ecommerce industry writes).
// For sites with Stripe wired the client should follow up with create-checkout;
// this handler guarantees a durable order record either way.
async function handleCartCheckout(
  supabase: any,
  businessId: string,
  projectId: string | undefined,
  data: Record<string, any>
): Promise<IntentResult> {
  const items = Array.isArray(data.items) ? data.items : [];
  const subtotal = Number(data.subtotal || data.total || 0);
  const total = Number(data.total || subtotal || 0);
  const customerEmail = data.customerEmail || data.email || null;
  const customerName = data.customerName || data.name || null;

  const { data: order, error } = await supabase
    .from("orders")
    .insert({
      business_id: businessId,
      user_id: data.userId || null,
      session_id: data.sessionId || data.visitorId || null,
      customer_email: customerEmail,
      customer_name: customerName,
      items,
      subtotal,
      tax: Number(data.tax || 0),
      total,
      currency: (data.currency || "USD").toString().toUpperCase().slice(0, 3),
      status: "pending",
      metadata: { projectId: projectId || null, source: data._source || "published" },
    })
    .select("id")
    .single();

  if (error) {
    console.error("[intent-router] orders insert failed:", error);
    return { success: false, error: error.message };
  }

  // Best-effort: also create a lead so the sale shows up in the CRM.
  if (customerEmail || customerName) {
    await createLead(supabase, businessId, projectId, {
      email: customerEmail,
      name: customerName,
      source: "cart_checkout",
      message: `Order ${order?.id} for ${items.length} item(s), total ${total}`,
    }).catch(() => undefined);
  }

  return {
    success: true,
    message: "Order created",
    data: { orderId: order?.id, total },
  };
}

// Handle donation.start — nonprofit-specific: capture donor intent as a lead.
async function handleDonationStart(
  supabase: any,
  businessId: string,
  projectId: string | undefined,
  data: Record<string, any>
): Promise<IntentResult> {
  const lead = await createLead(supabase, businessId, projectId, {
    email: data.email || data.customerEmail || null,
    name: data.name || data.donorName || null,
    phone: data.phone || null,
    message: `Donation intent: ${data.amount || "unspecified"} ${data.currency || "USD"}${data.campaign ? ` — ${data.campaign}` : ""}`,
    source: "donation",
  });
  return {
    success: true,
    message: "Thanks for your support!",
    data: { leadId: lead?.id },
  };
}

// Handle button.click intent - generic button automation trigger
async function handleButtonClick(
  supabase: any,
  businessId: string,
  projectId: string | undefined,
  data: Record<string, any>
): Promise<IntentResult> {
  const buttonId = data.buttonId || data.button_id || "";
  const buttonLabel = data.buttonLabel || data.button_label || "";
  const buttonType = data.buttonType || data.button_type || "button";
  
  // Record the button click for analytics
  await supabase.from("button_clicks").insert({
    business_id: businessId,
    project_id: projectId || null,
    button_id: buttonId,
    button_label: buttonLabel,
    button_type: buttonType,
    button_class: data.classList || null,
    aria_label: data.ariaLabel || null,
    visitor_id: data.visitorId || null,
    metadata: data,
    created_at: new Date().toISOString(),
  }).catch((err: any) => {
    // Table might not exist - that's okay, log and continue
    console.log("[intent-router] button_clicks table not available:", err.message);
  });
  
  // If button has contact data, create a lead
  if (data.email || data.phone || data.name) {
    try {
      const lead = await createLead(supabase, businessId, projectId, {
        ...data,
        source: `button_${buttonId || buttonLabel || 'click'}`,
      });
      return {
        success: true,
        message: "Button action processed",
        data: { buttonId, buttonLabel, leadId: lead?.id },
      };
    } catch (err) {
      console.warn("[intent-router] Lead creation from button failed:", err);
    }
  }
  
  // Button click recorded - automation engine will handle workflows
  return {
    success: true,
    message: "Button action recorded",
    data: { buttonId, buttonLabel, buttonType },
  };
}

// Main intent router
async function routeIntent(payload: IntentPayload): Promise<IntentResult> {
  const supabase = getSupabaseAdmin();
  const startTime = Date.now();
  
  // Validate required fields
  if (!payload.businessId) {
    return { success: false, error: "businessId is required" };
  }
  
  if (!payload.intent) {
    return { success: false, error: "intent is required" };
  }
  
  // Check if this is a CoreIntent (production-allowed)
  if (!isCoreIntent(payload.intent)) {
    // Non-core intents only work in preview mode
    if (payload.source !== "preview") {
      return {
        success: false,
        error: `Intent "${payload.intent}" is not a CoreIntent. Only CoreIntents are allowed in production.`,
      };
    }
    
    // Allow in preview but log warning
    console.log(`[intent-router] Non-core intent "${payload.intent}" allowed in preview mode`);
  }
  
  let result: IntentResult;
  
  // Add source to data for preview mode handling
  const dataWithSource: Record<string, any> = { ...payload.data, _source: payload.source };
  
  try {
    // Route to appropriate handler
    switch (payload.intent) {
      case "contact.submit":
      case "lead.capture":
        result = await handleContactSubmit(supabase, payload.businessId, payload.projectId, dataWithSource);
        break;
      
      case "newsletter.subscribe":
        result = await handleNewsletterSubscribe(supabase, payload.businessId, payload.projectId, dataWithSource);
        break;
      
      case "quote.request":
        result = await handleQuoteRequest(supabase, payload.businessId, payload.projectId, dataWithSource);
        break;
      
      case "cta.primary":
        result = await handleCTA(supabase, payload.businessId, payload.projectId, dataWithSource, "primary");
        break;
      
      case "cta.secondary":
        result = await handleCTA(supabase, payload.businessId, payload.projectId, dataWithSource, "secondary");
        break;
      
      case "cart.add":
        result = await handleCartAdd(supabase, payload.businessId, payload.projectId, dataWithSource);
        break;
      
      case "cart.checkout":
        result = await handleCartCheckout(supabase, payload.businessId, payload.projectId, dataWithSource);
        break;
      
      case "donation.start":
        result = await handleDonationStart(supabase, payload.businessId, payload.projectId, dataWithSource);
        break;
      
      
      case "contact.call":
      case "contact.email":
        // These are typically client-side actions (tel: or mailto: links)
        // Just record the intent
        result = { success: true, message: "Intent recorded" };
        break;
      
      case "button.click":
        // Generic button click - route to automation engine
        result = await handleButtonClick(supabase, payload.businessId, payload.projectId, dataWithSource);
        break;
      
      case "form.submit":
        // Generic form submission - treat as lead capture
        result = await handleContactSubmit(supabase, payload.businessId, payload.projectId, dataWithSource);
        break;
      
      case "auth.login":
      case "auth.register":
        // Auth intents - record but don't process (handled by auth system)
        result = { success: true, message: "Auth intent recorded", data: { handled: false } };
        break;
      
      default:
        // Unknown intent - record as generic lead if it has contact info
        if ((dataWithSource as any).email || (dataWithSource as any).phone) {
          await createLead(supabase, payload.businessId, payload.projectId, {
            ...dataWithSource,
            source: payload.intent,
          });
        }
        result = { success: true, message: "Intent processed" };
    }
  } catch (error: any) {
    console.error("[intent-router] Error processing intent:", error);
    result = {
      success: false,
      error: error.message || "Failed to process intent",
    };
  }
  
  // Record execution for analytics
  const durationMs = Date.now() - startTime;
  await recordIntentExecution(supabase, payload, result, durationMs);
  
  // Trigger automation event for workflow processing
  if (result.success) {
    try {
      await triggerAutomationEvent(supabase, payload, result);
    } catch (autoErr) {
      console.warn("[intent-router] Automation trigger failed (non-blocking):", autoErr);
    }
  }
  
  return result;
}

// Trigger automation event for workflow processing
async function triggerAutomationEvent(
  supabase: any,
  payload: IntentPayload,
  result: IntentResult
) {
  // Create automation event for the intent
  const dedupeKey = `${payload.businessId}:${payload.intent}:${Date.now()}:${Math.random().toString(36).substring(7)}`;
  
  // Fire the automation event
  const { error } = await supabase.functions.invoke("automation-event", {
    body: {
      businessId: payload.businessId,
      intent: payload.intent,
      payload: {
        ...payload.data,
        projectId: payload.projectId,
        source: payload.source,
        sourceUrl: payload.sourceUrl,
        visitorId: payload.visitorId,
        intentResult: result.data,
      },
      dedupeKey,
      source: payload.source || "template",
      sourceUrl: payload.sourceUrl,
    },
  });
  
  if (error) {
    console.warn("[intent-router] Failed to trigger automation event:", error);
  } else {
    console.log("[intent-router] Automation event triggered for:", payload.intent);
  }
}

// HTTP server
serve(async (req) => {
  const preflight = handleCorsPreflightRequest(req, publicCorsHeaders);
  if (preflight) {
    return preflight;
  }
  
  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405, publicCorsHeaders);
  }
  
  try {
    const { data: rawPayload, error: parseError } = await safeParseBody<IntentPayload>(req, 65_536);
    if (parseError || !rawPayload) {
      const status = parseError?.includes("exceeds") ? 413 : 400;
      return errorResponse(parseError || "Invalid JSON body", status, publicCorsHeaders);
    }

    const payload: IntentPayload = {
      ...rawPayload,
      intent: typeof rawPayload.intent === "string" ? sanitizeString(rawPayload.intent, 100) : "",
      businessId: typeof rawPayload.businessId === "string"
        ? sanitizeString(rawPayload.businessId, 100)
        : "",
      projectId: typeof rawPayload.projectId === "string"
        ? sanitizeString(rawPayload.projectId, 100)
        : undefined,
      sourceUrl: typeof rawPayload.sourceUrl === "string"
        ? sanitizeString(rawPayload.sourceUrl, 2000)
        : undefined,
      visitorId: typeof rawPayload.visitorId === "string"
        ? sanitizeString(rawPayload.visitorId, 200)
        : undefined,
    };

    // Validate required fields
    if (!payload.intent || !payload.businessId) {
      return errorResponse("intent and businessId are required", 400, publicCorsHeaders);
    }

    // Validate businessId format (UUID)
    if (!isValidUUID(payload.businessId)) {
      return errorResponse("Invalid businessId format", 400, publicCorsHeaders);
    }

    const result = await routeIntent(payload);
    
    return secureJsonResponse(result as unknown as Record<string, unknown>, result.success ? 200 : 400, publicCorsHeaders);
  } catch (error: any) {
    console.error("[intent-router] Request error:", error);
    
    // Don't expose internal error details to clients
    return errorResponse("An unexpected error occurred. Please try again.", 500, publicCorsHeaders);
  }
});
