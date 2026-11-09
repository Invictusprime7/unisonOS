/**
 * Draws a graphic document with Fabric. The same object builder feeds the
 * editable canvas and every export, so what the owner sees is what prints.
 */

import { Ellipse, FabricImage, Rect, StaticCanvas, Textbox, type FabricObject } from 'fabric';
import {
  DESIGN_UNITS_PER_INCH,
  canvasSize,
  exportScale,
  getGraphicFormat,
  safeArea,
  type GraphicFormat,
} from './graphicFormats';
import { findGraphicFont, googleFontStylesheetUrl } from './graphicFonts';
import type { GraphicDocument, GraphicLayer, GraphicPage, ImageLayer, TextLayer } from './graphicDocument';

export const PLACEHOLDER_FILL = '#e7e5e4';
const PLACEHOLDER_STROKE = '#a8a29e';

/** Extra data carried on every Fabric object we create. */
export interface LayerObjectData {
  layerId?: string;
  guide?: boolean;
  /** Offset of a contained image inside its layer box. */
  boxOffset?: { x: number; y: number };
}

export const objectData = (object: FabricObject): LayerObjectData => (object as unknown as { unisonData?: LayerObjectData }).unisonData ?? {};
const setObjectData = (object: FabricObject, data: LayerObjectData) => {
  (object as unknown as { unisonData?: LayerObjectData }).unisonData = data;
};

const imageCache = new Map<string, HTMLImageElement>();
const loadedFontLinks = new Set<string>();

function loadImageElement(src: string): Promise<HTMLImageElement | null> {
  const cached = imageCache.get(src);
  if (cached) return Promise.resolve(cached);
  return new Promise((resolve) => {
    const image = new Image();
    if (!src.startsWith('data:')) image.crossOrigin = 'anonymous';
    image.onload = () => {
      imageCache.set(src, image);
      resolve(image);
    };
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

async function ensureFonts(doc: GraphicDocument): Promise<void> {
  if (typeof document === 'undefined') return;
  const wanted = new Map<string, Set<string>>();
  for (const page of doc.pages) {
    for (const layer of page.layers) {
      if (layer.type !== 'text') continue;
      const descriptors = wanted.get(layer.fontFamily) ?? new Set<string>();
      descriptors.add(`${layer.italic ? 'italic ' : ''}${layer.fontWeight}`);
      wanted.set(layer.fontFamily, descriptors);
    }
  }
  const loads: Promise<unknown>[] = [];
  for (const [family, descriptors] of wanted) {
    const font = findGraphicFont(family);
    if (!font) continue;
    const href = googleFontStylesheetUrl(font);
    if (!loadedFontLinks.has(href)) {
      loadedFontLinks.add(href);
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      document.head.appendChild(link);
      loads.push(new Promise((resolve) => { link.onload = resolve; link.onerror = resolve; }));
    }
  }
  await Promise.all(loads);
  const faces: Promise<unknown>[] = [];
  for (const [family, descriptors] of wanted) {
    for (const descriptor of descriptors) faces.push(document.fonts?.load(`${descriptor} 32px "${family}"`).catch(() => undefined));
  }
  await Promise.race([Promise.all(faces), new Promise((resolve) => setTimeout(resolve, 4_000))]);
}

/** Load fonts and pictures a document needs before it is drawn. */
export async function preloadDocumentAssets(doc: GraphicDocument): Promise<void> {
  const sources = doc.pages.flatMap((page) => page.layers.flatMap((layer) => (
    layer.type === 'image' && layer.src && !layer.src.startsWith('asset:') ? [layer.src] : []
  )));
  await Promise.all([ensureFonts(doc), ...sources.map(loadImageElement)]);
}

function textObject(layer: TextLayer): FabricObject {
  return new Textbox(layer.uppercase ? layer.text.toUpperCase() : layer.text, {
    left: layer.x,
    top: layer.y,
    originX: 'left',
    originY: 'top',
    width: layer.width,
    fontFamily: layer.fontFamily,
    fontSize: layer.fontSize,
    fontWeight: layer.fontWeight,
    fontStyle: layer.italic ? 'italic' : 'normal',
    fill: layer.color,
    textAlign: layer.align,
    lineHeight: layer.lineHeight,
    charSpacing: layer.letterSpacing,
    opacity: layer.opacity,
    angle: layer.rotation,
    splitByGrapheme: false,
  });
}

function shapeObject(layer: Extract<GraphicLayer, { type: 'shape' }>): FabricObject {
  const common = {
    left: layer.x,
    top: layer.y,
    originX: 'left' as const,
    originY: 'top' as const,
    opacity: layer.opacity,
    angle: layer.rotation,
    strokeUniform: true,
  };
  if (layer.shape === 'ellipse') {
    return new Ellipse({
      ...common,
      rx: layer.width / 2,
      ry: layer.height / 2,
      fill: layer.fill,
      stroke: layer.stroke ?? undefined,
      strokeWidth: layer.stroke ? layer.strokeWidth : 0,
    });
  }
  return new Rect({
    ...common,
    width: layer.width,
    height: layer.shape === 'line' ? Math.max(1, layer.height) : layer.height,
    fill: layer.fill,
    rx: layer.radius,
    ry: layer.radius,
    stroke: layer.stroke ?? undefined,
    strokeWidth: layer.stroke ? layer.strokeWidth : 0,
  });
}

function imageObject(layer: ImageLayer): { object: FabricObject; offset?: { x: number; y: number } } {
  const element = layer.src ? imageCache.get(layer.src) : undefined;
  if (!element) {
    return {
      object: new Rect({
        left: layer.x,
        top: layer.y,
        originX: 'left',
        originY: 'top',
        width: layer.width,
        height: layer.height,
        rx: layer.radius,
        ry: layer.radius,
        fill: PLACEHOLDER_FILL,
        stroke: PLACEHOLDER_STROKE,
        strokeWidth: 2,
        strokeDashArray: [10, 8],
        strokeUniform: true,
        opacity: layer.opacity,
        angle: layer.rotation,
      }),
    };
  }
  const iw = element.naturalWidth || element.width;
  const ih = element.naturalHeight || element.height;
  if (layer.fit === 'contain') {
    const scale = Math.min(layer.width / iw, layer.height / ih);
    const offset = { x: (layer.width - iw * scale) / 2, y: (layer.height - ih * scale) / 2 };
    const image = new FabricImage(element, {
      left: layer.x + offset.x,
      top: layer.y + offset.y,
      originX: 'left',
      originY: 'top',
      scaleX: scale,
      scaleY: scale,
      opacity: layer.opacity,
      angle: layer.rotation,
    });
    return { object: image, offset };
  }
  const scale = Math.max(layer.width / iw, layer.height / ih);
  const visibleW = layer.width / scale;
  const visibleH = layer.height / scale;
  const image = new FabricImage(element, {
    left: layer.x,
    top: layer.y,
    originX: 'left',
    originY: 'top',
    cropX: (iw - visibleW) / 2,
    cropY: (ih - visibleH) / 2,
    width: visibleW,
    height: visibleH,
    scaleX: scale,
    scaleY: scale,
    opacity: layer.opacity,
    angle: layer.rotation,
  });
  if (layer.radius > 0) {
    image.clipPath = new Rect({
      width: visibleW,
      height: visibleH,
      rx: layer.radius / scale,
      ry: layer.radius / scale,
      originX: 'center',
      originY: 'center',
    });
  }
  return { object: image };
}

/** True for an image frame with no picture loaded yet. */
export const isEmptyFrame = (layer: GraphicLayer) => layer.type === 'image' && !(layer.src && imageCache.has(layer.src));

/**
 * Fabric objects for one page, bottom-most first. Assets must be preloaded.
 * Exports leave empty picture frames out instead of printing the placeholder.
 */
export function buildPageObjects(page: GraphicPage, options: { placeholders?: boolean } = {}): FabricObject[] {
  const placeholders = options.placeholders ?? true;
  return page.layers.filter((layer) => placeholders || !isEmptyFrame(layer)).map((layer) => {
    let object: FabricObject;
    let offset: { x: number; y: number } | undefined;
    if (layer.type === 'text') object = textObject(layer);
    else if (layer.type === 'shape') object = shapeObject(layer);
    else ({ object, offset } = imageObject(layer));
    setObjectData(object, { layerId: layer.id, boxOffset: offset });
    return object;
  });
}

/** Editor-only trim and safe-area guides; never part of exports. */
export function buildGuideObjects(format: GraphicFormat, zoom: number, colors: { trim: string; safe: string }): FabricObject[] {
  const guides: FabricObject[] = [];
  const stroke = 1 / Math.max(zoom, 0.01);
  const guide = (x: number, y: number, width: number, height: number, color: string, dash: number[]) => {
    const rect = new Rect({
      left: x,
      top: y,
      originX: 'left',
      originY: 'top',
      width,
      height,
      fill: 'transparent',
      stroke: color,
      strokeWidth: stroke,
      strokeDashArray: dash.map((d) => d * stroke),
      selectable: false,
      evented: false,
      excludeFromExport: true,
      objectCaching: false,
    });
    setObjectData(rect, { guide: true });
    guides.push(rect);
  };
  if (format.bleed > 0) guide(format.bleed, format.bleed, format.trimWidth, format.trimHeight, colors.trim, [6, 4]);
  const safe = safeArea(format);
  guide(safe.x, safe.y, safe.width, safe.height, colors.safe, [2, 4]);
  return guides;
}

/** Geometry (and edited text) read back from a moved, resized or edited object. */
export function readLayerFromObject(object: FabricObject, layer: GraphicLayer): Partial<GraphicLayer> {
  const scaleX = object.scaleX ?? 1;
  const scaleY = object.scaleY ?? 1;
  const base = { x: object.left ?? layer.x, y: object.top ?? layer.y, rotation: object.angle ?? 0 };
  if (layer.type === 'text') {
    const box = object as Textbox;
    const fontScale = Math.abs(scaleY - 1) > 0.001 ? scaleY : 1;
    const text = box.text ?? layer.text;
    return {
      ...base,
      width: (box.width ?? layer.width) * scaleX,
      height: (box.height ?? 0) * scaleY,
      fontSize: Math.max(4, layer.fontSize * fontScale),
      text: layer.uppercase && text === layer.text.toUpperCase() ? layer.text : text,
    };
  }
  if (layer.type === 'image') {
    const offset = objectData(object).boxOffset;
    const width = object.getScaledWidth();
    const height = object.getScaledHeight();
    const resized = Math.abs(width - (offset ? layer.width - offset.x * 2 : layer.width)) > 0.5
      || Math.abs(height - (offset ? layer.height - offset.y * 2 : layer.height)) > 0.5;
    if (offset && !resized) return { ...base, x: base.x - offset.x, y: base.y - offset.y };
    return { ...base, width, height };
  }
  if (layer.shape === 'ellipse') {
    const ellipse = object as Ellipse;
    return { ...base, width: (ellipse.rx ?? layer.width / 2) * 2 * scaleX, height: (ellipse.ry ?? layer.height / 2) * 2 * scaleY };
  }
  return { ...base, width: (object.width ?? layer.width) * scaleX, height: (object.height ?? layer.height) * scaleY };
}

async function renderPage(doc: GraphicDocument, pageIndex: number, multiplier: number, type: 'png' | 'jpeg'): Promise<string> {
  const page = doc.pages[pageIndex];
  if (!page) throw new Error('That page does not exist.');
  await preloadDocumentAssets(doc);
  const format = getGraphicFormat(doc.formatId);
  const { width, height } = canvasSize(format);
  const element = document.createElement('canvas');
  const canvas = new StaticCanvas(element, { width, height, backgroundColor: page.background, enableRetinaScaling: false, renderOnAddRemove: false });
  try {
    buildPageObjects(page, { placeholders: false }).forEach((object) => canvas.add(object));
    canvas.renderAll();
    return canvas.toDataURL({ format: type, quality: 0.92, multiplier });
  } finally {
    canvas.dispose();
  }
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, data] = dataUrl.split(',');
  const mime = header.match(/data:([^;]+)/)?.[1] ?? 'application/octet-stream';
  const bytes = atob(data);
  const buffer = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i += 1) buffer[i] = bytes.charCodeAt(i);
  return new Blob([buffer], { type: mime });
}

export interface GraphicExport {
  blob: Blob;
  filename: string;
  dpi: number;
}

export function exportFilename(doc: GraphicDocument, suffix: string, extension: string): string {
  const slug = doc.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'design';
  return `${slug}${suffix ? `-${suffix}` : ''}.${extension}`;
}

/** PNG or JPG of one page at print resolution (screen formats at 1:1). */
export async function exportPageImage(doc: GraphicDocument, pageIndex: number, type: 'png' | 'jpeg'): Promise<GraphicExport> {
  const format = getGraphicFormat(doc.formatId);
  const { multiplier, dpi } = exportScale(format);
  const dataUrl = await renderPage(doc, pageIndex, multiplier, type);
  const suffix = doc.pages.length > 1 ? doc.pages[pageIndex].name.toLowerCase().replace(/[^a-z0-9]+/g, '-') : '';
  return { blob: dataUrlToBlob(dataUrl), filename: exportFilename(doc, suffix, type === 'jpeg' ? 'jpg' : 'png'), dpi };
}

/** Print-ready PDF: every page at full size including bleed. */
export async function exportPdf(doc: GraphicDocument): Promise<GraphicExport> {
  const format = getGraphicFormat(doc.formatId);
  const { width, height } = canvasSize(format);
  const { multiplier, dpi } = exportScale(format);
  const widthIn = width / DESIGN_UNITS_PER_INCH;
  const heightIn = height / DESIGN_UNITS_PER_INCH;
  const orientation = widthIn > heightIn ? 'landscape' : 'portrait';
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ orientation, unit: 'in', format: [widthIn, heightIn], compress: true });
  pdf.setProperties({ title: doc.title, creator: 'Unison Affinity' });
  for (let index = 0; index < doc.pages.length; index += 1) {
    if (index > 0) pdf.addPage([widthIn, heightIn], orientation);
    const jpeg = await renderPage(doc, index, multiplier, 'jpeg');
    pdf.addImage(jpeg, 'JPEG', 0, 0, widthIn, heightIn, undefined, 'FAST');
  }
  return { blob: pdf.output('blob'), filename: exportFilename(doc, format.print ? 'print' : '', 'pdf'), dpi };
}
