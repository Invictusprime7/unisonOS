/**
 * Calls the Affinity Graphics backend and turns its reply into an accepted
 * document. The whole returned document goes through
 * `normalizeGraphicDocument`; image data never travels to the AI on edits.
 */

import { supabase } from '@/integrations/supabase/client';
import { describeFormatForAI, getGraphicFormat } from './graphicFormats';
import { GRAPHIC_FONTS } from './graphicFonts';
import {
  normalizeGraphicDocument,
  pendingGeneratedImages,
  resolveReferenceSources,
  restoreImageSources,
  stripImageSources,
  updateLayer,
  type GraphicDocument,
  type GraphicReference,
} from './graphicDocument';

export const GRAPHIC_DESIGN_FUNCTION = 'affinity-graphic-design';

export interface GraphicDesignTurn {
  mode: 'create' | 'edit';
  prompt: string;
  formatId: string;
  document?: GraphicDocument | null;
  selectedLayerId?: string | null;
  references: readonly GraphicReference[];
  allowGeneratedPhotos: boolean;
}

export interface GraphicDesignResult {
  document: GraphicDocument;
  summary: string;
}

/** Read the plain-language message out of a function error. */
export async function readFunctionError(error: unknown): Promise<string> {
  const context = (error as { context?: unknown } | null)?.context;
  if (context instanceof Response) {
    if (context.status === 404) return 'Affinity Graphics is not switched on yet: the Unison backend needs to be redeployed.';
    try {
      const body = await context.clone().json();
      if (typeof body?.error === 'string' && body.error) return body.error;
    } catch {
      /* not JSON */
    }
    return `Affinity couldn't finish this design (${context.status}). Nothing was changed.`;
  }
  const name = (error as { name?: string } | null)?.name;
  if (name === 'FunctionsFetchError') return 'Affinity Graphics could not be reached. The Unison backend may need to be redeployed.';
  return error instanceof Error && error.message ? error.message : 'Affinity couldn\u2019t finish this design. Nothing was changed.';
}

function referenceIdsFor(turn: GraphicDesignTurn): string[] {
  const existing = turn.document?.pages.flatMap((page) => page.layers.flatMap((layer) => (
    layer.type === 'image' && layer.referenceId ? [layer.referenceId] : []
  ))) ?? [];
  return [...turn.references.map((ref) => ref.id), ...existing];
}

export async function requestGraphicDesign(turn: GraphicDesignTurn): Promise<GraphicDesignResult> {
  const format = getGraphicFormat(turn.formatId);
  const stripped = turn.mode === 'edit' && turn.document ? stripImageSources(turn.document) : null;
  const { data, error } = await supabase.functions.invoke(GRAPHIC_DESIGN_FUNCTION, {
    body: {
      mode: turn.mode,
      prompt: turn.prompt,
      format: describeFormatForAI(format),
      document: stripped?.document ?? null,
      selectedLayerId: turn.selectedLayerId ?? null,
      references: turn.references.map(({ id, name, role, dataUrl }) => ({ id, name, role, dataUrl })),
      allowGeneratedPhotos: turn.allowGeneratedPhotos,
      fonts: GRAPHIC_FONTS.map((font) => font.family),
    },
  });
  if (error) throw new Error(await readFunctionError(error));
  if (!data?.document) throw new Error('Affinity returned no design. Nothing was changed.');

  let document = normalizeGraphicDocument(data.document, { formatId: format.id, referenceIds: referenceIdsFor(turn) });
  if (stripped) document = restoreImageSources(document, stripped.assets);
  document = resolveReferenceSources(document, turn.references);
  return { document, summary: typeof data.summary === 'string' ? data.summary : 'Here\u2019s your design.' };
}

/** Fetch a remote image into a data URL so exports never use a tainted canvas. */
async function inlineImage(url: string): Promise<string> {
  if (url.startsWith('data:')) return url;
  try {
    const response = await fetch(url);
    if (!response.ok) return url;
    const blob = await response.blob();
    return await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => resolve(url);
      reader.readAsDataURL(blob);
    });
  } catch {
    return url;
  }
}

/**
 * Create the photos Affinity asked for, one at a time. Returns the updated
 * document and how many could not be created (those keep a placeholder).
 */
export async function fillGeneratedImages(
  doc: GraphicDocument,
  onProgress?: (done: number, total: number) => void,
): Promise<{ document: GraphicDocument; failed: number; firstError: string | null }> {
  const pending = pendingGeneratedImages(doc);
  let document = doc;
  let failed = 0;
  let firstError: string | null = null;
  for (let index = 0; index < pending.length; index += 1) {
    const { pageId, layer } = pending[index];
    onProgress?.(index, pending.length);
    try {
      const { data, error } = await supabase.functions.invoke('generate-image', {
        body: {
          prompt: `${layer.generate!.prompt}. No text, letters or logos in the image.`,
          width: Math.round(layer.width),
          height: Math.round(layer.height),
          style: 'photography',
          quality: 'high',
        },
      });
      if (error) throw new Error(await readFunctionError(error));
      const url = typeof data?.imageUrl === 'string' && data.imageUrl ? data.imageUrl : null;
      if (!url) throw new Error('No photo came back.');
      document = updateLayer(document, pageId, layer.id, { src: await inlineImage(url), generate: null });
    } catch (error) {
      failed += 1;
      firstError ??= error instanceof Error ? error.message : String(error);
      // Leave an empty frame; never retry (and re-bill) the same photo on later turns.
      document = updateLayer(document, pageId, layer.id, { generate: null });
    }
  }
  onProgress?.(pending.length, pending.length);
  return { document, failed, firstError };
}
