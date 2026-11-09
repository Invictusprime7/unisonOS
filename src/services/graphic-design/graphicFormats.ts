/**
 * Affinity Graphics formats. Every graphic document is laid out in design
 * units of CSS pixels at 96 per inch. Print formats include a bleed band on
 * every side (the canvas is trim + 2 × bleed) and a safe area inside the trim
 * where text must stay so it is not cut off by the printer.
 */

export const DESIGN_UNITS_PER_INCH = 96;
export const PRINT_EXPORT_DPI = 300;
const MM_PER_INCH = 25.4;

export type GraphicCategory = 'flyer' | 'poster' | 'banner' | 'business-card' | 'letterhead';

export interface GraphicFormat {
  id: string;
  label: string;
  category: GraphicCategory;
  /** Human size label shown to the owner, e.g. "8.5 × 11 in". */
  sizeLabel: string;
  /** Finished (trimmed) size in design units. */
  trimWidth: number;
  trimHeight: number;
  /** Bleed on each side in design units (0 for screen formats). */
  bleed: number;
  /** Distance from the trim edge that text should keep clear of. */
  safeMargin: number;
  print: boolean;
  /** Sides the format usually has (business cards: front and back). */
  defaultPages: 1 | 2;
  pageNames: string[];
}

const inch = (value: number) => Math.round(value * DESIGN_UNITS_PER_INCH);
const mm = (value: number) => Math.round((value / MM_PER_INCH) * DESIGN_UNITS_PER_INCH);
const PRINT_BLEED = inch(0.125);

function printFormat(
  id: string,
  label: string,
  category: GraphicCategory,
  sizeLabel: string,
  trimWidth: number,
  trimHeight: number,
  safeMargin: number,
  pages: 1 | 2 = 1,
): GraphicFormat {
  return {
    id,
    label,
    category,
    sizeLabel,
    trimWidth,
    trimHeight,
    bleed: PRINT_BLEED,
    safeMargin,
    print: true,
    defaultPages: pages,
    pageNames: pages === 2 ? ['Front', 'Back'] : ['Page 1'],
  };
}

export const GRAPHIC_FORMATS: readonly GraphicFormat[] = [
  printFormat('flyer-us-letter', 'Flyer', 'flyer', '8.5 × 11 in', inch(8.5), inch(11), inch(0.25)),
  printFormat('flyer-a5', 'Flyer (A5)', 'flyer', '148 × 210 mm', mm(148), mm(210), inch(0.2)),
  printFormat('flyer-a4', 'Flyer (A4)', 'flyer', '210 × 297 mm', mm(210), mm(297), inch(0.25)),
  printFormat('poster-18x24', 'Poster', 'poster', '18 × 24 in', inch(18), inch(24), inch(0.5)),
  printFormat('poster-11x17', 'Poster (tabloid)', 'poster', '11 × 17 in', inch(11), inch(17), inch(0.375)),
  printFormat('banner-rollup', 'Roll-up banner', 'banner', '33 × 80 in', inch(33), inch(80), inch(1.5)),
  printFormat('banner-vinyl-6x2', 'Outdoor banner', 'banner', '6 × 2 ft', inch(72), inch(24), inch(1)),
  {
    id: 'banner-web',
    label: 'Web banner',
    category: 'banner',
    sizeLabel: '1920 × 600 px',
    trimWidth: 1920,
    trimHeight: 600,
    bleed: 0,
    safeMargin: 48,
    print: false,
    defaultPages: 1,
    pageNames: ['Banner'],
  },
  printFormat('business-card-us', 'Business card', 'business-card', '3.5 × 2 in', inch(3.5), inch(2), inch(0.125), 2),
  printFormat('business-card-eu', 'Business card (EU)', 'business-card', '85 × 55 mm', mm(85), mm(55), inch(0.125), 2),
  printFormat('letterhead-us-letter', 'Letterhead', 'letterhead', '8.5 × 11 in', inch(8.5), inch(11), inch(0.5)),
  printFormat('letterhead-a4', 'Letterhead (A4)', 'letterhead', '210 × 297 mm', mm(210), mm(297), inch(0.5)),
];

export const DEFAULT_GRAPHIC_FORMAT_ID = 'flyer-us-letter';

const DEFAULT_FORMAT_BY_CATEGORY: Record<GraphicCategory, string> = {
  flyer: 'flyer-us-letter',
  poster: 'poster-18x24',
  banner: 'banner-rollup',
  'business-card': 'business-card-us',
  letterhead: 'letterhead-us-letter',
};

export const GRAPHIC_CATEGORY_LABELS: Record<GraphicCategory, string> = {
  flyer: 'Flyers',
  poster: 'Posters',
  banner: 'Banners',
  'business-card': 'Business cards',
  letterhead: 'Letterheads',
};

export function getGraphicFormat(id: string | null | undefined): GraphicFormat {
  return GRAPHIC_FORMATS.find((format) => format.id === id)
    ?? GRAPHIC_FORMATS.find((format) => format.id === DEFAULT_GRAPHIC_FORMAT_ID)!;
}

export function isGraphicFormatId(id: unknown): id is string {
  return typeof id === 'string' && GRAPHIC_FORMATS.some((format) => format.id === id);
}

export function defaultFormatForCategory(category: GraphicCategory): GraphicFormat {
  return getGraphicFormat(DEFAULT_FORMAT_BY_CATEGORY[category]);
}

/** Full canvas size, including bleed on both sides. */
export function canvasSize(format: GraphicFormat): { width: number; height: number } {
  return { width: format.trimWidth + format.bleed * 2, height: format.trimHeight + format.bleed * 2 };
}

/** Rectangle text should stay inside, in canvas coordinates. */
export function safeArea(format: GraphicFormat): { x: number; y: number; width: number; height: number } {
  const inset = format.bleed + format.safeMargin;
  const { width, height } = canvasSize(format);
  return { x: inset, y: inset, width: width - inset * 2, height: height - inset * 2 };
}

const MAX_EXPORT_DIMENSION = 12_000;
const MAX_EXPORT_AREA = 100_000_000;

/**
 * Pixel multiplier used for exports. Print formats aim for 300 DPI; very
 * large formats (roll-up banners) are capped so the browser can still draw
 * them, and the real resolution is reported back.
 */
export function exportScale(format: GraphicFormat): { multiplier: number; dpi: number } {
  if (!format.print) return { multiplier: 1, dpi: DESIGN_UNITS_PER_INCH };
  const { width, height } = canvasSize(format);
  const target = PRINT_EXPORT_DPI / DESIGN_UNITS_PER_INCH;
  const byDimension = MAX_EXPORT_DIMENSION / Math.max(width, height);
  const byArea = Math.sqrt(MAX_EXPORT_AREA / (width * height));
  const multiplier = Math.min(target, byDimension, byArea);
  return { multiplier, dpi: Math.round(multiplier * DESIGN_UNITS_PER_INCH) };
}

/** Wire format of a graphic format for the backend prompt. */
export function describeFormatForAI(format: GraphicFormat) {
  const size = canvasSize(format);
  const safe = safeArea(format);
  return {
    id: format.id,
    label: format.label,
    category: format.category,
    sizeLabel: format.sizeLabel,
    print: format.print,
    canvasWidth: size.width,
    canvasHeight: size.height,
    bleed: format.bleed,
    safeArea: safe,
    pageNames: format.pageNames,
  };
}
