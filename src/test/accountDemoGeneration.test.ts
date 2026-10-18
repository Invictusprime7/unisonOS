// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readAccountDemoStatus, withAccountDemoGeneration } from '@/services/accountDemoGeneration';
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc } }));

describe('account demo client', () => {
  beforeEach(() => { rpc.mockReset(); });
  it('reads persistent count and saved project from the account, not browser storage', async () => {
    rpc.mockResolvedValue({ data: { generation_count: 1, remaining: 0, in_progress: false, project_id: 'saved-project' }, error: null });
    expect(await readAccountDemoStatus()).toEqual({ generationCount: 1, remaining: 0, inProgress: false, projectId: 'saved-project' });
    expect(rpc).toHaveBeenCalledWith('account_demo_status');
  });
  it('fails closed when allowance cannot be read', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'unavailable' } });
    await expect(readAccountDemoStatus()).rejects.toThrow('could not be checked');
  });
  it('does not run generation when the server refuses a second free run', async () => {
    rpc.mockResolvedValue({ error: { message: "You've used your free demo generation." } });
    const generate = vi.fn();
    await expect(withAccountDemoGeneration(generate)).rejects.toThrow('used your free');
    expect(generate).not.toHaveBeenCalled();
  });
  it('reserves before generation and releases failures using the same operation', async () => {
    rpc.mockResolvedValue({ error: null });
    let operation = '';
    await expect(withAccountDemoGeneration(async id => {
      operation = id;
      expect(rpc).toHaveBeenCalledWith('reserve_account_demo_generation', { p_operation_id: id });
      throw new Error('generation failed');
    })).rejects.toThrow('generation failed');
    expect(rpc).toHaveBeenLastCalledWith('release_account_demo_generation', { p_operation_id: operation });
  });
});