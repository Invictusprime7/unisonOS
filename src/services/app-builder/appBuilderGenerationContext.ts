/** Single per-job derivation of everything a page turn may know, taken only from the sealed contract. */

import type { AppBuildContract } from '@/services/app-builder/appBuilderContracts';
import { resolveDesignSourceBundle, isGenericImplementationId } from './design/designSystemResolver';
import type { DesignSourceBundle } from './design/DesignSourceBundle';
import { materializeDesignSources, type DesignSourceMaterialization } from './design/designSourceMaterializer';
import { getAllIndustries, getIndustryProfile } from '@/platform/core/industryMatrix';
import { listCatalogSurfaces } from '@/platform/core/catalogSurfaceRegistry';
import { listResources, type ContentTypeRow } from '@/services/resources/resourceRegistry';
import { listTopologyPageRoleAliases } from '@/platform/core/siteTopologyPlanner';
import { collectResolvedCompositions } from '@/platform/core/resolvedComposition';
import { COMPOSER_CONTEXT_LIMIT, packContextBlocks } from './contextBudget';

/** Home references stay compact so later pages keep room for their own design vocabulary. */
export const HOME_OBJECT_CONTEXT_LIMIT = 2_500;

/** Read-only Home object references; source data stays in its canonical composition sidecar. */
export function renderHomeObjectContext(contract: AppBuildContract, files: Readonly<Record<string, string>>, homePageId: string): string {
  const home = contract.topology.sitePlan.pages.find(page => page.id === homePageId);
  if (!home) return '';
  const composition = collectResolvedCompositions({ ...files })[home.filePath];
  if (!composition || composition.compiledBy !== 'app-builder') return '';
  const bindings = contract.business.intentBindings.filter(binding => binding.pageId === homePageId);
  const objects = composition.sections.map(section => ({
    sectionId: section.sectionId, family: section.semanticType, variantId: section.variantId,
    sourcePath: section.sourcePath, sourceModulePath: section.sourceModulePath,
    dataFields: Object.keys(section.data ?? {}),
  }));
  const full = {
    pageId: homePageId, pageFilePath: home.filePath, objects,
    bindings: bindings.map(binding => ({
      bindingId: binding.bindingId, sourceSection: binding.sourceSection, sourceSlot: binding.sourceSlot,
      coreIntent: binding.coreIntent, domIntent: binding.domIntent, targetType: binding.targetType,
      targetId: binding.targetId, componentInstanceId: binding.componentInstanceId,
      requiredCapabilities: binding.requiredCapabilities, missingCapabilities: binding.missingCapabilities,
      businessFieldBindings: binding.businessFieldBindings,
    })),
    enabledCapabilities: contract.business.capabilities,
  };
  let payload = JSON.stringify(full);
  if (payload.length > HOME_OBJECT_CONTEXT_LIMIT) {
    // Identities only; the sidecar remains the authority for full object data.
    payload = JSON.stringify({
      pageId: homePageId, pageFilePath: home.filePath,
      objects: objects.map(({ sectionId, family, variantId }) => ({ sectionId, family, variantId })),
      bindings: bindings.map(({ bindingId, coreIntent, componentInstanceId }) => ({ bindingId, coreIntent, componentInstanceId })),
      enabledCapabilities: contract.business.capabilities,
    });
  }
  return [
    'HOME OBJECT CONTRACT (read-only canonical reference; not new authorization):',
    payload,
    'Read the supplied Home composition sidecar for established content and object data. Preserve shared resource, component, field and intent identities. Reuse these contracts only where this page has its own canonical binding; never copy Home binding IDs onto other pages or invent capabilities. Keep the current page role and sealed composition, and choose different listed variants than Home where the plan allows. Pending business setup does not authorize a success claim.',
  ].join('\n');
}

export interface AppBuilderGenerationContext {
  contract: AppBuildContract;
  designSources: DesignSourceBundle;
  materialization: DesignSourceMaterialization;
  runtimeContext: string;
  /** Same facts with design-source modules trimmed to what one page may use, packed into `budget` chars. */
  runtimeContextForPage: (pageId: string, budget?: number) => string;
}

export interface IndustrySeedDataTarget {
  target: string;
  catalogSurface?: string;
  /** Registered resource that owns records for this seed key. */
  resourceKey?: string;
  /** CreatorData path the seed data is read from. */
  creatorDataPath?: string;
}

export const INDUSTRY_SEED_DATA_TARGETS: Record<string, IndustrySeedDataTarget> = {
  business_name: { target: 'BusinessProfile.name and CreatorData.businessInfo.businessName', resourceKey: 'business-profile', creatorDataPath: 'businessInfo.businessName' },
  business_email: { target: 'BusinessProfile.email and CreatorData.businessInfo.email', resourceKey: 'business-profile', creatorDataPath: 'businessInfo.email' },
  features: { target: 'authored feature sections, not a product catalog' },
  pricing_tiers: { target: 'catalog.pricing / pricing_plans', catalogSurface: 'pricing', resourceKey: 'pricing', creatorDataPath: 'products (catalogSurface: pricing)' },
  services: { target: 'catalog.services / services', catalogSurface: 'services', resourceKey: 'services', creatorDataPath: 'services' },
  operating_hours: { target: 'BusinessProfile.hours and CreatorData.businessInfo.hours', resourceKey: 'business-profile', creatorDataPath: 'businessInfo.hours' },
  menu_items: { target: 'catalog.menu / menu_items', catalogSurface: 'menu', resourceKey: 'menu', creatorDataPath: 'products (catalogSurface: menu)' },
  service_areas: { target: 'owner-provided service-area content; do not invent coverage zones' },
  programs: { target: 'catalog.services / services when represented as bookable programs', catalogSurface: 'services', resourceKey: 'services', creatorDataPath: 'services' },
  credentials: { target: 'owner-supplied CreatorData.team and about-page content; never invent qualifications', resourceKey: 'content:team', creatorDataPath: 'team' },
  specialties: { target: 'catalog.services categories and owner-supplied page content', catalogSurface: 'services', resourceKey: 'services', creatorDataPath: 'services.category' },
  products: { target: 'catalog.products / products', catalogSurface: 'products', resourceKey: 'products', creatorDataPath: 'products (catalogSurface: products)' },
  shipping_info: { target: 'owner-supplied shipping policy content; do not invent shipping rules or APIs' },
  portfolio_items: { target: 'CMS gallery content from CreatorData.gallery', resourceKey: 'content:gallery', creatorDataPath: 'gallery' },
  mission_statement: { target: 'BusinessProfile.description and CreatorData.businessInfo.description', resourceKey: 'business-profile', creatorDataPath: 'businessInfo.description' },
  case_studies: { target: 'CMS case-studies content from CreatorData.caseStudies', resourceKey: 'content:case-studies', creatorDataPath: 'caseStudies' },
};

export function getIndustrySeedDataTargets(industry: string): Array<{
  key: string;
  target: IndustrySeedDataTarget;
}> {
  return getIndustryProfile(industry)?.seedDataKeys.map((key) => ({
    key,
    target: INDUSTRY_SEED_DATA_TARGETS[key] ?? {
      target: 'authored industry content; do not invent a catalog, table, or backend surface',
    },
  })) ?? [];
}

export function getUnmappedIndustrySeedDataKeys(): string[] {
  return [...new Set(getAllIndustries().flatMap((profile) => profile.seedDataKeys))]
    .filter((key) => !INDUSTRY_SEED_DATA_TARGETS[key]);
}

export function buildIndustryAuthoringContext(industry: string, enabledCapabilities: readonly string[]): string {
  const profile = getIndustryProfile(industry);
  if (!profile) {
    return `INDUSTRY AUTHORING CONTRACT: preserve the selected business identity "${industry}". Treat focused owner requests as additive and do not reclassify the business from a page-level feature request.`;
  }

  const seedTargets = getIndustrySeedDataTargets(industry);
  const industryCatalogs = [...new Set(seedTargets
    .map(({ key }) => INDUSTRY_SEED_DATA_TARGETS[key]?.catalogSurface)
    .filter((surface): surface is string => !!surface))];
  return [
    `INDUSTRY AUTHORING CONTRACT: canonical industry ${profile.industry} (${profile.name}). Keep this business identity even when the owner requests a focused feature.`,
    `Industry seed data targets:\n${seedTargets.map(({ key, target }) => `- ${key} → ${target.target}${target.resourceKey ? `; resource ${target.resourceKey}` : ''}${target.creatorDataPath ? `; CreatorData.${target.creatorDataPath}` : ''}`).join('\n')}`,
    `Industry catalog targets: ${industryCatalogs.join(', ') || 'none'}. Launch capabilities: ${enabledCapabilities.join(', ') || 'none'}.`,
    'Use owner-provided facts for prices, credentials, service areas, mission, and shipping terms; do not fabricate them. A focused user intent is additive to the selected industry: implement it with enabled capabilities and matching industry data; do not change the business category or invent unprovisioned tables, APIs, or controllers.',
  ].join('\n');
}

export function buildIndustryIconContext(
  industry: string,
  enabledCapabilities: readonly string[],
  intents: readonly string[],
  selectedSurfaces: readonly string[] = [],
): string {
  const catalogSurfaces = listCatalogSurfaces();
  const registeredSurfaces = new Set(catalogSurfaces.map((surface) => surface.surfaceId));
  const industrySurfaces = new Set(getIndustrySeedDataTargets(industry)
    .map(({ target }) => target.catalogSurface)
    .filter((surface): surface is string => !!surface && registeredSurfaces.has(surface)));
  for (const surface of catalogSurfaces) {
    if (selectedSurfaces.some((key) => key === surface.surfaceId || surface.aliases.includes(key))
      || enabledCapabilities.includes(`catalog.${surface.surfaceId}`)) industrySurfaces.add(surface.surfaceId);
  }
  const seedDataKeys = new Set(getIndustryProfile(industry)?.seedDataKeys ?? []);
  const purchaseRequested = intents.some((intent) => intent === 'cart.add' || intent === 'cart.checkout');
  // Focused commerce may render a products projection, but eligibility is not
  // evidence that a payable record has been created.
  if (enabledCapabilities.includes('commerce') && purchaseRequested) industrySurfaces.add('products');
  const searchableSurfaces = catalogSurfaces.filter((surface) => industrySurfaces.has(surface.surfaceId))
    .map((surface) => surface.surfaceId);
  const cartableSurfaces = catalogSurfaces.filter((surface) => industrySurfaces.has(surface.surfaceId)
    && surface.supportedIntents.includes('cart.add') && Boolean(surface.fields.price || surface.fields.priceCents))
    .map((surface) => surface.surfaceId);
  const cartEnabled = enabledCapabilities.includes('commerce') && purchaseRequested && cartableSurfaces.length > 0;
  const affordances = [
    seedDataKeys.has('menu_items') ? 'menu -> Utensils' : '',
    seedDataKeys.has('products') ? 'products -> Package' : '',
    seedDataKeys.has('pricing_tiers') ? 'pricing -> BadgeDollarSign' : '',
    seedDataKeys.has('services') && enabledCapabilities.includes('booking') ? 'services -> CalendarDays' : '',
    seedDataKeys.has('portfolio_items') ? 'portfolio content -> Images' : '',
    seedDataKeys.has('service_areas') ? 'owner-provided service areas -> MapPin' : '',
  ].filter(Boolean);

  return [
    'CANONICAL ICON CONTEXT: derive interactive icons from this contract, registered content surfaces, and content actually rendered on the page; industry identity alone does not authorize an action.',
    `Content surfaces: ${[...industrySurfaces].sort().join(', ') || 'none declared'}.`,
    `Search: ${searchableSurfaces.length ? `Search is eligible for rendered, non-empty searchable content on ${searchableSurfaces.join(', ')}; omit the control on pages without such content.` : 'no searchable catalog surface is declared; omit search unless the page has another real searchable collection.'}`,
    `Cart: ${cartEnabled ? `ShoppingBag or ShoppingCart may represent cart actions for ${cartableSurfaces.join(', ')}; bind only to the requested cart intent and enabled commerce capability, and only with persisted product IDs.` : 'omit shopping bag/cart actions: commerce requires both an enabled commerce capability and an explicit cart.add or cart.checkout intent with a cartable registered surface.'}`,
    `Industry content affordances: ${affordances.join(', ') || 'none from the industry seed profile'}. Use only when the matching content is rendered; icons never imply an unprovisioned API, route, or capability.`,
    'Use only icon exports available through approved project dependencies, and give icon-only controls an accessible name.',
  ].join('\n');
}

/**
 * Registered content resources a generation turn may reference. When rows are
 * provided (even empty), only those job-scoped CMS types are projected — the
 * global registry never leaks another project's types into a scoped turn.
    'CANONICAL ICON CONTEXT: derive interactive icons from this contract, registered content surfaces, and content actually rendered on the page; industry identity alone does not authorize an action.',
    `Search: ${searchableSurfaces.length ? `Search is eligible for rendered, non-empty searchable content on ${searchableSurfaces.join(', ')}; omit the control on pages without such content.` : 'no searchable catalog surface is declared; omit search unless the page has another real searchable collection.'}`,
    `Cart: ${cartEnabled ? `ShoppingBag or ShoppingCart may represent cart actions for ${cartableSurfaces.join(', ')}; bind only to the requested cart intent and enabled commerce capability.` : 'omit shopping bag/cart actions: commerce requires both an enabled commerce capability and an explicit cart.add or cart.checkout intent with a cartable registered surface.'}`,
    'Cart payloads use persisted product IDs from the explicit products checkout projection, never service IDs, plan IDs, offer IDs or authored fixture slugs; omit cart controls until that projection exists, and verify payment availability separately. Keep booking programs on services and subscription tiers on pricing.',
    `Industry content affordances: ${affordances.join(', ') || 'none from the industry seed profile'}. Use only when the matching content is rendered; icons never imply an unprovisioned API, route, or capability.`,
    'Use only icon exports available through approved project dependencies, and give icon-only controls an accessible name.',
  ].join('\n');
}

/** Read contract only: registered schemas do not authorize creation or payment. */
export function buildRegisteredResourceContext(contentTypes: readonly ContentTypeRow[] = []): string {
  return [
    'REGISTERED RESOURCE CONTRACT: read and edit through agentOperations / ResourceRuntime with the current project and business scope; bind data-ut-resource to the returned persisted record ID and editable field. Labels and fixture slugs are not database IDs.',
    ...listResources(contentTypes).map((resource) => `- ${resource.key} → ${resource.storage.table ?? `CMS ${resource.storage.contentType}`} (${resource.cardinality}); fields: ${resource.schema.map((field) => `${field.key}:${field.type}`).join(', ')}.`),
    'CMS seed targets are planned, not installed: create their declared content types through the existing CMS command only when supplied content exists, then use returned type/entry IDs. Features, coverage, credentials and shipping copy never imply a new catalog or API.',
  ].join('\n');
}

export function buildAppBuilderGenerationContext(contract: AppBuildContract, contentTypes: readonly ContentTypeRow[] = []): AppBuilderGenerationContext {
  const { business, runtime } = contract;
  const designSources = resolveDesignSourceBundle(contract);
  const materialization = materializeDesignSources(designSources);
  const industryContext = buildIndustryAuthoringContext(business.industry, business.capabilities);
  const iconContext = buildIndustryIconContext(business.industry, business.capabilities, business.intents,
    contract.design.compositionPlan.pages.flatMap((page) => page.target.sectionOrder));
  const logoContext = [
    `CANONICAL LOGO CONTRACT: brand mark source ${business.branding.brandMark.source.kind}.${business.branding.brandMark.source.field}; render only in ${business.branding.brandMark.placements.map(({ slotId }) => slotId).join(', ')} using the registered business-profile binding, never a hard-coded URL.`,
    `Preserve the logo's intrinsic ratio with object-fit: contain within ${business.branding.brandMark.image.maxWidthPx}x${business.branding.brandMark.image.maxHeightPx}px; use accessible name "${business.branding.brandMark.accessibleName}". If the profile has no logo, render the text wordmark "${business.branding.brandMark.missingAssetFallback.text}"; do not generate or source a replacement mark.`,
    `Logo cloud is separate social proof: use ${business.branding.logoCloud.artifactId} only with owner-authored entries, at least ${business.branding.logoCloud.minimumItems}; generated entries are forbidden and the empty behavior is ${business.branding.logoCloud.emptyBehavior}.`,
  ].join('\n');
  const bindingsForPage = (pageId?: string) => pageId
    ? business.intentBindings.filter((binding) => binding.pageId === pageId)
    : business.intentBindings;
  const componentsForPage = (pageId?: string) => {
    if (!pageId) return business.registeredComponents;
    const bindingComponentIds = new Set(bindingsForPage(pageId)
      .map((binding) => binding.componentInstanceId)
      .filter((instanceId): instanceId is string => Boolean(instanceId)));
    return business.registeredComponents.filter((component) =>
      component.runtime.usedOnPages.length === 0
      || component.runtime.usedOnPages.includes(pageId)
      || bindingComponentIds.has(component.runtime.instanceId));
  };
  const registeredComponentContext = (pageId?: string) => {
    const components = componentsForPage(pageId);
    return `REGISTERED COMPONENT CONTRACT: ${components.length ? components.map((component) => `${component.runtime.componentSlug} (instance ${component.runtime.instanceId}; pages ${component.runtime.usedOnPages.join(', ') || 'site-wide'}; target ${component.targetType}; status ${component.runtime.status}; write intent ${component.runtime.writeIntent ?? 'none'}; required bindings ${component.requiredBindingKeys.join(', ') || 'none'}; required native form fields ${component.requiredNativeFormFields?.join(', ') || 'none'}; bindings ${JSON.stringify(component.bindings)})`).join('\n') : 'no canonical functional components are provisioned for this page.'}`;
  };
  // Keep identity concise, not generic: source-owned projection supplies fields.
  const registeredComponentTemplates = (pageId?: string) => {
    const templates = componentsForPage(pageId).filter(component => component.nativeComponentTemplate);
    return templates.length ? [
      'REGISTERED COMPONENT BLUEPRINTS: preserve these canonical native hosts, field names, and intent markers exactly; they define behavior, while certified design-source modules define presentation.',
      ...templates.map(component => `${component.runtime.componentSlug}:\n${component.nativeComponentTemplate}`),
    ].join('\n') : '';
  };
  const registeredComponentBlueprints = (pageId?: string) => {
    const hosts = componentsForPage(pageId).filter(component => component.runtime.writeIntent && ['form', 'calendar'].includes(component.targetType));
    if (!hosts.length) return 'FORMS: this page hosts no registered form. Do not add forms; certified Contact variants already render their own form, so only use a Contact section where the plan requires it.';
    return [
      'FORM PLACEMENT (one form per purpose, inside <main>, before the shared footer):',
      ...hosts.map(component => `- ${component.runtime.componentSlug}: if the page renders a Contact family section, that section's built-in form IS the registered form — put data-ut-component-slug="${component.runtime.componentSlug}" on that contact <section> wrapper, pass submitIntent "${component.runtime.writeIntent}" and the selected fields in its props, and add no other form. Otherwise compose exactly one host data-ut-component-slug="${component.runtime.componentSlug}" with native <form data-intent-form="${component.runtime.writeIntent}"> inside its planned body section. No local onSubmit success handler.`),
      'Never place a form after the footer and never render a second form for the same purpose.',
    ].join('\n');
  };
  const canonicalIntentBindings = (pageId?: string) => {
    const bindings = bindingsForPage(pageId);
    return [
      `${pageId ? 'PAGE ' : ''}CANONICAL INTENT BINDINGS: ${bindings.length ? bindings.map((binding) => `${binding.bindingId}: page ${binding.pageId} ${binding.route} ${binding.sourceSection}.${binding.sourceSlot} -> core intent ${binding.coreIntent}, DOM intent ${binding.domIntent}, required marker ${binding.ctaMarkers.map((marker) => `data-ut-cta="${marker}"`).join(' or ') || 'none'}, handler ${binding.intentHandler}, target ${binding.targetType}:${binding.targetId}${binding.componentSlug ? `, registered ${binding.componentSlug} instance ${binding.componentInstanceId} (write intent ${binding.componentWriteIntent ?? 'none'})` : ''}${binding.missingCapabilities.length ? `, INACTIVE missing capabilities ${binding.missingCapabilities.join(', ')}; omit this interaction` : ''}`).join('\n') : 'none.'}`,
      'Use these supplied IDs only; do not invent binding, target, or component-instance IDs. The platform stamps the canonical intent and component-instance ID after candidate validation from the exact CTA marker and registered component slug.',
      ...bindings.filter((binding) => binding.businessFieldBindings?.length).map((binding) => `${binding.bindingId} business field bindings: ${JSON.stringify(binding.businessFieldBindings)}. Resolve these from the canonical scoped business profile; never copy private destinations or business answers into visitor form values.`),
    ].join('\n');
  };
  const businessParameterContext = [
    `PUBLIC BUSINESS FACTS: use only these public contact and brand values ${JSON.stringify(business.parameters)} and public profile projection ${JSON.stringify(business.businessProfile)}. Private notification recipients, payment routing, and CRM destinations are intentionally excluded and are resolved by the tenant-scoped runtime.`,
    `CONFIGURATION READINESS: these business fields are configured: ${business.configuredBusinessFields.join(', ') || 'none'}. The field names are readiness metadata only; do not infer or emit their values.`,
    'For operational interactions, render only the exact registered component and intent handler assigned by the contract. Tenant-scoped server handlers resolve private CRM destinations and notification recipients; never place those values in generated markup or client source. Do not invent component IDs, alternate intent handlers, direct database writes, or local success handlers.',
  ].join('\n');
  const interactiveSurfaceContract = [
    'FORM AND CHAT AUTHORING CONTRACT:',
    'Use @/unison/ui/form-fields controls and @/unison/ui/button actions for form UI. Every field needs a visible label and semantic theme tokens.',
    'Registered 21st.dev-derived designs may only be used through certified @/unison/design-sources modules listed for this page; never import raw 21st.dev components, invent variants, or add unregistered dependencies.',
    'Only emit form actions and data-ut-intent values covered by the registered intents and exact Wizard CTA markers in this contract. A design component does not authorize a new action or intent.',
    'A contact, quote, newsletter, or lead-capture form does not imply a floating chat widget. Add chat only when the owner explicitly requests it, and only wire it to an intent registered in this contract.',
  ].join('\n');
  const checkoutRequiresPaymentSetup = business.registeredComponents.some((component) =>
    component.runtime.componentSlug === 'checkout-cta'
    && !business.configuredBusinessFields.includes('paymentProvider'),
  );
  const commerceSetupContext = checkoutRequiresPaymentSetup
    ? [
        'PAYMENT SETUP IS A PUBLISH READINESS ITEM, NOT A SITE-AUTHORING FAILURE.',
        'Complete every selected commerce page and preserve the registered checkout CTA and pay.checkout intent. Do not invent provider credentials or claim transactions are enabled until payment setup is complete.',
      ].join('\n')
    : '';
  const pageIdentityContext = (pageId: string): string => {
    const page = contract.topology.sitePlan.pages.find((candidate) => candidate.id === pageId);
    if (!page) return '';
    const roleAliases = listTopologyPageRoleAliases(page.role);
    return [
      `CANONICAL PAGE NODE: persist page ID "${page.id}"; route "${page.route}" and role aliases ${roleAliases.join(', ') || page.role} resolve to this same node.`,
      `For each certified root section, use section ID stable across copy/layout edits; emit data-ut-entity-id="section:${page.id}:<sectionId>", data-ut-page-id="${page.id}", and data-ut-page-path="${page.route}". Never use titles, array indexes, or source offsets as persisted IDs.`,
    ].join('\n');
  };
  // Priority 1 blocks carry the design vocabulary and placement rules and are never dropped.
  const compose = (modules: string, pageId?: string, budget = COMPOSER_CONTEXT_LIMIT) => packContextBlocks([
    { priority: 1, text: !pageId && business.bindingGuide ? `WIZARD BINDING MARKERS (HARD CANDIDATE ACCEPTANCE REQUIREMENTS):\n${business.bindingGuide}` : '' },
    { priority: 1, text: pageId ? pageIdentityContext(pageId) : '' },
    { priority: 1, text: 'AI ENRICHMENT: author business-specific copy, complete object collections, purposeful media and working interactions through the registered contracts. The deterministic starter is not an AI response: do not retain baseline filler, generic field substitutions or empty sections. Preserve every planned section, including repeated families, in the planned order. CTA sections need specific, business-worded headlines and actions, never generic "Get started" copy. Platform projection wires objects; it never supplies missing creative content.' },
    { priority: 1, text: registeredComponentBlueprints(pageId) },
    { priority: 1, text: modules },
    { priority: 2, text: `PAGE DESIGN FIT: ${designSources.implementations.filter(impl => !pageId || designSources.eligibleByPage[pageId]?.includes(impl.implementationId))
      .map(impl => `${impl.implementationId}: ${impl.visualSignature ? `${impl.visualSignature.geometry}, ${impl.visualSignature.mediaDominance} media, ${impl.visualSignature.density}` : impl.name}`).join('; ')}. Variants are listed best-fit first per family. Choose designs that realize the target geometry and media dominance, and do not reuse one variant for different sections of a page or repeat the previous page's choices when another listed variant fits.` },
    { priority: 2, text: 'PERSISTABLE SECTION CONTRACT: every page-level body <section>, shared <header> navbar, and shared <footer> must carry literal stable data-ut-section-id, data-ut-section-type, and data-ut-variant values. Use site:navbar and site:footer as the shared chrome IDs across pages. For a listed certified variant, import its default family dispatcher from @/unison/design-sources/<Family> and render exactly one per root with matching sectionId/variantId and JSON-serializable props={{...}}. For a unique authored body component that has no suitable listed variant, use data-ut-variant="custom:<kebab-slug>" on a known non-chrome section family and render exactly one default component imported from @/project-components/ or @/components/generated/ inside that root; keep all JSX props literal and serializable. Never use custom variants for navbar/footer. Keep existing data-ut-intent, data-ut-cta, data-ut-resource, slot, and registered component markers inside the root; never replace or regenerate those bindings when changing visual layout.' },
    { priority: 1, text: 'CANONICAL SHARED SHELL: import and render the existing named SiteNav from @/project-components/site/SiteNav and SiteFooter from @/project-components/site/SiteFooter exactly once on every page, outside <main>: SiteNav first, then <main> holding every body section, then SiteFooter last. Nothing renders after SiteFooter. These wrappers are compiler-materialized from the canonical route registry and shared eligible design variants; do not inline, duplicate, or re-author page-local navigation or footer.' },
    { priority: 2, trimmable: true, text: canonicalIntentBindings(pageId) },
    { priority: 3, trimmable: true, text: registeredComponentContext(pageId) },
    { priority: 3, text: businessParameterContext },
    { priority: 4, text: interactiveSurfaceContract },
    { priority: 2, text: commerceSetupContext },
    { priority: 4, text: 'Portable recipe identity: pass stable sectionId from the page composition and componentInstanceId only from an existing canonical functional instance; never invent cmp_ IDs or substitute an implementation ID for an instance ID. Local toggles are component state, not data-ut-intent. Auth submit forms use data-intent-form="auth.login"/"auth.register"; auth.login/auth.register click bindings only open/focus auth.' },
    { priority: 3, text: `Industry ${business.industry}; goals ${business.goals.join(', ') || 'none'}. Intents: ${business.intents.join(', ') || 'none'}; capabilities: ${business.capabilities.join(', ') || 'none'}.` },
    { priority: 4, text: industryContext },
    { priority: 4, text: logoContext },
    { priority: 4, text: iconContext },
    { priority: 3, text: buildRegisteredResourceContext(contentTypes) },
    { priority: 4, text: `Approved experience capabilities: ${runtime.approvedExperienceCapabilities.join(', ') || 'none'}.` },
    { priority: 5, text: `Protected paths: ${runtime.protectedPaths.join(', ')}.` },
    { priority: 5, text: `Available runtime dependencies (already pinned for this site): ${(runtime.availableRuntimeDependencies ?? []).join(', ')}. You may also import any valid browser npm package; the shared site dependency resolver will add it to the site graph and preview will verify installation. Never import Node builtins or server-only packages.` },
  ], budget).text;
  return {
    contract,
    designSources,
    materialization,
    // Site-wide reference is not a request payload; only per-page context is budgeted.
    runtimeContext: compose(renderDesignSourceModules(materialization), undefined, Number.POSITIVE_INFINITY),
    runtimeContextForPage: (pageId, budget) => compose(renderDesignSourceModules(materialization, new Set(designSources.eligibleByPage[pageId] ?? [])), pageId, budget),
  };
}

const MAX_IDS_PER_MODULE = 12;

function renderDesignSourceModules(materialization: DesignSourceMaterialization, only?: ReadonlySet<string>): string {
  const byModule = new Map<string, string[]>();
  const exports = new Map<string, string>();
  for (const [id, entry] of Object.entries(materialization.manifest.implementations)) {
    if (only && only.size > 0 && !only.has(id)) continue;
    if (entry.exportName) exports.set(id, entry.props ? entry.exportName + '(' + entry.props + ')' : entry.exportName);
    byModule.set(entry.modulePath, [...(byModule.get(entry.modulePath) ?? []), id]);
  }
  const lines = [...byModule].sort(([a], [b]) => a.localeCompare(b)).map(([modulePath, ids]) =>
    `- ${modulePath.replace(/^\/src\//, '@/').replace(/\.tsx$/, '')} (props, variantId): ${ids.sort().slice(0, only ? ids.length : MAX_IDS_PER_MODULE).map((id) => (exports.has(id) ? `${id}={ ${exports.get(id)} }` : id)).join(', ')}`);
  return lines.length
    ? `Certified design-source modules (read-only; the IDs listed below are the only eligible variants for this page; copy each ID exactly into both root data-ut-variant and nested dispatcher variantId, and never choose a global or inferred variant. Import the default family dispatcher, e.g. import Services from '@/unison/design-sources/Services'; <Services variantId="services:editorial-rows" props={{ headline: "..", items: [...] }} />. The listed registry exports and prop hints identify available variants, but do not render named variant exports directly. Props marked [] are required, non-empty arrays (name?[] is optional and may be omitted) and {a|b|c?} lists the fields every item needs (? = optional; fill every non-? field with real business copy); headline/subheadline are plain strings, never nested <h1>/<h2>. Never import from recipes/ or REGISTERED_VARIANTS):\n${lines.join('\n')}`
    : '';
}

export interface DesignSourceUsageReport {
  version: '1.0';
  eligiblePerPage: Record<string, number>;
  referencedPerPage: Record<string, string[]>;
  genericFallbackIds: string[];
  primitiveOnlyPages: string[];
}

/** R0: which design sources were available and which a candidate actually references. */
export function reportDesignSourceUsage(
  contract: AppBuildContract,
  bundle: DesignSourceBundle,
  files: Readonly<Record<string, string>>,
): DesignSourceUsageReport {
  const report: DesignSourceUsageReport = { version: '1.0', eligiblePerPage: {}, referencedPerPage: {}, genericFallbackIds: [], primitiveOnlyPages: [] };
  const known = bundle.implementations.map((impl) => impl.implementationId);
  const generic = new Set<string>();
  for (const page of contract.topology.sitePlan.pages) {
    const source = files[page.filePath] ?? '';
    const referenced = known.filter((id) => source.includes(id));
    report.eligiblePerPage[page.id] = bundle.eligibleByPage[page.id]?.length ?? 0;
    report.referencedPerPage[page.id] = referenced;
    referenced.filter(isGenericImplementationId).forEach((id) => generic.add(id));
    if (referenced.length === 0 && report.eligiblePerPage[page.id] > 0) report.primitiveOnlyPages.push(page.id);
  }
  report.genericFallbackIds = [...generic].sort();
  return report;
}
