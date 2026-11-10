/**
 * Industry vertical library: data packs plus one universal reader.
 *
 * Adding a vertical means adding a pack file and listing it in VERTICAL_PACKS;
 * detection, requirements, page inference, composition and brief rendering
 * never change per vertical.
 */
import type { CreationRequirement, CreationVertical, UniversalCreationPage } from '@/platform/core/universalCreation';
import { resolveTopologyPageRoleAlias } from '@/platform/core/siteTopologyPlanner';
import type { IndustryVerticalPack, VerticalInteraction, VerticalPage, VerticalSubVariant } from './types';
import { SPORTS } from './sports';
import { TRAVEL } from './travel';
import { EVENTS } from './events';
import { MUSIC } from './music';
import { WEDDINGS } from './weddings';
import { FITNESS } from './fitness';
import { HOSPITALITY } from './hospitality';
import { PHOTOGRAPHY } from './photography';

export type { IndustryVerticalPack, VerticalInteraction, VerticalPage, VerticalSubVariant } from './types';

export const VERTICAL_PACKS: readonly IndustryVerticalPack[] = [SPORTS, TRAVEL, EVENTS, MUSIC, WEDDINGS, FITNESS, HOSPITALITY, PHOTOGRAPHY];

export function getVerticalPack(id: string | null | undefined): IndustryVerticalPack | undefined {
  return id ? VERTICAL_PACKS.find((pack) => pack.id === id) : undefined;
}

const NEGATION = /\b(?:no|not|without|avoid|exclude|omit|skip|never|don't|do not|doesn't|does not)\b(?:\s+\w+){0,3}\s*$/i;

function escape(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\?[- ]/g, '[- ]?');
}

/** Non-negated occurrences of a keyword (word-bounded, hyphen/space tolerant). */
function occurrences(text: string, keyword: string): number[] {
  const pattern = new RegExp(`(?<![a-z0-9])${escape(keyword.toLowerCase())}(?![a-z0-9])`, 'gi');
  const hits: number[] = [];
  for (const match of text.toLowerCase().matchAll(pattern)) {
    const index = match.index ?? 0;
    const before = text.slice(Math.max(0, index - 60), index);
    const clause = before.slice(Math.max(before.lastIndexOf('.'), before.lastIndexOf(','), before.lastIndexOf(';'), before.lastIndexOf('\n')) + 1);
    if (!NEGATION.test(clause)) hits.push(index);
  }
  return hits;
}

const words = (keyword: string) => keyword.trim().split(/\s+/).length;

interface PackScore { pack: IndustryVerticalPack; score: number; last: number; evidence: string[] }

function scorePack(pack: IndustryVerticalPack, text: string): PackScore {
  let score = 0;
  let last = -1;
  const evidence: string[] = [];
  const consider = (keyword: string, weight: number) => {
    const hits = occurrences(text, keyword);
    if (!hits.length) return;
    score += weight;
    last = Math.max(last, ...hits);
    evidence.push(keyword);
  };
  for (const keyword of new Set(pack.keywords)) consider(keyword, words(keyword));
  // Multi-word variant phrases ("wedding photographer") identify the trade
  // more precisely than the single nouns they contain.
  for (const variant of pack.variants) {
    for (const keyword of variant.keywords) if (words(keyword) > 1 && !pack.keywords.includes(keyword)) consider(keyword, words(keyword));
  }
  return { pack, score, last, evidence };
}

function pickVariant(pack: IndustryVerticalPack, text: string): VerticalSubVariant | null {
  let best: { variant: VerticalSubVariant; score: number } | null = null;
  for (const variant of pack.variants) {
    const score = variant.keywords.reduce((sum, keyword) => sum + (occurrences(text, keyword).length ? words(keyword) : 0), 0);
    if (score > 0 && (!best || score > best.score)) best = { variant, score };
  }
  return best?.variant ?? null;
}

/**
 * Read the vertical from the owner's words. Ties go to the later mention,
 * because English compounds put the business noun last ("festival
 * photographer", "wedding venue"). Returns null when nothing matches.
 */
export function resolveIndustryVertical(text: string): CreationVertical | null {
  if (!text.trim()) return null;
  const ranked = VERTICAL_PACKS.map((pack) => scorePack(pack, text))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || b.last - a.last);
  const [primary, second] = ranked;
  if (!primary) return null;
  const variant = pickVariant(primary.pack, text);
  return {
    packId: primary.pack.id,
    variantId: variant?.id ?? null,
    blendPackId: second && second.score >= 1 ? second.pack.id : null,
    confidence: Math.min(1, primary.score / 3),
    evidence: primary.evidence.slice(0, 6),
  };
}

function interactionsFor(vertical: CreationVertical | null | undefined): VerticalInteraction[] {
  const packs = [getVerticalPack(vertical?.packId), getVerticalPack(vertical?.blendPackId)].filter(Boolean) as IndustryVerticalPack[];
  return packs.flatMap((pack) => pack.interactions);
}

function evidenceSentence(text: string, index: number): string {
  const start = Math.max(text.lastIndexOf('.', index), text.lastIndexOf('\n', index), text.lastIndexOf('!', index), text.lastIndexOf('?', index)) + 1;
  const ends = ['.', '\n', '!', '?'].map((mark) => text.indexOf(mark, index)).filter((position) => position >= 0);
  const sentence = text.slice(start, ends.length ? Math.min(...ends) : text.length).replace(/\s+/g, ' ').trim();
  return sentence.length > 200 ? `${sentence.slice(0, 197)}…` : sentence;
}

const camelWords = (name: string) => name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();

/**
 * Interaction requirements the owner asked for in the trade's own words.
 * Multi-word phrases count for every vertical ("seat map"); single words
 * ("classes", "rooms") only for the vertical(s) the prompt is about.
 */
export function verticalInteractionRequirements(
  text: string,
  origin: CreationRequirement['origin'],
  vertical: CreationVertical | null | undefined,
): CreationRequirement[] {
  const scoped = new Set(interactionsFor(vertical).map((interaction) => interaction.id));
  const found = new Map<string, CreationRequirement>();
  for (const pack of VERTICAL_PACKS) {
    for (const interaction of pack.interactions) {
      if (found.has(interaction.id)) continue;
      const inScope = scoped.has(interaction.id) && (pack.id === vertical?.packId || pack.id === vertical?.blendPackId);
      for (const keyword of interaction.keywords) {
        if (words(keyword) < 2 && !inScope) continue;
        const [index] = occurrences(text, keyword);
        if (index === undefined) continue;
        found.set(interaction.id, {
          id: `req:interaction:${interaction.id}`,
          kind: 'interaction',
          text: `interactions: ${interaction.label}`,
          evidence: evidenceSentence(text, index),
          origin,
          ...(interaction.sampleDataRequired ? { sampleDataRequired: true } : {}),
          evidenceTerms: [...new Set([interaction.label, camelWords(interaction.originalComponent), ...interaction.keywords.filter((phrase) => words(phrase) > 1)])],
        });
        break;
      }
    }
  }
  return [...found.values()];
}

function variantOf(vertical: CreationVertical | null | undefined): { pack: IndustryVerticalPack; variant: VerticalSubVariant } | null {
  const pack = getVerticalPack(vertical?.packId);
  if (!pack) return null;
  return { pack, variant: pack.variants.find((variant) => variant.id === vertical?.variantId) ?? pack.variants[0] };
}

/**
 * Typical pages for the vertical, used only when the owner asked for several
 * pages without naming enough of them. Never duplicates a route or a non-custom
 * role the plan already has.
 */
export function inferVerticalPages(
  vertical: CreationVertical | null | undefined,
  existing: readonly Pick<UniversalCreationPage, 'route' | 'suggestedRole'>[],
  limit = 4,
): VerticalPage[] {
  const resolved = variantOf(vertical);
  if (!resolved) return [];
  const routes = new Set(existing.map((page) => page.route.toLowerCase()));
  // A page's role comes from its suggested role or, when unset, its route ("/blog" → blog).
  const roleOf = (page: Pick<UniversalCreationPage, 'route' | 'suggestedRole'>) => page.suggestedRole || resolveTopologyPageRoleAlias(page.route) || null;
  const roles = new Set(existing.map(roleOf).filter((role) => role && role !== 'custom'));
  const pages: VerticalPage[] = [];
  for (const page of resolved.variant.pages) {
    if (pages.length >= limit) break;
    if (routes.has(page.route.toLowerCase()) || (page.role !== 'custom' && roles.has(page.role))) continue;
    routes.add(page.route.toLowerCase());
    if (page.role !== 'custom') roles.add(page.role);
    pages.push(page);
  }
  return pages;
}

const singular = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/s\b/g, '');

/**
 * Page vocabulary across every pack: resolves an owner-named destination
 * ("tour dates", "RSVP", "lineup") to a pack page's route and role. Advisory
 * only — unknown names still become their own custom page.
 */
export function matchVerticalPageName(name: string, preferredPackId?: string): VerticalPage | null {
  const key = singular(name);
  if (!key) return null;
  let prefix: VerticalPage | null = null;
  const packs = [...VERTICAL_PACKS].sort((a, b) => Number(b.id === preferredPackId) - Number(a.id === preferredPackId));
  for (const pack of packs) {
    for (const variant of pack.variants) {
      for (const page of variant.pages) {
        const title = singular(page.title);
        const slug = singular(page.route.replace(/^\//, ''));
        if (key === title || key === slug) return page;
        if (!prefix && (key.startsWith(`${title} `) || key.startsWith(`${slug} `))) prefix = page;
      }
    }
  }
  return prefix;
}

/** Composition industry for a build: dedicated industry profiles win, then the vertical. */
export function compositionIndustryFor(
  industry: string,
  vertical: CreationVertical | null | undefined,
  hasDedicatedProfiles: (industryId: string) => boolean,
): string {
  if (hasDedicatedProfiles(industry)) return industry;
  return getVerticalPack(vertical?.packId) ? vertical!.packId : industry;
}

/** Ranking words for certified design retrieval (mood/structure + signature experiences). */
export function verticalDesignTerms(vertical: CreationVertical | null | undefined): string[] {
  const resolved = variantOf(vertical);
  if (!resolved) return [];
  const signature = resolved.pack.interactions.filter((interaction) => resolved.variant.signatureInteractions.includes(interaction.id));
  return [...new Set([...resolved.pack.designTerms, ...signature.map((interaction) => interaction.label)])];
}

/** Authoring knowledge block for the App Builder page brief. Guidance only. */
export function renderVerticalKnowledge(vertical: CreationVertical | null | undefined): string {
  const resolved = variantOf(vertical);
  if (!resolved) return '';
  const { pack, variant } = resolved;
  const explicitVariant = Boolean(vertical?.variantId);
  const signature = pack.interactions.filter((interaction) => variant.signatureInteractions.includes(interaction.id));
  const others = pack.interactions.filter((interaction) => !variant.signatureInteractions.includes(interaction.id));
  const describe = (interaction: VerticalInteraction) =>
    `${interaction.label} — ${interaction.brief} Certified fit: ${interaction.certifiedFamilies.join('/') || 'none'}; otherwise author /src/project-components/${pack.id}/${interaction.originalComponent}.tsx${interaction.sampleDataRequired ? ' [labelled sample data unless connected]' : ''}`;
  const blend = getVerticalPack(vertical?.blendPackId);
  return [
    `INDUSTRY KNOWLEDGE (${pack.label} · ${explicitVariant ? variant.label : `variant not stated; closest: ${pack.variants.map((entry) => entry.label).join(' / ')}`}; matched: ${vertical?.evidence.join(', ') || 'n/a'}). Unison vertical guidance: the owner's prompt and CREATIVE REQUIREMENTS win wherever they differ; never add pages, capabilities, facts or claims the owner did not ask for.`,
    `- Trade vocabulary: ${[...pack.vocabulary, ...variant.vocabulary].join(', ')}.`,
    `- Content objects (show as structured, labelled sample content unless the owner supplied it): ${pack.contentObjects.map((object) => `${object.label} (${object.fields.join(', ')})`).join('; ')}.`,
    `- Proof visitors trust here: ${pack.proofMechanisms.join('; ')}.`,
    `- Visitor's main action: ${variant.primaryAction}.`,
    signature.length ? `- Signature experiences for this kind of site (build those the prompt asks for; the rest are options): ${signature.map(describe).join(' | ')}` : '',
    others.length ? `- Other experiences in this trade (only when they serve the prompt): ${others.map((interaction) => interaction.label).join(', ')}.` : '',
    `- Imagery: ${pack.imagery.join('; ')}. Motion: ${pack.motion.join('; ')}.`,
    `- Honesty: ${pack.honesty.join(' ')}`,
    blend ? `- Blended trade: also draw on ${blend.label} vocabulary (${blend.vocabulary.slice(0, 6).join(', ')}) and its experiences (${blend.interactions.map((interaction) => interaction.label).join(', ')}) where the prompt combines them.` : '',
    '- Layout freedom: these are starting points. Compose certified designs in new arrangements, adapt them, or author original site-local components when the experience needs it; original components that would serve other sites are library promotion candidates.',
  ].filter(Boolean).join('\n');
}
