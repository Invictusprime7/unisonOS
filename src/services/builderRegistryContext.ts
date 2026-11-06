/**
 * builderRegistryContext — V4 M8: both AI layers see the SAME canonical view.
 *
 * The Wizard composer (`requestAIPageComposition`) and Lane B already receive
 * the bounded `WizardAggregatedRegistryContext` projection. The in-Builder
 * assistant did not: `sanitizeVfsForAI` strips `/.unison/`, so the edit lane
 * was blind to certified 21st variants, component-state contracts, artifact
 * contracts, runtime dependencies and capability requirements.
 *
 * This module resolves the canonical context for an open draft:
 *   1. the sealed projection persisted at WIZARD_REGISTRY_CONTEXT_PATH, else
 *   2. a freshly aggregated projection for the draft's industry/template/theme.
 *
 * It then produces a BOUNDED payload (no source files, no credentials, no
 * global registry dump) shaped exactly like the Lane B projection so both
 * lanes reason over identical vocabulary.
 */

import {
  buildWizardAggregatedRegistryContext,
  WIZARD_REGISTRY_CONTEXT_PATH,
  type WizardAggregatedRegistryContext,
  type WizardRegistryImplementationSummary,
} from '@/services/launch/wizardRegistryAggregation';
import { readSealedArtDirection, type SealedArtDirectionMeta } from '@/sections/variants/resolvedArtDirection';
import type { ComponentStateContract } from '@/sections/variants/componentStates';
import type { ImplementationVisualSignature } from '@/services/implementationVisualSignature';
import type { WizardDesignSelection, WizardExperiencePreference } from '@/services/wizardDesignSelection';

/** Bounded projection handed to the in-Builder AI lane. */
export interface BuilderRegistryContext {
  version: WizardAggregatedRegistryContext['version'];
  generationPolicy?: WizardAggregatedRegistryContext['generationPolicy'];
  industry: string;
  templateId: string;
  themePresetId: string;
  artDirectionPackId?: string;
  artDirectionGrammar?: WizardAggregatedRegistryContext['artDirectionGrammar'];
  /** Sealed family + qualified pack — the AI Builder may never switch family. */
  artDirection?: { familyId: string; packId: string; storagePackId: string } | null;
  designSelection?: WizardDesignSelection;
  designRegistrySignature: string;
  sections: Array<{
    type: string;
    isFirstClass: boolean;
    artifactId: string | null;
    allowedVariantIds: string[];
  }>;
  implementations: Array<{
    id: string;
    sectionType: string;
    name: string;
    certification: string;
    pageRoles: readonly string[];
    vocabularyRefs: WizardRegistryImplementationSummary['vocabularyRefs'];
    radixPrimitives: readonly string[];
    runtimeDependencies?: readonly string[];
    componentStates?: ComponentStateContract;
    visualSignature?: ImplementationVisualSignature;
    compatibleExperiencePreferences?: readonly WizardExperiencePreference[];
    artifactContract?: {
      artifactId: string;
      dataSourceKind: string;
      supportedSlots: readonly string[];
      intentBindings: readonly string[];
      aiEditScope: string;
    };
  }>;
  runtimeDependencies?: Record<string, string>;
  primitiveFamilies?: WizardAggregatedRegistryContext['primitiveFamilies'];
  capabilityRequirements?: WizardAggregatedRegistryContext['capabilityRequirements'];
  pageCompositions?: WizardAggregatedRegistryContext['pageCompositions'];
  artifacts?: WizardAggregatedRegistryContext['artifacts'];
  catalogSurfaces?: WizardAggregatedRegistryContext['catalogSurfaces'];
  motionPrimitives?: string[];
  motionProfile?: string;
  interactionProfile?: string;
  assets?: WizardAggregatedRegistryContext['assets'];
  /** Existing project modules the Composer may import without inventing paths. */
  validImportPaths?: string[];
  /** Certified recipes made explicit for reuse/adaptation decisions. */
  portableRecipeIds?: string[];
}

const MAX_SECTIONS = 24;
const MAX_IMPLEMENTATIONS = 18;
const MAX_VARIANTS_PER_SECTION = 12;
const MAX_PAGE_COMPOSITIONS = 16;
const MAX_ALTERNATIVES_PER_PAGE = 8;
const MAX_IMPLEMENTATIONS_PER_ALTERNATIVE = 12;
const MAX_ARTIFACTS = 16;
const MAX_CATALOG_SURFACES = 12;
const MAX_ASSETS = 12;
const MAX_IMPORT_PATHS = 100;

const DESIGN_SOURCE_PUBLIC = /^\/src\/unison\/design-sources\/(?!recipes\/)[^/]+\.(?:tsx?|jsx?)$/;

/** Design-source entry modules are never truncated away: the Builder must always see what it may import. */
export function collectValidImportPaths(files?: Record<string, string> | null): string[] {
  const all = Object.keys(files ?? {})
    .filter(path => /^\/src\/.+\.(?:tsx?|jsx?)$/.test(path) && !path.startsWith('/src/unison/design-sources/recipes/'))
    .sort();
  const priority = all.filter(path => DESIGN_SOURCE_PUBLIC.test(path));
  const rest = all.filter(path => !DESIGN_SOURCE_PUBLIC.test(path));
  return [...priority, ...rest]
    .flatMap(path => {
      const withoutExtension = path.replace(/\.(?:tsx?|jsx?)$/, '');
      const alias = withoutExtension.replace(/^\/src\//, '@/').replace(/\/index$/, '');
      return [path, alias];
    })
    .filter((path, index, list) => list.indexOf(path) === index)
    .slice(0, MAX_IMPORT_PATHS)
    .sort();
}

/** Read the sealed projection persisted into the draft VFS by the launcher. */
export function readPersistedRegistryContext(
  vfsFiles?: Record<string, string> | null,
): WizardAggregatedRegistryContext | null {
  const raw = vfsFiles?.[WIZARD_REGISTRY_CONTEXT_PATH];
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as WizardAggregatedRegistryContext;
    return parsed && Array.isArray(parsed.sections) ? parsed : null;
  } catch {
    return null;
  }
}

/** Narrow a full canonical context down to the bounded AI payload. */
export function boundRegistryContext(
  context: WizardAggregatedRegistryContext,
  options?: { sectionTypes?: readonly string[]; pageRole?: string },
): BuilderRegistryContext {
  const focus = options?.sectionTypes?.length ? new Set(options.sectionTypes) : null;
  const sectionCandidates = context.sections
    .filter((section) => !focus || focus.has(section.type))
    .slice(0, MAX_SECTIONS);
  const allowed = new Set(sectionCandidates.map((section) => section.type));
  const implementations = (context.implementations ?? [])
    .filter((implementation) => allowed.has(implementation.sectionType)
      && (!options?.pageRole || implementation.pageRoles.length === 0 || implementation.pageRoles.includes(options.pageRole)))
    .sort((a, b) => {
      if (!options?.pageRole) return 0;
      return Number(b.pageRoles.includes(options.pageRole)) - Number(a.pageRoles.includes(options.pageRole));
    })
    .slice(0, MAX_IMPLEMENTATIONS)
    .map((implementation) => ({
      id: implementation.id,
      sectionType: implementation.sectionType,
      name: implementation.name,
      certification: implementation.certification,
      pageRoles: implementation.pageRoles,
      vocabularyRefs: implementation.vocabularyRefs,
      radixPrimitives: implementation.radixPrimitives,
      runtimeDependencies: implementation.runtimeDependencies,
      componentStates: implementation.componentStates,
      visualSignature: implementation.visualSignature,
      compatibleExperiencePreferences: implementation.compatibleExperiencePreferences,
      artifactContract: implementation.artifactContract,
    })) as BuilderRegistryContext['implementations'];
  const includedImplementationIds = new Set(implementations.map((implementation) => implementation.id));
  const sections = sectionCandidates.map((section) => ({
    type: section.type,
    isFirstClass: section.isFirstClass,
    artifactId: section.artifactId ?? null,
    allowedVariantIds: (section.allowedVariantIds ?? [])
      .filter((id) => !options?.pageRole || includedImplementationIds.has(id))
      .slice(0, MAX_VARIANTS_PER_SECTION),
  }));
  return {
    version: context.version,
    generationPolicy: context.generationPolicy,
    industry: context.industry,
    templateId: context.templateId,
    themePresetId: context.themePresetId,
    artDirectionPackId: context.artDirectionPackId,
    artDirectionGrammar: context.artDirectionGrammar,
    designSelection: context.designSelection,
    designRegistrySignature: context.designRegistrySignature,
    sections,
    implementations,
    runtimeDependencies: context.runtimeDependencies,
    primitiveFamilies: context.primitiveFamilies,
    capabilityRequirements: context.capabilityRequirements,
    artifacts: context.artifacts
      .filter(artifact => allowed.has(artifact.sectionType))
      .slice(0, MAX_ARTIFACTS),
    catalogSurfaces: context.catalogSurfaces.slice(0, MAX_CATALOG_SURFACES),
    motionPrimitives: context.motionPrimitives.slice(0, 20),
    motionProfile: context.motionProfile,
    interactionProfile: context.interactionProfile,
    assets: context.assets?.slice(0, MAX_ASSETS),
    portableRecipeIds: implementations.map(implementation => implementation.id),
    pageCompositions: context.pageCompositions?.slice(0, MAX_PAGE_COMPOSITIONS).map((composition) => ({
      role: composition.role,
      alternatives: composition.alternatives.slice(0, MAX_ALTERNATIVES_PER_PAGE).map((alternative) => ({
        id: alternative.id,
        sectionTypes: alternative.sectionTypes.slice(0, MAX_IMPLEMENTATIONS_PER_ALTERNATIVE),
        implementationIds: alternative.implementationIds.slice(0, MAX_IMPLEMENTATIONS_PER_ALTERNATIVE),
      })),
    })),
  };
}

/**
 * Resolve the bounded canonical registry context for the in-Builder AI lane.
 * Never throws: the edit lane must still work when a draft predates V2.
 */
export function resolveBuilderRegistryContext(input: {
  vfsFiles?: Record<string, string> | null;
  industry?: string | null;
  templateId?: string | null;
  themePresetId?: string | null;
  seed?: string | null;
  businessId?: string | null;
  projectId?: string | null;
  sectionTypes?: readonly string[];
  pageRole?: string | null;
}): BuilderRegistryContext | null {
  try {
    const withArt = (ctx: BuilderRegistryContext): BuilderRegistryContext => {
      const art = readSnapshotArtDirection(input.vfsFiles);
      const withImports = { ...ctx, validImportPaths: collectValidImportPaths(input.vfsFiles) };
      if (!art) return withImports;
      return { ...withImports, artDirectionPackId: art.storagePackId, artDirection: { familyId: art.familyId, packId: art.packId, storagePackId: art.storagePackId } };
    };
    const persisted = readPersistedRegistryContext(input.vfsFiles);
    if (persisted) return withArt(boundRegistryContext(persisted, { sectionTypes: input.sectionTypes, pageRole: input.pageRole ?? undefined }));
    if (!input.industry && !input.templateId && !input.themePresetId) return null;
    const rebuilt = buildWizardAggregatedRegistryContext({
      industry: input.industry || 'general',
      templateId: input.templateId || 'default',
      themePresetId: input.themePresetId || 'default',
      seed: input.seed ?? undefined,
      businessId: input.businessId ?? undefined,
      projectId: input.projectId ?? undefined,
    });
    return withArt(boundRegistryContext(rebuilt, { sectionTypes: input.sectionTypes, pageRole: input.pageRole ?? undefined }));
  } catch {
    return null;
  }
}

/** Sealed art direction read from the snapshot mirror; null when absent/unparseable. */
function readSnapshotArtDirection(files?: Record<string, string> | null) {
  const raw = files?.['/.unison/site-bundle-snapshot.json'];
  if (!raw) return null;
  try {
    return readSealedArtDirection((JSON.parse(raw) as { meta?: SealedArtDirectionMeta }).meta);
  } catch {
    return null;
  }
}
