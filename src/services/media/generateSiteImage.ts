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

/**
 * A second picture cannot be requested while one is already being made.
 * Generation genuinely takes 15-25 seconds, and clicking again during that
 * window only adds load and comes back refused, so callers lock their control
 * on this state rather than on a guessed delay.
 */
export class SiteImageBusyError extends Error {
  constructor() {
    super('A picture is already being made. Wait for it to finish, then try again.');
    this.name = 'SiteImageBusyError';
  }
}

/** A refusal from the image service, carrying how long to wait when it says so. */
export class SiteImageRequestError extends Error {
  constructor(
    message: string,
    public status?: number,
    public retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'SiteImageRequestError';
  }
}

let inFlight = false;
const busyListeners = new Set<() => void>();

function setInFlight(next: boolean) {
  if (inFlight === next) return;
  inFlight = next;
  for (const listener of [...busyListeners]) listener();
}

export function isImageBusy(): boolean {
  return inFlight;
}

/** Subscribe to "a picture is being made" so a control can stay locked honestly. */
export function subscribeImageBusy(listener: () => void): () => void {
  busyListeners.add(listener);
  return () => {
    busyListeners.delete(listener);
  };
}

export async function generateSiteImage(
  instruction: string,
  target: SiteImageTargetContext,
  site: SiteImageSiteContext = {},
): Promise<{ url: string; prompt: string }> {
  // Check and claim happen before the first await, so two clicks in the same
  // tick can never both pass the gate.
  if (inFlight) return Promise.reject(new SiteImageBusyError());
  setInFlight(true);
  try {
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
      let retryAfterSeconds: number | undefined;
      let status: number | undefined;
      try {
        const ctx = (error as { context?: Response }).context;
        status = ctx?.status;
        const j = ctx ? await ctx.clone().json() : null;
        detail = j?.error ?? j?.message ?? '';
        const raw = (j as { retryAfterSeconds?: unknown } | null)?.retryAfterSeconds;
        if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) retryAfterSeconds = Math.ceil(raw);
      } catch { /* no body */ }
      throw new SiteImageRequestError(
        detail || error.message || 'The image generator did not answer',
        status,
        retryAfterSeconds,
      );
    }
    const d = data as { imageUrl?: string; prompt?: string; error?: string } | null;
    if (!d?.imageUrl) throw new SiteImageRequestError(d?.error || 'No image came back');
    return { url: d.imageUrl, prompt: d.prompt ?? instruction };
  } finally {
    setInFlight(false);
  }
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
export interface ImageGeneratedDetail { selector: string; src: string; kind: 'img' | 'background'; currentSrc?: string; alt?: string; pagePath?: string; placement?: PicturePlacement; scrim?: 'light' | 'dark' | boolean; text?: string; evidence?: string[]; ownerPath?: string; tagName?: string; runs?: string[] }
