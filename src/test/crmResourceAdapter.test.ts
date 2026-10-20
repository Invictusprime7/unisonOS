import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const method of ['select', 'update', 'eq', 'order', 'limit', 'maybeSingle']) {
    builder[method] = vi.fn();
  }
  for (const method of ['select', 'update', 'eq', 'order', 'limit']) {
    builder[method].mockReturnValue(builder);
  }
  return { builder, from: vi.fn(() => builder) };
});

vi.mock('@/integrations/supabase/client', () => ({ supabase: supabaseMock }));
vi.mock('@/services/project-backend/projectBackendGateway', () => ({
  withProjectBackend: async (_projectId: string | null | undefined, run: (descriptor: null) => Promise<unknown>) => run(null),
}));

import { getResource, listProjectCrmResources, listResources } from '@/services/resources/resourceRegistry';
import { crmResourceAdapter } from '@/services/resources/resourceAdapters';
import { applyResourceOp, queryResource } from '@/services/resources/resourceRuntime';

describe('project CRM resource adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers labeled project CRM resources without exposing them to generated-site discovery', () => {
    expect(listProjectCrmResources().map(({ key, label }) => [key, label])).toEqual([
      ['crm:contacts', 'Contacts'],
      ['crm:leads', 'Leads'],
    ]);
    expect(getResource('crm:contacts')?.schema.map((field) => field.label)).toContain('Email');
    expect(getResource('crm:leads')?.schema.find((field) => field.key === 'status')?.editable).toBe(false);
    expect(listResources().some((resource) => resource.kind === 'crm')).toBe(false);
  });

  it('filters updates to both project and business and strips identity/scope fields', async () => {
    const contact = { id: 'contact-1', project_id: 'project-1', business_id: 'business-1', email: 'new@example.com' };
    supabaseMock.builder.maybeSingle.mockResolvedValue({ data: contact, error: null });

    const result = await crmResourceAdapter.update(
      getResource('crm:contacts')!,
      { businessId: 'business-1', projectId: 'project-1', mode: 'cloud' },
      'contact-1',
      { email: 'new@example.com', id: 'other-id', project_id: 'other-project', business_id: 'other-business' },
      { updated_at: '2026-10-20T10:00:00.000Z' },
    );

    expect(supabaseMock.from).toHaveBeenCalledWith('crm_contacts');
    expect(supabaseMock.builder.eq).toHaveBeenCalledWith('id', 'contact-1');
    expect(supabaseMock.builder.eq).toHaveBeenCalledWith('project_id', 'project-1');
    expect(supabaseMock.builder.eq).toHaveBeenCalledWith('business_id', 'business-1');
    expect(supabaseMock.builder.eq).toHaveBeenCalledWith('updated_at', '2026-10-20T10:00:00.000Z');
    expect(supabaseMock.builder.update).toHaveBeenCalledWith(expect.objectContaining({ email: 'new@example.com' }));
    expect(supabaseMock.builder.update.mock.calls[0][0]).not.toHaveProperty('project_id');
    expect(supabaseMock.builder.update.mock.calls[0][0]).not.toHaveProperty('business_id');
    expect(supabaseMock.builder.update.mock.calls[0][0]).not.toHaveProperty('id');
    expect(result).toMatchObject({ id: 'contact-1', email: 'new@example.com' });
  });

  it('refuses writes without a project scope', async () => {
    await expect(crmResourceAdapter.query(getResource('crm:leads')!, { businessId: 'business-1', mode: 'cloud' }))
      .rejects.toThrow('CRM records require a selected project.');
    expect(supabaseMock.from).not.toHaveBeenCalled();
  });

  it('routes Cloud CRM edits through ResourceRuntime', async () => {
    supabaseMock.builder.maybeSingle.mockResolvedValue({
      data: { id: 'contact-1', project_id: 'project-1', business_id: 'business-1', email: 'new@example.com' },
      error: null,
    });
    await applyResourceOp({
      op: 'update',
      ref: { resourceKey: 'crm:contacts', kind: 'crm', recordId: 'contact-1' },
      values: { email: 'new@example.com' },
      expected: { updated_at: '2026-10-20T10:00:00.000Z' },
    }, { businessId: 'business-1', projectId: 'project-1', mode: 'cloud' });

    expect(supabaseMock.from).toHaveBeenCalledWith('crm_contacts');
    expect(supabaseMock.builder.eq).toHaveBeenCalledWith('project_id', 'project-1');
    expect(supabaseMock.builder.eq).toHaveBeenCalledWith('updated_at', '2026-10-20T10:00:00.000Z');
  });

  it('keeps CRM resources unavailable to Builder mode', async () => {
    const context = { businessId: 'business-1', projectId: 'project-1', mode: 'builder' as const };
    await expect(queryResource('crm:contacts', context)).rejects.toThrow('CRM records are only available in the Cloud workspace.');
    await expect(applyResourceOp({
      op: 'update',
      ref: { resourceKey: 'crm:contacts', kind: 'crm', recordId: 'contact-1' },
      values: { email: 'new@example.com' },
    }, context)).rejects.toThrow('CRM records are only editable in the Cloud workspace.');
    expect(supabaseMock.from).not.toHaveBeenCalled();
  });
});