/**
 * "Unison x Loveable Design" as an optional design reference.
 *
 * Reads the attached design library's own knowledge — art direction packs,
 * theme families, page jobs, industry dialects and its prompt interpreter — and
 * states it as plain guidance Affinity may follow while writing original code.
 * The library's components stay optional; this source never requires them.
 */
import {
  ART_DIRECTION_PACKS,
  buildArtDirectionTokens,
  getArtDirectionPack,
  type ArtDirectionPack,
} from '@/design-system/unison-x-loveable-design-d5be96/design-system/unison/contracts/art-direction';
import { ART_DIRECTION_FAMILY_REGISTRY, THEME_FAMILIES } from '@/design-system/unison-x-loveable-design-d5be96/design-system/unison/contracts/theme-family';
import { resolvePageArchetype } from '@/design-system/unison-x-loveable-design-d5be96/design-system/unison/contracts/page-archetypes';
import { industryCreativeProfile } from '@/design-system/unison-x-loveable-design-d5be96/design-system/unison/contracts/industry-vocabulary';
import { interpretCreativeIntent } from '@/design-system/unison-x-loveable-design-d5be96/design-system/unison/runtime/interpret-creative-intent';
import type { DesignExperience, DesignReferenceBlock, DesignReferenceContext, DesignReferencePage, DesignReferenceSource } from './registry';

export const UNISON_LOVEABLE_REFERENCE_ID = 'unison-x-loveable';
/** Library slug and version recorded in lovable.toml. */
export const UNISON_LOVEABLE_LIBRARY = { slug: 'unison-x-loveable-design-d5be96', version: '1.0.0' } as const;

const ORIGIN_LABEL: Record<string, string> = {
  explicit: 'the owner asked for it',
  confirmed: 'the owner confirmed it',
  refinement: 'the owner asked for it in a refinement',
  inferred: 'provisional; inferred from the conversation, so change it if the prompt points elsewhere',
};

const HERO_LAYOUT: Record<string, string> = {
  'full-bleed': 'full-bleed media with copy anchored low',
  split: 'two equal columns, copy beside media',
  centered: 'centered copy stack',
  asymmetric: 'asymmetric 7/5 split, copy on the wide side',
  'stacked-editorial': 'stacked editorial headline above media',
  poster: 'poster-scale type that fills the first screen',
};

const SURFACE: Record<string, string> = {
  flat: 'flat, no card fills or shadows; separate content with space and rules',
  bordered: 'card fill with a hairline border, no shadow',
  elevated: 'card fill with a soft shadow that deepens on hover',
  glass: 'translucent cards with a faint primary-tinted ring',
  offset: 'solid cards with a hard offset shadow in the foreground colour',
};

const MEDIA: Record<string, string> = {
  'full-bleed': 'edge-to-edge, square corners, 16/9',
  framed: 'framed with the base radius, 4/3',
  duotone: 'desaturated, higher contrast, 3/2',
  masked: 'strongly rounded masks, square crops',
  'soft-mask': 'very soft rounded masks, 5/4',
};

const EXPERIENCE: Record<DesignExperience, string> = {
  standard: 'Standard: calm, quick reveals only where they help orientation; no scroll-jacking.',
  'motion-rich': 'Motion-rich: staggered section reveals, hover feedback on every interactive card, one signature motion moment on Home.',
  immersive: 'Immersive: scroll-linked depth, layered media and one cinematic opening; keep every page usable with motion off.',
};

const QUALITY_FLOOR = [
  'Avoid the generic pattern of a centered hero followed by three equal cards; give each page a strong hierarchy and compositional contrast.',
  'Do not repeat equal-width card grids, excessive rounded containers, excessive pills, gratuitous gradients or glass, or purposeless animation.',
  'Make each page do a different job; reuse the shared chrome and visual language, never the Home composition.',
  'Compose mobile on purpose (re-ordered hierarchy, comfortable touch targets), not by merely stacking desktop columns.',
  'Keep semantic HTML, keyboard access, visible focus, AA contrast and prefers-reduced-motion fallbacks.',
  'Show industry-relevant proof the owner actually supplied; never invent reviews, prices, numbers or availability.',
];

/** Page title/route → the library's page role. Unknown pages keep their own job (`custom`). */
export function pageRoleFor(page: DesignReferencePage): string {
  const words = `${page.title} ${page.route}`.toLowerCase();
  if (page.route === '/' || /\bhome\b/.test(words)) return 'home';
  const table: Array<[RegExp, string]> = [
    [/\b(check ?out|cart|bag)\b/, 'checkout'],
    [/\b(book|booking|appointment|reserv|schedule a)\w*/, 'booking'],
    [/\b(pricing|plans?|rates|packages)\b/, 'pricing'],
    [/\b(shop|store|products?|collections?|catalog)\b/, 'shop'],
    [/\b(gallery|portfolio|work|projects|lookbook)\b/, 'gallery'],
    [/\b(services?|treatments|what we do|offerings)\b/, 'services'],
    [/\b(about|story|team|people|our)\b/, 'about'],
    [/\b(contact|visit|find us|location|enquir)\w*/, 'contact'],
    [/\b(faq|questions|help)\b/, 'faq'],
    [/\b(blog|journal|news|articles|stories|press)\b/, 'blog'],
    [/\b(sign ?in|log ?in|account)\b/, 'auth'],
  ];
  return table.find(([pattern]) => pattern.test(words))?.[1] ?? 'custom';
}

interface ResolvedDirection {
  pack: ArtDirectionPack;
  reason: string;
  alternatives: ArtDirectionPack[];
  avoid: string[];
}

function resolveDirection(context: DesignReferenceContext): ResolvedDirection {
  const reading = interpretCreativeIntent(context.prompt);
  const avoid = [...new Set(reading.affinity.excludedPacks.flatMap((pack) => pack.evidence.map((e) => e.replace(/^avoid "|"$/g, ''))))];
  const chosen = getArtDirectionPack(context.artDirectionPackId);
  if (chosen) {
    return { pack: chosen, reason: ORIGIN_LABEL[context.artDirectionOrigin ?? ''] ?? 'chosen in the creative brief', alternatives: [], avoid };
  }
  const ranked = reading.affinity.packs.map((entry) => ART_DIRECTION_PACKS[entry.id]).filter(Boolean);
  const pack = ranked[0] ?? ART_DIRECTION_PACKS['soft-editorial'];
  const evidence = reading.affinity.packs[0]?.evidence.slice(0, 4).join(', ');
  return {
    pack,
    reason: evidence ? `provisional; read from the owner's words (${evidence})` : 'provisional; the prompt carried no clear visual signal, so treat this as a neutral starting point',
    alternatives: ranked.slice(1, 3),
    avoid,
  };
}

function directionLines(direction: ResolvedDirection, compact: boolean): string[] {
  const { pack } = direction;
  const family = THEME_FAMILIES[ART_DIRECTION_FAMILY_REGISTRY[pack.id].primaryFamily];
  const sig = pack.signature;
  const d = pack.design;
  const lines = [
    `Art direction: ${pack.name} — ${pack.description} Theme family: ${family.name} (${family.description}). Why: ${direction.reason}.`,
    `- Type: display ${sig.typography.displayStack} at weight ${sig.typography.displayWeight}, leading ${sig.typography.displayLineHeight}, tracking ${d.headingTracking}${d.headingTransform === 'uppercase' ? ', uppercase' : ''}; body ${sig.typography.bodyStack} at weight ${sig.typography.bodyWeight}; heading scale ratio ${d.typeScaleRatio}; body measure ${d.measure}; eyebrows ${sig.typography.eyebrowTransform === 'uppercase' ? 'uppercase' : 'sentence case'} with ${sig.typography.eyebrowTracking} tracking. Pair with a web font of the same character if you like.`,
    `- Space: ${d.rhythm} section rhythm, ${sig.density} density.`,
    `- Hero: ${HERO_LAYOUT[sig.hero.layout] ?? sig.hero.layout}, ${sig.hero.align}-aligned, about ${sig.hero.minHeight} tall, media ${sig.hero.mediaRatio}.`,
    `- Surfaces: ${SURFACE[d.surface] ?? d.surface}; radius ${d.radius}; border weight ${d.borderWeight}. Labels/pills: ${sig.pill}.`,
    `- Colour treatment: ${sig.gradient === 'none' ? 'no gradients' : `${sig.gradient} gradient language, used sparingly`}; accent ${d.accentPolicy}. Media: ${MEDIA[d.mediaTreatment] ?? d.mediaTreatment}.`,
    `- Motion: ${sig.entrance} entrances, ${d.motionDuration} with ${d.motionEase}, travel ${d.motionDistance}.`,
  ];
  if (direction.avoid.length) lines.push(`- The owner asked to avoid: ${direction.avoid.join(', ')}. Drop any part of this direction that conflicts.`);
  if (!compact) {
    lines.push(`- Example palette (HSL triplets; the owner's brand colours always win): background ${family.fallbackPalette.background}, foreground ${family.fallbackPalette.foreground}, primary ${family.fallbackPalette.primary}, accent ${family.fallbackPalette.accent}.`);
    if (direction.alternatives.length) lines.push(`- Also plausible: ${direction.alternatives.map((alt) => `${alt.name} (${alt.description})`).join('; ')}.`);
  }
  return lines;
}

function tokenBlock(pack: ArtDirectionPack): string {
  const tokens = buildArtDirectionTokens(pack);
  const body = Object.entries(tokens)
    .filter(([name]) => !/^--ut-(art-direction|gradient-profile|density|hero-layout|pill-style|entrance)$/.test(name))
    .map(([name, value]) => `  ${name}: ${value};`)
    .join('\n');
  return `Starter design tokens for this direction (optional; copy into :root in /src/index.css and adjust freely; they read your own --background/--foreground/--primary/--secondary/--card/--border/--muted HSL triplets):\n:root {\n${body}\n}`;
}

function pageLines(pages: readonly DesignReferencePage[], industry?: string | null): string[] {
  if (!pages.length) return [];
  const list = (values: readonly string[]) => values.join(', ') || 'anything that serves the job';
  return [
    'Page jobs (section names are suggestions; write each section in whatever form fits):',
    ...pages.slice(0, 12).map((page) => {
      const role = pageRoleFor(page);
      const archetype = resolvePageArchetype(role, industry);
      const parts = [`- ${page.title} (${page.route}): ${role === 'custom' ? 'serve this page\'s own purpose without borrowing another page\'s job' : archetype.purpose}`];
      if (archetype.requiredFamilies.length) parts.push(`usually carries ${list(archetype.requiredFamilies)}`);
      if (archetype.recommendedFamilies.length) parts.push(`fits well: ${list(archetype.recommendedFamilies.slice(0, 6))}`);
      if (archetype.forbiddenFamilies.length) parts.push(`usually wrong here: ${list(archetype.forbiddenFamilies)}`);
      parts.push(`keep it to about ${archetype.maxBodySections} sections`);
      return parts.join('; ') + '.';
    }),
  ];
}

function industryLine(industry?: string | null): string {
  const profile = industryCreativeProfile(industry);
  if (!profile) return '';
  return `Industry dialect (${profile.industry}): reach for ${profile.preferredFamilies.join(', ') || 'what the owner describes'}; usually avoid ${profile.discouragedFamilies.join(', ') || 'nothing in particular'}${profile.discouragedTags.length ? ` and ${profile.discouragedTags.join(', ')} styling` : ''}.`;
}

export function composeUnisonLoveableReference(context: DesignReferenceContext): DesignReferenceBlock {
  const compact = context.scope === 'edit';
  const direction = resolveDirection(context);
  const sections = [
    `UNISON X LOVEABLE DESIGN v${UNISON_LOVEABLE_LIBRARY.version}`,
    directionLines(direction, compact).join('\n'),
    context.experience ? `Experience: ${EXPERIENCE[context.experience]}` : '',
    compact ? '' : industryLine(context.industry),
    pageLines(context.pages ?? [], context.industry).join('\n'),
    `Quality floor:\n${QUALITY_FLOOR.map((line) => `- ${line}`).join('\n')}`,
    compact ? '' : tokenBlock(direction.pack),
  ];
  return {
    sourceId: UNISON_LOVEABLE_REFERENCE_ID,
    version: UNISON_LOVEABLE_LIBRARY.version,
    text: sections.filter(Boolean).join('\n\n'),
    resolved: {
      artDirection: direction.pack.id,
      ...(context.experience ? { experience: context.experience } : {}),
    },
  };
}

export const unisonLoveableReferenceSource: DesignReferenceSource = {
  id: UNISON_LOVEABLE_REFERENCE_ID,
  name: 'Unison x Loveable design',
  description: 'Art direction, page layouts and quality standards from the Unison design library, plus its ready-made sections.',
  version: UNISON_LOVEABLE_LIBRARY.version,
  enabledByDefault: true,
  compose: composeUnisonLoveableReference,
};
