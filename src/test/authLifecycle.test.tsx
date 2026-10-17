import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  listeners: [] as Array<(event: string, session: unknown) => unknown>,
  navigate: vi.fn(), toast: vi.fn(), from: vi.fn(),
  getSession: vi.fn(), signInWithPassword: vi.fn(), audit: vi.fn(), securityAudit: vi.fn(),
}));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  auth: {
    getSession: mocks.getSession,
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
  mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
  mocks.from.mockReturnValue({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { completed: true } }) }) }) });
});
afterEach(cleanup);

describe('auth listener lock release', () => {
  it('releases sign-in before querying onboarding and navigates only once', async () => {
    let lockHeld = false;
    mocks.from.mockImplementation(() => {
      expect(lockHeld).toBe(false);
      return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { completed: true } }) }) }) };
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
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/dashboard', { replace: true }));
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
    expect(screen.getByRole('button', { name: 'Sign in', exact: true })).not.toBeDisabled();
  });
});