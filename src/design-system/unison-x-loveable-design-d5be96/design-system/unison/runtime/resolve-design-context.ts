import { ART_DIRECTION_PACKS, ART_DIRECTION_PACK_IDS, DEFAULT_ART_DIRECTION_PACK_ID } from '../contracts/art-direction';
import type { CreativeResolutionMode } from '../contracts/creative-intent';
import { pageArchetypeFor } from '../contracts/page-archetypes';
import { projectArtifactIssues, type ProjectArtifact } from '../contracts/project-artifact';
import { buildProjectOverlay, type ProjectArtDirectionOverlay } from '../contracts/project-overlay';
import { industryPackCapability } from '../contracts/theme-family';
import { getVariantById } from '../components/registry';
import { isCanonicalImplementation } from './resolve-legal-implementations';
import { interpretCreativeIntent, type CreativeInterpretation } from './interpret-creative-intent';
import { applyBrandTokens, type BrandedTokenSet, type UnisonBrandOverrides } from '../contracts/brand';
import { industryCreativeProfile } from '../contracts/industry-vocabulary';
import type { UnisonProjectBrief } from '../contracts/project-brief';
import { compileSiteDesignContract, projectSiteDesignContract } from '../contracts/site-design-contract';
import { THEME_FAMILIES } from '../contracts/theme-family';
import type { SectionType } from '../types';
import type { VariantId } from '../components/types';
import { childSeed, deriveDesignSeed, seededPick } from '@/platform/core/generationSeed';
import { resolveUnisonArtDirection, type SealedArtDirection } from './resolve-art-direction';

export const UNISON_DESIGN_SYSTEM_VERSION = '1.1.0';

export interface ResolvedUnisonDesignContext {
  version: typeof UNISON_DESIGN_SYSTEM_VERSION;
  brief: UnisonProjectBrief;
  designSeed: string;
  themeFamily: (typeof THEME_FAMILIES)[keyof typeof THEME_FAMILIES];
  resolution: SealedArtDirection;
  contract: ReturnType<typeof compileSiteDesignContract>;
  projection: ReturnType<typeof projectSiteDesignContract>;
  artDirection: (typeof ART_DIRECTION_PACKS)[keyof typeof ART_DIRECTION_PACKS];
  industryDialect: ReturnType<typeof industryCreativeProfile>;
  seededChoices: Record<string, string>;
  negativeVocabulary: readonly string[];
}

/** PRE-COMPOSITION: family → sealed pack → legal vocabulary → contract. Brand is ignored here. */
export function compileUnisonDesignContext(brief: UnisonProjectBrief): ResolvedUnisonDesignContext {
  const roles = brief.pageRoles.length ? brief.pageRoles : ['home'];
  const designSeed = brief.designSeed?.trim() || deriveDesignSeed({
    businessName: brief.projectName,
    industry: brief.industry,
    primaryGoal: brief.goals[0],
    secondaryGoals: [...brief.goals.slice(1), ...(brief.contentPriorities ?? [])],
    requestedPages: roles,
    templateId: UNISON_DESIGN_SYSTEM_VERSION,
    themePresetId: brief.artDirectionPackId ?? brief.themeFamilyId ?? null,
  });
  const resolution = resolveUnisonArtDirection({
    sealedPackId: brief.sealedArtDirectionPackId,
    artDirectionPackId: brief.artDirectionPackId,
    themeFamilyId: brief.themeFamilyId,
    industry: brief.industry,
    pageRoles: roles,
    experience: brief.experience,
    designSeed,
  });
  const contract = compileSiteDesignContract({
    industry: brief.industry,
    roles,
    artDirectionPackId: resolution.packId,
    experience: brief.experience ?? 'standard',
    mode: 'auto',
  });
  const seededChoices: Record<string, string> = {};
  for (const [role, page] of Object.entries(contract.pages)) {
    for (const family of [...page.requiredFamilies, ...page.recommendedFamilies]) {
      const legal = contract.allowedImplementations[family] ?? [];
      if (legal.length) seededChoices[`${role}:${family}`] = seededPick(childSeed(designSeed, role, family), legal);
    }
  }
  return {
    version: UNISON_DESIGN_SYSTEM_VERSION,
    brief,
    designSeed,
    themeFamily: THEME_FAMILIES[resolution.themeFamilyId],
    resolution,
    contract,
    projection: projectSiteDesignContract(contract),
    artDirection: ART_DIRECTION_PACKS[resolution.packId],
    industryDialect: industryCreativeProfile(contract.industry),
    seededChoices,
    negativeVocabulary: [...new Set([...(brief.negativeVocabulary ?? []), ...Object.values(contract.pages).flatMap((page) => page.discouragedTags)])],
  };
}

/** A section is either a Unison variant or a project-written artifact with a recorded description. */
export type UnisonComposedSection =
  | { family: SectionType; variantId: VariantId; artifact?: undefined }
  | { family: SectionType; artifact: ProjectArtifact; variantId?: undefined };

export interface UnisonPageComposition {
  pages: Record<string, ReadonlyArray<UnisonComposedSection>>;
}

export interface CompositionReport {
  /** Must be fixed: forbidden page family/tag, non-canonical Unison design, unknown variant, broken hard limits. */
  blocking: string[];
  /** Guidance only: a recommended Unison design exists or a canonical design sits outside the pack's recommended set. */
  advisory: string[];
}

/** Open composition check. The registry is a quality floor, not a whitelist. */
export function validateOpenComposition(context: ResolvedUnisonDesignContext, composition: UnisonPageComposition): CompositionReport {
  const blocking: string[] = [];
  const advisory: string[] = [];
  for (const [role, sections] of Object.entries(composition.pages)) {
    const archetype = pageArchetypeFor(role);
    for (const section of sections) {
      const { family } = section;
      if (archetype.forbiddenFamilies.includes(family)) blocking.push(`pages.${role}: ${family} must never appear on a ${role} page`);
      const recommended = context.contract.allowedImplementations[family] ?? [];
      if (section.artifact) {
        blocking.push(...projectArtifactIssues(section.artifact).map((i) => `pages.${role}: ${i}`));
        if (recommended.length) advisory.push(`pages.${role}: ${section.artifact.id} is project-written; recommended ${family} designs exist (${recommended.slice(0, 3).join(', ')})`);
        continue;
      }
      const variant = getVariantById(section.variantId);
      if (!variant) { blocking.push(`pages.${role}: ${section.variantId} is not a Unison design`); continue; }
      if (!isCanonicalImplementation(section.variantId)) { blocking.push(`pages.${role}: ${section.variantId} is not canonical (experimental/quarantined designs never reach client composition)`); continue; }
      const badTag = (variant.tags ?? []).find((t) => archetype.forbiddenTags.includes(t));
      if (badTag) blocking.push(`pages.${role}: ${section.variantId} carries "${badTag}", forbidden on ${role} pages`);
      if (!recommended.includes(section.variantId)) advisory.push(`pages.${role}: ${section.variantId} is outside the recommended ${family} vocabulary for ${context.resolution.packId}`);
    }
  }
  return { blocking, advisory };
}

/** Back-compatible flat list: blocking issues first, then advisory notes. */
export function validateComposition(context: ResolvedUnisonDesignContext, composition: UnisonPageComposition): string[] {
  const { blocking, advisory } = validateOpenComposition(context, composition);
  return [...blocking, ...advisory.map((a) => `advisory: ${a}`)];
}

export interface CreativeDesignContext extends ResolvedUnisonDesignContext {
  intent: CreativeInterpretation['intent'];
  affinity: CreativeInterpretation['affinity'];
  mode: CreativeResolutionMode;
  overlay?: ProjectArtDirectionOverlay;
  vocabulary: { recommended: Partial<Record<SectionType, VariantId[]>> };
  constraints: { hard: string[]; forbiddenByRole: Record<string, readonly SectionType[]> };
  extensionAuthority: {
    mayWriteProjectComponents: true;
    order: readonly ['reuse', 'compose', 'invent'];
    requires: string[];
    /** Explicit creative freedom — consumers never have to guess whether invention is permitted. */
    creativeFreedom: {
      customComponentsAllowed: true;
      customLayoutsAllowed: true;
      customInteractionsAllowed: true;
      customMotionAllowed: true;
      backendExtensionsAllowed: true;
      projectArtDirectionOverlayAllowed: true;
    };
  };
}

/** Raw customer brief → interpreted intent → sealed pack → contract + open-composition authority. */
export function resolveCreativeDesignContext(brief: UnisonProjectBrief, sourcePrompt: string): CreativeDesignContext {
  const interpretation = interpretCreativeIntent(sourcePrompt);
  const excluded = new Set(interpretation.affinity.excludedPacks.map((p) => p.id));
  const explicit = brief.sealedArtDirectionPackId ?? brief.artDirectionPackId;
  const fallback = (industryPackCapability(brief.industry) ?? [...ART_DIRECTION_PACK_IDS]).find((id) => !excluded.has(id)) ?? DEFAULT_ART_DIRECTION_PACK_ID;
  const basePackId = explicit ?? interpretation.primaryPackId ?? fallback;
  const experience = brief.experience ?? (interpretation.intent.motion.intensity === 'high' ? 'motion-rich' : undefined);
  const context = compileUnisonDesignContext({
    ...brief,
    artDirectionPackId: brief.themeFamilyId && !explicit ? undefined : basePackId,
    experience,
    negativeVocabulary: [...(brief.negativeVocabulary ?? []), ...interpretation.intent.negativeVocabulary],
  });
  const mode = interpretation.mode;
  const overlay = mode === 'exact' ? undefined : buildProjectOverlay(interpretation.intent, mode, context.resolution.packId, interpretation.blendPackId);
  const forbiddenByRole = Object.fromEntries(Object.keys(context.contract.pages).map((r) => [r, pageArchetypeFor(r).forbiddenFamilies]));
  return {
    ...context,
    intent: interpretation.intent,
    affinity: interpretation.affinity,
    mode,
    overlay,
    vocabulary: { recommended: context.contract.allowedImplementations as Partial<Record<SectionType, VariantId[]>> },
    constraints: {
      hard: ['semantic HTML', 'keyboard operation', 'visible focus', 'reduced-motion fallback', 'WCAG AA contrast', 'app screens never on marketing pages and vice versa', 'no experimental or quarantined Unison designs'],
      forbiddenByRole,
    },
    extensionAuthority: {
      mayWriteProjectComponents: true,
      order: ['reuse', 'compose', 'invent'] as const,
      requires: ['ProjectArtifact description', 'hard-limit compliance', 'semantic tokens, not raw colours'],
      creativeFreedom: {
        customComponentsAllowed: true,
        customLayoutsAllowed: true,
        customInteractionsAllowed: true,
        customMotionAllowed: true,
        backendExtensionsAllowed: true,
        projectArtDirectionOverlayAllowed: true,
      },
    },
  };
}

export interface ThemedComposition extends BrandedTokenSet {
  composition: UnisonPageComposition;
}

/** POST-COMPOSITION: sealed pack + brand → tokens. Topology and variants pass through untouched. */
export function applyPostCompositionTheme(context: ResolvedUnisonDesignContext, composition: UnisonPageComposition, brand: UnisonBrandOverrides | undefined = context.brief.brand): ThemedComposition {
  return { ...applyBrandTokens(context.resolution.packId, brand), composition };
}
