/**
 * Canonical fresh-launch planning without page-body materialization.
 *
 * This module resolves the same topology, capabilities, theme, Art Direction,
 * registry and UI-foundation contracts used by the legacy full compiler. The
 * plan-only projection emits protected runtime infrastructure, but deliberately
 * emits no `/src/pages/*` implementation. UnisonAppBuilder owns those bodies.
 */

import type {
  CapabilityPack,
  PlaygroundState,
  PlaygroundValidation,
  WizardSelections,
} from '@/types/playground';
import type { GeneratedSitePlan } from '@/platform/core/siteTopologyPlanner';
import type { SiteBundleSnapshot } from '@/platform/core/canonicalPipeline';
import type { NavItem, RouteDef, SiteManifest } from '@/types/siteBundle';
import { resolveCapabilities } from '@/services/wizardCapabilityResolver';
import { materializePlayground } from '@/services/wizardPlaygroundMaterializer';
import { getValidationSummary, validatePlayground } from '@/services/playgroundValidationService';
import { validateComposition } from '@/services/componentIntelligenceRegistry';
import {
  buildThemedIndexCssFromTokens,
  SHADCN_LIBRARY_CSS_MARKER,
} from '@/components/onboarding/themePresetToIndexCss';
import { assertThemeSeed } from '@/platform/core/themeSeedAssert';
import {
  buildWizardDesignIntervention,
  type WizardDesignIntervention,
} from '@/services/wizardDesignIntervention';
import {
  buildGeneratedUiFoundation,
  type GeneratedUiManifest,
} from '@/platform/core/generatedUiFoundation';
import { getRequiredRadixPrimitives } from '@/sections/variants';
import type { VariantId } from '@/sections/variants/types';
import { collectResolvedCompositions } from '@/platform/core/resolvedComposition';
import {
  buildThemeContractFiles,
} from '@/platform/core/themeContract';
import { projectResolvedArtDirection, type ResolvedArtDirection } from '@/sections/variants/resolvedArtDirection';
import {
  buildWizardAggregatedRegistryContext,
  WIZARD_REGISTRY_CONTEXT_PATH,
  type WizardAggregatedRegistryContext,
} from '@/services/launch/wizardRegistryAggregation';
import { ensureViteRootFiles } from '@/services/previewSession';
import { generateCanonicalRouter } from '@/utils/topologyRouterGenerator';
import { resolveApprovedExperienceCapabilities } from '@/services/experienceCapabilityResolver';
import { GENERATED_RUNTIME_PROFILE, EXPERIENCE_CAPABILITY_ID } from '@/platform/core/generatedRuntimeCapabilities';
import { resolveExperienceRequirement } from '@/sections/variants';
import { TEMPLATE_DESIGN_CONTRACT_PATH } from '@/services/templateLayoutContract';
import { readTemplateDesignContract } from '@/services/templateLayoutContract';
import { THEME_OVERRIDES_PATH } from '@/services/theme/themeTokenOverrides';
import type { AppBuilderUIFoundation } from '@/services/app-builder/appBuilderContracts';
import {
  readThemeContract,
  THEME_CONTRACT_PATH,
  THEME_CONTRACT_VERSION,
} from '@/platform/core/themeContract';
import { buildWizardGenerationBrief } from '@/services/wizardGenerationBrief';
import { designPlanSignature } from '@/utils/designVariation';
import { computeRenderHash } from '@/platform/core/generationSeed';
import { designRegistrySignature } from '@/services/designImplementationRegistry';

export const CANONICAL_LAUNCH_PLAN_VERSION = 'unison-canonical-launch-plan/1' as const;

export interface CanonicalLaunchContractResolution {
  capabilities: CapabilityPack;
  playground: PlaygroundState;
  sitePlan: GeneratedSitePlan;
  validations: PlaygroundValidation[];
  warnings: string[];
  errors: string[];
  themePresetId: string;
  themedCss: string;
  designIntervention: WizardDesignIntervention;
  artDirection: ResolvedArtDirection;
  uiFoundation: ReturnType<typeof buildGeneratedUiFoundation>;
  uiFoundationContract: AppBuilderUIFoundation;
  registryContext: WizardAggregatedRegistryContext;
}

export interface CanonicalLaunchPlan extends CanonicalLaunchContractResolution {
  version: typeof CANONICAL_LAUNCH_PLAN_VERSION;
  infrastructureFiles: Record<string, string>;
}

function planningInputFiles(existingVfsFiles: Readonly<Record<string, string>>): Record<string, string> {
  const allowed = [
    '/.unison/wizard-seed.json',
    TEMPLATE_DESIGN_CONTRACT_PATH,
    THEME_OVERRIDES_PATH,
  ];
  return Object.fromEntries(
    allowed.flatMap((path) => typeof existingVfsFiles[path] === 'string' ? [[path, existingVfsFiles[path]]] : []),
  );
}

export function resolveCanonicalLaunchContracts(
  selections: WizardSelections,
  existingVfsFiles: Record<string, string> = {},
): CanonicalLaunchContractResolution {
  const themePresetId = assertThemeSeed(
    selections.themePresetId,
    'WizardSelections -> canonical launch contracts',
  );
  if (!selections.themeTokens) {
    throw new Error('[canonicalLaunchPlan] Wizard selections require resolved themeTokens.');
  }

  const warnings: string[] = [];
  const errors: string[] = [];
  const capabilities = resolveCapabilities(selections);
  const materialization = materializePlayground(selections, capabilities);
  warnings.push(...materialization.warnings);
  const playground = materialization.playground;
  const sitePlan = materialization.sitePlan;
  const validations = validatePlayground(playground, existingVfsFiles);
  const summary = getValidationSummary(validations);
  if (!summary.isHealthy) {
    errors.push(...validations.filter((item) => item.severity === 'error').map((item) => item.message));
    warnings.push(...validations.filter((item) => item.severity === 'warning').map((item) => item.message));
  }
  for (const page of Object.values(playground.pageRegistry.pages)) {
    const sectionTypes = (page as { sectionTypes?: string[] }).sectionTypes;
    if (!sectionTypes?.length) continue;
    const composition = validateComposition(sectionTypes as never);
    warnings.push(...composition.issues.map((issue) => `[${page.title}] ${issue}`));
  }

  const designIntervention = buildWizardDesignIntervention({
    compositionPlan: selections.compositionPlan,
    businessName: selections.businessName,
    businessModel: selections.businessModel,
    industryOverlay: selections.industryOverlay || (selections as { industry?: string }).industry,
    templateId: selections.templateId,
    themePresetId,
    wizardSeedId: selections.wizardSeedId,
    regenerationNonce: selections.regenerationNonce,
    primaryGoal: selections.primaryGoal,
    secondaryGoals: selections.secondaryGoals,
    requestedPages: selections.requestedPages,
    projectId: selections.businessId,
    needsBooking: selections.needsBooking,
    sellsProducts: selections.sellsProducts,
    wantsLeadCapture: selections.wantsLeadCapture,
    needsImmersive: selections.needsImmersive,
    designSelection: selections.designSelection,
  });
  const themedCss = buildThemedIndexCssFromTokens(selections.themeTokens, {
    presetId: themePresetId,
    label: themePresetId,
    artDirectionPackId: designIntervention.artDirectionPackId,
  });
  if (!themedCss.includes('--primary') || !themedCss.includes(SHADCN_LIBRARY_CSS_MARKER)) {
    throw new Error('[canonicalLaunchPlan] Theme tokens did not produce the canonical shadcn stylesheet.');
  }

  const uiFoundation = buildGeneratedUiFoundation({
    industry: selections.industryOverlay || (selections as { industry?: string }).industry,
    templateId: selections.templateId,
    themePresetId,
    needsBooking: selections.needsBooking,
    wantsLeadCapture: selections.wantsLeadCapture,
    sellsProducts: selections.sellsProducts,
    requiredRadixPrimitives: getRequiredRadixPrimitives(
      Object.values(designIntervention.activeVariants),
    ),
  });
  const artDirection = projectResolvedArtDirection({ ...designIntervention, themePresetId });
  if (!artDirection) throw new Error('[canonicalLaunchPlan] Art Direction could not be projected.');
  const registryContext = buildWizardAggregatedRegistryContext({
    industry: selections.industryOverlay || (selections as { industry?: string }).industry || 'general',
    templateId: selections.templateId || 'unknown',
    themePresetId,
    seed: designIntervention.seed,
    businessId: selections.businessId,
    projectId: selections.businessId,
    designSelection: selections.designSelection,
  });
  const uiFoundationContract: AppBuilderUIFoundation = {
    version: uiFoundation.manifest.version,
    manifestPath: '/.unison/ui-manifest.json',
    importRoot: uiFoundation.manifest.importRoot,
    runtimeProfile: uiFoundation.manifest.runtimeProfile || GENERATED_RUNTIME_PROFILE.id,
    experienceCapabilities: [...(uiFoundation.manifest.experience?.capabilities || [])],
    approvedExperienceCapabilities: resolveApprovedExperienceCapabilities({
      webgl: designIntervention.envelope?.webgl,
      foundationCapabilities: uiFoundation.manifest.experience?.capabilities,
      // Approve before authoring: the Wizard's Immersive choice (or a resolved
      // registered implementation) is the requirement, since no page exists yet.
      requiredCapabilities: (selections.needsImmersive || selections.designSelection?.experience === 'immersive')
        ? [EXPERIENCE_CAPABILITY_ID]
        : resolveExperienceRequirement(Object.values(designIntervention.activeVariants)).capabilities,
      reachesExperienceLayer: false,
    }),
  };

  return {
    capabilities,
    playground,
    sitePlan,
    validations,
    warnings,
    errors,
    themePresetId,
    themedCss,
    designIntervention,
    artDirection,
    uiFoundation,
    uiFoundationContract,
    registryContext,
  };
}

export function buildCanonicalLaunchPlan(
  selections: WizardSelections,
  existingVfsFiles: Record<string, string> = {},
): CanonicalLaunchPlan {
  const resolved = resolveCanonicalLaunchContracts(selections, existingVfsFiles);
  let infrastructureFiles: Record<string, string> = {
    ...planningInputFiles(existingVfsFiles),
    ...resolved.uiFoundation.files,
    ...buildThemeContractFiles({
      artDirectionPackId: resolved.designIntervention.artDirectionPackId,
      themePresetId: resolved.themePresetId,
    }),
    '/src/index.css': resolved.themedCss,
    '/.unison/design-intervention.json': JSON.stringify(resolved.designIntervention, null, 2),
    [WIZARD_REGISTRY_CONTEXT_PATH]: JSON.stringify(resolved.registryContext, null, 2),
  };
  infrastructureFiles['/src/App.tsx'] = generateCanonicalRouter(
    resolved.playground.pageRegistry,
    selections.businessName,
  );
  infrastructureFiles = ensureViteRootFiles(infrastructureFiles, {
    stage4bCss: resolved.themedCss,
    themePresetId: resolved.themePresetId,
  });
  infrastructureFiles['/src/index.css'] = resolved.themedCss;

  const pageBodies = Object.keys(infrastructureFiles).filter((path) => /^\/src\/pages\//.test(path));
  if (pageBodies.length) {
    throw new Error(`[canonicalLaunchPlan] Plan-only projection emitted page bodies: ${pageBodies.join(', ')}`);
  }
  return {
    version: CANONICAL_LAUNCH_PLAN_VERSION,
    ...resolved,
    infrastructureFiles,
  };
}

function candidateSnapshotId(plan: CanonicalLaunchPlan, files: Readonly<Record<string, string>>): string {
  let hash = 0x811c9dc5;
  const value = [
    plan.designIntervention.seed,
    ...plan.sitePlan.pages.map((page) => `${page.id}:${page.route}:${page.filePath}`),
    ...Object.keys(files).sort().map((path) => `${path}:${files[path].length}`),
  ].join('|');
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `candidate_${hash.toString(16).padStart(8, '0')}`;
}

/**
 * Project an App Builder candidate into the canonical snapshot shape consumed
 * by finalization. This object is not accepted or persisted until commitMutation
 * succeeds; it is the candidate input to the one seal point.
 */
export function projectCanonicalLaunchCandidateSnapshot(
  plan: CanonicalLaunchPlan,
  selections: WizardSelections,
  candidateFiles: Record<string, string>,
): SiteBundleSnapshot {
  const registry = plan.playground.pageRegistry;
  const pages = Object.values(registry.pages);
  const generatedSectionVariants = Object.values(collectResolvedCompositions(candidateFiles))
    .flatMap((composition) => composition.sections.flatMap((section) =>
      section.variantId ? [[section.sectionId, section.variantId as VariantId] as const] : [],
    ));
  const designIntervention: WizardDesignIntervention = {
    ...plan.designIntervention,
    activeVariants: {
      ...plan.designIntervention.activeVariants,
      ...Object.fromEntries(generatedSectionVariants),
    },
  };
  const routes: RouteDef[] = pages.map((page) => ({
    path: page.path,
    pageId: page.pageId,
    isHome: page.isHome,
  }));
  const nav: NavItem[] = pages
    .filter((page) => page.showInNav)
    .sort((left, right) => left.navOrder - right.navOrder)
    .map((page) => ({ label: page.title, path: page.path, pageId: page.pageId }));
  const manifest: SiteManifest = {
    routes,
    nav,
    layout: { header: 'minimal', footer: 'minimal' },
    metadata: {
      title: selections.businessName || 'My Site',
      description: `${selections.businessName} — Built with Unison`,
    },
  };
  const generationBrief = buildWizardGenerationBrief({
    pageRegistry: registry,
    vfsFiles: candidateFiles,
    uiFoundation: plan.uiFoundation.manifest,
    themePresetId: plan.themePresetId,
    artDirectionPackId: plan.designIntervention.artDirectionPackId,
    industry: plan.sitePlan.industry,
    seed: plan.designIntervention.seed,
    customerGoals: selections.secondaryGoals,
  });
  const themeContract = readThemeContract(candidateFiles);
  const templateDesignContract = readTemplateDesignContract(candidateFiles);

  return {
    snapshotId: candidateSnapshotId(plan, candidateFiles),
    businessName: selections.businessName || '',
    industry: plan.sitePlan.industry,
    pageRegistry: registry,
    vfsFiles: { ...candidateFiles },
    routerFile: {
      path: '/src/App.tsx',
      content: candidateFiles['/src/App.tsx'] || '',
    },
    manifest,
    bindings: { ...plan.playground.bindings },
    calendars: { ...plan.playground.calendars },
    popups: { ...plan.playground.popups },
    creatorData: plan.playground.creatorData,
    componentInstances: plan.playground.creatorData.componentInstances,
    routes: plan.sitePlan.pages.map((page) => page.route),
    homeRoute: plan.sitePlan.pages.find((page) => page.isHome)?.route || '/',
    createdAt: new Date().toISOString(),
    themeTokens: selections.themeTokens,
    meta: {
      source: 'wizard',
      systemId: selections.systemType ?? null,
      industry: plan.sitePlan.industry,
      verticalContractId: selections.systemType ?? null,
      wizardSeedId: selections.wizardSeedId,
      generationSeed: plan.designIntervention.seed,
      designPlanSignature: designPlanSignature(plan.designIntervention.seed),
      renderHash: computeRenderHash({
        artDirectionFamilyId: plan.artDirection.familyId,
        artDirectionQualifiedPackId: plan.artDirection.packId,
        seed: plan.designIntervention.seed,
        industry: plan.sitePlan.industry,
        templateId: selections.templateId ?? null,
        themePresetId: plan.themePresetId,
        artDirectionPackId: plan.designIntervention.artDirectionPackId,
        layoutRecipe: plan.designIntervention.layoutRecipe ?? null,
        motionRecipes: plan.designIntervention.motionRecipes ?? null,
        experienceBudget: plan.designIntervention.experienceBudget ?? null,
        activeVariants: designIntervention.activeVariants,
        pages: pages.map((page) => `${page.pageId}:${page.path}:${page.pageRole ?? page.pageType}`).sort(),
        routes: plan.sitePlan.pages.map((page) => page.route).sort(),
      }),
      artDirection: plan.artDirection,
      themePresetId: plan.themePresetId,
      themeStyleVersion: '2.0',
      templateId: selections.templateId ?? null,
      artDirectionPackId: plan.designIntervention.artDirectionPackId,
      designSelection: selections.designSelection,
      interactionManifest: selections.interactionManifest,
      themeInjection: {
        version: '1.0',
        stage: '4b',
        presetId: plan.themePresetId,
        cssPath: '/src/index.css',
      },
      uiFoundation: plan.uiFoundationContract,
      themeContract: themeContract ? {
        version: THEME_CONTRACT_VERSION,
        contractPath: THEME_CONTRACT_PATH,
        artDirectionPackId: themeContract.artDirectionPackId,
      } : undefined,
      templateDesignContract: templateDesignContract ? {
        version: String(templateDesignContract.version),
        contractPath: TEMPLATE_DESIGN_CONTRACT_PATH,
        templateId: templateDesignContract.templateId,
        implementationId: templateDesignContract.implementationId,
        variantId: templateDesignContract.variantId,
        seed: templateDesignContract.seed,
        layoutSignature: templateDesignContract.signature,
        contractSignature: templateDesignContract.contractSignature,
        registrySignature: designRegistrySignature(),
      } : undefined,
      generationBrief,
      designIntervention,
      registryContext: plan.registryContext,
    },
  };
}
