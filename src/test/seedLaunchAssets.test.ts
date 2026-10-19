import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createCatalogItem: vi.fn(),
  listCatalog: vi.fn(),
  loadBusinessProfile: vi.fn(),
  saveBusinessProfile: vi.fn(),
  createContentRecord: vi.fn(),
  listContentRecords: vi.fn(),
  listContentTypes: vi.fn(),
  mutateContentRecord: vi.fn(),
}));

vi.mock('@/services/agent-runtime/catalogOps', () => ({
  createCatalogItem: mocks.createCatalogItem,
  listCatalog: mocks.listCatalog,
}));
vi.mock('@/services/businessProfileService', () => ({
  loadBusinessProfile: mocks.loadBusinessProfile,
  saveBusinessProfile: mocks.saveBusinessProfile,
}));
vi.mock('@/services/cmsRecordService', () => ({
  createContentRecord: mocks.createContentRecord,
  listContentRecords: mocks.listContentRecords,
  listContentTypes: mocks.listContentTypes,
  mutateContentRecord: mocks.mutateContentRecord,
}));

import { seedLaunchAssets } from '@/services/resources/seedLaunchAssets';
import { createEmptyCreatorData } from '@/types/creatorData';

describe('launch content seeding contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listCatalog.mockResolvedValue([]);
    mocks.loadBusinessProfile.mockResolvedValue(null);
    mocks.listContentTypes.mockResolvedValue([]);
    mocks.listContentRecords.mockResolvedValue([]);
    mocks.mutateContentRecord.mockImplementation(async (request: { values?: { apiKey?: string } }) => ({
      record: { id: `type-${request.values?.apiKey ?? 'unknown'}` },
    }));
    mocks.createContentRecord.mockResolvedValue({ id: 'entry' });
  });

  it('creates API-safe types and only submits fields declared by each type', async () => {
    const creatorData = createEmptyCreatorData('Launch');
    creatorData.faqs.faq_1 = {
      faqId: 'faq_1', question: 'When?', answer: 'Soon', category: 'General', sortOrder: 1,
    };
    creatorData.team.member_1 = {
      memberId: 'member_1', name: 'Alex', role: 'Owner', bio: 'Founder', sortOrder: 2,
    };
    creatorData.gallery.gallery_1 = {
      galleryItemId: 'gallery_1', assetId: 'asset_1', caption: 'Studio', category: 'Space', sortOrder: 3,
    };
    const extendedData = creatorData as typeof creatorData & {
      articles: Record<string, { title: string; excerpt: string; body: string }>;
      caseStudies: Record<string, { title: string; client: string; results: string }>;
    };
    extendedData.articles = { article_1: { title: 'News', excerpt: 'Summary', body: 'Details' } };
    extendedData.caseStudies = { case_1: { title: 'Results', client: 'Client', results: 'Growth' } };

    await seedLaunchAssets({ businessId: 'business-1', projectId: 'project-1', creatorData: extendedData });

    const typeCalls = mocks.mutateContentRecord.mock.calls
      .map(([request]) => request as { action: string; values?: { apiKey?: string; fieldSchema?: { fields?: Array<{ key: string }> } } })
      .filter((request) => request.action === 'content-type-create');
    const fieldsByTypeId = new Map<string, Set<string>>();
    for (const request of typeCalls) {
      const apiKey = request.values?.apiKey ?? '';
      expect(apiKey).toMatch(/^[a-z][a-z0-9_]{1,62}$/);
      fieldsByTypeId.set(`type-${apiKey}`, new Set(request.values?.fieldSchema?.fields?.map((field) => field.key) ?? []));
    }

    for (const [request] of mocks.createContentRecord.mock.calls) {
      const entry = request as { contentTypeId: string; values: { data: Record<string, unknown> } };
      const declaredFields = fieldsByTypeId.get(entry.contentTypeId);
      expect(declaredFields).toBeDefined();
      for (const [key, value] of Object.entries(entry.values.data)) {
        if (value !== undefined) expect(declaredFields?.has(key), `${entry.contentTypeId}.${key}`).toBe(true);
      }
    }
  });
  it('reuses historical FAQ and case-study type aliases instead of creating competing types', async () => {
    mocks.listContentTypes.mockResolvedValue([{ id: 'faq-old', api_key: 'faqs' }, { id: 'case-old', api_key: 'case_studies' }]);
    const data = createEmptyCreatorData('Launch');
    data.faqs.first = { faqId: 'first', question: 'When?', answer: 'Today' } as typeof data.faqs[string];
    const extended = data as typeof data & { caseStudies: Record<string, { title: string; body: string }> };
    extended.caseStudies = { first: { title: 'Story', body: 'Result' } };
    await seedLaunchAssets({ businessId: 'business-1', projectId: 'project-1', creatorData: extended });
    expect(mocks.mutateContentRecord).not.toHaveBeenCalled();
    expect(mocks.createContentRecord).toHaveBeenCalledWith(expect.objectContaining({ contentTypeId: 'faq-old' }));
    expect(mocks.createContentRecord).toHaveBeenCalledWith(expect.objectContaining({ contentTypeId: 'case-old' }));
  });
  it('fills owner-provided identity, email, hours and mission without overwriting existing profile facts', async () => {
    const hours = [{ day: 'Monday', open: '09:00', close: '17:00' }];
    mocks.loadBusinessProfile.mockResolvedValue({ name: '', email: '', hours: [], description: '' });
    const data = createEmptyCreatorData('Owner Studio');
    Object.assign(data.businessInfo, { email: 'owner@example.test', hours, description: 'Owner mission' });
    await seedLaunchAssets({ businessId: 'business-1', creatorData: data });
    expect(mocks.saveBusinessProfile).toHaveBeenCalledWith('business-1', {
      name: 'Owner Studio', email: 'owner@example.test', hours, description: 'Owner mission',
    });
    mocks.saveBusinessProfile.mockClear();
    mocks.loadBusinessProfile.mockResolvedValue({ name: 'Existing', email: 'existing@example.test', hours, description: 'Existing mission' });
    await seedLaunchAssets({ businessId: 'business-1', creatorData: data });
    expect(mocks.saveBusinessProfile).not.toHaveBeenCalled();
  });
  it('saves an explicitly targeted coaching pricing tier with currency and visibility intact', async () => {
    const data = createEmptyCreatorData('Coach');
    data.products.tier = { productId: 'tier', catalogSurface: 'pricing', name: 'Owner program', price: 95, currency: 'SEK', visibility: 'hidden', sortOrder: 2 };
    await seedLaunchAssets({ businessId: 'business-1', projectId: 'project-1', industry: 'coaching', creatorData: data });
    expect(mocks.createCatalogItem).toHaveBeenCalledWith('business-1', 'pricing', expect.objectContaining({ name: 'Owner program', price: 95, currency: 'SEK', active: false, sort_order: 2 }), 'project-1');
  });
});