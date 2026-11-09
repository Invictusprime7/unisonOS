/**
 * Industry vertical packs — data only.
 *
 * A vertical pack is authoring knowledge for a kind of business (sports,
 * flights, weddings…): its sub-variants, trade vocabulary, the content objects
 * its sites show, how visitors judge trust, signature interactive experiences,
 * page plans and composition profiles. It never provisions backend behaviour
 * (capabilities stay with the canonical industry matrix and authorization) and
 * never outranks the owner's prompt: it is evidence the App Builder may use.
 */
import type { SectionType } from '@/sections/types';
import type { CompositionCharacter, IndustryPageCompositionProfile } from '../types';

/** Same shape the composition registry builds profiles from. */
export type VerticalRoleProfile = Omit<IndustryPageCompositionProfile,
  'industryId' | 'pageRole' | 'compositionCharacter' | 'customCompositionAllowed' | 'customComponentsAllowed'> & {
  character: Partial<CompositionCharacter> & Pick<CompositionCharacter, 'density'>;
};

export interface VerticalInteraction {
  /** Stable slug; becomes `req:interaction:<id>` when the owner asks for it. */
  id: string;
  /** Short owner-facing name, e.g. "seat map". */
  label: string;
  /** Owner phrases that request this experience. */
  keywords: readonly string[];
  /** What a faithful implementation shows and lets visitors do. */
  brief: string;
  /** Certified families that can host or approximate it before authoring an original module. */
  certifiedFamilies: readonly SectionType[];
  /** Suggested site-local module when no certified design fits. */
  originalComponent: string;
  /** Live-looking data (scores, departures, availability) must be real or visibly labelled sample data. */
  sampleDataRequired?: boolean;
}

export interface VerticalContentObject {
  id: string;
  label: string;
  fields: readonly string[];
  /** Illustrative sample, always rendered as labelled sample content. */
  sample: string;
}

export interface VerticalPage {
  title: string;
  route: string;
  /** Canonical topology/composition role (home, services, gallery, about, booking, contact, pricing, shop, blog, faq, custom). */
  role: string;
  purpose: string;
}

export interface VerticalSubVariant {
  id: string;
  label: string;
  keywords: readonly string[];
  /** Extra trade terms for this variant. */
  vocabulary: readonly string[];
  /** Interaction IDs (from the pack) that define this variant. */
  signatureInteractions: readonly string[];
  /** Typical non-home pages, used only when the owner asks for several pages without naming them. */
  pages: readonly VerticalPage[];
  /** The visitor's main action, in the trade's words. */
  primaryAction: string;
  proof: readonly string[];
}

export interface IndustryVerticalPack {
  id: string;
  label: string;
  /** Owner phrases that identify the vertical (any variant). */
  keywords: readonly string[];
  /** Canonical industry whose capability/intent model is closest; a hint only. */
  hostIndustry: string;
  vocabulary: readonly string[];
  contentObjects: readonly VerticalContentObject[];
  proofMechanisms: readonly string[];
  interactions: readonly VerticalInteraction[];
  variants: readonly VerticalSubVariant[];
  imagery: readonly string[];
  motion: readonly string[];
  /** Words that help rank certified designs (mood and structure, not industry labels). */
  designTerms: readonly string[];
  /** Honesty rules specific to the trade. */
  honesty: readonly string[];
  /** Composition profiles by page role; roles missing here inherit the generic profile. */
  roleProfiles: Readonly<Record<string, VerticalRoleProfile>>;
}

/** The resolved vertical carried on the launch intent. */
export interface ResolvedVertical {
  packId: string;
  variantId: string | null;
  /** A second pack when the prompt blends two trades (e.g. a wedding photographer). */
  blendPackId?: string | null;
  confidence: number;
  evidence: string[];
}
