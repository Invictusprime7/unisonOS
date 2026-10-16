/**
 * SEND AUTOMATION EMAIL
 *
 * Internal-only transport for recipe/automation emails (recipeExecutor send_email).
 * Delivers through Resend with the project's RESEND_API_KEY. Only callable with
 * the service-role key or CRON_SECRET — never from browser code.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const TEMPLATES: Record<string, { subject: string; body: string }> = {
  booking_confirm_email: { subject: "Your booking with {{business}} is confirmed", body: "Hi {{name}},<br/><br/>Your booking{{serviceLine}}{{whenLine}} is confirmed. We look forward to seeing you." },
  quote_received: { subject: "We received your quote request", body: "Hi {{name}},<br/><br/>Thanks for reaching out to {{business}}. We received your request and will reply with a quote shortly." },
  job_complete_invoice: { subject: "Your job with {{business}} is complete", body: "Hi {{name}},<br/><br/>Your job is complete. Thank you for choosing {{business}} — your invoice will follow separately." },
  noshow_followup: { subject: "We missed you at {{business}}", body: "Hi {{name}},<br/><br/>We missed you today. Reply to this email if you'd like to rebook." },
  cart_reminder: { subject: "You left something in your cart", body: "Hi {{name}},<br/><br/>Your cart at {{business}} is still waiting for you." },
  cart_discount: { subject: "Still thinking it over?", body: "Hi {{name}},<br/><br/>Your cart at {{business}} is saved. Come back whenever you're ready." },
  order_confirm: { subject: "Your {{business}} order is confirmed", body: "Hi {{name}},<br/><br/>Thanks for your order{{orderLine}}. We'll let you know when it ships." },
  order_shipped: { subject: "Your {{business}} order has shipped", body: "Hi {{name}},<br/><br/>Good news — your order{{orderLine}} is on its way." },
  consultation_confirm: { subject: "Your consultation with {{business}} is confirmed", body: "Hi {{name}},<br/><br/>Your consultation{{whenLine}} is confirmed." },
  proposal_followup: { subject: "Following up on your proposal", body: "Hi {{name}},<br/><br/>Just checking in on the proposal from {{business}}. Reply with any questions." },
  welcome_client: { subject: "Welcome to {{business}}", body: "Hi {{name}},<br/><br/>Welcome! We're glad to be working with you." },
};

const esc = (v: unknown) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

const json = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE = /^[0-9a-f-]{36}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const auth = req.headers.get("authorization");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!((serviceKey && auth === `Bearer ${serviceKey}`) || (cronSecret && auth === `Bearer ${cronSecret}`))) {
    return json(401, { error: "Unauthorized" });
  }

  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) return json(200, { delivered: false, status: "unconfigured", error: "Email delivery is not set up yet; nothing was sent." });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json(400, { error: "Invalid JSON" }); }

  const template = typeof body.template === "string" ? body.template : "";
  const to = typeof body.to === "string" ? body.to.trim() : "";
  const businessId = typeof body.businessId === "string" ? body.businessId : "";
  const ctx = (body.context && typeof body.context === "object" ? body.context : {}) as Record<string, unknown>;

  const tpl = TEMPLATES[template];
  if (!tpl) return json(400, { delivered: false, status: "failed", error: `Unknown email template: ${template}` });
  if (!EMAIL_RE.test(to) || to.length > 320) return json(400, { delivered: false, status: "failed", error: "Invalid recipient email" });

  let businessName = "Our team";
  let fromName: string | null = null;
  let fromEmail: string | null = null;
  if (UUID_RE.test(businessId) && serviceKey) {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey, { auth: { persistSession: false } });
    const [{ data: biz }, { data: settings }] = await Promise.all([
      admin.from("businesses").select("name").eq("id", businessId).maybeSingle(),
      admin.from("business_automation_settings").select("default_sender_name, default_sender_email").eq("business_id", businessId).maybeSingle(),
    ]);
    if (biz?.name) businessName = biz.name;
    fromName = settings?.default_sender_name ?? null;
    fromEmail = settings?.default_sender_email ?? null;
  }

  const vars: Record<string, string> = {
    business: esc(businessName),
    name: esc(ctx.contactName || "there"),
    serviceLine: ctx.service ? ` for ${esc(ctx.service)}` : "",
    whenLine: ctx.scheduledAt ? ` on ${esc(new Date(String(ctx.scheduledAt)).toUTCString())}` : "",
    orderLine: ctx.orderId ? ` (#${esc(ctx.orderId)})` : "",
  };
  const fill = (s: string) => s.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "");
  const subject = fill(tpl.subject).replace(/&amp;/g, "&");
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#111">${fill(tpl.body)}<br/><br/>— ${vars.business}</div>`;

  const from = `${fromName || businessName} <${fromEmail || (Deno.env.get("RESEND_FROM_EMAIL") || "onboarding@resend.dev")}>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`[send-automation-email] Resend ${res.status}: ${text}`);
    return json(200, { delivered: false, status: "failed", providerStatus: res.status, error: text });
  }
  let id: string | undefined;
  try { id = JSON.parse(text).id; } catch { /* ignore */ }
  return json(200, { delivered: true, status: "sent", provider: "resend", emailId: id, to, subject });
});
