/**
 * Preview Execution Convergence — the review's restaurant slice at service
 * level: select a menu item in Preview, edit its name/price/image through the
 * unified command service, and prove the write lands on the owning record,
 * scoped to the owning project, with an invalidation that names the project
 * and the touched table. A second project's records must stay untouched.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ResourceRecord } from '@/services/resources/resourceTypes';

const mocks = vi.hoisted(() => ({
  resolve: vi.fn(),
  callProjectBackend: vi.fn(),
  listCmsRecords: vi.fn(),
  createCmsRecord: vi.fn(),
  updateCmsRecord: vi.fn(),
  removeCmsRecord: vi.fn(),
}));

vi.mock('@/services/project-backend/projectBackendResolver', () => ({
  projectBackendResolver: { resolve: mocks.resolve, invalidate: vi.fn() },
}));
vi.mock('@/services/project-backend/projectBackendClient', () => ({
  callProjectBackend: mocks.callProjectBackend,
}));
vi.mock('@/services/cmsRecordService', () => ({
  listCmsRecords: mocks.listCmsRecords,
  createCmsRecord: mocks.createCmsRecord,
  removeCmsRecord: mocks.removeCmsRecord,
  updateCmsRecord: mocks.updateCmsRecord,
  listContentRecords: vi.fn(async () => []),
  getContentRecord: vi.fn(),
  createContentRecord: vi.fn(),
  updateContentRecord: vi.fn(),
}));
vi.mock('@/services/businessProfileService', () => ({
  loadSiteProfile: vi.fn(),
  saveSiteProfile: vi.fn(),
}));

import { executeEditorCommand } from '@/services/editor/editorCommandService';
import { onResourceInvalidated, queryResource } from '@/services/resources/resourceRuntime';
import type { ResourceInvalidation } from '@/services/resources/resourceTypes';

const RESTAURANT = { businessId: 'business-restaurant', projectId: 'project-restaurant', siteId: 'site-restaurant' } as const;
const OTHER_PROJECT_ID = 'project-other';

const soup: ResourceRecord = { id: 'menu-soup', name: 'Roasted tomato soup', price_cents: 1250, image: 'https://x/soup.png' };
const otherProjectRows: ResourceRecord[] = [{ id: 'menu-other', name: 'Other site dish', price_cents: 900 }];

function rowsFor(projectId: string | null | undefined): ResourceRecord[] {
  return projectId === OTHER_PROJECT_ID ? otherProjectRows : [soup];
}

const ctx = { ...RESTAURANT, mode: 'builder' as const };

describe('preview execution convergence (restaurant slice)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    soup.name = 'Roasted tomato soup';
    soup.price_cents = 1250;
    soup.image = 'https://x/soup.png';
    mocks.resolve.mockImplementation(async (projectId: string) => ({
      bindingId: `binding-${projectId}`,
      projectId,
      siteId: `site-${projectId.replace('project-', '')}`,
      mode: 'shared-legacy',
      provider: 'supabase',
      status: 'ready',
    }));
    mocks.listCmsRecords.mockImplementation(async ({ projectId }: { projectId?: string | null }) => rowsFor(projectId));
    mocks.updateCmsRecord.mockImplementation(async ({ recordId, values }: { recordId: string; values: Record<string, unknown> }) => {
      Object.assign(soup, values);
      return { id: recordId, ...soup };
    });
  });

  it('text edit on a marked menu item saves to the record, not the JSX', async () => {
    const sourceExec = vi.fn();
    const invalidations: ResourceInvalidation[] = [];
    const off = onResourceInvalidated((inv) => invalidations.push(inv));

    const result = await executeEditorCommand(
      { type: 'set-text', text: 'Fire-roasted tomato soup', target: { pagePath: '/', resourceMark: 'menu#menu-soup.name' } },
      { source: 'inspector', resource: ctx, executors: { source: sourceExec } },
    );
    off();

    expect(result).toMatchObject({ ok: true, lane: 'resource', changedFields: ['name'] });
    expect(sourceExec).not.toHaveBeenCalled();
    expect(mocks.updateCmsRecord).toHaveBeenCalledWith(expect.objectContaining({
      businessId: RESTAURANT.businessId,
      projectId: RESTAURANT.projectId,
      resource: 'menu',
      recordId: 'menu-soup',
      values: { name: 'Fire-roasted tomato soup' },
    }));
    // Persisted value reads back through the same runtime.
    const rows = await queryResource('menu', ctx);
    expect(rows.find((r) => r.id === 'menu-soup')?.name).toBe('Fire-roasted tomato soup');
    // Invalidation names the owning project and the touched table.
    expect(invalidations).toHaveLength(1);
    expect(invalidations[0]).toMatchObject({
      resourceKey: 'menu',
      projectId: RESTAURANT.projectId,
      recordIds: ['menu-soup'],
      sourceTables: ['menu_items'],
    });
    // The other project's rows were never read or written.
    expect(otherProjectRows[0].name).toBe('Other site dish');
    expect(mocks.updateCmsRecord).toHaveBeenCalledTimes(1);
  });

  it('image replacement on a marked menu item writes the schema image field', async () => {
    const result = await executeEditorCommand(
      { type: 'replace-asset', url: 'https://x/new-soup.png', target: { pagePath: '/', resourceMark: 'menu#menu-soup' } },
      { source: 'toolbar', resource: ctx },
    );
    // The menu surface's image field is image_url — resolved from the schema, not guessed.
    expect(result).toMatchObject({ ok: true, lane: 'resource', changedFields: ['image_url'] });
    expect(mocks.updateCmsRecord).toHaveBeenCalledWith(expect.objectContaining({
      recordId: 'menu-soup',
      values: { image_url: 'https://x/new-soup.png' },
    }));
  });

  it('price edit via update-resource-field persists and offers undo', async () => {
    const result = await executeEditorCommand(
      { type: 'update-resource-field', values: { price_cents: 1390 }, target: { pagePath: '/', resourceMark: 'menu#menu-soup.price_cents' } },
      { source: 'inspector', resource: ctx },
    );
    expect(result).toMatchObject({ ok: true, lane: 'resource', changedFields: ['price_cents'] });
    expect(soup.price_cents).toBe(1390);
    await result.undo?.();
    expect(soup.price_cents).toBe(1250);
  });

  it('unmarked text stays on the source lane and never touches business data', async () => {
    const sourceExec = vi.fn(async () => ({ ok: true as const, command: 'set-text' as const, lane: 'source' as const, savedTo: '/src/pages/Home.tsx', changedFields: ['text'] }));
    const result = await executeEditorCommand(
      { type: 'set-text', text: 'Our story', target: { pagePath: '/', slotId: 'headline' } },
      { source: 'inspector', resource: ctx, executors: { source: sourceExec } },
    );
    expect(result.ok).toBe(true);
    expect(sourceExec).toHaveBeenCalledOnce();
    expect(mocks.listCmsRecords).not.toHaveBeenCalled();
    expect(mocks.updateCmsRecord).not.toHaveBeenCalled();
  });

  it('an element with no identity is read-only instead of guessing', async () => {
    const result = await executeEditorCommand(
      { type: 'set-text', text: 'x', target: { ownerKind: 'unbound' } },
      { source: 'inspector', resource: ctx },
    );
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/read-only/);
    expect(mocks.updateCmsRecord).not.toHaveBeenCalled();
  });
});
