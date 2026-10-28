/**
 * Narrows the sealed AppBuildContract into one bounded DesignSourceBundle.
 * It never re-selects from the global registry: every output id comes from the
 * contract's own sourceSelection / registryContext.
 */

import type { AppBuildContract } from '@/services/app-builder/appBuilderContracts';
import type { WizardRegistryImplementationSummary } from '@/services/launch/wizardRegistryAggregation';
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
    const roleFit = pool.filter((impl) => pinnedIds.has(impl.id)
      || impl.pageRoles.length === 0 || impl.pageRoles.includes(page.role));
    const richerTypes = new Set(roleFit.filter((impl) => !isGenericImplementationId(impl.id)).map((impl) => impl.sectionType));
    const rank = (impl: WizardRegistryImplementationSummary) =>
      (preferred[impl.sectionType] ?? []).includes(impl.id) ? 0 : 1;
    const ranked = roleFit
      .filter((impl) => !(isGenericImplementationId(impl.id) && richerTypes.has(impl.sectionType)))
      .sort((a, b) => rank(a) - rank(b) || a.id.localeCompare(b.id));
    const byType = new Map<string, WizardRegistryImplementationSummary[]>();
    for (const impl of ranked) byType.set(impl.sectionType, [...(byType.get(impl.sectionType) ?? []), impl]);
    const interleaved: WizardRegistryImplementationSummary[] = [];
    for (let round = 0; interleaved.length < ranked.length; round += 1) {
      for (const group of byType.values()) if (group[round]) interleaved.push(group[round]);
    }
    const bounded = interleaved.slice(0, MAX_ELIGIBLE_PER_PAGE);
    const boundedIds = new Set(bounded.map((impl) => impl.id));
    for (const implementation of interleaved) {
      if (pinnedIds.has(implementation.id) && !boundedIds.has(implementation.id)) {
        bounded.push(implementation);
        boundedIds.add(implementation.id);
      }
    }
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
