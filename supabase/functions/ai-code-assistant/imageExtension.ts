/**
 * AI Builder image extension (mode `image-generate`).
 *
 * The floating toolbar and the AI Builder chat send image requests here with
 * the clicked element's site context. The Builder model first writes a
 * site-aware art-direction prompt (business, industry, page, section, nearby
 * copy, current image, shape), then the shared generator makes and stores it.
 * The client places the result through the canonical image-replace save path.
 */
import { z } from "zod";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createChatCompletion } from "../_shared/ai/providerClient.ts";
import { generateAndStoreSiteImage, SiteImageError, sizeFor } from "../_shared/ai/siteImage.ts";
import { errorResponse, secureJsonResponse } from "../_shared/response.ts";

export const ImageGenerateSchema = z.object({
  mode: z.literal("image-generate"),
  instruction: z.string().trim().min(1).max(2_000),
  target: z.object({
    kind: z.enum(["img", "background"]),
    selector: z.string().max(1_000).optional(),
    alt: z.string().max(500).optional(),
    currentSrc: z.string().max(2_000).optional(),
    nearbyText: z.string().max(1_500).optional(),
    section: z.string().max(200).optional(),
    repeatLabel: z.string().max(120).optional(),
    width: z.number().positive().max(10_000).optional(),
    height: z.number().positive().max(10_000).optional(),
  }),
  site: z.object({
    projectId: z.string().max(64).optional(),
    businessId: z.string().max(64).optional(),
    industry: z.string().max(80).optional(),
    pagePath: z.string().max(300).optional(),
    sourceSnippet: z.string().max(4_000).optional(),
    siteStyle: z.string().max(1_000).optional(),
  }).default({}),
});

type ImageGenerateBody = z.infer<typeof ImageGenerateSchema>;

async function readBusiness(authHeader: string | null, businessId?: string): Promise<string> {
  if (!businessId || !authHeader) return "";
  try {
    const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    // RLS: only returns a row the caller can see.
    const { data } = await client.from("businesses").select("*").eq("id", businessId).maybeSingle();
    if (!data) return "";
    const d = data as Record<string, unknown>;
    return ["name", "industry", "description", "tagline", "city", "location"]
      .map((k) => (typeof d[k] === "string" && d[k] ? `${k}: ${String(d[k]).slice(0, 300)}` : ""))
      .filter(Boolean).join("\n");
  } catch {
    return "";
  }
}

async function writeArtDirection(body: ImageGenerateBody, business: string, signal?: AbortSignal): Promise<string> {
  const t = body.target;
  const shape = t.width && t.height ? `${Math.round(t.width)}x${Math.round(t.height)} px on screen (${t.width > t.height * 1.1 ? "landscape" : t.height > t.width * 1.1 ? "portrait" : "square"})` : "unknown";
  const context = [
    business && `Business:\n${business}`,
    body.site.industry && `Industry: ${body.site.industry}`,
    body.site.pagePath && `Page file: ${body.site.pagePath}`,
    t.section && `Section: ${t.section}`,
    t.repeatLabel && `Element: ${t.repeatLabel}`,
    `Slot: ${t.kind === "img" ? "image element" : "background image"}, ${shape}`,
    t.alt && `Current alt text: ${t.alt}`,
    t.currentSrc && `Current image link (hint only): ${t.currentSrc.slice(0, 200)}`,
    t.nearbyText && `Copy around the image: ${t.nearbyText}`,
    body.site.siteStyle && `Site visual style: ${body.site.siteStyle}`,
    body.site.sourceSnippet && `Page source around the image:\n${body.site.sourceSnippet}`,
  ].filter(Boolean).join("\n");

  const response = await createChatCompletion({
    model: "openai/gpt-6-astra",
    messages: [
      {
        role: "system",
        content: "You are the AI Builder's art director. Write ONE image-generation prompt for the exact image slot described. Honor the user's request first; use the business, industry, section, nearby copy and visual style so the image fits this site and slot. Describe subject, setting, composition for the slot's shape, lighting, palette and photographic/illustrative style. Never put words, logos or UI in the image unless the user asks. Reply with the prompt only, under 120 words.",
      },
      { role: "user", content: `User request: ${body.instruction}\n\nSite context:\n${context}` },
    ],
    reasoning_effort: "low",
  } as never, signal);
  if (!response.ok) throw new Error(`art direction ${response.status}`);
  const data = await response.json();
  const text = String(data?.choices?.[0]?.message?.content ?? "").trim();
  if (!text) throw new Error("empty art direction");
  return text.slice(0, 1_500);
}

export async function handleImageGenerate(
  raw: unknown,
  req: Request,
  userId: string,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  const parsed = ImageGenerateSchema.safeParse(raw);
  if (!parsed.success) return errorResponse("Invalid image request", 400, corsHeaders);
  const body = parsed.data;
  const business = await readBusiness(req.headers.get("Authorization"), body.site.businessId);

  let prompt = body.instruction;
  let directed = false;
  try {
    prompt = await writeArtDirection(body, business, req.signal);
    directed = true;
  } catch (err) {
    // The image still gets made from the user's words plus known context.
    console.warn("[image-extension] art direction unavailable:", err instanceof Error ? err.message : err);
    prompt = [body.instruction, body.site.industry && `for a ${body.site.industry} website`, body.target.section && `${body.target.section} section`, "professional, high quality, no text"].filter(Boolean).join(", ");
  }

  try {
    const url = await generateAndStoreSiteImage(userId, prompt, {
      size: sizeFor(body.target.width ?? 1536, body.target.height ?? 1024),
      quality: "medium",
    });
    return secureJsonResponse({ imageUrl: url, prompt, directed }, 200, corsHeaders);
  } catch (err) {
    if (err instanceof SiteImageError) {
      return errorResponse(
        err.message,
        err.status,
        corsHeaders,
        err.retryAfterSeconds ? { retryAfterSeconds: err.retryAfterSeconds } : undefined,
      );
    }
    console.error("[image-extension] failed:", err);
    return errorResponse(err instanceof Error ? err.message : "Image generation failed", 500, corsHeaders);
  }
}
