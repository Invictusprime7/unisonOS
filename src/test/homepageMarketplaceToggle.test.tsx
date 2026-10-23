import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

const mocks = vi.hoisted(() => ({ list: vi.fn(), chatUnmounted: vi.fn() }));

vi.mock('@/marketplace/listingService', () => ({
  listPublicMarketplaceListings: mocks.list,
}));

vi.mock('@/components/ai/AIAssistantCore', async () => {
  const React = await import('react');
  return {
    AIAssistantCore: () => {
      const [draft, setDraft] = React.useState('Chat is ready');
      React.useEffect(() => () => mocks.chatUnmounted(), []);
      return (
        <div>
          <p>{draft}</p>
          <button onClick={() => setDraft('Chat state retained')}>Update chat</button>
        </div>
      );
    },
  };
});

import { HeroSection } from '@/components/home/sections/HeroSection';

describe('homepage Chat/Marketplace toggle', () => {
  afterEach(() => {
    cleanup();
    mocks.list.mockReset();
    mocks.chatUnmounted.mockClear();
  });

  it('switches views without unmounting or losing chat state', async () => {
    mocks.list.mockResolvedValue([]);
    render(
      <MemoryRouter>
        <HeroSection
          user={null}
          onAuthRequired={vi.fn()}
          onSiteConfirmed={vi.fn()}
          launcherOpen={false}
          launchBrief={null}
          onLauncherOpenChange={vi.fn()}
        />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Update chat' }));
    expect(screen.getByText('Chat state retained')).toBeInTheDocument();

    const marketplaceTab = screen.getByRole('tab', { name: 'Marketplace' });
    fireEvent.keyDown(screen.getByRole('tab', { name: 'AI Chat' }), { key: 'ArrowRight' });
    expect(await screen.findByRole('heading', { name: 'Browse templates' })).toBeInTheDocument();
    expect(marketplaceTab).toHaveAttribute('aria-selected', 'true');
    expect(marketplaceTab).toHaveFocus();
    expect(screen.getByText('Chat state retained')).toBeInTheDocument();
    expect(mocks.chatUnmounted).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('tab', { name: 'AI Chat' }));
    expect(screen.getByText('Chat state retained')).toBeInTheDocument();
    expect(mocks.chatUnmounted).not.toHaveBeenCalled();
  });
});