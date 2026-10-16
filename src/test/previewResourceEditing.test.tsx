import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/resources/resourceRuntime', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/resources/resourceRuntime')>();
  return {
    ...actual,
    getResourceRecord: vi.fn(async () => ({ id: 'business-1', name: 'Studio', tagline: 'Original' })),
  };
});

import { ElementFloatingToolbar } from '@/components/creatives/web-builder/ElementFloatingToolbar';

afterEach(cleanup);

describe('Preview resource editing', () => {
  it('opens the linked record fields as soon as a resource-backed element is selected', async () => {
    render(
      <ElementFloatingToolbar
        element={{
          tagName: 'p',
          textContent: 'Studio',
          selector: '[data-ut-resource="business-profile#business-1.name"]',
          attributes: { 'data-ut-resource': 'business-profile#business-1.name' },
        }}
        onUpdateStyles={() => undefined}
        onReplaceImage={() => undefined}
        onDelete={() => undefined}
        onDuplicate={() => undefined}
        onClear={() => undefined}
        businessId="business-1"
      />,
    );

    await waitFor(() => expect(screen.getByLabelText('Tagline')).toBeTruthy());
    expect(screen.getByText('Edit saved business profile')).toBeTruthy();
  });
});