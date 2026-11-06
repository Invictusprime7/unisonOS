export type CreationMode = 'guided' | 'open-ended';

export interface UniversalCreationPage {
  route: string;
  title: string;
  purpose: string;
  suggestedRole?: string;
}

/** Ephemeral launch intent. The accepted SiteBundleSnapshot remains authoritative. */
export interface UniversalCreationInput {
  mode: CreationMode;
  originalPrompt: string;
  sitePurpose: string;
  subject: string;
  pages: UniversalCreationPage[];
  visualRequirements: string[];
  requestedCapabilities: string[];
}