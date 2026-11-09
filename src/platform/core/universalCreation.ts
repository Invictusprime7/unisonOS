export type CreationMode = 'guided' | 'open-ended';

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

/** One explicit, ID-carrying requirement from the owner's prompt or confirmed refinements. */
export interface CreationRequirement {
  id: string;
  kind: 'page' | 'navigation' | 'visual' | 'motion' | 'interaction' | 'capability' | 'reference' | 'content';
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

/** Ephemeral launch intent. The accepted SiteBundleSnapshot remains authoritative. */
export interface UniversalCreationInput {
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
  /** Open questions that block a faithful build; empty when none. */
  clarifications?: string[];
}