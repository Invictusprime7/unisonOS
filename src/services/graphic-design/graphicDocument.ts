/**
 * The one editable graphic document. Affinity returns a whole document; the
 * Design Studio canvas, the design check and every export are projections of
 * it. `normalizeGraphicDocument` is the single acceptance point for anything
 * the AI (or an older saved copy) supplies: it clamps geometry, fixes colours
 * and fonts, drops unusable layers and never invents content.
 */

import { canvasSize, getGraphicFormat, type GraphicFormat } from './graphicFormats';
import { DEFAULT_GRAPHIC_FONT, findGraphicFont, snapFontWeight } from './graphicFonts';

export const GRAPHIC_DOCUMENT_VERSION = 1;
export const MAX_LAYERS_PER_PAGE = 60;
export const MAX_TEXT_LENGTH = 800;
export const MAX_GENERATED_IMAGES = 2;

export type TextRole = 'headline' | 'subheadline' | 'body' | 'cta' | 'detail' | 'name' | 'title' | 'contact' | 'label';

interface LayerBase {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
}

export interface TextLayer extends LayerBase {
  type: 'text';
  text: string;
  role: TextRole;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  italic: boolean;
  color: string;
  align: 'left' | 'center' | 'right';
  lineHeight: number;
  /** Thousandths of an em. */
  letterSpacing: number;
  uppercase: boolean;
}

export interface ShapeLayer extends LayerBase {
  type: 'shape';
  shape: 'rect' | 'ellipse' | 'line';
  fill: string;
  stroke: string | null;
  strokeWidth: number;
  radius: number;
}

export interface ImageLayer extends LayerBase {
  type: 'image';
  /** data:, https: or blob: URL; `asset:<id>` while the AI edits the document. */
  src: string | null;
  /** Reference the owner imported (logo, photo) that fills this image. */
  referenceId: string | null;
  /** Photo Affinity should create for this slot. */
  generate: { prompt: string } | null;
  fit: 'cover' | 'contain';
  radius: number;
  alt: string;
}

export type GraphicLayer = TextLayer | ShapeLayer | ImageLayer;

export interface GraphicPage {
  id: string;
  name: string;
  background: string;
  layers: GraphicLayer[];
}

export interface GraphicDocument {
  version: typeof GRAPHIC_DOCUMENT_VERSION;
  formatId: string;
  title: string;
  palette: string[];
  pages: GraphicPage[];
}

export type ReferenceRole = 'logo' | 'photo' | 'inspiration';

export interface GraphicReference {
  id: string;
  name: string;
  role: ReferenceRole;
  /** Downscaled data URL sent to Affinity and used on the canvas. */
  dataUrl: string;
}

export class GraphicDocumentError extends Error {}

type Raw = Record<string, unknown>;

const isRecord = (value: unknown): value is Raw => typeof value === 'object' && value !== null && !Array.isArray(value);

const num = (value: unknown, fallback: number, min: number, max: number): number => {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};

const str = (value: unknown, max: number): string => (typeof value === 'string' ? value.slice(0, max) : '');

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Normalise a colour to `#rrggbb`, or null when it is not a hex colour. */
export function normalizeHexColor(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(HEX);
  if (!match) return null;
  const hex = match[1].length === 3 ? match[1].split('').map((c) => c + c).join('') : match[1];
  return `#${hex.toLowerCase()}`;
}

const TEXT_ROLES: readonly TextRole[] = ['headline', 'subheadline', 'body', 'cta', 'detail', 'name', 'title', 'contact', 'label'];

function uniqueId(base: string, used: Set<string>): string {
  const clean = base.replace(/[^a-z0-9_-]/gi, '').slice(0, 40) || 'layer';
  let id = clean;
  let n = 2;
  while (used.has(id)) id = `${clean}-${n++}`;
  used.add(id);
  return id;
}

function safeSource(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const src = value.trim();
  if (/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(src)) return src;
  if (/^(https:|blob:)/i.test(src)) return src;
  if (/^asset:[a-z0-9_-]+$/i.test(src)) return src;
  return null;
}

interface NormalizeContext {
  width: number;
  height: number;
  referenceIds: Set<string>;
  generatedSlots: { count: number };
}

function normalizeLayer(raw: unknown, index: number, used: Set<string>, ctx: NormalizeContext): GraphicLayer | null {
  if (!isRecord(raw)) return null;
  const type = raw.type;
  const span = Math.max(ctx.width, ctx.height);
  const base = {
    id: uniqueId(str(raw.id, 60) || `${String(type)}-${index + 1}`, used),
    x: num(raw.x, 0, -span, span * 2),
    y: num(raw.y, 0, -span, span * 2),
    width: num(raw.width, ctx.width / 2, 1, span * 3),
    height: num(raw.height, 0, 0, span * 3),
    rotation: num(raw.rotation, 0, -360, 360),
    opacity: num(raw.opacity, 1, 0, 1),
  };

  if (type === 'text') {
    const text = str(raw.text, MAX_TEXT_LENGTH).trim();
    if (!text) return null;
    const font = findGraphicFont(raw.fontFamily) ?? findGraphicFont(DEFAULT_GRAPHIC_FONT)!;
    const role = TEXT_ROLES.includes(raw.role as TextRole) ? raw.role as TextRole : 'body';
    const align = raw.align === 'center' || raw.align === 'right' ? raw.align : 'left';
    return {
      ...base,
      type: 'text',
      text,
      role,
      fontFamily: font.family,
      fontSize: num(raw.fontSize, 24, 4, Math.max(40, ctx.height)),
      fontWeight: snapFontWeight(font, num(raw.fontWeight, 400, 100, 900)),
      italic: font.italic && raw.italic === true,
      color: normalizeHexColor(raw.color) ?? '#111111',
      align,
      lineHeight: num(raw.lineHeight, 1.2, 0.7, 3),
      letterSpacing: num(raw.letterSpacing, 0, -100, 800),
      uppercase: raw.uppercase === true,
    };
  }

  if (type === 'shape') {
    const shape = raw.shape === 'ellipse' || raw.shape === 'line' ? raw.shape : 'rect';
    const stroke = normalizeHexColor(raw.stroke);
    const fill = normalizeHexColor(raw.fill) ?? (shape === 'line' ? stroke : null) ?? '#dddddd';
    return {
      ...base,
      height: Math.max(base.height, 1),
      type: 'shape',
      shape,
      fill,
      stroke: shape === 'line' ? null : stroke,
      strokeWidth: stroke ? num(raw.strokeWidth, 1, 0, 200) : 0,
      radius: shape === 'rect' ? num(raw.radius, 0, 0, span) : 0,
    };
  }

  if (type === 'image') {
    const referenceId = typeof raw.referenceId === 'string' && ctx.referenceIds.has(raw.referenceId) ? raw.referenceId : null;
    const src = safeSource(raw.src);
    let generate: ImageLayer['generate'] = null;
    if (!src && !referenceId && isRecord(raw.generate)) {
      const prompt = str(raw.generate.prompt, 600).trim();
      if (prompt && ctx.generatedSlots.count < MAX_GENERATED_IMAGES) {
        generate = { prompt };
        ctx.generatedSlots.count += 1;
      }
    }
    return {
      ...base,
      height: Math.max(base.height, 1),
      type: 'image',
      src,
      referenceId,
      generate,
      fit: raw.fit === 'contain' ? 'contain' : 'cover',
      radius: num(raw.radius, 0, 0, span),
      alt: str(raw.alt, 200),
    };
  }

  return null;
}

/**
 * Accept a document from Affinity or storage. Throws GraphicDocumentError
 * when nothing usable remains; never fills in missing copy.
 */
export function normalizeGraphicDocument(
  raw: unknown,
  options: { formatId?: string; referenceIds?: Iterable<string> } = {},
): GraphicDocument {
  if (!isRecord(raw)) throw new GraphicDocumentError('The design was empty.');
  const format: GraphicFormat = getGraphicFormat(options.formatId ?? str(raw.formatId, 60));
  const { width, height } = canvasSize(format);
  const ctx: NormalizeContext = {
    width,
    height,
    referenceIds: new Set(options.referenceIds ?? []),
    generatedSlots: { count: 0 },
  };
  const rawPages = Array.isArray(raw.pages) ? raw.pages : [];
  const pageIds = new Set<string>();
  const layerIds = new Set<string>();
  const pages: GraphicPage[] = rawPages.slice(0, format.defaultPages).map((page, pageIndex) => {
    const p = isRecord(page) ? page : {};
    const layers = (Array.isArray(p.layers) ? p.layers : [])
      .map((layer, index) => normalizeLayer(layer, index, layerIds, ctx))
      .filter((layer): layer is GraphicLayer => layer !== null)
      .slice(0, MAX_LAYERS_PER_PAGE);
    return {
      id: uniqueId(str(p.id, 40) || `page-${pageIndex + 1}`, pageIds),
      name: str(p.name, 40).trim() || format.pageNames[pageIndex] || `Page ${pageIndex + 1}`,
      background: normalizeHexColor(p.background) ?? '#ffffff',
      layers,
    };
  }).filter((page) => page.layers.length > 0);

  if (pages.length === 0) throw new GraphicDocumentError('The design had no usable text, shapes or images.');

  const palette = (Array.isArray(raw.palette) ? raw.palette : [])
    .map(normalizeHexColor)
    .filter((color): color is string => Boolean(color))
    .filter((color, index, all) => all.indexOf(color) === index)
    .slice(0, 6);

  return {
    version: GRAPHIC_DOCUMENT_VERSION,
    formatId: format.id,
    title: str(raw.title, 120).trim() || format.label,
    palette,
    pages,
  };
}

/**
 * Replace image data with short `asset:<layerId>` tokens before a document is
 * sent to Affinity, so edits never re-upload (or rewrite) photos.
 */
export function stripImageSources(doc: GraphicDocument): { document: GraphicDocument; assets: Record<string, string> } {
  const assets: Record<string, string> = {};
  const pages = doc.pages.map((page) => ({
    ...page,
    layers: page.layers.map((layer) => {
      if (layer.type !== 'image' || !layer.src || layer.src.startsWith('asset:')) return layer;
      assets[layer.id] = layer.src;
      return { ...layer, src: `asset:${layer.id}` };
    }),
  }));
  return { document: { ...doc, pages }, assets };
}

/** Put image data back after Affinity returns an edited document. */
export function restoreImageSources(doc: GraphicDocument, assets: Record<string, string>): GraphicDocument {
  return {
    ...doc,
    pages: doc.pages.map((page) => ({
      ...page,
      layers: page.layers.map((layer) => {
        if (layer.type !== 'image' || !layer.src?.startsWith('asset:')) return layer;
        const original = assets[layer.src.slice('asset:'.length)];
        return { ...layer, src: original ?? null };
      }),
    })),
  };
}

/** Fill reference-backed image layers with the imported picture. */
export function resolveReferenceSources(doc: GraphicDocument, references: readonly GraphicReference[]): GraphicDocument {
  const byId = new Map(references.map((ref) => [ref.id, ref.dataUrl]));
  return {
    ...doc,
    pages: doc.pages.map((page) => ({
      ...page,
      layers: page.layers.map((layer) => (
        layer.type === 'image' && layer.referenceId && byId.has(layer.referenceId)
          ? { ...layer, src: byId.get(layer.referenceId)! }
          : layer
      )),
    })),
  };
}

export function updateLayer(doc: GraphicDocument, pageId: string, layerId: string, patch: Partial<GraphicLayer>): GraphicDocument {
  return {
    ...doc,
    pages: doc.pages.map((page) => (page.id !== pageId ? page : {
      ...page,
      layers: page.layers.map((layer) => (layer.id === layerId ? { ...layer, ...patch } as GraphicLayer : layer)),
    })),
  };
}

export function removeLayer(doc: GraphicDocument, pageId: string, layerId: string): GraphicDocument {
  return {
    ...doc,
    pages: doc.pages.map((page) => (page.id !== pageId ? page : {
      ...page,
      layers: page.layers.filter((layer) => layer.id !== layerId),
    })),
  };
}

/** Move a layer one step up (+1) or down (-1) in the stacking order. */
export function reorderLayer(doc: GraphicDocument, pageId: string, layerId: string, step: 1 | -1): GraphicDocument {
  return {
    ...doc,
    pages: doc.pages.map((page) => {
      if (page.id !== pageId) return page;
      const index = page.layers.findIndex((layer) => layer.id === layerId);
      const target = index + step;
      if (index < 0 || target < 0 || target >= page.layers.length) return page;
      const layers = [...page.layers];
      [layers[index], layers[target]] = [layers[target], layers[index]];
      return { ...page, layers };
    }),
  };
}

export function updatePage(doc: GraphicDocument, pageId: string, patch: Partial<Pick<GraphicPage, 'background' | 'name'>>): GraphicDocument {
  return { ...doc, pages: doc.pages.map((page) => (page.id === pageId ? { ...page, ...patch } : page)) };
}

/** Layers that still need a photo created by Affinity. */
export function pendingGeneratedImages(doc: GraphicDocument): Array<{ pageId: string; layer: ImageLayer }> {
  return doc.pages.flatMap((page) => page.layers
    .filter((layer): layer is ImageLayer => layer.type === 'image' && !layer.src && Boolean(layer.generate))
    .map((layer) => ({ pageId: page.id, layer })));
}

/** Rough text block height used before the canvas has measured a text layer. */
export function estimateTextHeight(layer: TextLayer): number {
  if (layer.height > 0) return layer.height;
  const charsPerLine = Math.max(1, Math.floor(layer.width / (layer.fontSize * 0.55)));
  const lines = layer.text.split('\n').reduce((total, line) => total + Math.max(1, Math.ceil(line.length / charsPerLine)), 0);
  return lines * layer.fontSize * layer.lineHeight;
}
