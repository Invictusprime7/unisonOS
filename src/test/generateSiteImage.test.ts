import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const imageApi = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { functions: { invoke: imageApi.invoke } },
}));

import {
  generateSiteImage,
  isImageBusy,
  SiteImageBusyError,
  SiteImageRequestError,
} from '@/services/media/generateSiteImage';

describe('site image provider cooldown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-22T12:00:00.000Z'));
    imageApi.invoke.mockReset();
  });

  afterEach(() => vi.useRealTimers());

  it('honors provider Retry-After and prevents repeated requests during cooldown', async () => {
    const context = new Response(JSON.stringify({ error: 'The picture maker is busy', retryAfterSeconds: 2 }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    });
    imageApi.invoke.mockResolvedValueOnce({
      data: null,
      error: Object.assign(new Error('Function returned non-2xx status code'), { context }),
    });

    await expect(generateSiteImage('A calm studio portrait', { kind: 'img' }))
      .rejects.toMatchObject<Partial<SiteImageRequestError>>({ status: 429, retryAfterSeconds: 2 });
    expect(isImageBusy()).toBe(true);
    await expect(generateSiteImage('Another picture', { kind: 'img' }))
      .rejects.toBeInstanceOf(SiteImageBusyError);
    expect(imageApi.invoke).toHaveBeenCalledOnce();

    await vi.advanceTimersByTimeAsync(2_000);
    expect(isImageBusy()).toBe(false);
  });
});