import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { buildUnisonDesignArchitectureDirective } from "../_shared/canonicalPipelinePrompt.ts";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { verifyAuth, authError } from "../_shared/auth.ts";
import { errorResponse, secureJsonResponse } from "../_shared/response.ts";
import { safeParseBody, sanitizeString } from "../_shared/validate.ts";
import { createChatCompletion, isTextGenerationConfigured } from "../_shared/ai/providerClient.ts";
import { DEFAULT_GEMINI_GATEWAY_MODEL } from "../_shared/geminiModel.ts";

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const preflight = handleCorsPreflightRequest(req, corsHeaders);
  if (preflight) {
    return preflight;
  }

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405, corsHeaders);
  }

  try {
    const auth = await verifyAuth(req);
    if (!auth.user) {
      return authError(auth.error || "Unauthorized", auth.status, corsHeaders);
    }

    const { data: body, error: parseError } = await safeParseBody<{
      text?: string;
      tone?: string;
      purpose?: string;
    }>(req, 65_536);
    if (parseError || !body) {
      const status = parseError?.includes("exceeds") ? 413 : 400;
      return errorResponse(parseError || "Invalid request body", status, corsHeaders);
    }

    const text = typeof body.text === "string" ? sanitizeString(body.text, 20_000) : "";
    const tone = typeof body.tone === "string" ? sanitizeString(body.tone, 100) : "professional";
    const purpose = typeof body.purpose === "string" ? sanitizeString(body.purpose, 100) : "";
    if (!text) {
      return errorResponse("text is required", 400, corsHeaders);
    }

    if (!isTextGenerationConfigured()) {
      console.warn("No direct AI provider configured");
      return secureJsonResponse(
        { 
          error: "AI features are not configured. Set GEMINI_API_KEY, GOOGLE_API_KEY, UNISONGEMINI_API_KEY, ANTHROPIC_API_KEY, or LOVABLE_API_KEY.",
          isLocalDevelopment: true
        },
        503,
        corsHeaders
      );
    }

    let systemPrompt = "You are an expert copywriter. Rewrite the given text according to the specified tone and purpose.";
    
    if (purpose === "seo") {
      systemPrompt += " Make it SEO-friendly with relevant keywords naturally integrated. Focus on search intent and readability.";
    } else if (purpose === "article") {
      systemPrompt = "You are an expert long-form writer. Write the complete article described below (title, category, summary). 900-1400 words, clear section headings in markdown (##), concrete examples, no filler, no invented statistics or quotes attributed to real people. Return only the article body in markdown, without the title.";
    } else if (purpose === "cta") {
      systemPrompt += " Transform it into a compelling call-to-action that drives user engagement and conversions. Use action verbs and create urgency.";
    }

    systemPrompt += ` Use a ${tone} tone. Keep the core message but enhance clarity, impact, and engagement. Return only the rewritten text without explanations.`;

    const response = await createChatCompletion({
      model: DEFAULT_GEMINI_GATEWAY_MODEL,
      messages: [
        { role: "system", content: systemPrompt + buildUnisonDesignArchitectureDirective("brief") },
        { role: "user", content: text }
      ],
    });

    if (!response.ok) {
      if (response.status === 429) {
        return errorResponse("Rate limit exceeded. Please try again later.", 429, corsHeaders);
      }
      return errorResponse(`AI provider error: ${response.status}`, 503, corsHeaders);
    }

    const data = await response.json();
    const rewrittenText = data.choices?.[0]?.message?.content;

    if (!rewrittenText) {
      throw new Error("No rewritten text generated");
    }

    return secureJsonResponse({ rewrittenText }, 200, corsHeaders);
  } catch (error) {
    console.error("Error rewriting copy:", error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return errorResponse(message, 500, corsHeaders);
  }
});
