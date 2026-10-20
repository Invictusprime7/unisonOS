import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
const mocks = vi.hoisted(() => ({ load: vi.fn(), create: vi.fn(), types: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  auth: { getUser: async () => ({ data: { user: { id: 'user' } } }) },
  from: () => ({ select: () => ({ order: async () => ({ data: [{ id: 'project-a', name: 'Studio', business_id: 'business-a' }] }) }) }),
} }));
vi.mock('@/services/businessMembership', () => ({ loadBusinessMemberships: async () => [{ businessId: 'business-a', name: 'Studio' }] }));
vi.mock('@/services/cmsRecordService', () => ({ listContentTypes: mocks.types, mutateContentRecord: vi.fn(), transitionContentRecord: vi.fn() }));
vi.mock('@/services/resources/recordsProjection', () => ({ loadUnifiedRecords: mocks.load }));
vi.mock('@/services/resources/resourceRuntime', () => ({ applyResourceOp: mocks.create, onResourceInvalidated: () => () => {} }));
vi.mock('@/services/resources/seedLaunchAssets', () => ({ SEED_CONTENT_TYPES: {} }));
vi.mock('@/components/creatives/web-builder/RecordFieldsEditor', () => ({ RecordFieldsEditor: ({ mark }: { mark: string }) => <p>Editing {mark}</p> }));
import BusinessRecords from '@/pages/BusinessRecords';
import { registerContentTypes } from '@/services/resources/resourceRegistry';
describe('unified records page', () => {
  beforeEach(() => {
    vi.clearAllMocks(); registerContentTypes([]);
    mocks.types.mockResolvedValue([{ id: 'faq-type', api_key: 'faqs' }]);
    mocks.load.mockResolvedValue({ records: [{ key: 'content:faq#faq-row', kind: 'faqs', title: 'When do you ship?', resource: { key: 'content:faq', kind: 'content' }, record: { id: 'faq-row', status: 'draft' } }], errors: [] });
    mocks.create.mockResolvedValue({ id: 'created' });
  });
  it('loads the selected site, filters records and opens the original record identity', async () => {
    render(<MemoryRouter initialEntries={['/business/records?projectId=project-a']}><BusinessRecords /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'When do you ship?' }));
    expect(screen.getByText('Editing content:faq#faq-row')).toBeInTheDocument();
    expect(mocks.load).toHaveBeenCalledWith({ businessId: 'business-a', projectId: 'project-a', mode: 'builder' });
    fireEvent.change(screen.getByLabelText('Search records'), { target: { value: 'not found' } });
    expect(screen.getByText('No records found.')).toBeInTheDocument();
  });
  it('creates a FAQ through the shared runtime with the selected project', async () => {
    render(<MemoryRouter initialEntries={['/business/records?projectId=project-a']}><BusinessRecords /></MemoryRouter>);
    await screen.findByRole('button', { name: 'When do you ship?' });
    fireEvent.click(screen.getByRole('button', { name: 'FAQs (1)' }));
    fireEvent.click(screen.getByRole('button', { name: 'New record' }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledWith({ op: 'create', resourceKey: 'content:faq', values: { title: 'New question', question: 'New question', answer: '' } }, { businessId: 'business-a', projectId: 'project-a', mode: 'builder' }));
  });
  it('does not query or create records for a project absent from the accessible project list', async () => {
    render(<MemoryRouter initialEntries={['/business/records?projectId=other-project']}><BusinessRecords /></MemoryRouter>);
    await waitFor(() => expect(screen.getByRole('button', { name: 'New record' })).toBeDisabled());
    expect(mocks.load).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });
});