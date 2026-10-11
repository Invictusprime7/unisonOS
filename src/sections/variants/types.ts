/**
 * Section Variant Types
 * 
 * Defines the variant system that lets creators pick different visual layouts
 * for each section type while preserving the same data contract (props).
 * 
 * All rendering uses JSX/React source strings — consistent with the
 * LauncherWizard pipeline that generates React VFS files.
 */

import type { ComponentType } from 'react';
import type { RadixPrimitiveId } from '@/platform/core/generatedUiFoundation';
import type { VocabularyCategory } from '@/platform/core/designVocabulary';
import type { SectionType, BaseSectionProps } from '../types';

/** Unique identifier for a variant: "hero:split-image", "cta:gradient-banner", etc. */
export type VariantId = `${SectionType}:${string}`;
/** Points at a design vocabulary entry; ids are unique per category only. */
export interface VocabularyRef {
  category: VocabularyCategory;
  id: string;
}
/**
 * How a registered variant relates to the experience (WebGL) layer.
 *
 * `declared` records the dependency a future Phase 6A implementation will need
 * and grants no runtime capability; only `enabled` variants may reach live 3D.
 * The primitives are never restated here — they are derived from the named
 * design vocabulary entry, which owns them.
 */
export interface VariantExperienceDeclaration {
  status: 'declared' | 'enabled';
  vocabulary: { category: VocabularyCategory; id: string };
}

/** Content extracted from an existing JSX section for re-rendering in a new layout */
export interface ExtractedSectionContent {
  heading?: string;
  subheading?: string;
  ctaButtons?: Array<{ text: string; href: string; isPrimary: boolean }>;
  navLinks?: Array<{ text: string; href: string }>;
  brandName?: string;
  imageSrc?: string;
  imageAlt?: string;
  badge?: string;
  listItems?: string[];
}

/**
 * Authored capability facts for a variant (Registry Expansion milestone, Phase 1).
 * These are declared facts about the implementation — derived visual signatures
 * prefer them over string inference from slug/name/tags.
 */
export interface VariantCapabilityContract {
  layout?: {
    geometry?: readonly (
      | 'centered'
      | 'split'
      | 'asymmetric'
      | 'full-bleed'
      | 'layered'
      | 'spatial'
    )[];
    mediaDominance?: 'low' | 'medium' | 'high';
    density?: 'airy' | 'balanced' | 'dense';
    typographyScale?: 'restrained' | 'display' | 'monumental';
  };
  behavior?: {
    supportsVideo?: boolean;
    supportsFilters?: boolean;
    supportsCarousel?: boolean;
    supportsMarquee?: boolean;
    supportsSticky?: boolean;
    supportsLightbox?: boolean;
    supportsForm?: boolean;
    supportsMultipleCtas?: boolean;
    supportsCatalogData?: boolean;
  };
  media?: {
    required?: boolean;
    minItems?: number;
    maxItems?: number;
    preferredOrientations?: readonly ('portrait' | 'landscape' | 'square')[];
  };
  motion?: {
    level?: 'none' | 'restrained' | 'motion-rich' | 'immersive';
    reducedMotionRequired?: boolean;
  };
}

/**
 * Explicit compatibility declaration. Absent fields mean "no authored
 * restriction" (legacy entries stay universally eligible); newly certified
 * entries must declare this or be marked universal at promotion time.
 */
export interface VariantCompatibilityContract {
  industries?: readonly string[];
  pageRoles?: readonly import('../types').TemplatePageRole[];
  artDirectionFamilies?: readonly string[];
  artDirectionPacks?: readonly string[];
  themePresets?: readonly string[];
  experiencePreferences?: readonly import('@/services/wizardDesignSelection').WizardExperiencePreference[];
  excludedIndustries?: readonly string[];
}

/**
 * Release-maturity lifecycle, distinct from `generationStatus` (which is a
 * generation preference). `certified` is the only status eligible for
 * production resolution of new sites.
 */
export interface VariantLifecycleContract {
  status: 'experimental' | 'candidate' | 'certified' | 'deprecated' | 'retired';
  schemaVersion: number;
  implementationVersion: number;
  introducedAt?: string;
  deprecatedAt?: string;
}

/** AI-facing semantic description, derived into Builder design-source context. */
export interface VariantAiContract {
  summary: string;
  bestFor?: readonly string[];
  avoidFor?: readonly string[];
  contentRequirements?: readonly string[];
  compositionNotes?: readonly string[];
}

/** Metadata for a single section layout variant */
export interface SectionVariant<T extends SectionType = SectionType> {
  /** Unique ID: "hero:centered", "hero:split-image", "hero:full-bleed" */
  id: VariantId;
  /** The parent section type this variant belongs to */
  sectionType: T;
  /** Short slug for this variant style */
  slug: string;
  /** Display name shown in the variant picker */
  name: string;
  /** Brief description of the layout style */
  description: string;
  /** The React component that renders this variant (used by PageRenderer) */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: ComponentType<BaseSectionProps<any>>;
  vfs?: { mode: 'portable-recipe' | 'legacy-jsx'; certification?: 'approved' };
  /**
   * Development-time provenance for implementations adapted from an external
   * design source. Never consulted at runtime.
   */
  source?: import('@/design/21st-intake/provenance').VisualSourceMetadata;
  /** `legacy` implementations stay resolvable but are excluded from preferred generation. */
  generationStatus?: 'preferred' | 'supported' | 'legacy' | 'retired';
  /** Why an implementation was retired (required when generationStatus is 'retired'). */
  retiredReason?: string;
  /** Static thumbnail path for the variant picker grid */
  thumbnail: string;
  /** Tags for filtering (e.g., "modern", "minimal", "bold") */
  tags?: string[];
  /**
   * Optional authored composition affinity: neighbouring section family →
   * coherence weight in 0..1 (0.5 is neutral). Guides seeded selection only;
   * it never gates eligibility. See `src/sections/compositionAffinity.ts`.
   */
  compositionAffinity?: Readonly<Partial<Record<SectionType, number>>>;
  pageRoles?: readonly import('../types').TemplatePageRole[];
  /** Whether this is the default variant for the section type */
  isDefault?: boolean;
  /** Radix behavior facades required by this variant's generated JSX */
  radixPrimitives?: readonly RadixPrimitiveId[];
  /** Design vocabulary pattern this variant already executes today */
  vocabulary?: VocabularyRef;
  /** Additional executable vocabulary; the legacy shorthand remains supported. */
  vocabularyRefs?: readonly VocabularyRef[];
  /** Experience-layer dependency this variant declares or enables */
  experience?: VariantExperienceDeclaration;
  /**
   * Component-state contract (V4 M6). Optional per entry: the canonical
   * contract is derived from the family posture in `componentStates.ts` and
   * refined by whatever an implementation declares here.
   */
  states?: Partial<import('./componentStates').ComponentStateContract>;
  /** Authored capability facts; preferred over string inference when present. */
  capabilities?: VariantCapabilityContract;
  /** Explicit compatibility declaration (see VariantCompatibilityContract). */
  compatibility?: VariantCompatibilityContract;
  /** Release-maturity lifecycle; absent on legacy entries (treated as certified). */
  lifecycle?: VariantLifecycleContract;
  /** AI-facing semantic description for derived design-source context. */
  ai?: VariantAiContract;
  /**
   * @deprecated Legacy source metadata retained only while nonportable families
   * migrate. It must not be invoked to write or replace canonical VFS output.
   */
  renderJSX: (content: ExtractedSectionContent) => string;
}

/** Map of section type → array of available variants */
export type VariantRegistry = Partial<Record<SectionType, SectionVariant[]>>;

/** Tracks which variant is active for each section instance in a template */
export type ActiveVariantMap = Record<string, VariantId>;
