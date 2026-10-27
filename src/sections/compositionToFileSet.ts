import { applyAIPageComposition, validateAIPageComposition, COMPOSITION_ROLES } from '@/sections/aiPageComposition';
import { SECTION_FAMILY_EMIT, layoutVariantMap, certifiedDefaultVariantId, type SectionFamilyEmit } from './resolveSectionLayout';
const cardClass = 'ut-foundation-card bg-card text-card-foreground';
/**
 * compositionToReactFileSet — Splits a TemplateComposition into multiple
 * VFS files so inexperienced users can navigate per-section components.
 *
 * Output layout (flat, per user preference):
 *   /src/components/theme.ts         — THEME tokens + style helpers
 *   /src/components/SiteLayout.tsx   — shared layout wrapper (body + global CSS)
 *   /src/components/SocialIcon.tsx   — social icon picker
 *   /src/components/Navbar.tsx       — section component
 *   /src/components/Hero.tsx         — section component
 *   /src/components/Services.tsx     — section component (also used for features/pricing/gallery/etc.)
 *   /src/components/Testimonials.tsx — section component
 *   /src/components/CTA.tsx          — section component
 *   /src/components/Contact.tsx      — section component
 *   /src/components/Footer.tsx       — section component
 *   /src/components/Stats.tsx        — section component
 *   /src/components/Team.tsx         — section component
 *   /src/components/FAQ.tsx          — section component
 *   /src/components/SectionMap.ts    — section type → component map
 *   <pageFilePath>                   — page module: SECTIONS data + render loop
 *
 * SECTIONS data stays inline in the page file so existing tooling
 * (sectionSwapper, compositionInvariants, JSX edit pipeline) keeps working.
 *
 * Shared theme/component files are identical across pages within a generation
 * (themePresetId is plan-wide), so emitting them per page is idempotent —
 * subsequent pages overwrite with byte-equal content.
 */

import type { TemplateComposition, SectionType } from './types';
import { resolveImplementationId } from '@/services/designImplementationRegistry';
import { compilerOwnershipHash } from '@/platform/core/resolvedComposition';
export { compilerOwnershipHash } from '@/platform/core/resolvedComposition';
import { emitCompositionEnhancements, resolveCompositionEnhancements } from './compositionEnhancements';
import {
  RESOLVED_COMPOSITION_VERSION,
  resolvedCompositionPathFor,
  serializeResolvedComposition,
  type ResolvedPageComposition,
} from '@/platform/core/resolvedComposition';
import type { WizardDesignIntervention } from '@/services/wizardDesignIntervention';
import { getGenerationVariantsForSection, getLayoutForVariantId, getVariantById } from '@/sections/variants';
import { selectAffineVariant } from '@/sections/compositionAffinity';
import type { VariantId } from '@/sections/variants';
import heroPageIntroSource from '@/sections/variants/hero/HeroPageIntro.tsx?raw';
import stylexRecipes from './recipes/stylexRecipes.generated.json';
import { clampVariantToPack, resolveArtDirectionPack, resolveHeroPresentation } from '@/sections/variants';
import type { HeroLayoutId } from '@/sections/variants';
import * as ts from 'typescript';

/**
 * The pack's hero signature is richer than the section schema's three layouts,
 * so it is projected down deterministically. Same pack in, same layout out.
 */
const HERO_LAYOUT_TO_SECTION_LAYOUT: Record<HeroLayoutId, 'centered' | 'split' | 'full-bleed'> = {
  'full-bleed': 'full-bleed',
  poster: 'full-bleed',
  split: 'split',
  asymmetric: 'split',
  centered: 'centered',
  'stacked-editorial': 'centered',
};

/**
 * The slice of the wizard design brief the section compiler consumes.
 * `artDirectionPackId` is the SEALED pack — when present it wins outright.
 * `industry` + `themePresetId` + `seed` only re-derive it for legacy briefs.
 */
export type DesignInterventionSlice =
  Pick<WizardDesignIntervention, 'sectionVariants'>
  & Partial<Pick<
    WizardDesignIntervention,
    'activeVariants' | 'motionRecipes' | 'industry' | 'themePresetId' | 'layoutRecipe'
    | 'interactionRecipes' | 'artDirectionPackId' | 'seed' | 'envelope' | 'compositionPolicy' | 'compositionPlan'
  >>;

export interface CompositionCompileOptions {
  designIntervention?: DesignInterventionSlice;
  enhancementCanvasBudget?: number;
}

import {
  CATALOG_HYDRATION_MODULE,
  CATALOG_HYDRATION_PATH,
  HYDRATABLE_SECTION_TYPES,
} from './catalogHydrationModule';
import {
  FORM_RUNTIME_MODULE,
  FORM_RUNTIME_PATH,
} from './formRuntimeModule';
import {
  PUBLISHED_ACTION_RUNTIME_MODULE,
  PUBLISHED_ACTION_RUNTIME_PATH,
} from './publishedActionRuntimeModule';

const THEME_PATH = '/src/components/theme.ts';
const LAYOUT_PATH = '/src/components/SiteLayout.tsx';
const SOCIAL_PATH = '/src/components/SocialIcon.tsx';
const SECTION_MAP_PATH = '/src/components/SectionMap.ts';

const SECTION_FILES: Record<string, string> = {
  AuthForm: '/src/components/AuthForm.tsx',
  DataTable: '/src/components/DataTable.tsx',
  Navbar: '/src/components/Navbar.tsx',
  Hero: '/src/components/Hero.tsx',
  About: '/src/components/About.tsx',
  Services: '/src/components/Services.tsx',
  Features: '/src/components/Features.tsx',
  Gallery: '/src/components/Gallery.tsx',
  Pricing: '/src/components/Pricing.tsx',
  LogoCloud: '/src/components/LogoCloud.tsx',
  BlogPreview: '/src/components/BlogPreview.tsx',
  BeforeAfter: '/src/components/BeforeAfter.tsx',
  Testimonials: '/src/components/Testimonials.tsx',
  CTA: '/src/components/CTA.tsx',
  Contact: '/src/components/Contact.tsx',
  Footer: '/src/components/Footer.tsx',
  Stats: '/src/components/Stats.tsx',
  Team: '/src/components/Team.tsx',
  FAQ: '/src/components/FAQ.tsx',
};

function themeModule(_template?: TemplateComposition): string {
  const semanticTheme = JSON.stringify({
    colors: {
      background: 'var(--background)',
      foreground: 'var(--foreground)',
      card: 'var(--card)',
      cardForeground: 'var(--card-foreground)',
      primary: 'var(--primary)',
      primaryForeground: 'var(--primary-foreground)',
      secondary: 'var(--secondary)',
      secondaryForeground: 'var(--secondary-foreground)',
      muted: 'var(--muted)',
      mutedForeground: 'var(--muted-foreground)',
      accent: 'var(--accent)',
      accentForeground: 'var(--accent-foreground)',
      border: 'var(--border)',
    },
    typography: {
      headingFont: 'var(--font-heading)',
      bodyFont: 'var(--font-body)',
      headingWeight: 'var(--ut-weight-display)',
      bodyWeight: 'var(--ut-weight-body)',
    },
    radius: 'var(--radius)',
    sectionPadding: 'var(--ut-section-padding, 6rem 0)',
    containerWidth: '72rem',
  }, null, 2);
  return `// Snapshot style adapter.
// Shared by every section component in /src/components/.
// Stage 4b /src/index.css is the sole visual-token authority.
export const THEME = ${semanticTheme} as const;

export const RESPONSIVE_CSS = \`
  *, *::before, *::after { box-sizing: border-box; }
  img, svg { max-width: 100%; height: auto; display: block; }
  .ut-grid { display: grid; gap: 1.5rem; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }
  .ut-grid-2 { grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); }
  @media (max-width: 720px) {
    .ut-nav-links { display: none !important; }
    .ut-hero-stats { gap: 1.5rem !important; }
    .ut-footer-grid { grid-template-columns: 1fr !important; gap: 2rem !important; }
    .ut-footer-bottom { flex-direction: column !important; gap: 1rem !important; text-align: center; }
  }
\`;
`;
}

function layoutModule(): string {
  return `import React, { useEffect } from 'react';
import { RESPONSIVE_CSS } from './theme';
import { usePublishedFormRuntime } from './formRuntime';
import { usePublishedActionRuntime } from './publishedActionRuntime';

/**
 * SiteLayout installs structural responsive rules and published runtimes.
 * Stage 4b remains the only owner of global presentation.
 */
export default function SiteLayout({ children, pageRole }: { children: React.ReactNode; pageRole?: string }) {
  usePublishedFormRuntime();
  usePublishedActionRuntime();
  useEffect(() => {
    const s = document.createElement('style');
    s.textContent = RESPONSIVE_CSS;
    document.head.appendChild(s);
    return () => { s.remove(); };
  }, []);

  // data-ut-page-role scopes the page archetype's rhythm and density, which
  // Stage 4b emits into index.css. Nothing else is page-scoped.
  return <div data-ut-page-role={pageRole || 'custom'}>{children}</div>;
}
`;
}

const SOCIAL_ICON_MODULE = `import React from 'react';
import { Instagram, Facebook, Twitter, Linkedin, Youtube, Github, Twitch, Dribbble, Figma, Globe } from '@/unison/ui/icons';

export interface SocialIconProps {
  platform: string;
  size?: number;
  className?: string;
  color?: string;
}

const isComponent = (comp: any): boolean =>
  typeof comp === 'function' || (typeof comp === 'object' && comp !== null);

export function SocialIcon({ platform, size = 16, className, color }: SocialIconProps) {
  const key = String(platform || '').toLowerCase().trim();
  const common = { size, className, color, 'aria-hidden': true } as const;

  const fallbackGlobe = (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>
    </svg>
  );

  const fallbackX = (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color || "currentColor"} aria-hidden="true" className={className}><path d="M18.244 2H21l-6.52 7.45L22 22h-6.83l-4.79-6.27L4.8 22H2l6.97-7.97L2 2h6.91l4.34 5.75L18.24 2zm-1.2 18h1.66L7.05 4H5.27l11.77 16z"/></svg>
  );

  const fallbackTikTok = (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color || "currentColor"} aria-hidden="true" className={className}><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5.8 20.1a6.34 6.34 0 0 0 10.86-4.43V8.83a8.16 8.16 0 0 0 4.77 1.52V6.94a4.85 4.85 0 0 1-1.84-.25z"/></svg>
  );

  const fallbackPinterest = (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color || "currentColor"} aria-hidden="true" className={className}><path d="M12 0a12 12 0 0 0-4.37 23.17c-.06-.94-.11-2.38.02-3.4.12-.93 1.27-5.93 1.27-5.93s-.32-.65-.32-1.6c0-1.5.87-2.62 1.95-2.62.92 0 1.36.69 1.36 1.51 0 .92-.59 2.3-.89 3.58-.25 1.07.54 1.95 1.6 1.95 1.92 0 3.4-2.03 3.4-4.95 0-2.59-1.86-4.4-4.52-4.4-3.08 0-4.89 2.31-4.89 4.7 0 .93.36 1.93.81 2.47.09.11.1.2.07.32-.08.34-.27 1.07-.31 1.22-.05.2-.16.24-.37.15-1.38-.64-2.25-2.66-2.25-4.28 0-3.49 2.53-6.69 7.3-6.69 3.83 0 6.81 2.73 6.81 6.38 0 3.81-2.4 6.87-5.74 6.87-1.12 0-2.18-.58-2.54-1.27 0 0-.55 2.11-.69 2.62-.25.96-.93 2.17-1.39 2.9A12 12 0 1 0 12 0z"/></svg>
  );

  const fallbackGithub = (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/></svg>
  );

  const fallbackLinkedin = (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect width="4" height="12" x="2" y="9"/><circle cx="4" cy="4" r="2"/></svg>
  );

  const fallbackTwitter = (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"/></svg>
  );

  if (key === 'instagram' || key === 'ig') return isComponent(Instagram) ? <Instagram {...common} /> : fallbackGlobe;
  if (key === 'facebook' || key === 'fb' || key === 'meta') return isComponent(Facebook) ? <Facebook {...common} /> : fallbackGlobe;
  if (key === 'twitter') return isComponent(Twitter) ? <Twitter {...common} /> : fallbackTwitter;
  if (key === 'x' || key === 'x.com') return fallbackX;
  if (key === 'linkedin' || key === 'in') return isComponent(Linkedin) ? <Linkedin {...common} /> : fallbackLinkedin;
  if (key === 'youtube' || key === 'yt') return isComponent(Youtube) ? <Youtube {...common} /> : fallbackGlobe;
  if (key === 'github' || key === 'gh') return isComponent(Github) ? <Github {...common} /> : fallbackGithub;
  if (key === 'twitch') return isComponent(Twitch) ? <Twitch {...common} /> : fallbackGlobe;
  if (key === 'dribbble') return isComponent(Dribbble) ? <Dribbble {...common} /> : fallbackGlobe;
  if (key === 'figma') return isComponent(Figma) ? <Figma {...common} /> : fallbackGlobe;
  if (key === 'tiktok') return fallbackTikTok;
  if (key === 'pinterest') return fallbackPinterest;
  return isComponent(Globe) ? <Globe {...common} /> : fallbackGlobe;
}

export function socialAriaLabel(platform: string): string {
  const key = String(platform || '').toLowerCase().trim();
  if (!key) return 'Social link';
  return 'Visit our ' + key.charAt(0).toUpperCase() + key.slice(1) + ' page';
}

export default SocialIcon;
`;

/**
 * Semantic type → sanctioned component family.
 *
 * INVARIANT: no cross-semantic substitution. A registered Gallery stays a
 * Gallery, Pricing stays Pricing, Features stays Features. When a composition
 * carries a semantic type with no sanctioned implementation the emitter fails
 * loudly (see assertSanctionedSectionTypes) so the page can be re-planned or
 * repaired by Lane B — it is never silently rendered as something else.
 */
const SECTION_COMPONENT_BY_TYPE: Record<string, keyof typeof SECTION_FILES> = {
  'auth-form': 'AuthForm', 'data-table': 'DataTable',
  navbar: 'Navbar', hero: 'Hero', about: 'About',
  services: 'Services', features: 'Features', pricing: 'Pricing', gallery: 'Gallery',
  'blog-preview': 'BlogPreview', 'before-after': 'BeforeAfter', testimonials: 'Testimonials',
  cta: 'CTA', contact: 'Contact', footer: 'Footer', stats: 'Stats',
  'logo-cloud': 'LogoCloud', team: 'Team', faq: 'FAQ',
};

export class UnsanctionedSectionTypeError extends Error {
  readonly sectionTypes: string[];
  constructor(pageFilePath: string, sectionTypes: string[]) {
    super(
      `[compositionToFileSet] page ${pageFilePath} declares section type(s) with no sanctioned component family: ` +
      `${sectionTypes.join(', ')}. Cross-semantic substitution is forbidden — re-plan the page or run a focused Lane B repair.`,
    );
    this.name = 'UnsanctionedSectionTypeError';
    this.sectionTypes = sectionTypes;
  }
}

function assertSanctionedSectionTypes(template: TemplateComposition, pageFilePath: string): void {
  const unsanctioned = Array.from(new Set(
    template.sections
      .map((section) => section.type)
      .filter((type) => !SECTION_COMPONENT_BY_TYPE[type]),
  ));
  if (unsanctioned.length) throw new UnsanctionedSectionTypeError(pageFilePath, unsanctioned);
}

/**
 * M4 — certified families are the only emitted implementation.
 *
 * Every section component emitted into the VFS resolves through the canonical
 * variant registry. There is no second, hand-authored "legacy" implementation
 * inlined next to it: double authoring is exactly what let a weak fallback win
 * whenever a layout token failed to resolve. Unresolvable layout tokens now
 * fall back to the family's certified default variant, never to a downgraded
 * design.
 */
function certifiedSectionModule(componentName: string, family: SectionFamilyEmit): string {
  const map = layoutVariantMap(family);
  const defaultVariantId = certifiedDefaultVariantId(componentName, family, map);
  return `import React from 'react';
import { REGISTERED_VARIANTS } from './recipes/${componentName}';
import { THEME } from './theme';

const LAYOUT_VARIANTS: Record<string, string> = ${JSON.stringify(map)};
const DEFAULT_VARIANT_ID = ${JSON.stringify(defaultVariantId)};

export default function ${componentName}({ props: explicitProps, variantId, sectionId, componentInstanceId, ...rest }: { props?: any; variantId?: string; sectionId?: string; componentInstanceId?: string; [key: string]: any }) {
  const renderId = React.useId();
  const props = explicitProps ?? rest;
  const requestedId = variantId || (props && LAYOUT_VARIANTS[props.layout]) || DEFAULT_VARIANT_ID;
  if (variantId && !Object.prototype.hasOwnProperty.call(REGISTERED_VARIANTS, variantId)) throw new Error('Unsupported ${componentName} variant: ' + variantId);
  const resolvedId = REGISTERED_VARIANTS[requestedId] ? requestedId : DEFAULT_VARIANT_ID;
  const Component = REGISTERED_VARIANTS[resolvedId];
  if (!Component) return null;
  return <div data-ut-section-id={sectionId || renderId} data-ut-section-type=${JSON.stringify(family.sectionType)} data-ut-variant={resolvedId} data-ut-component-instance-id={componentInstanceId || undefined}>
    <Component section={{ id: sectionId || renderId, type: ${JSON.stringify(family.sectionType)}, variantId: resolvedId, props }} theme={THEME} />
  </div>;
}
`;
}

/** Component name for a section type, or undefined when the type is not emittable. */
export function certifiedComponentForSectionType(sectionType: string): string | undefined {
  return SECTION_COMPONENT_BY_TYPE[sectionType];
}

const SECTION_MODULE_SOURCE: Record<keyof typeof SECTION_FILES, string> = Object.fromEntries(
  Object.keys(SECTION_FILES).map((componentName) => [
    componentName,
    certifiedSectionModule(componentName, SECTION_FAMILY_EMIT[componentName]),
  ]),
) as Record<keyof typeof SECTION_FILES, string>;




/**
 * Recovery Phase 2 — the emitter compiles, it does not reinterpret.
 *
 * Registered variants used to be downgraded into a per-section wrapper module
 * that reduced the variant to `<Component props={{...props, layout}} />`.
 * That threw away the variant identity at exactly the moment it mattered.
 * The section map is now a plain semantic-type → component family map; variant
 * identity travels intact on the section props and in the emitted
 * ResolvedPageComposition, where Lane B and the preflight can both read it.
 */
interface VariantSectionModule {
  path: string;
  componentName: string;
  content: string;
}

function sectionMapModule(template: TemplateComposition, pageFilePath: string): {
  path: string;
  content: string;
  components: Set<keyof typeof SECTION_FILES>;
  variantModules: VariantSectionModule[];
} {
  assertSanctionedSectionTypes(template, pageFilePath);
  const sectionTypes = Array.from(new Set(template.sections.map((section) => section.type)));
  const components = new Set(sectionTypes.map((type) => SECTION_COMPONENT_BY_TYPE[type]));
  const mapPath = pageFilePath.replace(/\.(tsx|jsx)$/i, '.sections.ts');
  const imports = Array.from(components)
    .map((component) => `import ${component} from '../components/${component}';`)
    .join('\n');
  const mappings = sectionTypes
    .map((type) => `${JSON.stringify(type)}: ${SECTION_COMPONENT_BY_TYPE[type]}`)
    .join(',\n  ');

  return {
    path: mapPath,
    components,
    variantModules: [],
    content: `import type React from 'react';
${imports}

export const SECTION_MAP: Record<string, React.ComponentType<{ props: any }>> = {
  ${mappings}
};
`,
  };
}

function resolveSnapshotSectionLayouts(template: TemplateComposition): TemplateComposition['sections'] {
  return template.sections.map((section) => {
    const props = { ...section.props } as Record<string, unknown>;
    if (typeof props.layout === 'string') return section;

    switch (section.type) {
      case 'navbar':
        props.layout = props.transparent === true ? 'centered-logo' : 'standard';
        break;
      case 'contact':
        props.layout = props.address || props.phone || props.email ? 'split-card' : 'centered';
        break;
      case 'footer': {
        const columns = Array.isArray(props.columns) ? props.columns : [];
        props.layout = props.newsletter === true
          ? 'dark-band'
          : (columns.length ? 'columns' : 'centered-minimal');
        break;
      }
      default:
        return section;
    }

    return { ...section, props: props as typeof section.props } as typeof section;
  });
}

/**
 * Recovery Phase 5 — design recipes are executable layout contracts.
 *
 * A wizard recipe never degrades into a vague layout word ("grid", "carousel").
 * It resolves to a registered, executable variant id whenever the variant
 * registry owns that section family; the legacy layout token is only used for
 * families that have no first-class variants yet (and is derived from the
 * variant, not hand-written, when one exists).
 */
const RECIPE_VARIANTS: Partial<Record<WizardDesignIntervention['sectionVariants'][number], {
  sectionTypes: string[];
  /** Executable variant id, preferred. */
  variantId?: VariantId;
  /** Only used when no first-class variant family exists yet. */
  layout?: string;
}>> = {
  'collage-hero': { sectionTypes: ['hero'], variantId: 'hero:full-bleed' },
  'split-media-hero': { sectionTypes: ['hero'], variantId: 'hero:split-image' },
  'proof-hero': { sectionTypes: ['hero'], variantId: 'hero:centered' },
  'bento-services': { sectionTypes: ['services'], variantId: 'services:card-grid' },
  'comparison-services': { sectionTypes: ['services'], variantId: 'services:alternating' },
  'gallery-lightbox': { sectionTypes: ['gallery'], variantId: 'gallery:lightbox-grid' },
  'testimonial-rail': { sectionTypes: ['testimonials'], variantId: 'testimonials:rail' },
  'pricing-accordion': { sectionTypes: ['pricing', 'faq'], variantId: 'pricing:accordion', layout: 'accordion' },
  'conversion-form': { sectionTypes: ['contact'], variantId: 'contact:split-card' },
};

/** Recipes targeting `features` reuse the services family intent. */
const FEATURES_RECIPE_VARIANTS: Partial<Record<string, VariantId>> = {
  'bento-services': 'features:grid',
  'comparison-services': 'features:icon-left',
};

function applyRecipe(
  section: TemplateComposition['sections'][number],
  recipes: readonly WizardDesignIntervention['sectionVariants'][number][],
) {
  for (const recipe of recipes) {
    const featureVariant = section.type === 'features' ? FEATURES_RECIPE_VARIANTS[recipe] : undefined;
    if (featureVariant) {
      return { variantId: featureVariant, layout: getLayoutForVariantId(featureVariant) };
    }
    const candidate = RECIPE_VARIANTS[recipe];
    if (!candidate?.sectionTypes.includes(section.type)) continue;
    const variantOwnsSection = candidate.variantId?.split(':')[0] === section.type;
    if (candidate.variantId && variantOwnsSection && getVariantById(candidate.variantId)) {
      return { variantId: candidate.variantId, layout: getLayoutForVariantId(candidate.variantId) };
    }
    if (candidate.layout) return { variantId: undefined, layout: candidate.layout };
  }
  return undefined;
}

/**
 * Recovery Phase 3 (R3) — the rest of the wizard vocabulary is executable too.
 *
 * `layoutRecipe` (page-level structural bias) and `interactionRecipes`
 * (what the visitor can actually do) used to be computed by the wizard, written
 * into the brief, and then dropped on the floor by the compiler. They now
 * resolve to registered variant ids exactly like `sectionVariants` does, so a
 * "floating navbar / image lightbox" brief compiles to a floating navbar and a
 * lightbox gallery instead of registry defaults.
 */
const LAYOUT_RECIPE_VARIANTS: Partial<Record<
  NonNullable<WizardDesignIntervention['layoutRecipe']>,
  Partial<Record<string, VariantId>>
>> = {
  'floating-navbar': { navbar: 'navbar:minimal-dark' },
  'collage-hero': { hero: 'hero:full-bleed', gallery: 'gallery:editorial-mosaic' },
  'bento-features': { features: 'features:grid', services: 'services:card-grid' },
  'media-card-grid': { gallery: 'gallery:masonry', features: 'features:grid', services: 'services:card-grid' },
  'conversion-form': { contact: 'contact:split-card', cta: 'cta:split-card' },
  'rich-footer': { footer: 'footer:columns' },
};

const INTERACTION_RECIPE_VARIANTS: Partial<Record<
  WizardDesignIntervention['interactionRecipes'][number],
  Partial<Record<string, VariantId>>
>> = {
  'image-lightbox': { gallery: 'gallery:lightbox-grid' },
  accordion: { pricing: 'pricing:accordion' },
};

/** Interaction tokens for families that have no first-class variants yet. */
const INTERACTION_RECIPE_LAYOUTS: Partial<Record<
  WizardDesignIntervention['interactionRecipes'][number],
  Partial<Record<string, string>>
>> = {
  accordion: { faq: 'accordion' },
  tabs: { faq: 'tabs' },
};

function resolveVariantForSectionType(
  sectionType: string,
  candidate: VariantId | undefined,
): VariantId | undefined {
  if (!candidate) return undefined;
  if (candidate.split(':')[0] !== sectionType) return undefined;
  return getVariantById(candidate) ? candidate : undefined;
}

/**
 * Interactions win over the page-level layout bias: a brief that asks for a
 * lightbox must produce a lightbox even when the layout recipe prefers a mosaic.
 */
function applyVocabularyRecipes(
  section: TemplateComposition['sections'][number],
  designIntervention?: DesignInterventionSlice,
): { variantId?: VariantId; layout?: string } | undefined {
  for (const interaction of designIntervention?.interactionRecipes || []) {
    const variantId = resolveVariantForSectionType(
      section.type,
      INTERACTION_RECIPE_VARIANTS[interaction]?.[section.type],
    );
    if (variantId) return { variantId, layout: getLayoutForVariantId(variantId) };
    const layout = INTERACTION_RECIPE_LAYOUTS[interaction]?.[section.type];
    if (layout) return { layout };
  }

  const layoutRecipe = designIntervention?.layoutRecipe;
  const variantId = layoutRecipe
    ? resolveVariantForSectionType(section.type, LAYOUT_RECIPE_VARIANTS[layoutRecipe]?.[section.type])
    : undefined;
  if (variantId) return { variantId, layout: getLayoutForVariantId(variantId) };

  return undefined;
}



/** Apply an explicit presentation operation to authored data without recomposing the page. */
export function updateResolvedCompositionVariants(
  source: string,
  previous: ResolvedPageComposition,
  nextOverrides: WizardDesignIntervention['activeVariants'],
  sourceFiles: Readonly<Record<string, string>> = { [previous.pageFilePath]: source },
) {
  const data = source.match(/const\s+SECTIONS\s*=\s*([\s\S]*?);\s*\r?\nconst\s+HYDRATABLE/);
  const previousOverrides = previous.variantOverrides ?? {};
  if (!data && previous.sections.length > 0 && previous.sections.every(section =>
    Boolean(section.sectionId && section.semanticType && section.variantId && section.primitiveId),
  )) {
    const candidateFiles = Object.entries(sourceFiles).filter(([path, content]) =>
      /\.(?:tsx|jsx|ts|js)$/i.test(path)
      && typeof content === 'string'
      && previous.sections.some(section => !section.sourcePath || section.sourcePath === path),
    );
    const parsedFiles = candidateFiles.map(([path, content]) => ({
      path,
      content,
      sourceFile: ts.createSourceFile(path, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX),
    }));
    const requested = new Map(previous.sections.flatMap(section => {
      const variantId = nextOverrides[section.sectionId];
      if (!variantId || previousOverrides[section.sectionId] === variantId) return [];
      const variant = getVariantById(variantId as VariantId);
      if (!variant || variant.sectionType !== section.semanticType) {
        throw new Error(`Cannot apply ${variantId} to ${section.sectionId} (${section.semanticType}).`);
      }
      if (!section.variantId || !section.primitiveId) {
        throw new Error(`Section ${section.sectionId} has no registered implementation identity.`);
      }
      return [[section.sectionId, {
        currentVariantId: section.variantId,
        variantId: variant.id,
        layout: getLayoutForVariantId(variant.id),
      }] as const];
    }));
    const matches = new Map<string, Array<{ path: string; content: string; sourceFile: ts.SourceFile; root: ts.JsxOpeningElement }>>();
    for (const parsed of parsedFiles) {
      const visit = (node: ts.Node) => {
        if (ts.isJsxOpeningElement(node)) {
          const idAttribute = node.attributes.properties.find((property): property is ts.JsxAttribute =>
            ts.isJsxAttribute(property) && property.name.getText(parsed.sourceFile) === 'data-ut-section-id');
          const id = idAttribute?.initializer;
          const sectionId = id && ts.isStringLiteral(id) ? id.text : null;
          if (sectionId && requested.has(sectionId)) {
            matches.set(sectionId, [...(matches.get(sectionId) ?? []), {
              path: parsed.path,
              content: parsed.content,
              sourceFile: parsed.sourceFile,
              root: node,
            }]);
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(parsed.sourceFile);
    }

    const editsByFile = new Map<string, { content: string; edits: Array<{ start: number; end: number; text: string }> }>();
    for (const [sectionId, update] of requested) {
      const candidates = matches.get(sectionId) ?? [];
      const roots = candidates.filter(candidate => !candidates.some(other =>
        other.path === candidate.path
        && other.root !== candidate.root
        && other.root.getStart(other.sourceFile) <= candidate.root.getStart(candidate.sourceFile)
        && other.root.getEnd() >= candidate.root.getEnd(),
      ));
      if (roots.length !== 1) throw new Error(`Cannot uniquely locate section ${sectionId} in ${previous.pageFilePath}.`);
      const target = roots[0];
      const { path: targetPath, content: targetSource, sourceFile, root } = target;
      const targetEdits = editsByFile.get(targetPath) ?? { content: targetSource, edits: [] };
      editsByFile.set(targetPath, targetEdits);
      const originalSection = previous.sections.find(section => section.sectionId === sectionId)!;
      if (originalSection.legacyRendererName) {
        const sectionElement = root.parent && ts.isJsxElement(root.parent) ? root.parent : null;
        if (!sectionElement || !originalSection.primitiveId || !originalSection.sourceModulePath || !originalSection.data) {
          throw new Error(`Section ${sectionId} lacks the migration metadata required for a safe variant swap.`);
        }
        const legacyRenderers: Array<ts.JsxOpeningLikeElement> = [];
        const findLegacyRenderer = (node: ts.Node) => {
          if (node !== root && (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node))) {
            const nestedId = node.attributes.properties.find((property): property is ts.JsxAttribute =>
              ts.isJsxAttribute(property) && property.name.getText(sourceFile) === 'data-ut-section-id');
            const nestedValue = nestedId?.initializer;
            if (nestedValue && ts.isStringLiteral(nestedValue) && nestedValue.text !== sectionId) return;
          }
          if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node))
            && node.tagName.getText(sourceFile) === originalSection.legacyRendererName) legacyRenderers.push(node);
          ts.forEachChild(node, findLegacyRenderer);
        };
        findLegacyRenderer(sectionElement);
        if (legacyRenderers.length !== 1) {
          throw new Error(`Cannot uniquely locate legacy renderer ${originalSection.legacyRendererName} for section ${sectionId}.`);
        }
        const legacyRenderer = legacyRenderers[0];
        const legacyElement = ts.isJsxOpeningElement(legacyRenderer) && legacyRenderer.parent && ts.isJsxElement(legacyRenderer.parent)
          ? legacyRenderer.parent
          : legacyRenderer;
        if (ts.isJsxOpeningElement(legacyRenderer)) {
          if (!ts.isJsxElement(legacyElement) || legacyElement.children.some(child =>
            !ts.isJsxText(child) || child.text.trim().length > 0,
          )) {
            throw new Error(`Legacy renderer ${originalSection.legacyRendererName} has children that cannot be migrated as section data.`);
          }
        }
        const dispatcher = originalSection.primitiveId;
        const modulePath = originalSection.sourceModulePath.replace(/^\/src\//, '@/').replace(/\.(?:tsx?|jsx?)$/i, '');
        const hasDispatcherImport = sourceFile.statements.some(statement =>
          ts.isImportDeclaration(statement)
          && ts.isStringLiteral(statement.moduleSpecifier)
          && statement.moduleSpecifier.text === modulePath
          && statement.importClause?.name?.text === dispatcher,
        );
        if (!hasDispatcherImport) {
          const imports = sourceFile.statements.filter(ts.isImportDeclaration);
          const insertAt = imports.length ? imports[imports.length - 1].getEnd() : 0;
          targetEdits.edits.push({
              start: insertAt,
              end: insertAt,
              text: `${insertAt ? '\n' : ''}import ${dispatcher} from ${JSON.stringify(modulePath)};\n`,
          });
        }
        targetEdits.edits.push({
          start: legacyElement.getStart(sourceFile),
          end: legacyElement.getEnd(),
          text: `<${dispatcher} sectionId=${JSON.stringify(sectionId)} variantId=${JSON.stringify(update.variantId)} props={${JSON.stringify(originalSection.data)}} />`,
        });
      } else {
      const rendererMatches: ts.JsxOpeningLikeElement[] = [];
      const sectionElement = root.parent && ts.isJsxElement(root.parent) ? root.parent : null;
      if (!sectionElement) throw new Error(`Section ${sectionId} has no renderer subtree.`);
      const visitRenderer = (node: ts.Node) => {
        if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
          if (node !== root) {
            const nestedId = node.attributes.properties.find((property): property is ts.JsxAttribute =>
              ts.isJsxAttribute(property) && property.name.getText(sourceFile) === 'data-ut-section-id');
            const nestedValue = nestedId?.initializer;
            if (nestedValue && ts.isStringLiteral(nestedValue) && nestedValue.text !== sectionId) return;
          }
          if (node.tagName.getText(sourceFile) === originalSection.primitiveId) {
            const variantAttribute = node.attributes.properties.find((property): property is ts.JsxAttribute =>
              ts.isJsxAttribute(property) && property.name.getText(sourceFile) === 'variantId');
            const initializer = variantAttribute?.initializer;
            if (initializer && ts.isStringLiteral(initializer) && initializer.text === update.currentVariantId) {
              rendererMatches.push(node);
            }
          }
        }
        ts.forEachChild(node, visitRenderer);
      };
      visitRenderer(sectionElement);
      if (rendererMatches.length !== 1) {
        throw new Error(`Section ${sectionId} must render exactly one ${originalSection.primitiveId} dispatcher for ${update.currentVariantId}.`);
      }

      const renderer = rendererMatches[0];
      const variantAttribute = renderer.attributes.properties.find((property): property is ts.JsxAttribute =>
        ts.isJsxAttribute(property) && property.name.getText(sourceFile) === 'variantId');
      if (!variantAttribute) throw new Error(`Section ${sectionId} has no variant selector.`);
      targetEdits.edits.push({
        start: variantAttribute.getStart(sourceFile),
        end: variantAttribute.getEnd(),
        text: `variantId=${JSON.stringify(update.variantId)}`,
      });
      }

      const values: Array<[string, string | undefined]> = [
        ['data-ut-variant', update.variantId],
        ['data-ut-layout', update.layout],
      ];
      const additions: string[] = [];
      for (const [name, value] of values) {
        const attribute = root.attributes.properties.find((property): property is ts.JsxAttribute =>
          ts.isJsxAttribute(property) && property.name.getText(sourceFile) === name);
        if (!value) {
          if (attribute) targetEdits.edits.push({ start: attribute.getStart(sourceFile), end: attribute.getEnd(), text: '' });
          continue;
        }
        const text = `${name}=${JSON.stringify(value)}`;
        if (attribute) targetEdits.edits.push({ start: attribute.getStart(sourceFile), end: attribute.getEnd(), text });
        else additions.push(text);
      }
      if (additions.length) targetEdits.edits.push({ start: root.attributes.end, end: root.attributes.end, text: ` ${additions.join(' ')}` });
    }

    const updatedSources: Record<string, string> = {};
    for (const [path, { content, edits }] of editsByFile) {
      let updated = content;
      for (const edit of edits.sort((a, b) => b.start - a.start)) {
        updated = `${updated.slice(0, edit.start)}${edit.text}${updated.slice(edit.end)}`;
      }
      updatedSources[path] = updated;
    }
    const sections = previous.sections.map(section => {
      const update = requested.get(section.sectionId);
      if (!update) return section;
      const { legacyRendererName: _legacyRendererName, ...migrated } = section;
      const sourcePath = editsByFile.size === 1 ? [...editsByFile.keys()][0] : section.sourcePath;
      return { ...migrated, ...(sourcePath ? { sourcePath } : {}), variantId: update.variantId, layoutRecipe: update.layout };
    });
    const composition: ResolvedPageComposition = {
      ...previous,
      compiledBy: 'app-builder',
      variantOverrides: { ...nextOverrides },
      sections,
    };
    return { source: updatedSources[previous.pageFilePath] ?? source, updatedSources, composition };
  }
  if (!data) throw new Error(`Cannot apply a variant to custom page data: ${previous.pageFilePath}`);

  const sections = (JSON.parse(data[1]) as TemplateComposition['sections']).map(section => {
    const key = section.id in nextOverrides ? section.id : section.type !== 'hero' ? section.sourceSectionId : undefined;
    const nextVariantId = key ? nextOverrides[key] : undefined;
    if (!nextVariantId || previousOverrides[key!] === nextVariantId) return section;
    const variant = getVariantById(nextVariantId);
    if (!variant || variant.sectionType !== section.type) return section;
    const layout = getLayoutForVariantId(variant.id);
    return { ...section, variantId: variant.id, props: { ...section.props, ...(layout ? { layout } : {}) } };
  });
  const composition: ResolvedPageComposition = { ...previous, variantOverrides: { ...nextOverrides },
    sections: previous.sections.map(resolved => {
      const section = sections.find(item => item.id === resolved.sectionId);
      return section ? { ...resolved, variantId: section.variantId, layoutRecipe: (section.props as { layout?: string }).layout } : resolved;
    }),
    activation: previous.activation ? { ...previous.activation, decisions: previous.activation.decisions.map(decision => {
      const section = sections.find(item => item.id === decision.sectionId);
      return section ? { ...decision, implementationId: resolveImplementationId(section.type, section.variantId) } : decision;
    }) } : undefined,
  };
  return { source: source.replace(data[0], `const SECTIONS = ${JSON.stringify(sections, null, 2)};\nconst HYDRATABLE`), composition };
}

function applyDesignVariants(
  template: TemplateComposition,
  designIntervention?: DesignInterventionSlice,
): TemplateComposition {
  const compositionPlan = designIntervention?.compositionPlan && designIntervention.artDirectionPackId
    ? validateAIPageComposition(designIntervention.compositionPlan, designIntervention.artDirectionPackId, COMPOSITION_ROLES) ?? undefined : undefined;
  template = applyAIPageComposition(template, compositionPlan);
  const pageVariants = compositionPlan?.pages.find(page => page.role === (template.pageRole || 'home'))?.variants;
  const variants = designIntervention?.sectionVariants;
  const activeVariants = designIntervention?.activeVariants;

  /**
   * ArtDirectionPack — the cohesion contract.
   * Recipe-derived variants are clamped into the pack's compatible family, and
   * sections with no signal at all inherit the pack's preferred variant instead
   * of falling back to a registry default. Explicit `activeVariants` (direct
   * authorship) are never clamped. The SEALED pack id wins; industry/theme are
   * only used to re-derive it for briefs written before sealing existed.
   */
  const pack = (
    designIntervention?.artDirectionPackId
    || designIntervention?.industry
    || designIntervention?.themePresetId
  )
    ? resolveArtDirectionPack({
        sealedPackId: designIntervention?.artDirectionPackId,
        industry: designIntervention?.industry,
        themePresetId: designIntervention?.themePresetId,
        seed: designIntervention?.seed,
      })
    : undefined;


  const hasVocabulary = Boolean(
    designIntervention?.layoutRecipe || designIntervention?.interactionRecipes?.length,
  );
  if (!variants?.length && !Object.keys(activeVariants || {}).length && !pack && !hasVocabulary
    && !template.sections.some(section => section.type === 'hero' && section.sourceSectionId && section.variantId)) return template;

  return {
    ...template,
    sections: template.sections.map((section) => {
      const routeVariant = section.sourceSectionId && section.variantId
        ? getVariantById(section.variantId) : undefined;
      const activeVariantId = activeVariants?.[section.id] || (pageVariants?.[section.type] as VariantId | undefined) || (
        routeVariant?.sectionType === section.type ? routeVariant.id :
        section.sourceSectionId && section.type !== 'hero' ? activeVariants?.[section.sourceSectionId] : undefined
      );
      let activeVariant = activeVariantId ? getVariantById(activeVariantId) : undefined;
      if (designIntervention?.compositionPlan && !activeVariants?.[section.id]) {
        const roleEligible = getGenerationVariantsForSection(section.type, pack, template.pageRole || 'home');
        // Preserved business sections may outlive a role recommendation; keep
        // their content using a certified implementation of the same family.
        const eligible = roleEligible.length ? roleEligible : getGenerationVariantsForSection(section.type, pack);
        if (!eligible.length) throw new Error('No certified 21st implementation for ' + section.type);
        // Affinity-guided, not "first in the list": the art direction order,
        // the industry dialect and the page's own neighbouring families rank
        // the legal candidates; the seed breaks ties deterministically.
        if (!activeVariant || !eligible.some(candidate => candidate.id === activeVariant!.id)) {
          activeVariant = selectAffineVariant(eligible, `${designIntervention?.seed ?? template.id}|${section.id}`, {
            packId: pack?.id,
            industry: designIntervention?.industry,
            role: template.pageRole || 'home',
            neighbors: template.sections.map(entry => entry.type),
            baselineVariantId: activeVariantId,
          }) ?? eligible[0];
        }
      }
      if (!activeVariant && section.type === 'hero' && section.sourceSectionId && section.variantId) {
        const layout = getLayoutForVariantId(section.variantId);
        return { ...section, props: { ...section.props, ...(layout ? { layout } : {}) } as typeof section.props };
      }
      if (activeVariant?.sectionType === section.type) {
        const layout = getLayoutForVariantId(activeVariant.id);
        return {
          ...section,
          variantId: activeVariant.id,
          props: layout ? { ...section.props, layout } as typeof section.props : section.props,
        };
      }
      const resolved = applyRecipe(section, variants || [])
        ?? applyVocabularyRecipes(section, designIntervention);

      const packVariantId = pack
        ? clampVariantToPack(pack, section.type, resolved?.variantId ?? section.variantId)
        : undefined;

      const variantId = packVariantId ?? resolved?.variantId;
      let layout = variantId
        ? getLayoutForVariantId(variantId) ?? resolved?.layout
        : resolved?.layout;

      // Hero composition is theme-led: when nothing else declared a layout the
      // sealed pack's hero signature decides it, so two industries sharing a
      // style card still differ from two style cards sharing an industry.
      if (pack && section.type === 'hero' && !layout && !(section.props as { layout?: string })?.layout) {
        layout = HERO_LAYOUT_TO_SECTION_LAYOUT[resolveHeroPresentation(pack).layout];
      }

      if (!variantId && !layout) return section;
      return {
        ...section,
        ...(variantId ? { variantId } : {}),
        props: layout
          ? { ...section.props, layout } as typeof section.props
          : section.props,
      };
    }),
  };
}

function pageModule(
  template: TemplateComposition,
  sectionMapImport: string,
  activation?: ResolvedPageComposition['activation'],
): string {
  const enhancements = emitCompositionEnhancements(activation);
  const sectionsJson = JSON.stringify(resolveSnapshotSectionLayouts(template), null, 2);
  const title = JSON.stringify(template.name);
  const hydratableJson = JSON.stringify(HYDRATABLE_SECTION_TYPES);
  return `import React, { useEffect } from 'react';
import SiteLayout from '@/components/SiteLayout';
import { SECTION_MAP } from '${sectionMapImport}';
import { useSectionData, mergeHydratedItems } from '@/components/catalogHydration';
${enhancements.imports}

// ============================================================================
// Page Content (data only)
//
// Each entry below is a section on this page. Edit text, items, ctas, etc.
// here to update what renders. The visual styling for each section type lives
// in its own file under /src/components/ — e.g. Hero.tsx, Services.tsx.
// ============================================================================
const SECTIONS = ${sectionsJson};
const HYDRATABLE = new Set(${hydratableJson});
${enhancements.source}

class SectionErrorBoundary extends React.Component<{ sectionId: string; children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(err: any) {
    console.warn('[SectionErrorBoundary] Section failed to render:', this.props.sectionId, err);
  }
  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

/**
 * Renders a single section. Live-catalog section types subscribe to
 * useSectionData; when the host resolves rows, they override the seeded
 * items. Static sections render exactly as authored.
 */
function RenderedSection({ section, occurrence }: { section: any; occurrence: number }) {
  const C = SECTION_MAP[section.id] || SECTION_MAP[section.type];
  if (!C || (typeof C !== 'function' && typeof C !== 'object')) {
    console.warn('[RenderedSection] Invalid or missing component for section:', section.id, section.type);
    return null;
  }

  const isHydratable = HYDRATABLE.has(section.type);
  const hydration = useSectionData(section.id, isHydratable ? section.type : undefined, occurrence);

  let props = section.props;
  let hidden = false;
  if (isHydratable) {
    const merged = mergeHydratedItems(section.props && section.props.items, hydration);
    if (merged.hide) hidden = true;
    props = { ...section.props, items: merged.items };
  }
  if (hidden) return null;

  const layoutToken = props && props.layout;
  const mediaTreatment = layoutToken === 'full-bleed'
    ? 'full-bleed-overlay'
    : layoutToken === 'split'
      ? 'split-frame'
      : props && (props.image || props.backgroundImage)
        ? 'centered-frame'
        : 'text-only';
  return (
    <SectionErrorBoundary sectionId={section.id}>
      <div
        data-ut-section-id={section.id}
        ${enhancements.source ? "className={section.type !== 'navbar' && section.type !== 'footer' ? 'relative isolate' : undefined}" : ''}
        data-ut-composition-id={${JSON.stringify(template.compositionAlternativeId || null)}}
        data-ut-section-type={section.type}
        data-ut-variant={section.variantId || undefined}
        data-ut-layout={layoutToken || undefined}
        data-ut-media-treatment={section.type === 'hero' ? mediaTreatment : undefined}
        data-ut-hydration={isHydratable ? (hydration.loading ? 'loading' : (hydration.rows ? 'live' : 'seed')) : undefined}
      >
        ${enhancements.source ? '{enhanceSection(section, props, <C props={props} variantId={section.variantId} />)}' : '<C props={props} variantId={section.variantId} />'}
      </div>
    </SectionErrorBoundary>
  );
}

export default function Page() {
  useEffect(() => { document.title = ${title}; }, []);
  const visible = SECTIONS.filter((s: any) => !s.hidden);
  // Assign per-type occurrence indices so the host can map a wizard-type
  // section to its emitted binding (\`\${requirementKey}-\${index}\`).
  const typeCounters: Record<string, number> = {};
  return (
    <SiteLayout pageRole={${JSON.stringify(template.pageRole || 'home')}}>
      {visible.map((s: any) => {
        const occurrence = typeCounters[s.type] ?? 0;
        typeCounters[s.type] = occurrence + 1;
        return <RenderedSection key={s.id} section={s} occurrence={occurrence} />;
      })}
    </SiteLayout>
  );
}
`;
}

/**
 * Pass 2 — Stage 4b declares its resolution instead of leaving it implicit.
 *
 * Every visual decision this compiler just executed (variant identity, layout,
 * motion, media treatment) is written out as a ResolvedPageComposition so no
 * downstream layer has to re-infer it from the emitted TSX.
 */
export function resolvePageComposition(
  template: TemplateComposition,
  pageFilePath: string,
  options?: CompositionCompileOptions,
): ResolvedPageComposition {
  const projected = applyDesignVariants(template, options?.designIntervention);
  const sections = resolveSnapshotSectionLayouts(projected);
  return {
    version: RESOLVED_COMPOSITION_VERSION,
    compiledBy: 'stage-4b',
    pageFilePath,
    templateName: template.name,
    variantOverrides: options?.designIntervention?.activeVariants ? { ...options.designIntervention.activeVariants } : {},
    compositionAlternativeId: template.compositionAlternativeId,
    layoutRecipe: options?.designIntervention?.layoutRecipe,
    activation: options?.designIntervention?.compositionPolicy === 'maximum-compatible'
      ? resolveCompositionEnhancements(projected, options.designIntervention.envelope, options.enhancementCanvasBudget)
      : undefined,
    sections: sections.map((section) => {
      const props = (section.props || {}) as Record<string, unknown>;
      const layout = typeof props.layout === 'string' ? props.layout : undefined;
      const mediaRecipe = section.type === 'hero'
        ? (layout === 'full-bleed'
          ? 'full-bleed-overlay'
          : layout === 'split'
            ? 'split-frame'
            : (props.image || props.backgroundImage)
              ? 'centered-frame'
              : 'text-only')
        : undefined;
      return {
        sectionId: section.id,
        semanticType: section.type,
        primitiveId: SECTION_COMPONENT_BY_TYPE[section.type] ?? null,
        variantId: section.variantId,
        layoutRecipe: layout,
        mediaRecipe,
      };
    }),
  };
}

/**
 * Generate a full multi-file VFS payload for one composed page.
 * Shared component files are emitted with idempotent content across pages
 * within the same generation; safe to merge by simple object spread.
 */
export function compositionToReactFileSet(
  template: TemplateComposition,
  pageFilePath: string,
  options?: CompositionCompileOptions,
): Record<string, string> {
  const projectedTemplate = applyDesignVariants(template, options?.designIntervention);
  const composition = resolvePageComposition(template, pageFilePath, options);
  const sectionMap = sectionMapModule(projectedTemplate, pageFilePath);
  const sectionMapImport = `./${sectionMap.path.split('/').pop()?.replace(/\.ts$/, '')}`;
  const files: Record<string, string> = {
    [THEME_PATH]: themeModule(projectedTemplate),
    [LAYOUT_PATH]: layoutModule(),
    [sectionMap.path]: sectionMap.content,
    [CATALOG_HYDRATION_PATH]: CATALOG_HYDRATION_MODULE,
    [FORM_RUNTIME_PATH]: FORM_RUNTIME_MODULE,
    [PUBLISHED_ACTION_RUNTIME_PATH]: PUBLISHED_ACTION_RUNTIME_MODULE,
    [pageFilePath]: pageModule(projectedTemplate, sectionMapImport, composition.activation),
    [resolvedCompositionPathFor(pageFilePath)]: serializeResolvedComposition(
      resolvePageComposition(template, pageFilePath, options),
    ),
  };
  for (const component of sectionMap.components) {
    files[SECTION_FILES[component]] = SECTION_MODULE_SOURCE[component];
  }
  if (sectionMap.components.has('AuthForm')) {
    files['/src/components/recipes/AuthForm.ts'] = stylexRecipes.families['auth-form'];
  }
  if (sectionMap.components.has('DataTable')) {
    files['/src/components/recipes/DataTable.ts'] = stylexRecipes.families['data-table'];
  }
  if (sectionMap.components.has('Navbar')) {
    files['/src/components/MobileNavigation.tsx'] = stylexRecipes.mobileNavigationModule;
  }
  if (sectionMap.components.has('Gallery')) {
    files['/src/components/recipes/Gallery.ts'] = stylexRecipes.families.gallery;
  }
  if (sectionMap.components.has('Hero')) {
    files['/src/components/recipes/Hero.ts'] = stylexRecipes.families.hero;
  }
  if (sectionMap.components.has('Services')) {
    files['/src/components/recipes/Services.ts'] = stylexRecipes.families.services;
  }
  if (sectionMap.components.has('Features')) {
    files['/src/components/recipes/Features.ts'] = stylexRecipes.families.features;
  }
  if (sectionMap.components.has('Navbar')) {
    files['/src/components/recipes/Navbar.ts'] = stylexRecipes.families.navbar;
  }
  if (sectionMap.components.has('Contact')) {
    files['/src/components/recipes/Contact.ts'] = stylexRecipes.families.contact;
  }
  if (sectionMap.components.has('Pricing')) {
    files['/src/components/recipes/Pricing.ts'] = stylexRecipes.families.pricing;
  }
  if (sectionMap.components.has('CTA')) {
    files['/src/components/recipes/CTA.ts'] = stylexRecipes.families.cta;
  }
  if (sectionMap.components.has('Footer')) {
    files['/src/components/recipes/Footer.ts'] = stylexRecipes.families.footer;
  }
  if (sectionMap.components.has('Testimonials')) {
    files['/src/components/recipes/Testimonials.ts'] = stylexRecipes.families.testimonials;
  }
  if (sectionMap.components.has('About')) {
    files['/src/components/recipes/About.ts'] = stylexRecipes.families.about;
  }
  if (sectionMap.components.has('FAQ')) {
    files['/src/components/recipes/FAQ.ts'] = stylexRecipes.families.faq;
  }
  if (sectionMap.components.has('Stats')) {
    files['/src/components/recipes/Stats.ts'] = stylexRecipes.families.stats;
  }
  if (sectionMap.components.has('Team')) {
    files['/src/components/recipes/Team.ts'] = stylexRecipes.families.team;
  }
  if (sectionMap.components.has('LogoCloud')) {
    files['/src/components/recipes/LogoCloud.ts'] = stylexRecipes.families['logo-cloud'];
  }
  if (sectionMap.components.has('BlogPreview')) {
    files['/src/components/recipes/BlogPreview.ts'] = stylexRecipes.families['blog-preview'];
  }
  if (sectionMap.components.has('BeforeAfter')) {
    files['/src/components/recipes/BeforeAfter.ts'] = stylexRecipes.families['before-after'];
  }
  for (const module of sectionMap.variantModules) {
    files[module.path] = module.content;
  }
  files[SOCIAL_PATH] = SOCIAL_ICON_MODULE;
  composition.compilerOwnership = Object.fromEntries(Object.entries(files)
    .filter(([path]) => /\.[jt]sx?$/.test(path))
    .map(([path, source]) => [path, compilerOwnershipHash(source)]));
  files[resolvedCompositionPathFor(pageFilePath)] = serializeResolvedComposition(composition);
  return files;
}

/**
 * Certified section wrappers + their prebuilt family bundles, keyed by the
 * canonical /src/components paths. Pure and page-independent: the design-source
 * materializer re-roots these; it never forks the recipe text.
 */
export function certifiedSectionModuleFiles(components: Iterable<string>): Record<string, string> {
  const wanted = [...new Set(components)].filter((name) => SECTION_FILES[name]).sort();
  const files: Record<string, string> = {};
  if (!wanted.length) return files;
  files[THEME_PATH] = themeModule();
  for (const component of wanted) {
    const family = SECTION_FAMILY_EMIT[component];
    const bundle = (stylexRecipes.families as Record<string, string>)[family.sectionType];
    if (!bundle) continue;
    files[SECTION_FILES[component]] = SECTION_MODULE_SOURCE[component];
    files[`/src/components/recipes/${component}.ts`] = bundle;
    if (component === 'Navbar') files['/src/components/MobileNavigation.tsx'] = stylexRecipes.mobileNavigationModule;
  }
  return files;
}
