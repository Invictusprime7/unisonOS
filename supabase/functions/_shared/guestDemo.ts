export interface GuestDemoRpcClient {
  rpc(name: string, args: Record<string, unknown>): Promise<{ data: unknown; error: { message?: string } | null }>;
}

export interface GuestDemoReservation {
  operation_id: string;
  operation_key: string;
  project_id: string | null;
  draft_id: string | null;
  max_ai_requests_per_action: number;
  max_input_tokens_per_request: number;
  max_output_tokens_per_request: number;
  max_action_cost_microusd: number;
  expires_at: string;
  action_allowance: number;
}

export interface GuestDemoUsageMeter {
  maxOutputTokens: number;
  reserveProviderCall(input: {
    modelId: string;
    inputTokenLimit: number;
    outputTokenLimit: number;
  }): Promise<string>;
  settleProviderCall(input: {
    callId: string;
    inputTokens: number;
    outputTokens: number;
  }): Promise<void>;
}

export function validateGuestDemoRequest(input: {
  mode?: string;
  operationId?: string | null;
  encodedRequestBytes: number;
  maxInputTokens: number;
  hasAttachments: boolean;
  requestsBusinessCapabilities: boolean;
}): string | null {
  if (input.mode !== 'template-react' && input.mode !== 'builder-source-edit') {
    return 'This AI mode is unavailable in the free demo';
  }
  if (!input.operationId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.operationId)) {
    return 'A valid guest demo operation ID is required';
  }
  if (!Number.isFinite(input.encodedRequestBytes) || input.encodedRequestBytes > input.maxInputTokens * 4) {
    return 'The request exceeds the free demo input limit';
  }
  if (input.hasAttachments) return 'Attachments are unavailable in the free demo';
  if (input.requestsBusinessCapabilities) return 'Business operations are unavailable in the free demo';
  return null;
}

export function classifyGuestDemoError(error: unknown): { status: number; errorType: string; message: string } | null {
  const detail = error instanceof Error ? error.message : String(error ?? '');
  if (detail.includes('Guest demo action cost limit reached')
    || detail.includes('Guest demo session cost limit reached')
    || detail.includes('Guest demo provider usage exceeded')) {
    return { status: 402, errorType: 'guest_cost_limit', message: 'This free demo action reached its usage limit.' };
  }
  if (detail.includes('Insufficient guest demo AI actions')) {
    return { status: 402, errorType: 'insufficient_credits', message: 'Your free demo AI actions are used up.' };
  }
  if (detail.includes('Guest AI request rate limit') || detail.includes('Guest AI action request limit')) {
    return { status: 429, errorType: 'rate_limited', message: 'Too many AI requests. Please wait a moment and try again.' };
  }
  if (detail.includes('no longer active') || detail.includes('session is not active')) {
    return { status: 410, errorType: 'guest_session_expired', message: 'This guest demo session has expired.' };
  }
  if (detail.includes('project scope') || detail.includes('project authorization') || detail.includes('project identity')) {
    return { status: 403, errorType: 'guest_project_scope', message: 'This guest request is outside the demo project.' };
  }
  if (detail.includes('verified anonymous Auth user')) {
    return { status: 403, errorType: 'guest_identity_required', message: 'A verified guest session is required.' };
  }
  return null;
}

function throwRpcError(error: { message?: string } | null, operation: string): void {
  if (error) throw new Error(`Guest demo ${operation} failed: ${error.message || 'database error'}`);
}

export async function reserveGuestDemoAction(
  client: GuestDemoRpcClient,
  input: {
    guestUserId: string;
    operationId: string;
  },
): Promise<GuestDemoReservation> {
  const { data: sessionData, error: sessionError } = await client.rpc('guest_demo_ensure_session', {
    p_guest_user_id: input.guestUserId,
  });
  throwRpcError(sessionError, 'session initialization');

  if (!sessionData || typeof sessionData !== 'object' || !('project_id' in sessionData) || !('draft_id' in sessionData)) {
    throw new Error('Guest demo session returned an invalid project scope');
  }
  const session = sessionData as { project_id: string | null; draft_id: string | null };

  const { data, error } = await client.rpc('guest_demo_reserve_action', {
    p_guest_user_id: input.guestUserId,
    p_project_id: session.project_id,
    p_draft_id: session.draft_id,
    p_operation_id: input.operationId,
  });
  throwRpcError(error, 'action reservation');

  if (!data || typeof data !== 'object' || !('operation_key' in data)) {
    throw new Error('Guest demo reservation returned an invalid policy response');
  }

  return {
    ...(data as Omit<GuestDemoReservation, 'project_id' | 'draft_id'>),
    project_id: session.project_id,
    draft_id: session.draft_id,
  };
}

export async function releaseGuestDemoAction(
  client: GuestDemoRpcClient,
  guestUserId: string,
  operationId: string,
  reason: string,
): Promise<void> {
  const { error } = await client.rpc('guest_demo_release_action', {
    p_guest_user_id: guestUserId,
    p_operation_id: operationId,
    p_reason: reason.slice(0, 120),
  });
  throwRpcError(error, 'action release');
}

export async function executeGuestDemoAction<T>(
  client: GuestDemoRpcClient,
  input: {
    guestUserId: string;
    operationId: string;
  },
  execute: (reservation: GuestDemoReservation) => Promise<T>,
  shouldRelease: (result: T) => boolean,
): Promise<T> {
  const reservation = await reserveGuestDemoAction(client, input);
  try {
    const result = await execute(reservation);
    if (shouldRelease(result)) {
      await releaseGuestDemoAction(client, input.guestUserId, input.operationId, 'ai-request-failed');
    }
    return result;
  } catch (error) {
    try {
      await releaseGuestDemoAction(client, input.guestUserId, input.operationId, 'ai-request-threw');
    } catch {
      // The reservation expires if the best-effort release is unavailable.
    }
    throw error;
  }
}

function rpcObject(data: unknown, operation: string): Record<string, unknown> {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error(`Guest demo ${operation} returned an invalid response`);
  }
  return data as Record<string, unknown>;
}

export function createGuestDemoUsageMeter(
  client: GuestDemoRpcClient,
  input: { guestUserId: string; operationId: string; reservation: GuestDemoReservation },
): GuestDemoUsageMeter {
  return {
    maxOutputTokens: input.reservation.max_output_tokens_per_request,
    async reserveProviderCall(call) {
      const callId = crypto.randomUUID();
      const { data, error } = await client.rpc('guest_demo_reserve_provider_call', {
        p_guest_user_id: input.guestUserId,
        p_operation_id: input.operationId,
        p_call_id: callId,
        p_model_id: call.modelId.replace(/^google\//, ''),
        p_input_token_limit: call.inputTokenLimit,
        p_output_token_limit: call.outputTokenLimit,
      });
      throwRpcError(error, 'provider cost reservation');
      const result = rpcObject(data, 'provider cost reservation');
      if (result.call_id !== callId || typeof result.reserved_cost_microusd !== 'number') {
        throw new Error('Guest demo provider cost reservation returned an invalid policy response');
      }
      return callId;
    },
    async settleProviderCall(call) {
      const { data, error } = await client.rpc('guest_demo_settle_provider_call', {
        p_guest_user_id: input.guestUserId,
        p_operation_id: input.operationId,
        p_call_id: call.callId,
        p_input_tokens: call.inputTokens,
        p_output_tokens: call.outputTokens,
      });
      throwRpcError(error, 'provider usage settlement');
      const result = rpcObject(data, 'provider usage settlement');
      if (typeof result.operation_cost_microusd !== 'number'
        || typeof result.max_action_cost_microusd !== 'number'
        || result.operation_cost_microusd > result.max_action_cost_microusd) {
        throw new Error('Guest demo provider usage exceeded the action cost limit');
      }
    },
  };
}