import { supabase } from '@/integrations/supabase/client';
import { planSiteTopology } from '@/platform/core/siteTopologyPlanner';
import type { UniversalCreationInput, UniversalCreationPage } from '@/platform/core/universalCreation';

export interface UniversalCreationPlanProposal {
  pages: UniversalCreationPage[];
  requestedCapabilities: string[];
}

const ALLOWED_CAPABILITIES = new Set([
  'booking', 'commerce', 'authentication', 'lead-capture', 'content-management',
]);

function normalizedRoute(route: string): string {
  const normalized = route.trim().toLowerCase().replace(/\/+$/, '');
  return normalized || '/';
}

export function applyUniversalCreationProposal(
  input: UniversalCreationInput,
  proposal: UniversalCreationPlanProposal,
): UniversalCreationInput {
  if (!Array.isArray(proposal.pages) || proposal.pages.length > 12) {
    throw new Error('Universal plan must contain at most 12 pages.');
  }
  const existingRoutes = new Set(input.pages.map((page) => normalizedRoute(page.route)));
  const proposedPages = proposal.pages.filter((page) => !existingRoutes.has(normalizedRoute(page.route)));
  const pages = [...input.pages, ...proposedPages];

  planSiteTopology('universal', input.subject || 'Website', {
    explicitPages: pages,
    restrictToAdditionalPages: true,
  });

  return {
    ...input,
    pages,
    requestedCapabilities: [...new Set([
      ...input.requestedCapabilities,
      ...proposal.requestedCapabilities.filter((capability) => ALLOWED_CAPABILITIES.has(capability)),
    ])],
  };
}

export async function planUniversalCreation(
  input: UniversalCreationInput,
): Promise<UniversalCreationInput> {
  const { data, error } = await supabase.functions.invoke('universal-creation-plan', {
    body: { prompt: input.originalPrompt, existingPages: input.pages },
  });
  if (error) throw new Error(error.message || 'Universal creation planning failed');
  const response = data as { success?: boolean; proposal?: UniversalCreationPlanProposal; error?: string } | null;
  if (!response?.success || !response.proposal) {
    throw new Error(response?.error || 'Universal creation planner returned no proposal');
  }
  return applyUniversalCreationProposal(input, response.proposal);
}