/**
 * Section Registry — Type Definitions
 * 
 * Every section component conforms to a typed schema.
 * Templates become declarative compositions of sections.
 */

import type { ComponentType } from 'react';

// ============================================================================
// Theme Contract
// ============================================================================

/** Design tokens passed to every section */
export interface ThemeTokens {
  // Colors (CSS custom property values, HSL format)
  colors: {
    primary: string;       // e.g. "330 80% 60%"
    primaryForeground: string;
    secondary: string;
    secondaryForeground: string;
    accent: string;
    accentForeground: string;
    background: string;
    foreground: string;
    muted: string;
    mutedForeground: string;
    card: string;
    cardForeground: string;
    border: string;
  };
  // Typography
  typography: {
    headingFont: string;   // e.g. "'Cormorant Garamond', serif"
    bodyFont: string;      // e.g. "'Inter', sans-serif"
    headingWeight: string; // e.g. "700"
    bodyWeight: string;
  };
  // Shape
  radius: string;          // e.g. "0.75rem"
  // Density
  sectionPadding: string;  // e.g. "5rem 1rem"
  containerWidth: string;  // e.g. "1200px"
}

// ============================================================================
// Section Schema
// ============================================================================

/** Section type identifiers */
export type SectionType =
  | 'navbar'
  | 'hero'
  | 'services'
  | 'features'
  | 'pricing'
  | 'testimonials'
  | 'team'
  | 'gallery'
  | 'faq'
  | 'cta'
  | 'contact'
  | 'footer'
  | 'stats'
  | 'about'
  | 'logo-cloud'
  | 'blog-preview'
  | 'before-after'
  | 'auth-form'
  | 'data-table';

/** A single section in a template composition */
export interface SectionEntry<T extends SectionType = SectionType> {
  id: string;
  /** Original template section identity retained when this section is cloned for a route. */
  sourceSectionId?: string;
  type: T;
  /** Registry-owned visual variant; behavior remains bound through id/type/slots. */
  variantId?: import('./variants/types').VariantId;
  props: SectionPropsMap[T];
  /** Optional CSS module or scoped styles for this section */
  className?: string;
  /** Whether this section is hidden */
  hidden?: boolean;
}

/** Navigation link */
export interface NavLink {
  label: string;
  href: string;
  /** Intent to fire on click (replaces href navigation) */
  intent?: string;
}

/** CTA button */
export interface CTAButton {
  label: string;
  href?: string;
  intent?: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
}

/** Testimonial item */
export interface TestimonialItem {
  quote: string;
  author: string;
  role?: string;
  avatar?: string;
  rating?: number;
}

/** Service/feature item */
export interface ServiceItem {
  title: string;
  description: string;
  price?: string;
  duration?: string;
  icon?: string;
  image?: string;
  badge?: string;
  cta?: CTAButton;
}

/** Team member */
export interface TeamMember {
  name: string;
  role: string;
  bio?: string;
  image?: string;
  socials?: { platform: string; url: string }[];
}

/** FAQ item */
export interface FAQItem {
  question: string;
  answer: string;
}

/** Pricing tier */
export interface PricingTier {
  name: string;
  price: string;
  period?: string;
  description?: string;
  features: string[];
  cta: CTAButton;
  highlighted?: boolean;
  badge?: string;
}

/** Gallery item */
export interface GalleryItem {
  src: string;
  alt: string;
  caption?: string;
  category?: string;
}

/** Stat item */
export interface StatItem {
  value: string;
  label: string;
  icon?: string;
}

// ============================================================================
// Props map — each section type's specific props
// ============================================================================

export interface SectionPropsMap {
  navbar: {
    brand: string;
    logo?: string;
    links: NavLink[];
    cta?: CTAButton;
    sticky?: boolean;
    transparent?: boolean;
    layout?: 'standard' | 'centered-logo' | 'minimal-dark' | 'floating-pill';
  };
  hero: {
    headline: string;
    subheadline?: string;
    description?: string;
    ctas?: CTAButton[];
    image?: string;
    backgroundImage?: string;
    images?: GalleryItem[];
    layout?: 'centered' | 'split' | 'full-bleed' | 'page-title' | 'editorial-banner' | 'commerce-gradient' | 'showcase-panel' | 'prisma-cinematic' | 'image-stream';
    badge?: string;
    stats?: StatItem[];
  };
  services: {
    headline?: string;
    subheadline?: string;
    items: ServiceItem[];
    columns?: 2 | 3 | 4;
    layout?: 'grid' | 'list' | 'alternating' | 'product-cards';
  };
  features: {
    headline?: string;
    subheadline?: string;
    items: ServiceItem[];
    columns?: 2 | 3 | 4;
    layout?: 'grid' | 'icon-left' | 'centered' | 'bento-grid';
  };
  pricing: {
    headline?: string;
    subheadline?: string;
    tiers: PricingTier[];
    showToggle?: boolean;
    layout?: 'tiers' | 'comparison' | 'accordion' | 'feature-table';
  };
  testimonials: {
    headline?: string;
    subheadline?: string;
    items: TestimonialItem[];
    layout?: 'grid' | 'carousel' | 'single' | 'marquee';
  };
  team: {
    headline?: string;
    subheadline?: string;
    members: TeamMember[];
    columns?: 2 | 3 | 4;
  };
  gallery: {
    headline?: string;
    subheadline?: string;
    items: GalleryItem[];
    columns?: 2 | 3 | 4;
    filterable?: boolean;
    /** Variant slug or legacy layout alias — resolved by the gallery renderer. */
    layout?: string;
  };
  faq: {
    headline?: string;
    subheadline?: string;
    items: FAQItem[];
    layout?: 'accordion' | 'grid' | 'two-column';
  };
  cta: {
    headline: string;
    description?: string;
    ctas: CTAButton[];
    layout?: 'centered' | 'split' | 'banner' | 'signal-banner';
    backgroundImage?: string;
  };
  contact: {
    headline?: string;
    description?: string;
    layout?: 'centered' | 'split-card' | 'minimal-inline';
    fields?: { name: string; type: string; placeholder?: string; required?: boolean }[];
    submitLabel?: string;
    submitIntent?: string;
    showMap?: boolean;
    address?: string;
    phone?: string;
    email?: string;
  };
  footer: {
    brand: string;
    logo?: string;
    layout?: 'columns' | 'centered-minimal' | 'dark-band' | 'brand-social';
    columns?: { title: string; links: NavLink[] }[];
    socials?: { platform: string; url: string; icon?: string }[];
    copyright?: string;
    newsletter?: boolean;
  };
  stats: {
    headline?: string;
    items: StatItem[];
    layout?: 'row' | 'grid' | 'metric-cards';
  };
  about: {
    headline?: string;
    description: string;
    image?: string;
    cta?: CTAButton;
    layout?: 'text-left' | 'text-right' | 'centered';
  };
  'logo-cloud': {
    headline?: string;
    logos: { name: string; src?: string }[];
    layout?: 'grid' | 'marquee' | 'wordmark-row';
  };
  'blog-preview': {
    headline?: string;
    posts: { title: string; excerpt: string; image?: string; date?: string; author?: string; href?: string }[];
  };
  'before-after': {
    headline?: string;
    subheadline?: string;
    items: { before: string; after: string; label?: string }[];
  };
  'auth-form': {
    heading?: string;
    subheading?: string;
    submitLabel?: string;
    footerNote?: string;
    altActionLabel?: string;
    altActionHref?: string;
  };
  'data-table': {
    heading?: string;
    columns?: Array<{ key: string; label: string }>;
    rows?: Array<Record<string, unknown>>;
    sourceTable?: string;
    emptyMessage?: string;
    stats?: Array<{ label: string; value: string; change?: string }>;
  };
}

// ============================================================================
// Registry Types
// ============================================================================

/** Props passed to every section component */
export interface BaseSectionProps<T extends SectionType = SectionType> {
  section: SectionEntry<T>;
  theme: ThemeTokens;
}

/** A registered section component */
export interface SectionRegistryEntry {
  component: ComponentType<BaseSectionProps<any>>;
  label: string;
  category: 'navigation' | 'hero' | 'content' | 'social-proof' | 'conversion' | 'footer';
  description?: string;
}

// ============================================================================
// Template Composition
// ============================================================================

/**
 * Page role identifiers used by the topology planner & scaffolder.
 * Mirrors `PageRole` in src/contracts/siteTopologyPlanner.ts to keep
 * the type contract local to the section registry.
 */
export type TemplatePageRole =
  | 'home'
  | 'about'
  | 'services'
  | 'contact'
  | 'pricing'
  | 'gallery'
  | 'faq'
  | 'booking'
  | 'checkout'
  | 'thank_you'
  | 'blog'
  | 'shop'
  | 'immersive'
  | 'auth'
  | 'dashboard'
  | 'custom';

/** A complete template definition — just data, no JSX */
export interface TemplatePageAlternative {
  id: string;
  sectionIds: string[];
  heroVariantId?: import('./variants/types').VariantId;
  themePresetIds?: string[];
}

export interface TemplatePageComposition {
  sections: SectionEntry[];
  alternatives: TemplatePageAlternative[];
}

export interface TemplateComposition {
  pageRole?: TemplatePageRole;
  id: string;
  name: string;
  category: string;
  industry: string;
  description: string;
  theme?: ThemeTokens | null;
  /** Sections rendered on the home page (canonical full composition). */
  sections: SectionEntry[];
  pageCompositions?: Partial<Record<TemplatePageRole, TemplatePageComposition>>;
  compositionAlternativeId?: string;
  /** Optional global CSS for advanced effects (keyframes, scroll-reveal) */
  globalStyles?: string;
  tags?: string[];
  systemType?: string;
  /**
   * Optional list of sub-page roles this template can scaffold.
   * If omitted, the topology planner falls back to the industry profile defaults.
   */
  pageRoles?: TemplatePageRole[];
  /**
   * Optional shared section pool: per-role ordered list of SectionType identifiers.
   * The scaffolder builds each sub-page by filtering `sections` to these types in order.
   * If omitted, a sensible default per role is used (see scaffolder).
   */
  sectionPool?: Partial<Record<TemplatePageRole, SectionType[]>>;
}
