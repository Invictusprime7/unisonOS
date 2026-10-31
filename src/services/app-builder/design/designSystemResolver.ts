/**
 * Narrows the sealed AppBuildContract into one bounded DesignSourceBundle.
 * It never re-selects from the global registry: every output id comes from the
 * contract's own sourceSelection / registryContext.
 */

import type { AppBuildContract } from '@/services/app-builder/appBuilderContracts';
import type { WizardRegistryImplementationSummary } from '@/services/launch/wizardRegistryAggregation';
import { normalizePageRole } from '@/services/composition/industryCompositionRegistry';
import {
  DESIGN_SOURCE_BUNDLE_VERSION,
  type DesignSourceBundle,
  type ResolvedDesignSource,
} from './DesignSourceBundle';

export const MAX_ELIGIBLE_PER_PAGE = 24;

export const GENERIC_IMPLEMENTATION_SUFFIX = ':generic';

export function isGenericImplementationId(id: string): boolean {
  return id.endsWith(GENERIC_IMPLEMENTATION_SUFFIX);
}

function toResolvedSource(impl: WizardRegistryImplementationSummary): ResolvedDesignSource {
  return {
    implementationId: impl.id,
    sectionType: impl.sectionType,
    name: impl.name,
    certification: impl.certification,
    pageRoles: impl.pageRoles,
    provenance: {
      origin: impl.source?.origin,
      sourceId: impl.source?.sourceId,
      derivation: impl.source?.derivation,
      adaptationVersion: impl.source?.adaptationVersion,
    },
    vocabularyRefs: impl.vocabularyRefs,
    componentStates: impl.componentStates,
    visualSignature: impl.visualSignature,
    artifactContract: impl.artifactContract,
    execution: {
      mode: 'portable-recipe',
      portableRecipeId: impl.id,
      runtimeDependencies: impl.runtimeDependencies ?? [],
    },
  };
}

/** Variants offered per planned family, so the AI can vary style instead of seeing one option. */
export const MAX_VARIANTS_PER_PAGE_FAMILY = 6;

function seededRank(seed: string, value: string): number {
  let hash = 2166136261;
  for (const char of `${seed}\u0000${value}`) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return hash >>> 0;
}

const DENSITY_FIT: Record<string, string> = { low: 'airy', medium: 'balanced', high: 'dense' };

/** Higher means the variant's authored visual signature realizes the page's composition target. */
function targetFit(impl: WizardRegistryImplementationSummary, target: { hero?: string; geometry?: string; density?: string } | undefined): number {
  const signature = impl.visualSignature;
  if (!target || !signature) return 0;
  let score = 0;
  if (target.geometry && signature.geometry === target.geometry) score += 2;
  if (target.density && signature.density === DENSITY_FIT[target.density]) score += 1;
  if (impl.sectionType === 'hero' && target.hero) {
    const mediaLed = /immersive|media|cinematic|full-bleed|gallery/.test(target.hero);
    if (mediaLed && signature.mediaDominance === 'high') score += 3;
    if (!mediaLed && signature.mediaDominance !== 'high') score += 1;
  }
  return score;
}

export function resolveDesignSourceBundle(contract: AppBuildContract): DesignSourceBundle {
  const { design } = contract;
  const registry = design.registryContext;
  const selected = new Set(design.sourceSelection.implementationIds);
  const forbidden = design.resolvedSiteDesignContext.hardLegality.forbiddenImplementations;
  const preferred = design.resolvedSiteDesignContext.creativeRecommendation.preferredImplementations;

  const pool = (registry.implementations ?? []).filter((impl) => {
    if (!selected.has(impl.id)) return false;
    return !(forbidden[impl.sectionType] ?? []).includes(impl.id);
  });

  const eligibleByPage: Record<string, string[]> = {};
  for (const page of contract.topology.sitePlan.pages) {
    const pinnedIds = new Set(registry.pinnedImplementationIdsByPage?.[page.id] ?? []);
    const pageRole = normalizePageRole(page.role);
    const target = design.compositionPlan?.pages.find((planned) => planned.pageId === page.id)?.target;
    // The sealed section order owns which families this page renders; those
    // families get the variety, never unrelated families that merely sort first.
    const pageFamilies = new Set<string>([...(target?.sectionOrder ?? []), 'navbar', 'footer']);
    const roleFit = pool.filter((impl) => pinnedIds.has(impl.id)
      || impl.pageRoles.length === 0 || impl.pageRoles.includes(pageRole));
    const richerTypes = new Set(roleFit.filter((impl) => !isGenericImplementationId(impl.id)).map((impl) => impl.sectionType));
    const seed = `${design.seed}:${page.id}`;
    const rank = (impl: WizardRegistryImplementationSummary) => [
      pinnedIds.has(impl.id) ? 0 : 1,
      (preferred[impl.sectionType] ?? []).includes(impl.id) ? 0 : 1,
      -targetFit(impl, target),
    ];
    const ranked = roleFit
      .filter((impl) => !(isGenericImplementationId(impl.id) && richerTypes.has(impl.sectionType)))
      .sort((a, b) => {
        const left = rank(a); const right = rank(b);
        for (let index = 0; index < left.length; index += 1) if (left[index] !== right[index]) return left[index] - right[index];
        // Seeded tie-break: equally legal variants rotate per site/page instead of alphabetical first-match.
        return seededRank(seed, a.id) - seededRank(seed, b.id) || a.id.localeCompare(b.id);
      });
    const byType = new Map<string, WizardRegistryImplementationSummary[]>();
    for (const impl of ranked) byType.set(impl.sectionType, [...(byType.get(impl.sectionType) ?? []), impl]);
    const bounded: WizardRegistryImplementationSummary[] = [];
    const boundedIds = new Set<string>();
    const take = (impl: WizardRegistryImplementationSummary) => {
      if (boundedIds.has(impl.id)) return;
      bounded.push(impl);
      boundedIds.add(impl.id);
    };
    for (const [family, group] of byType) {
      if (pageFamilies.has(family)) group.slice(0, MAX_VARIANTS_PER_PAGE_FAMILY).forEach(take);
    }
    // Remaining room offers one option per other family for owner-requested additions.
    for (let round = 0; bounded.length < MAX_ELIGIBLE_PER_PAGE; round += 1) {
      let added = false;
      for (const [family, group] of byType) {
        if (pageFamilies.has(family) || !group[round] || bounded.length >= MAX_ELIGIBLE_PER_PAGE) continue;
        take(group[round]);
        added = true;
      }
      if (!added || round > 0) break;
    }
    for (const implementation of ranked) if (pinnedIds.has(implementation.id)) take(implementation);
    eligibleByPage[page.id] = bounded.map((impl) => impl.id);
  }

  const used = new Set(Object.values(eligibleByPage).flat());
  const implementations = pool
    .filter((impl) => used.has(impl.id))
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(toResolvedSource);

  return {
    version: DESIGN_SOURCE_BUNDLE_VERSION,
    identity: {
      seed: design.seed,
      industry: registry.industry,
      templateId: registry.templateId,
      themePresetId: design.themePresetId,
      artDirectionPackId: registry.artDirectionPackId ?? design.resolvedSiteDesignContext.contract.artDirectionPackId,
      designRegistrySignature: registry.designRegistrySignature,
    },
    artDirection: {
      grammar: registry.artDirectionGrammar,
      motionProfile: registry.motionProfile,
      interactionProfile: registry.interactionProfile,
      selection: registry.designSelection,
    },
    primitives: {
      families: registry.primitiveFamilies ?? [],
      legalImports: [design.uiFoundation.importRoot],
      experienceCapabilities: [...contract.runtime.approvedExperienceCapabilities],
    },
    implementations,
    eligibleByPage,
    pageCompositions: registry.pageCompositions ?? [],
    assets: registry.assets ?? [],
    dependencies: { ...(registry.runtimeDependencies ?? {}) },
  };
}
