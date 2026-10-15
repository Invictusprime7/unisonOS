/**
 * Pure helpers for placing a picture on an element that had none:
 * as a new <img> at the top of the element, or as a cover background.
 */
type BoundsFinder = (source: string, selector: string) => { start: number; end: number } | null;

/** Index just past the opening tag's `>` (ignores `>` inside quotes/braces), or -1 if self-closing/unfound. */
export function openingTagEnd(source: string, start: number): number {
  let depth = 0;
  let quote: string | null = null;
  for (let i = start + 1; i < source.length; i++) {
    const c = source[i];
    if (quote) { if (c === quote) quote = null; continue; }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') depth--;
    else if (c === '>' && depth === 0) return source[i - 1] === '/' ? -1 : i + 1;
  }
  return -1;
}

const escAttr = (v: string) => v.replace(/"/g, '&quot;');

/** Inserts `<img>` as the first child of the selected element. Returns null when it cannot. */
export function insertImageIntoElement(source: string, selector: string, src: string, alt: string, findBounds: BoundsFinder): string | null {
  const bounds = findBounds(source, selector);
  if (!bounds) return null;
  const at = openingTagEnd(source, bounds.start);
  if (at < 0 || at > bounds.end) return null;
  const lineStart = source.lastIndexOf('\n', bounds.start) + 1;
  const indent = (source.slice(lineStart, bounds.start).match(/^\s*/)?.[0] ?? '') + '  ';
  const tag = `\n${indent}<img src="${escAttr(src)}" alt="${escAttr(alt)}" loading="lazy" className="w-full aspect-video object-cover" />`;
  return source.slice(0, at) + tag + source.slice(at);
}

/** Cover-background styles; a dark scrim keeps text on top readable. */
export function coverBackgroundStyles(src: string, withScrim: boolean): Record<string, string> {
  const url = `url("${src.replace(/"/g, '%22')}")`;
  return {
    backgroundImage: withScrim ? `linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.45)), ${url}` : url,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  };
}
