import { withSupabase } from "npm:@supabase/server@1";
import { createChatCompletion, isTextGenerationConfigured } from "../_shared/ai/providerClient.ts";
import { DEFAULT_GEMINI_GATEWAY_MODEL } from "../_shared/geminiModel.ts";
import { checkRateLimit, getClientIp, rateLimitHeaders } from "../_shared/rateLimit.ts";
import { safeParseBody, sanitizeString } from "../_shared/validate.ts";

const RATE_LIMIT = { maxRequests: 12, windowSeconds: 60 };
const CAPABILITIES = new Set([
  "booking",
  "commerce",
  "authentication",
  "lead-capture",
  "content-management",
]);

function parseJson(content: string): Record<string, unknown> | null {
  const trimmed = content.trim();
  const json = trimmed.startsWith("```")
    ? trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")
    : trimmed;
  try {
    const parsed: unknown = JSON.parse(json);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

export default {
  fetch: withSupabase({ auth: "user" }, async (req) => {
    if (req.method !== "POST") return Response.json({ success: false, error: "Method not allowed" }, { status: 405 });
    const rate = checkRateLimit("universal-creation-plan", getClientIp(req), RATE_LIMIT);
    if (!rate.allowed) {
      return Response.json(
        { success: false, error: "Too many planning requests. Try again shortly." },
        { status: 429, headers: rateLimitHeaders(rate, RATE_LIMIT) },
      );
    }
    if (!isTextGenerationConfigured()) {
      return Response.json({ success: false, error: "AI planning is temporarily unavailable" }, { status: 503 });
    }

    const { data: body, error } = await safeParseBody<Record<string, unknown>>(req, 16_384);
    if (error || !body || typeof body.prompt !== "string") {
      return Response.json({ success: false, error: "A site prompt is required" }, { status: 400 });
    }
    const prompt = sanitizeString(body.prompt, 10_000);
    if (!prompt) return Response.json({ success: false, error: "A site prompt is required" }, { status: 400 });
    const existingPages = Array.isArray(body.existingPages) ? body.existingPages.slice(0, 20) : [];

    const systemPrompt = `You are Unison's Universal Intent Planner. Propose a compact page topology and operational capabilities from the user's request. Do not write code, invent business facts, or add features that were not requested. Preserve all explicit custom routes. Prefer a single clear page purpose over generic filler pages.

Return only JSON with this shape:
{"pages":[{"route":"/example","title":"Example","purpose":"Specific visitor outcome","suggestedRole":"custom"}],"requestedCapabilities":["booking"]}

Pages may use roles home, about, services, contact, pricing, gallery, faq, booking, checkout, thank_you, blog, shop, immersive, or custom. Capabilities may only be booking, commerce, authentication, lead-capture, or content-management. Return no more than 12 pages and no more than 5 capabilities. Keep routes absolute and stable. Existing Wizard pages are authoritative; do not repeat them. Do not infer a capability from a negated request.`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 35_000);
    try {
      const completion = await createChatCompletion({
        model: DEFAULT_GEMINI_GATEWAY_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: JSON.stringify({ prompt, existingPages }) },
        ],
        temperature: 0.2,
        max_tokens: 1800,
      }, controller.signal);
      if (!completion.ok) return Response.json({ success: false, error: "AI planning failed" }, { status: 502 });
      const result = await completion.json();
      const content = result.choices?.[0]?.message?.content;
      const proposal = typeof content === "string" ? parseJson(content) : null;
      if (!proposal || !Array.isArray(proposal.pages)) {
        return Response.json({ success: false, error: "AI returned an invalid page plan" }, { status: 502 });
      }

      const pages = proposal.pages.slice(0, 12).flatMap((page: unknown) => {
        if (!page || typeof page !== "object" || Array.isArray(page)) return [];
        const value = page as Record<string, unknown>;
        const route = typeof value.route === "string" ? sanitizeString(value.route, 160) : "";
        const title = typeof value.title === "string" ? sanitizeString(value.title, 120) : "";
        const purpose = typeof value.purpose === "string" ? sanitizeString(value.purpose, 320) : "";
        if (!route || !title || !purpose) return [];
        return [{
          route,
          title,
          purpose,
          suggestedRole: typeof value.suggestedRole === "string" ? sanitizeString(value.suggestedRole, 40) : "custom",
        }];
      });
      const requestedCapabilities = Array.isArray(proposal.requestedCapabilities)
        ? [...new Set(proposal.requestedCapabilities.filter((value): value is string => typeof value === "string")
          .map((value) => value.trim().toLowerCase())
          .filter((value) => CAPABILITIES.has(value)))].slice(0, 5)
        : [];
      return Response.json({ success: true, proposal: { pages, requestedCapabilities } });
    } catch (caught) {
      console.error("[universal-creation-plan] planning failed", caught instanceof Error ? caught.message : "unknown error");
      return Response.json({ success: false, error: "AI planning failed" }, { status: 502 });
    } finally {
      clearTimeout(timeout);
    }
  }),
};