import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { AppRouteConfig } from '@/routes/routeConfig';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(), redirect: vi.fn(),
  listeners: [] as Array<(event: string, session: unknown) => void>,
}));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {
  getSession: mocks.getSession,
  onAuthStateChange: (listener: (event: string, session: unknown) => void) => {
    mocks.listeners.push(listener);
    return { data: { subscription: { unsubscribe: vi.fn() } } };
  },
} } }));
vi.mock('@/services/guestDemoClaim', () => ({ stashGuestDemoUser: vi.fn() }));
vi.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: '/home', search: '', hash: '' }),
  Navigate: ({ to }: { to: string }) => { mocks.redirect(to); return null; },
}));
vi.mock('@/components/RouteErrorBoundary', () => ({
  RouteErrorBoundary: ({ children }: { children: ReactNode }) => children,
  AsyncRouteLoadingFallback: () => <div role="status">Checking account</div>,
}));
vi.mock('@/components/shell', () => ({ RouteShellFrame: ({ children }: { children: ReactNode }) => children }));
vi.mock('@/routes/RouteMetaContext', () => ({ RouteMetaProvider: ({ children }: { children: ReactNode }) => children }));
vi.mock('@/routes/RouteRuntimeContext', () => ({ RouteRuntimeProvider: ({ children }: { children: ReactNode }) => children }));
vi.mock('@/routes/routeShellActivation', () => ({ getRouteShellActivationOptionsFromEnv: () => ({}), isRouteShellEnabled: () => false }));
import { AppRouteElement } from '@/routes/AppRouteElement';

const route = (requiresAuth: boolean): AppRouteConfig => ({
  path: requiresAuth ? '/home' : '/auth',
  meta: { id: requiresAuth ? 'home' : 'auth', title: 'Unison', section: 'auth', shell: 'public', chrome: 'legacy', requiresAuth },
  element: <div>Account page</div>,
});
const session = { user: { id: 'account-user', is_anonymous: false } };
beforeEach(() => { vi.clearAllMocks(); mocks.listeners.length = 0; });
afterEach(cleanup);

describe('authentication route transitions', () => {
  it('waits when a public gate becomes protected without bouncing to auth', async () => {
    let resolve: ((value: { data: { session: typeof session } }) => void) | undefined;
    mocks.getSession.mockReturnValue(new Promise(done => { resolve = done; }));
    const view = render(<AppRouteElement route={route(false)} />);
    view.rerender(<AppRouteElement route={route(true)} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(mocks.redirect).not.toHaveBeenCalled();
    await act(async () => { resolve?.({ data: { session } }); });
    expect(screen.getByText('Account page')).toBeInTheDocument();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it('does not let an older empty session overwrite sign-in, but still handles sign-out', async () => {
    let resolve: ((value: { data: { session: null } }) => void) | undefined;
    mocks.getSession.mockReturnValue(new Promise(done => { resolve = done; }));
    render(<AppRouteElement route={route(true)} />);
    act(() => { mocks.listeners[0]?.('SIGNED_IN', session); });
    await act(async () => { resolve?.({ data: { session: null } }); });
    expect(screen.getByText('Account page')).toBeInTheDocument();
    expect(mocks.redirect).not.toHaveBeenCalled();
    act(() => { mocks.listeners[0]?.('SIGNED_OUT', null); });
    expect(mocks.redirect).toHaveBeenCalledWith('/auth?next=%2Fhome');
  });

  it('still refuses anonymous sessions', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: { user: { id: 'guest', is_anonymous: true } } } });
    render(<AppRouteElement route={route(true)} />);
    await waitFor(() => expect(mocks.redirect).toHaveBeenCalledWith('/auth?next=%2Fhome'));
  });
});