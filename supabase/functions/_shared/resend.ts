/**
 * Single Resend transport for every Unison site email. Routes through the
 * Lovable connector gateway (the linked RESEND_API_KEY is a gateway key, not
 * a raw Resend key). Returns delivery truth; never claims success on failure.
 */
const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";

export const DEFAULT_FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") || "onboarding@resend.dev";

export interface ResendEmail {
  from?: string;
  to: string | string[];
  subject: string;
  html: string;
  reply_to?: string;
}

export interface ResendResult {
  ok: boolean;
  status: number;
  id?: string;
  error?: string;
}

export function isResendConfigured(): boolean {
  return Boolean(Deno.env.get("LOVABLE_API_KEY") && Deno.env.get("RESEND_API_KEY"));
}

export async function sendResendEmail(email: ResendEmail): Promise<ResendResult> {
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!lovableKey || !resendKey) return { ok: false, status: 0, error: "Email delivery is not set up" };
  const res = await fetch(`${GATEWAY_URL}/emails`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": resendKey,
    },
    body: JSON.stringify({
      ...email,
      from: email.from || `Unison <${DEFAULT_FROM_EMAIL}>`,
      to: Array.isArray(email.to) ? email.to : [email.to],
      reply_to: email.reply_to || undefined,
    }),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`[resend] ${res.status}: ${text}`);
    return { ok: false, status: res.status, error: text };
  }
  let id: string | undefined;
  try { id = JSON.parse(text).id; } catch { /* ignore */ }
  return { ok: true, status: res.status, id };
}
