import { validateTwentyFirstGenerationCoverage, summarizeCoverageReport } from '@/services/launch/twentyFirstCoverageGate';
/**
 * Launch Orchestrator — Wizard intent → canonical plan → App Builder → Builder.
 *
 * Fresh-launch flow (implemented):
 *   plan (resolve selections & IDs)
 *   → contract (canonical planning, infrastructure only)
 *   → app-build (App Builder authors complete application as isolated candidate)
 *   → preflight (validate candidate, seal SiteBundleSnapshot)
 *   → commit (one initial revision with accepted App Builder application)
 *   → handoff (Builder/Preview/Publish consume same revision).
 *
 * All application authorship happens before the initial canonical commit.
 * Revision 1 is the final accepted App Builder application, not a baseline
 * to be rewritten. Post-launch editing routes through the same App Builder.
 */

import { supabase } from "@/integrations/supabase/client";
import { withAccountDemoGeneration } from '@/services/accountDemoGeneration';
import {
  businessSystems,
  type BusinessSystemType,
  type LayoutCategory,
} from "@/data/templates/types";
import type { ThemePreset } from "@/components/onboarding/themePresets";
import { themePresetToThemeTokens } from "@/components/onboarding/themePresetToTokens";
import {
  compileContract,
  createBlueprintFromIndustry,
  evaluateAllGates,
  getIndustryForCategory,
  getAllowedIntents,
  runIntegrityReport,
} from "@/platform/core";
import { classifyDraft } from "@/platform/core/canonicalRuntimeContract";
import { getCompositionMeta } from "@/utils/compositionReference";
import { getCompositionById } from "@/sections/templates";
import { deriveDesignSeed } from "@/platform/core/generationSeed";
import { generateDesignVariation } from "@/utils/designVariation";
import {
  buildTemplateLayoutContract,
  TEMPLATE_DESIGN_CONTRACT_PATH,
} from "@/services/templateLayoutContract";
import {
  buildCanonicalLaunchArtifactsAsync,
  type PublishedRuntimeConfig,
} from "@/services/canonicalLaunchVfs";
import { loadBusinessProfile, saveSiteProfile } from "@/services/businessProfileService";
import { autoEmitSectionBindings, planSectionDataBindings } from "@/services/autoEmitSectionBindings";
import { countExpectedGeneratedBindingReceipts, persistGeneratedBindings } from '@/services/persistGeneratedBindings';
import { buildBusinessRuntimeContract } from "@/platform/core/businessRuntimeContract";
import {
  buildNativePublishReadinessManifest,
  buildNativePublishSetupSnapshot,
} from "@/services/nativePublishReadiness";
import {
  auditWizardIntentGap,
  buildIntentBindingsFile,
  buildIntentSurfacesFile,
} from "@/services/wizardIntentAudit";
import { planLaunchFormDefinitions } from "@/services/launchFormDefinitions";
import { persistLaunchFormDefinitions } from "@/services/launchFormDefinitionPersistence";
import { evaluatePublishedRuntimeReadiness } from "@/services/publishedRuntimeReadiness";
import {
  createConfirmedLaunchIds,
  provisionConfirmedLaunchSite,
  type ConfirmedLaunchIds,
} from "@/services/confirmedLaunchProvisioner";
import { commitMutation } from "@/services/vfsCommitService";
import { computeBuilderVfsSignature, writeBuilderRecoverySnapshot, markBuilderRecoveryPersisted, type BuilderRecoverySnapshot } from '@/services/builderStateRecovery';
import { legacyFilesToPatchPlan } from "@/types/patchPlan";
import { createLaunchState, type LaunchState } from "@/types/launchState";
import {
  buildLauncherNavigationState,
  persistLauncherHandoff,
} from "@/services/launcherHandoffPersistence";
import {
  createLaunchRun,
  publishLaunchDegradations,
  LaunchFatalError,
  type LaunchRun,
  type LaunchRunSnapshot,
} from "@/services/launch/launchRun";
import { resolveVerticalLaunchContract } from "@/services/verticalLaunchContract";
import { resolveArtDirectionPack, resolveExperienceRequirement } from "@/sections/variants";
import { resolveApprovedExperienceCapabilities } from "@/services/experienceCapabilityResolver";
import { runExperiencePreflight } from "@/services/experiencePreflightGate";
import type { BuilderIdentity } from "@/types/builderIdentity";
import type { BusinessProfileDTO } from "@/types/businessProfile";
import type { WizardBusinessParameters, WizardSelections } from "@/types/playground";
import {
  getLanguageFromFileName,
  type VirtualNode,
} from "@/hooks/useVirtualFileSystem";
import { livePageTopology } from "@/builder/controllers/PageTopologyController";
import { livePreviewRuntime } from "@/builder/controllers/PreviewRuntimeController";
import { livePlaygroundSync } from "@/builder/controllers/PlaygroundSyncController";
import {
  getDefaultTemplateCardForIndustry,
  getDefaultTemplateCardFor,
  GOAL_TO_NEEDS,
  LAUNCHER_PRESELECTS,
  SYSTEM_TO_BUSINESS_MODEL,
  SYSTEM_TO_INDUSTRY_OVERLAY,
  resolveTemplateIndustryCategory,
  uniqueValues,
  type CustomerNeed,
  type PageChoice,
  type PrimaryGoal,
  type TemplateCardData,
} from "@/components/onboarding/wizard/wizardCatalog";
import {
  buildPublicBusinessContext,
  resolveWizardIndustryOverlay,
} from '@/services/wizardMergeContext';
import { buildWizardBindingGuide } from '@/services/wizardBindingBridge';
import type { CommitMutationResult } from "@/services/vfsCommitService";
import { compileResolvedSiteDesignContext } from '@/services/launch/resolvedSiteDesignContext';
import { buildAppBuildContract } from '@/services/app-builder/appBuilderContracts';
import { unisonAppBuilder } from '@/services/app-builder/UnisonAppBuilder';
import { WIZARD_LANE_B_PROTECTED_PATHS } from '@/services/wizardLaneBEnrichment';
import {
  buildCanonicalLaunchPlan,
  projectCanonicalLaunchCandidateSnapshot,
} from '@/services/launch/canonicalLaunchPlan';
import { createWizardCompileArtifact } from '@/platform/core/snapshotSeal';
import { resolveBusinessLaunchPlan } from '@/services/launch/launchCapabilities';

export interface LaunchOrchestratorInput {
  demoGeneration?: boolean;
  systemId: BusinessSystemType;
  template?: TemplateCardData;
  industry?: string;
  visionPrompt?: string;
  designSelection?: import("@/services/wizardDesignSelection").WizardDesignSelection;
  regenerationNonce?: string | null;
  theme: ThemePreset;
  businessName: string;
  primaryGoal: PrimaryGoal | null;
  customerNeeds: CustomerNeed[];
  selectedPages: PageChoice[];
  socialLinks?: Record<string, string>;
  businessParameters?: WizardBusinessParameters;
  existingBusinessId?: string | null;
}

export interface LaunchOrchestratorCallbacks {
  onReview?: (candidate: { files: Record<string, string>; entryPoint: string }) => Promise<boolean>;
  onStatus?: (status: string) => void;
  onProgress?: (snapshot: LaunchRunSnapshot) => void;
  /**
   * @deprecated Fresh launches generate the complete application in the app-build stage.
   * The author stage that used this callback has been removed. All pages are part of
   * revision 1; no page-by-page commits occur after the initial launch commit.
   */
  aiAuthoring?: boolean;
  /**
   * @deprecated Fresh launches generate the complete application in the app-build stage.
   * The author stage that used this callback has been removed. All pages are part of
   * revision 1; no page-by-page commits occur after the initial launch commit.
   */
  onAuthoredPage?: (event: { files: Record<string, string>; pageTitle: string }) => void;
}

export interface LaunchOrchestratorResult {
  launchState: LaunchState;
  routeState: Record<string, unknown>;
  navigationState: unknown;
  projectId: string;
  draftId: string;
  revisionId: string;
  snapshot: LaunchRunSnapshot;
}

let lastYieldAt = 0;

/** Cooperative yield — keeps the wizard shell painting during compilation. */
function yieldToBrowser(): Promise<void> {
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  if (now - lastYieldAt < 12) return Promise.resolve();
  lastYieldAt = now;
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => resolve());
    else setTimeout(resolve, 0);
  });
}

function newId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function resolveGenerationCategory(
  system: (typeof businessSystems)[number],
  template: TemplateCardData,
): LayoutCategory {
  return (resolveTemplateIndustryCategory(template.industry) ||
    system.templateCategories[0]) as LayoutCategory;
}

function vfsFilesToVirtualNodes(vfsFiles: Record<string, string>): VirtualNode[] {
  return Object.entries(vfsFiles).map(([path, content]) => {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const name = normalizedPath.split("/").pop() || normalizedPath;
    return {
      id: `launch-${normalizedPath}`,
      name,
      content,
      type: "file",
      language: getLanguageFromFileName(name),
      parentId: null,
      path: normalizedPath,
    };
  });
}

/**
 * Runs the full deterministic launch. Throws on fatal failure; the caller
 * renders the message and diagnostic context in the wizard.
 */
export async function runLaunchPipeline(
  submitted: LaunchOrchestratorInput,
  callbacks: LaunchOrchestratorCallbacks = {},
): Promise<LaunchOrchestratorResult> {
  if (submitted.demoGeneration) {
    return withAccountDemoGeneration(operationId => runReservedLaunchPipeline(submitted, callbacks, operationId));
  }
  return runReservedLaunchPipeline(submitted, callbacks);
}

async function runReservedLaunchPipeline(
  submitted: LaunchOrchestratorInput,
  callbacks: LaunchOrchestratorCallbacks,
  demoOperationId?: string,
): Promise<LaunchOrchestratorResult> {
  const baseline = submitted.template || getDefaultTemplateCardForIndustry(submitted.industry) || getDefaultTemplateCardFor(submitted.systemId);
  if (!baseline) throw new LaunchFatalError('No content baseline is available for this industry.');
  const input = { ...submitted, template: baseline };
  const run: LaunchRun = createLaunchRun({ onChange: callbacks.onProgress });
  const status = (message: string) => {
    callbacks.onStatus?.(message);
  };

  const system = businessSystems.find((s) => s.id === input.systemId);
  if (!system) throw new LaunchFatalError("That business system is no longer available.");

  const brand = input.businessName.trim();
  if (!brand) throw new LaunchFatalError("Please enter your business name.");

  const composition = getCompositionById(input.template.id);
  if (!composition) {
    throw new LaunchFatalError(
      `"${input.template.label}" has no registered composition. Pick another template.`,
    );
  }

  // ── Stage: plan ───────────────────────────────────────────────────────────
  status("Resolving your site plan…");
  const plan = await run.stage("plan", async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      throw new LaunchFatalError("Your session expired. Sign in again to generate your site.");
    }
    const user = sessionData.session.user;
    const ownerEmail = input.businessParameters?.ownerEmail?.trim()
      || input.businessParameters?.notificationEmail?.trim()
      || user.email
      || "";

    const generationCategory = resolveGenerationCategory(system, input.template);
    const industryProfile = getIndustryForCategory(generationCategory);
    const industryOverlay = resolveWizardIndustryOverlay({
      templateIndustry: input.template.industry,
      generationIndustry: industryProfile?.industry || generationCategory,
      systemIndustry: SYSTEM_TO_INDUSTRY_OVERLAY[input.systemId],
    });
    const compositionMeta = getCompositionMeta(generationCategory);
    const businessLaunchPlan = resolveBusinessLaunchPlan({
      industry: industryProfile?.industry || input.template.industry,
      primaryGoal: input.primaryGoal,
      customerNeeds: input.customerNeeds,
    });
    if (businessLaunchPlan.blockedRequests.length > 0) {
      throw new LaunchFatalError(
        `This launch requests unsupported capabilities: ${businessLaunchPlan.blockedRequests.join(', ')}.`,
      );
    }
    const launchCapabilities = businessLaunchPlan.operationalCapabilities;
    const canonicalIntents = uniqueValues<string>([
      ...(industryProfile
        ? getAllowedIntents(launchCapabilities)
        : system.intents),
      ...(compositionMeta?.intents || []),
    ]);

    // Reserve stable IDs; reviewed launches register them only after acceptance.
    const requestedIds = createConfirmedLaunchIds(input.existingBusinessId || undefined);
    const provision = () => provisionConfirmedLaunchSite({
      ids: requestedIds,
      existingBusinessId: input.existingBusinessId || undefined,
      businessName: brand,
      industry: industryOverlay,
      siteName: `${brand} Site`,
      siteSlug: `${brand}-${requestedIds.siteId.slice(0, 8)}`
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, ""),
      systemType: input.systemId,
      templateId: input.template.id,
      themePresetId: input.theme.id,
    });
    const confirmed: ConfirmedLaunchIds = callbacks.onReview ? requestedIds : await provision();
    try {
      if (!callbacks.onReview) localStorage.setItem("unison:lastBusinessId", confirmed.businessId);
    } catch {
      /* browser storage is best-effort */
    }
    const ids = confirmed;
    const plannedBusinessId = confirmed.businessId;

    const preselect = LAUNCHER_PRESELECTS[input.systemId];
    const launchContract = resolveVerticalLaunchContract(input.systemId);
    const primaryGoal: PrimaryGoal =
      input.primaryGoal || preselect?.primaryGoal || "collect_leads";
    const customerNeeds = uniqueValues<CustomerNeed>(input.customerNeeds);
    const requestedPages = uniqueValues<string>(["home", ...input.selectedPages]);
    const goalNeeds = GOAL_TO_NEEDS[primaryGoal] || {};

    const wizardSeedId = newId("ws");
    const seed = deriveDesignSeed({
      businessName: brand,
      businessModel: SYSTEM_TO_BUSINESS_MODEL[input.systemId] || "general",
      industry: industryOverlay,
      templateId: input.template.id,
      themePresetId: input.theme.id,
      primaryGoal,
      secondaryGoals: customerNeeds,
      requestedPages,
      projectId: plannedBusinessId,
      regenerationNonce: input.regenerationNonce ?? null,
    });

    const themeTokens = themePresetToThemeTokens(input.theme);
    const selections: WizardSelections = {
      regenerationNonce: input.regenerationNonce ?? null,
      visionPrompt: input.visionPrompt?.trim(),
      designSelection: input.designSelection,
      businessName: brand,
      businessParameters: {
        ...input.businessParameters,
        ownerEmail,
        notificationEmail: input.businessParameters?.notificationEmail?.trim() || ownerEmail || undefined,
        socialLinks: input.socialLinks,
      },
      businessModel: SYSTEM_TO_BUSINESS_MODEL[input.systemId] || "general",
      industryOverlay,
      systemType: input.systemId,
      primaryGoal,
      secondaryGoals: customerNeeds as string[],
      needsBooking:
        launchCapabilities.includes('booking') ||
        launchContract.forcedNeeds.booking ||
        !!goalNeeds.needsBooking ||
        customerNeeds.includes("book_service"),
      sellsProducts:
        launchContract.forcedNeeds.products ||
        !!goalNeeds.sellsProducts ||
        customerNeeds.includes("buy_offer"),
      wantsLeadCapture:
        launchContract.forcedNeeds.leadCapture ||
        !!goalNeeds.wantsLeadCapture ||
        customerNeeds.includes("request_quote") ||
        customerNeeds.includes("fill_form"),
      templateId: input.template.id,
      themeId: input.theme.id,
      themePresetId: input.theme.id,
      themeTokens,
      primaryIntent: industryProfile?.primaryIntent,
      requestedPages,
      scaffoldMode: "selected-pages",
      nativePublishReady: launchContract.nativePublishCapable && Boolean(ownerEmail),
      ownerEmail: ownerEmail || undefined,
      publishMode:
        launchContract.nativePublishCapable && ownerEmail
          ? "native-first-party"
          : "manual-setup",
      wizardSeedId,
      businessId: plannedBusinessId,
    };

    return {
      user,
      ownerEmail,
      ids,
      confirmed,
      provision,
      generationCategory,
      industryOverlay,
      industryProfile,
      launchCapabilities,
      businessLaunchPlan,
      canonicalIntents,
      launchContract,
      seed,
      wizardSeedId,
      themeTokens,
      selections,
      requestedPages,
    };
  }, { timeoutMs: 30_000 });

  const design = generateDesignVariation(plan.seed);
  const blueprint = createBlueprintFromIndustry(
    plan.industryOverlay,
    brand,
    { email: plan.ownerEmail || undefined },
  );
  const compiledContract = compileContract(blueprint, { backendInstalled: false });
  const gateVerdicts = evaluateAllGates(compiledContract);
  const themedComposition = { ...composition, theme: plan.themeTokens };
  const designContract = buildTemplateLayoutContract(themedComposition, {
    seed: plan.seed,
    styleVariation: design,
    pageRole: "home",
  });

  const wizardSeedFile = {
    version: "2.0",
    id: plan.wizardSeedId,
    source: "launch-orchestrator",
    business: {
      name: brand,
      industry: plan.industryOverlay,
      parameters: plan.selections.businessParameters,
      primaryGoal: plan.selections.primaryGoal,
      systemType: input.systemId,
    },
    generation: {
      primaryGoal: plan.selections.primaryGoal,
      secondaryGoals: plan.selections.secondaryGoals,
      requestedPages: plan.requestedPages,
    },
    template: {
      id: input.template.id,
      label: input.template.label,
      sections: composition.sections.filter((section) => !section.hidden).map((section) => section.type),
    },
    theme: { presetId: input.theme.id, label: input.theme.label, tokens: plan.themeTokens },
    design: { seed: plan.seed, contractSignature: designContract.contractSignature },
    socials: Object.entries(input.socialLinks || {})
      .map(([platform, raw]) => {
        const value = (raw || "").trim();
        if (!value) return null;
        return { platform, href: /^https?:\/\//i.test(value) ? value : `https://${value}` };
      })
      .filter((entry): entry is { platform: string; href: string } => !!entry),
  };

  // ── Stage: contract (canonical planning, no page bodies) ──────────────────
  status("Planning your application…");
  const canonicalPlan = await run.stage("contract", async () => {
    const coverage = validateTwentyFirstGenerationCoverage({
      pages: plan.requestedPages.map(role => ({ role, sectionTypes: composition.sections.filter(section => !section.hidden).map(section => section.type) })),
      artDirectionPack: resolveArtDirectionPack({ sealedPackId: input.designSelection?.artDirectionPackId, industry: plan.industryOverlay, themePresetId: input.theme.id, seed: plan.seed }),
    });
    if (!coverage.ok) run.degrade('contract', 'coverage.21st-incomplete', summarizeCoverageReport(coverage));
    return buildCanonicalLaunchPlan(plan.selections, {
        "/.unison/wizard-seed.json": JSON.stringify(wizardSeedFile, null, 2),
        [TEMPLATE_DESIGN_CONTRACT_PATH]: JSON.stringify(designContract, null, 2),
    });
  }, { timeoutMs: 30_000 });

  const materializedPlayground = canonicalPlan.playground;
  const sitePlan = canonicalPlan.sitePlan;
  const pipelineValidations = canonicalPlan.validations;
  if (!sitePlan.pages.length) {
    throw new LaunchFatalError("The canonical plan returned no application pages.");
  }

  const bindingGuide = buildWizardBindingGuide(canonicalPlan.playground, {
    industry: plan.industryOverlay,
    enabledCapabilities: plan.launchCapabilities,
  });
  const designContext = compileResolvedSiteDesignContext({
    industry: plan.industryOverlay,
    roles: sitePlan.pages.map((page) => page.role),
    artDirectionPackId: canonicalPlan.artDirection.storagePackId as never,
    experience: input.designSelection?.experience,
    mode: input.designSelection?.mode,
    designSeed: plan.seed,
    businessModel: (SYSTEM_TO_BUSINESS_MODEL[input.systemId] || 'general') as never,
  });
  const appBuildContract = buildAppBuildContract({
    identity: {
      projectId: plan.ids.projectId,
      businessId: plan.ids.businessId,
      siteId: plan.ids.siteId,
      systemType: input.systemId,
    },
    sitePlan,
    pageRegistry: canonicalPlan.playground.pageRegistry,
    industry: plan.industryOverlay,
    businessName: brand,
    businessProfile: canonicalPlan.playground.creatorData.businessInfo,
    businessParameters: {
      ...plan.selections.businessParameters,
      ownerEmail: plan.ownerEmail || undefined,
      notificationEmail: canonicalPlan.playground.creatorData.businessInfo.notificationEmail,
      notificationPhone: canonicalPlan.playground.creatorData.businessInfo.notificationPhone,
      publicEmail: canonicalPlan.playground.creatorData.businessInfo.email,
      phone: canonicalPlan.playground.creatorData.businessInfo.phone,
      crmDestination: canonicalPlan.playground.creatorData.businessInfo.crmDestination,
      bookingOwner: canonicalPlan.playground.creatorData.businessInfo.bookingOwner,
      paymentProvider: canonicalPlan.playground.creatorData.businessInfo.paymentProvider,
      followUpChannel: canonicalPlan.playground.creatorData.businessInfo.followUpChannel,
    },
    canonicalBindings: Object.values(canonicalPlan.playground.bindings),
    registeredComponentInstances: Object.values(canonicalPlan.playground.creatorData.componentInstances),
    visionBrief: plan.selections.visionPrompt,
    goals: [plan.selections.primaryGoal, ...plan.selections.secondaryGoals],
    intents: plan.canonicalIntents,
    capabilities: plan.launchCapabilities,
    bindingGuide,
    seed: plan.seed,
    themePresetId: input.theme.id,
    themeTokens: plan.themeTokens,
    artDirection: canonicalPlan.artDirection,
    designContext,
    uiFoundation: canonicalPlan.uiFoundationContract,
    registryContext: canonicalPlan.registryContext,
    protectedPaths: WIZARD_LANE_B_PROTECTED_PATHS,
  });

  // ── Stage: app-build (one isolated, whole-site candidate) ─────────────────
  status("Designing your application…");
  const appBuild = await run.stage("app-build", async (signal) => {
    const result = await unisonAppBuilder.generate({
      operationId: `launch:${plan.ids.draftId}:app-build`,
      contract: appBuildContract,
      initialFiles: canonicalPlan.infrastructureFiles,
      entryPoint: '/src/App.tsx',
      baseRevisionId: null,
      signal,
      budgetMs: 280_000,
      onProgress: (event) => {
        if (event.phase === 'authoring') status(`Designing ${event.page.title}…`);
      },
    });
    if (result.candidate.status !== 'ready-for-commit' || result.stopReason !== 'complete') {
      const diagnostics = result.candidate.diagnostics.slice(0, 8).join(' ');
      throw new LaunchFatalError(
        `App Builder could not produce an acceptable application${diagnostics ? `: ${diagnostics}` : '.'}`,
      );
    }
    return result;
  }, { timeoutMs: 300_000 });
  const candidateFiles = { ...appBuild.candidateFiles };
  const siteBundleSnapshot = projectCanonicalLaunchCandidateSnapshot(
    canonicalPlan,
    plan.selections,
    candidateFiles,
  );

  const loadedBusinessProfile = input.existingBusinessId
    ? await loadBusinessProfile(input.existingBusinessId)
    : null;
  if (input.existingBusinessId && !loadedBusinessProfile) {
    throw new Error("Unable to load the selected Business Profile for this launch.");
  }
  const baseBusinessProfile: BusinessProfileDTO = loadedBusinessProfile || {
    businessId: plan.confirmed.businessId,
    ownerId: plan.user.id,
    name: brand,
    industry: plan.industryOverlay,
    email: plan.ownerEmail || null,
    notificationEmail: plan.ownerEmail || null,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    address: {},
    hours: [],
    socialLinks: {},
    settings: {},
  };
  const ownerParameters = plan.selections.businessParameters ?? {};
  const businessProfile: BusinessProfileDTO = {
    ...baseBusinessProfile,
    name: brand,
    industry: plan.industryOverlay,
    notificationEmail: ownerParameters.notificationEmail?.trim() || ownerParameters.ownerEmail?.trim() || baseBusinessProfile.notificationEmail || plan.ownerEmail || null,
    notificationPhone: ownerParameters.notificationPhone?.trim() || baseBusinessProfile.notificationPhone || null,
    email: ownerParameters.publicEmail?.trim() || baseBusinessProfile.email || null,
    phone: ownerParameters.phone?.trim() || baseBusinessProfile.phone || null,
    tagline: ownerParameters.tagline?.trim() || baseBusinessProfile.tagline || null,
    description: ownerParameters.description?.trim() || baseBusinessProfile.description || null,
    website: ownerParameters.website?.trim() || baseBusinessProfile.website || null,
    logoUrl: ownerParameters.logoUrl?.trim() || baseBusinessProfile.logoUrl || null,
    brandColor: ownerParameters.brandColor?.trim() || baseBusinessProfile.brandColor || null,
    timezone: ownerParameters.timezone?.trim() || baseBusinessProfile.timezone,
    address: { ...baseBusinessProfile.address, ...(ownerParameters.address ?? {}) },
    hours: ownerParameters.hours?.length ? ownerParameters.hours as BusinessProfileDTO['hours'] : baseBusinessProfile.hours,
    socialLinks: { ...baseBusinessProfile.socialLinks, ...(ownerParameters.socialLinks ?? {}) },
  };
  const canonicalPages = Object.values(siteBundleSnapshot.pageRegistry.pages)
    .filter((page): page is typeof page & { filePath: string } => Boolean(page.filePath))
    .map((page) => ({
      slug: page.path === '/' ? 'home' : page.path.replace(/^\//, ''),
      path: page.filePath,
      route: page.path,
      title: page.title,
      role: page.pageRole || page.pageType,
    }));
  const uiFoundation = JSON.parse(
    siteBundleSnapshot.vfsFiles['/.unison/ui-manifest.json'] || 'null',
  ) as Record<string, unknown> | null;
  const publicBusinessContext = buildPublicBusinessContext(businessProfile);
  const socialLinks = new Map<string, string>();
  for (const [platform, url] of Object.entries(publicBusinessContext.socialLinks)) {
    if (url) socialLinks.set(platform, url);
  }
  for (const { platform, href } of wizardSeedFile.socials) {
    socialLinks.set(platform, href);
  }
  const contextualWizardSeedFile = {
    ...wizardSeedFile,
    business: {
      ...publicBusinessContext,
      name: brand,
      industry: plan.industryOverlay,
      primaryGoal: plan.selections.primaryGoal,
      systemType: input.systemId,
    },
    canonical: {
      pages: canonicalPages,
      capabilities: plan.launchCapabilities,
      intents: plan.canonicalIntents,
      businessLaunchPlan: {
        version: plan.businessLaunchPlan.version,
        journeyId: plan.businessLaunchPlan.journeyId,
        canonicalIndustryId: plan.businessLaunchPlan.canonicalIndustryId,
        primaryGoal: plan.businessLaunchPlan.primaryGoal,
        customerNeeds: plan.businessLaunchPlan.customerNeeds,
        operationalCapabilities: plan.businessLaunchPlan.operationalCapabilities,
        businessCapabilities: plan.businessLaunchPlan.businessCapabilities,
      },
    },
    generation: {
      ...wizardSeedFile.generation,
      socials: [...socialLinks].map(([platform, url]) => ({ platform, url })),
    },
    uiFoundation,
    generationBrief: siteBundleSnapshot.meta.generationBrief,
    designIntervention: siteBundleSnapshot.meta.designIntervention,
    bindingGuide,
  };
  const plannedDataBindings = planSectionDataBindings(siteBundleSnapshot);
  const dataBindingsReady = plannedDataBindings.length === 0;
  const businessRuntime = buildBusinessRuntimeContract({
    businessId: plan.confirmed.businessId,
    projectId: plan.confirmed.projectId,
    siteId: plan.confirmed.siteId,
    locationId: null,
    requestedCapabilities: plan.businessLaunchPlan.businessCapabilities,
    profile: businessProfile,
    snapshotId: siteBundleSnapshot.snapshotId,
    expectedBindingCount: plannedDataBindings.length,
    bindingsReady: dataBindingsReady,
  });
  const nativeSetupSnapshot = buildNativePublishSetupSnapshot({
    enabled: plan.launchContract.nativePublishCapable,
    ownerEmail: plan.ownerEmail,
    businessName: brand,
    businessId: plan.confirmed.businessId,
    systemType: input.systemId,
  });
  const wizardAudit = auditWizardIntentGap({
    sitePlan,
    state: materializedPlayground,
    industryOverlay: plan.industryOverlay,
  });
  const nativeReadinessManifest = {
    ...buildNativePublishReadinessManifest({
      state: materializedPlayground,
      validations: pipelineValidations,
      setupSnapshot: nativeSetupSnapshot,
      enabled: plan.launchContract.nativePublishCapable,
      systemType: input.systemId,
      industryOverlay: plan.industryOverlay,
    }),
    wizardAudit,
  };
  const intentBindingsFile = buildIntentBindingsFile(materializedPlayground);
  const intentSurfacesFile = buildIntentSurfacesFile(materializedPlayground);

  // ── Stage: enrich ─────────────────────────────────────────────────────────
  // Launcher enrichment is deterministic compiler work. AI may consume this
  // context after launch, but it never authors or replaces Launcher page files.
  status("Finalizing your deterministic design…");
  run.markStage("enrich", "done");

  // ── Stage: preflight (merge + seal + strict import contract) ──────────────
  status("Running preview gates…");
  const artifacts = await run.stage("preflight", async (signal) => {
    const built = await buildCanonicalLaunchArtifactsAsync(
      {
        // App Builder's whole-site candidate is finalized once, then sealed as
        // the only source accepted by Preview, Builder and Publish.
        generatedFiles: candidateFiles,
        preferredEntryPoint: "/src/App.tsx",
        siteBundleSnapshot,
        compileArtifact: createWizardCompileArtifact(siteBundleSnapshot),
        compiledPlayground: null,
        canonicalPlayground: materializedPlayground,
        mergeWithCanonicalSnapshot: true,
        businessId: plan.selections.businessId,
        projectId: plan.ids.projectId,
        organizationId: plan.selections.businessId,
        siteId: plan.ids.siteId,
        systemType: input.systemId,
        systemName: system.name,
        templateName: `${brand} Site`,
        templateCategory: plan.generationCategory,
        templateId: input.template.id,
        businessName: brand,
        industry: plan.industryOverlay,
        aesthetic: input.theme.id,
        themePresetId: input.theme.id,
        backendRequired: false,
        wizardSelections: plan.selections,
        businessRuntime,
        enabledCapabilities: plan.launchCapabilities,
        approvedExperienceCapabilities: resolveApprovedExperienceCapabilities({
          webgl: canonicalPlan.designIntervention.envelope?.webgl,
          foundationCapabilities: canonicalPlan.uiFoundationContract.experienceCapabilities,
          requiredCapabilities: [
            ...resolveExperienceRequirement(
              Object.values(canonicalPlan.designIntervention.activeVariants),
            ).capabilities,
            ...canonicalPlan.uiFoundationContract.approvedExperienceCapabilities,
          ],
          reachesExperienceLayer:
            runExperiencePreflight(candidateFiles).manifest.totalInstances > 0,
        }),
        acceptedLaneBPagePaths: sitePlan.pages.map((page) => page.filePath),
        registeredPageBodyAuthority: 'app-builder',
        // Every registered body must be present in the App Builder candidate.
        // Missing pages are a real closure failure, never a fallback request.
        allowCanonicalPageFallback: false,
        strictPreflight: false,
      } as Parameters<typeof buildCanonicalLaunchArtifactsAsync>[0],
      { yieldToHost: yieldToBrowser, signal },
    );
    return built;
  }, { timeoutMs: 180_000 });

  const missingPages = artifacts.siteBundleSnapshot?.meta?.seal?.missingPageFiles || [];
  if (missingPages.length > 0) {
    run.degrade(
      "preflight",
      "preflight.sealed_pages_missing",
      `${missingPages.length} page(s) reached the sealed revision without a body.`,
      missingPages.join(", "),
    );
  }

  const plannedFormDefinitions = planLaunchFormDefinitions(artifacts.siteBundleSnapshot);
  const publishedRuntimeReadiness = evaluatePublishedRuntimeReadiness({
    runtime: JSON.parse(
      artifacts.files["/.unison/published-runtime.json"],
    ) as PublishedRuntimeConfig,
    bindingCount: plannedDataBindings.length,
    formDefinitionCount: plannedFormDefinitions.length,
  });
  if (!publishedRuntimeReadiness.ok) {
    run.degrade(
      "preflight",
      "preflight.publish_not_ready",
      "Publishing checks are incomplete; you can still edit and preview everything.",
      publishedRuntimeReadiness.blockers.join(" "),
    );
  }

  const integrityReport = runIntegrityReport(
    artifacts.siteBundleSnapshot,
    compiledContract,
    { compositions: [{ label: input.template.id, composition: themedComposition }] },
  );

  const vfsFiles: Record<string, string> = {
    ...artifacts.files,
    "/.unison/wizard-seed.json": JSON.stringify(contextualWizardSeedFile, null, 2),
    [TEMPLATE_DESIGN_CONTRACT_PATH]: JSON.stringify(designContract, null, 2),
    "/.unison/launch-readiness.json": JSON.stringify({
      ...nativeReadinessManifest,
      wizardAudit,
      launchContract: plan.launchContract,
      publishedRuntimeReadiness,
      generatedAt: new Date().toISOString(),
      previewReady: true,
    }, null, 2),
    "/.unison/native-publish-setup.json": JSON.stringify(nativeSetupSnapshot || null, null, 2),
    "/.unison/setup-snapshot.json": JSON.stringify(nativeSetupSnapshot || null, null, 2),
    "/.unison/intent-bindings.json": JSON.stringify(intentBindingsFile, null, 2),
    "/.unison/intent-surfaces.json": JSON.stringify(intentSurfacesFile, null, 2),
    "/.unison/gate-verdicts.json": JSON.stringify(gateVerdicts, null, 2),
    "/.unison/integrity-report.json": JSON.stringify(integrityReport, null, 2),
  };
  const draftClassification = classifyDraft(vfsFiles);
  vfsFiles["/.unison/draft-classification.json"] = JSON.stringify(
    draftClassification,
    null,
    2,
  );

  // ── Stage: commit ─────────────────────────────────────────────────────────
  status("Saving your site workspace…");
  if (callbacks.onReview && !await callbacks.onReview({ files: vfsFiles, entryPoint: artifacts.entryPoint })) {
    const error = new Error('Site preview discarded');
    error.name = 'LaunchReviewCancelled';
    throw error;
  }
  const commit: { confirmed: ConfirmedLaunchIds; result: CommitMutationResult } = await run.stage("commit", async () => {
    // Register the reviewed identity before writing its first revision.
    const confirmed: ConfirmedLaunchIds = callbacks.onReview ? await plan.provision() : plan.confirmed;
    if (Object.keys(plan.confirmed).some(key => confirmed[key as keyof ConfirmedLaunchIds] !== plan.confirmed[key as keyof ConfirmedLaunchIds])) throw new Error('Launch identity changed after review. Generate a fresh preview.');
    const persistedProfile = await saveSiteProfile(confirmed.businessId, confirmed.projectId, {
      name: businessProfile.name,
      industry: businessProfile.industry,
      notificationEmail: businessProfile.notificationEmail,
      notificationPhone: businessProfile.notificationPhone,
      email: businessProfile.email,
      phone: businessProfile.phone,
      tagline: businessProfile.tagline,
      description: businessProfile.description,
      website: businessProfile.website,
      logoUrl: businessProfile.logoUrl,
      brandColor: businessProfile.brandColor,
      timezone: businessProfile.timezone,
      address: businessProfile.address,
      hours: businessProfile.hours,
      socialLinks: businessProfile.socialLinks,
    });
    if (!persistedProfile) throw new Error('Owner information could not be saved for this site. Review the details and retry launch.');
    try { localStorage.setItem('unison:lastBusinessId', confirmed.businessId); } catch { /* Best effort. */ }
    const identity: BuilderIdentity = {
      userId: plan.user.id,
      businessId: confirmed.businessId,
      projectId: confirmed.projectId,
      draftId: confirmed.draftId,
      revisionId: "",
      sessionId: `web-builder:${confirmed.draftId}`,
    };
    const recovery: BuilderRecoverySnapshot = {
      version: 2,
      templateId: confirmed.draftId,
      code: vfsFiles[artifacts.entryPoint] || '',
      editorCode: vfsFiles[artifacts.entryPoint] || '',
      savedAt: new Date().toISOString(),
      vfsSignature: computeBuilderVfsSignature(vfsFiles),
      vfsFiles,
      reason: 'navigation_flush',
      pendingRemote: true,
    };
    // A failed first commit must not discard the reviewed App Builder source.
    // This browser journal is recovery only; it does not create a revision.
    writeBuilderRecoverySnapshot(recovery);
    const result = await commitMutation({
      source: "wizard-launch",
      identity,
      current: {
        vfsFiles: {},
        playground: materializedPlayground ?? undefined,
        activePagePath: artifacts.entryPoint,
      },
      patch: {
        ...legacyFilesToPatchPlan(vfsFiles),
        ...(demoOperationId ? { operationIds: [`account-demo:${demoOperationId}`] } : {}),
      },
      options: {
        requirePreviewPass: false,
        requireReadinessPass: false,
        compiledContract,
        businessName: brand,
        industry: plan.industryOverlay,
        selectedTemplateId: input.template.id,
        themePresetId: input.theme.id,
        selections: plan.selections,
        reviewedArtifact: {
          siteBundleSnapshot: artifacts.siteBundleSnapshot ?? siteBundleSnapshot,
          runtimeManifest: artifacts.runtimeManifest,
          playground: materializedPlayground ?? undefined,
        },
      },
    });
    if (!result.persistedRevisionId) {
      throw new Error("The generated site could not be saved to its project.");
    }
    if (!result.siteBundleSnapshot || !result.runtimeManifest) {
      throw new Error("The canonical commit returned an incomplete launch artifact.");
    }
    markBuilderRecoveryPersisted(recovery, confirmed.draftId, undefined, result.persistedRevisionId);
    return { confirmed, result };
  }, { timeoutMs: 120_000 });

  const bindingPersistenceReceipt = await autoEmitSectionBindings({
    businessId: commit.confirmed.businessId,
    projectId: commit.confirmed.projectId,
    snapshot: commit.result.siteBundleSnapshot ?? siteBundleSnapshot,
  });
  const persistedDataBindingsReady = bindingPersistenceReceipt.errors === 0
    && bindingPersistenceReceipt.emitted === plannedDataBindings.length;
  if (!persistedDataBindingsReady) {
    run.degrade(
      'commit',
      'commit.data_bindings_pending',
      'Catalog bindings are not fully installed yet; preview is available, but operational publishing remains blocked.',
      `Expected ${plannedDataBindings.length}, emitted ${bindingPersistenceReceipt.emitted}, errors ${bindingPersistenceReceipt.errors}.`,
    );
  }

  const requiredIntentBindingCount = countExpectedGeneratedBindingReceipts(appBuildContract.business.intentBindings);
  const intentBindingPersistenceReceipt = await persistGeneratedBindings({
    businessId: commit.confirmed.businessId,
    projectId: commit.confirmed.projectId,
    files: commit.result.vfsFiles,
  });
  const intentBindingsReady = intentBindingPersistenceReceipt.failed === 0
    && intentBindingPersistenceReceipt.persisted === intentBindingPersistenceReceipt.attempted
    && intentBindingPersistenceReceipt.persisted >= requiredIntentBindingCount;
  const finalBusinessRuntime = buildBusinessRuntimeContract({
    businessId: commit.confirmed.businessId,
    projectId: commit.confirmed.projectId,
    siteId: commit.confirmed.siteId,
    locationId: null,
    requestedCapabilities: plan.businessLaunchPlan.businessCapabilities,
    profile: businessProfile,
    snapshotId: siteBundleSnapshot.snapshotId,
    expectedBindingCount: plannedDataBindings.length,
    bindingsReady: persistedDataBindingsReady && intentBindingsReady,
  });
  const bindingReadinessReceipt = {
    catalog: {
      expected: plannedDataBindings.length,
      attempted: bindingPersistenceReceipt.emitted + bindingPersistenceReceipt.errors,
      persisted: bindingPersistenceReceipt.emitted,
      errors: bindingPersistenceReceipt.errors,
      ready: persistedDataBindingsReady,
    },
    intents: {
      expected: requiredIntentBindingCount,
      attempted: intentBindingPersistenceReceipt.attempted,
      persisted: intentBindingPersistenceReceipt.persisted,
      errors: intentBindingPersistenceReceipt.failed,
      ready: intentBindingsReady,
    },
  };
  if (!intentBindingsReady) {
    run.degrade(
      'commit',
      'commit.intent_bindings_pending',
      'The site is saved for preview, but operational actions remain blocked until intent bindings are verified.',
      `Expected ${requiredIntentBindingCount}, attempted ${intentBindingPersistenceReceipt.attempted}, persisted ${intentBindingPersistenceReceipt.persisted}, errors ${intentBindingPersistenceReceipt.failed}.`,
    );
  }

  try {
    const formDefinitionPersistence = await persistLaunchFormDefinitions({
      businessId: commit.confirmed.businessId,
      projectId: commit.confirmed.projectId,
      siteId: commit.confirmed.siteId,
      definitions: plannedFormDefinitions,
    });
    if (formDefinitionPersistence.error) {
      run.degrade(
        "commit",
        "commit.form_definitions_unavailable",
        "Your form settings will finish saving in the builder.",
        formDefinitionPersistence.error,
      );
    }
  } catch (error) {
    run.degrade(
      "commit",
      "commit.form_definitions_unavailable",
      "Your form settings will finish saving in the builder.",
      error instanceof Error ? error.message : String(error),
    );
  }

  try {
    const { seedLaunchAssets } = await import("@/services/resources/seedLaunchAssets");
    await seedLaunchAssets({
      businessId: commit.confirmed.businessId,
      projectId: commit.confirmed.projectId,
      industry: plan.industryProfile?.industry || plan.generationCategory,
      enableProductCommerce: plan.selections.sellsProducts,
      creatorData: (commit.result.playground ?? materializedPlayground)?.creatorData ?? null,
      mediaAssets: appBuildContract.design.registryContext.assets,
    });
  } catch (error) {
    run.degrade(
      "commit",
      "commit.assets_unavailable",
      "Your products and business details will finish saving in the builder.",
      error instanceof Error ? error.message : String(error),
    );
  }

  // ── Stage: handoff ────────────────────────────────────────────────────────
  // The App Builder generated the complete application in app-build BEFORE the
  // initial commit; revision 1 is final and no page rewrites occur after it.
  status("Opening the builder…");
  const handoff = await run.stage("handoff", async () => {
    const committed = commit.result;
    if (!committed.siteBundleSnapshot) {
      throw new Error("The committed launch is missing its site bundle snapshot.");
    }
    const committedPlayground = committed.playground ?? materializedPlayground;
    const committedVfsNodes: VirtualNode[] = vfsFilesToVirtualNodes(committed.vfsFiles);
    livePageTopology.setRegistry(committed.siteBundleSnapshot.pageRegistry);
    livePreviewRuntime.hydrateFromRegistry(committed.siteBundleSnapshot.pageRegistry);
    livePlaygroundSync.hydrateFromVFS(committedVfsNodes, committed.vfsFiles);
    const launchState = createLaunchState({
      systemType: input.systemId,
      systemName: system.name,
      businessName: brand,
      templateName: `${brand} Site`,
      templateCategory: plan.generationCategory as never,
      vfsFiles: committed.vfsFiles,
      aesthetic: input.theme.id,
      themePresetId: input.theme.id,
      templateId: input.template.id,
      preloadedIntents: plan.canonicalIntents,
      startInPreview: true,
      intentRuntime: true,
      businessId: commit.confirmed.businessId,
      projectId: commit.confirmed.projectId,
      industry: plan.industryOverlay,
      runtimeManifest: committed.runtimeManifest,
      entryPoint: committed.runtimeManifest.entryPoint,
      sitePlan,
      siteBundleSnapshot: committed.siteBundleSnapshot,
      materializedPlayground: committedPlayground,
      compiledPlayground: null,
      pipelineManifest: committed.runtimeManifest,
      wizardSelections: plan.selections,
      wizardSeed: contextualWizardSeedFile,
      draftId: commit.confirmed.draftId,
      revisionId: committed.persistedRevisionId,
    } as Parameters<typeof createLaunchState>[0]);

    const routeState: Record<string, unknown> = {
      ...launchState,
      fromLauncher: true,
      businessId: commit.confirmed.businessId,
      projectId: commit.confirmed.projectId,
      siteId: commit.confirmed.siteId,
      draftId: commit.confirmed.draftId,
      revisionId: committed.persistedRevisionId,
      entryPoint: committed.runtimeManifest.entryPoint,
      templateId: input.template.id,
      themePresetId: input.theme.id,
      preloadedIntents: plan.canonicalIntents,
      launchContract: plan.launchContract,
      businessRuntime: finalBusinessRuntime,
      bindingReadinessReceipt,
      vfsFiles: committed.vfsFiles,
      siteBundleSnapshot: committed.siteBundleSnapshot,
      runtimeManifest: committed.runtimeManifest,
      canonicalPlayground: committedPlayground,
      materializedPlayground: committedPlayground,
      _compiledContract: compiledContract,
      _previewGateVerdict: gateVerdicts.preview,
      _publishGateVerdict: gateVerdicts.publish,
      _draftClassification: draftClassification,
    };

    const navigationState = buildLauncherNavigationState(routeState);
    persistLauncherHandoff({ routeState, launchState });

    try {
      await supabase.from("onboarding_state").upsert(
        {
          user_id: plan.user.id,
          completed: true,
          current_step: "launched",
          industry: input.systemId,
          business_name: brand,
          project_id: commit.confirmed.projectId,
        },
        { onConflict: "user_id" },
      );
    } catch (error) {
      console.warn("[launchOrchestrator] onboarding completion not recorded", error);
    }

    return { launchState, routeState, navigationState };
  }, { timeoutMs: 30_000 });

  publishLaunchDegradations(run.snapshot().degradations);

  return {
    launchState: handoff.launchState,
    routeState: handoff.routeState,
    navigationState: handoff.navigationState,
    projectId: commit.confirmed.projectId,
    draftId: commit.confirmed.draftId,
    revisionId: commit.result.persistedRevisionId!,
    snapshot: run.snapshot(),
  };
}
