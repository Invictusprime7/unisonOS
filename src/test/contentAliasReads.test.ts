import { afterEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ list: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn() }));
vi.mock('@/services/cmsRecordService', () => ({ listContentRecords: mocks.list, getContentRecord: mocks.get, createContentRecord: mocks.create, updateContentRecord: mocks.update }));
import { contentResourceAdapter } from '@/services/resources/resourceAdapters';
import { getResource, registerContentTypes } from '@/services/resources/resourceRegistry';
const ctx = { businessId: 'business', projectId: 'project', mode: 'builder' as const };
afterEach(() => { registerContentTypes([]); vi.clearAllMocks(); });
describe('content alias records preserve their storage identities', () => {
  it('reads every historical type ID in project scope and preserves distinct same-title entries', async () => {
    registerContentTypes([{ id: 'primary', api_key: 'faq' }, { id: 'legacy', api_key: 'faqs' }]);
    mocks.list.mockImplementation(async ({ contentTypeId }) => [{ id: contentTypeId, title: 'Same title', data: { answer: contentTypeId }, status: 'published' }]);
    const def = getResource('content:faq');
    if (!def) throw new Error('Missing definition');
    expect((await contentResourceAdapter.query(def, ctx)).map((r) => r.id)).toEqual(['primary', 'legacy']);
    expect(mocks.list).toHaveBeenCalledWith(expect.objectContaining({ businessId: 'business', projectId: 'project', contentTypeId: 'legacy' }));
  });
  it('does not let one content kind read a record owned by another content type', async () => {
    registerContentTypes([{ id: 'faq-type', api_key: 'faq' }]);
    mocks.get.mockResolvedValue({ id: 'case-record', content_type_id: 'case-type', title: 'Case study' });
    const def = getResource('content:faq');
    if (!def) throw new Error('Missing definition');
    expect(await contentResourceAdapter.get(def, ctx, 'case-record')).toBeNull();
  });
  it('creates a FAQ using its canonical type and keeps title outside schema data', async () => {
    registerContentTypes([{ id: 'faq-type', api_key: 'faq', field_schema: [{ key: 'question', type: 'text' }, { key: 'answer', type: 'textarea' }] }]);
    mocks.create.mockResolvedValue({ id: 'new', title: 'Delivery?', data: { question: 'Delivery?', answer: 'Yes' } });
    const def = getResource('content:faqs');
    if (!def) throw new Error('Missing definition');
    await contentResourceAdapter.create(def, ctx, { title: 'Delivery?', question: 'Delivery?', answer: 'Yes' });
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ contentTypeId: 'faq-type', projectId: 'project', values: { title: 'Delivery?', data: { question: 'Delivery?', answer: 'Yes' } } }));
  });
  it('updates a historical entry by its original ID without moving its type or history', async () => {
    registerContentTypes([{ id: 'faq-type', api_key: 'faq' }, { id: 'faq-old', api_key: 'faqs' }]);
    mocks.get.mockResolvedValue({ id: 'legacy-entry', content_type_id: 'faq-old', title: 'Old title', slug: 'old', locale: 'en', data: { answer: 'Old answer' } });
    mocks.update.mockResolvedValue({ id: 'legacy-entry', title: 'New title', data: { answer: 'New answer' } });
    const def = getResource('content:faq');
    if (!def) throw new Error('Missing definition');
    await contentResourceAdapter.update(def, ctx, 'legacy-entry', { title: 'New title', answer: 'New answer' }, { answer: 'Old answer' });
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ recordId: 'legacy-entry', projectId: 'project', values: { title: 'New title', slug: 'old', locale: 'en', data: { answer: 'New answer' } } }));
    expect(mocks.update.mock.calls[0][0]).not.toHaveProperty('contentTypeId');
  });
});