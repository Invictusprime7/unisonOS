/**
 * Affinity Graphics: create or edit one whole graphic document (flyer,
 * poster, banner, business card, letterhead) from the owner's words and
 * optional reference images. Gemini leads through the shared provider client;
 * the existing directly configured backup policy is unchanged.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { verifyAuth, authError } from "../_shared/auth.ts";
import { errorResponse, secureJsonResponse } from "../_shared/response.ts";
import { safeParseBody } from "../_shared/validate.ts";
import { checkRateLimit } from "../_shared/rateLimit.ts";
import {
  createLastResortGatewayChatCompletion,
  createPlannedChatCompletion,
  hasLovableGatewayAccess,
} from "../_shared/ai/providerClient.ts";
import { DEFAULT_GEMINI_GATEWAY_MODEL } from "../_shared/geminiModel.ts";
import {
  buildGraphicDesignMessages,
  extractGraphicDesignResult,
  parseGraphicDesignRequest,
} from "../_shared/graphicDesignPrompt.ts";

const REQUEST_TIMEOUT_MS = 125_000;
const BACKUP_MIN_WINDOW_MS = 40_000;
const UNREADABLE_RETRY_MIN_WINDOW_MS = 45_000;

function hasGeminiKey(): boolean {
  return ["GEMINI_API_KEY", "GOOGLE_API_KEY", "UNISONGEMINI_API_KEY"].some((name) => Boolean(Deno.env.get(name)?.trim()));
}

async function withDeadline(
  ms: number,
  run: (signal: AbortSignal) => Promise<Response>,
): Promise<{ response: Response | null; timedOut: boolean }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException("graphic design timeout", "AbortError")), ms);
  try {
    return { response: await run(controller.signal), timedOut: false };
  } catch (error) {
    console.warn("[affinity-graphic-design] provider attempt failed", error instanceof Error ? error.message : error);
    return { response: null, timedOut: controller.signal.aborted };
  } finally {
    clearTimeout(timer);
  }
}

/** Diagnostics only: why a reply failed to parse, without logging its content. */
function logUnreadableReply(choice: { finish_reason?: unknown; message?: { content?: unknown } } | undefined, usage: unknown): void {
  const content = choice?.message?.content;
  const raw = typeof content === "string" ? content : JSON.stringify(content ?? null);
  let parseError: string | null = null;
  try {
    JSON.parse(raw);
  } catch (error) {
    parseError = (error instanceof Error ? error.message : String(error)).slice(0, 200);
  }
  console.error("[affinity-graphic-design] unreadable reply", JSON.stringify({
    finish: choice?.finish_reason ?? null,
    chars: raw.length,
    usage: usage ?? null,
    parseError,
  }));
}

function providerErrorDetail(text: string): string {
  try {
    const parsed = JSON.parse(text);
    return String(parsed?.error?.message ?? parsed?.message ?? parsed?.error ?? "").slice(0, 300);
  } catch {
    return "";
  }
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const preflight = handleCorsPreflightRequest(req, corsHeaders);
  if (preflight) return preflight;
  if (req.method !== "POST") return errorResponse("Method not allowed", 405, corsHeaders);

  try {
    const auth = await verifyAuth(req);
    if (!auth.user) return authError(auth.error || "Unauthorized", auth.status, corsHeaders);

    const limit = checkRateLimit("affinity-graphic-design", auth.user.id, { maxRequests: 12, windowSeconds: 60 });
    if (!limit.allowed) {
      return errorResponse(`Affinity is busy with your earlier requests. Try again in ${limit.retryAfterSeconds} seconds.`, 429, corsHeaders);
    }

    const { data: body, error: parseError } = await safeParseBody(req, 6_500_000);
    if (parseError || !body) {
      return errorResponse(parseError?.includes("exceeds") ? "Your reference images are too large. Use fewer or smaller images." : "Invalid request body", parseError?.includes("exceeds") ? 413 : 400, corsHeaders);
    }

    const parsed = parseGraphicDesignRequest(body);
    if (!parsed.ok) return errorResponse(parsed.error, 400, corsHeaders);

    const geminiReady = hasGeminiKey();
    const backupReady = hasLovableGatewayAccess();
    if (!geminiReady && !backupReady) {
      return errorResponse("Affinity isn't connected to an AI provider on this backend yet. Add the Gemini key to switch it on.", 503, corsHeaders);
    }

    const request = {
      model: DEFAULT_GEMINI_GATEWAY_MODEL,
      messages: buildGraphicDesignMessages(parsed.request),
      response_format: { type: "json_object" },
      max_tokens: 16_000,
    };
    const startedAt = Date.now();
    const remainingMs = () => REQUEST_TIMEOUT_MS - (Date.now() - startedAt);
    let response: Response | null = null;
    let timedOut = false;
    let result: ReturnType<typeof extractGraphicDesignResult> = null;

    // A reply that is complete but structurally broken JSON (Gemini sometimes
    // drops a bracket in long documents) gets one fresh attempt when enough
    // of the window is left; provider errors and timeouts are never retried.
    for (let round = 0; round < 2 && !result; round++) {
      if (round > 0) {
        if (remainingMs() < UNREADABLE_RETRY_MIN_WINDOW_MS) break;
        console.warn("[affinity-graphic-design] retrying once after an unreadable reply");
      }
      response = null;
      timedOut = false;

      // Gemini (the owner's key) leads and owns the whole window; the directly
      // configured backup runs only when Gemini fails early enough to leave time.
      if (geminiReady) {
        const attempt = await withDeadline(remainingMs(), (signal) => createPlannedChatCompletion(request, signal));
        timedOut = attempt.timedOut;
        response = attempt.response;
        if (response && !response.ok) console.warn("[affinity-graphic-design] gemini failed", response.status);
      }
      if ((!response || !response.ok) && !timedOut && backupReady && remainingMs() >= BACKUP_MIN_WINDOW_MS) {
        const attempt = await withDeadline(remainingMs(), (signal) => createLastResortGatewayChatCompletion(request, signal));
        timedOut = attempt.timedOut;
        if (attempt.response) response = attempt.response;
      }

      if (!response) {
        return errorResponse(
          timedOut ? "Affinity took too long to finish this design. Nothing was changed. Try again, or ask for something simpler." : "Affinity couldn't reach the AI provider. Nothing was changed.",
          timedOut ? 504 : 503,
          corsHeaders,
        );
      }

      if (!response.ok) {
        const detail = providerErrorDetail(await response.text());
        console.error("[affinity-graphic-design] provider error", response.status, detail);
        if (response.status === 402) return errorResponse("Your Gemini account is out of credit. Add credit to keep designing. Nothing was changed.", 402, corsHeaders);
        if (response.status === 429) return errorResponse("The AI provider is rate limiting requests. Wait a minute and try again.", 429, corsHeaders);
        return errorResponse(`The AI provider couldn't finish this design (${response.status}). Nothing was changed.`, 503, corsHeaders);
      }

      const payload = await response.json();
      const choice = payload?.choices?.[0];
      result = extractGraphicDesignResult(choice?.message?.content);
      if (!result) logUnreadableReply(choice, payload?.usage);
    }

    if (!result || !response) {
      return errorResponse("Affinity returned a design it couldn't read, twice. Nothing was changed. Try again, or ask for something simpler.", 502, corsHeaders);
    }

    return secureJsonResponse({
      summary: result.summary,
      document: result.document,
      provider: response.headers.get("X-Unison-AI-Provider") ?? "gemini",
    }, 200, corsHeaders);
  } catch (error) {
    console.error("[affinity-graphic-design] error", error);
    return errorResponse("Affinity couldn't finish this design. Nothing was changed.", 500, corsHeaders);
  }
});
