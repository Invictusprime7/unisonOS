import { classifyGuestDemoError, createGuestDemoUsageMeter, executeGuestDemoAction, reserveGuestDemoAction, validateGuestDemoRequest, type GuestDemoRpcClient } from './guestDemo.ts';

const reservation = {
  operation_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  operation_key: 'guest-demo:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  project_id: null,
  draft_id: null,
  max_ai_requests_per_action: 12,
  max_input_tokens_per_request: 12000,
  max_output_tokens_per_request: 8192,
  max_action_cost_microusd: 150000,
  expires_at: '2026-10-18T12:00:00.000Z',
  action_allowance: 3,
};
const sessionScope = { project_id: null, draft_id: null };

Deno.test('guest reservation ensures the session before reserving an action', async () => {
  const calls: string[] = [];
  const serverScope = {
    project_id: '33333333-3333-4333-8333-333333333333',
    draft_id: '44444444-4444-4444-8444-444444444444',
  };
  const client: GuestDemoRpcClient = {
    async rpc(name, args) {
      calls.push(name);
      if (name === 'guest_demo_reserve_action' && (
        args.p_project_id !== serverScope.project_id || args.p_draft_id !== serverScope.draft_id
      )) throw new Error('Reservation did not use the server-owned project scope');
      return {
        data: name === 'guest_demo_ensure_session' ? serverScope
          : name === 'guest_demo_reserve_action' ? reservation
            : null,
        error: null,
      };
    },
  };

  const result = await reserveGuestDemoAction(client, {
    guestUserId: '11111111-1111-4111-8111-111111111111',
    operationId: reservation.operation_id,
  });

  if (calls.join(',') !== 'guest_demo_ensure_session,guest_demo_reserve_action') {
    throw new Error(`Unexpected guest RPC order: ${calls.join(',')}`);
  }
  if (result.operation_key !== reservation.operation_key) {
    throw new Error('Reservation response did not preserve the operation key');
  }
  if (result.project_id !== serverScope.project_id || result.draft_id !== serverScope.draft_id) {
    throw new Error('Reservation result did not preserve the server-owned project scope');
  }
});

Deno.test('guest reservation stops if session initialization fails', async () => {
  let reserveCalled = false;
  const client: GuestDemoRpcClient = {
    async rpc(name) {
      if (name === 'guest_demo_reserve_action') reserveCalled = true;
      return { data: null, error: name === 'guest_demo_ensure_session' ? { message: 'not anonymous' } : null };
    },
  };

  try {
    await reserveGuestDemoAction(client, {
      guestUserId: '11111111-1111-4111-8111-111111111111',
      projectId: null,
      draftId: null,
      operationId: reservation.operation_id,
    });
    throw new Error('Expected session initialization to fail');
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes('session initialization failed')) throw error;
  }
  if (reserveCalled) throw new Error('Reservation must not run when session initialization fails');
});

Deno.test('guest action releases its reservation when generation returns a failed response', async () => {
  const calls: string[] = [];
  const client: GuestDemoRpcClient = {
    async rpc(name) {
      calls.push(name);
      return {
        data: name === 'guest_demo_ensure_session' ? sessionScope
          : name === 'guest_demo_reserve_action' ? reservation
            : null,
        error: null,
      };
    },
  };

  const result = await executeGuestDemoAction(
    client,
    { guestUserId: '11111111-1111-4111-8111-111111111111', operationId: reservation.operation_id },
    async () => ({ ok: false }),
    response => !response.ok,
  );

  if (result.ok) throw new Error('Expected the failed response to be preserved');
  if (!calls.includes('guest_demo_release_action')) throw new Error('Expected failed generation to release the reservation');
});

Deno.test('guest action keeps a successful response reserved for revision settlement', async () => {
  const calls: string[] = [];
  const client: GuestDemoRpcClient = {
    async rpc(name) {
      calls.push(name);
      return {
        data: name === 'guest_demo_ensure_session' ? sessionScope
          : name === 'guest_demo_reserve_action' ? reservation
            : null,
        error: null,
      };
    },
  };

  await executeGuestDemoAction(
    client,
    { guestUserId: '11111111-1111-4111-8111-111111111111', operationId: reservation.operation_id },
    async () => ({ ok: true }),
    response => !response.ok,
  );

  if (calls.includes('guest_demo_release_action')) throw new Error('Successful generation must remain reserved until a revision settles');
});

Deno.test('guest requests require an allowed mode, bounded body, and operation identity', () => {
  const allowed = {
    mode: 'template-react',
    operationId: reservation.operation_id,
    encodedRequestBytes: 48000,
    maxInputTokens: 12000,
    hasAttachments: false,
    requestsBusinessCapabilities: false,
  };
  if (validateGuestDemoRequest(allowed) !== null) throw new Error('Expected a bounded source-edit request to be allowed');
  if (!validateGuestDemoRequest({ ...allowed, mode: 'image-generate' })) throw new Error('Expected image generation to be denied');
  if (!validateGuestDemoRequest({ ...allowed, operationId: 'not-a-uuid' })) throw new Error('Expected malformed operation identity to be denied');
  if (!validateGuestDemoRequest({ ...allowed, encodedRequestBytes: 48001 })) throw new Error('Expected oversized request to be denied');
  if (!validateGuestDemoRequest({ ...allowed, hasAttachments: true })) throw new Error('Expected attachments to be denied');
  if (!validateGuestDemoRequest({ ...allowed, requestsBusinessCapabilities: true })) throw new Error('Expected business capability requests to be denied');
});

Deno.test('guest credit and rate-limit failures have distinct API classifications', () => {
  const exhausted = classifyGuestDemoError(new Error('Guest demo action reservation failed: Insufficient guest demo AI actions'));
  const limited = classifyGuestDemoError(new Error('Guest demo action reservation failed: Guest AI request rate limit reached'));
  if (exhausted?.status !== 402 || exhausted.errorType !== 'insufficient_credits') throw new Error('Expected an insufficient-credit response');
  if (limited?.status !== 429 || limited.errorType !== 'rate_limited') throw new Error('Expected a rate-limited response');
  const costLimit = classifyGuestDemoError(new Error('Guest demo provider cost reservation failed: Guest demo action cost limit reached'));
  if (costLimit?.status !== 402 || costLimit.errorType !== 'guest_cost_limit') throw new Error('Expected an action cost-limit response');
  const sessionCostLimit = classifyGuestDemoError(new Error('Guest demo provider cost reservation failed: Guest demo session cost limit reached'));
  if (sessionCostLimit?.status !== 402 || sessionCostLimit.errorType !== 'guest_cost_limit') throw new Error('Expected a session cost-limit response');
});

Deno.test('guest provider usage reserves before sending and settles actual usage', async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const client: GuestDemoRpcClient = {
    async rpc(name, args) {
      calls.push({ name, args });
      return {
        data: name === 'guest_demo_reserve_provider_call'
          ? { call_id: args.p_call_id, reserved_cost_microusd: 50000 }
          : { actual_cost_microusd: 12000, operation_cost_microusd: 12000, max_action_cost_microusd: 150000 },
        error: null,
      };
    },
  };
  const meter = createGuestDemoUsageMeter(client, {
    guestUserId: '11111111-1111-4111-8111-111111111111',
    operationId: reservation.operation_id,
    reservation,
  });
  const callId = await meter.reserveProviderCall({
    modelId: 'google/gemini-3.8-flash', inputTokenLimit: 4000, outputTokenLimit: 1000,
  });
  await meter.settleProviderCall({ callId, inputTokens: 700, outputTokens: 400 });

  if (meter.maxOutputTokens !== reservation.max_output_tokens_per_request) throw new Error('Output cap was not preserved');
  if (calls[0]?.name !== 'guest_demo_reserve_provider_call' || calls[1]?.name !== 'guest_demo_settle_provider_call') {
    throw new Error('Provider usage must reserve before settlement');
  }
  if (calls[0].args.p_model_id !== 'gemini-3.8-flash' || calls[1].args.p_call_id !== callId) {
    throw new Error('Provider usage RPC arguments were not normalized or correlated');
  }
});