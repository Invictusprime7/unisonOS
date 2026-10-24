import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { loadPreview, renderPreview } = vi.hoisted(() => ({ loadPreview: vi.fn(), renderPreview: vi.fn() }));
vi.mock('@/marketplace/stageReleaseClient', () => ({ loadMarketplaceReleasePreview: loadPreview }));
vi.mock('@/components/VFSPreview', () => ({ VFSPreview: (props: unknown) => { renderPreview(props); return null; } }));
import { MarketplaceReleaseThumbnail } from '@/marketplace/MarketplaceReleaseThumbnail';

describe('published release thumbnails', () => {
  beforeEach(() => { loadPreview.mockReset(); renderPreview.mockClear(); });
  afterEach(cleanup);

  it('renders the published package rather than original project assets', async () => {
    const files = { '/src/App.tsx': 'export default function App(){return <main>Site</main>}' };
    loadPreview.mockResolvedValue({ success: true, files });
    render(<MarketplaceReleaseThumbnail slug="published-site" releaseId="release-1" />);
    await waitFor(() => expect(renderPreview).toHaveBeenCalled());
    expect(loadPreview).toHaveBeenCalledWith('published-site');
    expect(renderPreview.mock.calls[0][0]).toMatchObject({ files, enableSelection: false, showToolbar: false, forceBackend: 'sandpack' });
  });

  it('reloads when a new release replaces the listing', async () => {
    loadPreview.mockResolvedValue({ success: true, files: { '/src/App.tsx': 'first' } });
    const view = render(<MarketplaceReleaseThumbnail slug="published-site" releaseId="release-1" />);
    await waitFor(() => expect(loadPreview).toHaveBeenCalledTimes(1));
    view.rerender(<MarketplaceReleaseThumbnail slug="published-site" releaseId="release-2" />);
    await waitFor(() => expect(loadPreview).toHaveBeenCalledTimes(2));
  });
});