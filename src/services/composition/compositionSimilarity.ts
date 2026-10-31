import type { CompositionSignature, HeroPattern, LayoutGeometry } from './types';

/** 0 = unrelated, 1 = identical topology. */
export function compositionSimilarity(a: CompositionSignature, b: CompositionSignature): number {
  let score = 0;
  if (a.hero === b.hero && a.hero !== 'none') score += 0.35;
  if (a.geometry === b.geometry) score += 0.2;
  if (a.density === b.density) score += 0.1;
  const len = Math.max(a.sectionOrder.length, b.sectionOrder.length);
  if (len > 0) {
    let same = 0;
    for (let i = 0; i < len; i++) if (a.sectionOrder[i] && a.sectionOrder[i] === b.sectionOrder[i]) same++;
    score += 0.35 * (same / len);
  }
  return Math.round(score * 100) / 100;
}

const FAMILY_HINTS: Array<[RegExp, string]> = [
  [/hero/i, 'hero'], [/gallery|masonry|portfolio|lookbook/i, 'gallery'], [/service|treatment/i, 'services'],
  [/menu/i, 'menu'], [/pricing|price/i, 'pricing'], [/testimonial|review/i, 'testimonials'],
  [/team|stylist|staff/i, 'team'], [/about|story/i, 'about'], [/faq/i, 'faq'], [/booking|reserv|appointment/i, 'booking'],
  [/contact/i, 'contact'], [/map|location/i, 'map'], [/cta|call-to-action/i, 'cta'], [/feature/i, 'features'],
];

/** Best-effort structural signature from an authored page's TSX source. */
export function extractCompositionSignature(source: string | undefined): CompositionSignature {
  const src = source ?? '';
  const order: string[] = [];
  const tagRe = /<(?:section|header)\b[^>]*?(?:data-ut-section(?:-type)?|id|aria-label|className)=["'{`]([^"'`}]+)/g;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(src))) {
    const hit = FAMILY_HINTS.find(([re]) => re.test(m![1]));
    const fam = hit?.[1] ?? 'content';
    if (order[order.length - 1] !== fam) order.push(fam);
  }
  const head = src.slice(0, 4000);
  let hero: HeroPattern = 'none';
  if (/h-screen|min-h-screen|min-h-\[(?:8|9|10)\dvh\]/.test(head) && /<img|<video|bg-\[url/.test(head)) hero = 'immersive-media';
  else if (/grid-cols-2|md:grid-cols-2|lg:grid-cols-2/.test(head) && /<img/.test(head)) hero = 'split-media';
  else if (/text-(?:6|7|8|9)xl/.test(head)) hero = 'typographic';
  else if (order[0] === 'hero') hero = 'editorial-intro';
  else if (/<h1/.test(head)) hero = 'utility-header';

  let geometry: LayoutGeometry = 'centered';
  if (/masonry|columns-\d|col-span-\d|row-span/.test(src)) geometry = 'asymmetric';
  else if (/absolute inset-0/.test(src)) geometry = 'layered';
  else if (/grid-cols-(?:3|4)/.test(src)) geometry = 'grid';
  else if (/grid-cols-2/.test(src)) geometry = 'split';

  const sections = order.length;
  const density = sections >= 6 ? 'high' : sections >= 3 ? 'medium' : 'low';
  const variants = [...new Set([...src.matchAll(/data-ut-variant\s*=\s*["']([a-z-]+:[a-z0-9-]+)["']/g)]
    .map((match) => match[1]).filter((id) => !/^(?:navbar|footer):/.test(id)))];
  return { hero, geometry, density, sectionOrder: order, variants };
}
