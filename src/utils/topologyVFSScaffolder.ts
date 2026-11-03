/**
 * Topology → VFS Scaffolder
 *
 * Ensures every page declared in the site topology has a corresponding
 * .tsx file in the VFS. Generates starter React components for missing pages
 * based on their role/type from the topology plan.
 *
 * **Template-driven scaffolding (Phase 1):**
 * When the active site plan carries a `selectedTemplateId` (set by the Wizard
 * Launcher chip selection), sub-pages are scaffolded as **role-filtered subsets
 * of the template's section pool** — not generic spinners. This makes the chip
 * selection the single authority over CSS layouts, navigation structure, and
 * page scaffolding direction.
 */

import type { GeneratedSitePlan, PageRouteNode, PageRole } from '@/platform/core/siteTopologyPlanner';
import { generateCanonicalRouter, generateCanonicalRouterFromPlan } from './topologyRouterGenerator';
import type { PageRegistry } from '@/types/pageRegistry';
import type { SectionEntry, SectionType, TemplateComposition, TemplatePageRole } from '@/sections/types';
import { ALL_COMPOSITIONS, getCompositionById, getCompositionsByIndustry } from '@/sections/templates';
import { compositionToReactCode } from '@/sections/PageRenderer';
import { compositionToReactFileSet } from '@/sections/compositionToFileSet';
import { THEME_PRESETS } from '@/components/onboarding/themePresets';
import { themePresetToThemeTokens } from '@/components/onboarding/themePresetToTokens';
import { PreviewPipelineError } from '@/services/previewPipelineError';
import type { WizardDesignIntervention } from '@/services/wizardDesignIntervention';
import { EXPERIENCE_PERFORMANCE_BUDGET } from '@/platform/core/generatedRuntimeCapabilities';
import { getVariantsForSection } from '@/sections/variants/registry';
import { getIndustryProfile } from '@/platform/core/industryMatrix';
import { getDefaultTemplateIdForIndustry, createIndustryStarterSection } from '@/sections/templates/industryDefaultRegistry';
import { bindMediaToComposition, buildSeedMediaLibrary, type SeedMediaAsset } from '@/services/launch/assetSlotBinding';
import { assertArtifactCatalogClosure } from '@/platform/core/resolvedArtifactCatalog';

/**
 * Options shared by the scaffolding entry points.
 *
 * Spinner / minimal placeholder scaffolds have been REMOVED from Unison.
 * Every page MUST render from the site/page topology + SiteBundleSnapshot
 * composition (industry template + theme preset). If a topology page has no
 * resolvable composition, the scaffolder throws PreviewPipelineError so the
 * runtime surfaces the drift via PreviewRuntimeError instead of emitting a
 * loading/minimal placeholder.
 *
 * `strictWizardComposition` is retained for callsite compatibility but is now
 * effectively always-on — there is no legacy spinner path to opt out to.
 */
export interface ScaffoldOptions {
  /** @deprecated Strict composition is now the only supported mode. */
  strictWizardComposition?: boolean;
  /** Canonical, opt-in visual recipes projected into generated page modules. */
  designIntervention?: Pick<WizardDesignIntervention, 'motionRecipes' | 'sectionVariants' | 'activeVariants'> & Partial<Pick<WizardDesignIntervention, 'industry' | 'themePresetId' | 'layoutRecipe' | 'interactionRecipes' | 'seed' | 'envelope' | 'compositionPolicy' | 'compositionPlan' | 'artDirectionPackId'>>;
}


// ============================================================================
// Default per-role section pool — used when a template doesn't define its own.
// Keeps every chip-selected industry getting consistent sub-page structure.
// ============================================================================

const DEFAULT_ROLE_SECTION_POOL: Record<PageRole, SectionType[]> = {
  home:      ['navbar', 'hero', 'services', 'features', 'testimonials', 'cta', 'footer'],
  services:  ['navbar', 'hero', 'services', 'features', 'pricing', 'testimonials', 'cta', 'footer'],
  pricing:   ['navbar', 'hero', 'pricing', 'services', 'faq', 'testimonials', 'cta', 'footer'],
  about:     ['navbar', 'hero', 'about', 'team', 'stats', 'testimonials', 'cta', 'footer'],
  contact:   ['navbar', 'hero', 'contact', 'faq', 'testimonials', 'cta', 'footer'],
  gallery:   ['navbar', 'hero', 'gallery', 'testimonials', 'cta', 'footer'],
  faq:       ['navbar', 'hero', 'faq', 'services', 'testimonials', 'cta', 'footer'],
  booking:   ['navbar', 'hero', 'services', 'testimonials', 'contact', 'cta', 'footer'],
  shop:      ['navbar', 'hero', 'services', 'gallery', 'testimonials', 'cta', 'footer'],
  checkout:  ['navbar', 'hero', 'services', 'contact', 'faq', 'cta', 'footer'],
  thank_you: ['navbar', 'hero', 'stats', 'testimonials', 'cta', 'footer'],
  blog:      ['navbar', 'hero', 'blog-preview', 'testimonials', 'cta', 'footer'],
  immersive: ['navbar', 'hero', 'gallery', 'features', 'stats', 'cta', 'footer'],
  custom:    ['navbar', 'hero', 'services', 'testimonials', 'faq', 'cta', 'footer'],
};

const MINIMUM_ROUTE_BODY_SECTIONS = 4;

const ROLE_SUPPLEMENT_PRIORITY: Record<PageRole, SectionType[]> = {
  home: ['services', 'features', 'testimonials', 'cta'],
  services: ['features', 'pricing', 'testimonials', 'faq', 'cta'],
  pricing: ['services', 'faq', 'testimonials', 'cta'],
  about: ['team', 'stats', 'testimonials', 'cta'],
  contact: ['faq', 'testimonials', 'services', 'cta'],
  gallery: ['testimonials', 'services', 'cta', 'faq'],
  faq: ['services', 'testimonials', 'cta', 'contact'],
  booking: ['services', 'testimonials', 'contact', 'cta'],
  shop: ['services', 'gallery', 'testimonials', 'cta'],
  checkout: ['services', 'contact', 'faq', 'cta'],
  thank_you: ['stats', 'testimonials', 'cta', 'services'],
  blog: ['blog-preview', 'testimonials', 'services', 'cta'],
  immersive: ['gallery', 'features', 'stats', 'testimonials', 'cta'],
  custom: ['services', 'testimonials', 'faq', 'cta'],
};

const ROLE_EYEBROWS: Partial<Record<PageRole, string>> = {
  contact: 'Get in Touch',
  booking: 'Appointments & Scheduling',
  services: 'Our Offerings',
  pricing: 'Pricing & Plans',
  about: 'About Our Team',
  gallery: 'Portfolio & Work',
  faq: 'Frequently Asked Questions',
  shop: 'Curated Catalog',
  checkout: 'Checkout',
  blog: 'Latest Insights',
  immersive: 'Interactive Experience',
};

// ============================================================================
// Template resolution — chip → composition
// ============================================================================

/**
 * Resolve which TemplateComposition drives this site plan.
 * Priority: explicit selectedTemplateId → industry-matched composition → null.
 */
function resolveActiveTemplate(plan: GeneratedSitePlan): TemplateComposition | null {
  // The plan carries selectedTemplateId via planSiteTopology options (see planner).
  const selectedId = (plan as GeneratedSitePlan & { selectedTemplateId?: string }).selectedTemplateId;
  if (selectedId) {
    const direct = getCompositionById(selectedId);
    if (direct) return direct;
  }

  // Explicit default registry — every canonical industry resolves to one
  // known-good composition before generic industry/category fallbacks, so
  // alias handling and registration order can never change the default.
  const registeredDefaultId = getDefaultTemplateIdForIndustry(plan.industry);
  if (registeredDefaultId) {
    const registeredDefault = getCompositionById(registeredDefaultId);
    if (registeredDefault) return registeredDefault;
  }

  // Industry fallback — use first composition matching the plan's industry.
  const byIndustry = getCompositionsByIndustry(plan.industry);
  if (byIndustry.length > 0) return byIndustry[0];

  // Last-resort lexical scan against composition.industry/category.
  const fuzzy = ALL_COMPOSITIONS.find(
    c => c.industry === plan.industry || c.category === plan.industry
  );
  return fuzzy ?? null;
}

function applyPlanThemeToTemplate(
  template: TemplateComposition | null,
  plan: GeneratedSitePlan,
): TemplateComposition | null {
  if (!template) return null;
  const presetId = (plan as GeneratedSitePlan & { selectedThemePresetId?: string }).selectedThemePresetId;
  if (!presetId) return template;
  const preset = THEME_PRESETS.find((p) => p.id === presetId);
  if (!preset) return template;
  return {
    ...template,
    theme: themePresetToThemeTokens(preset),
  };
}

// ============================================================================
// Wizard-seed → composition brand/content injection
//
// The WizardSeed (persisted at `/.unison/wizard-seed.json`) is the durable
// record of every wizard selection (business name, industry, tagline, social
// links, intents). Template compositions ship with neutral sample copy —
// without this overlay, sub-pages render generic "Brand" / "Welcome" content
// even though the seed file is present in the VFS. This helper threads seed
// values into a TemplateComposition immediately before it is split into per-
// section files, so every page hash route reflects the wizard selections.
//
// Substitution rules (conservative — never clobber rich AI/user content):
//   • navbar/footer `brand`              → always overwritten with seed.business.name
//   • hero `headline` (empty/placeholder)→ filled from seed.business.tagline
//   • hero `subheadline` (empty)         → filled from seed.business.tagline
//   • contact email / phone (empty)      → filled from seed.socials
//   • footer copyright (empty)           → filled with `© <year> <brand>`
//   • any string field containing the literal `{{businessName}}` is replaced
// ============================================================================

const BRAND_PLACEHOLDER_RE = /\{\{\s*businessName\s*\}\}/gi;
const TEMPLATE_BRAND_LITERALS = new Set([
  'Brand', 'BRAND', 'Your Brand', 'Your Business', 'Acme', 'Acme Inc.',
  'Company', 'Your Company', 'Lorem', 'Lorem Ipsum',
]);

function isBlank(value: unknown): boolean {
  return typeof value !== 'string' || value.trim().length === 0;
}

function looksLikePlaceholder(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (trimmed.length === 0) return true;
  return TEMPLATE_BRAND_LITERALS.has(trimmed);
}

function substituteBrandTokens<T>(value: T, brand: string): T {
  if (typeof value === 'string') {
    return value.replace(BRAND_PLACEHOLDER_RE, brand) as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => substituteBrandTokens(item, brand)) as unknown as T;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = substituteBrandTokens(v, brand);
    }
    return out as T;
  }
  return value;
}

function collectTemplateBrandLiterals(composition: TemplateComposition): string[] {
  return [...new Set(composition.sections.flatMap((section) => {
    if (section.type !== 'navbar' && section.type !== 'footer') return [];
    const value = (section.props as Record<string, unknown> | undefined)?.brand;
    return typeof value === 'string' && value.trim() ? [value.trim()] : [];
  }))];
}

function replaceTemplateBrandLiterals<T>(value: T, templateBrands: readonly string[], brand: string): T {
  if (typeof value === 'string') {
    return templateBrands.reduce(
      (result, templateBrand) => result.split(templateBrand).join(brand),
      value,
    ) as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => replaceTemplateBrandLiterals(item, templateBrands, brand)) as unknown as T;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
      out[key] = replaceTemplateBrandLiterals(nestedValue, templateBrands, brand);
    }
    return out as T;
  }
  return value;
}

interface NormalizedSeed {
  brand?: string;
  tagline?: string;
  industry?: string;
  email?: string;
  phone?: string;
  address?: string;
  socials?: Array<{ platform?: string; href?: string }>;
  /** Real business media projected into the seed (M6 asset → slot binding). */
  media?: SeedMediaAsset[];
}

function normalizeWizardSeed(seed: Record<string, unknown> | undefined): NormalizedSeed {
  if (!seed || typeof seed !== 'object') return {};
  const business = (seed.business as Record<string, unknown> | undefined) || {};
  const generation = (seed.generation as Record<string, unknown> | undefined) || {};
  const topLevelSocials = Array.isArray(seed.socials) ? seed.socials : [];
  const legacySocials = Array.isArray(generation.socials) ? generation.socials : [];
  const socials = (topLevelSocials.length > 0 ? topLevelSocials : legacySocials) as Array<{
    platform?: string;
    href?: string;
    email?: string;
    phone?: string;
  }>;
  const findSocial = (kind: string) =>
    socials.find((s) => String(s?.platform || '').toLowerCase() === kind)?.href;
  return {
    brand: typeof business.name === 'string' ? business.name : undefined,
    tagline: typeof business.tagline === 'string' ? business.tagline : undefined,
    industry: typeof business.industry === 'string' ? business.industry : undefined,
    email: findSocial('email') || (socials.find((s) => s.email)?.email as string | undefined),
    phone: findSocial('phone') || (socials.find((s) => s.phone)?.phone as string | undefined),
    address: findSocial('address'),
    socials,
    media: buildSeedMediaLibrary(
      (Array.isArray((seed.media as { assets?: unknown })?.assets)
        ? ((seed.media as { assets: unknown[] }).assets)
        : []) as Array<Record<string, unknown>>,
    ),
  };
}

function applyWizardSeedToComposition(
  composition: TemplateComposition,
  plan: GeneratedSitePlan,
): TemplateComposition {
  const seed = normalizeWizardSeed(
    (plan as GeneratedSitePlan & { wizardSeed?: Record<string, unknown> }).wizardSeed,
  );
  const brand = seed.brand?.trim() || plan.businessName.trim();
  const mediaLibrary = seed.media || [];
  const mediaSeedKey = `${composition.id}:${plan.selectedThemePresetId || ''}:${plan.industry || ''}`;
  const withMedia = (result: TemplateComposition) => {
    const bound = bindMediaToComposition(result, mediaLibrary, mediaSeedKey);
    // The Resolved Artifact Catalog is the runtime media authority: surface any
    // required media slot it cannot satisfy instead of shipping a blank frame.
    if (bound.report.catalog) {
      for (const violation of assertArtifactCatalogClosure(bound.report.catalog)) {
        console.warn(`[artifact-catalog] ${violation}`);
      }
    }
    return bound.composition;
  };
  if (!brand && !seed.tagline && !seed.email && !seed.phone) return withMedia(composition);

  // Template brand copy is sample data. Replace it across the full composition
  // before deriving route-specific pages so Wizard identity remains canonical.
  const templateBrands = collectTemplateBrandLiterals(composition);
  let nextSections = brand
    ? composition.sections.map((section) => replaceTemplateBrandLiterals(
        substituteBrandTokens(section, brand),
        templateBrands,
        brand,
      ))
    : composition.sections.slice();

  // 2. Per-section structural overrides for brand-critical fields.
  nextSections = nextSections.map((section) => {
    const props = { ...(section.props as Record<string, unknown> | undefined) } as Record<string, unknown>;
    switch (section.type) {
      case 'navbar':
      case 'footer': {
        if (brand) props.brand = brand;
        if (section.type === 'footer') {
          if (isBlank(props.copyright) && brand) {
            props.copyright = `© ${new Date().getFullYear()} ${brand}. All rights reserved.`;
          }
          if (isBlank(props.tagline) && seed.tagline) {
            props.tagline = seed.tagline;
          }
          // Merge wizard-seed socials into footer.socials so that the runtime
          // Footer renders lucide icons even when the composition step was
          // bypassed. Seed uses `href`; Footer runtime uses `url`.
          if (Array.isArray(seed.socials) && seed.socials.length > 0) {
            const byPlatform = new Map<string, { platform: string; url: string }>();
            for (const s of seed.socials) {
              const p = String(s?.platform || '').toLowerCase();
              if (!p) continue;
              const url = s.href || (s as { url?: string }).url;
              if (!url) continue;
              byPlatform.set(p, { platform: p, url });
            }
            props.socials = Array.from(byPlatform.values());
          }
        }
        break;
      }
      case 'hero': {
        if (looksLikePlaceholder(props.headline) && seed.tagline) {
          props.headline = seed.tagline;
        }
        if (isBlank(props.subheadline) && seed.tagline) {
          props.subheadline = seed.tagline;
        }
        break;
      }
      case 'contact': {
        if (isBlank(props.email) && seed.email) props.email = seed.email;
        if (isBlank(props.phone) && seed.phone) props.phone = seed.phone;
        if (isBlank(props.address) && seed.address) props.address = seed.address;
        if (isBlank(props.headline) && brand) {
          props.headline = `Contact ${brand}`;
        }
        break;
      }
      default:
        break;
    }
    return { ...section, props } as SectionEntry;
  });

  return withMedia({ ...composition, name: brand || composition.name, sections: nextSections });
}


/**
 * Build a synthetic sub-composition for a given page role by filtering the
 * template's source sections through the per-role pool.
 *
 * **Authority rule (Execution Hierarchy):** SiteBundle / template composition
 * owns section *presence* and *count*. The role pool is used **only as a filter
 * set** — we iterate every section in `template.sections` in source order and
 * keep it if its type is allowed for this role. This preserves repeated
 * sections (e.g. multiple feature-card grids, product collections, gallery
 * tiles) and their full `items` / `cards` / `products` / `layout` payloads.
 *
 * Previously this function used a `Map<SectionType, SectionEntry>` with
 * "first match wins", collapsing every duplicate into a single section and
 * producing sparse skeleton pages regardless of bundle richness. Do not
 * reintroduce that pattern.
 *
 * Returns null if no usable sections can be assembled (caller falls back to spinner).
 */
function buildRoleComposition(
  template: TemplateComposition,
  role: PageRole,
  page: PageRouteNode,
  plan: GeneratedSitePlan,
  options?: ScaffoldOptions,
): TemplateComposition | null {
  const definition = template.pageCompositions?.[role as TemplatePageRole];
  if ((page.isHome || role === 'home') && !definition) return template.sections.length > 0 ? template : null;

  let selectedAlternative: import('@/sections/types').TemplatePageAlternative | undefined;
  if (definition) {
    const alternatives = definition.alternatives.filter(alternative =>
      !alternative.themePresetIds || alternative.themePresetIds.includes(plan.selectedThemePresetId || ''));
    if (!alternatives.length) {
      if ((page.isHome || role === 'home') && template.sections.length > 0) return template;
      throw new PreviewPipelineError('vfs', `No eligible ${role} composition for ${template.id}.`);
    }
    const seed = options?.designIntervention?.seed || 'default';
    selectedAlternative = alternatives[stableStringHash(`${template.id}:${role}:${plan.selectedThemePresetId || ''}:${seed}`) % alternatives.length];
    const inventorySections = [...template.sections, ...definition.sections];
    const inventory = new Map(inventorySections.map(section => [section.id, section]));
    if (inventory.size !== inventorySections.length || new Set(definition.alternatives.map(alternative => alternative.id)).size !== definition.alternatives.length) {
      throw new PreviewPipelineError('vfs', `Duplicate composition identity in ${template.id}/${role}.`);
    }
    if (selectedAlternative.heroVariantId && !getVariantsForSection('hero').some(variant => variant.id === selectedAlternative!.heroVariantId)) {
      throw new PreviewPipelineError('vfs', `Unknown hero variant in ${selectedAlternative.id}.`);
    }
    const sections = selectedAlternative.sectionIds.map(sectionId => {
      const section = inventory.get(sectionId);
      if (!section) throw new PreviewPipelineError('vfs', `Unknown section ${sectionId} in ${selectedAlternative!.id}.`);
      return section;
    });
    if (!sections.length || new Set(selectedAlternative.sectionIds).size !== sections.length) {
      throw new PreviewPipelineError('vfs', `Invalid ordered sections in ${selectedAlternative.id}.`);
    }
    if ((role === 'pricing' || role === 'faq') && !sections.some(section => section.type === role)) {
      throw new PreviewPipelineError('vfs', `Missing ${role} section in ${selectedAlternative.id}.`);
    }
    template = applyWizardSeedToComposition({ ...template, sections }, plan);
  }

  // The canonical Industry Matrix owns each interior page's section contract.
  // Honour it ahead of the generic role pool so an industry's authored route
  // (coaching /programs, contractor /projects) keeps its declared shape.
  const contractTypes = (
    getIndustryProfile(plan.industry)?.defaultPages.find((spec) => spec.path === page.route)
      ?.expectedSections ?? []
  ) as SectionType[];
  // The industry matrix is the route contract. A template-authored pool can
  // enrich that contract, but may not remove declared route sections.
  const authoredPool = template.sectionPool?.[role as TemplatePageRole];
  const rolePool: SectionType[] =
    authoredPool ??
    DEFAULT_ROLE_SECTION_POOL[role] ??
    DEFAULT_ROLE_SECTION_POOL.custom;
  const rawPool = contractTypes.length > 0
    ? [...contractTypes, ...rolePool.filter((type) => !contractTypes.includes(type))]
    : rolePool;
  const hasNavbar = rawPool.includes('navbar');
  const hasHero = rawPool.includes('hero');
  const hasFooter = rawPool.includes('footer');
  const bodyTypes = rawPool.filter((type) => type !== 'navbar' && type !== 'hero' && type !== 'footer');
  const poolList: SectionType[] = [
    ...(hasNavbar ? (['navbar'] as SectionType[]) : []),
    ...(hasHero ? (['hero'] as SectionType[]) : []),
    ...bodyTypes,
    ...(hasFooter ? (['footer'] as SectionType[]) : []),
  ];
  const allowedTypes = new Set<SectionType>(poolList);
  const alternateMedia = !page.isHome ? collectAlternateHeroMedia(template) : [];
  const alternateHeroMedia = alternateMedia[stableStringHash(page.id) % Math.max(1, alternateMedia.length)];

  // Iterate template sections in source order and keep every section whose
  // type is in the allowed set. Duplicates are preserved with unique ids so
  // React keys + intent slots stay distinct. All section payload fields
  // (items, cards, products, gallery, layout, props) are passed through.
  const routeSeed = options?.designIntervention?.seed || 'default';
  const routeDesign = stableStringHash(template.id + ':' + role + ':' + routeSeed) % 2 === 0 ? 'editorial' : 'showcase';
  let routeDesignApplied = false;
  const filtered: SectionEntry[] = [];
  const typeCounters = new Map<SectionType, number>();
  const selectedSourceIds = new Set<string>();
  const appendSection = (source: SectionEntry) => {
    const idx = typeCounters.get(source.type) ?? 0;
    typeCounters.set(source.type, idx + 1);
    const props = { ...(source.props as Record<string, unknown>) };
    const routeHeroVariant = source.type === 'hero'
      ? getVariantsForSection('hero').find((variant) => selectedAlternative?.heroVariantId
        ? variant.id === selectedAlternative.heroVariantId
        : variant.pageRoles?.includes(role as TemplatePageRole))
      : undefined;
    if (source.type === 'hero' && !page.isHome) {
      const roleLabel = page.title.trim() || page.role.replace(/_/g, ' ');
      props.headline = roleLabel;
      props.subheadline = `Explore ${roleLabel.toLowerCase()} from ${template.name}.`;
      props.badge = ROLE_EYEBROWS[role] || roleLabel;
      if (alternateHeroMedia) {
        if (typeof props.image === 'string') props.image = alternateHeroMedia;
        else props.backgroundImage = alternateHeroMedia;
      }
    }
    // Derive page design from certified variants in the existing registry.
    // Explicit page compositions retain their authored choices and data.
    const routeCandidates = !definition && source.type !== 'hero'
      ? getVariantsForSection(source.type).filter(variant =>
        variant.vfs?.certification === 'approved' &&
        variant.tags?.includes('route-design') &&
        variant.tags.includes('page-design:' + routeDesign) &&
        variant.pageRoles?.includes(role as TemplatePageRole))
      : [];
    const routeVariant = routeCandidates.length
      ? routeCandidates[stableStringHash(template.id + ':' + role + ':' + source.id + ':' + routeSeed) % routeCandidates.length]
      : undefined;
    if (routeVariant) routeDesignApplied = true;
    filtered.push({
      ...source,
      ...(routeVariant ? { variantId: routeVariant.id } : {}),
      id: definition ? `${page.id}-${source.id}` : `${page.id}-${source.type}-${idx}`,
      sourceSectionId: source.sourceSectionId || source.id,
      ...(routeHeroVariant ? { variantId: routeHeroVariant.id } : {}),
      props: props as SectionEntry['props'],
    });
    selectedSourceIds.add(source.id);
  };
  for (const source of template.sections) {
    if (!definition && !allowedTypes.has(source.type)) continue;
    appendSection(source);
  }

  // The role pool can declare a section type the Home composition never
  // contains. Provision it from the industry starter registry instead of
  // silently dropping the industry's page contract.
  if (!page.isHome) {
    const presentTypes = new Set(filtered.map((section) => section.type));
    // Explicit template compositions retain their authored section order, but
    // still receive any body family required by the industry route contract.
    const requiredTypes = definition ? contractTypes : poolList;
    for (const type of requiredTypes) {
      if (type === 'navbar' || type === 'footer' || presentTypes.has(type)) continue;
      const starter = createIndustryStarterSection(plan.industry, type, {
        businessName: plan.businessName || template.name,
        pageTitle: page.title,
        idPrefix: `${template.id}-${page.id}-pool`,
      });
      if (!starter) continue;
      appendSection(starter);
      // Contract supplements must remain body content. Preserve the explicit
      // alternative's order while keeping its footer as the terminal section.
      const appended = filtered.pop();
      const footerIndex = filtered.findIndex((section) => section.type === 'footer');
      if (appended && footerIndex >= 0) filtered.splice(footerIndex, 0, appended);
      else if (appended) filtered.push(appended);
      presentTypes.add(type);
    }
  }

  if (!definition && !page.isHome && filtered.length < MINIMUM_ROUTE_BODY_SECTIONS) {
    const priority = ROLE_SUPPLEMENT_PRIORITY[role] || ROLE_SUPPLEMENT_PRIORITY.custom;
    const candidates = template.sections
      .map((section, index) => ({ section, index, priority: priority.indexOf(section.type) }))
      .filter(({ section }) => (
        section.type !== 'navbar' && section.type !== 'footer' && section.type !== 'hero' && !selectedSourceIds.has(section.id)
      ))
      .sort((left, right) => {
        const leftPriority = left.priority === -1 ? Number.MAX_SAFE_INTEGER : left.priority;
        const rightPriority = right.priority === -1 ? Number.MAX_SAFE_INTEGER : right.priority;
        return leftPriority - rightPriority || left.index - right.index;
      });
    for (const { section } of candidates) {
      appendSection(section);
      if (filtered.length >= MINIMUM_ROUTE_BODY_SECTIONS) break;
    }
  }

  // Canonical page hierarchy: on interior pages, enforce poolList rank so navbar is index 0,
  // hero is index 1, content follows hero, conversion/forms precede footer, and footer is last.
  if (!definition && !page.isHome) {
    const rank = (type: SectionType) => {
      const index = poolList.indexOf(type);
      return index === -1 ? poolList.length : index;
    };
    filtered.sort((left, right) => rank(left.type) - rank(right.type));
    const footers = filtered.filter((section) => section.type === 'footer');
    for (const footer of footers) filtered.splice(filtered.indexOf(footer), 1);
    filtered.push(...footers);
  }

  if (filtered.length === 0) return null;

  return {
    ...template,
    id: `${template.id}--${role}`,
    pageRole: role as TemplatePageRole,
    name: `${template.name} · ${page.title}`,
    compositionAlternativeId: selectedAlternative?.id ?? (routeDesignApplied ? `${template.id}:${role}:${routeDesign}` : undefined),
    sections: filtered,
  };
}

function stableStringHash(value: string): number {
  let hash = 0;
  for (const character of value) hash = ((hash << 5) - hash + character.charCodeAt(0)) | 0;
  return Math.abs(hash);
}

function collectAlternateHeroMedia(template: TemplateComposition): string[] {
  const media = new Set<string>();
  for (const section of template.sections) {
    if (section.type === 'hero') continue;
    const props = section.props as Record<string, unknown>;
    for (const key of ['image', 'backgroundImage']) {
      if (typeof props[key] === 'string' && props[key]) media.add(props[key]);
    }
    if (Array.isArray(props.items)) {
      for (const item of props.items) {
        if (item && typeof item === 'object' && typeof (item as Record<string, unknown>).image === 'string') {
          media.add((item as Record<string, string>).image);
        }
      }
    }
  }
  return [...media];
}


// ============================================================================
// Core: Scaffold missing pages from topology
// ============================================================================

/**
 * Given a site plan and existing VFS files, returns a map of files that
 * need to be created to satisfy the topology.
 *
 * When `template` is provided (or resolvable from the plan), missing pages
 * are scaffolded as role-filtered slices of the template's composition via
 * `buildRoleComposition` + `compositionToReactCode`, so sub-pages added
 * post-wizard inherit the same section vocabulary and styling as the seed
 * `/src/App.tsx`. Without a usable composition, this throws; wizard previews
 * must never render spinner/minimal placeholders that mask a broken SiteBundle.
 */
export function scaffoldMissingTopologyPages(
  plan: GeneratedSitePlan,
  existingFiles: Record<string, string>,
  template?: TemplateComposition | null,
  options?: ScaffoldOptions,
): Record<string, string> {
  const out: Record<string, string> = {};
  const activeTemplate = applyPlanThemeToTemplate(template ?? resolveActiveTemplate(plan), plan);
  const missing = getMissingTopologyPages(plan, existingFiles);

  const blocked: string[] = [];
  for (const page of missing) {
    const compositional = tryComposeTopologyPageFiles(page, plan, activeTemplate, options);
    if (compositional) {
      Object.assign(out, compositional);
      continue;
    }
    blocked.push(page.filePath);
  }

  if (blocked.length > 0) {
    throw new PreviewPipelineError(
      'vfs',
      `SiteBundleSnapshot has no composition for ${blocked.length} wizard page(s); refusing to emit minimal scaffold.`,
      { blockedFiles: blocked, recoverableByRelaunch: true },
    );
  }

  return out;
}


/**
 * Scaffold missing pages AND regenerate the canonical router (App.tsx).
 * This is the preferred entry point — it guarantees every scaffolded
 * page is also routable in the preview.
 */
export function scaffoldMissingTopologyPagesWithRouter(
  plan: GeneratedSitePlan,
  existingFiles: Record<string, string>,
  registry: PageRegistry,
  template?: TemplateComposition | null,
  options?: ScaffoldOptions,
): Record<string, string> {
  const newFiles = scaffoldMissingTopologyPages(plan, existingFiles, template, options);

  const registryPages = Object.values(registry.pages);
  const routerCode = registryPages.length > 0
    ? generateCanonicalRouter(registry, plan.businessName)
    : generateCanonicalRouterFromPlan(plan);

  if (routerCode) {
    newFiles['/src/App.tsx'] = routerCode;
  }

  return newFiles;
}

/**
 * Check which topology pages are missing from the VFS.
 */
export function getMissingTopologyPages(
  plan: GeneratedSitePlan,
  existingFiles: Record<string, string>
): PageRouteNode[] {
  return plan.pages.filter(p => !existingFiles[p.filePath]);
}

// ============================================================================
// Page Generator
// ============================================================================

/**
 * Generate a page file (LEGACY: single self-contained string) for a topology
 * node. Retained for callers that need a single string (Builder reference,
 * sectionSwapper). Wizard scaffolding uses `generateTopologyPlaceholderFiles`
 * to emit per-component files for navigability.
 */
export function generateTopologyPlaceholder(
  page: PageRouteNode,
  plan: GeneratedSitePlan,
  template?: TemplateComposition | null
): string {
  const composed = tryComposeTopologyPage(page, plan, template);
  if (composed) return composed;
  throw new PreviewPipelineError(
    'vfs',
    `SiteBundleSnapshot has no composition for page "${page.title}" (${page.filePath}); refusing to emit minimal scaffold.`,
    { blockedFiles: [page.filePath], recoverableByRelaunch: true },
  );
}

/**
 * Multi-file variant. Returns the page file + extracted section components
 * under `/src/components/`. Throws PreviewPipelineError if no composition.
 */
export function generateTopologyPlaceholderFiles(
  page: PageRouteNode,
  plan: GeneratedSitePlan,
  template?: TemplateComposition | null,
  options?: ScaffoldOptions,
): Record<string, string> {
  const composed = tryComposeTopologyPageFiles(page, plan, template, options);
  if (composed) return composed;
  throw new PreviewPipelineError(
    'vfs',
    `SiteBundleSnapshot has no composition for page "${page.title}" (${page.filePath}); refusing to emit minimal scaffold.`,
    { blockedFiles: [page.filePath], recoverableByRelaunch: true },
  );
}

/**
 * Attempt to compose a page (single-string form) from the active template.
 * Returns null when composition is unavailable.
 */
export function tryComposeTopologyPage(
  page: PageRouteNode,
  plan: GeneratedSitePlan,
  template?: TemplateComposition | null,
  options?: ScaffoldOptions,
): string | null {
  const active = applyPlanThemeToTemplate(template ?? resolveActiveTemplate(plan), plan);
  if (!active) return null;
  const seeded = applyWizardSeedToComposition(active, plan);
  const sub = buildRoleComposition(seeded, page.role, page, plan, options);
  if (!sub) return null;
  try {
    return compositionToReactCode(sub);
  } catch {
    return null;
  }
}

/**
 * Attempt to compose a page (multi-file form). Emits the page module plus
 * the shared `/src/components/*` files. Section component files are
 * idempotent across pages within a generation — safe to merge by Object.assign.
 */
export function tryComposeTopologyPageFiles(
  page: PageRouteNode,
  plan: GeneratedSitePlan,
  template?: TemplateComposition | null,
  options?: ScaffoldOptions,
): Record<string, string> | null {
  const active = applyPlanThemeToTemplate(template ?? resolveActiveTemplate(plan), plan);
  if (!active) return null;
  const seeded = applyWizardSeedToComposition(active, plan);
  const sub = buildRoleComposition(seeded, page.role, page, plan, options);
  if (!sub) return null;
  try {
    const pageIndex = [...plan.pages]
      .sort((a, b) => Number(b.isHome) - Number(a.isHome) || a.filePath.localeCompare(b.filePath))
      .findIndex(candidate => candidate.filePath === page.filePath);
    const { maxCanvasRootsPerPage, maxHeavyScenesPerSite } = EXPERIENCE_PERFORMANCE_BUDGET;
    return compositionToReactFileSet(sub, page.filePath, {
      designIntervention: options?.designIntervention,
      // Reserve a stable share of the existing site budget, with home first.
      enhancementCanvasBudget: pageIndex < 0 ? 0 : Math.max(0,
        Math.min(maxCanvasRootsPerPage, maxHeavyScenesPerSite - pageIndex * maxCanvasRootsPerPage)),
    });
  } catch (error) {
    if (options?.designIntervention?.compositionPlan) throw error;
    return null;
  }
}



function extractComponentName(filePath: string): string {
  const fileName = filePath.split('/').pop()?.replace('.tsx', '') || 'Page';
  return fileName.charAt(0).toUpperCase() + fileName.slice(1);
}

/**
 * Returns the list of non-home pages from a topology plan
 * that need AI generation (missing from VFS).
 *
 * Note: when a template-driven scaffold is in play, these pages already have
 * real industry composition content — AI is only needed if the user explicitly
 * asks to enrich them.
 */
export function getTopologyPagesForAIGeneration(
  plan: GeneratedSitePlan,
  existingFiles: Record<string, string>
): PageRouteNode[] {
  return plan.pages.filter(p => !existingFiles[p.filePath] && !p.isHome);
}
