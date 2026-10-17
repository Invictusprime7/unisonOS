import { afterEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ list: vi.fn(), get: vi.fn() }));
vi.mock('@/services/cmsRecordService', () => ({ listContentRecords: mocks.list, getContentRecord: mocks.get }));
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
});