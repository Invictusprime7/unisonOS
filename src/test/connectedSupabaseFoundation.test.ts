import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  createAuthorizationUrl,
  decryptSecret,
  encryptSecret,
  readOAuthCallbackState,
} from '../../server/api-lib/connectedSupabase';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260806164754_add_connected_backend_foundation.sql'),
  'utf8',
);
const hardeningMigration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260806165213_harden_onboarding_session_browser_writes.sql'),
  'utf8',
);
const vercelConfig = readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf8');

const sessionId = '11111111-1111-4111-8111-111111111111';
const userId = '22222222-2222-4222-8222-222222222222';

beforeEach(() => {
  process.env.VITE_SUPABASE_URL = 'https://nfrdomdvyrbwuokathtw.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test-only';
  process.env.SUPABASE_OAUTH_CLIENT_ID = 'client-id';
  process.env.SUPABASE_OAUTH_CLIENT_SECRET = 'client-secret';
  process.env.SUPABASE_OAUTH_REDIRECT_URI = 'https://unison-tasks-official.vercel.app/api/integrations/supabase/callback';
  process.env.OAUTH_STATE_SECRET = 'state-secret-for-tests';
  process.env.CONNECTED_PROJECT_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
});

describe('connected Supabase foundation', () => {
  it('creates RLS-protected sessions and service-role-only token tables', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.onboarding_sessions');
    expect(migration).toContain('CREATE POLICY "onboarding_sessions_update_own_draft"');
    expect(migration).toContain("status IN ('draft', 'awaiting_backend_connection', 'failed')");
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.supabase_connections');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.connected_supabase_projects');
    expect(migration).toContain('REVOKE ALL ON TABLE public.supabase_connections FROM anon, authenticated');
    expect(migration).toContain('REVOKE ALL ON TABLE public.connected_supabase_projects FROM anon, authenticated');
    expect(migration).toContain("WHEN 'backend.connect' THEN public.is_business_admin(p_business_id)");
    expect(hardeningMigration).toContain('reject_untrusted_onboarding_session_transitions');
    expect(hardeningMigration).toContain("NEW.status IS DISTINCT FROM OLD.status");
    expect(hardeningMigration).toContain("NEW.provisioning_progress IS DISTINCT FROM OLD.provisioning_progress");
  });

  it('keeps the PKCE verifier out of OAuth state and validates its signed cookie binding', () => {
    const authorization = createAuthorizationUrl(sessionId, userId);
    const url = new URL(authorization.url);
    const state = url.searchParams.get('state');

    expect(url.origin).toBe('https://api.supabase.com');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(authorization.cookie).toContain('HttpOnly');
    expect(authorization.cookie).toContain('Secure');
    expect(state).not.toContain('codeVerifier');

    const cookie = authorization.cookie.split(';')[0];
    const callback = readOAuthCallbackState({ headers: { cookie } } as never, state);
    expect(callback.sessionId).toBe(sessionId);
    expect(callback.userId).toBe(userId);
    expect(callback.codeVerifier).toHaveLength(64);
    expect(() => readOAuthCallbackState({ headers: { cookie } } as never, `${state}tampered`)).toThrow('OAuth session expired');
  });

  it('encrypts stored OAuth credentials with authenticated encryption', () => {
    const ciphertext = encryptSecret('refresh-token-value');
    expect(ciphertext).toMatch(/^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(ciphertext).not.toContain('refresh-token-value');
    expect(decryptSecret(ciphertext)).toBe('refresh-token-value');
    expect(() => decryptSecret(`${ciphertext}tampered`)).toThrow('could not be decrypted');
  });

  it('routes connected backend URLs through one Serverless function', () => {
    expect(existsSync(resolve(process.cwd(), 'api/connected-backend.ts'))).toBe(true);
    expect(existsSync(resolve(process.cwd(), 'api/integrations/supabase/authorize.ts'))).toBe(false);
    expect(vercelConfig).toContain('/api/integrations/supabase/authorize');
    expect(vercelConfig).toContain('/api/connected-backend?route=authorize');
  });
});