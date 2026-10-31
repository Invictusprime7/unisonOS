/** Google may put its cooldown in RetryInfo rather than an HTTP header. */
export function rateLimitDelayMs(headers: Headers, body: string, attempt = 0, now = Date.now()): number {
  const header = headers.get('retry-after');
  if (header !== null) {
    const seconds = Number(header);
    const delay = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(header) - now;
    if (Number.isFinite(delay) && delay > 0) return Math.ceil(delay);
  }
  try {
    const payload = JSON.parse(body);
    const details = payload?.error?.details;
    if (Array.isArray(details)) {
      for (const detail of details) {
        if (detail?.['@type'] !== 'type.googleapis.com/google.rpc.RetryInfo') continue;
        const match = /^(\d+(?:\.\d+)?)s$/.exec(String(detail.retryDelay));
        if (match && Number(match[1]) > 0) return Math.ceil(Number(match[1]) * 1000);
      }
    }
  } catch { /* Safe default for non-JSON refusals. */ }
  return 1500 * 2 ** attempt;
}

/** Retry waits belong to the request, never an expired generation attempt. */
export function waitForRateLimit(delayMs: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      reject(signal?.reason ?? new DOMException('Request aborted', 'AbortError'));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, delayMs);
    if (signal?.aborted) onAbort();
    else signal?.addEventListener('abort', onAbort, { once: true });
  });
}