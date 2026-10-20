import { describe, expect, it, vi } from 'vitest';
import {
  createAuthRecoveryFetch,
  isRejectedRefreshTokenRequest,
  isRejectedAuthUserRequest,
} from '@/integrations/supabase/authSessionRecovery';

describe('Supabase rejected-session recovery', () => {
  it('recognizes rejected auth user validation requests only', () => {
    expect(isRejectedAuthUserRequest(
      'https://project.supabase.co/auth/v1/user',
      new Response(null, { status: 403 }),
    )).toBe(true);
    expect(isRejectedAuthUserRequest(
      'https://project.supabase.co/rest/v1/projects',
      new Response(null, { status: 403 }),
    )).toBe(false);
  });

  it('recognizes rejected refresh-token requests only', () => {
    expect(isRejectedRefreshTokenRequest(
      'https://project.supabase.co/auth/v1/token?grant_type=refresh_token',
      new Response(null, { status: 400 }),
    )).toBe(true);
    expect(isRejectedRefreshTokenRequest(
      'https://project.supabase.co/auth/v1/token?grant_type=password',
      new Response(null, { status: 400 }),
    )).toBe(false);
    expect(isRejectedRefreshTokenRequest(
      'https://project.supabase.co/auth/v1/token?grant_type=refresh_token',
      new Response(null, { status: 500 }),
    )).toBe(false);
    expect(isRejectedRefreshTokenRequest(
      'https://project.supabase.co/auth/v1/token?grant_type=refresh_token',
      new Response(null, { status: 401 }),
    )).toBe(true);
  });

  it('preserves refresh credentials when concurrent access-token probes fail', async () => {
    const clearLocalSession = vi.fn(async () => undefined);
    const fetchWithRecovery = createAuthRecoveryFetch(
      clearLocalSession,
      vi.fn(async () => new Response(null, { status: 403 })) as unknown as typeof fetch,
    );

    await Promise.all([
      fetchWithRecovery('https://project.supabase.co/auth/v1/user'),
      fetchWithRecovery('https://project.supabase.co/auth/v1/user'),
    ]);

    expect(clearLocalSession).not.toHaveBeenCalled();
  });

  it.each([400, 401, 403, 429, 503])('leaves refresh status %s to the SDK without a competing sign-out', async (status) => {
    const clearLocalSession = vi.fn(async () => undefined);
    const fetchWithRecovery = createAuthRecoveryFetch(
      clearLocalSession,
      vi.fn(async () => new Response(null, { status })) as unknown as typeof fetch,
    );

    const response = await fetchWithRecovery('https://project.supabase.co/auth/v1/token?grant_type=refresh_token');

    expect(response.status).toBe(status);
    expect(clearLocalSession).not.toHaveBeenCalled();
  });
});
