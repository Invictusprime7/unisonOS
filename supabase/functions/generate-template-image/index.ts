import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { verifyAuth, authError } from "../_shared/auth.ts";
import { errorResponse, secureJsonResponse } from "../_shared/response.ts";
import { safeParseBody, sanitizeString } from "../_shared/validate.ts";
import { createImageGeneration, isImageGenerationConfigured } from "../_shared/ai/providerClient.ts";

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

    const { data: body, error: parseError } = await safeParseBody<{ prompt?: string; style?: string }>(req, 65_536);
    if (parseError || !body) {
      const status = parseError?.includes("exceeds") ? 413 : 400;
      return errorResponse(parseError || "Invalid request body", status, corsHeaders);
    }

    const prompt = typeof body.prompt === "string" ? sanitizeString(body.prompt, 10_000) : "";
    const style = typeof body.style === "string" ? sanitizeString(body.style, 200) : undefined;
    if (!prompt) {
      return errorResponse("Prompt is required", 400, corsHeaders);
    }

    if (!isImageGenerationConfigured()) {
      console.warn("Gemini API key not configured - image generation unavailable");
      return secureJsonResponse(
        {
          error: "Image generation is not configured. Set GEMINI_API_KEY.",
          isLocalDevelopment: true,
        },
        503,
        corsHeaders,
      );
    }

    const enhancedPrompt = `${prompt}. Style: ${style || "professional and modern"}. High quality, detailed, suitable for web design.`;

    const response = await createImageGeneration({ prompt: enhancedPrompt });

    if (!response.ok) {
      if (response.status === 429) {
        return errorResponse("Rate limit exceeded. Please try again later.", 429, corsHeaders);
      }
      return errorResponse(`AI Gateway error: ${response.status}`, 503, corsHeaders);
    }

    const data = await response.json();
    const generated = data.data?.[0];
    const imageUrl = generated?.b64_json ? `data:image/png;base64,${generated.b64_json}` : generated?.url;

    if (!imageUrl) {
      throw new Error("No image generated");
    }

    return secureJsonResponse({ imageUrl }, 200, corsHeaders);
  } catch (error) {
    console.error("Error generating template image:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return errorResponse(message, 500, corsHeaders);
  }
});
