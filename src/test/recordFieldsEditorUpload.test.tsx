import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  applyResourceOp: vi.fn(),
  getResourceRecord: vi.fn(),
  uploadForPlacement: vi.fn(),
}));

vi.mock('@/services/resources/resourceRuntime', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/resources/resourceRuntime')>();
  return { ...actual, applyResourceOp: mocks.applyResourceOp, getResourceRecord: mocks.getResourceRecord };
});

vi.mock('@/services/assets/uploadPlacement', () => ({
  uploadForPlacement: mocks.uploadForPlacement,
}));

import { RecordFieldsEditor } from '@/components/creatives/web-builder/RecordFieldsEditor';

describe('RecordFieldsEditor image upload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getResourceRecord.mockResolvedValue({ id: 'business-1', name: 'Studio', tagline: 'Original', logoUrl: '' });
    mocks.applyResourceOp.mockImplementation(async (_op, _context) => ({
      id: 'business-1', name: 'Studio', tagline: 'Original', logoUrl: 'https://storage.example/logo.png',
    }));
    mocks.uploadForPlacement.mockResolvedValue({
      name: 'logo.png', kind: 'image', mimeType: 'image/png', url: 'https://storage.example/logo.png',
    });
  });

  it('exposes the profile logo upload and saves only its project-scoped resource field', async () => {
    render(<RecordFieldsEditor defaultOpen mark="business-profile#business-1" businessId="business-1" projectId="project-1" />);

    const tagline = await screen.findByLabelText('Tagline');
    fireEvent.change(tagline, { target: { value: 'Unsaved tagline draft' } });
    const file = new File(['image bytes'], 'logo.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('Upload logo'), { target: { files: [file] } });

    await waitFor(() => expect(mocks.uploadForPlacement).toHaveBeenCalledWith(file, 'project-1'));
    await waitFor(() => expect(mocks.applyResourceOp).toHaveBeenCalledWith(
      {
        op: 'update',
        ref: expect.objectContaining({ resourceKey: 'business-profile', kind: 'business-profile', recordId: 'business-1' }),
        values: { logoUrl: 'https://storage.example/logo.png' },
      },
      { businessId: 'business-1', projectId: 'project-1', mode: 'builder' },
    ));
    expect(mocks.applyResourceOp).toHaveBeenCalledTimes(1);
    expect(mocks.applyResourceOp.mock.calls[0][0].values).not.toHaveProperty('tagline');
  });
});