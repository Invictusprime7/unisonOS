import { describe, expect, it } from 'vitest';
import {
  AUTHORITATIVE_SUPABASE_PROJECT_REF as REF,
  AUTHORITATIVE_SUPABASE_URL as UNISON,
  resolveAuthoritativeSupabaseConfig,
  resolveSupabaseClientUrl,
  verifySupabaseIdentity,
} from '@/integrations/supabase/env';

describe('UNISON backend identity', () => {
  it('ignores Lovable-injected values for another project, including their key', () => {
    const r = resolveAuthoritativeSupabaseConfig({ url: 'https://oruwtgdjurstvhgqcvbv.supabase.co', publishableKey: 'other-key' });
    expect(r.url).toBe(UNISON);
    expect(r.publishableKey).not.toBe('other-key');
    expect(r.ignoredInjectedRef).toBe('oruwtgdjurstvhgqcvbv');
  });
  it('accepts injected UNISON values (production) and falls back when empty', () => {
    expect(resolveAuthoritativeSupabaseConfig({ url: ` "${UNISON}/"\n`, publishableKey: 'k' })).toMatchObject({ url: UNISON, publishableKey: 'k', ignoredInjectedRef: null });
    expect(resolveAuthoritativeSupabaseConfig({}).url).toBe(UNISON);
    expect(resolveAuthoritativeSupabaseConfig({ url: 'not a url' }).url).toBe(UNISON);
  });
  it('passes direct URL and same-origin dev proxy to UNISON', () => {
    expect(verifySupabaseIdentity(UNISON, UNISON)).toEqual({ ok: true });
    const proxied = resolveSupabaseClientUrl(UNISON, true, 'http://localhost:8080');
    expect(verifySupabaseIdentity(proxied, UNISON, 'http://localhost:8080')).toEqual({ ok: true });
  });
  it('fails closed for the wrong ref, foreign proxies and mismatched URLs', () => {
    const wrong = 'https://oruwtgdjurstvhgqcvbv.supabase.co';
    expect(verifySupabaseIdentity(wrong, wrong).ok).toBe(false);
    expect(verifySupabaseIdentity('http://evil.test/__supabase', UNISON, 'http://localhost:8080').ok).toBe(false);
    expect(verifySupabaseIdentity(wrong, UNISON).ok).toBe(false);
    expect(REF).toBe('nfrdomdvyrbwuokathtw');
  });
});
