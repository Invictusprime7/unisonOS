import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({ getSession: vi.fn(), getUser: vi.fn(), refreshSession: vi.fn(), signOut: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth } }));
vi.mock('@/integrations/supabase/env', () => ({ isSupabaseEnvConfigured: true, SUPABASE_URL: 'https://test.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'public-test-key' }));
const session = (token: string) => ({ access_token: token, expires_at: Math.floor(Date.now()/1000) + 3600 });
const input = { messages: [{ role: 'user', content: 'Improve this page' }] };
let live: ReturnType<typeof session> | null;
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.resetModules(); vi.resetAllMocks();
  live = session('initial');
  auth.getSession.mockImplementation(async () => ({ data: { session: live }, error: null }));
  auth.getUser.mockResolvedValue({ data: { user: { id: 'user' } }, error: null });
  auth.refreshSession.mockImplementation(async () => { live = session('fresh'); return { data: { session: live }, error: null }; });
  auth.signOut.mockImplementation(async () => { live = null; });
  fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ content: 'ok' })));
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());
describe('Builder session recovery', () => {
  it('rejects cross-project connector targets before auth or network calls', async () => {
    const { runBuilderTurn } = await import('@/services/builderBrainClient');
    const result = await runBuilderTurn({ ...input, connectorContext: {
      projectId: 'site-a', selection: { projectId: 'site-b' },
    } });
    expect(result.error?.message).toContain('another project');
    expect(auth.getSession).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('sends the connector contract without duplicating raw files on transport', async () => {
    const { runBuilderTurn } = await import('@/services/builderBrainClient');
    const result = await runBuilderTurn({ ...input, connectorContext: {
      files: { '/src/pages/Home.tsx': 'private-source-marker' },
      sourceTargets: ['/src/pages/Home.tsx'], projectId: 'site-a',
    } });
    expect(result.error).toBeNull();
    const payload = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(payload.messages[0].content).toContain('[UNISON BUILDER CONNECTOR v1]');
    expect(payload.messages[1]).toEqual(input.messages[0]);
    expect(payload.connectorContext).toBeUndefined();
    expect(fetchMock.mock.calls[0][1].body).not.toContain('private-source-marker');
  });
  it('refreshes a rejected edge token and replays with the new credential', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ error: 'Invalid or expired token' }), { status: 401 }));
    const { runBuilderTurn } = await import('@/services/builderBrainClient');
    expect((await runBuilderTurn(input)).error).toBeNull();
    expect(auth.refreshSession).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls.map((call) => call[1].headers.Authorization)).toEqual(['Bearer initial', 'Bearer fresh']);
  });
  it('does not resend a rejected token after refresh failure', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ error: 'Invalid or expired token' }), { status: 401 }));
    auth.refreshSession.mockResolvedValue({ data: { session: null }, error: { status: 503 } });
    const { runBuilderTurn, isBuilderSessionError } = await import('@/services/builderBrainClient');
    expect(isBuilderSessionError((await runBuilderTurn(input)).error)).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('recovers an access token rejected by Auth before calling the model', async () => {
    auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: { status: 401 } });
    const { runBuilderTurn } = await import('@/services/builderBrainClient');
    expect((await runBuilderTurn(input)).error).toBeNull();
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer fresh');
  });
  it('does not resurrect a cached refresh after sign-out', async () => {
    live = { ...session('initial'), expires_at: Math.floor(Date.now()/1000) + 90 };
    const { primeBuilderSession, runBuilderTurn, isBuilderSessionError } = await import('@/services/builderBrainClient');
    expect(await primeBuilderSession()).toBe(true);
    live = null;
    expect(isBuilderSessionError((await runBuilderTurn(input)).error)).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('retains a valid live token after a transient proactive refresh failure', async () => {
    live = { ...session('initial'), expires_at: Math.floor(Date.now()/1000) + 90 };
    auth.refreshSession.mockResolvedValue({ data: { session: null }, error: { status: 503 } });
    const { runBuilderTurn } = await import('@/services/builderBrainClient');
    expect((await runBuilderTurn(input)).error).toBeNull();
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer initial');
  });
});
