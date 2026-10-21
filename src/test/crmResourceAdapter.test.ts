import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const method of ['select', 'update', 'insert', 'delete', 'eq', 'or', 'order', 'limit', 'maybeSingle', 'single']) {
    builder[method] = vi.fn();
  }
  for (const method of ['select', 'update', 'insert', 'delete', 'eq', 'or', 'order', 'limit']) {
    builder[method].mockReturnValue(builder);
  }
  return {
    builder,
    from: vi.fn(() => builder),
    functions: { invoke: vi.fn() },
  };
});

vi.mock('@/integrations/supabase/client', () => ({ supabase: supabaseMock }));
vi.mock('@/services/project-backend/projectBackendGateway', () => ({
  withProjectBackend: async (_projectId: string | null | undefined, run: (descriptor: null) => Promise<unknown>) => run(null),
}));

import { getResource, listProjectCrmResources, listResources } from '@/services/resources/resourceRegistry';
import { crmResourceAdapter } from '@/services/resources/resourceAdapters';
import { applyResourceOp, queryResource } from '@/services/resources/resourceRuntime';
import { createCrmLead } from '../../supabase/functions/_shared/canonicalCrm';

describe('project CRM resource adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers labeled project CRM resources without exposing them to generated-site discovery', () => {
    expect(listProjectCrmResources().map(({ key, label }) => [key, label])).toEqual([
      ['crm:contacts', 'Contacts'],
      ['crm:leads', 'Leads'],
      ['crm:deals', 'Deals'],
      ['crm:workflows', 'Workflows'],
      ['crm:automations', 'Automations'],
    ]);
    expect(getResource('crm:contacts')?.schema.map((field) => field.label)).toContain('Email');
    expect(getResource('crm:leads')?.schema.find((field) => field.key === 'status')?.editable).toBe(true);
    expect(listResources().some((resource) => resource.kind === 'crm')).toBe(false);
  });

  it('filters updates to both project and business and strips identity/scope fields', async () => {
    const contact = { id: 'contact-1', project_id: 'project-1', business_id: 'business-1', email: 'new@example.com' };
    supabaseMock.functions.invoke.mockResolvedValue({ data: { success: true, record: contact }, error: null });

    const result = await crmResourceAdapter.update(
      getResource('crm:contacts')!,
      { businessId: 'business-1', projectId: 'project-1', mode: 'cloud' },
      'contact-1',
      { email: 'new@example.com', id: 'other-id', project_id: 'other-project', business_id: 'other-business' },
      { updated_at: '2026-10-20T10:00:00.000Z' },
    );

    expect(supabaseMock.functions.invoke).toHaveBeenCalledWith('crm-command', { body: {
      resource: 'contacts',
      action: 'update',
      recordId: 'contact-1',
      businessId: 'business-1',
      projectId: 'project-1',
      values: { email: 'new@example.com' },
      expected: { updated_at: '2026-10-20T10:00:00.000Z' },
    } });
    expect(supabaseMock.from).not.toHaveBeenCalled();
    expect(result).toMatchObject({ id: 'contact-1', email: 'new@example.com' });
  });

  it('refuses writes without a project scope', async () => {
    await expect(crmResourceAdapter.query(getResource('crm:leads')!, { businessId: '', mode: 'cloud' }))
      .rejects.toThrow('CRM records require a selected business or project.');
    expect(supabaseMock.from).not.toHaveBeenCalled();
  });

  it('creates and deletes CRM rows through the adapter with trusted scope', async () => {
    supabaseMock.functions.invoke
      .mockResolvedValueOnce({ data: { success: true, record: { id: 'contact-1', project_id: 'project-1', business_id: 'business-1', email: 'new@example.com' } }, error: null })
      .mockResolvedValueOnce({ data: { success: true, deleted: true }, error: null });
    await crmResourceAdapter.create(
      getResource('crm:contacts')!,
      { businessId: 'business-1', projectId: 'project-1', mode: 'cloud' },
      { email: 'new@example.com', business_id: 'attacker-business', project_id: 'attacker-project' },
    );

    expect(supabaseMock.functions.invoke).toHaveBeenNthCalledWith(1, 'crm-command', { body: expect.objectContaining({
      resource: 'contacts',
      action: 'create',
      businessId: 'business-1',
      projectId: 'project-1',
      values: { email: 'new@example.com' },
    }) });
    await crmResourceAdapter.delete(
      getResource('crm:contacts')!,
      { businessId: 'business-1', projectId: 'project-1', mode: 'cloud' },
      'contact-1',
    );
    expect(supabaseMock.functions.invoke).toHaveBeenNthCalledWith(2, 'crm-command', { body: {
      resource: 'contacts',
      action: 'delete',
      recordId: 'contact-1',
      businessId: 'business-1',
      projectId: 'project-1',
    } });
    expect(supabaseMock.from).not.toHaveBeenCalled();
  });

  it('maps UI lead status to the canonical database stage column', async () => {
    supabaseMock.functions.invoke.mockResolvedValue({
      data: { success: true, record: { id: 'lead-1', project_id: 'project-1', business_id: 'business-1', stage: 'qualified' } },
      error: null,
    });
    const result = await crmResourceAdapter.create(
      getResource('crm:leads')!,
      { businessId: 'business-1', projectId: 'project-1', mode: 'cloud' },
      { title: 'New inquiry', status: 'qualified' },
    );

    expect(supabaseMock.functions.invoke).toHaveBeenCalledWith('crm-command', { body: expect.objectContaining({
      resource: 'leads',
      action: 'create',
      values: { title: 'New inquiry', stage: 'qualified' },
    }) });
    expect(result.status).toBe('qualified');
  });

  it('includes same-business shared contacts when viewing a project workspace', async () => {
    supabaseMock.builder.select.mockReturnValueOnce(supabaseMock.builder);
    supabaseMock.builder.order.mockReturnValueOnce(supabaseMock.builder);
    supabaseMock.builder.limit.mockReturnValueOnce(supabaseMock.builder);
    supabaseMock.builder.then = vi.fn((resolve) => resolve({ data: [], error: null }));
    await crmResourceAdapter.query(getResource('crm:contacts')!, {
      businessId: 'business-1',
      projectId: 'project-1',
      mode: 'cloud',
    });
    expect(supabaseMock.builder.eq).toHaveBeenCalledWith('business_id', 'business-1');
    expect(supabaseMock.builder.or).toHaveBeenCalledWith('project_id.eq.project-1,project_id.is.null');
  });

  it('routes Cloud CRM edits through ResourceRuntime', async () => {
    supabaseMock.functions.invoke.mockResolvedValue({
      data: { success: true, record: { id: 'contact-1', project_id: 'project-1', business_id: 'business-1', email: 'new@example.com' } },
      error: null,
    });
    await applyResourceOp({
      op: 'update',
      ref: { resourceKey: 'crm:contacts', kind: 'crm', recordId: 'contact-1' },
      values: { email: 'new@example.com' },
      expected: { updated_at: '2026-10-20T10:00:00.000Z' },
    }, { businessId: 'business-1', projectId: 'project-1', mode: 'cloud' });

    expect(supabaseMock.functions.invoke).toHaveBeenCalledWith('crm-command', expect.objectContaining({
      body: expect.objectContaining({ projectId: 'project-1', expected: { updated_at: '2026-10-20T10:00:00.000Z' } }),
    }));
    expect(supabaseMock.from).not.toHaveBeenCalled();
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

  it('resolves duplicate contact input to the same business-scoped natural-key contact', async () => {
    const calls: Array<{ table: string; operation: string; payload?: Record<string, unknown>; filters: unknown[] }> = [];
    const client = {
      from(table: string) {
        const call = { table, operation: 'select', payload: undefined as Record<string, unknown> | undefined, filters: [] as unknown[] };
        calls.push(call);
        const builder = {
          select() { return builder; },
          eq(column: string, value: unknown) { call.filters.push([column, value]); return builder; },
          or(filter: string) { call.filters.push(['or', filter]); return builder; },
          upsert(payload: Record<string, unknown>, options: Record<string, unknown>) {
            call.operation = 'upsert';
            call.payload = payload;
            call.filters.push(['options', options]);
            return builder;
          },
          insert(payload: Record<string, unknown>) { call.operation = 'insert'; call.payload = payload; return builder; },
          async maybeSingle() {
            if (table === 'businesses') return { data: { id: 'business-1' }, error: null };
            if (table === 'projects') return { data: { business_id: 'business-1' }, error: null };
            if (table === 'crm_contacts' && call.operation === 'upsert') return { data: null, error: null };
            if (table === 'crm_contacts') return { data: { id: 'contact-natural-key' }, error: null };
            return { data: null, error: null };
          },
          async single() { return { data: { id: `lead-${calls.filter((entry) => entry.table === 'crm_leads').length}` }, error: null }; },
        };
        return builder;
      },
    };

    const first = await createCrmLead(client, { businessId: 'business-1', projectId: 'project-1' }, {
      title: 'First inquiry',
      contact: { email: 'Customer@Example.test' },
    });
    const retry = await createCrmLead(client, { businessId: 'business-1', projectId: 'project-1' }, {
      title: 'Repeated inquiry',
      contact: { email: 'customer@example.test' },
    });

    expect(first.contactId).toBe('contact-natural-key');
    expect(retry.contactId).toBe(first.contactId);
    const leadWrites = calls.filter((call) => call.table === 'crm_leads' && call.operation === 'insert');
    expect(leadWrites.map((call) => call.payload?.contact_id)).toEqual(['contact-natural-key', 'contact-natural-key']);
    expect(calls.filter((call) => call.table === 'crm_contacts' && call.operation === 'upsert')).toHaveLength(2);
  });
});