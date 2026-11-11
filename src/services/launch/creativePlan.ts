/**
 * Creative plan projection for prompt-first creation (Native Authorship guide §4).
 *
 * A pure, deterministic reading of the owner's own words (and the site
 * direction they confirmed in chat) into explicit, ID-carrying requirements.
 * It extends the existing Universal Creation plan; it is not a second planner
 * and never decides the final design. Every value here is evidence for the
 * App Builder, and the original prompt remains the creative authority.
 */
import type {
  CreationRequirement,
  CreativeBrief,
  DesignDirection,
  UniversalCreationPage,
} from '@/platform/core/universalCreation';

/** Executable theme families, in no priority order: the owner's earliest mention wins. */
export const THEME_FAMILY_KEYWORDS: Readonly<Record<string, readonly string[]>> = {
  modern: ['modern', 'clean', 'contemporary', 'sleek'],
  editorial: ['editorial', 'magazine', 'magazine-style', 'luxury', 'elegant', 'serif'],
  futuristic: ['futuristic', 'tech', 'neon', 'cyber', 'sci-fi'],
  minimalist: ['minimalist', 'minimal', 'simple', 'whitespace'],
  bold: ['bold', 'loud', 'vibrant', 'high contrast', 'punchy', 'striking', 'dramatic', 'high-energy', 'energetic'],
  organic: ['organic', 'natural', 'earthy', 'warm', 'botanical', 'calm'],
};

/**
 * Styles no executable family names. They stay authoritative creative
 * requirements; the mapped family is only a provisional token base.
 */
const UNMAPPED_STYLE_BASE: ReadonlyArray<readonly [style: string, family: string]> = [
  ['cinematic', 'bold'], ['noir', 'bold'], ['brutalist', 'bold'], ['gritty', 'bold'], ['grunge', 'bold'],
  ['streetwear', 'bold'], ['maximalist', 'bold'], ['sporty', 'bold'], ['playful', 'bold'], ['rebellious', 'bold'],
  ['punk', 'bold'], ['y2k', 'futuristic'], ['vaporwave', 'futuristic'], ['synthwave', 'futuristic'],
  ['retro', 'editorial'], ['vintage', 'editorial'], ['art deco', 'editorial'], ['victorian', 'editorial'],
  ['whimsical', 'organic'], ['rustic', 'organic'], ['bohemian', 'organic'], ['boho', 'organic'],
  ['industrial', 'minimalist'], ['scandinavian', 'minimalist'], ['japandi', 'minimalist'], ['swiss', 'minimalist'],
];

/** Token base when the prompt names no style at all. Always labelled provisional. */
export const PROVISIONAL_THEME_BASE = 'modern';

const DIMENSIONS: ReadonlyArray<readonly [dimension: keyof CreativeBrief, pattern: RegExp]> = [
  ['tone', /\b(bold|loud|playful|serious|premium|luxurious|luxury|gritty|edgy|energetic|high[- ]energy|calm|friendly|authoritative|rebellious|cinematic|dramatic|vibrant|punchy|elegant|minimal(?:ist)?|moody|warm|fun|sporty|raw|sophisticated|quirky|whimsical|striking|noir|brutalist|retro|vintage|futuristic|organic|maximalist)\b/gi],
  ['typography', /\b(serif|sans[- ]serif|condensed (?:type|typography|headlines?)|(?:big|huge|oversized|massive|bold|chunky) (?:type|typography|headlines?|lettering)|display (?:type|typography)|editorial typography|monospace|handwritten|script (?:font|type))\b/gi],
  ['color', /(#[0-9a-f]{3,8}\b|\b(?:dark mode|dark theme|neon|monochrome|pastels?|high contrast|earthy tones|national colou?rs|(?:red|orange|yellow|green|blue|black|white|gold|teal|pink|maroon|navy|crimson|emerald|purple|violet|silver|cream|beige)(?: and (?:red|orange|yellow|green|blue|black|white|gold|teal|pink|maroon|navy|crimson|emerald|purple|violet|silver|cream|beige))?)\b)/gi],
  ['imagery', /\b(visually rich|image[- ]heavy|image[- ]led|photography|photos?|imagery|illustrations?|videos?|full[- ]bleed (?:images?|photos?|media)|action shots?|immersive imagery|hero (?:image|video)s?)\b/gi],
  ['composition', /\b(magazine[- ]style|editorial layout|asymmetric(?:al)?|bento|split[- ]screen|masonry|full[- ]bleed|long[- ]scroll|dense|airy|whitespace|grid layout|card grid|layered)\b/gi],
  ['motion', /\b(motion|animat(?:e|ed|ion|ions)|cinematic|parallax|scroll[- ]driven|kinetic|reveal(?:s| effects?)?|transitions?|micro[- ]interactions?)\b/gi],
  ['interactions', /\b(live (?:scores?|updates?|ticker|feed|blog|coverage|commentary|match(?:es)?)|tickers?|countdowns?|filters?|filterable|search(?:able)?|carousels?|sliders?|tabs|accordions?|interactive (?!match\b|match cent(?:re|er)\b)[a-z]+(?:[ -][a-z]+){0,2}|polls?|quiz(?:zes)?|calculators?|maps?|comments?|match cent(?:re|er)|fixtures?|standings|league tables?|leaderboards?|scoreboards?|playlists?|audio player|video player|before[- ]and[- ]after|dashboards?|charts?|analytics|artist showcase|lookbook|product configurator|booking calendar|class schedules?|facility maps?)\b/gi],
];

const NEGATION = /\b(?:no|not|without|avoid|exclude|omit|skip|never|don't|do not|doesn't|does not|less|fewer)\b(?:\s+\w+){0,3}\s*$/i;

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'item';
}

function isNegated(text: string, index: number): boolean {
  const before = text.slice(Math.max(0, index - 80), index);
  const clause = before.slice(Math.max(before.lastIndexOf('.'), before.lastIndexOf('!'), before.lastIndexOf('?'), before.lastIndexOf('\n'), before.lastIndexOf(';'), before.lastIndexOf(',')) + 1);
  return NEGATION.test(clause);
}

/** The sentence around an index, trimmed, so a requirement keeps its meaning. */
function evidenceAt(text: string, index: number): string {
  const start = Math.max(text.lastIndexOf('.', index), text.lastIndexOf('\n', index), text.lastIndexOf('!', index), text.lastIndexOf('?', index)) + 1;
  const ends = ['.', '\n', '!', '?'].map((mark) => text.indexOf(mark, index)).filter((position) => position >= 0);
  const end = ends.length ? Math.min(...ends) : text.length;
  const sentence = text.slice(start, end).replace(/\s+/g, ' ').trim();
  return sentence.length > 200 ? `${sentence.slice(0, 197)}…` : sentence;
}

function wordIndex(text: string, word: string): number {
  const match = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/[- ]/g, '[- ]')}\\b`, 'i').exec(text);
  return match && !isNegated(text, match.index) ? match.index : -1;
}

/** Earliest non-negated family mention in `text`; null when none. */
export function earliestThemeFamily(text: string): { familyId: string; phrase: string } | null {
  let best: { familyId: string; phrase: string; index: number } | null = null;
  for (const [familyId, words] of Object.entries(THEME_FAMILY_KEYWORDS)) {
    for (const word of words) {
      const index = wordIndex(text, word);
      if (index >= 0 && (!best || index < best.index)) best = { familyId, phrase: word, index };
    }
  }
  return best ? { familyId: best.familyId, phrase: best.phrase } : null;
}

function unmappedStyles(text: string): Array<{ style: string; family: string; index: number }> {
  return UNMAPPED_STYLE_BASE
    .map(([style, family]) => ({ style, family, index: wordIndex(text, style) }))
    .filter((entry) => entry.index >= 0)
    .sort((a, b) => a.index - b.index);
}

/**
 * Resolve the site-wide design direction without silently collapsing to
 * Modern: the owner's words win, then the confirmed chat direction, then a
 * clearly labelled provisional token base.
 */
export function resolveDesignDirection(ownerText: string, confirmedDirection = ''): DesignDirection {
  const styles = [...new Set([...unmappedStyles(ownerText), ...unmappedStyles(confirmedDirection)].map((entry) => entry.style))];
  const owner = earliestThemeFamily(ownerText);
  if (owner) {
    return { familyId: owner.familyId, origin: 'explicit', matchedPhrase: owner.phrase, unmappedStyles: styles,
      note: `The owner asked for "${owner.phrase}"; the ${owner.familyId} family supplies tokens and art direction.` };
  }
  const confirmed = confirmedDirection ? earliestThemeFamily(confirmedDirection) : null;
  if (confirmed) {
    return { familyId: confirmed.familyId, origin: 'confirmed', matchedPhrase: confirmed.phrase, unmappedStyles: styles,
      note: `The confirmed site direction says "${confirmed.phrase}"; the ${confirmed.familyId} family supplies tokens and art direction.` };
  }
  const nearest = [...unmappedStyles(ownerText), ...unmappedStyles(confirmedDirection)][0];
  if (nearest) {
    return { familyId: nearest.family, origin: 'provisional', matchedPhrase: nearest.style, unmappedStyles: styles,
      note: `No executable family matches "${nearest.style}". ${nearest.family} is only a provisional token base; realize "${styles.join('", "')}" through original layout, type, imagery and motion.` };
  }
  return { familyId: PROVISIONAL_THEME_BASE, origin: 'provisional', unmappedStyles: [],
    note: `The prompt names no visual style. ${PROVISIONAL_THEME_BASE} is only a provisional token base; derive the look from the subject and purpose in the prompt.` };
}

function collect(text: string, origin: CreationRequirement['origin'], into: Map<string, CreationRequirement>, brief: CreativeBrief): void {
  for (const [dimension, pattern] of DIMENSIONS) {
    for (const match of text.matchAll(pattern)) {
      const phrase = match[0].trim();
      if (isNegated(text, match.index ?? 0)) continue;
      const kind: CreationRequirement['kind'] = dimension === 'motion' ? 'motion' : dimension === 'interactions' ? 'interaction' : 'visual';
      const id = `req:${kind === 'visual' ? `${dimension}` : kind}:${slug(phrase)}`;
      if (!brief[dimension].some((value) => value.toLowerCase() === phrase.toLowerCase())) brief[dimension].push(phrase);
      if (!into.has(id)) into.set(id, { id, kind, text: `${dimension}: ${phrase}`, evidence: evidenceAt(text, match.index ?? 0), origin });
    }
  }
  for (const match of text.matchAll(/\b(?:inspired by|similar to|in the style of|reminiscent of|references? (?:like|such as))\s+([^.,;\n]{2,60})/gi)) {
    if (isNegated(text, match.index ?? 0)) continue;
    const reference = match[1].trim();
    if (!brief.references.includes(reference)) brief.references.push(reference);
    const id = `req:reference:${slug(reference)}`;
    if (!into.has(id)) into.set(id, { id, kind: 'reference', text: `reference (inspiration only): ${reference}`, evidence: evidenceAt(text, match.index ?? 0), origin });
  }
  for (const match of text.matchAll(/https?:\/\/[^\s<>"'()]+/gi)) {
    const url = match[0].replace(/[.,;:!?]+$/, '');
    if (/(?:instagram|facebook|fb|linkedin|youtube|youtu|tiktok|twitter|x|pinterest|github)\.(?:com|be)\b/i.test(url)) continue;
    if (!brief.references.includes(url)) brief.references.push(url);
    const id = `req:reference:${slug(url.replace(/^https?:\/\//, ''))}`;
    if (!into.has(id)) into.set(id, { id, kind: 'reference', text: `reference (inspiration only): ${url}`, evidence: evidenceAt(text, match.index ?? 0), origin });
  }
}

export function requestsMultiplePages(text: string): boolean {
  return /\b(?:multi[- ]?page|multiple pages|several pages|many pages|separate pages|full (?:web)?site with pages|(?:two|three|four|five|six|seven|eight|\d+)[- ]pages?)\b/i.test(text)
    && !/\b(?:single[- ]page|one[- ]page|landing page only)\b/i.test(text);
}

/**
 * Pages the AI proposed in the summary the owner confirmed. Only explicit page
 * lists count ("Pages: Home, Live, News…" or a bulleted list under a Pages
 * heading), so a passing mention of "contact" in prose never adds a page.
 */
export function confirmedPageNames(confirmedDirection: string): string[] {
  if (!confirmedDirection.trim()) return [];
  const names: string[] = [];
  const lines = confirmedDirection.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const inline = /\bpages?\b[^:\n]{0,40}[:–—-]\s*(.+)$/i.exec(lines[i]);
    if (inline && /[,/]|\band\b/.test(inline[1])) {
      names.push(...inline[1].split(/,|\/|\band\b|;/i));
      continue;
    }
    if (/^\s*(?:#+\s*)?(?:site\s+)?pages?\s*:?\s*$/i.test(lines[i].replace(/\*/g, ''))) {
      for (let j = i + 1; j < lines.length && /^\s*(?:[-*•]|\d+[.)])\s+/.test(lines[j]); j += 1) {
        names.push(lines[j].replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '').split(/\s[–—-]\s|:|\(/)[0]);
      }
    }
  }
  // Affinity's own summary lists destinations as bold bullets ("- **Tour dates**: …").
  // Bullets describing identity, look or audience are direction, not pages.
  for (const line of lines) {
    const bullet = /^\s*(?:[-*•]|\d+[.)])\s+\*\*([^*]{2,40})\*\*\s*[:–—-]/.exec(line);
    if (!bullet) continue;
    if (/\b(?:identity|name|look|feel|style|tone|vibe|colou?rs?|palette|fonts?|typography|audience|brand|design|aesthetic|mood|voice|goal|purpose|imagery|photos?|layout|navigation|footer|header|home ?page|overview|vision)\b/i.test(bullet[1])) continue;
    names.push(bullet[1]);
  }
  return [...new Set(names
    .map((name) => name.replace(/\*\*/g, '').replace(/\bpages?\b/gi, '').replace(/[.()[\]"“”]/g, '').trim())
    .filter((name) => name.length >= 2 && name.length <= 40 && /^[A-Za-z0-9&' /-]+$/.test(name)))];
}

export interface CreativePlanProjection {
  creativeBrief: CreativeBrief;
  requirements: CreationRequirement[];
  multiPage: boolean;
  designDirection: DesignDirection;
}

/**
 * Requirements read from the owner's words (explicit) and from the site
 * direction they confirmed (confirmed). Page and capability requirements are
 * added by the caller from the plan it already derives.
 */
export function deriveCreativePlan(ownerText: string, confirmedDirection = ''): CreativePlanProjection {
  const creativeBrief: CreativeBrief = { tone: [], typography: [], color: [], imagery: [], composition: [], motion: [], interactions: [], references: [] };
  const requirements = new Map<string, CreationRequirement>();
  collect(ownerText, 'explicit', requirements, creativeBrief);
  if (confirmedDirection) collect(confirmedDirection, 'confirmed', requirements, creativeBrief);
  const multiPage = requestsMultiplePages(ownerText) || requestsMultiplePages(confirmedDirection);
  if (multiPage) {
    const fromOwner = requestsMultiplePages(ownerText);
    const source = fromOwner ? ownerText : confirmedDirection;
    const index = source.search(/multi[- ]?page|multiple pages|several pages|pages?/i);
    requirements.set('req:navigation:multi-page', {
      id: 'req:navigation:multi-page', kind: 'navigation', text: 'multi-page site with navigable, independently composed pages',
      evidence: evidenceAt(source, Math.max(0, index)), origin: fromOwner ? 'explicit' : 'confirmed',
    });
  }
  return { creativeBrief, requirements: [...requirements.values()], multiPage, designDirection: resolveDesignDirection(ownerText, confirmedDirection) };
}

export function pageRequirements(pages: readonly UniversalCreationPage[], confirmedRoutes: ReadonlySet<string>): CreationRequirement[] {
  return pages.filter((page) => page.route !== '/').map((page) => ({
    id: `req:page:${slug(page.route)}`,
    kind: 'page' as const,
    text: `page ${page.route} (${page.title}): ${page.purpose}`,
    evidence: page.purpose,
    origin: confirmedRoutes.has(page.route.toLowerCase()) ? 'confirmed' as const : 'explicit' as const,
    pageRoute: page.route,
  }));
}

/** Requirement block that is never truncated in AI context. */
export function renderCreativeRequirements(requirements: readonly CreationRequirement[] | undefined, direction?: DesignDirection): string {
  const lines = (requirements ?? []).map((requirement) => `- [${requirement.id}] (${requirement.origin}) ${requirement.text}${requirement.evidence && !requirement.text.includes(requirement.evidence) ? ` — "${requirement.evidence}"` : ''}`);
  if (direction) {
    lines.unshift(`- [req:direction] (${direction.origin}) design direction ${direction.familyId}${direction.origin === 'provisional' ? ' — PROVISIONAL token base only' : ''}: ${direction.note}`);
  }
  return lines.length
    ? `CREATIVE REQUIREMENTS (from the owner's prompt and confirmed refinements; every ID must be visibly realized — they are never optional and never satisfied by generic sections):\n${lines.join('\n')}`
    : '';
}
