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
  /** Open questions that block a faithful build; empty when none. */
  clarifications?: string[];
}