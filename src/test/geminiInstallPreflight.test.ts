import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/integrations/supabase/supabaseFunctionRequest', () => ({
  getSupabaseFunctionUrl: () => 'https://backend.test/functions/v1/ai-code-assistant',
  getSupabaseFunctionHeaders: async () => ({ Authorization: 'Bearer test-session' }),
}));
import { verifyGeminiBeforeInstall } from '@/marketplace/geminiInstallPreflight';

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
describe('Gemini installation check transport', () => {
  it('only passes an explicit successful Gemini check through the authenticated endpoint', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ success: true, preflight: { ready: true } }));
    vi.stubGlobal('fetch', fetcher);
    await verifyGeminiBeforeInstall();
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher.mock.calls[0][1]).toMatchObject({ headers: { Authorization: 'Bearer test-session' }, body: JSON.stringify({ mode: 'gemini-install-preflight' }) });
  });
  it('refuses a credit failure with the specific safe diagnostic', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ success: true, preflight: { ready: false, message: 'Gemini credit unavailable' } })));
    await expect(verifyGeminiBeforeInstall()).rejects.toThrow('Gemini credit unavailable');
  });
  it('fails closed when an older backend does not understand the check', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ success: true, content: 'OK' })));
    await expect(verifyGeminiBeforeInstall()).rejects.toThrow('latest backend update');
  });
  it('does not pass an aborted check', async () => {
    const controller = new AbortController();
    controller.abort();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ success: true, preflight: { ready: true } })));
    await expect(verifyGeminiBeforeInstall(controller.signal)).rejects.toThrow('stopped');
  });
  it('bounds the check to twenty seconds', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn((_url, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(new DOMException('Stopped', 'AbortError')), { once: true });
    })));
    const result = expect(verifyGeminiBeforeInstall()).rejects.toThrow('timed out');
    await vi.advanceTimersByTimeAsync(20_000);
    await result;
  });
});