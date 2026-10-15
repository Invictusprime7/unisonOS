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

/** Cover-background styles; a shade matched to the text color keeps it readable. */
export function coverBackgroundStyles(src: string, scrim: 'light' | 'dark' | boolean | null | undefined): Record<string, string> {
  const url = `url("${src.replace(/"/g, '%22')}")`;
  const tone = scrim === true ? 'dark' : scrim || null;
  // Deliberate literals: written into the generated site, where app tokens do not apply.
  const shade = tone === 'light' ? 'rgba(255,255,255,0.78)' : 'rgba(0,0,0,0.5)';
  return {
    backgroundImage: tone ? `linear-gradient(${shade}, ${shade}), ${url}` : url,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  };
}

/** End offset (past `</tag>`) of the element opening at `start`, counting nested same-name tags. */
function closingEnd(source: string, start: number, tag: string): number {
  const re = new RegExp(`<(/?)${tag}\\b[^>]*?(/?)>`, 'gi');
  re.lastIndex = start;
  let depth = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) {
    if (m[2] === '/') { if (depth === 0) return re.lastIndex; continue; }
    depth += m[1] ? -1 : 1;
    if (depth === 0) return re.lastIndex;
  }
  return -1;
}

/**
 * Locates the clicked element by its own text instead of its position:
 * the nearest enclosing `<tag>` around a text run that occurs exactly once.
 */
export function boundsByText(source: string, tag: string, runs: string[]): { start: number; end: number } | null {
  const t = tag.toLowerCase();
  if (!/^[a-z][a-z0-9]*$/.test(t)) return null;
  for (const run of [...runs].sort((a, b) => b.length - a.length)) {
    const needle = run.slice(0, 40);
    const at = source.indexOf(needle);
    if (at < 0 || source.indexOf(needle, at + 1) >= 0) continue;
    const opens = [...source.slice(0, at).matchAll(new RegExp(`<${t}\\b`, 'gi'))].map((m) => m.index ?? 0).reverse();
    for (const start of opens) {
      const end = closingEnd(source, start, t);
      if (end > at) return { start, end };
    }
  }
  return null;
}

/** Bounds finder that trusts the selector only when the matched element holds the clicked text. */
export function anchoredFinder(fallback: BoundsFinder, anchor?: { tag?: string; runs?: string[] } | null): BoundsFinder {
  const runs = (anchor?.runs ?? []).filter((r) => r.length >= 6);
  if (!anchor?.tag || !runs.length) return fallback;
  return (source, selector) => {
    const b = fallback(source, selector);
    if (b && runs.some((r) => source.slice(b.start, b.end).includes(r.slice(0, 40)))) return b;
    return boundsByText(source, anchor.tag!, runs);
  };
}

/** Text runs inside clicked markup (source splits text across tags). */
export function textRunsFromHtml(html?: string): string[] {
  return [...new Set((html ?? '').replace(/<[^>]*>/g, '\n').split('\n')
    .map((t) => t.replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').trim())
    .filter((t) => t.length >= 6 && t.length <= 160 && !/[{}@;]/.test(t)))].slice(0, 8);
}

/** Dark text needs a light shade behind it, light text a dark one. */
export function scrimToneForTextColor(color?: string): 'light' | 'dark' {
  const m = String(color ?? '').match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
  if (!m) return 'dark';
  const [r, g, b] = [m[1], m[2], m[3]].map(Number);
  return (0.299 * r + 0.587 * g + 0.114 * b) < 140 ? 'light' : 'dark';
}
