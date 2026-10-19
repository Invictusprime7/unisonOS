import { describe, expect, it, vi } from 'vitest';
import { createCoalescedRefresh } from '@/services/coalescedRefresh';

describe('serial project refreshes', () => {
  it('coalesces a burst into one trailing read without parallel requests', async () => {
    let release: (() => void) | undefined;
    const load = vi.fn().mockImplementationOnce(() => new Promise<void>(resolve => { release = resolve; })).mockResolvedValue(undefined);
    const queue = createCoalescedRefresh(load);
    const first = queue.refresh();
    for (let i = 0; i < 20; i++) expect(queue.refresh()).toBe(first);
    expect(load).toHaveBeenCalledTimes(1);
    release?.();
    await first;
    expect(load).toHaveBeenCalledTimes(2);
    await queue.refresh();
    expect(load).toHaveBeenCalledTimes(3);
  });
  it('does not replay events after unmount', async () => {
    let release: (() => void) | undefined;
    const load = vi.fn(() => new Promise<void>(resolve => { release = resolve; }));
    const queue = createCoalescedRefresh(load);
    const pending = queue.refresh();
    void queue.refresh();
    queue.dispose();
    release?.();
    await pending;
    await queue.refresh();
    expect(load).toHaveBeenCalledTimes(1);
  });
  it('allows retry after a failed read', async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
    const queue = createCoalescedRefresh(load);
    await expect(queue.refresh()).rejects.toThrow('offline');
    await queue.refresh();
    expect(load).toHaveBeenCalledTimes(2);
  });
});