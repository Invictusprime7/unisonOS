import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getSession } = vi.hoisted(() => ({
  getSession: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { auth: { getSession } },
}));

import { getSupabaseFunctionHeaders, getSupabaseFunctionUrl } from '@/integrations/supabase/supabaseFunctionRequest';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '@/integrations/supabase/env';

describe('Supabase Edge Function request routing', () => {
  beforeEach(() => getSession.mockReset());

  it('builds function URLs from the shared Supabase base URL', () => {
    expect(getSupabaseFunctionUrl('/ai-code-assistant')).toBe(`${SUPABASE_URL}/functions/v1/ai-code-assistant`);
  });

  it('sends the publishable key as apikey and the user session as Authorization', async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: 'user-jwt' } }, error: null });
    await expect(getSupabaseFunctionHeaders()).resolves.toEqual({
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: 'Bearer user-jwt',
    });
  });

  it('never sends the publishable key as a bearer token when signed out', async () => {
    getSession.mockResolvedValue({ data: { session: null }, error: null });
    await expect(getSupabaseFunctionHeaders()).resolves.toEqual({ apikey: SUPABASE_PUBLISHABLE_KEY });
  });
});