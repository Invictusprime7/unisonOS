/**
 * Client access to the marketplace staging service. Calls the
 * marketplace-stage-release edge function with the signed-in user's session;
 * the service verifies the admin role server-side before staging anything.
 */
import { getSupabaseFunctionHeaders, getSupabaseFunctionUrl } from '@/integrations/supabase/supabaseFunctionRequest';

export interface MarketplaceStageResult {
  success: true;
  listingId: string;
  slug: string;
  releaseId: string;
  version: string;
  status: string;
  acceptedRevisionId: string;
  snapshotSha256: string;
}

export async function stageMarketplaceRelease(projectId: string): Promise<MarketplaceStageResult> {
  const headers = await getSupabaseFunctionHeaders();
  const response = await fetch(getSupabaseFunctionUrl('marketplace-stage-release'), {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.success !== true) {
    throw new Error(payload?.error ?? `Staging failed (${response.status}).`);
  }
  return payload as MarketplaceStageResult;
}
