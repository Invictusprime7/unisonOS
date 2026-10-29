import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { buildUnisonDesignArchitectureDirective } from "../_shared/canonicalPipelinePrompt.ts";
import { z } from "zod";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { verifyAuth, authError } from "../_shared/auth.ts";
import { errorResponse, secureJsonResponse } from "../_shared/response.ts";
import { safeParseBody } from "../_shared/validate.ts";
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

    const bodySchema = z.object({
      prompt: z.string().trim().min(1).max(10_000),
      canvasState: z.unknown().optional(),
      action: z.string().trim().max(100).optional(),
    });

    const { data: rawBody, error: parseError } = await safeParseBody(req, 131_072);
    if (parseError || !rawBody) {
      const status = parseError?.includes("exceeds") ? 413 : 400;
      return errorResponse(parseError || "Invalid request body", status, corsHeaders);
    }

    const parsed = bodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return errorResponse("Invalid request body", 400, corsHeaders);
    }

    const { prompt, canvasState, action } = parsed.data;
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

    const systemPrompt = `You are an expert web design AI assistant integrated with a Fabric.js canvas builder.

Your role is to help users create web designs by generating Fabric.js objects based on their natural language requests.

CRITICAL RULES:
1. ALWAYS return valid JSON in this exact structure:
{
  "objects": [
    {
      "type": "rect" | "circle" | "text" | "textbox" | "image" | "group",
      "left": number,
      "top": number,
      "width": number,
      "height": number,
      "fill": "hex color",
      "stroke": "hex color",
      "strokeWidth": number,
      "text": "string (for text objects)",
      "fontSize": number (for text objects),
      "fontFamily": "string (for text objects)",
      "src": "url (for images)",
      "radius": number (for circles),
      "rx": number (border radius for rects),
      "ry": number (border radius for rects)
    }
  ],
  "explanation": "Brief explanation of what was created"
}

2. Position objects intelligently:
   - Center important elements
   - Use proper spacing and alignment
   - Follow design best practices
   - Canvas is 1280x800px (desktop), expandable vertically
   - CRITICAL: All objects MUST fit within canvas bounds (0-1280 width, 0-800+ height)
   - Consider object dimensions when positioning (left + width <= 1280, top + height within canvas)

3. Use modern, beautiful colors:
   - Professional color schemes
   - Good contrast
   - Consistent palette

4. For different requests:
   - "Add a button" → Create a rect + text group for a button
   - "Create a hero section" → Create background rect + heading + subtext
   - "Add a card" → Create rect with shadow effect + text elements
   - "Create navigation" → Create horizontal group of text elements
   - "Add form" → Create input fields (rects) with labels (text)

5. Support modifications:
   - "Make it bigger" → Increase width/height
   - "Change color to blue" → Update fill colors
   - "Move to the right" → Adjust left position
   - "Add shadow" → Add shadow property

6. Be creative but practical:
   - Real-world usable designs
   - Responsive proportions
   - Professional typography

Current canvas state: ${JSON.stringify(canvasState || {})}
Action type: ${action || 'create'}

IMPORTANT: Return ONLY valid JSON, no markdown, no explanations outside the JSON structure.`;

    const response = await createChatCompletion({
      model: DEFAULT_GEMINI_GATEWAY_MODEL,
      messages: [
        { role: "system", content: systemPrompt + buildUnisonDesignArchitectureDirective("brief") },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    if (!response.ok) {
      if (response.status === 429) {
        return errorResponse("Rate limit exceeded. Please try again later.", 429, corsHeaders);
      }
      if (response.status === 401) {
        console.error("AI gateway authentication failed");
        return errorResponse("AI service authentication failed. Please check API configuration.", 401, corsHeaders);
      }
      const errorText = await response.text();
      console.error("AI provider error:", response.status, errorText);
      return errorResponse(`AI provider error: ${response.status}`, 503, corsHeaders);
    }

    const data = await response.json();
    const content = String(data?.choices?.[0]?.message?.content ?? "").slice(0, 250_000);
    
    let aiResponse;
    try {
      aiResponse = JSON.parse(content);
      console.log("AI Response:", JSON.stringify(aiResponse, null, 2));
    } catch (e) {
      console.error("Failed to parse AI response:", content);
      throw new Error("Invalid JSON response from AI");
    }

    // Validate response structure
    if (!aiResponse.objects || !Array.isArray(aiResponse.objects)) {
      throw new Error("Invalid response structure: missing objects array");
    }

    return secureJsonResponse(aiResponse, 200, corsHeaders);
  } catch (error: unknown) {
    console.error("Error in web-builder-ai function:", error);
    return errorResponse(
      error instanceof Error ? error.message : "Internal server error",
      500,
      corsHeaders
    );
  }
});
