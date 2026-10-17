/** Single per-job derivation of everything a page turn may know, taken only from the sealed contract. */

import type { AppBuildContract } from '@/services/app-builder/appBuilderContracts';
import { resolveDesignSourceBundle, isGenericImplementationId } from './design/designSystemResolver';
import type { DesignSourceBundle } from './design/DesignSourceBundle';
import { materializeDesignSources, type DesignSourceMaterialization } from './design/designSourceMaterializer';
import { getAllIndustries, getIndustryProfile } from '@/platform/core/industryMatrix';
import { listCatalogSurfaces } from '@/platform/core/catalogSurfaceRegistry';

export interface AppBuilderGenerationContext {
  contract: AppBuildContract;
  designSources: DesignSourceBundle;
  materialization: DesignSourceMaterialization;
  runtimeContext: string;
  /** Same facts with design-source modules trimmed to what one page may use. */
  runtimeContextForPage: (pageId: string) => string;
}

export interface IndustrySeedDataTarget {
  target: string;
  catalogSurface?: string;
}

export const INDUSTRY_SEED_DATA_TARGETS: Record<string, IndustrySeedDataTarget> = {
  business_name: { target: 'BusinessProfile.name and CreatorData.businessInfo.businessName' },
  business_email: { target: 'BusinessProfile.email and CreatorData.businessInfo.email' },
  features: { target: 'authored feature sections, not a product catalog' },
  pricing_tiers: { target: 'catalog.pricing / pricing_plans', catalogSurface: 'pricing' },
  services: { target: 'catalog.services / services', catalogSurface: 'services' },
  operating_hours: { target: 'BusinessProfile.hours and CreatorData.businessInfo.hours' },
  menu_items: { target: 'catalog.menu / menu_items', catalogSurface: 'menu' },
  service_areas: { target: 'owner-provided service-area content; do not invent coverage zones' },
  programs: { target: 'catalog.services / services when represented as bookable programs', catalogSurface: 'services' },
  credentials: { target: 'owner-supplied CreatorData.team and about-page content; never invent qualifications' },
  specialties: { target: 'catalog.services categories and owner-supplied page content', catalogSurface: 'services' },
  products: { target: 'catalog.products / products', catalogSurface: 'products' },
  shipping_info: { target: 'owner-supplied shipping policy content; do not invent shipping rules or APIs' },
  portfolio_items: { target: 'CMS gallery content from CreatorData.gallery' },
  mission_statement: { target: 'BusinessProfile.description and CreatorData.businessInfo.description' },
  case_studies: { target: 'CMS case-studies content from CreatorData.caseStudies' },
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
    `Industry seed data targets:\n${seedTargets.map(({ key, target }) => `- ${key} → ${target.target}`).join('\n')}`,
    `Industry catalog targets: ${industryCatalogs.join(', ') || 'none'}. Launch capabilities: ${enabledCapabilities.join(', ') || 'none'}.`,
    'Use owner-provided facts for prices, credentials, service areas, mission, and shipping terms; do not fabricate them. A focused user intent is additive to the selected industry: implement it with enabled capabilities and matching industry data; do not change the business category or invent unprovisioned tables, APIs, or controllers.',
  ].join('\n');
}

export function buildIndustryIconContext(
  industry: string,
  enabledCapabilities: readonly string[],
  intents: readonly string[],
): string {
  const registeredSurfaces = new Set(listCatalogSurfaces().map((surface) => surface.surfaceId));
  const industrySurfaces = new Set(getIndustrySeedDataTargets(industry)
    .map(({ target }) => target.catalogSurface)
    .filter((surface): surface is string => !!surface && registeredSurfaces.has(surface)));
  const seedDataKeys = new Set(getIndustryProfile(industry)?.seedDataKeys ?? []);
  const searchableSurfaces = ['menu', 'pricing', 'products', 'services']
    .filter((surface) => industrySurfaces.has(surface));
  const cartableSurfaces = ['menu', 'products', 'services']
    .filter((surface) => industrySurfaces.has(surface));
  const purchaseRequested = intents.some((intent) => intent === 'cart.add' || intent === 'cart.checkout');
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
    `Search: ${searchableSurfaces.length ? `Search is eligible for rendered, non-empty searchable content on ${searchableSurfaces.join(', ')}; omit the control on pages without such content.` : 'no searchable catalog surface is declared; omit search unless the page has another real searchable collection.'}`,
    `Cart: ${cartEnabled ? `ShoppingBag or ShoppingCart may represent cart actions for ${cartableSurfaces.join(', ')}; bind only to the requested cart intent and enabled commerce capability.` : 'omit shopping bag/cart actions: commerce requires both an enabled commerce capability and an explicit cart.add or cart.checkout intent with a cartable registered surface.'}`,
    `Industry content affordances: ${affordances.join(', ') || 'none from the industry seed profile'}. Use only when the matching content is rendered; icons never imply an unprovisioned API, route, or capability.`,
    'Use only icon exports available through approved project dependencies, and give icon-only controls an accessible name.',
  ].join('\n');
}

export function buildAppBuilderGenerationContext(contract: AppBuildContract): AppBuilderGenerationContext {
  const { business, runtime } = contract;
  const designSources = resolveDesignSourceBundle(contract);
  const materialization = materializeDesignSources(designSources);
  const industryContext = buildIndustryAuthoringContext(business.industry, business.capabilities);
  const iconContext = buildIndustryIconContext(business.industry, business.capabilities, business.intents);
  const logoContext = [
    `CANONICAL LOGO CONTRACT: brand mark source ${business.branding.brandMark.source.kind}.${business.branding.brandMark.source.field}; render only in ${business.branding.brandMark.placements.map(({ slotId }) => slotId).join(', ')} using the registered business-profile binding, never a hard-coded URL.`,
    `Preserve the logo's intrinsic ratio with object-fit: contain within ${business.branding.brandMark.image.maxWidthPx}x${business.branding.brandMark.image.maxHeightPx}px; use accessible name "${business.branding.brandMark.accessibleName}". If the profile has no logo, render the text wordmark "${business.branding.brandMark.missingAssetFallback.text}"; do not generate or source a replacement mark.`,
    `Logo cloud is separate social proof: use ${business.branding.logoCloud.artifactId} only with owner-authored entries, at least ${business.branding.logoCloud.minimumItems}; generated entries are forbidden and the empty behavior is ${business.branding.logoCloud.emptyBehavior}.`,
  ].join('\n');
  const compose = (modules: string) => [
    `Industry ${business.industry}; goals ${business.goals.join(', ') || 'none'}.`,
    industryContext,
    iconContext,
    logoContext,
    `Intents: ${business.intents.join(', ') || 'none'}; capabilities: ${business.capabilities.join(', ') || 'none'}.`,
    business.bindingGuide ? `Binding guide: ${business.bindingGuide}` : '',
    `Protected paths: ${runtime.protectedPaths.join(', ')}.`,
    `Approved dependencies: ${runtime.approvedDependencies.join(', ')}.`,
    modules,
    'Portable recipe identity: pass stable sectionId from the page composition and componentInstanceId only from an existing canonical functional instance; never invent cmp_ IDs or substitute an implementation ID for an instance ID. Local toggles are component state, not data-ut-intent. Auth submit forms use data-intent-form="auth.login"/"auth.register"; auth.login/auth.register click bindings only open/focus auth.',
    `Approved experience capabilities: ${runtime.approvedExperienceCapabilities.join(', ') || 'none'}.`,
  ].filter(Boolean).join('\n');
  return {
    contract,
    designSources,
    materialization,
    runtimeContext: compose(renderDesignSourceModules(materialization)),
    runtimeContextForPage: (pageId) => compose(renderDesignSourceModules(materialization, new Set(designSources.eligibleByPage[pageId] ?? []))),
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
    ? `Certified design-source modules (read-only; import the named export and pass the listed props directly, e.g. import { Name } from '@/unison/design-sources/<Family>'; <Name headline=".." items={[..]} />; props marked [] are required, non-empty arrays (name?[] is optional and may be omitted) and {a|b|c?} lists the fields every item needs (? = optional; fill each non-? field with real business copy, never leave items empty); headline/subheadline are plain strings, never nested <h1>/<h2>; never import from recipes/ or REGISTERED_VARIANTS):\n${lines.join('\n')}`
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
