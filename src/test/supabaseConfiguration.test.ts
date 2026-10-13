import { beforeEach, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolveSupabaseAuthStorageKey, resolveSupabaseClientUrl } from '@/integrations/supabase/env';
const createClient = vi.hoisted(() => vi.fn(() => ({})));
vi.mock('@supabase/supabase-js', () => ({ createClient }));
beforeEach(() => { vi.resetModules(); createClient.mockClear(); });
it('uses the linked project for Auth and direct function calls without injected configuration', async () => {
  vi.stubEnv('VITE_SUPABASE_URL', ''); vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', ''); vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
  vi.stubEnv('VITE_SUPABASE_DEV_PROXY', 'false');
  try {
    const env = await import('@/integrations/supabase/env');
    await import('@/integrations/supabase/client');
    const project = readFileSync('supabase/config.toml', 'utf8').match(/project_id = "([^"]+)"/)![1];
    expect(env.SUPABASE_URL).toBe('https://' + project + '.supabase.co');
    // Supabase publishable keys may be opaque (`sb_publishable_*`) rather than
    // legacy JWTs, so the project identity is established by the endpoint.
    expect(env.SUPABASE_PUBLISHABLE_KEY).toBeTruthy();
    expect(createClient).toHaveBeenCalledWith(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, expect.any(Object));
  } finally { vi.unstubAllEnvs(); }
});
it('shares sanitized injected configuration across both transports', async () => {
  vi.stubEnv('VITE_SUPABASE_URL', ' "https://override.supabase.co"\r\n');
  vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', ' "public-test-key"\r\n');
  vi.stubEnv('VITE_SUPABASE_DEV_PROXY', 'false');
  try {
    const env = await import('@/integrations/supabase/env');
    await import('@/integrations/supabase/client');
    expect(env.SUPABASE_URL).toBe('https://override.supabase.co');
    expect(createClient).toHaveBeenCalledWith(env.SUPABASE_URL, 'public-test-key', expect.any(Object));
  } finally { vi.unstubAllEnvs(); }
});

it('proxies browser development through the same origin without changing the auth storage key', () => {
  expect(resolveSupabaseClientUrl('https://project-ref.supabase.co', true, 'http://localhost:8081'))
    .toBe('http://localhost:8081/__supabase');
  expect(resolveSupabaseClientUrl('https://project-ref.supabase.co', false, 'http://localhost:8081'))
    .toBe('https://project-ref.supabase.co');
  expect(resolveSupabaseAuthStorageKey('https://project-ref.supabase.co')).toBe('sb-project-ref-auth-token');
});
