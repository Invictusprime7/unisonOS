import { supabase } from '@/integrations/supabase/client';

export interface AccountDemoStatus {
  generationCount: number;
  remaining: number;
  inProgress: boolean;
  projectId: string | null;
}

export async function readAccountDemoStatus(): Promise<AccountDemoStatus> {
  const { data, error } = await supabase.rpc('account_demo_status');
  if (error) throw new Error('Your demo allowance could not be checked. Please try again.');
  const result = data as { generation_count?: number; remaining?: number; in_progress?: boolean; project_id?: string | null } | null;
  if (!result || !Number.isInteger(result.generation_count) || !Number.isInteger(result.remaining) || typeof result.in_progress !== 'boolean') {
    throw new Error('Your demo allowance could not be checked. Please try again.');
  }
  return { generationCount: Number(result.generation_count), remaining: Number(result.remaining), inProgress: result.in_progress, projectId: result.project_id ?? null };
}

/** The database settles this reservation only when the canonical revision saves. */
export async function withAccountDemoGeneration<T>(generate: (operationId: string) => Promise<T>): Promise<T> {
  const operationId = crypto.randomUUID();
  const { error } = await supabase.rpc('reserve_account_demo_generation', { p_operation_id: operationId });
  if (error) throw new Error(error.message || 'Your demo generation could not start. Please try again.');
  try {
    return await generate(operationId);
  } finally {
    // Settled reservations are immutable; failures release the slot. Expiry
    // recovers abandoned tabs when this request cannot reach the server.
    try { await supabase.rpc('release_account_demo_generation', { p_operation_id: operationId }); }
    catch { /* Server expiry handles a disconnected browser. */ }
  }
}