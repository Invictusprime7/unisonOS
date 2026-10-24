import { unisonAppBuilder } from '@/services/app-builder/UnisonAppBuilder';
import { buildAppBuildContract } from '@/services/app-builder/appBuilderContracts';
import { compileResolvedSiteDesignContext } from '@/services/launch/resolvedSiteDesignContext';
import { buildCanonicalLaunchPlan, projectCanonicalLaunchCandidateSnapshot } from '@/services/launch/canonicalLaunchPlan';
import { WIZARD_LANE_B_PROTECTED_PATHS } from '@/services/wizardLaneBEnrichment';
import { buildCanonicalLaunchArtifacts } from '@/services/canonicalLaunchVfs';
import { generateCanonicalRouter } from '@/utils/topologyRouterGenerator';
import { createWizardDesignSelection } from '@/services/wizardDesignSelection';
import type { SiteBundleSnapshot } from '@/platform/core/canonicalPipeline';
import type { ConfirmedLaunchIds } from '@/services/confirmedLaunchProvisioner';
import type { WizardSelections } from '@/types/playground';
import type { PageRole } from '@/platform/core/siteTopologyPlanner';
import { materializePreviewImages } from './materializePreviewImages';
import { getIntentDef } from '@/platform/core/intentSurfaceRegistry';
import { buildWizardBindingGuide } from '@/services/wizardBindingBridge';
import { collectLocalImportClosure } from '@/services/laneBCompanionModules';

const PAGE_ROLES = new Set<string>(['home', 'about', 'services', 'contact', 'pricing', 'gallery', 'faq', 'booking', 'checkout', 'thank_you', 'blog', 'shop', 'immersive', 'custom']);
function templatePageRole(role: string): PageRole {
  if (role === 'service') return 'services';
  if (role === 'thankyou') return 'thank_you';
  return PAGE_ROLES.has(role) ? role as PageRole : 'custom';
}

export interface MarketplaceTemplateMaterial {
  files: Record<string, string>;
  siteBundleSnapshot: SiteBundleSnapshot;
  entryPoint: string;
  templateIntents?: string[];
  mediaAssets?: Array<{ id: string; kind: string; url: string }>;
}

/** Candidate-only bridge. The installer remains responsible for one durable acceptance. */
export async function materializeTemplateWithAppBuilder(material: MarketplaceTemplateMaterial, ids: ConfirmedLaunchIds) {
  const snapshot = material.siteBundleSnapshot;
  const packId = snapshot.meta.artDirectionPackId;
  if (!snapshot.themeTokens || !packId) throw new Error('This template is missing its saved design contract.');
  const intents = [...new Set([...(material.templateIntents ?? []), ...Object.values(snapshot.bindings ?? {}).flatMap(binding => binding.coreIntent ? [binding.coreIntent] : [])])];
  const capabilities = [...new Set(intents.flatMap(intent => getIntentDef(intent)?.requiredCapabilities ?? []))];
  const selections: WizardSelections = {
    businessName: snapshot.businessName, businessModel: 'general', industryOverlay: snapshot.industry as WizardSelections['industryOverlay'],
    systemType: snapshot.meta.systemId ?? 'agency', primaryGoal: 'lead_capture', secondaryGoals: [],
    templateId: snapshot.meta.templateId ?? undefined, themePresetId: String(snapshot.meta.themePresetId),
    themeTokens: snapshot.themeTokens, requestedPages: ['home'], scaffoldMode: 'selected-pages',
    designSelection: createWizardDesignSelection({ artDirectionPackId: packId as never }),
    businessId: ids.businessId, sellsProducts: capabilities.includes('commerce'), needsBooking: capabilities.includes('booking'),
    wantsLeadCapture: capabilities.includes('lead-capture'),
  };
  const plan = buildCanonicalLaunchPlan(selections);
  plan.playground.pageRegistry = snapshot.pageRegistry;
  plan.sitePlan.pages = Object.values(snapshot.pageRegistry.pages).map(page => ({
    id: page.pageId, name: page.pageId, title: page.title, route: page.path, role: templatePageRole(page.pageRole ?? page.pageType),
    filePath: page.filePath ?? '', isHome: page.isHome, visibleInNav: true, generatedBy: 'wizard' as const,
  }));
  if (plan.sitePlan.pages.some(page => !page.filePath)) throw new Error('The template has an incomplete page source registry.');
  plan.sitePlan.homePageId = snapshot.pageRegistry.homePageId ?? plan.sitePlan.pages.find(page => page.isHome)?.id ?? 'home';
  // Retain public starter content but allocate forms/components from the buyer's plan.
  plan.playground.creatorData = { ...snapshot.creatorData,
    forms: plan.playground.creatorData.forms, overlays: plan.playground.creatorData.overlays,
    // Buyers have not given an owner email, CRM or booking owner yet; these stay
    // stubbed until they finish setup, exactly like an unconfigured fresh launch.
    componentInstances: Object.fromEntries(Object.entries(plan.playground.creatorData.componentInstances)
      .map(([id, instance]) => [id, { ...instance, status: 'stubbed' as const }])),
    businessInfo: { businessName: snapshot.businessName },
  };
  // The selected registry replaces the planner's routes; discard bindings to routes not installed.
  plan.playground.bindings = Object.fromEntries(Object.entries(plan.playground.bindings)
    .filter(([, binding]) => Boolean(snapshot.pageRegistry.pages[binding.sourcePageId])));
  const bindingGuide = buildWizardBindingGuide(plan.playground, { industry: snapshot.industry, enabledCapabilities: capabilities });
  const seed = snapshot.meta.generationSeed ?? plan.designIntervention.seed;
  const contract = buildAppBuildContract({
    identity: { projectId: ids.projectId, businessId: ids.businessId, siteId: ids.siteId, systemType: selections.systemType ?? 'agency' },
    sitePlan: plan.sitePlan, pageRegistry: snapshot.pageRegistry, industry: snapshot.industry, businessName: snapshot.businessName,
    visionBrief: 'Install the selected marketplace template faithfully. Preserve all preview pages, text, imagery, section compositions, geometric rhythm and slot-intent identities. Converge the supplied React source with the canonical runtime; do not invent a different site or copy seller service authorizations.',
    goals: [selections.primaryGoal], intents, capabilities, bindingGuide, seed, themePresetId: plan.themePresetId,
    canonicalBindings: Object.values(plan.playground.bindings), registeredComponentInstances: Object.values(plan.playground.creatorData.componentInstances),
    businessProfile: plan.playground.creatorData.businessInfo,
    themeTokens: snapshot.themeTokens, artDirection: snapshot.meta.artDirection ?? plan.artDirection,
    designContext: compileResolvedSiteDesignContext({ industry: snapshot.industry, roles: plan.sitePlan.pages.map(page => page.role), artDirectionPackId: packId as never, designSeed: seed, businessModel: 'general' }),
    uiFoundation: plan.uiFoundationContract, registryContext: snapshot.meta.registryContext ?? plan.registryContext,
    protectedPaths: WIZARD_LANE_B_PROTECTED_PATHS,
  });
  // Images are embedded after acceptance: data URLs exceed the per-file request limit.
  const initialFiles = { ...plan.infrastructureFiles, ...material.files,
    '/src/App.tsx': generateCanonicalRouter(snapshot.pageRegistry, snapshot.businessName) };
  const result = await unisonAppBuilder.generate({
    operationId: `marketplace-install:${ids.draftId}:app-build`, contract, initialFiles, entryPoint: '/src/App.tsx', baseRevisionId: null, budgetMs: 280_000,
    reuseAcceptedPages: false,
    pageCheck: (path, source, files) => {
      const reference = collectLocalImportClosure({ ...initialFiles, ...files, [path]: source }, path)
        .find(imported => imported.startsWith('/src/marketplace/'));
      return reference ? [`Materialize this page as standalone source using canonical design-source modules; remove its dependency on preview-only ${reference}.`] : [];
    },
    runtimeContext: [
      'MARKETPLACE INSTALLATION: Author real standalone pages and shared site components, not wrappers around Preview, MarketplaceRegisteredSection, or selectedPreview. The /src/marketplace sources are reference-only; installed page import closures must not depend on them. Preserve their content, imagery and sealed design while adapting to the canonical design-source modules and buyer runtime. Use registered Resource Runtime reads and data-ut-resource marks for editable records, not static catalog arrays. Never use seller resource IDs or service authorizations. Do not edit canonical App.tsx or protected infrastructure.',
      `BUYER STARTER CONTENT (saved after acceptance): ${starterSummary(plan.playground.creatorData)}`,
    ].join('\n').slice(0, 3500),
  });
  if (result.candidate.status !== 'ready-for-commit' || result.stopReason !== 'complete') {
    throw new Error(`App Builder could not prepare this template: ${result.candidate.diagnostics.slice(0, 6).join(' ') || result.stopReason}`);
  }
  const files = await materializePreviewImages(result.candidateFiles);
  for (const page of plan.sitePlan.pages) {
    const reference = collectLocalImportClosure(files, page.filePath).find(path => path.startsWith('/src/marketplace/'));
    if (reference) throw new Error(`App Builder did not materialize ${page.title}: it still depends on preview material (${reference}).`);
  }
  const acceptedSnapshot = projectCanonicalLaunchCandidateSnapshot(plan, selections, files);
  acceptedSnapshot.meta = { ...acceptedSnapshot.meta, generationSeed: seed,
    artDirection: snapshot.meta.artDirection ?? plan.artDirection, artDirectionPackId: packId };
  return buildCanonicalLaunchArtifacts({ generatedFiles: files, siteBundleSnapshot: acceptedSnapshot, canonicalPlayground: plan.playground,
    preferredEntryPoint: '/src/App.tsx', businessId: ids.businessId, projectId: ids.projectId, siteId: ids.siteId,
    mergeWithCanonicalSnapshot: true, allowCanonicalPageFallback: false, preservePageSources: true, strictPreflight: true,
    themePresetId: plan.themePresetId, businessName: snapshot.businessName, industry: snapshot.industry });
}
function starterSummary(data: SiteBundleSnapshot['creatorData']) {
  const names = (rows: Record<string, { name?: string; question?: string; title?: string }> | undefined) =>
    Object.values(rows ?? {}).map(row => row.name ?? row.question ?? row.title).filter(Boolean).slice(0, 12).join('; ');
  return [`products: ${names(data?.products)}`, `services: ${names(data?.services)}`, `team: ${names(data?.team)}`,
    `faqs: ${Object.keys(data?.faqs ?? {}).length}`, `gallery: ${Object.keys(data?.gallery ?? {}).length}`].join(' | ').slice(0, 1800);
}
