/**
 * Beginner design check. Turns the "Design like a pro" tips into concrete,
 * explainable findings: stick to 2–3 colours, big bold headlines, leave white
 * space, keep things aligned inside the safe area, readable contrast and no
 * tiny print. Findings are advice for the owner; they never block exports.
 */

import { DESIGN_UNITS_PER_INCH, canvasSize, getGraphicFormat, safeArea } from './graphicFormats';
import { estimateTextHeight, type GraphicDocument, type GraphicLayer, type GraphicPage, type TextLayer } from './graphicDocument';

export type DesignCheckRule = 'colors' | 'headline' | 'white-space' | 'safe-area' | 'overlap' | 'contrast' | 'tiny-text';

export interface DesignCheckFinding {
  rule: DesignCheckRule;
  severity: 'warning' | 'problem';
  pageId: string;
  layerId?: string;
  message: string;
  /** Instruction Affinity can follow to fix this finding. */
  fix: string;
}

export const MAX_ACCENT_COLORS = 3;
const POINTS_PER_INCH = 72;

interface Box { x: number; y: number; width: number; height: number }

function layerBox(layer: GraphicLayer): Box {
  const height = layer.type === 'text' ? estimateTextHeight(layer) : layer.height;
  return { x: layer.x, y: layer.y, width: layer.width, height };
}

function rgb(hex: string): [number, number, number] {
  const value = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16)) as [number, number, number];
}

function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** White, black and greys do not count against the 2–3 colour budget. */
export function isNeutralColor(hex: string): boolean {
  const [r, g, b] = rgb(hex);
  return Math.max(r, g, b) - Math.min(r, g, b) < 24;
}

function colorDistance(a: string, b: string): number {
  const [ar, ag, ab] = rgb(a);
  const [br, bg, bb] = rgb(b);
  return Math.sqrt((ar - br) ** 2 + (ag - bg) ** 2 + (ab - bb) ** 2);
}

/** Distinct non-neutral colours; near-identical shades count once. */
export function accentColors(page: GraphicPage): string[] {
  const used = [page.background, ...page.layers.flatMap((layer) => {
    if (layer.type === 'text') return [layer.color];
    if (layer.type === 'shape') return [layer.fill, ...(layer.stroke ? [layer.stroke] : [])];
    return [];
  })];
  const distinct: string[] = [];
  for (const color of used) {
    if (isNeutralColor(color)) continue;
    if (!distinct.some((existing) => colorDistance(existing, color) < 40)) distinct.push(color);
  }
  return distinct;
}

const contains = (outer: Box, x: number, y: number) => x >= outer.x && x <= outer.x + outer.width && y >= outer.y && y <= outer.y + outer.height;

function intersectionArea(a: Box, b: Box): number {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

/** Colour directly behind the middle of a text layer, or null when it sits on a photo. */
function colorBehind(page: GraphicPage, index: number): string | null {
  const box = layerBox(page.layers[index]);
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  for (let i = index - 1; i >= 0; i -= 1) {
    const below = page.layers[i];
    if (!contains(layerBox(below), cx, cy)) continue;
    if (below.type === 'image') return null;
    if (below.type === 'shape' && below.opacity >= 0.9) return below.fill;
  }
  return page.background;
}

/** The most dominant line on the page (roles are often repeated, so size decides). */
function headlineOf(page: GraphicPage): TextLayer | undefined {
  return page.layers
    .filter((layer): layer is TextLayer => layer.type === 'text')
    .sort((a, b) => b.fontSize - a.fontSize)[0];
}

export function runDesignCheck(doc: GraphicDocument): DesignCheckFinding[] {
  const format = getGraphicFormat(doc.formatId);
  const size = canvasSize(format);
  const safe = safeArea(format);
  const findings: DesignCheckFinding[] = [];
  const pxPerPoint = DESIGN_UNITS_PER_INCH / POINTS_PER_INCH;
  const minPrintPoints = format.category === 'business-card' ? 7 : 8;

  for (const page of doc.pages) {
    const accents = accentColors(page);
    if (accents.length > MAX_ACCENT_COLORS) {
      findings.push({
        rule: 'colors',
        severity: 'warning',
        pageId: page.id,
        message: `${page.name} uses ${accents.length} colours. Stick to 2–3 so it doesn't look busy.`,
        fix: `Reduce ${page.name} to two or three colours plus neutrals.`,
      });
    }

    const headline = headlineOf(page);
    if (headline && format.category !== 'letterhead') {
      const shortSide = Math.min(format.trimWidth, format.trimHeight);
      const minimum = format.category === 'business-card' ? shortSide * 0.08 : shortSide * 0.06;
      if (headline.fontSize < minimum) {
        findings.push({
          rule: 'headline',
          severity: 'warning',
          pageId: page.id,
          layerId: headline.id,
          message: `The main line "${headline.text.slice(0, 40)}" is small. Make it big and bold so it reads at a glance.`,
          fix: `Make the text "${headline.text.slice(0, 60)}" much larger and bolder.`,
        });
      }
    }

    // White space: sample the trim area on a grid and count covered cells.
    const foreground = page.layers.filter((layer) => {
      const box = layerBox(layer);
      return box.width * box.height < size.width * size.height * 0.85;
    });
    const steps = 30;
    let covered = 0;
    for (let ix = 0; ix < steps; ix += 1) {
      for (let iy = 0; iy < steps; iy += 1) {
        const x = format.bleed + ((ix + 0.5) / steps) * format.trimWidth;
        const y = format.bleed + ((iy + 0.5) / steps) * format.trimHeight;
        if (foreground.some((layer) => contains(layerBox(layer), x, y))) covered += 1;
      }
    }
    if (covered / (steps * steps) > 0.78) {
      findings.push({
        rule: 'white-space',
        severity: 'warning',
        pageId: page.id,
        message: `${page.name} is very full. Leave some empty space so it's easier to read.`,
        fix: `Add more white space on ${page.name}: remove or shrink the least important elements.`,
      });
    }

    page.layers.forEach((layer, index) => {
      if (layer.type !== 'text') return;
      const box = layerBox(layer);
      const outside = box.x < safe.x - 0.5 || box.y < safe.y - 0.5
        || box.x + box.width > safe.x + safe.width + 0.5 || box.y + box.height > safe.y + safe.height + 0.5;
      if (outside) {
        findings.push({
          rule: 'safe-area',
          severity: format.print ? 'problem' : 'warning',
          pageId: page.id,
          layerId: layer.id,
          message: format.print
            ? `"${layer.text.slice(0, 40)}" is too close to the edge and may be cut off when printed.`
            : `"${layer.text.slice(0, 40)}" is too close to the edge.`,
          fix: `Move "${layer.text.slice(0, 60)}" inside the safe area, aligned with the other text.`,
        });
      }

      const behind = colorBehind(page, index);
      if (behind) {
        const large = layer.fontSize >= 24 * pxPerPoint * (format.category === 'business-card' ? 0.5 : 1) || (layer.fontWeight >= 700 && layer.fontSize >= 18.66 * pxPerPoint);
        const ratio = contrastRatio(layer.color, behind);
        if (ratio < (large ? 3 : 4.5)) {
          findings.push({
            rule: 'contrast',
            severity: 'problem',
            pageId: page.id,
            layerId: layer.id,
            message: `"${layer.text.slice(0, 40)}" is hard to read against its background.`,
            fix: `Change the colour of "${layer.text.slice(0, 60)}" so it stands out clearly from what is behind it.`,
          });
        }
      }

      if (format.print && layer.fontSize / pxPerPoint < minPrintPoints) {
        findings.push({
          rule: 'tiny-text',
          severity: 'warning',
          pageId: page.id,
          layerId: layer.id,
          message: `"${layer.text.slice(0, 40)}" may be too small to read once printed.`,
          fix: `Make "${layer.text.slice(0, 60)}" at least ${minPrintPoints} pt.`,
        });
      }

      for (let other = index + 1; other < page.layers.length; other += 1) {
        const next = page.layers[other];
        if (next.type !== 'text') continue;
        const nextBox = layerBox(next);
        const overlap = intersectionArea(box, nextBox);
        const smaller = Math.min(box.width * box.height, nextBox.width * nextBox.height);
        if (smaller > 0 && overlap / smaller > 0.15) {
          findings.push({
            rule: 'overlap',
            severity: 'problem',
            pageId: page.id,
            layerId: next.id,
            message: `"${next.text.slice(0, 30)}" overlaps "${layer.text.slice(0, 30)}".`,
            fix: `Separate "${next.text.slice(0, 50)}" from "${layer.text.slice(0, 50)}" so they don't overlap, keeping them aligned.`,
          });
        }
      }
    });
  }

  return findings;
}

/** One instruction that asks Affinity to fix every finding at once. */
export function designCheckFixInstruction(findings: readonly DesignCheckFinding[]): string {
  const fixes = [...new Set(findings.map((finding) => finding.fix))];
  return `Fix these design check findings without changing the wording or the overall idea:\n${fixes.map((fix) => `- ${fix}`).join('\n')}`;
}
