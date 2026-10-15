/**
 * Supabase Edge Function: Generate Image
 * Generates AI images through the configured direct image provider.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { verifyAuth, authError } from "../_shared/auth.ts";
import { errorResponse, secureJsonResponse } from "../_shared/response.ts";
import { safeParseBody, sanitizeString } from "../_shared/validate.ts";
import { createImageGeneration, isImageGenerationConfigured } from "../_shared/ai/providerClient.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/** Store a generated image and return a long-lived link, so site source never carries megabytes of base64. */
async function storeGeneratedImage(userId: string, dataUrl: string): Promise<string | null> {
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return null;
    const b64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const admin = createClient(url, key);
    const path = `generated/${userId}/${crypto.randomUUID()}.png`;
    const up = await admin.storage.from("user-files").upload(path, bytes, { contentType: "image/png" });
    if (up.error) { console.warn("[Generate-Image] store failed:", up.error.message); return null; }
    const signed = await admin.storage.from("user-files").createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
    return signed.data?.signedUrl ?? null;
  } catch (err) {
    console.warn("[Generate-Image] store error:", err);
    return null;
  }
}

interface ImageGenerationRequest {
  prompt: string;
  negative_prompt?: string;
  width?: number;
  height?: number;
  style?: "digital-art" | "realistic" | "artistic" | "photography" | "illustration" | "anime" | "3d-render" | "logo" | "icon";
  quality?: "standard" | "high" | "ultra";
  placement?: {
    position: string;
    container?: string;
  };
}

interface ImageGenerationResponse {
  imageUrl: string;
  url: string;
  base64?: string;
  placement?: {
    position: string;
    css: string;
  };
  error?: string;
}

serve(async (req: Request) => {
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

    const { data: body, error: parseError } = await safeParseBody<ImageGenerationRequest>(req, 65_536);
    if (parseError || !body) {
      const status = parseError?.includes("exceeds") ? 413 : 400;
      return errorResponse(parseError || "Invalid request body", status, corsHeaders);
    }

    const prompt = typeof body.prompt === "string" ? sanitizeString(body.prompt, 10_000) : "";
    const negativePrompt = typeof body.negative_prompt === "string" ? sanitizeString(body.negative_prompt, 2_000) : undefined;
    const width = typeof body.width === "number" ? Math.max(256, Math.min(2048, Math.trunc(body.width))) : 1024;
    const height = typeof body.height === "number" ? Math.max(256, Math.min(2048, Math.trunc(body.height))) : 1024;
    const style = body.style ?? "digital-art";
    const quality = body.quality ?? "high";
    const placement = body.placement;

    console.log("[Generate-Image] Request:", { prompt, style, quality, placement });

    if (!prompt) {
      return errorResponse("Prompt is required", 400, corsHeaders);
    }

    if (!isImageGenerationConfigured()) {
      return errorResponse("Image generation is not configured.", 503, corsHeaders);
    }

    const stylePrompts: Record<string, string> = {
      "digital-art": "digital art style, vibrant colors, professional, high quality",
      realistic: "photorealistic, highly detailed, professional photography",
      artistic: "artistic painting style, creative, expressive brushstrokes",
      photography: "professional photography, sharp focus, perfect lighting",
      illustration: "illustrated style, clean lines, professional illustration",
      anime: "anime art style, vibrant colors, manga aesthetic",
      "3d-render": "3D rendered, CGI, professional 3D visualization",
      logo: "clean logo design, minimal, professional brand identity, vector style",
      icon: "clean icon design, simple, flat design, scalable",
    };

    const aspectRatio = width > height ? "landscape" : width < height ? "portrait" : "square";
    const sizeContext = `${aspectRatio} ${width}x${height} aspect ratio`;
    const enhancedPrompt = `${prompt}, ${stylePrompts[style] || stylePrompts["digital-art"]}, ${sizeContext}`;
    const fullPrompt = negativePrompt ? `${enhancedPrompt}. Avoid: ${negativePrompt}` : enhancedPrompt;

    const size = width > height ? "1536x1024" : height > width ? "1024x1536" : "1024x1024";
    const response = await createImageGeneration({
      prompt: fullPrompt,
      size,
      quality: quality === "ultra" ? "high" : quality === "high" ? "medium" : "low",
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Generate-Image] AI provider error:", response.status, errorText);

      if (response.status === 429) {
        return errorResponse("Rate limit exceeded. Please try again later.", 429, corsHeaders);
      }
      if (response.status === 401) {
        return errorResponse("AI service authentication failed. Please check API configuration.", 401, corsHeaders);
      }

      let detail = "";
      try { detail = JSON.parse(errorText)?.error?.message ?? JSON.parse(errorText)?.message ?? ""; } catch { /* plain text */ }
      if (response.status === 402) return errorResponse(detail || "AI credits are used up. Add credits to keep generating images.", 402, corsHeaders);
      if (response.status === 403) return errorResponse(detail || "Image generation is not allowed for this workspace.", 403, corsHeaders);
      return errorResponse(detail || `Failed to generate image: ${response.status}`, response.status >= 500 ? 503 : response.status, corsHeaders);
    }

    const result = await response.json();
    const generated = result.data?.[0];
    const inline = generated?.b64_json ? `data:image/png;base64,${generated.b64_json}` : generated?.url;
    const stored = inline?.startsWith("data:") ? await storeGeneratedImage(auth.user.id, inline) : null;
    const imageData = stored ?? inline;

    if (!imageData) {
      throw new Error("No image generated");
    }

    const placementInfo = placement ? generatePlacementCSS(placement.position, placement.container) : undefined;
    const responseData: ImageGenerationResponse = {
      imageUrl: imageData,
      url: imageData,
      base64: imageData.startsWith("data:") ? imageData : undefined,
      placement: placementInfo,
    };

    return secureJsonResponse(responseData as unknown as Record<string, unknown>, 200, corsHeaders);
  } catch (error) {
    console.error("[Generate-Image] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to generate image";
    return secureJsonResponse(
      {
        error: errorMessage,
        imageUrl: "",
        url: "",
      },
      500,
      corsHeaders,
    );
  }
});

function generatePlacementCSS(position: string, _container?: string): { position: string; css: string } {
  const positionMap: Record<string, string> = {
    "top-left": "position: absolute; top: 10px; left: 10px;",
    "top-center": "position: absolute; top: 10px; left: 50%; transform: translateX(-50%);",
    "top-right": "position: absolute; top: 10px; right: 10px;",
    "center-left": "position: absolute; top: 50%; left: 10px; transform: translateY(-50%);",
    center: "position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);",
    "center-right": "position: absolute; top: 50%; right: 10px; transform: translateY(-50%);",
    "bottom-left": "position: absolute; bottom: 10px; left: 10px;",
    "bottom-center": "position: absolute; bottom: 10px; left: 50%; transform: translateX(-50%);",
    "bottom-right": "position: absolute; bottom: 10px; right: 10px;",
    "corner-left": "position: absolute; top: 10px; left: 10px;",
    "corner-right": "position: absolute; top: 10px; right: 10px;",
  };

  const css = positionMap[position] || positionMap["top-left"];
  return {
    position,
    css: `${css} max-width: 100%; cursor: move; resize: both; overflow: hidden;`,
  };
}
