import { describe, it, expect, vi } from 'vitest';
import { runExclusive } from '@/services/builder/builderMutationCoordinator';

describe('save queue', () => {
  it('a stuck save does not block later saves', async () => {
    vi.useFakeTimers();
    void runExclusive('toolbar', () => new Promise(() => {})); // never settles
    let ran = false;
    const next = runExclusive('toolbar', async () => { ran = true; });
    await vi.advanceTimersByTimeAsync(91_000);
    await next;
    expect(ran).toBe(true);
    vi.useRealTimers();
  });
});
