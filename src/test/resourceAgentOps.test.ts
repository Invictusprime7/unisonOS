import { describe, it, expect } from 'vitest';
import { agentOperations } from '@/services/agent-runtime/operations';

describe('resource agent operations', () => {
  it('lists business details with editable fields', () => {
    const list = agentOperations.list_resources();
    const profile = list.find((r) => r.kind === 'business-profile');
    expect(profile?.fields.length).toBeGreaterThan(0);
  });
  it('classifies catalog resources and exposes their typed editable schemas', () => {
    const list = agentOperations.list_resources();
    const product = list.find((resource) => resource.key === 'products');
    const service = list.find((resource) => resource.key === 'services');

    expect(product?.catalogKind).toBe('product');
    expect(product?.fieldDefinitions).toContainEqual(expect.objectContaining({ key: 'price', type: 'money' }));
    expect(product?.fieldDefinitions).toContainEqual(expect.objectContaining({ key: 'inventory_count', type: 'number' }));
    expect(service?.catalogKind).toBe('service');
    expect(service?.fieldDefinitions).toContainEqual(expect.objectContaining({ key: 'duration_minutes', type: 'number' }));
    expect(service?.fieldDefinitions).not.toContainEqual(expect.objectContaining({ key: 'inventory_count' }));
  });
  it('refuses unknown record marks and missing business', async () => {
    await expect(agentOperations.update_resource_field({ files: {} }, 'nope#1.x', 'y')).rejects.toThrow(/No business/);
    await expect(agentOperations.update_resource_field({ files: {}, businessId: 'b' }, 'nope#1.x', 'y')).rejects.toThrow(/Unknown record mark/);
  });
});
