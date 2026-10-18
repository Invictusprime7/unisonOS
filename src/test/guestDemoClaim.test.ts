// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, string>();
vi.stubGlobal('window', {
  localStorage: {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  },
});

const rpcMock = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: (...args: unknown[]) => rpcMock(...args) },
}));

import { claimGuestDemoIfNeeded, peekGuestDemoUser, stashGuestDemoUser } from '@/services/guestDemoClaim';

const STORAGE_KEY = 'unison_guest_demo_user_id';

describe('guestDemoClaim', () => {
  beforeEach(() => {
    window.localStorage.clear();
    rpcMock.mockReset();
  });

  it('stashes only anonymous guest user ids', () => {
    stashGuestDemoUser('guest-1', true);
    expect(peekGuestDemoUser()).toBe('guest-1');
    stashGuestDemoUser('user-2', false);
    expect(peekGuestDemoUser()).toBe('guest-1');
  });

  it('does nothing when there is no stashed guest or it matches the current user', async () => {
    expect(await claimGuestDemoIfNeeded('user-1')).toEqual({ claimed: false, projectId: null });
    stashGuestDemoUser('user-1', true);
    expect(await claimGuestDemoIfNeeded('user-1')).toEqual({ claimed: false, projectId: null });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('claims the guest demo project and clears the stash on success', async () => {
    stashGuestDemoUser('guest-1', true);
    rpcMock.mockResolvedValue({ data: { claimed: true, project_id: 'proj-1' }, error: null });
    const result = await claimGuestDemoIfNeeded('user-9');
    expect(rpcMock).toHaveBeenCalledWith('claim_guest_demo', { p_guest_user_id: 'guest-1' });
    expect(result).toEqual({ claimed: true, projectId: 'proj-1' });
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('never blocks auth when the claim fails', async () => {
    stashGuestDemoUser('guest-1', true);
    rpcMock.mockResolvedValue({ data: null, error: { message: 'boom' } });
    expect(await claimGuestDemoIfNeeded('user-9')).toEqual({ claimed: false, projectId: null });
    rpcMock.mockRejectedValue(new Error('network'));
    expect(await claimGuestDemoIfNeeded('user-9')).toEqual({ claimed: false, projectId: null });
  });

  it('clears the stash when the session was already claimed or expired', async () => {
    stashGuestDemoUser('guest-1', true);
    rpcMock.mockResolvedValue({ data: { claimed: false, reason: 'already_claimed' }, error: null });
    await claimGuestDemoIfNeeded('user-9');
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
