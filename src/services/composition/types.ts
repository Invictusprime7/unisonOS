/**
 * Cross-industry page composition contracts.
 *
 * Industry defines the business job, page role the narrative job, Art Direction
 * the visual expression. These contracts are data only — one planner consumes
 * them for every industry.
 */

import type { SectionType } from '@/sections/types';

export type HeroPattern =
  | 'immersive-media'
  | 'split-media'
  | 'typographic'
  | 'editorial-intro'
  | 'utility-header'
  | 'none';

export type LayoutGeometry = 'centered' | 'split' | 'asymmetric' | 'full-bleed' | 'layered' | 'grid';

export interface CompositionCharacter {
  density: 'low' | 'medium' | 'high';
  /** 0..1 scales */
  mediaDominance: number;
  typographyDominance: number;
  editoriality: number;
  informationDensity: number;
  conversionPressure: number;
  interactionDepth: number;
  asymmetry: number;
  layering: number;
}

export interface IndustryPageCompositionProfile {
  industryId: string;
  pageRole: string;
  narrativeGoals: string[];
  primaryIntent?: string;
  supportingIntents?: string[];
  requiredCapabilities: string[];
  optionalCapabilities?: string[];
  domainVocabulary?: string[];
  compositionCharacter: CompositionCharacter;
  preferredFamilies: SectionType[];
  /** Proven executable section architectures; the seed chooses among data, never invents one. */
  sectionOrderCandidates?: SectionType[][];
  /** Hero patterns in preference order; the planner allocates across the site. */
  heroCandidates: HeroPattern[];
  geometryCandidates: LayoutGeometry[];
  preferredCompositionPatterns: string[];
  discouragedCompositionPatterns: string[];
  mediaStrategy?: string[];
  motionStrategy?: string[];
  noveltyBudget: number;
  customCompositionAllowed: boolean;
  customComponentsAllowed: boolean;
}

/** Fingerprint of a page's structure — independent of colours/fonts. */
export interface CompositionSignature {
  hero: HeroPattern;
  geometry: LayoutGeometry;
  density: CompositionCharacter['density'];
  /** Ordered section families, e.g. ["hero","services","gallery","cta"]. */
  sectionOrder: string[];
  /** Certified body variants the page rendered (shared nav/footer excluded). */
  variants?: string[];
}

export interface PlannedPage {
  pageId: string;
  role: string;
  profile: IndustryPageCompositionProfile;
  target: CompositionSignature;
  /** Stable identity of the chosen industry x intent x art-direction architecture. */
  compositionKey: string;
}

export interface CompositionResolutionInput {
  industry: string;
  pageIntent: string;
  artDirection?: string | null;
  businessTraits?: readonly string[];
  availableCapabilities?: readonly string[];
  seed: string;
}

export interface CompositionResolution {
  profile: IndustryPageCompositionProfile;
  sectionOrder: SectionType[];
  compositionKey: string;
}

export interface SiteCompositionPlan {
  industryId: string;
  seed: string;
  pages: PlannedPage[];
}

export interface SiteVisualMemoryEntry {
  pageId: string;
  role: string;
  signature: CompositionSignature;
}

export interface RedundancyIssue {
  pageId: string;
  conflictsWith: string;
  similarity: number;
  reason: string;
}
