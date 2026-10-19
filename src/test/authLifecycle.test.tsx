import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  listeners: [] as Array<(event: string, session: unknown) => unknown>,
  navigate: vi.fn(), toast: vi.fn(), from: vi.fn(),
  claimGuest: vi.fn(),
  getSession: vi.fn(), refreshSession: vi.fn(), signInWithPassword: vi.fn(), audit: vi.fn(), securityAudit: vi.fn(),
}));
vi.mock('@/services/guestDemoClaim', () => ({ claimGuestDemoIfNeeded: mocks.claimGuest }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  auth: {
    getSession: mocks.getSession,
    refreshSession: mocks.refreshSession,
    signInWithPassword: mocks.signInWithPassword,
    onAuthStateChange: (listener: (event: string, session: unknown) => unknown) => {
      mocks.listeners.push(listener);
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    },
  },
  from: mocks.from,
} }));
vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.navigate }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/services/auditLogger', () => ({ auditLogger: { log: mocks.audit, logSecurityEvent: mocks.securityAudit } }));

import Auth from '@/pages/Auth';
import { useAuth } from '@/hooks/useAuth';

const session = { user: { id: 'signed-in-user' } };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.listeners.length = 0;
  sessionStorage.clear();
  window.history.replaceState({}, '', '/auth');
  mocks.claimGuest.mockResolvedValue({ claimed: false, projectId: null });
  mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
  mocks.from.mockReturnValue({ select: () => ({ eq: () => ({ abortSignal: () => ({ maybeSingle: async () => ({ data: { completed: true } }) }) }) }) });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('auth listener lock release', () => {
  it('keeps sign-in when an older initial read finishes empty, but honors sign-out', async () => {
    let finish: ((value: unknown) => void) | undefined;
    mocks.getSession.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const { result } = renderHook(() => useAuth());
    act(() => { mocks.listeners[0]?.('SIGNED_IN', session); });
    await act(async () => { finish?.({ data: { session: null }, error: null }); });
    expect(result.current.user?.id).toBe('signed-in-user');
    act(() => { mocks.listeners[0]?.('SIGNED_OUT', null); });
    expect(result.current.user).toBeNull();
  });

  it('keeps the session on a retryable renewal failure', async () => {
    mocks.getSession.mockResolvedValue({ data: { session }, error: null });
    mocks.refreshSession.mockResolvedValue({ data: { session: null }, error: new Error('temporarily offline') });
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.user?.id).toBe('signed-in-user'));
    await act(async () => { await result.current.refreshSession(); });
    expect(result.current.user?.id).toBe('signed-in-user');
  });
  it('releases sign-in before querying onboarding and navigates only once', async () => {
    let lockHeld = false;
    mocks.from.mockImplementation(() => {
      expect(lockHeld).toBe(false);
      return { select: () => ({ eq: () => ({ abortSignal: () => ({ maybeSingle: async () => ({ data: { completed: true } }) }) }) }) };
    });
    mocks.signInWithPassword.mockImplementation(async () => {
      lockHeld = true;
      for (const listener of mocks.listeners) {
        expect(listener('SIGNED_IN', session)).toBeUndefined();
      }
      lockHeld = false;
      return { data: { session }, error: null };
    });
    render(<Auth />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'test-only-password' } });
    fireEvent.submit(screen.getByLabelText('Password').closest('form') as HTMLFormElement);
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/home', { replace: true }));
    act(() => { mocks.listeners[0]?.('TOKEN_REFRESHED', session); });
    expect(mocks.navigate).toHaveBeenCalledTimes(1);
    expect(mocks.from).toHaveBeenCalledTimes(1);
  });

  it('releases the listener before audit work and updates authenticated state immediately', async () => {
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => {
      expect(mocks.listeners[0]?.('SIGNED_IN', session)).toBeUndefined();
      expect(mocks.audit).not.toHaveBeenCalled();
    });
    expect(result.current.user?.id).toBe('signed-in-user');
    await waitFor(() => expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ action: 'login' })));
  });

  it('clears the signing-in state when the SDK throws', async () => {
    mocks.signInWithPassword.mockRejectedValue(new Error('Session could not be stored'));
    render(<Auth />);
    fireEvent.submit(screen.getByLabelText('Password').closest('form') as HTMLFormElement);
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Sign in failed' })));
    expect(screen.getByRole('button', { name: /^Sign in$/ })).not.toBeDisabled();
  });
});

describe('post-auth Home entry', () => {
  it.each(['/pricing', '/oauth/consent', '/demo', '/cloud', '/dashboard'])('ignores the %s return path for returning accounts', async (next) => {
    window.history.replaceState({}, '', `/auth?next=${encodeURIComponent(next)}`);
    sessionStorage.setItem('checkout_plan', 'pending-plan');
    mocks.getSession.mockResolvedValue({ data: { session } });
    render(<Auth />);
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/home', { replace: true }));
    expect(mocks.navigate).toHaveBeenCalledTimes(1);
  });
  it('opens Home even when legacy guest recovery never finishes', async () => {
    mocks.claimGuest.mockReturnValue(new Promise(() => {}));
    mocks.getSession.mockResolvedValue({ data: { session } });
    render(<Auth />);
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/home', { replace: true }));
    expect(mocks.claimGuest).toHaveBeenCalledWith('signed-in-user');
  });

  it('opens Home on a stalled onboarding read and ignores late results', async () => {
    vi.useFakeTimers();
    let complete: ((value: { data: { completed: boolean } }) => void) | undefined;
    mocks.from.mockReturnValue({ select: () => ({ eq: () => ({ abortSignal: () => ({ maybeSingle: () => new Promise(resolve => { complete = resolve; }) }) }) }) });
    mocks.getSession.mockResolvedValue({ data: { session } });
    render(<Auth />);
    await act(async () => { await vi.advanceTimersByTimeAsync(4001); });
    expect(mocks.navigate).toHaveBeenCalledWith('/home', { replace: true });
    await act(async () => { complete?.({ data: { completed: false } }); });
    expect(mocks.navigate).toHaveBeenCalledTimes(1);
  });

  it('opens Home instead of the previously crashing project', async () => {
    window.history.replaceState({}, '', '/auth?next=%2Fweb-builder%3Fid%3D59383cfa-e8f4-4370-bd53-708d110abb13');
    mocks.getSession.mockResolvedValue({ data: { session } });
    render(<Auth />);
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/home', { replace: true }));
  });

  it('sends first-time accounts to the Live Demo', async () => {
    mocks.from.mockReturnValue({ select: () => ({ eq: () => ({ abortSignal: () => ({ maybeSingle: async () => ({ data: { completed: false } }) }) }) }) });
    mocks.getSession.mockResolvedValue({ data: { session } });
    render(<Auth />);
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/demo', { replace: true }));
  });

  it('does not send anonymous sessions into protected pages', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: { user: { id: 'guest', is_anonymous: true } } } });
    render(<Auth />);
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
    expect(mocks.navigate).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('opens Home on onboarding errors rather than treating existing accounts as new', async () => {
    mocks.from.mockReturnValue({ select: () => ({ eq: () => ({ abortSignal: () => ({ maybeSingle: async () => ({ data: null, error: new Error('offline') }) }) }) }) });
    mocks.getSession.mockResolvedValue({ data: { session } });
    render(<Auth />);
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/home', { replace: true }));
  });
});
