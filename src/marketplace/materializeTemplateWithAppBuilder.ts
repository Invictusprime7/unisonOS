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
import { readSealedArtDirection } from '@/sections/variants/resolvedArtDirection';
import { installationFailureMessage } from './installationFailure';

const PAGE_ROLES = new Set<string>(['home', 'about', 'services', 'contact', 'pricing', 'gallery', 'faq', 'booking', 'checkout', 'thank_you', 'blog', 'shop', 'immersive', 'custom']);
function templatePageRole(role: string): PageRole {
  if (role === 'service') return 'services';
  if (role === 'thankyou') return 'thank_you';
  return PAGE_ROLES.has(role) ? role as PageRole : 'custom';
}

function authoredDesignLock(files: Readonly<Record<string, string>>): string {
  const source = files['/src/marketplace/template.ts'];
  const prefix = 'export default ';
  if (!source?.startsWith(prefix)) return '';

  try {
    const template = JSON.parse(source.slice(prefix.length).replace(/;\s*$/, '')) as {
      name?: string;
      category?: string;
      pages?: Array<{
        id?: string;
        path?: string;
        title?: string;
        sections?: Array<{ id?: string; type?: string; variantId?: string; props?: Record<string, unknown> }>;
      }>;
    };
    const pages = (template.pages ?? []).map(page => ({
      id: page.id,
      path: page.path,
      title: page.title,
      sections: (page.sections ?? []).map(section => {
        const props = section.props ?? {};
        const copy = Object.fromEntries(Object.entries(props)
          .filter(([key, value]) => /^(eyebrow|headline|title|description|subtitle|label|layout|alignment)$/.test(key)
            && typeof value === 'string'));
        const imageSlots = Object.keys(props).filter(key => /image|avatar|src|before|after/i.test(key));
        return { id: section.id, type: section.type, variantId: section.variantId, copy, imageSlots };
      }),
    }));
    return [
      `MARKETPLACE TEMPLATE DESIGN LOCK: ${template.name ?? 'Selected template'} (${template.category ?? 'unclassified'}). Treat this authored blueprint as immutable, not inspiration. Preserve page order, section order, section variants, layout, copy, and each image slot. Do not replace this design with industry-default content or imagery; only adapt preview-only interactions to the buyer's canonical bindings.`,
      JSON.stringify(pages),
    ].join('\n');
  } catch {
    return '';
  }
}

export interface MarketplaceTemplateMaterial {
  files: Record<string, string>;
  siteBundleSnapshot: SiteBundleSnapshot;
  entryPoint: string;
  templateIntents?: string[];
  mediaAssets?: Array<{ id: string; kind: string; url: string }>;
}

export interface MaterializeOptions {
  signal?: AbortSignal;
  onPage?: (event: { title: string; index: number; total: number; phase: string }) => void;
}

/** Candidate-only bridge. The installer remains responsible for one durable acceptance. */
export async function materializeTemplateWithAppBuilder(material: MarketplaceTemplateMaterial, ids: ConfirmedLaunchIds, options: MaterializeOptions = {}) {
  const snapshot = material.siteBundleSnapshot;
  const packId = readSealedArtDirection(snapshot.meta)?.storagePackId;
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
    visionBrief: 'Install the selected marketplace template faithfully. The supplied authored source is the design authority, not inspiration. Preserve every page, section order, layout, variant, authored copy, image assignment, geometric rhythm and slot-intent identity. Do not substitute industry-default content or imagery. Converge preview-only interactions with the canonical runtime; do not invent a different site or copy seller service authorizations.',
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
  // Budget covers one fresh-invocation retry per page when the provider times
  // out (transient latency), on top of the normal per-page authoring windows.
  const result = await unisonAppBuilder.generate({
    operationId: `marketplace-install:${ids.draftId}:app-build`, contract, initialFiles, entryPoint: '/src/App.tsx', baseRevisionId: null, budgetMs: 430_000,
    reuseAcceptedPages: false, signal: options.signal,
    onProgress: event => options.onPage?.({ title: event.page.title, index: event.index, total: event.total, phase: event.phase }),
    pageCheck: (path, source, files) => {
      const reference = collectLocalImportClosure({ ...initialFiles, ...files, [path]: source }, path)
        .find(imported => imported.startsWith('/src/marketplace/'));
      return reference ? [`Materialize this page as standalone source using canonical design-source modules; remove its dependency on preview-only ${reference}.`] : [];
    },
    runtimeContext: [
      authoredDesignLock(initialFiles),
      'MARKETPLACE INSTALLATION: Author real standalone pages and shared site components, not wrappers around Preview, MarketplaceRegisteredSection, or selectedPreview. The /src/marketplace sources are reference-only; installed page import closures must not depend on them. Preserve their content, imagery and sealed design while adapting to the canonical design-source modules and buyer runtime. Use registered Resource Runtime reads and data-ut-resource marks for editable records, not static catalog arrays. Never use seller resource IDs or service authorizations. Do not edit canonical App.tsx or protected infrastructure.',
      `BUYER STARTER CONTENT (saved after acceptance): ${starterSummary(plan.playground.creatorData)}`,
    ].join('\n').slice(0, 3500),
  });
  if (options.signal?.aborted) throw new Error(String(options.signal.reason ?? 'Installation was stopped before the draft was built.'));
  if (result.candidate.status !== 'ready-for-commit' || result.stopReason !== 'complete') {
    throw new Error(installationFailureMessage(result));
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
    // Same workspace identity as fresh launch: without it the saved draft cannot open in the Builder.
    preferredEntryPoint: '/src/App.tsx', organizationId: ids.businessId, businessId: ids.businessId, projectId: ids.projectId, siteId: ids.siteId,
    mergeWithCanonicalSnapshot: true, allowCanonicalPageFallback: false, preservePageSources: true, strictPreflight: true,
    themePresetId: plan.themePresetId, businessName: snapshot.businessName, industry: snapshot.industry });
}
function starterSummary(data: SiteBundleSnapshot['creatorData']) {
  const names = (rows: Record<string, { name?: string; question?: string; title?: string }> | undefined) =>
    Object.values(rows ?? {}).map(row => row.name ?? row.question ?? row.title).filter(Boolean).slice(0, 12).join('; ');
  return [`products: ${names(data?.products)}`, `services: ${names(data?.services)}`, `team: ${names(data?.team)}`,
    `faqs: ${Object.keys(data?.faqs ?? {}).length}`, `gallery: ${Object.keys(data?.gallery ?? {}).length}`].join(' | ').slice(0, 1800);
}
