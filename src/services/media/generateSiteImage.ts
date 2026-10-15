/**
 * The one client entry to the project's image generator (`generate-image`).
 * Used by the floating toolbar and the AI Builder; the resulting link is
 * applied through the toolbar's canonical image-replace save path.
 */
import { supabase } from '@/integrations/supabase/client';

export type SiteImageStyle = 'photography' | 'realistic' | 'illustration' | 'digital-art' | '3d-render' | 'artistic';

export async function generateSiteImage(prompt: string, opts: { style?: SiteImageStyle; width?: number; height?: number } = {}): Promise<string> {
  const { data, error } = await supabase.functions.invoke('generate-image', {
    body: { prompt, style: opts.style ?? 'photography', quality: 'high', width: opts.width ?? 1536, height: opts.height ?? 1024 },
  });
  if (error) {
    let detail = '';
    try { const ctx = (error as { context?: Response }).context; const j = ctx ? await ctx.clone().json() : null; detail = j?.error ?? j?.message ?? ''; } catch { /* no body */ }
    throw new Error(detail || error.message || 'The image generator did not answer');
  }
  const url = (data as { imageUrl?: string; error?: string } | null)?.imageUrl;
  if (!url) throw new Error((data as { error?: string } | null)?.error || 'No image came back');
  return url;
}

/** True when a request on an image asks for a new picture rather than a layout/style change. */
export function isImageGenerationRequest(prompt: string): boolean {
  return /\b(generate|create|make|draw|render|replace|swap|change|new)\b[^.]{0,40}\b(image|photo|picture|illustration|graphic|visual)\b/i.test(prompt)
    || /^\s*(an?\s+)?(photo|image|picture|illustration)\s+of\b/i.test(prompt);
}

export const IMAGE_GENERATED_EVENT = 'unison:image-generated' as const;
export interface ImageGeneratedDetail { selector: string; src: string; kind: 'img' | 'background' }
