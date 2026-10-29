import {
  buildPlannedChatCompletionRequest,
  geminiOwnsLeadBudget,
  reserveFallbackWindow,
  PROVIDER_LOOP_TOTAL_BUDGET_MS,
  runProviderLoop,
  resetDirectQuotaCooldown,
} from '../_shared/aiProviderLoop.ts';
import { buildProviderPlan } from '../_shared/providerRouter.ts';
const test = (name: string, fn: () => unknown) => Deno.test(name, async () => { resetDirectQuotaCooldown(); await fn(); });
import { isPageDesignRequest } from '../_shared/catalogTools.ts';
import { buildResponseBody } from '../_shared/responseNormalizer.ts';
import { runComposerLane } from './composerLane.ts';

test('Composer image references survive provider fallback and format repair end to end', async () => {
  await withProviderEnv({ AI_PROVIDER_MODE: 'hybrid', GEMINI_API_KEY: 'test', LOVABLE_API_KEY: 'test' }, async () => {
    const data = 'data:image/png;base64,aGVsbG8=';
    const durableUrl = 'https://example.test/upload.png';
    const sent: Array<{ url: string; messages: Array<{ role: string; content: unknown }> }> = [];
    let gatewayCalls = 0;
    globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      sent.push({ url: String(url), messages: body.messages });
      if (!String(url).includes('lovable')) {
        return new Response('{"error":{"message":"Billing is required"}}', { status: 402 });
      }
      gatewayCalls++;
      const content = gatewayCalls === 1 ? 'invalid response' :
        'SUMMARY: Updated\n<<<EDIT /src/pages/Home.tsx\n<<<<<<< SEARCH\nBefore\n=======\nAfter\n>>>>>>> REPLACE\n>>>END';
      return new Response(JSON.stringify({ choices: [{ message: { content } }] }));
    }) as typeof fetch;
    const response = await runComposerLane(JSON.stringify({
      task: 'builder_source_edit',
      page: { role: 'home', title: 'Home', route: '/', filePath: '/src/pages/Home.tsx' },
      brief: 'Place the uploaded reference', instruction: 'Update the supplied page',
      files: { '/src/pages/Home.tsx': 'export default function Home(){return <main>Before</main>}' },
      sourceTargets: ['/src/pages/Home.tsx'], routes: [],
      runtimeContext: `Uploaded URL: ${durableUrl}`, images: [{ name: 'upload.png', data }],
    }), {}, async aiMessages => runProviderLoop({ aiMessages, providerPlan: hybridPlan, navPageGen: false }));
    assert(response.status === 200, 'Composer should accept the repaired candidate');
    assert(gatewayCalls === 2, 'both generation and format repair must run');
    assert(sent.length === 3, 'failed Gemini lead, gateway generation and gateway repair must run');
    assert(sent[0].url.includes('googleapis') && sent.slice(1).every(call => call.url.includes('lovable')),
      'Gemini must fall back directly to the surviving gateway');
    for (const call of sent) {
      const content = call.messages.find(message => message.role === 'user')?.content;
      assert(Array.isArray(content), 'image content must not be flattened to text');
      assert(JSON.stringify(content).includes(durableUrl), 'durable placement context must survive');
      const image = (content as Array<{ type: string; image_url?: { url: string } }>).find(part => part.type === 'image_url');
      assert(image?.image_url?.url === data, 'reference bytes must survive every attempted provider');
    }
    const payload = await response.json();
    const candidate = JSON.parse(payload.content);
    assert(candidate.fileOps[0].content === 'export default function Home(){return <main>After</main>}', 'repaired file edit must read back intact');
    assert(!candidate.fileOps[0].content.includes(data), 'reference data must not leak into authored source');
  });
});

test('Gemini-primary App Builder turns use Lovable after Gemini fails', async () => {
  await withProviderEnv({ AI_PROVIDER_MODE: 'gemini-primary', GEMINI_API_KEY: 'test', LOVABLE_API_KEY: 'test' }, async () => {
    const calls: string[] = [];
    let geminiCalls = 0;
    const task = {
      type: 'site_page_author' as const,
      fastPath: false,
      shouldUseMemory: false,
      shouldUseCompactContext: false,
      prefersJsonOutput: true,
      skipResearch: true,
      skipThinking: false,
    };
    const providerPlan = buildProviderPlan(task, true, undefined, 'complex', 'composer', (name) => ({
      GEMINI_API_KEY: 'test',
      LOVABLE_API_KEY: 'test',
      AI_PROVIDER_MODE: 'gemini-primary',
    }[name]));
    globalThis.fetch = (async (url: RequestInfo | URL) => {
      const requestUrl = url instanceof Request ? url.url : String(url);
      calls.push(requestUrl);
      if (requestUrl.includes('generativelanguage.googleapis.com')) {
        geminiCalls++;
        if (geminiCalls > 1) {
          return new Response(JSON.stringify({ choices: [{ message: { content: 'Gemini recovered' } }] }));
        }
        throw new DOMException('Gemini timed out', 'TimeoutError');
      }
      if (requestUrl.includes('lovable')) {
        return new Response(JSON.stringify({ choices: [{ message: { content: 'Recovered page' } }] }));
      }
      throw new Error(`Unexpected provider request: ${requestUrl}`);
    }) as typeof fetch;

    const result = await runProviderLoop({
      aiMessages: [{ role: 'user', content: 'Author the Home page' }],
      providerPlan,
      navPageGen: false,
    });

    assert(providerPlan.primaryProvider === 'gemini', 'Gemini must remain primary');
    assert(providerPlan.geminiOnly === false, 'Gemini-primary mode must retain configured fallbacks');
    assert(result.providerUsed === 'lovable' && result.content === 'Recovered page', 'Lovable should recover the failed Gemini request');
    assert(result.modelUsed === 'google/gemini-3.8-flash', 'managed backup must also use Gemini');
    assert(calls.length === 2
      && calls[0].includes('generativelanguage.googleapis.com')
      && calls[1].includes('lovable'), 'direct Gemini then managed gateway');

    calls.length = 0;
    const nextResult = await runProviderLoop({
      aiMessages: [{ role: 'user', content: 'Author the next page' }],
      providerPlan,
      navPageGen: false,
    });
    assert(nextResult.providerUsed === 'gemini' && nextResult.content === 'Gemini recovered', 'a prior timeout must not make Lovable primary on the next turn');
    assert(calls[0].includes('generativelanguage.googleapis.com'), 'the next turn must start with Gemini');
  });
});

test('page design requests cannot be diverted into catalog mutations', () => {
  assert(isPageDesignRequest('home is complete. design the other nav pages.'), 'remaining pages require file output');
  assert(isPageDesignRequest('redesign the Services page'), 'page layout needs file output');
  assert(isPageDesignRequest('wire the in-preview navigation page routes'), 'route wiring requires VFS source output');
  assert(!isPageDesignRequest('change the haircut price to $45'), 'catalog edits retain tools');
});

test('Gemini receives the remaining direct-provider window when no alternative direct provider exists', () => {
  const models = [
    { id: 'google/gemini-3.8-flash', label: 'Gemini', maxTokens: 16000 },
  ];

  assert(geminiOwnsLeadBudget(models, 0, false), 'Gemini owns the plan when no alternative direct provider exists');
  assert(geminiOwnsLeadBudget(models, 0, false, true), 'a prioritized Gemini lead owns its generation window');
  assert(!geminiOwnsLeadBudget(models, 0, true), 'an unavailable Gemini model cannot own the request window');
  assert(!geminiOwnsLeadBudget(models, 1, false), 'an absent model cannot own the request window');
});

test('a failed Gemini page attempt leaves the next request its full remaining window', async () => {
  await withProviderEnv({ AI_PROVIDER_MODE: 'gemini-primary', GEMINI_API_KEY: 'test' }, async () => {
    const calls: string[] = [];
    const logs: string[] = [];
    const originalLog = console.log;
    let geminiAttempt = 0;
    globalThis.fetch = (async (url: RequestInfo | URL) => {
      const requestUrl = url instanceof Request ? url.url : String(url);
      calls.push(requestUrl);
      if (requestUrl.includes('generativelanguage.googleapis.com')) {
        geminiAttempt++;
        return geminiAttempt === 1
          ? new Response('temporary provider error', { status: 500 })
          : new Response(JSON.stringify({ choices: [{ message: { content: 'Gemini page' } }] }));
      }
      throw new Error(`Unexpected provider request: ${requestUrl}`);
    }) as typeof fetch;
    console.log = (...values: unknown[]) => { logs.push(values.join(' ')); };

    try {
      const providerPlan = {
        gatewayModels: [
          { id: 'google/gemini-3.8-flash', label: 'Gemini', maxTokens: 16000 },
        ],
        perModelTimeoutMs: 145_000,
        fallbackMaxTokens: 16000,
        preferLongLeadAttempt: true,
        fallbackReserveMs: 30_000,
      };
      let firstTurnFailed = false;
      try {
        await runProviderLoop({ aiMessages: messages, providerPlan, navPageGen: false });
      } catch {
        firstTurnFailed = true;
      }
      assert(firstTurnFailed, 'the first turn should report the exhausted provider chain');
      calls.length = 0;
      const result = await runProviderLoop({ aiMessages: messages, providerPlan, navPageGen: false });

      assert(result.providerUsed === 'gemini' && result.content === 'Gemini page', 'the next page should still use Gemini');
      assert(calls.length === 1 && calls[0].includes('generativelanguage.googleapis.com'), 'the failed Gemini request must be retried on the next turn');
      assert(logs.some((line) => line.includes('Trying planned direct model Gemini (timeout: 143s')),
        'Gemini should receive the remaining 145 s budget minus 2 s response headroom');
    } finally {
      console.log = originalLog;
    }
  });
});

test('preserves tool-only managed fallback success after Gemini billing exhaustion', async () => {
  const originalFetch = globalThis.fetch;
  const names = ['AI_PROVIDER_MODE', 'GEMINI_API_KEY', 'GOOGLE_API_KEY', 'UNISONGEMINI_API_KEY', 'ANTHROPIC_API_KEY', 'LOVABLE_API_KEY'];
  const originalEnv = new Map(names.map(name => [name, Deno.env.get(name)]));
  const calls: string[] = [];
  const toolCalls = [{ id: 'call_test', type: 'function', function: { name: 'updateCatalogRow', arguments: '{"patch":{"price":45}}' } }];
  try {
    for (const name of names) Deno.env.delete(name);
    Deno.env.set('AI_PROVIDER_MODE', 'hybrid');
    Deno.env.set('GEMINI_API_KEY', 'test');
    Deno.env.set('LOVABLE_API_KEY', 'test');
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body));
      calls.push(request.model);
      const requestUrl = input instanceof Request ? input.url : String(input);
      if (requestUrl.includes('googleapis')) return new Response('{"error":{"message":"Billing is required"}}', { status: 402 });
      if (requestUrl.includes('lovable')) return new Response(JSON.stringify({ choices: [{ message: { content: null, tool_calls: toolCalls } }] }));
      throw new Error('Unexpected fallback after success');
    }) as typeof fetch;
    const result = await runProviderLoop({
      aiMessages: [{ role: 'user', content: 'Change the haircut price to $45' }],
      navPageGen: false,
      tools: [{ type: 'function', function: { name: 'updateCatalogRow', parameters: { type: 'object' } } }],
      providerPlan: {
        gatewayModels: [{ id: 'google/gemini-3.8-flash', label: 'Gemini', maxTokens: 1000 }],
        perModelTimeoutMs: 45000, fallbackMaxTokens: 1000,
      },
    });
    assert(result.providerUsed === 'lovable', 'successful managed fallback must be returned');
    assert(result.toolCalls?.[0].id === 'call_test', 'tool call must survive');
    assert(calls.length === 2, 'Gemini then managed fallback, with no later providers after tool-only success');
    const body = buildResponseBody({ ...result, generatedImageUrl: '' });
    assert(Array.isArray(body.tool_calls) && body.tool_calls.length === 1, 'HTTP response must forward the tool call');
  } finally {
    globalThis.fetch = originalFetch;
    for (const [name, value] of originalEnv) {
      if (value === undefined) Deno.env.delete(name);
      else Deno.env.set(name, value);
    }
  }
});

const integrationEnvNames = ['AI_PROVIDER_MODE', 'GEMINI_API_KEY', 'GOOGLE_API_KEY', 'UNISONGEMINI_API_KEY', 'ANTHROPIC_API_KEY', 'LOVABLE_API_KEY'];
async function withProviderEnv(config: Record<string, string>, run: () => Promise<void>) {
  const originalEnv = new Map(integrationEnvNames.map(name => [name, Deno.env.get(name)]));
  const originalFetch = globalThis.fetch;
  try {
    for (const name of integrationEnvNames) Deno.env.delete(name);
    for (const [name, value] of Object.entries(config)) Deno.env.set(name, value);
    await run();
  } finally {
    globalThis.fetch = originalFetch;
    for (const [name, value] of originalEnv) {
      if (value === undefined) Deno.env.delete(name); else Deno.env.set(name, value);
    }
  }
}
const hybridPlan = { gatewayModels: [
  { id: 'google/gemini-3.8-flash', label: 'Gemini', maxTokens: 1000 },
], perModelTimeoutMs: 110_000, fallbackMaxTokens: 1000, preferLongLeadAttempt: true, fallbackReserveMs: 30_000 };

test('funded Gemini answers before configured Lovable fallback', async () => {
  await withProviderEnv({ AI_PROVIDER_MODE: 'hybrid', GEMINI_API_KEY: 'test', LOVABLE_API_KEY: 'test' }, async () => {
    const calls: string[] = [];
    globalThis.fetch = (async (url: RequestInfo | URL) => {
      calls.push(String(url));
      return new Response(JSON.stringify({ choices: [{ message: { content: 'Gemini page' } }] }));
    }) as typeof fetch;
    const result = await runProviderLoop({ aiMessages: messages, providerPlan: hybridPlan, navPageGen: false });
    assert(result.providerUsed === 'gemini', 'Gemini must own the successful page');
    assert(calls.length === 1 && calls[0].includes('generativelanguage.googleapis.com'), 'fallbacks must not preempt Gemini');
  });
});

test('guest metering pins generation to priced Gemini and reconciles returned usage', async () => {
  await withProviderEnv({ AI_PROVIDER_MODE: 'hybrid', GEMINI_API_KEY: 'test', LOVABLE_API_KEY: 'test' }, async () => {
    const requests: Array<{ url: string; body: Record<string, unknown> }> = [];
    let tokenCountCalls = 0;
    let tokenCountRequest: Record<string, unknown> | undefined;
    let tokenCountApiKey: string | null = null;
    const reservations: Array<{ modelId: string; inputTokenLimit: number; outputTokenLimit: number }> = [];
    const settlements: Array<{ callId: string; inputTokens: number; outputTokens: number }> = [];
    globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
      if (String(url).includes(':countTokens')) {
        tokenCountCalls++;
        tokenCountRequest = JSON.parse(String(init?.body));
        tokenCountApiKey = new Headers(init?.headers).get('x-goog-api-key');
        return new Response(JSON.stringify({ totalTokens: 420 }));
      }
      requests.push({ url: String(url), body: JSON.parse(String(init?.body)) });
      return new Response(JSON.stringify({
        model: 'gemini-3.8-flash',
        choices: [{ message: { content: 'Guest page' } }],
        usage: { prompt_tokens: 420, completion_tokens: 180 },
      }));
    }) as typeof fetch;

    const result = await runProviderLoop({
      aiMessages: [{ role: 'system', content: 'Use the supplied source only.' }, ...messages],
      navPageGen: false,
      tools: [{ type: 'function', function: { name: 'updateCatalogRow', parameters: { type: 'object' } } }],
      providerPlan: {
        ...hybridPlan,
        raceGateway: true,
      },
      guestUsageMeter: {
        maxOutputTokens: 8192,
        async reserveProviderCall(input) {
          reservations.push(input);
          return 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
        },
        async settleProviderCall(input) { settlements.push(input); },
      },
    });

    assert(result.providerUsed === 'gemini' && result.content === 'Guest page', 'guest should receive the priced Gemini result');
    assert(requests.length === 1 && requests[0].url.includes('generativelanguage.googleapis.com'), 'guest calls must not reach the managed gateway');
    assert(tokenCountCalls === 1, 'guest cost reservation must count the complete prompt before generation');
    const generationRequest = tokenCountRequest?.generateContentRequest as {
      systemInstruction?: { parts?: Array<{ text?: string }> };
      contents?: unknown[];
    } | undefined;
    assert(tokenCountApiKey === 'test', 'token counting must use the server-side Gemini key header');
    assert(generationRequest?.systemInstruction?.parts?.[0]?.text === 'Use the supplied source only.', 'token counting must include the complete system instruction');
    assert(generationRequest?.contents?.length === 1, 'token counting must include the user turn');
    assert(requests[0].body.max_tokens === 1000, 'guest output must remain within the provider plan and policy cap');
    assert(!('tools' in requests[0].body), 'guest requests must not forward unmetered catalog tools');
    assert(reservations.length === 1 && reservations[0].modelId === 'google/gemini-3.8-flash', 'cost must be reserved for the exact priced model');
    assert(reservations[0].inputTokenLimit > 420 && reservations[0].outputTokenLimit === 1000, 'reservation must include counted input and framing headroom');
    assert(settlements.length === 1 && settlements[0].inputTokens === 420 && settlements[0].outputTokens === 180, 'actual provider usage must be reconciled');
  });
});

test('hybrid fallbacks reach Lovable after Gemini failure', async () => {
  await withProviderEnv({ AI_PROVIDER_MODE: 'hybrid', GEMINI_API_KEY: 'test', LOVABLE_API_KEY: 'test' }, async () => {
    const calls: string[] = [];
    globalThis.fetch = (async (url: RequestInfo | URL) => {
      calls.push(String(url));
      if (String(url).includes('lovable')) return new Response(JSON.stringify({ choices: [{ message: { content: 'Recovered page' } }] }));
      return new Response('{"error":{"message":"Billing is required"}}', { status: 402 });
    }) as typeof fetch;
    const result = await runProviderLoop({ aiMessages: messages, providerPlan: hybridPlan, navPageGen: false });
    assert(result.providerUsed === 'lovable' && result.content === 'Recovered page', 'managed fallback should recover');
    assert(calls.length === 2 && calls[0].includes('googleapis') && calls[1].includes('lovable'), 'expected Gemini then Lovable');
  });
});

test('Gemini credits exhausted falls back to Lovable Cloud AI and stays there while cooled down', async () => {
  await withProviderEnv({ AI_PROVIDER_MODE: 'hybrid', GEMINI_API_KEY: 'test', LOVABLE_API_KEY: 'test' }, async () => {
    const calls: string[] = [];
    globalThis.fetch = (async (url: RequestInfo | URL) => {
      calls.push(String(url));
      if (String(url).includes('googleapis')) {
        return new Response('{"error":{"message":"Your prepayment credits are depleted. Please add credits."}}', { status: 402 });
      }
      return new Response(JSON.stringify({ choices: [{ message: { content: 'Recovered by Lovable Cloud AI' } }] }));
    }) as typeof fetch;
    const geminiOnlyPlan = {
      ...hybridPlan,
      gatewayModels: [hybridPlan.gatewayModels[0]],
      geminiOnly: true,
    };
    const first = await runProviderLoop({ aiMessages: messages, providerPlan: geminiOnlyPlan, navPageGen: false });
    assert(first.providerUsed === 'lovable' && first.content === 'Recovered by Lovable Cloud AI', 'Lovable Cloud AI must take over when Gemini credit is out');
    assert(calls.length === 2 && calls[0].includes('googleapis') && calls[1].includes('lovable'), 'expected Gemini attempt then managed gateway');

    calls.length = 0;
    const second = await runProviderLoop({ aiMessages: messages, providerPlan: geminiOnlyPlan, navPageGen: false });
    assert(second.providerUsed === 'lovable', 'cooled-down Gemini must not be retried');
    assert(calls.length === 1 && calls[0].includes('lovable'), 'the depleted key must be skipped until credits are added');
  });
});

test('provider failover respects the remaining Composer request budget', async () => {
  await withProviderEnv({ AI_PROVIDER_MODE: 'hybrid', GEMINI_API_KEY: 'test' }, async () => {
    const originalNow = Date.now;
    let now = 1000, calls = 0;
    Date.now = () => now;
    try {
      globalThis.fetch = (async () => {
        calls++; now += 18_000;
        return new Response('{"error":{"message":"Billing is required"}}', { status: 402 });
      }) as typeof fetch;
      const result = await runProviderLoop({ aiMessages: messages, providerPlan: hybridPlan, navPageGen: false, totalBudgetMs: 20_000 });
      assert(result.earlyError?.status === 402, 'provider failure should remain available to the caller');
      assert(calls === 1, 'the fallback must not start a new 135 second budget');
    } finally { Date.now = originalNow; }
  });
});

test('gateway body parsing remains cancellable after response headers arrive', async () => {
  await withProviderEnv({ AI_PROVIDER_MODE: 'hybrid', LOVABLE_API_KEY: 'test' }, async () => {
    const controller = new AbortController();
    globalThis.fetch = (async (_url: RequestInfo | URL, init?: RequestInit) => {
      return new Response(new ReadableStream({
        pull(stream) {
          controller.abort(new DOMException('Composer deadline exceeded', 'TimeoutError'));
          assert(init?.signal?.aborted === true, 'provider cancellation must remain linked while reading the body');
          stream.error(init?.signal?.reason);
        },
      }, { highWaterMark: 0 }));
    }) as typeof fetch;
    try {
      await runProviderLoop({ aiMessages: messages, providerPlan: hybridPlan, navPageGen: false, signal: controller.signal });
      throw new Error('Expected cancellation');
    } catch (error) {
      assert(error instanceof Error && error.name === 'TimeoutError', 'request deadline must terminate body parsing');
    }
  });
});

test('request cancellation interrupts managed gateway retry backoff', async () => {
  await withProviderEnv({ AI_PROVIDER_MODE: 'hybrid', LOVABLE_API_KEY: 'test' }, async () => {
    const controller = new AbortController();
    let calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      return new Response('{"message":"Rate limited"}', { status: 429, headers: { 'retry-after': '10' } });
    }) as typeof fetch;
    const timer = setTimeout(() => controller.abort(new DOMException('Composer deadline exceeded', 'TimeoutError')), 5);
    try {
      await runProviderLoop({ aiMessages: messages, providerPlan: hybridPlan, navPageGen: false, signal: controller.signal });
      throw new Error('Expected cancellation');
    } catch (error) {
      assert(error instanceof Error && error.name === 'TimeoutError', 'deadline should interrupt retry backoff');
      assert(calls === 1, 'no provider replay should occur after cancellation');
    } finally { clearTimeout(timer); }
  });
});

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const messages = [{ role: 'user', content: 'Generate the requested site.' }];

test('preserves fallback time after a reasoning timeout', () => {
  assert(reserveFallbackWindow(90_000, 134_800, 60_000) === 72_800, 'lead must preserve fallback time after billing failure');
  assert(reserveFallbackWindow(110_000, 135_000, 60_000) === 73_000, 'Composer must preserve fallback time');
});

test('keeps server headroom beyond the funded Wizard lead attempt', () => {
  assert(PROVIDER_LOOP_TOTAL_BUDGET_MS === 145_000, 'provider loop should allow 145 seconds');
});

test('keeps reasoning_effort for Gemini compatibility requests', () => {
  const request = buildPlannedChatCompletionRequest({
    model: { id: 'google/gemini-3.8-flash', label: 'Gemini 3.8 Flash', maxTokens: 36_000 },
    aiMessages: messages,
    reasoningEffort: 'medium',
  });

  assert(request.max_tokens === 36_000, 'Gemini should use max_tokens');
  assert(request.reasoning_effort === 'medium', 'Gemini should retain reasoning_effort');
});

test('does not cooldown funded Gemini after a request-rate quota 429', async () => {
    await withProviderEnv({ AI_PROVIDER_MODE: 'hybrid', GEMINI_API_KEY: 'test' }, async () => {
      let calls = 0;
      globalThis.fetch = (async () => {
        calls++;
        if (calls <= 2) {
          return new Response('{"error":{"message":"Quota exceeded for requests per minute"}}', {
            status: 429,
            headers: { 'retry-after': '0' },
          });
        }
        return new Response(JSON.stringify({ choices: [{ message: { content: 'Gemini recovered' } }] }));
      }) as typeof fetch;

      const first = await runProviderLoop({
        aiMessages: messages,
        providerPlan: { ...hybridPlan, gatewayModels: [hybridPlan.gatewayModels[0]] },
        navPageGen: false,
      });
      assert(first.earlyError?.status === 429, 'request-rate quota should remain a transient rate limit');

      const second = await runProviderLoop({
        aiMessages: messages,
        providerPlan: { ...hybridPlan, gatewayModels: [hybridPlan.gatewayModels[0]] },
        navPageGen: false,
      });
      assert(second.providerUsed === 'gemini' && second.content === 'Gemini recovered', 'the next request should retry funded Gemini');
      assert(calls === 3, `expected the retried Gemini request to succeed, got ${calls} provider calls`);
    });
  });

  test('Gemini billing exhaustion does not invoke an unsupported direct provider', async () => {
  const originalFetch = globalThis.fetch;
  const envNames = ['AI_PROVIDER_MODE', 'GEMINI_API_KEY', 'GOOGLE_API_KEY', 'UNISONGEMINI_API_KEY', 'ANTHROPIC_API_KEY', 'LOVABLE_API_KEY'];
  const originalEnv = new Map(envNames.map((name) => [name, Deno.env.get(name)]));
  const requestedUrls: string[] = [];

  Deno.env.set('AI_PROVIDER_MODE', 'hybrid');
  Deno.env.set('GEMINI_API_KEY', 'test-gemini-key');
  Deno.env.delete('GOOGLE_API_KEY');
  Deno.env.delete('UNISONGEMINI_API_KEY');
  Deno.env.delete('ANTHROPIC_API_KEY');
  Deno.env.delete('LOVABLE_API_KEY');

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    requestedUrls.push(url);
    if (url.includes('generativelanguage.googleapis.com')) {
      return new Response(JSON.stringify({ error: { message: 'Billing is required.' } }), {
        status: 402,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    throw new Error(`Unexpected provider URL: ${url}`);
  }) as typeof fetch;

  try {
    const result = await runProviderLoop({
      aiMessages: messages,
      providerPlan: {
        gatewayModels: [
          { id: 'google/gemini-3.8-flash', label: 'Gemini 3.8 Flash', maxTokens: 36_000 },
        ],
        perModelTimeoutMs: 30_000,
        fallbackMaxTokens: 36_000,
      },
      navPageGen: false,
    });

    assert(result.earlyError?.status === 402, 'Gemini billing exhaustion should be surfaced');
    assert(requestedUrls.length === 1, 'the loop should make only the configured Gemini request');
    assert(requestedUrls[0].includes('generativelanguage.googleapis.com'), 'the configured Gemini provider should be used');
  } finally {
    globalThis.fetch = originalFetch;
    for (const [name, value] of originalEnv) {
      if (value === undefined) Deno.env.delete(name);
      else Deno.env.set(name, value);
    }
  }
});

test('Lovable AI 429 is retried and its refusal remains visible', async () => {
  const originalFetch = globalThis.fetch;
  const names = ['AI_PROVIDER_MODE', 'GEMINI_API_KEY', 'GOOGLE_API_KEY', 'UNISONGEMINI_API_KEY', 'ANTHROPIC_API_KEY', 'LOVABLE_API_KEY'];
  const originalEnv = new Map(names.map(name => [name, Deno.env.get(name)]));
  const plan = { gatewayModels: [{ id: 'google/gemini-3.8-flash', label: 'Gemini', maxTokens: 1000 }], perModelTimeoutMs: 45000, fallbackMaxTokens: 1000 };
  try {
    for (const name of names) Deno.env.delete(name);
    Deno.env.set('AI_PROVIDER_MODE', 'hybrid');
    Deno.env.set('LOVABLE_API_KEY', 'test');
    const isGateway = (input: RequestInfo | URL) => String(input instanceof Request ? input.url : input).includes('lovable');

    // 1) Two transient 429s, then success: the page is written by Lovable AI.
    let gatewayCalls = 0;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      if (isGateway(input)) {
        gatewayCalls++;
        if (gatewayCalls < 3) return new Response('{"message":"Rate limited"}', { status: 429, headers: { 'retry-after': '1' } });
        return new Response(JSON.stringify({ choices: [{ message: { content: 'page source' } }] }));
      }
      throw new Error('direct providers must not run after gateway success');
    }) as typeof fetch;
    const ok = await runProviderLoop({ aiMessages: [{ role: 'user', content: 'x' }], navPageGen: false, providerPlan: plan });
    assert(ok.providerUsed === 'lovable' && ok.content === 'page source', 'gateway retry must recover the page');
    assert(gatewayCalls === 3, 'two bounded retries');

    // 2) Gateway keeps refusing: surface the gateway's answer.
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      if (isGateway(input)) return new Response('{"message":"Too many requests right now"}', { status: 429, headers: { 'retry-after': '1' } });
      throw new Error('no direct provider should run after the gateway refusal');
    }) as typeof fetch;
    const failed = await runProviderLoop({ aiMessages: [{ role: 'user', content: 'x' }], navPageGen: false, providerPlan: plan });
    assert(failed.earlyError?.status === 429, `expected gateway 429, got ${failed.earlyError?.status}`);
    assert(/Lovable AI: Too many requests/.test(failed.earlyError?.error ?? ''), failed.earlyError?.error ?? 'missing');
  } finally {
    globalThis.fetch = originalFetch;
    for (const [name, value] of originalEnv) {
      if (value === undefined) Deno.env.delete(name);
      else Deno.env.set(name, value);
    }
  }
});
