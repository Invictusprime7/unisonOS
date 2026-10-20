import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { buildUnisonDesignArchitectureDirective } from "../_shared/canonicalPipelinePrompt.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createChatCompletion } from "../_shared/ai/providerClient.ts";
import { DEFAULT_GEMINI_GATEWAY_MODEL } from "../_shared/geminiModel.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const startedAt = Date.now();
  let provider = "unknown";
  let resolvedModel = "unknown";
  let userId: string | null = null;

  // Best-effort: identify caller for per-user logs
  try {
    const auth = req.headers.get("Authorization");
    if (auth) {
      const sb = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: auth } } },
      );
      const { data } = await sb.auth.getUser();
      userId = data?.user?.id ?? null;
    }
  } catch (_) { /* ignore */ }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const logRequest = async (opts: {
    statusCode: number | null;
    success: boolean;
    errorMessage?: string | null;
    tokens?: { prompt?: number; completion?: number; total?: number };
  }) => {
    // Only signed-in callers produce log rows; anonymous requests cannot
    // write into the internal request log.
    if (!userId) return;
    try {
      await admin.from("ai_request_logs").insert({
        user_id: userId,
        provider,
        model: resolvedModel,
        status_code: opts.statusCode,
        success: opts.success,
        error_message: opts.errorMessage ?? null,
        latency_ms: Date.now() - startedAt,
        prompt_tokens: opts.tokens?.prompt ?? null,
        completion_tokens: opts.tokens?.completion ?? null,
        total_tokens: opts.tokens?.total ?? null,
      });
    } catch (e) {
      console.error("ai log insert failed:", e);
    }
  };

  try {
    const { messages: rawMessages, model = DEFAULT_GEMINI_GATEWAY_MODEL, reasoning } = await req.json();
    // The server owns the system instructions: callers may only send user and
    // assistant turns, as plain text.
    const messages = (Array.isArray(rawMessages) ? rawMessages : [])
      .filter((m: unknown): m is { role: string; content: string } =>
        !!m && typeof m === "object"
        && ((m as { role?: unknown }).role === "user" || (m as { role?: unknown }).role === "assistant")
        && typeof (m as { content?: unknown }).content === "string")
      .slice(-50)
      .map((m) => ({ role: m.role, content: m.content.slice(0, 20_000) }));
    const response = await createChatCompletion({
      model,
      messages: [
        { role: "system", content: "You are Unison Task's AI assistant. Be clear, concise, and accurate." + buildUnisonDesignArchitectureDirective("brief") },
        ...messages,
      ],
      stream: true,
      ...(reasoning?.effort && reasoning.effort !== "none" ? { reasoning: { effort: reasoning.effort } } : {}),
    });
    provider = response.headers.get("X-Unison-AI-Provider") ?? "unknown";
    resolvedModel = typeof model === "string" ? model : "unknown";

    if (!response.ok) {
      const errorText = await response.text();
      await logRequest({ statusCode: response.status, success: false, errorMessage: errorText.slice(0, 400) });
      return new Response(JSON.stringify({ error: "AI provider error", detail: errorText }), {
        status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Success — log immediately (token counts not available with stream)
    await logRequest({ statusCode: 200, success: true });

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("chat error:", e);
    await logRequest({ statusCode: 500, success: false, errorMessage: msg });
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
