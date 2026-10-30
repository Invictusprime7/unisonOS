import { getSupabaseFunctionHeaders, getSupabaseFunctionUrl } from '@/integrations/supabase/supabaseFunctionRequest';

/** Must finish before claiming a release, provisioning a project or authoring pages. */
export async function verifyGeminiBeforeInstall(signal?: AbortSignal): Promise<void> {
  const controller = new AbortController();
  const abort = () => controller.abort(signal?.reason);
  if (signal?.aborted) abort();
  else signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(getSupabaseFunctionUrl('ai-code-assistant'), {
      method: 'POST',
      headers: { ...await getSupabaseFunctionHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'gemini-install-preflight' }),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null);
    if (controller.signal.aborted) throw new Error('The Gemini check was stopped. Installation has not started.');
    if (response.ok && payload?.success === true && payload?.preflight?.ready === true) return;
    if (response.status === 401) throw new Error('Sign in before checking Gemini and installing a template.');
    throw new Error(payload?.preflight?.message ?? 'The Gemini check could not be completed. Installation has not started. The latest backend update may need to be deployed.');
  } catch (error) {
    if (controller.signal.aborted) throw new Error('The Gemini check timed out or was stopped. Installation has not started.');
    if (error instanceof TypeError) throw new Error('The Gemini check could not reach the backend. Installation has not started.');
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}