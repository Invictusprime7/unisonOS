import { rateLimitDelayMs, waitForRateLimit } from './rateLimitRetry.ts';

Deno.test('cooldown parses seconds, HTTP dates and Google RetryInfo without shortening', () => {
  const now = Date.parse('2026-10-31T07:30:00Z');
  const values = [
    rateLimitDelayMs(new Headers({ 'retry-after': '60' }), '', 0, now),
    rateLimitDelayMs(new Headers({ 'retry-after': 'Sat, 31 Oct 2026 07:31:00 GMT' }), '', 0, now),
    rateLimitDelayMs(new Headers(), JSON.stringify({ error: { details: [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '45.5s' }] } })),
    rateLimitDelayMs(new Headers({ 'retry-after': '0' }), ''),
  ];
  if (JSON.stringify(values) !== JSON.stringify([60000, 60000, 45500, 1500])) throw new Error(`Wrong cooldowns: ${values}`);
});

Deno.test('cancelled retry wait stops without a provider request', async () => {
  const controller = new AbortController();
  const waiting = waitForRateLimit(60000, controller.signal);
  controller.abort(new DOMException('Cancelled', 'AbortError'));
  try { await waiting; throw new Error('Cancellation was ignored'); }
  catch (error) { if (!(error instanceof Error) || error.name !== 'AbortError') throw error; }
});