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
}