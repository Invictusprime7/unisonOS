import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ callbacks: [] as Array<(payload: { new?: Record<string, unknown> }) => void>, refresh: vi.fn(), remove: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  channel: () => { const channel = { on(_event: unknown, _filter: unknown, callback: typeof mocks.callbacks[number]) { mocks.callbacks.push(callback); return this; }, subscribe() {} }; return channel; },
  removeChannel: mocks.remove,
} }));
vi.mock('@/services/dataOperationRefresh', () => ({ refreshDataOperationResources: mocks.refresh }));
import { startCatalogLiveSync } from '@/services/catalogLiveSync';
describe('live record refresh is project-scoped', () => {
  beforeEach(() => { mocks.callbacks.length = 0; vi.clearAllMocks(); });
  it('refreshes the owning site only, including other tabs under the same business', () => {
    const stop = startCatalogLiveSync({ businessId: 'business-1', projectId: 'project-1' });
    mocks.callbacks[0]({ new: { id: 'product-2', project_id: 'project-2' } });
    expect(mocks.refresh).not.toHaveBeenCalled();
    mocks.callbacks[0]({ new: { id: 'product-1', project_id: 'project-1' } });
    expect(mocks.refresh).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ projectId: 'project-1', results: [expect.objectContaining({ rowId: 'product-1', sourceTable: 'products' })] }));
    stop();
    expect(mocks.remove).toHaveBeenCalledOnce();
  });
});