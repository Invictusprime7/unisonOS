/**
 * Page archetype contract — the canonical, page-specific half of the design
 * vocabulary.
 *
 * The art direction pack owns the SITE's visual language (colour, type, motion,
 * base rhythm and density). It says nothing about how a pricing page differs
 * from a gallery. This module owns exactly that difference, and nothing else:
 *
 *   - rhythmShift / densityShift — whole-step modulation of the pack's spacing
 *     scale for this page role. Never a new palette, type scale or motion
 *     profile, so the homepage-established language always survives.
 *   - requiredFamilies — the section families a page of this role must carry
 *     for the page to do its job at all ("required roles").
 *   - forbiddenFamilies / forbiddenTags — the negative vocabulary: designs that
 *     are certified and site-legal but wrong for this page (a marquee on
 *     checkout, a pricing table on a thank-you page).
 *   - maxBodySections — an upper bound on body families so a page role cannot
 *     be padded into an undifferentiated long scroll.
 *
 * Every consumer (composition prompt, composition validator, its edge mirror
 * and the Stage 4b CSS emission) reads this one table. The edge mirror lives at
 * supabase/functions/_shared/pageArchetypeContract.ts and is drift-tested.
 */

import type { SectionType } from '@/sections/types';
import {
  buildPageScaleTokens,
  shiftDensity,
  shiftRhythm,
  type ArtDirectionPack,
  type DensityId,
  type RhythmId,
} from '@/sections/variants/artDirectionPacks';
import { describeIndustryDialect, industryCreativeProfile } from '@/sections/templates/industryCreativeVocabulary';


export const COMPILER_OWNED_FAMILIES: readonly SectionType[] = ['navbar', 'footer'];

export interface PageArchetype {
  /** One-line page purpose, stated to the model verbatim. */
  purpose: string;
  /** Whole-step modulation of the pack's rhythm (-1 tighter, +1 airier). */
  rhythmShift: -1 | 0 | 1;
  /** Whole-step modulation of the pack's spacing density. */
  densityShift: -1 | 0 | 1;
  /** Families this page role must carry (chrome excluded). */
  requiredFamilies: readonly SectionType[];
  /** Families that fit this page role well. */
  recommendedFamilies: readonly SectionType[];
  /** Negative vocabulary — families that must never appear on this role. */
  forbiddenFamilies: readonly SectionType[];
  /** Negative vocabulary — variant tags disqualified on this role. */
  forbiddenTags: readonly string[];
  /** Upper bound on body families (chrome excluded). */
  maxBodySections: number;
}

const ARCHETYPES = {
  auth: {
    purpose: 'Let a returning user sign in with as little friction as possible.',
    rhythmShift: -1, densityShift: -1,
    requiredFamilies: ['auth-form'],
    recommendedFamilies: [],
    forbiddenFamilies: ['hero', 'services', 'features', 'pricing', 'gallery', 'testimonials', 'stats', 'team', 'blog-preview', 'before-after', 'logo-cloud', 'cta', 'contact', 'faq', 'about', 'data-table'],
    forbiddenTags: ['marquee', 'immersive'],
    maxBodySections: 1,
  },
  dashboard: {
    purpose: 'Present the user’s data and primary work at a glance.',
    rhythmShift: -1, densityShift: -1,
    requiredFamilies: ['data-table'],
    recommendedFamilies: ['stats'],
    forbiddenFamilies: ['hero', 'services', 'pricing', 'gallery', 'testimonials', 'team', 'blog-preview', 'before-after', 'logo-cloud', 'cta', 'contact', 'about', 'auth-form'],
    forbiddenTags: ['marquee', 'immersive'],
    maxBodySections: 4,
  },
  home: {
    purpose: 'Establish the brand, the primary offer and one clear primary action.',
    rhythmShift: 0, densityShift: 0,
    requiredFamilies: ['hero', 'cta'],
    recommendedFamilies: ['services', 'features', 'gallery', 'testimonials', 'stats', 'logo-cloud', 'about'],
    forbiddenFamilies: ['blog-preview'],
    forbiddenTags: [],
    maxBodySections: 8,
  },
  services: {
    purpose: 'Explain what is offered, for whom, and how to start.',
    rhythmShift: 0, densityShift: -1,
    requiredFamilies: ['services', 'cta'],
    recommendedFamilies: ['hero', 'features', 'pricing', 'faq', 'before-after', 'testimonials'],
    forbiddenFamilies: ['blog-preview', 'logo-cloud'],
    forbiddenTags: ['marquee'],
    maxBodySections: 7,
  },
  pricing: {
    purpose: 'Present plans or rates side by side and remove purchase doubt.',
    rhythmShift: -1, densityShift: -1,
    requiredFamilies: ['pricing', 'faq'],
    recommendedFamilies: ['hero', 'features', 'testimonials', 'cta', 'stats'],
    forbiddenFamilies: ['gallery', 'blog-preview', 'before-after', 'team'],
    forbiddenTags: ['marquee', 'immersive'],
    maxBodySections: 6,
  },
  about: {
    purpose: 'Tell the business story and show the people behind it.',
    rhythmShift: 1, densityShift: 0,
    requiredFamilies: ['about'],
    recommendedFamilies: ['hero', 'team', 'stats', 'gallery', 'testimonials', 'cta'],
    forbiddenFamilies: ['pricing', 'blog-preview'],
    forbiddenTags: [],
    maxBodySections: 6,
  },
  contact: {
    purpose: 'Make one contact action obvious and answer the questions that block it.',
    rhythmShift: -1, densityShift: -1,
    requiredFamilies: ['contact'],
    recommendedFamilies: ['hero', 'faq', 'stats'],
    forbiddenFamilies: ['pricing', 'gallery', 'blog-preview', 'before-after', 'logo-cloud', 'testimonials'],
    forbiddenTags: ['marquee', 'immersive'],
    maxBodySections: 4,
  },
  gallery: {
    purpose: 'Let the work speak — media first, copy second.',
    rhythmShift: 1, densityShift: 1,
    requiredFamilies: ['gallery'],
    recommendedFamilies: ['hero', 'before-after', 'testimonials', 'cta'],
    forbiddenFamilies: ['pricing', 'faq', 'blog-preview'],
    forbiddenTags: [],
    maxBodySections: 5,
  },
  faq: {
    purpose: 'Answer real objections in scannable order.',
    rhythmShift: -1, densityShift: -1,
    requiredFamilies: ['faq'],
    recommendedFamilies: ['hero', 'contact', 'cta'],
    forbiddenFamilies: ['gallery', 'pricing', 'blog-preview', 'before-after', 'team', 'logo-cloud'],
    forbiddenTags: ['marquee', 'immersive'],
    maxBodySections: 4,
  },
  booking: {
    purpose: 'Get one booking completed with nothing competing for attention.',
    rhythmShift: -1, densityShift: -1,
    requiredFamilies: ['services', 'contact'],
    recommendedFamilies: ['hero', 'faq', 'testimonials'],
    forbiddenFamilies: ['blog-preview', 'gallery', 'logo-cloud', 'before-after'],
    forbiddenTags: ['marquee', 'immersive'],
    maxBodySections: 5,
  },
  shop: {
    purpose: 'Browse and choose products with clear pricing and proof.',
    rhythmShift: 0, densityShift: -1,
    requiredFamilies: ['services'],
    recommendedFamilies: ['hero', 'gallery', 'features', 'testimonials', 'cta', 'faq'],
    forbiddenFamilies: ['blog-preview', 'team'],
    forbiddenTags: [],
    maxBodySections: 7,
  },
  checkout: {
    purpose: 'Complete the purchase. Nothing on this page may distract from it.',
    rhythmShift: -1, densityShift: -1,
    requiredFamilies: ['contact'],
    recommendedFamilies: ['faq'],
    forbiddenFamilies: ['hero', 'gallery', 'blog-preview', 'testimonials', 'logo-cloud', 'before-after', 'team', 'stats', 'cta', 'pricing', 'services', 'features', 'about'],
    forbiddenTags: ['marquee', 'immersive', 'parallax'],
    maxBodySections: 3,
  },
  thank_you: {
    purpose: 'Confirm what just happened and state the single next step.',
    rhythmShift: -1, densityShift: -1,
    requiredFamilies: ['cta'],
    recommendedFamilies: ['faq', 'contact'],
    forbiddenFamilies: ['pricing', 'gallery', 'blog-preview', 'before-after', 'logo-cloud', 'team', 'services', 'features', 'testimonials'],
    forbiddenTags: ['marquee', 'immersive', 'parallax'],
    maxBodySections: 3,
  },
  blog: {
    purpose: 'Show recent writing in reading order.',
    rhythmShift: 1, densityShift: 0,
    requiredFamilies: ['blog-preview'],
    recommendedFamilies: ['hero', 'cta', 'contact'],
    forbiddenFamilies: ['pricing', 'before-after', 'gallery', 'team', 'logo-cloud'],
    forbiddenTags: ['immersive'],
    maxBodySections: 4,
  },
  immersive: {
    purpose: 'A single spatial experience with minimal supporting copy.',
    rhythmShift: 1, densityShift: 1,
    requiredFamilies: ['hero'],
    recommendedFamilies: ['gallery', 'cta', 'about'],
    forbiddenFamilies: ['pricing', 'faq', 'blog-preview', 'logo-cloud', 'team', 'contact'],
    forbiddenTags: [],
    maxBodySections: 4,
  },
  custom: {
    purpose: 'Serve the registered route purpose without borrowing another role.',
    rhythmShift: 0, densityShift: 0,
    requiredFamilies: [],
    recommendedFamilies: ['hero', 'about', 'features', 'cta'],
    forbiddenFamilies: [],
    forbiddenTags: [],
    maxBodySections: 6,
  },
} satisfies Record<string, PageArchetype>;

export type PageArchetypeRole = keyof typeof ARCHETYPES;
export const PAGE_ARCHETYPES: Readonly<Record<string, PageArchetype>> = ARCHETYPES;

export const pageArchetypeFor = (role: string): PageArchetype =>
  PAGE_ARCHETYPES[role] ?? PAGE_ARCHETYPES.custom;

const union = <T,>(...groups: ReadonlyArray<readonly T[] | undefined>): T[] =>
  Array.from(new Set(groups.flatMap(group => group ?? [])));

/**
 * The page archetype modulated by the industry dialect (governing plan,
 * Phase 7 / Invariant K). The dialect may add required and recommended
 * families and widen the negative vocabulary; it can never strip a family the
 * page role requires, and it never touches rhythm, density or the ceiling —
 * those stay page-owned so the homepage's language survives.
 */
export function resolvePageArchetype(role: string, industry?: string | null): PageArchetype {
  const base = pageArchetypeFor(role);
  const profile = industryCreativeProfile(industry);
  if (!profile) return base;
  const page = profile.pageProfiles[role];

  const requiredFamilies = union(base.requiredFamilies, page?.requiredFamilies);
  const preferred = union(page?.preferredFamilies, profile.preferredFamilies);
  const forbiddenFamilies = union(base.forbiddenFamilies, profile.discouragedFamilies, page?.discouragedFamilies)
    .filter(family => !requiredFamilies.includes(family) && !(page?.preferredFamilies ?? []).includes(family));
  const recommendedFamilies = union(base.recommendedFamilies, preferred)
    .filter(family => !forbiddenFamilies.includes(family) && !requiredFamilies.includes(family));

  return {
    ...base,
    requiredFamilies,
    recommendedFamilies,
    forbiddenFamilies,
    forbiddenTags: union(base.forbiddenTags, profile.discouragedTags),
    maxBodySections: Math.max(base.maxBodySections, requiredFamilies.length),
  };
}

const isChrome = (family: string) => COMPILER_OWNED_FAMILIES.includes(family as SectionType);


/** Resolved spacing scale for one page role against the sealed pack. */
export function resolvePageScale(role: string, pack: ArtDirectionPack): { rhythm: RhythmId; density: DensityId } {
  const archetype = pageArchetypeFor(role);
  return {
    rhythm: shiftRhythm(pack.design.rhythm, archetype.rhythmShift),
    density: shiftDensity(pack.signature.density, archetype.densityShift),
  };
}

/**
 * Page-scoped CSS for every role, emitted by Stage 4b into index.css. Only the
 * spacing subset is scoped; everything else stays site-owned at :root.
 */
export function buildPageArchetypeCss(pack: ArtDirectionPack): string {
  return Object.keys(PAGE_ARCHETYPES).map(role => {
    const { rhythm, density } = resolvePageScale(role, pack);
    const declarations = Object.entries(buildPageScaleTokens(rhythm, density))
      .map(([name, value]) => `${name}: ${value};`)
      .join(' ');
    return `  [data-ut-page-role="${role}"] { ${declarations} }`;
  }).join('\n');
}

/**
 * Deterministic repair of a page's section order against its archetype:
 * forbidden families are dropped, missing required families are appended before
 * the CTA tail, and the body is clamped to the archetype's maximum. Chrome
 * placement stays compiler-owned and untouched.
 */
export function normalizePageSectionOrder(role: string, sectionOrder: readonly string[], industry?: string | null): string[] {
  const archetype = resolvePageArchetype(role, industry);

  const forbidden = new Set<string>(archetype.forbiddenFamilies);
  const kept = sectionOrder.filter((family, index) =>
    sectionOrder.indexOf(family) === index && (isChrome(family) || !forbidden.has(family)));

  // Missing required families are NOT synthesised here: adding a family the
  // model never planned would emit an empty section. They surface as archetype
  // issues so the composition lane asks the model to repair its own plan.

  const body = kept.filter(family => !isChrome(family));
  if (body.length <= archetype.maxBodySections) return kept;
  const required = new Set<string>(archetype.requiredFamilies);
  const dropped = new Set<string>();
  let over = body.length - archetype.maxBodySections;
  for (let index = body.length - 1; index >= 0 && over > 0; index -= 1) {
    if (required.has(body[index])) continue;
    dropped.add(body[index]);
    over -= 1;
  }
  return kept.filter(family => !dropped.has(family));
}

/** Machine-checked archetype violations for one page. */
export function pageArchetypeIssues(
  role: string,
  sectionOrder: readonly string[],
  variantTags: Readonly<Record<string, readonly string[]>> = {},
  options: { requireFamilies?: boolean; industry?: string | null } = {},
): string[] {
  const archetype = resolvePageArchetype(role, options.industry);

  const issues: string[] = [];
  const body = sectionOrder.filter(family => !isChrome(family));
  for (const family of sectionOrder) {
    if (archetype.forbiddenFamilies.includes(family as SectionType)) {
      issues.push(`pages.${role}.sectionOrder: ${family} is forbidden on a ${role} page`);
    }
  }
  for (const required of options.requireFamilies === false ? [] : archetype.requiredFamilies) {
    if (!sectionOrder.includes(required)) {
      issues.push(`pages.${role}.sectionOrder: a ${role} page must include ${required}`);
    }
  }
  if (body.length > archetype.maxBodySections) {
    issues.push(`pages.${role}.sectionOrder: at most ${archetype.maxBodySections} body sections`);
  }
  for (const [family, tags] of Object.entries(variantTags)) {
    const blocked = tags.filter(tag => archetype.forbiddenTags.includes(tag));
    if (blocked.length) {
      issues.push(`pages.${role}.variants.${family}: ${blocked.join(', ')} is forbidden on a ${role} page`);
    }
  }
  return issues;
}

/** The archetype rule block handed verbatim to the composition model. */
export function describePageArchetypes(roles: readonly string[], industry?: string | null): string {
  const dialect = describeIndustryDialect(industry);
  const body = roles.map(role => {
    const archetype = resolvePageArchetype(role, industry);

    const value = (values: readonly string[]) => (values.length ? values.join(', ') : 'none');
    return [
      `  role "${role}" — ${archetype.purpose}`,
      `    must include: ${value(archetype.requiredFamilies)}`,
      `    fits well: ${value(archetype.recommendedFamilies)}`,
      `    never include (families): ${value(archetype.forbiddenFamilies)}`,
      `    never include (design traits): ${value(archetype.forbiddenTags)}`,
      `    at most ${archetype.maxBodySections} body sections; page spacing is ${archetype.rhythmShift === 0 ? 'the site rhythm' : archetype.rhythmShift < 0 ? 'one step tighter than the site rhythm' : 'one step airier than the site rhythm'}.`,
    ].join('\n');
  }).join('\n');
  return dialect ? `${dialect}\n${body}` : body;
}

