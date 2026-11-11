export type CreationMode = 'guided' | 'open-ended';
export const UNIVERSAL_CREATION_VERSION = 1 as const;

export interface UniversalCreationPage {
  route: string;
  title: string;
  purpose: string;
  suggestedRole?: string;
}

export type UniversalCapabilityId =
  | 'booking'
  | 'commerce'
  | 'authentication'
  | 'lead-capture'
  | 'content-management';

export interface UniversalCapabilityEvidence {
  capabilityId: UniversalCapabilityId;
  origin: 'explicit' | 'inferred';
  reason: string;
}

/** How a creative decision is realized inside the one App Builder pipeline. */
export type CreativeResolution = 'reuse' | 'adapt' | 'author';
/** explicit: owner's first request; confirmed: accepted chat summary; refinement: a later owner message; inferred: Affinity's suggestion. */
export type CreativeDecisionOrigin = 'explicit' | 'confirmed' | 'refinement' | 'inferred';

/**
 * One conversational creative decision — the natural-language equivalent of a
 * former Wizard selection (art direction, experience, hero layout, section
 * layout) plus original designs the registry does not contain.
 */
export interface CreativeDecision {
  /** Stable identity, e.g. `dec:hero:home`, `dec:section:gallery:releases`. */
  id: string;
  target: 'hero' | 'section' | 'original';
  /** Section family (hero, gallery, blog-preview…) or an original purpose slug (timeline, rsvp…). */
  family: string;
  /** Page the decision belongs to; null means wherever the family appears. */
  pageRoute: string | null;
  /** The owner's phrase, e.g. "horizontal releases gallery". */
  value: string;
  /** Layout/treatment words read from the phrase (horizontal, cinematic, masonry…). */
  modifiers: string[];
  origin: CreativeDecisionOrigin;
  evidence: string;
  resolution: CreativeResolution;
  /** Ranked certified matches, best first; empty when authoring an original. */
  implementationIds: string[];
  /** Modifiers no certified match carries; realized by adapting or authoring. */
  unmatched: string[];
}

/** Site-wide art direction resolved from the conversation (never Modern-first). */
export interface ExperienceArtDirection {
  packId: string;
  packName: string;
  familyId: string;
  origin: CreativeDecisionOrigin;
  /** The owner's (or confirmed/refined) words that selected it. */
  evidence: string[];
  /** Next-best packs, for transparency. */
  alternatives: Array<{ packId: string; score: number }>;
}

/** The conversational creative brief carried with the launch and sealed into the site. */
export interface ExperienceDirection {
  version: 1;
  artDirection: ExperienceArtDirection;
  experience: { value: 'standard' | 'motion-rich' | 'immersive'; origin: CreativeDecisionOrigin; evidence: string };
  decisions: CreativeDecision[];
  /** Decision IDs a refinement asked to keep unchanged ("leave the rest unchanged"). */
  locked: string[];
}

/** Executable design target a requirement is checked against. */
export interface CreationDesignTarget {
  kind: 'art-direction' | 'experience' | 'section' | 'original';
  family?: string;
  implementationIds?: string[];
  resolution?: CreativeResolution;
  packId?: string;
  experience?: 'standard' | 'motion-rich' | 'immersive';
  decisionId?: string;
}

/** One explicit, ID-carrying requirement from the owner's prompt or confirmed refinements. */
export interface CreationRequirement {
  id: string;
  kind: 'page' | 'navigation' | 'visual' | 'motion' | 'interaction' | 'capability' | 'reference' | 'content' | 'experience';
  text: string;
  /** The owner's own sentence that carries this requirement. */
  evidence?: string;
  /** explicit: owner's words; confirmed: the chat summary the owner confirmed; inferred: planner. */
  origin: 'explicit' | 'confirmed' | 'inferred';
  pageRoute?: string;
  /** Live-looking data (scores, departures, availability) must be real or visibly labelled sample data. */
  sampleDataRequired?: boolean;
  /** Alternative phrasings that evidence an implementation (any one, all of its words). */
  evidenceTerms?: string[];
  /** Creative decisions carry the design they must be realized with. */
  design?: CreationDesignTarget;
}

/**
 * The industry vertical read from the owner's words (sports, flights,
 * weddings…). Authoring knowledge only: it never provisions capabilities and
 * never outranks the prompt.
 */
export interface CreationVertical {
  packId: string;
  variantId: string | null;
  /** A second vertical when the prompt blends two trades (e.g. a wedding photographer). */
  blendPackId?: string | null;
  confidence: number;
  /** The owner's matched phrases. */
  evidence: string[];
}

/** Creative brief dimensions, each the owner's own phrases. */
export interface CreativeBrief {
  tone: string[];
  typography: string[];
  color: string[];
  imagery: string[];
  composition: string[];
  motion: string[];
  interactions: string[];
  /** Inspiration only — never copied. */
  references: string[];
}

/**
 * Site-wide design direction. `provisional` means no executable family
 * matched the prompt: the family supplies a token base only and the creative
 * brief stays authoritative (never a silent Modern collapse).
 */
export interface DesignDirection {
  familyId: string;
  origin: 'explicit' | 'confirmed' | 'provisional';
  matchedPhrase?: string;
  unmappedStyles: string[];
  note: string;
}

export interface UniversalCreationFinalizedSelections {
  version: 1;
  industry: string;
  businessName: string;
  systemId: string;
  goals: string[];
  visitorActions: string[];
  requestedCapabilities: string[];
  authorizedCapabilities: string[];
  pages: UniversalCreationPage[];
  design: {
    themePresetId: string;
    artDirectionFamilyId: string;
    artDirectionPackId: string;
    experience: string;
    mode: string;
  };
  uiFoundation: {
    manifestPath: string;
    importRoot: string;
    runtimeProfile: string;
    primitiveFamilyIds: string[];
    experiencePrimitiveIds: string[];
    approvedExperienceCapabilities: string[];
  };
}

/** Durable, versioned user intent. Accepted source and SiteBundleSnapshot remain authoritative. */
export interface UniversalCreationInput {
  /** Optional on input for backward compatibility; new transports persist version 1. */
  version?: typeof UNIVERSAL_CREATION_VERSION;
  mode: CreationMode;
  originalPrompt: string;
  sitePurpose: string;
  subject: string;
  industryHint?: string;
  pages: UniversalCreationPage[];
  visualRequirements: string[];
  requestedCapabilities: string[];
  capabilityEvidence?: UniversalCapabilityEvidence[];
  /** The site direction summary the owner confirmed in chat (accepted refinement). */
  confirmedDirection?: string;
  /** Follow-up owner messages after the first request, in order. */
  refinements?: string[];
  creativeBrief?: CreativeBrief;
  requirements?: CreationRequirement[];
  multiPage?: boolean;
  designDirection?: DesignDirection;
  vertical?: CreationVertical;
  /** Conversational creative brief: art direction, experience, hero/section layouts, originals. */
  experienceDirection?: ExperienceDirection;
  /** Open questions that block a faithful build; empty when none. */
  clarifications?: string[];
  /** Resolved Wizard and canonical selections sealed into the App Builder launch contract. */
  finalizedSelections?: UniversalCreationFinalizedSelections;
}

/** Normalize legacy inputs before transport or persistence without mutating their owner. */
export function normalizeUniversalCreation(input: UniversalCreationInput): UniversalCreationInput {
  return { ...structuredClone(input), version: UNIVERSAL_CREATION_VERSION };
}