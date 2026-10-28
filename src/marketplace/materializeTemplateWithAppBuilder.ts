import { unisonAppBuilder } from '@/services/app-builder/UnisonAppBuilder';
import { buildAppBuildContract } from '@/services/app-builder/appBuilderContracts';
import { compileResolvedSiteDesignContext } from '@/services/launch/resolvedSiteDesignContext';
import { buildCanonicalLaunchPlan, projectCanonicalLaunchCandidateSnapshot } from '@/services/launch/canonicalLaunchPlan';
import { WIZARD_LANE_B_PROTECTED_PATHS } from '@/services/wizardLaneBEnrichment';
import { buildCanonicalLaunchArtifactsAsync } from '@/services/canonicalLaunchVfs';
import { generateCanonicalRouter } from '@/utils/topologyRouterGenerator';
import { createWizardDesignSelection } from '@/services/wizardDesignSelection';
import type { SiteBundleSnapshot } from '@/platform/core/canonicalPipeline';
import type { ConfirmedLaunchIds } from '@/services/confirmedLaunchProvisioner';
import type { PlaygroundBinding, WizardSelections } from '@/types/playground';
import type { PageRole } from '@/platform/core/siteTopologyPlanner';
import { materializePreviewImages } from './materializePreviewImages';
import { getIntentDef, resolveIntentName } from '@/platform/core/intentSurfaceRegistry';
import { collectResolvedCompositions } from '@/platform/core/resolvedComposition';
import { ART_DIRECTION_PACKS } from '@/sections/variants';
import { buildWizardBindingGuide } from '@/services/wizardBindingBridge';
import type { MarketplaceTemplateBinding } from './marketplaceTemplatePrimitives';
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
  portableBindings?: readonly MarketplaceTemplateBinding[];
  mediaAssets?: Array<{ id: string; kind: string; url: string }>;
}

export interface MaterializeOptions {
  signal?: AbortSignal;
  onStatus?: (label: string) => void;
  onPage?: (event: { title: string; index: number; total: number; phase: string }) => void;
}

function playgroundIntentFor(coreIntent: string): PlaygroundBinding['intent'] {
  if (coreIntent === 'nav.external') return 'external.open';
  if (coreIntent.startsWith('nav.')) return 'nav.goto_page';
  if (coreIntent.startsWith('cart.') || coreIntent === 'pay.checkout') return 'checkout.start';
  if (coreIntent.startsWith('booking.')) return 'calendar.open';
  return 'form.open';
}

function resolveTemplateSourcePages(
  binding: MarketplaceTemplateBinding,
  plan: ReturnType<typeof buildCanonicalLaunchPlan>,
): string[] {
  const pages = Object.values(plan.playground.pageRegistry.pages);
  if (binding.sourcePageId && plan.playground.pageRegistry.pages[binding.sourcePageId]) return [binding.sourcePageId];
  if (binding.sourceSection === 'navbar') return pages.map((page) => page.pageId);
  const matchingPage = pages.find((page) => page.pageId === binding.sourceSection
    || (page.pageRole ?? page.pageType) === binding.sourceSection);
  return [matchingPage?.pageId ?? plan.playground.pageRegistry.homePageId ?? pages.find((page) => page.isHome)?.pageId ?? 'home'];
}

function projectPortableBindings(
  bindings: readonly MarketplaceTemplateBinding[],
  plan: ReturnType<typeof buildCanonicalLaunchPlan>,
): Record<string, PlaygroundBinding> {
  const projected = { ...plan.playground.bindings };
  const registry = plan.playground.pageRegistry;
  const buyerBindings = Object.values(plan.playground.bindings);
  const forms = Object.values(plan.playground.creatorData.forms ?? {});

  for (const binding of bindings) {
    const intent = resolveIntentName(binding.intent);
    const definition = intent ? getIntentDef(intent) : null;
    if (!definition || definition.status !== 'stable' || definition.triggerType !== 'user-action') continue;
    for (const pageId of resolveTemplateSourcePages(binding, plan)) {
      const sourcePage = registry.pages[pageId];
      if (!sourcePage) continue;
      const targetPage = binding.targetPageId ? registry.pages[binding.targetPageId] : undefined;
      const canonical = buyerBindings.find((candidate) => candidate.coreIntent === intent);
      let targetType: PlaygroundBinding['targetType'];
      let targetId: string;
      if (intent.startsWith('nav.') && targetPage) {
        targetType = 'page';
        targetId = targetPage.pageId;
      } else if (intent.startsWith('nav.')) {
        targetType = 'url';
        targetId = binding.targetSectionId ? `#${binding.targetSectionId}` : sourcePage.path;
      } else if (intent === 'cart.add') {
        const product = Object.values(plan.playground.creatorData.products ?? {})
          .find((candidate) => candidate.status !== 'archived'
            && (!binding.product?.name || candidate.name.toLowerCase() === binding.product.name.toLowerCase()));
        if (!product) continue;
        targetType = 'product';
        targetId = product.productId;
      } else if (intent === 'cart.view') {
        targetType = 'url';
        targetId = '#cart';
      } else if (canonical) {
        targetType = canonical.targetType;
        targetId = canonical.targetId;
      } else if (definition.requiredCapabilities?.includes('booking')) {
        const calendar = Object.values(plan.playground.calendars)[0];
        if (!calendar) continue;
        targetType = 'calendar';
        targetId = calendar.calendarId;
      } else {
        const formPurpose = intent.includes('booking') ? 'booking'
          : intent.includes('newsletter') ? 'newsletter'
            : intent.includes('quote') || intent.includes('contact') ? 'contact'
              : undefined;
        const form = forms.find((candidate) => candidate.submitIntentId === intent)
          ?? (formPurpose ? forms.find((candidate) => candidate.name.toLowerCase().includes(formPurpose)) : undefined)
          ?? forms[0];
        if (!form) continue;
        targetType = 'form';
        targetId = form.formId;
      }

      const bindingId = `marketplace:${binding.id}:${pageId}`;
      projected[bindingId] = {
        ...(canonical ?? {}),
        bindingId,
        sourcePageId: pageId,
        sourceLabel: binding.label,
        intent: playgroundIntentFor(intent),
        targetId,
        targetType,
        confidence: 1,
        source: 'manual',
        isValid: true,
        elementKey: `${pageId}.${binding.sourceSection}.${binding.sourceSlot}`,
        sourceSection: binding.sourceSection as PlaygroundBinding['sourceSection'],
        sourceSlot: binding.sourceSlot as PlaygroundBinding['sourceSlot'],
        coreIntent: intent,
        requiredCapabilities: [...(definition.requiredCapabilities ?? [])],
        payloadTemplate: canonical?.payloadTemplate,
        readiness: 'preview-ready',
      };
    }
  }
  const navDefinition = getIntentDef('nav.goto');
  if (navDefinition) {
    for (const sourcePage of Object.values(registry.pages)) {
      for (const targetPage of Object.values(registry.pages)) {
        const bindingId = `marketplace:route:${sourcePage.pageId}:${targetPage.pageId}`;
        projected[bindingId] = {
          bindingId,
          sourcePageId: sourcePage.pageId,
          sourceLabel: targetPage.title,
          intent: 'nav.goto_page',
          targetId: targetPage.pageId,
          targetType: 'page',
          confidence: 1,
          source: 'manual',
          isValid: true,
          elementKey: `${sourcePage.pageId}.navbar.route-${targetPage.pageId}-link`,
          sourceSection: 'navbar',
          sourceSlot: `route-${targetPage.pageId}-link` as PlaygroundBinding['sourceSlot'],
          coreIntent: navDefinition.name,
          requiredCapabilities: [...(navDefinition.requiredCapabilities ?? [])],
          readiness: 'preview-ready',
        };
      }
    }
  }
  return projected;
}

function portableBindingsFor(material: MarketplaceTemplateMaterial): MarketplaceTemplateBinding[] {
  if (material.portableBindings?.length) return [...material.portableBindings];
  return Object.values(material.siteBundleSnapshot.bindings ?? {}).flatMap((binding) => {
    if (!binding.sourceSection || !binding.sourceSlot) return [];
    const intent = resolveIntentName(binding.coreIntent ?? binding.intent);
    if (!intent) return [];
    const product = binding.targetType === 'product'
      ? material.siteBundleSnapshot.creatorData.products?.[binding.targetId]
      : undefined;
    return [{
      id: binding.bindingId,
      intent,
      label: binding.sourceLabel || binding.sourceSlot,
      sourceSection: binding.sourceSection,
      sourceSlot: binding.sourceSlot,
      sourcePageId: binding.sourcePageId,
      ...(product ? { product: { productId: product.productId, name: product.name, price: product.price, quantity: 1 } } : {}),
      targetPageId: binding.targetType === 'page'
        ? binding.targetId
        : undefined,
      targetSectionId: binding.targetType === 'url' && binding.targetId.startsWith('#')
        ? binding.targetId.slice(1)
        : undefined,
    }];
  });
}

function templatePinnedImplementationsByPage(
  material: MarketplaceTemplateMaterial,
  plan: ReturnType<typeof buildCanonicalLaunchPlan>,
  artDirectionPackId: string,
): Record<string, string[]> {
  const pinned = new Map<string, Set<string>>();
  const pages = Object.values(material.siteBundleSnapshot.pageRegistry.pages);
  const add = (pageId: string | undefined, variantId: string | undefined) => {
    if (!pageId || !variantId || !material.siteBundleSnapshot.pageRegistry.pages[pageId]) return;
    const variants = pinned.get(pageId) ?? new Set<string>();
    variants.add(variantId);
    pinned.set(pageId, variants);
  };
  const templateSource = material.files['/src/marketplace/template.ts'];
  if (templateSource?.startsWith('export default ')) {
    try {
      const template = JSON.parse(templateSource.slice('export default '.length).replace(/;\s*$/, '')) as {
        pages?: Array<{ id?: string; sections?: Array<{ variantId?: string }> }>;
      };
      for (const page of template.pages ?? []) {
        for (const section of page.sections ?? []) add(page.id, section.variantId);
      }
    } catch { /* Invalid reference metadata is ignored; the candidate gate remains authoritative. */ }
  }
  for (const composition of Object.values(collectResolvedCompositions(material.files))) {
    const page = pages.find((candidate) => candidate.filePath === composition.pageFilePath);
    for (const section of composition.sections) add(page?.pageId, section.variantId);
  }
  const sharedChromeIds = new Set(['site:navbar', 'site:footer']);
  const pack = ART_DIRECTION_PACKS[artDirectionPackId as keyof typeof ART_DIRECTION_PACKS];
  for (const page of pages) {
    for (const variantId of pack?.navbarFamily ?? []) add(page.pageId, variantId);
  }
  for (const [sectionId, variantId] of Object.entries(plan.designIntervention.activeVariants)) {
    if (!sharedChromeIds.has(sectionId)) continue;
    for (const page of pages) add(page.pageId, variantId);
  }
  return Object.fromEntries([...pinned].map(([pageId, variants]) => [pageId, [...variants].sort()]));
}

/** Candidate-only bridge. The installer remains responsible for one durable acceptance. */
export async function materializeTemplateWithAppBuilder(material: MarketplaceTemplateMaterial, ids: ConfirmedLaunchIds, options: MaterializeOptions = {}) {
  options.onStatus?.('Preparing template design and bindings');
  const snapshot = material.siteBundleSnapshot;
  const packId = readSealedArtDirection(snapshot.meta)?.storagePackId;
  if (!snapshot.themeTokens || !packId) throw new Error('This template is missing its saved design contract.');
  const portableBindings = portableBindingsFor(material);
  const intents = [...new Set([
    ...(material.templateIntents ?? []),
    ...portableBindings.map((binding) => binding.intent),
    ...Object.values(snapshot.bindings ?? {}).flatMap(binding => binding.coreIntent ? [binding.coreIntent] : []),
  ])];
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
  const registryContext = {
    ...(snapshot.meta.registryContext ?? plan.registryContext),
    pinnedImplementationIdsByPage: templatePinnedImplementationsByPage(material, plan, packId),
  };
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
  if (portableBindings.length) {
    plan.playground.bindings = projectPortableBindings(portableBindings, plan);
  }
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
    uiFoundation: plan.uiFoundationContract, registryContext,
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
    onStatus: options.onStatus,
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
  options.onStatus?.('Embedding template images');
  const files = await materializePreviewImages(result.candidateFiles, { signal: options.signal });
  for (const page of plan.sitePlan.pages) {
    const reference = collectLocalImportClosure(files, page.filePath).find(path => path.startsWith('/src/marketplace/'));
    if (reference) throw new Error(`App Builder did not materialize ${page.title}: it still depends on preview material (${reference}).`);
  }
  const acceptedSnapshot = projectCanonicalLaunchCandidateSnapshot(plan, selections, files);
  acceptedSnapshot.meta = { ...acceptedSnapshot.meta, generationSeed: seed,
    artDirection: snapshot.meta.artDirection ?? plan.artDirection, artDirectionPackId: packId };
  options.onStatus?.('Building canonical preview and runtime');
  return buildCanonicalLaunchArtifactsAsync({ generatedFiles: files, siteBundleSnapshot: acceptedSnapshot, canonicalPlayground: plan.playground,
    // Same workspace identity as fresh launch: without it the saved draft cannot open in the Builder.
    preferredEntryPoint: '/src/App.tsx', organizationId: ids.businessId, businessId: ids.businessId, projectId: ids.projectId, siteId: ids.siteId,
    mergeWithCanonicalSnapshot: true, allowCanonicalPageFallback: false, preservePageSources: true, strictPreflight: true,
    themePresetId: plan.themePresetId, businessName: snapshot.businessName, industry: snapshot.industry }, {
      yieldToHost: () => new Promise<void>((resolve) => setTimeout(resolve, 0)),
      signal: options.signal,
    });
}
function starterSummary(data: SiteBundleSnapshot['creatorData']) {
  const names = (rows: Record<string, { name?: string; question?: string; title?: string }> | undefined) =>
    Object.values(rows ?? {}).map(row => row.name ?? row.question ?? row.title).filter(Boolean).slice(0, 12).join('; ');
  return [`products: ${names(data?.products)}`, `services: ${names(data?.services)}`, `team: ${names(data?.team)}`,
    `faqs: ${Object.keys(data?.faqs ?? {}).length}`, `gallery: ${Object.keys(data?.gallery ?? {}).length}`].join(' | ').slice(0, 1800);
}
