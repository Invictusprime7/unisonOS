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
}

/** Candidate-only bridge. The installer remains responsible for one durable acceptance. */
export async function materializeTemplateWithAppBuilder(material: MarketplaceTemplateMaterial, ids: ConfirmedLaunchIds) {
  const snapshot = material.siteBundleSnapshot;
  const packId = snapshot.meta.artDirectionPackId;
  if (!snapshot.themeTokens || !packId) throw new Error('This template is missing its saved design contract.');
  const selections: WizardSelections = {
    businessName: snapshot.businessName, businessModel: 'general', industryOverlay: snapshot.industry as WizardSelections['industryOverlay'],
    systemType: snapshot.meta.systemId ?? 'agency', primaryGoal: 'lead_capture', secondaryGoals: [],
    templateId: snapshot.meta.templateId ?? undefined, themePresetId: String(snapshot.meta.themePresetId),
    themeTokens: snapshot.themeTokens, requestedPages: ['home'], scaffoldMode: 'selected-pages',
    designSelection: createWizardDesignSelection({ artDirectionPackId: packId as never }),
  };
  const plan = buildCanonicalLaunchPlan(selections);
  plan.playground.pageRegistry = snapshot.pageRegistry;
  plan.sitePlan.pages = Object.values(snapshot.pageRegistry.pages).map(page => ({
    id: page.pageId, name: page.pageId, title: page.title, route: page.path, role: templatePageRole(page.pageRole ?? page.pageType),
    filePath: page.filePath ?? '', isHome: page.isHome, visibleInNav: true, generatedBy: 'wizard' as const,
  }));
  if (plan.sitePlan.pages.some(page => !page.filePath)) throw new Error('The template has an incomplete page source registry.');
  plan.sitePlan.homePageId = snapshot.pageRegistry.homePageId ?? plan.sitePlan.pages.find(page => page.isHome)?.id ?? 'home';
  const seed = snapshot.meta.generationSeed ?? plan.designIntervention.seed;
  const contract = buildAppBuildContract({
    identity: { projectId: ids.projectId, businessId: ids.businessId, siteId: ids.siteId, systemType: selections.systemType ?? 'agency' },
    sitePlan: plan.sitePlan, pageRegistry: snapshot.pageRegistry, industry: snapshot.industry, businessName: snapshot.businessName,
    visionBrief: 'Install the selected marketplace template faithfully. Preserve all preview pages, text, imagery, section compositions, geometric rhythm and slot-intent identities. Converge the supplied React source with the canonical runtime; do not invent a different site or copy seller service authorizations.',
    goals: [], intents: [], capabilities: [], bindingGuide: '', seed, themePresetId: plan.themePresetId,
    themeTokens: snapshot.themeTokens, artDirection: snapshot.meta.artDirection ?? plan.artDirection,
    designContext: compileResolvedSiteDesignContext({ industry: snapshot.industry, roles: plan.sitePlan.pages.map(page => page.role), artDirectionPackId: packId as never, designSeed: seed, businessModel: 'general' }),
    uiFoundation: plan.uiFoundationContract, registryContext: snapshot.meta.registryContext ?? plan.registryContext,
    protectedPaths: WIZARD_LANE_B_PROTECTED_PATHS,
  });
  const sourceFiles = await materializePreviewImages(material.files);
  const initialFiles = { ...plan.infrastructureFiles, ...sourceFiles,
    '/src/App.tsx': generateCanonicalRouter(snapshot.pageRegistry, snapshot.businessName) };
  const result = await unisonAppBuilder.generate({
    operationId: `marketplace-install:${ids.draftId}:app-build`, contract, initialFiles, entryPoint: '/src/App.tsx', baseRevisionId: null, budgetMs: 280_000,
    runtimeContext: 'MARKETPLACE INSTALLATION: The supplied page bodies and their import closure are the selected preview material, not generic examples. Materialize every selected page faithfully. Retain available media and legal component implementations. Do not edit canonical App.tsx, protected infrastructure or the sealed Art Direction. Business connections must belong to the buyer.',
  });
  if (result.candidate.status !== 'ready-for-commit' || result.stopReason !== 'complete') {
    throw new Error(`App Builder could not prepare this template: ${result.candidate.diagnostics.slice(0, 6).join(' ') || result.stopReason}`);
  }
  const files = { ...result.candidateFiles };
  const acceptedSnapshot = projectCanonicalLaunchCandidateSnapshot(plan, selections, files);
  return buildCanonicalLaunchArtifacts({ generatedFiles: files, siteBundleSnapshot: acceptedSnapshot, canonicalPlayground: plan.playground,
    preferredEntryPoint: '/src/App.tsx', businessId: ids.businessId, projectId: ids.projectId, siteId: ids.siteId,
    mergeWithCanonicalSnapshot: true, allowCanonicalPageFallback: false, preservePageSources: true, strictPreflight: true,
    themePresetId: plan.themePresetId, businessName: snapshot.businessName, industry: snapshot.industry });
}