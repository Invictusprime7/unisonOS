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
import { renderCreativeRequirements } from '@/services/launch/creativePlan';
import { renderVerticalKnowledge } from '@/services/composition/verticals';
import { ARCHETYPE_ADVISORY_POLICY, CREATIVE_AUTHORITY_ORDER, MIXED_SECTION_AUTHORING_POLICY } from './creativeAuthorityPolicy';

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
    // Project-scoped CMS types lead so a trimmed context keeps this site's own schemas.
    ...[...listResources(contentTypes)].sort((a, b) => Number(!a.key.startsWith('content:')) - Number(!b.key.startsWith('content:'))).map((resource) => `- ${resource.key} → ${resource.storage.table ?? `CMS ${resource.storage.contentType}`} (${resource.cardinality}); fields: ${resource.schema.map((field) => `${field.key}:${field.type}`).join(', ')}.`),
    'CMS seed targets are planned, not installed: create their declared content types through the existing CMS command only when supplied content exists, then use returned type/entry IDs. Features, coverage, credentials and shipping copy never imply a new catalog or API.',
  ].join('\n');
}

export function buildAppBuilderGenerationContext(contract: AppBuildContract, contentTypes: readonly ContentTypeRow[] = []): AppBuilderGenerationContext {
  const { business, runtime } = contract;
  const designSources = resolveDesignSourceBundle(contract);
  const materialization = materializeDesignSources(designSources);
  const creation = business.universalCreation;
  const openEnded = creation?.mode === 'open-ended';
  const creationContext = creation ? [
    `VISITOR CREATION SPECIFICATION (${creation.mode}): site purpose: ${creation.sitePurpose}; subject: ${creation.subject}.`,
    `Explicit page plan: ${creation.pages.map((page) => `${page.route} (${page.title}; role ${page.suggestedRole ?? 'custom'}): ${page.purpose}`).join(' | ') || 'Home only.'}`,
    `Visual requirements: ${creation.visualRequirements.join('; ') || 'Use the visual direction in the original prompt.'}`,
    `Requested operational capabilities: ${creation.requestedCapabilities.join(', ') || 'none; do not add unrequested backend behavior.'}`,
    'Capability authorization: a requested capability is not authorization. Use only registered components and intents in this contract; never simulate backend writes or claim unbound operations are functional.',
    `Original visitor prompt (primary creative authority): ${creation.originalPrompt}`,
    ...(creation.confirmedDirection ? [`Confirmed site direction (accepted refinement; never narrows the prompt): ${creation.confirmedDirection}`] : []),
    ...(creation.refinements?.length ? [`Owner refinements in order (later ones win where they disagree): ${creation.refinements.join(' | ')}`] : []),
    ...(creation.designDirection?.origin === 'provisional'
      ? [`Design direction is PROVISIONAL: ${creation.designDirection.note} Never treat the token base as the requested style.`]
      : []),
    renderCreativeRequirements(creation.requirements, creation.designDirection),
    ...(creation.experienceDirection ? ['Experience requirements (req:experience:*) are the owner\'s conversational design choices: REUSE renders the named certified design (its data-ut-variant), ADAPT keeps the named design as the base and marks a site-local derivative with // @unison-derived-from <id>, AUTHOR creates an original site-local component. Realize each on its stated page; never silently substitute a different design or art direction.'] : []),
    renderVerticalKnowledge(creation.vertical),
    ...(openEnded ? ['The selected industry is only a compatibility hint; do not replace the visitor subject or purpose with an industry template. Author site-local TSX wherever certified designs do not fit the prompt.'] : []),
    ...(creation.sitePurpose.toLowerCase().includes('editorial')
      ? ['Editorial pages may render static sample articles. When a published articles content type exists, load it through listPublishedContent from @/components/publishedActionRuntime. If no type or published rows are available, keep a local sample/empty state; do not claim CMS editing or publishing without canonical owner authorization.']
      : []),
  ].join('\n') : '';
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
    return `VERIFIED COMPONENT-CAPABILITY PROJECTION: ${components.length ? components.map((component) => `${component.runtime.componentSlug} (instance ${component.runtime.instanceId}; pages ${component.runtime.usedOnPages.join(', ') || 'site-wide'}; target ${component.targetType}; status ${component.runtime.status}; required capabilities ${component.runtime.requiredCapabilities.join(', ') || 'none'}; write intent ${component.runtime.writeIntent ?? 'none'}; required bindings ${component.requiredBindingKeys.join(', ') || 'none'}; required native form fields ${component.requiredNativeFormFields?.join(', ') || 'none'}; bindings ${JSON.stringify(component.bindings)})`).join('\n') : 'no canonical functional components are provisioned for this page.'}`;
  };
  // Keep identity concise, not generic: source-owned projection supplies fields.
  const registeredComponentTemplates = (pageId?: string) => {
    const templates = componentsForPage(pageId).filter(component => component.nativeComponentTemplate);
    return templates.length ? [
      'REGISTERED COMPONENT BLUEPRINTS: preserve these canonical native hosts, field names, and intent markers exactly; they define behavior, while original App Builder-authored sections define presentation.',
      ...templates.map(component => `${component.runtime.componentSlug}:\n${component.nativeComponentTemplate}`),
    ].join('\n') : '';
  };
  const registeredComponentBlueprints = (pageId?: string) => {
    const hosts = componentsForPage(pageId).filter(component => component.runtime.writeIntent && ['form', 'calendar'].includes(component.targetType));
    if (!hosts.length) return 'FORMS: this page hosts no registered form. Do not add forms; certified Contact variants already render their own form, so only use a Contact section where the plan requires it.';
    return [
      'FORM PLACEMENT: exactly one registered form per purpose, inside <main> before the footer. A certified Contact variant may host it; otherwise use one native form marked with the registered intent. Preserve all listed field names. Never add duplicate forms or local success handlers.',
      ...hosts.map(component => `- ${component.runtime.componentSlug}; intent ${component.runtime.writeIntent}; required fields: ${component.requiredNativeFormFields?.join(', ') || 'none'}. Use only its registered instance and form/calendar binding.`),
    ].join('\n');
  };
  const canonicalIntentBindings = (pageId?: string) => {
    const bindings = bindingsForPage(pageId);
    return [
      `${pageId ? `PAGE ${pageId} ` : ''}CANONICAL INTENT BINDINGS: ${bindings.length ? bindings.map((binding) => `${binding.bindingId}: ${binding.sourceSection}.${binding.sourceSlot} -> core intent ${binding.coreIntent}, DOM intent ${binding.domIntent}, marker ${binding.ctaMarkers.map((marker) => `data-ut-cta="${marker}"`).join('|') || 'none'}, handler ${binding.intentHandler}, target ${binding.targetType}:${binding.targetId}${binding.componentSlug ? `, component ${binding.componentSlug} instance ${binding.componentInstanceId}` : ''}${binding.missingCapabilities.length ? `, INACTIVE (${binding.missingCapabilities.join(', ')})` : ''}`).join('\n') : 'none.'}`,
      'Preserve every supplied page, component, resource, and binding ID exactly. A design variant never grants runtime authority; use only these intents and handlers.',
      ...bindings.filter((binding) => binding.businessFieldBindings?.length).map((binding) => `${binding.bindingId} profile fields: ${binding.businessFieldBindings!.map(({ field }) => field).join(', ')}. Never copy private destinations or business answers into visitor values.`),
    ].join('\n');
  };
  const businessParameterContext = [
    `PUBLIC BUSINESS FACTS: use only these public contact and brand values ${JSON.stringify(business.parameters)} and public profile projection ${JSON.stringify(business.businessProfile)}. Private notification recipients, payment routing, and CRM destinations are intentionally excluded and are resolved by the tenant-scoped runtime.`,
    `CONFIGURATION READINESS: these business fields are configured: ${business.configuredBusinessFields.join(', ') || 'none'}. The field names are readiness metadata only; do not infer or emit their values.`,
    'For operational interactions, render only the exact registered component and intent handler assigned by the contract. Tenant-scoped server handlers resolve private CRM destinations and notification recipients; never place those values in generated markup or client source. Do not invent component IDs, alternate intent handlers, direct database writes, or local success handlers.',
  ].join('\n');
  const interactiveSurfaceContract = [
    'FORM AND CHAT AUTHORING CONTRACT:',
    'Forms are interaction widgets, not body-section layouts: never use a bare <form>, Form, or *Form component as a standalone section or the only content on a page. Embed form controls within a purposeful, planned section that includes visible context and authored layout.',
    'Use @/unison/ui/form-fields controls and @/unison/ui/button actions for form UI. Every field needs a visible label and semantic theme tokens.',
    'Certified design sources are rendered only through their @/unison/design-sources/<Family> dispatchers with a listed variantId; never import raw 21st.dev or vendor source directly. Registered functional hosts may be included only when the canonical contract assigns them.',
    'Only emit form actions and data-ut-intent values covered by the registered intents and exact canonical CTA markers in this contract. A design component does not authorize a new action or intent.',
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
    { priority: 1, text: canonicalIntentBindings(pageId) },
    { priority: 1, text: creationContext },
    { priority: 1, text: modules },
    { priority: 1, text: pageId ? pageIdentityContext(pageId) : '' },
    { priority: 1, text: renderEligiblePresentation(designSources, pageId) },
    { priority: 1, text: 'PERSISTABLE SECTION CONTRACT: every root uses stable literal data-ut-section-id, data-ut-section-type and data-ut-variant. Shared chrome IDs are site:navbar and site:footer. A body section is either one certified family dispatcher with a listed variantId, or one site-local default-exported component under /src/project-components/ or /src/components/generated/ with a unique custom:<kebab-slug> variant. Every section must render meaningful visible content; empty wrappers and form-only wrappers are invalid. Never use custom variants for chrome. Keep all canonical intent, CTA, resource, slot and component-instance markers unchanged.' },
    { priority: 1, text: CREATIVE_AUTHORITY_ORDER },
    { priority: 1, text: MIXED_SECTION_AUTHORING_POLICY },
    { priority: 1, text: ARCHETYPE_ADVISORY_POLICY },
    { priority: 1, text: 'CANONICAL SHARED SHELL: render compiler-owned SiteNav then one <main> body then SiteFooter, exactly once. Do not inline, duplicate, or re-author page chrome.' },
    { priority: 1, text: registeredComponentBlueprints(pageId) },
    { priority: 2, trimmable: true, text: buildRegisteredResourceContext(contentTypes) },
    { priority: 1, text: 'DESIGN DIRECTION: the owner\'s prompt and confirmed refinements decide the experience. The resolved art direction pack supplies the site-wide visual language (typography, geometry, spacing cadence, media treatment, motion character) and the theme tokens supply colour; express the prompt through them rather than replacing it. Preserve canonical IDs, bindings, handlers, intents and CTA markers; never invent backend actions, business facts or baseline filler.' },
    { priority: 3, trimmable: true, text: renderCertifiedOptions(materialization, designSources, pageId) },
    { priority: 1, text: registeredComponentContext(pageId) },
    { priority: 4, text: registeredComponentTemplates(pageId) },
    { priority: 3, text: businessParameterContext },
    { priority: 4, text: interactiveSurfaceContract },
    { priority: 2, text: commerceSetupContext },
    { priority: 4, text: 'Portable recipe identity: pass stable sectionId from the page composition and componentInstanceId only from an existing canonical functional instance; never invent cmp_ IDs or substitute an implementation ID for an instance ID. Local toggles are component state, not data-ut-intent. Auth submit forms use data-intent-form="auth.login"/"auth.register"; auth.login/auth.register click bindings only open/focus auth.' },
    { priority: 3, text: `Industry ${business.industry}; goals ${business.goals.join(', ') || 'none'}. Intents: ${business.intents.join(', ') || 'none'}; capabilities: ${business.capabilities.join(', ') || 'none'}.` },
    { priority: 4, text: industryContext },
    { priority: 4, text: logoContext },
    { priority: 4, text: iconContext },
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
    runtimeContextForPage: (pageId, budget) => {
      const eligibleIds = designSources.eligibleByPage[pageId] ?? [];
      return compose(renderDesignSourceModules(materialization, new Set(eligibleIds)), pageId, budget);
    },
  };
}

const MAX_IDS_PER_MODULE = 12;

function eligibleImplementationsByFamily(designSources: DesignSourceBundle, pageId: string): Map<string, string[]> {
  const implementations = new Map(designSources.implementations.map((implementation) => [implementation.implementationId, implementation]));
  const byFamily = new Map<string, string[]>();
  for (const id of designSources.eligibleByPage[pageId] ?? []) {
    const implementation = implementations.get(id);
    if (!implementation) continue;
    byFamily.set(implementation.sectionType, [...(byFamily.get(implementation.sectionType) ?? []), id]);
  }
  return byFamily;
}

function renderEligiblePresentation(designSources: DesignSourceBundle, pageId?: string): string {
  if (!pageId) return '';
  const byFamily = eligibleImplementationsByFamily(designSources, pageId);
  const families = [...byFamily.keys()];
  return families.length
    ? `CERTIFIED DESIGN VOCABULARY: certified families available on this page are ${families.join(', ')}. They are optional REUSE/ADAPT options; any other section may be AUTHORED as a site-local component.`
    : 'CERTIFIED DESIGN VOCABULARY: no certified designs are eligible on this page; AUTHOR every body section as a site-local component.';
}

const MAX_OPTIONS_PER_FAMILY = 3;
const MAX_PROPS_HINT = 280;

/** Small ranked set of certified implementations a page may REUSE, with their prop contracts. */
function renderCertifiedOptions(
  materialization: DesignSourceMaterialization,
  designSources: DesignSourceBundle,
  pageId?: string,
): string {
  if (!pageId) return '';
  const manifest = materialization.manifest.implementations;
  const lines: string[] = [];
  for (const [family, ids] of eligibleImplementationsByFamily(designSources, pageId)) {
    if (family === 'navbar' || family === 'footer') continue;
    const options = ids.filter((id) => manifest[id]).slice(0, MAX_OPTIONS_PER_FAMILY);
    if (!options.length) continue;
    const importPath = manifest[options[0]].modulePath.replace(/^\/src\//, '@/').replace(/\.(?:tsx?|jsx?)$/i, '');
    const dispatcher = importPath.split('/').pop() ?? 'Section';
    lines.push(`- ${family} (import ${dispatcher} from "${importPath}"): ${options.map((id) => {
      const props = manifest[id].props;
      return `${id}${props ? ` props {${props.length > MAX_PROPS_HINT ? `${props.slice(0, MAX_PROPS_HINT)}…` : props}}` : ''}`;
    }).join('; ')}`);
  }
  return lines.length
    ? ['CERTIFIED OPTIONS FOR THIS PAGE (ranked; REUSE/ADAPT only where they fit the prompt; name[]{a|b?} is an array of objects, ? = optional):', ...lines].join('\n')
    : '';
}

function renderDesignSourceModules(
  materialization: DesignSourceMaterialization,
  only?: ReadonlySet<string>,
): string {
  const families = [...new Set(Object.entries(materialization.manifest.implementations)
    .filter(([id]) => !only || only.has(id))
    .map(([, entry]) => entry.sectionType))].sort();
  if (!only) {
    return families.length
      ? `Certified implementations exist for these families (${families.join(', ')}); each page lists the ones it may REUSE or ADAPT. Site-local sections live under /src/project-components/ or /src/components/generated/ with custom:<kebab-slug> identities.`
      : '';
  }
  return families.length
    ? `PAGE-SCOPED REGISTRY CONTEXT (exhaustive for certified reuse): only these certified families are eligible on this page (${families.join(', ')}). Never use a registered variant or implementation from another page; author anything else as an original site-local component with a custom:<kebab-slug> identity.`
    : 'PAGE-SCOPED REGISTRY CONTEXT: no certified design-source implementations are eligible for this page. Do not use registered variants from other pages; author body sections as original site-local components with custom:<kebab-slug> identities.';
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
