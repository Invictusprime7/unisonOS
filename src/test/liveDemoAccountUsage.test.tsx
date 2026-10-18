import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LiveDemo from '@/pages/LiveDemo';
const { readStatus, getSession, launchProps } = vi.hoisted(() => ({
  readStatus: vi.fn(), getSession: vi.fn(), launchProps: vi.fn(),
}));
vi.mock('@/services/accountDemoGeneration', () => ({ readAccountDemoStatus: readStatus }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: { getSession } } }));
vi.mock('@/components/home/sections', () => ({ HeroSection: (props: { onSiteConfirmed: (brief: string) => void; onLauncherOpenChange: (open: boolean) => void; launcherOpen: boolean; demoGeneration: boolean }) => {
  launchProps(props);
  return <div><button onClick={() => props.onSiteConfirmed('Bakery website')}>Confirm plan</button>
    {props.launcherOpen && <button onClick={() => props.onLauncherOpenChange(false)}>Close setup</button>}</div>;
} }));

describe('Live Demo account allowance read-back', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({ data: { session: { user: { id: 'account-1' } } } });
    readStatus.mockResolvedValue({ generationCount: 0, remaining: 1, inProgress: false, projectId: null });
  });
  afterEach(cleanup);
  const open = () => render(<MemoryRouter><LiveDemo /></MemoryRouter>);

  it('keeps the run available after planning and closing without generating a project', async () => {
    open();
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm plan' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close setup' }));
    expect(await screen.findByRole('button', { name: 'Confirm plan' })).toBeInTheDocument();
    expect(launchProps.mock.lastCall?.[0].demoGeneration).toBe(true);
  });
  it('reads the exhausted account state again after remount without local storage', async () => {
    readStatus.mockResolvedValue({ generationCount: 1, remaining: 0, inProgress: false, projectId: 'saved-draft' });
    const first = open();
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Confirm plan' })).not.toBeInTheDocument());
    expect(await screen.findByRole('button', { name: 'Open Unison Home' })).toBeInTheDocument();
    first.unmount();
    window.localStorage.clear();
    open();
    expect(await screen.findByRole('button', { name: 'Open Unison Home' })).toBeInTheDocument();
    expect(readStatus).toHaveBeenCalledTimes(2);
  });
  it('does not open generation when the account allowance cannot be checked, and allows retry', async () => {
    readStatus.mockRejectedValueOnce(new Error('offline'));
    open();
    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('button', { name: 'Confirm plan' })).toBeInTheDocument();
    expect(readStatus).toHaveBeenCalledTimes(2);
  });
  it('holds a second tab while the same account has a generation in progress', async () => {
    readStatus.mockResolvedValue({ generationCount: 0, remaining: 1, inProgress: true, projectId: null });
    open();
    await waitFor(() => expect(readStatus).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: 'Confirm plan' })).not.toBeInTheDocument();
  });
});