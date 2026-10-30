import { createPlannedChatCompletion } from './ai/providerClient.ts';
import { configuredComposerGeminiModel } from './geminiModel.ts';

export const GEMINI_PREFLIGHT_TIMEOUT_MS = 15_000;
export interface GeminiPreflightResult {
  ready: boolean;
  code: 'ready' | 'not_configured' | 'credits_exhausted' | 'rate_limited' | 'unauthorized' | 'model_unavailable' | 'timeout' | 'unreachable';
  message: string;
}

/** One tiny, uncached direct request: proves usable quota now, not a balance or full-install guarantee. */
export async function checkGeminiForInstall(
  signal?: AbortSignal,
  invoke = createPlannedChatCompletion,
  readEnv: (name: string) => string | undefined = name => Deno.env.get(name),
): Promise<GeminiPreflightResult> {
  if (!['GEMINI_API_KEY', 'GOOGLE_API_KEY', 'UNISONGEMINI_API_KEY'].some(name => readEnv(name)?.trim())) {
    return { ready: false, code: 'not_configured', message: 'Your Gemini key is not configured. Installation has not started.' };
  }
  const controller = new AbortController();
  const abort = () => controller.abort(signal?.reason);
  if (signal?.aborted) abort();
  else signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => controller.abort(), GEMINI_PREFLIGHT_TIMEOUT_MS);
  try {
    const response = await invoke({
      model: `google/${configuredComposerGeminiModel(readEnv)}`,
      messages: [{ role: 'user', content: 'Reply OK.' }],
      max_tokens: 16, reasoning_effort: 'low', stream: false,
    }, controller.signal, false);
    const payload = await response.json().catch(() => null);
    if (response.ok && Array.isArray(payload?.choices) && payload.choices.length > 0) {
      return { ready: true, code: 'ready', message: 'Gemini is reachable and accepted a small test request. This does not guarantee enough credit for the entire installation.' };
    }
    // Inspect provider detail only for classification; never expose raw responses or credentials.
    const detail = JSON.stringify(payload ?? '');
    if (response.status === 402 || /insufficient[_\s-]?quota|insufficient (?:credits?|funds?)|credits?.{0,30}(?:depleted|exhausted)|prepayment|billing.{0,40}(?:required|disabled|inactive|exhausted|insufficient)|payment required|exceeded your current quota/i.test(detail)) {
      return { ready: false, code: 'credits_exhausted', message: 'Gemini reports unavailable credit or exhausted billing quota. Add credit in Google AI Studio, then try again. Installation has not started.' };
    }
    if (response.status === 429) return { ready: false, code: 'rate_limited', message: 'Gemini is temporarily rate limited. Wait a moment and try again. Installation has not started.' };
    if (response.status === 401 || response.status === 403) return { ready: false, code: 'unauthorized', message: 'Gemini refused your API key or its permissions. Check the configured key. Installation has not started.' };
    if (response.status === 404) return { ready: false, code: 'model_unavailable', message: 'The configured Gemini model is unavailable for your key. Installation has not started.' };
    return { ready: false, code: 'unreachable', message: 'Gemini could not complete the connection check. Try again shortly. Installation has not started.' };
  } catch {
    return controller.signal.aborted
      ? { ready: false, code: 'timeout', message: 'The Gemini connection check timed out or was stopped. Installation has not started.' }
      : { ready: false, code: 'unreachable', message: 'Gemini could not be reached. Try again shortly. Installation has not started.' };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}