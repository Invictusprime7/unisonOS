import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: mocks }));
import { saveSiteProfile } from '@/services/businessProfileService';
function query(result: unknown) {
  const q = { select: vi.fn(), eq: vi.fn(), is: vi.fn(), update: vi.fn(), insert: vi.fn(), maybeSingle: vi.fn(async () => result) };
  for (const method of ['select', 'eq', 'is', 'update', 'insert'] as const) q[method].mockReturnValue(q);
  return q;
}
describe('site override conditional saving', () => {
  beforeEach(() => vi.clearAllMocks());
  it('guards the entire observed overrides object and preserves unrelated fields', async () => {
    const observed = { tagline: 'Original', phone: '123' };
    const read = query({ data: { overrides: observed }, error: null });
    const write = query({ data: { project_id: 'project' }, error: null });
    const base = query({ data: { id: 'business', name: 'Acme' }, error: null });
    const reread = query({ data: { overrides: { ...observed, tagline: 'Changed' } }, error: null });
    mocks.from.mockReturnValueOnce(read).mockReturnValueOnce(write).mockReturnValueOnce(base).mockReturnValueOnce(reread);
    expect((await saveSiteProfile('business', 'project', { tagline: 'Changed' }))?.tagline).toBe('Changed');
    expect(write.update).toHaveBeenCalledWith({ overrides: { tagline: 'Changed', phone: '123' } });
    expect(write.eq).toHaveBeenCalledWith('overrides', observed);
    expect(write.eq).toHaveBeenCalledWith('business_id', 'business');
  });
  it('rejects a concurrent update instead of returning a successful save', async () => {
    const read = query({ data: { overrides: { tagline: 'Original' } }, error: null });
    const write = query({ data: null, error: null });
    mocks.from.mockReturnValueOnce(read).mockReturnValueOnce(write);
    await expect(saveSiteProfile('business', 'project', { tagline: 'Changed' })).rejects.toThrow('Conflict');
    expect(mocks.from).toHaveBeenCalledTimes(2);
  });
  it('does not overwrite a profile concurrently created after a missing-row read', async () => {
    const read = query({ data: null, error: null });
    const write = query({ data: null, error: { code: '23505', message: 'duplicate' } });
    mocks.from.mockReturnValueOnce(read).mockReturnValueOnce(write);
    await expect(saveSiteProfile('business', 'project', { email: 'owner@example.test' })).rejects.toThrow('Conflict');
    expect(write.insert).toHaveBeenCalledWith({ project_id: 'project', business_id: 'business', overrides: { email: 'owner@example.test' } });
    expect(write.update).not.toHaveBeenCalled();
  });
  it('rejects an already changed observed site field before writing', async () => {
    mocks.from.mockReturnValueOnce(query({ data: { overrides: { tagline: 'Newer' } }, error: null }))
      .mockReturnValueOnce(query({ data: { id: 'business', name: 'Acme' }, error: null }));
    await expect(saveSiteProfile('business', 'project', { tagline: 'Mine' }, { tagline: 'Original' })).rejects.toThrow('Conflict');
    expect(mocks.from).toHaveBeenCalledTimes(2);
  });
});