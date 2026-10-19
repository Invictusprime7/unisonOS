import { beforeEach, describe, expect, it, vi } from 'vitest';
import { findBuilderDraftIdForProject, findLatestBuilderDraftProjectionForProject } from '@/services/builderDraftBridge';

const mock = vi.hoisted(() => ({ results: [] as unknown[], queries: [] as any[] }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  auth: { getUser: vi.fn() },
  from: vi.fn(() => {
    const result = mock.results.shift();
    const query: any = { then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve) };
    for (const method of ['select', 'eq', 'not', 'order', 'limit']) query[method] = vi.fn(() => query);
    mock.queries.push(query);
    return query;
  }),
} }));
beforeEach(() => { mock.results.length = 0; mock.queries.length = 0; });
describe('lightweight draft lookup', () => {
  it('filters accepted revisions before limiting to the newest one', async () => {
    mock.results.push({ data: [{ id: 'draft', last_revision_id: 'revision', updated_at: '2026-10-19' }], error: null });
    expect(await findLatestBuilderDraftProjectionForProject({ projectId: 'project', userId: 'owner' }))
      .toMatchObject({ draftId: 'draft', revisionId: 'revision' });
    expect(mock.queries[0].not).toHaveBeenCalledWith('last_revision_id', 'is', null);
    expect(mock.queries[0].limit).toHaveBeenCalledWith(1);
    expect(mock.queries[0].eq).toHaveBeenCalledWith('project_id', 'project');
  });
  it('retains historical metadata identity without transferring embedded snapshots', async () => {
    mock.results.push({ data: [], error: null }, { data: [{ id: 'legacy', metaLinkedProjectId: 'project' }], error: null });
    expect(await findBuilderDraftIdForProject({ projectId: 'project', userId: 'owner' })).toBe('legacy');
    const projection = mock.queries[1].select.mock.calls[0][0];
    expect(projection).toContain('metaLinkedProjectId:metadata->>linkedProjectId');
    expect(projection.split(',').map((s: string) => s.trim())).not.toContain('metadata');
  });
  it('retains name fallback within the requested business', async () => {
    mock.results.push({ data: [{ id: 'wrong', business_id: 'other', metaName: 'Studio' }, { id: 'right', business_id: 'business', metaProjectName: 'Studio' }], error: null });
    expect(await findBuilderDraftIdForProject({ projectName: 'studio', businessId: 'business', userId: 'owner' })).toBe('right');
  });
});