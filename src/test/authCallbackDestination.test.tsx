import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ navigate: vi.fn(), getSession: vi.fn(), setSession: vi.fn(), from: vi.fn(), audit: vi.fn() }));
vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.navigate }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: { getSession: mocks.getSession, setSession: mocks.setSession }, from: mocks.from } }));
vi.mock('@/services/auditLogger', () => ({ auditLogger: { log: mocks.audit } }));
import AuthCallback from '@/pages/AuthCallback';

const session = { user: { id: 'account', is_anonymous: false } };
beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState({}, '', '/auth/callback');
  mocks.getSession.mockResolvedValue({ data: { session } });
  mocks.setSession.mockResolvedValue({ data: { session } });
  mocks.audit.mockReturnValue(new Promise(() => {}));
  mocks.from.mockReturnValue({ select: () => ({ eq: () => ({ abortSignal: () => ({ maybeSingle: async () => ({ data: { completed: true } }) }) }) }) });
});
afterEach(cleanup);

describe('direct callback destinations', () => {
  it('opens Home for returning accounts without waiting for audit logging', async () => {
    render(<AuthCallback />);
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/home', { replace: true }));
    expect(mocks.navigate).toHaveBeenCalledTimes(1);
  });
  it('opens Demo for a first-time account', async () => {
    mocks.from.mockReturnValue({ select: () => ({ eq: () => ({ abortSignal: () => ({ maybeSingle: async () => ({ data: { completed: false } }) }) }) }) });
    render(<AuthCallback />);
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/demo', { replace: true }));
  });
  it('opens Demo immediately for a confirmed signup', async () => {
    window.history.replaceState({}, '', '/auth/callback#access_token=test-token&refresh_token=test-refresh&type=signup');
    render(<AuthCallback />);
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/demo', { replace: true }));
    expect(mocks.from).not.toHaveBeenCalled();
  });
});