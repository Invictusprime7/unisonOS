import { supabase } from '@/integrations/supabase/client';
import { planSiteTopology } from '@/platform/core/siteTopologyPlanner';
import type {
  UniversalCapabilityEvidence,
  UniversalCreationInput,
  UniversalCreationPage,
} from '@/platform/core/universalCreation';

export interface UniversalCreationPlanProposal {
  pages: UniversalCreationPage[];
  requestedCapabilities: string[];
  capabilityEvidence?: Array<Pick<UniversalCapabilityEvidence, 'capabilityId' | 'reason'>>;
}

const ALLOWED_CAPABILITIES = new Set([
  'booking', 'commerce', 'authentication', 'lead-capture', 'content-management',
]);

function normalizedRoute(route: string): string {
  const normalized = route.trim().toLowerCase().replace(/\/+$/, '');
  return normalized || '/';
}

function parseProposal(value: unknown): UniversalCreationPlanProposal | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const proposal = value as Record<string, unknown>;
  if (!Array.isArray(proposal.pages) || proposal.pages.length > 12) return null;
  const requestedCapabilitiesValue = proposal.requestedCapabilities;
  const capabilityEvidenceValue = proposal.capabilityEvidence;
  if (!Array.isArray(requestedCapabilitiesValue)) return null;
  if (capabilityEvidenceValue !== undefined && !Array.isArray(capabilityEvidenceValue)) return null;

  const pages: UniversalCreationPage[] = [];
  for (const value of proposal.pages) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const page = value as Record<string, unknown>;
    if (
      typeof page.route !== 'string' || !page.route.trim() ||
      typeof page.title !== 'string' || !page.title.trim() ||
      typeof page.purpose !== 'string' || !page.purpose.trim() ||
      (page.suggestedRole !== undefined && typeof page.suggestedRole !== 'string')
    ) return null;
    pages.push({
      route: page.route,
      title: page.title,
      purpose: page.purpose,
      ...(typeof page.suggestedRole === 'string' ? { suggestedRole: page.suggestedRole } : {}),
    });
  }

  if (requestedCapabilitiesValue.some((capability) => typeof capability !== 'string')) return null;
  const capabilityEvidence: Array<Pick<UniversalCapabilityEvidence, 'capabilityId' | 'reason'>> = [];
  for (const value of Array.isArray(capabilityEvidenceValue) ? capabilityEvidenceValue : []) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const evidence = value as Record<string, unknown>;
    if (
      typeof evidence.capabilityId !== 'string' || !ALLOWED_CAPABILITIES.has(evidence.capabilityId) ||
      typeof evidence.reason !== 'string' || !evidence.reason.trim() || evidence.reason.length > 320
    ) return null;
    capabilityEvidence.push({ capabilityId: evidence.capabilityId as UniversalCapabilityEvidence['capabilityId'], reason: evidence.reason.trim() });
  }
  return {
    pages,
    requestedCapabilities: requestedCapabilitiesValue as string[],
    capabilityEvidence,
  };
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

  const requestedCapabilities = [...new Set([
    ...input.requestedCapabilities,
    ...proposal.requestedCapabilities.filter((capability) => ALLOWED_CAPABILITIES.has(capability)),
  ])];
  const evidenceByCapability = new Map<UniversalCapabilityEvidence['capabilityId'], UniversalCapabilityEvidence>();
  for (const evidence of input.capabilityEvidence ?? []) evidenceByCapability.set(evidence.capabilityId, evidence);
  for (const capability of requestedCapabilities) {
    if (!ALLOWED_CAPABILITIES.has(capability) || evidenceByCapability.get(capability as UniversalCapabilityEvidence['capabilityId'])?.origin === 'explicit') continue;
    const proposedEvidence = proposal.capabilityEvidence?.find((evidence) => evidence.capabilityId === capability);
    evidenceByCapability.set(capability as UniversalCapabilityEvidence['capabilityId'], {
      capabilityId: capability as UniversalCapabilityEvidence['capabilityId'],
      origin: 'inferred',
      reason: proposedEvidence?.reason ?? 'Inferred from the original prompt by the Universal Intent Planner.',
    });
  }

  return {
    ...input,
    pages,
    requestedCapabilities,
    ...(evidenceByCapability.size ? { capabilityEvidence: [...evidenceByCapability.values()] } : {}),
  };
}

export async function planUniversalCreation(
  input: UniversalCreationInput,
): Promise<UniversalCreationInput> {
  const { data, error } = await supabase.functions.invoke('universal-creation-plan', {
    body: { prompt: input.originalPrompt, existingPages: input.pages },
  });
  if (error) {
    const context = (error as { context?: unknown }).context;
    const payload = context instanceof Response
      ? await context.clone().json().catch(() => null) as { error?: unknown } | null
      : null;
    const message = typeof payload?.error === 'string' && payload.error.trim()
      ? payload.error.trim()
      : error.message || 'Universal creation planning failed';
    throw new Error(message);
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Universal creation planner returned an invalid response');
  }
  const response = data as Record<string, unknown>;
  if (response.success !== true) {
    throw new Error(typeof response.error === 'string'
      ? response.error
      : 'Universal creation planner returned no proposal');
  }
  const proposal = parseProposal(response.proposal);
  if (!proposal) throw new Error('Universal creation planner returned an invalid proposal');
  return applyUniversalCreationProposal(input, proposal);
}