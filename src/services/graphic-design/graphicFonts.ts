/**
 * Curated typefaces Affinity may use in graphics. Each entry lists only the
 * weights the font really ships so the web-font request never fails.
 */

export interface GraphicFont {
  family: string;
  kind: 'sans' | 'serif' | 'display';
  weights: readonly number[];
  italic: boolean;
}

export const GRAPHIC_FONTS: readonly GraphicFont[] = [
  { family: 'Inter', kind: 'sans', weights: [400, 500, 600, 700, 800, 900], italic: false },
  { family: 'Montserrat', kind: 'sans', weights: [400, 500, 600, 700, 800, 900], italic: true },
  { family: 'Poppins', kind: 'sans', weights: [400, 500, 600, 700, 800, 900], italic: true },
  { family: 'Work Sans', kind: 'sans', weights: [400, 500, 600, 700, 800, 900], italic: true },
  { family: 'Raleway', kind: 'sans', weights: [400, 500, 600, 700, 800, 900], italic: true },
  { family: 'Space Grotesk', kind: 'sans', weights: [400, 500, 600, 700], italic: false },
  { family: 'Oswald', kind: 'display', weights: [400, 500, 600, 700], italic: false },
  { family: 'Bebas Neue', kind: 'display', weights: [400], italic: false },
  { family: 'Anton', kind: 'display', weights: [400], italic: false },
  { family: 'Archivo Black', kind: 'display', weights: [400], italic: false },
  { family: 'Playfair Display', kind: 'serif', weights: [400, 500, 600, 700, 800, 900], italic: true },
  { family: 'DM Serif Display', kind: 'serif', weights: [400], italic: true },
  { family: 'Fraunces', kind: 'serif', weights: [400, 500, 600, 700, 800, 900], italic: true },
  { family: 'Lora', kind: 'serif', weights: [400, 500, 600, 700], italic: true },
  { family: 'Cormorant Garamond', kind: 'serif', weights: [400, 500, 600, 700], italic: true },
  { family: 'Libre Baskerville', kind: 'serif', weights: [400, 700], italic: false },
];

export const DEFAULT_GRAPHIC_FONT = 'Inter';

export function findGraphicFont(family: unknown): GraphicFont | undefined {
  if (typeof family !== 'string') return undefined;
  const wanted = family.replace(/["']/g, '').split(',')[0].trim().toLowerCase();
  return GRAPHIC_FONTS.find((font) => font.family.toLowerCase() === wanted);
}

/** Nearest weight the font actually ships. */
export function snapFontWeight(font: GraphicFont, weight: number): number {
  return font.weights.reduce((best, candidate) => (
    Math.abs(candidate - weight) < Math.abs(best - weight) ? candidate : best
  ), font.weights[0]);
}

/** Google Fonts stylesheet URL for one family. */
export function googleFontStylesheetUrl(font: GraphicFont): string {
  const family = font.family.replace(/ /g, '+');
  const weights = font.weights.join(';');
  const axes = font.italic
    ? `ital,wght@${font.weights.map((w) => `0,${w}`).join(';')};${font.weights.map((w) => `1,${w}`).join(';')}`
    : `wght@${weights}`;
  return `https://fonts.googleapis.com/css2?family=${family}:${axes}&display=swap`;
}
