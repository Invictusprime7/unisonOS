import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ElementIntentInspector } from '@/components/creatives/web-builder/ElementIntentInspector';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  upsert: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: mocks.from } }));

const selection = {
  elementKey: 'booking-button',
  elementLabel: 'Book now',
  tagName: 'button',
  intent: 'booking.start',
};

beforeEach(() => {
  vi.clearAllMocks();
  const query: Record<string, any> = {};
  query.select = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.order = vi.fn(() => query);
  query.limit = vi.fn(() => query);
  query.maybeSingle = vi.fn(() => Promise.resolve({
    data: { id: 'binding-1', workflow_id: null, intent: 'booking.start', enabled: true },
  }));
  query.upsert = mocks.upsert.mockResolvedValue({ error: null });
  query.delete = mocks.delete.mockReturnValue(query);
  query.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
    Promise.resolve({ data: [], error: null }).then(resolve, reject);
  mocks.from.mockReturnValue(query);
});

afterEach(cleanup);

function renderInspector() {
  return render(
    <ElementIntentInspector
      selection={selection}
      businessId="business-1"
      projectId="project-1"
      pagePath="/src/pages/Home.tsx"
      onClose={vi.fn()}
    />,
  );
}

describe('Element Inspector confirmations', () => {
  it('saves intent settings only after the check is clicked', async () => {
    renderInspector();
    const confirm = await screen.findByRole('button', { name: 'Confirm intent changes' });
    expect(mocks.upsert).not.toHaveBeenCalled();

    fireEvent.click(confirm);
    await waitFor(() => expect(mocks.upsert).toHaveBeenCalledOnce());
  });

  it('does not unlink an existing binding until the staged action is confirmed', async () => {
    renderInspector();
    fireEvent.click(await screen.findByRole('button', { name: /Unwire/ }));
    expect(mocks.delete).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm unwire' }));
    await waitFor(() => expect(mocks.delete).toHaveBeenCalledOnce());
  });
});