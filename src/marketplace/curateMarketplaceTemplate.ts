import { themePresetToThemeTokens } from '@/components/onboarding/themePresetToTokens';
import { SYSTEM_TO_BUSINESS_MODEL } from '@/components/onboarding/wizard/wizardCatalog';
import { buildAppBuildContract } from '@/services/app-builder/appBuilderContracts';
import { resolveDesignSourceBundle } from '@/services/app-builder/design/designSystemResolver';
import { compileResolvedSiteDesignContext } from '@/services/launch/resolvedSiteDesignContext';
import { buildWizardBindingGuide } from '@/services/wizardBindingBridge';
import { buildCanonicalLaunchPlan } from '@/services/launch/canonicalLaunchPlan';
import { createWizardDesignSelection } from '@/services/wizardDesignSelection';
import { getIntentDef } from '@/platform/core/intentSurfaceRegistry';
import type { ArtDirectionPackId } from '@/sections/variants/artDirectionPacks';
import { generateTopologyPlaceholderFiles } from '@/utils/topologyVFSScaffolder';
import type { TemplateComposition } from '@/sections/types';
import type { BusinessModel, IndustryOverlay, WizardSelections } from '@/types/playground';
import type { ThemePreset } from '@/components/onboarding/themePresets';

const INDUSTRY_OVERLAYS: Record<string, IndustryOverlay> = {
  salon: 'salon',
  barber: 'barber',
  medspa: 'medspa',
  wellness: 'wellness',
  restaurant: 'restaurant',
  cafe: 'cafe',
  bakery: 'bakery',
  contractor: 'contractor',
  'local-service': 'local-service',
  local_service: 'local-service',
  realestate: 'real_estate',
  real_estate: 'real_estate',
  'real-estate': 'real_estate',
  store: 'ecommerce',
  ecommerce: 'ecommerce',
  saas: 'saas',
  agency: 'agency',
  portfolio: 'portfolio',
  photography: 'photographer',
  photographer: 'photographer',
  coaching: 'coaching',
  fitness: 'fitness',
  nonprofit: 'nonprofit',
  content: 'nonprofit',
  creator: 'creator',
  dental: 'dental',
  healthcare: 'dental',
  auto_detailing: 'auto_detailing',
  hvac: 'hvac',
  cleaning: 'cleaning',
  landscaping: 'landscaping',
  moving: 'moving',
  legal: 'legal',
};

const DEFAULT_PAGES: Record<BusinessModel, string[]> = {
  appointment_service: ['services', 'pricing', 'booking', 'about', 'contact'],
  quote_lead: ['services', 'gallery', 'about', 'contact', 'faq'],
  ecommerce: ['shop', 'about', 'contact'],
  portfolio_creator: ['gallery', 'about', 'contact', 'pricing'],
  restaurant_hospitality: ['services', 'gallery', 'booking', 'contact'],
  saas_digital: ['pricing', 'about', 'contact', 'faq'],
  nonprofit: ['about', 'gallery', 'contact'],
  general: ['about', 'contact'],
};

const PURCHASE_INTENTS = new Set(['cart.add', 'cart.checkout', 'pay.checkout']);
const BOOKING_INTENTS = new Set(['booking.create', 'calendar.open']);

export interface CuratedMarketplaceTemplate {
  files: Record<string, string>;
  selections: WizardSelections;
  contract: ReturnType<typeof buildAppBuildContract>;
  designSourceBundle: ReturnType<typeof resolveDesignSourceBundle>;
  intentCount: number;
  routeCount: number;
  portableRecipeCount: number;
}

function collectTemplateIntents(template: TemplateComposition): string[] {
  const intents = new Set<string>();
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (typeof value !== 'object' || value === null) return;
    for (const [key, child] of Object.entries(value)) {
      if (key === 'intent' && typeof child === 'string' && getIntentDef(child)) intents.add(child);
      else visit(child);
    }
  };
  visit(template.sections);
  visit(template.pageCompositions);
  return [...intents].sort();
}

function resolveIndustryOverlay(template: TemplateComposition): IndustryOverlay {
  const key = template.industry.trim().toLowerCase().replace(/\s+/g, '_');
  const overlay = INDUSTRY_OVERLAYS[key];
  if (!overlay) {
    throw new Error(`Marketplace template ${template.id} has no canonical industry overlay for "${template.industry}".`);
  }
  return overlay;
}

function resolveBusinessModel(
  systemType: keyof typeof SYSTEM_TO_BUSINESS_MODEL,
  industry: IndustryOverlay,
  intents: readonly string[],
): BusinessModel {
  if (industry === 'restaurant' || industry === 'cafe' || industry === 'bakery') {
    return intents.some((intent) => BOOKING_INTENTS.has(intent)) ? 'restaurant_hospitality' : 'general';
  }
  if (intents.some((intent) => PURCHASE_INTENTS.has(intent))) return 'ecommerce';
  if (intents.some((intent) => BOOKING_INTENTS.has(intent))) return 'appointment_service';
  if (intents.includes('quote.request')) return 'quote_lead';
  const model = SYSTEM_TO_BUSINESS_MODEL[systemType];
  return model === 'ecommerce' ? 'general' : model;
}

function resolveSystemType(template: TemplateComposition): keyof typeof SYSTEM_TO_BUSINESS_MODEL {
  const available = Object.keys(SYSTEM_TO_BUSINESS_MODEL) as Array<keyof typeof SYSTEM_TO_BUSINESS_MODEL>;
  if (template.systemType && available.includes(template.systemType as keyof typeof SYSTEM_TO_BUSINESS_MODEL)) {
    return template.systemType as keyof typeof SYSTEM_TO_BUSINESS_MODEL;
  }
  if (template.industry === 'restaurant' || template.industry === 'salon' || template.industry === 'contractor') return 'booking';
  if (template.industry === 'store') return 'store';
  if (template.industry === 'saas') return 'saas';
  if (template.industry === 'portfolio' || template.industry === 'photography') return 'portfolio';
  if (template.industry === 'nonprofit' || template.industry === 'content') return 'content';
  return 'agency';
}

function resolveRequestedPages(template: TemplateComposition, model: BusinessModel, intents: readonly string[]): string[] {
  const declared = [
    ...(template.pageRoles ?? []),
    ...Object.keys(template.pageCompositions ?? {}),
  ];
  const roles = declared.length > 0 ? declared : DEFAULT_PAGES[model];
  const purchasing = intents.some((intent) => PURCHASE_INTENTS.has(intent));
  const booking = intents.some((intent) => BOOKING_INTENTS.has(intent));
  return [...new Set(['home', ...roles])].filter((role) => {
    if ((role === 'checkout' || role === 'thank_you' || role === 'thankyou') && !purchasing) return false;
    if ((role === 'booking' || role === 'booking_confirmation') && !booking) return false;
    return true;
  });
}

export function curateMarketplaceTemplate(
  template: TemplateComposition,
  themePreset: ThemePreset,
  sealedArtDirectionPackId?: string,
): CuratedMarketplaceTemplate {
  const industryOverlay = resolveIndustryOverlay(template);
  const systemType = resolveSystemType(template);
  const templateIntents = collectTemplateIntents(template);
  const businessModel = resolveBusinessModel(systemType, industryOverlay, templateIntents);
  const requestedPages = resolveRequestedPages(template, businessModel, templateIntents);
  const primaryIntent = [
    'booking.create', 'calendar.open', 'cart.add', 'cart.checkout', 'pay.checkout', 'quote.request', 'contact.submit', 'newsletter.subscribe',
  ].find((intent) => templateIntents.includes(intent)) ?? templateIntents[0];
  const primaryGoal = primaryIntent && PURCHASE_INTENTS.has(primaryIntent)
    ? 'purchase'
    : primaryIntent && BOOKING_INTENTS.has(primaryIntent)
      ? 'booking'
      : primaryIntent === 'quote.request'
        ? 'quote_request'
        : 'lead_capture';

  const selections: WizardSelections = {
    businessName: template.name,
    businessModel,
    industryOverlay,
    systemType,
    primaryGoal,
    secondaryGoals: [],
    primaryIntent,
    requestedPages,
    scaffoldMode: 'selected-pages',
    templateId: template.id,
    themeId: themePreset.id,
    themePresetId: themePreset.id,
    themeTokens: themePresetToThemeTokens(themePreset),
    wizardSeedId: `marketplace-preview:${template.id}`,
    businessId: `marketplace-preview:${template.id}`,
    needsBooking: templateIntents.some((intent) => BOOKING_INTENTS.has(intent)),
    sellsProducts: templateIntents.some((intent) => PURCHASE_INTENTS.has(intent)),
    wantsLeadCapture: templateIntents.some((intent) => ['contact.submit', 'quote.request', 'newsletter.subscribe'].includes(intent)),
    designSelection: sealedArtDirectionPackId
      ? createWizardDesignSelection({ artDirectionPackId: sealedArtDirectionPackId as ArtDirectionPackId })
      : undefined,
  };

  const plan = buildCanonicalLaunchPlan(selections);
  const designContext = compileResolvedSiteDesignContext({
    industry: industryOverlay,
    roles: plan.sitePlan.pages.map((page) => page.role),
    artDirectionPackId: plan.designIntervention.artDirectionPackId,
    experience: selections.designSelection?.experience,
    mode: selections.designSelection?.mode,
    designSeed: plan.designIntervention.seed,
    businessModel,
  });
  const bindingGuide = buildWizardBindingGuide(plan.playground, { industry: industryOverlay });
  const activeIntents = [...new Set([
    ...templateIntents,
    ...Object.values(plan.playground.bindings).map((binding) => binding.coreIntent).filter((intent): intent is string => Boolean(intent)),
  ])].sort();
  const previewIdentity = `marketplace-preview:${template.id}`;
  const contract = buildAppBuildContract({
    identity: {
      projectId: previewIdentity,
      businessId: previewIdentity,
      siteId: previewIdentity,
      systemType,
    },
    sitePlan: plan.sitePlan,
    pageRegistry: plan.playground.pageRegistry,
    industry: industryOverlay,
    businessName: template.name,
    businessParameters: selections.businessParameters,
    businessProfile: plan.playground.creatorData.businessInfo,
    canonicalBindings: Object.values(plan.playground.bindings),
    registeredComponentInstances: Object.values(plan.playground.creatorData.componentInstances),
    forms: Object.values(plan.playground.creatorData.forms),
    goals: [primaryGoal],
    intents: activeIntents,
    capabilities: [],
    bindingGuide,
    seed: plan.designIntervention.seed,
    themePresetId: themePreset.id,
    themeTokens: selections.themeTokens!,
    artDirection: plan.artDirection,
    designContext,
    uiFoundation: plan.uiFoundationContract,
    registryContext: plan.registryContext,
    protectedPaths: [],
  });
  const designSourceBundle = resolveDesignSourceBundle(contract);

  const files = { ...plan.infrastructureFiles };
  for (const page of plan.sitePlan.pages) {
    Object.assign(files, generateTopologyPlaceholderFiles(
      page,
      plan.sitePlan,
      template,
      { designIntervention: plan.designIntervention },
    ));
  }

  const intentBindings = contract.business.intentBindings.map((binding) => ({
    bindingId: binding.bindingId,
    route: binding.route,
    sourceSection: binding.sourceSection,
    sourceSlot: binding.sourceSlot,
    coreIntent: binding.coreIntent,
    domIntent: binding.domIntent,
    intentHandler: binding.intentHandler,
    missingCapabilities: binding.missingCapabilities,
  }));
  files['/.unison/marketplace-curation.json'] = JSON.stringify({
    schemaVersion: 'marketplace-template-curation/1',
    templateId: template.id,
    industry: industryOverlay,
    themePresetId: themePreset.id,
    designSeed: contract.design.seed,
    artDirectionPackId: contract.design.artDirection.storagePackId,
    topology: contract.topology.sitePlan.pages.map((page) => ({
      pageId: page.id,
      role: page.role,
      route: page.route,
      filePath: page.filePath,
    })),
    intentBindings,
    designRegistrySignature: designSourceBundle.identity.designRegistrySignature,
    portableRecipeIds: designSourceBundle.implementations.map((implementation) => implementation.execution.portableRecipeId),
    primitiveFamilies: designSourceBundle.primitives.families,
    installedImportRoot: designSourceBundle.primitives.legalImports[0],
    runtimeDependencies: designSourceBundle.dependencies,
  }, null, 2);

  return {
    files,
    selections,
    contract,
    designSourceBundle,
    intentCount: contract.business.intentBindings.length,
    routeCount: plan.sitePlan.pages.length,
    portableRecipeCount: designSourceBundle.implementations.length,
  };
}