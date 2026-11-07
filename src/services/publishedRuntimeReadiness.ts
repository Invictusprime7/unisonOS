import type { PublishedRuntimeConfig } from '@/services/canonicalLaunchVfs';

export interface PublishedRuntimeReadiness {
  ok: boolean;
  required: {
    profile: boolean;
    catalog: boolean;
    forms: boolean;
    payments: boolean;
  };
  blockers: string[];
}

/**
 * Checks the public config actually embedded in the generated site. This
 * prevents a launch from passing with preview-only wiring or missing public
 * endpoints for the live surfaces its VFS contains.
 */
export function evaluatePublishedRuntimeReadiness(input: {
  runtime: PublishedRuntimeConfig;
  bindingCount: number;
  formDefinitionCount: number;
  commerceRequired?: boolean;
  paymentProviderConfigured?: boolean;
}): PublishedRuntimeReadiness {
  const required = {
    profile: true,
    catalog: input.bindingCount > 0,
    forms: input.formDefinitionCount > 0,
    payments: input.commerceRequired === true,
  };
  const blockers: string[] = [];

  if (!input.runtime.siteId || !input.runtime.businessId || !input.runtime.projectId) {
    blockers.push('Published runtime identity is incomplete.');
  }
  if ((required.profile || required.catalog) && !input.runtime.endpoint) {
    blockers.push('Published profile/catalog runtime endpoint is unavailable.');
  }
  if (required.forms && !input.runtime.formEndpoint) {
    blockers.push('Published form submission endpoint is unavailable.');
  }
  if (required.payments && input.paymentProviderConfigured !== true) {
    blockers.push('Payment provider is not configured for requested checkout.');
  }

  return { ok: blockers.length === 0, required, blockers };
}