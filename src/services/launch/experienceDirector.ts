/**
 * Affinity Experience Director (Conversational Experience guide, 2026-11-10).
 *
 * The natural-language replacement for the retired Wizard's manual design
 * selections. It reads the owner's own words — the first request, the summary
 * they confirmed and every later refinement, in order — into explicit creative
 * decisions: site art direction, experience budget, hero layout, per-page and
 * per-section layouts, and original components the registry does not contain.
 *
 * It is a pure, deterministic projection over the existing canonical launch
 * brief. It is not a planner, compiler or writer: decisions resolve against
 * the certified design registry through intent-aware retrieval (REUSE / ADAPT
 * / AUTHOR), become never-truncated requirements, and seal into the existing
 * `WizardDesignSelection` the canonical pipeline already executes. Explicit
 * choices are never silently replaced; ties are broken by a stable hash of the
 * owner's words, never by a Modern-first default.
 */
import type {
  CreationRequirement,
  CreativeDecision,
  CreativeDecisionOrigin,
  CreativeResolution,
  DesignDirection,
  ExperienceDirection,
  UniversalCreationPage,
} from '@/platform/core/universalCreation';
import { ART_DIRECTION_PACKS, ART_DIRECTION_PACK_IDS, type ArtDirectionPackId } from '@/sections/variants/artDirectionPacks';
import { ART_DIRECTION_FAMILY_REGISTRY, industryPackCapability, isThemeFamilyId } from '@/sections/variants/themeFamily';
import type { VariantId } from '@/sections/variants/types';
import { listDesignImplementations, type DesignImplementation } from '@/services/designImplementationRegistry';
import { isProductionEligible } from '@/services/designImplementationEligibility';
import type { WizardDesignSelection, WizardExperiencePreference } from '@/services/wizardDesignSelection';

/** Persisted creative brief inside the site (compiler-owned metadata). */
export const CREATIVE_BRIEF_PATH = '/.unison/creative-brief.json';

export interface ExperienceDirectorInput {
  /** The owner's first request (primary creative authority). */
  ownerText: string;
  /** The Affinity summary the owner confirmed (accepted refinement). */
  confirmedDirection?: string;
  /** Later owner messages, in order; later ones win. */
  refinements?: readonly string[];
  /** Planned pages, so per-page decisions bind to real routes. */
  pages?: readonly Pick<UniversalCreationPage, 'route' | 'title'>[];
  /** Explicit/confirmed theme family, when the owner named one. */
  designDirection?: DesignDirection;
  /** Industry vertical mood words and host industry (inferred evidence only). */
  vertical?: { designTerms: readonly string[]; hostIndustry?: string | null } | null;
}

// ── Text helpers ──────────────────────────────────────────────────────────────

const NEGATION = /\b(?:no|not|without|avoid|exclude|omit|skip|never|don't|do not|doesn't|does not|less|fewer|instead of)\b(?:\s+[\w-]+){0,3}\s*$/i;

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'item';
}

function routeSlug(route: string | null): string {
  if (!route || route === '/') return 'home';
  return slug(route);
}

/** Stable FNV-1a hash; the same words always break a tie the same way. */
function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function sentencesOf(text: string): string[] {
  return text.split(/(?<=[.!?])\s+|\n+/).map((sentence) => sentence.trim()).filter(Boolean);
}

function isNegatedAt(text: string, index: number): boolean {
  const before = text.slice(Math.max(0, index - 60), index);
  const clause = before.slice(Math.max(before.lastIndexOf(','), before.lastIndexOf(';'), before.lastIndexOf(':')) + 1);
  return NEGATION.test(clause);
}

const MULTIWORD: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bfull[- ]bleed\b/g, 'full-bleed'], [/\bsplit[- ]screen\b/g, 'split-screen'], [/\bscroll[- ]driven\b/g, 'scroll-driven'],
  [/\bimage[- ]led\b/g, 'image-led'], [/\bimage[- ]heavy\b/g, 'image-heavy'], [/\bvisually rich\b/g, 'visually-rich'],
  [/\bhigh[- ]contrast\b/g, 'high-contrast'], [/\btwo[- ]column\b/g, 'two-column'], [/\bthree[- ]column\b/g, 'three-column'],
  [/\bbefore[- ](?:and|&)[- ]after\b/g, 'before-after'], [/\btour dates?\b/g, 'tour_dates'], [/\bmatch cent(?:re|er)\b/g, 'match_centre'],
  [/\blogo (?:cloud|wall|strip)\b/g, 'logo_cloud'], [/\bcall[- ]to[- ]action\b/g, 'cta'], [/\bcontact form\b/g, 'contact_form'],
  [/\bline[- ]up\b/g, 'lineup'], [/\bsign[- ]ups?\b/g, 'sign-ups'], [/\b3[- ]d\b/g, '3d'], [/\bbento[- ]box\b/g, 'bento'],
  [/\bside[- ]by[- ]side\b/g, 'side-by-side'], [/\bfull[- ]screen\b/g, 'fullscreen'], [/\bmicro[- ]interactions?\b/g, 'micro-interactions'],
];

/** Lower-cased text with multiword vocabulary joined, same length not guaranteed. */
function normalize(text: string): string {
  let next = text.toLowerCase().replace(/[’']/g, "'");
  for (const [pattern, joined] of MULTIWORD) next = next.replace(pattern, joined);
  return next;
}

// ── Vocabulary ────────────────────────────────────────────────────────────────

/** Section-family head nouns. Last noun in a run is the head. */
const FAMILY_NOUNS: Readonly<Record<string, string>> = {
  hero: 'hero', heroes: 'hero', masthead: 'hero',
  gallery: 'gallery', galleries: 'gallery', reel: 'gallery', filmstrip: 'gallery', lookbook: 'gallery', carousel: 'gallery', slideshow: 'gallery', portfolio: 'gallery',
  testimonials: 'testimonials', testimonial: 'testimonials', reviews: 'testimonials', quotes: 'testimonials',
  pricing: 'pricing', packages: 'pricing',
  faq: 'faq', faqs: 'faq',
  team: 'team', crew: 'team',
  stats: 'stats', statistics: 'stats', numbers: 'stats', metrics: 'stats', scores: 'stats', scoreboard: 'stats',
  features: 'features',
  services: 'services', offerings: 'services',
  news: 'blog-preview', articles: 'blog-preview', blog: 'blog-preview', posts: 'blog-preview', journal: 'blog-preview',
  logos: 'logo-cloud', sponsors: 'logo-cloud', partners: 'logo-cloud', logo_cloud: 'logo-cloud',
  contact_form: 'contact',
  cta: 'cta',
  navigation: 'navbar', navbar: 'navbar', nav: 'navbar',
  footer: 'footer',
};

/** Experiences no certified family implements; they are authored originals. */
const ORIGINAL_NOUNS: Readonly<Record<string, string>> = {
  timeline: 'timeline', itinerary: 'itinerary', schedule: 'schedule', tour_dates: 'tour-dates', setlist: 'setlist',
  lineup: 'lineup', match_centre: 'match-centre', countdown: 'countdown', map: 'map', playlist: 'playlist', player: 'player',
  ticker: 'ticker', rsvp: 'rsvp', configurator: 'configurator', calculator: 'calculator', quiz: 'quiz', leaderboard: 'leaderboard',
  standings: 'standings', fixtures: 'fixtures', discography: 'discography', releases: 'releases', menu: 'menu',
};

/** Trailing words that do not change the head noun ("editorial news layouts"). */
const TRAILING_NOISE = new Set(['layout', 'layouts', 'section', 'sections', 'design', 'designs', 'style', 'block', 'blocks', 'area', 'strip', 'wall', 'feed', 'experience', 'module', 'component', 'grid']);

/** Layout and treatment modifiers Affinity understands (prefix or postfix). */
const LAYOUT_WORDS = new Set([
  'horizontal', 'vertical', 'masonry', 'bento', 'grid', 'mosaic', 'editorial', 'magazine', 'cinematic', 'immersive', 'full-bleed',
  'split', 'split-screen', 'side-by-side', 'asymmetric', 'asymmetrical', 'carousel', 'marquee', 'scrolling', 'rail', 'sticky',
  'animated', 'kinetic', 'interactive', 'minimal', 'minimalist', 'card', 'cards', 'list', 'alternating', 'accordion', 'tabbed',
  'filterable', 'searchable', 'comparison', 'toggle', 'spotlight', 'featured', 'large', 'oversized', 'fullscreen', 'parallax',
  'layered', 'stacked', 'two-column', 'three-column', 'video', 'photo', 'photography', 'image-led', 'image-heavy', 'visually-rich',
  'dark', 'bold', 'playful', 'elegant', 'romantic', 'scroll-driven', 'centered', 'centred', 'statement', 'typographic',
  'poster', 'dramatic', 'moody', 'luxurious', 'compact', 'expandable', 'lightbox', 'wide', 'filmic', 'dynamic', 'live',
  'swipeable', 'swipe', 'collage', 'portrait', 'gradient', 'glass', 'neon', 'retro', 'vintage', 'brutalist', 'clean', 'simple',
]);

/** Retrieval synonyms: an owner word → registry words that realize it. */
const SYNONYMS: Readonly<Record<string, readonly string[]>> = {
  horizontal: ['horizontal', 'reel', 'rail', 'filmstrip', 'sequential', 'carousel'],
  vertical: ['vertical'],
  cinematic: ['cinematic', 'full-bleed', 'immersive', 'dramatic', 'wide', 'prisma'],
  filmic: ['cinematic', 'film', 'full-bleed'],
  immersive: ['immersive', 'full-bleed', 'cinematic', 'stream', 'spatial', 'depth'],
  photography: ['image', 'media', 'photo', 'full-bleed', 'fan', 'stream', 'gallery', 'cinematic'],
  photo: ['image', 'media', 'photo', 'full-bleed'],
  'image-led': ['image', 'media', 'full-bleed'],
  'image-heavy': ['image', 'media', 'full-bleed', 'gallery'],
  'visually-rich': ['image', 'media', 'cinematic', 'mosaic'],
  video: ['video', 'media', 'cinematic', 'full-bleed'],
  editorial: ['editorial', 'magazine', 'mosaic', 'banner', 'lead', 'featured'],
  magazine: ['editorial', 'magazine', 'featured', 'lead'],
  masonry: ['masonry'],
  bento: ['bento', 'mosaic'],
  mosaic: ['mosaic', 'bento'],
  collage: ['mosaic', 'masonry', 'fan'],
  split: ['split'], 'split-screen': ['split'], 'side-by-side': ['split'],
  asymmetric: ['asymmetric', 'mosaic', 'editorial'], asymmetrical: ['asymmetric', 'mosaic', 'editorial'],
  centered: ['centered', 'center'], centred: ['centered', 'center'],
  carousel: ['carousel', 'rail', 'reel'], swipeable: ['rail', 'reel', 'carousel'], swipe: ['rail', 'reel'],
  marquee: ['marquee', 'scrolling', 'ticker'], scrolling: ['marquee', 'reel', 'rail', 'stream'],
  rail: ['rail', 'reel'],
  minimal: ['minimal', 'clean', 'statement', 'centered'], minimalist: ['minimal', 'clean', 'statement'],
  clean: ['clean', 'minimal'], simple: ['minimal', 'clean', 'compact'],
  statement: ['statement', 'type-led', 'underline'], typographic: ['type-led', 'statement', 'variable-type', 'underline'],
  comparison: ['comparison', 'table'], toggle: ['toggle', 'billing'],
  accordion: ['accordion', 'expandable'], expandable: ['expandable', 'accordion'],
  cards: ['cards', 'card', 'grid'], card: ['card', 'cards'], grid: ['grid'], list: ['list', 'compact', 'rows'], compact: ['compact', 'list'],
  spotlight: ['spotlight', 'featured'], featured: ['featured', 'spotlight', 'lead'],
  animated: ['motion', 'marquee', 'stream', 'animated'], kinetic: ['motion', 'marquee', 'variable-type'], dynamic: ['motion', 'stream'],
  'scroll-driven': ['motion', 'stream', 'perspective'], parallax: ['motion', 'perspective', 'depth'],
  layered: ['layered', 'depth', 'overlap'], stacked: ['stacked', 'editorial'],
  bold: ['bold', 'dramatic', 'poster'], dramatic: ['dramatic', 'cinematic', 'full-bleed'], poster: ['poster', 'bold'],
  large: ['full-bleed', 'wide', 'bold'], oversized: ['full-bleed', 'bold', 'variable-type'], fullscreen: ['full-bleed', 'immersive'], wide: ['wide', 'full-bleed'],
  lightbox: ['lightbox', 'inspection'], interactive: ['interactive', 'slider', 'lightbox'], alternating: ['alternating'],
  searchable: ['searchable'], filterable: ['searchable', 'filter'], tabbed: ['tabs', 'tabbed'],
  'two-column': ['two-column', 'split', 'columns'], 'three-column': ['columns', 'grid'],
  portrait: ['portrait'], gradient: ['gradient'], glass: ['glass'], neon: ['neon', 'signal'],
  dark: ['dark', 'minimal-dark', 'noir', 'cinematic'], moody: ['dark', 'cinematic'], elegant: ['editorial', 'premium'],
  romantic: ['editorial', 'soft', 'image'], luxurious: ['premium', 'editorial'], playful: ['fan', 'playful'], live: ['live', 'ticker', 'marquee'],
};

const BREAK_WORDS = new Set([
  'a', 'an', 'the', 'with', 'and', 'or', 'plus', 'of', 'for', 'to', 'in', 'on', 'at', 'our', 'my', 'your', 'their', 'its', 'his', 'her',
  'that', 'which', 'is', 'are', 'be', 'should', 'must', 'has', 'have', 'include', 'including', 'featuring', 'features?', 'very', 'really',
  'some', 'also', 'but', 'page', 'pages', 'site', 'website', 'make', 'create', 'build', 'add', 'want', 'need', 'like', 'use', 'using', 'from',
  'into', 'this', 'it', 'as', 'by', 'more', 'less', 'much', 'even', 'way', 'too', 'than', 'dedicated', 'separate', 'own', 'new', ',',
]);
const POSTFIX_SKIP = new Set(['is', 'be', 'feel', 'feels', 'look', 'looks', 'should', 'must', 'more', 'much', 'even', 'a', 'bit', 'lot', 'way', 'to', 'far', 'really', 'very', 'extra', 'super', 'so', 'and', 'become', 'made', 'make']);
const REPLACE_WORDS = /\b(?:instead|replace|swap|switch (?:it )?to|change (?:it |the \w+ )?(?:to|into)|turn (?:it )?into|use an?|rather than)\b/i;
const PRESERVE_REST = /\b(?:leave|keep)\b[^.!?]{0,48}\b(?:rest|everything else|other (?:pages?|sections?|parts?)|same|unchanged|as (?:is|it is)|alone)\b|\bonly (?:change|update|touch|edit|adjust)\b|\bnothing else\b|\bdon'?t (?:change|touch) (?:anything|the rest)\b/i;

// ── Art direction retrieval ───────────────────────────────────────────────────

/** Owner style word → packs whose grammar realizes it (higher is stronger). */
const PACK_AFFINITY: Readonly<Record<string, Partial<Record<ArtDirectionPackId, number>>>> = {
  cinematic: { 'cinematic-portfolio': 5, 'editorial-noir': 3, 'noir-atelier': 1 },
  filmic: { 'cinematic-portfolio': 4, 'editorial-noir': 2 }, film: { 'cinematic-portfolio': 3 },
  immersive: { 'cinematic-portfolio': 2, 'glass-tech': 1, 'neon-grid': 1 },
  moody: { 'editorial-noir': 4, 'noir-atelier': 3, 'cinematic-portfolio': 2 },
  dark: { 'editorial-noir': 3, 'noir-atelier': 3, 'neon-grid': 2, 'cinematic-portfolio': 1, 'mono-terminal': 1 },
  noir: { 'editorial-noir': 5, 'noir-atelier': 4 },
  romantic: { 'soft-editorial': 4, 'warm-craft': 3, 'luxury-minimal': 2, 'print-serif': 2 },
  dreamy: { 'soft-editorial': 3, 'luxury-minimal': 1 }, soft: { 'soft-editorial': 3, 'organic-studio': 1 },
  airy: { 'soft-editorial': 3, 'luxury-minimal': 2, 'swiss-grid': 1 }, gentle: { 'soft-editorial': 2, 'organic-studio': 1 },
  elegant: { 'luxury-minimal': 4, 'noir-atelier': 3, 'print-serif': 2, 'soft-editorial': 2 },
  luxury: { 'luxury-minimal': 4, 'noir-atelier': 3, 'editorial-noir': 2 }, luxurious: { 'luxury-minimal': 4, 'noir-atelier': 3 },
  premium: { 'luxury-minimal': 3, 'noir-atelier': 2, 'commerce-editorial': 1 }, sophisticated: { 'luxury-minimal': 3, 'editorial-noir': 2, 'print-serif': 1 },
  editorial: { 'print-serif': 4, 'editorial-noir': 3, 'soft-editorial': 2, 'commerce-editorial': 1 },
  magazine: { 'print-serif': 4, 'editorial-noir': 3, 'soft-editorial': 1 }, serif: { 'print-serif': 3, 'editorial-noir': 2, 'soft-editorial': 1 },
  typographic: { 'print-serif': 2, 'swiss-grid': 2, 'brutalist-poster': 2 },
  bold: { 'bold-commercial': 4, 'brutalist-poster': 3, 'neon-grid': 1 },
  loud: { 'brutalist-poster': 3, 'bold-commercial': 3 }, punchy: { 'bold-commercial': 3, 'brutalist-poster': 2 },
  striking: { 'bold-commercial': 2, 'brutalist-poster': 2, 'editorial-noir': 1 }, vibrant: { 'bold-commercial': 3, 'neon-grid': 1 },
  energetic: { 'bold-commercial': 3, 'brutalist-poster': 1 }, 'high-energy': { 'bold-commercial': 3, 'brutalist-poster': 1 },
  sporty: { 'bold-commercial': 3, 'brutalist-poster': 1 }, 'high-contrast': { 'bold-commercial': 2, 'brutalist-poster': 2, 'editorial-noir': 1 },
  dramatic: { 'cinematic-portfolio': 2, 'editorial-noir': 2, 'bold-commercial': 1 },
  brutalist: { 'brutalist-poster': 5 }, poster: { 'brutalist-poster': 4 }, raw: { 'brutalist-poster': 3 }, gritty: { 'brutalist-poster': 3, 'editorial-noir': 1 },
  grunge: { 'brutalist-poster': 4 }, punk: { 'brutalist-poster': 4 }, rebellious: { 'brutalist-poster': 3 }, streetwear: { 'brutalist-poster': 3, 'bold-commercial': 1 },
  neon: { 'neon-grid': 5 }, cyber: { 'neon-grid': 4 }, cyberpunk: { 'neon-grid': 5 }, synthwave: { 'neon-grid': 4 }, vaporwave: { 'neon-grid': 3 },
  futuristic: { 'glass-tech': 3, 'neon-grid': 3, 'mono-terminal': 2 }, 'sci-fi': { 'neon-grid': 3, 'glass-tech': 2 }, tech: { 'glass-tech': 3, 'mono-terminal': 2 },
  glass: { 'glass-tech': 5 }, glassmorphism: { 'glass-tech': 5 }, terminal: { 'mono-terminal': 5 }, developer: { 'mono-terminal': 3 }, monospace: { 'mono-terminal': 4 },
  minimal: { 'swiss-grid': 3, 'luxury-minimal': 3 }, minimalist: { 'swiss-grid': 3, 'luxury-minimal': 3 }, whitespace: { 'luxury-minimal': 2, 'swiss-grid': 2 },
  swiss: { 'swiss-grid': 5 }, clean: { 'swiss-grid': 2, 'luxury-minimal': 1, 'glass-tech': 1 }, simple: { 'swiss-grid': 2 },
  scandinavian: { 'swiss-grid': 2, 'organic-studio': 2 }, japandi: { 'luxury-minimal': 2, 'organic-studio': 2 },
  organic: { 'organic-studio': 4, 'warm-craft': 2 }, natural: { 'organic-studio': 3, 'warm-craft': 1 }, earthy: { 'organic-studio': 3, 'warm-craft': 2 },
  botanical: { 'organic-studio': 4 }, calm: { 'organic-studio': 2, 'soft-editorial': 2 }, serene: { 'organic-studio': 2, 'luxury-minimal': 2 },
  warm: { 'warm-craft': 4, 'organic-studio': 2 }, rustic: { 'warm-craft': 4 }, handmade: { 'warm-craft': 4 }, crafted: { 'warm-craft': 3 },
  cozy: { 'warm-craft': 3 }, boho: { 'warm-craft': 3, 'organic-studio': 2 }, bohemian: { 'warm-craft': 3, 'organic-studio': 2 },
  retro: { 'print-serif': 3, 'warm-craft': 2 }, vintage: { 'print-serif': 3, 'warm-craft': 2 }, 'art-deco': { 'noir-atelier': 3, 'print-serif': 2 },
  playful: { 'bold-commercial': 2, 'warm-craft': 2 }, fun: { 'bold-commercial': 2 }, whimsical: { 'warm-craft': 3, 'organic-studio': 1 },
  modern: { 'glass-tech': 2, 'swiss-grid': 2, 'commerce-editorial': 1, 'bold-commercial': 1 }, contemporary: { 'swiss-grid': 2, 'glass-tech': 1 }, sleek: { 'glass-tech': 2, 'luxury-minimal': 1 },
  boutique: { 'commerce-editorial': 3, 'luxury-minimal': 1 }, shop: { 'commerce-editorial': 2 }, store: { 'commerce-editorial': 2 },
  'visually-rich': { 'cinematic-portfolio': 2, 'editorial-noir': 1, 'commerce-editorial': 1 }, 'image-heavy': { 'cinematic-portfolio': 2 },
  'image-led': { 'cinematic-portfolio': 2 }, photography: { 'cinematic-portfolio': 2, 'luxury-minimal': 1 }, gallery: { 'cinematic-portfolio': 1 },
};

const RICH_MEDIA_WORDS = new Set(['visually-rich', 'image-heavy', 'image-led', 'photography', 'cinematic', 'immersive']);

function packFamilies(id: ArtDirectionPackId): string[] {
  const entry = ART_DIRECTION_FAMILY_REGISTRY[id];
  return entry ? [entry.primaryFamily, ...entry.secondaryFamilies] : [];
}

interface PackScore { packId: ArtDirectionPackId; score: number; evidence: Array<{ word: string; origin: CreativeDecisionOrigin }> }

function wordHits(text: string): Array<{ word: string; index: number }> {
  const normalized = normalize(text);
  const hits: Array<{ word: string; index: number }> = [];
  for (const match of normalized.matchAll(/[a-z0-9][a-z0-9-]*/g)) {
    const word = match[0];
    if (PACK_AFFINITY[word] && !isNegatedAt(normalized, match.index ?? 0)) hits.push({ word, index: match.index ?? 0 });
  }
  return hits;
}

function negatedStyleWords(text: string): string[] {
  const normalized = normalize(text);
  const words: string[] = [];
  for (const match of normalized.matchAll(/[a-z0-9][a-z0-9-]*/g)) {
    if (PACK_AFFINITY[match[0]] && isNegatedAt(normalized, match.index ?? 0)) words.push(match[0]);
  }
  return words;
}

function explicitPackNamed(text: string): ArtDirectionPackId | null {
  const normalized = text.toLowerCase();
  let best: { id: ArtDirectionPackId; index: number } | null = null;
  for (const id of ART_DIRECTION_PACK_IDS) {
    const name = ART_DIRECTION_PACKS[id].name.toLowerCase();
    const pattern = new RegExp(`\\b(?:${name.replace(/[- ]/g, '[- ]')}|${id.replace(/-/g, '[- ]')})\\b`);
    const match = pattern.exec(normalized);
    if (match && !isNegatedAt(normalized, match.index) && (!best || match.index < best.index)) best = { id, index: match.index };
  }
  return best?.id ?? null;
}

function resolveArtDirection(
  sources: ReadonlyArray<{ text: string; origin: CreativeDecisionOrigin; weight: number }>,
  input: ExperienceDirectorInput,
  experience: WizardExperiencePreference,
): ExperienceDirection['artDirection'] {
  // An owner-named pack wins outright; the latest naming wins.
  for (const source of [...sources].reverse()) {
    const named = explicitPackNamed(source.text);
    if (named) {
      const pack = ART_DIRECTION_PACKS[named];
      return { packId: named, packName: pack.name, familyId: ART_DIRECTION_FAMILY_REGISTRY[named].primaryFamily, origin: source.origin, evidence: [pack.name.toLowerCase()], alternatives: [] };
    }
  }
  const direction = input.designDirection;
  const familyLocked = direction && direction.origin !== 'provisional' && isThemeFamilyId(direction.familyId) ? direction.familyId : null;
  const candidates = ART_DIRECTION_PACK_IDS.filter((id) => !familyLocked || packFamilies(id).includes(familyLocked));
  const scores = new Map<ArtDirectionPackId, PackScore>(candidates.map((id) => [id, { packId: id, score: 0, evidence: [] }]));
  const add = (id: ArtDirectionPackId, amount: number, word: string, origin: CreativeDecisionOrigin) => {
    const entry = scores.get(id);
    if (!entry) return;
    entry.score += amount;
    if (amount > 0 && !entry.evidence.some((item) => item.word === word)) entry.evidence.push({ word, origin });
  };
  for (const source of sources) {
    for (const { word } of wordHits(source.text)) {
      for (const [id, weight] of Object.entries(PACK_AFFINITY[word]!)) add(id as ArtDirectionPackId, (weight ?? 0) * source.weight, word, source.origin);
      if (RICH_MEDIA_WORDS.has(word)) {
        for (const id of candidates) {
          const pack = ART_DIRECTION_PACKS[id];
          if (pack.design.mediaTreatment === 'full-bleed' || pack.signature?.density === 'gallery') add(id, 0.5 * source.weight, word, source.origin);
        }
      }
    }
    for (const word of negatedStyleWords(source.text)) {
      for (const [id, weight] of Object.entries(PACK_AFFINITY[word]!)) add(id as ArtDirectionPackId, -(weight ?? 0) * source.weight, word, source.origin);
    }
    if (/\b(?:no|without|avoid)\s+gradients?\b/i.test(source.text)) {
      for (const id of candidates) if ((ART_DIRECTION_PACKS[id].signature?.gradient ?? 'none') !== 'none') add(id, -2, 'no gradients', source.origin);
    }
  }
  // Trade mood words (music → moody, cinematic…) are suggestions, never authority.
  for (const term of input.vertical?.designTerms ?? []) {
    const word = normalize(term).replace(/\s+/g, '-');
    for (const [id, weight] of Object.entries(PACK_AFFINITY[word] ?? {})) add(id as ArtDirectionPackId, (weight ?? 0) * 0.35, word, 'inferred');
  }
  const industryPacks = industryPackCapability(input.vertical?.hostIndustry ?? null) ?? [];
  for (const id of industryPacks) add(id, 0.25, 'industry fit', 'inferred');
  if (familyLocked) {
    for (const id of candidates) add(id, ART_DIRECTION_FAMILY_REGISTRY[id].primaryFamily === familyLocked ? 3 : 1, familyLocked, direction!.origin === 'confirmed' ? 'confirmed' : 'explicit');
  }
  for (const id of candidates) {
    if (experience === 'immersive' && !ART_DIRECTION_FAMILY_REGISTRY[id].experiences.includes('immersive')) add(id, -2, 'immersive budget', 'inferred');
  }
  const tieSeed = sources.map((source) => source.text).join('\n');
  const ranked = [...scores.values()].sort((a, b) => b.score - a.score
    || (stableHash(`${tieSeed}|${a.packId}`) - stableHash(`${tieSeed}|${b.packId}`)));
  const best = ranked[0];
  const words = best.evidence.filter((item) => item.word !== 'industry fit');
  const strongest = words.find((item) => item.origin === 'refinement') ?? words.find((item) => item.origin === 'explicit')
    ?? words.find((item) => item.origin === 'confirmed') ?? null;
  const pack = ART_DIRECTION_PACKS[best.packId];
  const familyId = familyLocked && packFamilies(best.packId).includes(familyLocked) ? familyLocked : ART_DIRECTION_FAMILY_REGISTRY[best.packId].primaryFamily;
  return {
    packId: best.packId,
    packName: pack.name,
    familyId,
    origin: strongest?.origin ?? 'inferred',
    evidence: words.map((item) => item.word).slice(0, 6),
    alternatives: ranked.slice(1, 4).filter((entry) => entry.score > 0).map((entry) => ({ packId: entry.packId, score: Math.round(entry.score * 10) / 10 })),
  };
}

// ── Experience budget ────────────────────────────────────────────────────────

const IMMERSIVE_3D = /\b(?:3d|three\.?js|webgl|immersive (?:3d|world|scene|experience|environment)|fully immersive|spatial)\b/i;
const MOTION_WORDS = /\b(?:motion|animat(?:e|ed|ion|ions)|cinematic|parallax|scroll-driven|kinetic|immersive|dynamic|reveals?|transitions?|micro-interactions?)\b/i;
const STATIC_WORDS = /\b(?:(?:no|without|minimal|less|reduced|little|subtle) (?:motion|animations?)|static)\b/i;

/** Experience budget a single message asks for; null when it says nothing. */
export function experienceFromText(text: string): WizardExperiencePreference | null {
  const normalized = normalize(text);
  if (STATIC_WORDS.test(normalized)) return 'standard';
  const immersive = IMMERSIVE_3D.exec(normalized);
  if (immersive && !isNegatedAt(normalized, immersive.index)) return 'immersive';
  const motion = MOTION_WORDS.exec(normalized);
  if (motion && !isNegatedAt(normalized, motion.index)) return 'motion-rich';
  return null;
}

// ── Section decisions ────────────────────────────────────────────────────────

interface PhraseMatch {
  target: CreativeDecision['target'];
  family: string;
  value: string;
  modifiers: string[];
  subject: string[];
  explicitRoute: string | null;
  replace: boolean;
}

function matchPage(words: string, pages: readonly Pick<UniversalCreationPage, 'route' | 'title'>[]): string | null {
  const clean = words.toLowerCase().replace(/_/g, ' ').trim();
  if (!clean) return null;
  for (const page of pages) {
    if (page.route === '/') continue;
    const title = page.title.toLowerCase();
    const route = page.route.replace(/^\//, '').replace(/[-_]/g, ' ').toLowerCase();
    if (clean === title || clean === route || clean.replace(/s$/, '') === title.replace(/s$/, '') || clean.replace(/s$/, '') === route.replace(/s$/, '')) return page.route;
  }
  if (/^(?:home|homepage|landing|front)$/.test(clean)) return '/';
  return null;
}

/** "On the gallery page, …" applies to the whole sentence; other page references to their clause. */
function sentencePageScope(sentence: string, pages: readonly Pick<UniversalCreationPage, 'route' | 'title'>[]): string | null {
  const lead = /^\s*(?:on|for|in)\s+(?:the\s+|my\s+|our\s+)?([a-z][a-z &'-]{1,30}?)\s+page\b/i.exec(sentence);
  if (lead) return matchPage(lead[1], pages);
  const subject = /\bthe\s+([a-z][a-z &'-]{1,30}?)\s+page\s+(?:should|must|needs?|will|can|has|have|gets?|with|:)/i.exec(sentence);
  return subject ? matchPage(subject[1], pages) : null;
}

function clauseOf(sentence: string, index: number): string {
  const start = Math.max(sentence.lastIndexOf(',', index), sentence.lastIndexOf(';', index)) + 1;
  const ends = [',', ';'].map((mark) => sentence.indexOf(mark, index)).filter((position) => position >= 0);
  return sentence.slice(start, ends.length ? Math.min(...ends) : sentence.length);
}

function phrasesIn(sentence: string, pages: readonly Pick<UniversalCreationPage, 'route' | 'title'>[]): PhraseMatch[] {
  const normalized = normalize(sentence);
  // Punctuation is a hard phrase boundary ("gallery, tour dates" are two phrases).
  const tokens = [...normalized.matchAll(/[a-z0-9_][a-z0-9_-]*|[,;:()&/]/g)]
    .map((match) => ({ word: /^[,;:()&/]$/.test(match[0]) ? ',' : match[0], index: match.index ?? 0 }));
  const sentenceScope = sentencePageScope(normalized, pages);
  const replace = REPLACE_WORDS.test(normalized);
  const matches: PhraseMatch[] = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const word = tokens[i].word;
    const family = FAMILY_NOUNS[word];
    const original = ORIGINAL_NOUNS[word];
    if (!family && !original) continue;
    // The last noun in a run is the head ("story timeline", "releases gallery").
    let next = i + 1;
    while (next < tokens.length && TRAILING_NOISE.has(tokens[next].word)) next += 1;
    if (next < tokens.length && (FAMILY_NOUNS[tokens[next].word] || ORIGINAL_NOUNS[tokens[next].word]) && next === i + 1) continue;
    if (isNegatedAt(normalized, tokens[i].index)) continue;
    const prefix: string[] = [];
    for (let back = i - 1; back >= 0 && prefix.length < 4; back -= 1) {
      const candidate = tokens[back].word;
      if (BREAK_WORDS.has(candidate) || /^\d+$/.test(candidate)) break;
      prefix.unshift(candidate);
    }
    const postfix: string[] = [];
    for (let forward = next; forward < tokens.length && postfix.length < 4; forward += 1) {
      const candidate = tokens[forward].word;
      if (POSTFIX_SKIP.has(candidate) && !postfix.length) continue;
      if (!LAYOUT_WORDS.has(candidate)) break;
      postfix.push(candidate);
    }
    const leadingModifiers = prefix.filter((candidate) => LAYOUT_WORDS.has(candidate));
    const subject = prefix.filter((candidate) => !LAYOUT_WORDS.has(candidate) && !FAMILY_NOUNS[candidate]);
    const modifiers = [...new Set([...leadingModifiers, ...postfix])];
    // A plain mention ("tour dates", "a gallery") is a page or interaction, not a layout decision.
    if (!modifiers.length && !(original && subject.length) && word !== 'timeline') continue;
    const clause = normalize(clauseOf(sentence, tokens[i].index));
    const clausePage = /\b([a-z][a-z &'-]{1,30}?)\s+page\b/.exec(clause);
    const explicitRoute = sentenceScope ?? (clausePage ? matchPage(clausePage[1], pages) : null);
    const valueWords = [...prefix, word.replace(/_/g, ' '), ...postfix].join(' ').replace(/_/g, ' ');
    matches.push({
      target: family === 'hero' ? 'hero' : family ? 'section' : 'original',
      family: family ?? original!,
      value: valueWords,
      modifiers,
      subject,
      explicitRoute,
      replace,
    });
  }
  return matches;
}

let implementationCache: DesignImplementation[] | null = null;
function certifiedImplementations(): DesignImplementation[] {
  implementationCache ??= listDesignImplementations().filter((implementation) => Boolean(implementation.variantId) && isProductionEligible(implementation));
  return implementationCache;
}

function haystackOf(implementation: DesignImplementation): string {
  return [implementation.implementationId, implementation.variantId, implementation.slug, implementation.name, implementation.description, ...implementation.tags]
    .filter(Boolean).join(' ').toLowerCase();
}

const THREE_D = /\b(?:3d|tunnel|webgl|spatial)\b/;

/** Intent-aware retrieval of certified designs for a family and the owner's words. */
export function rankCertifiedDesigns(family: string, words: readonly string[], experience: WizardExperiencePreference): {
  ranked: Array<{ id: string; name: string; score: number }>;
  unmatched: string[];
} {
  const pool = certifiedImplementations().filter((implementation) => implementation.sectionType === family);
  const unmatched = new Set(words);
  const ranked = pool.map((implementation) => {
    const haystack = haystackOf(implementation);
    let score = 0;
    for (const word of words) {
      const direct = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(haystack);
      const synonym = (SYNONYMS[word] ?? []).some((term) => haystack.includes(term));
      if (direct) score += 2;
      else if (synonym) score += 1;
      if (direct || synonym) unmatched.delete(word);
    }
    if (THREE_D.test(haystack) && experience !== 'immersive' && !words.includes('3d')) score -= 3;
    return { id: implementation.variantId as string, name: implementation.name, score };
  }).filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  // Words a top match lacks remain unmatched even if a lower match had them.
  if (ranked[0]) {
    const top = pool.find((implementation) => implementation.variantId === ranked[0].id)!;
    const haystack = haystackOf(top);
    for (const word of words) {
      const hit = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(haystack) || (SYNONYMS[word] ?? []).some((term) => haystack.includes(term));
      if (!hit) unmatched.add(word); else unmatched.delete(word);
    }
  }
  return { ranked, unmatched: [...unmatched] };
}

function decisionId(match: Pick<PhraseMatch, 'target' | 'family'>, route: string | null): string {
  if (match.target === 'hero') return `dec:hero:${routeSlug(route ?? '/')}`;
  if (match.target === 'section') return `dec:section:${match.family}:${route ? routeSlug(route) : 'site'}`;
  return `dec:original:${slug(match.family)}:${route ? routeSlug(route) : 'site'}`;
}

function resolveDecision(
  match: PhraseMatch,
  route: string | null,
  origin: CreativeDecisionOrigin,
  evidence: string,
  experience: WizardExperiencePreference,
  modifiers: string[] = match.modifiers,
): CreativeDecision {
  const id = decisionId(match, route);
  if (match.target === 'original') {
    return { id, target: 'original', family: match.family, pageRoute: route, value: match.value, modifiers, origin, evidence,
      resolution: 'author', implementationIds: [], unmatched: modifiers };
  }
  const { ranked, unmatched } = rankCertifiedDesigns(match.family, modifiers, experience);
  const coverage = modifiers.length ? (modifiers.length - unmatched.length) / modifiers.length : 0;
  const resolution: CreativeResolution = !ranked.length ? 'author' : coverage >= 0.99 && ranked[0].score >= 2 ? 'reuse' : 'adapt';
  return {
    id, target: match.target, family: match.family, pageRoute: route, value: match.value, modifiers, origin, evidence,
    resolution, implementationIds: ranked.slice(0, 3).map((entry) => entry.id), unmatched: resolution === 'reuse' ? [] : unmatched,
  };
}

function implicitRoute(match: PhraseMatch, pages: readonly Pick<UniversalCreationPage, 'route' | 'title'>[]): string | null {
  if (match.explicitRoute) return match.explicitRoute;
  if (match.target === 'hero') return '/';
  for (const word of [...match.subject, match.family]) {
    const route = matchPage(word.replace(/-/g, ' '), pages);
    if (route && route !== '/') return route;
  }
  return null;
}

// ── Direction assembly ────────────────────────────────────────────────────────

interface RefinementOutcome {
  direction: ExperienceDirection;
  changed: string[];
}

function applyMessage(
  direction: ExperienceDirection,
  text: string,
  origin: CreativeDecisionOrigin,
  pages: readonly Pick<UniversalCreationPage, 'route' | 'title'>[],
): RefinementOutcome {
  const decisions = new Map(direction.decisions.map((decision) => [decision.id, decision]));
  const changed: string[] = [];
  for (const sentence of sentencesOf(text)) {
    for (const match of phrasesIn(sentence, pages)) {
      const route = implicitRoute(match, pages);
      const id = decisionId(match, route);
      const previous = decisions.get(id);
      // The owner's first request may not be overridden by a lower-authority summary.
      if (previous && origin === 'confirmed' && previous.origin === 'explicit') continue;
      const modifiers = previous && !match.replace && origin === 'refinement'
        ? [...new Set([...match.modifiers, ...previous.modifiers])]
        : match.modifiers.length ? match.modifiers : previous?.modifiers ?? [];
      const merged = previous && origin === 'refinement' && !match.replace
        ? { ...match, value: `${previous.value} — ${match.value}`, modifiers }
        : match;
      decisions.set(id, resolveDecision(merged, route, origin, sentence.slice(0, 220), direction.experience.value, modifiers));
      changed.push(id);
    }
  }
  return { direction: { ...direction, decisions: [...decisions.values()] }, changed };
}

/** Owner text with decision phrases removed, so "immersive hero" does not restyle the whole site. */
function siteStyleText(text: string, pages: readonly Pick<UniversalCreationPage, 'route' | 'title'>[]): string {
  let next = normalize(text);
  for (const sentence of sentencesOf(text)) {
    for (const match of phrasesIn(sentence, pages)) {
      if (!match.modifiers.length) continue;
      next = next.replace(normalize(match.value).replace(/ /g, ' '), ' ');
    }
  }
  return next;
}

function isSectionScoped(text: string, pages: readonly Pick<UniversalCreationPage, 'route' | 'title'>[]): boolean {
  return sentencesOf(text).some((sentence) => phrasesIn(sentence, pages).length > 0);
}

/** Read the conversation into the creative brief. Deterministic for the same words. */
export function deriveExperienceDirection(input: ExperienceDirectorInput): ExperienceDirection {
  const pages = input.pages ?? [];
  const refinements = input.refinements ?? [];
  // Experience: later explicit statements win; the first request leads otherwise.
  let experience: ExperienceDirection['experience'] = { value: 'standard', origin: 'inferred', evidence: '' };
  const experienceSources: Array<[string, CreativeDecisionOrigin]> = [
    [input.ownerText, 'explicit'], [input.confirmedDirection ?? '', 'confirmed'], ...refinements.map((text) => [text, 'refinement'] as [string, CreativeDecisionOrigin]),
  ];
  for (const [text, origin] of experienceSources) {
    if (!text.trim()) continue;
    const value = experienceFromText(text);
    if (!value) continue;
    if (origin === 'confirmed' && experience.origin === 'explicit') continue;
    if (origin === 'refinement' && PRESERVE_REST.test(text)) continue;
    experience = { value, origin, evidence: sentencesOf(text).find((sentence) => experienceFromText(sentence) === value)?.slice(0, 200) ?? text.slice(0, 200) };
  }
  const styleSources = [
    { text: siteStyleText(input.ownerText, pages), origin: 'explicit' as const, weight: 1 },
    ...(input.confirmedDirection ? [{ text: siteStyleText(input.confirmedDirection, pages), origin: 'confirmed' as const, weight: 0.6 }] : []),
    // Section-scoped refinements ("make the hero more cinematic") never restyle the site.
    ...refinements.filter((text) => !isSectionScoped(text, pages) && !PRESERVE_REST.test(text))
      .map((text) => ({ text: normalize(text), origin: 'refinement' as const, weight: 3 })),
  ];
  let direction: ExperienceDirection = {
    version: 1,
    artDirection: resolveArtDirection(styleSources, input, experience.value),
    experience,
    decisions: [],
    locked: [],
  };
  direction = applyMessage(direction, input.ownerText, 'explicit', pages).direction;
  if (input.confirmedDirection) direction = applyMessage(direction, input.confirmedDirection, 'confirmed', pages).direction;
  for (const refinement of refinements) direction = refineExperienceDirection(direction, refinement, pages).direction;
  return direction;
}

/**
 * Apply one later owner message. Only the decisions it names change; when it
 * says "leave the rest unchanged" every other decision is locked.
 */
export function refineExperienceDirection(
  direction: ExperienceDirection,
  message: string,
  pages: readonly Pick<UniversalCreationPage, 'route' | 'title'>[] = [],
): RefinementOutcome & { locked: string[]; preserveRest: boolean } {
  const outcome = applyMessage(direction, message, 'refinement', pages);
  const preserveRest = PRESERVE_REST.test(message) || (outcome.changed.length > 0 && /\bonly\b/i.test(message));
  let next = outcome.direction;
  if (!outcome.changed.length && !preserveRest) {
    const value = experienceFromText(message);
    if (value) next = { ...next, experience: { value, origin: 'refinement', evidence: message.slice(0, 200) } };
  }
  const allIds = ['dec:art-direction', 'dec:experience', ...next.decisions.map((decision) => decision.id)];
  const locked = preserveRest ? allIds.filter((id) => !outcome.changed.includes(id)) : next.locked.filter((id) => !outcome.changed.includes(id));
  next = { ...next, locked: [...new Set(locked)] };
  return { direction: next, changed: outcome.changed, locked: next.locked, preserveRest };
}

// ── Projections ───────────────────────────────────────────────────────────────

function implementationName(id: string): string {
  return certifiedImplementations().find((implementation) => implementation.variantId === id)?.name ?? id;
}

function decisionText(decision: CreativeDecision): string {
  const where = decision.pageRoute ? ` on ${decision.pageRoute}` : ' wherever it appears';
  const label = decision.target === 'hero' ? 'hero' : decision.target === 'section' ? `${decision.family} section` : `original ${decision.family}`;
  const best = decision.implementationIds[0];
  const how = decision.resolution === 'reuse'
    ? `REUSE certified ${best} (${implementationName(best)}) — it matches; do not swap it for another variant`
    : decision.resolution === 'adapt'
      ? `ADAPT certified ${best} (${implementationName(best)}) as the base and realize ${decision.unmatched.length ? `"${decision.unmatched.join('", "')}"` : 'the requested treatment'} through its props or a site-local derivative marked // @unison-derived-from ${best}`
      : `AUTHOR an original site-local component under /src/project-components/ (no certified design fits)`;
  return `${label}${where}: "${decision.value}" → ${how}`;
}

/** ID-carrying requirements for the never-truncated creative block and coverage. */
export function experienceRequirements(direction: ExperienceDirection | undefined): CreationRequirement[] {
  if (!direction) return [];
  const requirementOrigin = (origin: CreativeDecisionOrigin): CreationRequirement['origin'] => origin === 'inferred' ? 'inferred' : origin === 'confirmed' ? 'confirmed' : 'explicit';
  const art = direction.artDirection;
  const requirements: CreationRequirement[] = [{
    id: 'req:experience:art-direction',
    kind: 'experience',
    text: `art direction ${art.packId} (${art.packName}, ${art.familyId} family) — compose every page in this grammar${art.evidence.length ? `; chosen for "${art.evidence.join('", "')}"` : ''}`,
    evidence: art.evidence.join(', ') || 'matched to the subject',
    origin: requirementOrigin(art.origin),
    design: { kind: 'art-direction', packId: art.packId, decisionId: 'dec:art-direction' },
  }];
  if (direction.experience.value !== 'standard' || direction.experience.origin !== 'inferred') {
    requirements.push({
      id: 'req:experience:budget',
      kind: 'experience',
      text: `experience ${direction.experience.value}${direction.experience.value === 'standard' ? ' — keep motion restrained' : ' — realize purposeful motion that respects reduced-motion'}`,
      evidence: direction.experience.evidence,
      origin: requirementOrigin(direction.experience.origin),
      design: { kind: 'experience', experience: direction.experience.value, decisionId: 'dec:experience' },
    });
  }
  for (const decision of direction.decisions) {
    requirements.push({
      id: `req:experience:${decision.id.replace(/^dec:/, '')}`,
      kind: 'experience',
      text: decisionText(decision),
      evidence: decision.evidence,
      origin: requirementOrigin(decision.origin),
      ...(decision.pageRoute ? { pageRoute: decision.pageRoute } : {}),
      evidenceTerms: [decision.value, decision.family.replace(/-/g, ' ')],
      design: {
        kind: decision.target === 'original' ? 'original' : 'section',
        family: decision.family,
        implementationIds: decision.implementationIds,
        resolution: decision.resolution,
        decisionId: decision.id,
      },
    });
  }
  return requirements;
}

/** Executable Wizard-equivalent selection: sealed pack, experience and owner pins. */
export function designSelectionFromDirection(direction: ExperienceDirection): Pick<WizardDesignSelection, 'mode' | 'artDirectionPackId' | 'experience' | 'sectionPins' | 'routePins'> {
  const sectionPins: Record<string, VariantId> = {};
  const routePins: Record<string, Record<string, VariantId>> = {};
  for (const decision of direction.decisions) {
    const best = decision.implementationIds[0];
    if (!best || decision.resolution === 'author' || decision.target === 'original') continue;
    if (decision.pageRoute) {
      routePins[decision.pageRoute] = { ...(routePins[decision.pageRoute] ?? {}), [decision.family]: best as VariantId };
    } else {
      sectionPins[decision.family] = best as VariantId;
    }
  }
  return {
    mode: direction.artDirection.origin === 'inferred' && !direction.decisions.length ? 'auto' : 'guided',
    artDirectionPackId: direction.artDirection.packId as ArtDirectionPackId,
    experience: direction.experience.value,
    sectionPins,
    routePins,
  };
}

/** Certified implementation pins per planned page (site-wide pins land on every page). */
export function pinnedImplementationsByRoute(
  selection: Pick<WizardDesignSelection, 'sectionPins' | 'routePins'> | undefined,
  routes: readonly string[],
): Record<string, string[]> {
  if (!selection) return {};
  const result: Record<string, string[]> = {};
  for (const route of routes) {
    const ids = [...Object.values(selection.sectionPins ?? {}), ...Object.values(selection.routePins?.[route] ?? {})];
    if (ids.length) result[route] = [...new Set(ids.map(String))];
  }
  return result;
}

/** Owner-facing labels for the Creative Brief inspector. */
export function describeOrigin(origin: CreativeDecisionOrigin): string {
  return origin === 'explicit' ? 'Your words' : origin === 'confirmed' ? 'Confirmed' : origin === 'refinement' ? 'Refined' : 'Suggested';
}

export function describeResolution(decision: CreativeDecision): string {
  const best = decision.implementationIds[0];
  if (decision.resolution === 'reuse' && best) return `Unison design: ${implementationName(best)}`;
  if (decision.resolution === 'adapt' && best) return `Adapted from ${implementationName(best)}`;
  return 'Designed for your site';
}

// ── Persisted brief + edit refinement ────────────────────────────────────────

export interface PersistedCreativeBrief {
  version: 1;
  direction: ExperienceDirection;
  pages: Array<{ route: string; title: string }>;
}

export function serializeCreativeBrief(direction: ExperienceDirection, pages: readonly Pick<UniversalCreationPage, 'route' | 'title'>[]): string {
  const brief: PersistedCreativeBrief = { version: 1, direction, pages: pages.map(({ route, title }) => ({ route, title })) };
  return JSON.stringify(brief, null, 2);
}

export function readCreativeBrief(files: Readonly<Record<string, string>> | undefined | null): PersistedCreativeBrief | null {
  const raw = files?.[CREATIVE_BRIEF_PATH];
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PersistedCreativeBrief;
    return parsed?.version === 1 && parsed.direction?.version === 1 && Array.isArray(parsed.direction.decisions) ? parsed : null;
  } catch {
    return null;
  }
}

/** True when an edit instruction asks for a creative change Affinity can record. */
export function isCreativeRefinement(brief: PersistedCreativeBrief, instruction: string): boolean {
  if (!instruction.trim()) return false;
  const outcome = refineExperienceDirection(brief.direction, instruction, brief.pages);
  return outcome.changed.length > 0 || JSON.stringify(outcome.direction.experience) !== JSON.stringify(brief.direction.experience);
}

/**
 * The refined brief file for an Affinity edit, or null when the instruction
 * changes no creative decision. Rides the edit's own canonical commit.
 */
export function refinedCreativeBriefFile(files: Readonly<Record<string, string>>, instruction: string | undefined): { contents: string; changed: string[]; locked: string[] } | null {
  const brief = readCreativeBrief(files);
  if (!brief || !instruction?.trim()) return null;
  const outcome = refineExperienceDirection(brief.direction, instruction, brief.pages);
  const contents = serializeCreativeBrief(outcome.direction, brief.pages);
  if (contents === files[CREATIVE_BRIEF_PATH]) return null;
  return { contents, changed: outcome.changed, locked: outcome.locked };
}

/** Edit-time directive: the sealed brief plus exactly which decisions this request may change. */
export function renderCreativeBriefDirective(brief: PersistedCreativeBrief | null, instruction?: string | null): string {
  if (!brief) return '';
  const outcome = instruction?.trim() ? refineExperienceDirection(brief.direction, instruction, brief.pages) : null;
  const direction = outcome?.direction ?? brief.direction;
  const lines = experienceRequirements(direction).map((requirement) => `- [${requirement.id}] ${requirement.text}`);
  const changed = outcome?.changed ?? [];
  return [
    'SEALED CREATIVE BRIEF (the owner\'s conversational design decisions; never silently replace them):',
    ...lines,
    changed.length
      ? `This request changes only: ${changed.join(', ')}. ${outcome!.preserveRest ? 'The owner asked to leave everything else unchanged: do not edit other sections, pages, the art direction or the experience budget.' : 'Keep every other decision as recorded.'}`
      : 'This request names no creative decision; keep every decision above as recorded.',
  ].join('\n');
}
