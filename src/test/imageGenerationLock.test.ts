import { describe, it, expect, vi, beforeEach } from 'vitest';

// The client entry must own the "one picture at a time" rule, because a picture
// takes 15-25 seconds and every extra click during that window is a wasted
// request that comes back refused.
const invoke = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => invoke(...args) } },
}));

const { generateSiteImage, isImageBusy, subscribeImageBusy, SiteImageBusyError } = await import(
  '@/services/media/generateSiteImage'
);

const target = { kind: 'img' as const, selector: 'img.hero' };

describe('image generation lock', () => {
  beforeEach(() => {
    invoke.mockReset();
    expect(isImageBusy()).toBe(false);
  });

  it('refuses a second request while one is still being made', async () => {
    let release: (v: { data: { imageUrl: string; prompt: string } }) => void = () => {};
    invoke.mockImplementation(() => new Promise((resolve) => { release = resolve; }));

    const first = generateSiteImage('a warm studio interior', target);
    expect(isImageBusy()).toBe(true);

    await expect(generateSiteImage('a second picture', target)).rejects.toBeInstanceOf(SiteImageBusyError);
    expect(invoke).toHaveBeenCalledTimes(1);

    release({ data: { imageUrl: 'https://x/1.png', prompt: 'a warm studio interior' } });
    await expect(first).resolves.toMatchObject({ url: 'https://x/1.png' });
    expect(isImageBusy()).toBe(false);
  });

  it('releases the lock when the request fails, so the next try can run', async () => {
    invoke.mockResolvedValue({ data: null, error: new Error('boom') });
    await expect(generateSiteImage('a picture', target)).rejects.toThrow('boom');
    expect(isImageBusy()).toBe(false);

    invoke.mockResolvedValue({ data: { imageUrl: 'https://x/2.png', prompt: 'p' } });
    await expect(generateSiteImage('try again', target)).resolves.toMatchObject({ url: 'https://x/2.png' });
  });

  it('carries the wait the service asked for, so the message can state it', async () => {
    vi.useFakeTimers();
    try {
      invoke.mockResolvedValue({
        data: null,
        error: {
          message: 'Edge Function returned a non-2xx status code',
          context: {
            status: 429,
            clone: () => ({
              json: async () => ({ success: false, error: 'The picture maker is busy — try again in 12 seconds.', retryAfterSeconds: 12 }),
            }),
          },
        },
      });
      await expect(generateSiteImage('a picture', target)).rejects.toMatchObject({
        name: 'SiteImageRequestError',
        status: 429,
        retryAfterSeconds: 12,
      });
      expect(isImageBusy()).toBe(true);
      await vi.advanceTimersByTimeAsync(12_000);
      expect(isImageBusy()).toBe(false);
    } finally {
      await vi.runOnlyPendingTimersAsync();
      vi.useRealTimers();
    }
  });

  it('tells subscribers when a picture starts and finishes', async () => {
    const seen: boolean[] = [];
    const stop = subscribeImageBusy(() => seen.push(isImageBusy()));
    let release: (v: { data: { imageUrl: string } }) => void = () => {};
    invoke.mockImplementation(() => new Promise((resolve) => { release = resolve; }));

    const running = generateSiteImage('a picture', target);
    release({ data: { imageUrl: 'https://x/3.png' } });
    await running;
    stop();

    expect(seen).toEqual([true, false]);
    expect(isImageBusy()).toBe(false);
  });
});
