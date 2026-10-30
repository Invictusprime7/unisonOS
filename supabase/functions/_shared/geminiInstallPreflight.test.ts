import { checkGeminiForInstall } from './geminiInstallPreflight.ts';

function assert(condition: unknown, message = 'Assertion failed'): asserts condition {
  if (!condition) throw new Error(message);
}
const env = (name: string) => name === 'UNISONGEMINI_API_KEY' ? 'test-key' : name === 'GEMINI_COMPOSER_MODEL' ? 'gemini-custom' : undefined;

Deno.test('install preflight uses the owner key configuration and Composer model with one tiny no-retry call', async () => {
  let calls = 0;
  const result = await checkGeminiForInstall(undefined, async (request, signal, retry) => {
    calls++;
    assert(request.model === 'google/gemini-custom');
    assert(request.max_tokens === 16 && request.stream === false);
    assert(retry === false && signal instanceof AbortSignal);
    return Response.json({ choices: [{ message: { content: 'OK' } }] });
  }, env);
  assert(result.ready && result.code === 'ready' && calls === 1);
});

for (const [status, detail, code] of [
  [402, 'prepayment credits depleted', 'credits_exhausted'],
  [429, 'insufficient_quota', 'credits_exhausted'],
  [429, 'Too many requests', 'rate_limited'],
  [403, 'invalid key', 'unauthorized'],
  [404, 'missing model', 'model_unavailable'],
  [503, 'unavailable', 'unreachable'],
] as const) {
  Deno.test(`install preflight rejects ${status} ${detail} without fallback or raw detail`, async () => {
    let calls = 0;
    const result = await checkGeminiForInstall(undefined, async () => {
      calls++;
      return Response.json({ error: { message: detail, secret: 'never-expose' } }, { status });
    }, env);
    assert(!result.ready && result.code === code && calls === 1);
    assert(!result.message.includes('never-expose'));
  });
}

Deno.test('install preflight does not call a provider without a Gemini key even with backup configured', async () => {
  let calls = 0;
  const result = await checkGeminiForInstall(undefined, async () => { calls++; return Response.json({}); }, name => name === 'LOVABLE_API_KEY' ? 'backup' : undefined);
  assert(!result.ready && result.code === 'not_configured' && calls === 0);
});

Deno.test('install preflight checks again immediately after credits are replenished', async () => {
  let calls = 0;
  const invoke = async () => ++calls === 1
    ? Response.json({ error: 'prepayment credits depleted' }, { status: 402 })
    : Response.json({ choices: [{ message: { content: 'OK' } }] });
  assert(!(await checkGeminiForInstall(undefined, invoke, env)).ready);
  assert((await checkGeminiForInstall(undefined, invoke, env)).ready && calls === 2);
});

Deno.test('install preflight rejects network failures and aborted requests', async () => {
  const network = await checkGeminiForInstall(undefined, async () => { throw new TypeError('network'); }, env);
  assert(!network.ready && network.code === 'unreachable');
  const controller = new AbortController();
  controller.abort();
  const aborted = await checkGeminiForInstall(controller.signal, async (_request, signal) => {
    signal?.throwIfAborted();
    return Response.json({});
  }, env);
  assert(!aborted.ready && aborted.code === 'timeout');
});