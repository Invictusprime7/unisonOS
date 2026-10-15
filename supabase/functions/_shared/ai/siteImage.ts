/**
 * Shared image generation + storage for site images. Used by the AI Builder's
 * image extension (`ai-code-assistant` mode `image-generate`) and the legacy
 * `generate-image` endpoint, so both produce and store images identically.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decodeBase64 } from "jsr:@std/encoding@1/base64";
import { createImageGeneration, isImageGenerationConfigured } from "./providerClient.ts";

export class SiteImageError extends Error {
  constructor(
    public status: number,
    message: string,
    /** Whole seconds the service asked us to wait, when it said so. */
    public retryAfterSeconds?: number,
  ) {
    super(message);
  }
}

/** Whole seconds to wait before retrying a refused request, from Retry-After. */
export function rateLimitSeconds(headers: Headers): number | undefined {
  const retryAfter = headers.get("retry-after");
  if (!retryAfter) return undefined;
  const seconds = Number(retryAfter);
  const delay = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(retryAfter) - Date.now();
  if (!Number.isFinite(delay) || delay <= 0) return 1;
  return Math.min(600, Math.ceil(delay / 1000));
}

/** Store a generated image and return a long-lived link, so site source never carries base64. */
export async function storeGeneratedImage(userId: string, dataUrl: string): Promise<string | null> {
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return null;
    // Native decoder: a per-character loop on a multi-MB image exceeded the CPU limit.
    const bytes = decodeBase64(dataUrl.slice(dataUrl.indexOf(",") + 1));
    const admin = createClient(url, key);
    const path = `generated/${userId}/${crypto.randomUUID()}.png`;
    const up = await admin.storage.from("user-files").upload(path, bytes, { contentType: "image/png" });
    if (up.error) { console.warn("[site-image] store failed:", up.error.message); return null; }
    const signed = await admin.storage.from("user-files").createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
    return signed.data?.signedUrl ?? null;
  } catch (err) {
    console.warn("[site-image] store error:", err);
    return null;
  }
}

export function sizeFor(width: number, height: number): string {
  return width > height * 1.1 ? "1536x1024" : height > width * 1.1 ? "1024x1536" : "1024x1024";
}

/** Generate one image and return a stored link. Throws SiteImageError with a user-safe message. */
export async function generateAndStoreSiteImage(
  userId: string,
  prompt: string,
  opts: { size?: string; quality?: "low" | "medium" | "high" } = {},
): Promise<string> {
  if (!isImageGenerationConfigured()) throw new SiteImageError(503, "Image generation is not configured.");
  const response = await createImageGeneration({ prompt, size: opts.size ?? "1024x1024", quality: opts.quality ?? "medium" });
  if (!response.ok) {
    const text = await response.text();
    console.error("[site-image] provider error:", response.status, text.slice(0, 400));
    let detail = "";
    try { const j = JSON.parse(text); detail = j?.error?.message ?? j?.message ?? ""; } catch { /* plain text */ }
    if (response.status === 429) {
      const seconds = rateLimitSeconds(response.headers);
      throw new SiteImageError(
        429,
        seconds
          ? `The picture maker is busy — try again in ${seconds} second${seconds === 1 ? "" : "s"}.`
          : "The picture maker is busy right now. Please try again in a minute.",
        seconds,
      );
    }
    if (response.status === 402) throw new SiteImageError(402, detail || "AI credits are used up. Add credits to keep generating images.");
    if (response.status === 403) throw new SiteImageError(403, detail || "Image generation is not allowed for this workspace.");
    if (response.status === 401) throw new SiteImageError(401, "AI service authentication failed.");
    throw new SiteImageError(response.status >= 500 ? 503 : response.status, detail || `Image generation failed (${response.status}).`);
  }
  const result = await response.json();
  const generated = result.data?.[0];
  const inline: string | undefined = generated?.b64_json ? `data:image/png;base64,${generated.b64_json}` : generated?.url;
  if (!inline) throw new SiteImageError(502, "No image came back from the generator.");
  if (!inline.startsWith("data:")) return inline;
  const stored = await storeGeneratedImage(userId, inline);
  if (!stored) throw new SiteImageError(500, "The image was made but could not be saved to your site files.");
  return stored;
}
