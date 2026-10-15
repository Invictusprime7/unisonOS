/**
 * Client entry to the AI Builder's image extension (`ai-code-assistant`,
 * mode `image-generate`). The Builder writes a site-aware prompt from the
 * clicked element's context, generates and stores the image; the link is
 * then applied through the toolbar's canonical image-replace save path.
 */
import { supabase } from '@/integrations/supabase/client';

export interface SiteImageTargetContext {
  kind: 'img' | 'background';
  selector?: string;
  alt?: string;
  currentSrc?: string;
  nearbyText?: string;
  section?: string;
  repeatLabel?: string;
  width?: number;
  height?: number;
}

export interface SiteImageSiteContext {
  projectId?: string;
  businessId?: string;
  industry?: string;
  pagePath?: string;
  sourceSnippet?: string;
  siteStyle?: string;
}

const clip = (v: string | undefined | null, n: number) => (v ? String(v).slice(0, n) : undefined);

export async function generateSiteImage(
  instruction: string,
  target: SiteImageTargetContext,
  site: SiteImageSiteContext = {},
): Promise<{ url: string; prompt: string }> {
  const { data, error } = await supabase.functions.invoke('ai-code-assistant', {
    body: {
      mode: 'image-generate',
      instruction: instruction.slice(0, 2000),
      target: {
        ...target,
        alt: clip(target.alt, 500), currentSrc: clip(target.currentSrc, 2000),
        nearbyText: clip(target.nearbyText, 1500), section: clip(target.section, 200),
        selector: clip(target.selector, 1000), repeatLabel: clip(target.repeatLabel, 120),
      },
      site: {
        ...site,
        pagePath: clip(site.pagePath, 300), sourceSnippet: clip(site.sourceSnippet, 4000),
        siteStyle: clip(site.siteStyle, 1000), industry: clip(site.industry, 80),
      },
    },
  });
  if (error) {
    let detail = '';
    try { const ctx = (error as { context?: Response }).context; const j = ctx ? await ctx.clone().json() : null; detail = j?.error ?? j?.message ?? ''; } catch { /* no body */ }
    throw new Error(detail || error.message || 'The image generator did not answer');
  }
  const d = data as { imageUrl?: string; prompt?: string; error?: string } | null;
  if (!d?.imageUrl) throw new Error(d?.error || 'No image came back');
  return { url: d.imageUrl, prompt: d.prompt ?? instruction };
}

/** Finds the page file and a source snippet around the current image, for site-aware prompts. */
export function locateImageSource(files: Record<string, string> | null | undefined, currentSrc?: string, alt?: string): { pagePath?: string; sourceSnippet?: string } {
  if (!files) return {};
  const needles = [currentSrc && !currentSrc.startsWith('data:') ? currentSrc.split('?')[0] : '', alt ? `alt="${alt}"` : '', alt ?? ''].filter((n) => n && n.length > 3) as string[];
  for (const needle of needles) {
    for (const [path, src] of Object.entries(files)) {
      if (!/\.(tsx|jsx)$/.test(path)) continue;
      const i = src.indexOf(needle);
      if (i >= 0) return { pagePath: path, sourceSnippet: src.slice(Math.max(0, i - 1800), i + 1800) };
    }
  }
  return {};
}

/** True when a request on an image asks for a new picture rather than a layout/style change. */
export function isImageGenerationRequest(prompt: string): boolean {
  return /\b(generate|create|make|draw|render|replace|swap|change|new)\b[^.]{0,40}\b(image|photo|picture|illustration|graphic|visual)\b/i.test(prompt)
    || /^\s*(an?\s+)?(photo|image|picture|illustration)\s+of\b/i.test(prompt);
}

export const IMAGE_GENERATED_EVENT = 'unison:image-generated' as const;
/** `placement` is set when the element had no picture: add a cover background or an image inside it. */
export type PicturePlacement = 'background' | 'inside';
export interface ImageGeneratedDetail { selector: string; src: string; kind: 'img' | 'background'; currentSrc?: string; alt?: string; pagePath?: string; placement?: PicturePlacement; scrim?: boolean; text?: string }
